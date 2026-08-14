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

# 임계값은 인자로 받는다. 기본값과 운영 오버라이드는 definitions.get_thresholds()
# 가 합쳐서 준다 — 어느 값이 맞는지는 실제 데이터를 봐야 알 수 있고, 그 판단은
# 운영에서 이뤄지므로 배포 없이 바꿀 수 있어야 한다.
from .definitions import DEFAULT_THRESHOLDS


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


def _object_particle(word):
    """받침 유무로 '을/를'을 고른다. 지표명이 데이터에서 오기 때문에 필요하다."""
    if not word:
        return '를'
    last = word[-1]
    code = ord(last)
    if 0xAC00 <= code <= 0xD7A3:
        return '을' if (code - 0xAC00) % 28 else '를'
    if last.isdigit() or last.isascii():
        return '을(를)'
    return '를'


def _topic_particle(word):
    """받침 유무로 '은/는'을 고른다."""
    if not word:
        return '는'
    last = word[-1]
    code = ord(last)
    if 0xAC00 <= code <= 0xD7A3:
        return '은' if (code - 0xAC00) % 28 else '는'
    if last.isdigit() or last.isascii():
        return '은(는)'
    return '는'


def _all_divisions_hit(metrics_by_division, divisions, metric_key, threshold, worse='higher'):
    """모든 사업부가 임계값을 넘었는가.

    개발 DB(시드 데이터)를 붙여 보니 전 사업부가 똑같이 걸리는 항목이 나왔다 —
    과제 대부분의 종료월이 12월이라 일정 쏠림이 어디나 100%, 선행연결 행이 두
    개뿐이라 고립 비율도 어디나 100%.

    ⚠️ 그 값들은 시드가 만든 것이라 현실을 말해주지 않는다. 그래도 이 처리는
       필요하다 — 어떤 항목이든 전 사업부가 같은 값이면 사업부 비교에 쓸 수
       없고, 사업부마다 한 줄씩 내보내면 정작 차이가 있는 항목이 묻힌다.
       **전부 걸리면 개별 사정이 아니라 관행이나 구조의 문제**이므로 전사로
       한 번만 말한다. 실제 데이터에 편차가 있으면 이 처리는 자동으로 비켜간다.
    """
    values = [metrics_by_division.get(d.id, {}).get(metric_key) for d in divisions]
    valid = [v for v in values if v is not None]
    if len(valid) < 2 or len(valid) != len(divisions):
        return False
    return all(v >= threshold for v in valid) if worse == 'higher' \
        else all(v <= threshold for v in valid)


