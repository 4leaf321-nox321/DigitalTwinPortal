"""
디지털 트윈 대시보드 — 보고서 이미지 분리 (Phase 1-2)

배경
    보고서 이미지가 과제 JSON 안에 base64 data URI 로 인라인 저장되어 있다.
    운영 실측(2026-07-28): 23개 과제 / 33.9 MB / 저장 payload 의 94.4%.
    과제 하나의 진행률만 바꿔도 이 33.9 MB 가 통째로 왕복한다.

설계 원칙 — "이동"이 아니라 "복사" (실행계획 2장 원칙 2)
    원본 base64 를 **지우지 않고** 파일로 복사한 뒤 참조(imageId)만 추가한다.
    화면에서 정상 표시를 확인한 다음에야 별도 단계(--strip)로 원본을 제거한다.
    각 단계가 독립적으로 되돌릴 수 있다.

    [단계 1] --extract   base64 → 파일 저장 + dt_report_images 행 생성 + JSON 에 imageId 추가
                         dataUrl 은 그대로 둔다.  이 시점에 데이터가 두 벌.
                         프론트는 imageId 가 있으면 서버 URL, 없으면 dataUrl 로 폴백한다.
             ↓ 화면에서 이미지 정상 표시 확인
    [단계 2] --strip     JSON 에서 dataUrl 만 제거 → payload 급감
                         파일과 DB 행은 그대로이므로 언제든 복구 가능.

안전장치
    - 기본은 **--dry-run**. 실제 변경은 --extract / --strip 을 명시해야 한다.
    - --strip 은 **--backup-file 필수** (원본 JSON 이 사라지는 유일한 단계).
    - 모든 쓰기는 단일 트랜잭션. 중간 실패 시 전체 롤백.
    - 추출한 파일은 **sha256 으로 원본과 대조**한다. 하나라도 어긋나면 롤백.
    - --strip 은 **imageId 가 있고 파일이 실제로 존재하는** 원소의 dataUrl 만 지운다.
    - 재실행 안전(idempotent): 이미 처리된 이미지는 건너뛴다.

사용법 (운영서버)
    cd <프로젝트>/backend
    venv\\Scripts\\activate

    python scripts\\dt_image_extract.py                  # 1) 현황만 확인
    python scripts\\dt_image_extract.py --extract        # 2) 파일로 복사 (원본 유지)
    #  → 화면에서 보고서 이미지 정상 표시 확인
    python scripts\\dt_image_extract.py --strip --backup-file D:\\dt_backup\\core_20260728_1830.dump
    python scripts\\dt_image_extract.py --verify         # 언제든 무결성 재확인

의존성
    표준 라이브러리 + psycopg (이미 설치됨). 신규 패키지 없음.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import sys
import uuid as uuidlib
from datetime import datetime

try:
    import psycopg
except ImportError:
    print("[FAIL] psycopg 를 찾을 수 없습니다. venv 를 활성화했는지 확인하세요.")
    sys.exit(1)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from dt_scan import load_dsn, mask_dsn, human
except ImportError:
    print("[FAIL] dt_scan.py 를 같은 폴더에서 찾을 수 없습니다.")
    sys.exit(1)


# 과제 JSON 에서 이미지가 들어 있는 키들
IMAGE_SLOTS = [
    "이미지_좌측", "이미지_우측",
    "이미지_개요그림", "이미지_상세내용그림", "이미지_향후계획그림",
]

UPLOAD_FOLDER = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "uploads", "digital-twin-dashboard",
)

DATA_URI_RE = re.compile(r"^data:(?P<mime>[\w.+-]+/[\w.+-]+)?;base64,(?P<b64>.+)$", re.S)

EXT_BY_MIME = {
    "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png",
    "image/gif": ".gif", "image/webp": ".webp", "image/bmp": ".bmp",
}

MIN_BACKUP_BYTES = 1024 * 1024


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


def decode_data_url(data_url: str):
    """data URI → (bytes, mime). 형식이 아니면 (None, None)."""
    if not isinstance(data_url, str):
        return None, None
    m = DATA_URI_RE.match(data_url.strip())
    if not m:
        return None, None
    try:
        raw = base64.b64decode(m.group("b64"), validate=False)
    except Exception:
        return None, None
    return raw, (m.group("mime") or "application/octet-stream").lower()


def check_backup(path: str | None, log: Log) -> bool:
    if not path:
        log("[FAIL] --strip 에는 --backup-file 이 필요합니다.")
        log("       런북 0-0 단계 1에서 만든 core_*.dump 경로를 지정하세요.")
        return False
    if not os.path.exists(path):
        log(f"[FAIL] 백업 파일이 없습니다: {path}")
        return False
    size = os.path.getsize(path)
    if size < MIN_BACKUP_BYTES:
        log(f"[FAIL] 백업 파일이 너무 작습니다 ({human(size)}): {path}")
        return False
    mtime = datetime.fromtimestamp(os.path.getmtime(path))
    log(f"[OK]   백업 파일 확인: {os.path.basename(path)} / {human(size)} / {mtime:%Y-%m-%d %H:%M}")
    return True


def load_projects(cur):
    cur.execute("SELECT id, version, projects FROM dashboard_data ORDER BY id LIMIT 1")
    row = cur.fetchone()
    if row is None:
        return None, None, None
    row_id, version, projects = row
    if isinstance(projects, (str, bytes, bytearray)):
        projects = json.loads(projects)
    return row_id, version, (projects or [])


def survey(projects, log: Log):
    """현재 인라인 이미지 현황을 집계한다 (변경 없음)."""
    total_payload = len(json.dumps(projects, ensure_ascii=False).encode("utf-8"))
    n_inline = n_linked = 0
    inline_bytes = 0
    per_slot = {}
    projects_with = set()

    for p in projects:
        pid = p.get("uuid") or p.get("id") or "?"
        for slot in IMAGE_SLOTS:
            arr = p.get(slot)
            if not isinstance(arr, list):
                continue
            for elem in arr:
                if not isinstance(elem, dict):
                    continue
                has_data = isinstance(elem.get("dataUrl"), str) and elem["dataUrl"].startswith("data:")
                has_id = bool(elem.get("imageId"))
                if has_data:
                    n_inline += 1
                    b = len(elem["dataUrl"].encode("utf-8"))
                    inline_bytes += b
                    per_slot[slot] = per_slot.get(slot, 0) + b
                    projects_with.add(pid)
                if has_id:
                    n_linked += 1

    log("\n── 현재 이미지 현황 ──")
    log(f"  과제 payload 총량            : {human(total_payload)}")
    log(f"  인라인 base64 이미지          : {n_inline:,}장 / {human(inline_bytes)}"
        f"  (payload 의 {inline_bytes / max(total_payload,1) * 100:.1f}%)")
    log(f"  이미지 보유 과제              : {len(projects_with):,}건")
    log(f"  이미 참조(imageId)로 바뀐 것   : {n_linked:,}장")
    if per_slot:
        log("  슬롯별:")
        for slot, b in sorted(per_slot.items(), key=lambda x: -x[1]):
            log(f"    {slot:<22}{human(b):>12}")
    return n_inline, inline_bytes, total_payload


def do_extract(conn, cur, log: Log, dry_run: bool):
    """
    단계 1 — base64 를 파일로 복사하고 imageId 를 붙인다. **dataUrl 은 남긴다.**
    """
    row_id, version, projects = load_projects(cur)
    if row_id is None:
        log("[FAIL] dashboard_data 에 행이 없습니다.")
        return False

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    # 이미 추출된 것 재사용 (재실행 안전) — sha256 기준
    cur.execute("SELECT sha256, id, stored_filename FROM dt_report_images WHERE sha256 IS NOT NULL")
    by_hash = {r[0]: (r[1], r[2]) for r in cur.fetchall()}

    created = reused = skipped = failed = 0
    written_files: list[str] = []
    total_bytes = 0

    log("\n── 추출 실행 ──" if not dry_run else "\n── 추출 계획 (dry-run) ──")

    for p in projects:
        pid = p.get("uuid") or p.get("id")
        if not pid:
            continue
        for slot in IMAGE_SLOTS:
            arr = p.get(slot)
            if not isinstance(arr, list):
                continue
            for pos, elem in enumerate(arr):
                if not isinstance(elem, dict):
                    continue
                if elem.get("imageId"):
                    skipped += 1                       # 이미 처리됨
                    continue
                raw, mime = decode_data_url(elem.get("dataUrl"))
                if raw is None:
                    if elem.get("dataUrl"):
                        failed += 1
                        log(f"  [WARN] 디코드 실패: 과제 {pid} / {slot}[{pos}]")
                    continue

                digest = hashlib.sha256(raw).hexdigest()
                total_bytes += len(raw)

                if digest in by_hash:                  # 동일 이미지 재사용
                    image_id = by_hash[digest][0]
                    reused += 1
                    if not dry_run:
                        elem["imageId"] = image_id
                    continue

                stored = f"img_{uuidlib.uuid4().hex}{EXT_BY_MIME.get(mime, '')}"
                if not dry_run:
                    fpath = os.path.join(UPLOAD_FOLDER, stored)
                    with open(fpath, "wb") as fh:
                        fh.write(raw)
                    written_files.append(fpath)

                    # 파일이 실제로 원본과 같은지 즉시 대조
                    with open(fpath, "rb") as fh:
                        if hashlib.sha256(fh.read()).hexdigest() != digest:
                            log(f"  [FAIL] 파일 검증 불일치: {stored}")
                            raise RuntimeError("파일 해시 불일치")

                    # created_at/updated_at 은 **UTC naive** 로 넣는다.
                    # BaseModel 이 datetime.utcnow 를 쓰므로 다른 테이블과 같은 기준이어야 한다.
                    # SQL 의 now() 는 세션 타임존(KST)이라 9시간이 어긋난다.
                    cur.execute(
                        "INSERT INTO dt_report_images "
                        "(project_id, slot, position, original_filename, stored_filename, caption, "
                        " mime_type, file_size, sha256, source, created_at, updated_at) "
                        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'extract',"
                        "        (now() AT TIME ZONE 'UTC'), (now() AT TIME ZONE 'UTC')) RETURNING id",
                        (pid, slot, pos, elem.get("fileName"), stored, elem.get("caption") or "",
                         mime, len(raw), digest),
                    )
                    image_id = cur.fetchone()[0]
                    by_hash[digest] = (image_id, stored)
                    elem["imageId"] = image_id
                created += 1

    log(f"  신규 추출 : {created:,}장")
    log(f"  중복 재사용: {reused:,}장")
    log(f"  이미 처리됨: {skipped:,}장")
    log(f"  디코드 실패: {failed:,}장")
    log(f"  원본 용량 : {human(total_bytes)}")

    if dry_run:
        log("\n  확인만 했습니다. 파일도 DB도 변경하지 않았습니다.")
        return True

    if created == 0 and reused == 0:
        log("\n  추출할 이미지가 없습니다. (이미 완료된 상태일 수 있습니다)")
        conn.rollback()
        return True

    # JSON 에 imageId 를 추가한 상태로 저장 — dataUrl 은 그대로 남아 있다
    cur.execute(
        "UPDATE dashboard_data SET projects = %s, version = version + 1 WHERE id = %s",
        (json.dumps(projects, ensure_ascii=False), row_id),
    )
    conn.commit()
    log(f"\n[OK]   커밋 완료 — imageId {created + reused:,}개 부여 (원본 dataUrl 은 그대로 유지)")
    log("       이제 화면에서 보고서 이미지가 정상 표시되는지 확인한 뒤 --strip 을 실행하세요.")
    return True


def do_verify(cur, log: Log) -> bool:
    """
    파일·DB·JSON 3자 대조. --strip 전에 반드시 통과해야 한다.
    """
    row_id, version, projects = load_projects(cur)
    if row_id is None:
        log("[FAIL] dashboard_data 에 행이 없습니다.")
        return False

    cur.execute("SELECT id, stored_filename, sha256, file_size FROM dt_report_images")
    rows = {r[0]: (r[1], r[2], r[3]) for r in cur.fetchall()}

    log("\n── 무결성 검증 ──")

    missing_file = bad_hash = dangling = ok = no_id = 0
    for p in projects:
        for slot in IMAGE_SLOTS:
            arr = p.get(slot)
            if not isinstance(arr, list):
                continue
            for elem in arr:
                if not isinstance(elem, dict):
                    continue
                image_id = elem.get("imageId")
                if not image_id:
                    if isinstance(elem.get("dataUrl"), str) and elem["dataUrl"].startswith("data:"):
                        no_id += 1
                    continue
                if image_id not in rows:
                    dangling += 1
                    continue
                stored, digest, _size = rows[image_id]
                fpath = os.path.join(UPLOAD_FOLDER, stored)
                if not os.path.exists(fpath):
                    missing_file += 1
                    log(f"  [FAIL] 파일 없음: id={image_id} {stored}")
                    continue
                with open(fpath, "rb") as fh:
                    if hashlib.sha256(fh.read()).hexdigest() != digest:
                        bad_hash += 1
                        log(f"  [FAIL] 해시 불일치: id={image_id} {stored}")
                        continue
                ok += 1

    log(f"  정상(파일 존재 + 해시 일치) : {ok:,}장")
    log(f"  DB 행 없음(dangling id)     : {dangling:,}장")
    log(f"  파일 없음                   : {missing_file:,}장")
    log(f"  해시 불일치                 : {bad_hash:,}장")
    log(f"  아직 추출 안 된 인라인       : {no_id:,}장")

    healthy = (dangling == 0 and missing_file == 0 and bad_hash == 0)
    log(f"\n  판정: {'[OK] 전부 정상' if healthy else '[FAIL] 문제 있음'}")
    return healthy


def do_strip(conn, cur, log: Log, dry_run: bool):
    """
    단계 2 — 검증을 통과한 원소의 dataUrl 만 제거한다.
    파일과 DB 행은 남으므로 언제든 복구할 수 있다.
    """
    if not do_verify(cur, log):
        log("\n[FAIL] 무결성 검증을 통과하지 못했습니다. dataUrl 을 제거하지 않습니다.")
        return False

    row_id, version, projects = load_projects(cur)
    cur.execute("SELECT id, stored_filename FROM dt_report_images")
    stored_by_id = {r[0]: r[1] for r in cur.fetchall()}

    stripped = 0
    freed = 0
    log("\n── dataUrl 제거 " + ("계획 (dry-run) ──" if dry_run else "실행 ──"))

    for p in projects:
        for slot in IMAGE_SLOTS:
            arr = p.get(slot)
            if not isinstance(arr, list):
                continue
            for elem in arr:
                if not isinstance(elem, dict):
                    continue
                image_id = elem.get("imageId")
                data_url = elem.get("dataUrl")
                if not image_id or not isinstance(data_url, str) or not data_url.startswith("data:"):
                    continue
                stored = stored_by_id.get(image_id)
                if not stored or not os.path.exists(os.path.join(UPLOAD_FOLDER, stored)):
                    continue                                  # 파일 없으면 절대 지우지 않는다
                freed += len(data_url.encode("utf-8"))
                stripped += 1
                if not dry_run:
                    del elem["dataUrl"]

    log(f"  제거 대상 : {stripped:,}장")
    log(f"  절감 용량 : {human(freed)}")

    if dry_run:
        log("\n  확인만 했습니다. 변경하지 않았습니다.")
        return True
    if stripped == 0:
        log("\n  제거할 대상이 없습니다.")
        conn.rollback()
        return True

    new_payload = len(json.dumps(projects, ensure_ascii=False).encode("utf-8"))
    cur.execute(
        "UPDATE dashboard_data SET projects = %s, version = version + 1 WHERE id = %s",
        (json.dumps(projects, ensure_ascii=False), row_id),
    )
    conn.commit()
    log(f"\n[OK]   커밋 완료 — {stripped:,}장의 dataUrl 제거")
    log(f"       과제 payload: {human(new_payload)} (이미지 제거 후)")
    return True


def main():
    ap = argparse.ArgumentParser(description="보고서 이미지 분리 (기본: 현황 확인만)")
    ap.add_argument("--dsn", help="접속 문자열. 생략 시 DATABASE_URL 또는 backend/.env")
    ap.add_argument("--extract", action="store_true", help="단계 1: 파일로 복사 + imageId 부여 (원본 유지)")
    ap.add_argument("--strip", action="store_true", help="단계 2: dataUrl 제거 (--backup-file 필수)")
    ap.add_argument("--verify", action="store_true", help="파일·DB·JSON 무결성 검증만")
    ap.add_argument("--backup-file", help="사전 확보한 백업 파일 경로 (--strip 필수)")
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
    log = Log(os.path.join(outdir, f"dt_image_{stamp}.log"))

    if args.extract:
        mode = "단계 1: 추출 (원본 dataUrl 유지)"
    elif args.strip:
        mode = "단계 2: dataUrl 제거"
    elif args.verify:
        mode = "무결성 검증만"
    else:
        mode = "현황 확인만 (dry-run)"

    log("=" * 72)
    log(" 디지털 트윈 대시보드 — 보고서 이미지 분리 (Phase 1-2)")
    log("=" * 72)
    log(f" 접속     : {mask_dsn(dsn)}")
    log(f" 모드     : {mode}")
    log(f" 저장 폴더 : {UPLOAD_FOLDER}")
    log(f" 로그     : {log.path}")
    log("-" * 72)

    if args.strip and not check_backup(args.backup_file, log):
        log("\n결과: [FAIL] 사전조건 미충족. 아무것도 변경하지 않았습니다.")
        log.close()
        sys.exit(1)

    try:
        conn = psycopg.connect(dsn)
    except Exception as exc:
        log(f"[FAIL] DB 접속 실패: {exc}")
        log.close()
        sys.exit(1)

    exit_code = 0
    try:
        cur = conn.cursor()
        _row_id, _ver, projects = load_projects(cur)
        if projects is None:
            log("[FAIL] dashboard_data 에 행이 없습니다.")
            exit_code = 1
        else:
            survey(projects, log)

            if args.verify:
                exit_code = 0 if do_verify(cur, log) else 1
            elif args.extract:
                exit_code = 0 if do_extract(conn, cur, log, dry_run=False) else 1
                if exit_code == 0:
                    do_verify(cur, log)
            elif args.strip:
                exit_code = 0 if do_strip(conn, cur, log, dry_run=False) else 1
            else:
                do_extract(conn, cur, log, dry_run=True)
                log("\n" + "-" * 72)
                log(" 확인만 했습니다. 실제로 분리하려면:")
                log("   python scripts\\dt_image_extract.py --extract")
                log("-" * 72)

    except Exception:
        conn.rollback()
        import traceback
        log("[FAIL] 처리 중 오류가 발생해 롤백했습니다.")
        log(traceback.format_exc())
        exit_code = 1
    finally:
        conn.close()

    log("\n" + "=" * 72)
    log(f" 결과: {'[OK] 완료' if exit_code == 0 else '[FAIL] 실패'}")
    log(f" 로그: {log.path}")
    log("=" * 72)
    log.close()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
