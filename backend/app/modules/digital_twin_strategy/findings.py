"""
데이터가 먼저 말하는 부분.

진단의 출발점을 "사람이 격자를 채우는 것"에서 "시스템이 틀어진 지점을 짚는 것"으로
바꾼다. 근거 없이 매기는 점수는 다들 3점으로 수렴하고, 채우는 것 자체가 목적이
되어 아무것도 바꾸지 못한다.

여기서 나오는 것은 결론이 아니라 **눈에 띄는 사실**이다. 왜 그런지는 사람이
답하고, 그중 무엇이 올해의 크럭스인지도 사람이 고른다.

⚠️ 시간이 해결하는 것은 짚지 않는다.
   진행률이 낮다는 지적은 연말이면 저절로 사라진다. 여기서 잡는 것은 놔두면
   그대로 남는 구조적 결함이다 — 성과를 정의하지 않은 과제, 지표에 걸리지 않은
   과제, 사람·일정 쏠림, 따로 도는 과제.

규칙 기반이다. AI 는 뒤 Phase 에서 붙는다 — 규칙으로 잡히는 것부터 잡고, 규칙이
못 잡는 결합을 AI 에게 맡기는 편이 검증 가능하다.
"""

# 임계값은 코드에 둔다. 나중에 방법론 정의처럼 운영에서 조정하게 만든다.
NO_PERFORMANCE = 30.0        # 성과 미정의 비율이 이 위면 짚는다
NO_KPI_LINK = 30.0           # KPI 미연결 비율
UNCLASSIFIED_LINK = 40.0     # 연결 등급 미지정 비율
PL_CONCENTRATION = 25.0      # 한 PL 이 차지하는 비율
DEPT_CONCENTRATION = 50.0    # 한 부서가 차지하는 비율
PRIMARY_LINK_LOW = 20.0      # 등급 연결 중 주기여가 이 아래면 짚는다
DEADLINE_CROWDING = 50.0     # 한 분기에 몰린 비율
ISOLATED = 50.0              # 고립 과제 비율
KPI_SHORTFALL = 80.0         # KPI 달성률이 이 아래면 미달
SPREAD_CONCENTRATED = 4      # 참여 부서가 이 이하면 확산 정체


def _subject_particle(word):
    """받침 유무로 '이/가'를 고른다.

    부서명이 데이터에서 오므로 문장에 그대로 끼워 넣으면 'DA1팀가' 같은 것이
    나온다. 화면에 보이는 문장이라 어색하면 신뢰가 깎인다.
    영문·숫자로 끝나면 판단이 어려우니 안전하게 '이(가)' 로 둔다.
    """
    if not word:
        return '가'
    last = word[-1]
    code = ord(last)
    if 0xAC00 <= code <= 0xD7A3:              # 한글 음절
        return '이' if (code - 0xAC00) % 28 else '가'
    if last.isdigit() or last.isascii():
        return '이(가)'
    return '가'


