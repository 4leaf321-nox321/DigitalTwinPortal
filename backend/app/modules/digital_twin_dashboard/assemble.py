"""
dt2_* 행 → V1 `/data` 와 같은 형태의 JSON 으로 재조립 (Phase 2-4)

무엇을 하나
    dt2_import.py 의 **반대 방향**이다. 행으로 흩어놓은 것을 다시 원본 모양으로 모은다.
    화면은 응답 형태가 그대로라 자기가 V2 에서 읽는다는 것을 모른다.

왜 필요한가
    Phase 2 는 "테이블이 원본과 같다" 까지만 증명했다.
    화면이 받는 **형태로 되돌릴 수 있는가** 는 별개 문제이고, 실제로 해보니
    `성과목록` 원소의 참조 키 이름이 모자랐다(2026-07-29 발견, 이관 수정).

    그래서 이 파일과 짝을 이루는 `scripts/dt2_compare_api.py` 로
    "V1 응답과 V2 응답이 같은가" 를 운영 데이터로 대조한 뒤에 화면을 옮긴다.

의도적으로 다른 것 — 하나뿐
    `linkedProjects`   성과에 저장돼 있던 **파생 캐시**. 이관하지 않았고 되돌리지도 않는다.
                       화면은 이 값을 전부 직접 계산한다
                       (ContributionEditModal.jsx:505, AllPerformancesView 등).
                       저장된 값을 읽는 코드는 없다.
"""

from __future__ import annotations

from datetime import datetime, date
from decimal import Decimal

from app.modules.digital_twin_dashboard.field_maps import (
    PROJECT_FIELD_MAP, PERFORMANCE_FIELD_MAP, IMAGE_SLOTS,
)
from app.modules.digital_twin_dashboard.models_v2 import (
    Dt2Project, Dt2Performance, Dt2ProjectPerformance, Dt2ProjectDependency,
)
from app.shared.timeutil import iso_kst

# col → 원본 JSON 키 (이관 맵의 역방향)
PROJECT_COL_TO_KEY = {v: k for k, v in PROJECT_FIELD_MAP.items()}
PERF_COL_TO_KEY = {v: k for k, v in PERFORMANCE_FIELD_MAP.items()}


def _num_out(v):
    """
    Numeric → JSON 숫자. 정수면 int 로 낸다.

    Decimal 은 그대로 jsonify 하면 터진다. 그리고 9 를 9.0 으로 내면
    화면에서 문자열 비교하는 자리가 어긋날 수 있어 정수는 정수로 유지한다.
    """
    if v is None:
        return None
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    return v


def _ts_out(v):
    """
    DateTime → ISO 문자열. **'Z' 를 반드시 붙인다.**

    저장값은 naive UTC 다. Z 없이 내보내면 브라우저가 `new Date(...)` 로
    **로컬 시간**으로 해석해 KST 기준 9시간이 밀린다.
    """
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat(timespec='milliseconds') + 'Z'
    if isinstance(v, date):
        return iso_kst(v)
    return v


def _out(col, value):
    if col in ('current_level', 'target_level'):
        return _num_out(value)
    if isinstance(value, (datetime, date)):
        return _ts_out(value)
    if isinstance(value, Decimal):
        return _num_out(value)
    return value


# V1 은 이 키들을 **참일 때만** 저장한다. False 를 실어 보내면 원본과 달라진다.
_TRUE_ONLY_KEYS = {'_deleted', '_permanentlyDeleted'}

# 이관이 지어낸 타임스탬프를 표시해 둔 자리 (extra_fields)
_SYNTH_TS_KEY = '_synthesizedTs'

# 연결로 만들지 못한 `성과목록` 원소를 보관해 둔 자리 (extra_fields)
_UNLINKED_KEY = '_unlinkedPerfRefs'

# 재조립 결과에 내보내지 않는 내부 표식
_INTERNAL_KEYS = {_SYNTH_TS_KEY, _UNLINKED_KEY}


def _base_dict(row, col_to_key) -> dict:
    """컬럼 + extra_fields 를 원본 키 이름으로 되돌린다."""
    extra = dict(row.extra_fields or {})
    synth = set(extra.get(_SYNTH_TS_KEY) or ())

    out = {}
    for col, key in col_to_key.items():
        v = getattr(row, col, None)
        if v is None:
            continue
        # 이관이 지어낸 타임스탬프는 원본에 없던 것이라 내보내지 않는다
        if key in synth:
            continue
        # V1 이 참일 때만 저장하는 키는 거짓이면 생략한다
        if key in _TRUE_ONLY_KEYS and not v:
            continue
        out[key] = _out(col, v)

    for k, v in extra.items():
        if k in _INTERNAL_KEYS:
            continue
        out.setdefault(k, v)
    return out


def assemble_performance(row: Dt2Performance) -> dict:
    """성과 1행 → 원본 성과 dict."""
    return _base_dict(row, PERF_COL_TO_KEY)


# 선행과제 원소에 **베껴져 있는** 대상 과제의 표시 필드.
# 원소를 만든 시점의 사본이라, 대상 과제의 이름이 바뀌면 낡는다.
# 살아 있는 행을 받으면(`dep_projects`) 이 키들을 덮어쓴다.
_DEP_COPIED_KEYS = ('과제명', '사업부', '과제년도', '과제PL')


