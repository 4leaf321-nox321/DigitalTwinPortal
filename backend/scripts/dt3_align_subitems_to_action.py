"""
세부항목 완료일을 **상위 액션아이템 완료일에 맞춘다.** (2026-08-07)

⚠️ `dt3_backfill_action_items.py` 와 **방향이 반대다.** 둘 중 하나만 써야 한다.

    dt3_backfill_action_items   세부항목 → 상위   (상위 완료일을 덮어쓴다)
    이 스크립트                  상위 → 세부항목   (상위 완료일을 지킨다)

왜 이 방향인가 (2026-08-07 결정)
    운영의 일정·완료 보고가 **상위 액션아이템 완료일 기준으로 이미 나갔다.**
    그 날짜가 바뀌면 이미 보고된 숫자와 어긋난다. 그래서 지금 정합성을 맞출 때는
    상위 완료일이 정본이고, 세부항목 날짜가 거기에 맞춰져야 한다.
    (앞으로 새로 입력되는 것은 서버 파생 규칙대로 세부항목이 정본이다 — 이건
     **과거 데이터를 한 번 맞추는** 도구다)

맞추는 규칙
    상위가 완료이고 완료일이 있는 액션아이템에 대해, 세부항목 완료일의 **최댓값이
    상위 완료일과 같아지도록** 만든다. 서버 파생(`_last_completed_date` = max)이
    그 값을 다시 계산해도 상위 날짜가 그대로 나오게 하는 것이 목적이다.

        · 세부 최댓값 > 상위   →  상위보다 늦은 세부를 **전부** 상위 날짜로 당긴다
                                 (하나만 당기면 그 다음으로 늦은 것이 또 최댓값이 된다)
        · 세부 최댓값 < 상위   →  **가장 늦은 세부 하나**를 상위 날짜로 민다
        · 세부에 날짜가 하나도 없음 → 손대지 않는다
                                 (`normalize_action_items` 가 그 경우 상위 완료일을
                                  그대로 두므로 이미 안전하다)

    상위의 `완료여부`·`완료일`·`목표일` 은 **읽기만 한다. 절대 쓰지 않는다.**

안전장치
    고친 배열을 서버와 **같은 함수**(`normalize_action_items`)에 넣어 보고,
    상위 완료일이 원래 값 그대로 나오는지 확인한 뒤에만 보낸다. 하나라도 어긋나면
    그 과제는 보내지 않고 목록에 남긴다 — 조용히 덮는 것이 이 작업에서 가장 나쁘다.

사용법
    python scripts\\dt3_align_subitems_to_action.py            # 조사만 (기본)
    python scripts\\dt3_align_subitems_to_action.py --commit   # 반영
    python scripts\\dt3_align_subitems_to_action.py --limit 5  # 앞 N 건만
"""

from __future__ import annotations

import argparse
import copy
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                    # noqa: E402

from app import create_app                                            # noqa: E402
from app.modules.auth.models import User                              # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project   # noqa: E402
# 파생 규칙의 **정본**. 여기서 다시 구현하지 않는다.
from app.modules.digital_twin_dashboard.routes_v2 import (            # noqa: E402
    _status_conflict, normalize_action_items,
)

REASON = '세부항목 완료일을 상위 액션아이템 완료일에 맞춤 (보고 기준 보존)'


def _d(v):
    return str(v or '').strip()


