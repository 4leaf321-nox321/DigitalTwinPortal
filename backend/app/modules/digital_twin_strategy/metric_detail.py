"""
관측값 하나를 **풀어서** 보여준다 — 어떻게 셌고, 어느 과제가 그 수를 만들었나.

왜 필요한가
    화면이 「KPI 미연결 62.5%」라고만 말하면 사람이 할 수 있는 것이 없다. 62.5%
    가 어느 과제들인지 알아야 그 과제를 열어 고치러 간다. 숫자만 보여주는 진단은
    **읽고 끝나는 진단**이다.

⚠️ **여기서 다시 세지 않는다.** metrics.measure 가 쓰는 것과 **같은 판정**을
   써야 한다. 조건을 여기에 다시 적으면 언젠가 갈라지고, 그때 「62.5% 라는데
   목록은 3건」 같은 화면이 나온다. 그래서 각 지표의 판정을 아래 `_PICK` 한 곳에
   두고, 세는 쪽과 보여주는 쪽이 그것을 같이 쓴다.

⚠️ **매번 부르지 않는다.** 관측을 그릴 때마다 지표 10개 × 사업부 5개를 미리
   풀어 두면 payload 가 열 배가 된다. 사람이 숫자를 **누를 때만** 부른다
   (임계값 미리보기와 같은 규칙).
"""
from .definitions import METRICS

_METRIC_BY_KEY = {m['key']: m for m in METRICS}


# ── 어느 과제가 이 수를 만들었나 ─────────────────────────────────────────────
#
# 비율 지표는 **분자에 해당하는 과제**를 고른다. 「62.5% 가 미연결」이면 그
# 미연결 과제들이 사람이 보고 싶은 것이다.
_PICK = {
    'no_performance_rate': lambda p: not (p.get('performance_count') or 0),
    'no_kpi_link_rate': lambda p: not (p.get('kpi_links') or []),
    'isolated_rate': lambda p: not (p.get('dependency_count') or 0),
    'unclassified_link_rate':
        lambda p: any(not l.get('relation_type') for l in (p.get('kpi_links') or [])),
    'primary_link_rate':
        lambda p: any(l.get('relation_type') == 'primary'
                      for l in (p.get('kpi_links') or [])),
}

# 분자·분모가 무엇인지 사람 말로. **단위가 과제가 아닌 것**이 있다 —
# 연결 등급 두 개는 과제가 아니라 **연결**을 센다. 그걸 안 밝히면 「연결 12건 중
# 5건」을 과제 수로 읽는다.
_TERMS = {
    'no_performance_rate': ('성과를 안 적은 과제', '전체 과제'),
    'no_kpi_link_rate': ('KPI 에 안 걸린 과제', '전체 과제'),
    'isolated_rate': ('선행·후속이 없는 과제', '전체 과제'),
    'unclassified_link_rate': ('등급을 안 정한 연결', '전체 연결'),
    'primary_link_rate': ('주기여 연결', '등급을 정한 연결'),
    'dept_concentration': ('가장 많은 부서가 맡은 과제', '부서별 참여 합계'),
    'pl_concentration': ('가장 많은 PL 이 맡은 과제', '전체 과제'),
    'deadline_crowding': ('가장 몰린 분기의 과제', '전체 과제'),
}


def _project_row(p, why=None):
    """목록에 뜰 한 줄. **과제를 알아볼 수 있을 만큼만.**"""
    return {
        'uuid': p.get('_uuid'),
        'title': p.get('과제명'),
        'division': p.get('사업부'),
        'process': p.get('프로세스'),
        'pl': p.get('과제PL'),
        'depts': p.get('담당부서목록') or [],
        'status': p.get('진행상태'),
        'why': why,
    }


def _rank(counts, total, limit=None):
    """많은 순으로. 비율을 같이 낸다 — 「12건」만으로는 편중인지 알 수 없다."""
    rows = sorted(counts.items(), key=lambda kv: (-kv[1], str(kv[0])))
    if limit:
        rows = rows[:limit]
    return [{'name': str(n), 'count': c,
             'share': round(c * 100 / total, 1) if total else None}
            for n, c in rows]


