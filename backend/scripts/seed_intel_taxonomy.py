# -*- coding: utf-8 -*-
"""분류를 자료에 적용한다 (개발 DB 전용).

⚠️⚠️ **도구의 uuid 는 절대 안 바꾼다.** 바뀌면 그 도구에 걸린 근거 소식과 사업부의
   「무엇으로 하나」가 통째로 끊긴다. 이름이 같으면 있는 줄을 쓰고 **부모만** 옮긴다.

⚠️ 쓰이지 않게 된 옛 역량은 `remove_tech` 로 지운다 — 그래야 자식이 떼어져 살아남고
   사업부 줄도 함께 정리된다. 직접 지우면 자식이 없어진 uuid 를 가리켜 레이더에서
   통째로 사라진다.
"""
import logging
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(_HERE))   # backend/
sys.path.insert(0, _HERE)                    # 옆의 분류 자료
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

from app import create_app                                    # noqa: E402
from app.extensions import db                                 # noqa: E402
from app.modules.digital_twin_intel import services as S      # noqa: E402
from app.modules.digital_twin_intel.models import (           # noqa: E402
    CPT_KEYS, DEFAULT_SECTORS, IntelDivisionStage, IntelTech,
    IntelTechCapability)
from seed_intel_taxonomy_data import TAXONOMY                                 # noqa: E402


