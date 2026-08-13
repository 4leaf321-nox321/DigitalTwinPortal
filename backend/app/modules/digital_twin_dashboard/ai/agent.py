"""에이전트 루프 — LLM 이 도구를 스스로 골라 쓰고, 마지막에 답한다.

    chat(tools=스키마) → tool_calls 있으면 실행·되먹임 → 없으면 그게 최종 답변

참고 구현: ReportArchive `app/ai/agent.py`. 폭주 방지를 셋이 나눠 맡는 구조를 그대로 쓴다 —
`_MAX_HOPS`(LLM 왕복 수) · `_MAX_TOOL_CALLS_PER_HOP` · `_MAX_TOOL_CALLS_TOTAL`.
앞의 것만으론 **한 홉에 뱉은 tool_calls N개가 그대로 다 도는 걸 못 막는다.**

⚠️ 예산을 넘긴 호출은 **실행만 건너뛰고 응답은 채운다.** tool_call 마다 `role:tool`
   메시지가 하나씩 있어야 하는 프로토콜이라, 그냥 버리면 다음 `chat` 이 400 으로 깨진다.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from flask import current_app

from app.modules.digital_twin_dashboard.ai import agent_tools
from app.modules.digital_twin_dashboard.ai.llm import LLMContextError, LLMError, chat

# 서버가 사고 옵션을 거부했는가. 프로세스가 사는 동안만 기억한다(재시작하면 다시 시도).
_reasoning_off: dict = {}

_MAX_HOPS = 6
_MAX_TOOL_CALLS_PER_HOP = 5
_MAX_TOOL_CALLS_TOTAL = 15
_BUDGET_MSG = ('도구 호출 예산을 초과해 이 호출은 실행되지 않았습니다. '
               '지금까지 모은 것만으로 답하세요.')

# 도구 결과를 그대로 되먹이면 토큰이 폭발한다(과제 상세 하나가 수 KB). 잘라서 넣고,
# 잘랐다는 사실을 모델에게 알린다 — 조용히 자르면 모델이 없는 값을 지어낸다.
_MAX_TOOL_RESULT_CHARS = 6000

# ─────────────────────────────────────────────────────────────────────────────
# 시스템 프롬프트 — **스킬 파일을 그대로 쓴다**
#
# 절차 규칙(먼저 describe_fields · 202 면 물어보고 confirm · 배열은 통째 교체 · ignored
# 를 알릴 것)은 이미 `mcp_server/skill/digitaltwin/SKILL.md` 에 있다. 여기에 다시 쓰면
# **같은 규칙이 두 곳**이 되고, 한쪽만 고쳐져 갈린다 — 그러면 Claude Code 로 쓸 때와
# 사내 LLM 으로 쓸 때 동작이 달라진다. 그게 제일 나쁘다.
#
# 그래서 파일을 읽어 앞머리(frontmatter)만 떼고 그대로 싣는다.
# `dt3_test_agent.py` 가 "프롬프트에 스킬 본문이 실제로 들어갔는지" 를 검사한다.
# ─────────────────────────────────────────────────────────────────────────────

_SKILL_PATH = (Path(__file__).resolve().parents[5]
               / 'mcp_server' / 'skill' / 'digitaltwin' / 'SKILL.md')

_PREAMBLE = (
    '당신은 디지털 트윈 대시보드의 과제 관리 도우미다. 도구로 과제를 조회·수정하고 '
    '한국어로 간결히 답한다.\n'
    '아래는 반드시 지켜야 할 작업 절차다. 특히 **확인 절차를 건너뛰지 마라** — '
    '핵심 필드는 사용자에게 무엇이 어떻게 바뀌는지 보여주고 동의를 받은 뒤에만 반영한다.\n'
    '도구가 돌려준 사실만 근거로 답하고, 모르는 값은 지어내지 말고 사용자에게 물어라.\n'
    '\n'
    # ── 조사하는 방법 ────────────────────────────────────────────────────
    # 🐞 이 대목이 통째로 없었다. 아래 SKILL.md 는 **쓰기 안전 절차**(고치기 전에
    #    describe_fields · 202 면 확인)만 담고 있어서, "모르면 더 알아봐라" 라고
    #    시키는 문장이 한 줄도 없었다. 그래서 모델은 도구를 한 번 부르고 곧장 답했다.
    #    2026-08-11 운영에서 **한 홉에서 끝나는** 것이 확인됐다.
    '## 조사하는 방법\n'
    '한 번에 답하려 하지 마라. 도구를 **필요한 만큼 여러 번** 부를 수 있고, '
    '그러라고 있는 것이다.\n'
    'A) 답하기 전에 먼저 정한다 — 이 질문에 답하려면 **무엇을 알아야 하는가**. '
    '두 가지 이상이면 하나씩 확인한다.\n'
    'B) 도구 결과를 받으면 **답이 다 찼는지 스스로 확인한다.** 덜 찼으면 그 자리에서 '
    '도구를 다시 부른다. 모자란 채로 답하지 마라.\n'
    'C) 「왜」·「어디가 문제인가」·「무엇부터 하면 되는가」 처럼 판단을 묻는 질문은 '
    '집계 한 번으로 끝나지 않는다. 집계로 **후보를 좁힌 다음**, 그 후보를 '
    'get_project·get_project_history 로 실제로 열어 보고 답한다.\n'
    'D) 결과가 「잘렸습니다」 라고 나오면 조건을 좁혀(사업부·연도·상태) 다시 부른다. '
    '잘린 부분을 짐작해 채우지 마라.\n'
    'E) 답에 쓰는 숫자·이름은 **직접 부른 도구 결과에 있던 것**이어야 한다. '
    '근거가 없으면 그 문장을 쓰지 말고, 필요하면 도구를 한 번 더 불러 확보한다.\n'
    'F) 다만 이미 답할 수 있으면 더 부르지 마라. 확인이 끝났는데 도구를 더 부르는 것도 '
    '똑같이 나쁘다.\n'
    '\n---\n\n'
)

# 스킬 파일을 못 읽을 때 쓸 최소 규칙. **조용히 규칙 없이 돌지 않게** 하려는 것이다.
_FALLBACK_RULES = (
    '규칙:\n'
    '1) 과제를 고치기 전에 describe_fields 를 먼저 불러 필드 key 와 위험도를 확인한다.\n'
    '2) list_projects 로 과제를 특정하고(과제코드는 uuid 가 아니다), get_project 로 '
    '현재 값과 rowVersion 을 받는다. 후보가 둘 이상이면 사용자에게 고르게 한다.\n'
    '3) patch_project 가 202(needs_confirmation)를 주면 **아직 안 바뀐 것이다.** '
    'preview 의 before → after 를 그대로 보여주고 "이대로 반영할까요?" 라고 물은 뒤, '
    '동의를 받아야 confirm_change 를 부른다. 아니라고 하면 cancel_change 로 정리한다.\n'
    '4) 응답의 ignored 에 키가 있으면 그 키는 저장되지 않았다 — 사용자에게 알린다.\n'
    '5) 액션아이템·이슈 같은 배열은 통째로 교체된다. get_project 로 현재 값을 받아 '
    '전체를 보낸다.\n'
    '6) 참여인력·담당자·소유자는 AI 가 바꿀 수 없다(403). [참여인력 계정 점검] 화면에서 '
    '직접 지정하라고 안내한다.\n'
)


def _skill_body() -> str:
    """SKILL.md 본문(앞머리 제외). 못 읽으면 최소 규칙으로 떨어진다."""
    try:
        text = _SKILL_PATH.read_text(encoding='utf-8')
    except OSError:
        current_app.logger.warning('[DT-AI] 스킬 파일을 못 읽었다: %s', _SKILL_PATH)
        return _FALLBACK_RULES
    # `---` 로 둘러싸인 앞머리 제거. 없으면 통째로 쓴다.
    m = re.match(r'^---\s*\n.*?\n---\s*\n', text, re.S)
    body = text[m.end():] if m else text
    return body.strip() or _FALLBACK_RULES


def system_prompt() -> str:
    return _PREAMBLE + _skill_body()


def _chat(messages, *, tools):
    """
    한 홉. **사고를 켜서** 부르고, 서버가 그걸 모르면 한 번만 물러선다.

    왜 사고를 켜나
        에이전트는 "무엇을 더 알아야 하는가" 를 스스로 정해야 다음 홉이 나온다.
        사고가 꺼져 있으면 도구를 한 번 부르고 바로 답해 버린다 — 2026-08-11 운영에서
        실제로 **한 홉에서 끝나고** 있었다.

    왜 물러서나
        `chat_template_kwargs` 는 OpenAI 표준이 아니라 서버가 알아야 하는 값이다.
        모르는 서버는 400 을 낸다. 그때 그냥 실패하면 **AI 가 통째로 죽는다** —
        사고는 좋아지자고 켠 것이지 없으면 안 되는 것이 아니다.

        ⚠️ 토큰 한도 초과(`LLMContextError`)는 **물러설 일이 아니다.** 사고를 꺼도
           입력이 그대로라 똑같이 실패한다. 그건 그대로 올려 보내 "새 대화로" 라고
           안내하게 둔다.
        ⚠️ 한 번 거부당하면 프로세스가 사는 동안 기억한다. 서버가 모르는 옵션은
           다음 요청에서도 모른다 — 매번 두 번씩 부르면 응답이 두 배로 느려진다.
    """
    cfg = current_app.config
    effort = cfg.get('LLM_AGENT_REASONING')
    kwargs = {
        'tools': tools,
        'temperature': cfg.get('LLM_AGENT_TEMPERATURE'),
        'max_tokens': cfg.get('LLM_AGENT_MAX_TOKENS'),
    }
    if effort and not _reasoning_off.get('yes'):
        try:
            return chat(messages, reasoning_effort=effort, **kwargs)
        except LLMContextError:
            raise
        except LLMError as exc:
            if '실패했습니다(400)' not in str(exc):
                raise
            current_app.logger.warning(
                '[DT-AI] 서버가 사고 옵션을 거부했다 — 이제부터 끄고 부른다: %s', exc)
            _reasoning_off['yes'] = True
    return chat(messages, **kwargs)


def _assistant_tool_msg(res) -> dict:
    """파싱된 tool_calls 를 OpenAI assistant 메시지로 되돌린다(다음 턴에 되먹임)."""
    return {
        'role': 'assistant',
        'content': res.content or '',
        'tool_calls': [
            {
                'id': tc.get('id') or f'call_{i}',
                'type': 'function',
                'function': {
                    'name': tc.get('name') or '',
                    'arguments': json.dumps(tc.get('arguments') or {}, ensure_ascii=False),
                },
            }
            for i, tc in enumerate(res.tool_calls or [])
        ],
    }


def _tool_payload(content: dict) -> str:
    s = json.dumps(content, ensure_ascii=False)
    if len(s) <= _MAX_TOOL_RESULT_CHARS:
        return s
    return (s[:_MAX_TOOL_RESULT_CHARS]
            + f'\n…(결과가 길어 잘렸습니다. 필요하면 조건을 좁혀 다시 부르세요.)')


def _summary(name: str, args: dict, content: dict) -> str:
    """사람이 화면에서 읽을 한 줄. 값 자체가 아니라 **무슨 일이 있었는지**를 적는다."""
    if isinstance(content, dict):
        if content.get('status') == 'needs_confirmation':
            return f'{name} — 확인 대기(202)'
        if content.get('status') == 'conflict':
            return f'{name} — 충돌(409)'
        if content.get('status') == 'error':
            return f"{name} — 실패({content.get('httpStatus')})"
        if content.get('error'):
            return f'{name} — {str(content["error"])[:80]}'
        if 'total' in content:
            return f"{name} — {content.get('total')}건"
        if content.get('applied'):
            return f"{name} — {', '.join(map(str, content['applied']))} 반영"
    return name


def run_agent(auth: str, query: str, *, history=None, readonly: bool = False,
              max_hops: int = _MAX_HOPS) -> dict:
    """질문 → `{answer, trace, hops, model, toolCalls, truncated}`.

    auth      호출자의 `Authorization` 헤더. 도구가 **그대로** 써서 그 사람 권한으로 돈다.
    readonly  쓰기 도구를 아예 안 넘긴다(처음 켤 때 관찰용).
    """
    q = (query or '').strip()
    if not q:
        return {'answer': '', 'answerEmpty': True, 'trace': [], 'hops': 0,
                'toolCalls': 0, 'model': None, 'truncated': False}

    messages = [{'role': 'system', 'content': system_prompt()}]
    for turn in (history or [])[-8:]:      # 최근 8턴만 — 그 이상은 토큰만 먹는다
        role = turn.get('role')
        if role in ('user', 'assistant') and turn.get('content'):
            messages.append({'role': role, 'content': str(turn['content'])})
    messages.append({'role': 'user', 'content': q})

    tools = agent_tools.schemas(readonly=readonly)
    trace: list[dict] = []
    spent = 0
    truncated = False
    last = None

    for hop in range(1, max_hops + 1):
        # 마지막 홉은 도구를 안 넘긴다 = **이번엔 답을 내라**. 무한 조사를 끊는다.
        use_tools = hop < max_hops
        last = _chat(messages, tools=tools if use_tools else None)

        if not (use_tools and last.tool_calls):
            break

        messages.append(_assistant_tool_msg(last))
        for idx, tc in enumerate(last.tool_calls):
            name = tc.get('name')
            args = tc.get('arguments') or {}
            if idx >= _MAX_TOOL_CALLS_PER_HOP or spent >= _MAX_TOOL_CALLS_TOTAL:
                content = {'error': _BUDGET_MSG}
                truncated = True
            else:
                spent += 1
                content = agent_tools.run_tool(auth, name, args)
                trace.append({'hop': hop, 'tool': name, 'args': args,
                              'summary': _summary(name, args, content)})
            messages.append({
                'role': 'tool',
                'tool_call_id': tc.get('id') or f'call_{hop}_{idx}',
                'content': _tool_payload(content),
            })
    else:
        # for 가 break 없이 끝났다 = 마지막 홉까지 갔다. 위에서 도구를 안 줬으므로
        # last 는 최종 답변이다. 별도 처리는 필요 없고 표시만 남긴다.
        truncated = truncated or spent >= _MAX_TOOL_CALLS_TOTAL

    # 🐞 **답변이 비는 경우가 있다**(2026-08-01 스텁으로 실측).
    #    마지막 홉은 도구를 안 넘기는데, 그래도 모델이 tool_calls 만 뱉고 content 를
    #    비우면 루프는 거기서 끊기고 `answer` 가 빈 문자열이 된다. 그대로 두면 화면에
    #    **아무것도 안 나온다** — 사용자는 고장인지 답이 없는 건지 알 수가 없다.
    #    (finish_reason='length' 로 잘린 경우도 같은 모양이 된다.)
    answer = (last.content if last else '') or ''
    if not answer:
        answer = ('조사는 했지만 답변을 만들지 못했습니다. '
                  '아래 조사 내역을 참고해 다시 물어봐 주세요.'
                  if trace else
                  '답변을 받지 못했습니다. 다시 시도해 주세요.')

    return {
        'answer': answer,
        'answerEmpty': not ((last.content if last else '') or ''),
        'reasoning': getattr(last, 'reasoning', None),
        # 왜 거기서 멈췄는지. `length` 면 답이 잘린 것이라 **`LLM_AGENT_MAX_TOKENS`
        # 를 올려야 한다** — 홉이 모자란 것과 증상이 같아서 안 남기면 오진한다.
        'finishReason': getattr(last, 'finish_reason', None),
        'reasoningOn': bool(current_app.config.get('LLM_AGENT_REASONING'))
                       and not _reasoning_off.get('yes'),
        'trace': trace,
        'hops': len(set(t['hop'] for t in trace)) if trace else 0,
        'toolCalls': spent,
        'model': getattr(last, 'model', None),
        'truncated': truncated,
    }


__all__ = ['run_agent', 'system_prompt', 'LLMError']