def explain(metric_key, items):
    """관측값 하나를 푼다.

    items 는 `measure()` 에 넘긴 것과 **같은 묶음**이어야 한다 — 사업부로 걸렀으면
    사업부로 거른 것을, 프로세스면 프로세스를.
    """
    spec = _METRIC_BY_KEY.get(metric_key)
    if not spec:
        raise ValueError(f'알 수 없는 지표입니다: {metric_key}')

    out = {
        'key': metric_key, 'label': spec['label'], 'unit': spec.get('unit'),
        'detail': spec.get('detail'),
        'total': len(items),
        'projects': [], 'breakdown': [], 'formula': None,
        'numerator': None, 'denominator': None,
    }
    if not items:
        out['formula'] = '이 묶음에 과제가 없습니다.'
        return out

    num_label, den_label = _TERMS.get(metric_key, (None, None))

    # ── 과제 수 — 나눌 것이 없다. 목록이 곧 답이다. ──
    if metric_key == 'project_count':
        out['formula'] = '이 묶음에 속한 과제를 모두 셉니다.'
        out['projects'] = [_project_row(p) for p in items]
        return out

    # ── 부서 축 ──
    if metric_key in ('dept_spread', 'dept_concentration'):
        counts = {}
        for p in items:
            for d in (p.get('담당부서목록') or []):
                if d:
                    counts[d] = counts.get(d, 0) + 1
        assignments = sum(counts.values())
        out['breakdown'] = _rank(counts, assignments)

        if metric_key == 'dept_spread':
            out['formula'] = ('과제에 이름을 올린 부서를 셉니다. **한 과제에 여러 '
                              '부서가 걸리면 각 부서에 한 번씩** 세므로, 아래 '
                              '합계는 과제 수보다 클 수 있습니다.')
            out['numerator'] = {'label': '참여 부서', 'count': len(counts)}
            return out

        top = out['breakdown'][0] if out['breakdown'] else None
        out['formula'] = ('가장 많은 과제를 맡은 부서 한 곳이 차지하는 비율입니다. '
                          '분모는 과제 수가 아니라 **부서별 참여를 모두 더한 값**입니다.')
        out['numerator'] = {'label': f"{num_label}" + (f" ({top['name']})" if top else ''),
                            'count': top['count'] if top else 0}
        out['denominator'] = {'label': den_label, 'count': assignments}
        if top:
            out['projects'] = [_project_row(p, f"{top['name']} 소속")
                               for p in items if top['name'] in (p.get('담당부서목록') or [])]
        return out

    # ── PL·분기 축 — 「누구에게 / 언제 몰렸나」 ──
    if metric_key in ('pl_concentration', 'deadline_crowding'):
        field, fmt = (('과제PL', lambda v: v),
                      ('end_quarter', lambda v: f'{v}분기'))[metric_key == 'deadline_crowding']
        counts = {}
        for p in items:
            v = p.get(field)
            if v:
                counts[v] = counts.get(v, 0) + 1
        out['breakdown'] = [{**r, 'name': fmt(r['name'])} for r in _rank(counts, len(items))]
        top_key = max(counts, key=lambda k: counts[k]) if counts else None
        out['formula'] = ('가장 많이 몰린 한 곳이 전체 과제에서 차지하는 비율입니다.'
                          if metric_key == 'pl_concentration' else
                          '종료가 가장 몰린 분기가 전체 과제에서 차지하는 비율입니다.')
        out['numerator'] = {'label': f'{num_label} ({fmt(top_key)})' if top_key else num_label,
                            'count': counts.get(top_key, 0)}
        out['denominator'] = {'label': den_label, 'count': len(items)}
        if top_key is not None:
            out['projects'] = [_project_row(p, f'{fmt(top_key)}')
                               for p in items if p.get(field) == top_key]
        return out

    # ── 연결 등급 — **세는 단위가 과제가 아니라 연결이다** ──
    if metric_key in ('unclassified_link_rate', 'primary_link_rate'):
        links = [l for p in items for l in (p.get('kpi_links') or [])]
        graded = [l for l in links if l.get('relation_type')]
        by_grade = {}
        for l in graded:
            g = l['relation_type']
            by_grade[g] = by_grade.get(g, 0) + 1
        label_ko = {'primary': '주기여', 'support': '보조', 'indirect': '간접'}
        out['breakdown'] = [{'name': label_ko.get(g, g), 'count': c,
                             'share': round(c * 100 / len(graded), 1) if graded else None}
                            for g, c in sorted(by_grade.items(), key=lambda kv: -kv[1])]
        if metric_key == 'unclassified_link_rate':
            n = len(links) - len(graded)
            out['formula'] = ('⚠️ 이 값은 **과제가 아니라 연결을 셉니다.** 걸긴 걸었는데 '
                              '어떻게 기여하는지 정하지 않은 연결의 비율입니다.')
            out['numerator'] = {'label': num_label, 'count': n}
            out['denominator'] = {'label': den_label, 'count': len(links)}
        else:
            out['formula'] = ('⚠️ 이 값은 **과제가 아니라 연결을 셉니다.** 등급을 정한 '
                              '연결 중 「주기여」의 비율입니다. 등급은 순서척도라 '
                              '주=3·보조=2 로 합치지 않고 등급별로 따로 셉니다.')
            out['numerator'] = {'label': num_label, 'count': by_grade.get('primary', 0)}
            out['denominator'] = {'label': den_label, 'count': len(graded)}
        pick = _PICK[metric_key]
        out['projects'] = [_project_row(p) for p in items if pick(p)]
        return out

    # ── 나머지 비율 — 분자에 걸린 과제를 그대로 내민다 ──
    pick = _PICK.get(metric_key)
    if pick:
        hit = [p for p in items if pick(p)]
        out['formula'] = f'{num_label}를 {den_label} 로 나눈 비율입니다.'
        out['numerator'] = {'label': num_label, 'count': len(hit)}
        out['denominator'] = {'label': den_label, 'count': len(items)}
        out['projects'] = [_project_row(p) for p in hit]
        return out

    out['formula'] = '이 지표는 아직 풀어서 보여주지 않습니다.'
    return out
