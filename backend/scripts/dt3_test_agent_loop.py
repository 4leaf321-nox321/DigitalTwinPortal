"""에이전트 루프가 **여러 홉을 도는가.** (2026-08-11)

왜 이 시험이 따로 있나
    운영에서 에이전트가 **한 홉에서 끝나고** 있었다. 루프 코드는 멀쩡했고, 막고 있던
    것은 그 주변이었다 — 사고(reasoning)가 꺼져 있었고, 온도를 안 넘겼고, 프롬프트에
    「모르면 더 알아봐라」 가 한 줄도 없었다.

    그 셋은 **눈에 안 보인다.** 고쳐 놔도 누가 `.env` 를 손대거나 프롬프트를 다듬다가
    조용히 되돌아갈 수 있고, 그러면 다시 한 홉짜리가 된다. 그래서 못 박는다.

무엇을 못 박나
    ① 홉이 실제로 이어진다 — 도구 결과를 받고 **또** 도구를 부를 수 있다
    ② 사고·온도를 실제로 실어 보낸다
    ③ 서버가 사고 옵션을 거부하면 **AI 가 죽지 않고** 물러선다. 그리고 기억한다
    ④ 토큰 한도 초과는 물러설 일이 아니다 — 그대로 올라간다
    ⑤ 프롬프트에 조사 지시가 들어 있다

⚠️ **LLM 도 REST API 도 안 부른다.** `chat` 과 `run_tool` 을 가짜로 바꿔 루프만 돌린다 —
   그래야 개발서버가 안 떠 있어도, 스텁이 없어도 이 시험이 돈다.

실행: python scripts\\dt3_test_agent_loop.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app                                            # noqa: E402
from app.modules.digital_twin_dashboard.ai import agent as A          # noqa: E402
from app.modules.digital_twin_dashboard.ai import agent_tools         # noqa: E402
from app.modules.digital_twin_dashboard.ai.llm import (               # noqa: E402
    ChatResult, LLMContextError, LLMError)

fails = []


def check(desc, ok, extra=''):
    print(f"  {'[OK]  ' if ok else '[FAIL]'} {desc}" + (f'   {extra}' if not ok and extra else ''))
    if not ok:
        fails.append(desc)


class Recorder:
    """`chat` 을 대신한다. 각본대로 답하고, 무엇을 실어 보냈는지 적어 둔다."""

    def __init__(self, script):
        self.script = list(script)
        self.calls = []

    def __call__(self, messages, **kw):
        self.calls.append(kw)
        step = self.script.pop(0) if self.script else None
        if isinstance(step, Exception):
            raise step
        if step is None:
            return ChatResult(content='(끝)', model='fake', finish_reason='stop')
        if isinstance(step, str):
            return ChatResult(content=step, model='fake', finish_reason='stop')
        # 도구 호출 각본
        return ChatResult(
            content='', model='fake', finish_reason='tool_calls',
            tool_calls=[{'id': f'c{len(self.calls)}', 'name': step[0], 'arguments': step[1]}])


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    orig_chat, orig_tool = A.chat, agent_tools.run_tool
    agent_tools.run_tool = lambda auth, name, args: {'ok': True, 'tool': name}

    try:
        # ── ① 홉이 이어지는가 ──────────────────────────────────────────
        print('── 홉이 이어지는가 ──')
        with app.app_context():
            A._reasoning_off.clear()
            rec = Recorder([
                ('list_projects', {'division': 'MX'}),
                ('get_project', {'uuid': 'u1'}),
                ('get_project_history', {'uuid': 'u1'}),
                '조사해 보니 이렇습니다.',
            ])
            A.chat = rec
            out = A.run_agent('Bearer x', 'MX 사업부에서 뭐가 문제야?')
            check('★ 도구를 받고 또 부른다 (한 홉에서 안 끝난다)',
                  out['toolCalls'] == 3, f"toolCalls={out['toolCalls']}")
            check('★ 홉이 여러 번 돈다', out['hops'] == 3, f"hops={out['hops']}")
            check('마지막 답이 답변으로 나온다',
                  out['answer'] == '조사해 보니 이렇습니다.', out['answer'])
            check('조사 내역이 남는다', len(out['trace']) == 3, str(len(out['trace'])))
            check('왜 멈췄는지 남긴다', out['finishReason'] == 'stop', str(out['finishReason']))

        # ── ② 사고·온도를 싣는가 ───────────────────────────────────────
        print('── 무엇을 실어 보내는가 ──')
        with app.app_context():
            A._reasoning_off.clear()
            rec = Recorder(['끝'])
            A.chat = rec
            A.run_agent('Bearer x', '안녕')
            kw = rec.calls[0]
            check('★ 사고를 켜서 부른다',
                  kw.get('reasoning_effort') == app.config['LLM_AGENT_REASONING'],
                  str(kw.get('reasoning_effort')))
            check('★ 온도를 못 박아 보낸다',
                  kw.get('temperature') == app.config['LLM_AGENT_TEMPERATURE'],
                  str(kw.get('temperature')))
            check('도구를 넘긴다', bool(kw.get('tools')), str(bool(kw.get('tools'))))

        # 사고를 꺼 두면 안 보낸다 (예전 동작을 남겨 둔다)
        with app.app_context():
            A._reasoning_off.clear()
            app.config['LLM_AGENT_REASONING'] = ''
            rec = Recorder(['끝'])
            A.chat = rec
            out = A.run_agent('Bearer x', '안녕')
            check('꺼 두면 사고 옵션을 안 보낸다',
                  rec.calls[0].get('reasoning_effort') is None, str(rec.calls[0]))
            check('켜졌는지 여부를 응답에 남긴다', out['reasoningOn'] is False, str(out))
            app.config['LLM_AGENT_REASONING'] = 'medium'

        # ── ③ 서버가 거부하면 물러서는가 ───────────────────────────────
        print('── 서버가 사고 옵션을 모를 때 ──')
        with app.app_context():
            A._reasoning_off.clear()
            rec = Recorder([
                LLMError('LLM 호출이 실패했습니다(400): unknown field chat_template_kwargs'),
                '사고 없이 답합니다.',
            ])
            A.chat = rec
            out = A.run_agent('Bearer x', '안녕')
            check('★ 400 이면 사고를 빼고 다시 불러 답을 낸다',
                  out['answer'] == '사고 없이 답합니다.', out['answer'])
            check('다시 부를 때는 사고를 안 싣는다',
                  rec.calls[1].get('reasoning_effort') is None, str(rec.calls[1]))
            check('★ 거부당한 것을 기억한다 (매번 두 번 부르지 않는다)',
                  A._reasoning_off.get('yes') is True, str(A._reasoning_off))

            rec2 = Recorder(['두 번째 질문'])
            A.chat = rec2
            A.run_agent('Bearer x', '또 물어봄')
            check('다음 질문부터는 처음부터 사고 없이 부른다',
                  len(rec2.calls) == 1 and rec2.calls[0].get('reasoning_effort') is None,
                  str(rec2.calls))

        # 400 이 아닌 실패는 물러서지 않는다
        with app.app_context():
            A._reasoning_off.clear()
            A.chat = Recorder([LLMError('LLM 호출이 실패했습니다(503): 서버 점검')])
            try:
                A.run_agent('Bearer x', '안녕')
                check('★ 400 이 아닌 실패는 삼키지 않는다', False, '예외가 안 났다')
            except LLMError as exc:
                check('★ 400 이 아닌 실패는 삼키지 않는다', '503' in str(exc), str(exc))

        # ── ④ 토큰 한도 초과는 물러설 일이 아니다 ──────────────────────
        with app.app_context():
            A._reasoning_off.clear()
            rec = Recorder([LLMContextError('대화가 모델의 토큰 한도를 넘었습니다.'), '안 불려야 함'])
            A.chat = rec
            try:
                A.run_agent('Bearer x', '안녕')
                check('★ 토큰 한도 초과는 그대로 올린다', False, '예외가 안 났다')
            except LLMContextError:
                check('★ 토큰 한도 초과는 그대로 올린다', True)
            check('한도 초과로 사고를 끄지 않는다', not A._reasoning_off.get('yes'),
                  str(A._reasoning_off))
            check('한도 초과면 다시 부르지 않는다', len(rec.calls) == 1, str(len(rec.calls)))

        # ── ⑤ 프롬프트에 조사 지시가 있는가 ────────────────────────────
        print('── 프롬프트 ──')
        with app.app_context():
            p = A.system_prompt()
            for phrase in ('조사하는 방법', '한 번에 답하려 하지 마라',
                           '여러 번', '다시 부른다', '후보를 좁힌'):
                check(f"프롬프트에 '{phrase}'", phrase in p)
            check('★ 쓰기 안전 절차도 그대로 있다 (덮어쓰지 않았다)',
                  'describe_fields' in p and 'confirm_change' in p)
    finally:
        A.chat, agent_tools.run_tool = orig_chat, orig_tool

    print()
    if fails:
        print(f'[FAIL] {len(fails)}건 실패')
        for f in fails:
            print(f'   - {f}')
        return 1
    print('[OK] 전부 통과')
    return 0


if __name__ == '__main__':
    sys.exit(main())
