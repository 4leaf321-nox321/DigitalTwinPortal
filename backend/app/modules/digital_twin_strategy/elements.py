"""
③ 분석 — SWOT 의 네 칸에 넣을 **후보**를 뽑는다.

백지에서 시작하지 않게 하는 장치다. 다만 **자동으로 요소가 되지는 않는다** —
사람이 골라 승격한다. 자동으로 옮기면 이 칸이 발견 사항의 복사본이 되고,
그러면 ④ TOWS 에서 조합할 것이 없어진다.

⚠️ **네 칸의 근거 무게가 다르다.**

    S 강점  진단의 높은 레벨 · 사업부 간 격차의 상위 사업부   ← 포탈 데이터
    W 약점  진단의 낮은 레벨 · 발견 사항                      ← 포탈 데이터
    O 기회  없음                                              ← 설문 또는 사람
    T 위협  없음                                              ← 설문 또는 사람

   O·T 를 여기서 지어내지 않는다. 포탈에 없는 정보를 규칙이 만들어내면 그건
   근거가 아니라 창작이다. 그 자리는 설문이 메운다(ANALYSIS_PLAN 3절).
"""
from .definitions import (
    ANALYSIS_KIND_BY_KEY, CATEGORIES, CATEGORY_ANALYSIS, LEVEL_MAX, LEVEL_MIN,
)
from .survey_link import ORGANIZATION_LABEL

_DIMENSION_BY_SLOT = {
    (c['key'], d['key']): d
    for c in CATEGORIES for d in c['dimensions']
}
_CATEGORY_LABEL = {c['key']: c['label'] for c in CATEGORIES}

# 강점·약점으로 볼 레벨.
#
# ⚠️ **양쪽을 대칭으로 두지 않는다.** 약점은 2단계도 약점이지만, 강점은 4단계면
#    "보통보다 낫다" 정도라 전략 요소로 세우기엔 약하다. 무엇보다 '준비도 4단계'
#    는 **사실이지 활용할 수 있는 강점 서술이 아니다** — ④ TOWS 에서 S×O 를
#    만들려면 "이걸로 무엇을 할 수 있는가"가 나와야 한다.
#
#    4단계까지 올리면 개발 DB 에서만 후보가 31건이 나왔다. 그 목록은 안 읽힌다.
#    강점의 주 원천은 오히려 **사업부 간 격차**다 — "MX 에서는 이미 되고 있다"
#    는 옮길 수 있다는 뜻이라, 그대로 수가 된다.
#
# ⚠️ 임계값 설정에 넣지 않았다 — 늘어날수록 설정 화면이 표가 되고, 그러면
#    정작 조정해야 할 값(설문 쪽)이 안 보인다. 정말 필요해지면 그때 넣는다.
STRONG_AT = LEVEL_MAX          # 5 만
WEAK_AT = LEVEL_MIN + 1        # 2 이하


def _label(category, dimension):
    meta = _DIMENSION_BY_SLOT.get((category, dimension))
    if not meta:
        return dimension
    return f"{_CATEGORY_LABEL.get(category, category)} · {meta['label']}"


