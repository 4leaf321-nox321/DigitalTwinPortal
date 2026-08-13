"""
연도별 과제 일괄 삭제 / 복구 API 시험 — 개발 DB 전용.

무엇을 지키려는가
    이 경로는 **한 번에 수백 건**을 지운다. 그래서 "되는가" 보다 **"안 돼야 할 때
    확실히 막히는가"** 가 시험의 대부분이다. 특히 세 가지를 못 박는다:

      · **admin 만** — 1건 영구삭제는 admin·dt_office 인데 여기는 admin 뿐이다.
        dt_office 가 통과하면 이번 요구사항 자체가 깨진 것이다.
      · **연도 필터가 실제로 먹는가** — 고른 연도 밖의 과제가 한 건이라도 지워지면
        그게 최악의 사고다. 다른 연도·연도 없음(NULL) 과제를 같이 두고 확인한다.
      · **빈 years 를 '전체'로 해석하지 않는가** — 그 분기가 생기면 실수 한 번이
        전 과제 삭제가 된다.

    시험 데이터는 실제로 쓰지 않는 연도(1901·1902)를 쓰고 끝나면 지운다.
    개발 DB 의 진짜 과제는 건드리지 않는다.

사용법
    python scripts\\dt3_test_bulk_year_delete.py
"""

from __future__ import annotations

import os
import sys
import uuid as uuidlib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app                                          # noqa: E402
from app.extensions import db                                       # noqa: E402
from app.modules.auth import pat as pat_mod                         # noqa: E402
from app.modules.auth.models import User, UserRole                  # noqa: E402
from app.modules.digital_twin_dashboard.models import (             # noqa: E402
    DashboardActivityLog,
)
from app.modules.digital_twin_dashboard.models_v2 import (          # noqa: E402
    Dt2Project, Dt2ProjectChange, Dt2ProjectHistory,
)
from app.shared.auth import _G_KEY as PAT_G_KEY                     # noqa: E402
from flask import g as flask_g                                      # noqa: E402
from flask_jwt_extended import create_access_token                  # noqa: E402

MARK = '__dt3_bulkyear__'
Y1, Y2 = 1901, 1902          # 실제로 쓰지 않는 연도
results = []


def check(desc, cond, extra=''):
    results.append((desc, bool(cond)))
    print(f"  {'[OK]  ' if cond else '[FAIL]'} {desc}"
          + (f"   {extra}" if not cond and extra else ''))


def auth(u):
    # 컷오버 전 쓰기 차단을 시험에서는 통과시킨다 (config.DT2_ALLOW_TEST_WRITE_HEADER)
    return {'Authorization': f'Bearer {create_access_token(identity=str(u.id))}',
            'X-DT2-Allow-Write': 'test'}


def mk_user(role, tag):
    u = User(email=f'{MARK}_{tag}@t.local', name=f'{MARK} {tag}',
             role=role, is_active=True)
    u.set_password('x' * 16)
    return u


def mk_project(year, tag, owner_id):
    u = str(uuidlib.uuid4())
    db.session.add(Dt2Project(
        uuid=u, code=f'{MARK}-{tag}', title=f'{MARK} {tag}', status='정상진행',
        year=year, owner_user_id=owner_id, row_version=1, extra_fields={},
        is_deleted=False, is_permanently_deleted=False))
    return u


