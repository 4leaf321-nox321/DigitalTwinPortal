"""
디지털 트윈 대시보드 — 소유자 없는 활성 과제 진단 (읽기 전용)

무엇을 하나
    `dt2_projects.owner_user_id` 가 비어 있는 **활성 과제**를 찾아, 과제마다
    **소유자 해석이 왜 실패했는지**를 세 경로별로 보여준다.

        scripts/dt2_import.py 의 resolve_owner() 순서
          ① 과제참여인력목록[].knoxId → users.email 의 @앞부분 (소문자 비교)
          ② 과제PL              → users.name 과 정확히 일치
          ③ 작성자              → users.name 과 정확히 일치

    셋 다 실패하면 소유자가 비어 있는 채로 남는다. 이 스크립트는 **어느 단계에서
    끊겼는지**를 짚어 준다 — knoxId 가 아예 없는 것과, 있는데 그 계정이 users 에
    없는 것은 고치는 방법이 다르기 때문이다.

무엇을 하지 않나
    **아무것도 쓰지 않는다.** 세션을 READ ONLY 로 고정하고 확인한 뒤 시작한다.
    소유자를 **추측해서 채우지도 않는다** — 누가 담당인지는 데이터에 없다.
    지어내면 엉뚱한 사람에게 과제 소유권이 붙는다
    (permissions.resolve_division_id 의 "값을 지어내지 않는다" 와 같은 원칙).

왜 지금 봐야 하나
    **컷오버 전에만 화면으로 고칠 수 있다.**
      컷오버 전  v2_sync 가 dt2_import.import_projects 를 그대로 불러 쓰므로
                 동기화마다 resolve_owner 가 다시 돈다 → 화면에서 참여인력에
                 knoxId 를 채우고 저장하면 owner_user_id 가 채워진다
      컷오버 후  v2_sync 가 멈춘다(DT2_WRITE_ENABLED 와 상호배타). owner_user_id 는
                 사업부(division_id)와 달리 쓰기 관문에 자동 해석이 **없다** →
                 화면으로는 못 고치고 별도 도구가 필요해진다

    그리고 컷오버 후에는 권한 검사가 실제로 걸리므로, 소유자도 없고 사업부도 안
    잡히는 과제는 **admin·dt_office 말고는 아무도 못 고친다.**

⚠️ 출력에 과제명·사람 이름·knoxId 가 그대로 나온다 (고치려면 누구인지 알아야 한다).
   그래서 **로그 파일을 만들지 않고 화면에만 찍는다** — 이 폴더는 통째로 압축해
   옮겨 다니므로, 파일로 남기면 의도치 않게 따라나갈 수 있다.
   파일이 꼭 필요하면 직접 리다이렉트할 것: `python scripts\\dt3_owner_gaps.py > x.txt`

사용법
    python scripts\\dt3_owner_gaps.py

의존성
    표준 라이브러리 + psycopg. 신규 패키지 없음.
"""

from __future__ import annotations

import argparse
import os
import sys

try:
    import psycopg
except ImportError:
    print("[FAIL] psycopg 를 찾을 수 없습니다. venv 를 활성화했는지 확인하세요.")
    sys.exit(1)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from dt_scan import load_dsn, mask_dsn, enforce_read_only
except ImportError as exc:
    print(f"[FAIL] 같은 폴더의 dt_scan.py 를 찾을 수 없습니다: {exc}")
    sys.exit(1)


def load_user_maps(cur):
    """
    dt2_import.load_refs 와 **똑같은 규칙**으로 만든다.

    기준이 갈리면 이 스크립트가 "고쳤다" 고 한 것이 실제 이관에서는 안 풀린다.
    - 이메일은 @앞부분만, 공백 제거, 소문자
    - 이름은 앞뒤 공백만 제거해 정확히 비교
    - 둘 다 setdefault — 같은 키가 여럿이면 **먼저 나온 사용자**가 이긴다
    - is_active 로 거르지 않는다 (load_refs 가 안 거른다)
    """
    cur.execute("SELECT id, email, name FROM users")
    rows = cur.fetchall()
    by_local, by_name = {}, {}
    for uid, email, name in rows:
        if email and '@' in email:
            by_local.setdefault(email.split('@')[0].strip().lower(), uid)
        if name:
            by_name.setdefault(name.strip(), uid)
    return by_local, by_name, len(rows)


def member_list(value):
    """members_json 은 JSONB 라 보통 list 로 온다. 아니면 빈 목록으로 본다."""
    return value if isinstance(value, list) else []


