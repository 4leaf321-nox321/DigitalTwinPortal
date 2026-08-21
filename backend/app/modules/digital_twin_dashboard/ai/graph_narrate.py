"""관계도 에이전트의 **서술** — LLM 이 하는 일은 여기까지다.

`graph_agent.py` 가 낸 숫자를 받아 **문장으로만** 엮는다.
숫자를 다시 세거나, 없는 항목을 만들거나, 순위를 바꾸지 않는다.

왜 파일을 갈랐나
    LLM 호출이 분석 안에 섞여 있으면 "이 숫자는 계산인가 생성인가" 를 코드에서
    구분할 수 없게 된다. 파일이 갈려 있으면 `graph_agent.py` 에 `llm` 이라는
    글자가 없는 것만으로 그 파일의 모든 숫자가 결정적임이 보장된다.

**서술이 실패해도 분석은 성공이다.** 호출부는 이 함수의 예외를 잡아 `narrative`
만 비우고 나머지를 그대로 내보낸다 — 그것이 "LLM 은 계산하지 않는다" 의 실질적 이득이다.
"""
from __future__ import annotations

import json

from app.modules.digital_twin_dashboard.ai import llm as dt_llm

# 스텁이 알아보는 표식. `scripts/llm_stub.py` 와 **같은 문자열**이어야 한다.
MARK = '### dt-graph-agent: narrate'

_TIMEOUT = 60.0
_TEMPERATURE = 0.2

_SYSTEM = f"""{MARK}
당신은 디지털 트윈 과제 관리의 PMO 분석가입니다.
아래 JSON 은 **이미 서버가 계산해 확정한 결과**입니다.

규칙
1. **숫자를 새로 만들거나 바꾸지 마세요.** JSON 에 있는 수치만 씁니다.
   JSON 에 없는 것은 "알 수 없다" 고 하거나 아예 언급하지 마세요.
2. 4~6문장. 한국어. 개조식이 아니라 **읽는 글**로 씁니다.
3. **첫 문장에 가장 급한 것 하나만** 씁니다. 그 하나를 `**굵게**` 표시합니다.
   여럿을 나열하지 마세요 — 다 중요하다는 말은 아무것도 안 하는 말입니다.
   무엇이 가장 급한지는 당신이 고릅니다. 수가 큰 것이 아니라 **손을 못 대고
   있는 것**, **여러 갈래로 동시에 걸리는 것**이 먼저입니다.
4. 그다음 순서: ② 왜 그렇게 보는지 (JSON 의 수치로 근거를 답니다)
   ③ 그다음으로 걸리는 것 (있으면 한 문장) ④ **무엇부터 하면 되는가.**
   마지막 문장은 사람이 **내일 할 수 있는 한 가지**로 끝냅니다.
   "관리가 필요하다" 같은 말은 아무 일도 시키지 않습니다.
5. `trend` 가 있고 `unavailable` 이 아니면 **움직임을 한 마디 넣으세요** —
   「지난주보다 2개 늘었다」처럼. 같은 수를 매주 보면 세 번째부터는 안 읽습니다.
   `unavailable` 이면 **아무 말도 하지 마세요.** 견줄 수 없는 것을 「같다」고
   하면 안 됩니다.
6. `coverage.notes` 에 내용이 있으면 그 한계를 한 번 밝히세요. 데이터가 덜 찬
   상태에서 단정하지 마세요. 다만 그 얘기로 글을 끝내지는 마세요 — 마지막은
   할 일입니다.
7. 사람 이름을 지목해 평가하지 마세요. "특정 담당자에게 몰려 있다" 처럼
   현상만 씁니다.
8. **표ㆍ목록ㆍ머리글을 쓰지 마세요. 문단 하나로 씁니다.** 쓸 수 있는 표기는
   `**굵게**` 뿐이고, 그것도 3번의 그 하나에만 씁니다.
   ⚠️ 목록으로 늘어놓으면 서버가 **이미 화면에 그린 숫자**를 두 번째로 옮겨
      적는 꼴이 됩니다. 한 화면에 서로 다른 숫자 두 벌이 같은 무게로 놓이면
      사람은 어느 쪽을 믿을지 모릅니다. 당신이 할 일은 다시 세는 것이 아니라
      **무엇이 급한지 고르는 것**입니다.
"""


