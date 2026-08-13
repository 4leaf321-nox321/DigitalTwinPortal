"""
컷오버 후 **참여인력 경로로 편집 권한이 실제로 열리는지** 미리 재기 (읽기 전용).

무엇을 보나
    컷오버하면 `can_edit_project` 가 실제로 걸린다(공지 3번). 편집 권한은 네 경로 중
    하나로 열린다 — 소유자 · **참여인력** · 같은 사업부 manager · admin/dt_office.

        소유자   `dt3_owner_gaps.py` 로 확인했다 (운영 351/352)
        manager  `dt3_readiness.py` 로 확인했다 (운영 40/40, 352건 전부 커버)
        참여인력 **한 번도 안 세봤다** ← 이 스크립트

    참여인력 경로는 `permissions.is_project_member` 가 판정한다. **요청할 때마다**
    로그인한 사람과 과제의 `members_json`/`owners_json` 을 대조하는 방식이라,
    이관 시점에 한 번 정해지는 `owner_user_id` 와는 성격이 다르다.

        · 이메일 **@앞부분**(소문자)이 원소의 `knoxId` 와 같거나
        · 이름이 원소의 `이름` 과 정확히 같으면 (앞뒤 공백만 정리)

    ⚠️ **이름은 동명이인이 아닐 때만 쓴다.** 활성 사용자 중 같은 이름이 둘 이상이면
       그 사람은 이름으로 매칭되지 않는다(`actor_match_tokens` — 권한은 판단할 수
       없을 때 좁게 잡는다). 이 스크립트도 같은 규칙을 쓴다.

왜 미리 재나
    매칭이 안 되면 **과제PL·참여인력인데도 자기 과제를 못 고친다.** 컷오버 직후
    "수정이 안 돼요" 문의가 몰릴지 여부가 여기서 갈린다. 미리 재두면 몇 명이
    불편해질지 알고 들어갈 수 있고, knoxId 표기 문제라면 컷오버 전에 고칠 수 있다.

    admin·dt_office 와 manager 가 전 과제를 커버하므로 **"아무도 못 고치는 과제"는
    생기지 않는다.** 여기서 재는 것은 "본인이 직접 고칠 수 있는가" 다.

⚠️ 출력에 knoxId·이름이 나온다 (고치려면 누구인지 알아야 한다).
   그래서 **로그 파일을 만들지 않고 화면에만 찍는다** — 이 폴더는 통째로 압축해
   옮겨 다니므로, 파일로 남기면 의도치 않게 따라나갈 수 있다.

사용법
    python scripts\\dt3_member_coverage.py
    python scripts\\dt3_member_coverage.py --limit 0     # 미매칭 knoxId 전체 나열
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter

try:
    import psycopg
except ImportError:
    print('[FAIL] psycopg 를 찾을 수 없습니다. venv 를 활성화했는지 확인하세요.')
    sys.exit(1)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from dt_scan import load_dsn, mask_dsn, enforce_read_only
except ImportError as exc:
    print(f'[FAIL] 같은 폴더의 dt_scan.py 를 찾을 수 없습니다: {exc}')
    sys.exit(1)

# 전 과제를 고칠 수 있는 역할. 이들은 매칭과 무관하므로 '본인 경로' 집계에서 뺀다.
GLOBAL_ROLES = ('admin', 'dt_office')


def as_list(value):
    return value if isinstance(value, list) else []


def elem_tokens(element):
    """원소에서 (knoxId 소문자, 이름) 을 뽑는다. is_project_member 와 같은 규칙."""
    if isinstance(element, str):
        return None, element.strip() or None
    if not isinstance(element, dict):
        return None, None
    knox = (element.get('knoxId') or '').strip().lower() or None
    name = (element.get('이름') or '').strip() or None
    return knox, name


def main():
    ap = argparse.ArgumentParser(
        description='참여인력 편집 권한 커버리지 (읽기 전용 · 화면 출력만)')
    ap.add_argument('--dsn')
    ap.add_argument('--limit', type=int, default=15,
                    help='미매칭 knoxId 를 몇 개까지 보일지 (0 이면 전부)')
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    dsn = load_dsn(args.dsn)
    print('=' * 78)
    print(' 참여인력 편집 권한 커버리지 (읽기 전용)')
    print('=' * 78)
    print(f' 접속 : {mask_dsn(dsn)}')
    print('-' * 78)

    conn = psycopg.connect(dsn, autocommit=True)
    if not enforce_read_only(conn):
        print('[FAIL] 읽기 전용 보호를 걸지 못했습니다. 중단합니다.')
        sys.exit(1)

    try:
        cur = conn.cursor()

        # ── 1. 사용자 ────────────────────────────────────────────────────
        cur.execute("SELECT id, email, name, role FROM users WHERE is_active = true")
        users = cur.fetchall()

        by_local = {}
        name_count = Counter()
        for _uid, email, name, _role in users:
            if name and name.strip():
                name_count[name.strip()] += 1
        for uid, email, name, _role in users:
            if email and '@' in email:
                by_local.setdefault(email.split('@')[0].strip().lower(), uid)
        # 동명이인은 이름으로 매칭되지 않는다 (actor_match_tokens 와 같은 규칙)
        by_name = {}
        for uid, _email, name, _role in users:
            key = (name or '').strip()
            if key and name_count[key] == 1:
                by_name.setdefault(key, uid)

        roles = Counter(r for _i, _e, _n, r in users)
        globals_ = {uid for uid, _e, _n, role in users if role in GLOBAL_ROLES}

        print('\n── 1. 사용자 ──')
        print(f'  활성 사용자 {len(users)}명  ' +
              ' · '.join(f'{r} {c}' for r, c in roles.most_common()))
        print(f'  이메일 @앞부분으로 찾을 수 있음 : {len(by_local)}명')
        dup = sum(c for c in name_count.values() if c > 1)
        print(f'  이름으로 찾을 수 있음           : {len(by_name)}명'
              + (f'  (동명이인 {dup}명은 이름 매칭 불가)' if dup else ''))

        # ── 2. 과제의 참여인력 데이터 ────────────────────────────────────
        cur.execute("""
            SELECT uuid, code, title, owner_user_id, members_json, owners_json
              FROM dt2_projects
             WHERE NOT is_deleted AND NOT is_permanently_deleted
             ORDER BY code NULLS LAST, uuid
        """)
        projects = cur.fetchall()

        with_members = 0
        knox_all = Counter()
        knox_unmatched = Counter()
        name_only_matched = 0
        no_self_editor = []        # 소유자도 참여인력 매칭도 없는 과제
        editors_per_project = []
        user_hits = Counter()

        for uuid, code, title, owner_id, members, owners in projects:
            elems = as_list(members) + as_list(owners)
            tokens = [elem_tokens(e) for e in elems]
            tokens = [(k, n) for k, n in tokens if k or n]
            if tokens:
                with_members += 1

            matched = set()
            matched_by_name_only = False
            for knox, name in tokens:
                hit = None
                if knox:
                    knox_all[knox] += 1
                    hit = by_local.get(knox)
                    if hit is None:
                        knox_unmatched[knox] += 1
                if hit is None and name:
                    hit = by_name.get(name)
                    if hit is not None and knox:
                        matched_by_name_only = True
                if hit is not None:
                    matched.add(hit)

            if matched_by_name_only:
                name_only_matched += 1

            # 본인이 직접 고칠 수 있는 사람 = 소유자 + 참여인력 매칭 (전역 역할 제외)
            self_editors = set(matched)
            if owner_id is not None:
                self_editors.add(owner_id)
            self_editors -= globals_
            editors_per_project.append(len(self_editors))
            for uid in self_editors:
                user_hits[uid] += 1
            if not self_editors:
                no_self_editor.append((code, title))

        print('\n── 2. 과제의 참여인력 데이터 ──')
        print(f'  활성 과제 {len(projects)}건')
        print(f'  참여인력/담당자가 1명 이상 적힌 과제 : {with_members}건')
        total_knox = sum(knox_all.values())
        uniq_knox = len(knox_all)
        bad_uniq = len(knox_unmatched)
        if total_knox:
            ok_uniq = uniq_knox - bad_uniq
            print(f'  knoxId 총 {total_knox}개 (고유 {uniq_knox}개)')
            print(f'    · 계정과 매칭  : {ok_uniq}개 ({ok_uniq * 100 // max(uniq_knox, 1)}%)')
            print(f'    · 매칭 안 됨   : {bad_uniq}개')
        else:
            print('  knoxId 가 적힌 원소가 없습니다.')
        if name_only_matched:
            print(f'  knoxId 는 안 맞고 **이름으로만** 매칭된 과제 : {name_only_matched}건')
            print('    → knoxId 표기가 계정 이메일과 다르다는 뜻이다. 동명이인이 생기면'
                  ' 그 순간 매칭이 끊긴다.')

        # ── 3. 컷오버 후 "본인이 직접 고칠 수 있는가" ────────────────────
        print('\n── 3. 컷오버 후 본인 편집 가능 여부 ──')
        print('  (admin·dt_office 와 manager 경로는 제외한 순수 "본인" 기준이다.')
        print('   그 둘은 이미 확인됐다 — dt3_owner_gaps.py · dt3_readiness.py)')
        zero = sum(1 for n in editors_per_project if n == 0)
        one = sum(1 for n in editors_per_project if n == 1)
        many = sum(1 for n in editors_per_project if n >= 2)
        print(f'  본인 편집자 0명 : {zero}건   ← 사무국·manager 에게 부탁해야 한다')
        print(f'             1명 : {one}건')
        print(f'          2명 이상 : {many}건')
        print(f'  자기 과제를 1건 이상 고칠 수 있는 사람 : {len(user_hits)}명')

        if knox_unmatched:
            show = knox_unmatched.most_common(None if args.limit == 0 else args.limit)
            print(f'\n── 매칭 안 되는 knoxId {len(knox_unmatched)}종 ──')
            print('  (계정이 없거나, 이메일 @앞부분과 표기가 다르다)')
            for knox, cnt in show:
                print(f'    {knox:<24} {cnt}개 과제에 등장')
            if args.limit and len(knox_unmatched) > args.limit:
                print(f'    … 외 {len(knox_unmatched) - args.limit}종 (--limit 0 으로 전체)')

        if no_self_editor:
            print(f'\n── 본인 편집자가 0명인 과제 {len(no_self_editor)}건 ──')
            for code, title in no_self_editor[:args.limit or len(no_self_editor)]:
                print(f'    {code or "(코드없음)":<16} {title or "(이름없음)"}')
            if args.limit and len(no_self_editor) > args.limit:
                print(f'    … 외 {len(no_self_editor) - args.limit}건')

        # ── 판정 ─────────────────────────────────────────────────────────
        print('\n' + '=' * 78)
        ratio = zero * 100 // max(len(projects), 1)
        if ratio == 0:
            print(' 결과: [OK] 모든 활성 과제에 본인 편집자가 있습니다.')
        elif ratio <= 10:
            print(f' 결과: [OK] 본인 편집자가 없는 과제가 {zero}건({ratio}%)입니다.')
            print('        사무국·manager 가 커버하므로 컷오버를 막지 않습니다.')
        else:
            print(f' 결과: [확인 필요] 본인 편집자가 없는 과제가 {zero}건({ratio}%)입니다.')
            print('        컷오버 직후 "수정이 안 된다" 문의가 몰릴 수 있습니다.')
            print('        위 미매칭 knoxId 목록을 보고 표기를 맞추면 줄어듭니다.')
        print('=' * 78)
        return 0
    finally:
        conn.close()


if __name__ == '__main__':
    sys.exit(main())
