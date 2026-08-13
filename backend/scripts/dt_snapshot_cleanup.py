"""
디지털 트윈 대시보드 — 누적 스냅샷 정리 (Phase 1-1)

배경
    업서트마다 전체 데이터(운영 약 37 MB)의 복사본이 dashboard_snapshots 에 한 건씩 쌓였다.
    운영 실측(2026-07-28): 4,896건 / 논리 28.8 GB / 디스크 25.2 GB — DB 최대 용량 소비원.
    코드 쪽 자동 생성은 Phase 1-1에서 중단했고, 이 스크립트는 **이미 쌓인 것**을 정리한다.

보존 규칙 — 아래 중 하나라도 해당하면 남긴다
    1. snapshot_type 이 manual / upload      사람이 만든 것 + 덮어쓰기 직전 백업
    2. 최근 --keep-days 일 이내 생성          타입 무관
    3. 자동 생성분 중 최신 --keep 건

안전장치
    - 기본은 **--dry-run**. 실제 삭제는 --commit 을 명시해야 한다.
    - --commit 시 **--backup-file 로 백업 파일을 지정해야 한다.** 존재·크기를 검사하고, 없으면 거부한다.
    - 삭제는 배치 단위 + 단일 트랜잭션. 중간 실패 시 전체 롤백된다.
    - 삭제 전후 건수를 대조해 [OK]/[FAIL] 로 판정한다.
    - 로그를 파일로 남긴다.

사용법 (운영서버)
    cd <프로젝트>/backend
    venv\\Scripts\\activate

    # 1) 무엇이 지워질지만 확인 (아무것도 바꾸지 않음)
    python scripts\\dt_snapshot_cleanup.py

    # 2) 실제 삭제 (백업 파일 경로 필수)
    python scripts\\dt_snapshot_cleanup.py --commit --backup-file D:\\dt_backup\\snapshots_20260728_1830.dump

    # 3) 디스크 실제 반환 (테이블 잠금 발생 — 런북 참조)
    python scripts\\dt_snapshot_cleanup.py --vacuum-full --backup-file D:\\dt_backup\\snapshots_20260728_1830.dump

의존성
    표준 라이브러리 + psycopg (이미 설치됨). 신규 패키지 없음.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone

try:
    import psycopg
except ImportError:
    print("[FAIL] psycopg 를 찾을 수 없습니다. venv 를 활성화했는지 확인하세요.")
    sys.exit(1)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from dt_scan import load_dsn, mask_dsn, human   # 접속/포맷 헬퍼 재사용
except ImportError:
    print("[FAIL] dt_scan.py 를 같은 폴더에서 찾을 수 없습니다.")
    sys.exit(1)


PROTECTED_TYPES = ("manual", "upload")
DEFAULT_KEEP = 30
DEFAULT_KEEP_DAYS = 7
DELETE_BATCH = 200                 # 한 번에 지우는 건수 (TOAST 가 커서 작게 나눈다)
MIN_BACKUP_BYTES = 1024 * 1024     # 백업 파일 최소 크기 (1 MB) — 빈 파일 방지


class Log:
    """화면과 파일에 동시에 남긴다."""

    def __init__(self, path: str):
        self.path = path
        self.fh = open(path, "w", encoding="utf-8")

    def __call__(self, msg: str = ""):
        print(msg)
        self.fh.write(msg + "\n")
        self.fh.flush()

    def close(self):
        self.fh.close()


def check_backup(path: str | None, log: Log) -> bool:
    """--commit 전제조건: 백업 파일이 실제로 존재하고 비어 있지 않아야 한다."""
    if not path:
        log("[FAIL] --commit 에는 --backup-file 이 필요합니다.")
        log("       런북 0-0 단계 2에서 만든 snapshots_*.dump 경로를 지정하세요.")
        return False
    if not os.path.exists(path):
        log(f"[FAIL] 백업 파일이 없습니다: {path}")
        return False
    size = os.path.getsize(path)
    if size < MIN_BACKUP_BYTES:
        log(f"[FAIL] 백업 파일이 너무 작습니다 ({human(size)}). 백업이 정상인지 확인하세요: {path}")
        return False
    mtime = datetime.fromtimestamp(os.path.getmtime(path))
    age_days = (datetime.now() - mtime).days
    log(f"[OK]   백업 파일 확인: {os.path.basename(path)} / {human(size)} / {mtime:%Y-%m-%d %H:%M} ({age_days}일 전)")
    if age_days > 3:
        log(f"[주의] 백업이 {age_days}일 전 것입니다. 최신 백업 사용을 권장합니다.")
    return True


def summarize(cur, log: Log, title: str):
    """현재 스냅샷 현황을 타입별로 출력한다."""
    log(f"\n── {title} ──")
    cur.execute(
        "SELECT coalesce(snapshot_type,'(없음)') AS t, count(*), "
        "       coalesce(sum(length(snapshot_data::text)),0) "
        "FROM dashboard_snapshots GROUP BY 1 ORDER BY 2 DESC"
    )
    total_n = total_b = 0
    log(f"  {'타입':<12}{'건수':>8}{'논리 크기':>14}")
    for t, n, b in cur.fetchall():
        log(f"  {t:<12}{n:>8,}{human(b):>14}")
        total_n += n
        total_b += b
    log(f"  {'합계':<12}{total_n:>8,}{human(total_b):>14}")

    cur.execute("SELECT pg_total_relation_size('dashboard_snapshots')")
    disk = cur.fetchone()[0]
    log(f"  디스크 실사용: {human(disk)}")
    return total_n, total_b, disk


def select_targets(cur, keep: int, keep_days: int):
    """삭제 대상 id 목록과 논리 용량을 계산한다. (규칙은 모듈 docstring 참조)"""
    # created_at 은 naive UTC 로 저장된다 (BaseModel 이 datetime.utcnow 사용) → 비교 기준도 naive UTC
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=keep_days)

    protected = list(PROTECTED_TYPES)

    # psycopg3 에서는 `NOT IN %s` 가 동작하지 않는다. `= ANY(%s)` + 리스트를 쓴다.
    cur.execute(
        "SELECT id FROM dashboard_snapshots "
        "WHERE snapshot_type IS NULL OR NOT (snapshot_type = ANY(%s)) "
        "ORDER BY created_at DESC LIMIT %s",
        (protected, keep),
    )
    keep_ids = [r[0] for r in cur.fetchall()]

    sql = (
        "SELECT id, coalesce(length(snapshot_data::text),0) FROM dashboard_snapshots "
        "WHERE (snapshot_type IS NULL OR NOT (snapshot_type = ANY(%s))) "
        "  AND created_at < %s"
    )
    params: list = [protected, cutoff]
    if keep_ids:
        sql += " AND id <> ALL(%s)"
        params.append(keep_ids)
    sql += " ORDER BY id"

    cur.execute(sql, params)
    rows = cur.fetchall()
    return [r[0] for r in rows], sum(r[1] for r in rows), keep_ids, cutoff


def do_vacuum_full(dsn: str, log: Log) -> bool:
    """디스크를 실제로 반환한다. ACCESS EXCLUSIVE 락 — 그동안 스냅샷 테이블 접근이 대기한다."""
    log("\n[VACUUM FULL] 시작 — 이 동안 dashboard_snapshots 접근이 대기합니다.")
    log("              (자동 스냅샷 생성은 이미 중단되었으므로 일상 저장에는 영향이 없습니다)")
    t0 = datetime.now()
    try:
        with psycopg.connect(dsn, autocommit=True) as conn:   # VACUUM 은 트랜잭션 안에서 못 돈다
            conn.execute("VACUUM (FULL, ANALYZE) dashboard_snapshots")
        took = int((datetime.now() - t0).total_seconds())
        log(f"[OK]   VACUUM FULL 완료 ({took}초)")
        return True
    except Exception as exc:
        log(f"[FAIL] VACUUM FULL 실패: {exc}")
        return False


def main():
    ap = argparse.ArgumentParser(description="누적 스냅샷 정리 (기본: dry-run)")
    ap.add_argument("--dsn", help="접속 문자열. 생략 시 DATABASE_URL 또는 backend/.env")
    ap.add_argument("--commit", action="store_true", help="실제로 삭제한다 (--backup-file 필수)")
    ap.add_argument("--vacuum-full", action="store_true",
                    help="삭제 후 디스크를 실제 반환한다 (테이블 잠금 발생)")
    ap.add_argument("--backup-file", help="사전 확보한 스냅샷 백업 파일 경로")
    ap.add_argument("--keep", type=int, default=DEFAULT_KEEP, help=f"자동 생성분 보존 건수 (기본 {DEFAULT_KEEP})")
    ap.add_argument("--keep-days", type=int, default=DEFAULT_KEEP_DAYS,
                    help=f"최근 N일 이내는 타입 무관 보존 (기본 {DEFAULT_KEEP_DAYS})")
    ap.add_argument("--out", help="로그 디렉터리 (기본: scripts/out)")
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
    log = Log(os.path.join(outdir, f"dt_snapshot_cleanup_{stamp}.log"))

    mode = "실제 삭제 (--commit)" if args.commit else "확인만 (dry-run)"
    log("=" * 72)
    log(" 디지털 트윈 대시보드 — 누적 스냅샷 정리")
    log("=" * 72)
    log(f" 접속 : {mask_dsn(dsn)}")
    log(f" 모드 : {mode}")
    log(f" 정책 : 자동 생성분 최신 {args.keep}건 보존 / 최근 {args.keep_days}일 보존 / "
        f"{'·'.join(PROTECTED_TYPES)} 전량 보존")
    log(f" 로그 : {log.path}")
    log("-" * 72)

    # 사전조건
    if args.commit or args.vacuum_full:
        if not check_backup(args.backup_file, log):
            log("\n결과: [FAIL] 사전조건 미충족. 아무것도 삭제하지 않았습니다.")
            log.close()
            sys.exit(1)

    try:
        conn = psycopg.connect(dsn)          # autocommit=False — 명시적 트랜잭션
    except Exception as exc:
        log(f"[FAIL] DB 접속 실패: {exc}")
        log.close()
        sys.exit(1)

    exit_code = 0
    try:
        cur = conn.cursor()

        before_n, before_b, before_disk = summarize(cur, log, "정리 전 현황")

        targets, target_bytes, keep_ids, cutoff = select_targets(cur, args.keep, args.keep_days)

        log("\n── 정리 계획 ──")
        log(f"  기준 시각(이보다 오래된 것만 대상) : {cutoff:%Y-%m-%d %H:%M} UTC")
        log(f"  보존 — 보호 타입({'/'.join(PROTECTED_TYPES)})     : 전량")
        log(f"  보존 — 자동 생성분 최신                : {len(keep_ids):,}건")
        log(f"  보존 — 최근 {args.keep_days}일 이내             : 기준 시각 이후 전량")
        log(f"  **삭제 대상**                          : {len(targets):,}건 / 논리 {human(target_bytes)}")
        log(f"  정리 후 예상 건수                      : {before_n - len(targets):,}건")

        # ⚠️ 여기서 조기 return 하면 안 된다.
        #    --vacuum-full 은 try/finally 이후에 실행되므로, return 하면 VACUUM 이 통째로 건너뛰어진다.
        #    (2026-07-28 운영 중 발견: E-2 로 이미 삭제한 뒤 --vacuum-full 을 실행했더니
        #     "삭제할 대상이 없습니다" 만 뜨고 디스크가 반환되지 않았다)
        if not targets:
            log("\n  삭제할 대상이 없습니다. (이미 정리된 상태)")
            conn.rollback()

        elif not args.commit:
            log("\n" + "-" * 72)
            log(" 확인만 했습니다. 아무것도 삭제하지 않았습니다.")
            log(" 실제로 삭제하려면 아래처럼 실행하세요:")
            log(f"   python scripts\\dt_snapshot_cleanup.py --commit --backup-file <백업파일경로>")
            log("-" * 72)
            conn.rollback()

        else:
            exit_code = do_delete(conn, cur, log, targets, before_n, before_b, before_disk)

    except Exception:
        conn.rollback()
        import traceback
        log("[FAIL] 처리 중 오류가 발생해 롤백했습니다.")
        log(traceback.format_exc())
        exit_code = 1
    finally:
        conn.close()

    # 삭제 여부와 무관하게, --vacuum-full 이 지정되면 반드시 실행한다
    if exit_code == 0 and args.vacuum_full:
        if do_vacuum_full(dsn, log):
            try:
                with psycopg.connect(dsn, autocommit=True) as c2:
                    row = c2.execute("SELECT pg_total_relation_size('dashboard_snapshots')").fetchone()
                    log(f"  VACUUM 후 디스크: {human(row[0])}")
            except Exception:
                pass
        else:
            exit_code = 1
    elif exit_code == 0 and not args.vacuum_full:
        log("\n  디스크를 실제로 반환하려면 --vacuum-full 을 붙여 다시 실행하세요.")

    log("\n" + "=" * 72)
    log(f" 결과: {'[OK] 완료' if exit_code == 0 else '[FAIL] 실패'}")
    log(f" 로그: {log.path}")
    log("=" * 72)
    log.close()
    sys.exit(exit_code)


def do_delete(conn, cur, log, targets, before_n, before_b, before_disk) -> int:
    """실제 삭제 — 단일 트랜잭션, 배치 단위. 성공 0 / 실패 1"""
    log(f"\n── 삭제 실행 ({len(targets):,}건, {DELETE_BATCH}건씩) ──")
    done = 0
    for i in range(0, len(targets), DELETE_BATCH):
        batch = targets[i:i + DELETE_BATCH]
        cur.execute("DELETE FROM dashboard_snapshots WHERE id = ANY(%s)", (batch,))
        done += cur.rowcount
        log(f"  {done:,} / {len(targets):,} 건 삭제")

    # 커밋 전 검증 — 예상과 다르면 롤백한다
    cur.execute("SELECT count(*) FROM dashboard_snapshots")
    after_n_pre = cur.fetchone()[0]
    expected = before_n - len(targets)
    if after_n_pre != expected:
        log(f"[FAIL] 예상 건수와 다릅니다 (예상 {expected:,} / 실제 {after_n_pre:,}). 롤백합니다.")
        conn.rollback()
        log("\n결과: [FAIL] 롤백 완료. 데이터는 변경되지 않았습니다.")
        return 1

    conn.commit()
    log(f"[OK]   커밋 완료 — {done:,}건 삭제")

    after_n, after_b, after_disk = summarize(cur, log, "정리 후 현황")

    log("\n── 결과 ──")
    log(f"  건수      : {before_n:,} → {after_n:,}  (-{before_n - after_n:,})")
    log(f"  논리 크기 : {human(before_b)} → {human(after_b)}")
    log(f"  디스크    : {human(before_disk)} → {human(after_disk)}")
    if after_disk >= before_disk * 0.9:
        log("\n[주의] 디스크 사용량이 아직 줄지 않았습니다. **정상입니다.**")
        log("       PostgreSQL 은 DELETE 만으로 파일을 반환하지 않습니다(빈 공간으로 재사용).")
        log("       실제로 반환하려면 --vacuum-full 을 실행하세요 (테이블 잠금 발생).")
    return 0


if __name__ == "__main__":
    main()