def derive_findings(metrics_by_division, divisions, context=None, thresholds=None):
    """관측값에서 눈에 띄는 것을 뽑는다.

    metrics_by_division: { division_id: { metric_key: value|None } }
    context: { division_id: {...} }  숫자만으로 부족한 부가 정보(예: 최다 부서명)
    반환: 각 항목에 왜 짚였는지(evidence)를 붙인 목록.
    """
    name = {d.id: d.name for d in divisions}
    context = context or {}
    T = {**DEFAULT_THRESHOLDS, **(thresholds or {})}
    findings = []

    # 전 사업부가 걸리는 항목은 사업부별로 반복하지 않는다.
    universal = {
        key: _all_divisions_hit(metrics_by_division, divisions, key, threshold)
        for key, threshold in (
            ('no_performance_rate', T['no_performance']),
            ('no_kpi_link_rate', T['no_kpi_link']),
            ('unclassified_link_rate', T['unclassified_link']),
            ('deadline_crowding', T['deadline_crowding']),
            ('isolated_rate', T['isolated']),
        )
    }

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
        if v is not None and v >= T['no_performance'] and not universal['no_performance_rate']:
            add('gap_performance', 'high',
                f'{d.name} 과제 {v}% 가 성과를 정의하지 않았습니다',
                '무엇을 이루려는지 적지 않은 채 진행 중입니다. 끝나도 무엇이 '
                '좋아졌는지 말할 수 없고, KPI 기여도 설명할 수 없습니다.',
                d.id, {'no_performance_rate': v})

        v = m.get('no_kpi_link_rate')
        if v is not None and v >= T['no_kpi_link'] and not universal['no_kpi_link_rate']:
            add('gap_kpi_link', 'high',
                f'{d.name} 과제 {v}% 가 어느 KPI 에도 걸려 있지 않습니다',
                '전략과 실행이 끊긴 지점입니다. 지표를 밀지 않는 과제가 많다면 '
                '지표가 현실을 못 담고 있거나, 과제가 방향과 무관한 것입니다.',
                d.id, {'no_kpi_link_rate': v})

        v = m.get('unclassified_link_rate')
        if v is not None and v >= T['unclassified_link'] and not universal['unclassified_link_rate']:
            add('gap_link_grade', 'medium',
                f'{d.name} KPI 연결 {v}% 가 등급 미지정입니다',
                '주·보조·간접을 정하지 않아 연결이 전부 동등해 보입니다. '
                '어느 과제가 그 지표를 실제로 떠받치는지 읽을 수 없습니다.',
                d.id, {'unclassified_link_rate': v})

        # 등급을 매긴 것 중 주기여가 적으면, 지표를 직접 미는 과제 없이
        # 기반·간접만 쌓고 있다는 뜻이다.
        v = m.get('primary_link_rate')
        grades = context.get(d.id, {}).get('link_grades') or {}
        if v is not None and v <= T['primary_link_low'] and grades.get('graded_total', 0) >= 5:
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
        if v is not None and v >= T['pl_concentration']:
            add('concentration_pl', 'medium',
                f'{d.name} 과제의 {v}% 를 한 사람이 맡고 있습니다',
                '사람에 묶인 조직은 그 사람이 빠지면 멈춥니다. 지식이 개인에게 '
                '남고 조직 역량으로 축적되지 않습니다.',
                d.id, {'pl_concentration': v})

        v = m.get('deadline_crowding')
        if v is not None and v >= T['deadline_crowding'] and not universal['deadline_crowding']:
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

        narrow = spread is not None and spread <= T['spread_concentrated']
        skewed = skew is not None and skew >= T['dept_concentration']

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
        if v is not None and v >= T['isolated'] and not universal['isolated_rate']:
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
        # `<` 이 아니라 `<=` 다. 높을수록 좋은 다른 두 규칙(primary_link_low,
        # spread_concentrated)이 `<=` 를 쓰는데 여기만 `<` 이면, 값이 기준과
        # 정확히 같을 때 관측 표는 붉은데 목록에는 안 뜬다. 색과 목록이
        # 갈리면 어느 쪽이 맞는지 아무도 모른다.
        if kpi is not None and kpi <= T['kpi_shortfall']:
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
                    f'목표의 {T['kpi_shortfall']:.0f}% 에 못 미칩니다.',
                    d.id, {'kpi_achievement': kpi})

    # ── 전사로 보는 것 ─────────────────────────────────────────────────
    # 사업부마다 걸리는 것은 개별 사정이지만, 전 사업부에 걸리면 구조 문제다.
    # 심각도를 항목마다 따로 준다. 전사에 걸린다고 다 급한 것은 아니다 —
    # 연말 종료 쏠림은 연간 과제 관행의 결과일 수 있어 사실 확인이 먼저다.
    for key, metric_key, threshold, severity, title, detail in (
        ('company_gap_performance', 'no_performance_rate', T['no_performance'], 'high',
         '전 사업부에서 성과 정의가 비어 있습니다',
         '특정 사업부의 습관이 아니라 양식이나 절차가 그것을 요구하지 않는 것일 수 있습니다.'),
        ('company_gap_kpi_link', 'no_kpi_link_rate', T['no_kpi_link'], 'high',
         '전 사업부에서 KPI 연결이 비어 있습니다',
         '지표 체계가 현장 과제를 담지 못하고 있을 가능성이 있습니다.'),
        ('company_gap_link_grade', 'unclassified_link_rate', T['unclassified_link'], 'medium',
         '전 사업부에서 KPI 연결 등급이 비어 있습니다',
         '등급을 매기는 절차가 자리잡지 않은 것으로 보입니다. '
         '연결이 전부 동등해 보여 무엇이 지표를 떠받치는지 읽을 수 없습니다.'),
        ('company_deadline_crowding', 'deadline_crowding', T['deadline_crowding'], 'info',
         '과제가 전사적으로 같은 분기에 끝납니다',
         '연간 과제 관행이라면 자연스러운 결과입니다. 사업부 비교에는 쓸 수 없고, '
         '검증 부하가 연말에 몰리는 것이 문제인지만 따로 보면 됩니다.'),
        ('company_isolated', 'isolated_rate', T['isolated'], 'medium',
         '과제 간 선후 관계가 거의 기록돼 있지 않습니다',
         '특정 사업부가 아니라 전사적으로 비어 있습니다. 과제가 실제로 따로 도는 '
         '것인지, 선행과제 기능을 쓰지 않는 것인지 먼저 가려야 합니다.'),
    ):
        values = [metrics_by_division.get(d.id, {}).get(metric_key) for d in divisions]
        valid = [v for v in values if v is not None]
        if valid and min(valid) >= threshold:
            add(key, severity, title, detail, None,
                {metric_key: {'min': min(valid), 'max': max(valid)}})

    spreads = [metrics_by_division.get(d.id, {}).get('dept_spread') for d in divisions]
    valid_spreads = [s for s in spreads if s is not None]
    if valid_spreads and max(valid_spreads) <= T['spread_concentrated']:
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
                'title': f'"{kpi}"{_object_particle(kpi)} 주기여로 미는 과제가 없습니다',
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
                'title': f'"{kpi}"{_topic_particle(kpi)} {row["divisions"][0]} 에서만 다룹니다',
                'detail': '한 사업부만 이 지표에 걸려 있습니다. 전사 지표라면 '
                          '나머지가 손대지 않고 있는 것이고, 사업부 전용이라면 정상입니다.',
                'division_id': None,
                'division_name': None,
                'evidence': dict(row),
            })

    order = {'high': 0, 'medium': 1, 'info': 2}
    findings.sort(key=lambda f: (order.get(f['severity'], 9), f['title']))
    return findings
