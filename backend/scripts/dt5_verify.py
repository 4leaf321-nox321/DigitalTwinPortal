"""반입 전/후 점검 — 선행 과제 + 액션아이템 정체성. **아무것도 쓰지 않는다.**

운영 작업자가 런북 5 에서 두 번 돌린다(백필 전 · 백필 후). 몇 초면 끝난다.

여기서 잡으려는 것은 **운영 데이터에만 있을 수 있는 함정**이다. 개발 DB 에는
선행과제가 2건뿐이고 액션아이템 활동로그가 0건이라, 아래 것들은 개발에서 볼 수 없다.

    ① 이미 들어 있는 **순환**(A→B→A)
       새 저장 경로는 순환을 400 으로 막는다. 그런데 옛 데이터에 이미 순환이 있으면
       그 과제는 **선행 연결을 고치려 할 때마다 400 을 본다.** 미리 알아야 안내할 수 있다.
    ② **끊긴 연결** (대상 과제가 영구 삭제됨)
       읽기는 되지만, 그 과제의 선행 연결을 저장하려 하면 400 이다.
       화면이 '삭제되었거나 볼 수 없는 과제' 로 표시하니 사용자가 지우면 된다 — 건수만 안다.
    ③ 액션아이템 **uuid 현황**과 중복
    ④ 액션아이템에 붙은 **활동 로그 건수** (옛 로그는 그대로 두고 손대지 않는다)

실행: python scripts\\dt5_verify.py
"""
from __future__ import annotations

import os
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect as sa_inspect                       # noqa: E402

from app import create_app                                         # noqa: E402
from app.extensions import db                                      # noqa: E402
from app.modules.digital_twin_dashboard.models import (            # noqa: E402
    DashboardActivityLog,
)
from app.modules.digital_twin_dashboard.models_v2 import (         # noqa: E402
    Dt2Project, Dt2ProjectDependency,
)

oks, fails, notes = [], [], []


def check(desc, ok, extra=''):
    print(f"  {'[OK]  ' if ok else '[FAIL]'} {desc}" + (f'   {extra}' if extra else ''))
    (oks if ok else fails).append(desc)


def info(line):
    print(f'  [정보] {line}')
    notes.append(line)


