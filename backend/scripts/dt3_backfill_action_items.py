"""
액션아이템 파생 백필 — 상위 완료여부·완료일·진행률을 액션아이템에 맞춘다. (2026-08-03)

왜 필요한가
    파생이 화면에만 있던 동안, 화면을 안 거친 쓰기(MCP·API·시드)로 만들어진 과제는
    상위 액션아이템 완료여부와 진행률이 세부항목과 어긋난 채 저장돼 있다.
    서버 파생을 켜도 그 과제들은 **다음에 저장될 때** 제각각 값이 튄다. 그러면
    진척 이력에 계단이 여기저기 생겨 추이를 읽을 수 없다.
    한 번에 정리하고 시작하면 계단이 한 시점에 한 번만 생긴다.

어떻게
    DB 에 직접 쓰지 않고 **PATCH API 를 지난다**(시드와 같은 방식). 그래야
    변경 이력(dt2_project_changes)과 진척 이력(dt2_project_history)이 정상적으로
    남는다. 직접 UPDATE 하면 값만 바뀌고 "누가 왜 바꿨는지" 가 사라진다.

    파생 규칙은 **서버 함수를 그대로 불러 쓴다**(routes_v2). 여기에 같은 계산을
    또 적으면 사본이 갈려서, 애초에 이 백필이 필요해진 것과 같은 문제가 된다.

사용법
    python scripts\\dt3_backfill_action_items.py              # 조사만 (기본)
    python scripts\\dt3_backfill_action_items.py --commit     # 실제 반영
    python scripts\\dt3_backfill_action_items.py --commit --email <관리자 이메일>
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                    # noqa: E402

from app import create_app                                            # noqa: E402
from app.modules.auth.models import User                              # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project   # noqa: E402
from app.modules.digital_twin_dashboard.routes_v2 import (            # noqa: E402
    _status_conflict, derive_progress, normalize_action_items,
)

REASON = '액션아이템 파생 백필 — 상위 완료여부·진행률을 액션아이템에 맞춤'

# 바뀌는 것의 **유형**. `--only` 로 골라 볼 수 있다 (2026-08-07 요청).
#
# ⚠️ `표기정리` 둘이 따로 있는 이유 — `None` 과 `''`(그리고 `None` 과 `False`)는
#    화면에서 **똑같이** 보이지만 JSON 으로는 다른 값이다. 이걸 '채움' 으로 세면
#    "빈칸에 날짜가 들어간다" 로 읽혀서 건수가 부풀고, 정작 봐야 할 진짜 변경이
#    묻힌다. 눈에 보이는 변화가 없는 것은 따로 센다.
KINDS = {
    'done-on':      '완료여부 false→true',
    'done-off':     '완료여부 true→false',
    'done-null':    '완료여부 표기정리 (None→false · 화면 동일)',
    'date-fill':    '완료일 채움',
    'date-clear':   '완료일 지움',
    'date-later':   '완료일 미룸 (세부가 더 늦음)',
    'date-earlier': '완료일 앞당김 (상위가 더 늦었음)',
    'date-null':    "완료일 표기정리 (None→'' · 화면 동일)",
    'progress':     '진행률 변경',
}


def _txt(v):
    """`None` 과 `''` 를 같은 것으로 본다 — 화면에 보이는 값 기준."""
    return '' if v is None else str(v)


def item_kinds(old, new):
    """액션아이템 한 건이 어떻게 바뀌는가. (유형키, 설명문구) 목록."""
    out = []
    if old.get('완료여부') != new.get('완료여부'):
        o, n = old.get('완료여부'), new.get('완료여부')
        if o is None:
            out.append(('done-null', f'완료여부 {o!r} → {n!r}'))
        else:
            out.append(('done-on' if n else 'done-off', f'완료여부 {o!r} → {n!r}'))
    if old.get('완료일') != new.get('완료일'):
        o, n = _txt(old.get('완료일')), _txt(new.get('완료일'))
        raw = f'완료일 {old.get("완료일")!r} → {new.get("완료일")!r}'
        if o == n:
            out.append(('date-null', raw))
        elif not o:
            out.append(('date-fill', raw))
        elif not n:
            out.append(('date-clear', raw))
        elif o > n:
            out.append(('date-earlier', raw))
        else:
            out.append(('date-later', raw))
    return out


def project_changes(p, fixed, now, want):
    """과제 하나가 어떻게 바뀌는가 → [(액션아이템 제목, [(유형키, 문구)])] · 진행률 유형."""
    rows = []
    for a, b in zip(p.action_items_json or [], fixed):
        if not isinstance(a, dict) or not isinstance(b, dict) or a == b:
            continue
        ks = item_kinds(a, b)
        if ks:
            rows.append((str(b.get('제목') or b.get('id') or '?'), ks))
    prog = [('progress', f'진행률 {now} → {want}')] if now != want else []
    return rows, prog


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--commit', action='store_true',
                    help='실제로 반영한다. 없으면 무엇이 바뀔지만 보여준다.')
    ap.add_argument('--email', default='yjtwin.park@samsung.com',
                    help='어느 계정으로 고칠지. 전 과제를 고칠 수 있어야 한다.')
    ap.add_argument('--limit', type=int, default=0, help='앞에서 N 건만 (시험용)')
    ap.add_argument('--only', default='',
                    help='이 유형**만** 있는 과제를 고른다 (쉼표로 여럿). '
                         '다른 유형이 섞인 과제는 빼고 따로 알려준다. '
                         + ' / '.join(KINDS))
    ap.add_argument('--any', action='store_true', dest='any_match',
                    help='--only 를 느슨하게: 그 유형이 **하나라도** 있으면 고른다. '
                         '섞인 과제도 들어오므로 반영하면 다른 유형까지 같이 바뀐다. '
                         '훑어볼 때만 쓸 것.')
    args = ap.parse_args()

    only = {k.strip() for k in args.only.split(',') if k.strip()}
    bad = only - set(KINDS)
    if bad:
        print(f'[FAIL] 모르는 유형: {", ".join(sorted(bad))}')
        print('       쓸 수 있는 것: ' + ' / '.join(KINDS))
        return 1

    app = create_app()
    with app.app_context():
        actor = User.query.filter_by(email=args.email).first()
        if actor is None:
            print(f'[FAIL] 계정을 찾을 수 없습니다: {args.email}')
            return 1

        rows = (Dt2Project.query
                .filter_by(is_deleted=False, is_permanently_deleted=False)
                .order_by(Dt2Project.code)
                .all())
        if args.limit:
            rows = rows[:args.limit]

        # 무엇이 바뀔지 먼저 다 계산한다 — 고치면서 세면 중간에 멈췄을 때
        # 얼마나 남았는지 알 수 없다.
        todo, conflicts, no_items = [], [], []
        for p in rows:
            items = p.action_items_json or []
            fixed = normalize_action_items(items)
            want = derive_progress(fixed)
            now = p.progress if p.progress is not None else 0

            # ⚠️ 액션아이템이 **한 건도 없는** 과제는 건드리지 않는다 (2026-08-07).
            #
            #    `derive_progress([]) == 0` 이고, 이 백필은 `{'액션아이템목록': []}` 을
            #    보낸다. 서버는 그 키가 patch 에 있으면 **무조건** 진행률을 다시
            #    파생시키므로(`_derive_action_items`), 배열이 그대로여도 진행률만
            #    0 으로 덮인다. 즉 **액션아이템을 안 쓴 완료 과제의 100% 가 0% 가 된다.**
            #
            #    ✅ **2026-08-11 그 구멍은 서버에서 막혔다** — 0 건이면 진행상태를 따라
            #       `완료` 는 100 이 된다(`derive_progress` 의 `status` 인자).
            #       그래도 이 건너뛰기는 **그대로 둔다**: `완료` 가 아닌 0 건 과제는
            #       여전히 0 으로 덮이고, "맞출 정본이 없으면 손대지 않는다" 는
            #       이 백필의 전제 자체는 바뀌지 않았다.
            #
            #    이 백필의 전제는 "사본을 정본에 맞춘다" 인데, 액션아이템이 없으면
            #    맞출 정본이 없다. 없는 근거로 값을 지우는 것은 고치는 게 아니다.
            #    나중에 그 과제에 액션아이템을 넣으면 그때 정상적으로 파생된다.
            if not fixed:
                if now != 0:
                    no_items.append((p, now))
                continue

            # 진행상태가 액션아이템과 어긋난 과제는 **사람이 먼저 정해야 한다.**
            # 서버가 상태를 고를 수는 없어서, 이 상태로 두면 그 과제는 어떤 저장도
            # 400 이 된다(불변식이 '이번 저장 뒤의 상태' 를 보기 때문).
            why = _status_conflict(p, {})
            if why:
                conflicts.append((p, why))

            if fixed == items and want == now:
                continue
            todo.append((p, fixed, now, want))

        # 과제마다 무엇이 어떻게 바뀌는지 미리 다 풀어 둔다 — 집계·선별·출력이
        # **같은 계산**을 봐야 숫자와 목록이 갈리지 않는다.
        detail = {}          # uuid → (액션아이템 변화 목록, 진행률 변화, 유형 집합)
        for p, fixed, now, want in todo:
            rows_, prog = project_changes(p, fixed, now, want)
            ks = {k for _n, bits in rows_ for k, _t in bits} | {k for k, _t in prog}
            detail[p.uuid] = (rows_, prog, ks)

        # 전체 집계는 **거르기 전** 기준으로 낸다 — 무엇을 골랐든 전체 그림은 같아야 한다.
        tally = {k: 0 for k in KINDS}
        for p, _f, _n, _w in todo:
            rows_, prog, _ks = detail[p.uuid]
            for _name, bits in rows_:
                for k, _t in bits:
                    tally[k] += 1
            for k, _t in prog:
                tally[k] += 1

        print(f'대상 {len(rows)}건 · 손볼 것 {len(todo)}건 · 이미 맞는 것 '
              f'{len(rows) - len(todo)}건')
        if todo:
            print('  바뀌는 것(액션아이템 단위 · 진행률은 과제 단위):')
            for k, label in KINDS.items():
                if tally[k]:
                    print(f'    {k:<13} {label:<34} {tally[k]}건')
            print('  ↑ 유형 하나만 보려면  --only <유형키>  (쉼표로 여럿)')

        shown = todo
        if only:
            # ★ 유형 하나만 **고치는** 것은 서버가 허락하지 않는다 — 저장할 때
            #   배열을 통째로 다시 정규화한다(`_derive_action_items`. 실측 확인:
            #   부분만 담아 보내도 세부항목 기준으로 되돌아온다).
            #
            #   그래서 **과제를 고른다.** 고른 유형 **말고는 바뀔 것이 없는** 과제만
            #   담으면, 반영해도 딸려 오는 변화가 없다. 이게 이 도구에서 가능한
            #   '일부만 고치기' 다. (2026-08-07 요청)
            match = [t for t in todo if detail[t[0].uuid][2] & only]
            pure = [t for t in match if not (detail[t[0].uuid][2] - only)]
            mixed = [t for t in match if detail[t[0].uuid][2] - only]

            sel = ','.join(sorted(only))
            if args.any_match:
                shown = match
                print(f'\n── --only {sel} --any → 과제 {len(match)}건 '
                      f'(섞인 것 {len(mixed)}건 포함) ──')
                if mixed:
                    extra = sorted({k for t in mixed for k in detail[t[0].uuid][2]} - only)
                    print('  ⚠️ 반영하면 아래 유형도 **같이** 바뀐다: '
                          + ' · '.join(KINDS[k] for k in extra))
            else:
                shown = pure
                print(f'\n── --only {sel} → 이 유형만 있는 과제 {len(pure)}건 '
                      f'(반영해도 딸려 오는 변화 없음) ──')
                if mixed:
                    print(f'  다른 유형이 섞여 **뺀** 과제 {len(mixed)}건 — '
                          '그 과제는 반영하면 섞인 유형까지 함께 바뀐다.')
                    for t in mixed[:10]:
                        p_ = t[0]
                        others = sorted(detail[p_.uuid][2] - only)
                        print(f'    {(p_.code or p_.uuid[:8]):<12} '
                              f'{(p_.title or "")[:24]:<26} '
                              f'+ {" · ".join(KINDS[k] for k in others)}')
                    if len(mixed) > 10:
                        print(f'    … 외 {len(mixed) - 10}건')
                    print('    (그대로 반영하려면 --any, 또는 섞인 유형을 --only 에 추가)')

        for p, fixed, now, want in shown:
            rows_, prog, ks = detail[p.uuid]
            print(f'  {(p.code or p.uuid[:8]):<12} [{p.status or "-":<5}] '
                  f'{(p.title or "")[:26]:<28} '
                  + ' · '.join(t for _k, t in prog))
            for name, bits in rows_:
                for k, text in bits:
                    star = '*' if (only and k in only) else ' '
                    print(f'      {star} {name[:28]:<30} {text}')

        if no_items:
            print(f'\n건드리지 않은 과제 {len(no_items)}건 — 액션아이템이 0건이라 '
                  '진행률을 파생시킬 근거가 없다.')
            print('  (백필이 손대면 이 과제들의 진행률이 전부 0 이 된다. 그래서 뺀다.'
                  ' 액션아이템을 넣으면 그때 정상적으로 계산된다)')
            for p, now in no_items[:15]:
                print(f'  {(p.code or p.uuid[:8]):<12} [{p.status or "-":<5}] '
                      f'{(p.title or "")[:26]:<28} 진행률 {now} 유지')
            if len(no_items) > 15:
                print(f'  … 외 {len(no_items) - 15}건')

        if conflicts:
            print(f'\n⚠️ 진행상태가 액션아이템과 어긋난 과제 {len(conflicts)}건 — '
                  '사람이 먼저 정해야 한다. 그대로 두면 이 과제들은 저장이 막힌다.')
            for p, why in conflicts:
                print(f'  {(p.code or p.uuid[:8]):<12} [{p.status or "-":<5}] '
                      f'{(p.title or "")[:26]:<28} {why.splitlines()[0]}')
        else:
            print('\n진행상태가 액션아이템과 어긋난 과제: 없음')

        if not shown:
            print('\n반영할 것이 없다.')
            return 0
        if not args.commit:
            print(f'\n--commit 을 주면 위 {len(shown)}건을 반영한다. '
                  '지금은 아무것도 쓰지 않았다.')
            return 0

        token = create_access_token(identity=str(actor.id))
        H = {'Authorization': f'Bearer {token}'}
        c = app.test_client()

        ok, failed = 0, []
        for p, fixed, _now, _want in shown:
            # `액션아이템목록` 만 보낸다. 진행률은 서버가 파생시킨다 — 여기서 같이
            # 보내면 액션아이템이 있는 과제라 400 이 아니라, 파생값에 덮여 무의미하다.
            r = c.patch(f'/api/dt-v2/projects/{p.uuid}',
                        headers=H,
                        json={'patch': {'액션아이템목록': fixed}, 'reason': REASON})
            if r.status_code == 200:
                ok += 1
            else:
                body = r.get_json(silent=True) or {}
                failed.append((p.code or p.uuid[:8], r.status_code,
                               body.get('message') or body.get('error') or ''))

        print(f'\n반영 {ok}건 · 실패 {len(failed)}건')
        for code, status, msg in failed:
            print(f'  [{status}] {code} {msg}')
        # 진행상태가 액션아이템과 어긋나 400 이 난 과제는 사람이 정해야 한다 —
        # 상태를 내릴지 액션아이템을 완료로 볼지는 서버가 고를 수 없다.
        return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