def derive_findings(metrics_by_division, divisions, context=None):
    """관측값에서 눈에 띄는 것을 뽑는다.

    metrics_by_division: { division_id: { metric_key: value|None } }
    context: { division_id: {...} }  숫자만으로 부족한 부가 정보(예: 최다 부서명)
    반환: 각 항목에 왜 짚였는지(evidence)를 붙인 목록.
    """
    name = {d.id: d.name for d in divisions}
    context = context or {}
    findings = []

    def add(key, severity, title, detail, division_id=None, evidence=None):
        findings.append({
            'key': key,
            'severity': severity,          # high | medium | info
            'title': title,
            'detail': detail,
            'division_id': division_id,
            'division_name': name.get(division_id),
            'evidence': evidence or {},
        })

    # ── 데이터 공백 ────────────────────────────────────────────────────
    # 무엇을 이루려는지 적지 않고 일하는 상태. 끝나도 성과를 말할 수 없다.
    for d in divisions:
        m = metrics_by_division.get(d.id, {})

        v = m.get('no_performance_rate')
        if v is not None and v >= NO_PERFORMANCE:
            add('gap_performance', 'high',
                f'{d.name} 과제 {v}% 가 성과를 정의하지 않았습니다',
                '무엇을 이루려는지 적지 않은 채 진행 중입니다. 끝나도 무엇이 '
                '좋아졌는지 말할 수 없고, KPI 기여도 설명할 수 없습니다.',
                d.id, {'no_performance_rate': v})

        v = m.get('no_kpi_link_rate')
        if v is not None and v >= NO_KPI_LINK:
            add('gap_kpi_link', 'high',
                f'{d.name} 과제 {v}% 가 어느 KPI 에도 걸려 있지 않습니다',
                '전략과 실행이 끊긴 지점입니다. 지표를 밀지 않는 과제가 많다면 '
                '지표가 현실을 못 담고 있거나, 과제가 방향과 무관한 것입니다.',
                d.id, {'no_kpi_link_rate': v})

        v = m.get('unclassified_link_rate')
        if v is not None and v >= UNCLASSIFIED_LINK:
            add('gap_link_grade', 'medium',
                f'{d.name} KPI 연결 {v}% 가 등급 미지정입니다',
                '주·보조·간접을 정하지 않아 연결이 전부 동등해 보입니다. '
                '어느 과제가 그 지표를 실제로 떠받치는지 읽을 수 없습니다.',
                d.id, {'unclassified_link_rate': v})

        # 등급을 매긴 것 중 주기여가 적으면, 지표를 직접 미는 과제 없이
        # 기반·간접만 쌓고 있다는 뜻이다.
        v = m.get('primary_link_rate')
        grades = context.get(d.id, {}).get('link_grades') or {}
        if v is not None and v <= PRIMARY_LINK_LOW and grades.get('graded_total', 0) >= 5:
            add('few_primary_links', 'medium',
                f'{d.name} 등급 연결 중 주기여가 {v}% 뿐입니다',
                (f"주 {grades.get('primary', 0)} · 보조 {grades.get('support', 0)} · "
                 f"간접 {grades.get('indirect', 0)} 건입니다. 지표를 직접 밀어붙이는 "
                 '과제 없이 기반과 간접 기여만 쌓이고 있을 수 있습니다.'),
                d.id, {'primary_link_rate': v, **grades})

    # ── 쏠림 ──────────────────────────────────────────────────────────
    for d in divisions:
        m = metrics_by_division.get(d.id, {})

        v = m.get('pl_concentration')
        if v is not None and v >= PL_CONCENTRATION:
            add('concentration_pl', 'medium',
                f'{d.name} 과제의 {v}% 를 한 사람이 맡고 있습니다',
                '사람에 묶인 조직은 그 사람이 빠지면 멈춥니다. 지식이 개인에게 '
                '남고 조직 역량으로 축적되지 않습니다.',
                d.id, {'pl_concentration': v})

        v = m.get('deadline_crowding')
        if v is not None and v >= DEADLINE_CROWDING:
            add('concentration_deadline', 'medium',
                f'{d.name} 과제의 {v}% 가 같은 분기에 끝납니다',
                '검증과 마무리 부하가 한꺼번에 닥칩니다. 그 시기에 품질이 '
                '떨어지거나 일정이 밀릴 가능성이 큽니다.',
                d.id, {'deadline_crowding': v})

        # 참여 부서 수와 편중도는 서로 다른 것을 말한다.
        #   부서 2개              → 애초에 몇 곳만 한다
        #   부서 6개 · 편중 70%   → 이름만 여럿이고 실제로는 한 곳이 다 한다
        # 다만 둘 다 걸리면 같은 이야기를 두 번 하게 되므로 하나로 합쳐 말한다.
        spread = m.get('dept_spread')
        skew = m.get('dept_concentration')
        ctx = context.get(d.id, {})
        top = ctx.get('top_dept')
        ranking = ctx.get('dept_ranking') or []
        others = ', '.join(f"{r['name']} {r['count']}건" for r in ranking[1:3])

        narrow = spread is not None and spread <= SPREAD_CONCENTRATED
        skewed = skew is not None and skew >= DEPT_CONCENTRATION

        if skewed:
            actor = top or '한 부서'
            head = f'{d.name} 과제의 {skew}% 를 {actor}{_subject_particle(actor)} 맡고 있습니다'
            body = (
                f'참여 부서가 {spread}곳뿐인 데다 그중 한 곳에 몰려 있습니다. '
                if narrow else
                f'참여 부서는 {spread}곳이지만 한 곳이 대부분을 맡고 있어, '
                '이름만 여럿이고 실제로는 한 부서가 하는 상태입니다. '
            )
            if others:
                body += f'다음은 {others}.'
            add('concentration_dept_skew', 'medium', head, body.strip(), d.id,
                {'dept_concentration': skew, 'dept_spread': spread,
                 'top_dept': top, 'ranking': ranking})
        elif narrow:
            add('concentration_dept', 'medium',
                f'{d.name} 참여 부서 {spread}곳',
                '소수 부서만 참여하고 있습니다. 확산되지 않으면 조직 역량으로 '
                '남지 않습니다.',
                d.id, {'dept_spread': spread})

    # ── 연결의 부재 ────────────────────────────────────────────────────
    for d in divisions:
        m = metrics_by_division.get(d.id, {})
        v = m.get('isolated_rate')
        if v is not None and v >= ISOLATED:
            add('isolated_projects', 'medium',
                f'{d.name} 과제 {v}% 가 다른 과제와 이어지지 않습니다',
                '선행·후속 관계가 없는 과제가 많습니다. 각자 따로 돌면 결과가 '
                '쌓이지 않고 비슷한 일이 반복될 수 있습니다.',
                d.id, {'isolated_rate': v})

    # ── 성과 ──────────────────────────────────────────────────────────
    for d in divisions:
        m = metrics_by_division.get(d.id, {})
        kpi = m.get('kpi_achievement')
        count = m.get('project_count')
        if kpi is not None and kpi < KPI_SHORTFALL:
            counts = [metrics_by_division.get(x.id, {}).get('project_count') for x in divisions]
            valid = [c for c in counts if c is not None]
            avg_count = sum(valid) / len(valid) if valid else None
            if count is not None and avg_count and count >= avg_count:
                add('volume_without_outcome', 'high',
                    f'{d.name} 과제 {count}건인데 KPI {kpi}%',
                    '과제 수는 평균 이상인데 성과가 따라오지 않습니다. 양이 아니라 '
                    '방향이나 실행의 문제일 수 있습니다.',
                    d.id, {'project_count': count, 'kpi_achievement': kpi})
            else:
                add('kpi_shortfall', 'high',
                    f'{d.name} KPI 달성률 {kpi}%',
                    f'목표의 {KPI_SHORTFALL:.0f}% 에 못 미칩니다.',
                    d.id, {'kpi_achievement': kpi})

    # ── 전사로 보는 것 ─────────────────────────────────────────────────
    # 사업부마다 걸리는 것은 개별 사정이지만, 전 사업부에 걸리면 구조 문제다.
    for key, metric_key, threshold, title, detail in (
        ('company_gap_performance', 'no_performance_rate', NO_PERFORMANCE,
         '전 사업부에서 성과 정의가 비어 있습니다',
         '특정 사업부의 습관이 아니라 양식이나 절차가 그것을 요구하지 않는 것일 수 있습니다.'),
        ('company_gap_kpi_link', 'no_kpi_link_rate', NO_KPI_LINK,
         '전 사업부에서 KPI 연결이 비어 있습니다',
         '지표 체계가 현장 과제를 담지 못하고 있을 가능성이 있습니다.'),
    ):
        values = [metrics_by_division.get(d.id, {}).get(metric_key) for d in divisions]
        valid = [v for v in values if v is not None]
        if valid and min(valid) >= threshold:
            add(key, 'high', title, detail, None, {metric_key: {'min': min(valid), 'max': max(valid)}})

    spreads = [metrics_by_division.get(d.id, {}).get('dept_spread') for d in divisions]
    valid_spreads = [s for s in spreads if s is not None]
    if valid_spreads and max(valid_spreads) <= SPREAD_CONCENTRATED:
        add('spread_stalled_company', 'high',
            '전 사업부에서 확산이 정체돼 있습니다',
            f'모든 사업부의 참여 부서가 {max(valid_spreads)}개 이하입니다. '
            '개별 사업부 문제가 아니라 전사 차원의 걸림돌일 가능성이 큽니다.',
            None, {'max_dept_spread': max(valid_spreads)})

    kpis = [metrics_by_division.get(d.id, {}).get('kpi_achievement') for d in divisions]
    valid_kpis = [k for k in kpis if k is not None]
    if len(valid_kpis) >= 2 and (max(valid_kpis) - min(valid_kpis)) >= 30:
        best = max(divisions, key=lambda d: metrics_by_division.get(d.id, {}).get('kpi_achievement') or -1)
        worst = min(divisions, key=lambda d: metrics_by_division.get(d.id, {}).get('kpi_achievement') or 999)
        add('division_gap', 'info',
            f'사업부 간 KPI 편차 {max(valid_kpis) - min(valid_kpis):.0f}%p',
            f'{best.name} 와 {worst.name} 의 차이가 큽니다. 잘 되는 쪽에서 '
            '가져올 것이 있는지 볼 만합니다.',
            None, {'best': best.name, 'worst': worst.name})

    order = {'high': 0, 'medium': 1, 'info': 2}
    findings.sort(key=lambda f: (order.get(f['severity'], 9), f['title']))
    return findings


