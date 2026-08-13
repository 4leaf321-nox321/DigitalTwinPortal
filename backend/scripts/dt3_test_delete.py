"""
삭제 / 복구 API 시험 — 개발 DB 전용.

V1 은 이 경로들에 **권한 검사가 없었다.** 로그인만 하면 남의 과제도 지울 수 있었다.
Phase 3 가 고치는 지점이라, "거부돼야 하는데 통과하는" 경우를 집중적으로 본다.

성과 삭제는 V1 과 같이 **연결된 모든 과제에서 참조도 제거**한다.
남의 과제에서도 사라지므로 그 파급이 응답·로그에 남는지 확인한다.

사용법
    python scripts\\dt3_test_delete.py
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
    Dt2ProjectChange, Dt2ProjectHistory, Dt2PerformanceHistory,
)
from flask_jwt_extended import create_access_token

MARK = '__dt3_del_test__'
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

        owner = User(email=f'{MARK}_o@t.local', name=f'{MARK} 소유자',
                     role=UserRole.USER, is_active=True)
        owner.set_password('x' * 16)
        stranger = User(email=f'{MARK}_s@t.local', name=f'{MARK} 무관',
                        role=UserRole.USER, is_active=True)
        stranger.set_password('x' * 16)
        db.session.add_all([owner, stranger]); db.session.commit()

        pA, pB = str(uuidlib.uuid4()), str(uuidlib.uuid4())
        fid = None
        try:
            for u, c, own in ((pA, MARK + '-A', owner.id), (pB, MARK + '-B', admin.id)):
                db.session.add(Dt2Project(uuid=u, code=c, title=c, status='정상진행',
                                          owner_user_id=own, row_version=1,
                                          extra_fields={}, is_deleted=False,
                                          is_permanently_deleted=False))
            db.session.commit()

            print("\n── ★ 과제 삭제 권한 ──")
            r = client.post(f'/api/dt-v2/projects/{pA}/delete', headers=auth(stranger))
            check('★ 남의 과제 삭제 403', r.status_code == 403, f'실제 {r.status_code}')
            db.session.expire_all()
            check('★ 실제로 안 지워짐',
                  Dt2Project.query.filter_by(uuid=pA).first().is_deleted is False)

            r = client.post(f'/api/dt-v2/projects/{pA}/delete', headers=auth(owner))
            check('소유자는 삭제 가능', r.status_code == 200, f'실제 {r.status_code}')
            r = client.post(f'/api/dt-v2/projects/{pA}/delete', headers=auth(owner))
            check('두 번 삭제 400', r.status_code == 400, f'실제 {r.status_code}')

            print("\n── 복구 ──")
            r = client.post(f'/api/dt-v2/projects/{pA}/restore', headers=auth(stranger))
            check('★ 남이 복구 403', r.status_code == 403, f'실제 {r.status_code}')
            r = client.post(f'/api/dt-v2/projects/{pA}/restore', headers=auth(owner))
            check('소유자는 복구 가능', r.status_code == 200, f'실제 {r.status_code}')
            db.session.expire_all()
            check('복구 반영됨',
                  Dt2Project.query.filter_by(uuid=pA).first().is_deleted is False)
            r = client.post(f'/api/dt-v2/projects/{pA}/restore', headers=auth(owner))
            check('삭제 안 된 것 복구 400', r.status_code == 400, f'실제 {r.status_code}')

            print("\n── ★ 영구 삭제는 관리자만 ──")
            r = client.delete(f'/api/dt-v2/projects/{pA}', headers=auth(owner))
            check('★ 소유자여도 영구삭제 403', r.status_code == 403, f'실제 {r.status_code}')
            r = client.delete(f'/api/dt-v2/projects/{pA}', headers=auth(admin))
            check('admin 은 가능', r.status_code == 200, f'실제 {r.status_code}')
            db.session.expire_all()
            check('영구삭제 반영',
                  Dt2Project.query.filter_by(uuid=pA).first().is_permanently_deleted)
            r = client.post(f'/api/dt-v2/projects/{pA}/restore', headers=auth(admin))
            check('★ 영구삭제는 복구 불가 400', r.status_code == 400, f'실제 {r.status_code}')
            r = client.patch(f'/api/dt-v2/projects/{pA}',
                             json={'patch': {'progress': 1}}, headers=auth(admin))
            check('★ 영구삭제 과제는 수정도 403', r.status_code == 403, f'실제 {r.status_code}')

            print("\n── ★ 성과 삭제는 다른 과제의 연결도 끊는다 ──")
            r = client.post('/api/dt-v2/performances',
                            # 대분류·소분류는 2026-08-03 부터 생성 시 필수다(400).
                            json={'fields': {'title': f'{MARK} 성과', 'unit': '건',
                                             'category': '품질향상',
                                             'subcategory': '예측 정확도'}},
                            headers=auth(admin))
            fid = r.get_json()['data']['uuid']
            db.session.add(Dt2ProjectPerformance(
                project_uuid=pB, performance_uuid=fid, position=0,
                extra_fields={'uuid': fid}))
            db.session.commit()

            r = client.delete(f'/api/dt-v2/performances/{fid}', headers=auth(stranger))
            check('★ 무관한 사람은 성과 삭제 403', r.status_code == 403,
                  f'실제 {r.status_code}')

            r = client.delete(f'/api/dt-v2/performances/{fid}', headers=auth(admin))
            check('admin 삭제 200', r.status_code == 200, f'실제 {r.status_code}')
            d = r.get_json()['data']
            check('★ 영향받은 과제가 응답에 담김',
                  len(d.get('unlinkedProjects') or []) == 1,
                  f"실제 {d.get('unlinkedProjects')}")
            check('★ 연결이 실제로 끊김',
                  Dt2ProjectPerformance.query.filter_by(performance_uuid=fid).count() == 0)
            logs = Dt2ProjectChange.query.filter_by(
                project_uuid=pB, field='performance_links').count()
            check('★ 그 과제의 변경 로그에 남음', logs >= 1, f'실제 {logs}건')

            print("\n── 성과 복구 ──")
            r = client.post(f'/api/dt-v2/performances/{fid}/restore', headers=auth(stranger))
            check('★ 남이 복구 403', r.status_code == 403, f'실제 {r.status_code}')
            r = client.post(f'/api/dt-v2/performances/{fid}/restore', headers=auth(admin))
            check('admin 복구 200', r.status_code == 200, f'실제 {r.status_code}')
            check('★ 연결은 되살아나지 않음 (안내대로)',
                  Dt2ProjectPerformance.query.filter_by(performance_uuid=fid).count() == 0)

            print("\n── 조회에서 빠지는가 ──")
            r = client.get('/api/dt-v2/projects', headers=auth(admin))
            uuids = {i['uuid'] for i in r.get_json()['data']['items']}
            check('★ 영구삭제 과제는 목록에 없음', pA not in uuids)

        finally:
            print("\n── 정리 ──")
            for u in (pA, pB):
                Dt2ProjectPerformance.query.filter_by(project_uuid=u).delete()
                Dt2ProjectChange.query.filter_by(project_uuid=u).delete()
                Dt2ProjectHistory.query.filter_by(project_uuid=u).delete()
                Dt2Project.query.filter_by(uuid=u).delete()
            if fid:
                Dt2ProjectPerformance.query.filter_by(performance_uuid=fid).delete()
                Dt2PerformanceHistory.query.filter_by(performance_uuid=fid).delete()
                Dt2Performance.query.filter_by(uuid=fid).delete()
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
