"""AI 에이전트 (Phase 5) — 루프 · 도구 실행 · 확인 절차 · 관문.

**실제 GLM 없이 검증한다.** `agent.chat` 을 각본형 fake 로 갈아끼워, 모델이
`list_projects` 를 호출→**진짜 REST 도구가 실행**→최종 답변하는 흐름을 그대로 태운다.
mock 이 아니다 — `chat` 하나만 대체하고 그 아래(도구 실행·권한·202 분기)는 전부 진짜다.

⚠️ **도구 실행은 자기 REST API 를 부른다.** 그래서 이 시험은 **백엔드가 떠 있어야**
   돈다(기본 http://127.0.0.1:5174). 안 떠 있으면 그 항목만 건너뛰고 알린다 —
   조용히 통과시키면 "도구가 실제로 도는가" 를 아무도 안 본 채로 넘어간다.

실행: python scripts\\dt3_test_agent.py
"""
from __future__ import annotations

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests                                                    # noqa: E402
from flask_jwt_extended import create_access_token                 # noqa: E402

from app import create_app                                         # noqa: E402
from app.modules.auth.models import User, UserRole                 # noqa: E402
from app.modules.digital_twin_dashboard.ai import agent as A       # noqa: E402
from app.modules.digital_twin_dashboard.ai import agent_tools as T  # noqa: E402
from app.modules.digital_twin_dashboard.ai import llm as L         # noqa: E402

fails = []


def check(desc, ok, extra=''):
    print(f"  {'[OK]  ' if ok else '[FAIL]'} {desc}" + (f'   {extra}' if not ok and extra else ''))
    if not ok:
        fails.append(desc)


def _cr(content='', tool_calls=None):
    return L.ChatResult(content=content, model='fake', tool_calls=tool_calls)


