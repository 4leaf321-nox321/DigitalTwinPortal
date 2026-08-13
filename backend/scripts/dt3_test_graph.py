"""관계도 투영 API (`/api/dt-v2/graph`).

무엇을 못 박나 — `graph_view.py` 머리말의 세 원칙이 실제로 지켜지는가.

    ① **색·크기를 서버가 정하지 않는다.**
       예전 「지식 그래프 저장」이 노드에 `color`·`size` 를 박아 저장하는 바람에
       데이터가 아니라 그림이 됐다. 그러면 같은 데이터를 다른 기준으로 못 칠한다.
    ② **권한은 그래프 밖에서.** 볼 수 없는 과제가 노드로 새면 안 된다.
       그래프가 우회로가 되는 것이 이 기능의 가장 큰 위험이다.
    ③ **저장하지 않는다.** 이 API 를 부르고 나서 DB 가 그대로여야 한다.

    그리고 그리기 전에 반드시 참이어야 하는 것:
    ④ 엣지의 양 끝이 **실제로 있는 노드**다. 하나라도 없으면 화면에 이름 없는
      유령 점이 뜬다(force-graph 가 없는 끝을 노드로 만들어 낸다).

실행: python scripts\\dt3_test_graph.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                 # noqa: E402

from app import create_app                                         # noqa: E402
from app.extensions import db                                      # noqa: E402
from app.modules.auth.models import User, UserRole                 # noqa: E402
from app.modules.digital_twin_dashboard import graph_view as GV    # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import (         # noqa: E402
    Dt2Project, Dt2ProjectChange, Dt2ProjectDependency,
)

fails = []


def check(desc, ok, extra=''):
    print(f"  {'[OK]  ' if ok else '[FAIL]'} {desc}" + (f'   {extra}' if not ok and extra else ''))
    if not ok:
        fails.append(desc)


def get(c, url, hdr):
    r = c.get(url, headers=hdr)
    return r.status_code, ((r.get_json() or {}).get('data') or {})


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
            # ── 1. 옵션 ──────────────────────────────────────────────────
            print('── 필터 옵션 ──')
            st, o = get(c, '/api/dt-v2/graph/options', hdr)
            check('200', st == 200, f'실제 {st}')
            check('연도를 준다', isinstance(o.get('years'), list))
            check('사업부를 준다', isinstance(o.get('divisions'), list))
            check('레이어 목록이 서버 상수와 같다',
                  o.get('layers') == list(GV.LAYERS), str(o.get('layers')))
            check('기본 레이어를 알려준다',
                  o.get('defaultLayers') == list(GV.DEFAULT_LAYERS))

            r = c.get('/api/dt-v2/graph/options')
            check('토큰 없으면 401', r.status_code in (401, 422), f'실제 {r.status_code}')

            # ── 2. 그래프 기본 ───────────────────────────────────────────
            print('\n── 그래프 ──')
            st, g = get(c, '/api/dt-v2/graph?layers=all', hdr)
            check('200', st == 200, f'실제 {st}')
            nodes, edges = g.get('nodes') or [], g.get('edges') or []
            check('노드가 있다', len(nodes) > 0, str(len(nodes)))
            print(f"     [정보] 노드 {len(nodes)} · 엣지 {len(edges)} · "
                  f"과제 {g.get('stats', {}).get('projectCount')}")

            # ① 색·크기 금지
            painted = [n for n in nodes if 'color' in n or 'size' in n
                       or 'shape' in n or 'font' in n]
            check('★ 노드에 색·크기가 없다 (표현은 화면이 정한다)',
                  not painted, str(painted[:1])[:120])

            # ④ 엣지의 양 끝이 실재하는 노드
            refs = {n['ref'] for n in nodes}
            ghosts = [x for e in edges for x in (e['source'], e['target']) if x not in refs]
            check('★ 엣지의 양 끝이 모두 실재하는 노드다 (유령 노드 방지)',
                  not ghosts, f'{len(ghosts)}개')

            # 🐞 같은 엣지를 두 번 담으면 화면에 겹쳐 그려질 뿐 아니라 **잇는 힘이
            #    곱해져 배치가 찌그러진다.** 사업부→프로세스 엣지를 과제 루프 안에서
            #    만들다가 실제로 21개가 100개가 됐다(2026-08-09).
            #    KPI 만 예외다 — 같은 (과제, 지표) 라도 지원 대상 사업부가 다르면
            #    다른 연결이다(`dt2_project_kpi` 유니크 제약이 그 셋이다).
            dup = [k for k, n in __import__('collections').Counter(
                (e['source'], e['target'], e['relation']) for e in edges
                if e['relation'] != 'contributes').items() if n > 1]
            check('★ 같은 엣지가 두 번 담기지 않는다', not dup,
                  f'{len(dup)}쌍 · 예: {dup[:2]}')

            check('모든 노드에 ref·type·label 이 있다',
                  all(n.get('ref') and n.get('type') and 'label' in n for n in nodes))
            check('ref 가 "<type>:<id>" 모양이다',
                  all(n['ref'].startswith(n['type'] + ':') for n in nodes))
            check('ref 가 겹치지 않는다', len(refs) == len(nodes))

            # ── 3. 레이어 토글이 실제로 먹는가 ───────────────────────────
            print('\n── 레이어 ──')
            st, only_dep = get(c, '/api/dt-v2/graph?layers=dep', hdr)
            types = {n['type'] for n in only_dep['nodes']}
            check('★ dep 만 켜면 과제 노드만 남는다', types <= {'project'}, str(sorted(types)))
            rels = {e['relation'] for e in only_dep['edges']}
            check('dep 만 켜면 precedes 엣지만', rels <= {'precedes'}, str(sorted(rels)))

            # ── perf 는 성과 + **성과 분류**(대분류→소분류→성과) 다 (2026-08-09) ──
            #    '모든 성과 현황' 이 성과를 대분류>소분류로 묶어 보여주는데,
            #    관계도에서는 성과가 그냥 흩어져 있어 "비슷한 성과" 가 안 보였다.
            st, only_perf = get(c, '/api/dt-v2/graph?layers=perf', hdr)
            ptypes = {n['type'] for n in only_perf['nodes']}
            check('perf 는 과제·성과·성과분류만',
                  ptypes <= {'project', 'perf', 'perfcat', 'perfsub'}, str(sorted(ptypes)))
            check('★ 성과 대분류·소분류 노드가 있다',
                  {'perfcat', 'perfsub'} <= ptypes, str(sorted(ptypes)))

            pref_map = {n['ref']: n for n in only_perf['nodes']}
            pparents = {}
            for e in only_perf['edges']:
                if pref_map[e['target']]['type'] == 'perf' and e['relation'] == 'contains':
                    pparents.setdefault(e['target'], []).append(pref_map[e['source']]['type'])
            check('★ 성과의 분류 부모가 하나뿐이다',
                  all(len(v) == 1 for v in pparents.values()),
                  str([k for k, v in pparents.items() if len(v) != 1][:2]))
            subs = [n for n in only_perf['nodes'] if n['type'] == 'perfsub']
            check('소분류가 대분류별로 갈린다 (ref 에 대분류가 들어간다)',
                  all('|' in n['ref'].split(':', 1)[1] for n in subs),
                  str([n['ref'] for n in subs[:2]]))
            check('소분류가 자기 대분류를 안다', all(n.get('category') for n in subs))
            # 성과는 과제(measures)와 분류(contains) 양쪽에 붙는다 — 둘은 다른 관계다.
            check('성과가 과제와도 이어져 있다',
                  any(e['relation'] == 'measures' for e in only_perf['edges']))
            print(f"     [정보] 성과 대분류 "
                  f"{len([n for n in only_perf['nodes'] if n['type'] == 'perfcat'])}개 · "
                  f"소분류 {len(subs)}개 · "
                  f"성과 {len([n for n in only_perf['nodes'] if n['type'] == 'perf'])}건")

            # ── org 는 사업부 → **프로세스** → 과제 로 이어진다 (2026-08-09) ──
            #    사업부를 과제에 바로 이으면 한 사업부에 20갈래 별이 생겨서
            #    자리를 못 잡는다. 사이에 프로세스를 끼워 무리를 가른다.
            st, org = get(c, '/api/dt-v2/graph?layers=org', hdr)
            otypes = {n['type'] for n in org['nodes']}
            check('★ org 에 프로세스 노드가 있다', 'process' in otypes, str(sorted(otypes)))
            check('org 은 사업부·프로세스·담당부서·과제만',
                  otypes <= {'project', 'division', 'process', 'dept'},
                  str(sorted(otypes)))
            # 「조직」과 「사람」을 갈랐다 — 담당부서는 조직 쪽, 소속부서는 사람 쪽이다.
            orels = {e['relation'] for e in org['edges']}
            check('★ org 에 담당부서(handled_by)가 있다', 'handled_by' in orels,
                  str(sorted(orels)))
            check('★ org 에 소속부서(belongs_to)는 없다 (그건 사람 쪽이다)',
                  'belongs_to' not in orels, str(sorted(orels)))
            check('org 에 사람 노드가 없다', 'person' not in otypes, str(sorted(otypes)))

            oref = {n['ref']: n for n in org['nodes']}
            parents = {}
            for e in org['edges']:
                if oref[e['target']]['type'] == 'project':
                    parents.setdefault(e['target'], []).append(oref[e['source']]['type'])
            # 과제는 조직 갈래에서 **부모가 하나**여야 한다. 프로세스를 끼웠는데
            # 사업부 직결을 안 지웠으면 여기서 둘이 된다(별 모양이 그대로 남는다).
            check('★ 과제의 조직 부모가 하나뿐이다 (사업부 직결이 남아 있지 않다)',
                  all(len(v) == 1 for v in parents.values()),
                  str([k for k, v in parents.items() if len(v) != 1][:2]))
            div_to_proj = [t for t, v in parents.items() if v == ['division']]
            check('사업부 직결은 프로세스가 비어 있을 때만이다',
                  all(not (oref[t].get('process')) for t in div_to_proj))
            proc_nodes = [n for n in org['nodes'] if n['type'] == 'process']
            check('프로세스 노드가 사업부별로 갈린다 (ref 에 사업부가 들어간다)',
                  all('|' in n['ref'].split(':', 1)[1] for n in proc_nodes),
                  str([n['ref'] for n in proc_nodes[:2]]))
            check('프로세스 노드가 자기 사업부를 안다',
                  all(n.get('division') for n in proc_nodes))
            print(f'     [정보] 프로세스 노드 {len(proc_nodes)}개 · '
                  f'사업부 직결 과제 {len(div_to_proj)}건(프로세스 미입력)')

            # ── card : 「모든 성과 현황」의 카드 = 화면 이름 **「성과 속성」** ──
            #
            # 개발 DB 의 카드는 대부분 **삭제된 성과**를 가리켜서 화면에 안 뜬다.
            # 그래서 시험용 카드를 하나 만들어 실제로 도는지 보고 지운다 —
            # 있는 데이터에만 기대면 "코드가 도는지" 를 확인할 수 없다.
            from app.modules.digital_twin_dashboard.models import KPIDashboardCard

            st, pg = get(c, '/api/dt-v2/graph?layers=perf', hdr)
            live = [n['ref'].split(':', 1)[1] for n in pg['nodes'] if n['type'] == 'perf']
            tmp = None
            if len(live) >= 2:
                tmp = KPIDashboardCard(
                    name='__dt3_시험카드', division='MX', category='전체',
                    subcategories=[], logic='합계',
                    selected_perf_keys=[live[0], live[1], live[0], '없는키'],
                    year=2026, order=999, is_active=True)
                db.session.add(tmp)
                db.session.commit()
            try:
                st, cg = get(c, '/api/dt-v2/graph?layers=card', hdr)
                ctypes = {n['type'] for n in cg['nodes']}
                # 과제 노드는 **레이어와 무관하게 늘 있다**(그래프의 바탕이다).
                # 그 위에 카드와 그 카드가 담은 성과만 얹혀야 한다.
                check('card 는 카드와 성과만 더한다',
                      ctypes <= {'kpicard', 'perf', 'project'}, str(sorted(ctypes)))
                mine = [n for n in cg['nodes']
                        if n['type'] == 'kpicard' and '__dt3_시험카드' in n['label']]
                if tmp is not None:
                    check('★ 성과 속성 카드가 노드로 나온다', len(mine) == 1, str(len(mine)))
                    if mine:
                        cref = mine[0]['ref']
                        mine_edges = [e for e in cg['edges'] if e['source'] == cref]
                        check('★ 카드가 고른 성과와 이어진다',
                              len(mine_edges) == 2, f'{len(mine_edges)}건 (2 기대)')
                        check('★ 같은 성과를 두 번 골라도 엣지는 하나',
                              len({e['target'] for e in mine_edges}) == 2)
                        check('없는 키는 조용히 빠진다',
                              all(e['target'].startswith('perf:') for e in mine_edges))
                        check('관계 이름이 분류와 다르다 (in_card)',
                              all(e['relation'] == 'in_card' for e in mine_edges))
                        check('사업부를 이름에 붙인다 (같은 이름 카드가 여럿이다)',
                              '(MX)' in mine[0]['label'], mine[0]['label'])
                        check('카드가 몇 건을 담았는지 알려준다',
                              mine[0].get('perfCount') == 2, str(mine[0].get('perfCount')))

                    # 다른 연도를 고르면 안 나와야 한다 (카드는 연도별이다)
                    st, cg2 = get(c, '/api/dt-v2/graph?layers=card&years=2025', hdr)
                    check('★ 연도 필터가 카드에도 걸린다',
                          not any('__dt3_시험카드' in n['label'] for n in cg2['nodes']))

                    # 비활성 카드는 안 나온다
                    tmp.is_active = False
                    db.session.commit()
                    st, cg3 = get(c, '/api/dt-v2/graph?layers=card', hdr)
                    check('★ 비활성 카드는 안 나온다',
                          not any('__dt3_시험카드' in n['label'] for n in cg3['nodes']))
            finally:
                if tmp is not None:
                    db.session.delete(tmp)
                    db.session.commit()
                    check('정리: 시험 카드 삭제',
                          KPIDashboardCard.query.filter_by(name='__dt3_시험카드').count() == 0)

            # ── people : 사람 + **부서** (2026-08-09) ──────────────────────
            #    부서는 `members_json[].부서`(소속)와 `depts_json`(담당) 두 곳에서 온다.
            #    `dept_name` 은 쉼표로 이어 붙인 파생 문자열이라 쓰면 안 된다 —
            #    쓰면 'CAE그룹(MX), Digital Twin사무국(MX)' 이 부서 하나가 된다.
            st, ppl = get(c, '/api/dt-v2/graph?layers=people', hdr)
            pptypes = {n['type'] for n in ppl['nodes']}
            check('people 는 사람·부서·과제만',
                  pptypes <= {'project', 'person', 'dept'}, str(sorted(pptypes)))
            depts = [n for n in ppl['nodes'] if n['type'] == 'dept']
            check('★ 부서 노드가 있다', len(depts) > 0, str(len(depts)))
            check('★ 부서 이름에 쉼표가 없다 (dept_name 파생값을 쓰지 않았다)',
                  all(',' not in n['label'] for n in depts),
                  str([n['label'] for n in depts if ',' in n['label']][:2]))
            prels = {e['relation'] for e in ppl['edges']}
            check('★ people 에 소속부서(belongs_to)가 있다',
                  'belongs_to' in prels, str(sorted(prels)))
            check('★ people 에 담당부서(handled_by)는 없다 (그건 조직 쪽이다)',
                  'handled_by' not in prels, str(sorted(prels)))
            # 부서 노드는 **필요한 쪽이 만든다.** 한쪽만 켜도 부서가 제대로 보여야 한다.
            check('★ 사람만 켜도 부서 노드가 만들어진다', len(depts) > 0, str(len(depts)))
            # 같은 (사람,부서)·(과제,부서) 는 과제 수만큼 반복될 수 있다 — 한 번만이어야 한다.
            pdup = [k for k, n in __import__('collections').Counter(
                (e['source'], e['target'], e['relation'])
                for e in ppl['edges']).items() if n > 1]
            check('★ 부서 엣지가 과제 수만큼 중복되지 않는다', not pdup, str(pdup[:2]))
            print(f"     [정보] 사람 {len([n for n in ppl['nodes'] if n['type'] == 'person'])}명 · "
                  f"부서 {len(depts)}개")

            st, none_layer = get(c, '/api/dt-v2/graph?layers=', hdr)
            check('레이어를 하나도 안 켜면 과제만 나온다',
                  {n['type'] for n in none_layer['nodes']} <= {'project'})
            check('그때 엣지는 없다', len(none_layer['edges']) == 0)

            r = c.get('/api/dt-v2/graph?layers=없는것', headers=hdr)
            check('★ 모르는 레이어는 400 (조용히 버리지 않는다)',
                  r.status_code == 400, f'실제 {r.status_code}')

            # ── 4. 필터 ──────────────────────────────────────────────────
            print('\n── 필터 ──')
            years = o.get('years') or []
            if years:
                st, one = get(c, f'/api/dt-v2/graph?layers=&years={years[0]}', hdr)
                check('연도 필터가 먹는다',
                      all(n.get('year') == years[0] for n in one['nodes']),
                      str({n.get('year') for n in one['nodes']}))
            divs = [d['name'] for d in (o.get('divisions') or [])]
            if divs:
                st, one = get(c, f'/api/dt-v2/graph?layers=&divisions={divs[0]}', hdr)
                check('사업부 필터가 먹는다',
                      all(n.get('division') == divs[0] for n in one['nodes']),
                      str({n.get('division') for n in one['nodes']}))
                check('필터를 걸면 전체보다 적거나 같다',
                      one['stats']['projectCount'] <= g['stats']['projectCount'])

            st, with_del = get(c, '/api/dt-v2/graph?layers=&includeDeleted=1', hdr)
            check('휴지통 포함이 더 많거나 같다',
                  with_del['stats']['projectCount'] >= none_layer['stats']['projectCount'],
                  f"{with_del['stats']['projectCount']} vs {none_layer['stats']['projectCount']}")

            # ── 5. ② 권한 — 볼 수 없는 과제가 새지 않는가 ────────────────
            print('\n── 권한 ──')
            other = User.query.filter(User.role != UserRole.ADMIN,
                                      User.is_active.is_(True)).first()
            if other is None:
                print('     [정보] 비관리자 계정이 없어 건너뜁니다.')
            else:
                hdr2 = {'Authorization':
                        f'Bearer {create_access_token(identity=str(other.id))}'}
                st, mine = get(c, '/api/dt-v2/graph?layers=all', hdr2)
                check('비관리자도 200', st == 200, f'실제 {st}')
                check('★ 관리자보다 많이 보지 않는다',
                      mine['stats']['projectCount'] <= g['stats']['projectCount'],
                      f"{mine['stats']['projectCount']} vs {g['stats']['projectCount']}")

                # 서버 권한 함수와 **직접** 대조한다 — 응답 숫자만 보면
                # 둘 다 틀렸을 때 통과한다.
                from app.modules.digital_twin_dashboard import permissions as P
                allowed = {p.uuid for p in Dt2Project.query.filter(
                    Dt2Project.is_deleted.is_(False),
                    Dt2Project.is_permanently_deleted.is_(False)).all()
                    if P.can_view_project(other, p)}
                got = {n['ref'].split(':', 1)[1] for n in mine['nodes']
                       if n['type'] == 'project'}
                check('★ 볼 수 있는 과제와 정확히 같다', got == allowed,
                      f'추가로 샌 것 {len(got - allowed)}건')

                # 옵션의 사업부도 새면 안 된다
                st, o2 = get(c, '/api/dt-v2/graph/options', hdr2)
                mine_divs = {d['name'] for d in (o2.get('divisions') or [])}
                real = {(p.division or '').strip() for p in Dt2Project.query.all()
                        if p.uuid in allowed}
                real.discard('')
                check('★ 필터 옵션에도 남의 사업부가 안 뜬다',
                      mine_divs <= real, str(sorted(mine_divs - real)))

            # ── 6. ③ 아무것도 쓰지 않는다 ────────────────────────────────
            print('\n── 저장하지 않는가 ──')
            before = (Dt2Project.query.count(),
                      Dt2ProjectChange.query.count(),
                      Dt2ProjectDependency.query.count())
            for url in ('/api/dt-v2/graph?layers=all',
                        '/api/dt-v2/graph/options',
                        '/api/dt-v2/graph?layers=perf,kpi&years=2026'):
                c.get(url, headers=hdr)
            db.session.expire_all()
            after = (Dt2Project.query.count(),
                     Dt2ProjectChange.query.count(),
                     Dt2ProjectDependency.query.count())
            check('★ 과제·변경이력·연결 건수가 그대로다', before == after,
                  f'{before} → {after}')

            # 액션아이템은 uuid 없는 것을 그리지 않는다(§6-B). 그 규칙도 못 박는다.
            st, ga = get(c, '/api/dt-v2/graph?layers=action', hdr)
            act = [n for n in ga['nodes'] if n['type'] == 'action']
            check('액션아이템 노드의 ref 가 uuid 다 (순번 id 가 아니다)',
                  all(not n['ref'].startswith('action:action_') for n in act),
                  str([n['ref'] for n in act[:2]]))

            # ── 취소 과제는 그리지 않는다 ──────────────────────────────
            #
            # 관계도는 "지금 무엇이 얽혀 있나" 라, 취소된 과제의 연결은 살아 있는
            # 관계가 아니다. 다른 화면들이 이미 모수에서 뺀다.
            #
            # ⚠️ 개발 DB 에는 휴지통 밖 취소 과제가 **0건**이라 있는 데이터로는
            #    검사할 수가 없다. 그래서 살아 있는 과제 하나를 **세션 안에서만**
            #    취소로 바꿔 보고 곧바로 롤백한다 (커밋하지 않는다).
            print('\n── 취소 과제 ──')
            victim = next((p for p in Dt2Project.query.filter(
                Dt2Project.is_deleted.is_(False),
                Dt2Project.is_permanently_deleted.is_(False)).all()
                if (p.status or '').strip() != '취소'), None)
            if victim is None:
                check('시험할 살아 있는 과제가 있다', False)
            else:
                ref = f'project:{victim.uuid}'
                st, before = get(c, '/api/dt-v2/graph', hdr)
                check('바꾸기 전에는 그래프에 있다',
                      any(n['ref'] == ref for n in before['nodes']))
                was = victim.status
                try:
                    victim.status = '취소'
                    db.session.flush()          # 커밋하지 않는다
                    st, after = get(c, '/api/dt-v2/graph', hdr)
                    refs = {n['ref'] for n in after['nodes']}
                    check('★ 취소로 바꾸면 그래프에서 빠진다', ref not in refs)
                    check('나머지 과제는 그대로다',
                          len([n for n in after['nodes'] if n['type'] == 'project'])
                          == len([n for n in before['nodes'] if n['type'] == 'project']) - 1)
                    # 엣지도 함께 빠져야 한다 — 노드만 빼면 유령 점이 생긴다
                    ends = {e['source'] for e in after['edges']} \
                        | {e['target'] for e in after['edges']}
                    check('★ 그 과제로 가는 엣지도 함께 빠진다', ref not in ends)
                    check('엣지의 양 끝이 여전히 다 노드다', ends <= refs,
                          str(list(ends - refs)[:2]))

                    # includeDeleted 는 "지금 없는 것까지" — 취소도 되돌아온다
                    st, all_ = get(c, '/api/dt-v2/graph?includeDeleted=1', hdr)
                    check('includeDeleted=1 이면 취소도 보인다',
                          ref in {n['ref'] for n in all_['nodes']})

                    # AI 분석도 **같은 모수**여야 한다
                    from app.modules.digital_twin_dashboard.ai import graph_agent as GA
                    scope = GA.Scope(admin)
                    check('★ AI 분석 모수에서도 빠진다',
                          victim.uuid not in scope.uuids)
                finally:
                    victim.status = was
                    db.session.rollback()       # 흔적을 남기지 않는다
                still = Dt2Project.query.filter_by(uuid=victim.uuid).first()
                check('★ 시험이 과제 상태를 바꾸지 않았다',
                      (still.status or '') == (was or ''),
                      f'{still.status} vs {was}')

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
