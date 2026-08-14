"""
B. 활용과 성과 — 포탈 데이터로 계산되는 관측값.

사람이 매기지 않는다. 근거 원천(EvidenceSource)이 준 과제·KPI 를 사업부별로
집계한다. 원천이 fixture 인지 local 인지는 여기서 신경 쓰지 않는다 — 그래서
개발에서 만든 집계 로직이 운영에서 그대로 돈다.

⚠️ 시간이 지나면 저절로 좋아지는 값은 재지 않는다.
   진행률·완료율은 연말이면 어차피 100% 에 가까워지므로 "지금 몇 %인가"가
   전략 판단 근거가 못 된다. 대신 놔두면 그대로 남는 구조적 결함을 잰다 —
   성과를 정의하지 않은 과제, KPI 에 걸리지 않은 과제, 사람·일정 쏠림 같은 것.
"""
from .definitions import METRIC_KEYS


def _to_float(value):
    """KPI 값은 문자열로 저장된다(kpi_records.value 가 String). 숫자가 아니면 버린다."""
    try:
        return float(str(value).replace(',', '').strip())
    except (TypeError, ValueError):
        return None


def _pct(part, whole):
    return round(part * 100 / whole, 1) if whole else None


def compute_metrics(source, year, divisions):
    """사업부별 관측값을 계산한다.

    반환: (values, context)
      values  { division_id: { metric_key: value|None } }
      context { division_id: { ... } }  숫자만으로는 부족한 부가 정보.
              편중도가 높을 때 "어느 부서인가"를 말해주려면 이름이 필요하다.

    값이 None 인 것은 '계산할 근거가 없음'이다. 0 과 구분해야 한다 —
    과제가 0건인 것과 데이터를 못 읽은 것은 다른 뜻이다.
    """
    projects = source.get_projects(year) or []
    kpis = source.get_kpis(year) or []

    by_name = {d.name: d.id for d in divisions}
    result = {d.id: {k: None for k in METRIC_KEYS} for d in divisions}
    context = {d.id: {} for d in divisions}

    grouped = {d.id: [] for d in divisions}
    for p in projects:
        division_id = by_name.get(p.get('사업부'))
        if division_id is not None:
            grouped[division_id].append(p)

    for division_id, items in grouped.items():
        m = result[division_id]
        total = len(items)
        m['project_count'] = total
        if not total:
            continue

        # 부서별 과제 수. 한 과제에 여러 부서가 걸리면 각 부서에 한 번씩 센다 —
        # 참여했는지를 보는 것이지 지분을 나누는 것이 아니다.
        dept_counts = {}
        for p in items:
            for dept in (p.get('담당부서목록') or []):
                if dept:
                    dept_counts[dept] = dept_counts.get(dept, 0) + 1

        m['dept_spread'] = len(dept_counts)

        if dept_counts:
            top_dept, top_count = max(dept_counts.items(), key=lambda kv: kv[1])
            total_assignments = sum(dept_counts.values())
            m['dept_concentration'] = _pct(top_count, total_assignments)
            context[division_id]['top_dept'] = top_dept
            context[division_id]['top_dept_count'] = top_count
            # 상위 3개까지 남긴다. "어느 부서만 많다"를 말하려면 목록이 있어야 한다.
            context[division_id]['dept_ranking'] = [
                {'name': n, 'count': c}
                for n, c in sorted(dept_counts.items(), key=lambda kv: -kv[1])[:3]
            ]

        # 무엇을 이루려는지 적지 않은 채 진행 중인 과제.
        # 끝나도 무엇이 좋아졌는지 말할 수 없다.
        no_perf = sum(1 for p in items if not (p.get('performance_count') or 0))
        m['no_performance_rate'] = _pct(no_perf, total)

        # 어느 지표에도 걸려 있지 않은 과제 — 전략과 실행이 끊긴 지점.
        no_link = sum(1 for p in items if not (p.get('kpi_links') or []))
        m['no_kpi_link_rate'] = _pct(no_link, total)

        # 걸긴 걸었는데 어떻게 기여하는지 정하지 않은 연결.
        # 전부 동등해 보이면 무엇이 핵심인지 읽을 수 없다.
        links = [l for p in items for l in (p.get('kpi_links') or [])]
        if links:
            unclassified = sum(1 for l in links if not l.get('relation_type'))
            m['unclassified_link_rate'] = _pct(unclassified, len(links))

            # 등급별로 따로 센다. 순서척도라 주=3·보조=2 로 합치면
            # '간접 3건'과 '주 1건'이 같아진다(Dt2ProjectKpi 주석).
            graded = [l for l in links if l.get('relation_type')]
            if graded:
                by_grade = {}
                for l in graded:
                    g = l['relation_type']
                    by_grade[g] = by_grade.get(g, 0) + 1
                m['primary_link_rate'] = _pct(by_grade.get('primary', 0), len(graded))
                context[division_id]['link_grades'] = {
                    'primary': by_grade.get('primary', 0),
                    'support': by_grade.get('support', 0),
                    'indirect': by_grade.get('indirect', 0),
                    'graded_total': len(graded),
                }

        # 한 사람에게 몰린 정도. 사람에 묶인 조직은 그 사람이 빠지면 멈춘다.
        pl_counts = {}
        for p in items:
            pl = p.get('과제PL')
            if pl:
                pl_counts[pl] = pl_counts.get(pl, 0) + 1
        if pl_counts:
            m['pl_concentration'] = _pct(max(pl_counts.values()), total)

        # 종료가 한 분기에 몰리면 검증 부하가 한꺼번에 닥친다.
        quarters = {}
        for p in items:
            q = p.get('end_quarter')
            if q:
                quarters[q] = quarters.get(q, 0) + 1
        if quarters:
            m['deadline_crowding'] = _pct(max(quarters.values()), total)

        # 선행·후속 어느 쪽과도 안 이어진 과제. 많으면 축적이 되지 않는다.
        isolated = sum(1 for p in items if not (p.get('dependency_count') or 0))
        m['isolated_rate'] = _pct(isolated, total)

    # ── KPI 달성률 ────────────────────────────────────────────────────
    # 목표와 실적을 사업부별로 합산해 낸다. 지표별 달성률의 평균이 아니라
    # 합계 기준이다 — 작은 지표 하나가 평균을 흔드는 것을 피한다.
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

    return result, context


