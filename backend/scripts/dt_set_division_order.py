"""
사업부 표시 순서를 정식 순서로 맞춘다

무엇에 쓰나
    화면의 사업부 차례는 **설정이 정본**이다(frontend utils/divisionOrder.js).
    그런데 설정 DB 의 차례가 화면들이 쓰던 차례와 달랐다 — SR 과 GTR 이 뒤바뀌어
    있었다. 정식 순서는 이것이다(2026-08-21 결정).

        MX · VD · DA · NW · 의료기기 · SR · GTR · CS

    화면 코드에 박혀 있던 배열들을 모두 걷어내고 설정을 보게 바꿨으므로,
    설정의 차례가 곧 화면의 차례다. 이 스크립트가 그 차례를 맞춘다.

        python scripts\\dt_set_division_order.py            # 무엇이 바뀌는지만 본다
        python scripts\\dt_set_division_order.py --apply    # 실제로 쓴다

⚠️ **기본은 미리보기다.** --apply 를 줘야 쓴다. 설정을 건드리는 일이라 무엇이
   바뀌는지 먼저 눈으로 보고 결정하는 편이 낫다.

⚠️ **활성 사업부만** 손댄다(is_active). 비활성 행은 화면에 안 나오므로 차례를
   맞출 이유가 없다. 개발 DB 에는 비활성 행이 16개 남아 있고 그중 하나는 이름이
   `CS2` 인데, 안 보이는 행이라 그대로 둔다.

⚠️ 목록에 없는 사업부는 **건드리지 않는다.** 조직이 늘었는데 이 스크립트가
   그것을 뒤로 밀어 버리면 안 된다. 그런 사업부가 있으면 알려만 주고 지나간다
   — 차례는 사람이 정할 일이다.

여러 번 돌려도 결과가 같다.
"""
from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402
from app.modules.digital_twin_dashboard.models import Division  # noqa: E402

# frontend/src/modules/digital-twin-dashboard/utils/divisionOrder.js 의
# DIVISION_ORDER_FALLBACK 과 **같은 차례**여야 한다. 둘이 갈리면 설정을 못 받은
# 첫 그림과 받은 뒤 그림의 차례가 달라 목록이 눈앞에서 뒤바뀐다.
CANONICAL = ['MX', 'VD', 'DA', 'NW', '의료기기', 'SR', 'GTR', 'CS']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='실제로 쓴다 (기본은 미리보기)')
    args = ap.parse_args()

    app = create_app()
    with app.app_context():
        rows = (Division.query
                .filter_by(is_active=True)
                .order_by(Division.order, Division.id)
                .all())
        if not rows:
            print('활성 사업부가 없습니다.')
            return

        print('== 지금 차례 ==')
        for d in rows:
            print(f'   order={d.order:<3} {d.name}')

        rank = {name: i for i, name in enumerate(CANONICAL)}
        known = [d for d in rows if d.name in rank]
        unknown = [d for d in rows if d.name not in rank]

        if unknown:
            print()
            print('-- 정식 순서 목록에 없는 사업부 (건드리지 않는다) --')
            for d in unknown:
                print(f'   order={d.order:<3} {d.name}')
            print('   -> 차례를 정하려면 이 스크립트의 CANONICAL 과 화면의')
            print('      DIVISION_ORDER_FALLBACK 을 **함께** 고쳐야 합니다.')

        known.sort(key=lambda d: rank[d.name])
        changes = []
        for i, d in enumerate(known):
            if d.order != i:
                changes.append((d, d.order, i))

        print()
        if not changes:
            print('== 이미 정식 순서입니다. 바꿀 것이 없습니다. ==')
            return

        print('== 바뀔 것 ==')
        for d, before, after in changes:
            print(f'   {d.name:<8} order {before} -> {after}')

        if not args.apply:
            print()
            print('   (미리보기입니다. 실제로 쓰려면 --apply 를 주세요.)')
            return

        for d, _before, after in changes:
            d.order = after
        db.session.commit()

        print()
        print('== 쓴 뒤 차례 ==')
        for d in (Division.query.filter_by(is_active=True)
                  .order_by(Division.order, Division.id).all()):
            print(f'   order={d.order:<3} {d.name}')


if __name__ == '__main__':
    main()
