"""
② 이슈 — 격차에서 후보를 뽑는다.

진단은 핵심 난제를 남기고 끝난다. 난제는 "넘어야 할 지점"이라 그대로는 손댈 수
없으므로, **풀 수 있는 크기로 쪼갠 것**이 이슈다.

쪼개는 것은 사람이 한다. 다만 백지에서 시작하지 않게, 진단이 이미 드러낸
**격차(gap)** 를 후보로 늘어놓는다. PLAN.md 3절의 '격차 분석'이 이것이다.

후보는 두 곳에서 나온다.

    A. 성숙도 격차   사람이 매긴 목표 - 현재       (strategy_assessment)
    B. 지표 격차     사람이 정한 목표 - 관측값     (strategy_metric_target × metrics)
    C. 설문이 짚은 것  규칙이 잡은 사실             (survey_link.derive_*_findings)

⚠️ '짚인 것(findings)'은 여기서 다시 뽑지 않는다. 그쪽은 이미 진단 화면에서
   한 번의 클릭으로 **핵심 난제**가 되는 길이 있다. 같은 사실이 두 경로로
   들어오면 이슈 목록에 중복이 쌓이고, 어느 쪽이 정본인지 갈린다.

   **딱 하나 예외가 설문이다**(C). 지표에서 나온 짚인 것은 같은 지표가 B 로도
   후보를 내므로 중복이지만, 설문에서 나온 것은 **다른 길이 아예 없다.** A 로
   가려면 사람이 목표 레벨을 넣어야 하는데, '63% 가 데이터 정합성을 꼽았다'는
   격차가 아니라 지목이라 목표를 정하는 것과 상관이 없다. 그래서 그것만 낸다.

   중복은 **핵심 난제로 이미 올린 것을 빼서** 막는다(promoted). 두 경로가
   같은 사실을 이슈로 만드는 일은 그렇게 사라진다.

후보는 저장하지 않는다. 매번 계산한다 — 사람이 목표를 고치면 후보도 따라
바뀌어야 한다. 채택한 순간에만 strategy_issue 로 남는다.
"""

from .definitions import CATEGORIES, METRICS


# 격차가 이보다 작으면 후보로 내밀지 않는다. 한 단계 차이는 대부분의 조직에
# 늘 있는 것이라, 그것까지 늘어놓으면 목록이 25줄이 되고 아무도 안 읽는다.
GAP_MIN = 2


def _by_key(items):
    return {item['key']: item for item in items}


_METRIC_BY_KEY = _by_key(METRICS)
_CATEGORY_BY_KEY = _by_key(CATEGORIES)
_DIMENSION_BY_SLOT = {
    (c['key'], d['key']): d
    for c in CATEGORIES for d in c['dimensions']
}
_LEVEL_LABEL = {
    (c['key'], level['value']): level['label']
    for c in CATEGORIES for level in c['levels']
}


# 설문에서 나온 짚인 것의 key 앞자리. survey_link 가 붙이는 것과 같은 약속이다.
SURVEY_FINDING_PREFIX = 'survey_'

# 심각도 → 정렬 무게. 격차(A·B)의 weight 와 같은 자에서 견주어야 하므로
# 단계 차이와 비슷한 크기로 둔다.
_SEVERITY_WEIGHT = {'high': 3, 'medium': 2, 'info': 1}


def derive_survey_candidates(findings, promoted=None):
    """설문이 짚은 것을 이슈 후보로. (위 C)

    ⚠️ **핵심 난제로 이미 올린 것은 빼낸다.** 안 빼면 같은 사실이 난제로도
       후보로도 남아, 이슈 목록에 두 번 들어올 수 있다.

    ⚠️ 지표에서 나온 짚인 것은 **여기 안 온다.** 그쪽은 B 가 같은 것을 이미 낸다.
    """
    taken = set(promoted or ())
    out = []
    for f in findings or []:
        key = f.get('key') or ''
        if not key.startswith(SURVEY_FINDING_PREFIX) or key in taken:
            continue
        division_id = f.get('division_id')
        out.append({
            'key': f'finding:{key}:{division_id}',
            'title': f.get('title') or key,
            'detail': f.get('detail') or '',
            'division_id': division_id,
            'source_type': 'finding',
            'source_ref': key,
            'group': '설문',
            'gap': None,
            'weight': _SEVERITY_WEIGHT.get(f.get('severity'), 1),
        })
    return out