def assemble_project(row: Dt2Project, links=None, deps=None,
                     dep_projects=None) -> dict:
    """
    과제 1행 + 관계 → 원본 과제 dict.

    `dep_projects`  {uuid: Dt2Project} — 선행과제 원소의 과제명·사업부를 **지금 값으로**
                    채우는 데 쓴다. 안 주면 원소에 베껴져 있던 사본을 그대로 쓴다
                    (`assemble_project` 를 낱개로 부르는 자리에서 과제를 다시 조회하게
                    만들지 않으려는 것뿐이다 — 전체 조립은 항상 준다).
    """
    out = _base_dict(row, PROJECT_COL_TO_KEY)

    # 성과 연결 — extra_fields 에 원본 원소가 통째로 들어 있다.
    # **원본 배열 순서로 되돌린다.** position 이 없는 예전 데이터는 뒤에 붙인다.
    placed = []
    for ln in (links or []):
        elem = dict(ln.extra_fields or {})
        # 참조가 없으면 최소한 그것만은 살린다 (이관 수정 전 데이터 대비)
        if not any(k in elem for k in
                   ('성과항목UUID', '성과UUID', 'uuid', '성과항목ID', 'id')):
            elem['성과항목UUID'] = ln.performance_uuid
        # 타입 컬럼에만 값이 있고 extra_fields 에 없으면 채워 넣는다.
        # extra_fields 를 완전하게 쓰지 않는 writer 가 생겨도 값이 사라지지 않는다.
        # (2026-07-29: V2 연결 API 가 참조 키만 넣어 기여도·실적이 사라졌었다)
        if ln.contribution is not None and '과제기여도' not in elem:
            elem['과제기여도'] = ln.contribution
        if ln.actual_level is not None and '실적수준' not in elem:
            elem['실적수준'] = ln.actual_level
        placed.append((ln.position if ln.position is not None else 10_000, elem))

    # 연결로 만들지 못한 원소(고아·중복)도 제자리에 되돌린다
    for item in ((row.extra_fields or {}).get(_UNLINKED_KEY) or []):
        if isinstance(item, dict) and '_raw' in item:
            placed.append((item.get('_pos', 10_000), item['_raw']))

    if placed:
        placed.sort(key=lambda t: t[0])
        out['성과목록'] = [e for _pos, e in placed]

    # 선행과제 — 원소는 `{uuid, 과제명, 사업부, 과제년도, 과제PL}` 모양이다.
    # 표시 필드는 **지금의 대상 과제**에서 다시 채운다. 사본을 그대로 내보내면
    # 대상 과제 이름을 바꾼 뒤에도 편집창에 옛 이름이 뜬다.
    dep_list = []
    for d in (deps or []):
        elem = dict(d.extra_fields or {})
        elem.setdefault('uuid', d.depends_on_uuid)
        live = (dep_projects or {}).get(d.depends_on_uuid)
        if live is not None:
            elem['과제명'] = live.title or ''
            elem['사업부'] = live.division or ''
            elem['과제년도'] = live.year if live.year is not None else ''
            elem['과제PL'] = live.pl_name or ''
        else:
            # 대상이 사라졌다 — 사본으로라도 보여준다. 없으면 빈 값으로 자리는 남긴다.
            for k in _DEP_COPIED_KEYS:
                elem.setdefault(k, '')
        dep_list.append(elem)
    if dep_list:
        out['선행과제목록'] = dep_list

    # 이미지 참조 — Phase 1-2 에서 슬롯별로 모아둔 것을 되돌린다
    for slot, refs in (row.image_refs_json or {}).items():
        if slot in IMAGE_SLOTS and refs:
            out[slot] = refs

    return out


def assemble_data(include_permanently_deleted=False,
                  include_deleted_performances=False) -> dict:
    """
    V1 `GET /data` 와 같은 형태의 전체 응답.

    기본 필터는 V1 과 **동일하게** 맞춘다.
        과제  _permanentlyDeleted 인 것 제외 (소프트 삭제는 포함해서 내보낸다)
        성과  _deleted 인 것 제외
    """
    pq = Dt2Project.query
    if not include_permanently_deleted:
        pq = pq.filter(Dt2Project.is_permanently_deleted.is_(False))
    projects = pq.all()

    fq = Dt2Performance.query
    if not include_deleted_performances:
        fq = fq.filter(Dt2Performance.is_deleted.is_(False))
    perfs = fq.all()

    # 관계를 과제별로 미리 묶는다 (과제마다 쿼리하면 396번 왕복한다)
    links_by_proj = {}
    for ln in Dt2ProjectPerformance.query.all():
        links_by_proj.setdefault(ln.project_uuid, []).append(ln)
    deps_by_proj = {}
    for d in Dt2ProjectDependency.query.all():
        deps_by_proj.setdefault(d.project_uuid, []).append(d)

    # 선행과제의 표시 필드를 지금 값으로 채우기 위한 색인. 이미 다 읽어 둔 목록이라
    # 왕복이 늘지 않는다. `include_permanently_deleted=False` 로 걸러진 과제는 여기
    # 없으므로, 그런 대상은 사본으로 남는다(위 assemble_project 참조).
    proj_by_uuid = {p.uuid: p for p in projects}

    return {
        'projects': [
            assemble_project(p, links_by_proj.get(p.uuid), deps_by_proj.get(p.uuid),
                             proj_by_uuid)
            for p in projects
        ],
        'performances': [assemble_performance(f) for f in perfs],
    }