def main():
    app = create_app()
    with app.app_context():
        logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

        # ── 0. 적어 둔 것부터 검사한다 ──────────────────────────────────────
        bad = [c for c in TAXONOMY if c[1] not in DEFAULT_SECTORS]
        for c in bad:
            print('  !! 모르는 부채꼴:', c[0], c[1])
        badcpt = [(c[0], k) for c in TAXONOMY for k in c[3] if k not in CPT_KEYS]
        for n, k in badcpt:
            print('  !! 모르는 CPT:', n, k)
        names = [c[0] for c in TAXONOMY]
        dup = {n for n in names if names.count(n) > 1}
        for n in dup:
            print('  !! 역량 이름 겹침:', n)
        tools_all = [t for c in TAXONOMY for t in c[5]]
        dupt = {t for t in tools_all if tools_all.count(t) > 1}
        for t in dupt:
            print('  !! 도구가 두 역량에 적혔다:', t)
        if bad or badcpt or dup or dupt:
            print('\n적어 둔 것에 흠이 있어 멈춘다.')
            return

        wanted = set(names)
        made = updated = moved = created = 0

        # ── 1. 역량 ─────────────────────────────────────────────────────────
        for name, sector, summary, cpt, tags, _tools in TAXONOMY:
            c = IntelTech.query.filter_by(name=name).first()
            if c is None:
                c, err = S.create_tech(actor_id=None, name=name, kind='capability',
                                       category=sector, summary=summary,
                                       tags=tags, cpt=cpt)
                if err:
                    print('  역량 실패', name, err)
                    continue
                made += 1
            else:
                # 도구로 있던 이름이면 역량으로 올린다(공급사ㆍ주소는 규칙대로 비운다).
                c.kind = 'capability'
                c.parent_uuid = None
                c.vendor = None
                c.url = None
                c.category = sector
                c.summary = summary
                c.tags = list(tags)
                c.cpt = [k for k in cpt if k in CPT_KEYS]
                updated += 1
        db.session.commit()

        caps = {c.name: c for c in IntelTech.query.filter_by(kind='capability').all()}

        # ── 2. 도구 — **uuid 를 지키며 부모만 옮긴다** ──────────────────────
        for name, _s, _sm, _c, _tg, tools in TAXONOMY:
            cap = caps.get(name)
            if cap is None:
                continue
            for tn in tools:
                """
                ⚠️⚠️ **별칭까지 보고 찾는다**(`find_tech_by_name`). 이름만 딱 맞춰
                   찾으면, 합쳐서 별칭으로 남은 표기(「Executable Digital Twin
                   (xDT)」)를 못 찾아 **같은 것을 또 만들거나** — 더 나쁘게는,
                   만들기가 별칭으로 있는 줄을 돌려주는 바람에 **부모를 안 옮기고
                   지나친다.** 합치기를 도로 무르는 셈이다.
                """
                t = S.find_tech_by_name(tn)
                if t is None:
                    t, err = S.create_tech(actor_id=None, name=tn, kind='tool',
                                           capabilityUuids=[cap.uuid])
                    if err:
                        print('  도구 실패', tn, err)
                    else:
                        created += 1
                    continue
                if t.kind == 'capability':
                    # 옛 역량 이름이 이제 도구로 간다 — 매달린 것을 먼저 떼어 낸다.
                    IntelTechCapability.query.filter_by(
                        capability_uuid=t.uuid).delete()
                    t.kind = 'tool'
                """
                ⚠️ **이미 있는 연결은 안 건드린다.** 표에 적힌 것을 더할 뿐이다 —
                   사람이 손으로 더 매달아 둔 역량을 씨뿌리기가 지우면 안 된다.
                """
                if not IntelTechCapability.query.filter_by(
                        tech_uuid=t.uuid, capability_uuid=cap.uuid).first():
                    db.session.add(IntelTechCapability(
                        tech_uuid=t.uuid, capability_uuid=cap.uuid))
                    moved += 1
        db.session.commit()

        # ── 3. 안 쓰는 옛 역량 지우기 ───────────────────────────────────────
        dropped = []
        for c in IntelTech.query.filter_by(kind='capability').all():
            if c.name not in wanted:
                dropped.append(c.name)
                S.remove_tech(c.uuid)

        # ── 4. 사업부 줄 추스르기 ───────────────────────────────────────────
        # ⚠️ 도구가 다른 역량으로 옮겨 갔으면, 옛 역량의 「무엇으로 하나」는 거짓말이다.
        fixed = 0
        for r in IntelDivisionStage.query.all():
            keep = []
            for u in (r.tools or []):
                if IntelTechCapability.query.filter_by(
                        tech_uuid=u, capability_uuid=r.tech_uuid).first():
                    keep.append(u)
            if keep != (r.tools or []):
                r.tools = keep
                fixed += 1
        db.session.commit()

        # ── 4.5 표에 없는데 역량 밑에 있는 도구 ────────────────────────────
        """
        ⚠️⚠️ **자동으로 안 지운다.** 이 자리에는 MCPㆍ소식으로 들어온 도구도 함께
           산다 — 표에 없다고 지우면 바깥에서 조사해 넣은 것이 매번 사라진다.
        ⚠️ 그래도 **알려는 줘야 한다.** 표에서 옮기거나 뺀 줄이 옛 자리에 조용히
           남으면, 다음에 볼 때 「왜 여기 있지」가 된다.
        """
        listed = {t for _n, _s2, _sm, _c, _tg, tools in TAXONOMY for t in tools}
        strays = []
        for c in IntelTech.query.filter_by(kind='capability').all():
            links = IntelTechCapability.query.filter_by(
                capability_uuid=c.uuid).all()
            for t in IntelTech.query.filter(
                    IntelTech.uuid.in_([x.tech_uuid for x in links] or ['-'])).all():
                names = [t.name] + list(t.aliases or [])
                if not any(n in listed for n in names):
                    strays.append((c.name, t.name))

        # ── 5. 보고 ────────────────────────────────────────────────────────
        caps = IntelTech.query.filter_by(kind='capability').all()
        tools = IntelTech.query.filter_by(kind='tool').all()
        linked = {r.tech_uuid for r in IntelTechCapability.query.all()}
        orph = [t for t in tools if t.uuid not in linked]
        print()
        print('역량 새로 %d · 고쳐 씀 %d · 지움 %d' % (made, updated, len(dropped)))
        print('도구 새로 %d · 부모 옮김 %d' % (created, moved))
        print('사업부 줄에서 어긋난 도구 정리 %d줄' % fixed)
        if dropped:
            print('  지운 옛 역량:', ', '.join(dropped))
        if strays:
            print()
            print('표에 없는데 역량 밑에 있는 도구 %d개 (안 지운다 — 확인만):' % len(strays))
            for cap_name, tool_name in strays:
                print('     %-24s ← %s' % (cap_name[:24], tool_name))
        print()
        print('== 지금 ==')
        print('역량 %d · 도구 %d (안 매달린 것 %d)' % (len(caps), len(tools), len(orph)))
        if orph:
            for o in orph:
                print('     미아:', o.name)
        print()
        for sec in DEFAULT_SECTORS:
            rows = [c for c in caps if c.category == sec]
            n = sum(IntelTechCapability.query.filter_by(
                capability_uuid=c.uuid).count() for c in rows)
            print('   %-14s 역량 %2d · 도구 %3d' % (sec, len(rows), n))
        print()
        from app.modules.digital_twin_intel.models import CPT_GROUPS
        for k, ko in CPT_GROUPS:
            print('   CPT %-18s %-8s %2d개' % (k, ko,
                                               len([c for c in caps if k in (c.cpt or [])])))


if __name__ == '__main__':
    main()
