"""OpenAI 호환 LLM 어댑터 — 운영은 GLM-5.2, 개발은 스텁.

참고 구현: ReportArchive `app/ai/llm.py`. **그쪽이 실제 GLM-5.2 툴콜을 성공시킨 코드**라
요청 바디·응답 파싱·오류 갈래를 그대로 따른다. 스트리밍·ollama·임베딩은 안 가져왔다
(이 프로젝트는 아직 안 쓴다). 필요해지면 그때 같은 파일에서 마저 가져온다.

⚠️ **`httpx` 가 아니라 `requests` 를 쓴다.** 참고 구현은 httpx 인데, 이 백엔드 venv 에는
   **httpx 가 없다**(Flask 스택뿐 · 2026-08-01 실측). 스텁 하나·어댑터 하나 때문에
   의존성을 늘리지 않는다 — `requests` 는 이미 있고, 여기서 쓰는 건 POST·타임아웃·
   상태코드뿐이라 바꿀 것이 없다.

이 파일은 **모델과만 얘기한다.** 도구가 무엇인지, 권한이 어떤지 모른다.
"""
from __future__ import annotations

import json as _json
from dataclasses import dataclass, field
from typing import Optional

import requests
from flask import current_app


class LLMError(RuntimeError):
    """LLM 호출 실패. 사용자에게 그대로 보여줄 수 있는 문장을 담는다."""


class LLMContextError(LLMError):
    """토큰 한도 초과. **같은 입력으로 재시도해도 똑같이 실패한다** — 재시도 금지."""


class LLMNotConfigured(LLMError):
    """`LLM_BASE_URL` 이 비어 있다. 기능만 꺼진 것이지 고장이 아니다."""


@dataclass
class ChatResult:
    content: str
    model: str
    reasoning: Optional[str] = None
    usage: Optional[dict] = None
    finish_reason: Optional[str] = None
    # [{id, name, arguments(dict)}] — 없으면 None. 루프가 이걸로 계속할지 정한다.
    tool_calls: Optional[list] = None
    raw: dict = field(default_factory=dict)


# 토큰 초과를 알아보는 단서. 서버마다 문장이 달라 넓게 잡는다.
_CONTEXT_OVERFLOW_HINTS = (
    'context length', 'context_length', 'maximum context',
    'too many tokens', 'reduce the length', 'exceeds the model',
)


def _is_context_overflow(detail: str) -> bool:
    low = (detail or '').lower()
    return any(h in low for h in _CONTEXT_OVERFLOW_HINTS)


def is_configured() -> bool:
    return bool(current_app.config.get('LLM_BASE_URL'))


def _parse_tool_calls(raw) -> Optional[list]:
    """OpenAI 호환 `message.tool_calls` → `[{id, name, arguments(dict)}]`.

    ⚠️ **`arguments` 가 JSON 문자열로 오는 서버와 객체로 오는 서버가 둘 다 있다.**
    한쪽만 가정하면 다른 쪽에서 첫 호출에 깨진다. 둘 다 받고, 깨진 JSON 은 `{}` 로
    떨어뜨린다 — 여기서 예외를 내면 모델이 오타 하나 낸 것으로 대화 전체가 죽는다.
    빈 인자는 도구 쪽에서 "필수 인자 없음" 오류로 돌아가 모델이 고쳐 부른다.
    """
    if not raw or not isinstance(raw, list):
        return None
    out = []
    for tc in raw:
        fn = (tc or {}).get('function') or {}
        args_raw = fn.get('arguments')
        if isinstance(args_raw, dict):
            args = args_raw
        else:
            try:
                args = _json.loads(args_raw) if args_raw else {}
            except (ValueError, TypeError):
                args = {}
        out.append({'id': tc.get('id'), 'name': fn.get('name'), 'arguments': args})
    return out or None


