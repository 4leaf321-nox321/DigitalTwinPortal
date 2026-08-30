"""성숙도 MCP 도구를 **실제로 돌려** 본다. (2026-08-30)

`dt3_test_maturity_mcp.py` 는 경로가 URL 표에 있는지만 대본다 — 보내는 **몸통이 백엔드가
받는 꼴인지**는 못 잡는다. 그건 실제로 불러 봐야 안다. 이 시험은 `localhost:3003/mcp` 의
JSON-RPC 로 진짜 도구를 부른다 — 운영에서 AI 가 겪는 것과 같은 경로다.

  A  성숙도 도구 12개가 등록돼 있고 대시보드 도구와 이름이 안 겹친다
  B  뼈대 읽기 — 부문·축·칸이 오는가
  C  대상·수단을 만들고 잇는다  ★ 몸통이 맞는지는 여기서만 드러난다
  D  평가 — 근거 없으면 막히고, 있으면 칸이 올라간다
  E  값 축(정확도)은 값으로 넣고 칸은 서버가 정한다
  F  동시 수정 — 낡은 base_assessed_at 이면 409
  G  일괄 입력 dry_run 은 저장하지 않는다
  H  **뒷정리** — 만든 것을 전부 지운다

⚠️ 개발 DB 의 성숙도는 일부러 비워 둔 상태다(운영 첫 실행 모습을 보려고).
   이 시험은 만든 것을 H 에서 반드시 지운다 — 중간에 죽으면 이름으로 찾아 지울 것.

실행
    1) 백엔드가 5174 에 떠 있어야 한다
    2) MCP 서버를 띄운다:  cd mcp_server && venv\\Scripts\\python.exe server.py
    3) venv/Scripts/python.exe scripts/dt3_test_maturity_mcp_live.py
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

MCP_URL = os.environ.get('MCP_URL', 'http://127.0.0.1:3003/mcp')
MARK = 'ZZ-MCP시험'          # 만든 것에 붙이는 표 — 중간에 죽어도 이 이름으로 찾는다
FAIL = []


def check(name, got, want):
    ok = got == want
    print(f"  {'OK  ' if ok else 'FAIL'}  {name}: got={got!r} want={want!r}")
    if not ok:
        FAIL.append(name)


def check_true(name, got):
    ok = bool(got)
    print(f"  {'OK  ' if ok else 'FAIL'}  {name}: {str(got)[:120]!r}")
    if not ok:
        FAIL.append(name)


class Mcp:
    def __init__(self, token):
        self.c = requests.Session()
        self.h = {'Authorization': f'Bearer {token}',
                  'Content-Type': 'application/json',
                  'Accept': 'application/json, text/event-stream'}
        self.n = 0
        r = self._post({'jsonrpc': '2.0', 'id': 0, 'method': 'initialize',
                        'params': {'protocolVersion': '2024-11-05', 'capabilities': {},
                                   'clientInfo': {'name': 'maturity-live', 'version': '1'}}}, raw=True)
        self.h['mcp-session-id'] = r.headers['mcp-session-id']
        self._post({'jsonrpc': '2.0', 'method': 'notifications/initialized'}, raw=True)

    def _post(self, body, raw=False):
        r = self.c.post(MCP_URL, headers=self.h, json=body, timeout=120)
        if raw:
            return r
        r.encoding = 'utf-8'          # SSE 에는 charset 이 없어 한글이 깨진다
        m = re.search(r'^data: (.+)$', r.text, re.M)
        if not m:
            raise RuntimeError(f'MCP 응답 파싱 실패: {r.status_code} {r.text[:200]}')
        return json.loads(m.group(1))

    def tools(self):
        out = self._post({'jsonrpc': '2.0', 'id': 99, 'method': 'tools/list'})
        return {t['name']: t.get('description', '') for t in out['result']['tools']}

    def call(self, tool, args):
        self.n += 1
        out = self._post({'jsonrpc': '2.0', 'id': self.n, 'method': 'tools/call',
                          'params': {'name': tool, 'arguments': args}})
        if 'error' in out:
            raise RuntimeError(f'{tool}: {out["error"]}')
        res = out['result']
        if 'structuredContent' in res:
            sc = res['structuredContent']
            return sc.get('result', sc)
        parts = [p.get('text', '') for p in res.get('content', [])]
        txt = ''.join(parts)
        if txt.strip().startswith(('{', '[')):
            try:
                return json.loads(txt)
            except json.JSONDecodeError:
                return self._parts(parts)
        return txt

    @staticmethod
    def _parts(parts):
        return [json.loads(p) for p in parts if p.strip()]

    def call_list(self, tool, args):
        """목록을 돌려주는 도구용.

        ⚠️ MCP 는 목록을 **줄마다 한 조각**으로 보낸다. 그래서 한 줄짜리 목록은 겉보기에
           낱개 객체와 구분이 안 된다(조각 하나에 `{...}`). 무엇을 기대하는지는 부르는
           쪽이 알므로 여기서 갈라 준다 — 도구가 잘못된 것이 아니다.
        """
        self.n += 1
        out = self._post({'jsonrpc': '2.0', 'id': self.n, 'method': 'tools/call',
                          'params': {'name': tool, 'arguments': args}})
        if 'error' in out:
            raise RuntimeError(f'{tool}: {out["error"]}')
        return self._parts([p.get('text', '') for p in out['result'].get('content', [])])


def main():
    app = create_app()
    with app.app_context():
        user = User.query.filter_by(is_admin=True).first() or User.query.first()
        if user is None:
            print('사용자가 없습니다.')
            return 1
        token = create_access_token(identity=str(user.id))
    print(f'· 사용자: {user.name} (id={user.id})')

    m = Mcp(token)
    made = {'subject': None, 'agent': None, 'pair': None}

    try:
        # ── A 등록과 이름 갈림 ──────────────────────────────────────────────
        print('\nA. 도구 등록')
        names = m.tools()
        mat = sorted(n for n in names if n.startswith('maturity_'))
        check('성숙도 도구 수', len(mat), 12)
        check_true('대시보드 도구도 그대로', 'list_projects' in names)
        # 성숙도 도구 설명에 다른 모듈과 헷갈리지 말라는 안내가 있는가
        check_true('describe 가 대시보드와 다르다고 말한다', '대시보드' in names['maturity_describe'])

        # ── B 뼈대 ─────────────────────────────────────────────────────────
        print('\nB. 뼈대 읽기')
        defs = m.call('maturity_describe', {})
        sectors = {s['key']: s for s in defs['sectors']}
        check_true('부문에 시뮬레이션이 있다', 'simulation' in sectors)
        axes = defs['axes']['simulation']
        by_axis = {a['key']: a for a in axes}
        check_true('축에 정확도·자동화가 있다', {'accuracy', 'automation'} <= set(by_axis))
        check('정확도는 값 축', by_axis['accuracy']['kind'], 'value')

        divs = m.call_list('maturity_list_divisions', {})
        mine = next((d for d in divs if not d.get('deny_reason')), None) or divs[0]
        did = mine['id']
        print(f"  · 사업부: {mine['name']} (id={did})")

        # ── C 만들고 잇기 ───────────────────────────────────────────────────
        print('\nC. 대상·수단 만들고 잇기')
        subj = m.call('maturity_add_item', {'division_id': did, 'kind': 'subject',
                                            'name': f'{MARK} 낙하 시험', 'detail': '1.2m'})
        check_true('대상이 생겼다', isinstance(subj, dict) and subj.get('id'))
        made['subject'] = subj.get('id')

        agent = m.call('maturity_add_item', {'division_id': did, 'kind': 'agent',
                                             'name': f'{MARK} 구조 해석',
                                             'fields': {'kind': '구조', 'model_kind': 'physics',
                                                        'tools': ['LS-DYNA']}})
        check_true('수단이 생겼다', isinstance(agent, dict) and agent.get('id'))
        made['agent'] = agent.get('id')
        check('모델 종류가 들어갔다', agent.get('model_kind'), 'physics')

        pair = m.call('maturity_link', {'subject_id': made['subject'], 'agent_id': made['agent']})
        check_true('연계가 생겼다', isinstance(pair, dict) and pair.get('id'))
        made['pair'] = pair.get('id')

        items = m.call_list('maturity_list_items', {'division_id': did, 'kind': 'subject'})
        check_true('목록에서 보인다', any(i['id'] == made['subject'] for i in items))

        # ── D 평가 ─────────────────────────────────────────────────────────
        print('\nD. 평가 — 근거가 규칙이다')
        blocked = m.call('maturity_assess', {'pair_id': made['pair'], 'axis': 'automation',
                                             'note': '', 'rung': 'pre'})
        check('근거가 비면 막힌다', blocked.get('status'), 'error')

        got = m.call('maturity_assess', {'pair_id': made['pair'], 'axis': 'automation',
                                         'note': '전처리 템플릿 확인(2026-08)', 'flags': ['pre'],
                                         'evidence': {'hours_per_run': 4}})
        check_true('근거가 있으면 저장된다', isinstance(got, dict) and got.get('assessments'))
        auto = (got.get('assessments') or {}).get('automation') or {}
        check_true('자동화 칸이 매겨졌다', auto.get('rung'))

        # ── E 값 축 ────────────────────────────────────────────────────────
        print('\nE. 값 축 — 값만 넣고 칸은 서버가 정한다')
        acc = m.call('maturity_assess', {'pair_id': made['pair'], 'axis': 'accuracy',
                                         'note': '시험 5건 비교, 오차 6%', 'value': 94,
                                         'evidence': {'compared_tests': 5, 'error_pct': 6}})
        row = (acc.get('assessments') or {}).get('accuracy') or {}
        check('값이 들어갔다', row.get('value'), 94)
        check_true('칸은 서버가 정했다', row.get('rung'))
        refused = m.call('maturity_assess', {'pair_id': made['pair'], 'axis': 'accuracy',
                                             'note': '칸을 직접', 'rung': 'correlated'})
        check('값 축에 칸을 넣으면 거절', refused.get('status'), 'error')

        # ── F 동시 수정 ────────────────────────────────────────────────────
        print('\nF. 남이 먼저 고쳤을 때')
        cur = m.call('maturity_get_pair', {'pair_id': made['pair']})
        stamp = ((cur.get('assessments') or {}).get('automation') or {}).get('assessed_at')
        check_true('평가 시각을 준다', stamp)
        m.call('maturity_assess', {'pair_id': made['pair'], 'axis': 'automation',
                                   'note': '남이 먼저 고친 셈', 'flags': ['pre', 'run'],
                                   'evidence': {'hours_per_run': 3}})
        stale = m.call('maturity_assess', {'pair_id': made['pair'], 'axis': 'automation',
                                           'note': '낡은 기준으로 덮기', 'flags': ['pre'],
                                           'evidence': {'hours_per_run': 4},
                                           'base_assessed_at': stamp})
        check('낡은 기준이면 409', stale.get('status'), 'conflict')
        check_true('성숙도 말로 안내한다', 'maturity_get_pair' in (stale.get('hint') or ''))

        # ── G 일괄 입력 ────────────────────────────────────────────────────
        print('\nG. 일괄 입력 — dry_run 은 저장하지 않는다')
        kinds = m.call_list('maturity_bulk_kinds', {'division_id': did})
        sub_kind = next((k for k in kinds if k['key'] == 'subject'), None)
        check_true('갈래와 열 이름이 온다', sub_kind and sub_kind.get('columns'))
        cols = sub_kind['columns']
        text = '\t'.join(cols) + '\n' + '\t'.join(
            [mine['name'] if c == '사업부' else (f'{MARK} 굽힘 시험' if c == cols[1] else '') for c in cols])
        dry = m.call('maturity_bulk', {'division_id': did, 'kind': 'subject', 'text': text})
        check_true('미리보기가 줄을 셈한다', (dry.get('summary') or {}).get('rows'))
        after = m.call_list('maturity_list_items', {'division_id': did, 'kind': 'subject'})
        check('미리보기는 저장하지 않는다',
              any(f'{MARK} 굽힘' in i['name'] for i in after), False)

        # ── 판·변화도 읽히는가 ─────────────────────────────────────────────
        board = m.call('maturity_board', {'division_id': did})
        check_true('판이 읽힌다', isinstance(board, dict) and 'subjects' in board)
        ch = m.call('maturity_changes', {'division_id': did, 'days': 7})
        check_true('변화가 읽힌다', isinstance(ch, (dict, list)))

    finally:
        # ── H 뒷정리 ───────────────────────────────────────────────────────
        print('\nH. 뒷정리 — 만든 것을 지운다')
        base = os.environ.get('DT_API_BASE', 'http://localhost:5174').rstrip('/')
        h = {'Authorization': f'Bearer {token}'}
        left = []
        for kind, key in (('pairs', 'pair'), ('agents', 'agent'), ('subjects', 'subject')):
            rid = made.get(key)
            if not rid:
                continue
            r = requests.delete(f'{base}/api/dev-dt-maturity/{kind}/{rid}', headers=h, timeout=30)
            print(f'  · {kind}/{rid} → {r.status_code}')
            if not r.ok:
                left.append(f'{kind}/{rid}')
        check('남긴 것이 없다', left, [])

    print()
    print(f'{"[FAIL] " + str(len(FAIL)) + "건" if FAIL else "[OK] 전부 통과"}')
    for f in FAIL:
        print('  -', f)
    return 1 if FAIL else 0


if __name__ == '__main__':
    sys.exit(main())
