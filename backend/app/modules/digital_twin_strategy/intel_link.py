# -*- coding: utf-8 -*-
"""기술정보(intel) → 전략. AUDIT_PLAN 3-1.

전략의 technical 진단(데이터·모델·통합·분석·응용)을 지금 손과 설문으로 매기는데,
그 답의 일차 근거 — **역량 81개 × 사업부별 단계 × 무슨 도구로** — 는 기술정보
모듈에 이미 쌓여 있다. 여기가 그 둘을 잇는다. 세 가지를 만든다:

    ① technical 진단의 **후보 레벨**   (사람이 승격해야 basis='auto' 가 된다)
    ② SWOT O·T 의 **후보**            (근거가 걸린 기술 소식)
    ③ 인텔發 **발견 사항**             (역량 기록률 · 낡은 근거 비율)

⚠️⚠️ **읽기 전용이다.** 전략이 인텔을 읽지, 인텔은 전략을 모른다 — evidence.py 가
   대시보드를 읽는 것과 같은 결합 방향이다. 인텔 표를 여기서 고치는 코드가 생기는
   순간 두 모듈이 서로를 알게 된다.

⚠️ **자동으로 진단을 덮지 않는다.** 설문(apply-survey)과 같은 규칙 — 후보는 조회에
   실려 나가기만 하고, 반영은 사람이 apply-intel 을 눌렀을 때다. 손으로 매긴
   칸(basis='manual')은 그때도 건너뛴다.
"""
from datetime import date, timedelta

# ── 부채꼴 → 진단 차원 ──────────────────────────────────────────────────────
#
# 인텔의 여섯 부채꼴을 technical 다섯 차원에 접는다. 정의(definitions.py)를 두고
# 맞춘 것이다:
#
#     data         「현실의 값을 얼마나 확보하고 연결하는가」 ← 데이터·연결
#     model        「대상을 얼마나 정밀하게 모사하는가」     ← 시뮬레이션·해석,
#                   모델의 신뢰(V&V·ROM)도 모사의 질이다     ← 모델 신뢰·운영
#     integration  「모델과 시스템이 이어져 있는가」          ← 플랫폼, 표준화
#     analysis     「예측·최적화까지 하는가」                ← AI
#
# ⚠️ **application(응용)은 안 접는다.** 「실제 의사결정에 쓰이는가」는 도구 목록이
#    말해 줄 수 없다 — 도구를 도입한 것과 판단에 쓰는 것은 다른 일이다. 여기에
#    후보를 내면 그 후보는 인상이다. 빈 것이 정직하다.
SECTOR_TO_DIMENSION = {
    '데이터·연결': 'data',
    '시뮬레이션·해석': 'model',
    '모델 신뢰·운영': 'model',
    'AI': 'analysis',
    '플랫폼': 'integration',
    '표준화': 'integration',
}

# ── 단계 → 레벨 무게 ────────────────────────────────────────────────────────
#
# 진단 레벨의 뜻(1 없음/수기 · 2 부분 · 3 연계 · 4 예측/최적화 · 5 폐루프)에
# 단계를 얹은 것이다: 도입(이미 쓴다)=4, 시험=3, 관찰=2, 감지(막 봤다)=1.
#
# ⚠️ **5(폐루프)는 여기서 안 나온다.** 도구를 도입했다는 사실만으로 「결과가
#    현실에 자동으로 되돌아간다」고 말할 수는 없다 — 그 판단은 사람 몫이다.
# ⚠️ **보류는 수준이 아니라 판단이다** — 평균에서 빼고, 기록으로만 센다.
STAGE_LEVEL = {'도입': 4, '시험': 3, '관찰': 2, '감지': 1}


def _load_intel():
    """인텔 표를 읽는다. 모듈이 없거나 표가 비면 None — 부르는 쪽이 조용히 접는다."""
    try:
        from app.modules.digital_twin_intel.models import (
            IntelDivisionStage, IntelTech,
        )
        from app.modules.digital_twin_intel import services as intel
    except Exception:
        return None
    caps = IntelTech.query.filter(
        IntelTech.kind == 'capability',
        IntelTech.is_archived.is_(False),
    ).all()
    if not caps:
        return None
    rows = IntelDivisionStage.query.filter(
        IntelDivisionStage.stage.isnot(None)).all()
    # 낡음은 인텔의 규칙 그대로 잰다 — 여기서 다시 만들면 두 화면이 갈린다.
    stats = intel.evidence_stats([c.uuid for c in caps])
    return caps, rows, stats


