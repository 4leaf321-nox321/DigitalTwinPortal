"""
액션아이템 이력의 **경계**를 잰다 (읽기 전용)

무엇에 쓰나
    0.5.0 부터 진척률의 과거 값을 되짚지 않고 저장된 이력(dt2_project_history)에서
    읽는다. 이력이 없던 시절은 예전처럼 되짚기로 떨어진다.

    그 **경계에서 곡선이 튈 수 있다.** 이력 기능이 켜진 날 찍힌 첫 행이 그때의
    실제 상태가 아니라 **이관 도중 상태**를 잡았다면, 그날 한 점만 푹 꺼진다.
    개발 DB 가 그랬다 — 8/02 에 86/303(28%), 다음 날 122/303(40%). 하루에 완료가
    36건 늘 리 없으니 그건 일이 된 게 아니라 데이터가 들어온 것이다.

    운영은 다를 수 있다. 이력이 켜질 때 데이터가 안정적이었다면 첫 행도 멀쩡해서
    골짜기가 없다. **그것을 눈으로 확인하려고** 이 스크립트를 만들었다.

        python scripts\\dt2_ai_history_boundary.py
        python scripts\\dt2_ai_history_boundary.py --year 2026 --division MX

무엇을 보나
    1) 살아있는 과제들의 **첫 이력 날짜** 분포 — 언제부터 기록이 있나
    2) 날짜별로 몇 %가 이력으로 답할 수 있나 — 경계가 어디인가
    3) 경계 앞뒤 곡선 세 줄
           지금        v0.5.0 이 그리는 값 (첫 행 포함)
           첫행 건너뜀  첫 이력 행을 「기록 시작 표시」로 보고 건너뛴 값
           되짚기만     0.4.x 까지 그리던 값

어떻게 읽나
    「지금」이 앞뒤보다 **혼자 푹 꺼진 날**이 있으면 그것이 가짜 골짜기다.
    그러면 첫 행을 건너뛰는 쪽으로 고쳐야 한다 — 「첫행 건너뜀」 줄이 그 결과다.
    꺼지는 날이 없으면 그대로 두어도 된다.

⚠️ 이 스크립트의 「되짚기」는 화면 계산을 **그대로 옮긴 것이 아니라 진단용 근사**다.
   과제 편입ㆍ삭제 시점을 따지지 않고 지금 살아있는 과제만 센다. 경계에서 곡선이
   튀는지 보는 데는 충분하지만, 화면 숫자와 소수점까지 맞지는 않는다.

읽기만 한다. 쓰는 문장이 없다.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402
from sqlalchemy import text  # noqa: E402


def _items(raw):
    if isinstance(raw, list):
        return raw
    if not raw:
        return []
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return []


def _derived_counts(items, ymd):
    """되짚기 — 오늘 남아 있는 항목 + 완료일. 지워진 항목은 볼 수 없다."""
    total = done = 0
    for it in items:
        total += 1
        d = str(it.get('완료일') or '').strip()[:10]
        if it.get('완료여부') and d and d <= ymd:
            done += 1
    return total, done


def _pct(done, total):
    return (100.0 * done / total) if total else 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--year', type=int, default=date.today().year)
    ap.add_argument('--division', default=None)
    args = ap.parse_args()

    app = create_app()
    with app.app_context():
        where = "year = :y AND is_deleted = false AND status <> '취소'"
        params = {'y': args.year}
        if args.division:
            where += " AND division = :d"
            params['d'] = args.division

        rows = db.session.execute(text(
            "SELECT uuid, title, division, action_items_json "
            "FROM dt2_projects WHERE " + where), params).fetchall()
        if not rows:
            print(f'{args.year}년 살아있는 과제가 없습니다.')
            return

        uuids = [r.uuid for r in rows]
        items_by = {r.uuid: _items(r.action_items_json) for r in rows}

        hist = db.session.execute(text(
            "SELECT project_uuid, (observed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::date AS d, "
            "       action_total, action_done, change_kind "
            "FROM dt2_project_history WHERE project_uuid = ANY(:u) "
            "ORDER BY observed_at ASC, id ASC"), {'u': uuids}).fetchall()

        # 과제 → 날짜 → 그날 마지막 값 (화면과 같은 규칙)
        per = defaultdict(dict)
        kinds = defaultdict(int)
        for h in hist:
            per[h.project_uuid][h.d.isoformat()] = (int(h.action_total or 0),
                                                    int(h.action_done or 0))
            kinds[h.change_kind] += 1

        scope = f'{args.year}년' + (f' · {args.division}' if args.division else '')
        print(f'== 액션아이템 이력 경계 · {scope} ==')
        print(f'   살아있는 과제 {len(rows)}개 · 이력 있는 과제 {len(per)}개 '
              f'· 이력 없음 {len(rows) - len(per)}개')
        print('   기록 갈래: ' + ', '.join(f'{k}={v}' for k, v in
                                       sorted(kinds.items(), key=lambda x: -x[1])))
        if not per:
            print('   이력이 하나도 없습니다 — 화면은 전부 되짚기로 떨어집니다.')
            return

        firsts = sorted(min(days) for days in per.values())
        print()
        print('-- 1) 첫 이력 날짜 분포 --')
        by_month = defaultdict(int)
        for f in firsts:
            by_month[f[:7]] += 1
        for m in sorted(by_month):
            n = by_month[m]
            print(f'   {m}   {n:4d}건  ' + '#' * min(50, max(1, n * 50 // len(firsts))))
        print(f'   가장 이른 {firsts[0]} · 중앙값 {firsts[len(firsts) // 2]} '
              f'· 가장 늦은 {firsts[-1]}')

        # 가장 많은 과제가 한날에 시작한 날 = 이력이 켜진 날로 본다
        start_count = defaultdict(int)
        for f in firsts:
            start_count[f] += 1
        boundary = max(start_count.items(), key=lambda x: x[1])[0]
        print(f'   -> 이력이 켜진 날로 보이는 것: {boundary} '
              f'({start_count[boundary]}개 과제가 이날 한꺼번에 시작)')

        print()
        print('-- 2) 경계 앞뒤 곡선 --')
        b = date.fromisoformat(boundary)
        days = [b + timedelta(days=k) for k in range(-7, 9)]
        days = [d for d in days if d <= date.today()]

        print('   날짜          지금    첫행 건너뜀   되짚기만   이력으로 답한 과제')
        prev_now = None
        flagged = []
        for d in days:
            ymd = d.isoformat()
            tot = {'now': [0, 0], 'skip': [0, 0], 'derived': [0, 0]}
            used = 0
            for u in uuids:
                items = items_by.get(u, [])
                dt_, dn_ = _derived_counts(items, ymd)
                tot['derived'][0] += dt_
                tot['derived'][1] += dn_

                dayvals = per.get(u) or {}
                keys = sorted(k for k in dayvals if k <= ymd)
                if keys:
                    used += 1
                    t, n = dayvals[keys[-1]]
                    tot['now'][0] += t
                    tot['now'][1] += n
                else:
                    tot['now'][0] += dt_
                    tot['now'][1] += dn_

                # 첫 행은 「기록 시작 표시」로 보고 건너뛴다
                first = min(dayvals) if dayvals else None
                keys2 = [k for k in keys if k != first]
                if keys2:
                    t, n = dayvals[keys2[-1]]
                    tot['skip'][0] += t
                    tot['skip'][1] += n
                else:
                    tot['skip'][0] += dt_
                    tot['skip'][1] += dn_

            now = _pct(*reversed(tot['now']))
            skip = _pct(*reversed(tot['skip']))
            der = _pct(*reversed(tot['derived']))
            share = round(100 * used / len(uuids))
            mark = ''
            if prev_now is not None and now < prev_now - 1.0:
                mark = '   <-- 꺼진다'
                flagged.append(ymd)
            print(f'   {ymd}   {now:6.1f}%   {skip:6.1f}%   {der:6.1f}%   {share:3d}%{mark}')
            prev_now = now

        print()
        print('-- 판정 --')
        if flagged:
            print(f'   가짜 골짜기로 보이는 날: {", ".join(flagged)}')
            print('   -> 첫 이력 행이 이관 도중 상태를 잡았을 수 있습니다.')
            print('      「첫행 건너뜀」 줄이 그 날에도 안 꺼지면, 그쪽으로 고치면 됩니다.')
        else:
            print('   경계에서 혼자 꺼지는 날이 없습니다. 지금대로 두어도 됩니다.')
            print('   (「지금」과 「되짚기만」의 단차는 가짜가 아닙니다 — 되짚기가 낮게')
            print('    잡고 있던 것이 바로잡히는 것이라, 숨기지 말고 밝히는 게 맞습니다.)')


if __name__ == '__main__':
    main()