def find_cycles(edges):
    """`edges` = {src: [dst...]}. 순환에 낀 노드 집합을 돌려준다 (DFS 색칠)."""
    WHITE, GRAY, BLACK = 0, 1, 2
    color = defaultdict(int)
    bad = set()

    for start in list(edges):
        if color[start] != WHITE:
            continue
        # 재귀 대신 명시적 스택 — 깊은 사슬에서 파이썬 재귀 한도를 넘지 않게.
        stack = [(start, iter(edges.get(start, ())))]
        color[start] = GRAY
        path = [start]
        while stack:
            node, it = stack[-1]
            nxt = next(it, None)
            if nxt is None:
                color[node] = BLACK
                stack.pop()
                path.pop()
                continue
            if color[nxt] == GRAY:
                # 되돌아왔다 — path 에서 nxt 부터 끝까지가 순환이다
                if nxt in path:
                    bad.update(path[path.index(nxt):])
                else:
                    bad.add(nxt)
                continue
            if color[nxt] == WHITE:
                color[nxt] = GRAY
                path.append(nxt)
                stack.append((nxt, iter(edges.get(nxt, ()))))
    return bad


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        print('=' * 68)
        print(' 디지털 트윈 — 선행 과제 · 액션아이템 정체성 점검')
        print('=' * 68)

        # ── 1. 표가 있는가 ────────────────────────────────────────────────
        print('\n1. 표 확인 (스키마 변경은 없다 — 이미 있어야 한다)')
        names = set(sa_inspect(db.engine).get_table_names())
        check('dt2_project_dependencies 가 있다',
              'dt2_project_dependencies' in names,
              '' if 'dt2_project_dependencies' in names
              else '없다면 V2 이관이 덜 된 것이다. 멈추고 개발 담당자에게 연락한다.')
        if 'dt2_project_dependencies' not in names:
            print('\n[FAIL] 표가 없어 더 볼 수 없습니다.')
            return 1

        projects = {p.uuid: p for p in Dt2Project.query.all()}
        alive = {u: p for u, p in projects.items() if not p.is_permanently_deleted}
        info(f'과제 {len(projects)}건 (영구삭제 제외 {len(alive)}건)')

        # ── 2. 선행 과제 현황 ─────────────────────────────────────────────
        print('\n2. 선행 과제 연결')
        deps = Dt2ProjectDependency.query.all()
        info(f'선행 과제 연결 {len(deps)}건')

        edges = defaultdict(list)
        dangling = []
        self_ref = []
        for d in deps:
            edges[d.project_uuid].append(d.depends_on_uuid)
            if d.depends_on_uuid == d.project_uuid:
                self_ref.append(d)
            elif d.depends_on_uuid not in projects:
                dangling.append(d)

        check('자기 자신을 가리키는 연결이 없다', not self_ref, f'{len(self_ref)}건')
        for d in self_ref[:5]:
            src = projects.get(d.project_uuid)
            print(f'          - {src.code if src else d.project_uuid[:8]}')

        # ② 끊긴 연결 — FAIL 이 아니다. 읽기는 되고, 사용자가 화면에서 지울 수 있다.
        if dangling:
            info(f'★ 끊긴 연결 {len(dangling)}건 (대상 과제가 없다)')
            for d in dangling[:8]:
                src = projects.get(d.project_uuid)
                print(f'          - {src.code if src else d.project_uuid[:8]} '
                      f'→ (없는 과제 {d.depends_on_uuid[:8]})')
            print('          이 과제들은 편집창에서 그 줄이 흐리게 "삭제되었거나 볼 수 없는')
            print('          과제" 로 뜬다. 선행 연결을 고치려면 그 줄을 먼저 지워야 한다.')
        else:
            check('끊긴 연결이 없다', True)

        # ① 순환 — 여기가 이 점검의 핵심이다
        cyc = find_cycles(edges)
        check('★ 순환(A→B→A)이 없다', not cyc, f'{len(cyc)}개 과제가 순환에 껴 있다')
        if cyc:
            for u in list(cyc)[:10]:
                p = projects.get(u)
                print(f'          - {p.code if p else u[:8]}  {(p.title if p else "")[:30]}')
            print('          이 과제들은 선행 연결을 **저장하려 할 때** 400 이 난다.')
            print('          담당자에게 한쪽 연결을 지워 달라고 안내하면 된다. 반입을')
            print('          멈출 사유는 아니다 — 지금도 화면에는 그대로 보인다.')

        # ── 3. 액션아이템 정체성 ──────────────────────────────────────────
        print('\n3. 액션아이템 정체성 (uuid)')
        total = with_uuid = odd = 0
        seen = Counter()
        no_id = 0
        for p in projects.values():
            items = p.action_items_json
            if not isinstance(items, list):
                continue
            for it in items:
                if not isinstance(it, dict):
                    odd += 1
                    continue
                total += 1
                u = str(it.get('uuid') or '').strip()
                if u:
                    with_uuid += 1
                    seen[u] += 1
                if 'id' not in it:
                    no_id += 1

        info(f'액션아이템 {total}건 · uuid 있음 {with_uuid}건 · 없음 {total - with_uuid}건')
        if odd:
            info(f'dict 가 아닌 원소 {odd}건 (백필이 건드리지 않는다)')
        info(f'id 가 없는 항목 {no_id}건 (원래 없던 것 — 백필이 만들어 주지 않는다)')

        dups = [u for u, n in seen.items() if n > 1]
        check('★ uuid 가 겹치지 않는다', not dups, f'{len(dups)}개 겹침')
        for u in dups[:5]:
            print(f'          - {u} ({seen[u]}번)')

        if with_uuid == total and total:
            check('★ 전부 uuid 를 가지고 있다 (백필 완료 상태)', True)
        else:
            info('★ 아직 백필 전이다 — 런북 6장에서 채운다.')

        # ── 4. 액션아이템 활동 로그 (건드리지 않는다) ─────────────────────
        print('\n4. 액션아이템 활동 로그')
        try:
            ai_logs = DashboardActivityLog.query.filter(
                DashboardActivityLog.target_type == 'action_item').count()
            all_logs = DashboardActivityLog.query.count()
            info(f'활동 로그 전체 {all_logs}건 · 액션아이템 대상 {ai_logs}건')
            print('          옛 로그는 **그대로 둔다.** 화면은 target_id 를 읽지 않고')
            print('          이름(target_name)과 요약만 보여주므로 영향이 없다.')
        except Exception as exc:                                   # noqa: BLE001
            info(f'활동 로그를 세지 못했다 ({exc}) — 반입을 멈출 사유는 아니다.')

        # ── 정리 ─────────────────────────────────────────────────────────
        print()
        print('=' * 68)
        if fails:
            print(f' 결과: [FAIL] {len(fails)}건 — 멈추고 위 내용을 확인하세요.')
            for f in fails:
                print(f'   - {f}')
        else:
            print(f' 결과: [OK] {len(oks)}/{len(oks)} — 다음 단계로 넘어가도 됩니다.')
        print('=' * 68)
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