def collect(divisions, thresholds=None):
    """사업부×차원 **후보 레벨**과 사업부별 기록 요약.

    돌려주는 모양:
        {'cells': [...], 'divisions': [...], 'total_caps': N}

    cells 한 칸:
        division_id · dimension · suggested_level(1~4 | None)
        considered(평균에 든 역량 수) · recorded(보류 포함 기록 수)
        insufficient(왜 후보가 없는가) · stages({단계: 수}) · examples([이름…])

    ⚠️ 표본이 얇으면 후보를 안 낸다(intel_min_caps, 기본 3). 역량 한두 개의
       단계로 차원 하나를 말하면 그건 관찰이 아니라 확대해석이다.
    """
    thresholds = thresholds or {}
    min_caps = int(thresholds.get('intel_min_caps', 3) or 3)

    loaded = _load_intel()
    if loaded is None:
        return {'cells': [], 'divisions': [], 'total_caps': 0}
    caps, rows, stats = loaded

    sector_of = {c.uuid: c.category for c in caps}
    name_of = {c.uuid: c.name for c in caps}
    cap_of = {c.uuid: c for c in caps}
    total_caps = len(caps)

    # 인텔은 사업부를 **이름**으로 들고 있다(하드 결합을 피한 값이라 FK 가 없다).
    by_name = {d.name: d for d in divisions}

    # division name → dimension → [row…] / 사업부별 기록·낡음 셈
    per_dim = {}
    per_div = {d.id: {'recorded': 0, 'stale': 0} for d in divisions}
    for r in rows:
        d = by_name.get(r.division)
        if d is None or r.tech_uuid not in sector_of:
            continue
        per_div[d.id]['recorded'] += 1
        cnt, last = stats.get(r.tech_uuid, (0, None))
        cap = cap_of[r.tech_uuid]
        if cap.is_stale(last, stage=r.stage, said_at=r.changed_at):
            per_div[d.id]['stale'] += 1
        dim = SECTOR_TO_DIMENSION.get(sector_of[r.tech_uuid])
        if dim:
            per_dim.setdefault((d.id, dim), []).append(r)

    cells = []
    for d in divisions:
        for dim in sorted(set(SECTOR_TO_DIMENSION.values())):
            mine = per_dim.get((d.id, dim), [])
            leveled = [r for r in mine if r.stage in STAGE_LEVEL]
            stage_counts = {}
            for r in mine:
                stage_counts[r.stage] = stage_counts.get(r.stage, 0) + 1
            cell = {
                'division_id': d.id,
                'dimension': dim,
                'recorded': len(mine),
                'considered': len(leveled),
                'stages': stage_counts,
                # 도입부터 차례로 — 「무엇을 보고 이 레벨인가」가 이 목록이다.
                'examples': [
                    name_of[r.tech_uuid] for r in sorted(
                        leveled, key=lambda r: -STAGE_LEVEL[r.stage])[:5]
                ],
                'suggested_level': None,
                'insufficient': None,
            }
            if len(leveled) < min_caps:
                cell['insufficient'] = (
                    f'기록한 역량이 {len(leveled)}개뿐입니다'
                    f' (후보를 내려면 {min_caps}개)')
            else:
                avg = sum(STAGE_LEVEL[r.stage] for r in leveled) / len(leveled)
                cell['suggested_level'] = max(1, min(4, round(avg)))
            cells.append(cell)

    div_rows = []
    for d in divisions:
        rec = per_div[d.id]['recorded']
        stale = per_div[d.id]['stale']
        div_rows.append({
            'division_id': d.id,
            'name': d.name,
            'recorded': rec,
            'total': total_caps,
            'coverage': round(rec * 100 / total_caps, 1) if total_caps else None,
            'stale': stale,
            'stale_rate': round(stale * 100 / rec, 1) if rec else None,
        })

    return {'cells': cells, 'divisions': div_rows, 'total_caps': total_caps}


def attach_current(collected, assessments):
    """후보 옆에 **지금 값**을 붙인다. 후보만 보이면 무엇을 바꾸는지 모른다."""
    current = {
        (a['division_id'], a['dimension']): a
        for a in assessments if a.get('category') == 'technical'
    }
    for c in collected['cells']:
        a = current.get((c['division_id'], c['dimension'])) or {}
        c['current_level'] = a.get('current_level')
        c['current_basis'] = a.get('basis')
    return collected


