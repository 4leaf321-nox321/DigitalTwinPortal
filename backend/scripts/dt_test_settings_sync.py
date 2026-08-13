"""
설정 저장(PUT /settings) 동기화 시험 — 개발 DB 전용.

무엇을 지키려는가
    화면의 기본 설정(sampleData.js)은 **문자열 id** 를 쓴다.
        { id: 'vd_mecha_solution', name: 'Mecha Solution', divisionId: 'vd' }
    예전 서버는 숫자 id 만 기존 항목으로 인정해서, 이런 페이로드를 저장하면
      ① 전체가 새로 만들어지고 직전 세대는 비활성으로 쌓였다 (저장 한 번 = 한 벌 복제)
      ② divisionId 가 숫자가 아니라 **사업부 연결이 None 이 됐다**
    개발서버 실측(2026-08-02): 설정 테이블 7개가 전부 3벌, 부서 91개 중 88개 사업부 없음.

    이 시험은 **그 페이로드를 두 번 저장해도 늘어나지 않고 연결이 살아 있는지** 본다.

⚠️ 이 시험은 설정 테이블을 건드린다. 끝나면 **시험 전 상태로 되돌린다**(마지막 정리).

사용법
    python scripts\\dt_test_settings_sync.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import DevelopmentConfig                            # noqa: E402
DevelopmentConfig.SQLALCHEMY_ECHO = False

from app import create_app                                          # noqa: E402
from app.extensions import db                                       # noqa: E402
from app.modules.auth.models import User, UserRole                  # noqa: E402
from app.modules.digital_twin_dashboard.models import (             # noqa: E402
    Division, Department, PerformanceCategory, PerformanceSubcategory,
)
from flask_jwt_extended import create_access_token                  # noqa: E402

results = []


def check(desc, cond, extra=''):
    results.append((desc, bool(cond)))
    print(f"  {'[OK]  ' if cond else '[FAIL]'} {desc}" + (f'   {extra}' if not cond and extra else ''))


# sampleData.js 와 같은 모양 — **문자열 id, 문자열 divisionId**
SAMPLE = {
    'divisions': [
        {'id': 'mx', 'name': '__T_MX', 'color': '#06b6d4', 'order': 0},
        {'id': 'medical', 'name': '__T_의료기기', 'color': '#10b981', 'order': 1},
    ],
    'departments': [
        {'id': 'mx_iot', 'name': '__T_IoT Team', 'divisionId': 'mx', 'order': 0},
        {'id': 'med_lab', 'name': '__T_의료 Lab', 'divisionId': 'medical', 'order': 1},
    ],
    'performanceCategories': [
        {'id': 'prod', 'name': '__T_생산성', 'color': '#3b82f6', 'order': 0},
    ],
    'performanceSubcategories': [
        {'id': 'prod_hours', 'name': '__T_공수절감', 'categoryId': 'prod',
         'unit': 'hrs', 'order': 0},
    ],
}


def counts():
    return (Division.query.filter_by(is_active=True).count(),
            Department.query.filter_by(is_active=True).count(),
            PerformanceSubcategory.query.filter_by(is_active=True).count())


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        # 시험 전 상태 보존 (활성 id 집합)
        before = {
            m: {r.id for r in m.query.filter_by(is_active=True).all()}
            for m in (Division, Department, PerformanceCategory, PerformanceSubcategory)
        }
        total_before = {m: m.query.count() for m in before}

        admin = User.query.filter_by(role=UserRole.ADMIN, is_active=True).first()
        if admin is None:
            print('SKIP 활성 admin 이 없습니다.')
            return 0
        c = app.test_client()
        h = {'Authorization': 'Bearer ' + create_access_token(identity=str(admin.id))}

        try:
            print('\n── 1회차 저장 (문자열 id) ──')
            r = c.put('/api/digital-twin-dashboard/settings', json=SAMPLE, headers=h)
            check('저장 200', r.status_code == 200, f'실제 {r.status_code}')
            d1, p1, s1 = counts()

            mx = Division.query.filter_by(name='__T_MX', is_active=True).first()
            med = Division.query.filter_by(name='__T_의료기기', is_active=True).first()
            iot = Department.query.filter_by(name='__T_IoT Team', is_active=True).first()
            lab = Department.query.filter_by(name='__T_의료 Lab', is_active=True).first()
            sub = PerformanceSubcategory.query.filter_by(name='__T_공수절감', is_active=True).first()

            check('★ 부서가 사업부에 붙는다 (divisionId="mx")',
                  iot is not None and mx is not None and iot.division_id == mx.id,
                  f'실제 {iot and iot.division_id} vs {mx and mx.id}')
            check("★ 이름이 다른 참조도 풀린다 ('medical' → 의료기기)",
                  lab is not None and med is not None and lab.division_id == med.id,
                  f'실제 {lab and lab.division_id} vs {med and med.id}')
            check('★ 성과 소분류가 사라지지 않는다 (categoryId="prod")',
                  sub is not None and sub.category_id is not None)

            print('\n── 2회차 저장 (같은 페이로드) ──')
            r = c.put('/api/digital-twin-dashboard/settings', json=SAMPLE, headers=h)
            check('저장 200', r.status_code == 200, f'실제 {r.status_code}')
            db.session.expire_all()
            d2, p2, s2 = counts()

            check('★ 사업부가 늘지 않는다', d1 == d2, f'{d1} → {d2}')
            check('★ 부서가 늘지 않는다', p1 == p2, f'{p1} → {p2}')
            check('★ 성과 소분류가 늘지 않는다', s1 == s2, f'{s1} → {s2}')

            check('★ 같은 행이 재사용된다 (id 불변)',
                  Division.query.filter_by(name='__T_MX', is_active=True).first().id == mx.id)
            check('2회차에도 사업부 연결 유지',
                  Department.query.filter_by(name='__T_IoT Team',
                                             is_active=True).first().division_id == mx.id)

            print('\n── 3회차: 숫자 id 로 되돌려 보내기 (정상 화면 경로) ──')
            normal = {
                'divisions': [{'id': str(mx.id), 'name': '__T_MX2', 'color': '#111111'}],
                'departments': [{'id': str(iot.id), 'name': '__T_IoT Team',
                                 'divisionId': str(mx.id)}],
            }
            r = c.put('/api/digital-twin-dashboard/settings', json=normal, headers=h)
            check('저장 200', r.status_code == 200, f'실제 {r.status_code}')
            db.session.expire_all()
            check('숫자 id 는 그 행을 갱신한다 (이름 변경 반영)',
                  Division.query.get(mx.id).name == '__T_MX2')
            check('★ 목록에서 빠진 항목은 비활성으로 내려간다',
                  Division.query.get(med.id).is_active is False)

            print('\n── ★ 비활성 세대 id 를 가리켜도 활성으로 붙는가 ──')
            # 이 DB 에는 **같은 이름의** 사업부가 세대별로 여러 벌 있다(MX = id 1·9·17,
            # 그중 17 만 활성). 옛 세대 id 를 물면 화면 목록(활성만 내려간다)에 없는
            # 값이 되어 '공통' 으로 샌다. 그래서 이름이 같은 활성 행으로 옮겨야 한다.
            # ⚠️ 3회차에서 활성 MX 의 이름을 '__T_MX2' 로 바꿨으므로 잔재도 같은 이름이어야
            #    '세대 중복' 재현이 된다. (이름까지 다르면 그건 다른 사업부다)
            stale = Division(name='__T_MX2', color='#000000', is_active=False)
            db.session.add(stale)
            db.session.commit()
            r = c.put('/api/digital-twin-dashboard/settings', json={
                'divisions': [{'id': str(mx.id), 'name': '__T_MX2', 'color': '#111111'}],
                'departments': [{'id': str(iot.id), 'name': '__T_IoT Team',
                                 'divisionId': str(stale.id)}],   # ← 비활성 세대 id
            }, headers=h)
            db.session.expire_all()
            linked = Department.query.get(iot.id).division_id
            check('★ 비활성 사업부 id 는 같은 이름의 활성 행으로 승격된다',
                  linked == mx.id, f'실제 division_id={linked} (활성 MX={mx.id}, 비활성={stale.id})')
            Division.query.filter_by(id=stale.id).delete()
            db.session.commit()

            print('\n── 4회차: 내려간 항목을 이름으로 되살리기 ──')
            revive = {
                'divisions': [{'id': 'medical', 'name': '__T_의료기기', 'color': '#10b981'}],
            }
            r = c.put('/api/digital-twin-dashboard/settings', json=revive, headers=h)
            db.session.expire_all()
            check('★ 새로 만들지 않고 옛 행을 되살린다',
                  Division.query.get(med.id).is_active is True,
                  f'med.id={med.id}')
            check('★ 되살리며 새 행이 생기지 않았다',
                  Division.query.filter_by(name='__T_의료기기').count() == 1,
                  f"실제 {Division.query.filter_by(name='__T_의료기기').count()}개")

            print('\n── ★ 운영 모양: 이미 정리된 설정을 그대로 되저장해도 안 바뀌는가 ──')
            # 운영은 관리자가 **손으로** 모든 부서에 사업부를 지정해 둔 상태다.
            # 화면이 GET 으로 받은 것을 그대로 PUT 하는 것이 가장 흔한 저장이고,
            # 그때 행이 늘거나 id 가 바뀌거나 사업부 연결이 풀리면 **그 수작업이 날아간다.**
            # GET → PUT 왕복이 완전한 무연산인지 본다.
            r = c.get('/api/digital-twin-dashboard/settings', headers=h)
            snapshot = (r.get_json() or {}).get('data') or {}
            before_rows = {
                (d.id, d.name, d.division_id)
                for d in Department.query.filter_by(is_active=True).all()
            }
            before_div = {(d.id, d.name) for d in Division.query.filter_by(is_active=True).all()}

            r = c.put('/api/digital-twin-dashboard/settings', json={
                'divisions': snapshot.get('divisions', []),
                'departments': snapshot.get('departments', []),
            }, headers=h)
            check('되저장 200', r.status_code == 200, f'실제 {r.status_code}')
            db.session.expire_all()

            after_rows = {
                (d.id, d.name, d.division_id)
                for d in Department.query.filter_by(is_active=True).all()
            }
            after_div = {(d.id, d.name) for d in Division.query.filter_by(is_active=True).all()}
            check('★ 부서 (id·이름·사업부) 가 하나도 안 바뀐다',
                  before_rows == after_rows,
                  f'사라짐={before_rows - after_rows} 생김={after_rows - before_rows}')
            check('★ 사업부도 그대로', before_div == after_div,
                  f'사라짐={before_div - after_div} 생김={after_div - before_div}')
            check('★ 행이 늘지 않는다',
                  Department.query.count() == total_before[Department] + 0
                  or Department.query.count() <= total_before[Department] + 2,
                  f'전체 {Department.query.count()} (시험 시작 {total_before[Department]})')

        finally:
            print('\n── 정리 (시험 전 상태로 복구) ──')
            db.session.rollback()
            for m in (PerformanceSubcategory, PerformanceCategory, Department, Division):
                m.query.filter(m.name.like('__T\\_%')).delete(synchronize_session=False)
            db.session.commit()
            for m, ids in before.items():
                m.query.filter(m.id.in_(ids or {0})).update(
                    {'is_active': True}, synchronize_session=False)
                m.query.filter(m.id.notin_(ids or {0})).update(
                    {'is_active': False}, synchronize_session=False)
            db.session.commit()
            ok = all(m.query.count() == n for m, n in total_before.items())
            check('시험 데이터가 남지 않았다', ok,
                  str({m.__name__: (m.query.count(), n) for m, n in total_before.items()}))
            check('시험 전 활성 집합이 복구됐다',
                  all({r.id for r in m.query.filter_by(is_active=True).all()} == ids
                      for m, ids in before.items()))

        failed = [d for d, ok in results if not ok]
        print('\n' + '=' * 72)
        if failed:
            print(f' 결과: [FAIL] {len(failed)}건 실패')
            for d in failed:
                print('   - ' + d)
            print('=' * 72)
            return 1
        print(f' 결과: [OK] {len(results)}건 전부 통과')
        print('=' * 72)
        return 0


if __name__ == '__main__':
    sys.exit(main())
