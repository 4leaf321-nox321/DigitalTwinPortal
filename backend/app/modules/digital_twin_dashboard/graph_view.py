"""관계도 투영 — `dt2_*` 를 읽어 노드/엣지로 **그때그때 만든다.**

무엇을 하나 / 안 하나
    한다     정본(`dt2_*`)을 읽어 그래프 모양으로 **투영**한다.
    안 한다  **아무것도 저장하지 않는다.** 노드도 엣지도 테이블이 없다.

왜 저장하지 않나
    예전 「지식 그래프 저장」은 브라우저에서 만들어 `dx_graphs`/`dx_nodes`/`dx_edges`
    에 **찍어 두는** 것이었다. 그래서 저장한 순간에 얼어붙었고, 과제명을 바꿔도
    그래프는 옛 이름 그대로였다. 색·크기까지 노드에 박혀 있어 데이터가 아니라
    **그림**이었다. 투영은 그 문제가 원천적으로 없다 — 매번 지금 값을 읽는다.

이 파일이 지키는 세 가지 (`디지털트윈_지식그래프_계획.md` §5)
    ① **색·크기를 정하지 않는다.** 라벨과 최소 속성만 낸다. 표현은 화면이 정한다.
       그래야 같은 데이터로 사업부별·진행상태별 색칠을 토글할 수 있다.
    ② **권한은 그래프 밖에서.** 여기서는 "볼 수 있는 과제" 를 먼저 고르고,
       노드는 **그 과제에 매달린 것만** 만든다. 그래프가 우회로가 되면 안 된다.
    ③ **N+1 금지.** 관계를 과제별로 미리 묶는다(`assemble_data` 와 같은 방식).

ObjectRef
    노드의 정체성은 `"<type>:<id>"` 문자열 하나다.
        project:<uuid>   perf:<uuid>   kpi:<id>
        division:<이름>   process:<사업부>|<프로세스>
        perfcat:<대분류>  perfsub:<대분류>|<소분류>   kpicard:<id>
        person:<knoxId>  dept:<부서명>   action:<uuid>
    정수 id(KPI)와 문자열 키(knoxId)가 섞이므로 문자열로 통일한다
    (ReportArchive `ObjectLink` 의 ObjectRef 와 같은 이유).

⚠️ **이름(사람·부서)으로 노드를 만들지 않는다.** knoxId 가 있는 사람만 노드가 된다.
   표기가 흔들리면 다른 노드가 되기 때문이다 — `owner-links` 감사가 그 증상이었다.
   knoxId 없는 참여자는 그래프에 안 나온다. 지어내는 것보다 없는 편이 낫다.
"""
from __future__ import annotations

from app.extensions import db
from app.modules.digital_twin_dashboard import permissions as P
from app.modules.digital_twin_dashboard.models import Division
from app.modules.digital_twin_dashboard.models_v2 import (
    Dt2Performance, Dt2Project, Dt2ProjectDependency, Dt2ProjectKpi,
    Dt2ProjectPerformance,
)

# 켤 수 있는 레이어. 화면의 토글과 **같은 이름**을 쓴다 — 갈리면 화면이 못 켠다.
LAYERS = ('perf', 'card', 'kpi', 'dep', 'org', 'people', 'action')

# 기본으로 켜는 레이어. 사람·액션아이템은 노드가 급격히 늘어 처음엔 끈다.
DEFAULT_LAYERS = ('perf', 'card', 'kpi', 'dep', 'org')

# 한 번에 내보내는 노드 상한. 넘으면 **자르지 않고 알린다** — 잘린 그래프는
# "연결이 없다" 로 읽혀서 없는 결론을 만든다.
MAX_NODES = 4000


def _ref(kind: str, ident) -> str:
    return f'{kind}:{ident}'


def _norm_list(raw):
    """쉼표로 온 필터를 목록으로. 빈 값은 '전체' 를 뜻한다(None)."""
    if raw is None:
        return None
    items = [s.strip() for s in str(raw).split(',') if s.strip()]
    return items or None