def compute_kpi_coverage(source, year, divisions):
    """지표 쪽에서 본 공백.

    사업부 관점(compute_metrics)이 "이 조직이 지표에 얼마나 걸려 있나"를 본다면,
    여기서는 뒤집어 **"이 지표를 실제로 미는 과제가 있는가"** 를 본다.

    주기여가 하나도 없는 지표는 아무도 책임지고 밀지 않는 지표다. 목표만 있고
    그것을 달성할 과제가 없는 상태이며, 사업부별 집계로는 드러나지 않는다.

    반환: [{ kpi, total_links, primary, support, indirect, unset,
             divisions: [사업부명...] }]
    """
    projects = source.get_projects(year) or []
    target_names = {d.name for d in divisions}

    rows = {}
    for p in projects:
        division = p.get('사업부')
        for link in (p.get('kpi_links') or []):
            kpi = link.get('kpi')
            if not kpi:
                continue
            row = rows.setdefault(kpi, {
                'kpi': kpi, 'total_links': 0,
                'primary': 0, 'support': 0, 'indirect': 0, 'unset': 0,
                'divisions': set(),
            })
            row['total_links'] += 1
            grade = link.get('relation_type')
            row[grade if grade in ('primary', 'support', 'indirect') else 'unset'] += 1
            if division in target_names:
                row['divisions'].add(division)

    out = []
    for row in rows.values():
        row['divisions'] = sorted(row['divisions'])
        out.append(row)
    # 미는 과제가 없는 지표부터 보여준다.
    out.sort(key=lambda r: (r['primary'], r['total_links']))
    return out
