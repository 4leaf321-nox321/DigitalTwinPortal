"""
소분류 단위를 바꾸면 **그 소분류를 쓰는 성과의 단위도 함께 바뀐다.** (2026-08-05)

왜 필요한가
    성과의 `단위` 는 소분류가 정하는 값이고, 성과 행에 있는 것은 **사본**이다.
    그 파생(`_derive_perf_from_subcategory`)은 **성과를 저장할 때만** 돈다.
    그래서 설정에서 소분류 단위를 바꾸면, 그 소분류를 쓰는 성과들은 각자 저장될
    때까지 옛 단위를 달고 있다 — 그런데 **화면은 그 칸을 읽기 전용으로 잠그므로
    사람이 고칠 수도 없다.** 2026-08-05 에 고친 그 버그가 그대로 재발한다.
    (실제로 그날 `억`→`억원` 으로 바꾸면서 성과 30건을 손으로 맞춰야 했다.)

  A  소분류 단위를 바꾸면 그 성과들이 따라온다 ★★
  B  **조용히 하지 않는다** — 응답에 몇 건을 바꿨는지 실어 보낸다 ★
  C  다른 소분류의 성과는 안 건드린다
  D  이력에 남는다 (source='server')
  E  되돌리면 대칭으로 돌아온다
  F  단위를 안 바꾼 저장은 아무것도 건드리지 않는다 ★
     (매번 건드리면 변경 이력이 오염되고 낙관적 락이 헛돈다)

실행:  venv/Scripts/python.exe scripts/dt3_test_perf_unit_cascade.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                    # noqa: E402

from app import create_app                                            # noqa: E402
from app.extensions import db                                         # noqa: E402
from app.modules.auth.models import User                              # noqa: E402
from app.modules.digital_twin_dashboard.models import (                # noqa: E402
    PerformanceCategory, PerformanceSubcategory,
)
from app.modules.digital_twin_dashboard.models_v2 import (             # noqa: E402
    Dt2Performance, Dt2PerformanceHistory,
)

CAT, SUB = '품질향상', '예측 정확도'
PROBE = 'ppm__cascade_probe__'
fails = []


def check(desc, got, want):
    ok = got == want
    print(f"  {'OK  ' if ok else 'FAIL'}  {desc}: got={got!r} want={want!r}")
    if not ok:
        fails.append(desc)


def check_true(desc, cond, extra=''):
    print(f"  {'OK  ' if cond else 'FAIL'}  {desc}" + (f'   {extra}' if not cond else ''))
    if not cond:
        fails.append(desc)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        admin = User.query.filter_by(role='admin').first()
        if admin is None:
            print('[FAIL] admin 계정이 없다.')
            return 1
        H = {'Authorization': f'Bearer {create_access_token(identity=str(admin.id))}'}
        c = app.test_client()

        cats = {x.id: x.name for x in PerformanceCategory.query.all()}
        subs = list(PerformanceSubcategory.query
                    .filter(PerformanceSubcategory.is_active.is_(True)).all())
        target = next((s for s in subs
                       if cats.get(s.category_id) == CAT and s.name == SUB), None)
        if target is None:
            print(f'[FAIL] 소분류 {CAT}/{SUB} 를 못 찾았다.')
            return 1

        def payload(unit_for_target):
            return [{'id': str(s.id), 'name': s.name,
                     'categoryId': str(s.category_id),
                     'unit': (unit_for_target if s.id == target.id else s.unit),
                     'description': s.description,
                     'isAchievementType': bool(s.is_achievement_type)}
                    for s in subs]

        def perfs_of(cat, sub):
            return (Dt2Performance.query
                    .filter(Dt2Performance.category == cat,
                            Dt2Performance.subcategory == sub,
                            Dt2Performance.is_deleted.isnot(True)).all())

        orig_unit = target.unit
        mine = perfs_of(CAT, SUB)
        others = [p for p in Dt2Performance.query
                  .filter(Dt2Performance.is_deleted.isnot(True)).all()
                  if (p.category, p.subcategory) != (CAT, SUB)]
        other_units = {p.uuid: p.unit for p in others}
        hist_before = Dt2PerformanceHistory.query.filter_by(source='server').count()
        print(f'대상 {CAT}/{SUB} · 지금 단위 {orig_unit!r} · 쓰는 성과 {len(mine)}건 '
              f'· 다른 성과 {len(others)}건')

        try:
            print('\nA  소분류 단위를 바꾸면 그 성과들이 따라온다 ★★')
            r = c.put('/api/digital-twin-dashboard/settings', headers=H,
                      json={'performanceSubcategories': payload(PROBE)})
            check('설정 저장 200', r.status_code, 200)
            data = (r.get_json() or {}).get('data') or {}
            db.session.expire_all()
            after = perfs_of(CAT, SUB)
            check('그 소분류 성과가 전부 새 단위',
                  {p.unit for p in after}, {PROBE})

            print('\nB  조용히 하지 않는다 — 몇 건인지 알린다 ★')
            check_true('cascaded 가 응답에 있다', bool(data.get('cascaded')), str(data)[:120])
            joined = ' '.join(data.get('cascaded') or [])
            check_true(f'건수({len(mine)})를 말한다', str(len(mine)) in joined, joined[:140])
            check_true('message 에도 실린다', PROBE in (data.get('message') or ''),
                       (data.get('message') or '')[:140])

            print('\nC  다른 소분류의 성과는 안 건드린다')
            db.session.expire_all()
            moved = [p.uuid for p in Dt2Performance.query
                     .filter(Dt2Performance.is_deleted.isnot(True)).all()
                     if p.uuid in other_units and p.unit != other_units[p.uuid]]
            check('다른 성과의 단위가 바뀐 건수', len(moved), 0)

            print('\nD  이력에 남는다')
            check('server 이력이 성과 수만큼 늘었다',
                  Dt2PerformanceHistory.query.filter_by(source='server').count()
                  - hist_before, len(mine))

            print('\nF  단위를 안 바꾼 저장은 아무것도 안 건드린다 ★')
            hist_mid = Dt2PerformanceHistory.query.filter_by(source='server').count()
            r = c.put('/api/digital-twin-dashboard/settings', headers=H,
                      json={'performanceSubcategories': payload(PROBE)})
            d2 = (r.get_json() or {}).get('data') or {}
            check('두 번째 저장은 cascaded 가 비어 있다', d2.get('cascaded'), [])
            check('이력도 안 늘었다',
                  Dt2PerformanceHistory.query.filter_by(source='server').count(), hist_mid)
        finally:
            print('\nE  되돌리면 대칭으로 돌아온다')
            r = c.put('/api/digital-twin-dashboard/settings', headers=H,
                      json={'performanceSubcategories': payload(orig_unit)})
            db.session.expire_all()
            back = perfs_of(CAT, SUB)
            check('원래 단위로 복구', {p.unit for p in back}, {orig_unit})
            check('소분류도 복구',
                  PerformanceSubcategory.query.get(target.id).unit, orig_unit)

    print()
    if fails:
        print(f'실패 {len(fails)}건: {", ".join(fails)}')
        return 1
    print('전부 통과')
    return 0


if __name__ == '__main__':
    sys.exit(main())