def _parse_response(data: dict, *, fallback_model: str) -> ChatResult:
    """관대하게 파싱한다. GLM 은 사고 과정을 `reasoning_content` 로 따로 준다."""
    choices = data.get('choices')
    if not choices:
        raise LLMError(f'LLM 응답에 choices 가 없습니다: {str(data)[:200]}')
    msg = (choices[0] or {}).get('message') or {}
    content = (msg.get('content') or '').strip()
    reasoning = msg.get('reasoning_content') or msg.get('reasoning')
    if isinstance(reasoning, str):
        reasoning = reasoning.strip() or None
    tool_calls = _parse_tool_calls(msg.get('tool_calls'))

    # 도구만 부르고 content 가 빈 턴은 **정상이다**(function-calling 턴).
    # 셋 다 없을 때만 오류로 본다.
    if not content and not reasoning and not tool_calls:
        raise LLMError('LLM 응답에 content·reasoning·tool_calls 가 모두 없습니다.')

    return ChatResult(
        content=content,
        reasoning=reasoning,
        model=data.get('model') or fallback_model,
        usage=data.get('usage'),
        finish_reason=(choices[0] or {}).get('finish_reason'),
        tool_calls=tool_calls,
        raw=data,
    )


def chat(
    messages: list,
    *,
    tools: Optional[list] = None,
    tool_choice: str = 'auto',
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    timeout: Optional[float] = None,
    reasoning_effort: Optional[str] = None,
) -> ChatResult:
    """한 번의 `/v1/chat/completions` 호출.

    messages    OpenAI 형식. `role: tool` 메시지도 그대로 실린다(루프가 조립한다)
    tools       함수 스키마 목록. 없으면 안 보낸다 = **도구 없이 답하라**는 뜻이라,
                루프의 마지막 홉이 이걸로 최종 답변을 강제한다
    max_tokens  안 주면 `LLM_MAX_TOKENS`(.env 로 조절). **호출부에 숫자를 박지 말 것** —
                박으면 설정을 바꿔도 그 경로만 안 따라와서, "올렸는데 여전히 잘린다" 가 된다
    """
    cfg = current_app.config
    base = (cfg.get('LLM_BASE_URL') or '').rstrip('/')
    if not base:
        raise LLMNotConfigured(
            'LLM 서버 주소(LLM_BASE_URL)가 설정되지 않았습니다. '
            '개발서버라면 scripts/llm_stub.py 를 띄우고 .env 에 주소를 넣으세요.')

    mdl = model or cfg.get('LLM_MODEL') or 'GLM-5-2'
    limit = int(max_tokens or cfg.get('LLM_MAX_TOKENS') or 2048)
    body: dict = {'model': mdl, 'messages': messages, 'max_tokens': limit}
    if temperature is not None:
        body['temperature'] = temperature
    if tools:
        body['tools'] = tools
        body['tool_choice'] = tool_choice
    # 호출부가 준 값이 우선한다 — **자리마다 필요한 정도가 다르다.** 에이전트는
    # 여러 홉을 계획해야 해서 사고가 필요하고, 폼 채우기는 한 번에 뽑아내는 일이라
    # 켜 봐야 느려지기만 한다. 안 주면 예전대로 `.env` 하나를 따른다.
    effort = reasoning_effort if reasoning_effort is not None else cfg.get('LLM_REASONING_EFFORT')
    if effort:
        # GLM reasoning — 서버 chat_template 으로 넘어간다(OpenAI 표준 필드가 아니다).
        body['chat_template_kwargs'] = {'reasoning_effort': effort}

    headers = {'Content-Type': 'application/json'}
    if cfg.get('LLM_API_KEY'):
        headers['Authorization'] = f"Bearer {cfg['LLM_API_KEY']}"

    try:
        resp = requests.post(
            f'{base}/chat/completions', json=body, headers=headers,
            timeout=timeout or cfg.get('LLM_TIMEOUT') or 120,
        )
    except requests.RequestException as exc:
        raise LLMError(f'LLM 서버에 닿지 못했습니다: {exc}') from exc

    if not resp.ok:
        try:
            detail = resp.text or ''
        except Exception:          # noqa: BLE001 — 본문을 못 읽어도 진행한다
            detail = ''
        # 토큰 초과는 **같은 입력으로 재시도해도 똑같이 실패한다.** 다른 실패와 갈라서
        # 호출부가 "새 대화로 다시" 라고 안내할 수 있게 한다.
        if resp.status_code == 400 and _is_context_overflow(detail):
            raise LLMContextError(
                '대화가 모델의 토큰 한도를 넘었습니다. 새 대화로 다시 물어보세요.')
        raise LLMError(
            f'LLM 호출이 실패했습니다({resp.status_code}): {detail[:300]}')

    try:
        data = resp.json()
    except ValueError as exc:
        raise LLMError(f'LLM 응답이 JSON 이 아닙니다: {(resp.text or "")[:200]}') from exc

    return _parse_response(data, fallback_model=mdl)
