"""
파생값 백필 — **사본이 정본과 어긋난 것**을 한 번에 맞춘다. (2026-08-05)

무엇이 사본인가
    이 시스템에는 "다른 값에서 만들어지는 표시용 사본" 이 넷 있다.
    화면은 저장할 때마다 정본에서 다시 만드는데, **서버에는 그 규칙이 없었다.**
    그래서 화면을 안 거친 쓰기(MCP·API·시드·이관)로 들어온 것은 갈라져 있다.

        담당자 · 과제참여인력   ←  과제참여인력목록   (dt2_projects)
        담당부서               ←  담당부서목록       (dt2_projects)
        관리자                 ←  과제PL             (dt2_projects)
        단위 · 달성형여부       ←  소분류             (dt2_performances)

    2026-08-05 에 서버가 파생시키도록 고쳤지만, 그 파생은 **정본이 저장될 때만**
    돈다(매번 돌리면 변경 이력이 오염되고 낙관적 락이 헛돈다 — 실측으로 확인).
    그래서 **이미 어긋나 있는 것**은 이 스크립트가 한 번에 맞춘다.

    ⚠️ 안 맞추고 두면, 몇 달 뒤 **아무 상관없는 이유로** 그 행을 저장하는 순간
       값이 바뀐다. 저장한 사람은 자기가 안 건드린 값이 바뀐 것을 보게 된다.
       한 번에 알고 맞추는 편이 낫다.

어떻게
    · 판정 규칙을 **여기 다시 적지 않는다.** 서버의 파생 함수를 그대로 불러 쓴다
      (`_derive_people_copies` · `_derive_manager` · `_derive_perf_from_subcategory`).
      여기에 같은 계산을 또 적으면 사본이 갈려서, 이 백필이 필요해진 것과 같은
      문제가 된다.
    · 쓸 때는 **PATCH API 를 지난다.** 직접 UPDATE 하면 값만 바뀌고
      "누가 왜 바꿨는지" 가 이력에 안 남는다.

사용법
    python scripts\\dt3_backfill_derived.py                  # 조사만 (기본 · 아무것도 안 쓴다)
    python scripts\\dt3_backfill_derived.py --commit         # 실제 반영
    python scripts\\dt3_backfill_derived.py --email <관리자 이메일>
    python scripts\\dt3_backfill_derived.py --limit 20       # 앞 N 건만
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                    # noqa: E402

from app import create_app                                            # noqa: E402
from app.modules.auth.models import User                              # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import (             # noqa: E402
    Dt2Performance, Dt2Project,
)
# 파생 규칙의 **정본**. 여기서 다시 구현하지 않는다.
from app.modules.digital_twin_dashboard.routes_v2 import (             # noqa: E402
    _derive_manager, _derive_people_copies, _derive_perf_from_subcategory,
)

PROJ_API = '/api/dt-v2/projects'
PERF_API = '/api/dt-v2/performances'


def _readable(v):
    return '' if v is None else v


def scan_projects(limit=None):
    """어긋난 과제와 **무엇을 보내야 고쳐지는가**(정본 필드)를 함께 돌려준다."""
    out = []
    q = Dt2Project.query.filter(Dt2Project.is_deleted.isnot(True))
    for p in q.order_by(Dt2Project.code).all():
        want, send = {}, {}

        # 담당자·과제참여인력·담당부서 — 정본을 그대로 되보내면 서버가 사본을 만든다.
        cols = {}
        if p.members_json is not None:
            cols['members_json'] = p.members_json
        if p.depts_json is not None:
            cols['depts_json'] = p.depts_json
        if cols:
            _derive_people_copies(cols, p)
            for k in ('owners_json', 'member_names', 'dept_name'):
                if k in cols and _readable(getattr(p, k)) != _readable(cols[k]):
                    want[k] = cols[k]
            if 'members_json' in cols and (
                    'owners_json' in want or 'member_names' in want):
                send['과제참여인력목록'] = p.members_json
            if 'depts_json' in cols and 'dept_name' in want:
                send['담당부서목록'] = p.depts_json

        # 관리자 ← 과제PL
        m = {'pl_name': p.pl_name}
        _derive_manager(m)
        if _readable(p.manager_name) != _readable(m.get('manager_name')):
            want['manager_name'] = m.get('manager_name')
            send['과제PL'] = p.pl_name

        if want:
            out.append((p, want, send))
            if limit and len(out) >= limit:
                break
    return out


def scan_performances(limit=None):
    out = []
    q = Dt2Performance.query.filter(Dt2Performance.is_deleted.isnot(True))
    for f in q.order_by(Dt2Performance.code).all():
        d = {'category': f.category, 'subcategory': f.subcategory}
        _derive_perf_from_subcategory(d, f)
        want = {k: d[k] for k in ('unit', 'is_achievement_type')
                if k in d and _readable(getattr(f, k)) != _readable(d[k])}
        if want:
            out.append((f, want))
            if limit and len(out) >= limit:
                break
    return out


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    ap = argparse.ArgumentParser()
    ap.add_argument('--commit', action='store_true',
                    help='실제로 반영한다. 없으면 조사만 하고 아무것도 쓰지 않는다.')
    ap.add_argument('--email', default=None, help='실행할 관리자 계정 (기본: 아무 admin)')
    ap.add_argument('--limit', type=int, default=None, help='앞 N 건만')
    ap.add_argument('--all', action='store_true', dest='show_all',
                    help='어긋난 것을 **전부** 찍는다 (기본은 예시 12건).')
    args = ap.parse_args()

    app = create_app()
    with app.app_context():
        actor = (User.query.filter_by(email=args.email).first() if args.email
                 else User.query.filter_by(role='admin').first())
        if actor is None:
            print('[중단] 실행할 관리자 계정을 찾지 못했다. --email 로 지정할 것.')
            return 1
        H = {'Authorization': f'Bearer {create_access_token(identity=str(actor.id))}'}
        client = app.test_client()

        projects = scan_projects(args.limit)
        perfs = scan_performances(args.limit)

        n_proj = Dt2Project.query.filter(Dt2Project.is_deleted.isnot(True)).count()
        n_perf = Dt2Performance.query.filter(
            Dt2Performance.is_deleted.isnot(True)).count()

        # 어느 사본이 몇 건 어긋났는지. **합계보다 이게 먼저 읽혀야 한다** —
        # "과제 101건 어긋남" 만으로는 무엇이 바뀔지 알 수 없어서 사람이 판단을 못 한다.
        # (2026-08-07 운영 반출 준비 중 요청)
        LABEL = {
            'owners_json': '담당자',
            'member_names': '과제참여인력',
            'dept_name': '담당부서',
            'manager_name': '관리자',
            'unit': '단위',
            'is_achievement_type': '달성형여부',
        }

        # 필드별로 세되 **'공란 채움' 과 '값 변경' 을 가른다** (2026-08-07 요청).
        #   채움 = 사본이 비어 있어서 정본에서 만들어 넣는 것 — 잃는 것이 없다.
        #   변경 = 사본에 값이 있었는데 정본과 달랐던 것 — **어느 쪽이 맞는지 봐야 한다.**
        def by_field(rows):
            c = {}
            for obj, want in [(it[0], it[1]) for it in rows]:
                for k in want:
                    cur = _readable(getattr(obj, k))
                    blank = cur in ('', None, [], {})
                    a, b = c.get(k, (0, 0))
                    c[k] = (a + 1, b) if blank else (a, b + 1)
            return c

        def fmt_field(c):
            out = []
            for k, (fill, chg) in c.items():
                bits = []
                if fill:
                    bits.append(f'공란 채움 {fill}')
                if chg:
                    bits.append(f'값 변경 {chg}')
                out.append(f'{LABEL.get(k, k)} {fill + chg}건({" · ".join(bits)})')
            return ' · '.join(out)

        def show(rows, get_obj, width):
            n = len(rows) if args.show_all else 12
            for item in rows[:n]:
                obj, want = get_obj(item), item[1]
                bits = ' · '.join(
                    f'{LABEL.get(k, k)} {_readable(getattr(obj, k))!r} → {v!r}'
                    for k, v in want.items())
                print(f'    {(obj.code or obj.uuid[:8]):{width}} '
                      + (bits if args.show_all else bits[:96]))
            if len(rows) > n:
                print(f'    … 외 {len(rows) - n}건  (전부 보려면 --all)')

        print('── 조사 ──────────────────────────────────────────────')
        print(f'  과제 {n_proj}건 중 어긋남 {len(projects)}건')
        pf = by_field(projects)
        if pf:
            print('    어긋난 사본: ' + fmt_field(pf))
        show(projects, lambda it: it[0], 12)

        print(f'  성과 {n_perf}건 중 어긋남 {len(perfs)}건')
        ff = by_field(perfs)
        if ff:
            print('    어긋난 사본: ' + fmt_field(ff))
        show(perfs, lambda it: it[0], 16)

        if not projects and not perfs:
            print('\n어긋난 것이 없다. 할 일 없음.')
            return 0

        if not args.commit:
            print('\n--commit 을 주면 반영한다. 지금은 아무것도 쓰지 않았다.')
            return 0

        print('\n── 반영 ──────────────────────────────────────────────')
        ok = fail = 0
        for p, want, send in projects:
            if not send:
                # 보낼 정본이 없다 = 사본만 있고 정본이 비어 있는 경우.
                # 조용히 넘기지 않는다 — 손으로 봐야 할 건이다.
                print(f'    [건너뜀] {p.code or p.uuid[:8]} — 되보낼 정본이 없다: {want}')
                fail += 1
                continue
            r = client.patch(f'{PROJ_API}/{p.uuid}', headers=H,
                             json={'patch': send, 'ignore_unknown': True,
                                   'reason': '파생값 백필 (사본을 정본에 맞춤)'})
            if r.status_code == 200:
                ok += 1
            else:
                fail += 1
                print(f'    [실패] {p.code or p.uuid[:8]} {r.status_code} '
                      f'{(r.get_json() or {}).get("message", "")[:70]}')

        for f, want in perfs:
            # 단위는 보내도 소분류 값으로 덮인다 — 그게 요점이다.
            r = client.patch(f'{PERF_API}/{f.uuid}', headers=H,
                             json={'patch': {'단위': want.get('unit', f.unit)},
                                   'ignore_unknown': True,
                                   'reason': '파생값 백필 (단위를 소분류에 맞춤)'})
            if r.status_code == 200:
                ok += 1
            else:
                fail += 1
                print(f'    [실패] {f.code or f.uuid[:8]} {r.status_code} '
                      f'{(r.get_json() or {}).get("message", "")[:70]}')

        print(f'  반영 {ok}건 · 실패 {fail}건')

        # 다시 세어 본다 — "고쳤다" 를 말로만 하지 않는다.
        left_p, left_f = len(scan_projects()), len(scan_performances())
        print(f'\n  남은 어긋남 — 과제 {left_p} · 성과 {left_f}')
        return 0 if (left_p == 0 and left_f == 0 and fail == 0) else 1


if __name__ == '__main__':
    sys.exit(main())
