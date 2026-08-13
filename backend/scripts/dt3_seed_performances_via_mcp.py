"""
2026년도 과제 100건에 성과를 만들어 연결한다 — **MCP 서버를 통해서.** (2026-08-03)

백엔드 REST 를 직접 부르지 않는다. `localhost:3003/mcp` 의 JSON-RPC 로 **실제 MCP
서버의 도구**(create_performance · link_performances · confirm_change)를 부른다.
도구를 사람이 한 번씩 부르는 것과 서버가 보는 것이 완전히 같다 — 다만 왕복을
한 프로세스에서 돌 뿐이다. 과제 1건당 3콜이라 100건이면 300회다.

절차 (과제 1건당)
    1. create_performance   즉시 생성 (202 없음)
    2. link_performances    → 202 needs_confirmation + proposalId
    3. confirm_change       → 반영

`affectedProjects` 가 비어 있지 않으면 **멈춘다** — 새로 만든 성과라 비어 있어야
정상이고, 비어 있지 않다는 건 남의 과제 기여도까지 흔든다는 뜻이다.

실행:  venv/Scripts/python.exe scripts/dt3_seed_performances_via_mcp.py [--dry-run]
"""
import json
import os
import re
import sys

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                    # noqa: E402

from app import create_app                                            # noqa: E402
from app.modules.auth.models import User                              # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project    # noqa: E402

from dt3_perf_2026_data import PERFS                                  # noqa: E402

MCP_URL = os.environ.get('MCP_URL', 'http://127.0.0.1:3003/mcp')
DRY = '--dry-run' in sys.argv


class Mcp:
    """MCP streamable-http 클라이언트. 응답은 SSE 한 줄로 온다."""

    def __init__(self, token):
        self.c = requests.Session()
        self.h = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
        }
        self.n = 0
        r = self._post({'jsonrpc': '2.0', 'id': 0, 'method': 'initialize',
                        'params': {'protocolVersion': '2024-11-05',
                                   'capabilities': {},
                                   'clientInfo': {'name': 'seed', 'version': '1'}}},
                       raw=True)
        self.h['mcp-session-id'] = r.headers['mcp-session-id']
        self._post({'jsonrpc': '2.0', 'method': 'notifications/initialized'},
                   raw=True)

    def _post(self, body, raw=False):
        r = self.c.post(MCP_URL, headers=self.h, json=body, timeout=120)
        if raw:
            return r
        # ⚠️ SSE 응답에는 charset 이 없어 requests 가 ISO-8859-1 로 추측한다.
        #    보내는 쪽(json=)은 UTF-8 이라 멀쩡한데 **읽는 쪽만 깨진다** —
        #    uuid 같은 ASCII 만 볼 때는 안 드러나서 놓치기 쉽다.
        r.encoding = 'utf-8'
        # SSE: "event: message\ndata: {...}"
        m = re.search(r'^data: (.+)$', r.text, re.M)
        if not m:
            raise RuntimeError(f'MCP 응답을 읽을 수 없다: {r.status_code} {r.text[:300]}')
        return json.loads(m.group(1))

    def call(self, tool, args):
        self.n += 1
        out = self._post({'jsonrpc': '2.0', 'id': self.n, 'method': 'tools/call',
                          'params': {'name': tool, 'arguments': args}})
        if 'error' in out:
            raise RuntimeError(f'{tool}: {out["error"]}')
        res = out['result']
        if res.get('isError'):
            raise RuntimeError(f'{tool}: {res.get("content")}')
        # 구조화 출력이 있으면 그것을, 없으면 텍스트를 JSON 으로 읽는다
        if 'structuredContent' in res:
            sc = res['structuredContent']
            return sc.get('result', sc)
        txt = ''.join(p.get('text', '') for p in res.get('content', []))
        return json.loads(txt) if txt.strip().startswith(('{', '[')) else txt


