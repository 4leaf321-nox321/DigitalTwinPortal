"""
디지털 트윈 대시보드 — Phase 3 착수 전 권한 입력 점검 (읽기 전용)

무엇을 확인하나
    계획서 7-1 의 권한 함수가 **실제 데이터에서 성립하는지** 본다.

        def can_edit_project(actor, project):
            if actor.role == 'admin':             return True
            if project.owner_user_id == actor.id: return True      # ← ①
            if actor.role == 'manager':
                return actor_division_id(actor) == project.division_id   # ← ②③
            return False

        ① dt2_projects.owner_user_id 가 채워져 있는가
        ② dt2_projects.division_id 가 채워져 있는가
        ③ actor_division_id(actor) 가 풀리는가
             users.department 는 **FK 가 아니라 자유 텍스트**다.
             departments.name 과 이름으로 맞춰야 하고, 그래서
             미매칭·중복이 생길 수 있다. 이게 이 스크립트의 핵심 관심사다.

    마지막으로 "그래서 각 manager 가 실제로 몇 건을 고칠 수 있는가" 를 센다.
    권한 함수가 문법적으로 맞아도, 아무도 아무것도 못 고치면 소용이 없다.

무엇을 하지 않나
    **아무것도 쓰지 않는다.** 세션을 READ ONLY 로 고정하고 쓰기 프로브로 확인한 뒤 시작한다.
    출력에 개인 식별 정보를 넣지 않는다 — 이름·이메일 대신 건수와 부서명만 낸다.

사용법
    python scripts\\dt3_readiness.py
    python scripts\\dt3_readiness.py --detail    # 미매칭 부서명 전체 나열

의존성
    표준 라이브러리 + psycopg. 신규 패키지 없음.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime

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


class Log:
    def __init__(self, path: str):
        self.path = path
        self.fh = open(path, "w", encoding="utf-8")

    def __call__(self, msg: str = ""):
        print(msg)
        self.fh.write(msg + "\n")
        self.fh.flush()

    def close(self):
        self.fh.close()


def norm_dept(s):
    """부서명 비교용 정규화. 공백·전각공백만 정리한다 (과한 정규화는 오히려 오매칭)."""
    if not s:
        return ''
    return ' '.join(str(s).replace('　', ' ').split()).strip()


def main():
    ap = argparse.ArgumentParser(description="Phase 3 권한 입력 점검 (읽기 전용)")
    ap.add_argument("--dsn")
    ap.add_argument("--detail", action="store_true", help="미매칭 부서명을 전부 나열")
    ap.add_argument("--out")
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    dsn = load_dsn(args.dsn)
    here = os.path.dirname(os.path.abspath(__file__))
    outdir = args.out or os.path.join(here, "out")
    os.makedirs(outdir, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    log = Log(os.path.join(outdir, f"dt3_readiness_{stamp}.log"))

    log("=" * 72)
    log(" Phase 3 착수 전 권한 입력 점검 (읽기 전용)")
    log("=" * 72)
    log(f" 접속 : {mask_dsn(dsn)}")
    log(f" 로그 : {log.path}")
    log("-" * 72)

    conn = psycopg.connect(dsn, autocommit=True)
    if not enforce_read_only(conn):
        log("[FAIL] 읽기 전용 보호를 걸지 못했습니다. 중단합니다.")
        log.close()
        sys.exit(1)

    exit_code = 0
    problems = []
    try:
        cur = conn.cursor()

        # ── ① ② 과제 쪽 입력 ────────────────────────────────────────────────
        log("\n── ①② 과제 쪽: owner_user_id / division_id ──")
        cur.execute(
            "SELECT count(*), count(owner_user_id), count(division_id) "
            "  FROM dt2_projects WHERE NOT is_deleted AND NOT is_permanently_deleted"
        )
        active, owner_ok, div_ok = cur.fetchone()
        log(f"  활성 과제           : {active:,}")
        log(f"  owner_user_id 있음  : {owner_ok:,}  (없음 {active-owner_ok:,})")
        log(f"  division_id 있음    : {div_ok:,}  (없음 {active-div_ok:,})")

        if active and (active - div_ok) * 10 > active:
            problems.append(f"division_id 없는 활성 과제 {active-div_ok:,}건 "
                            f"— manager 권한이 이만큼 작동하지 않는다")
        if active - owner_ok:
            log(f"  → owner 없는 {active-owner_ok:,}건은 소유자 본인 편집이 불가. "
                f"admin/manager 로만 접근된다")

        # ── ③ 사용자 → 사업부 해석 ─────────────────────────────────────────
        log("\n── ③ 사용자 → 사업부 해석 (users.department 는 자유 텍스트) ──")

        cur.execute(
            "SELECT lower(name), division_id FROM departments "
            " WHERE is_active AND name IS NOT NULL"
        )
        dept_map = defaultdict(set)
        for name, div_id in cur.fetchall():
            dept_map[norm_dept(name).lower()].add(div_id)

        ambiguous_depts = {k for k, v in dept_map.items() if len({d for d in v if d}) > 1}
        no_div_depts = {k for k, v in dept_map.items() if not any(d for d in v)}
        log(f"  활성 부서(고유 이름): {len(dept_map):,}")
        log(f"    division 없음     : {len(no_div_depts):,}")
        log(f"    이름 중복인데 division 이 갈림: {len(ambiguous_depts):,}  ← 있으면 해석 불가")

        if dept_map and len(no_div_depts) * 5 > len(dept_map):
            problems.append(f"활성 부서 {len(dept_map):,}종 중 {len(no_div_depts):,}종에 "
                            f"division 이 없다 — 그 부서 소속 manager 는 해석이 안 된다")
        if ambiguous_depts:
            problems.append(f"이름은 같은데 division 이 다른 부서 {len(ambiguous_depts):,}종 "
                            f"— 텍스트로는 어느 사업부인지 확정할 수 없다")

        cur.execute(
            "SELECT role, department FROM users WHERE is_active"
        )
        rows = cur.fetchall()
        by_role = Counter(r or '(없음)' for r, _ in rows)
        log(f"\n  활성 사용자 {len(rows):,} — " + ", ".join(f"{k} {v}" for k, v in by_role.most_common()))

        stat = Counter()
        unmatched_names = Counter()
        manager_div = Counter()
        for role, dept in rows:
            if role not in ('manager',):
                continue
            key = norm_dept(dept).lower()
            if not key:
                stat['부서 비어있음'] += 1
                continue
            if key not in dept_map:
                stat['부서명 미매칭'] += 1
                unmatched_names[norm_dept(dept)] += 1
                continue
            divs = {d for d in dept_map[key] if d}
            if not divs:
                stat['부서는 찾았으나 division 없음'] += 1
            elif len(divs) > 1:
                stat['부서명 중복 — 해석 불가'] += 1
            else:
                stat['해석됨'] += 1
                manager_div[next(iter(divs))] += 1

        n_mgr = by_role.get('manager', 0)
        log(f"\n  manager {n_mgr:,}명의 사업부 해석 결과")
        if n_mgr == 0:
            log("    manager 역할 사용자가 없습니다. 이 경로는 지금 쓰이지 않습니다.")
        else:
            for k, v in stat.most_common():
                mark = "  " if k == '해석됨' else "!!"
                log(f"    {mark} {k:<28} {v:,}")
            if stat['해석됨'] < n_mgr:
                problems.append(f"manager {n_mgr - stat['해석됨']:,}명의 사업부를 "
                                f"users.department 텍스트로 풀 수 없다")

        if unmatched_names:
            log(f"\n  [미매칭 부서명] {len(unmatched_names)}종")
            items = unmatched_names.most_common(None if args.detail else 10)
            for name, cnt in items:
                log(f"    - {name!r} ({cnt}명)")
            if not args.detail and len(unmatched_names) > 10:
                log(f"    ... --detail 로 전체 확인")

        # ── 실효성: manager 가 실제로 몇 건을 고칠 수 있나 ──────────────────
        log("\n── 실효성: 권한별로 실제 편집 가능한 활성 과제 수 ──")
        cur.execute(
            "SELECT division_id, count(*) FROM dt2_projects "
            " WHERE NOT is_deleted AND NOT is_permanently_deleted "
            " GROUP BY 1"
        )
        proj_by_div = {d: c for d, c in cur.fetchall()}
        log(f"  admin           : {active:,}건 (전체)")
        if manager_div:
            reach = sum(proj_by_div.get(d, 0) for d in manager_div)
            log(f"  manager(해석된 {sum(manager_div.values())}명이 속한 사업부 합): {reach:,}건")
            for d, cnt in manager_div.most_common():
                log(f"    division_id={d} : manager {cnt}명 → 과제 {proj_by_div.get(d, 0):,}건")
        else:
            log(f"  manager         : 0건  ← 사업부가 해석된 manager 가 없다")
        log(f"  소유자 본인     : 과제당 1명. 활성 과제 중 {owner_ok:,}건에 소유자가 있다")

        unreachable = active - owner_ok
        if unreachable:
            log(f"\n  [확인] 소유자도 없고 사업부도 안 잡히면 admin 만 고칠 수 있다.")

        # ── 판정 ────────────────────────────────────────────────────────────
        log("\n" + "=" * 72)
        if n_mgr == 0:
            log(" 판정: [정보 부족] manager 역할 사용자가 없어 ③ 경로를 검증할 수 없다.")
            log("        admin / 소유자 경로만으로 Phase 3 개발은 진행 가능하다.")
            log("        manager 를 쓸 계획이면 계정을 만든 뒤 이 스크립트를 다시 돌린다.")
            exit_code = 2
        elif problems:
            log(" 판정: [확인 필요]")
            for p in problems:
                log(f"   - {p}")
            log("")
            log(" Phase 3 개발은 진행할 수 있다. 권한 함수 자체는 admin/소유자 경로로 동작한다.")
            log(" 다만 **컷오버 전까지** 위 항목을 채워야 manager 경로가 의미를 갖는다.")
            exit_code = 2
        else:
            log(" 판정: [OK] 권한 함수의 입력이 전부 갖춰져 있다.")
            log(f"        manager {stat['해석됨']:,}명 전원의 사업부가 해석된다.")
        log("=" * 72)

        log("\n 이 결과로 판단할 것")
        log("   - owner/division 이 비어 있어도 **개발은 막히지 않는다.** admin 은 항상 통과한다.")
        log("   - 다만 컷오버 시점에 이 값들이 비어 있으면, 현업이 자기 과제를 못 고치고")
        log("     전부 admin 에게 몰린다. 그 전에 채워야 한다.")

    except Exception:
        import traceback
        log("[FAIL] 점검 중 오류가 발생했습니다.")
        log(traceback.format_exc())
        exit_code = 1
    finally:
        conn.close()
        log.close()

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