def is_deleted(u):
    db.session.expire_all()
    row = Dt2Project.query.filter_by(uuid=u).first()
    return None if row is None else bool(row.is_deleted)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    # 개발 설정의 SQL 로그가 결과 화면을 덮는다. **엔진을 만들기 전에** 꺼야 한다
    # (echo 는 전용 로거를 써서 나중에 레벨을 낮춰도 소용없다 — dt4_kpi_verify 와 같은 이유).
    from app.config import DevelopmentConfig
    DevelopmentConfig.SQLALCHEMY_ECHO = False

    app = create_app()
    with app.app_context():
        client = app.test_client()
        n_proj, n_user = Dt2Project.query.count(), User.query.count()
        admin = User.query.filter_by(role=UserRole.ADMIN, is_active=True).first()
        if admin is None:
            print('SKIP 활성 admin 이 없습니다.')
            return

        manager = mk_user(UserRole.MANAGER, 'mgr')
        office = mk_user(UserRole.DT_OFFICE_MEMBER, 'office')
        plain = mk_user(UserRole.USER, 'user')
        db.session.add_all([manager, office, plain])
        db.session.commit()

        made, pat_id = [], None
        try:
            # Y1 에 3건, Y2 에 1건, 연도 없음 1건.
            a1 = mk_project(Y1, 'a1', admin.id)
            a2 = mk_project(Y1, 'a2', plain.id)      # 남의 과제도 대상이 되는지
            a3 = mk_project(Y1, 'a3', admin.id)
            b1 = mk_project(Y2, 'b1', admin.id)
            n0 = mk_project(None, 'noyear', admin.id)
            made = [a1, a2, a3, b1, n0]
            db.session.commit()

            print('\n── ★ 권한: admin 만 (dt_office 도 제외) ──')
            for who, u in (('manager', manager), ('dt_office', office),
                           ('일반 user', plain)):
                r = client.post('/api/dt-v2/projects/bulk-delete',
                                json={'years': [Y1]}, headers=auth(u))
                check(f'★ {who} 는 일괄 삭제 403', r.status_code == 403,
                      f'실제 {r.status_code}')
                r = client.get('/api/dt-v2/projects/year-summary', headers=auth(u))
                check(f'{who} 는 연도 요약도 403', r.status_code == 403,
                      f'실제 {r.status_code}')
            check('★ 거부된 요청으로 아무것도 안 지워짐',
                  not any(is_deleted(u) for u in made))

            print('\n── ★ PAT(MCP·AI)은 admin 토큰이어도 막힌다 ──')
            rec, plaintext = pat_mod.create_token(admin.id, f'{MARK} 시험용',
                                                  expires_days=1)
            pat_id = rec.id
            r = client.post('/api/dt-v2/projects/bulk-delete',
                            json={'years': [Y1]},
                            headers={'Authorization': f'Bearer {plaintext}',
                                     'X-DT2-Allow-Write': 'test'})
            check('★ PAT 은 403', r.status_code == 403, f'실제 {r.status_code}')
            check('★ PAT 요청으로도 안 지워짐', not any(is_deleted(u) for u in made))

            # ⚠️ **시험 한정 정리.** PAT 인증은 인증된 사용자를 `g` 에 담는데, `g` 는
            #    앱 컨텍스트에 붙는다. 이 스크립트는 바깥에서 `with app.app_context()` 를
            #    **한 번만** 열고 요청을 여러 번 보내므로(Flask 는 같은 앱의 컨텍스트가
            #    이미 있으면 그것을 재사용한다) PAT 이 남긴 값이 **다음 JWT 요청까지
            #    따라가** 이후 전부 403 이 된다.
            #    운영에서는 요청마다 앱 컨텍스트가 새로 생기므로 일어나지 않는다 —
            #    코드 문제가 아니라 이 시험 방식의 부작용이라 여기서 지운다.
            if hasattr(flask_g, PAT_G_KEY):
                delattr(flask_g, PAT_G_KEY)

            print('\n── ★ 빈 years 를 "전체"로 해석하지 않는다 ──')
            for body, desc in (({}, 'years 누락'),
                               ({'years': []}, '빈 배열'),
                               ({'years': None}, 'null'),
                               ({'years': 1901}, '배열이 아님')):
                r = client.post('/api/dt-v2/projects/bulk-delete',
                                json=body, headers=auth(admin))
                check(f'★ {desc} → 400', r.status_code == 400, f'실제 {r.status_code}')
            r = client.post('/api/dt-v2/projects/bulk-delete',
                            json={'years': ['abcd']}, headers=auth(admin))
            check('숫자가 아닌 연도 → 400', r.status_code == 400, f'실제 {r.status_code}')
            check('★ 그 사이 아무것도 안 지워짐', not any(is_deleted(u) for u in made))

            print('\n── 연도 요약 ──')
            r = client.get('/api/dt-v2/projects/year-summary', headers=auth(admin))
            check('admin 은 200', r.status_code == 200,
                  f'실제 {r.status_code} {str(r.get_json())[:300]}')
            rows = {row['year']: row
                    for row in ((r.get_json() or {}).get('data') or {}).get('years', [])}
            check(f'{Y1}년 사용 중 3건', rows.get(Y1, {}).get('activeCount') == 3,
                  f"실제 {rows.get(Y1)}")
            check(f'{Y2}년 사용 중 1건', rows.get(Y2, {}).get('activeCount') == 1,
                  f"실제 {rows.get(Y2)}")
            check('연도 없음(None) 행도 나온다', None in rows, f'실제 키 {list(rows)[:5]}')

            print('\n── ★ expectedCount 가 다르면 멈춘다 ──')
            r = client.post('/api/dt-v2/projects/bulk-delete',
                            json={'years': [Y1], 'expectedCount': 2},
                            headers=auth(admin))
            check('★ 건수 불일치 → 409', r.status_code == 409, f'실제 {r.status_code}')
            check('★ 409 면 한 건도 안 지워짐', not any(is_deleted(u) for u in made))

            print('\n── 삭제 ──')
            r = client.post('/api/dt-v2/projects/bulk-delete',
                            json={'years': [Y1], 'expectedCount': 3,
                                  'reason': f'{MARK} 사유'},
                            headers=auth(admin))
            check('admin · 건수 일치 → 200', r.status_code == 200, f'실제 {r.status_code}')
            d = (r.get_json() or {}).get('data') or {}
            check('응답 count 가 3', d.get('count') == 3, f"실제 {d.get('count')}")
            check('응답에 지운 과제 목록이 담김',
                  {p['uuid'] for p in d.get('projects', [])} == {a1, a2, a3})

            print('\n── ★ 고른 연도 밖은 그대로여야 한다 ──')
            check(f'{Y1}년 3건 모두 삭제됨', all(is_deleted(u) for u in (a1, a2, a3)))
            check('★ 소유자가 남이어도 지워짐(관리자 권한)', is_deleted(a2))
            check(f'★ {Y2}년 과제는 그대로', is_deleted(b1) is False)
            check('★ 연도 없음(NULL) 과제는 그대로', is_deleted(n0) is False)

            print('\n── 이력 ──')
            chg = Dt2ProjectChange.query.filter(
                Dt2ProjectChange.project_uuid.in_([a1, a2, a3]),
                Dt2ProjectChange.field == 'is_deleted').all()
            check('★ 과제마다 변경 이력 1건', len(chg) == 3, f'실제 {len(chg)}건')
            check('사유가 이력에 남음',
                  all(c.reason == f'{MARK} 사유' for c in chg))
            check('row_version 이 올라감',
                  all(Dt2Project.query.filter_by(uuid=u).first().row_version == 2
                      for u in (a1, a2, a3)))
            log = (DashboardActivityLog.query
                   .filter_by(action='BULK_DELETE')
                   .order_by(DashboardActivityLog.id.desc()).first())
            check('★ 활동 로그 1행이 남음', log is not None
                  and (log.changes or {}).get('count') == 3,
                  f'실제 {log and log.changes}')

            print('\n── 대상이 없으면 404 ──')
            r = client.post('/api/dt-v2/projects/bulk-delete',
                            json={'years': [Y1]}, headers=auth(admin))
            check('이미 다 지운 연도 → 404', r.status_code == 404, f'실제 {r.status_code}')

            print('\n── 요약이 휴지통으로 옮겨졌음을 보여준다 ──')
            r = client.get('/api/dt-v2/projects/year-summary', headers=auth(admin))
            rows = {row['year']: row for row in r.get_json()['data']['years']}
            check(f'{Y1}년 사용 중 0 · 휴지통 3',
                  rows.get(Y1, {}).get('activeCount') == 0
                  and rows.get(Y1, {}).get('trashedCount') == 3, f"실제 {rows.get(Y1)}")

            print('\n── ★ 일괄 복구 (삭제의 짝) ──')
            r = client.post('/api/dt-v2/projects/bulk-restore',
                            json={'years': [Y1]}, headers=auth(manager))
            check('★ manager 는 일괄 복구도 403', r.status_code == 403,
                  f'실제 {r.status_code}')
            r = client.post('/api/dt-v2/projects/bulk-restore',
                            json={'years': [Y1]}, headers=auth(admin))
            check('admin 복구 200', r.status_code == 200, f'실제 {r.status_code}')
            check('★ 3건 모두 되살아남',
                  not any(is_deleted(u) for u in (a1, a2, a3)))
            r = client.post('/api/dt-v2/projects/bulk-restore',
                            json={'years': [Y1]}, headers=auth(admin))
            check('복구할 것이 없으면 404', r.status_code == 404, f'실제 {r.status_code}')

            print('\n── ★ 영구삭제된 과제는 복구 대상에서 빠진다 ──')
            r = client.delete(f'/api/dt-v2/projects/{a3}', headers=auth(admin))
            check('영구삭제 200', r.status_code == 200, f'실제 {r.status_code}')
            r = client.post('/api/dt-v2/projects/bulk-delete',
                            json={'years': [Y1]}, headers=auth(admin))
            check('일괄 삭제 대상은 남은 2건', (r.get_json() or {})
                  .get('data', {}).get('count') == 2,
                  f"실제 {(r.get_json() or {}).get('data', {}).get('count')}")
            r = client.post('/api/dt-v2/projects/bulk-restore',
                            json={'years': [Y1]}, headers=auth(admin))
            check('★ 복구도 2건만 (영구삭제 제외)', (r.get_json() or {})
                  .get('data', {}).get('count') == 2,
                  f"실제 {(r.get_json() or {}).get('data', {}).get('count')}")
            db.session.expire_all()
            check('★ 영구삭제 과제는 여전히 영구삭제 상태',
                  Dt2Project.query.filter_by(uuid=a3).first().is_permanently_deleted)

            print('\n── 여러 연도 동시 삭제 ──')
            r = client.post('/api/dt-v2/projects/bulk-delete',
                            json={'years': [Y1, Y2]}, headers=auth(admin))
            check('두 연도 합쳐 3건 (a1·a2·b1)',
                  (r.get_json() or {}).get('data', {}).get('count') == 3,
                  f"실제 {(r.get_json() or {}).get('data', {}).get('count')}")
            check('★ 연도 없음 과제는 여기서도 그대로', is_deleted(n0) is False)

        finally:
            print('\n── 정리 ──')
            for u in made:
                Dt2ProjectChange.query.filter_by(project_uuid=u).delete()
                Dt2ProjectHistory.query.filter_by(project_uuid=u).delete()
                Dt2Project.query.filter_by(uuid=u).delete()
            DashboardActivityLog.query.filter(
                DashboardActivityLog.target_name.like(f'%{Y1}년%')).delete(
                    synchronize_session=False)
            if pat_id is not None:
                from app.modules.auth.models import PersonalAccessToken
                PersonalAccessToken.query.filter_by(id=pat_id).delete()
            db.session.commit()
            User.query.filter(User.id.in_([manager.id, office.id, plain.id]))\
                .delete(synchronize_session=False)
            db.session.commit()
            check('과제 건수 불변', Dt2Project.query.count() == n_proj,
                  f'{Dt2Project.query.count()} vs {n_proj}')
            check('사용자 건수 불변', User.query.count() == n_user)

        failed = [d for d, ok in results if not ok]
        print('\n' + '=' * 72)
        if failed:
            print(f' 결과: [FAIL] {len(failed)}건 실패')
            for d in failed:
                print(f'   - {d}')
            print('=' * 72)
            sys.exit(1)
        print(f' 결과: [OK] {len(results)}건 전부 통과')
        print('=' * 72)


if __name__ == '__main__':
    main()
