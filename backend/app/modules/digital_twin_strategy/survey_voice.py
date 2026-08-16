"""
설문 서술형을 묶어 읽는다. (LINK_PLAN 6-1 의 남은 절반)

객관식은 규칙으로 셀 수 있지만 **"이런 말이 많았다"는 판단이라 규칙이 못 한다.**
그래서 이것만 AI 에게 맡긴다.

무엇이 문제인지 가장 구체적으로 말하는 것은 오히려 이쪽이다. '성과 측정 1.9점'
보다 "무엇을 성과로 볼지 사업부마다 달라서, 잘했다는 말을 서로 다른 뜻으로
씁니다" 한 줄이 다음에 무엇을 할지 알려준다.

── 지켜야 하는 것 넷 ──────────────────────────────────────────────────────

⚠️ **규칙이 짚은 것과 섞지 않는다.** findings 는 센 것이고 이것은 읽은 것이다.
   한 목록에 섞으면 지어낸 문장이 세어진 사실과 똑같은 모양으로 앉는다.
   화면에서도 자리를 갈라 두고, 「AI 가 묶은 것」이라고 적는다.

⚠️ **인용문이 원문에 실제로 있는지 검사한다.** 있지도 않은 말을 그럴듯하게
   지어내는 것이 이 종류 작업의 대표적 실패다. 원문에 없는 인용은 **버린다** —
   경고를 다는 정도로는 부족하다. 근거로 못 쓸 문장이 화면에 남으면 나머지
   묶음까지 못 믿게 된다.

⚠️ **누를 때만 부른다.** 진단 화면을 열 때마다 LLM 을 부르면 화면이 느려지고,
   같은 답에 돈을 반복해서 쓴다.

⚠️ **응답자 정보를 안 보낸다.** 서술형은 문체로 사람이 좁혀진다. 역할·사업부를
   같이 보내면 "그 사업부의 그 역할인 사람"이 되어 사실상 기명이 된다.
"""
import json
import re

from app.modules.digital_twin_dashboard.ai import llm as dt_llm

# 묶음 개수. 많이 내면 목록이 되고, 목록은 안 읽힌다.
MAX_THEMES = 5

# 한 묶음에 붙일 인용 수.
MAX_QUOTES = 3

# 서술형이 이보다 적으면 부르지 않는다. 두세 건을 묶어 "이런 의견이 있다"고
# 말하는 것은 요약이 아니라 지목이다.
MIN_ANSWERS = 8

# ⚠️ 개발 스텁(`scripts/llm_stub.py`)이 이 작업을 알아보는 표식. 없으면 스텁이
#    되울림으로 답해서 개발서버에서는 이 기능을 **한 번도 못 돌려본다.**
#    바꾸면 스텁의 _MARK_VOICES 도 같이 바꿔야 한다.
MARK = '### dt-strategy: survey-voices'

_SYSTEM = """### dt-strategy: survey-voices
당신은 조직 설문의 자유서술 답변을 읽고 **되풀이되는 이야기**를 묶는 일을 합니다.

지켜야 할 것:
- 답변에 실제로 있는 내용만 씁니다. 없는 것을 짐작해 덧붙이지 마세요.
- 인용문은 **원문에서 그대로** 가져옵니다. 고쳐 쓰거나 다듬지 마세요.
- 해결책을 제안하지 마세요. 무슨 말이 오갔는지만 정리합니다.
- 한 사람만 한 말은 묶음으로 만들지 마세요. 여러 사람이 비슷하게 말한 것만 묶습니다.
- 한국어로 씁니다.

JSON 만 출력합니다. 다른 말을 붙이지 마세요.

{"themes": [{"title": "짧은 제목 (한 줄)",
             "summary": "무슨 이야기인지 두세 문장",
             "quotes": ["원문 그대로 1", "원문 그대로 2"]}]}"""


def _normalize(text):
    """인용 대조용. 공백과 문장부호 차이로 헛걸리는 것을 막는다."""
    return re.sub(r'[\s"\'“”‘’·.,!?]+', '', text or '')


def _verify_quotes(quotes, corpus):
    """원문에 실제로 있는 인용만 남긴다. (남은 것, 버린 것)

    LLM 이 인용을 조금 다듬는 일이 흔해서 정확히 일치하지는 않는다. 그래서
    **정규화한 뒤 부분 일치**로 본다 — 그래도 없는 말을 지어낸 것은 걸린다.
    """
    kept, dropped = [], []
    flat = [_normalize(a) for a in corpus]
    for quote in quotes or []:
        needle = _normalize(quote)
        if len(needle) < 6:
            dropped.append(quote)
            continue
        if any(needle in text or text in needle for text in flat):
            kept.append(quote)
        else:
            dropped.append(quote)
    return kept[:MAX_QUOTES], dropped


