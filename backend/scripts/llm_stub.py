"""OpenAI 호환 LLM 스텁 — **개발서버에서 GLM 없이 어댑터를 진짜로 돌린다.**

개발서버는 GPU 서버(GLM-5.2)에 못 닿는다(운영만 닿는다). 그렇다고 어댑터를 못 만드는 건
아니다 — **같은 응답 모양**을 흉내내는 작은 서버를 띄우면 우리 코드(요청 바디 조립 ·
httpx · 응답 파싱 · tool_calls 파싱 · 타임아웃)가 전부 그대로 실행된다.
참고 구현: ReportArchive `scripts/llm_stub.py` (그쪽이 실제 GLM 툴콜을 성공시킨 코드다).

⚠️ **Flask 로 짰다.** ReportArchive 는 FastAPI 인데, 그걸 따라가면 백엔드 venv 에
   fastapi·uvicorn 이 새로 들어온다. Flask 는 이미 있다 — 스텁 하나 때문에 의존성을
   늘리지 않는다.

엔드포인트
    GET  /v1/models             모델 목록
    POST /v1/chat/completions   아래 규칙대로 응답

응답 규칙 (네 갈래)
    ⓪ 시스템 프롬프트에 **폼 도우미 표식**이 있으면 그 작업에 맞는 JSON 을 만들어 준다.
       ← `ai/form_assist.py` 의 `MARK_FILL`·`MARK_ACTIONS`. 되울림으로는 JSON 파싱을
         한 번도 못 태우기 때문에, 이 갈래가 없으면 개발서버에서 폼 채우기·액션아이템
         뽑기를 **한 줄도 돌려볼 수 없다.** 값은 붙여넣은 원문에서 실제로 뽑아 만든다
         (고정 문자열이면 화면이 늘 같은 것만 보여줘 시험이 되지 않는다).
         · 과제명·상세설명 ← 원문 첫 줄·앞부분
         · 사업부·프로세스·과제영역·과제구분 ← **프롬프트에 실린 선택지 중 원문에
           등장하는 값**(목록을 스텁이 따로 알지 않는다 — 설정이 늘면 따라온다)
         · 액션아이템 ← 글머리표(`- `, `1. `)로 시작하는 줄
         · 원문에 `!지어내기` 를 넣으면 **일부러 틀린 값**(없는 사업부·13월·진행률)을
           섞는다. 서버가 버리고 화면이 사유를 띄우는 길을 눈으로 볼 때 쓴다.
    ① `fixtures/glm_chat_response.json` 이 있으면 **그대로 재생한다.**
       ← 운영에서 실제 GLM 응답을 한 번 떠 와서 넣어 두면, 개발에서 그 **진짜 모양**에
         파싱을 고정할 수 있다. `arguments` 가 문자열인지 객체인지 같은 것이 여기서 갈린다.
         ⚠️ 폼 도우미(⓪)보다 **뒤에** 본다 — 그 fixture 는 도구 호출 응답이라
            폼 도우미에 재생하면 JSON 이 아니어서 늘 실패한다.
    ② 마지막 user 메시지가 `!tool <이름> <JSON>` 이면 **그 도구를 부르는 tool_calls** 로 답한다.
       ← 루프·도구 실행·되먹임을 손으로 태워 볼 때 쓴다.
    ③ 그 외에는 마지막 user 메시지를 되울린다.

실행
    python scripts\\llm_stub.py               # 0.0.0.0:9001
    python scripts\\llm_stub.py --port 9100

그리고 backend\\.env 에:
    LLM_BASE_URL=http://localhost:9001/v1
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

from flask import Flask, jsonify, request

STUB_MODEL = 'GLM-5-2'
_FIXTURE = Path(__file__).resolve().parent.parent / 'tests' / 'fixtures' / 'glm_chat_response.json'

app = Flask(__name__)


@app.get('/v1/models')
def models():
    return jsonify({'object': 'list', 'data': [{'id': STUB_MODEL, 'object': 'model'}]})


def _last_user(messages) -> str:
    for m in reversed(messages or []):
        if (m or {}).get('role') == 'user':
            return str(m.get('content') or '')
    return ''


def _tool_call_response(model, spec: str):
    """`!tool <이름> <JSON인자>` → tool_calls 응답.

    `arguments` 를 **JSON 문자열로** 낸다 — OpenAI 규격이 그렇고, 그래야 우리 파서의
    문자열 갈래가 실제로 검증된다(객체 갈래는 fixture 로 확인한다).
    """
    parts = spec.strip().split(None, 2)
    name = parts[1] if len(parts) > 1 else ''
    args = parts[2] if len(parts) > 2 else '{}'
    try:
        json.loads(args)
    except ValueError:
        args = '{}'
    return {
        'id': 'chatcmpl-stub-tool',
        'object': 'chat.completion',
        'model': model,
        'choices': [{
            'index': 0,
            'message': {
                'role': 'assistant',
                'content': '',
                'tool_calls': [{
                    'id': 'call_stub_1',
                    'type': 'function',
                    'function': {'name': name, 'arguments': args},
                }],
            },
            'finish_reason': 'tool_calls',
        }],
        'usage': {'prompt_tokens': 0, 'completion_tokens': 0, 'total_tokens': 0},
    }


# ⚠️ **`ai/form_assist.py` 의 MARK_FILL·MARK_ACTIONS 와 같은 문자열이어야 한다.**
#    여기서 import 하지 않는 이유 — 이 스텁은 백엔드 앱을 띄우지 않고 혼자 도는
#    개발 도구다(앱을 import 하면 DB·설정까지 끌려온다). 대신 어긋나면
#    `dt3_test_form_assist.py` 가 실패한다.
_MARK_FILL = '### dt-form-assist: project-fill'
_MARK_ACTIONS = '### dt-form-assist: action-items'
_MARK_PEOPLE = '### dt-form-assist: people'
_MARK_KPI = '### dt-form-assist: kpi-links'
# ⚠️ `ai/graph_narrate.py` 의 MARK 와 **같은 문자열**이어야 한다.
_MARK_GRAPH_NARRATE = '### dt-graph-agent: narrate'
_MARK_NAME_MATCH = '### dxkpi-import: name-match'
# ⚠️ `digital_twin_strategy/survey_voice.py` 의 MARK 와 **같은 문자열**이어야 한다.
_MARK_VOICES = '### dt-strategy: survey-voices'

# KPI 추천 프롬프트의 지표 줄:  - id=12 `설계 리드타임 단축률` (효율) 단위 %
_KPI_RE = re.compile(r'^-\s*id=(\d+)\s*`([^`]*)`(.*)$', re.M)

# 사람 이름처럼 보이는 것. 스텁이라 **모양만** 본다(한글 2~4자).
# 진짜 모델은 문맥으로 가리지만, 여기서는 화면·후보 조회 경로를 태우는 것이 목적이다.
#
# ⚠️ 처음엔 "줄 끝이나 쉼표 앞의 한글 2~4자" 를 다 집었더니 `회의록`·`작성` 까지
#    사람으로 올라왔다. 문맥을 못 보는 스텁에서는 **집는 자리를 좁히는 것**이 답이다:
#      · 직함이 붙은 이름          (`홍길동 책임`)
#      · 참석/참여/담당 줄의 나열   (`참석: 홍길동, 김철수`)
_TITLED_RE = re.compile(r'([가-힣]{2,4})\s*(?:님|씨|책임|선임|프로|매니저|연구원)')
_ROSTER_RE = re.compile(r'^\s*(?:참석|참여|담당|작성자|보고자)\s*[:：]\s*(.+)$')
_KOREAN_NAME_RE = re.compile(r'^[가-힣]{2,4}$')

_BULLET_RE = re.compile(r'^\s*(?:[-*·•]|\d+[.)])\s*(.+)$')

# 서술형을 끊는 자리 — 문장 끝과 쉼표. 스텁이라 뜻은 못 보고 **부호만** 본다.
_CLAUSE_RE = re.compile(r'[.。\n,、]+')

# 폼 채우기 프롬프트의 선택지 줄:  - `사업부` (choice) 선택지: MX · VD · DA
# **여기 실린 목록이 곧 설정 테이블의 활성 값**이라, 스텁이 목록을 따로 알 필요가 없다.
_OPTION_RE = re.compile(r'^-\s*`([^`]+)`.*?선택지:\s*(.+)$', re.M)

# 상세정보 섹션 줄:  - `상세정보_과제개요` (detail) 항목 2개까지, **하위 줄 없이**
_DETAIL_RE = re.compile(r'^-\s*`(상세정보_[^`]+)`\s*\(detail\)(.*)$', re.M)

# 스텁이 채울 섹션 수와 한 줄 길이. 7섹션을 다 채우면 미리보기가 화면을 덮어서
# **정작 봐야 할 다른 칸이 안 보인다.** 39자 제한 아래로 넉넉히 자른다.
_STUB_DETAIL_SECTIONS = 3
_STUB_LINE_CHARS = 30

# 일부러 틀린 값을 내게 하는 개발용 신호. 원문에 이 말을 넣으면 스텁이
# **선택지에 없는 사업부·13월·화이트리스트 밖 필드**를 보낸다 —
# 서버가 버리고 화면이 "왜 안 넣었는지" 를 띄우는 길을 눈으로 확인할 때 쓴다.
# (`!tool …` 과 같은 결의 장치다)
_FORGE_MARK = '!지어내기'


def _system_text(messages) -> str:
    for m in messages or []:
        if (m or {}).get('role') == 'system':
            return str(m.get('content') or '')
    return ''


# 사용자 메시지에서 **본문이 시작되는 자리**. `form_assist` 의 프롬프트가 쓰는 머리말이다.
#
# ⚠️ **프롬프트에서 이 머리말을 바꾸면 여기도 바꿀 것.** 안 맞으면 스텁이 머리말까지
#    본문으로 읽어서 `[과제] …` · `[기간] …` 이 액션아이템 제목으로 올라온다
#    (2026-08-08 실제로 그랬다). `dt3_test_form_assist.py` 가 일치를 강제한다.
_BODY_HEADS = ('[과제 내용]', '[원문]')


def _source_lines(user_text: str):
    """마지막 user 메시지의 **본문** 줄들. 머리말이 없으면 전체를 줄로 나눈다."""
    body = user_text
    for head in _BODY_HEADS:
        if head in body:
            body = body.split(head, 1)[-1]
            break
    return [ln.strip() for ln in body.splitlines() if ln.strip()]


def _json_message(model, payload):
    """content 에 JSON 을 담은 응답. **코드펜스로 감싼다** — 진짜 모델이 흔히 그렇게
    답하므로, 파서의 펜스 벗기기 갈래가 개발에서 실제로 검증된다."""
    text = '```json\n' + json.dumps(payload, ensure_ascii=False, indent=2) + '\n```'
    return {
        'id': 'chatcmpl-stub-form',
        'object': 'chat.completion',
        'model': model,
        'choices': [{'index': 0,
                     'message': {'role': 'assistant', 'content': text},
                     'finish_reason': 'stop'}],
        'usage': {'prompt_tokens': 0, 'completion_tokens': 0, 'total_tokens': 0},
    }


def _text_message(model, text):
    """content 가 **그냥 글**인 응답. 관계도 에이전트의 서술이 이 모양이다
    (JSON 을 기대하지 않으므로 코드펜스로 감싸지 않는다)."""
    return {
        'id': 'chatcmpl-stub-narrate',
        'object': 'chat.completion',
        'model': model,
        'choices': [{'index': 0,
                     'message': {'role': 'assistant', 'content': text},
                     'finish_reason': 'stop'}],
        'usage': {'prompt_tokens': 0, 'completion_tokens': 0, 'total_tokens': 0},
    }


def _graph_narrate_text(user_text: str) -> str:
    """
    관계도 에이전트의 서술을 흉내 낸다.

    **숫자를 지어내지 않는다.** 사용자 메시지로 온 JSON 에 들어 있는 값만 골라 문장에
    끼운다 — 그래야 "LLM 은 계산하지 않는다" 는 규칙이 스텁에서도 지켜지고,
    화면에 뜬 숫자와 서술이 어긋나지 않는 것을 개발에서 실제로 볼 수 있다.
    """
    try:
        d = json.loads(user_text)
    except ValueError:
        return '분석 결과를 읽지 못해 서술을 만들 수 없습니다. (스텁)'

    kind = d.get('kind')
    head = (d.get('headline') or '').strip()
    cov = d.get('coverage') or {}
    parts = []

    if head:
        parts.append(head)

    if kind == 'gaps':
        gaps = d.get('gaps') or []
        if gaps:
            top = max(gaps, key=lambda g: g.get('count') or 0)
            parts.append(f"그중 「{top['title']}」 이 {top['count']}건으로 가장 많습니다.")
            parts.append('먼저 이 항목부터 채우면 나머지 분석의 정확도가 함께 올라갑니다.')
    elif kind == 'kpi':
        steps = {s['label']: s['count'] for s in (d.get('steps') or [])}
        no_res = steps.get('성과 실적 없음', 0)
        overdue = steps.get('그중 목표일 지남', 0)
        if no_res:
            parts.append(f'성과 실적이 아직 없는 과제가 {no_res}개 있습니다.')
        if overdue:
            parts.append(f'목표일이 지난 미완료 액션이 {overdue}건 남아 있습니다.')
        pri = d.get('priority') or []
        if pri:
            parts.append(f"우선 볼 과제는 {pri[0].get('code') or pri[0].get('title')} 입니다.")
    elif kind == 'risky':
        items = d.get('items') or []
        if items:
            worst = items[0]
            parts.append(f"가장 처지는 지표는 「{worst['label']}」 입니다.")
            orphan = [i for i in items if i.get('noProjects')]
            if orphan:
                parts.append(f'그중 {len(orphan)}개는 미는 과제가 하나도 없습니다.')
    elif kind == 'hidden':
        items = d.get('items') or []
        cross = [i for i in items if i.get('crossDivision')]
        if cross:
            parts.append(f'사업부가 다른 쌍이 {len(cross)}개 있어 협업 여지가 있습니다.')
        if d.get('note'):
            parts.append(str(d['note']))
    elif kind == 'stalled':
        worst = (d.get('worst') or [])
        if worst:
            parts.append(f"가장 오래 멈춘 것은 {worst[0].get('code')} "
                         f"({worst[0].get('idleDays')}일)입니다.")
        # 진행률이 내려간 것을 "나빠졌다" 로 읽으면 안 된다 — 계획이 커진 것일 수 있다.
        if d.get('hint'):
            parts.append(str(d['hint']).replace('**', ''))
        if d.get('note'):
            parts.append(str(d['note']))
    elif kind == 'schedule':
        items = d.get('items') or []
        if items:
            parts.append(f"{items[0].get('code')} 는 미완료의 {items[0].get('share')}% 가 "
                         f"{items[0].get('peakMonth')} 에 몰려 있습니다.")
        if d.get('note'):
            parts.append(str(d['note']))
    elif kind == 'issues':
        oldest = (d.get('oldest') or [])
        if oldest:
            parts.append(f"가장 오래된 미해결 이슈는 {oldest[0].get('code')} 의 "
                         f"{oldest[0].get('oldest')} 등록 건입니다.")
    elif kind == 'keyProjects':
        st = d.get('stats') or {}
        if st.get('keyAvgProgress') is not None:
            parts.append(f"중점과제 평균 진행률은 {st['keyAvgProgress']}%, "
                         f"그 외는 {st.get('otherAvgProgress')}% 입니다.")
        if d.get('hint'):
            parts.append(str(d['hint']))
    elif kind == 'readiness':
        gaps = d.get('gaps') or []
        if gaps:
            top = max(gaps, key=lambda g: g.get('count') or 0)
            parts.append(f"「{top['title']}」 이 {top['count']}건으로 가장 많습니다.")
    elif kind == 'divisions':
        rows = d.get('rows') or []
        if rows:
            w = rows[0]
            parts.append(f"{w.get('division')} 가 채움률 {w.get('fillRate')}% 로 가장 낮고, "
                         f"안 채운 항목이 {w.get('todo')}건입니다.")
        # 뺀 것을 밝히지 않으면 보는 사람이 "성과 비교" 로 오해한다.
        for ex in (d.get('excluded') or [])[:1]:
            parts.append(f"{ex.get('label')} 는 이 표에 넣지 않았습니다 — {ex.get('why')}")
        if d.get('note'):
            parts.append(str(d['note']))

    for n in (cov.get('notes') or [])[:1]:
        parts.append(str(n))

    parts.append('(스텁이 만든 서술입니다 — 숫자는 서버 계산 결과 그대로입니다.)')
    return ' '.join(parts)


def _match_options(system_text: str, source_text: str):
    """시스템 프롬프트에 실린 선택지 중 **원문에 실제로 나오는** 값을 고른다.

    목록을 여기 적어 두지 않는다 — 프롬프트에서 읽는다. 그래야 설정에 사업부가 하나
    늘어도 스텁이 따라오고, **화면에서 선택 칸이 채워지는 것을 실제로 볼 수 있다**
    (그전에는 스텁이 과제명·상세설명 두 칸만 만들어서 선택지 검증 경로가 늘 비어 있었다).

    ⚠️ 찾는 범위는 **`[원문]` 아래뿐**이다. 사용자 메시지 전체를 뒤지면 `[현재 값]` 의
       사업부가 걸려서 늘 지금 값과 같은 값을 내고, 서버가 "안 바뀜" 으로 걸러 버린다.
    """
    flat = re.sub(r'\s+', '', source_text).lower()
    picked = {}
    for key, raw in _OPTION_RE.findall(system_text):
        for opt in [o.strip() for o in raw.split('·') if o.strip()]:
            if re.sub(r'\s+', '', opt).lower() in flat:
                picked[key] = opt
                break
    return picked


def _detail_sections(system_text: str, lines):
    """상세 과제 정보 섹션을 원문 줄로 채운다.

    프롬프트에 실린 사양(`(detail)` · `하위 줄 없이`)을 읽어서 **섹션마다 규칙을
    맞춘다** — 앞 3섹션은 하위 줄이 없어야 하고, 한 줄은 39자를 넘으면 버려진다.
    스텁이라 뜻은 못 보지만 **모양은 진짜와 같게** 만든다.
    """
    out = {}
    for key, tail in _DETAIL_RE.findall(system_text)[:_STUB_DETAIL_SECTIONS]:
        parent_only = '하위 줄 없이' in tail
        picked = [ln[:_STUB_LINE_CHARS] for ln in lines[:4]][:2]
        if not picked:
            continue
        items = [{'text': t, 'children': []} for t in picked]
        if not parent_only and len(lines) > 2:
            items[0]['children'] = [{'text': ln[:_STUB_LINE_CHARS]} for ln in lines[1:3]]
        out[key] = {'enabled': True, 'items': items}
    return out


def _form_fill_payload(system_text: str, user_text: str):
    """붙여넣은 원문에서 과제명·상세설명·선택 칸·상세정보를 만들어 준다(실제 값으로)."""
    lines = _source_lines(user_text)
    if not lines:
        return {'fields': {}, 'note': '[stub] 원문이 비어 값을 만들지 않았습니다.'}

    source = '\n'.join(lines)
    fields = {'과제명': lines[0][:60], '과제상세설명': source[:1500]}
    fields.update(_match_options(system_text, source))
    fields.update(_detail_sections(system_text, lines))
    note = ('[stub] 실제 모델이 아닙니다 — 원문 앞부분, 원문에 등장한 선택지, '
            f'상세정보 앞 {_STUB_DETAIL_SECTIONS}섹션을 채웠습니다.')

    if _FORGE_MARK in user_text:
        # 버려지는 값들 — 화면의 "왜 안 넣었는지" 안내를 확인하는 용도
        fields['사업부'] = '없는사업부'
        fields['종료'] = 13
        fields['진행률'] = 80
        # 39자를 넘는 줄 하나. 섹션은 살고 그 줄만 빠지는지 본다.
        # ⚠️ **맨 뒤가 아니라 두 번째에 끼운다** — 앞 3섹션은 항목 2개까지라,
        #    뒤에 붙이면 개수 제한에 먼저 걸려 잘려서 길이 검사까지 가지도 못한다.
        for key, section in fields.items():
            if key.startswith('상세정보_') and isinstance(section, dict):
                section['items'].insert(1, {'text': '가' * 45, 'children': []})
                break
        note += f' ({_FORGE_MARK}: 일부러 틀린 값 4개를 섞었습니다)'

    return {'fields': fields, 'note': note}


def _form_actions_payload(user_text: str):
    """액션아이템 후보. **입력 두 갈래를 다 흉내낸다.**

    ㉠ 글머리표(`- `, `1. ` …)가 있으면 그 줄을 그대로 옮긴다 (회의록·주간보고)
    ㉡ 없으면 **문장을 끊는다** (서술형 과제 설명)

    ㉡이 없으면 개발에서 서술형 경로를 볼 수가 없다 — 첫 줄 하나만 나와서 "목록을
    이미 갖고 있어야 쓰는 기능" 처럼 보인다. 스텁이라 뜻은 못 보고 문장부호로만
    자르지만, 화면·중복 판정·미리보기를 태우는 데는 충분하다.
    """
    lines = _source_lines(user_text)
    items = []
    for ln in lines:
        m = _BULLET_RE.match(ln)
        if not m:
            continue
        items.append({'제목': m.group(1)[:80], '목표일': '', '액티비티': []})
        if len(items) >= 5:
            break

    if not items:
        for part in _CLAUSE_RE.split('\n'.join(lines)):
            part = part.strip(' \t·-')
            if len(part) < 6:            # 조각난 부스러기는 버린다
                continue
            items.append({'제목': part[:80], '목표일': '', '액티비티': []})
            if len(items) >= 5:
                break

    if not items:
        items = [{'제목': (lines or ['액션아이템 예시'])[0][:80],
                  '목표일': '', '액티비티': []}]

    return {'items': items,
            'note': '[stub] 실제 모델이 아닙니다 — 글머리표 줄, 없으면 문장을 끊어 옮겼습니다.'}


def _form_people_payload(user_text: str):
    """참석자 줄에서 이름처럼 보이는 것을 뽑는다. **knoxId 는 만들지 않는다** —
    계정 확인은 서버 몫이고, 스텁이 흉내내면 그 경계가 흐려진다."""
    people, seen = [], set()
    for ln in _source_lines(user_text):
        found = list(_TITLED_RE.findall(ln))
        roster = _ROSTER_RE.match(ln)
        if roster:
            for token in re.split(r'[,·、/]| 및 ', roster.group(1)):
                token = _TITLED_RE.sub(r'\1', token).strip()
                if _KOREAN_NAME_RE.match(token):
                    found.append(token)
        for name in found:
            if name in seen or len(people) >= 5:
                continue
            seen.add(name)
            people.append({'이름': name, '근거': ln[:60]})
    return {'people': people,
            'note': '[stub] 실제 모델이 아닙니다 — 이름처럼 보이는 말을 그대로 옮겼습니다.'}


def _form_kpi_payload(system_text: str):
    """프롬프트에 실린 지표 목록에서 **아직 안 걸린** 것 두 개를 고른다.

    스텁이라 뜻은 못 본다. 그래도 **근거를 비워 두지 않는다** — 근거가 없으면 화면이
    "근거를 적지 않은 추천" 으로 경고하는데, 그 경고를 늘 보게 되면 진짜 경고를
    흘려보내게 된다.
    """
    kpis = []
    for kid, label, tail in _KPI_RE.findall(system_text):
        if '이미 연결됨' in tail:
            continue
        kpis.append({'id': int(kid),
                     '근거': f'[stub] 과제 내용과 «{label}» 이(가) 닿아 보입니다'})
        if len(kpis) >= 2:
            break
    return {'kpis': kpis,
            'note': '[stub] 실제 모델이 아닙니다 — 목록 앞쪽에서 두 개를 골랐을 뿐입니다.'}


def _voices_payload(user_text: str):
    """설문 서술형 묶기 흉내. (`digital_twin_strategy/survey_voice.py`)

    **인용문은 받은 원문에서 그대로 가져온다.** 지어낸 문장을 돌려주면 서버가
    전부 걸러내서, 개발에서는 늘 빈 화면만 보게 된다.

    묶는 방식은 단순하다 — 같은 문장이 몇 번 나왔는지 세어 많은 것부터 낸다.
    진짜 모델처럼 뜻으로 묶지는 못하지만, **화면·파싱·인용 검사**는 그대로
    돌아간다. 그게 스텁이 하는 일이다.

    ⚠️ 첫 묶음에 **일부러 없는 인용 하나**를 섞는다. 서버가 그것을 버리고
       화면이 '1건 버림'을 띄우는 길을, 개발에서 눈으로 볼 수 있어야 한다.
    """
    try:
        payload = json.loads(user_text)
    except ValueError:
        return {'themes': []}

    counts = {}
    for group in payload.get('questions') or []:
        for answer in group.get('answers') or []:
            text = (answer or '').strip()
            if text:
                counts[text] = counts.get(text, 0) + 1

    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    limit = int(payload.get('max_themes') or 5)

    themes = []
    for i, (text, n) in enumerate(ranked[:limit]):
        quotes = [text]
        if i == 0:
            quotes.append('예산이 배정되지 않아 아무것도 시작하지 못했습니다.')
        themes.append({
            'title': text[:24] + ('…' if len(text) > 24 else ''),
            'summary': f'비슷한 이야기가 {n}건 나왔습니다. (개발 스텁이 같은 문장을 '
                       '센 것이라, 뜻으로 묶은 결과는 아닙니다.)',
            'quotes': quotes,
        })
    return {'themes': themes}


def _name_match_payload(user_text: str):
    """KPI 이름 짝짓기 (`dx_kpi_management/name_ai.py`).

    스텁이라 **뜻을 못 본다.** 글자가 가장 많이 겹치는 것을 고를 뿐이다. 그래도 이게
    있어야 개발서버에서 화면 흐름(눌렀다 → 채워졌다 → 고쳤다 → 저장했다)을 끝까지
    밟아볼 수 있다.

    ⚠️ **일부러 목록 밖 이름도 하나 섞는다.** 진짜 모델은 없는 KPI 를 지어내기도
       하는데, 서버가 그걸 버리는지 여기서 확인돼야 한다.
    """
    lines = [ln.strip() for ln in str(user_text or '').split('\n')]
    catalog, asked, in_catalog = [], [], True
    for ln in lines:
        if '짝을 못 찾은' in ln:
            in_catalog = False
            continue
        if not ln.startswith('- '):
            continue
        item = ln[2:].strip()
        (catalog if in_catalog else asked).append(item)

    labels = [re.sub(r'\s*\([^)]*\)\s*$', '', c).strip() for c in catalog]

    def overlap(a, b):
        sa = set(re.sub(r'[\s()\[\]/·.,\-_]', '', a).lower())
        sb = set(re.sub(r'[\s()\[\]/·.,\-_]', '', b).lower())
        return len(sa & sb) / max(1, len(sa | sb))

    matches = []
    for name in asked:
        best, score = None, 0.0
        for label in labels:
            s = overlap(name, label)
            if s > score:
                best, score = label, s
        if best and score >= 0.3:
            matches.append({'name': name, 'kpi': best,
                            'confidence': 'medium' if score >= 0.5 else 'low',
                            'why': f'[stub] 글자가 {int(score * 100)}% 겹칩니다'})
        else:
            matches.append({'name': name, 'kpi': None,
                            'confidence': 'low', 'why': '[stub] 닮은 것이 없습니다'})
    if asked:
        # 목록에 없는 답 — 서버가 버려야 한다
        matches.append({'name': asked[0], 'kpi': '스텁이 지어낸 KPI',
                        'confidence': 'high', 'why': '[stub] 일부러 넣은 가짜입니다'})
    return {'matches': matches}


@app.post('/v1/chat/completions')
def chat_completions():
    body = request.get_json(silent=True) or {}
    model = body.get('model') or STUB_MODEL
    messages = body.get('messages') or []

    # ⓪ 폼 도우미 — fixture 보다 **먼저** 본다 (그 fixture 는 도구 호출 응답이다)
    system = _system_text(messages)
    if _MARK_FILL in system:
        return jsonify(_json_message(model, _form_fill_payload(system, _last_user(messages))))
    if _MARK_ACTIONS in system:
        return jsonify(_json_message(model, _form_actions_payload(_last_user(messages))))
    if _MARK_PEOPLE in system:
        return jsonify(_json_message(model, _form_people_payload(_last_user(messages))))
    if _MARK_KPI in system:
        return jsonify(_json_message(model, _form_kpi_payload(system)))
    if _MARK_GRAPH_NARRATE in system:
        return jsonify(_text_message(model, _graph_narrate_text(_last_user(messages))))
    if _MARK_NAME_MATCH in system:
        return jsonify(_json_message(model, _name_match_payload(_last_user(messages))))
    if _MARK_VOICES in system:
        return jsonify(_json_message(model, _voices_payload(_last_user(messages))))

    # ① 운영 캡처 fixture 가 있으면 그대로 재생 (진짜 응답 모양에 파싱 핀 고정)
    if _FIXTURE.exists():
        try:
            return jsonify(json.loads(_FIXTURE.read_text(encoding='utf-8')))
        except (ValueError, OSError):
            pass          # 손상됐으면 아래 합성 응답으로 떨어진다

    last = _last_user(messages)

    # ② 도구 호출 각본.
    #    ⚠️ **`tools` 를 받았을 때만** 낸다 — 진짜 모델은 안 준 도구를 부를 수 없다.
    #    이 조건이 없으면 루프의 마지막 홉(도구 없이 답을 강제하는 홉)에서도 스텁이
    #    tool_calls 를 뱉어, 답변이 영원히 안 나오고 홉만 태운다.
    if last.startswith('!tool ') and body.get('tools'):
        return jsonify(_tool_call_response(model, last))

    # ③ 되울림. reasoning_effort 를 줬으면 GLM 처럼 사고 과정을 별 필드로 채운다
    #    (어댑터의 reasoning 분리를 검증하려는 것이다).
    effort = (body.get('chat_template_kwargs') or {}).get('reasoning_effort')
    message = {'role': 'assistant', 'content': f'[stub:{model}] {last}'}
    if effort:
        message['reasoning_content'] = f'(reasoning_effort={effort}) 생각하는 중…'

    n_tools = len(body.get('tools') or [])
    return jsonify({
        'id': 'chatcmpl-stub',
        'object': 'chat.completion',
        'model': model,
        'choices': [{'index': 0, 'message': message, 'finish_reason': 'stop'}],
        'usage': {'prompt_tokens': len(last.split()),
                  'completion_tokens': 5,
                  'total_tokens': len(last.split()) + 5,
                  # 표준 필드가 아니다 — 스텁이 도구를 몇 개 받았는지 눈으로 보려고 넣는다
                  'stub_tools_received': n_tools},
    })


def main():
    ap = argparse.ArgumentParser(description='OpenAI 호환 LLM 스텁 (개발 전용)')
    ap.add_argument('--host', default='0.0.0.0')
    ap.add_argument('--port', type=int, default=9001)
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    print(f"""
    ================================================================
    |  LLM 스텁 (개발 전용 — 실제 모델이 아니다)                   |
    ================================================================
    |  http://{args.host}:{args.port}/v1
    |  fixture: {'있음 — 그대로 재생한다' if _FIXTURE.exists() else '없음 — 합성 응답'}
    |
    |  backend\\.env 에:  LLM_BASE_URL=http://localhost:{args.port}/v1
    |  도구 호출 시험:    질문을  !tool list_projects {{"q":"MX"}}
    |  폼 도우미 시험:    편집창에서 그냥 쓰면 된다 (원문에서 값을 만들어 준다)
    |                     원문에 !지어내기 를 넣으면 틀린 값도 섞어 준다(검증 확인용)
    ================================================================
    """)
    app.run(host=args.host, port=args.port, debug=False, threaded=True)


if __name__ == '__main__':
    main()