def derive_kpi_findings(coverage):
    """지표 쪽에서 본 공백.

    사업부별 집계로는 안 드러나는 것이 있다. 어느 사업부도 그 지표를 주기여로
    밀지 않으면, 사업부별 숫자는 다 멀쩡해 보여도 그 지표는 아무도 책임지지
    않는 상태다. 목표만 있고 달성할 과제가 없는 것이다.
    """
    findings = []

    for row in coverage or []:
        kpi = row['kpi']
        if row['total_links'] == 0:
            continue

        if row['primary'] == 0:
            findings.append({
                'key': 'kpi_no_primary',
                'severity': 'high',
                'title': f'"{kpi}" 를 주기여로 미는 과제가 없습니다',
                'detail': (
                    f"연결 {row['total_links']}건이 모두 보조·간접이거나 등급 미지정입니다"
                    f"(보조 {row['support']} · 간접 {row['indirect']} · 미지정 {row['unset']}). "
                    '목표는 있는데 그것을 직접 달성할 과제가 없는 상태일 수 있습니다.'
                ),
                'division_id': None,
                'division_name': None,
                'evidence': dict(row),
            })

        if len(row['divisions']) == 1:
            findings.append({
                'key': 'kpi_single_division',
                'severity': 'info',
                'title': f'"{kpi}" 는 {row["divisions"][0]} 에서만 다룹니다',
                'detail': '한 사업부만 이 지표에 걸려 있습니다. 전사 지표라면 '
                          '나머지가 손대지 않고 있는 것이고, 사업부 전용이라면 정상입니다.',
                'division_id': None,
                'division_name': None,
                'evidence': dict(row),
            })

    order = {'high': 0, 'medium': 1, 'info': 2}
    findings.sort(key=lambda f: (order.get(f['severity'], 9), f['title']))
    return findings