def derive_element_candidates(assessments, findings, divisions):
    """S·W 후보. 돌려주는 각 항목의 key 로 이미 쓴 것을 걸러낸다.

    O·T 는 **여기서 안 만든다.** 만들 근거가 없다.
    """
    names = {d.id: d.name for d in divisions}
    out = []

    # ── 진단 레벨의 양 끝 ─────────────────────────────────────────────
    for a in assessments:
        level = a.get('current_level')
        if level is None:
            continue
        category, dimension = a.get('category'), a.get('dimension')
        if (category, dimension) not in _DIMENSION_BY_SLOT:
            continue
        division_id = a.get('division_id')
        where = names.get(division_id, '?')
        label = _label(category, dimension)

        if level >= STRONG_AT:
            out.append({
                'key': f'assessment:S:{category}:{dimension}:{division_id}',
                'kind': 'S',
                'title': f'{where} · {label} {level}단계',
                'detail': (f'{label} 을(를) {level}단계로 매겼습니다. '
                           '다른 곳으로 옮길 수 있는 것이 있는지 봅니다.'),
                'division_id': division_id,
                'source_type': 'assessment',
            })
        elif level <= WEAK_AT:
            out.append({
                'key': f'assessment:W:{category}:{dimension}:{division_id}',
                'kind': 'W',
                'title': f'{where} · {label} {level}단계',
                'detail': f'{label} 이(가) {level}단계에 머물러 있습니다.',
                'division_id': division_id,
                'source_type': 'assessment',
            })

    # ── 발견 사항 ─────────────────────────────────────────────────────
    #
    # ⚠️ 대부분 약점이지만 **사업부 간 격차는 강점이기도 하다** — 잘하는 곳이
    #    있다는 뜻이라, 그쪽을 S 로 세워야 ④ 에서 "옮기는 수" 가 나온다.
    for f in findings or []:
        key = f.get('key') or ''
        if key.startswith('survey_division_gap:'):
            # ⚠️ **격차는 전사 사실이지만 강점은 잘하는 쪽의 것이다.** 발견
            #    사항으로는 전사가 맞다("사업부 간 1.4점 벌어져 있다"). 그런데
            #    그것을 강점으로 세우면서 전사로 두면, 격차의 **약한 쪽 사업부
            #    아래에도 강점으로 뜬다.** 실제로 그렇게 나왔다.
            evidence = f.get('evidence') or {}
            top_id = evidence.get('top_division_id')
            top_name = evidence.get('top', '')
            average = evidence.get('top_average')
            label = ORGANIZATION_LABEL.get(evidence.get('dimension'), '')
            out.append({
                'key': f'finding:S:{key}',
                'kind': 'S',
                # 강점으로 읽히게 다시 쓴다. "편차가 1.4점" 은 관찰이지 강점이
                # 아니다 — ④ 에서 S×O 를 만들려면 "무엇을 할 수 있는가"가
                # 보여야 한다.
                'title': (f'{top_name} · {label} {average}점 — 사업부 중 가장 높습니다'
                          if top_name and label else (f.get('title') or key)),
                'detail': (f.get('detail') or '')
                          + ' 잘하는 곳이 있다는 것은 방법이 없는 것이 아니라 '
                            '아직 옮겨지지 않은 것입니다.',
                'division_id': top_id,
                'source_type': 'finding',
            })
            continue
        # 참고(info)까지 후보로 올리면 목록이 길어져 아무도 안 고른다.
        if f.get('severity') == 'info':
            continue
        out.append({
            'key': f'finding:W:{key}',
            'kind': 'W',
            'title': f.get('title') or key,
            'detail': f.get('detail') or '',
            'division_id': f.get('division_id'),
            'source_type': 'finding',
        })

    # 종류끼리 모아 준다. 섞여 있으면 세 건뿐인 강점이 스물네 건의 약점 사이에
    # 흩어져, 있는 줄도 모르고 지나간다.
    order = {'S': 0, 'W': 1, 'O': 2, 'T': 3}
    out.sort(key=lambda c: (order.get(c['kind'], 9), c['title']))
    return out


def derive_survey_candidates(plan, min_sample):
    """O·T 후보. **설문에서만 나온다.**

    포탈에 없는 정보라 규칙이 만들어낼 수 없다. 「가장 큰 위협은?」 같은 객관식
    문항을 `analysis:threat` 에 연결해 두면, 보기 하나하나가 후보가 된다.

    ⚠️ **1위만 내지 않는다.** 진단의 쏠림 규칙은 튀는 것 하나를 짚는 일이지만
       여기는 재료를 모으는 일이다 — 2위·3위도 위협이다.

    ⚠️ **사업부별로 낸다.** 진단이 사업부별인데 분석만 전사로 뭉치면 「MX 의
       위협」과 「NW 의 위협」이 한 줄로 섞인다.
    """
    try:
        from app.modules.survey.evidence import choice_tally_by_link, closed_surveys
    except Exception:
        return []

    out = []
    for survey in closed_surveys('strategy_plan', plan.id):
        for item in choice_tally_by_link(survey, f'{CATEGORY_ANALYSIS}:',
                                         min_answers=min_sample):
            axis = item['link_key'].split(':', 1)[1]
            kind = ANALYSIS_KIND_BY_KEY.get(axis)
            if not kind:
                continue
            for row in item['rows']:
                out.append({
                    'key': (f"survey:{kind}:{item['question_id']}:"
                            f"{row['value']}:{item['division_id']}"),
                    'kind': kind,
                    'title': row['value'],
                    'detail': (f"「{item['text']}」에 {item['answer_count']}명 중 "
                               f"{row['count']}명({row['share']}%)이 꼽았습니다. "
                               '현장이 인식하는 것이지 시장 그 자체는 아닙니다.'),
                    'division_id': item['division_id'],
                    'source_type': 'survey',
                })
    return out


def summarize_elements(elements):
    """네 칸이 어떻게 차 있는지. 화면이 "무엇이 비었나"를 말할 수 있게.

    ⚠️ **비어 있다고 틀린 것이 아니다.** 특히 O·T 는 설문을 돌리기 전에는 빌
       수밖에 없다. 세기만 하고 판정하지 않는다.
    """
    counts = {k: 0 for k in ('S', 'W', 'O', 'T')}
    for element in elements:
        kind = element.get('kind')
        if kind in counts:
            counts[kind] += 1
    return {
        'counts': counts,
        # ④ TOWS 는 S×O, W×O, S×T, W×T 를 조합한다. 한 축이 통째로 비면
        # 그 조합이 아예 안 나온다 — 그 사실을 화면이 미리 말해야 한다.
        'emptyKinds': [k for k, n in counts.items() if n == 0],
    }