def parse_layers(raw):
    """`layers` 질의 → 켤 레이어 집합. 모르는 이름은 조용히 버리지 않고 알린다."""
    if raw is None:
        return set(DEFAULT_LAYERS), []
    names = _norm_list(raw)
    if names is None:
        return set(), []
    if len(names) == 1 and names[0] == 'all':
        return set(LAYERS), []
    unknown = [n for n in names if n not in LAYERS]
    return {n for n in names if n in LAYERS}, unknown


def _person_entries(p):
    """
    이 과제에 붙은 **knoxId 가 있는 사람**들. `(knoxId, 이름, 관계, 부서)` 목록.

    knoxId 가 없으면 건너뛴다 — 이름만으로 노드를 만들면 동명이인이 한 사람이 되고,
    표기가 흔들리면 한 사람이 여러 노드가 된다. 둘 다 조용히 틀린 그림을 만든다.

    부서는 **참여인력 항목에만** 있다(`members_json[].부서`). 과제PL·작성자는
    이름과 knoxId 만 있어 부서를 모른다 — 지어내지 않고 빈 값으로 둔다.
    """
    out = []
    if (p.pl_knox_id or '').strip():
        out.append((p.pl_knox_id.strip(), (p.pl_name or '').strip(), 'led_by', ''))
    if (p.author_knox_id or '').strip():
        out.append((p.author_knox_id.strip(), (p.author_name or '').strip(),
                    'authored_by', ''))
    for m in (p.members_json or []):
        if not isinstance(m, dict):
            continue
        knox = str(m.get('knoxId') or '').strip()
        if knox:
            out.append((knox, str(m.get('이름') or '').strip(), 'member_of',
                        str(m.get('부서') or '').strip()))
    return out


def _project_depts(p):
    """
    과제의 **담당부서**. `depts_json` 이 정본이다.

    `dept_name` 은 그것을 쉼표로 이어 붙인 문자열(파생)이라 쓰지 않는다 —
    쓰면 `'CAE그룹(MX), Digital Twin사무국(MX)'` 이 통째로 부서 하나가 된다.
    """
    out = []
    for d in (p.depts_json or []):
        name = d if isinstance(d, str) else (d or {}).get('이름') or (d or {}).get('name')
        name = str(name or '').strip()
        if name:
            out.append(name)
    return out


