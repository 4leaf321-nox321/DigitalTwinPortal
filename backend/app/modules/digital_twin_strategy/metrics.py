"""
B. 활용과 성과 — 포탈 데이터로 계산되는 관측값.

사람이 매기지 않는다. 근거 원천(EvidenceSource)이 준 과제·KPI 를 사업부별로
집계한다. 원천이 fixture 인지 local 인지는 여기서 신경 쓰지 않는다 — 그래서
개발에서 만든 집계 로직이 운영에서 그대로 돈다.

계산 결과에는 source_mode 를 함께 남긴다. 합성 데이터로 뽑은 수치가 실제
관측값으로 오인되면 안 된다.
"""
from .definitions import METRIC_KEYS


def _to_float(value):
    """KPI 값은 문자열로 저장된다(kpi_records.value 가 String). 숫자가 아니면 버린다."""
    try:
        return float(str(value).replace(',', '').strip())
    except (TypeError, ValueError):
        return None


def compute_metrics(source, year, divisions):
    """사업부별 관측값을 계산한다.

    반환: { division_id: { metric_key: value|None } }
    값이 None 인 것은 '계산할 근거가 없음'이다. 0 과 구분해야 한다 —
    과제가 0건인 것과 데이터를 못 읽은 것은 다른 뜻이다.
    """
    projects = source.get_projects(year) or []
    kpis = source.get_kpis(year) or []

    by_name = {d.name: d.id for d in divisions}
    result = {d.id: {k: None for k in METRIC_KEYS} for d in divisions}

    # ── 과제 기반 지표 ────────────────────────────────────────────────
    grouped = {d.id: [] for d in divisions}
    for p in projects:
        division_id = by_name.get(p.get('사업부'))
        if division_id is not None:
            grouped[division_id].append(p)

    for division_id, items in grouped.items():
        m = result[division_id]
        m['project_count'] = len(items)

        depts = set()
        for p in items:
            for dept in (p.get('담당부서목록') or []):
                if dept:
                    depts.add(dept)
        m['dept_spread'] = len(depts)

        progresses = [p.get('progress') for p in items if isinstance(p.get('progress'), (int, float))]
        m['avg_progress'] = round(sum(progresses) / len(progresses), 1) if progresses else None

        if items:
            done = sum(1 for p in items if p.get('진행상태') == '완료')
            m['completion_rate'] = round(done * 100 / len(items), 1)

    # ── KPI 기반 지표 ─────────────────────────────────────────────────
    # 목표와 실적을 사업부별로 합산해 달성률을 낸다. 지표별 달성률의 평균이
    # 아니라 합계 기준이다 — 작은 지표 하나가 평균을 흔드는 것을 피한다.
    totals = {d.id: {'target': 0.0, 'actual': 0.0, 'seen': False} for d in divisions}
    for row in kpis:
        division_id = by_name.get(row.get('사업부'))
        if division_id is None:
            continue
        target = _to_float(row.get('목표'))
        actual = _to_float(row.get('실적'))
        if target is None or actual is None or target == 0:
            continue
        totals[division_id]['target'] += target
        totals[division_id]['actual'] += actual
        totals[division_id]['seen'] = True

    for division_id, t in totals.items():
        if t['seen'] and t['target'] > 0:
            result[division_id]['kpi_achievement'] = round(t['actual'] * 100 / t['target'], 1)

    return result
