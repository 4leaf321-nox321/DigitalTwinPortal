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
from app.modules.digital_twin_intel import services as S      # noqa: E402
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
        # ⚠️ 역량도 도구도 단계를 안 갖는다 — 단계는 사업부 줄에만 산다.
        odd = [t.name for t in caps + tools if t.stage or t.stage_reason]
        print('단계를 든 줄: %d개 (씨뿌리기가 비웁니다)' % len(odd))
        for n in odd[:10]:
            print('  ·', n)
        print()

        """
        ⚠️⚠️ **부딪히는 이름** — 여기가 제일 조용히 망가지는 자리다.

        씨뿌리기는 역량을 **딱 맞는 이름**으로만 찾지만(`filter_by(name=)`), 못 찾아
        새로 만들 때 `create_tech` 가 **별칭까지** 보고 찾는다(`find_tech_by_name`).
        그래서 표의 역량 이름이 **다른 줄의 별칭**에 물려 있으면:

          · 그 줄이 도구면 → 층이 달라 **「역량 실패」로 건너뛴다.** 그 역량이 안
            생기고, 그러면 **그 밑 도구도 통째로 안 들어간다**(`caps.get` 이 None).
          · 표의 도구 이름이 **역량**에 물려 있으면 → 그 역량을 **도구로 내리고
            매달림을 지운다.** 되돌릴 길이 없다.

        ⚠️ 씨뿌리기와 **같은 함수**로 본다. 여기서 따로 맞대 보면 확인이 거짓말한다.
        """
        by_name = {c.name for c in caps} | {t.name for t in tools}
        clash_cap, clash_tool = [], []
        for name in sorted(wanted):
            if name in by_name:
                continue                      # 딱 맞는 이름이 있으면 그 줄을 쓴다
            hit = S.find_tech_by_name(name)
            if hit is not None and hit.kind != 'capability':
                clash_cap.append((name, hit.name))
        for tn in sorted(listed):
            hit = S.find_tech_by_name(tn)
            if hit is not None and hit.kind == 'capability':
                kids = IntelTechCapability.query.filter_by(
                    capability_uuid=hit.uuid).count()
                clash_tool.append((tn, hit.name, kids))

        print('부딪히는 이름')
        if clash_cap:
            print('  !! 이 역량들은 **안 만들어지고 그 밑 도구도 통째로 빠집니다** '
                  '(%d개)' % len(clash_cap))
            for name, other in clash_cap:
                n_tools = len(next(c[5] for c in TAXONOMY if c[0] == name))
                print('     · 「%s」 ← 도구 「%s」 의 별칭에 물림 (도구 %d개가 함께 빠짐)'
                      % (name, other, n_tools))
        if clash_tool:
            print('  !! 이 역량들이 **도구로 내려가고 매달림이 지워집니다** (%d개)'
                  % len(clash_tool))
            for tn, cap_name, kids in clash_tool:
                print('     · 역량 「%s」 ← 표의 도구 「%s」 에 물림 (매달린 도구 %d개가 떨어짐)'
                      % (cap_name, tn, kids))
        if not clash_cap and not clash_tool:
            print('  없음')
        print()

        add_c = sorted(wanted - {c.name for c in caps})
        print('새로 생길 역량: %d개' % len(add_c))
        for n in add_c[:15]:
            print('  ·', n)
        if len(add_c) > 15:
            print('  … 그리고 %d개 더' % (len(add_c) - 15))


if __name__ == '__main__':
    main()