def build_graph(actor, *, years=None, divisions=None, layers=None,
                include_deleted=False):
    """
    관계도 한 장. `(payload, unknown_layers)`.

    years/divisions 는 목록이거나 None(전체). `actor` 기준으로 **볼 수 있는 과제만**
    고른다 — 그 뒤의 노드는 전부 거기서 파생되므로, 이 한 줄이 가시성의 전부다.
    """
    layers = set(layers) if layers is not None else set(DEFAULT_LAYERS)

    q = Dt2Project.query.filter(Dt2Project.is_permanently_deleted.is_(False))
    if not include_deleted:
        q = q.filter(Dt2Project.is_deleted.is_(False))
    if years:
        q = q.filter(Dt2Project.year.in_([int(y) for y in years if str(y).isdigit()]))
    if divisions:
        q = q.filter(Dt2Project.division.in_(divisions))

    # ② 권한 — 여기서 한 번에 거른다.
    #
    # ⚠️ **취소 과제도 뺀다.** 관계도는 "지금 무엇이 어떻게 얽혀 있나" 를 그리는데,
    #    취소된 과제의 사람·KPI 연결은 살아 있는 관계가 아니다. 다른 화면들이 이미
    #    모수에서 빼고 있어서(`ProjectSummary` 완료율, `DashboardView` 경영진 보고,
    #    `trend_view` 과제 수), 여기서만 세면 같은 사업부의 과제 수가 화면마다 달라진다.
    #
    #    `includeDeleted` 는 "지금 없는 것까지 보기" 라는 뜻이라 취소도 같이 되돌린다 —
    #    휴지통과 취소는 사유가 다를 뿐 **지금 굴러가는 과제가 아닌 것**은 같다.
    #
    #    SQL 이 아니라 여기서 거르는 이유: `status != '취소'` 는 **NULL 을 떨어뜨린다**.
    #    상태가 안 적힌 과제가 통째로 사라진다.
    projects = [p for p in q.all()
                if P.can_view_project(actor, p)
                and (include_deleted or (p.status or '').strip() != '취소')]
    visible = {p.uuid for p in projects}

    nodes = {}          # ref → dict
    edges = []
    counts = {k: 0 for k in ('project', 'perf', 'perfcat', 'perfsub', 'kpicard',
                             'kpi', 'division', 'process', 'person', 'dept',
                             'action')}

    def add_node(ref, ntype, label, **props):
        if ref in nodes:
            return nodes[ref]
        node = {'ref': ref, 'type': ntype, 'label': label or '(이름 없음)'}
        node.update({k: v for k, v in props.items() if v not in (None, '')})
        nodes[ref] = node
        counts[ntype] = counts.get(ntype, 0) + 1
        return node

    # ── 과제 노드 ────────────────────────────────────────────────────────
    for p in projects:
        add_node(_ref('project', p.uuid), 'project', p.title,
                 code=p.code, division=p.division, status=p.status,
                 year=p.year, progress=p.progress,
                 isKey=bool(p.is_key), isPoc=bool(p.is_poc),
                 isDeleted=bool(p.is_deleted))

    # ── org: 조직 — 사업부 → 프로세스 → 과제, 그리고 담당부서 ─────────────
    #
    # **사업부를 과제에 바로 잇지 않는다** (2026-08-09 요청).
    #   사업부가 6개인데 과제가 100건이면 한 사업부에 20갈래 별이 생긴다.
    #   그 모양은 힘이 자리를 잡기도 어렵고, 한 노드를 끌면 나머지가 우르르 끌려온다.
    #   사이에 프로세스(개발·제조·품질·디자인·연계)를 끼우면 같은 100건이
    #   **21개 무리**로 갈라져 훨씬 빨리 안정되고 눈으로도 읽힌다.
    #
    # 프로세스 노드는 **사업부별로 따로** 만든다(`process:MX|개발`).
    #   하나로 합치면 '개발' 노드가 6개 사업부에 전부 붙어 **더 큰 허브**가 된다 —
    #   고치려던 문제를 그대로 다시 만드는 셈이다.
    if 'org' in layers:
        colors = {d.name: d.color for d in Division.query.all()}
        # 🐞 사업부→프로세스 엣지는 **과제마다 생기지 않는다.** 과제 루프 안에서
        #    그냥 append 하면 그 무리의 과제 수만큼 같은 엣지가 쌓인다(실측 21개가
        #    100개로). 중복 엣지는 화면에 겹쳐 그려질 뿐 아니라 **잇는 힘이 그만큼
        #    곱해져** 배치가 찌그러진다.
        seen_org = set()
        for p in projects:
            name = (p.division or '').strip()
            if not name:
                continue        # 사업부가 없으면 조직 갈래에 매달 곳이 없다
            dref = _ref('division', name)
            # 색은 **정하지 않는다.** 다만 사업부는 화면이 이미 색을 갖고 있어
            # 그 값을 속성으로 실어 준다 — 칠하는 것은 여전히 화면이 정한다.
            add_node(dref, 'division', name, brandColor=colors.get(name))

            proc = (p.process or '').strip()
            if proc:
                pref = _ref('process', f'{name}|{proc}')
                add_node(pref, 'process', proc, division=name,
                         brandColor=colors.get(name))
                if (dref, pref) not in seen_org:
                    seen_org.add((dref, pref))
                    edges.append({'source': dref, 'target': pref, 'relation': 'contains'})
                edges.append({'source': pref, 'target': _ref('project', p.uuid),
                              'relation': 'contains'})
            else:
                # 프로세스가 안 적힌 과제는 사업부에 바로 단다. 안 그러면 조직
                # 갈래에서 통째로 사라져서 "이 과제는 어디 소속인가" 를 못 본다.
                edges.append({'source': dref, 'target': _ref('project', p.uuid),
                              'relation': 'contains'})

        # 담당부서. **사업부와 다른 축이다** — 사업부는 과제가 어느 조직의 것인지를,
        # 담당부서는 실제로 누가 맡아 하는지를 말한다(한 과제에 여럿일 수 있다).
        # 그래서 `contains` 갈래에 끼우지 않고 별도 관계로 옆에 붙인다.
        for p in projects:
            pjref = _ref('project', p.uuid)
            for dept in _project_depts(p):
                dpref = _ref('dept', dept)
                add_node(dpref, 'dept', dept)
                if (pjref, dpref) not in seen_org:
                    seen_org.add((pjref, dpref))
                    edges.append({'source': pjref, 'target': dpref,
                                  'relation': 'handled_by'})

    # ── perf: 성과 + 성과 분류 ───────────────────────────────────────────
    #
    # **성과끼리도 엮는다** (2026-08-09 요청). '모든 성과 현황' 이 성과를
    # **대분류 > 소분류**로 묶어 보여주는데(AllPerformancesView), 관계도에서는
    # 성과 112건이 그냥 흩어져 있어서 "비슷한 성과" 가 안 보였다.
    # 조직 갈래(사업부→프로세스→과제)와 **같은 방식**으로 한 겹 끼운다:
    #     대분류 → 소분류 → 성과
    # 소분류는 대분류별로 따로 만든다(`perfsub:품질향상|불량률`) — 합치면
    # 같은 이름의 소분류가 여러 대분류에 붙어 허브가 된다(프로세스와 같은 이유).
    # 볼 수 있는 과제에 걸린 성과. `perf` 레이어와 `card` 레이어가 같이 쓴다 —
    # **가시성의 근거가 하나여야** 한쪽만 새는 일이 없다.
    perf_links = []
    perfs = {}
    if {'perf', 'card'} & layers:
        perf_links = [ln for ln in Dt2ProjectPerformance.query.all()
                      if ln.project_uuid in visible]
        puids = {ln.performance_uuid for ln in perf_links}
        perfs = {f.uuid: f for f in Dt2Performance.query.filter(
            Dt2Performance.uuid.in_(puids)).all()} if puids else {}
        perfs = {u: f for u, f in perfs.items() if not f.is_deleted}

    def add_perf_node(f):
        pref = _ref('perf', f.uuid)
        add_node(pref, 'perf', f.title, category=f.category,
                 subcategory=f.subcategory, unit=f.unit)
        return pref

    if 'perf' in layers:
        links = perf_links

        # 분류 엣지는 성과마다가 아니라 **한 번만** 만든다 (사업부→프로세스와 같은 함정)
        seen_cat = set()
        for ln in links:
            f = perfs.get(ln.performance_uuid)
            if f is None:
                continue        # 지워진 성과는 그리지 않는다
            pref = add_perf_node(f)
            edges.append({'source': _ref('project', ln.project_uuid),
                          'target': pref, 'relation': 'measures',
                          'contribution': ln.contribution})

            cat = (f.category or '').strip()
            sub = (f.subcategory or '').strip()
            if not cat:
                continue        # 분류가 없으면 매달 곳이 없다
            cref = _ref('perfcat', cat)
            add_node(cref, 'perfcat', cat)
            if sub:
                sref = _ref('perfsub', f'{cat}|{sub}')
                add_node(sref, 'perfsub', sub, category=cat)
                if (cref, sref) not in seen_cat:
                    seen_cat.add((cref, sref))
                    edges.append({'source': cref, 'target': sref,
                                  'relation': 'contains'})
                parent = sref
            else:
                parent = cref
            if (parent, pref) not in seen_cat:
                seen_cat.add((parent, pref))
                edges.append({'source': parent, 'target': pref,
                              'relation': 'contains'})

    # ── card: KPI 대시보드 카드 (「모든 성과 현황」의 카드) ────────────────
    #
    # 「개발 비용」·「품질 비용」 같은 카드다. 사람이 **직접 고른 성과 묶음**이라
    # 대분류/소분류(자동 분류)와 뜻이 다르다. 그래서 관계도 이름도 다르게 둔다
    # (`in_card`) — 같은 `contains` 로 두면 "성과의 분류 부모는 하나" 라는 규칙이
    # 깨지고, 무엇이 자동이고 무엇이 사람 판단인지 구분이 사라진다.
    #
    # ⚠️ 한 성과가 **여러 카드에 들어갈 수 있다.** 그게 분류와 가장 다른 점이다.
    if 'card' in layers:
        from app.modules.digital_twin_dashboard.models import KPIDashboardCard

        cq = KPIDashboardCard.query.filter(KPIDashboardCard.is_active.is_(True))
        if years:
            cq = cq.filter(KPIDashboardCard.year.in_(
                [int(y) for y in years if str(y).isdigit()]))
        cards = cq.order_by(KPIDashboardCard.order.asc(),
                            KPIDashboardCard.id.asc()).all()

        # 카드는 성과를 **여러 이름의 키**로 가리킨다(화면 `getLinkedKpiCards` 와 같은
        # 후보들). 대개 uuid 지만 옛 카드는 다른 키를 들고 있을 수 있어 전부 받는다.
        by_key = {}
        for f in perfs.values():
            for k in (f.uuid, f.legacy_uuid, f.id, f.title):
                if k not in (None, ''):
                    by_key.setdefault(str(k), f)

        for card in cards:
            hit = []
            seen_f = set()
            for raw in (card.selected_perf_keys or []):
                f = by_key.get(str(raw))
                # 볼 수 없는 과제에만 걸린 성과는 `perfs` 에 없다 → 자동으로 빠진다.
                if f is not None and f.uuid not in seen_f:
                    seen_f.add(f.uuid)
                    hit.append(f)
            if not hit:
                continue        # 볼 수 있는 성과가 하나도 없는 카드는 그리지 않는다

            # 같은 이름의 카드가 사업부별로 따로 있다(「품질 비용」이 4개). 이름만
            # 쓰면 화면에서 구분이 안 되므로 사업부를 붙인다.
            div = (card.division or '').strip()
            label = card.name if div in ('', '전체') else f'{card.name} ({div})'
            cref = _ref('kpicard', card.id)
            add_node(cref, 'kpicard', label, division=card.division,
                     category=card.category, year=card.year, logic=card.logic,
                     perfCount=len(hit))
            for f in hit:
                edges.append({'source': cref, 'target': add_perf_node(f),
                              'relation': 'in_card'})

    # ── kpi: DX KPI ──────────────────────────────────────────────────────
    if 'kpi' in layers:
        from app.modules.dx_kpi_management.models import KpiDefinition
        rows = [r for r in Dt2ProjectKpi.query.all() if r.project_uuid in visible]
        kids = {r.kpi_definition_id for r in rows}
        defs = {d.id: d for d in KpiDefinition.query.filter(
            KpiDefinition.id.in_(kids)).all()} if kids else {}
        for r in rows:
            d = defs.get(r.kpi_definition_id)
            if d is None:
                continue
            kref = _ref('kpi', d.id)
            add_node(kref, 'kpi', d.label, category=d.category, unit=d.unit,
                     kind=d.kind or 'metric')
            edges.append({'source': _ref('project', r.project_uuid),
                          'target': kref, 'relation': 'contributes',
                          # 기여등급은 **더하면 안 되는 순서척도**다. 굵기로 쓸 때도
                          # 합이 아니라 범주다 (routes_v2.KPI_RELATION_TYPES 주석).
                          'relationType': r.relation_type,
                          'targetDivision': r.target_division})

    # ── dep: 선행 과제 (과제 → 과제) ─────────────────────────────────────
    if 'dep' in layers:
        for d in Dt2ProjectDependency.query.all():
            # **양쪽이 다 보여야** 그린다. 한쪽만 보이면 안 보이는 과제의 존재가
            # 화살표로 드러난다.
            if d.project_uuid not in visible or d.depends_on_uuid not in visible:
                continue
            edges.append({'source': _ref('project', d.depends_on_uuid),
                          'target': _ref('project', d.project_uuid),
                          'relation': 'precedes'})

    # ── people: 사람 + 그 **소속** 부서 (knoxId 가 있는 사람만) ───────────
    #
    # 부서 노드는 `org` 와 나눠 쓴다 (2026-08-09).
    #     여기(`people`)  사람 —소속→ 부서   (`members_json[].부서`)
    #     `org`           과제 —담당→ 부서   (`depts_json`)
    # 「누가」와 「어느 조직이」는 다른 질문이라 토글을 갈랐다. 부서 노드 자체는
    # **필요한 쪽이 만든다**(`add_node` 는 같은 ref 면 한 번만 만든다) — 그래서
    # 한쪽만 켜도 부서가 제대로 보이고, 둘 다 켜면 같은 알약에 두 종류 선이 붙는다.
    #
    # ⚠️ 한 사람이 **여러 부서**로 나타날 수 있다. 참여인력 항목마다 부서를 따로
    #    적기 때문이다(개발 데이터에선 8명 전원이 9개 부서에 걸쳐 있다).
    #    하나로 줄이지 않는다 — 줄이면 어느 것이 맞는지 우리가 정하는 셈이고,
    #    그대로 두면 **데이터가 어긋나 있다는 사실이 화면에 보인다.**
    if 'people' in layers:
        seen_people = set()
        for p in projects:
            pjref = _ref('project', p.uuid)

            for knox, name, rel, dept in _person_entries(p):
                nref = _ref('person', knox)
                add_node(nref, 'person', name or knox, knoxId=knox)
                edges.append({'source': nref, 'target': pjref, 'relation': rel})

                if dept:
                    dref = _ref('dept', dept)
                    add_node(dref, 'dept', dept)
                    # 같은 (사람, 부서) 는 과제 수만큼 반복된다 — 한 번만 담는다.
                    if (nref, dref) not in seen_people:
                        seen_people.add((nref, dref))
                        edges.append({'source': nref, 'target': dref,
                                      'relation': 'belongs_to'})

            # 과제의 담당부서. 사람과 다른 관계다 — 사람이 소속된 것과
            # 과제를 맡은 것은 뜻이 다르다.

    # ── action: 액션아이템 (§6-B 의 uuid 가 정체성) ──────────────────────
    if 'action' in layers:
        for p in projects:
            for it in (p.action_items_json or []):
                if not isinstance(it, dict):
                    continue
                # ⚠️ `id` 는 저장할 때마다 다시 매겨지는 **순번**이다. uuid 만 쓴다.
                #    uuid 가 없는 항목(백필 전)은 그리지 않는다 — 매번 다른 노드가 된다.
                uid = str(it.get('uuid') or '').strip()
                if not uid:
                    continue
                aref = _ref('action', uid)
                add_node(aref, 'action', str(it.get('제목') or '').strip(),
                         done=bool(it.get('완료여부')),
                         dueDate=str(it.get('목표일') or '') or None)
                edges.append({'source': _ref('project', p.uuid), 'target': aref,
                              'relation': 'has_item'})

    # 엣지의 양 끝이 실제로 있는 노드인지 확인한다. 없는 끝이 하나라도 있으면
    # 라이브러리가 유령 노드를 만들어 낸다 — 화면에 이름 없는 점이 뜬다.
    edges = [e for e in edges if e['source'] in nodes and e['target'] in nodes]

    node_list = list(nodes.values())
    truncated = len(node_list) > MAX_NODES

    return {
        'nodes': node_list,
        'edges': edges,
        'stats': {
            'nodeCount': len(node_list),
            'edgeCount': len(edges),
            'byType': counts,
            'projectCount': len(projects),
        },
        'layers': sorted(layers),
        # 자르지 않는다. 화면이 "너무 많다, 필터를 좁혀라" 를 보여 주게 알리기만 한다.
        'truncated': truncated,
        'maxNodes': MAX_NODES,
    }, []


