"""
「내 일」 화면 착수 전 권한 변경 영향 조사 (읽기 전용)

⚠️ **2026-08-11: 이 변경은 이미 적용됐다.** 그래서 이 스크립트는 이제 "바꾸면
   어떻게 되나" 가 아니라 **"바꿔서 무엇이 달라졌나"** 를 재는 도구다.
   아래에서 `now` 는 **옛 규칙**(이름 매칭 O · 작성자 X), `after` 는 **지금 규칙**이다.

무엇을 하나
    「내 일」 화면을 만들면서 **권한 판정 세 곳을 함께 바꿨다.** 운영 데이터로
    "실제로 누가 무엇을 얻고 잃었는가" 를 센다. 다섯 가지를 잰다.

        A. 작성자에게 편집 권한을 주면 **새로 권한을 얻는 사람·과제**
        B. 이름 매칭을 폐지하면 **권한을 잃는 사람·과제**
        C. 그 결과 **본인 경로 편집자가 0 명이 되는 과제**
        D. 조회 권한(can_view_project)에 PL·참여인력·작성자를 넣으면 새로 보이는 과제
        E. 「내가 하는 일」 렌즈의 크기 — 특히 **manager 가 작성자인 과제**

    A·B 는 서로 반대 방향이라 **함께 재야 한다.** 따로 재면 "작성자로 열었는데
    이름 매칭 폐지로 다시 닫히는" 사람을 두 번 세거나 아예 놓친다.

왜 E 를 재나
    manager 는 자기 사업부 과제를 **전부** 고칠 수 있는데, 실제로 상당수 과제를
    **본인이 작성**한다(2026-08-11 확인). 그러면 「내가 하는 일」과 「우리 사업부」가
    거의 같은 목록이 되어 **렌즈를 나눈 의미가 사라진다.**

    이건 코드로 답할 수 없고 데이터로만 답할 수 있다. 겹침이 크면 렌즈 구성을
    바꿔야 하므로, 화면을 만들기 **전에** 재야 한다.

무엇을 하지 않나
    **아무것도 쓰지 않는다.** 세션을 READ ONLY 로 고정하고 프로브로 확인한 뒤 시작한다.
    권한을 **고치지도, 고칠 값을 지어내지도 않는다** — 이 스크립트는 숫자만 낸다.

판정 규칙은 permissions.py 를 그대로 따른다
    이 스크립트는 앱 없이 도는 대신 규칙을 **다시 적는다.** 사본이 갈리면 조사가
    거짓말을 하므로, 아래 세 함수와 짝을 맞춰 두었다. 규칙을 고칠 때 여기도 볼 것.

        actor_match_tokens   local = 이메일 @앞부분(소문자) / 이름은 **유일할 때만**
        is_project_member    members_json·owners_json 의 knoxId **만** (2026-08-11)
        is_project_pl        pl_knox_id **만**
        is_project_author    author_knox_id **만** (2026-08-11 신설)

    manager 의 사업부는 `actor_division_id` 와 같게 푼다 — users.department 는 FK 가
    아니라 자유 텍스트라, departments.name 과 **이름으로** 맞추고 0 개·2 개 이상이면
    None(그 사람은 manager 경로를 못 탄다).

⚠️ 출력에 이름·knoxId·과제명이 나온다 (누구인지 알아야 고칠 수 있다).
   그래서 **로그 파일을 만들지 않고 화면에만 찍는다** — 이 폴더는 통째로 압축해
   옮겨 다니므로, 파일로 남기면 의도치 않게 따라나갈 수 있다.
   파일이 꼭 필요하면 직접 리다이렉트할 것:
       python scripts\\dt3_worklist_survey.py > x.txt

사용법
    python scripts\\dt3_worklist_survey.py
    python scripts\\dt3_worklist_survey.py --limit 0      # 목록을 전부 나열
    python scripts\\dt3_worklist_survey.py --dsn postgresql://...

의존성
    표준 라이브러리 + psycopg. 신규 패키지 없음.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter, defaultdict

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


# 사업부·소유자와 무관하게 전 과제를 고칠 수 있는 역할 (permissions.GLOBAL_EDIT_ROLES).
# 이들은 어떤 변경으로도 권한이 늘거나 줄지 않으므로 증감 집계에서 뺀다.
GLOBAL_ROLES = ('admin', 'dt_office')

# viewer 는 소유자·참여인력이어도 편집할 수 없다 (can_edit_project 의 명시적 분기).
VIEWER_ROLE = 'viewer'


def as_list(value):
    return value if isinstance(value, list) else []


def elem_tokens(element):
    """참여인력 원소에서 (knoxId 소문자, 이름). `is_project_member` 와 같은 규칙."""
    if isinstance(element, str):
        return None, (element.strip() or None)
    if not isinstance(element, dict):
        return None, None
    knox = (element.get('knoxId') or '').strip().lower() or None
    name = (element.get('이름') or '').strip() or None
    return knox, name


class Users:
    """활성 사용자 색인. `actor_match_tokens` 와 같은 규칙으로 만든다."""

    def __init__(self, rows, dept_to_div):
        self.by_id = {}
        self.role = {}
        self.division = {}
        self.label = {}

        name_count = Counter()
        for _uid, _email, name, _role, _dept in rows:
            if name and name.strip():
                name_count[name.strip()] += 1

        self.by_local = {}
        self.by_name = {}
        for uid, email, name, role, dept in rows:
            self.by_id[uid] = (email, name, role)
            self.role[uid] = role
            key = (dept or '').strip().lower()
            self.division[uid] = dept_to_div.get(key)
            local = email.split('@')[0].strip().lower() if email and '@' in email else ''
            nm = (name or '').strip()
            self.label[uid] = f'{nm or "(이름없음)"}/{local or "(knox없음)"}'
            if local:
                self.by_local.setdefault(local, uid)
            # ⚠️ 동명이인은 이름으로 매칭되지 않는다 (권한은 좁게 잡는다)
            if nm and name_count[nm] == 1:
                self.by_name.setdefault(nm, uid)

        self.dup_names = sum(c for c in name_count.values() if c > 1)

    def is_global(self, uid):
        return self.role.get(uid) in GLOBAL_ROLES

    def is_viewer(self, uid):
        return self.role.get(uid) == VIEWER_ROLE


def editors_of(project, users, *, use_name, with_author):
    """
    이 과제를 **본인 경로로** 고칠 수 있는 사용자 id 집합.

    `use_name`     이름 매칭을 인정할지 (옛 규칙=True / 지금=False)
    `with_author`  작성자 경로를 인정할지 (옛 규칙=False / 지금=True)

    manager·admin·dt_office 는 **여기 넣지 않는다.** 역할로 열리는 경로라
    이 변경의 증감과 무관하고, 섞으면 "본인이 직접 고칠 수 있는가" 를 잴 수 없다.
    """
    (_uuid, _code, _title, owner_id, members, owners,
     pl_knox, author_knox, _div_id, _pub) = project

    found = set()

    if owner_id is not None:
        found.add(owner_id)

    for el in as_list(members) + as_list(owners):
        knox, name = elem_tokens(el)
        hit = users.by_local.get(knox) if knox else None
        if hit is None and use_name and name:
            hit = users.by_name.get(name)
        if hit is not None:
            found.add(hit)

    # 과제PL — knoxId 만 본다. 이름은 지금도 보지 않으므로 use_name 과 무관하다.
    pl = (pl_knox or '').strip().lower()
    if pl:
        hit = users.by_local.get(pl)
        if hit is not None:
            found.add(hit)

    if with_author:
        au = (author_knox or '').strip().lower()
        if au:
            hit = users.by_local.get(au)
            if hit is not None:
                found.add(hit)

    # viewer 는 어느 경로로도 편집할 수 없다
    return {u for u in found if not users.is_viewer(u)}


def role_covers(uid, project, users):
    """역할로 이미 편집 권한이 있는가 (admin·dt_office·같은 사업부 manager)."""
    if users.is_global(uid):
        return True
    if users.role.get(uid) != 'manager':
        return False
    div = users.division.get(uid)
    proj_div = project[8]
    return div is not None and proj_div is not None and div == proj_div


def head(title):
    print()
    print(f'── {title} ' + '─' * max(0, 74 - len(title)))


def brief(project, width=30):
    """목록 한 줄용 과제 표기. 코드·과제명이 비어 있어도 죽지 않게."""
    code = project[1] or '(코드없음)'
    title = (project[2] or '')[:width]
    return f'{code} {title}'.rstrip()


def show(items, limit, fmt):
    shown = items if limit == 0 else items[:limit]
    for it in shown:
        print(f'    {fmt(it)}')
    if limit and len(items) > limit:
        print(f'    … 외 {len(items) - limit}건 (--limit 0 으로 전체)')


def main():
    ap = argparse.ArgumentParser(
        description='「내 일」 화면 권한 변경 영향 조사 (읽기 전용 · 화면 출력만)')
    ap.add_argument('--dsn')
    ap.add_argument('--limit', type=int, default=15,
                    help='목록을 몇 건까지 보일지 (0 이면 전부)')
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    dsn = load_dsn(args.dsn)
    print('=' * 78)
    print(' 「내 일」 화면 — 권한 변경 영향 조사 (읽기 전용)')
    print('=' * 78)
    print(f' 접속 : {mask_dsn(dsn)}')

    conn = psycopg.connect(dsn, autocommit=True)
    if not enforce_read_only(conn):
        print('[FAIL] 읽기 전용 보호를 걸지 못했습니다. 중단합니다.')
        sys.exit(1)

    try:
        cur = conn.cursor()

        # ── 0. 재료 ──────────────────────────────────────────────────────
        cur.execute("""
            SELECT lower(btrim(name)), division_id
              FROM departments
             WHERE is_active = true AND division_id IS NOT NULL
        """)
        dept_rows = cur.fetchall()
        by_dept = defaultdict(set)
        for name, div in dept_rows:
            by_dept[name].add(div)
        # 이름이 여러 사업부에 걸리면 확정할 수 없다 → None (actor_division_id 와 같다)
        dept_to_div = {k: next(iter(v)) for k, v in by_dept.items() if len(v) == 1}

        cur.execute("""
            SELECT id, email, name, role, department
              FROM users WHERE is_active = true
        """)
        users = Users(cur.fetchall(), dept_to_div)

        cur.execute("""
            SELECT uuid, code, title, owner_user_id, members_json, owners_json,
                   pl_knox_id, author_knox_id, division_id, is_division_public
              FROM dt2_projects
             WHERE NOT is_deleted AND NOT is_permanently_deleted
             ORDER BY code NULLS LAST, uuid
        """)
        projects = cur.fetchall()

        roles = Counter(users.role.values())
        no_div_mgr = [u for u, r in users.role.items()
                      if r == 'manager' and users.division.get(u) is None]

        head('0. 재료')
        print(f'  활성 사용자 {len(users.role)}명  ' +
              ' · '.join(f'{r} {c}' for r, c in roles.most_common()))
        print(f'  활성 과제   {len(projects)}건')
        if users.dup_names:
            print(f'  동명이인 {users.dup_names}명 — 지금도 이름으로는 매칭되지 않는다')
        if no_div_mgr:
            print(f'  ⚠️ 사업부를 못 푸는 manager {len(no_div_mgr)}명 — '
                  f'이들은 manager 경로가 아예 안 열린다')
            show([users.label[u] for u in no_div_mgr], args.limit, lambda s: s)

        # ── 지금 / 바꾼 뒤 편집자 집합 ───────────────────────────────────
        now = {}      # 이름 매칭 O · 작성자 X   (**옛 규칙**)
        after = {}    # 이름 매칭 X · 작성자 O   (**지금 규칙**)
        for p in projects:
            now[p[0]] = editors_of(p, users, use_name=True, with_author=False)
            after[p[0]] = editors_of(p, users, use_name=False, with_author=True)

        # ── A. 작성자 개방으로 새로 얻는 권한 ───────────────────────────
        head('A. 작성자에게 편집 권한을 주면')
        author_known = author_unknown = 0
        gained_pairs = []          # 역할로도 못 얻던 사람이 새로 얻는 (사람, 과제)
        gained_but_role = 0        # 이미 역할로 열려 있어 실질 증가 아님
        for p in projects:
            au = (p[7] or '').strip().lower()
            if not au:
                continue
            uid = users.by_local.get(au)
            if uid is None:
                author_unknown += 1
                continue
            author_known += 1
            if uid in now[p[0]]:
                continue                       # 이미 본인 경로로 열려 있었다
            if users.is_viewer(uid):
                continue                       # viewer 는 어차피 못 고친다
            if role_covers(uid, p, users):
                gained_but_role += 1
                continue
            gained_pairs.append((uid, p))

        print(f'  작성자 knoxId 가 계정과 이어지는 과제 : {author_known}건')
        print(f'  작성자 knoxId 로 계정을 못 찾는 과제  : {author_unknown}건'
              + ('  (아직 가입 전이면 정상 — 가입하면 열린다)' if author_unknown else ''))
        print(f'  이미 역할(manager·admin)로 열려 있던 과제 : {gained_but_role}건'
              f'  ← 실질 증가가 아니다')
        print(f'  ★ 실질적으로 새 편집 권한이 생기는 과제  : {len(gained_pairs)}건'
              f' / 사람 {len({u for u, _ in gained_pairs})}명')
        show(gained_pairs, args.limit,
             lambda t: f'{users.label[t[0]]:<28} ← {brief(t[1])}')

        # ── B. 이름 매칭 폐지로 잃는 권한 ───────────────────────────────
        head('B. 이름 매칭을 폐지하면')
        lost_pairs = []
        lost_but_role = 0
        for p in projects:
            for uid in now[p[0]] - after[p[0]]:
                if role_covers(uid, p, users):
                    lost_but_role += 1
                    continue
                lost_pairs.append((uid, p))

        print(f'  역할로 여전히 열려 있어 영향 없음 : {lost_but_role}건')
        print(f'  ★ 실제로 편집 권한을 잃는 과제    : {len(lost_pairs)}건'
              f' / 사람 {len({u for u, _ in lost_pairs})}명')
        if lost_pairs:
            print('     → 0 이 아니면 knoxId 를 먼저 채운 뒤에 폐지할 것')
        show(lost_pairs, args.limit,
             lambda t: f'{users.label[t[0]]:<28} ✕ {brief(t[1])}')

        # ── C. 본인 경로 편집자가 0 명이 되는 과제 ──────────────────────
        head('C. 바꾼 뒤 본인 경로 편집자가 0 명인 과제')
        orphan_now = [p for p in projects if not now[p[0]]]
        orphan_after = [p for p in projects if not after[p[0]]]
        print(f'  지금    : {len(orphan_now)}건')
        print(f'  바꾼 뒤 : {len(orphan_after)}건')
        print('  ※ manager·admin·dt_office 는 여전히 고칠 수 있다 — '
              '"아무도 못 고치는 과제" 가 아니라')
        print('     "담당자 본인이 직접 못 고치는 과제" 다.')
        show(orphan_after, args.limit,
             lambda p: brief(p, 40))

        # ── D. 조회 권한 확장 ───────────────────────────────────────────
        head('D. 조회 권한에 PL·참여인력·작성자를 넣으면')
        pub = [p for p in projects if p[9]]
        newly_visible = []
        for p in pub:
            for uid in after[p[0]]:
                if users.is_global(uid):
                    continue
                # 지금은 소유자만 예외다 — 나머지는 사업부가 같아야 볼 수 있다
                if uid == p[3]:
                    continue
                if users.division.get(uid) is not None and users.division[uid] == p[8]:
                    continue
                newly_visible.append((uid, p))
        print(f'  사업부내공개 과제 : {len(pub)}건')
        print(f'  ★ 새로 보이게 되는 (사람, 과제) : {len(newly_visible)}건'
              f' / 사람 {len({u for u, _ in newly_visible})}명')
        print('     (지금은 "고칠 수는 있는데 목록에 없는" 상태였던 것들이다)')
        show(newly_visible, args.limit,
             lambda t: f'{users.label[t[0]]:<28} → {brief(t[1])}')

        # ── E. 「내가 하는 일」 렌즈 크기 ────────────────────────────────
        head('E. 「내가 하는 일」 렌즈 크기 — manager 중심')
        print('  「내가 하는 일」 = 소유자·PL·참여인력·작성자 (역할 경로 제외)')
        print('  「우리 사업부」   = 그 사람 사업부의 전 과제')
        print()
        div_count = Counter(p[8] for p in projects if p[8] is not None)
        mine_of = defaultdict(set)
        for p in projects:
            for uid in after[p[0]]:
                mine_of[uid].add(p[0])

        mgrs = [u for u, r in users.role.items() if r == 'manager']
        rows = []
        for uid in mgrs:
            div = users.division.get(uid)
            if div is None:
                continue
            mine = len(mine_of.get(uid, ()))
            whole = div_count.get(div, 0)
            rows.append((uid, mine, whole, (mine / whole) if whole else 0.0))
        rows.sort(key=lambda t: -t[3])

        if rows:
            avg = sum(r[3] for r in rows) / len(rows)
            heavy = [r for r in rows if r[3] >= 0.7]
            print(f'  manager {len(rows)}명 (사업부가 풀리는 사람만)')
            print(f'  내 과제 / 사업부 과제 평균 비율 : {avg * 100:.0f}%')
            print(f'  70% 이상 겹치는 manager        : {len(heavy)}명')
            print('     → 이 사람들에게는 두 렌즈가 거의 같은 목록이다')
            print()
            show(rows, args.limit,
                 lambda t: f'{users.label[t[0]]:<28} 내것 {t[1]:>3} / 사업부 {t[2]:>3}'
                           f'  = {t[3] * 100:>3.0f}%')
        else:
            print('  사업부가 풀리는 manager 가 없다 — E 는 판단할 수 없다.')

        # ── 요약 ────────────────────────────────────────────────────────
        print()
        print('=' * 78)
        print(' 요약 — 이 숫자로 정할 것')
        print('=' * 78)
        print(f'  A 작성자 개방 실질 증가        : 과제 {len(gained_pairs)}건')
        print(f'  B 이름 매칭 폐지 실질 손실     : 과제 {len(lost_pairs)}건'
              + ('   ← 0 이 아니면 knoxId 를 먼저 채울 것' if lost_pairs else '   ← 안전'))
        print(f'  C 본인 경로 0 명 과제          : {len(orphan_now)} → {len(orphan_after)}건')
        print(f'  D 새로 보이게 되는 (사람,과제) : {len(newly_visible)}건')
        if rows:
            print(f'  E 두 렌즈 70% 이상 겹치는 manager : {len(heavy)} / {len(rows)}명')
        print('=' * 78)

        # 손실이 있으면 비정상 종료로 알린다 (B 가 이 조사의 유일한 위험 항목)
        return 1 if lost_pairs else 0

    finally:
        conn.close()


if __name__ == '__main__':
    sys.exit(main())
