"""성숙도 MCP 도구가 **실제로 있는 API 를 부르는지** 검사한다. (2026-08-30)

왜 이 검사가 필요한가
    MCP 서버는 얇은 프록시라 경로를 글자로 적는다. 백엔드에서 라우트 하나를 바꾸거나
    지우면 도구는 **조용히 404 를 받고**, AI 는 "그런 자료가 없다" 는 잘못된 전제로
    움직인다. 사용자에게는 그럴듯한 답이 나가므로 사람 눈으로는 못 잡는다.

    그래서 도구를 하나씩 실제로 불러 보고(가짜 전송기로 가로채) **그 경로가 백엔드
    URL 표에 그 메서드로 있는지**를 대본다. 서버를 띄우지 않아도 돈다.

    이 검사가 깨지면 **도구를 고치라는 뜻**이지 검사를 고치라는 뜻이 아니다.

여기서 함께 지키는 것
    · 성숙도 도구는 전부 `maturity_` 로 시작한다 — 대시보드 도구와 목록에서 갈려야 한다
    · 성숙도 도구는 **성숙도 접두사만** 쓴다 — /api/dt-v2 로 새면 남의 모듈을 건드린다
    · 근거(note) 없는 평가는 **서버에 가기 전에** 막힌다

실행: python scripts\\dt3_test_maturity_mcp.py
"""
from __future__ import annotations

import asyncio
import os
import sys
import types

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(os.path.dirname(ROOT), 'mcp_server'))

# ⚠️ mcp 꾸러미는 MCP 서버의 venv 에만 있다(별도 venv 인 이유는 README 참고).
#    이 검사는 백엔드 venv 에서 도므로, 타입 힌트로만 쓰이는 Context 를 껍데기로 세운다.
if 'mcp' not in sys.modules:
    pkg = types.ModuleType('mcp')
    server_mod = types.ModuleType('mcp.server')
    fastmcp = types.ModuleType('mcp.server.fastmcp')
    fastmcp.Context = object
    fastmcp.FastMCP = object
    sys.modules.update({'mcp': pkg, 'mcp.server': server_mod, 'mcp.server.fastmcp': fastmcp})

import maturity_tools                                               # noqa: E402
from app import create_app                                          # noqa: E402

fails = []
oks = 0


def check(cond, msg):
    global oks
    if cond:
        oks += 1
        print(f'[OK] {msg}')
    else:
        fails.append(msg)
        print(f'[FAIL] {msg}')


# ── 도구를 모으는 가짜 서버와, 부른 곳을 적는 가짜 전송기 ────────────────────
class FakeMcp:
    def __init__(self):
        self.tools = {}

    def tool(self):
        def deco(fn):
            self.tools[fn.__name__] = fn
            return fn
        return deco


calls = []


async def recorder(ctx, method, path, *, params=None, json_body=None, prefix=''):
    calls.append({'method': method, 'path': path, 'prefix': prefix,
                  'params': params, 'json': json_body})
    return {'ok': True}


fake = FakeMcp()
maturity_tools.register(fake, recorder)

# ── ① 이름이 갈리는가 ────────────────────────────────────────────────────────
check(len(fake.tools) >= 10, f'성숙도 도구가 모였다 ({len(fake.tools)}개)')
bad_name = [n for n in fake.tools if not n.startswith('maturity_')]
check(not bad_name, f'전부 maturity_ 로 시작한다 (어긋난 것: {bad_name})')