def filter_options(actor):
    """
    화면의 필터가 고를 수 있는 값. **볼 수 있는 과제에서만** 뽑는다 —
    남의 사업부 이름이 드롭다운에 뜨면 그 자체가 정보 유출이다.
    """
    # 취소 과제는 관계도에 안 그리므로 여기서도 뺀다 — 안 빼면 고르면 **빈 그림**이
    # 나오는 사업부·연도가 드롭다운에 남는다.
    projects = [p for p in Dt2Project.query.filter(
        Dt2Project.is_permanently_deleted.is_(False),
        Dt2Project.is_deleted.is_(False)).all()
        if P.can_view_project(actor, p) and (p.status or '').strip() != '취소']

    years = sorted({p.year for p in projects if p.year}, reverse=True)
    names = {(p.division or '').strip() for p in projects}
    names.discard('')
    colors = {d.name: d.color for d in Division.query.order_by(
        Division.order.asc(), Division.id.asc()).all()}
    divisions = [{'name': n, 'color': colors.get(n)}
                 for n in sorted(names, key=lambda x: (list(colors).index(x)
                                                       if x in colors else 999, x))]
    return {'years': years, 'divisions': divisions,
            'layers': list(LAYERS), 'defaultLayers': list(DEFAULT_LAYERS)}
