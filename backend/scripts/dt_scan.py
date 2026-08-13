"""
디지털 트윈 대시보드 — 운영 현황 스캔 (읽기 전용)

목적
    "디지털트윈_대시보드_실행계획.md" Phase 0-1.
    개발 데이터로 세운 가정을 운영 실측으로 교체하기 위한 기준선(baseline)을 만든다.

보안 원칙 — 이 스크립트는 데이터 "값"을 출력하지 않는다
    출력하는 것 : 건수, 비율, 바이트 크기, 키(필드) 이름, 타입, 판정([OK]/[WARN])
    출력 안 하는 것 : 과제명, 사람 이름, 설명, 코멘트, 이미지, 그 밖의 모든 값
    → 산출된 .md 파일은 값이 없으므로 반출 부담이 낮다.
    (예외: --emit-mapping 을 붙이면 소유자 매핑 후보 CSV를 별도 파일로 만든다.
     이 CSV 에는 사람 이름이 들어가므로 파일 첫 줄에 반출 금지를 명시하고,
     운영서버 안에서 현업 회람용으로만 사용한다.)

안전성
    - 커넥션을 read-only 로 고정한다. 쓰기 SQL 은 DB 가 거부한다.
    - DDL/DML 을 일절 실행하지 않는다.
    - 실패해도 서비스에 영향이 없다.

사용법 (운영서버)
    cd <프로젝트>/backend
    venv\\Scripts\\activate
    python scripts\\dt_scan.py

    # 접속 정보를 직접 주는 경우
    python scripts\\dt_scan.py --dsn "postgresql://postgres:****@localhost:5432/dxdigitaltwin"

    # 소유자 매핑 후보 CSV 도 함께 생성 (반출 금지 파일)
    python scripts\\dt_scan.py --emit-mapping

산출물
    scripts/out/dt_scan_YYYYMMDD_HHMM.md            ← 반출 검토 대상
    scripts/out/dt_mapping_candidates_YYYYMMDD.csv  ← --emit-mapping 시. 반출 금지

의존성
    표준 라이브러리 + psycopg (이미 설치됨). 신규 패키지 없음.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime

try:
    import psycopg
except ImportError:
    print("[FAIL] psycopg 를 찾을 수 없습니다. venv 를 활성화했는지 확인하세요.")
    sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# 기준 인벤토리 — 실행계획 문서 2-0장 (개발 DB 기준으로 작성된 목록)
# 운영에 이 목록에 없는 키가 있으면 리포트한다. (있어도 실패는 아니다: extra_fields 가 받아냄)
# ─────────────────────────────────────────────────────────────────────────────

BASELINE_PROJECT_KEYS = {
    # 식별자
    "uuid", "id",
    # 기본정보
    "과제명", "사업부", "프로세스", "과제영역", "과제구분", "진행상태", "과제년도",
    "시작", "종료", "진행률", "과제상세설명",
    "PoC과제여부", "중점과제여부", "사업부내공개여부",
    # 담당정보
    "과제PL", "작성자", "관리자", "담당자", "담당부서", "담당부서목록",
    "과제참여인력", "과제참여인력목록",
    # 목록류
    "성과목록", "액션아이템목록", "이슈목록", "월간진척현황", "선행과제목록",
    # 상세과제정보
    "상세정보_과제개요", "상세정보_추진배경", "상세정보_과제목표", "상세정보_상세내용",
    "상세정보_성과", "상세정보_산출물", "상세정보_향후계획", "상세정보_입력완료",
    "이미지_좌측", "이미지_우측", "이미지_개요그림", "이미지_상세내용그림",
    "이미지_향후계획그림", "이미지_그룹1_카테고리", "이미지_그룹2_카테고리",
    # 시스템/삭제
    "createdAt", "updatedAt", "_canceledAt",
    "_deleted", "_deletedAt", "_deletedBy", "_deletedByName",
    "_permanentlyDeleted", "_permanentlyDeletedAt",
    "_permanentlyDeletedBy", "_permanentlyDeletedByName",
}

BASELINE_PERFORMANCE_KEYS = {
    "uuid", "id", "성과항목", "displayName", "대분류", "소분류", "단위", "성과년도",
    "현재수준", "목표수준", "실적수준", "월별실적", "월별실적여부",
    "isAchievementType", "조치사항", "조치사항목록", "보고현황목록", "성과평가",
    "계산로직", "로직입력여부", "디지털트윈기여도", "디지털트윈기여도여부",
    "설명", "성과항목UUID", "isActive", "isFromSample",
    "createdAt", "updatedAt", "linkedProjects",
    # UI 런타임 상태 (이관 제외 대상)
    "isEditing", "_idChanged",
    # 운영 스캔(2026-07-28)에서 확인된 소프트 삭제 — 개발 DB엔 삭제 성과가 0건이라 안 보였음
    "_deleted", "_deletedAt", "_deletedBy", "_deletedByName",
} | {f"실적_{m}월" for m in range(1, 13)}   # 운영 스캔에서 확인된 월별 실적 평면 키 (월별실적 배열과 이중 표현)

# 월별 실적의 두 번째 표현 (배열 `월별실적` 과 공존) — 정본 판정이 필요하다
MONTHLY_FLAT_KEYS = [f"실적_{m}월" for m in range(1, 13)]

# 이관 시 제외하기로 한 UI 런타임 상태 키
RUNTIME_ONLY_KEYS = {"isEditing", "_idChanged"}

IMAGE_KEYS = [
    "이미지_좌측", "이미지_우측", "이미지_개요그림",
    "이미지_상세내용그림", "이미지_향후계획그림",
]


# ─────────────────────────────────────────────────────────────────────────────
# 유틸
# ─────────────────────────────────────────────────────────────────────────────

def human(n: int) -> str:
    """바이트를 읽기 쉬운 단위로."""
    if n is None:
        return "-"
    f = float(n)
    for unit in ("B", "kB", "MB", "GB"):
        if f < 1024 or unit == "GB":
            return f"{f:,.0f} {unit}" if unit == "B" else f"{f:,.1f} {unit}"
        f /= 1024
    return f"{f:.1f} GB"


def jsize(value) -> int:
    """값을 UTF-8 JSON 으로 직렬화했을 때의 바이트 수 (크기 비교용 일관 지표)."""
    try:
        return len(json.dumps(value, ensure_ascii=False).encode("utf-8"))
    except (TypeError, ValueError):
        return 0


def as_obj(value):
    """psycopg 가 json 을 문자열로 돌려주는 경우까지 대비."""
    if isinstance(value, (str, bytes, bytearray)):
        try:
            return json.loads(value)
        except (ValueError, TypeError):
            return None
    return value


def pct(part: int, whole: int) -> str:
    if not whole:
        return "-"
    return f"{part / whole * 100:.1f}%"


def verdict(ok: bool, warn_text: str = "WARN") -> str:
    return "[OK]" if ok else f"[{warn_text}]"


def load_dsn(explicit: str | None) -> str:
    """--dsn > 환경변수 > backend/.env 순으로 접속 문자열을 찾는다."""
    if explicit:
        return normalize_dsn(explicit)

    env_url = os.environ.get("DATABASE_URL")
    if env_url:
        return normalize_dsn(env_url)

    here = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(os.path.dirname(here), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8-sig", errors="replace") as fh:
            for line in fh:
                line = line.strip()
                if line.startswith("DATABASE_URL="):
                    return normalize_dsn(line.split("=", 1)[1].strip().strip('"').strip("'"))

    raise SystemExit(
        "[FAIL] DATABASE_URL 을 찾지 못했습니다.\n"
        "       backend/.env 에 DATABASE_URL 이 있는지 확인하거나 --dsn 으로 직접 주세요."
    )


def normalize_dsn(url: str) -> str:
    """SQLAlchemy 형식(postgresql+psycopg://)을 libpq 형식으로 변환."""
    return re.sub(r"^postgresql\+\w+://", "postgresql://", url)


def mask_dsn(dsn: str) -> str:
    """로그에 남길 접속 문자열에서 비밀번호를 가린다."""
    return re.sub(r"://([^:/@]+):([^@]*)@", r"://\1:****@", dsn)


def enforce_read_only(conn) -> bool:
    """
    세션을 읽기 전용으로 고정하고, **실제로 쓰기가 거부되는지 증명**한다.

    주의: psycopg3 의 `conn.read_only = True` 는 autocommit 모드에서 효과가 없다.
          (명시적 BEGIN 이 없어 READ ONLY 속성이 붙지 않는다.)
          그래서 세션 특성을 직접 설정하고, 반드시 프로브로 검증한다.

    프로브는 실패하는 것이 정상이며, 설령 실행되더라도 데이터에 영향이 없는 문장만 쓴다.
    """
    try:
        conn.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")
    except Exception as exc:
        print(f"[FAIL] 읽기 전용 세션 설정 실패: {exc}")
        return False

    try:
        conn.read_only = True          # 비-autocommit 경로까지 대비 (실패해도 무시)
    except Exception:
        pass

    setting = "?"
    try:
        row = conn.execute("SHOW default_transaction_read_only").fetchone()
        setting = row[0] if row else "?"
    except Exception:
        pass

    # 쓰기가 실제로 거부되는지 검증 — 통과하면 안 된다.
    # 두 프로브 모두 설령 실행되더라도 데이터 변경이 0건이다.
    probes = [
        ("DDL", "CREATE TEMP TABLE _dt_scan_ro_probe (x int)"),
        ("DML", "DELETE FROM dashboard_data WHERE false"),
    ]
    for label, sql in probes:
        try:
            conn.execute(sql)
        except psycopg.errors.ReadOnlySqlTransaction:
            continue                                   # 기대한 거부
        except psycopg.errors.UndefinedTable:
            continue                                   # 대상 테이블 없음 — 검증 대상 아님
        except Exception:
            continue                                   # 그 밖의 이유로도 쓰기가 안 됨
        print(f"[FAIL] 읽기 전용 보호가 동작하지 않습니다 ({label} 프로브가 통과함).")
        print(f"       default_transaction_read_only = {setting}")
        print("       안전을 위해 중단합니다. 데이터는 변경되지 않았습니다.")
        return False

    print(f" 보호 : 읽기 전용 확인됨 (default_transaction_read_only = {setting}, 쓰기 프로브 2/2 거부)")
    return True


def table_exists(cur, name: str) -> bool:
    cur.execute(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = %s",
        (name,),
    )
    return cur.fetchone() is not None


def scalar(cur, sql: str, params=None, default=None):
    try:
        cur.execute(sql, params or ())
        row = cur.fetchone()
        return row[0] if row else default
    except Exception:
        return default


# ─────────────────────────────────────────────────────────────────────────────
# 스캔 본체
# ─────────────────────────────────────────────────────────────────────────────

class Scan:
    def __init__(self, cur):
        self.cur = cur
        self.md: list[str] = []
        self.findings: list[tuple[str, str, str]] = []   # (판정, 항목, 요약)
        self.projects: list[dict] = []
        self.performances: list[dict] = []
        self.users: list[dict] = []
        self.mapping_rows: list[dict] = []

    # ── 출력 헬퍼 ────────────────────────────────────────────────────────
    def h(self, level: int, text: str):
        self.md.append(f"\n{'#' * level} {text}\n")

    def p(self, text: str = ""):
        self.md.append(text)

    def table(self, headers: list[str], rows: list[list]):
        if not rows:
            self.md.append("_(해당 없음)_")
            return
        self.md.append("| " + " | ".join(str(h) for h in headers) + " |")
        self.md.append("|" + "|".join("---" for _ in headers) + "|")
        for r in rows:
            self.md.append("| " + " | ".join("" if c is None else str(c) for c in r) + " |")

    def finding(self, ok: bool, item: str, summary: str, warn_text: str = "WARN"):
        self.findings.append((verdict(ok, warn_text), item, summary))

    # ── 0. 환경 ─────────────────────────────────────────────────────────
    def sec_env(self):
        self.h(2, "0. 환경")
        pgver = scalar(self.cur, "SHOW server_version", default="?")
        dbname = scalar(self.cur, "SELECT current_database()", default="?")
        dbsize = scalar(self.cur, "SELECT pg_database_size(current_database())", default=0)
        alembic = "-"
        if table_exists(self.cur, "alembic_version"):
            alembic = scalar(self.cur, "SELECT version_num FROM alembic_version LIMIT 1", default="-")
        ntables = scalar(
            self.cur,
            "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
            default=0,
        )
        self.table(
            ["항목", "값"],
            [
                ["PostgreSQL", pgver],
                ["데이터베이스", dbname],
                ["DB 전체 크기", human(dbsize)],
                ["alembic_version", alembic],
                ["public 테이블 수", ntables],
                ["스캔 시각", datetime.now().strftime("%Y-%m-%d %H:%M:%S")],
            ],
        )

    # ── 1. 싱글톤 현황 ──────────────────────────────────────────────────
    def sec_singleton(self):
        self.h(2, "1. dashboard_data (싱글톤) 현황")

        if not table_exists(self.cur, "dashboard_data"):
            self.p("> ⚠️ `dashboard_data` 테이블이 없습니다. 이후 분석을 건너뜁니다.")
            self.finding(False, "dashboard_data", "테이블 없음", "FAIL")
            return False

        nrows = scalar(self.cur, "SELECT count(*) FROM dashboard_data", default=0)
        self.cur.execute(
            "SELECT version, "
            "       octet_length(projects::text), "
            "       octet_length(performances::text), "
            "       octet_length(data_metadata::text), "
            "       updated_at, "
            "       projects, performances "
            "FROM dashboard_data ORDER BY id LIMIT 1"
        )
        row = self.cur.fetchone()
        if row is None:
            self.p("> ⚠️ `dashboard_data` 에 행이 없습니다.")
            self.finding(False, "dashboard_data", "행 0건", "FAIL")
            return False

        version, proj_bytes, perf_bytes, meta_bytes, updated_at, projects, performances = row
        self.projects = [p for p in (as_obj(projects) or []) if isinstance(p, dict)]
        self.performances = [p for p in (as_obj(performances) or []) if isinstance(p, dict)]

        payload = (proj_bytes or 0) + (perf_bytes or 0)

        self.table(
            ["항목", "값", "비고"],
            [
                ["행 수", nrows, "싱글톤이면 1"],
                ["version", version, "누적 전량 덮어쓰기 횟수"],
                ["최종 수정", updated_at, ""],
                ["projects 저장 텍스트", human(proj_bytes), f"{len(self.projects):,}건"],
                ["performances 저장 텍스트", human(perf_bytes), f"{len(self.performances):,}건"],
                ["data_metadata", human(meta_bytes), ""],
                ["**저장/조회 1회 payload**", f"**{human(payload)}**", "압축 없이 매 저장마다 왕복"],
            ],
        )

        self.finding(nrows == 1, "싱글톤 구조", f"dashboard_data {nrows}행")
        self.finding(
            payload < 500 * 1024,
            "저장 payload",
            f"{human(payload)} (저장 1회당 업로드+다운로드로 약 {human(payload * 2)} 왕복)",
        )

        # 과제/성과 상태 분해
        act = sum(1 for p in self.projects if not p.get("_deleted") and not p.get("_permanentlyDeleted"))
        soft = sum(1 for p in self.projects if p.get("_deleted") and not p.get("_permanentlyDeleted"))
        perm = sum(1 for p in self.projects if p.get("_permanentlyDeleted"))
        perf_act = sum(1 for p in self.performances if not p.get("_deleted"))
        perf_del = len(self.performances) - perf_act

        self.h(3, "1.1 상태별 분해")
        self.table(
            ["구분", "건수", "비율"],
            [
                ["과제 — 활성", act, pct(act, len(self.projects))],
                ["과제 — 소프트 삭제", soft, pct(soft, len(self.projects))],
                ["과제 — 영구 삭제", perm, pct(perm, len(self.projects))],
                ["과제 — 합계", len(self.projects), "100%"],
                ["성과 — 활성", perf_act, pct(perf_act, len(self.performances))],
                ["성과 — 삭제", perf_del, pct(perf_del, len(self.performances))],
                ["성과 — 합계", len(self.performances), "100%"],
            ],
        )

        dead = soft + perm
        self.finding(
            dead == 0 or dead / max(len(self.projects), 1) < 0.15,
            "삭제분 적재",
            f"삭제 상태 과제 {dead}건이 매 조회에 함께 전송됨 (GET /data 가 _deleted 를 거르지 않음)",
        )
        return True

    # ── 2. 키 인벤토리 ──────────────────────────────────────────────────
    def _key_stats(self, records: list[dict]):
        cnt = Counter()
        nonempty = Counter()
        size = Counter()
        types = defaultdict(Counter)
        empties = (None, "", [], {}, 0, False)
        for rec in records:
            for k, v in rec.items():
                cnt[k] += 1
                size[k] += jsize(v)
                types[k][type(v).__name__] += 1
                if not any(v is e or v == e for e in empties):
                    nonempty[k] += 1
        return cnt, nonempty, size, types

    def _inventory_block(self, title: str, records: list[dict], baseline: set[str]):
        self.h(3, title)
        if not records:
            self.p("_(데이터 없음)_")
            return set()

        cnt, nonempty, size, types = self._key_stats(records)
        rows = []
        for k in sorted(cnt, key=lambda x: (-size[x], x)):
            mark = "" if k in baseline else " ⚠️**신규**"
            note = ""
            if k in RUNTIME_ONLY_KEYS:
                note = "UI 런타임 상태 (이관 제외 대상)"
            rows.append([
                f"`{k}`{mark}",
                f"{cnt[k]:,}",
                f"{nonempty[k]:,}",
                "/".join(sorted(types[k])),
                human(size[k]),
                note,
            ])
        self.table(["키", "보유", "값있음", "타입", "총 크기", "비고"], rows)

        found = set(cnt)
        new_keys = found - baseline
        missing = baseline - found

        self.p()
        self.p(f"- 실재 키: **{len(found)}개** / 기준 인벤토리: {len(baseline)}개")
        if new_keys:
            self.p(f"- ⚠️ **기준에 없는 신규 키 {len(new_keys)}개**: "
                   + ", ".join(f"`{k}`" for k in sorted(new_keys)))
            self.p("  → 실행계획 2-0 인벤토리에 추가할 것. "
                   "(추가하지 않아도 `extra_fields` 가 받아내므로 데이터 유실은 없음)")
        else:
            self.p("- 기준에 없는 신규 키: **없음**")
        if missing:
            self.p(f"- 기준에 있으나 운영에 없는 키 {len(missing)}개: "
                   + ", ".join(f"`{k}`" for k in sorted(missing))
                   + " _(개발 전용 필드이거나 미사용. 스키마에 남겨도 무해)_")
        return new_keys

    def sec_inventory(self):
        self.h(2, "2. 키 인벤토리 — 이관 누락 방지")
        self.p("> 기준: 실행계획 문서 2-0장(개발 DB 기준 작성). "
               "여기서 나온 차이로 문서를 갱신한다.")

        new_p = self._inventory_block("2.1 과제(projects) 키", self.projects, BASELINE_PROJECT_KEYS)
        new_f = self._inventory_block("2.2 성과(performances) 키", self.performances, BASELINE_PERFORMANCE_KEYS)

        self.finding(
            not new_p and not new_f,
            "키 인벤토리",
            f"신규 키 과제 {len(new_p)}개 / 성과 {len(new_f)}개"
            + (" — 문서 갱신 필요" if (new_p or new_f) else ""),
            "정보",
        )

        # 중첩 구조
        self.h(3, "2.3 중첩 구조 원소의 키")
        nested = [
            ("성과목록[] (과제→성과 조인)", "성과목록", self.projects),
            ("액션아이템목록[]", "액션아이템목록", self.projects),
            ("이슈목록[]", "이슈목록", self.projects),
            ("과제참여인력목록[]", "과제참여인력목록", self.projects),
            ("담당자[]", "담당자", self.projects),
            ("선행과제목록[]", "선행과제목록", self.projects),
            ("linkedProjects[] (성과→과제 역방향)", "linkedProjects", self.performances),
            ("조치사항목록[]", "조치사항목록", self.performances),
            ("보고현황목록[]", "보고현황목록", self.performances),
        ]
        rows = []
        for label, key, source in nested:
            c = Counter()
            n_elem = 0
            for rec in source:
                arr = rec.get(key)
                if isinstance(arr, list):
                    for elem in arr:
                        n_elem += 1
                        if isinstance(elem, dict):
                            c.update(elem.keys())
            if n_elem == 0:
                rows.append([label, 0, "_(원소 없음)_"])
            else:
                keys_desc = ", ".join(f"`{k}`({v})" for k, v in c.most_common())
                rows.append([label, f"{n_elem:,}", keys_desc or "_(스칼라 원소)_"])
        self.table(["구조", "원소 수", "원소가 가진 키(빈도)"], rows)

        # 이미지 원소
        img_elem = Counter()
        n_img = 0
        for rec in self.projects:
            for k in IMAGE_KEYS:
                arr = rec.get(k)
                if isinstance(arr, list):
                    for elem in arr:
                        n_img += 1
                        if isinstance(elem, dict):
                            img_elem.update(elem.keys())
        self.p()
        self.p(f"- 이미지 원소 총 {n_img:,}개, 키: "
               + (", ".join(f"`{k}`({v})" for k, v in img_elem.most_common()) or "_(없음)_"))

        # 월간진척현황 키
        months = Counter()
        for rec in self.projects:
            mp = rec.get("월간진척현황")
            if isinstance(mp, dict):
                months.update(mp.keys())
        self.p(f"- 월간진척현황 키: "
               + (", ".join(f"`{k}`({v})" for k, v in sorted(months.items())) or "_(없음)_"))

    # ── 3. 이미지 인라인 ────────────────────────────────────────────────
    def sec_images(self):
        self.h(2, "3. 보고서 이미지 base64 인라인 ★ Phase 1 우선순위 결정")

        total_payload = sum(jsize(p) for p in self.projects)
        img_total = 0
        img_projects = set()
        per_key = Counter()
        img_count = 0
        biggest = []

        for rec in self.projects:
            pid = rec.get("id") or rec.get("uuid") or "?"
            sub = 0
            for k in IMAGE_KEYS:
                arr = rec.get(k)
                if isinstance(arr, list) and arr:
                    s = jsize(arr)
                    per_key[k] += s
                    sub += s
                    for elem in arr:
                        if isinstance(elem, dict) and isinstance(elem.get("dataUrl"), str):
                            if elem["dataUrl"].startswith("data:"):
                                img_count += 1
            if sub > 0:
                img_total += sub
                img_projects.add(pid)
                biggest.append((pid, sub))

        biggest.sort(key=lambda x: -x[1])

        self.table(
            ["항목", "값", "판정"],
            [
                ["이미지 보유 과제 수", f"{len(img_projects):,} / {len(self.projects):,}",
                 verdict(len(img_projects) <= 5, "주의")],
                ["인라인 이미지 장수", f"{img_count:,}", ""],
                ["이미지 총 용량", human(img_total), ""],
                ["과제 payload 총량", human(total_payload), ""],
                ["**payload 중 이미지 비중**", f"**{pct(img_total, total_payload)}**",
                 verdict(total_payload == 0 or img_total / max(total_payload, 1) < 0.15, "주의")],
            ],
        )

        if per_key:
            self.h(3, "3.1 이미지 키별 용량")
            self.table(
                ["키", "총 용량"],
                [[f"`{k}`", human(v)] for k, v in per_key.most_common()],
            )

        if biggest:
            self.h(3, "3.2 이미지가 큰 과제 상위 10 (과제 id 만 표시, 과제명 미출력)")
            self.table(
                ["과제 id", "이미지 용량"],
                [[pid, human(sz)] for pid, sz in biggest[:10]],
            )

        # 과제 1건 크기 분포
        sizes = sorted((jsize(p) for p in self.projects), reverse=True)
        if sizes:
            avg = sum(sizes) / len(sizes)
            self.h(3, "3.3 과제 1건 크기 분포")
            self.table(
                ["지표", "값"],
                [
                    ["평균", human(int(avg))],
                    ["중앙값", human(sizes[len(sizes) // 2])],
                    ["최대", human(sizes[0])],
                    ["최대/평균 배수", f"{sizes[0] / avg:.0f}배" if avg else "-"],
                ],
            )

        self.finding(
            len(img_projects) <= 5 and img_total < 200 * 1024,
            "이미지 인라인",
            f"{len(img_projects)}개 과제 / {human(img_total)} / payload의 {pct(img_total, total_payload)}"
            + (" — Phase 1-2(파일 분리)를 최우선으로 올릴 것"
               if len(img_projects) > 5 else ""),
        )

    # ── 4. 데이터 품질 ──────────────────────────────────────────────────
    def sec_quality(self):
        self.h(2, "4. 데이터 품질 — 이관 예외 규모")

        # updatedAt 포맷
        fmt = Counter()
        for rec in self.projects:
            v = rec.get("updatedAt") or rec.get("updated_at")
            if v is None or v == "":
                fmt["없음(NULL/빈값)"] += 1
            elif isinstance(v, str) and v.endswith("Z"):
                fmt["ISO+Z"] += 1
            else:
                fmt["기타 포맷"] += 1

        self.h(3, "4.1 updatedAt (병합 최신성 판정에 사용)")
        self.table(
            ["포맷", "건수", "비율"],
            [[k, v, pct(v, len(self.projects))] for k, v in fmt.most_common()],
        )
        missing_ts = fmt.get("없음(NULL/빈값)", 0)
        self.p()
        self.p("> `/data/upsert` 는 `new_updated >= existing_updated` 문자열 비교로 덮어쓸지 판단한다. "
               "값이 없으면 `'' >= ''` 가 참이 되어 **무조건 덮어쓴다.**")
        self.finding(
            missing_ts == 0,
            "updatedAt 결측",
            f"{missing_ts}건 ({pct(missing_ts, len(self.projects))}) — 이 과제들은 동시 수정 시 조용히 덮어쓰기됨",
        )

        # 키 고유성
        self.h(3, "4.2 키 고유성 (uuid 를 PK 로 쓸 수 있는가)")
        rows = []
        for label, recs in (("과제", self.projects), ("성과", self.performances)):
            uuids = [r.get("uuid") for r in recs]
            ids = [r.get("id") for r in recs]
            u_missing = sum(1 for u in uuids if not u)
            i_missing = sum(1 for i in ids if not i)
            u_dup = len(uuids) - len(set(u for u in uuids if u)) - u_missing
            i_dup = len(ids) - len(set(i for i in ids if i)) - i_missing
            rows.append([label, len(recs), u_missing, max(u_dup, 0), i_missing, max(i_dup, 0)])
            self.finding(
                u_missing == 0 and u_dup <= 0,
                f"{label} uuid 고유성",
                f"누락 {u_missing}건 / 중복 {max(u_dup, 0)}건",
            )
        self.table(["구분", "건수", "uuid 누락", "uuid 중복", "id 누락", "id 중복"], rows)

        # 성과 참조 무결성 + 양방향 대조
        self.h(3, "4.3 과제↔성과 연결 (양방향 대조) ★")
        perf_by_uuid = {p.get("uuid") for p in self.performances if p.get("uuid")}
        perf_by_id = {p.get("id") for p in self.performances if p.get("id")}

        fwd = set()          # (project_uuid, performance_key)
        fwd_refs = 0
        orphan = 0
        fmt_counter = Counter()
        for rec in self.projects:
            puid = rec.get("uuid")
            arr = rec.get("성과목록")
            if not isinstance(arr, list):
                continue
            for elem in arr:
                fwd_refs += 1
                if not isinstance(elem, dict):
                    fmt_counter["문자열 참조"] += 1
                    continue
                key = None
                for cand in ("성과항목UUID", "성과UUID", "uuid"):
                    if elem.get(cand):
                        key = elem[cand]
                        fmt_counter[cand] += 1
                        break
                if key is None:
                    for cand in ("성과항목ID", "id"):
                        if elem.get(cand):
                            key = elem[cand]
                            fmt_counter[cand] += 1
                            break
                if key is None:
                    orphan += 1
                    continue
                if key in perf_by_uuid or key in perf_by_id:
                    fwd.add((puid, key))
                else:
                    orphan += 1

        rev = set()
        rev_refs = 0
        for perf in self.performances:
            puid = perf.get("uuid")
            arr = perf.get("linkedProjects")
            if not isinstance(arr, list):
                continue
            for elem in arr:
                rev_refs += 1
                if isinstance(elem, dict):
                    pk = elem.get("uuid") or elem.get("과제UUID") or elem.get("id")
                elif isinstance(elem, str):
                    pk = elem
                else:
                    pk = None
                if pk:
                    rev.add((pk, puid))

        only_fwd = len(fwd - rev)
        only_rev = len(rev - fwd)

        self.table(
            ["항목", "값", "판정"],
            [
                ["과제→성과 (`성과목록`) 참조 수", f"{fwd_refs:,}", ""],
                ["성과→과제 (`linkedProjects`) 참조 수", f"{rev_refs:,}", ""],
                ["고아 참조 (존재하지 않는 성과 지목)", f"{orphan:,}", verdict(orphan == 0)],
                ["**정방향에만 있는 연결**", f"**{only_fwd:,}**", verdict(only_fwd == 0, "확인")],
                ["**역방향에만 있는 연결**", f"**{only_rev:,}**", verdict(only_rev == 0, "확인")],
            ],
        )
        if fmt_counter:
            self.p()
            self.p("- 참조 키 포맷 분포: "
                   + ", ".join(f"`{k}` {v}건" for k, v in fmt_counter.most_common()))
        self.p()
        self.p("> 양쪽이 어긋나면 이관 시 **어느 쪽을 정본으로 볼지 결정**해야 한다. "
               "(실행계획 2-0 판단사항 '라')")
        self.finding(
            only_fwd == 0 and only_rev == 0,
            "연결 양방향 일치",
            f"정방향 전용 {only_fwd}건 / 역방향 전용 {only_rev}건",
            "확인필요",
        )

        # 월별 실적 이중 표현 대조
        self.h(3, "4.4 성과 월별 실적 — 두 가지 표현이 공존한다 ★ 정본 결정 필요")
        self.p("`월별실적`(배열) 과 `실적_1월`…`실적_12월`(평면 키) 이 같은 값을 두 곳에 담고 있다. "
               "이관 시 **어느 쪽을 정본으로 볼지** 정해야 하므로, 실제로 일치하는지 대조한다.")

        only_arr = only_flat = both = neither = 0
        agree = disagree = 0
        disagree_months = Counter()

        def norm(v):
            """비교용 정규화 — 빈값 계열을 하나로 취급."""
            if v is None or v == "" or v == []:
                return None
            if isinstance(v, str):
                s = v.strip()
                return None if s == "" else s
            return v

        for perf in self.performances:
            arr = perf.get("월별실적")
            has_arr = isinstance(arr, list) and any(norm(x) is not None for x in arr)
            flat = {m: norm(perf.get(f"실적_{m}월")) for m in range(1, 13)}
            has_flat = any(v is not None for v in flat.values())

            if has_arr and has_flat:
                both += 1
                mismatched = False
                for m in range(1, 13):
                    a = norm(arr[m - 1]) if len(arr) >= m else None
                    b = flat[m]
                    if a is None and b is None:
                        continue
                    if str(a) != str(b):
                        mismatched = True
                        disagree_months[f"{m}월"] += 1
                if mismatched:
                    disagree += 1
                else:
                    agree += 1
            elif has_arr:
                only_arr += 1
            elif has_flat:
                only_flat += 1
            else:
                neither += 1

        self.table(
            ["구분", "성과 수", "비율"],
            [
                ["둘 다 값 있음", both, pct(both, len(self.performances))],
                ["└ 값이 **일치**", agree, pct(agree, max(both, 1))],
                ["└ 값이 **불일치**", disagree, pct(disagree, max(both, 1))],
                ["`월별실적` 배열만", only_arr, pct(only_arr, len(self.performances))],
                ["`실적_N월` 평면 키만", only_flat, pct(only_flat, len(self.performances))],
                ["둘 다 비어 있음", neither, pct(neither, len(self.performances))],
            ],
        )
        if disagree_months:
            self.p()
            self.p("- 불일치가 발생한 월: "
                   + ", ".join(f"{k}({v}건)" for k, v in sorted(
                       disagree_months.items(), key=lambda x: int(x[0][:-1]))))
        self.p()
        self.p("> **판정 기준**: 불일치 0건이면 어느 쪽을 정본으로 삼아도 안전하다. "
               "불일치가 있으면 화면에 실제로 표시되는 쪽(프론트 코드 확인)을 정본으로 삼고, "
               "다른 쪽은 `extra_fields` 에 보관한다.")
        self.finding(
            disagree == 0,
            "월별실적 이중 표현",
            f"둘 다 보유 {both}건 중 불일치 {disagree}건 "
            f"(배열만 {only_arr} / 평면만 {only_flat})",
            "정본결정",
        )

        # 샘플 데이터 혼입
        n_sample_issue = sum(
            1 for rec in self.projects
            for e in (rec.get("이슈목록") or [])
            if isinstance(e, dict) and e.get("_sample")
        )
        n_sample_perf = sum(1 for p in self.performances if p.get("isFromSample"))
        self.h(3, "4.4 샘플/런타임 데이터 혼입")
        self.table(
            ["항목", "건수", "방침"],
            [
                ["`_sample` 이슈", n_sample_issue, "이관 여부 결정 필요 (기본: 플래그 유지 이관)"],
                ["`isFromSample` 성과", n_sample_perf, "동일"],
                ["`isEditing` 보유 성과",
                 sum(1 for p in self.performances if "isEditing" in p), "이관 제외"],
                ["`_idChanged` 보유 성과",
                 sum(1 for p in self.performances if "_idChanged" in p), "이관 제외"],
            ],
        )

    # ── 5. 소유자 매핑 가능성 ───────────────────────────────────────────
    def sec_ownership(self):
        self.h(2, "5. 과제 소유자 매핑 가능성 ★ Phase 0-2 임계경로 길이 결정")

        if not table_exists(self.cur, "users"):
            self.p("> ⚠️ `users` 테이블이 없습니다.")
            return

        self.cur.execute("SELECT id, email, name, department, role FROM users ORDER BY id")
        cols = [d.name for d in self.cur.description]
        self.users = [dict(zip(cols, r)) for r in self.cur.fetchall()]

        by_name = {}
        by_local = {}
        for u in self.users:
            if u.get("name"):
                by_name.setdefault(u["name"].strip(), u)
            if u.get("email") and "@" in u["email"]:
                by_local.setdefault(u["email"].split("@")[0].strip().lower(), u)

        active = [p for p in self.projects
                  if not p.get("_deleted") and not p.get("_permanentlyDeleted")]

        hit_knox = hit_pl = hit_writer = 0
        resolved = 0
        for rec in active:
            pid = rec.get("id") or rec.get("uuid")
            owner = None
            source = "-"

            # 1순위: 참여인력 knoxId → users.email 로컬파트
            for elem in (rec.get("과제참여인력목록") or []):
                if isinstance(elem, dict) and elem.get("knoxId"):
                    cand = by_local.get(str(elem["knoxId"]).strip().lower())
                    if cand:
                        owner, source = cand, "knoxId"
                        hit_knox += 1
                        break
            # 2순위: 과제PL 이름
            if owner is None and rec.get("과제PL"):
                cand = by_name.get(str(rec["과제PL"]).strip())
                if cand:
                    owner, source = cand, "과제PL"
                    hit_pl += 1
            # 3순위: 작성자 이름
            if owner is None and rec.get("작성자"):
                cand = by_name.get(str(rec["작성자"]).strip())
                if cand:
                    owner, source = cand, "작성자"
                    hit_writer += 1

            if owner is not None:
                resolved += 1

            self.mapping_rows.append({
                "project_id": pid,
                "project_uuid": rec.get("uuid"),
                "과제PL": rec.get("과제PL") or "",
                "작성자": rec.get("작성자") or "",
                "knoxId후보": ";".join(
                    str(e.get("knoxId")) for e in (rec.get("과제참여인력목록") or [])
                    if isinstance(e, dict) and e.get("knoxId")
                ),
                "매핑근거": source,
                "owner_user_id": owner["id"] if owner else "",
                "owner_name": owner["name"] if owner else "",
            })

        n = len(active)
        unresolved = n - resolved
        self.table(
            ["매핑 근거", "성공 건수", "비율"],
            [
                ["1순위 `knoxId` → users.email", hit_knox, pct(hit_knox, n)],
                ["2순위 `과제PL` → users.name", hit_pl, pct(hit_pl, n)],
                ["3순위 `작성자` → users.name", hit_writer, pct(hit_writer, n)],
                ["**자동 매핑 합계**", f"**{resolved}**", f"**{pct(resolved, n)}**"],
                ["**현업 확인 필요**", f"**{unresolved}**", f"**{pct(unresolved, n)}**"],
                ["활성 과제 총계", n, "100%"],
            ],
        )
        self.p()
        self.p(f"- 계정 수: {len(self.users)}명 "
               f"(이름 보유 {len(by_name)}, 이메일 로컬파트 보유 {len(by_local)})")
        self.p("- 자동 매핑률이 높을수록 **Phase 0-2(현업 회람) 기간이 짧아진다.** "
               "미매핑분은 admin 임시 소유로 두고 순차 이관한다.")
        self.finding(
            unresolved <= n * 0.2,
            "소유자 자동 매핑",
            f"{resolved}/{n} 자동 해결 ({pct(resolved, n)}), 현업 확인 {unresolved}건",
        )

    # ── 6. 조직 데이터 ──────────────────────────────────────────────────
    def sec_org(self):
        self.h(2, "6. 조직 데이터 — '같은 부서 manager' 권한 규칙의 전제")

        rows = []
        ok_all = True

        if table_exists(self.cur, "divisions"):
            total = scalar(self.cur, "SELECT count(*) FROM divisions", default=0)
            uniq = scalar(self.cur, "SELECT count(DISTINCT name) FROM divisions", default=0)
            dup_ok = total == uniq
            ok_all &= dup_ok
            rows.append(["divisions 행 수", total, ""])
            rows.append(["divisions 고유 이름 수", uniq, verdict(dup_ok, "중복")])

        if table_exists(self.cur, "departments"):
            dtotal = scalar(self.cur, "SELECT count(*) FROM departments", default=0)
            dnull = scalar(self.cur, "SELECT count(*) FROM departments WHERE division_id IS NULL", default=0)
            ok_all &= (dnull == 0)
            rows.append(["departments 행 수", dtotal, ""])
            rows.append(["departments.division_id NULL", dnull, verdict(dnull == 0, "백필필요")])

        if self.users:
            no_dept = sum(1 for u in self.users if not u.get("department"))
            n_mgr = sum(1 for u in self.users if u.get("role") in ("manager", "admin"))
            rows.append(["users 부서 미기입", no_dept, verdict(no_dept == 0, "확인")])
            rows.append(["manager/admin 계정 수", n_mgr, ""])

        self.table(["항목", "값", "판정"], rows)

        # 과제 사업부 값 ↔ divisions
        div_names = set()
        if table_exists(self.cur, "divisions"):
            self.cur.execute("SELECT DISTINCT name FROM divisions")
            div_names = {r[0] for r in self.cur.fetchall() if r[0]}

        used = Counter(
            p.get("사업부") for p in self.projects
            if not p.get("_permanentlyDeleted") and p.get("사업부")
        )
        unmatched = [d for d in used if d not in div_names]
        self.h(3, "6.1 과제 `사업부` 값 ↔ divisions 매칭")
        self.table(
            ["사업부 값", "과제 수", "divisions 존재"],
            [[d, c, "O" if d in div_names else "**X**"] for d, c in used.most_common()],
        )
        self.finding(
            not unmatched and ok_all,
            "조직 데이터",
            (f"divisions 미매칭 값 {len(unmatched)}종. " if unmatched else "")
            + ("departments.division_id 백필 필요" if not ok_all else "권한 규칙 계산 가능"),
        )

    # ── 7. 곁다리 테이블 ────────────────────────────────────────────────
    def sec_side_tables(self):
        self.h(2, "7. 곁다리 테이블 — 정리/이관 범위")

        # 스냅샷
        if table_exists(self.cur, "dashboard_snapshots"):
            self.h(3, "7.1 dashboard_snapshots (저장할 때마다 전체 복사본이 쌓임)")
            self.cur.execute(
                "SELECT snapshot_type, count(*), sum(length(snapshot_data::text)) "
                "FROM dashboard_snapshots GROUP BY 1 ORDER BY 2 DESC"
            )
            rows, tot_n, tot_b = [], 0, 0
            for t, c, b in self.cur.fetchall():
                rows.append([t, f"{c:,}", human(b or 0)])
                tot_n += c
                tot_b += (b or 0)
            rows.append(["**합계**", f"**{tot_n:,}**", f"**{human(tot_b)}**"])
            self.table(["타입", "건수", "JSON 텍스트 합계"], rows)

            disk = scalar(self.cur,
                          "SELECT pg_total_relation_size('dashboard_snapshots')", default=0)
            self.cur.execute("SELECT min(created_at)::date, max(created_at)::date FROM dashboard_snapshots")
            oldest, newest = self.cur.fetchone() or (None, None)
            self.p()
            self.p(f"- 디스크 실사용: **{human(disk)}** / 기간: {oldest} ~ {newest}")
            self.finding(
                tot_n <= 50,
                "스냅샷 누적",
                f"{tot_n:,}건 / 논리 {human(tot_b)} / 디스크 {human(disk)}"
                + (" — Phase 1-3 정리 대상" if tot_n > 50 else ""),
            )

        # 활동 로그
        if table_exists(self.cur, "dashboard_activity_logs"):
            n = scalar(self.cur, "SELECT count(*) FROM dashboard_activity_logs", default=0)
            d = scalar(self.cur, "SELECT pg_total_relation_size('dashboard_activity_logs')", default=0)
            self.h(3, "7.2 dashboard_activity_logs")
            self.p(f"- {n:,}건 / {human(d)} — 구조 의존 없음. V2 이관 제외(그대로 유지)")

        # 첨부파일
        if table_exists(self.cur, "project_attachments"):
            self.h(3, "7.3 project_attachments (디스크 저장 — 보고서 이미지와 다름)")
            n = scalar(self.cur, "SELECT count(*) FROM project_attachments", default=0)
            sz = scalar(self.cur, "SELECT coalesce(sum(file_size),0) FROM project_attachments", default=0)
            self.cur.execute("SELECT DISTINCT project_id FROM project_attachments")
            att_pids = {r[0] for r in self.cur.fetchall()}
            known = {p.get("uuid") for p in self.projects} | {p.get("id") for p in self.projects}
            orphan = len([p for p in att_pids if p not in known])
            self.table(
                ["항목", "값", "판정"],
                [
                    ["첨부 건수", f"{n:,}", ""],
                    ["총 용량", human(sz), ""],
                    ["연결된 과제 수", len(att_pids), ""],
                    ["고아 첨부(과제 없음)", orphan, verdict(orphan == 0)],
                ],
            )
            self.finding(orphan == 0, "첨부파일 무결성", f"고아 {orphan}건")

        # module_settings
        if table_exists(self.cur, "module_settings"):
            self.h(3, "7.4 module_settings — 과제 uuid 종속 설정 탐지 ★")
            self.cur.execute(
                "SELECT settings_key, octet_length(settings_data::text), updated_at, settings_data "
                "FROM module_settings WHERE module_name = 'digital_twin_dashboard' "
                "ORDER BY settings_key"
            )
            uuid_re = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
            known_uuids = {p.get("uuid") for p in self.projects if p.get("uuid")}
            rows, dependent = [], []
            for key, nbytes, upd, data in self.cur.fetchall():
                obj = as_obj(data)
                dep = "-"
                if isinstance(obj, dict):
                    ks = list(obj.keys())
                    n_uuid = sum(1 for k in ks if uuid_re.match(str(k)))
                    n_match = sum(1 for k in ks if k in known_uuids)
                    if n_uuid:
                        dep = f"⚠️ **과제 uuid 키 {n_uuid}개** (실재 과제와 매칭 {n_match})"
                        dependent.append(key)
                rows.append([f"`{key}`", human(nbytes), str(upd)[:16], dep])
            self.table(["settings_key", "크기", "최종수정", "과제 종속성"], rows)
            self.p()
            if dependent:
                self.p("> ⚠️ 위 설정은 **과제 uuid 를 키로 삼는다.** V2 전환 시 함께 옮기지 않으면 "
                       "해당 상태가 통째로 사라진다. → `dt2_projects` 컬럼으로 흡수 검토.")
            self.finding(
                not dependent,
                "module_settings 과제 종속",
                ", ".join(dependent) if dependent else "종속 설정 없음",
                "이관필요",
            )

        # 디스크 Top
        self.h(3, "7.5 테이블 디스크 사용량 Top 10")
        self.cur.execute(
            "SELECT c.relname, pg_total_relation_size(c.oid) "
            "FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = 'public' AND c.relkind = 'r' "
            "ORDER BY 2 DESC LIMIT 10"
        )
        self.table(
            ["테이블", "총 크기"],
            [[r[0], human(r[1])] for r in self.cur.fetchall()],
        )

    # ── 요약 ────────────────────────────────────────────────────────────
    def sec_summary_front(self) -> list[str]:
        out = ["\n## 판정 요약\n"]
        out.append("| 판정 | 항목 | 내용 |")
        out.append("|---|---|---|")
        for v, item, summary in self.findings:
            out.append(f"| {v} | {item} | {summary} |")
        n_ok = sum(1 for v, _, _ in self.findings if v == "[OK]")
        out.append("")
        out.append(f"**{n_ok}/{len(self.findings)} 항목 [OK]**")
        out.append("")
        out.append("> `[OK]` 가 아닌 항목은 실행계획 문서의 해당 Phase 에서 처리한다. "
                   "이 스크립트는 진단만 하며 아무것도 고치지 않는다.")
        return out


def write_mapping_csv(path: str, rows: list[dict]):
    import csv
    with open(path, "w", encoding="utf-8-sig", newline="") as fh:
        fh.write("# 반출 금지 — 사람 이름이 포함된 파일입니다. 운영서버 내부에서 현업 회람용으로만 사용하세요.\n")
        if not rows:
            return
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def main():
    ap = argparse.ArgumentParser(
        description="디지털 트윈 대시보드 운영 현황 스캔 (읽기 전용, 값 미출력)"
    )
    ap.add_argument("--dsn", help="접속 문자열. 생략 시 DATABASE_URL 또는 backend/.env 사용")
    ap.add_argument("--out", help="출력 디렉터리 (기본: scripts/out)")
    ap.add_argument("--emit-mapping", action="store_true",
                    help="소유자 매핑 후보 CSV 도 생성 (사람 이름 포함 — 반출 금지)")
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
    md_path = os.path.join(outdir, f"dt_scan_{stamp}.md")

    print("=" * 70)
    print(" 디지털 트윈 대시보드 — 운영 현황 스캔 (읽기 전용)")
    print("=" * 70)
    print(f" 접속 : {mask_dsn(dsn)}")
    print(f" 출력 : {md_path}")
    print("-" * 70)

    try:
        conn = psycopg.connect(dsn, autocommit=True)
    except Exception as exc:
        print(f"[FAIL] DB 접속 실패: {exc}")
        sys.exit(1)

    if not enforce_read_only(conn):
        conn.close()
        sys.exit(1)

    scan = Scan(conn.cursor())
    scan.md.append(f"# 디지털 트윈 대시보드 — 운영 현황 스캔")
    scan.md.append("")
    scan.md.append(f"- 생성: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    scan.md.append(f"- 대상: `{mask_dsn(dsn)}`")
    scan.md.append("- 이 문서에는 **데이터 값이 포함되어 있지 않다** "
                   "(건수·비율·크기·키 이름·타입만).")
    scan.md.append("- 근거 문서: `디지털트윈_대시보드_실행계획.md` Phase 0-1")

    try:
        scan.sec_env()
        has_data = scan.sec_singleton()
        if has_data:
            scan.sec_inventory()
            scan.sec_images()
            scan.sec_quality()
            scan.sec_ownership()
            scan.sec_org()
        scan.sec_side_tables()
    except Exception as exc:
        import traceback
        print("[FAIL] 스캔 중 오류가 발생했습니다.")
        traceback.print_exc()
        scan.md.append("\n## ⚠️ 스캔 중단\n")
        scan.md.append(f"```\n{traceback.format_exc()}\n```")
    finally:
        conn.close()

    # 판정 요약을 문서 앞쪽에 삽입
    body = scan.md[:6] + scan.sec_summary_front() + scan.md[6:]
    with open(md_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(body) + "\n")

    # 콘솔 요약
    print()
    for v, item, summary in scan.findings:
        print(f" {v:<12} {item:<24} {summary}")
    print("-" * 70)
    n_ok = sum(1 for v, _, _ in scan.findings if v == "[OK]")
    print(f" 결과: {n_ok}/{len(scan.findings)} 항목 [OK]")
    print(f" 리포트: {md_path}")

    if args.emit_mapping and scan.mapping_rows:
        csv_path = os.path.join(outdir, f"dt_mapping_candidates_{stamp}.csv")
        write_mapping_csv(csv_path, scan.mapping_rows)
        print(f" 매핑후보: {csv_path}   ← 사람 이름 포함. 반출 금지")

    print("=" * 70)
    print(" 이 스크립트는 읽기 전용입니다. 데이터를 변경하지 않았습니다.")
    print("=" * 70)


if __name__ == "__main__":
    main()