def derive_findings(collected, divisions, thresholds=None):
    """인텔發 발견 사항.

    ⚠️ 「기록률이 낮다」는 그 사업부의 수준이 낮다는 말이 **아니다** — technical
       진단이 근거 없이 서 있다는 말이다. 문장이 그 차이를 지켜야 한다.
    """
    thresholds = thresholds or {}
    low = float(thresholds.get('intel_coverage_low', 30.0) or 30.0)
    stale_at = float(thresholds.get('intel_stale_rate', 50.0) or 50.0)
    name = {d.id: d.name for d in divisions}
    out = []

    def add(key, severity, division_id, title, detail, evidence):
        out.append({
            'key': key, 'severity': severity, 'title': title, 'detail': detail,
            'division_id': division_id,
            'division_name': name.get(division_id),
            'evidence': evidence or {},
        })

    rows = collected.get('divisions') or []
    total = collected.get('total_caps') or 0
    if not rows or not total:
        return out

    # 전부 낮으면 사업부 사정이 아니라 판 전체가 빈 것이다 — 전사로 한 번만.
    lows = [r for r in rows if (r['coverage'] or 0) < low]
    if len(lows) == len(rows):
        most = max(r['recorded'] for r in rows)
        add('intel_coverage:all', 'high', None,
            '기술 레이더가 통째로 비어 있습니다',
            (f'역량 {total}개 중 가장 많이 적은 사업부가 {most}개입니다. '
             'technical 진단 전체가 근거 없이 서 있습니다 — 「사업부 적기」부터.'),
            {'coverage': {r['name']: r['coverage'] for r in rows}})
    else:
        for r in lows:
            add(f"intel_coverage:{r['division_id']}", 'medium', r['division_id'],
                f"{r['name']} 의 역량 기록률 {r['coverage']}%",
                (f"기술 레이더의 역량 {total}개 중 {r['recorded']}개만 적었습니다 — "
                 '이 사업부의 technical 진단이 근거 없이 서 있습니다.'),
                {'recorded': r['recorded'], 'total': total,
                 'coverage': r['coverage']})

    for r in rows:
        if r['stale_rate'] is None or r['recorded'] < 3:
            continue
        if r['stale_rate'] >= stale_at:
            add(f"intel_stale:{r['division_id']}", 'medium', r['division_id'],
                f"{r['name']} 의 낡은 근거 {r['stale_rate']}%",
                (f"적어 둔 역량 {r['recorded']}개 중 {r['stale']}개는 근거가 "
                 '낡았습니다 — 적어 둔 뒤 아무 소식도 안 붙었습니다.'),
                {'stale': r['stale'], 'recorded': r['recorded']})
    return out


def derive_element_candidates(limit=12, days=180):
    """O·T 후보 — **근거가 걸린** 기술 소식.

    ⚠️ 근거가 걸린 것만 낸다(남은 결정에서 그렇게 정했다). 사람이 한 번 읽고
       「이 기술 얘기다」라고 이어 둔 소식이라야 후보 자격이 있다 — 안 걸린
       소식까지 내면 이 목록이 뉴스 피드가 된다.

    ⚠️ kind 는 일단 'O' 로 낸다. 소식이 기회인지 위협인지는 자료에 없다 — 그
       판단은 승격하는 사람이 하고, 올린 뒤 화면에서 바꿀 수 있다. 문구가 그
       사실을 말한다.
    """
    try:
        from app.modules.digital_twin_intel.models import (
            IntelEvidence, IntelNews, IntelTech,
        )
    except Exception:
        return []
    since = date.today() - timedelta(days=days)
    news = (IntelNews.query
            .filter(IntelNews.published_at.isnot(None),
                    IntelNews.published_at >= since)
            .order_by(IntelNews.published_at.desc())
            .limit(200).all())
    if not news:
        return []
    ev = IntelEvidence.query.filter(
        IntelEvidence.news_uuid.in_([n.uuid for n in news])).all()
    linked = {}
    for e in ev:
        linked.setdefault(e.news_uuid, []).append(e.tech_uuid)
    tech_names = {t.uuid: t.name for t in IntelTech.query.filter(
        IntelTech.uuid.in_(sorted({u for us in linked.values() for u in us}))
    ).all()} if linked else {}

    out = []
    for n in news:
        techs = [tech_names.get(u) for u in linked.get(n.uuid, [])]
        techs = [t for t in techs if t]
        if not techs:
            continue                      # 근거 없는 소식은 후보가 아니다
        out.append({
            'key': f'intel_news:{n.uuid}',
            'kind': 'O',
            'title': n.title[:200],
            'detail': ((n.summary or '').strip()[:200] or '요약 없음')
            + f" — 걸린 기술: {' · '.join(techs[:4])}."
            + ' 위협이면 올린 뒤 T 로 바꾸세요.',
            'division_id': None,
            'source_type': 'intel',
        })
        if len(out) >= limit:
            break
    return out