# ── ② 도구를 하나씩 불러 경로를 적는다 ──────────────────────────────────────
SAMPLE = {
    'maturity_describe': {},
    'maturity_list_divisions': {},
    'maturity_board': {'division_id': 17},
    'maturity_list_items': {'division_id': 17, 'kind': 'subject'},
    'maturity_get_pair': {'pair_id': 12},
    'maturity_changes': {'division_id': 17},
    'maturity_add_item': {'division_id': 17, 'kind': 'agent', 'name': '낙하 해석'},
    'maturity_update_item': {'kind': 'subject', 'item_id': 3, 'fields': {'detail': 'x'}},
    'maturity_link': {'subject_id': 1, 'agent_id': 2},
    'maturity_assess': {'pair_id': 12, 'axis': 'automation', 'note': '근거', 'rung': 'pre'},
    'maturity_bulk': {'division_id': 17, 'kind': 'subject', 'text': 'a\tb'},
    'maturity_bulk_kinds': {'division_id': 17},
    'maturity_name_catalog': {'kind': 'tool', 'division_id': 17},
    'maturity_name_audit': {'kind': 'family', 'division_id': 17},
    'maturity_pending': {'division_id': 17},
    'maturity_list_records': {'kind': 'review', 'division_id': 17, 'year': 2026},
    'maturity_record_stats': {'kind': 'thread_case', 'division_id': 17},
    'maturity_add_record': {'kind': 'review', 'division_id': 17, 'fields': {'month': '2026-03'}},
    'maturity_update_record': {'kind': 'thread_case', 'record_id': 4, 'fields': {'note': 'x'}},
    'maturity_promote_review': {'division_id': 17, 'agent_name': 'a', 'item': 'b'},
    'maturity_add_system': {'name': 'PLM', 'kind': 'plm'},
    'maturity_update_system': {'system_id': 3, 'fields': {'status': 'active'}},
    'maturity_add_org': {'division_id': 17, 'name': '협력사'},
    'maturity_set_defect': {'pair_id': 12, 'axis': 'modeling', 'name': '크랙', 'col': 'test'},
    'maturity_reached': {'pair_id': 12, 'axis': 'automation', 'rung': 'pre', 'month': '2025-03'},
    'maturity_add_segment': {'division_id': 17, 'segment_def_id': 5},
    'maturity_threads': {},
    'maturity_thread_dicts': {'division_id': 17},
}
missing = [n for n in fake.tools if n not in SAMPLE]
check(not missing, f'검사에 빠진 도구가 없다 (빠진 것: {missing})')


async def run_all():
    for name, fn in fake.tools.items():
        if name in SAMPLE:
            await fn(None, **SAMPLE[name])


asyncio.run(run_all())
# maturity_thread_dicts 는 사전 둘을 읽어 한 번에 준다 — 부름이 하나 더 는다
check(len(calls) == len(SAMPLE) + 1, f'도구마다 서버를 불렀다 ({len(calls)}번)')

# 모듈 표 — 목록에서 첫 줄만 보이는 클라이언트에서도 갈리게
unmarked = [n for n, f in fake.tools.items() if '[성숙도]' not in (f.__doc__ or '')]
check(not unmarked, f'모든 도구 설명이 [성숙도] 로 시작한다 (빠진 것: {unmarked})')

# ── ③ 남의 모듈로 새지 않는가 ───────────────────────────────────────────────
strayed = sorted({c['prefix'] for c in calls} - {maturity_tools.MATURITY_PREFIX})
check(not strayed, f'성숙도 접두사만 쓴다 (샌 것: {strayed})')

# ── ④ 그 경로가 백엔드에 실제로 있는가 ──────────────────────────────────────
app = create_app()
adapter = app.url_map.bind('localhost')
for c in calls:
    full = c['prefix'] + c['path']
    try:
        adapter.match(full, method=c['method'])
        check(True, f"{c['method']} {full}")
    except Exception as e:                                    # 404 · 405 둘 다 잡는다
        check(False, f"{c['method']} {full} — 백엔드에 없다 ({type(e).__name__})")

# ── ⑤ 근거 없는 평가는 서버에 가기 전에 막힌다 ──────────────────────────────
calls.clear()
out = asyncio.run(fake.tools['maturity_assess'](None, pair_id=12, axis='automation', note='  '))
check(not calls, '근거가 비면 서버를 부르지 않는다')
check(isinstance(out, dict) and out.get('status') == 'error' and '근거' in out.get('message', ''),
      f'근거가 왜 필요한지 말해 준다: {out.get("message", "")[:40]}')

# ── ⑥ 갈래를 잘못 주면 짚어 준다 ────────────────────────────────────────────
calls.clear()
out2 = asyncio.run(fake.tools['maturity_list_items'](None, division_id=17, kind='nope'))
check(not calls and isinstance(out2, dict) and out2.get('status') == 'error',
      'kind 가 subject·agent 가 아니면 부르기 전에 막는다')

print()
print(f'{oks} [OK] / {len(fails)} FAIL')
if fails:
    for f in fails:
        print('  -', f)
sys.exit(1 if fails else 0)