def _parse(content):
    """LLM 답에서 JSON 을 꺼낸다. 코드펜스를 씌워 주는 모델이 있어 벗겨 낸다."""
    text = (content or '').strip()
    if text.startswith('```'):
        text = re.sub(r'^```[a-zA-Z]*\n?', '', text)
        text = re.sub(r'\n?```$', '', text).strip()
    start, end = text.find('{'), text.rfind('}')
    if start < 0 or end <= start:
        raise ValueError('LLM 이 JSON 을 돌려주지 않았습니다.')
    return json.loads(text[start:end + 1])


def is_available():
    return dt_llm.is_configured()


def summarize(plan):
    """이 전략의 마감 설문 서술형을 묶는다.

    돌려주는 값:
        {'available': bool, 'reason': str|None, 'surveys': [...],
         'themes': [{title, summary, quotes, survey_id, survey_title}],
         'answer_count': int, 'dropped_quotes': int}

    실패해도 예외를 밖으로 내지 않는다 — 진단 화면이 AI 때문에 깨지면 안 된다.
    """
    result = {'available': False, 'reason': None, 'surveys': [],
              'themes': [], 'answer_count': 0, 'dropped_quotes': 0}

    if not is_available():
        result['reason'] = ('LLM 서버가 설정되지 않았습니다(.env 의 LLM_BASE_URL). '
                            '서술형 원문은 설문 집계 화면에서 그대로 보실 수 있습니다.')
        return result

    try:
        from app.modules.survey.evidence import candidate_surveys, free_text_answers
    except Exception:
        result['reason'] = '설문 모듈을 읽을 수 없습니다.'
        return result

    blocks = []
    corpus = []
    for survey in candidate_surveys('strategy_plan', plan.id):
        for group in free_text_answers(survey):
            blocks.append({'survey_id': survey.id, 'survey_title': survey.title,
                           'question': group['text'], 'answers': group['answers']})
            corpus.extend(group['answers'])
            result['surveys'].append({'id': survey.id, 'title': survey.title})

    result['answer_count'] = len(corpus)
    if len(corpus) < MIN_ANSWERS:
        result['reason'] = (f'서술형 답이 {len(corpus)}건뿐입니다. '
                            f'{MIN_ANSWERS}건은 모여야 묶을 수 있습니다 — 두세 건을 '
                            '묶어 "이런 의견이 있다"고 말하는 것은 요약이 아니라 '
                            '지목입니다.')
        return result

    payload = {
        'max_themes': MAX_THEMES,
        # ⚠️ 문항과 답변만 보낸다. 누가 썼는지는 애초에 안 실려 온다.
        'questions': [{'question': b['question'], 'answers': b['answers']}
                      for b in blocks],
    }
    messages = [
        {'role': 'system', 'content': _SYSTEM},
        {'role': 'user',
         'content': json.dumps(payload, ensure_ascii=False)},
    ]

    try:
        # 온도를 낮게 둔다. 이 작업은 창작이 아니라 정리다.
        answer = dt_llm.chat(messages, temperature=0.1)
        parsed = _parse(answer.content)
    except Exception as e:
        result['reason'] = f'묶기에 실패했습니다: {e}'
        return result

    themes = []
    dropped = 0
    for theme in (parsed.get('themes') or [])[:MAX_THEMES]:
        quotes, thrown = _verify_quotes(theme.get('quotes'), corpus)
        dropped += len(thrown)
        # ⚠️ 인용이 하나도 안 남으면 **그 묶음을 버린다.** 근거 없이 남은 요약은
        #    "AI 가 그렇게 말했다" 외에 아무 뒷받침이 없다.
        if not quotes:
            continue
        themes.append({
            'title': (theme.get('title') or '').strip()[:200],
            'summary': (theme.get('summary') or '').strip()[:800],
            'quotes': quotes,
            'survey_id': blocks[0]['survey_id'] if blocks else None,
            'survey_title': blocks[0]['survey_title'] if blocks else None,
        })

    result['available'] = True
    result['themes'] = themes
    result['dropped_quotes'] = dropped
    if not themes:
        result['reason'] = ('묶을 만한 이야기를 찾지 못했습니다. '
                            '(원문에 없는 인용이 섞여 걸러졌을 수 있습니다.)')
    return result
