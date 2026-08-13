"""
성과 쓰기 API 시험 (실행계획 7.5-2) — 개발 DB 전용.

핵심 규칙 (2026-07-29 결정)
    **연결된 과제를 고칠 수 있으면 그 성과도 고칠 수 있다.**

    이 규칙은 "권한이 없던 사람에게 권한이 생기는" 방향이라, 잘못 구현하면
    조용히 너무 넓게 열린다. 그래서 **거부돼야 하는 경우**를 집중적으로 본다.
        - 연결이 없는 성과를 남이 고치려 할 때
        - 연결은 있지만 그 과제를 못 고치는 사람일 때
        - 연결된 과제가 삭제된 경우

    그리고 성과는 여러 과제가 공유하므로 affectedProjects 가 맞는지도 본다.

시험용 사용자·과제·성과를 만들어 쓰고 끝나면 지운다.

사용법
    python scripts\\dt3_test_performance.py
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
    Dt2ProjectHistory, Dt2PerformanceHistory, Dt2ProjectChange,
)
from flask_jwt_extended import create_access_token

MARK = '__dt3_perf_test__'
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
        if admin is None:
            print('[FAIL] admin 사용자가 없습니다.')
            sys.exit(1)

        # 과제 소유자(권한 있음) / 무관한 사람(권한 없음)
        owner = User(email=f'{MARK}_owner@t.local', name=f'{MARK} 소유자',
                     role=UserRole.USER, is_active=True)
        owner.set_password('x' * 16)
        stranger = User(email=f'{MARK}_out@t.local', name=f'{MARK} 무관',
                        role=UserRole.USER, is_active=True)
        stranger.set_password('x' * 16)
        db.session.add_all([owner, stranger]); db.session.commit()

        puid, puid2 = str(uuidlib.uuid4()), str(uuidlib.uuid4())
        linked_uuid = unlinked_uuid = None
        try:
            # 과제 2개 — 둘 다 owner 소유
            for u, code in ((puid, MARK + '-1'), (puid2, MARK + '-2')):
                db.session.add(Dt2Project(
                    uuid=u, code=code, title=f'{code}', status='정상진행',
                    owner_user_id=owner.id, row_version=1, extra_fields={},
                    is_deleted=False, is_permanently_deleted=False))
            db.session.commit()

            print("\n── 성과 생성 ──")
            # ⚠️ 2026-08-03 부터 **대분류·소분류가 생성 시 필수**이고 짝이 맞아야 한다
            #    (비면 화면에서 `미분류` 로 떨어져서). 빠뜨리면 400 이고, 그러면 이
            #    스크립트는 첫 줄에서 죽어 **나머지 검사가 통째로 안 돈다.**
            r = client.post('/api/dt-v2/performances',
                            json={'fields': {'title': f'{MARK} 성과', 'unit': '건',
                                             'category': '품질향상',
                                             'subcategory': '예측 정확도',
                                             'current_level': 10, 'target_level': 30}},
                            headers=auth(owner))
            check('POST 201', r.status_code == 201, f'실제 {r.status_code}')
            unlinked_uuid = r.get_json()['data']['uuid']
            check('생성자 기록됨',
                  r.get_json()['data']['createdByUserId'] == owner.id)

            print("\n── ★ 아직 과제에 안 붙은 성과 ──")
            r = client.patch(f'/api/dt-v2/performances/{unlinked_uuid}',
                             json={'patch': {'actual_level': '15'}}, headers=auth(owner))
            check('생성자는 고칠 수 있다', r.status_code == 200, f'실제 {r.status_code}')
            r = client.patch(f'/api/dt-v2/performances/{unlinked_uuid}',
                             json={'patch': {'actual_level': '99'}}, headers=auth(stranger))
            check('★ 남은 못 고친다 (연결이 없으므로)', r.status_code == 403,
                  f'실제 {r.status_code}')

            # 연결된 성과 준비
            r = client.post('/api/dt-v2/performances',
                            json={'fields': {'title': f'{MARK} 연결성과', 'unit': '건',
                                             'category': '품질향상',
                                             'subcategory': '예측 정확도'}},
                            headers=auth(admin))
            linked_uuid = r.get_json()['data']['uuid']
            db.session.add(Dt2ProjectPerformance(
                project_uuid=puid, performance_uuid=linked_uuid,
                position=0, extra_fields={'uuid': linked_uuid}))
            db.session.commit()

            print("\n── ★ 연결된 과제 기준 권한 ──")
            r = client.get(f'/api/dt-v2/performances/{linked_uuid}', headers=auth(owner))
            check('canEdit=True (연결 과제 소유자)',
                  r.get_json()['data'].get('canEdit') is True)
            check('affectedProjects=1', r.get_json()['data'].get('affectedProjects') == 1,
                  f"실제 {r.get_json()['data'].get('affectedProjects')}")

            r = client.patch(f'/api/dt-v2/performances/{linked_uuid}',
                             json={'patch': {'actual_level': '7'}}, headers=auth(owner))
            check('연결 과제 소유자는 수정 가능', r.status_code == 200, f'실제 {r.status_code}')

            r = client.get(f'/api/dt-v2/performances/{linked_uuid}', headers=auth(stranger))
            check('★ 무관한 사람 canEdit=False',
                  r.get_json()['data'].get('canEdit') is False)
            r = client.patch(f'/api/dt-v2/performances/{linked_uuid}',
                             json={'patch': {'actual_level': '99'}}, headers=auth(stranger))
            check('★ 무관한 사람 403', r.status_code == 403, f'실제 {r.status_code}')

            print("\n── ★ 공유 성과의 파급 범위 ──")
            db.session.add(Dt2ProjectPerformance(
                project_uuid=puid2, performance_uuid=linked_uuid,
                position=0, extra_fields={'uuid': linked_uuid}))
            db.session.commit()
            r = client.patch(f'/api/dt-v2/performances/{linked_uuid}',
                             json={'patch': {'actual_level': '8'}}, headers=auth(owner))
            check('★ affectedProjects=2 로 보고됨',
                  r.get_json()['data'].get('affectedProjects') == 2,
                  f"실제 {r.get_json()['data'].get('affectedProjects')}")

            print("\n── ★ 연결 과제가 삭제되면 ──")
            Dt2Project.query.filter_by(uuid=puid).update({'is_deleted': True})
            Dt2Project.query.filter_by(uuid=puid2).update({'is_deleted': True})
            db.session.commit()
            r = client.patch(f'/api/dt-v2/performances/{linked_uuid}',
                             json={'patch': {'actual_level': '9'}}, headers=auth(owner))
            check('★ 삭제된 과제로는 권한이 안 생긴다', r.status_code == 403,
                  f'실제 {r.status_code}')
            Dt2Project.query.filter(Dt2Project.uuid.in_([puid, puid2]))\
                .update({'is_deleted': False}, synchronize_session=False)
            db.session.commit()

            print("\n── 필드 분류 ──")
            r = client.patch(f'/api/dt-v2/performances/{linked_uuid}',
                             json={'patch': {'legacy_uuid': 'x'}}, headers=auth(admin))
            check('★ legacy_uuid 는 불변 400', r.status_code == 400, f'실제 {r.status_code}')
            r = client.patch(f'/api/dt-v2/performances/{linked_uuid}',
                             json={'patch': {'made_up': 1}}, headers=auth(admin))
            check('모르는 필드 400', r.status_code == 400, f'실제 {r.status_code}')

            print("\n── ★ AI 는 핵심 필드 금지 ──")
            r = client.patch(f'/api/dt-v2/performances/{linked_uuid}',
                             json={'patch': {'actual_level': '11'}, 'actor_mode': 'ai'},
                             headers=auth(admin))
            check('AI + 저위험 허용', r.status_code == 200, f'실제 {r.status_code}')
            # 2026-08-05: 핵심은 403 → **202**(확인 후 반영). 여기서 볼 것은
            # **그 자리에서 반영되지 않는다**는 것이다 — 202 로 새는 게 아니라 대기다.
            before_tgt = Dt2Performance.query.filter_by(uuid=linked_uuid).first().target_level
            r = client.patch(f'/api/dt-v2/performances/{linked_uuid}',
                             json={'patch': {'target_level': 999}, 'actor_mode': 'ai'},
                             headers=auth(admin))
            check('★ AI + 목표수준 202', r.status_code == 202, f'실제 {r.status_code}')
            db.session.expire_all()
            check('★ 그 자리에서 반영되지 않는다',
                  Dt2Performance.query.filter_by(uuid=linked_uuid).first().target_level
                  == before_tgt, '즉시 반영돼 버렸다')
            db.session.expire_all()
            fresh = Dt2Performance.query.filter_by(uuid=linked_uuid).first()
            check('★ 목표수준이 안 바뀜', fresh.target_level is None,
                  f'실제 {fresh.target_level}')

            print("\n── 낙관적 락 · 이력 ──")
            cur_v = fresh.row_version
            r = client.patch(f'/api/dt-v2/performances/{linked_uuid}',
                             json={'patch': {'actual_level': '12'},
                                   'expected_version': cur_v - 1}, headers=auth(admin))
            check('버전 어긋나면 409', r.status_code == 409, f'실제 {r.status_code}')

            hist = Dt2PerformanceHistory.query.filter_by(
                performance_uuid=linked_uuid).count()
            check('★ 성과 이력이 쌓임', hist >= 2, f'실제 {hist}행')

        finally:
            print("\n── 정리 ──")
            for u in (linked_uuid, unlinked_uuid):
                if u:
                    Dt2ProjectPerformance.query.filter_by(performance_uuid=u).delete()
                    Dt2PerformanceHistory.query.filter_by(performance_uuid=u).delete()
                    Dt2Performance.query.filter_by(uuid=u).delete()
            for u in (puid, puid2):
                Dt2ProjectChange.query.filter_by(project_uuid=u).delete()
                Dt2ProjectHistory.query.filter_by(project_uuid=u).delete()
                Dt2Project.query.filter_by(uuid=u).delete()
            db.session.commit()
            User.query.filter(User.id.in_([owner.id, stranger.id]))\
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
