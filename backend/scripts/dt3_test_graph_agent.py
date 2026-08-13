"""관계도 AI 에이전트 (`/api/dt-v2/graph/agent/*`).

무엇을 못 박나 — 계획서 §1 의 세 원칙이 코드에서 지켜지는가.

    ① **LLM 은 계산하지 않는다.**
       분석 GET 넷은 LLM 을 아예 안 부른다. 그리고 **LLM 이 죽어도 숫자는 나온다** —
       그게 이 구조의 실질적 이득이라 시험으로 못 박는다.
    ② **모든 답에 근거 경로(`refs`)가 있고, 그 ref 가 그래프에 실재한다.**
       없는 ref 를 강조하면 화면이 유령을 가리킨다.
    ③ **답보다 먼저 신뢰도.** 모든 응답에 `coverage` 가 있다.

    그리고 데이터를 보고 고친 것들:
    ④ **병목은 상대적이다.** 다들 똑같이 많으면 아무도 병목이 아니다
       (처음엔 절대 건수로 재서 관련자 8명이 **전원** 병목으로 잡혔다).
    ⑤ **숨은 연결은 흔한 고리를 뺀다.** 과제 3.1개당 KPI, KPI 16개뿐이라
       그냥 세면 아무 두 과제나 이어져 "협업 가능" 이 모든 쌍에 참이 된다.

실행: python scripts\\dt3_test_graph_agent.py   (LLM 서술까지 보려면 llm_stub 을 띄운다)
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                 # noqa: E402

from app import create_app                                         # noqa: E402
from app.modules.auth.models import User, UserRole                 # noqa: E402
from app.modules.digital_twin_dashboard.ai import graph_agent as GA  # noqa: E402

fails = []


def check(desc, ok, extra=''):
    print(f"  {'[OK]  ' if ok else '[FAIL]'} {desc}" + (f'   {extra}' if not ok and extra else ''))
    if not ok:
        fails.append(desc)


def get(c, url, hdr):
    r = c.get(url, headers=hdr)
    return r.status_code, ((r.get_json() or {}).get('data') or {})


def collect_refs(node):
    """응답 어디에 있든 `refs`/`ref` 를 전부 긁어 온다."""
    out = []
    if isinstance(node, dict):
        for k, v in node.items():
            if k == 'refs' and isinstance(v, list):
                out += [x for x in v if isinstance(x, str)]
            elif k in ('ref', 'projectRef', 'focusRef') and isinstance(v, str):
                out.append(v)
            else:
                out += collect_refs(v)
    elif isinstance(node, list):
        for v in node:
            out += collect_refs(v)
    return out


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        admin = User.query.filter_by(role=UserRole.ADMIN).first()
        if admin is None:
            check('admin 계정이 있다', False)
            return 1
        hdr = {'Authorization': f'Bearer {create_access_token(identity=str(admin.id))}'}

        with app.test_client() as c:
            # 그래프 전체의 ref 집합 — ② 검증의 기준이 된다.
            _st, full = get(c, '/api/dt-v2/graph?layers=all', hdr)
            known = {n['ref'] for n in full['nodes']}
            print(f"     [정보] 그래프 노드 {len(known)}개")

            analyses = {}

            # ── 0단계 : 데이터 공백 ─────────────────────────────────────
            print('\n── 0. 데이터 공백 ──')
            st, gaps = get(c, '/api/dt-v2/graph/agent/gaps', hdr)
            check('200', st == 200, f'실제 {st}')
            analyses['gaps'] = gaps
            keys = {g['key'] for g in (gaps.get('gaps') or [])}
            check('여섯 항목을 전부 본다',
                  {'noPerf', 'noKpi', 'contribution', 'overdue',
                   'unlinkedPl', 'noRelationType'} <= keys, str(sorted(keys)))
            check('항목마다 왜 문제인지 적는다',
                  all(g.get('why') for g in gaps['gaps']))
            check('★ 신뢰도를 함께 낸다', 'coverage' in gaps)
            for g in gaps['gaps']:
                print(f"     [정보] {g['title']}: {g['count']}건")

            # ── 1단계 : KPI 브리핑 ──────────────────────────────────────
            print('\n── 1. KPI 브리핑 ──')
            st, risky = get(c, '/api/dt-v2/graph/agent/risky?years=2026', hdr)
            analyses['risky'] = risky
            kid = (risky.get('items') or [{}])[0].get('kpiDefinitionId')
            if kid is None:
                check('시험할 지표가 있다', False)
                return 1
            st, kpi = get(c, f'/api/dt-v2/graph/agent/kpi/{kid}', hdr)
            check('200', st == 200, f'실제 {st}')
            analyses['kpi'] = kpi
            labels = [s['label'] for s in (kpi.get('steps') or [])]
            check('★ 다섯 단계를 순서대로 낸다',
                  labels[:3] == ['기여 과제', '성과 실적 확인', '성과 실적 없음'],
                  str(labels))
            check('단계마다 강조할 refs 가 있다',
                  all('refs' in s for s in kpi['steps']))
            # 성과 "확인" 은 연결이 아니라 **실적값**이 기준이다 — 목표만 세운 과제를
            # 성과를 낸 것으로 세면 브리핑 전체가 낙관 쪽으로 기운다.
            got = next(s for s in kpi['steps'] if s['key'] == 'withResult')
            none_ = next(s for s in kpi['steps'] if s['key'] == 'withoutResult')
            total = next(s for s in kpi['steps'] if s['key'] == 'projects')
            check('★ 성과 확인 + 미확인 = 기여 과제',
                  got['count'] + none_['count'] == total['count'],
                  f"{got['count']}+{none_['count']} vs {total['count']}")
            check('우선 대응에 이유를 적는다',
                  all(x.get('reasons') for x in (kpi.get('priority') or [])))
            check('없는 지표는 404',
                  c.get('/api/dt-v2/graph/agent/kpi/999999', headers=hdr).status_code == 404)

            # ④ 병목은 상대적이다
            print('\n── 병목 판정 ──')
            check('★ 병목 판정에 배수 기준이 있다',
                  GA.BOTTLENECK_RATIO > 1, str(GA.BOTTLENECK_RATIO))
            bn = kpi.get('bottleneck') or []
            check('★ 다들 비슷하면 아무도 병목이 아니다 (전원 병목이 안 나온다)',
                  all(b['openActions'] >= b['median'] * GA.BOTTLENECK_RATIO for b in bn),
                  str(bn[:2]))
            print(f'     [정보] 병목 {len(bn)}명')

            # ── 3단계 : 위험 지표 ───────────────────────────────────────
            print('\n── 3. 위험 지표 ──')
            check('200', st == 200)
            items = risky.get('items') or []
            check('위험도 순으로 내려간다',
                  all(items[i]['risk'] >= items[i + 1]['risk']
                      for i in range(len(items) - 1)))
            check('★ 미는 과제가 없는 지표를 표시한다',
                  all('noProjects' in i for i in items))
            st2, few = get(c, '/api/dt-v2/graph/agent/risky?years=2026&limit=2', hdr)
            check('limit 이 먹는다', len(few.get('items') or []) <= 2)
            print(f"     [정보] 위험 지표 {len(items)}개")

            # ── 4단계 : 숨은 연결 ───────────────────────────────────────
            print('\n── 4. 숨은 연결 ──')
            st, hidden = get(c, '/api/dt-v2/graph/agent/hidden?limit=5', hdr)
            check('200', st == 200, f'실제 {st}')
            analyses['hidden'] = hidden
            hs = hidden.get('items') or []
            check('limit 이 먹는다', len(hs) <= 5)
            check('점수 순으로 내려간다 (사업부 교차 가산 포함)',
                  all(hs[i]['score'] + (0.15 if hs[i]['crossDivision'] else 0)
                      >= hs[i + 1]['score'] + (0.15 if hs[i + 1]['crossDivision'] else 0)
                      for i in range(len(hs) - 1)))
            check('★ 왜 이어졌는지(via)를 밝힌다', all(x.get('via') for x in hs))
            check('★ 흔한 고리를 뺐다고 알린다', '고리' in (hidden.get('note') or ''))
            check('같은 과제끼리 짝지어지지 않는다',
                  all(x['a']['ref'] != x['b']['ref'] for x in hs))
            print(f"     [정보] {hidden.get('headline')}")

            # ── 멈춘 과제 (시간 축) ─────────────────────────────────────
            print('\n── 멈춘 과제 ──')
            st, stalled = get(c, '/api/dt-v2/graph/agent/stalled', hdr)
            check('200', st == 200, f'실제 {st}')
            analyses['stalled'] = stalled
            # 🐞 **"없습니다" 와 "모릅니다" 는 다르다.** 이력이 짧아 한 건도 판단
            #    못 했는데 "멈춘 과제가 없습니다" 라고 하면 문제가 없다고 믿게 된다.
            judged = len(stalled.get('stalled') or []) + len(stalled.get('regressed') or [])
            head = stalled.get('headline') or ''
            if '판단할 수 없습니다' in head:
                check('★ 판단 못 했으면 그 사실이 헤드라인이다',
                      '이력' in head, head[:60])
                check('몇 개를 못 봤는지 알려준다', '판단하지 않은' in (stalled.get('note') or ''))
            else:
                check('판단한 과제 수를 밝힌다', '판단한 과제' in head or judged > 0, head[:60])
            check('★ 진행률 하락을 "나빠졌다" 로 단정하지 않는다',
                  '계획이 커진' in (stalled.get('hint') or ''), stalled.get('hint'))
            st2, s30 = get(c, '/api/dt-v2/graph/agent/stalled?minDays=30', hdr)
            check('minDays 가 먹는다', '30일' in (s30.get('headline') or '')
                  or '30일' in str(s30.get('steps')), str(s30.get('steps'))[:80])
            print(f"     [정보] {head[:70]}")

            # ── 일정 쏠림 ───────────────────────────────────────────────
            print('\n── 일정 쏠림 ──')
            st, sched = get(c, '/api/dt-v2/graph/agent/schedule', hdr)
            check('200', st == 200, f'실제 {st}')
            analyses['schedule'] = sched
            months = sched.get('months') or []
            check('월별 분포를 준다', bool(months))
            check('월이 오름차순이다',
                  [m['month'] for m in months] == sorted(m['month'] for m in months))
            # 🐞 쏠림은 **과제별로 보면 안 보이고 전체로 봐야 보인다**(실측 181중 91).
            #    과제별 목록이 비었다고 "쏠림 없음" 이라고 하면 안 된다.
            if months:
                peak = max(months, key=lambda m: m['count'])
                check('★ 헤드라인이 전체 쏠림을 말한다',
                      peak['month'] in (sched.get('headline') or ''),
                      sched.get('headline'))
                check('★ 과제별 목록이 비어도 헤드라인이 "없음" 이 아니다',
                      '없습니다' not in (sched.get('headline') or '')
                      or sum(m['count'] for m in months) == 0,
                      sched.get('headline'))
            print(f"     [정보] {sched.get('headline')}")

            # ── 이슈 적체 ───────────────────────────────────────────────
            print('\n── 이슈 적체 ──')
            st, iss = get(c, '/api/dt-v2/graph/agent/issues', hdr)
            check('200', st == 200, f'실제 {st}')
            analyses['issues'] = iss
            check('두 갈래로 본다 (오래된 것 / 대응 없는 것)',
                  {s['key'] for s in (iss.get('steps') or [])} == {'stale', 'noAction'})
            check('가장 오래된 것부터 나온다',
                  all((iss['stale'][i]['oldest'] or '') <= (iss['stale'][i + 1]['oldest'] or '')
                      for i in range(len(iss.get('stale') or []) - 1)))
            print(f"     [정보] {iss.get('headline')}")

            # ── 중점과제의 말과 실제 ────────────────────────────────────
            print('\n── 중점과제 ──')
            st, keyp = get(c, '/api/dt-v2/graph/agent/key-projects', hdr)
            check('200', st == 200, f'실제 {st}')
            analyses['keyProjects'] = keyp
            check('어긋난 이유를 항목마다 적는다',
                  all(x.get('flags') for x in (keyp.get('items') or [])))
            check('중점 / 그 외 평균을 나란히 준다',
                  'keyAvgProgress' in (keyp.get('stats') or {}))
            # 어느 쪽이 틀렸는지 **우리가 정하지 않는다** — 그 태도를 문구로 못 박는다.
            check('★ 데이터 탓인지 표시 탓인지 단정하지 않는다',
                  '수도' in (keyp.get('hint') or ''), keyp.get('hint'))
            print(f"     [정보] {keyp.get('headline')}")

            # ── 보고 준비도 ─────────────────────────────────────────────
            print('\n── 보고 준비도 ──')
            st, rdy = get(c, '/api/dt-v2/graph/agent/readiness', hdr)
            check('200', st == 200, f'실제 {st}')
            analyses['readiness'] = rdy
            check('네 항목을 본다',
                  {g['key'] for g in (rdy.get('gaps') or [])}
                  == {'noDetail', 'noImage', 'noMilestone', 'noActual'})
            check('항목마다 왜 문제인지 적는다',
                  all(g.get('why') for g in rdy['gaps']))
            print(f"     [정보] {rdy.get('headline')}")

            # ── 사업부별 데이터 채움 ────────────────────────────────────
            #
            # **성과가 아니라 채움만 비교한다.** 진행률·달성률을 넣으면 기능조직이
            # 못해서가 아니라 잴 것이 없어서 꼴찌가 된다 — 그 결정이 지켜지는지 본다.
            print('\n── 사업부별 채움 ──')
            st, dv = get(c, '/api/dt-v2/graph/agent/divisions', hdr)
            check('200', st == 200, f'실제 {st}')
            analyses['divisions'] = dv
            rows = dv.get('rows') or []
            check('사업부별 행이 있다', bool(rows), str(len(rows)))

            # ★ 성과 지표가 새어 들어오지 않았는가 — 이 분석의 존재 이유다.
            banned = {'progress', 'achievement', 'rate_progress', 'achievementRate'}
            leaked = [m['key'] for m in (dv.get('metrics') or []) if m['key'] in banned]
            check('★ 진행률·달성률이 지표에 없다', not leaked, str(leaked))
            cell_keys = set()
            for r in rows:
                cell_keys |= set(r['cells'])
            check('★ 행에도 성과 지표가 없다', not (cell_keys & banned), str(cell_keys))
            check('★ 무엇을 왜 뺐는지 응답에 실린다',
                  bool(dv.get('excluded')) and all(e.get('why') for e in dv['excluded']),
                  str(dv.get('excluded'))[:120])

            # 비율만 주면 3/4 와 12/16 이 같아 보인다 — 분자·분모를 늘 함께 준다.
            check('★ 비율과 함께 분자·분모를 준다',
                  all('filled' in c and 'total' in c
                      for r in rows for c in r['cells'].values()))
            check('분모가 0 이면 비율을 만들지 않는다',
                  all(c['rate'] is None for r in rows for c in r['cells'].values()
                      if c['total'] == 0))
            check('★ 표본이 작은 사업부를 표시한다',
                  all('smallSample' in r for r in rows))
            check('기능조직을 표시한다', all('isFunctional' in r for r in rows))
            check('채움률이 낮은 곳부터 나온다',
                  all((rows[i]['fillRate'] or 0) <= (rows[i + 1]['fillRate'] or 0)
                      for i in range(len(rows) - 1)))
            check('항목마다 왜 필요한지 적는다',
                  all(m.get('why') for m in (dv.get('metrics') or [])))
            for r in rows[:3]:
                print(f"     [정보] {r['division']}: 채움 {r['fillRate']}% · "
                      f"과제 {r['projectCount']} · 할 일 {r['todo']}")

            # ── ② 근거 경로가 실재하는가 ────────────────────────────────
            print('\n── 근거 경로 ──')
            for name, payload in analyses.items():
                refs = [r for r in collect_refs(payload) if r]
                ghosts = sorted({r for r in refs if r not in known})
                check(f'★ {name}: refs 가 모두 그래프에 실재한다',
                      not ghosts, f'{len(ghosts)}개 · 예: {ghosts[:2]}')

            # ── ③ 신뢰도 ───────────────────────────────────────────────
            print('\n── 신뢰도 ──')
            for name, payload in analyses.items():
                cov = payload.get('coverage') or {}
                check(f'{name}: coverage 가 있다', bool(cov))
                check(f'{name}: 사람 분석을 믿어도 되는지 말한다',
                      'peopleReliable' in cov)

            # ── ① LLM 이 죽어도 숫자는 나온다 ──────────────────────────
            print('\n── LLM 없이도 되는가 ──')
            saved = app.config.get('LLM_BASE_URL')
            app.config['LLM_BASE_URL'] = ''
            try:
                st, g2 = get(c, '/api/dt-v2/graph/agent/gaps', hdr)
                check('★ LLM 이 꺼져 있어도 분석은 200', st == 200, f'실제 {st}')
                check('★ 그래도 숫자가 그대로 나온다',
                      g2.get('headline') == gaps.get('headline'))
                r = c.post('/api/dt-v2/graph/agent/narrate', headers=hdr,
                           json={'analysis': gaps})
                check('★ 서술은 실패해도 200 이다 (숫자를 오류로 덮지 않는다)',
                      r.status_code == 200, f'실제 {r.status_code}')
                nd = (r.get_json() or {}).get('data') or {}
                check('★ narrative 는 비고 이유를 알려준다',
                      nd.get('narrative') is None and nd.get('error'),
                      str(nd)[:120])
            finally:
                app.config['LLM_BASE_URL'] = saved

            r = c.post('/api/dt-v2/graph/agent/narrate', headers=hdr, json={})
            check('analysis 가 없으면 400', r.status_code == 400, f'실제 {r.status_code}')

            # 스텁이 떠 있으면 서술까지 확인한다
            r = c.post('/api/dt-v2/graph/agent/narrate', headers=hdr,
                       json={'analysis': analyses['kpi']})
            nd = (r.get_json() or {}).get('data') or {}
            if nd.get('narrative'):
                check('★ 서술이 나온다 (스텁)', len(nd['narrative']) > 10)
                # 스텁조차 숫자를 지어내지 않는지 — 계산된 값이 문장에 그대로 있어야 한다
                check('서술이 계산된 headline 을 담는다',
                      analyses['kpi']['headline'][:20] in nd['narrative'],
                      nd['narrative'][:100])
            else:
                print(f"     [정보] 스텁이 안 떠 있어 서술 확인은 건너뜁니다 "
                      f"({nd.get('error')})")

            # ── 가시성 ─────────────────────────────────────────────────
            print('\n── 가시성 ──')
            other = User.query.filter(User.role != UserRole.ADMIN,
                                      User.is_active.is_(True)).first()
            if other is None:
                print('     [정보] 비관리자 계정이 없어 건너뜁니다.')
            else:
                h2 = {'Authorization':
                      f'Bearer {create_access_token(identity=str(other.id))}'}
                st, mine = get(c, '/api/dt-v2/graph/agent/gaps', h2)
                check('비관리자도 200', st == 200, f'실제 {st}')
                check('★ 관리자보다 많이 보지 않는다',
                      mine['coverage']['projectCount']
                      <= gaps['coverage']['projectCount'],
                      f"{mine['coverage']['projectCount']} vs "
                      f"{gaps['coverage']['projectCount']}")
            r = c.get('/api/dt-v2/graph/agent/gaps')
            check('토큰 없으면 401', r.status_code in (401, 422), f'실제 {r.status_code}')

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
