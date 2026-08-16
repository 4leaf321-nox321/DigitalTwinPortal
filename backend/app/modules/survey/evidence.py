"""
설문을 **진단이 읽을 수 있는 모양**으로 내놓는 자리. (LINK_PLAN 1·4단계)

전략 모듈이 응답을 직접 세지 않는다. 세는 곳이 둘이 되면 집계 화면의 숫자와
진단의 숫자가 갈리고, 그 순간 둘 다 못 믿게 된다. 여기가 유일한 창구다.

⚠️ **전략을 import 하지 않는다.** 사업부를 걸러내는 일(진단 대상인가)도,
   레벨로 반올림하는 일도 여기서 하지 않는다 — 그건 진단의 판단이다. 여기는
   "누가 어느 축에 몇 점을 줬나"까지만 말한다.

── 왜 사람 단위로 접는가 ──────────────────────────────────────────────────

이 설문은 **역할마다 문항 수가 다른 것이 설계**다. PL 에게 5문항, 참여인력에게
1문항을 묻는 축이 실제로 나온다. 답을 그냥 다 모아 평균 내면 PL 한 사람이
참여인력 다섯 사람만큼 세어진다 — 그건 집계가 아니라 설계의 부작용이다.

그래서 **한 사람의 그 축 평균을 먼저 내고**, 그 사람 값들을 다시 평균 낸다.
1인 1표다.
"""
from .models import Survey, SurveyAnswer, SurveyQuestion, SurveyResponse
from .links import allowed_link_keys

# 레벨을 만들 수 있는 문항.
#
#   척도(scale)            답이 곧 1~5 다
#   객관식(choice) + 점수  **보기마다 점수가 적혀 있을 때만**
#
# 순위·복수선택은 고른 것이 여럿이라 한 사람의 점수가 하나로 정해지지 않는다.
# 서술형은 환산할 방법이 없다. 둘 다 findings 쪽으로 간다.
#
# ⚠️ 점수 없는 객관식은 **여기 안 온다.** '데이터 정합성'과 '인력 부족' 중
#    어느 쪽이 높은 단계인지는 정해질 수 없다 — 순서가 없는 보기다. 시스템이
#    점수를 짐작해 매기면 그 매핑을 나중에 아무도 설명하지 못한다.
LEVEL_QTYPE = 'scale'
SCORED_QTYPE = 'choice'


def _scores_of(question):
    """이 문항의 보기별 점수. {보기: 점수} — 없으면 빈 표."""
    options = question.options or {}
    labels = options.get('choices') or []
    scores = options.get('scores') or []
    if not scores or len(scores) != len(labels):
        return {}
    out = {}
    for label, score in zip(labels, scores):
        text = (label.get('label', label.get('value')) if isinstance(label, dict)
                else label)
        text = str(text).strip() if text is not None else ''
        if text and isinstance(score, int) and not isinstance(score, bool):
            out[text] = score
    return out


def levels_question(question, known):
    """이 문항이 진단 레벨에 들어가는가."""
    if not question.link_key or (known and question.link_key not in known):
        return False
    if question.qtype == LEVEL_QTYPE:
        return True
    return question.qtype == SCORED_QTYPE and bool(_scores_of(question))


def answer_level(question, answer):
    """이 답이 몇 점인가. 셀 수 없으면 None.

    척도는 숫자 그대로, 점수 붙은 객관식은 고른 보기의 점수다. 두 값이 같은
    자에서 나오므로 **한 사람 안에서 같이 평균 낼 수 있다** — 척도 문항 셋과
    점수 객관식 하나를 받은 사람은 그 넷의 평균이 자기 점수가 된다.
    """
    if question.qtype == LEVEL_QTYPE:
        return answer.value_number
    scores = _scores_of(question)
    if not scores:
        return None
    picked = answer.value_json
    if isinstance(picked, list):
        # 단일 선택인데 목록으로 온 옛 답. 하나짜리면 인정한다.
        picked = picked[0] if len(picked) == 1 else None
    if picked is None:
        return None
    return scores.get(str(picked).strip())


def _mean(values):
    return round(sum(values) / len(values), 2) if values else None


