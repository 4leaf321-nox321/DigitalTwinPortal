"""
V2 쓰기 API 통합 시험 (Phase 3-3, 3-4) — 개발 DB 전용.

무엇을 시험하나
    권한 거부, 낙관적 락(충돌/자동병합), 필드 분류, 변경 로그, 진척 이력 연동.
    Flask test_client 로 실제 HTTP 경로를 탄다 (라우트·JWT·트랜잭션까지 함께 검증).

안전장치
    시험용 과제를 **직접 만들어** 쓰고, 끝나면 지운다.
    기존 dt2_projects 행은 건드리지 않는다. 마지막에 건수를 대조한다.

사용법
    python scripts\\dt3_test_api.py
"""

from __future__ import annotations

import os
import sys
import uuid as uuidlib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.modules.auth.models import User, UserRole
from app.modules.digital_twin_dashboard.models_v2 import (
    Dt2Project, Dt2ProjectChange, Dt2ProjectHistory,
)

from flask_jwt_extended import create_access_token

MARK = '__dt3_api_test__'
results = []


def check(desc, cond, extra=''):
    results.append((desc, bool(cond)))
    print(f"  {'[OK]  ' if cond else '[FAIL]'} {desc}" + (f"   {extra}" if not cond and extra else ''))


def auth(user):
    return {'Authorization': f'Bearer {create_access_token(identity=str(user.id))}',
            'X-DT2-Allow-Write': 'test'}


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        client = app.test_client()

        before_count = Dt2Project.query.count()

        admin = User.query.filter_by(role=UserRole.ADMIN, is_active=True).first()
        if admin is None:
            print('[FAIL] admin 사용자가 없어 시험할 수 없습니다.')
            sys.exit(1)
        outsider = (User.query
                    .filter(User.is_active.is_(True), User.id != admin.id,
                            User.role.in_([UserRole.USER, UserRole.VIEWER]))
                    .first())

        # ── 시험용 과제 생성 ────────────────────────────────────────────────
        puid = str(uuidlib.uuid4())
        proj = Dt2Project(
            uuid=puid, code=MARK, title=f'{MARK} 원본제목',
            status='정상진행', progress=10, year=2026,
            start_month=1, end_month=12,
            division_id=None, owner_user_id=admin.id,
            action_items_json=[], issues_json=[],
            is_deleted=False, is_permanently_deleted=False,
            row_version=1, extra_fields={},
        )
        db.session.add(proj)
        db.session.commit()
        print(f"\n시험용 과제 생성: {puid[:8]}  (row_version=1)")

        try:
            print("\n── 읽기 ──")
            r = client.get(f'/api/dt-v2/projects/{puid}', headers=auth(admin))
            check('GET 단건 200', r.status_code == 200, f'실제 {r.status_code}')
            body = r.get_json()['data']
            check('canEdit=True (admin)', body.get('canEdit') is True)
            check('rowVersion=1', body.get('rowVersion') == 1, f"실제 {body.get('rowVersion')}")

            r = client.get('/api/dt-v2/projects', headers=auth(admin))
            check('GET 목록 200', r.status_code == 200)

            print("\n── 인증 ──")
            r = client.get(f'/api/dt-v2/projects/{puid}')
            check('토큰 없으면 401', r.status_code == 401, f'실제 {r.status_code}')

            print("\n── 필드 분류 ──")
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'made_up_field': 1}}, headers=auth(admin))
            check('★ 모르는 필드 400', r.status_code == 400, f'실제 {r.status_code}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'row_version': 99}}, headers=auth(admin))
            check('★ row_version 직접 수정 400', r.status_code == 400, f'실제 {r.status_code}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {}}, headers=auth(admin))
            check('빈 패치 400', r.status_code == 400, f'실제 {r.status_code}')

            print("\n── 정상 수정 ──")
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 50}, 'expected_version': 1},
                             headers=auth(admin))
            check('저위험 필드 200', r.status_code == 200, f'실제 {r.status_code}')
            d = r.get_json()['data']
            check('applied=[progress]', d.get('applied') == ['progress'], f"실제 {d.get('applied')}")
            check('rowVersion 2로 증가', d.get('rowVersion') == 2, f"실제 {d.get('rowVersion')}")

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 50}, 'expected_version': 2},
                             headers=auth(admin))
            check('★ 같은 값 재전송은 버전 안 올림',
                  r.get_json()['data'].get('rowVersion') == 2,
                  f"실제 {r.get_json()['data'].get('rowVersion')}")

            print("\n── 낙관적 락 ──")
            # 현재 v2. 낡은 버전 1을 들고 같은 필드(progress)를 고치려 하면 충돌
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 77}, 'expected_version': 1},
                             headers=auth(admin))
            check('★ 같은 필드 충돌 409', r.status_code == 409, f'실제 {r.status_code}')

            # 낡은 버전이지만 **다른 필드**면 자동 병합
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'title': f'{MARK} 바뀐제목'}, 'expected_version': 1},
                             headers=auth(admin))
            check('★ 안 겹치는 필드는 자동 병합 200', r.status_code == 200, f'실제 {r.status_code}')

            print("\n── 권한 ──")
            if outsider is None:
                print('  (건너뜀) 일반 사용자 계정이 없어 403 경로를 시험할 수 없습니다.')
            else:
                r = client.patch(f'/api/dt-v2/projects/{puid}',
                                 json={'patch': {'progress': 1}}, headers=auth(outsider))
                check('★ 남의 과제 수정 403', r.status_code == 403, f'실제 {r.status_code}')
                r = client.get(f'/api/dt-v2/projects/{puid}', headers=auth(outsider))
                check('읽기는 허용', r.status_code == 200, f'실제 {r.status_code}')
                check('canEdit=False', r.get_json()['data'].get('canEdit') is False)

            print("\n── AI 경로 ──")
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 60}, 'actor_mode': 'ai',
                                   'reason': '테스트'},
                             headers=auth(admin))
            check('AI + 저위험 → 즉시 반영 200', r.status_code == 200, f'실제 {r.status_code}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'status': '완료'}, 'actor_mode': 'ai',
                                   'reason': '테스트'},
                             headers=auth(admin))
            check('★ AI + 핵심 → 202 제안', r.status_code == 202, f'실제 {r.status_code}')
            d = r.get_json()['data']
            check('제안 id 반환', d.get('proposalId') is not None)
            db.session.expire_all()
            fresh = Dt2Project.query.filter_by(uuid=puid).first()
            check('★ 핵심 필드가 즉시 반영되지 않음', fresh.status == '정상진행',
                  f'실제 {fresh.status}')

            print("\n── 변경 로그 · 이력 ──")
            r = client.get(f'/api/dt-v2/projects/{puid}/changes', headers=auth(admin))
            check('변경 로그 200', r.status_code == 200)
            logs = r.get_json()['data']
            fields = {l['field'] for l in logs}
            check('progress·title 변경이 기록됨', {'progress', 'title'} <= fields, f'실제 {fields}')
            prog = [l for l in logs if l['field'] == 'progress']
            check('before/after 가 담김',
                  any(l['before'] is not None and l['after'] is not None for l in prog))

            hist = (Dt2ProjectHistory.query.filter_by(project_uuid=puid)
                    .order_by(Dt2ProjectHistory.observed_at).all())
            check('★ 진척 이력이 쌓임', len(hist) >= 2, f'실제 {len(hist)}행')
            check('change_kind 에 api 포함', any(h.change_kind in ('ui', 'ai') for h in hist),
                  f'실제 {[h.change_kind for h in hist]}')

        finally:
            # ── 정리 ────────────────────────────────────────────────────────
            print("\n── 정리 ──")
            Dt2ProjectChange.query.filter_by(project_uuid=puid).delete()
            Dt2ProjectHistory.query.filter_by(project_uuid=puid).delete()
            from app.modules.digital_twin_dashboard.models_v2 import Dt2ChangeProposal
            Dt2ChangeProposal.query.filter_by(project_uuid=puid).delete()
            Dt2Project.query.filter_by(uuid=puid).delete()
            db.session.commit()
            after_count = Dt2Project.query.count()
            check('기존 과제 건수 불변', after_count == before_count,
                  f'{before_count} -> {after_count}')

        failed = [d for d, ok in results if not ok]
        print("\n" + "=" * 72)
        if failed:
            print(f" 결과: [FAIL] {len(failed)}건 실패")
            for d in failed:
                print(f"   - {d}")
            print("=" * 72)
            sys.exit(1)
        print(f" 결과: [OK] {len(results)}건 전부 통과")
        print("=" * 72)


if __name__ == '__main__':
    main()
