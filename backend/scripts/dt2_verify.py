"""
디지털 트윈 대시보드 — V1 ↔ V2 동일성 검증 (Phase 2-3)

무엇을 증명하나
    "V2 로 옮긴 데이터가 원본과 논리적으로 같다" 를 **왕복(round-trip)** 으로 증명한다.

        원본 JSON  ──이관──▶  dt2_* 행  ──재조립──▶  JSON
             └──────────── 필드 단위 비교 ────────────┘

    이관 스크립트가 만든 결과를 그 스크립트의 반대 방향으로 되돌려 원본과 맞춰본다.
    한쪽 방향만 보면 "옮기다 빠뜨린 것"을 못 잡는다.

왜 이 방식인가 (실행계획 2.6.3)
    운영 데이터는 반출할 수 없어 개발서버로 가져와 비교할 수 없다.
    그래서 **비교를 운영서버 안에서 끝내고 결과 숫자만** 내보낸다.
    출력에는 값이 들어가지 않는다 — 건수·필드명·과제 code 뿐이다.

무엇을 비교하나
    1. 건수      과제·성과·연결·선행·첨부
    2. 필드      매핑된 모든 컬럼을 원본 JSON 값과 1:1 대조
    3. 관계      성과 연결 집합, 선행과제 집합
    4. 참조      이미지 참조, 첨부 연결
    5. 키 커버리지  원본 키가 전부 어딘가(컬럼 or extra_fields)에 있는가

무엇을 비교하지 않나 (의도적)
    linkedProjects   화면에서 계산된 파생 캐시라 이관 대상이 아니다
    isEditing/_idChanged  UI 런타임 상태
    고아 참조        존재하지 않는 성과를 지목한 참조는 이관 시 건너뛴다

사용법
    python scripts\\dt2_verify.py            # 요약
    python scripts\\dt2_verify.py --detail   # 불일치 상세 (과제 code + 필드명, 값은 미출력)

의존성
    표준 라이브러리 + psycopg. 신규 패키지 없음.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime, date

try:
    import psycopg
except ImportError:
    print("[FAIL] psycopg 를 찾을 수 없습니다. venv 를 활성화했는지 확인하세요.")
    sys.exit(1)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from dt_scan import load_dsn, mask_dsn
    from dt2_import import (
        PROJECT_FIELD_MAP, PERFORMANCE_FIELD_MAP,
        PROJECT_RELATION_KEYS, PERFORMANCE_RELATION_KEYS, PERFORMANCE_SKIP_KEYS,
        IMAGE_SLOTS, as_obj, to_int, to_num, to_bool, to_ts,
    )
except ImportError as exc:
    print(f"[FAIL] 같은 폴더의 dt_scan.py / dt2_import.py 를 찾을 수 없습니다: {exc}")
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


# ─────────────────────────────────────────────────────────────────────────────
# 비교 규칙
#   이관 과정에서 타입이 바뀌는 것들이 있다(문자열 "2026" → 정수 2026 등).
#   "논리적으로 같은가"를 봐야 하므로 원본 값도 같은 규칙으로 정규화해 비교한다.
# ─────────────────────────────────────────────────────────────────────────────

EMPTY = (None, '', [], {})


def norm_scalar(v):
    """빈값 계열을 하나로 취급."""
    if isinstance(v, str):
        v = v.strip()
    return None if any(v is e or v == e for e in EMPTY) else v


def cmp_int(src, dst):
    return to_int(src) == (to_int(dst) if dst is not None else None)


def cmp_num(src, dst):
    a, b = to_num(src), (to_num(dst) if dst is not None else None)
    if a is None or b is None:
        return a == b
    return abs(a - b) < 1e-9


def cmp_bool(src, dst):
    return to_bool(src) == bool(dst) if dst is not None else to_bool(src) is False


def cmp_ts(src, dst):
    a = to_ts(src)
    b = dst
    if isinstance(b, (datetime, date)) and not isinstance(b, datetime):
        b = datetime(b.year, b.month, b.day)
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    return abs((a - b).total_seconds()) < 1     # 1초 이내면 같다고 본다


def cmp_json(src, dst):
    """JSON 구조 비교. dst 는 psycopg 가 이미 파이썬 객체로 준다."""
    a = src if src is not None else None
    b = as_obj(dst) if isinstance(dst, (str, bytes, bytearray)) else dst
    if a in EMPTY and b in EMPTY:
        return True
    return json.dumps(a, ensure_ascii=False, sort_keys=True) == \
           json.dumps(b, ensure_ascii=False, sort_keys=True)


def cmp_text(src, dst):
    a, b = norm_scalar(src), norm_scalar(dst)
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    return str(a) == str(b)


from dt2_import import INT_COLS, BOOL_COLS, TS_COLS, NUM_COLS   # noqa: E402


def compare_field(col, src, dst):
    if col in INT_COLS:
        return cmp_int(src, dst)
    if col in NUM_COLS:
        return cmp_num(src, dst)
    if col in BOOL_COLS:
        return cmp_bool(src, dst)
    if col in TS_COLS:
        return cmp_ts(src, dst)
    if col.endswith('_json'):
        return cmp_json(src, dst)
    # 문자열 컬럼인데 원본이 구조인 경우 이관 시 직렬화했으므로 같은 방식으로 비교
    if isinstance(src, (dict, list)):
        return cmp_text(json.dumps(src, ensure_ascii=False), dst)
    return cmp_text(src, dst)


# ─────────────────────────────────────────────────────────────────────────────

def load_v1(cur):
    cur.execute("SELECT version, projects, performances FROM dashboard_data ORDER BY id LIMIT 1")
    row = cur.fetchone()
    if row is None:
        return None, [], []
    v, p, f = row
    p = [x for x in (as_obj(p) or []) if isinstance(x, dict)]
    f = [x for x in (as_obj(f) or []) if isinstance(x, dict)]
    return v, p, f


def fetch_rows(cur, table, cols):
    cur.execute(f'SELECT {", ".join(chr(34)+c+chr(34) for c in cols)} FROM {table}')
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def verify_entity(label, src_list, rows_by_uuid, field_map, relation_keys, skip_keys,
                  log: Log, detail: bool, code_key='id'):
    """과제/성과 공통 필드 비교."""
    log(f"\n── {label} 필드 대조 ──")

    missing, extra_rows = [], []
    mismatches = Counter()
    mismatch_samples = []
    uncovered_keys = Counter()
    n_cmp = 0

    src_uuids = set()
    for src in src_list:
        uuid = src.get('uuid')
        if not uuid:
            continue
        src_uuids.add(uuid)
        row = rows_by_uuid.get(uuid)
        if row is None:
            missing.append(src.get(code_key) or uuid)
            continue

        extra = as_obj(row.get('extra_fields')) or {}
        for key, value in src.items():
            if key in relation_keys or key in skip_keys:
                continue
            col = field_map.get(key)
            if col is None:
                # 매핑에 없는 키는 extra_fields 에 보존돼 있어야 한다
                if key not in extra:
                    uncovered_keys[key] += 1
                continue
            n_cmp += 1
            if not compare_field(col, value, row.get(col)):
                mismatches[f'{key} → {col}'] += 1
                if len(mismatch_samples) < 15:
                    mismatch_samples.append((src.get(code_key) or uuid, key, col))

    for uuid in rows_by_uuid:
        if uuid not in src_uuids:
            extra_rows.append(uuid)

    log(f"  대조한 필드 값        : {n_cmp:,}개")
    log(f"  원본에 있는데 V2 없음 : {len(missing):,}건")
    log(f"  V2 에만 있는 행       : {len(extra_rows):,}건")
    log(f"  **불일치 필드**       : **{sum(mismatches.values()):,}개**")
    log(f"  extra_fields 로도 보존 안 된 키 : {sum(uncovered_keys.values()):,}개")

    if mismatches:
        log("  불일치 내역:")
        for k, v in mismatches.most_common(20):
            log(f"    {k:<40} {v:,}건")
        if detail:
            log("  표본 (값은 출력하지 않음):")
            for code, key, col in mismatch_samples:
                log(f"    {code:<16} {key} → {col}")
    if uncovered_keys:
        log("  보존 안 된 키: " + ", ".join(f"{k}({v})" for k, v in uncovered_keys.most_common(10)))

    ok = not missing and not extra_rows and not mismatches and not uncovered_keys
    return ok, sum(mismatches.values()), len(missing), len(extra_rows)


def verify_links(cur, projects, performances, log: Log, detail: bool):
    """과제→성과 연결 집합 비교."""
    log("\n── 과제-성과 연결 대조 ──")

    perf_uuids = {f['uuid'] for f in performances if f.get('uuid')}
    perf_by_code, perf_by_legacy = {}, {}
    for f in performances:
        if f.get('id'):
            perf_by_code.setdefault(str(f['id']), f.get('uuid'))
        if f.get('성과항목UUID'):
            perf_by_legacy.setdefault(str(f['성과항목UUID']), f.get('uuid'))

    def resolve(elem):
        """dt2_import.import_links 와 **같은 순서**로 성과를 찾는다."""
        for cand in ('성과항목UUID', '성과UUID', 'uuid'):
            v = elem.get(cand)
            if v and str(v) in perf_uuids:
                return str(v)
            if v and str(v) in perf_by_legacy:
                return perf_by_legacy[str(v)]
        for cand in ('성과항목ID', 'id'):
            v = elem.get(cand)
            if v and str(v) in perf_by_code:
                return perf_by_code[str(v)]
        return None

    # 이관과 동일하게 **첫 건만** 채택한다. 같은 (과제, 성과) 를 두 번 가리키는
    # 원소가 있을 때 이관은 첫 건을 남기므로, 검증도 첫 건과 비교해야 한다.
    expected = set()
    expected_contrib = {}
    orphan = 0
    dup_refs = 0
    dup_conflict = 0
    for p in projects:
        puid = p.get('uuid')
        arr = p.get('성과목록')
        if not puid or not isinstance(arr, list):
            continue
        for elem in arr:
            if not isinstance(elem, dict):
                orphan += 1
                continue
            target = resolve(elem)
            if target is None:
                orphan += 1
                continue

            src = elem.get('과제기여도')
            src = None if src in (None, '') else str(src)

            if (puid, target) in expected:
                dup_refs += 1
                if expected_contrib.get((puid, target)) != src:
                    dup_conflict += 1     # 중복인데 기여도까지 다르다 — 기록만 한다
                continue
            expected.add((puid, target))
            expected_contrib[(puid, target)] = src

    cur.execute("SELECT project_uuid, performance_uuid FROM dt2_project_performance")
    actual = {(a, b) for a, b in cur.fetchall()}

    only_src = expected - actual
    only_v2 = actual - expected

    log(f"  원본에서 해석된 유효 연결 : {len(expected):,}건")
    log(f"  V2 연결                   : {len(actual):,}건")
    log(f"  고아 참조(이관 제외 대상) : {orphan:,}건")
    log(f"  중복 참조(첫 건만 채택)   : {dup_refs:,}건")
    log(f"  **원본에만 있음**         : **{len(only_src):,}건**")
    log(f"  **V2 에만 있음**          : **{len(only_v2):,}건**")

    # 관계 속성(과제기여도) 대조.
    # 위에서 만든 expected_contrib 를 쓴다 — 이관과 같은 해석·같은 중복 규칙이라야
    # 대조가 성립한다. (예전에는 raw uuid 3개만 훑어서, 성과항목ID/id 로 해석된
    # 연결은 비교 자체가 건너뛰어졌다)
    cur.execute("SELECT project_uuid, performance_uuid, contribution FROM dt2_project_performance")
    contrib = {(a, b): c for a, b, c in cur.fetchall()}
    contrib_mismatch = 0
    contrib_checked = 0
    for key, src in expected_contrib.items():
        if key not in contrib:
            continue                      # 연결 자체가 없는 건 위에서 이미 잡힌다
        contrib_checked += 1
        if src != contrib[key]:
            contrib_mismatch += 1
            if detail:
                log(f"    [기여도] project={key[0][:8]} performance={key[1][:8]}")
    log(f"  과제기여도 대조           : {contrib_checked:,}건 중 불일치 {contrib_mismatch:,}건")

    if dup_conflict:
        log(f"  [확인] 같은 성과를 두 번 가리키면서 기여도가 다른 원소 {dup_conflict:,}건.")
        log(f"         이관은 첫 건을 채택했다. 유실이 아니라 원본의 중복 입력이다.")

    return len(only_src) == 0 and len(only_v2) == 0 and contrib_mismatch == 0


def verify_refs(cur, projects, log: Log):
    """이미지 참조 · 선행과제 · 첨부 대조."""
    log("\n── 참조 대조 ──")

    # 이미지
    exp_img = {}
    for p in projects:
        puid = p.get('uuid')
        refs = {s: p[s] for s in IMAGE_SLOTS if isinstance(p.get(s), list) and p[s]}
        if puid and refs:
            exp_img[puid] = refs
    cur.execute("SELECT uuid, image_refs_json FROM dt2_projects WHERE image_refs_json <> '{}'::jsonb")
    act_img = {u: (as_obj(v) or {}) for u, v in cur.fetchall()}
    img_mismatch = 0
    for uuid, refs in exp_img.items():
        if json.dumps(refs, ensure_ascii=False, sort_keys=True) != \
           json.dumps(act_img.get(uuid, {}), ensure_ascii=False, sort_keys=True):
            img_mismatch += 1
    log(f"  이미지 보유 과제 : 원본 {len(exp_img):,} / V2 {len(act_img):,} / 불일치 {img_mismatch:,}")

    # 선행과제
    known = {p['uuid'] for p in projects if p.get('uuid')}
    exp_dep = set()
    for p in projects:
        puid = p.get('uuid')
        for elem in (p.get('선행과제목록') or []):
            dep = elem.get('uuid') if isinstance(elem, dict) else (elem if isinstance(elem, str) else None)
            if puid and dep and dep in known:
                exp_dep.add((puid, dep))
    cur.execute("SELECT project_uuid, depends_on_uuid FROM dt2_project_dependencies")
    act_dep = {(a, b) for a, b in cur.fetchall()}
    log(f"  선행과제 : 원본 {len(exp_dep):,} / V2 {len(act_dep):,} / "
        f"차이 {len(exp_dep ^ act_dep):,}")

    # 첨부
    cur.execute("SELECT count(*) FROM project_attachments")
    v1_att = cur.fetchone()[0]
    cur.execute("SELECT count(*), count(project_uuid) FROM dt2_project_attachments")
    v2_att, v2_linked = cur.fetchone()
    log(f"  첨부 : V1 {v1_att:,} / V2 {v2_att:,} (연결됨 {v2_linked:,} / 미연결 {v2_att - v2_linked:,})")

    return img_mismatch == 0 and exp_dep == act_dep and v1_att == v2_att


def verify_history(cur, performances, log: Log):
    """
    성과 이력 점검.

    이력은 '원본과 같은가' 로 검증할 수 없다. 과거 값은 원본에 없기 때문이다.
    대신 이력이 성립하기 위한 조건을 본다.
      1. 삭제되지 않은 성과에 최소 1행씩 있는가 (누락 없이 추적을 시작했는가)
      2. 각 성과의 **최신** 이력이 현재 본체 값과 일치하는가 (추적이 끊기지 않았는가)
      3. 같은 성과에 값이 똑같은 행이 연달아 있지 않은가 (변경감지가 헛돌지 않는가)
    """
    log("\n── 성과 이력 ──")

    cur.execute("SELECT count(*), count(DISTINCT performance_uuid), "
                "       min(observed_at), max(observed_at) FROM dt2_performance_history")
    total, tracked, first, last = cur.fetchone()
    if not total:
        log("  [WARN] 이력이 비어 있습니다. dt2_import.py 를 아직 돌리지 않았습니다.")
        return False
    log(f"  행 {total:,} / 추적 중인 성과 {tracked:,} / 기간 {first} ~ {last}")

    cur.execute("SELECT change_kind, count(*) FROM dt2_performance_history GROUP BY 1 ORDER BY 1")
    log("  종류: " + ", ".join(f"{k} {c:,}" for k, c in cur.fetchall()))

    # 1. 누락 — 살아있는 성과인데 이력이 하나도 없는 경우
    cur.execute(
        "SELECT count(*) FROM dt2_performances p "
        " WHERE p.is_deleted = false "
        "   AND NOT EXISTS (SELECT 1 FROM dt2_performance_history h "
        "                    WHERE h.performance_uuid = p.uuid)"
    )
    missing = cur.fetchone()[0]
    log(f"  이력 없는 활성 성과 : {missing:,}")

    # 2. 최신 이력 ↔ 본체 값 일치
    cur.execute(
        "WITH latest AS ("
        "  SELECT DISTINCT ON (performance_uuid) performance_uuid, "
        "         current_level, target_level, actual_level, unit "
        "    FROM dt2_performance_history "
        "   ORDER BY performance_uuid, observed_at DESC, id DESC"
        ") "
        "SELECT count(*) FROM latest l JOIN dt2_performances p ON p.uuid = l.performance_uuid "
        " WHERE p.current_level IS DISTINCT FROM l.current_level "
        "    OR p.target_level  IS DISTINCT FROM l.target_level "
        "    OR p.actual_level  IS DISTINCT FROM l.actual_level "
        "    OR p.unit          IS DISTINCT FROM l.unit"
    )
    stale = cur.fetchone()[0]
    log(f"  본체와 어긋난 최신 이력 : {stale:,}")

    # 3. 연속 중복 — 값이 안 바뀌었는데 행이 또 생긴 경우
    cur.execute(
        "SELECT count(*) FROM ("
        "  SELECT value_hash, lag(value_hash) OVER "
        "         (PARTITION BY performance_uuid ORDER BY observed_at, id) AS prev "
        "    FROM dt2_performance_history"
        ") t WHERE prev IS NOT NULL AND prev = value_hash"
    )
    dup = cur.fetchone()[0]
    log(f"  연속 중복 행 : {dup:,}")

    ok = (missing == 0 and stale == 0 and dup == 0)
    if not ok:
        if missing:
            log("  [WARN] 이력 없는 성과가 있습니다 — 이관 이후 새로 생긴 성과라면 다음 이관에서 채워집니다.")
        if stale:
            log("  [FAIL] 최신 이력이 본체와 다릅니다 — 이력 기록이 누락된 이관이 있습니다.")
        if dup:
            log("  [FAIL] 값이 같은데 행이 중복됐습니다 — 해시 정규화를 확인하세요.")
    return ok


def verify_project_history(cur, log: Log):
    """
    과제 진척 이력 점검. 성과 이력과 같은 세 가지를 본다.
    (누락 없음 / 최신 이력이 본체와 일치 / 연속 중복 없음)
    """
    log("\n── 과제 진척 이력 ──")

    cur.execute("SELECT count(*), count(DISTINCT project_uuid), "
                "       min(observed_at), max(observed_at) FROM dt2_project_history")
    total, tracked, first, last = cur.fetchone()
    if not total:
        log("  [WARN] 이력이 비어 있습니다. dt2_import.py 를 아직 돌리지 않았습니다.")
        return False
    log(f"  행 {total:,} / 추적 중인 과제 {tracked:,} / 기간 {first} ~ {last}")

    cur.execute("SELECT change_kind, count(*) FROM dt2_project_history GROUP BY 1 ORDER BY 1")
    log("  종류: " + ", ".join(f"{k} {c:,}" for k, c in cur.fetchall()))

    cur.execute(
        "SELECT count(*) FROM dt2_projects p "
        " WHERE p.is_deleted = false AND p.is_permanently_deleted = false "
        "   AND NOT EXISTS (SELECT 1 FROM dt2_project_history h "
        "                    WHERE h.project_uuid = p.uuid)"
    )
    missing = cur.fetchone()[0]
    log(f"  이력 없는 활성 과제 : {missing:,}")

    # 최신 이력 ↔ 본체 (본체에 있는 컬럼만 대조. 액션/이슈 집계는 본체에 없다)
    cur.execute(
        "WITH latest AS ("
        "  SELECT DISTINCT ON (project_uuid) project_uuid, status, progress, "
        "         start_month, end_month "
        "    FROM dt2_project_history "
        "   ORDER BY project_uuid, observed_at DESC, id DESC"
        ") "
        "SELECT count(*) FROM latest l JOIN dt2_projects p ON p.uuid = l.project_uuid "
        " WHERE p.status      IS DISTINCT FROM l.status "
        "    OR p.progress    IS DISTINCT FROM l.progress "
        "    OR p.start_month IS DISTINCT FROM l.start_month "
        "    OR p.end_month   IS DISTINCT FROM l.end_month"
    )
    stale = cur.fetchone()[0]
    log(f"  본체와 어긋난 최신 이력 : {stale:,}")

    cur.execute(
        "SELECT count(*) FROM ("
        "  SELECT value_hash, lag(value_hash) OVER "
        "         (PARTITION BY project_uuid ORDER BY observed_at, id) AS prev "
        "    FROM dt2_project_history"
        ") t WHERE prev IS NOT NULL AND prev = value_hash"
    )
    dup = cur.fetchone()[0]
    log(f"  연속 중복 행 : {dup:,}")

    # 참고 지표 — 진척률의 재료가 실제로 얼마나 채워져 있는지
    cur.execute(
        "WITH latest AS ("
        "  SELECT DISTINCT ON (project_uuid) * FROM dt2_project_history "
        "   ORDER BY project_uuid, observed_at DESC, id DESC"
        ") "
        "SELECT count(*) FILTER (WHERE progress IS NOT NULL), "
        "       count(*) FILTER (WHERE action_total > 0), count(*) FROM latest"
    )
    with_prog, with_items, tot = cur.fetchone()
    log(f"  [참고] 진행률 보유 {with_prog:,}/{tot:,} · 액션아이템 보유 {with_items:,}/{tot:,}")
    if tot and with_prog * 5 < tot:
        log("         저장된 진행률은 대부분 비어 있습니다. 추이는 진행상태와 "
            "액션아이템 완료비율로 보는 편이 맞습니다.")

    ok = (missing == 0 and stale == 0 and dup == 0)
    if not ok:
        if stale:
            log("  [FAIL] 최신 이력이 본체와 다릅니다 — 이력 기록이 누락된 이관이 있습니다.")
        if dup:
            log("  [FAIL] 값이 같은데 행이 중복됐습니다 — 해시 정규화를 확인하세요.")
    return ok


# ─────────────────────────────────────────────────────────────────────────────

def v2_write_enabled() -> bool:
    """
    V2 쓰기가 켜져 있는가.

    켜져 있으면 **이 대조는 더 이상 판정 도구가 아니다.** 컷오버 상태에서는 V1 이
    멈추고 dt2 만 앞서가므로 불일치가 정상이다. 그걸 모르고 보면 이관이 깨진 줄 안다
    (2026-07-30 실제로 그렇게 보였다 — V2 로 만든 과제 1건 때문에 건수가 어긋났다).

    이 스크립트는 앱을 띄우지 않으므로 load_dsn 과 같은 방식으로 .env 를 직접 읽는다.
    """
    raw = os.environ.get("DT2_WRITE_ENABLED")
    if raw is None:
        here = os.path.dirname(os.path.abspath(__file__))
        env_path = os.path.join(os.path.dirname(here), ".env")
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8-sig", errors="replace") as fh:
                    for line in fh:
                        line = line.strip()
                        if line.startswith("DT2_WRITE_ENABLED="):
                            raw = line.split("=", 1)[1].strip()
                            break
            except OSError:
                pass
    return (raw or "").strip().lower() in ("1", "true", "yes", "on")


def main():
    ap = argparse.ArgumentParser(description="V1 ↔ V2 동일성 검증 (읽기 전용)")
    ap.add_argument("--dsn")
    ap.add_argument("--detail", action="store_true", help="불일치 표본 출력 (값은 미출력)")
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
    log = Log(os.path.join(outdir, f"dt2_verify_{stamp}.log"))

    log("=" * 72)
    log(" 디지털 트윈 대시보드 — V1 ↔ V2 동일성 검증 (Phase 2-3)")
    log("=" * 72)
    log(f" 접속 : {mask_dsn(dsn)}")
    log(f" 로그 : {log.path}")
    log("-" * 72)
    log(" 읽기 전용입니다. 값은 출력하지 않습니다 (건수·필드명·과제 code 만).")

    try:
        conn = psycopg.connect(dsn, autocommit=True)
        conn.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")
    except Exception as exc:
        log(f"[FAIL] DB 접속 실패: {exc}")
        log.close()
        sys.exit(1)

    results = []
    try:
        cur = conn.cursor()
        v1_version, projects, performances = load_v1(cur)
        if v1_version is None:
            log("[FAIL] dashboard_data 에 행이 없습니다.")
            raise SystemExit(1)

        log(f"\n── 건수 대조 ──")
        cur.execute("SELECT count(*) FROM dt2_projects")
        n_p = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM dt2_performances")
        n_f = cur.fetchone()[0]
        log(f"  과제 : V1 {len(projects):,} / V2 {n_p:,}  {'[OK]' if len(projects) == n_p else '[FAIL]'}")
        log(f"  성과 : V1 {len(performances):,} / V2 {n_f:,}  {'[OK]' if len(performances) == n_f else '[FAIL]'}")
        results.append(("건수", len(projects) == n_p and len(performances) == n_f))

        proj_cols = ['uuid', 'extra_fields'] + sorted(set(PROJECT_FIELD_MAP.values()))
        perf_cols = ['uuid', 'extra_fields'] + sorted(set(PERFORMANCE_FIELD_MAP.values()))
        proj_rows = {r['uuid']: r for r in fetch_rows(cur, 'dt2_projects', list(dict.fromkeys(proj_cols)))}
        perf_rows = {r['uuid']: r for r in fetch_rows(cur, 'dt2_performances', list(dict.fromkeys(perf_cols)))}

        ok_p, *_ = verify_entity("과제", projects, proj_rows, PROJECT_FIELD_MAP,
                                 PROJECT_RELATION_KEYS, set(), log, args.detail, code_key='id')
        results.append(("과제 필드", ok_p))

        ok_f, *_ = verify_entity("성과", performances, perf_rows, PERFORMANCE_FIELD_MAP,
                                 PERFORMANCE_RELATION_KEYS, PERFORMANCE_SKIP_KEYS,
                                 log, args.detail, code_key='id')
        results.append(("성과 필드", ok_f))

        results.append(("과제-성과 연결", verify_links(cur, projects, performances, log, args.detail)))
        results.append(("참조(이미지·선행·첨부)", verify_refs(cur, projects, log)))
        results.append(("성과 이력", verify_history(cur, performances, log)))
        results.append(("과제 진척 이력", verify_project_history(cur, log)))

    except SystemExit:
        pass
    except Exception:
        import traceback
        log("[FAIL] 검증 중 오류가 발생했습니다.")
        log(traceback.format_exc())
        results.append(("실행", False))
    finally:
        conn.close()

    log("\n" + "=" * 72)
    log(" 판정 요약")
    log("=" * 72)
    for name, ok in results:
        log(f"  {'[OK]  ' if ok else '[FAIL]'} {name}")
    all_ok = all(ok for _, ok in results) and results
    log("")
    if all_ok:
        log(" 결과: [OK] V2 가 원본과 논리적으로 동일합니다. 다음 단계로 진행할 수 있습니다.")
    elif v2_write_enabled():
        # 판정을 뒤집지는 않는다 — 다만 원인을 오해하지 않게 먼저 알린다.
        log(" 결과: [FAIL] 불일치가 있습니다 — 다만 **DT2_WRITE_ENABLED 가 켜져 있습니다.**")
        log("")
        log("        이 상태에서는 V1 이 멈추고 dt2 만 앞서가므로 불일치가 **정상**입니다.")
        log("        (V2 로 만들거나 고친 것은 V1 에 반영되지 않습니다 — v2_sync 도 멈춰 있습니다)")
        log("        이 대조는 컷오버 **전** 도구입니다. 이관 자체를 다시 확인하려면")
        log("        .env 의 DT2_WRITE_ENABLED 를 끄고 재기동해 동기화를 되살린 뒤 실행하세요.")
    else:
        log(" 결과: [FAIL] 불일치가 있습니다. **이 상태로 다음 단계로 넘어가지 마세요.**")
        log("        --detail 로 다시 실행하면 어떤 과제의 어떤 필드인지 볼 수 있습니다.")
    log(f" 로그: {log.path}")
    log("=" * 72)
    log.close()
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