def derive_issue_candidates(assessments, metrics, divisions):
    """진단 격차를 이슈 후보로 바꾼다.

    assessments / metrics 는 routes.get_plan 이 화면에 내려주는 것과 같은 모양의
    dict 목록이다. 같은 값을 두 번 계산하지 않으려고 그대로 받는다.

    돌려주는 각 항목의 key 는 화면에서 "이미 이슈로 만든 후보"를 지우는 데
    쓴다. strategy_issue.source_ref 에 그대로 저장되므로 안정적이어야 한다.
    """
    names = {d.id: d.name for d in divisions}
    candidates = []

    # ── A. 성숙도 격차 ────────────────────────────────────────────────────
    for a in assessments:
        gap = a.get('gap')
        if gap is None or gap < GAP_MIN:
            continue

        category, dimension = a.get('category'), a.get('dimension')
        meta = _DIMENSION_BY_SLOT.get((category, dimension))
        if not meta:
            continue

        division_id = a.get('division_id')
        current, target = a['current_level'], a['target_level']
        current_label = _LEVEL_LABEL.get((category, current), current)
        target_label = _LEVEL_LABEL.get((category, target), target)
        category_label = _CATEGORY_BY_KEY.get(category, {}).get('label', category)

        candidates.append({
            'key': f'gap:{category}:{dimension}:{division_id}',
            'title': f'{names.get(division_id, "?")} · {meta["label"]} '
                     f'{current}단계 → {target}단계',
            'detail': f'{meta["question"]} — 지금은 {current}단계({current_label}), '
                      f'목표는 {target}단계({target_label})입니다. '
                      f'{gap}단계 차이입니다.',
            'division_id': division_id,
            'source_type': 'gap',
            'source_ref': f'{category}:{dimension}',
            'group': category_label,
            'gap': gap,
            # 정렬용. 격차가 클수록 먼저 보인다.
            'weight': gap,
        })

    # ── B. 지표 격차 ──────────────────────────────────────────────────────
    for m in metrics:
        gap, value, target = m.get('gap'), m.get('value'), m.get('target_value')
        if gap is None or value is None or target is None:
            continue

        meta = _METRIC_BY_KEY.get(m['metric_key'])
        if not meta or meta.get('direction') == 'neutral':
            continue

        # gap 은 목표 - 관측이다. 낮을수록 좋은 지표는 부호가 뒤집힌다 —
        # '성과 미정의 비율'은 관측이 목표보다 **높을 때** 문제다.
        shortfall = gap if meta['direction'] == 'higher' else -gap
        if shortfall <= 0:
            continue

        division_id = m.get('division_id')
        unit = meta.get('unit', '')
        candidates.append({
            'key': f'metric:{m["metric_key"]}:{division_id}',
            'title': f'{names.get(division_id, "?")} · {meta["label"]} '
                     f'{value}{unit} (목표 {target}{unit})',
            'detail': f'{meta["detail"]} 목표까지 {round(abs(shortfall), 1)}{unit} 남았습니다.',
            'division_id': division_id,
            'source_type': 'metric',
            'source_ref': m['metric_key'],
            'group': '활용과 성과',
            'gap': round(abs(shortfall), 1),
            # 지표는 단위가 %라 값이 크다. 성숙도(1~5)와 같은 자로 재면 지표가
            # 늘 위로 온다. 10 으로 나눠 자릿수를 맞춘다 — 정확한 비교가 아니라
            # 섞였을 때 한쪽이 목록을 독차지하지 않게 하는 것이 목적이다.
            'weight': abs(shortfall) / 10,
        })

    candidates.sort(key=lambda c: -c['weight'])
    return candidates


def summarize_coverage(cruxes, issues):
    """난제와 이슈가 서로 잘 물려 있는지.

    이 모듈에서 화면에 꼭 보여야 하는 두 가지를 센다.

      · 이슈가 없는 난제  — 넘겠다고 해놓고 아무것도 안 하는 것
      · 난제 없는 이슈    — 전략과 무관한 일을 하고 있는 것

    둘 다 "틀렸다"고 말하지 않는다. 난제 쪽이 틀렸을 수도 있다. 드러내기만 한다.
    """
    open_issues = [i for i in issues if i.get('status') != 'dropped']
    counts = {}
    for issue in open_issues:
        crux_id = issue.get('crux_id')
        if crux_id is not None:
            counts[crux_id] = counts.get(crux_id, 0) + 1

    return {
        'cruxCount': len(cruxes),
        'issueCount': len(open_issues),
        'droppedCount': len(issues) - len(open_issues),
        'issuesByCrux': counts,
        'cruxesWithoutIssues': [c['id'] for c in cruxes if not counts.get(c['id'])],
        'orphanIssueCount': sum(1 for i in open_issues if i.get('crux_id') is None),
    }
