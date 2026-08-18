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


# ── 프로세스에서 본 것 (Value Chain) ──────────────────────────────────────
#
# 사업부 축이 "누가 못 하고 있나"를 본다면 이쪽은 **"어느 프로세스가 약한가"**
# 를 본다. 같은 과제를 다른 축으로 자른 것이라 사람이 채울 격자가 늘지 않는다.
#
# ⚠️ **규칙을 둘만 둔다.** 프로세스 다섯 × 지표 열 개를 다 짚으면 발견 사항이 배로
#    늘고, 그러면 사업부 축에서 나온 것까지 같이 안 읽힌다.

# 프로세스 축에서 짚을 지표. 전부가 아니라 **프로세스로 갈렸을 때 뜻이 있는
# 것**만 고른다 — PL 집중도는 사람 문제라 사업부 축에서 보는 것이 맞다.
# 이보다 적은 과제로 "이 프로세스가 나쁘다" 고 말하지 않는다. 세 건 중 세 건이
# 성과 미정의면 100% 지만, 그 100% 는 조직의 성질이 아니라 표본의 성질이다.
_PROCESS_MIN_PROJECTS = 5

_PROCESS_METRICS = (
    ('no_performance_rate', 'no_performance', '성과를 정의하지 않았습니다'),
    ('no_kpi_link_rate', 'no_kpi_link', '어느 KPI 에도 걸려 있지 않습니다'),
)


def derive_process_findings(by_division, totals, processes, divisions,
                            thresholds=None, unknown_count=0, limit=3):
    """**사업부 안에서** 유난히 나쁜 프로세스.

    ⚠️ 전사 합계로 짚지 않는다. MX 의 개발과 VD 의 개발은 다른 조직이라, 합쳐서
       "개발이 나쁘다" 고 하면 어느 사업부 이야기인지 알 수 없다. 한 사업부가
       나쁜 것이 나머지까지 나쁜 것처럼 보이기도 한다.

    ⚠️ **그 사업부 전체가 나쁘면 안 짚는다.** 그건 프로세스 문제가 아니라 그
       사업부의 문제이고, 사업부 축 규칙이 이미 짚는다.

    limit 은 지표마다 낼 최대 건수다. 사업부 5 × 프로세스 5 × 지표 2 를 다
    짚으면 발견 사항이 스물다섯 줄 늘고, 그러면 사업부 축에서 나온 것까지
    같이 안 읽힌다.
    """
    T = {**DEFAULT_THRESHOLDS, **(thresholds or {})}
    names = {d.id: d.name for d in divisions}
    findings = []

    def add(key, severity, title, detail, division_id=None, evidence=None):
        findings.append({
            'key': key, 'severity': severity, 'title': title, 'detail': detail,
            'division_id': division_id, 'division_name': names.get(division_id),
            'evidence': evidence or {},
        })

    # ── 그 사업부 안에서 유난히 나쁜 프로세스 ─────────────────────────
    for metric, threshold_key, phrase in _PROCESS_METRICS:
        limit_value = T[threshold_key]
        hits = []
        for division_id, rows in (by_division or {}).items():
            scored = {name: m for name, m in rows.items()
                      if (m.get('project_count') or 0) >= _PROCESS_MIN_PROJECTS}
            if len(scored) < 2:
                continue          # 견줄 것이 없으면 "유난히" 를 말할 수 없다
            over = {n: m for n, m in scored.items()
                    if (m.get(metric) or 0) >= limit_value}
            # 그 사업부의 프로세스가 전부 나쁘면 사업부 문제다.
            if not over or len(over) == len(scored):
                continue
            worst = max(over, key=lambda n: over[n][metric])
            hits.append((division_id, worst, over[worst]))

        hits.sort(key=lambda h: -h[2][metric])
        for division_id, name, m in hits[:limit]:
            add(f'process_{metric}:{division_id}:{name}', 'medium',
                f'{names.get(division_id, "?")} · {name} 과제 {m[metric]}% 가 {phrase}',
                f'같은 사업부의 다른 프로세스는 기준 아래입니다 — 사업부 전체가 '
                f'아니라 이 프로세스의 문제로 보입니다. 과제 '
                f"{m['project_count']}건 기준입니다.",
                division_id,
                {'process': name, 'metric': metric, 'value': m[metric]})

    # ── 손대는 과제가 거의 없는 프로세스 ──────────────────────────────
    #
    # 이건 전사로 본다. 한 사업부에서만 적은 것은 그 사업부의 선택일 수 있지만,
    # **어디서도 안 하고 있으면** 그건 조직이 그 프로세스를 비워 둔 것이다.
    total_count = sum((totals.get(n) or {}).get('project_count') or 0
                      for n in processes)
    if total_count:
        share_limit = T['process_thin_share']
        for name in processes:
            count = (totals.get(name) or {}).get('project_count') or 0
            share = round(count * 100 / total_count, 1)
            if share >= share_limit:
                continue
            touching = [names.get(d) for d, rows in (by_division or {}).items()
                        if (rows.get(name, {}).get('project_count') or 0)]
            add(f'process_thin:{name}', 'medium',
                f'{name} 프로세스에 과제가 {count}건뿐입니다 (전체의 {share}%)',
                (f"손대는 사업부는 {', '.join(x for x in touching if x)} 입니다. "
                 if touching else '어느 사업부도 손대지 않고 있습니다. ')
                + '덜 중요해서인지, 손대기 어려워서인지, 아니면 아무도 맡지 '
                  '않아서인지는 사람이 답해야 합니다.',
                None, {'process': name, 'count': count, 'share': share})

    # ── 프로세스를 안 적은 과제 ───────────────────────────────────────
    if unknown_count:
        add('process_unknown', 'info',
            f'프로세스를 적지 않은 과제가 {unknown_count}건 있습니다',
            '이 과제들은 프로세스별 집계 어디에도 안 들어갑니다. '
            '숫자가 안 맞는 이유가 여기 있습니다.',
            None, {'count': unknown_count})

    order = {'high': 0, 'medium': 1, 'info': 2}
    findings.sort(key=lambda f: (order.get(f['severity'], 9), f['title']))
    return findings