def align_items(items):
    """상위 완료일을 지키도록 세부항목 날짜를 고친다. (새 배열, 변경내역) 반환."""
    if not isinstance(items, list):
        return items, []
    out, notes = [], []
    for it in items:
        if not isinstance(it, dict):
            out.append(it)
            continue
        subs = it.get('세부항목목록')
        parent = _d(it.get('완료일'))
        if not isinstance(subs, list) or not subs or not parent \
                or not bool(it.get('완료여부')):
            out.append(it)
            continue

        dated = [s for s in subs if isinstance(s, dict) and _d(s.get('완료일'))]
        if not dated:
            # 서버가 이 경우 상위 완료일을 유지한다 — 손댈 이유가 없다
            out.append(it)
            continue

        mx = max(_d(s.get('완료일')) for s in dated)
        if mx == parent:
            out.append(it)
            continue

        it = copy.deepcopy(it)
        subs = it['세부항목목록']
        title = str(it.get('제목') or it.get('id') or '?')
        if mx > parent:
            # 상위보다 늦은 것을 **전부** 당긴다
            for s in subs:
                if isinstance(s, dict) and _d(s.get('완료일')) > parent:
                    notes.append((title, str(s.get('내용') or '?'),
                                  _d(s.get('완료일')), parent, '당김'))
                    s['완료일'] = parent
        else:
            # 가장 늦은 것 **하나**를 민다
            for s in subs:
                if isinstance(s, dict) and _d(s.get('완료일')) == mx:
                    notes.append((title, str(s.get('내용') or '?'), mx, parent, '밈'))
                    s['완료일'] = parent
                    break
        out.append(it)
    return out, notes


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    ap = argparse.ArgumentParser()
    ap.add_argument('--commit', action='store_true',
                    help='실제로 반영한다. 없으면 무엇이 바뀔지만 보여준다.')
    ap.add_argument('--email', default='yjtwin.park@samsung.com',
                    help='어느 계정으로 고칠지. 전 과제를 고칠 수 있어야 한다.')
    ap.add_argument('--limit', type=int, default=0, help='앞에서 N 건만')
    args = ap.parse_args()

    app = create_app()
    with app.app_context():
        actor = User.query.filter_by(email=args.email).first()
        if actor is None:
            print(f'[FAIL] 계정을 찾을 수 없습니다: {args.email}')
            return 1

        rows = (Dt2Project.query
                .filter_by(is_deleted=False, is_permanently_deleted=False)
                .order_by(Dt2Project.code).all())

        todo, unsafe, conflicts = [], [], []
        n_pull = n_push = 0
        for p in rows:
            items = p.action_items_json or []
            fixed, notes = align_items(items)
            if not notes:
                continue

            # ★ 안전장치 — 서버와 **같은 함수**로 돌려 보고 상위 완료일이 그대로인지 본다.
            check = normalize_action_items(fixed)
            bad = [
                (str(a.get('제목') or '?'), _d(a.get('완료일')), _d(b.get('완료일')))
                for a, b in zip(items, check)
                if isinstance(a, dict) and isinstance(b, dict)
                and _d(a.get('완료일')) != _d(b.get('완료일'))
            ]
            if bad:
                unsafe.append((p, bad))
                continue

            why = _status_conflict(p, {})
            if why:
                conflicts.append((p, why))
                continue

            todo.append((p, fixed, notes))
            for _t, _c, _o, _n, kind in notes:
                if kind == '당김':
                    n_pull += 1
                else:
                    n_push += 1
            if args.limit and len(todo) >= args.limit:
                break

        print(f'대상 {len(rows)}건 · 손볼 것 {len(todo)}건')
        print(f'  세부항목 날짜 조정: 당김(상위보다 늦었음) {n_pull}건 · '
              f'밈(상위보다 일렀음) {n_push}건')
        print('  ※ 상위 액션아이템의 완료일·완료여부는 하나도 바뀌지 않는다')
        for p, _fixed, notes in todo:
            print(f'  {(p.code or p.uuid[:8]):<12} [{p.status or "-":<5}] '
                  f'{(p.title or "")[:26]:<28}')
            for title, content, old, new, kind in notes:
                print(f'      {title[:20]:<22} └ {content[:22]:<24} '
                      f'{old} → {new}  ({kind})')

        if unsafe:
            print(f'\n⚠️ 보내지 않은 과제 {len(unsafe)}건 — 고쳐도 상위 완료일이 '
                  '그대로 재현되지 않는다. 손으로 봐야 한다.')
            for p, bad in unsafe[:10]:
                for title, was, now in bad:
                    print(f'  {(p.code or p.uuid[:8]):<12} {title[:24]:<26} '
                          f'상위 완료일 {was} → {now} 가 되어 버림')

        if conflicts:
            print(f'\n⚠️ 진행상태가 액션아이템과 어긋나 뺀 과제 {len(conflicts)}건 — '
                  '그 상태로는 저장 자체가 400 이다.')
            for p, why in conflicts:
                print(f'  {(p.code or p.uuid[:8]):<12} {why.splitlines()[0][:60]}')

        if not todo:
            print('\n맞출 것이 없다.')
            return 0
        if not args.commit:
            print(f'\n--commit 을 주면 위 {len(todo)}건을 반영한다. '
                  '지금은 아무것도 쓰지 않았다.')
            return 0

        token = create_access_token(identity=str(actor.id))
        H = {'Authorization': f'Bearer {token}'}
        c = app.test_client()

        ok, failed = 0, []
        for p, fixed, _notes in todo:
            r = c.patch(f'/api/dt-v2/projects/{p.uuid}', headers=H,
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
        return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
