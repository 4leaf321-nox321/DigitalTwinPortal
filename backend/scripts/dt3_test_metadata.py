"""
metadata API 시험 — 개발 DB 전용.

여기서 고치는 것은 계획서 7-5 의 **"metadata 무조건 덮어쓰기" 버그**다.
    지금은 저장할 때마다 그 사용자의 로컬 metadata 가 전역 값을 통째로 덮는다.
    A 가 화면 모드를 간트로 바꾸고 저장하면 **모두의** 서버 metadata 가 간트가 된다.

그래서 이 시험의 초점은 "저장이 되는가" 가 아니라
**"저장되면 안 되는 것이 저장되지 않는가"** 다.

사용법
    python scripts\\dt3_test_metadata.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.modules.auth.models import User, UserRole
from app.modules.digital_twin_dashboard.models import ModuleSettings
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project, Dt2Performance
from flask_jwt_extended import create_access_token

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
        admin = User.query.filter_by(role=UserRole.ADMIN, is_active=True).first()

        row = ModuleSettings.query.filter_by(
            module_name='digital_twin_dashboard',
            settings_key='dashboard_metadata').first()
        had_row = row is not None
        backup = dict(row.settings_data or {}) if row else None

        try:
            print("\n── 읽기 ──")
            r = client.get('/api/dt-v2/metadata', headers=auth(admin))
            check('GET 200', r.status_code == 200, f'실제 {r.status_code}')
            d = r.get_json()['data']
            real_p = Dt2Project.query.filter(
                Dt2Project.is_deleted.is_(False),
                Dt2Project.is_permanently_deleted.is_(False)).count()
            check('★ projectCount 를 실제로 세서 준다',
                  d.get('projectCount') == real_p, f"실제 {d.get('projectCount')} vs {real_p}")

            print("\n── 쓰기 ──")
            r = client.put('/api/dt-v2/metadata',
                           json={'metadata': {'lastBackupDate': '2026-07-29',
                                              'someGlobal': 'x'}},
                           headers=auth(admin))
            check('PUT 200', r.status_code == 200, f'실제 {r.status_code}')
            d = r.get_json()['data']
            check('전역 값이 저장됨', d.get('lastBackupDate') == '2026-07-29')
            check('updatedBy 기록', d.get('updatedBy') == admin.name)

            print("\n── ★ 덮어쓰기 버그 방지 ──")
            r = client.put('/api/dt-v2/metadata',
                           json={'metadata': {
                               'settings': {'viewMode': 'gantt', 'autoSave': False},
                               'projectCount': 99999,
                               'performanceCount': 88888,
                               'lastBackupDate': '2026-07-30'}},
                           headers=auth(admin))
            d = r.get_json()['data']
            check('★ settings(화면 취향)는 무시됨', 'settings' in (d.get('ignoredKeys') or []),
                  f"실제 {d.get('ignoredKeys')}")
            check('★ 개수도 무시됨',
                  {'projectCount', 'performanceCount'} <= set(d.get('ignoredKeys') or []),
                  f"실제 {d.get('ignoredKeys')}")
            check('★ 보낸 개수가 저장되지 않음', d.get('projectCount') != 99999,
                  f"실제 {d.get('projectCount')}")
            check('전역 값은 정상 갱신', d.get('lastBackupDate') == '2026-07-30')

            db.session.expire_all()
            stored = (ModuleSettings.query.filter_by(
                module_name='digital_twin_dashboard',
                settings_key='dashboard_metadata').first().settings_data or {})
            check('★ DB 에도 settings 가 안 들어감', 'settings' not in stored,
                  f'실제 키 {sorted(stored)}')
            check('★ DB 에 개수가 안 들어감',
                  'projectCount' not in stored and 'performanceCount' not in stored)

            print("\n── 권한 ──")
            viewer = User(email='__meta_viewer@t.local', name='뷰어',
                          role=UserRole.VIEWER, is_active=True)
            viewer.set_password('x' * 16)
            db.session.add(viewer); db.session.commit()
            try:
                r = client.put('/api/dt-v2/metadata',
                               json={'metadata': {'lastBackupDate': 'x'}},
                               headers=auth(viewer))
                check('★ viewer 는 403', r.status_code == 403, f'실제 {r.status_code}')
            finally:
                User.query.filter_by(id=viewer.id).delete()
                db.session.commit()

            r = client.put('/api/dt-v2/metadata', json={'metadata': 'x'},
                           headers=auth(admin))
            check('객체 아니면 400', r.status_code == 400, f'실제 {r.status_code}')

            print("\n── /data 응답에도 반영되는가 ──")
            r = client.get('/api/dt-v2/data', headers=auth(admin))
            m = r.get_json()['data']['metadata']
            check('★ /data 의 metadata 가 새 저장소에서 옴',
                  m.get('lastBackupDate') == '2026-07-30', f"실제 {m.get('lastBackupDate')}")
            check('  개수도 계산된 값', m.get('projectCount') == real_p)

        finally:
            print("\n── 정리 ──")
            cur = ModuleSettings.query.filter_by(
                module_name='digital_twin_dashboard',
                settings_key='dashboard_metadata').first()
            if had_row and cur:
                cur.settings_data = backup
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(cur, 'settings_data')
            elif cur:
                db.session.delete(cur)
            db.session.commit()
            after = ModuleSettings.query.filter_by(
                module_name='digital_twin_dashboard',
                settings_key='dashboard_metadata').first()
            check('원상복구', (after is not None) == had_row)

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