def derive_strategy_link_findings(projects, linked_uuids, divisions,
                                  thresholds=None):
    """**어느 솔루션에도 안 걸린 과제.** (전략 ↔ 실행)

    ① 진단은 「KPI 에 안 걸린 과제」를 짚는다. 이건 그 짝이다 — 지표에는 걸렸어도
    **올해 전략이 하겠다고 한 것과 무관하게** 도는 과제가 얼마나 되는가.

    둘은 다른 것을 본다.

        KPI 미연결    과제가 무엇을 올리려는지 안 적혔다      (과제 쪽 문제)
        전략 미연결   전략이 그 과제를 자기 것이라 안 했다    (전략 쪽 문제)

    ⚠️ **과제를 나무라는 규칙이 아니다.** 비율이 높다고 현장이 잘못한 것이
       아니라, 전략이 현장에서 이미 벌어지는 일을 안 담은 것일 수 있다. 그래서
       문구가 어느 한쪽을 탓하지 않는다.

    ⚠️ **합성 데이터에서는 안 짚는다.** fixture 과제에는 uuid 가 없어 고를 수가
       없고, 그러면 무조건 100% 미연결이 나온다. 그건 조직의 상태가 아니라
       모드의 성질이다(과제 5건 미만은 판정하지 않는 것과 같은 이유).
    """
    T = {**DEFAULT_THRESHOLDS, **(thresholds or {})}
    names = {d.name: d.id for d in divisions}
    names_by_id = {d.id: d.name for d in divisions}

    # 식별자가 없는 원천(fixture)에서는 판단하지 않는다.
    known = [p for p in (projects or []) if p.get('_uuid')]
    if not known:
        return []

    linked = set(linked_uuids or ())
    findings = []

    def add(key, severity, title, detail, division_id=None, evidence=None):
        findings.append({
            'key': key, 'severity': severity, 'title': title, 'detail': detail,
            'division_id': division_id,
            'division_name': next((n for n, i in names.items()
                                   if i == division_id), None),
            'evidence': evidence or {},
        })

    limit = T['solution_unlinked_share']

    # 사업부별로 본다. 전사 하나로 뭉치면 어느 조직의 이야기인지 알 수 없다 —
    # 프로세스 축에서 겪은 것과 같은 함정이다.
    by_division = {}
    for p in known:
        by_division.setdefault(names.get(p.get('사업부')), []).append(p)

    for division_id, items in by_division.items():
        if division_id is None:
            continue
        loose = [p for p in items if p['_uuid'] not in linked]
        share = round(len(loose) * 100 / len(items), 1)
        if share < limit:
            continue
        # ⚠️ **제목에 사업부를 적는다.** 안 적으면 목록에 「과제 21건(100%)이…」가
        #    사업부 수만큼 똑같이 늘어서, 어느 조직 이야기인지 알 수 없다.
        #    다른 규칙들은 「MX 과제 63.3%…」처럼 이미 그렇게 한다.
        add(f'strategy_unlinked:{division_id}', 'medium',
            f'{names_by_id.get(division_id, "?")} 과제 {len(loose)}건({share}%)이 '
            f'올해 전략의 어느 솔루션에도 안 걸려 있습니다',
            '전략이 현장에서 이미 벌어지는 일을 안 담은 것일 수도, 과제가 '
            '전략과 무관하게 도는 것일 수도 있습니다. ④ 솔루션에서 과제를 '
            '걸거나, 그 과제들이 무엇을 위한 것인지 되물어야 합니다.',
            division_id,
            {'unlinked': len(loose), 'total': len(items), 'share': share})

    # 반대쪽. 하겠다고 적어 놓고 아무도 안 하는 것 — 이쪽이 더 급하다.
    total_share = round(
        len([p for p in known if p['_uuid'] not in linked]) * 100 / len(known), 1)
    if total_share >= limit and not findings:
        # 사업부별로 안 걸렸으면 전사로 한 번은 짚는다(사업부를 못 붙인 과제 등).
        add('strategy_unlinked:all', 'medium',
            f'과제의 {total_share}% 가 올해 전략의 어느 솔루션에도 안 걸려 '
            f'있습니다',
            '④ 솔루션에서 과제를 걸거나, 그 과제들이 무엇을 위한 것인지 '
            '되물어야 합니다.',
            None, {'share': total_share, 'total': len(known)})

    order = {'high': 0, 'medium': 1, 'info': 2}
    findings.sort(key=lambda f: (order.get(f['severity'], 9), f['title']))
    return findings