def main():
    app = create_app()
    with app.app_context():
        admin = User.query.filter_by(email='yjtwin.park@samsung.com').first()
        token = create_access_token(identity=str(admin.id))
        # 사업부도 같이 읽는다 — 성과에는 사업부 컬럼이 없어서 `성과항목` 앞에
        # `[MX] ` 처럼 접두어로 넣어야 화면이 사업부를 가른다. 손으로 적으면
        # 과제와 어긋나므로 **연결할 과제의 사업부를 그대로 따른다.**
        code_to_uuid, code_to_div = {}, {}
        for p in Dt2Project.query.filter(
                Dt2Project.year == 2026, Dt2Project.is_deleted.is_(False)).all():
            code_to_uuid[p.code] = p.uuid
            code_to_div[p.code] = p.division

    missing = [p['code'] for p in PERFS if p['code'] not in code_to_uuid]
    if missing:
        print(f'과제를 찾을 수 없다: {missing[:10]}')
        return 1

    # **과제별로 묶는다.** 한 과제에 성과가 여러 건일 수 있는데(비용절감이 두 번째로
    # 붙는다), `link_performances` 는 **통째 교체**라 한 건씩 보내면 앞엣것이 지워진다.
    # 그래서 그 과제의 성과를 전부 만든 뒤 **연결은 한 번에** 보낸다.
    groups = {}
    for spec in PERFS:
        groups.setdefault(spec['code'], []).append(spec)

    print(f'대상 성과 {len(PERFS)}건 · 과제 {len(groups)}건 · 매칭 완료')
    multi = {c: len(v) for c, v in groups.items() if len(v) > 1}
    if multi:
        print(f'  성과가 여러 건인 과제 {len(multi)}개 — 연결은 묶어서 한 번에 보낸다')
    if DRY:
        print('--dry-run 이라 만들지 않는다')
        return 0

    mcp = Mcp(token)
    print(f'MCP 연결: {MCP_URL}')

    ok, fail = 0, []
    for code, specs in groups.items():
        puid = code_to_uuid[code]
        try:
            # 1) 그 과제의 성과를 **전부** 만든다.
            items = []
            for i, spec in enumerate(specs):
                # `existing` 이 있으면 이미 만들어 둔 것을 쓴다.
                # (대화 중 MCP 도구로 직접 만든 몇 건이 있어 중복 생성을 막는다.
                #  성과는 MCP 로 지울 수 없으므로 중복을 만들면 화면에서 치워야 한다.)
                if spec.get('existing'):
                    puuid = spec['existing']
                else:
                    fields = {k: v for k, v in spec.items()
                              if k not in ('code', 'contribution', 'existing')}
                    # 성과코드는 과제당 유일해야 한다 — 겹치면 409 다.
                    fields['id'] = f'PERF-{code}' if i == 0 else f'PERF-{code}-{i + 1}'
                    # 사업부 접두어. 이미 붙어 있으면 두 번 붙이지 않는다.
                    div = code_to_div.get(code)
                    if div and not fields['성과항목'].startswith('['):
                        fields['성과항목'] = f"[{div}] {fields['성과항목']}"
                    perf = mcp.call('create_performance', {
                        'fields': fields,
                        'reason': f'{code} 과제 목표에 대응하는 성과 등록',
                    })
                    if perf.get('ignored'):
                        raise RuntimeError(f'ignored={perf["ignored"]}')
                    puuid = perf['uuid']
                items.append({'performanceUuid': puuid,
                              'contribution': spec.get('contribution', '100'),
                              'actualLevel': str(spec.get('실적수준', ''))})

            # 2) 연결 제안 (202) — 그 과제의 성과를 **한 번에** 보낸다
            prop = mcp.call('link_performances', {
                'project_uuid': puid,
                'items': items,
                'reason': f'{code} 과제-성과 연결',
            })
            d = prop.get('data', prop)
            if prop.get('httpStatus') != 202:
                fail.append((code, f'연결이 202 가 아니다: {prop.get("httpStatus")}'))
                continue
            # 새로 만든 성과라 다른 과제에 영향이 없어야 한다. 있으면 멈춘다.
            if d.get('affectedProjects'):
                fail.append((code, f'affectedProjects 가 비어 있지 않다: '
                                   f'{d["affectedProjects"]}'))
                continue

            # 3) 확인 반영
            res = mcp.call('confirm_change', {
                'proposal_id': d['proposalId'],
                'note': '과제-성과 연결 (사용자 사전 승인)',
            })
            if 'performance_links' not in (res.get('applied') or []):
                fail.append((code, f'반영 실패: {res}'))
                continue

            ok += 1
            tail = (f"{specs[0]['성과항목'][:28]}"
                    + (f' 외 {len(specs) - 1}건' if len(specs) > 1 else ''))
            print(f"  [{ok + len(fail):>3}/{len(groups)}] {code:<11} {tail}")
        except Exception as e:
            fail.append((code, str(e)[:160]))
            print(f"  [{ok + len(fail):>3}/{len(groups)}] {code:<11} 실패: {str(e)[:100]}")

    print()
    print(f'MCP 호출 {mcp.n}회 · 과제 성공 {ok}건 / 실패 {len(fail)}건')
    for code, why in fail:
        print(f'  {code}: {why}')
    return 1 if fail else 0


if __name__ == '__main__':
    sys.exit(main())
