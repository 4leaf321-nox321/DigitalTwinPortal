"""
디지털 트윈 대시보드 — V1 → V2 이관(복사) 스크립트 (Phase 2-2)

무엇을 하나
    dashboard_data 싱글톤 행의 JSON 배열을 읽어 dt2_* 테이블에 **행으로 복사**한다.

설계 원칙 (실행계획 2장)
    - **복사이지 이동이 아니다.** 원본 dashboard_data 는 읽기만 하고 절대 쓰지 않는다.
      컷오버 전까지 V1 이 정본이고, V2 가 꼬이면 비우고 다시 복사하면 된다.
    - **재실행 안전(idempotent).** uuid 기준 upsert 라 몇 번을 돌려도 같은 결과가 된다.
    - **유실 불가.** 매핑에 없는 키는 전부 extra_fields 로 흘려보낸다.
      인벤토리가 틀려도 데이터가 사라지지 않는다.

이관 규칙
    키          uuid 로 통일 (운영 스캔: 과제·성과 전부 존재·고유)
    소유자      과제참여인력목록[].knoxId → users.email 로컬파트
                → 과제PL 이름 → 작성자 이름 순. 못 찾으면 NULL (나중에 지정)
    사업부      division 텍스트 → is_active=true 인 divisions 행의 id
    성과 연결   성과목록[] → dt2_project_performance
                참조 해석: 성과항목UUID → 성과UUID → uuid → 성과항목ID → id
                고아 참조는 건너뛰고 리포트
    역방향      linkedProjects 는 화면 계산 캐시가 저장된 것이라 **이관하지 않는다**
    이미지      Phase 1-2 에서 분리된 imageId 참조만 image_refs_json 에 보존
    삭제분      is_deleted / is_permanently_deleted 로 **함께** 이관 (이력 보존)
    첨부        project_attachments → dt2_project_attachments
                과제를 못 찾으면 project_uuid = NULL ('미연결'로 보존)
    보고확인    module_settings.reportConfirmations (과제 uuid 키 맵) → report_confirmation
    런타임키    성과의 isEditing / _idChanged 는 컬럼을 만들지 않지만 **버리지 않는다**.
                extra_fields 로 보존해 V2 읽기 API 가 원본을 복원할 수 있게 한다.
    변환손실    타입 변환에서 값이 비면(숫자 컬럼에 비숫자 문자열 등) 원본을 extra_fields 에 남긴다.
    성과이력    수준값(현재/목표/실적/월별/단위)이 직전 기록과 **다를 때만**
                dt2_performance_history 에 1행 추가. 같으면 아무것도 안 쓴다.
                → 이관을 주기적으로 돌릴수록 추이가 촘촘해진다.

사용법
    python scripts\\dt2_import.py                 # 계획만 확인 (아무것도 안 씀)
    python scripts\\dt2_import.py --commit        # 실제 이관
    python scripts\\dt2_import.py --commit --truncate   # V2 를 비우고 처음부터 (이력은 보존)

주의
    --truncate 는 성과 이력을 지우지 않는다. 본체는 원본에서 다시 만들 수 있지만
    이력은 재생성이 불가능하다. 정말 지우려면 --truncate-history 를 명시해야 한다.

    ★ --truncate 는 **V1 에 원본이 없는 데이터를 지운다.** (2026-08-01 실제 사고)
      TRUNCATE ... CASCADE 는 dt2_projects 를 참조하는 테이블을 목록에 없어도
      자동으로 같이 비운다. dt2_project_kpi(과제↔DX KPI 연결)가 그렇게 날아갔다 —
      이 표는 V1 에서 오지 않으므로 재이관해도 **되살아나지 않는다.**
      아래 _cascade_targets() 가 실행 전에 실제 대상을 조회해 경고한다.

의존성
    표준 라이브러리 + psycopg (이미 설치됨). 신규 패키지 없음.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone

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

# 이력 변경감지 로직은 쓰기 API 와 **같은 파일**을 써야 한다.
# 판단이 갈리면 바뀌지도 않은 값에 매번 새 이력 행이 생긴다.
# 패키지 import(app.modules...)는 Flask 블루프린트까지 끌어오므로,
# 순수 파일 하나만 경로로 직접 읽는다.
def _load_history_hash():
    import importlib.util
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(os.path.dirname(here), 'app', 'modules',
                        'digital_twin_dashboard', 'history_hash.py')
    if not os.path.exists(path):
        print(f"[FAIL] history_hash.py 를 찾을 수 없습니다: {path}")
        print("       backend\\app\\modules\\digital_twin_dashboard\\history_hash.py 를 배포했는지 확인하세요.")
        sys.exit(1)
    spec = importlib.util.spec_from_file_location('dt_history_hash', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


HH = _load_history_hash()


# ─────────────────────────────────────────────────────────────────────────────
# 매핑 — app/modules/digital_twin_dashboard/field_maps.py 가 단일 출처다.
#
# 예전에는 이 파일이 사본을 들고 있었다. 백엔드 패키지를 import 하면 Flask 앱이
# 딸려와 운영서버 단독 실행이 깨지기 때문이었다. 하지만 사본은 갈렸을 때
# **조용히 필드가 사라진다**(실제로 세 번 물렸다).
#
# 그래서 매핑만 의존성 없는 파일로 떼어내고, history_hash.py 와 같은 방식으로
# 그 파일만 경로로 직접 읽는다. 앱은 여전히 딸려오지 않는다.
# ─────────────────────────────────────────────────────────────────────────────

def _load_field_maps():
    import importlib.util
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(os.path.dirname(here), 'app', 'modules',
                        'digital_twin_dashboard', 'field_maps.py')
    if not os.path.exists(path):
        print(f"[FAIL] field_maps.py 를 찾을 수 없습니다: {path}")
        print("       backend\\app\\modules\\digital_twin_dashboard\\field_maps.py 를 배포했는지 확인하세요.")
        sys.exit(1)
    spec = importlib.util.spec_from_file_location('dt_field_maps', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


FM = _load_field_maps()

# 아래 이름들은 dt2_verify.py 가 이 모듈에서 import 해 쓴다. 바꾸지 말 것.
PROJECT_FIELD_MAP = FM.PROJECT_FIELD_MAP
IMAGE_SLOTS = FM.IMAGE_SLOTS
PROJECT_RELATION_KEYS = FM.PROJECT_RELATION_KEYS
PERFORMANCE_FIELD_MAP = FM.PERFORMANCE_FIELD_MAP
PERFORMANCE_RELATION_KEYS = FM.PERFORMANCE_RELATION_KEYS
PERFORMANCE_SKIP_KEYS = FM.PERFORMANCE_SKIP_KEYS

# 타입 변환이 필요한 컬럼
INT_COLS = {'year', 'start_month', 'end_month', 'progress'}
BOOL_COLS = {'is_poc', 'is_key', 'is_division_public', 'detail_completed',
             'is_deleted', 'is_permanently_deleted', 'is_monthly',
             'is_achievement_type', 'has_calc_logic', 'has_dt_contribution',
             'is_active', 'is_from_sample'}
TS_COLS = {'created_at', 'updated_at', 'canceled_at',
           'deleted_at', 'permanently_deleted_at'}
NUM_COLS = {'current_level', 'target_level'}
JSON_COLS_SUFFIX = '_json'


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
# 값 변환
# ─────────────────────────────────────────────────────────────────────────────

def to_int(v):
    if v is None or v == '':
        return None
    try:
        return int(float(str(v).strip()))
    except (ValueError, TypeError):
        return None


def to_num(v):
    if v is None or v == '':
        return None
    try:
        return float(str(v).strip())
    except (ValueError, TypeError):
        return None


def to_bool(v):
    if isinstance(v, bool):
        return v
    if v is None or v == '':
        return False
    return str(v).strip().lower() in ('true', '1', 'y', 'yes')


def to_ts(v):
    """ISO 문자열 → naive UTC datetime. 실패하면 None."""
    if not v or not isinstance(v, str):
        return None
    s = v.strip()
    if not s:
        return None
    try:
        if s.endswith('Z'):
            s = s[:-1] + '+00:00'
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except ValueError:
        return None


def convert(col: str, value):
    if col in INT_COLS:
        return to_int(value)
    if col in NUM_COLS:
        return to_num(value)
    if col in BOOL_COLS:
        return to_bool(value)
    if col in TS_COLS:
        return to_ts(value)
    if col.endswith(JSON_COLS_SUFFIX):
        return json.dumps(value if value is not None else None, ensure_ascii=False)
    if isinstance(value, (dict, list)):
        # 문자열 컬럼인데 구조가 들어온 경우 — 원형을 잃지 않게 직렬화
        return json.dumps(value, ensure_ascii=False)
    return value


def as_obj(value):
    if isinstance(value, (str, bytes, bytearray)):
        try:
            return json.loads(value)
        except (ValueError, TypeError):
            return None
    return value


# ─────────────────────────────────────────────────────────────────────────────
# 참조 데이터 로드
# ─────────────────────────────────────────────────────────────────────────────

def load_refs(cur, log: Log):
    """소유자 매핑과 사업부 매핑에 쓸 기준 데이터."""
    cur.execute("SELECT id, email, name FROM users")
    users = cur.fetchall()
    by_local, by_name = {}, {}
    for uid, email, name in users:
        if email and '@' in email:
            by_local.setdefault(email.split('@')[0].strip().lower(), uid)
        if name:
            by_name.setdefault(name.strip(), uid)

    # 사업부는 활성 행만 (비활성은 설정 저장 때마다 쌓인 옛 버전)
    cur.execute("SELECT id, name FROM divisions WHERE is_active = true")
    div_by_name = {r[1].strip(): r[0] for r in cur.fetchall() if r[1]}

    # 과제 uuid 를 키로 하는 보고 확인 상태
    cur.execute(
        "SELECT settings_data FROM module_settings "
        "WHERE module_name='digital_twin_dashboard' AND settings_key='reportConfirmations'"
    )
    row = cur.fetchone()
    report_conf = as_obj(row[0]) if row else {}
    if not isinstance(report_conf, dict):
        report_conf = {}

    log(f"  사용자 {len(users)}명 (email {len(by_local)} / 이름 {len(by_name)})")
    log(f"  활성 사업부 {len(div_by_name)}개: {', '.join(sorted(div_by_name))}")
    log(f"  보고확인 항목 {len(report_conf)}건")
    return by_local, by_name, div_by_name, report_conf


def resolve_owner(project, by_local, by_name, stats):
    """소유자 해석 — knoxId → 과제PL → 작성자 순."""
    for elem in (project.get('과제참여인력목록') or []):
        if isinstance(elem, dict) and elem.get('knoxId'):
            uid = by_local.get(str(elem['knoxId']).strip().lower())
            if uid:
                stats['knoxId'] += 1
                return uid
    if project.get('과제PL'):
        uid = by_name.get(str(project['과제PL']).strip())
        if uid:
            stats['과제PL'] += 1
            return uid
    if project.get('작성자'):
        uid = by_name.get(str(project['작성자']).strip())
        if uid:
            stats['작성자'] += 1
            return uid
    stats['미해결'] += 1
    return None


# ─────────────────────────────────────────────────────────────────────────────
# 이관
# ─────────────────────────────────────────────────────────────────────────────

def import_projects(cur, projects, refs, log: Log, dry: bool, hist_state=None, source='dt2_import'):
    by_local, by_name, div_by_name, report_conf = refs
    owner_stats = Counter()
    unknown_keys = Counter()
    lossy_keys = Counter()
    unmatched_div = Counter()
    n = 0
    hist_seed = hist_changed = 0
    changed_field_stats = Counter()

    for p in projects:
        uuid = p.get('uuid')
        if not uuid:
            log(f"  [WARN] uuid 없는 과제 건너뜀: id={p.get('id')}")
            continue

        cols, vals = {}, {}
        extra = {}

        for key, value in p.items():
            if key in PROJECT_RELATION_KEYS:
                continue                      # 별도 테이블 / image_refs_json 으로 처리
            col = PROJECT_FIELD_MAP.get(key)
            if col:
                converted = convert(col, value)
                cols[col] = converted
                # 타입 변환에서 값이 사라지면 원본을 남긴다 (성과 쪽과 같은 이유)
                if converted is None and not _is_empty(value):
                    extra[key] = value
                    lossy_keys[key] += 1
            else:
                extra[key] = value            # ★ 매핑에 없는 키는 통째로 보존
                unknown_keys[key] += 1

        # 이미지 참조 (Phase 1-2 결과) — dataUrl 은 이미 제거됐고 imageId 만 남아 있다
        image_refs = {}
        for slot in IMAGE_SLOTS:
            arr = p.get(slot)
            if isinstance(arr, list) and arr:
                image_refs[slot] = arr
        cols['image_refs_json'] = json.dumps(image_refs, ensure_ascii=False)

        # 사업부 → division_id
        div_name = (p.get('사업부') or '').strip()
        div_id = div_by_name.get(div_name)
        if div_name and div_id is None:
            unmatched_div[div_name] += 1
        cols['division_id'] = div_id

        cols['owner_user_id'] = resolve_owner(p, by_local, by_name, owner_stats)
        cols['report_confirmation'] = (
            json.dumps(report_conf[uuid], ensure_ascii=False) if uuid in report_conf else None
        )
        cols.setdefault('title', '')
        if cols.get('title') is None:
            cols['title'] = ''

        # BaseModel 의 created_at/updated_at 은 NOT NULL 이라 없으면 채워야 한다.
        # **하지만 지어낸 값이라는 사실을 반드시 남긴다.**
        #   화면은 createdAt 으로 '기준일에 이 과제가 존재했나' 를 판정한다
        #   (DashboardView.jsx:4775). 없던 값을 이관 시각으로 채워서 내보내면
        #   그 과제들이 '방금 생긴 것' 이 되어 1주 전·1개월 전 비교에서 통째로 빠진다.
        #   재조립할 때 이 목록에 있는 키는 내보내지 않는다.
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        synth = []
        if not cols.get('created_at'):
            cols['created_at'] = now
            synth.append('createdAt')
        if not cols.get('updated_at'):
            cols['updated_at'] = now
            synth.append('updatedAt')
        if synth:
            extra['_synthesizedTs'] = synth

        cols['extra_fields'] = json.dumps(extra, ensure_ascii=False)

        n += 1

        if hist_state is not None:
            res = record_project_history(
                cur, uuid, cols, derive_project_counts(p),
                hist_state.get(uuid), now, source, dry
            )
            if res:
                kind, changed = res
                if kind == 'seed':
                    hist_seed += 1
                else:
                    hist_changed += 1
                    changed_field_stats.update(changed)

        if dry:
            continue

        names = list(cols.keys())
        placeholders = ', '.join(['%s'] * len(names))
        updates = ', '.join(f'"{c}" = EXCLUDED."{c}"' for c in names if c != 'uuid')
        cur.execute(
            f'INSERT INTO dt2_projects ({", ".join(chr(34)+c+chr(34) for c in names)}) '
            f'VALUES ({placeholders}) '
            f'ON CONFLICT (uuid) DO UPDATE SET {updates}',
            [cols[c] for c in names],
        )

    log(f"\n  과제 {n:,}건 처리")
    if hist_state is not None:
        unchanged = n - hist_seed - hist_changed
        log(f"  이력: 최초기록 {hist_seed:,} / 변경감지 {hist_changed:,} / 변화없음 {unchanged:,}")
        if changed_field_stats:
            log("        바뀐 필드: "
                + ", ".join(f"{k}({v})" for k, v in changed_field_stats.most_common()))
    log(f"  소유자 해석 — knoxId {owner_stats['knoxId']} / 과제PL {owner_stats['과제PL']} / "
        f"작성자 {owner_stats['작성자']} / **미해결 {owner_stats['미해결']}**")
    if unmatched_div:
        log(f"  [확인] 활성 사업부에 없는 값: "
            + ", ".join(f"{k}({v}건)" for k, v in unmatched_div.most_common()))
    if unknown_keys:
        log(f"  [정보] 매핑에 없어 extra_fields 로 보존한 키 {len(unknown_keys)}종: "
            + ", ".join(f"{k}({v})" for k, v in unknown_keys.most_common(10)))
    if lossy_keys:
        log(f"  [확인] 타입 변환에서 값이 비어 원본을 extra_fields 에 남긴 키: "
            + ", ".join(f"{k}({v})" for k, v in lossy_keys.most_common()))
    return n, owner_stats


# ─────────────────────────────────────────────────────────────────────────────
# 성과 수준값 이력 (dt2_performance_history)
# ─────────────────────────────────────────────────────────────────────────────

# 추적 대상 컬럼과 정규화·해시는 history_hash.py 한 곳에만 둔다 (쓰기 API 와 공유).
HISTORY_COLS = HH.PERF_HISTORY_COLS
_canon = HH.canon


def _value_hash(values: dict, cols=HISTORY_COLS) -> str:
    return HH.value_hash(values, cols)


def load_history_state(cur):
    """
    성과별 최신 이력 1건을 미리 읽어둔다. 성과 596건마다 SELECT 를 날리면
    왕복만 596번이라, 한 번에 가져와 메모리에서 비교한다.
    """
    cur.execute(
        "SELECT DISTINCT ON (performance_uuid) performance_uuid, value_hash, "
        "       current_level, target_level, actual_level, monthly_values_json::text, unit "
        "  FROM dt2_performance_history "
        " ORDER BY performance_uuid, observed_at DESC, id DESC"
    )
    state = {}
    for row in cur.fetchall():
        state[row[0]] = {
            'value_hash': row[1],
            'current_level': row[2], 'target_level': row[3], 'actual_level': row[4],
            'monthly_values_json': row[5], 'unit': row[6],
        }
    return state


def record_performance_history(cur, uuid, cols, prev, now, source, dry):
    """
    값이 직전 기록과 다를 때만 이력 1행을 남긴다. 같으면 None 을 돌려주고 아무것도 쓰지 않는다.

    반환: ('seed'|'import', 바뀐 필드 목록) 또는 None
    """
    tracked = {c: cols.get(c) for c in HISTORY_COLS}
    new_hash = _value_hash(tracked)

    if prev is None:
        # 최초 1회. 이관 이전부터 있던 값이라 '언제부터 이 값이었는지' 를 모른다.
        # 원본 updatedAt 을 시작점으로 쓴다 — 정확하지는 않지만 오늘로 몰아넣는 것보다
        # 낫고, change_kind='seed' 로 근사치임을 표시해 둔다.
        kind = 'seed'
        observed = cols.get('updated_at') or now
        changed = []
    else:
        if prev['value_hash'] == new_hash:
            return None
        kind = 'import'
        observed = now
        changed = [c for c in HISTORY_COLS
                   if _canon(c, tracked.get(c)) != _canon(c, prev.get(c))]

    if dry:
        return kind, changed

    cur.execute(
        "INSERT INTO dt2_performance_history ("
        "  performance_uuid, observed_at, source_updated_at, year, unit,"
        "  current_level, target_level, actual_level, monthly_values_json,"
        "  value_hash, changed_fields, change_kind, source, created_at, updated_at"
        ") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        [
            uuid, observed, cols.get('updated_at'), cols.get('year'), tracked.get('unit'),
            tracked.get('current_level'), tracked.get('target_level'), tracked.get('actual_level'),
            tracked.get('monthly_values_json'),
            new_hash, json.dumps(changed, ensure_ascii=False), kind, source, now, now,
        ],
    )
    return kind, changed


# ─────────────────────────────────────────────────────────────────────────────
# 과제 진척 이력 (dt2_project_history)
# ─────────────────────────────────────────────────────────────────────────────

# 성과와 달리 과제는 '진척률' 한 칸으로 정리되지 않는다.
#   진행상태     100% 채워져 있다. 실질적인 상태 지표.
#   진행률       저장은 되지만 대부분 비어 있다. 있으면 같이 본다.
#   액션아이템   화면이 실제로 쓰는 진척률의 재료. 분자/분모를 같이 남긴다.
#   시작/종료    월 번호(1~12). 일정이 밀리는 것을 잡는다.
# 그래서 '값 하나'가 아니라 이 묶음을 통째로 추적한다.
PROJECT_HISTORY_COLS = HH.PROJECT_HISTORY_COLS
derive_project_counts = HH.derive_project_counts


def load_project_history_state(cur):
    cur.execute(
        "SELECT DISTINCT ON (project_uuid) project_uuid, value_hash, "
        "       status, progress, action_total, action_done, "
        "       issue_total, issue_open, start_month, end_month "
        "  FROM dt2_project_history "
        " ORDER BY project_uuid, observed_at DESC, id DESC"
    )
    state = {}
    for r in cur.fetchall():
        state[r[0]] = {
            'value_hash': r[1], 'status': r[2], 'progress': r[3],
            'action_total': r[4], 'action_done': r[5],
            'issue_total': r[6], 'issue_open': r[7],
            'start_month': r[8], 'end_month': r[9],
        }
    return state


def record_project_history(cur, uuid, cols, counts, prev, now, source, dry):
    """값이 직전 기록과 다를 때만 1행. 같으면 None."""
    tracked = {c: cols.get(c) for c in PROJECT_HISTORY_COLS}
    tracked.update(counts)
    new_hash = _value_hash(tracked, PROJECT_HISTORY_COLS)

    if prev is None:
        kind = 'seed'
        observed = cols.get('updated_at') or now
        changed = []
    else:
        if prev['value_hash'] == new_hash:
            return None
        kind = 'import'
        observed = now
        changed = [c for c in PROJECT_HISTORY_COLS
                   if _canon(c, tracked.get(c)) != _canon(c, prev.get(c))]

    if dry:
        return kind, changed

    cur.execute(
        "INSERT INTO dt2_project_history ("
        "  project_uuid, observed_at, source_updated_at, year,"
        "  status, progress, action_total, action_done, issue_total, issue_open,"
        "  start_month, end_month,"
        "  value_hash, changed_fields, change_kind, source, created_at, updated_at"
        ") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        [
            uuid, observed, cols.get('updated_at'), cols.get('year'),
            tracked.get('status'), tracked.get('progress'),
            tracked.get('action_total'), tracked.get('action_done'),
            tracked.get('issue_total'), tracked.get('issue_open'),
            tracked.get('start_month'), tracked.get('end_month'),
            new_hash, json.dumps(changed, ensure_ascii=False), kind, source, now, now,
        ],
    )
    return kind, changed


def _is_empty(v):
    return v is None or v == '' or v == [] or v == {}


def import_performances(cur, performances, log: Log, dry: bool, hist_state=None, source='dt2_import'):
    unknown_keys = Counter()
    lossy_keys = Counter()
    n = 0
    hist_seed = hist_changed = 0
    changed_field_stats = Counter()
    for f in performances:
        uuid = f.get('uuid')
        if not uuid:
            log(f"  [WARN] uuid 없는 성과 건너뜀: id={f.get('id')}")
            continue

        cols, extra = {}, {}
        for key, value in f.items():
            if key in PERFORMANCE_RELATION_KEYS or key in PERFORMANCE_SKIP_KEYS:
                continue
            col = PERFORMANCE_FIELD_MAP.get(key)
            if col:
                converted = convert(col, value)
                cols[col] = converted
                # 타입 변환에서 값이 사라지면(숫자 컬럼에 비숫자 문자열 등)
                # 원본을 extra_fields 에 남긴다. 안 그러면 통째로 유실된다.
                # (2026-07-29 운영 대조에서 현재수준 3건이 이렇게 사라졌다)
                if converted is None and not _is_empty(value):
                    extra[key] = value
                    lossy_keys[key] += 1
            else:
                extra[key] = value
                unknown_keys[key] += 1

        # 과제와 같은 이유로, 지어낸 타임스탬프는 표시해 둔다 (재조립 시 생략)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        synth = []
        if not cols.get('created_at'):
            cols['created_at'] = now
            synth.append('createdAt')
        if not cols.get('updated_at'):
            cols['updated_at'] = now
            synth.append('updatedAt')
        if synth:
            extra['_synthesizedTs'] = synth

        cols['extra_fields'] = json.dumps(extra, ensure_ascii=False)

        n += 1

        # 이력은 본체 upsert 와 같은 트랜잭션에서 판정한다.
        # (dry 여도 '몇 건이 바뀌었는지' 는 세어야 계획을 볼 수 있다)
        if hist_state is not None:
            res = record_performance_history(
                cur, uuid, cols, hist_state.get(uuid), now, source, dry
            )
            if res:
                kind, changed = res
                if kind == 'seed':
                    hist_seed += 1
                else:
                    hist_changed += 1
                    changed_field_stats.update(changed)

        if dry:
            continue

        names = list(cols.keys())
        placeholders = ', '.join(['%s'] * len(names))
        updates = ', '.join(f'"{c}" = EXCLUDED."{c}"' for c in names if c != 'uuid')
        cur.execute(
            f'INSERT INTO dt2_performances ({", ".join(chr(34)+c+chr(34) for c in names)}) '
            f'VALUES ({placeholders}) '
            f'ON CONFLICT (uuid) DO UPDATE SET {updates}',
            [cols[c] for c in names],
        )

    log(f"\n  성과 {n:,}건 처리")
    if hist_state is not None:
        unchanged = n - hist_seed - hist_changed
        log(f"  이력: 최초기록 {hist_seed:,} / 변경감지 {hist_changed:,} / 변화없음 {unchanged:,}")
        if changed_field_stats:
            log("        바뀐 필드: "
                + ", ".join(f"{k}({v})" for k, v in changed_field_stats.most_common()))
        if hist_seed and hist_changed == 0 and unchanged == 0:
            log("        (최초 실행입니다. 이 시점부터 추이가 쌓이기 시작합니다)")
    if unknown_keys:
        log(f"  [정보] extra_fields 로 보존한 키 {len(unknown_keys)}종: "
            + ", ".join(f"{k}({v})" for k, v in unknown_keys.most_common(10)))
    if lossy_keys:
        log(f"  [확인] 타입 변환에서 값이 비어 원본을 extra_fields 에 남긴 키: "
            + ", ".join(f"{k}({v})" for k, v in lossy_keys.most_common()))
    return n


def import_links(cur, projects, performances, log: Log, dry: bool):
    """과제→성과 연결. 참조 해석은 결정론적 순서를 따른다."""
    perf_by_uuid = {f['uuid'] for f in performances if f.get('uuid')}
    perf_by_code = {}
    perf_by_legacy = {}
    for f in performances:
        if f.get('id'):
            perf_by_code.setdefault(str(f['id']), f.get('uuid'))
        if f.get('성과항목UUID'):
            perf_by_legacy.setdefault(str(f['성과항목UUID']), f.get('uuid'))

    n_ref = n_ok = n_orphan = 0
    dup = 0
    seen = set()
    key_fmt = Counter()
    mismatch = 0
    orphan_elems = {}          # 연결로 못 만든 원소를 과제별로 모아 둔다

    for p in projects:
        puid = p.get('uuid')
        arr = p.get('성과목록')
        if not puid or not isinstance(arr, list):
            continue

        for idx, elem in enumerate(arr):
            n_ref += 1
            if not isinstance(elem, dict):
                n_orphan += 1
                orphan_elems.setdefault(puid, []).append({'_pos': idx, '_raw': elem})
                continue

            target = None
            for cand in ('성과항목UUID', '성과UUID', 'uuid'):
                v = elem.get(cand)
                if v and str(v) in perf_by_uuid:
                    target, _ = str(v), key_fmt.update([cand])
                    break
                if v and str(v) in perf_by_legacy:
                    target, _ = perf_by_legacy[str(v)], key_fmt.update([cand + '(legacy)'])
                    break
            if target is None:
                for cand in ('성과항목ID', 'id'):
                    v = elem.get(cand)
                    if v and str(v) in perf_by_code:
                        target, _ = perf_by_code[str(v)], key_fmt.update([cand])
                        break
            if target is None:
                n_orphan += 1
                # 없는 성과를 가리키는 원소도 **버리지 않는다.** 버리면 화면의
                # '연결 N개' 가 줄어든다. 위치와 함께 과제 쪽에 보관했다가 복원한다.
                orphan_elems.setdefault(puid, []).append({'_pos': idx, '_raw': elem})
                continue

            if (puid, target) in seen:
                dup += 1
                orphan_elems.setdefault(puid, []).append({'_pos': idx, '_raw': elem,
                                                          '_dup': True})
                continue
            seen.add((puid, target))
            n_ok += 1

            # 원소를 **통째로** 보존한다. contribution/actual_level 컬럼은 질의용 사본일 뿐이다.
            # 원칙: extra_fields 만으로 원본 원소를 그대로 되살릴 수 있어야 한다.
            #   - 참조 키 이름(성과항목UUID / uuid / id …)이 화면 조회에 쓰인다
            #   - 값의 타입(50 vs '50')과 빈 문자열도 원본 그대로여야 한다
            rel_extra = dict(elem)
            # '성과 본체 복제 필드' 집계는 관계 속성·참조 키를 뺀 나머지 기준 (기존 의미 유지)
            if any(k not in ('과제기여도', '실적수준',
                             '성과항목UUID', '성과UUID', 'uuid', '성과항목ID', 'id')
                   for k in rel_extra):
                mismatch += 1

            if dry:
                continue

            now = datetime.now(timezone.utc).replace(tzinfo=None)
            cur.execute(
                'INSERT INTO dt2_project_performance '
                '(project_uuid, performance_uuid, contribution, actual_level, position,'
                ' extra_fields, created_at, updated_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s) '
                'ON CONFLICT (project_uuid, performance_uuid) DO UPDATE SET '
                'contribution = EXCLUDED.contribution, actual_level = EXCLUDED.actual_level, '
                'position = EXCLUDED.position, '
                'extra_fields = EXCLUDED.extra_fields, updated_at = EXCLUDED.updated_at',
                (puid, target,
                 str(elem.get('과제기여도')) if elem.get('과제기여도') not in (None, '') else None,
                 str(elem.get('실적수준')) if elem.get('실적수준') not in (None, '') else None,
                 idx,
                 json.dumps(rel_extra, ensure_ascii=False), now, now),
            )

    # 연결로 만들지 못한 원소(고아·중복)를 과제의 extra_fields 에 위치와 함께 보관한다.
    # 이게 없으면 V2 읽기 API 가 되돌릴 때 `성과목록` 의 원소 수가 줄어든다.
    if not dry and orphan_elems:
        for puid, items in orphan_elems.items():
            cur.execute(
                "UPDATE dt2_projects "
                "   SET extra_fields = jsonb_set(extra_fields, '{_unlinkedPerfRefs}', %s::jsonb) "
                " WHERE uuid = %s",
                [json.dumps(items, ensure_ascii=False), puid],
            )

    log(f"\n  과제→성과 참조 {n_ref:,}건 중 {n_ok:,}건 연결")
    log(f"  고아 참조(성과 없음) : {n_orphan:,}건  ← 연결 안 함 (원소는 보존)")
    log(f"  중복 참조            : {dup:,}건  ← 첫 건만 (나머지 원소는 보존)")
    if orphan_elems:
        log(f"  연결 못한 원소 보관  : 과제 {len(orphan_elems):,}건의 extra_fields._unlinkedPerfRefs")
    if key_fmt:
        log(f"  해석에 쓰인 키: " + ", ".join(f"{k}({v})" for k, v in key_fmt.most_common()))
    log(f"  성과 본체 복제 필드를 가진 원소: {mismatch:,}건 → extra_fields 에 보존")
    return n_ok, n_orphan


def import_dependencies(cur, projects, log: Log, dry: bool):
    known = {p['uuid'] for p in projects if p.get('uuid')}
    n = orphan = 0
    for p in projects:
        puid = p.get('uuid')
        arr = p.get('선행과제목록')
        if not puid or not isinstance(arr, list):
            continue
        for elem in arr:
            dep = elem.get('uuid') if isinstance(elem, dict) else (elem if isinstance(elem, str) else None)
            if not dep:
                continue
            if dep not in known:
                orphan += 1
                continue
            n += 1
            if dry:
                continue
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            extra = {k: v for k, v in elem.items() if k != 'uuid'} if isinstance(elem, dict) else {}
            cur.execute(
                'INSERT INTO dt2_project_dependencies '
                '(project_uuid, depends_on_uuid, extra_fields, created_at, updated_at) '
                'VALUES (%s,%s,%s,%s,%s) ON CONFLICT (project_uuid, depends_on_uuid) DO NOTHING',
                (puid, dep, json.dumps(extra, ensure_ascii=False), now, now),
            )
    log(f"\n  선행과제 {n:,}건 연결 (존재하지 않는 과제 지목 {orphan:,}건 건너뜀)")
    return n


def import_attachments(cur, projects, log: Log, dry: bool):
    """첨부 메타 이관. 파일 실체는 건드리지 않는다."""
    known = {p['uuid'] for p in projects if p.get('uuid')}
    known |= {str(p['id']) for p in projects if p.get('id')}
    id_to_uuid = {str(p['id']): p['uuid'] for p in projects if p.get('id') and p.get('uuid')}

    cur.execute(
        "SELECT id, project_id, original_filename, stored_filename, file_size, mime_type, "
        "       uploaded_by, uploaded_by_name, created_at FROM project_attachments ORDER BY id"
    )
    rows = cur.fetchall()
    n = orphan = 0
    for (aid, pid, fname, stored, size, mime, uby, uname, cat) in rows:
        target = None
        if pid in known:
            target = pid if pid not in id_to_uuid else id_to_uuid[pid]
        if target is None:
            orphan += 1              # 과제가 사라진 첨부 — NULL 로 보존
        n += 1
        if dry:
            continue
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        cur.execute(
            'INSERT INTO dt2_project_attachments '
            '(legacy_id, project_uuid, original_filename, stored_filename, file_size, mime_type, '
            ' uploaded_by, uploaded_by_name, created_at, updated_at) '
            'VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) '
            'ON CONFLICT (legacy_id) DO UPDATE SET project_uuid = EXCLUDED.project_uuid, '
            'original_filename = EXCLUDED.original_filename, updated_at = EXCLUDED.updated_at',
            (aid, target, fname, stored, size, mime, uby, uname, cat or now, now),
        )
    log(f"\n  첨부 {n:,}건 이관 (과제 미연결 {orphan:,}건은 project_uuid=NULL 로 보존)")
    return n, orphan


# ─────────────────────────────────────────────────────────────────────────────

# --truncate 로 비우는 표. **이관이 다시 채우는 표만** 여기 들어간다.
TRUNCATE_TABLES = [
    "dt2_project_performance", "dt2_project_dependencies",
    "dt2_project_attachments", "dt2_project_editors", "dt2_change_proposals",
    "dt2_projects", "dt2_performances",
]


def check_truncate_scope(cur, log: Log):
    """
    TRUNCATE ... CASCADE 가 **실제로** 비울 표를 조회해, 목록에 없는 것을 경고한다.

    왜 필요한가 (2026-08-01 사고)
        CASCADE 는 대상 표를 참조하는 표를 목록에 없어도 자동으로 비운다. 그래서
        `dt2_project_kpi`(과제↔DX KPI 연결)가 조용히 날아갔다 — 로그에 이름조차
        찍히지 않으니 실행한 사람은 알 방법이 없었다.

    왜 그냥 목록에 추가하지 않고 조회하는가
        표는 앞으로도 늘어난다. 목록에 적어 두는 방식은 다음에 또 똑같이 새는데,
        새는 순간이 아니라 한참 뒤 "데이터가 없다" 로 발견된다.
        사람이 갱신해야 하는 표를 하나 더 만드는 대신 **DB 에게 묻는다.**

    돌려주는 것
        비워지지만 이관이 다시 채우지 않는 표 [(이름, 행수), ...] — 행이 있는 것만.
        V1 에 원본이 없으므로 지우면 재이관으로도 복구되지 않는다.
    """
    from psycopg import sql

    # CASCADE 는 전이적이다 — 참조의 참조까지 따라간다.
    cur.execute("""
        WITH RECURSIVE closure AS (
            SELECT c.oid
              FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = ANY(%s)
            UNION
            SELECT con.conrelid
              FROM pg_constraint con
              JOIN closure cl ON con.confrelid = cl.oid
             WHERE con.contype = 'f'
        )
        SELECT c.relname
          FROM closure cl JOIN pg_class c ON c.oid = cl.oid
         ORDER BY c.relname
    """, (TRUNCATE_TABLES,))
    affected = [r[0] for r in cur.fetchall()]

    extra = [t for t in affected if t not in TRUNCATE_TABLES]
    orphans = []
    for t in extra:
        cur.execute(sql.SQL("SELECT count(*) FROM {}").format(sql.Identifier(t)))
        n = cur.fetchone()[0]
        if n:
            orphans.append((t, n))

    log("\n── TRUNCATE 영향 범위 ──")
    log(f"  명시한 표      : {len(TRUNCATE_TABLES)}개 (이관이 다시 채움)")
    if not extra:
        log("  CASCADE 추가분 : 없음")
        return []

    log(f"  CASCADE 추가분 : {len(extra)}개 — {', '.join(extra)}")
    if not orphans:
        log("  (모두 비어 있어 잃을 것이 없습니다)")
        return []

    log("\n  [경고] 아래는 V1 에 원본이 없어 **재이관해도 복구되지 않습니다.**")
    for t, n in orphans:
        log(f"      {t:<28} {n:,}건 삭제됨")
    return orphans


def main():
    ap = argparse.ArgumentParser(description="V1 → V2 이관 (기본: 계획만 확인)")
    ap.add_argument("--dsn")
    ap.add_argument("--commit", action="store_true", help="실제로 이관한다")
    ap.add_argument("--truncate", action="store_true", help="이관 전 dt2_* 를 비운다 (이력은 보존)")
    ap.add_argument("--truncate-history", action="store_true",
                    help="--truncate 시 성과 이력까지 지운다. 재생성 불가이므로 기본은 보존")
    ap.add_argument("--truncate-orphans", action="store_true",
                    help="CASCADE 로 같이 비워지는 표(V1 에 원본 없음)까지 지우는 것을 승인한다")
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
    log = Log(os.path.join(outdir, f"dt2_import_{stamp}.log"))

    log("=" * 72)
    log(" 디지털 트윈 대시보드 — V1 → V2 이관 (Phase 2-2)")
    log("=" * 72)
    log(f" 접속 : {mask_dsn(dsn)}")
    log(f" 모드 : {'실제 이관 (--commit)' if args.commit else '계획 확인 (dry-run)'}")
    log(f" 로그 : {log.path}")
    log("-" * 72)
    log(" 원본 dashboard_data 는 읽기만 합니다. 절대 수정하지 않습니다.")

    try:
        conn = psycopg.connect(dsn)
    except Exception as exc:
        log(f"[FAIL] DB 접속 실패: {exc}")
        log.close()
        sys.exit(1)

    exit_code = 0
    try:
        cur = conn.cursor()

        cur.execute("SELECT version, projects, performances FROM dashboard_data ORDER BY id LIMIT 1")
        row = cur.fetchone()
        if row is None:
            log("[FAIL] dashboard_data 에 행이 없습니다.")
            raise SystemExit(1)
        v1_version, projects, performances = row
        projects = [p for p in (as_obj(projects) or []) if isinstance(p, dict)]
        performances = [f for f in (as_obj(performances) or []) if isinstance(f, dict)]

        log(f"\n── 원본 (V1 v{v1_version}) ──")
        log(f"  과제 {len(projects):,}건 / 성과 {len(performances):,}건")

        log("\n── 참조 데이터 ──")
        refs = load_refs(cur, log)

        if args.truncate and args.commit:
            # 지우기 전에 **실제로 무엇이 지워지는지** 확인한다. TRUNCATE 목록만 보고
            # 판단하면 안 된다 — CASCADE 가 목록에 없는 참조 테이블까지 비운다.
            orphans = check_truncate_scope(cur, log)
            if orphans and not args.truncate_orphans:
                log("\n  중단합니다. 위 표는 V1 에서 복원되지 않습니다.")
                log("  지우기 전에 백업하거나, 정말 지우려면 --truncate-orphans 를 명시하세요.")
                raise SystemExit(1)

            log("\n  dt2_* 비우는 중…")
            # dt2_performance_history 는 일부러 뺐다. 본체는 원본에서 언제든 다시
            # 만들 수 있지만 이력은 재생성이 불가능하다 — 지우면 그 기간은 영영 공백이다.
            cur.execute(
                "TRUNCATE " + ", ".join(TRUNCATE_TABLES) + " CASCADE"
            )
            if args.truncate_history:
                log("  [주의] --truncate-history: 성과·과제 이력도 함께 지웁니다 (복구 불가)")
                cur.execute("TRUNCATE dt2_performance_history, dt2_project_history")
            else:
                log("  이력(dt2_performance_history · dt2_project_history)은 보존합니다.")

        dry = not args.commit
        log("\n── 이관 " + ("계획 ──" if dry else "실행 ──"))

        hist_state = load_history_state(cur)
        proj_hist_state = load_project_history_state(cur)
        log(f"  기존 이력 보유 — 성과 {len(hist_state):,}건 / 과제 {len(proj_hist_state):,}건")

        # 성과를 먼저 넣어야 연결 FK 가 성립한다
        import_performances(cur, performances, log, dry, hist_state=hist_state)
        import_projects(cur, projects, refs, log, dry, hist_state=proj_hist_state)
        import_links(cur, projects, performances, log, dry)
        import_dependencies(cur, projects, log, dry)
        import_attachments(cur, projects, log, dry)

        if dry:
            conn.rollback()
            log("\n" + "-" * 72)
            log(" 계획만 확인했습니다. 아무것도 쓰지 않았습니다.")
            log(" 실제로 이관하려면:  python scripts\\dt2_import.py --commit")
            log("-" * 72)
        else:
            conn.commit()
            log("\n[OK]   커밋 완료")

            cur.execute(
                "SELECT (SELECT count(*) FROM dt2_projects), (SELECT count(*) FROM dt2_performances), "
                "       (SELECT count(*) FROM dt2_project_performance), "
                "       (SELECT count(*) FROM dt2_project_dependencies), "
                "       (SELECT count(*) FROM dt2_project_attachments), "
                "       (SELECT count(*) FROM dt2_performance_history), "
                "       (SELECT count(DISTINCT performance_uuid) FROM dt2_performance_history), "
                "       (SELECT min(observed_at) FROM dt2_performance_history), "
                "       (SELECT count(*) FROM dt2_project_history), "
                "       (SELECT count(DISTINCT project_uuid) FROM dt2_project_history)"
            )
            a, b, c, d, e, h, hu, h0, ph, phu = cur.fetchone()
            log("\n── V2 현황 ──")
            log(f"  dt2_projects             : {a:,}")
            log(f"  dt2_performances         : {b:,}")
            log(f"  dt2_project_performance  : {c:,}")
            log(f"  dt2_project_dependencies : {d:,}")
            log(f"  dt2_project_attachments  : {e:,}")
            log(f"  dt2_performance_history  : {h:,}  (성과 {hu:,}건, 최초 {h0 or '-'})")
            log(f"  dt2_project_history      : {ph:,}  (과제 {phu:,}건)")
            log("\n  다음: python scripts\\dt2_verify.py 로 원본과 동일한지 검증하세요.")

    except SystemExit:
        conn.rollback()
        exit_code = 1
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
    log("=" * 72)
    log.close()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