def candidate_surveys(context_type=None, context_id=None):
    """근거가 될 수 있는 설문.

    조건은 둘이다 — **마감됐고**, 연결키가 달린 척도 문항이 있다.

    ⚠️ 진행 중(open)인 설문은 쓰지 않는다. 사람이 답할 때마다 진단이 움직이면,
       어제 본 숫자와 오늘 숫자가 다른데 아무도 왜인지 모른다.

    ⚠️ **설문 종류로 거르지 않는다.** 만족도 조사든 애로사항 수집이든, 연결키가
       달린 척도 문항이 없으면 애초에 후보가 아니다. 거름망은 문항의 꼬리표다.
    """
    query = Survey.query.filter_by(status='closed')
    if context_type:
        query = query.filter_by(context_type=context_type)
    if context_id is not None:
        query = query.filter_by(context_id=context_id)

    known = allowed_link_keys()
    out = []
    for survey in query.order_by(Survey.id.desc()).all():
        if any(levels_question(q, known) for q in survey.questions.all()):
            out.append(survey)
    return out


def dimension_cells(survey):
    """이 설문이 말하는 것. (연결키 × 사업부) 한 칸씩.

    돌려주는 값:
        [{'link_key', 'division_id', 'respondent_count', 'average',
          'values': [사람별 평균...],
          'by_role': {역할: {'average', 'count'}},
          'questions': [{'id', 'text', 'answer_count'}]}]

    division_id 가 None 인 칸은 **소속 미확인**이다. 버리지 않는다 — 빠뜨리면
    응답 수 합계가 안 맞는데 화면 어디에도 그 이유가 없다.
    """
    known = allowed_link_keys()
    questions = {q.id: q for q in survey.questions.all()
                 if levels_question(q, known)}
    if not questions:
        return []

    responses = survey.responses.filter(
        SurveyResponse.submitted_at.isnot(None)
    ).all()
    if not responses:
        return []

    # 답을 한 번에 읽는다. 응답마다 물으면 응답 수만큼 질의가 나간다.
    by_response = {}
    for a in SurveyAnswer.query.filter(
        SurveyAnswer.response_id.in_([r.id for r in responses]),
        SurveyAnswer.question_id.in_(list(questions)),
    ).all():
        if answer_level(questions[a.question_id], a) is not None:
            by_response.setdefault(a.response_id, []).append(a)

    cells = {}
    for response in responses:
        answers = by_response.get(response.id) or []
        if not answers:
            continue
        # 이 사람이 축마다 몇 점을 줬나. **먼저 사람 안에서 접는다.**
        per_key = {}
        for a in answers:
            question = questions[a.question_id]
            per_key.setdefault(question.link_key, []).append(
                answer_level(question, a))

        for key, values in per_key.items():
            cell = cells.setdefault((key, response.division_id), {
                'link_key': key,
                'division_id': response.division_id,
                'values': [],
                'by_role': {},
                'questions': {},
            })
            cell['values'].append(sum(values) / len(values))
            # 역할별로도 접어 둔다. 같은 축을 PL 과 참여인력이 다르게 보면
            # 그 차이 자체가 발견이다(LINK_PLAN 6-1).
            role = response.respondent_role or '미지정'
            cell['by_role'].setdefault(role, []).append(
                sum(values) / len(values))

        for a in answers:
            q = questions[a.question_id]
            cell = cells[(q.link_key, response.division_id)]
            entry = cell['questions'].setdefault(
                q.id, {'id': q.id, 'text': q.text, 'answer_count': 0})
            entry['answer_count'] += 1

    out = []
    for cell in cells.values():
        out.append({
            'link_key': cell['link_key'],
            'division_id': cell['division_id'],
            'respondent_count': len(cell['values']),
            'average': _mean(cell['values']),
            'values': [round(v, 2) for v in cell['values']],
            'by_role': {
                role: {'average': _mean(vals), 'count': len(vals)}
                for role, vals in cell['by_role'].items()
            },
            'questions': list(cell['questions'].values()),
        })
    out.sort(key=lambda c: (c['link_key'], c['division_id'] or 0))
    return out


