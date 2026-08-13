"""
V2 API 경계·악용 시험 — 개발 DB 전용.

기존 스위트는 "정상 경로" 와 "대표적인 거부" 를 본다.
이 파일은 그 사이에 남은 구석을 판다.

    A. 권한 우회      on_behalf_of 로 남의 권한을 빌릴 수 있는가 ★
    B. 인증           죽은 토큰 · 없는 사용자 · 비활성 사용자
    C. 타입/경계      숫자 자리에 문자열, 범위 밖 값, 초장문, null
    D. 동시성         낡은 버전 + 겹치지 않는 필드, 겹치는 필드
    E. 엔티티 간 상태 삭제된 대상에 연결/수정 시도

"통과하면 좋은 것" 이 아니라 **"막혀야 하는데 뚫리는 것"** 을 찾는 게 목적이다.

사용법
    python scripts\\dt3_test_edge.py
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
    Dt2Project, Dt2Performance, Dt2ProjectPerformance,
    Dt2ProjectChange, Dt2ProjectHistory, Dt2PerformanceHistory, Dt2ChangeProposal,
)
from flask_jwt_extended import create_access_token
from sqlalchemy import or_

MARK = '__dt3_edge__'
results = []


def check(desc, cond, extra=''):
    results.append((desc, bool(cond)))
    print(f"  {'[OK]  ' if cond else '[FAIL]'} {desc}" + (f"   {extra}" if not cond and extra else ''))


def auth(u):
    # 컷오버 전 쓰기 차단을 시험에서는 통과시킨다 (config.DT2_ALLOW_TEST_WRITE_HEADER)
    return {'Authorization': f'Bearer {create_access_token(identity=str(u.id))}',
            'X-DT2-Allow-Write': 'test'}


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        client = app.test_client()
        n_proj, n_perf, n_user = (Dt2Project.query.count(),
                                  Dt2Performance.query.count(), User.query.count())
        admin = User.query.filter_by(role=UserRole.ADMIN, is_active=True).first()

        # 앞선 실행이 중간에 죽었으면 시험 데이터가 남아 있다. 먼저 치운다.
        # **변경 로그가 users 를 FK 로 참조**하므로 사용자보다 먼저 지워야 한다.
        stale = User.query.filter(User.email.like(f'{MARK}%')).all()
        if stale:
            print(f"이전 실행 잔여 계정 {len(stale)}건 정리")
            ids = [u.id for u in stale]
            Dt2ProjectChange.query.filter(
                or_(Dt2ProjectChange.actor_user_id.in_(ids),
                    Dt2ProjectChange.on_behalf_of.in_(ids))).delete(
                synchronize_session=False)
            Dt2ChangeProposal.query.filter(
                or_(Dt2ChangeProposal.proposed_by.in_(ids),
                    Dt2ChangeProposal.on_behalf_of.in_(ids),
                    Dt2ChangeProposal.reviewed_by.in_(ids))).delete(
                synchronize_session=False)
            Dt2Performance.query.filter(
                Dt2Performance.created_by_user_id.in_(ids)).update(
                {'created_by_user_id': None}, synchronize_session=False)
            Dt2Project.query.filter(Dt2Project.owner_user_id.in_(ids)).update(
                {'owner_user_id': None}, synchronize_session=False)
            db.session.flush()
            for u in stale:
                db.session.delete(u)
            db.session.commit()
            n_user = User.query.count()
        stale_p = Dt2Project.query.filter(Dt2Project.code.like(f'{MARK}%')).all()
        for sp in stale_p:
            Dt2ProjectPerformance.query.filter_by(project_uuid=sp.uuid).delete()
            Dt2ChangeProposal.query.filter_by(project_uuid=sp.uuid).delete()
            Dt2ProjectChange.query.filter_by(project_uuid=sp.uuid).delete()
            Dt2ProjectHistory.query.filter_by(project_uuid=sp.uuid).delete()
            db.session.delete(sp)
        stale_f = Dt2Performance.query.filter(Dt2Performance.title.like(f'{MARK}%')).all()
        for sf in stale_f:
            Dt2ProjectPerformance.query.filter_by(performance_uuid=sf.uuid).delete()
            Dt2PerformanceHistory.query.filter_by(performance_uuid=sf.uuid).delete()
            db.session.delete(sf)
        if stale_p or stale_f:
            db.session.commit()
            n_proj, n_perf = Dt2Project.query.count(), Dt2Performance.query.count()

        outsider = User(email=f'{MARK}_out@t.local', name=f'{MARK}무관',
                        role=UserRole.USER, is_active=True)
        outsider.set_password('x' * 16)
        inactive = User(email=f'{MARK}_off@t.local', name=f'{MARK}비활성',
                        role=UserRole.ADMIN, is_active=False)
        inactive.set_password('x' * 16)
        db.session.add_all([outsider, inactive]); db.session.commit()

        puid = str(uuidlib.uuid4())
        fid = None
        try:
            db.session.add(Dt2Project(
                uuid=puid, code=MARK, title=MARK, status='정상진행', progress=10,
                owner_user_id=admin.id, row_version=1, extra_fields={},
                is_deleted=False, is_permanently_deleted=False))
            db.session.commit()

            # ── A. 권한 우회 ────────────────────────────────────────────────
            print("\n── A. on_behalf_of 로 권한을 빌릴 수 있는가 ──")
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 99},
                                   'on_behalf_of': admin.id},
                             headers=auth(outsider))
            check('★★ 일반 사용자가 admin 을 사칭해 수정 → 막혀야 함',
                  r.status_code == 403, f'실제 {r.status_code}')
            db.session.expire_all()
            check('★★ 실제로 안 바뀌어야 함',
                  Dt2Project.query.filter_by(uuid=puid).first().progress == 10,
                  f'실제 {Dt2Project.query.filter_by(uuid=puid).first().progress}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 98},
                                   'on_behalf_of': outsider.id},
                             headers=auth(admin))
            check('admin 이 남을 대신하는 건 허용되지만 그 사람 권한으로 판단',
                  r.status_code == 403, f'실제 {r.status_code}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 11},
                                   'on_behalf_of': 99999999},
                             headers=auth(admin))
            check('없는 사용자 대리 400', r.status_code == 400, f'실제 {r.status_code}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 11},
                                   'on_behalf_of': inactive.id},
                             headers=auth(admin))
            check('비활성 사용자 대리 400', r.status_code == 400, f'실제 {r.status_code}')

            # ── B. 인증 ────────────────────────────────────────────────────
            print("\n── B. 인증 ──")
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 1}},
                             headers={'Authorization': 'Bearer 엉터리토큰'})
            check('망가진 토큰 401/422', r.status_code in (401, 422), f'실제 {r.status_code}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 1}},
                             headers={'Authorization': f'Bearer {create_access_token(identity="99999999")}'})
            check('★ 없는 사용자 토큰 401', r.status_code == 401, f'실제 {r.status_code}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 1}}, headers=auth(inactive))
            check('★ 비활성 사용자 토큰 401', r.status_code == 401, f'실제 {r.status_code}')

            # ── C. 타입 / 경계 ──────────────────────────────────────────────
            print("\n── C. 타입 · 경계값 ──")
            for val, desc in ((-5, '음수 진행률'), (150, '100 초과 진행률')):
                r = client.patch(f'/api/dt-v2/projects/{puid}',
                                 json={'patch': {'progress': val}}, headers=auth(admin))
                check(f'{desc}({val}) 처리됨 (400 또는 200)',
                      r.status_code in (200, 400), f'실제 {r.status_code}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 'abc'}}, headers=auth(admin))
            check('★ 숫자 컬럼에 문자열 — 500 이면 안 됨',
                  r.status_code != 500, f'실제 {r.status_code}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'title': 'ㄱ' * 2000}}, headers=auth(admin))
            check('★ 컬럼 길이(500) 초과 — 500 이면 안 됨',
                  r.status_code != 500, f'실제 {r.status_code}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'action_items_json': 'not-a-list'}},
                             headers=auth(admin))
            check('JSON 컬럼에 문자열 — 500 이면 안 됨',
                  r.status_code != 500, f'실제 {r.status_code}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'title': None}}, headers=auth(admin))
            check('null 값 — 500 이면 안 됨', r.status_code != 500, f'실제 {r.status_code}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'title': "'; DROP TABLE dt2_projects; --"}},
                             headers=auth(admin))
            check('SQL 문자열이 그냥 값으로 저장됨', r.status_code == 200,
                  f'실제 {r.status_code}')
            check('★ 테이블이 살아있음', Dt2Project.query.count() >= 1)

            r = client.patch(f'/api/dt-v2/projects/{puid}', json={},
                             headers=auth(admin))
            check('본문 없음 400', r.status_code == 400, f'실제 {r.status_code}')
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': []}, headers=auth(admin))
            check('patch 가 배열이면 400', r.status_code == 400, f'실제 {r.status_code}')

            # ── D. 동시성 ──────────────────────────────────────────────────
            print("\n── D. 동시성 ──")
            db.session.expire_all()
            base = Dt2Project.query.filter_by(uuid=puid).first().row_version
            client.patch(f'/api/dt-v2/projects/{puid}',
                         json={'patch': {'status': '완료'}}, headers=auth(admin))
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'description': '다른 필드'},
                                   'expected_version': base}, headers=auth(admin))
            check('★ 낡은 버전 + 안 겹치는 필드 → 자동 병합 200',
                  r.status_code == 200, f'실제 {r.status_code}')
            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'status': '지연'},
                                   'expected_version': base}, headers=auth(admin))
            check('★ 낡은 버전 + 겹치는 필드 → 409',
                  r.status_code == 409, f'실제 {r.status_code}')

            r = client.patch(f'/api/dt-v2/projects/{puid}',
                             json={'patch': {'progress': 5},
                                   'expected_version': 'abc'}, headers=auth(admin))
            check('expected_version 이 문자열 — 500 이면 안 됨',
                  r.status_code != 500, f'실제 {r.status_code}')

            # ── E. 엔티티 간 상태 ───────────────────────────────────────────
            print("\n── E. 삭제된 대상 ──")
            r = client.post('/api/dt-v2/performances',
                            # 대분류·소분류는 2026-08-03 부터 생성 시 필수다(400).
                            json={'fields': {'title': f'{MARK} 성과',
                                             'category': '품질향상',
                                             'subcategory': '예측 정확도'}},
                            headers=auth(admin))
            fid = r.get_json()['data']['uuid']
            client.delete(f'/api/dt-v2/performances/{fid}', headers=auth(admin))

            r = client.put(f'/api/dt-v2/projects/{puid}/performances',
                           json={'items': [{'performanceUuid': fid}]}, headers=auth(admin))
            check('★ 삭제된 성과에 연결 시도', r.status_code in (200, 400),
                  f'실제 {r.status_code}')
            r = client.patch(f'/api/dt-v2/performances/{fid}',
                             json={'patch': {'actual_level': '1'}}, headers=auth(admin))
            check('★ 삭제된 성과 수정 403', r.status_code == 403, f'실제 {r.status_code}')

            r = client.put('/api/dt-v2/projects/%s/performances' % uuidlib.uuid4(),
                           json={'items': []}, headers=auth(admin))
            check('없는 과제에 연결 404', r.status_code == 404, f'실제 {r.status_code}')

            r = client.get(f'/api/dt-v2/projects/{uuidlib.uuid4()}', headers=auth(admin))
            check('없는 과제 조회 404', r.status_code == 404, f'실제 {r.status_code}')

        finally:
            print("\n── 정리 ──")
            Dt2ProjectPerformance.query.filter_by(project_uuid=puid).delete()
            Dt2ChangeProposal.query.filter_by(project_uuid=puid).delete()
            Dt2ProjectChange.query.filter_by(project_uuid=puid).delete()
            Dt2ProjectHistory.query.filter_by(project_uuid=puid).delete()
            Dt2Project.query.filter_by(uuid=puid).delete()
            if fid:
                Dt2ProjectPerformance.query.filter_by(performance_uuid=fid).delete()
                Dt2PerformanceHistory.query.filter_by(performance_uuid=fid).delete()
                Dt2Performance.query.filter_by(uuid=fid).delete()
            db.session.commit()
            User.query.filter(User.id.in_([outsider.id, inactive.id]))\
                .delete(synchronize_session=False)
            db.session.commit()
            check('과제 건수 불변', Dt2Project.query.count() == n_proj)
            check('성과 건수 불변', Dt2Performance.query.count() == n_perf)
            check('사용자 건수 불변', User.query.count() == n_user)

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
