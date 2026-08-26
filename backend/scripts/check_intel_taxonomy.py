# -*- coding: utf-8 -*-
"""**씨뿌리기 전에 무엇이 사라지는지 먼저 본다.** 아무것도 안 고친다.

왜 있나
    `seed_intel_taxonomy.py` 는 **표에 없는 역량을 지운다**(`remove_tech`). 그래야
    이름을 바꾸거나 뺀 역량이 옛 이름으로 남지 않는다. 그런데 운영에서 누가 손으로
    넣어 둔 역량이 있으면 **그것도 함께 사라지고, 거기 걸린 사업부 줄까지 없어진다.**

    ⚠️⚠️ 되돌릴 수 없다. 그래서 **돌리기 전에 세어 보는 자리**를 따로 둔다.

쓰는 법
    python scripts/check_intel_taxonomy.py

    「지워질 역량 0개」가 나오면 그냥 돌려도 된다.
"""
import logging
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(_HERE))   # backend/
sys.path.insert(0, _HERE)                    # 옆의 분류 자료
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

from app import create_app                                    # noqa: E402
from app.modules.digital_twin_intel.models import (           # noqa: E402
    IntelDivisionStage, IntelTech, IntelTechCapability)
from seed_intel_taxonomy_data import TAXONOMY                 # noqa: E402


def main():
    app = create_app()
    with app.app_context():
        logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

        wanted = {c[0] for c in TAXONOMY}
        listed = {t for c in TAXONOMY for t in c[5]}

        caps = IntelTech.query.filter_by(kind='capability').all()
        tools = IntelTech.query.filter(IntelTech.kind != 'capability').all()

        print('지금 이 DB')
        print('  역량 %d개 · 도구 %d개 · 매달림 %d줄 · 사업부 줄 %d개'
              % (len(caps), len(tools), IntelTechCapability.query.count(),
                 IntelDivisionStage.query.count()))
        print('표')
        print('  역량 %d개 · 도구 %d개' % (len(wanted), len(listed)))
        print()

        # ⚠️⚠️ 여기가 요점 — 표에 없는 역량은 **지워진다.**
        doomed = [c for c in caps if c.name not in wanted]
        print('씨뿌리기가 **지울** 역량: %d개' % len(doomed))
        for c in doomed:
            kids = IntelTechCapability.query.filter_by(
                capability_uuid=c.uuid).count()
            rows = IntelDivisionStage.query.filter_by(tech_uuid=c.uuid).count()
            print('  · %s  (매달린 도구 %d개는 떨어져 나오고, 사업부 줄 %d개는 사라진다)'
                  % (c.name, kids, rows))
        if not doomed:
            print('  없음 — 그냥 돌려도 됩니다.')
        print()

        # 도구는 안 지운다. 그래도 무엇이 표 밖에 있는지는 알려 준다.
        strays = [t for t in tools
                  if not any(n in listed for n in [t.name] + list(t.aliases or []))]
        print('표에 없는 도구: %d개 (**안 지웁니다** — MCPㆍ소식으로 들어온 것이 삽니다)'
              % len(strays))
        for t in strays[:15]:
            print('  ·', t.name)
        if len(strays) > 15:
            print('  … 그리고 %d개 더' % (len(strays) - 15))
        print()

        # ⚠️ 씨뿌리기가 **바로잡을** 줄. 역량은 단계가 없고 도구는 있어야 한다.
        odd_c = [c.name for c in caps if c.stage or c.stage_reason]
        odd_t = [t.name for t in tools if not t.stage]
        print('규칙에 어긋난 단계: 역량 %d개 · 도구 %d개 (씨뿌리기가 바로잡습니다)'
              % (len(odd_c), len(odd_t)))
        for n in (odd_c + odd_t)[:10]:
            print('  ·', n)
        print()

        add_c = sorted(wanted - {c.name for c in caps})
        print('새로 생길 역량: %d개' % len(add_c))
        for n in add_c[:15]:
            print('  ·', n)
        if len(add_c) > 15:
            print('  … 그리고 %d개 더' % (len(add_c) - 15))


if __name__ == '__main__':
    main()