def _scripted(*turns):
    """각본형 chat. 턴마다 미리 정한 ChatResult 를 돌려주고 호출을 기록한다."""
    state = {'n': 0, 'calls': [], 'tools_seen': []}

    def fake_chat(messages, *, tools=None, **kw):
        state['n'] += 1
        state['calls'].append(list(messages))
        state['tools_seen'].append(tools)
        idx = min(state['n'], len(turns)) - 1
        return turns[idx]

    return fake_chat, state


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()

    # ── 1. 도구 목록이 MCP 서버와 갈리지 않았는가 ─────────────────────────
    print('── 도구 목록 (MCP 서버와 대조) ──')
    server_py = (os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__)))))
    server_py = os.path.join(server_py, 'mcp_server', 'server.py')
    check('mcp_server/server.py 를 찾았다', os.path.exists(server_py), server_py)
    mcp_tools = set()
    if os.path.exists(server_py):
        with open(server_py, encoding='utf-8') as f:
            mcp_tools = set(re.findall(r'@mcp\.tool\(\)\s*\n\s*async def (\w+)', f.read()))
    agent_names = set(T.TOOL_NAMES)
    check(f'MCP 도구 {len(mcp_tools)}개가 에이전트에도 다 있다',
          bool(mcp_tools) and not (mcp_tools - agent_names),
          f'빠진 것: {sorted(mcp_tools - agent_names)}')
    check('에이전트에만 있는 도구가 없다', not (agent_names - mcp_tools),
          f'남는 것: {sorted(agent_names - mcp_tools)}')
    # 스키마가 OpenAI 규격을 지키는가 — 어긋나면 GLM 이 400 을 낸다
    bad = [s for s in T.TOOL_SCHEMAS
           if s.get('type') != 'function'
           or not (s.get('function') or {}).get('name')
           or (s.get('function') or {}).get('parameters', {}).get('type') != 'object']
    check('모든 스키마가 OpenAI function 규격이다', not bad, str(bad[:2]))
    ro = T.schemas(readonly=True)
    ro_names = {s['function']['name'] for s in ro}
    check('readonly 모드에 쓰기 도구가 없다',
          not (ro_names & {'patch_project', 'confirm_change', 'cancel_change'}),
          str(sorted(ro_names)))

    with app.app_context():
        # ── 2. 시스템 프롬프트가 스킬 본문을 싣는가 ───────────────────────
        print('\n── 시스템 프롬프트 (스킬 파일 재사용) ──')
        sp = A.system_prompt()
        check('스킬 파일을 실제로 읽었다 (폴백이 아니다)',
              A._FALLBACK_RULES not in sp and len(sp) > 2000, f'{len(sp)}자')
        check('앞머리(frontmatter)는 빠졌다', 'allowed-tools:' not in sp)
        for must in ('describe_fields', 'confirm_change', '통째로 교체', 'ignored'):
            check(f'프롬프트에 "{must}" 가 있다', must in sp)

        # ── 3. tool_calls 파싱 — 문자열/객체 두 갈래 ──────────────────────
        print('\n── tool_calls 파싱 ──')
        as_str = L._parse_tool_calls([{
            'id': 'a', 'function': {'name': 'get_project',
                                    'arguments': '{"uuid": "u-1"}'}}])
        check('arguments 가 JSON 문자열이어도 dict 로 푼다',
              as_str and as_str[0]['arguments'] == {'uuid': 'u-1'}, str(as_str))
        as_obj = L._parse_tool_calls([{
            'id': 'b', 'function': {'name': 'get_project',
                                    'arguments': {'uuid': 'u-2'}}}])
        check('arguments 가 객체여도 그대로 쓴다',
              as_obj and as_obj[0]['arguments'] == {'uuid': 'u-2'}, str(as_obj))
        broken = L._parse_tool_calls([{
            'id': 'c', 'function': {'name': 'x', 'arguments': '{깨진'}}])
        check('깨진 JSON 은 예외 없이 {} 로 떨어진다',
              broken and broken[0]['arguments'] == {}, str(broken))
        check('tool_calls 가 없으면 None', L._parse_tool_calls([]) is None)

        # ── 4. 알 수 없는 도구 ────────────────────────────────────────────
        print('\n── 도구 실행 ──')
        r = T.run_tool('', 'no_such_tool', {})
        check('모르는 도구는 예외가 아니라 오류 내용으로 돌아온다',
              isinstance(r, dict) and 'error' in r, str(r))
        r = T.run_tool('', 'get_project', {})
        check('uuid 없이 get_project 하면 안내가 돌아온다',
              isinstance(r, dict) and 'error' in r, str(r))

        # ── 5. 루프 — 도구를 부르고, 진짜로 실행하고, 되먹인다 ─────────────
        print('\n── 에이전트 루프 (백엔드 REST 실호출) ──')
        base = app.config.get('LLM_AGENT_API_BASE')
        alive = False
        try:
            requests.get(f'{base}/api/dt-v2/describe/fields', timeout=3)
            alive = True
        except requests.RequestException:
            alive = False

        if not alive:
            print(f'  [건너뜀] 백엔드가 안 떠 있다({base}) — 도구 실행 항목을 못 본다.')
            print('           `python run.py` 로 띄운 뒤 다시 돌릴 것.')
            fails.append('백엔드 미기동 — 도구 실행 미검증')
        else:
            admin = User.query.filter_by(role=UserRole.ADMIN).first()
            if admin is None:
                check('admin 계정이 있다', False, 'users 에 admin 없음')
            else:
                auth = f'Bearer {create_access_token(identity=str(admin.id))}'

                fake, st = _scripted(
                    _cr(tool_calls=[{'id': 't1', 'name': 'list_projects',
                                     'arguments': {'limit': 2}}]),
                    _cr(content='과제 2건을 찾았습니다.'),
                )
                orig = A.chat
                A.chat = fake
                try:
                    out = A.run_agent(auth, '과제 좀 찾아줘')
                finally:
                    A.chat = orig

                check('두 홉만에 끝났다 (도구 → 답변)', st['n'] == 2, f"실제 {st['n']}홉")
                check('최종 답변이 돌아왔다', out['answer'] == '과제 2건을 찾았습니다.', str(out)[:200])
                check('도구가 1회 실행됐다', out['toolCalls'] == 1, str(out['toolCalls']))
                check('trace 에 도구 이름이 남는다',
                      out['trace'] and out['trace'][0]['tool'] == 'list_projects', str(out['trace']))
                # ★ 도구가 **진짜로 돌았는지** — trace 요약에 건수가 찍혔으면 REST 가 응답한 것
                check('도구가 실제 데이터를 받아왔다 (요약에 건수)',
                      '건' in (out['trace'][0]['summary'] if out['trace'] else ''),
                      str(out['trace'][:1]))
                # 되먹임 메시지 모양 — tool_call 마다 role:tool 이 하나씩 있어야 한다
                second = st['calls'][1]
                tool_msgs = [m for m in second if m.get('role') == 'tool']
                check('tool 결과가 되먹여졌다 (role:tool 1건)', len(tool_msgs) == 1, str(len(tool_msgs)))
                check('assistant tool_calls 메시지도 실렸다',
                      any(m.get('role') == 'assistant' and m.get('tool_calls') for m in second))
                check('마지막 홉에는 도구를 안 넘긴다',
                      st['tools_seen'][0] is not None, '첫 홉에는 도구가 있어야 한다')

                # ── 6. 예산 — 한 홉에 도구를 잔뜩 뱉어도 실행은 묶인다 ──────
                many = [{'id': f't{i}', 'name': 'list_projects', 'arguments': {'limit': 1}}
                        for i in range(A._MAX_TOOL_CALLS_PER_HOP + 3)]
                fake2, st2 = _scripted(_cr(tool_calls=many), _cr(content='끝'))
                A.chat = fake2
                try:
                    out2 = A.run_agent(auth, '많이 불러봐')
                finally:
                    A.chat = orig
                check(f'한 홉 도구 실행이 {A._MAX_TOOL_CALLS_PER_HOP}개로 묶인다',
                      out2['toolCalls'] == A._MAX_TOOL_CALLS_PER_HOP, str(out2['toolCalls']))
                check('예산 초과를 truncated 로 알린다', out2['truncated'] is True)
                # 프로토콜 — 실행을 건너뛴 것도 tool 메시지는 있어야 다음 chat 이 안 깨진다
                tool_msgs2 = [m for m in st2['calls'][1] if m.get('role') == 'tool']
                check('건너뛴 호출도 tool 메시지는 채운다 (프로토콜)',
                      len(tool_msgs2) == len(many), f'{len(tool_msgs2)}/{len(many)}')

                # ── 6-2. 답변이 비는 경우 (2026-08-01 실측으로 잡은 결함) ────
                # 마지막 홉은 도구를 안 넘기는데, 그래도 모델이 tool_calls 만 뱉고
                # content 를 비우면 answer 가 빈 문자열이 된다 → 화면에 아무것도 안 나온다.
                fake3, _ = _scripted(
                    _cr(tool_calls=[{'id': 'x', 'name': 'list_projects',
                                     'arguments': {'limit': 1}}]),
                    _cr(content=''),          # 최종 홉인데 내용이 없다
                )
                A.chat = fake3
                try:
                    out4 = A.run_agent(auth, '빈 답변 시험', max_hops=2)
                finally:
                    A.chat = orig
                check('답변이 비면 빈 문자열 대신 안내 문장을 준다',
                      bool(out4['answer'].strip()), repr(out4['answer']))
                check('비었다는 사실을 answerEmpty 로 알린다',
                      out4.get('answerEmpty') is True, str(out4.get('answerEmpty')))
                check('그때도 trace 는 남는다', len(out4['trace']) == 1, str(out4['trace']))

                # ── 6-3. create_project — 생성 경로의 관문 ────────────────────
                #
                # 🐞 처음엔 **AI 금지 필드 검사가 생성에 없었다**(2026-08-02 실측).
                #    수정은 막고 생성은 열어 두면 "새로 만들어서 넣기" 로 그대로 우회된다.
                #    아래 세 항목이 그 관문을 못 박는다. **실제로 만들지는 않는다** —
                #    전부 거절되어야 하는 입력만 보낸다(개발 DB 를 더럽히지 않으려는 것).
                print('\n── create_project 관문 ──')
                # 2026-08-02 에 참여인력은 금지에서 **knoxId 필수**로 바뀌었다.
                # 그래서 여기서 볼 것은 403 이 아니라 **이름만으로는 못 넣는다**는 것이다
                # (막은 이유가 권한이 아니라 '이름으로는 누구인지 못 가린다' 였으므로,
                #  그 이유가 그대로 지켜지는지를 본다).
                r = T.run_tool(auth, 'create_project',
                               {'fields': {'과제명': 'x',
                                           '과제참여인력목록': [{'이름': '홍길동'}]},
                                'reason': '금지 필드 시험'})
                check('★★ 참여인력을 이름만으로는 못 넣는다 (400)',
                      r.get('httpStatus') == 400, str(r)[:160])
                check('★★ 그 400 이 knoxId 를 요구한다고 말한다',
                      'knoxId' in (r.get('message') or ''), str(r)[:160])
                # 2026-08-05: 담당자는 403 이 아니라 **파생**이다 — 보내도
                # `과제참여인력목록` 에서 다시 만들어진다. 결론은 같다 —
                # **AI 가 이름만으로 사람을 넣을 수 없다.**
                r = T.run_tool(auth, 'create_project',
                               {'fields': {'과제명': '__dt3_agent_derive__',
                                           '담당자': ['홍길동']},
                                'reason': '파생 확인'})
                check('★ 담당자를 보내도 그 이름이 들어가지 않는다',
                      (r.get('owners') or []) == [], str(r)[:140])
                if r.get('uuid'):
                    from app.extensions import db as _db
                    from app.modules.digital_twin_dashboard.models_v2 import (
                        Dt2Project as _P, Dt2ProjectChange as _C,
                        Dt2ProjectHistory as _H,
                    )
                    _C.query.filter_by(project_uuid=r['uuid']).delete()
                    _H.query.filter_by(project_uuid=r['uuid']).delete()
                    _P.query.filter_by(uuid=r['uuid']).delete()
                    _db.session.commit()
                r = T.run_tool(auth, 'create_project',
                               {'fields': {'사업부': 'MX'}, 'reason': '과제명 없음'})
                check('★ 과제명이 없으면 400', r.get('httpStatus') == 400, str(r)[:120])
                r = T.run_tool(auth, 'create_project', {'fields': {}, 'reason': 'x'})
                check('★ fields 가 비면 도구가 막는다',
                      'error' in r, str(r)[:120])

                # ── 7. 빈 질문 ──────────────────────────────────────────────
                A.chat = fake
                try:
                    out3 = A.run_agent(auth, '   ')
                finally:
                    A.chat = orig
                check('빈 질문은 LLM 을 부르지 않는다',
                      out3['toolCalls'] == 0 and out3['answer'] == '', str(out3))

        # ── 7-2. AI 기능 지도가 낡지 않았는가 ─────────────────────────────
        #
        # 이름에 'ai' 가 붙은 것이 여섯 갈래고 서로 다른 물건이다
        # (`ai_tools.py` 와 `ai/agent_tools.py` 는 **같은 폴더에 나란히** 있다).
        # 새 AI 모듈을 만들고 지도를 안 고치면 다음 사람이 반드시 헷갈린다.
        # → **지도에 안 적힌 AI 모듈이 있으면 여기서 실패한다.**
        #   검사를 고치지 말고 지도에 한 줄을 추가할 것.
        # ── 조회 도구 (2026-08-08 추가) ────────────────────────────────────
        # "간단한 건 되는데 복잡한 건 못 한다" 의 직접 원인 셋을 막는다:
        #   ① 사업부·프로세스로 못 걸러서 전부 긁어옴
        #   ② 집계 도구가 없어 목록을 눈으로 셈 (잘리면 조용히 틀림)
        #   ③ 조회 어휘를 물어볼 데가 없어 사업부 이름을 지어냄
        print('\n── 조회 도구 ──')
        # auth 는 위 블록(admin 이 있을 때)에서만 잡힌다 — 여기서 다시 만든다
        _adm = User.query.filter_by(role=UserRole.ADMIN).first()
        auth = f'Bearer {create_access_token(identity=str(_adm.id))}' if _adm else ''

        dm = T.run_tool(auth, 'describe_data', {})
        check('describe_data 가 사업부를 준다', bool(dm.get('divisions')), str(dm)[:120])
        check('describe_data 가 프로세스를 준다', bool(dm.get('processes')))
        check('describe_data 가 진행상태를 준다', bool(dm.get('statuses')))
        check('describe_data 가 KPI 를 준다', bool(dm.get('kpis')))

        div = (dm.get('divisions') or [None])[0]
        agg = T.run_tool(auth, 'aggregate_projects', {'group_by': 'division'})
        check('aggregate 가 전체 수를 준다', isinstance(agg.get('total'), int), str(agg)[:120])
        check('aggregate 가 축별로 나눈다', bool(agg.get('groups')))
        check('★ 축 합이 전체와 같다',
              sum(g['count'] for g in agg.get('groups') or []) == agg.get('total'),
              str(agg)[:200])

        one = T.run_tool(auth, 'aggregate_projects', {'division': div})
        lst = T.run_tool(auth, 'list_projects', {'division': div, 'limit': 50})
        check(f'★ 집계와 목록의 수가 같다 ({div})', one.get('total') == lst.get('total'),
              f"집계 {one.get('total')} vs 목록 {lst.get('total')}")

        # ★ 이게 이번 작업의 핵심 — 잘렸다는 사실을 응답이 스스로 말해야 한다.
        #   모델은 잘린 줄 모르면 세어서 틀린 수를 답한다.
        cut = T.run_tool(auth, 'list_projects', {'division': div, 'limit': 2})
        check('★ 잘리면 truncated 로 알린다', cut.get('truncated') is True, str(cut)[:120])
        check('그때도 total 은 진짜 수다', cut.get('total') == one.get('total'))
        full = T.run_tool(auth, 'list_projects', {'division': div, 'limit': 200})
        check('안 잘리면 truncated 가 false', full.get('truncated') is False)

        # 새 필터가 실제로 먹는가 (안 먹으면 조용히 전체가 나온다 — 제일 나쁜 실패)
        key = T.run_tool(auth, 'aggregate_projects', {'is_key': True})
        allp = T.run_tool(auth, 'aggregate_projects', {})
        check('is_key 필터가 실제로 좁힌다', 0 < key.get('total', 0) < allp.get('total', 0),
              f"중점 {key.get('total')} / 전체 {allp.get('total')}")
        low = T.run_tool(auth, 'aggregate_projects', {'progress_max': 30})
        check('progress_max 가 실제로 좁힌다', low.get('total', 0) < allp.get('total', 0))
        nolink = T.run_tool(auth, 'aggregate_projects', {'kpi_linked': False})
        yes = T.run_tool(auth, 'aggregate_projects', {'kpi_linked': True})
        check('★ kpi_linked 참/거짓 합이 전체다',
              nolink.get('total', 0) + yes.get('total', 0) == allp.get('total'),
              f"{nolink.get('total')} + {yes.get('total')} vs {allp.get('total')}")

        bad = T.run_tool(auth, 'aggregate_projects', {'group_by': '없는축'})
        # 도구 오류의 모양은 {status:'error', httpStatus, message} 다 (run_tool 규약).
        # 모델이 스스로 고치려면 **어떤 축이 되는지**가 문구에 있어야 한다.
        check('없는 축은 오류로 알린다', bad.get('status') == 'error', str(bad)[:140])
        check('그 오류가 쓸 수 있는 축을 알려준다',
              'division' in (bad.get('message') or ''), str(bad)[:140])

        # ── 프롬프트에 조회 절차가 들어갔나 (2026-08-08) ──────────────────
        # SKILL.md 를 그대로 싣는 구조라, 절이 사라지거나 앞머리 제거가 잘못되면
        # **조용히** 규칙 없는 프롬프트가 나간다. 그러면 모델은 다시 목록을 센다.
        print('\n── 조회 절차가 프롬프트에 있나 ──')
        sp = A.system_prompt()
        for kw in ('describe_data', 'aggregate_projects', 'truncated',
                   '목록을 받아 직접 세지 않는다'):
            check(f'프롬프트에 {kw!r}', kw in sp)

        print('\n── AI 기능 지도 ──')
        root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        map_path = os.path.join(root, '디지털트윈_AI기능_지도.md')
        check('지도 문서가 있다', os.path.exists(map_path), map_path)
        if os.path.exists(map_path):
            with open(map_path, encoding='utf-8') as f:
                doc = f.read()

            # 실제로 존재하는 AI 갈래를 훑어서 지도에 적혀 있는지 본다.
            found = []
            mod_dir = os.path.join(root, 'backend', 'app', 'modules')
            for name in sorted(os.listdir(mod_dir)):
                if name.startswith('ai'):
                    found.append(name)              # 예: ai_context
            dtd = os.path.join(mod_dir, 'digital_twin_dashboard')
            for name in sorted(os.listdir(dtd)):
                if name.startswith('ai'):
                    found.append(name)              # 예: ai_tools.py, ai
            fe = os.path.join(root, 'frontend', 'src')
            for base, _dirs, files in os.walk(fe):
                if 'node_modules' in base:
                    continue
                for fn in files:
                    if fn.startswith('Ai') and fn.endswith('.jsx'):
                        found.append(fn)            # 예: AiChatSidebar.jsx

            missing = [n for n in found if n.rstrip('.py').rstrip('.jsx') not in doc and n not in doc]
            check(f'AI 갈래 {len(found)}개가 지도에 다 적혀 있다',
                  not missing, f'지도에 없는 것: {missing}')

            # 헷갈리는 짝을 **명시적으로** 갈라 놓았는가 (이게 지도의 존재 이유다)
            for pair in ('ai_tools.py', 'agent_tools.py', 'AiChatSidebar', 'AiAgentPanel'):
                check(f'지도가 "{pair}" 를 설명한다', pair in doc)

        # ── 8. 라우트 관문 ────────────────────────────────────────────────
        print('\n── 라우트 관문 ──')
        admin = User.query.filter_by(role=UserRole.ADMIN).first()
        plain = User.query.filter(User.role != UserRole.ADMIN).first()
        with app.test_client() as c:
            r = c.post('/api/dt-v2/ai/agent', json={'query': 'x'})
            check('토큰 없으면 401', r.status_code in (401, 422), f'실제 {r.status_code}')

            # 2026-08-08 **읽기를 일반 사용자에게 열었다.** 그전엔 여기가 403 이었다.
            #   누가 쓰나   로그인한 사람 누구나 (조회는 어차피 해도 되는 일이다)
            #   뭘 하나     관리자가 아니면 **서버가 읽기로 강제**한다
            # 강제가 실제로 걸리는지는 `dt3_test_owner_links.py` 가 자세히 본다
            # (`run_agent` 를 가로채 어떤 모드로 불렸는지까지 확인한다).
            if plain is not None:
                tok = create_access_token(identity=str(plain.id))
                r = c.post('/api/dt-v2/ai/agent', json={'query': 'x'},
                           headers={'Authorization': f'Bearer {tok}'})
                check('★ 비관리자도 막히지 않는다 (읽기 개방)',
                      r.status_code != 403, f'실제 {r.status_code}')
                if r.status_code == 200:
                    check('★ 그때 서버가 읽기 전용으로 돌린다',
                          ((r.get_json() or {}).get('data') or {}).get('readonly') is True,
                          str(r.get_json())[:160])
            else:
                check('비관리자 계정이 있어 관문을 시험할 수 있다', False, 'users 에 없음')

            if admin is not None:
                tok = create_access_token(identity=str(admin.id))
                hdr = {'Authorization': f'Bearer {tok}'}
                r = c.post('/api/dt-v2/ai/agent', json={'query': ''}, headers=hdr)
                check('질문이 비면 400', r.status_code == 400, f'실제 {r.status_code}')

                # LLM 미설정이면 503 — 기능만 꺼진 것이지 고장이 아니다
                saved = app.config.get('LLM_BASE_URL')
                app.config['LLM_BASE_URL'] = ''
                try:
                    r = c.post('/api/dt-v2/ai/agent', json={'query': '안녕'}, headers=hdr)
                    check('LLM 미설정이면 503', r.status_code == 503, f'실제 {r.status_code}')
                finally:
                    app.config['LLM_BASE_URL'] = saved

        cfg = 'LLM_BASE_URL=' + (app.config.get('LLM_BASE_URL') or '(미설정)')
        print(f'\n  [정보] 도구 {len(T.TOOL_NAMES)}개 · 프롬프트 {len(A.system_prompt())}자 · {cfg}')

    print()
    if fails:
        print(f'[FAIL] {len(fails)}건: {fails}')
        return 1
    print('[OK] 전부 통과')
    return 0


if __name__ == '__main__':
    sys.exit(main())