def respondents_by_division(survey):
    """사업부별 **실인원**. {division_id: 사람 수}

    ⚠️ 축별 칸(dimension_cells)의 respondent_count 를 더하면 안 된다. 한 사람이
       다섯 축에 답하면 다섯 번 세어져서, 5명이 21명으로 보인다. 실제로 그렇게
       나왔다 — 사람 수를 말하는 자리에서는 사람을 세야 한다.
    """
    known = allowed_link_keys()
    questions = {q.id: q for q in survey.questions.all()
                 if levels_question(q, known)}
    if not questions:
        return {}

    responses = {
        r.id: r.division_id for r in survey.responses.filter(
            SurveyResponse.submitted_at.isnot(None)).all()
    }
    if not responses:
        return {}

    counted = {}
    seen = set()
    for a in SurveyAnswer.query.filter(
        SurveyAnswer.response_id.in_(list(responses)),
        SurveyAnswer.question_id.in_(list(questions)),
    ).all():
        if a.response_id in seen:
            continue
        if answer_level(questions[a.question_id], a) is None:
            continue
        seen.add(a.response_id)
        division_id = responses[a.response_id]
        counted[division_id] = counted.get(division_id, 0) + 1
    return counted


def choice_highlights(survey):
    """객관식이 어디로 몰렸나. 레벨은 못 만들지만 **사람들이 직접 지목한 것**이다.

    돌려주는 값:
        [{'question_id', 'text', 'answer_count',
          'top_value', 'top_count', 'top_share'}]

    한 문항에서 가장 많이 고른 보기 하나만 낸다. 전부 내면 findings 가 표가
    되어 아무도 안 읽는다 — 짚는 것은 튀는 것 하나다.
    """
    from .routes import compute_results        # 세는 곳은 하나다

    data = compute_results(survey)
    out = []
    for entry in data['questions']:
        rows = entry.get('choice_counts') or []
        answered = entry.get('answer_count') or 0
        if not rows or not answered:
            continue
        top = max(rows, key=lambda r: r['count'])
        if not top['count']:
            continue
        out.append({
            'question_id': entry['question_id'],
            'text': entry['text'],
            'answer_count': answered,
            'top_value': top['value'],
            'top_count': top['count'],
            'top_share': round(top['count'] * 100 / answered, 1),
        })
    return out


def free_text_answers(survey, limit_per_question=200):
    """서술형 원문. **누가 썼는지는 실리지 않는다.**

    돌려주는 값:
        [{'question_id', 'text'(문항), 'answers': [원문...]}]

    ⚠️ 응답자 정보를 붙이지 않는다. 서술형은 문체와 내용으로 사람이 좁혀지는
       일이 실제로 있어서, 여기에 역할이나 사업부를 달면 "그 사업부의 그 역할인
       사람"이 되어 사실상 기명이 된다. 원문만 낸다.

    ⚠️ **답이 적으면 아예 안 낸다.** 서술형 두 건을 묶어 "이런 의견이 있다"고
       말하는 것은 요약이 아니라 지목이다.
    """
    questions = [q for q in survey.questions.all() if q.qtype == 'text']
    if not questions:
        return []

    responses = [
        r.id for r in survey.responses.filter(
            SurveyResponse.submitted_at.isnot(None)).all()
    ]
    if not responses:
        return []

    grouped = {}
    for a in SurveyAnswer.query.filter(
        SurveyAnswer.response_id.in_(responses),
        SurveyAnswer.question_id.in_([q.id for q in questions]),
    ).all():
        text = (a.value_text or '').strip()
        if text:
            grouped.setdefault(a.question_id, []).append(text)

    out = []
    for q in questions:
        answers = grouped.get(q.id) or []
        if not answers:
            continue
        out.append({
            'question_id': q.id,
            'text': q.text,
            'answers': answers[:limit_per_question],
        })
    return out


def survey_brief(survey):
    """설문을 가리키는 최소한의 정보. 화면이 "어느 설문에서 나왔나"를 말할 때 쓴다."""
    return {
        'id': survey.id,
        'title': survey.title,
        'closes_at': survey.closes_at.isoformat() if survey.closes_at else None,
        'response_count': survey.responses.filter(
            SurveyResponse.submitted_at.isnot(None)
        ).count(),
    }