def narrate(payload: dict, *, timeout: float = _TIMEOUT) -> str:
    """
    분석 결과 → 서술 4~6문장. 실패하면 예외를 던진다(호출부가 잡는다).

    **보내는 것은 요약본이다.** 원본을 통째로 보내면 목록이 길어 토큰을 다 먹고,
    LLM 이 목록을 되읊는 답을 낸다. 셀 것은 이미 셌으므로 **셈의 결과만** 보낸다.
    """
    slim = _slim(payload)
    messages = [
        {'role': 'system', 'content': _SYSTEM},
        {'role': 'user',
         'content': json.dumps(slim, ensure_ascii=False, default=str)},
    ]
    result = dt_llm.chat(messages, temperature=_TEMPERATURE, timeout=timeout)
    text = (result.content or '').strip()
    if not text:
        raise dt_llm.LLMError('LLM 이 빈 답을 돌려주었습니다.')
    return text


def _slim(p: dict) -> dict:
    """LLM 에 보낼 최소 요약. 목록은 **개수와 앞 몇 개**만."""
    kind = p.get('kind')
    out = {
        'kind': kind,
        'title': p.get('title'),
        'headline': p.get('headline'),
        'coverage': {
            'projectCount': (p.get('coverage') or {}).get('projectCount'),
            'peopleReliable': (p.get('coverage') or {}).get('peopleReliable'),
            'notes': (p.get('coverage') or {}).get('notes') or [],
        },
    }
    if kind == 'gaps':
        out['gaps'] = [{'title': g['title'], 'count': g['count'], 'why': g['why']}
                       for g in (p.get('gaps') or []) if g['count']]
    elif kind == 'kpi':
        out['steps'] = [{'label': s['label'], 'count': s['count']}
                        for s in (p.get('steps') or [])]
        out['priority'] = [{'code': x.get('code'), 'title': x.get('title'),
                            'reasons': x.get('reasons')}
                           for x in (p.get('priority') or [])[:3]]
        out['bottleneckCount'] = len(p.get('bottleneck') or [])
    elif kind == 'risky':
        out['items'] = [{'label': i['label'], 'missCells': i['missCells'],
                         'worstAchievement': i['worstAchievement'],
                         'projectCount': i['projectCount'],
                         'noProjects': i['noProjects']}
                        for i in (p.get('items') or [])[:5]]
    elif kind == 'hidden':
        out['note'] = p.get('note')
        out['items'] = [{'a': i['a'].get('code'), 'b': i['b'].get('code'),
                         'aTitle': i['a'].get('title'), 'bTitle': i['b'].get('title'),
                         'crossDivision': i['crossDivision'],
                         'viaCount': i['viaCount']}
                        for i in (p.get('items') or [])[:5]]
    elif kind == 'stalled':
        out['steps'] = [{'label': s['label'], 'count': s['count']}
                        for s in (p.get('steps') or [])]
        out['note'] = p.get('note')
        # 진행률이 내려간 것을 "나빠졌다" 로 쓰면 안 된다 — 계획이 커진 것일 수 있다.
        out['hint'] = p.get('hint')
        out['worst'] = [{'code': x.get('code'), 'idleDays': x.get('idleDays')}
                        for x in (p.get('stalled') or [])[:3]]
        out['trend'] = p.get('trend')
    elif kind == 'schedule':
        out['note'] = p.get('note')
        out['items'] = [{'code': x.get('code'), 'peakMonth': x.get('peakMonth'),
                         'peakCount': x.get('peakCount'), 'share': x.get('share')}
                        for x in (p.get('items') or [])[:5]]
    elif kind == 'issues':
        out['steps'] = [{'label': s['label'], 'count': s['count']}
                        for s in (p.get('steps') or [])]
        out['oldest'] = [{'code': x.get('code'), 'oldest': x.get('oldest')}
                         for x in (p.get('stale') or [])[:3]]
    elif kind == 'keyProjects':
        out['stats'] = p.get('stats')
        out['hint'] = p.get('hint')
        out['items'] = [{'code': x.get('code'), 'flags': x.get('flags')}
                        for x in (p.get('items') or [])[:5]]
    elif kind == 'readiness':
        out['gaps'] = [{'title': g['title'], 'count': g['count'], 'why': g['why']}
                       for g in (p.get('gaps') or []) if g['count']]
    elif kind == 'divisions':
        # **일부러 뺀 것을 LLM 에게도 알린다** — 모르면 "진행률은 왜 없나" 를
        # 채우려 들거나, 없는 것을 있는 것처럼 쓴다.
        out['excluded'] = p.get('excluded')
        out['note'] = p.get('note')
        out['rows'] = [{'division': r['division'], 'projectCount': r['projectCount'],
                        'fillRate': r['fillRate'], 'todo': r['todo'],
                        'smallSample': r['smallSample'],
                        # 가장 덜 채운 항목 하나만 — 표를 통째로 보내면 되읊는다
                        'weakest': min(
                            ((k, c['rate']) for k, c in r['cells'].items()
                             if c['rate'] is not None),
                            key=lambda x: x[1], default=(None, None))[0]}
                       for r in (p.get('rows') or [])]
    return out