def main():
    ap = argparse.ArgumentParser(
        description="소유자 없는 활성 과제 진단 (읽기 전용 · 화면 출력만)")
    ap.add_argument("--dsn")
    # 운영은 4건 정도로 보고 있지만, 예상보다 많으면 화면이 통째로 흘러가 버린다.
    # 그러면 맨 아래 요약(무엇을 고쳐야 하는지)이 스크롤 밖으로 밀린다.
    ap.add_argument("--limit", type=int, default=30,
                    help="자세히 볼 과제 수 상한 (기본 30). 0 이면 제한 없음")
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    dsn = load_dsn(args.dsn)

    print("=" * 78)
    print(" 소유자 없는 활성 과제 진단 (읽기 전용)")
    print("=" * 78)
    print(f" 접속 : {mask_dsn(dsn)}")
    print("-" * 78)

    conn = psycopg.connect(dsn, autocommit=True)
    if not enforce_read_only(conn):
        print("[FAIL] 읽기 전용 보호를 걸지 못했습니다. 중단합니다.")
        sys.exit(1)

    try:
        cur = conn.cursor()

        by_local, by_name, user_count = load_user_maps(cur)
        print(f"  사용자 {user_count}명 (email 로컬파트 {len(by_local)} / 이름 {len(by_name)})")

        cur.execute(
            "SELECT count(*), count(owner_user_id) "
            "  FROM dt2_projects WHERE NOT is_deleted AND NOT is_permanently_deleted"
        )
        active, owner_ok = cur.fetchone()
        missing = active - owner_ok
        print(f"  활성 과제 {active:,} · 소유자 있음 {owner_ok:,} · "
              f"**없음 {missing:,}**")
        print("-" * 78)

        if missing == 0:
            print()
            print("[OK] 소유자 없는 활성 과제가 없습니다. 조치할 것이 없습니다.")
            return 0

        cur.execute(
            "SELECT code, title, division, division_id, year, status, "
            "       pl_name, author_name, members_json, uuid "
            "  FROM dt2_projects "
            " WHERE NOT is_deleted AND NOT is_permanently_deleted "
            "   AND owner_user_id IS NULL "
            " ORDER BY division NULLS LAST, code NULLS LAST, uuid"
        )
        rows = cur.fetchall()

        # 무엇을 고쳐야 하는지 집계 — 맨 아래 요약에 쓴다
        no_knox = knox_unmatched = pl_unmatched = author_unmatched = 0
        no_division = 0

        limit = len(rows) if args.limit in (0, None) else min(args.limit, len(rows))

        for i, (code, title, division, division_id, year, status,
                pl_name, author_name, members_json, uuid) in enumerate(rows, 1):
            # 집계는 **전부** 돌지만 화면 출력만 상한을 둔다 — 요약 숫자는 항상 정확하다.
            out = print if i <= limit else (lambda *a, **k: None)

            out()
            out(f"[{i}/{len(rows)}] 과제코드 {code or '(없음)'}   uuid {uuid}")
            out(f"       과제명   {title or '(없음)'}")
            out(f"       사업부   {division or '(없음)'}"
                f"   division_id {division_id if division_id is not None else '없음 ★'}"
                f"   {year or '-'}년   {status or '-'}")

            if division_id is None:
                no_division += 1

            # ── ① knoxId ──────────────────────────────────────────────────
            members = member_list(members_json)
            knox_entries = [m for m in members
                            if isinstance(m, dict) and m.get('knoxId')]
            if not knox_entries:
                no_knox += 1
                out(f"       ① knoxId  [FAIL] 참여인력 {len(members)}명 중 knoxId 를 가진 "
                    f"사람이 없습니다")
            else:
                hit = False
                for m in knox_entries:
                    knox = str(m['knoxId']).strip()
                    uid = by_local.get(knox.lower())
                    mark = f"[OK] → users.id={uid}" if uid else "[FAIL] users 에 그 계정 없음"
                    out(f"       ① knoxId  {knox} ({m.get('이름') or '이름 없음'}"
                        f" / {m.get('부서') or '부서 없음'})  {mark}")
                    hit = hit or bool(uid)
                if not hit:
                    knox_unmatched += 1

            # ── ② 과제PL ──────────────────────────────────────────────────
            if not pl_name:
                out("       ② 과제PL  [FAIL] 비어 있음")
                pl_unmatched += 1
            else:
                uid = by_name.get(str(pl_name).strip())
                if uid:
                    out(f"       ② 과제PL  '{pl_name}'  [OK] → users.id={uid}")
                else:
                    out(f"       ② 과제PL  '{pl_name}'  [FAIL] users.name 과 정확히 "
                        f"일치하는 사람이 없음")
                    pl_unmatched += 1

            # ── ③ 작성자 ──────────────────────────────────────────────────
            if not author_name:
                out("       ③ 작성자  [FAIL] 비어 있음")
                author_unmatched += 1
            else:
                uid = by_name.get(str(author_name).strip())
                if uid:
                    out(f"       ③ 작성자  '{author_name}'  [OK] → users.id={uid}")
                else:
                    out(f"       ③ 작성자  '{author_name}'  [FAIL] users.name 과 정확히 "
                        f"일치하는 사람이 없음")
                    author_unmatched += 1

        # ── 요약 ──────────────────────────────────────────────────────────
        print()
        if limit < len(rows):
            print(f"  … 위에 {limit}건만 자세히 보였습니다. 전부 보려면 --limit 0")
        print("=" * 78)
        print(f" 소유자 없는 활성 과제 {len(rows)}건")
        print("-" * 78)
        print(f"  참여인력에 knoxId 가 아예 없음      : {no_knox}건")
        print(f"  knoxId 는 있으나 users 에 계정 없음 : {knox_unmatched}건")
        print(f"  과제PL 이 비었거나 이름 불일치      : {pl_unmatched}건")
        print(f"  작성자 가 비었거나 이름 불일치      : {author_unmatched}건")
        if no_division:
            print(f"  ★ division_id 까지 없는 과제       : {no_division}건 "
                  f"— 컷오버 후 admin·dt_office 만 고칠 수 있다")
        print()
        print(" 고치는 법 (컷오버 전에만 화면으로 됩니다)")
        print("   1. 위 과제를 화면에서 열어 **참여인력에 담당자 knoxId 를 채운다**")
        print("      (knoxId = 사내 이메일의 @앞부분. 이름 매칭보다 확실하다)")
        print("   2. 저장하면 v2_sync 가 돌면서 owner_user_id 가 채워진다")
        print("   3. 이 스크립트를 다시 돌려 '없음 0' 을 확인한다")
        print()
        print("   ⚠️ 누가 담당인지는 **현업에 확인**할 것. 추측해서 넣으면 엉뚱한 사람에게")
        print("      과제 소유권이 붙고, 컷오버 후에는 그 사람만 고칠 수 있게 된다.")
        print("=" * 78)
        return 1 if rows else 0

    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