# 같은 규칙에서 나온 것들을 묶을 때 쓰는 이름.
#
# ⚠️ **없으면 안 묶는 것이 아니라 대표 문장으로 묶는다.** 규칙을 새로 넣을 때
#    여기 적는 걸 잊어도 화면이 깨지지 않아야 한다(assert 를 안 건 이유).
#    한 사이클을 돌려 보니 같은 모양 문장이 다섯 줄씩 이어져 목록이 안 읽혔다.
RULE_LABELS = {
    'gap_performance': '성과를 정의하지 않은 과제',
    'gap_kpi_link': 'KPI 에 안 걸린 과제',
    'gap_link_grade': '연결 등급을 안 정한 과제',
    'few_primary_links': '주기여 연결이 적음',
    'concentration_pl': '한 사람에게 몰림',
    'concentration_deadline': '일정이 한 분기에 몰림',
    'concentration_dept': '한 부서에 몰림',
    'concentration_dept_skew': '참여 부서가 이름뿐',
    'isolated_projects': '따로 도는 과제',
    'volume_without_outcome': '과제는 많은데 성과가 안 보임',
    'kpi_shortfall': 'KPI 달성률 미달',
    'kpi_single_division': '지표에 한 사업부만',
    'kpi_no_primary': '주기여로 미는 과제가 없음',
    'spread_stalled_company': '전사 확산 정체',
    'division_gap': '사업부 간 격차',
    'process_thin': '과제가 거의 없는 프로세스',
    'process_unknown': '프로세스를 안 적은 과제',
    'strategy_unlinked': '전략에 안 걸린 과제',
    'survey_division_gap': '설문 · 사업부 간 격차',
    'survey_role_gap': '설문 · 역할 간 인식 차',
    'survey_low_level': '설문 · 전사 공통 저점',
    'survey_choice_top': '설문 · 한 보기로 쏠림',
    'survey_choice_split': '설문 · 누가 답했느냐로 갈림',
}


def attach_rules(findings):
    """발견 사항마다 어느 규칙에서 나왔는지 붙인다.

    key 앞자리가 곧 규칙이다. 규칙 이름을 모르면 그 묶음의 **첫 제목**을
    이름으로 쓴다 — 이름을 몰라 안 묶는 것보다 낫다.
    """
    first = {}
    for f in findings or []:
        rule = (f.get('key') or '').split(':')[0]
        f['rule'] = rule
        first.setdefault(rule, f.get('title') or rule)
    for f in findings or []:
        f['ruleLabel'] = RULE_LABELS.get(f['rule']) or first[f['rule']]
    return findings
