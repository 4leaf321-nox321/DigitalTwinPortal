"""
V2 과제별 쓰기 API (Phase 3-3, 3-4)

기존 `/api/digital-twin-dashboard/*` 와 **URL 이 겹치지 않는다**(`/api/dt-v2/*`).
컷오버 전까지 이 API 는 아무도 부르지 않으므로 배포해도 화면이 달라지지 않는다.

핵심 성질
    권한      모든 쓰기가 permissions.can_edit_project 를 경유한다. 예외 없다.
    동시성    행 락(짧게) + 낙관적 락(row_version).
              버전이 어긋나도 **건드린 필드가 겹치지 않으면 통과**시킨다.
    AI        저위험 필드는 즉시 반영, 핵심 필드는 제안 대기열로 (202).
              사람이 UI 로 고칠 때는 분류를 적용하지 않는다.
    추적      바뀐 필드마다 dt2_project_changes 1행 + 진척 이력 갱신.
"""

from __future__ import annotations

import re
import time
import uuid as uuidlib
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from flask import Blueprint, Response, current_app, request
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import func, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm.attributes import flag_modified

from app.extensions import db
from app.modules.auth.models import User, UserRole
from app.modules.digital_twin_dashboard import permissions as P
from app.modules.digital_twin_dashboard.ai import agent as dt_agent
# 이름이 비슷하지만 다른 물건이다 — `agent` 는 LLM 이 도구로 **스스로 고치고**,
# `form_assist` 는 편집 화면의 칸에 넣을 값을 **제안만** 한다(쓰기 코드가 없다).
from app.modules.digital_twin_dashboard.ai import form_assist as dt_form
from app.modules.digital_twin_dashboard.ai import llm as dt_llm
from app.modules.digital_twin_dashboard.ai_tools import describe_fields as ai_describe_fields
from app.modules.digital_twin_dashboard.ai_tools import (
    describe_performance_fields as ai_describe_performance_fields,
)
from app.modules.digital_twin_dashboard import detail_rules as DR
from app.modules.digital_twin_dashboard import graph_view as GV
from app.modules.digital_twin_dashboard import trend_view as TV
from app.modules.digital_twin_dashboard import trend_notes as TN
from app.modules.digital_twin_dashboard.ai import graph_agent as GA
from app.modules.digital_twin_dashboard import worklist as WL
from app.modules.digital_twin_dashboard.ai import graph_narrate as GN
from app.modules.digital_twin_dashboard.assemble import (
    assemble_data, PROJECT_COL_TO_KEY,
    # 연결 행 사본을 **조립과 같은 모양**으로 맞추는 데 쓴다
    # (propagate_performance_to_links — Decimal 을 그대로 JSONB 에 넣으면 터진다)
    _out as assemble_out,
)
from app.modules.digital_twin_dashboard.field_maps import (
    PROJECT_FIELD_MAP, PERFORMANCE_FIELD_MAP, IMAGE_SLOTS,
    translate_keys, division_kpi_code,
)
from app.modules.digital_twin_dashboard.history import (
    record_project_history, record_performance_history,
)
from app.modules.digital_twin_dashboard.models import (
    DashboardData, DashboardActivityLog, ModuleSettings, Division,
    PerformanceCategory, PerformanceSubcategory,
)
from app.modules.digital_twin_dashboard.models_v2 import (
    Dt2Project, Dt2ProjectChange, Dt2ProjectHistory, Dt2ChangeProposal,
    Dt2Performance, Dt2ProjectPerformance, Dt2ProjectKpi, Dt2AgentRun,
    Dt2ProjectDependency,
)
from app.shared.auth import auth_required, authenticate, pat_user
from app.shared.responses import success_response, error_response
from app.shared.timeutil import iso_kst, now_utc_iso_z

bp_v2 = Blueprint('dt_v2', __name__)


# ─────────────────────────────────────────────────────────────────────────────
# 컷오버 전 쓰기 차단
#
# 컷오버 전에는 **V1(dashboard_data)이 정본**이고, 저장할 때마다 배치 동기화가
# dt2 를 V1 기준으로 덮어쓴다(v2_sync). 그래서 이 시점에 V2 쓰기 API 를 쓰면
# **다음 저장 한 번에 조용히 사라진다.** 2026-07-29 동시성 시험에서 실측했다
# (V2 로 33 을 썼는데 동기화 후 V1 값 100 으로 되돌아옴).
#
# 화면이 아직 이 API 를 부르지 않으므로 실제 사고는 아직 없지만,
# 전환 작업 중 누군가 시험 삼아 호출하면 데이터를 잃는다. 그래서 기본값을 막아둔다.
#
# 스위치는 **코드가 아니라 환경변수**다 (config.DT2_WRITE_ENABLED).
# 코드 상수로 두면 개발에서 켠 파일이 그대로 반입돼 운영에서도 켜진다.
# 컷오버 = 운영 .env 에 DT2_WRITE_ENABLED=true 를 넣고 재기동, 그것뿐이다.
# v2_sync 중단은 따로 하지 않아도 된다 — 같은 값을 보고 스스로 멈춘다.
# ─────────────────────────────────────────────────────────────────────────────

_WRITE_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}

# POST 이지만 **아무것도 쓰지 않는** 경로. 확인할 목록이 길어질 수 있어 본문으로 받을 뿐이다.
# 조회는 컷오버 스위치와 무관하게 동작해야 한다 — 쓰기가 꺼져 있다고 "이 사람이 계정과
# 연결됐는가" 를 못 보면, 정작 컷오버 전에 데이터를 정리할 수가 없다.
# 여기에 넣는 경로는 **반드시 읽기 전용이어야 한다.** 하나라도 쓰면 차단이 뚫린다.
#
# 폼 도우미 둘은 LLM 에게 값을 물어 **돌려주기만** 한다(DB 를 읽기만 하고 쓰지 않는다).
# 편집창에서 부르는 것이라, 쓰기 스위치가 꺼진 환경에서 503 이 나면 화면이 통째로
# 고장 난 것처럼 보인다 — 실제로는 저장이 막힌 것뿐인데.
_READ_ONLY_ENDPOINTS = {'dt_v2.resolve_members',
                        'dt_v2.ai_form_project_fill', 'dt_v2.ai_form_action_items',
                        'dt_v2.ai_form_people', 'dt_v2.ai_form_kpi_links',
                        # 관계도 에이전트의 서술. 분석 결과를 받아 **문장만** 만들어
                        # 돌려준다 — DB 를 읽지도 쓰지도 않는다. POST 인 것은 본문이
                        # 길어서일 뿐이다.
                        'dt_v2.graph_agent_narrate',
                        # 「내 일」의 미룸. 자기 표시 상태를 자기 표에만 쓴다 —
                        # 대시보드 데이터를 건드리지 않으므로 컷오버 스위치와 무관하다.
                        # (스위치를 되돌리는 날 배지가 4xx 로 깨지지 않게 여기 둔다)
                        'dt_v2.my_worklist_snooze', 'dt_v2.my_worklist_unsnooze'}


def v2_write_enabled() -> bool:
    """컷오버 스위치. 이 값이 True 면 V2 가 정본이고 v2_sync 는 멈춘다."""
    return bool(current_app.config.get('DT2_WRITE_ENABLED', False))


@bp_v2.before_request
def _block_writes_before_cutover():
    if request.endpoint in _READ_ONLY_ENDPOINTS:
        return None
    if request.method not in _WRITE_METHODS or v2_write_enabled():
        return None
    # 시험 코드는 통과시킨다 — 막힌 상태로는 쓰기 경로를 검증할 수 없다.
    # **운영에서는 이 분기가 열리지 않는다** (ProductionConfig 에서 False 고정,
    # 환경변수로도 못 켬). 열려 있으면 유효 토큰만 있으면 누구나 dt2 에 직접 쓸 수
    # 있고, 그 값은 다음 저장 시 동기화에 덮여 조용히 사라진다.
    if (current_app.config.get('DT2_ALLOW_TEST_WRITE_HEADER', False)
            and request.headers.get('X-DT2-Allow-Write') == 'test'):
        return None

    # **인증 실패가 503 보다 먼저 나와야 한다.**
    # 토큰이 잘못된 것을 "기능이 꺼져 있다" 로 답하면 클라이언트가 오진한다.
    # JWT·PAT 둘 다 받아야 하므로 데코레이터와 **같은 함수**를 쓴다(규칙 복제 금지).
    failed = authenticate()
    if failed is not None:
        return failed
    # 서명은 멀쩡한데 그 사용자가 없거나 비활성인 경우도 인증 실패로 본다.
    if _actor() is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    return error_response(
        'V2 쓰기 API 는 아직 활성화되지 않았습니다. 컷오버 전에는 V1 이 정본이며, '
        '여기에 쓴 값은 다음 저장 시 동기화로 덮어써집니다.',
        status_code=503)


@bp_v2.errorhandler(SQLAlchemyError)
def _v2_db_error(exc):
    """
    DB 계열 예외만 400 으로 바꾼다.

    보낸 값이 컬럼 타입·길이와 안 맞으면 DB 가 예외를 던진다. 그대로 두면 500 이 나가고
    트랜잭션이 열린 채 남는다. **입력이 잘못된 것을 서버 오류로 알리면 안 된다.**

    ⚠️ `Exception` 전체를 잡으면 안 된다. 인증 오류(flask_jwt_extended)까지 가로채
       "토큰이 잘못됐다" 가 "서버 오류" 로 둔갑한다. 실제로 그랬다(2026-07-29).
    """
    try:
        db.session.rollback()
    except Exception:
        pass
    import traceback
    print('[dt-v2] DB 오류 (입력 형식 문제로 처리):\n' + traceback.format_exc())
    return error_response(
        '보낸 값이 저장할 수 있는 형식이 아닙니다. 값의 타입과 길이를 확인하세요.',
        status_code=400)


# ─────────────────────────────────────────────────────────────────────────────
# 공통
# ─────────────────────────────────────────────────────────────────────────────

def _actor():
    """
    이번 요청의 주체. 없거나 비활성이면 None.

    **두 갈래로 들어온다** — 웹 화면은 JWT, MCP 등 외부 클라이언트는 PAT(`dtp_…`).
    PAT 은 데코레이터(`auth_required`)가 이미 해석해 `g` 에 담아 두므로 여기선 꺼내 쓴다
    (`@jwt_required()` 는 PAT 문자열을 JWT 로 파싱하려다 뷰에 닿기도 전에 401 을 낸다).
    """
    user = pat_user()
    if user is not None:
        return user if user.is_active else None

    try:
        uid = get_jwt_identity()
    except Exception:
        return None
    if uid is None:
        return None
    user = User.query.get(int(uid))
    if user is None or not user.is_active:
        return None
    return user


def _resolve_actors(caller: User, body: dict):
    """
    실제 권한을 판단할 주체를 정한다.

    MCP 는 서비스 계정으로 붙고 `on_behalf_of` 로 "누구를 대신해" 를 밝힌다.
    권한은 **대신하는 사람 기준**으로 판단한다. 서비스 계정 기준으로 보면
    서비스 계정에 admin 을 주는 순간 모든 제약이 사라지기 때문이다.

    ⚠️ 그런데 그것만으로는 부족하다. **누가 대리를 수행할 수 있는지**도 막아야 한다.
       (2026-07-29 경계 시험에서 발견) 이 검사가 없으면 아무 사용자나
       `on_behalf_of: <admin id>` 를 실어 보내 admin 권한을 얻는다. 실제로 뚫렸다.

       그래서 대리는 **admin / dt_office 만** 할 수 있다. MCP 서비스 계정이
       그 역할을 갖는다. 권한은 여전히 대신하는 사람 기준(더 좁은 쪽)으로 본다.

    반환: (권한 판단 대상, 실제 호출자, 대리 여부, 거부 사유)
          대상이 None 이면 거부 사유가 채워진다.
    """
    on_behalf_id = body.get('on_behalf_of')
    if not on_behalf_id:
        return caller, caller, False, None

    try:
        on_behalf_id = int(on_behalf_id)
    except (TypeError, ValueError):
        return None, caller, True, 'on_behalf_of 는 사용자 id 여야 합니다.'

    if on_behalf_id == caller.id:
        return caller, caller, False, None      # 자기 자신은 대리가 아니다

    if caller.role not in P.GLOBAL_EDIT_ROLES:
        return None, caller, True, (
            '다른 사용자를 대신해 수행할 권한이 없습니다. '
            '(on_behalf_of 는 관리자·사무국 계정만 사용할 수 있습니다)')

    target = User.query.get(on_behalf_id)
    if target is None or not target.is_active:
        return None, caller, True, 'on_behalf_of 로 지정한 사용자를 찾을 수 없거나 비활성입니다.'
    return target, caller, True, None


# 연결은 별도 테이블이라 대응하는 컬럼이 없다. 그래서 `PROJECT_COL_TO_KEY` 에 없고,
# 그대로 두면 변경 이력 화면에 `performance_links` 같은 영문 컬럼명이 그대로 나온다.
# 라벨을 **서버가** 준다 — 프론트에 표를 복제하면 field_maps 단일 출처 원칙이 깨진다.
VIRTUAL_FIELD_LABELS = {
    'performance_links': '성과 연결',
    'kpi_links': 'DX KPI 연결',
    'dependencies': '선행 과제 연결',
    # 컬럼은 있지만 `PROJECT_FIELD_MAP` 에 화면 키가 없어 컬럼명이 그대로 보이던 것들.
    '__created__': '과제 생성',
    'image_refs_json': '보고서 이미지',
}


def _expected_version(body):
    """
    expected_version 을 안전하게 읽는다. 없으면 (None, None).

    문자열이 오면 int() 가 ValueError 를 던져 500 이 나간다.
    **잘못된 입력을 서버 오류로 알리면 안 된다.** (2026-07-29 경계 시험)
    """
    raw = body.get('expected_version')
    if raw is None:
        return None, None
    try:
        return int(raw), None
    except (TypeError, ValueError):
        return None, 'expected_version 은 정수여야 합니다.'


def _to_columns(data: dict, field_map: dict):
    """
    화면이 보낸 키를 dt2 컬럼명으로 바꾼다 (한글·영어 둘 다 받는다).

    번역을 서버가 맡는 이유는 field_maps.py 머리말 참조 — 요약하면 맵을 프론트에
    복제하면 갈릴 자리가 하나 더 생기고, 이 프로젝트는 사본으로 세 번 물렸다.

    반환 (컬럼dict, origin, 에러응답 or None). 에러가 있으면 그대로 반환하면 된다.
    """
    cols, conflicts, origin = translate_keys(data, field_map)
    if conflicts:
        detail = '; '.join(f'{col} ← {", ".join(keys)}'
                           for col, keys in sorted(conflicts))
        return None, None, error_response(
            f'같은 항목을 두 가지 이름으로 함께 보냈습니다: {detail}',
            errors=sorted(col for col, _ in conflicts), status_code=400)
    return cols, origin, None


_COL_TO_KOREAN = {col: key for key, col in PROJECT_FIELD_MAP.items()}
# 성과는 표가 다르다 — 같은 컬럼명이라도 뜻이 다를 수 있어 섞어 쓰지 않는다
# (예: `title` 은 과제에서 '과제명', 성과에서 '성과항목').
_PERF_COL_TO_KOREAN = {col: key for key, col in PERFORMANCE_FIELD_MAP.items()}


def _korean_names(cols):
    """컬럼명을 화면이 쓰는 이름으로. 사람에게 보여줄 문구에만 쓴다."""
    return sorted(_COL_TO_KOREAN.get(c, c) for c in cols)


def _perf_korean_names(cols):
    """성과 컬럼명을 화면이 쓰는 이름으로."""
    return sorted(_PERF_COL_TO_KOREAN.get(c, c) for c in cols)


def _sent_names(names, origin: dict):
    """
    거부된 컬럼명을 **보낸 이름**으로 되돌려 보여준다.

    한글로 보냈는데 오류에 영문 컬럼명이 찍히면 어느 칸 얘긴지 알 수 없다.
    영어로 보냈으면 origin 이 항등이라 그대로 나온다.
    """
    return sorted(origin.get(n, n) for n in names)


def _people_preview(patch: dict) -> dict:
    """
    사람 필드의 확인 preview 를 **누구인지 알아볼 수 있게** 만든다.

    이게 이 기능의 핵심이다. 값을 그대로 보여주면 "홍길동 추가" 가 되는데,
    동명이인이 있는 조직에서 그건 사용자가 **아무것도 확인하지 못한 채 승인**하는
    것이다(참여인력을 AI 에게 막아 뒀던 원래 이유다). 그래서 knoxId 를 실제 계정과
    맞춰 보고 이름·knoxId·부서와 연결 여부를 같이 실어 보낸다.

    돌려주는 것: {필드키: [{이름, knoxId, 부서, 연결}, ...]}
    """
    keys = [k for k in (patch or {}) if k in P.AI_KNOX_REQUIRED_FIELDS]
    if not keys:
        return {}

    index = P.build_member_index()
    out = {}
    for key in keys:
        value = patch[key]
        elements = ([{'knoxId': value}] if key == 'pl_knox_id'
                    else (value if isinstance(value, list) else []))
        rows = []
        for el in elements:
            if not isinstance(el, dict):
                continue
            r = P.resolve_member(el, index)
            u = r['user']
            rows.append({
                '이름': u.name if u else (el.get('이름') or ''),
                'knoxId': (el.get('knoxId') or '').strip(),
                '부서': (getattr(u, 'department', '') or el.get('부서') or ''),
                # 계정이 없으면 지금은 권한이 안 생긴다. 가입하면 생긴다.
                '연결': '연결됨' if r['matched'] else '가입 대기(계정 없음)',
            })
        out[_COL_TO_KOREAN.get(key, key)] = rows
    return out


def _derive_people_copies(cols: dict, current=None) -> list:
    """
    `담당자`·`과제참여인력`·`담당부서` 를 **정본에서 파생**시킨다. 제자리에서 고친다.

    셋 다 화면이 만드는 **표시용 사본**이다(`formUtils.js` — "이전 버전과의 호환성을
    위한 데이터"). 정본은 `과제참여인력목록`(members_json)과 `담당부서목록`(depts_json).

    서버에 규칙이 없어서 갈라져 있었다 (2026-08-05 실측):
      · 담당자·과제참여인력  참여인력이 있는데도 110건 중 5건에만 채워져 있었다.
      · 담당부서            100건 중 44건이 **첫 부서만** 남은 낡은 값이었다.

    ⚠️ **정본이 이 patch 에 있을 때만 만든다** — `_derive_manager` 와 같은 조건이다.
       "지금 값이 어긋나면 항상 맞춘다" 로 했더니 **저장할 때마다 이 셋이 바뀌어서**
       ① `applied` 와 변경 이력이 매번 오염되고 ② 서로 다른 필드를 고친 두 사람이
       **자동 병합 대신 409** 로 부딪혔다(2026-08-05 회귀에서 잡음).
       이미 어긋나 있는 것은 일회성 backfill 로 맞춘다 — 저장 경로가 할 일이 아니다.
    """
    notes = []

    def _name(v):
        # 원소가 문자열일 때도 dict(`{'이름': ...}`)일 때도 있다 — 둘 다 받는다.
        if isinstance(v, dict):
            return str(v.get('이름') or v.get('name') or '').strip()
        return str(v or '').strip()

    if 'members_json' in cols:
        names = [n for n in (_name(m) for m in (cols['members_json'] or [])) if n]
        if list(getattr(current, 'owners_json', None) or []) != names:
            notes.append('담당자·과제참여인력을 참여인력 목록에서 다시 만들었습니다.')
        cols['owners_json'] = names
        cols['member_names'] = ', '.join(names)

    if 'depts_json' in cols:
        joined = ', '.join(n for n in (_name(d) for d in (cols['depts_json'] or [])) if n)
        if (getattr(current, 'dept_name', None) or '') != joined:
            notes.append('담당부서를 담당부서목록에서 다시 만들었습니다.')
        cols['dept_name'] = joined

    return notes


def _derive_manager(to_apply: dict) -> None:
    """
    `관리자`(manager_name)를 `과제PL`(pl_name)에서 파생시킨다. **제자리에서 고친다.**

    관리자는 독립된 값이 아니라 과제PL 의 사본이다 — 화면에 입력 칸이 없고,
    읽는 코드도 없다(2026-08-02 전수 확인: 코드 전체에서 이 필드를 읽는 곳이 없다).
    그런데 별도 필드로 노출돼 있어서 AI 는 이것만 따로 바꿀 수 있었고, 그렇게 바뀐
    값은 다음 저장 때 화면이 보내는 과제PL 로 조용히 덮였다.

    입력을 막는 것(IMMUTABLE)만으로는 부족하다 — 그러면 과제PL 을 바꿔도 관리자가
    옛 이름으로 남아 **갈라진 채 굳는다.** 그래서 쓰기 경로에서 서버가 맞춘다.
    이제 보내는 쪽은 아무도 관리자를 담지 않아도 된다(화면도 안 보낸다).
    """
    if 'pl_name' in to_apply:
        to_apply['manager_name'] = to_apply['pl_name']


# ─────────────────────────────────────────────────────────────────────────────
# 액션아이템 파생
#
# **액션아이템이 정본이다.** 진행상태는 진행률 계산에 관여하지 않는다.
# 액션아이템이 다 안 끝났는데 상태가 `완료` 거나 진행률이 100 인 것은 고쳐야 할
# 잘못된 데이터이지, 지켜야 할 값이 아니다.
#
# 이 계산은 원래 화면에만 있었다(ActionItemsSection·BasicInfoSection). 그래서
# 화면을 안 거치는 경로 — MCP·AI·API 직접 호출 — 로 세부항목을 완료로 바꾸면
# 상위 액션아이템도, 진행률도 따라오지 않았다. 진척 이력의 action_done 이
# 상위 완료여부만 세기 때문에(history_hash 참조) 이력에도 아무 흔적이 안 남았다.
# 그래서 서버로 옮긴다. 화면 계산은 이제 미리보기고, 정본은 여기다.
# ─────────────────────────────────────────────────────────────────────────────

# 아직 시작하지 않은 상태들 — 완료된 액션아이템이 있으면 모순이다.
NOT_STARTED_STATUSES = ('미착수', '계획', '미배정')


def _sub_items(item: dict) -> list:
    subs = item.get('세부항목목록')
    return subs if isinstance(subs, list) else []


def _last_completed_date(subs: list) -> str:
    """세부항목 중 마지막 완료일. 실제로 일이 끝난 날이다.

    저장 시점을 쓰면 백필할 때 실제와 다른 날짜가 박히고, 같은 데이터를 다시
    계산했을 때 값이 달라진다. 여기서 정하면 몇 번을 재계산해도 같은 값이 나온다.
    """
    dates = [str(s.get('완료일') or '').strip()
             for s in subs if isinstance(s, dict)]
    dates = [d for d in dates if d]
    return max(dates) if dates else ''


# 액션아이템의 **정체성**. `id` 와 다르다 — 자세한 것은 `_assign_action_uuids` 머리말.
ACTION_UUID_KEY = 'uuid'


def _action_uuid(item) -> str:
    if not isinstance(item, dict):
        return ''
    v = item.get(ACTION_UUID_KEY)
    return str(v).strip() if v not in (None, '') else ''


def _assign_action_uuids(items: list, previous=None) -> list:
    """
    액션아이템마다 **바뀌지 않는 정체성**(`uuid`)을 보장한다.

    왜 필요한가 — `id` 는 정체성이 아니라 순번이다
        화면은 저장할 때마다 모든 항목의 `id` 를 위치 순서로 다시 매긴다
        (`formUtils.processFormData` → `generateNextActionItemId`, 편집 저장에서는
        기존 목록을 빈 배열로 넘겨 항상 1..N 이 된다). 개발서버 실측: 항목이 2개
        이상인 과제 105개가 **전부** `1..N` 이었다.

        그래서 3개 중 **첫 번째**를 지우면 남은 둘의 id 가 1,2 로 당겨지고,
        id 로 비교하는 활동 로그는 "3번이 사라졌다" 고 본다 — **엉뚱한 항목이
        삭제됐다고 기록된다.** 마지막 것을 지울 때만 맞는다.
        지식 그래프에서는 더 나쁘다. 노드 id 가 저장 한 번에 다른 항목으로 옮겨 붙는다.

    `id` 는 **그대로 둔다.** 지우면 화면의 React key 와 기존 비교 코드가 같이 깨진다.
    새 키를 더하고, 참조하는 쪽을 하나씩 옮긴다.

    ── 이관 중 안전장치 (`previous`) ────────────────────────────────────────
    uuid 가 없는 항목이 오면 **먼저 기존 행에서 물려받고**, 없을 때만 새로 만든다.
    안 그러면 백필 전에 편집창을 열어 둔 사람이 저장하는 순간 새 uuid 가 발급돼
    방금 채운 값이 날아간다. 물려받는 순서:

        ① 제목이 같은 기존 항목의 uuid   (첫 번째 것부터 하나씩 소진)
        ② 같은 자리(index)의 기존 항목의 uuid
        ③ 새로 만든다

    ①이 ②보다 먼저인 이유: 옛 화면이 첫 항목을 지우고 저장하면 자리는 전부 밀리지만
    제목은 그대로다. 자리부터 보면 그 상황에서 uuid 가 통째로 한 칸씩 어긋난다.

    한 uuid 가 두 항목에 붙는 일은 없다 — 이미 쓴 것은 `used` 로 막는다.
    """
    if not isinstance(items, list):
        return []

    used = set()
    out = []
    # 들어온 값이 이미 uuid 를 들고 있으면 그대로 존중한다. 단 중복은 뒤엣것을 비운다
    # (같은 uuid 를 가진 항목이 둘이면 어느 쪽이 진짜인지 알 수 없다).
    for it in items:
        u = _action_uuid(it)
        if u and u not in used:
            used.add(u)
            out.append(u)
        else:
            out.append('')

    prev = previous if isinstance(previous, list) else []
    by_title = {}
    for pit in prev:
        pu = _action_uuid(pit)
        if not pu or pu in used:
            continue
        by_title.setdefault(str(pit.get('제목') or '').strip(), []).append(pu)
    by_index = [_action_uuid(pit) for pit in prev]

    result = []
    for idx, it in enumerate(items):
        if not isinstance(it, dict):
            result.append(it)
            continue
        u = out[idx]
        if not u:
            pool = by_title.get(str(it.get('제목') or '').strip())
            while pool and not u:
                cand = pool.pop(0)
                if cand not in used:
                    u = cand
            if not u and idx < len(by_index):
                cand = by_index[idx]
                if cand and cand not in used:
                    u = cand
            if not u:
                u = str(uuidlib.uuid4())
        used.add(u)
        it = dict(it)
        it[ACTION_UUID_KEY] = u
        result.append(it)
    return result


def normalize_action_items(items, previous=None) -> list:
    """상위 액션아이템의 완료여부·완료일을 세부항목에서 파생시키고, 정체성을 보장한다.

    세부항목이 없는 액션아이템은 그 자신의 표시가 정본이라 손대지 않는다.

    ⚠️ **세부항목(`세부항목목록`)에는 아직 uuid 를 안 준다.** 지금은 그것을 가리키는
       데이터가 없고(운영·개발 모두 0건), 노드가 되는 것은 상위 액션아이템이다.
       필요해지면 같은 방식으로 한 겹 더 내려가면 된다.
    """
    if not isinstance(items, list):
        return []
    items = _assign_action_uuids(items, previous)
    out = []
    for it in items:
        if not isinstance(it, dict):
            out.append(it)
            continue
        subs = _sub_items(it)
        if not subs:
            out.append(it)
            continue
        it = dict(it)
        done = all(bool(s.get('완료여부')) for s in subs if isinstance(s, dict))
        it['완료여부'] = done
        if done:
            # 세부항목에 날짜가 하나도 없으면 이미 들어 있던 완료일을 지우지 않는다.
            # 아는 것이 없다고 아는 것을 버릴 이유는 없다.
            last = _last_completed_date(subs)
            if last:
                it['완료일'] = last
        else:
            it['완료일'] = ''
        out.append(it)
    return out


def derive_progress(items, status=None) -> int:
    """액션아이템 균등 기여 × 세부항목 완료 비율.

    반올림은 **ROUND_HALF_UP** 이다. 파이썬 기본 `round()` 는 은행가 반올림이라
    `round(12.5) == 12` 로, 화면의 `Math.round`(13)와 갈린다.

    **액션아이템이 0건이면 진행상태를 따른다** — `완료` 면 100, 아니면 0.
    (2026-08-11 사용자 확정. 그전에는 무조건 0 이었다)

        왜 여기서만 상태를 보나
            액션아이템이 정본이라는 원칙은 그대로다. 다만 **0건이면 파생할 재료가
            아예 없다.** 재료가 없을 때까지 0 을 고집하면 "완료했는데 진행률 0%" 가
            되고, 화면(`BasicInfoSection` 의 진행상태 변경)은 100 을 넣으므로
            **화면과 서버가 갈린다.** 그 갈림이 진척 이력에 그대로 쌓인다.

        ⚠️ 1건이라도 있으면 상태를 보지 않는다. 그때는 액션아이템이 답을 갖고 있고,
           모순은 `_status_conflict` 가 400 으로 잡는다.
    """
    if not isinstance(items, list) or not items:
        return 100 if (status or '').strip() == '완료' else 0
    per = Decimal(100) / Decimal(len(items))
    total = Decimal(0)
    for it in items:
        if not isinstance(it, dict):
            continue
        subs = [s for s in _sub_items(it) if isinstance(s, dict)]
        if subs:
            done = sum(1 for s in subs if s.get('완료여부'))
            total += per * Decimal(done) / Decimal(len(subs))
        elif bool(it.get('완료여부')):
            total += per
    return int(total.quantize(Decimal('1'), rounding=ROUND_HALF_UP))


_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')

# 상세정보 7개 섹션과 그 한계(39자·항목 수)는 **`detail_rules.py` 가 정본**이다.
# AI 폼 도우미도 같은 판정을 해야 해서 밖으로 뺐다 — 여기 복사해 두면 두 곳이 갈리고,
# 갈리면 "화면은 넣었다는데 저장이 400" 이 된다.
_DETAIL_SECTION_COLS = DR.DETAIL_SECTION_COLS
_detail_section_errors = DR.detail_section_errors

# 보고서 이미지 슬롯의 **뒷부분**(`이미지_개요그림` → `개요그림`).
# 화면이 이 값을 슬롯 키로 쓰므로(`이미지_<값>`), 여기 없는 값이 저장되면 그 과제의
# 이미지는 저장도 표시도 안 된다. `IMAGE_SLOTS` 에서 만들어 **둘이 어긋날 수 없게** 한다.
IMAGE_CATEGORY_KEYS = frozenset(
    s[len('이미지_'):] for s in IMAGE_SLOTS if s not in ('이미지_좌측', '이미지_우측'))

# 성과의 '여부 플래그 + 본문' 짝. 본문만 넣고 플래그를 빠뜨리면 화면이 안 읽는다.
# (본문 컬럼, 플래그 컬럼, 한글 이름)
#
# ⚠️ `디지털트윈기여도` 는 **일부러 뺐다.** 화면 폼의 기본값이
#    `디지털트윈기여도여부: false` + `디지털트윈기여도: '100'` 이라
#    **값이 있는 것이 곧 '쓰겠다' 는 뜻이 아니다** — '100' 은 자리만 채운 값이다.
#    여기 넣으면 안 쓸 성과의 기여도가 켜진다(2026-08-03 실측으로 확인).
#    나머지 둘은 기본값이 각각 `null`·빈 문자열 배열이라 '값이 있으면 쓰려는 것' 이 맞다.
_PERF_FLAG_PAIRS = (
    ('monthly_values_json', 'is_monthly', '월별실적'),
    ('calc_logic_json', 'has_calc_logic', '계산로직'),
)


def _ai_assisted_cols(body) -> set:
    """본문의 `ai_assisted` → 컬럼 집합. **AI 폼 도우미가 채운 칸**을 이력에 가르려는 것.

    화면이 한글 키(`과제명`)로 보내므로 여기서 컬럼으로 옮긴다. 모르는 이름은
    **조용히 버린다** — 이건 표시용 표식이라, 오타 하나로 저장 자체를 막을 이유가 없다.
    (값 자체는 `patch` 로 따로 오고 그쪽은 평소대로 엄격하게 검사된다.)
    """
    names = body.get('ai_assisted')
    if not isinstance(names, list):
        return set()
    out = set()
    for name in names[:100]:
        key = str(name or '').strip()
        if not key:
            continue
        col = PROJECT_FIELD_MAP.get(key)
        if col:
            out.add(col)
        elif key in _COL_TO_KOREAN:      # 컬럼명으로 보내와도 받아 준다
            out.add(key)
    return out


def _fill_author_knox(patch: dict, sent_keys):
    """
    `작성자` 이름만 오고 `작성자_knoxId` 가 없으면 **이름으로 계정을 찾아 채운다.**

    화면은 knoxId 가 비면 작성자를 **'연결 안 됨'** 으로 표시한다
    (ResponsibleInfoSection `OwnerLinkBadge`). 그런데 작성자는 `과제PL`·`참여인력`
    과 달리 knoxId 필수 검사 대상이 아니라, 이름만 보내면 **조용히 통과하고
    화면에서만 끊겨 보인다.** 실제로 2026-08-03 에 과제 100건이 그렇게 만들어졌다.

    ⚠️ **이름이 활성 사용자 중 유일할 때만** 채운다(`build_member_index` 규칙).
       동명이인이면 누구인지 알 수 없으므로 손대지 않는다 — 작성자는 표시 전용이라
       권한이 열리진 않지만, 그렇다고 엉뚱한 계정을 붙일 이유는 없다.
    """
    if 'author_name' not in patch or 'author_knox_id' in sent_keys:
        return patch, None
    name = (patch.get('author_name') or '').strip()
    if not name or patch.get('author_knox_id'):
        return patch, None

    _by_local, by_name = P.build_member_index()
    u = by_name.get(name)
    if u is None or not u.email or '@' not in u.email:
        return patch, (f'작성자 `{name}` 를 계정과 잇지 못했습니다 — 화면에 '
                       "'연결 안 됨' 으로 보입니다. 동명이인이거나 아직 가입 전일 "
                       '수 있으니 `작성자_knoxId` 를 직접 넣으세요.')

    out = dict(patch)
    out['author_knox_id'] = u.email.split('@')[0].strip()
    return out, (f'작성자 `{name}` 의 knoxId 를 `{out["author_knox_id"]}` 로 '
                 '채웠습니다(이름이 유일해 계정을 특정했습니다).')


def _has_content(v):
    """
    본문이 **실제로** 들어 있나.

    길이만 보면 안 된다 — 화면은 `월별실적` 을 `Array(12).fill('')` 로,
    즉 **빈 문자열 12개**로 보낸다. 길이 기준이면 '내용 있음' 이 되어
    쓰지도 않을 월별실적 표시가 켜진다(2026-08-03 실측).
    그래서 **안이 전부 비어 있으면 없는 것으로 본다.**
    """
    if v is None:
        return False
    if isinstance(v, str):
        return v.strip() != ''
    if isinstance(v, dict):
        return any(_has_content(x) for x in v.values())
    if isinstance(v, list):
        return any(_has_content(x) for x in v)
    return True


def _fill_visibility_flags(patch: dict, sent_keys) -> tuple[dict, list]:
    """
    **내용을 넣었으면 보이게 한다.**

    두 군데 함정이 같은 모양이다 —
      · 상세정보 섹션의 `enabled`
      · 성과의 `월별실적여부`·`로직입력여부`·`디지털트윈기여도여부`
    본문만 넣고 플래그를 빠뜨리면 **저장은 되고 화면에서만 안 보인다.**
    `applied` 에도 성공으로 잡히고 `ignored` 에도 안 뜨니 부르는 쪽은 끝까지 모른다.

    그래서 본문이 있는데 플래그가 **안 왔으면** 켜 준다.
    **명시적으로 false 를 보낸 것은 존중한다** — 숨기려는 의도일 수 있다.
    무엇을 켰는지는 응답으로 알린다.
    """
    notes = []
    out = dict(patch)

    for col in _DETAIL_SECTION_COLS:
        v = out.get(col)
        if not isinstance(v, dict):
            continue
        if 'enabled' in v:
            continue                       # 보낸 값을 존중한다(false 포함)
        if not _has_content(v.get('items')):
            continue
        out[col] = {**v, 'enabled': True}
        notes.append(f'{_COL_TO_KOREAN.get(col, col)}: enabled 를 true 로 채웠습니다')

    for body_col, flag_col, label in _PERF_FLAG_PAIRS:
        if body_col not in out or flag_col in sent_keys:
            continue                       # 플래그를 보냈으면 그 값을 쓴다
        if not _has_content(out.get(body_col)):
            continue
        if out.get(flag_col) is True:
            continue
        out[flag_col] = True
        notes.append(f'{label} 을(를) 넣어 관련 표시 여부를 켰습니다')

    return out, notes


def normalize_issues(items) -> list:
    """
    이슈의 해결여부·해결일을 맞춘다. 액션아이템(`normalize_action_items`)과 같은 규칙.

    미해결인데 해결일이 남아 있으면 화면은 "안 끝났는데 끝난 날짜가 있는" 상태로
    보인다. 같은 자료구조에 같은 규칙을 적용해 두 곳이 갈라지지 않게 한다.
    """
    if not isinstance(items, list):
        return []
    out = []
    for it in items:
        if not isinstance(it, dict):
            out.append(it)
            continue
        it = dict(it)
        if not bool(it.get('해결여부')):
            it['해결일'] = ''
        out.append(it)
    return out


def _bad_dates(items, fields, label):
    """`YYYY-MM-DD` 가 아닌 날짜를 찾아 사람이 읽을 수 있게 돌려준다.

    빈 문자열은 **미완료·미해결 표시**라 정상이다(액션아이템 규칙과 같다).
    """
    bad = []
    for i, it in enumerate(items or []):
        if not isinstance(it, dict):
            continue
        for f in fields:
            v = it.get(f)
            if v in (None, ''):
                continue
            if not _DATE_RE.match(str(v)):
                bad.append(f'{label}[{i}].{f}={v!r}')
        for j, s in enumerate(_sub_items(it)):
            if not isinstance(s, dict):
                continue
            for f in ('완료일',):
                v = s.get(f)
                if v in (None, ''):
                    continue
                if not _DATE_RE.match(str(v)):
                    bad.append(f'{label}[{i}].세부항목[{j}].{f}={v!r}')
    return bad


def _validate_shapes(patch: dict, origin: dict):
    """
    **저장은 되는데 화면에서 어긋나는** 값을 만들기 전에 잡는다.

    JSONB 라 서버는 무엇이든 받는다. 그래서 여기서 보지 않으면 `applied` 로 성공이
    돌아가고 화면에서만 이상해진다 — `ignored` 도 안 뜨므로 부르는 쪽은 끝까지 모른다.

    · 시작/종료   월 번호(1~12)다. 범위 밖과 역전을 거절한다.
    · 날짜        `YYYY-MM-DD` 만. 빈 문자열은 미완료 표시라 허용.
    · 월간진척    키는 월 번호 문자열 "1"~"12". 날짜나 13월은 화면이 못 읽는다.
    """
    errs = []

    s, e = patch.get('start_month'), patch.get('end_month')
    for key, v in (('시작', s), ('종료', e)):
        if v is None:
            continue
        try:
            iv = int(v)
        except (TypeError, ValueError):
            errs.append(f'{key} 는 1~12 사이의 월 번호여야 합니다 (받은 값 {v!r})')
            continue
        if not 1 <= iv <= 12:
            errs.append(f'{key} 는 1~12 사이의 월 번호여야 합니다 (받은 값 {iv})')
    try:
        if s is not None and e is not None and 1 <= int(s) <= 12 and 1 <= int(e) <= 12 \
                and int(s) > int(e):
            errs.append(f'시작({s})이 종료({e})보다 뒤입니다. '
                        '월 번호는 같은 해 안에서만 씁니다.')
    except (TypeError, ValueError):
        pass

    if 'action_items_json' in patch:
        errs += _bad_dates(patch['action_items_json'], ('목표일', '완료일'), '액션아이템')
    if 'issues_json' in patch:
        errs += _bad_dates(patch['issues_json'], ('등록일', '해결일'), '이슈')

    mp = patch.get('monthly_progress_json')
    if isinstance(mp, dict):
        bad = [k for k in mp if not (str(k).isdigit() and 1 <= int(k) <= 12)]
        if bad:
            errs.append('월간진척현황의 키는 월 번호 문자열 "1"~"12" 입니다 '
                        f'(잘못된 키: {", ".join(map(repr, sorted(bad)))})')

    # 상세정보 — 한 줄 길이와 항목 수. 넘으면 저장은 되고 **화면에서 잘린다.**
    for col in _DETAIL_SECTION_COLS:
        if col in patch:
            errs += _detail_section_errors(col, patch[col])

    # 이미지 그룹 카테고리 — **슬롯 이름이지 자유 텍스트가 아니다.**
    #
    # 🐞 2026-08-08: 시드 스크립트가 여기에 `방사 패턴`·`모델 구조` 같은 **그림 제목**을
    #    넣었다(개발 100건). 화면은 이 값을 `이미지_<값>` 슬롯 키로 쓰기 때문에,
    #    그런 과제에서는 이미지를 올려도 **저장이 조용히 사라졌다** — 저장·조립 양쪽이
    #    정해진 슬롯 5개만 알기 때문이다. 서버가 값을 안 보고 받아 준 것이 근본 원인이라
    #    여기서 막는다(화면만 고치면 API·스크립트로 또 들어온다).
    for col in ('image_group1_category', 'image_group2_category'):
        v = str(patch.get(col) or '').strip()
        if v and v not in IMAGE_CATEGORY_KEYS:
            errs.append(f'{_COL_TO_KOREAN.get(col, col)} 는 그림 슬롯 이름이어야 합니다 '
                        f'(받은 값 {v!r}) — 쓸 수 있는 값: '
                        f'{", ".join(sorted(IMAGE_CATEGORY_KEYS))}. '
                        '그림에 붙일 설명은 이미지의 caption 에 씁니다.')

    # 이슈 — 해결일이 등록일보다 앞설 수는 없다.
    # (액션아이템의 완료일 > 목표일은 **지연 완료**라 정상이므로 보지 않는다.)
    for i, it in enumerate(patch.get('issues_json') or []):
        if not isinstance(it, dict):
            continue
        reg, res = it.get('등록일'), it.get('해결일')
        if reg and res and _DATE_RE.match(str(reg)) and _DATE_RE.match(str(res)) \
                and str(res) < str(reg):
            errs.append(f'이슈[{i}]: 해결일({res})이 등록일({reg})보다 앞섭니다')

    if errs:
        return error_response(
            '화면이 읽을 수 없는 형식이 있습니다: ' + ' / '.join(errs),
            errors=errs, status_code=400)
    return None


def _stored_action_items(p) -> list:
    """지금 DB 에 있는 액션아이템. uuid 를 물려받는 데 쓴다(신규 생성이면 빈 목록)."""
    stored = getattr(p, 'action_items_json', None) if p is not None else None
    return stored if isinstance(stored, list) else []


def _derive_action_items(patch: dict, previous=None, status=None) -> dict:
    """
    JSON 목록의 파생값을 맞춘다.

    · 액션아이템 — 상위 완료여부·완료일을 세부항목에서, 진행률을 액션아이템에서
                   그리고 **정체성(`uuid`)** 을 보장한다
    · 이슈       — 미해결이면 해결일을 비운다 (액션아이템과 같은 규칙)

    이름은 액션아이템만 가리키지만 호출부가 여럿이라 그대로 둔다. 이슈도 **같은
    지점에서** 맞춰야 한 쪽만 정규화되는 일이 안 생긴다.

    `previous` 는 **저장 전 DB 의 액션아이템**이다. uuid 없이 들어온 항목이 기존 uuid 를
    물려받게 하려는 것 — 안 주면 옛 화면이 저장할 때마다 uuid 가 새로 발급된다.

    `status` 는 **이 저장이 끝난 뒤의 진행상태**다. 액션아이템이 0건일 때만 쓴다
    (`derive_progress` 참조).
    """
    if 'action_items_json' in patch:
        items = normalize_action_items(patch.get('action_items_json'), previous)
        patch = dict(patch)
        patch['action_items_json'] = items
        patch['progress'] = derive_progress(items, status)
    elif (patch.get('status') == '완료' and 'progress' not in patch
          and not (previous or [])):
        # 액션아이템은 안 실렸는데 **진행상태만 `완료` 로** 바뀐 저장(AI·MCP 경로).
        # 화면은 폼 전체를 보내므로 위 갈래에서 처리되고, 여기는 그 밖의 경로다.
        #
        # ⚠️ **올리기만 한다. 내리지 않는다.** 조건을 `'status' in patch` 로 넓히면
        #    상태만 바꾸는 저장이 진행률을 0 으로 지운다 — 액션아이템이 0 건인 과제의
        #    진행률은 **사람이 직접 넣은 값이 유일한 근거**라 파생이 이기면 안 된다.
        #    실제로 두 번 걸렸다:
        #      · `{진행률: 55, 진행상태: '정상진행'}` → 55 가 0 으로 (dt3_test_koreankeys)
        #      · 상태만 바꾸는 제안을 승인 → progress 까지 0 으로 (dt3_test_proposals)
        patch = dict(patch)
        patch['progress'] = derive_progress([], status)
    if 'issues_json' in patch:
        patch = dict(patch)
        patch['issues_json'] = normalize_issues(patch.get('issues_json'))
    return patch


def _effective_action_items(p, patch: dict) -> list:
    """이 저장이 끝난 뒤의 액션아이템. `p` 는 신규 생성이면 None 이다."""
    previous = _stored_action_items(p)
    if 'action_items_json' in patch:
        return normalize_action_items(patch.get('action_items_json'), previous)
    # 저장에 안 실린 경우 — 이미 있는 것을 그대로 본다. 자기 자신을 `previous` 로 주어
    # 이미 붙어 있는 uuid 가 유지되게 한다(여기서 새로 만들면 읽기가 값을 바꾼다).
    return normalize_action_items(previous, previous)


def _status_conflict(p, patch: dict) -> str | None:
    """진행상태와 액션아이템이 모순이면 그 이유를 돌려준다. 아니면 None.

    서버가 진행상태를 **자동으로 바꾸지는 않는다.** 진행상태는 핵심 필드라
    AI 가 고치면 확인 대기를 거치는데, 서버가 파생으로 몰래 바꾸면 그 단계를
    통째로 우회하게 된다. 그래서 값은 파생시키고 상태는 검증만 한다.
    """
    status = patch.get('status', getattr(p, 'status', None))
    items = _effective_action_items(p, patch)
    done = [bool(it.get('완료여부')) for it in items if isinstance(it, dict)]
    if not done:
        # 액션아이템이 없으면 어긋날 것도 없다.
        return None
    if status == '완료' and not all(done):
        return (f'진행상태를 `완료` 로 두려면 액션아이템이 모두 완료여야 합니다 '
                f'(지금 {sum(done)}/{len(done)}건). 액션아이템이 정본입니다 — '
                '남은 액션아이템을 완료로 바꾸거나 진행상태를 그대로 두세요.')
    if status in NOT_STARTED_STATUSES and any(done):
        return (f'진행상태가 `{status}` 인데 완료된 액션아이템이 {sum(done)}건 '
                '있습니다. 일이 시작된 것이라면 `진행상태` 를 `정상진행` 으로 '
                '**같이 보내세요**(핵심 필드라 확인을 거쳐 액션아이템과 함께 '
                '반영됩니다). 아니라면 액션아이템의 완료 표시를 푸세요.')
    return None


def _project_summary(p: Dt2Project):
    return {
        'uuid': p.uuid, 'code': p.code, 'title': p.title,
        'division': p.division, 'divisionId': p.division_id,
        'status': p.status, 'progress': p.progress,
        'year': p.year, 'startMonth': p.start_month, 'endMonth': p.end_month,
        'plName': p.pl_name, 'ownerUserId': p.owner_user_id,
        'rowVersion': p.row_version,
        'isDeleted': p.is_deleted,
    }


def _project_detail(p: Dt2Project):
    d = _project_summary(p)
    d.update({
        'process': p.process, 'domain': p.domain, 'category': p.category,
        'description': p.description,
        'isPoc': p.is_poc, 'isKey': p.is_key,
        'isDivisionPublic': p.is_division_public,
        'authorName': p.author_name, 'managerName': p.manager_name,
        # 계정 연결 knoxId. 이름과 짝이지만 뜻이 다르다 — 이쪽이 실제 계정이고,
        # plKnoxId 는 편집 권한의 근거다(is_project_pl).
        'plKnoxId': p.pl_knox_id, 'authorKnoxId': p.author_knox_id,
        'actionItems': p.action_items_json or [],
        'issues': p.issues_json or [],
        'monthlyProgress': p.monthly_progress_json or {},
        'owners': p.owners_json or [],
        'depts': p.depts_json or [],
        'members': p.members_json or [],
        'imageRefs': p.image_refs_json or {},
        # 상세과제정보(보고서 본문). **쓸 수 있으면 읽을 수도 있어야 한다** —
        # 여기 빠져 있던 동안 AI 는 PATCH 로 값을 넣고도 되읽어 확인할 방법이 없었고,
        # 형태가 틀린 채로 저장돼도(`{enabled, items}` 가 아닌 맨 배열 등) 화면에서
        # 통째로 안 보일 뿐 `applied` 는 성공으로 돌아와 아무도 알아채지 못했다.
        #
        # 빈 값은 `{}` 가 아니라 **None** 으로 낸다. `{}` 는 `enabled` 도 `items` 도 없는
        # **깨진 섹션 객체**라, 안 채운 것과 잘못 채운 것을 구분할 수 없게 만든다.
        'detailOverview': p.detail_overview_json,
        'detailBackground': p.detail_background_json,
        'detailGoal': p.detail_goal_json,
        'detailContent': p.detail_content_json,
        'detailResult': p.detail_result_json,
        'detailOutput': p.detail_output_json,
        'detailPlan': p.detail_plan_json,
        'detailCompleted': bool(p.detail_completed),
        'imageGroup1Category': p.image_group1_category,
        'imageGroup2Category': p.image_group2_category,
        'createdAt': iso_kst(p.created_at) if p.created_at else None,
        'updatedAt': iso_kst(p.updated_at) if p.updated_at else None,
    })
    return d


# ─────────────────────────────────────────────────────────────────────────────
# 읽기 — V1 호환 (Phase 2-4)
# ─────────────────────────────────────────────────────────────────────────────

def _row_version_map():
    """
    낙관적 락에 쓸 행 버전. **과제·성과 객체 안에 넣지 않고 따로 내려준다.**

    객체 안에 넣으면 화면이 그대로 들고 다니다가 V1 으로 물러설 때 그 값이
    `dashboard_data` JSON 에 섞이고, PATCH 본문에도 딸려 들어가 `ignored` 잡음이 된다.
    별도 맵이면 원본 모양이 조금도 안 바뀐다 — `?rowVersions=1` 일 때만 붙는다.
    """
    return {
        'projects': {uuid: rv for uuid, rv in
                     db.session.query(Dt2Project.uuid, Dt2Project.row_version)},
        'performances': {uuid: rv for uuid, rv in
                         db.session.query(Dt2Performance.uuid, Dt2Performance.row_version)},
    }


def _wants_row_versions():
    return (request.args.get('rowVersions') or '').lower() in ('1', 'true', 'yes')


# 활동로그에서 '수정' 으로 볼 액션. DOWNLOAD 를 넣으면 **조회한 사람이 수정한 사람으로**
# 표시된다 — 화면 진입마다 로그가 쌓이므로 사실상 항상 마지막이 된다.
_MODIFY_ACTIONS = ('CREATE', 'UPDATE', 'DELETE')


def _last_touch():
    """
    "마지막으로 누가 언제 고쳤나" 를 **실제 데이터에서 파생**한다. `(시각, 이름)`.

    왜 파생하나
        V1 은 이 두 값이 `dashboard_data` 한 행에 적혀 있었다 — 모든 저장이 그 행을
        통째로 다시 썼으니 거기 적힌 게 곧 답이었다. **컷오버 후에는 아무도 그 행을
        쓰지 않는다.** 그대로 두면 화면이 "마지막 수정: 컷오버한 날, 아무개" 를
        영원히 보여준다. 셋 중 이 둘만 **사용자 눈에 보이는 거짓말**이 된다.
        (`version` 은 화면에 안 보여서 여기서 다루지 않는다 — 별건)

    시각
        `dt2_projects` · `dt2_performances` 의 `updated_at` 최댓값.
        의미가 V1 과 미묘하게 다르다 — V1 은 "싱글톤 행이 쓰인 시각" 이라 설정 저장·
        수동 업로드까지 포함했다. 이쪽은 "과제·성과가 마지막으로 바뀐 시각" 이다.
        화면 표시 용도로는 오히려 이쪽이 정확하다.

    사람 — **두 곳을 같이 보고 더 최근 것을 쓴다.** 한쪽만 보면 구멍이 남는다.
        `dashboard_activity_logs`  컷오버 전부터 계속 쌓인다. `user_name` 이 문자열로
                                   박혀 있어 계정이 지워져도 이름이 남는다(V1 과 같은
                                   성질). 단 **화면이 고른 19종 필드**가 바뀔 때만
                                   남아서, 진행률만 고치면 안 남는다.
        `dt2_project_changes`      컷오버 후 API 쓰기마다 **실제로 바뀐 필드 전부**를
                                   자동 기록한다. 위 19종 밖도 잡힌다. 대신 배치 이관
                                   (`dt2_import`)은 이 테이블을 안 쓰므로 **컷오버
                                   전에는 비어 있다.**
        둘을 합치면 컷오버 전후가 안 끊기고, 컷오버 후에는 19종 한계도 저절로 없어진다.

    ⚠️ 정렬을 `id DESC` 로 한다. 두 테이블 다 append-only 라 id 순서 = 시간 순서이고,
       PK 인덱스를 그대로 타서 **인덱스를 새로 만들 필요가 없다.** `created_at` 으로
       정렬하면 인덱스가 없어 활동로그가 커질수록 느려진다(화면 진입마다 부르는 경로다).
    """
    touched_at = None
    for col in (Dt2Project.updated_at, Dt2Performance.updated_at):
        value = db.session.query(func.max(col)).scalar()
        if value is not None and (touched_at is None or value > touched_at):
            touched_at = value

    touched_by = None
    seen_at = None

    log = (DashboardActivityLog.query
           .filter(DashboardActivityLog.action.in_(_MODIFY_ACTIONS))
           .order_by(DashboardActivityLog.id.desc())
           .first())
    if log is not None and log.user_name:
        touched_by, seen_at = log.user_name, log.created_at

    change = (db.session.query(User.name, Dt2ProjectChange.created_at)
              .select_from(Dt2ProjectChange)
              .join(User, User.id == Dt2ProjectChange.actor_user_id)
              .order_by(Dt2ProjectChange.id.desc())
              .first())
    if change is not None and change[0]:
        # 둘 다 BaseModel 의 naive UTC 라 그대로 비교해도 된다
        # (SQL now() 는 KST 라 섞으면 9시간 어긋난다 — history.py 주석 참조)
        if seen_at is None or (change[1] is not None and change[1] > seen_at):
            touched_by = change[0]

    return touched_at, touched_by


@bp_v2.route('/data', methods=['GET'])
@auth_required
def get_data_v1_shape():
    """
    dt2_* 를 조립해 **V1 `/data` 와 같은 형태**로 돌려준다.

    화면은 URL 만 바꾸면 되고 응답 처리 코드는 그대로다.
    `version` 과 메타데이터는 아직 V1 싱글톤에서 가져온다 — 컷오버 전까지
    정본은 V1 이고, 화면의 충돌 감지(버전 비교)가 V1 기준으로 돌아야 한다.
    `updated_at` · `last_modified_by_name` 만 예외로 **dt2 에서 파생**한다
    (`_last_touch` 참조 — 컷오버 후 그 둘이 얼어붙어 거짓이 되기 때문).

    ⚠️ `linkedProjects` 는 담지 않는다. 저장돼 있던 파생 캐시이고
       화면이 전부 직접 계산한다. 자세한 이유는 assemble.py 주석 참조.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    assembled = assemble_data()

    head = DashboardData.query.first()
    touched_at, touched_by = _last_touch()
    payload = {
        'version': head.version if head else 0,
        'projects': assembled['projects'],
        'performances': assembled['performances'],
        # metadata 는 module_settings 에서 온다 — 컷오버 후 dashboard_data 가
        # 없어져도 이 응답은 그대로 성립해야 한다.
        'metadata': _meta_payload((_meta_row().settings_data if _meta_row() else {})
                                  or (head.data_metadata if head else {})),
        'last_modified_by_name': touched_by,
        'updated_at': iso_kst(touched_at) if touched_at else None,
        'source': 'v2',        # 화면·검증에서 어느 쪽을 읽었는지 구분하려고 붙인다
    }
    # 기본 응답은 건드리지 않는다 — dt2_compare_api 가 V1 과 1:1 로 대조하는 형태다.
    if _wants_row_versions():
        payload['rowVersions'] = _row_version_map()
    return success_response(payload)


@bp_v2.route('/data/download', methods=['GET'])
@auth_required
def download_data_v1_shape():
    """
    V1 `/data/download` 대응.

    화면 본체가 부르는 건 `/data` 가 아니라 **이쪽**이다(`downloadServerData`).
    페이로드는 `/data` 와 완전히 같고, 다운로드 활동 로그를 추가로 남긴다.
    V2 로 옮기면서 그 로그가 끊기면 "누가 언제 데이터를 받아갔나" 를 잃는다.

    ⚠️ 대조 스크립트(dt2_compare_api.py)는 이 경로가 아니라 `/data` 를 쓴다.
       여기는 호출할 때마다 로그를 쓰기 때문이다. 조립 함수가 같으므로
       `/data` 가 같으면 이쪽도 같다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    # ⚠️ 예전엔 여기서 head 가 없으면 404 로 끊었다. 그런데 **화면 본체가 부르는 게
    #    이 경로다** — dt2 에 데이터가 멀쩡한데 V1 싱글톤 행만 지우면 화면이 통째로
    #    비어 버린다. V1 은퇴의 마지막 단계가 그 행을 지우는 것이므로, 그때 터진다.
    #    `/data` 는 이미 `if head else` 로 전부 방어돼 있었고 여기만 안 돼 있었다.
    head = DashboardData.query.first()
    version = head.version if head else 0

    assembled = assemble_data()

    db.session.add(DashboardActivityLog(
        action='DOWNLOAD',
        target_type='DATA',
        target_name=f'v{version} 다운로드',
        summary=(f'{actor.name}이(가) 서버에서 데이터를 불러옴 '
                 f'(v{version}, 과제 {len(assembled["projects"])}개, '
                 f'성과 {len(assembled["performances"])}개) [V2]'),
        changes={
            'version': version,
            'projectCount': len(assembled['projects']),
            'performanceCount': len(assembled['performances']),
            'source': 'v2',
        },
        user_id=actor.id,
        user_name=actor.name,
        data_version=version,
        source='server',
    ))
    db.session.commit()

    touched_at, touched_by = _last_touch()
    payload = {
        'version': version,
        'projects': assembled['projects'],
        'performances': assembled['performances'],
        'metadata': _meta_payload((_meta_row().settings_data if _meta_row() else {})
                                  or (head.data_metadata if head else {})),
        'last_modified_by_name': touched_by,
        'updated_at': iso_kst(touched_at) if touched_at else None,
        'source': 'v2',
    }
    if _wants_row_versions():
        payload['rowVersions'] = _row_version_map()
    return success_response(payload)


# ─────────────────────────────────────────────────────────────────────────────
# 읽기 — V2 고유
# ─────────────────────────────────────────────────────────────────────────────

def _project_filters(q, actor):
    """
    과제 목록의 필터를 **한 곳에** 모은다. 목록과 집계가 같은 함수를 쓴다.

    ⚠️ 따로 구현하면 반드시 갈리고, 갈리는 순간 **"목록은 12건인데 집계는 15건"** 이
       된다. 그게 제일 나쁜 종류의 버그다 — 어느 쪽이 맞는지 알 수 없다.

    2026-08-08 추가분(사업부명·프로세스·중점·진행률·KPI연결)은 AI 에이전트 때문이다.
    이 대시보드의 축이 사업부·프로세스인데 그걸로 못 걸러서, "MX 지연 과제" 같은
    질문에도 전부 긁어와 모델이 눈으로 세야 했다. 세다가 limit 에 잘리면
    **잘린 줄 모르고 틀린 수를 답한다.**
    """
    a = request.args
    q = q.filter(Dt2Project.is_permanently_deleted.is_(False))
    if a.get('include_deleted') != 'true':
        q = q.filter(Dt2Project.is_deleted.is_(False))

    if a.get('division_id'):
        q = q.filter(Dt2Project.division_id == a.get('division_id', type=int))
    # 사업부는 **이름**으로도 받는다 - 사람도 AI 도 'MX' 라고 말하지 id 로 말하지 않는다
    if a.get('division'):
        q = q.filter(Dt2Project.division == a['division'])
    if a.get('process'):
        q = q.filter(Dt2Project.process == a['process'])
    if a.get('status'):
        q = q.filter(Dt2Project.status == a['status'])
    if a.get('year'):
        q = q.filter(Dt2Project.year == a.get('year', type=int))
    if a.get('is_key') in ('true', 'false'):
        q = q.filter(Dt2Project.is_key.is_(a['is_key'] == 'true'))
    if a.get('progress_min') not in (None, ''):
        q = q.filter(Dt2Project.progress >= a.get('progress_min', type=int))
    if a.get('progress_max') not in (None, ''):
        q = q.filter(Dt2Project.progress <= a.get('progress_max', type=int))
    # DX KPI 에 걸렸나 - '미연결 과제 찾기' 가 이 화면의 상시 안건이라 필터로 둔다
    if a.get('kpi_linked') in ('true', 'false'):
        ex = db.session.query(Dt2ProjectKpi.project_uuid).filter(
            Dt2ProjectKpi.project_uuid == Dt2Project.uuid).exists()
        q = q.filter(ex if a['kpi_linked'] == 'true' else ~ex)

    if a.get('owner') == 'me':
        q = q.filter(Dt2Project.owner_user_id == actor.id)
    if a.get('editable') == 'true' and actor.role not in P.GLOBAL_EDIT_ROLES:
        # 내가 고칠 수 있는 것만. admin/dt_office 는 전체라 필터가 의미 없다.
        # **can_edit_project 와 조건이 같아야 한다.** 갈리면 "보이는데 못 고치는"
        # 과제가 생긴다. dt3_test_invariants.py D 항목이 일치를 강제한다.
        if actor.role == UserRole.VIEWER:
            q = q.filter(db.false())          # viewer 는 편집 가능한 것이 없다
        else:
            conds = [Dt2Project.owner_user_id == actor.id]
            member_cond = P.member_sql_condition(actor)
            if member_cond is not None:
                conds.append(member_cond)
            div = P.actor_division_id(actor)
            if actor.role == UserRole.MANAGER and div is not None:
                conds.append(Dt2Project.division_id == div)
            q = q.filter(or_(*conds))

    term = (a.get('q') or '').strip()
    if term:
        like = f'%{term}%'
        q = q.filter(or_(Dt2Project.title.ilike(like), Dt2Project.code.ilike(like)))
    return q


@bp_v2.route('/projects', methods=['GET'])
@auth_required
def list_projects():
    """요약 목록. 필터는 선택(`_project_filters`). 삭제분은 기본 제외."""
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    q = _project_filters(Dt2Project.query, actor)
    limit = min(request.args.get('limit', 200, type=int), 1000)
    offset = request.args.get('offset', 0, type=int)
    total = q.count()
    rows = (q.order_by(Dt2Project.year.desc(), Dt2Project.code)
            .limit(limit).offset(offset).all())

    return success_response({
        'total': total, 'limit': limit, 'offset': offset,
        # 목록이 잘렸다는 사실을 **응답이 스스로 말한다.** AI 가 이걸 보고 집계로
        # 갈아타야 한다 - 잘린 줄 모르고 세면 조용히 틀린 수가 나온다.
        'truncated': total > offset + len(rows),
        'items': [_project_summary(p) for p in rows],
    })


# 집계 축 - 화면이 실제로 쓰는 축과 같다. 임의 컬럼을 열어 주지 않는다
# (열면 AI 가 아무 이름이나 넣고, 없는 축은 500 이 된다).
_AGG_AXES = {
    'division': Dt2Project.division,
    'process': Dt2Project.process,
    'status': Dt2Project.status,
    'year': Dt2Project.year,
    'category': Dt2Project.category,
}


@bp_v2.route('/projects/aggregate', methods=['GET'])
@auth_required
def aggregate_projects():
    """
    과제를 **세어서** 돌려준다. 필터는 목록과 완전히 같다(`_project_filters`).

    왜 있나
        이게 없으면 "몇 건?" "사업부별로?" 가 전부 **나열 후 모델이 눈으로 세기** 가
        된다. 목록은 limit 에 잘리는데 모델은 잘린 줄 모르고 세어서, **틀렸다는
        신호 없이 틀린 수**를 답한다. 세는 일은 DB 가 해야 한다.

    질의
        group_by  division | process | status | year | category (없으면 전체 합계만)
        그 외     목록과 동일한 필터 전부

    응답
        {total, avgProgress, groupBy, groups: [{key, count, avgProgress}]}
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    axis_name = request.args.get('group_by')
    if axis_name and axis_name not in _AGG_AXES:
        return error_response(
            'group_by 는 ' + ', '.join(_AGG_AXES) + ' 중 하나여야 합니다.',
            status_code=400)

    rows = _project_filters(
        db.session.query(Dt2Project.progress), actor).all()
    total = len(rows)
    prog = [r[0] for r in rows if r[0] is not None]
    avg = (sum(prog) / len(prog)) if prog else None

    groups = []
    if axis_name:
        axis = _AGG_AXES[axis_name]
        grouped = (_project_filters(
            db.session.query(axis.label('k'), func.count().label('n'),
                             func.avg(Dt2Project.progress).label('avg')), actor)
            .group_by(axis).order_by(func.count().desc()).all())
        groups = [{
            'key': (g.k if g.k not in (None, '') else '(미지정)'),
            'count': g.n,
            'avgProgress': round(float(g.avg), 1) if g.avg is not None else None,
        } for g in grouped]

    return success_response({
        'total': total,
        'avgProgress': round(float(avg), 1) if avg is not None else None,
        'groupBy': axis_name or None,
        'groups': groups,
    })


@bp_v2.route('/ai/data-map', methods=['GET'])
@auth_required
def ai_data_map():
    """
    조회에 쓰는 **어휘 지도** - 사업부·프로세스·진행상태·과제구분·연도·DX KPI.

    왜 있나
        `describe_fields` 는 **고칠 수 있는 필드**를 말한다(수정용). 조회할 때 필요한
        "사업부에 뭐가 있나 · 프로세스 이름이 뭔가" 를 물어볼 데가 없어서, 모델이
        사업부 이름을 지어내고 0건을 받아 헤맸다.

        실제 데이터에 **있는 값**만 준다 - 설정에만 있고 안 쓰이는 값을 주면
        그것도 0건이 된다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    from app.modules.dx_kpi_management.models import KpiDefinition

    live = Dt2Project.query.filter(
        Dt2Project.is_deleted.is_(False),
        Dt2Project.is_permanently_deleted.is_(False))

    def vals(col):
        rows = (live.with_entities(col).filter(col.isnot(None))
                .group_by(col).order_by(func.count().desc()).all())
        return [r[0] for r in rows if r[0] != '']

    return success_response({
        'divisions': vals(Dt2Project.division),
        'processes': vals(Dt2Project.process),
        'statuses': vals(Dt2Project.status),
        'categories': vals(Dt2Project.category),
        'years': sorted(vals(Dt2Project.year), reverse=True),
        'kpis': [{'id': d.id, 'label': d.label, 'divisions': d.divisions or []}
                 for d in KpiDefinition.query.order_by(
                     KpiDefinition.sort_order.asc(), KpiDefinition.id.asc()).all()],
        'projectCount': live.count(),
        'note': ('여기 있는 값만 필터에 쓸 것. 목록이 truncated 면 세지 말고 '
                 'aggregate_projects 로 다시 물을 것.'),
    })


@bp_v2.route('/projects/<uuid>', methods=['GET'])
@auth_required
def get_project(uuid):
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    p = Dt2Project.query.filter_by(uuid=uuid).first()
    if p is None:
        return error_response('과제를 찾을 수 없습니다.', status_code=404)
    if not P.can_view_project(actor, p):
        return error_response('이 과제를 볼 권한이 없습니다.', status_code=403)

    data = _project_detail(p)
    data['canEdit'] = P.can_edit_project(actor, p)
    return success_response(data)


@bp_v2.route('/projects/<uuid>/changes', methods=['GET'])
@auth_required
def get_project_changes(uuid):
    """변경 이력. 누가 언제 무엇을 바꿨는가."""
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    p = Dt2Project.query.filter_by(uuid=uuid).first()
    if p is None:
        return error_response('과제를 찾을 수 없습니다.', status_code=404)
    if not P.can_view_project(actor, p):
        return error_response('이 과제를 볼 권한이 없습니다.', status_code=403)

    limit = min(request.args.get('limit', 100, type=int), 500)
    rows = (Dt2ProjectChange.query
            .filter_by(project_uuid=uuid)
            .order_by(Dt2ProjectChange.row_version.desc(), Dt2ProjectChange.id.desc())
            .limit(limit).all())
    names = {}
    for r in rows:
        for uid in (r.actor_user_id, r.on_behalf_of):
            if uid and uid not in names:
                u = User.query.get(uid)
                names[uid] = u.name if u else f'(삭제된 사용자 {uid})'
    # `field` 는 **컬럼명**(`progress`·`status`…)이라 화면이 그대로 못 보여준다.
    # 한글 키를 여기서 얹어 준다 — 프론트에 필드 맵을 복제하면 `field_maps.py` 단일 출처가
    # 깨지기 때문이다(사본이 갈려서 한 번 정리한 적이 있다). 맵에 없는 컬럼은 컬럼명을
    # 그대로 쓴다 — 지어내지 않는다.
    return success_response([{
        'rowVersion': r.row_version, 'field': r.field,
        'fieldLabel': VIRTUAL_FIELD_LABELS.get(
            r.field, PROJECT_COL_TO_KEY.get(r.field, r.field)),
        'before': r.before_value, 'after': r.after_value,
        'actor': names.get(r.actor_user_id), 'onBehalfOf': names.get(r.on_behalf_of),
        'source': r.source, 'reason': r.reason,
        'changedAt': iso_kst(r.created_at) if r.created_at else None,
    } for r in rows])


@bp_v2.route('/projects/<uuid>/history', methods=['GET'])
@auth_required
def get_project_history(uuid):
    """
    진척 지표 이력. **그 시점의 값**을 그대로 돌려준다.

    왜 필요한가 (`history_hash.derive_project_counts` 주석과 같은 이유)
        화면의 진척률은 액션아이템 완료 비율로 계산되는데 그 값은 **소급 변경된다** —
        오늘 액션아이템을 3개 추가하면 '지난달 진척률' 을 역산한 값이 어제와 달라진다.
        **분모가 바뀌기 때문이다.** 이 이력은 그 시점의 분자·분모를 그대로 남긴 것이라
        나중에 데이터를 고쳐도 안 바뀐다. 그래서 "진척률이 떨어진 게 일을 못 해서인지
        일이 늘어서인지" 를 구분할 수 있다 — 계산식으로는 절대 안 나오는 답이다.

    `/changes` 와 다르다
        `/changes`  누가 **무엇을 바꿨나** (행위, 필드 단위)
        `/history`  **지표가 어떻게 변했나** (결과, 한 시점 = 한 행)
        값이 직전 기록과 같으면 행을 만들지 않으므로 **행 하나 = 값이 바뀐 시점**이다.

    ⚠️ `startMonth`/`endMonth` 는 **날짜가 아니라 월 번호(1~12)** 다. 연도는 `year`.
    ⚠️ **2026-07-29 이전 기간은 존재하지 않는다.** 이력 수집이 그날 시작됐고 소급 생성은
       불가능하다. 그날 것은 `changeKind='seed'` 로 한 점 남아 있다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    p = Dt2Project.query.filter_by(uuid=uuid).first()
    if p is None:
        return error_response('과제를 찾을 수 없습니다.', status_code=404)
    if not P.can_view_project(actor, p):
        return error_response('이 과제를 볼 권한이 없습니다.', status_code=403)

    limit = min(request.args.get('limit', 100, type=int), 500)
    rows = (Dt2ProjectHistory.query
            .filter_by(project_uuid=uuid)
            .order_by(Dt2ProjectHistory.observed_at.desc(), Dt2ProjectHistory.id.desc())
            .limit(limit).all())

    return success_response([{
        'observedAt': iso_kst(r.observed_at) if r.observed_at else None,
        'year': r.year,
        'status': r.status,
        'progress': r.progress,
        'actionTotal': r.action_total, 'actionDone': r.action_done,
        'issueTotal': r.issue_total, 'issueOpen': r.issue_open,
        'startMonth': r.start_month, 'endMonth': r.end_month,
        # 직전 기록 대비 **무엇이 달라졌는지**. 화면이 그 칸만 강조할 수 있다.
        'changedFields': r.changed_fields or [],
        'changeKind': r.change_kind,     # seed / import / ui / ai
        'source': r.source,
    } for r in rows])


@bp_v2.route('/describe/fields', methods=['GET'])
@auth_required
def describe_fields():
    """
    과제 필드 안내 — **AI 가 PATCH 를 만들기 전에 먼저 읽는 도구.**

    왜 필요한가
        AI 는 필드명을 **지어낸다.** 없는 이름을 보내면 서버는 `ignored` 로 돌려주는데,
        AI 가 그걸 안 보면 사용자는 "저장됐다" 는 말만 듣는다.

        더 중요한 건 **위험도**다. 저위험 필드는 즉시 반영되지만 **핵심 필드는 제안 큐로
        가서 사람이 승인**해야 한다(202). AI 가 모르면 "고쳤습니다" 라고 답하는데 실제로는
        대기 중인 상태가 된다.

    내용은 `ai_tools.describe_fields()` 가 `field_maps` + `permissions` 에서 **읽어서**
    만든다. 복제하지 않으므로 필드가 늘면 안내도 자동으로 따라온다.

    읽기 전용이고 과제 데이터를 담지 않는다(어휘와 규칙뿐).
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    return success_response(ai_describe_fields())


@bp_v2.route('/describe/performance-fields', methods=['GET'])
@auth_required
def describe_performance_fields():
    """
    성과 필드 안내 — **AI 가 성과를 만들거나 고치기 전에 먼저 읽는 도구.**

    과제용 `/describe/fields` 와 **표가 다르다**(PERF_*). 과제 안내를 보고 성과를
    고치려 들면 없는 필드를 보내게 되고, 서버는 `ignored` 로 조용히 넘긴다.

    성과의 기준은 과제와 하나 다르다 — 성과는 **여러 과제가 공유**하므로
    핵심 필드가 202(확인 대기)가 아니라 **403** 이다. 그 차이를 여기서 알려준다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    return success_response(ai_describe_performance_fields())


# MCP 사용 안내(Agent Skill) 파일. 사용자가 자기 Claude Code 에 설치한다.
#
# 왜 서버가 파일을 그대로 읽어 보내나
#     안내는 `mcp_server/skill/digitaltwin/SKILL.md` 에 있는데, 계정 관리 화면에서
#     토큰만 받아 가는 사람은 **그 폴더를 갖고 있지 않다.** 화면에서 같이 내려받게
#     하지 않으면 결국 repo 를 가진 개발자만 쓰게 된다.
#     그렇다고 프론트에 본문을 복사해 넣으면 **사본이 갈린다** — 필드 규칙이 바뀌었는데
#     안내는 옛말을 하는 상태가 가장 나쁘다(`ai_tools` 를 field_maps 에서 끌어다 만든 것과
#     같은 이유다). 그래서 **파일 하나가 단일 출처**이고 여기선 그것을 그대로 보낸다.
#
# 읽기 전용이고 과제 데이터를 담지 않는다(사용 절차 문서뿐).
_SKILL_PATH = (Path(__file__).resolve().parents[4]
               / 'mcp_server' / 'skill' / 'digitaltwin' / 'SKILL.md')


@bp_v2.route('/skill/digitaltwin', methods=['GET'])
@auth_required
def mcp_skill_file():
    """MCP 사용 안내 파일(SKILL.md)을 그대로 돌려준다."""
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    try:
        text = _SKILL_PATH.read_text(encoding='utf-8')
    except OSError:
        # 반입할 때 `mcp_server` 폴더가 빠지면 여기로 온다. 빈 파일을 내주면 사용자는
        # 설치했다고 믿는다 — 분명히 실패로 알린다.
        current_app.logger.warning('[DT-V2] MCP 스킬 파일을 못 읽었다: %s', _SKILL_PATH)
        return error_response(
            'MCP 사용 안내 파일이 서버에 없습니다. 관리자에게 알려 주세요.',
            status_code=404)

    return Response(text, mimetype='text/markdown', headers={
        'Content-Disposition': 'attachment; filename="SKILL.md"',
        'Cache-Control': 'no-store',
    })


# ─────────────────────────────────────────────────────────────────────────────
# AI 에이전트 (Phase 5) — 사내 LLM 이 위 도구들을 스스로 골라 쓴다
#
# 관문이 **두 단계**다 (2026-08-08 개방).
#   누가 쓸 수 있나   로그인한 사람 누구나 — 단 **관리자가 아니면 읽기 전용**
#   무엇을 할 수 있나 그 사람의 권한 그대로 (도구가 호출자의 토큰으로 REST 를 부른다)
#
# **쓰기를 관리자로 좁혀 두는 이유는 기능이 아니라 관찰이다** — LLM 이 확인 절차를
# 지키는지, 엉뚱한 과제를 집지 않는지는 실제로 돌려봐야 안다. 그때까지는 무엇이
# 잘못돼도 되돌릴 수 있는 사람만 쓴다. 읽기는 그 걱정이 없어서 먼저 열었다.
#
# ⚠️ **읽기 전용을 서버가 강제한다.** 화면의 스위치는 안내일 뿐이고, 비관리자가
#    `readonly: false` 를 보내도 여기서 되돌린다 — 화면만 막으면 관문이 아니다.
#    그리고 **되돌렸다는 사실을 응답에 담는다**(`readonlyForced`). 조용히 바꾸면
#    사용자는 자기가 고쳐 달라고 한 것이 왜 안 됐는지 알 수가 없다.
# ─────────────────────────────────────────────────────────────────────────────

@bp_v2.route('/ai/agent', methods=['POST'])
@auth_required
def ai_agent():
    """
    본문
        query     사용자 질문/지시 (필수)
        history   이전 대화 [{role: 'user'|'assistant', content}] (선택)
        readonly  true 면 쓰기 도구를 아예 안 넘긴다 (선택, 기본 false)
                  **관리자가 아니면 이 값과 무관하게 true 로 고정된다**

    응답
        200  {answer, trace[], hops, toolCalls, model, truncated, readonly, readonlyForced}
        400  query 없음
        503  LLM 이 설정되지 않았거나 닿지 않음
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    body = request.get_json(silent=True) or {}
    query = (body.get('query') or '').strip()
    if not query:
        return error_response('질문이 비어 있습니다.', status_code=400)

    # 쓰기는 아직 관리자만. 비관리자의 요청은 **거절하지 않고 읽기로 돌린다** —
    # 조회는 어차피 해도 되는 일이라, 403 을 내면 쓸 수 있는 것까지 막힌다.
    asked_write = not bool(body.get('readonly'))
    is_admin = actor.role == UserRole.ADMIN
    readonly = True if not is_admin else not asked_write
    readonly_forced = asked_write and not is_admin

    if not dt_llm.is_configured():
        return error_response(
            'AI 서버가 설정되지 않았습니다. 관리자에게 문의하세요.', status_code=503)

    # 도구가 자기 REST API 를 부를 때 쓸 인증. **새로 만들지 않고 그대로 넘긴다** —
    # 여기서 토큰을 발급하면 그 토큰의 권한이 호출자와 달라질 수 있다.
    auth = request.headers.get('Authorization') or ''

    # ── 실행 + 기록 ──────────────────────────────────────────────────────
    # 성공이든 실패든 남긴다. "간단한 건 되는데 복잡한 건 못 한다" 를 고치려면
    # **어디서 어긋났는지**(도구 오선택·인자 오류·예산 초과·결과 잘림)를 봐야 하고,
    # 그 판단에 필요한 것이 trace 다. 실패 쪽이 오히려 고칠 거리를 준다.
    started = time.perf_counter()
    result, err = None, None
    try:
        result = dt_agent.run_agent(
            auth, query,
            history=body.get('history') or [],
            readonly=readonly,
        )
    except dt_llm.LLMNotConfigured as exc:
        err, status = str(exc), 503
    except dt_llm.LLMError as exc:
        # 모델·네트워크 문제는 서버 결함이 아니다. 문장을 그대로 보여준다.
        current_app.logger.warning('[DT-AI] %s', exc)
        err, status = str(exc), 503

    # 기록에도 **실제로 돈 모드**를 남긴다. 요청 본문을 그대로 믿으면 비관리자의
    # 실행이 전부 '쓰기 허용' 으로 남아, 나중에 로그를 보고 오진한다.
    _record_agent_run(actor, query, {**body, 'readonly': readonly}, result, err,
                      int((time.perf_counter() - started) * 1000))
    if err:
        return error_response(err, status_code=status)

    result['readonly'] = readonly
    if readonly_forced:
        result['readonlyForced'] = True
    return success_response(result)


def _record_agent_run(actor, query, body, result, err, ms):
    """에이전트 실행 1회를 남긴다. **실패해도 요청을 깨뜨리지 않는다** —
    진단 기록이 본 기능을 막으면 주객이 뒤바뀐다."""
    r = result or {}
    try:
        db.session.add(Dt2AgentRun(
            user_id=getattr(actor, 'id', None),
            question=query[:4000],
            answer=(r.get('answer') or '')[:8000] or None,
            trace=r.get('trace') or [],
            hops=int(r.get('hops') or 0),
            tool_calls=int(r.get('toolCalls') or 0),
            model=(r.get('model') or None),
            readonly=bool(body.get('readonly')),
            truncated=bool(r.get('truncated')),
            duration_ms=ms,
            error=(err or None),
        ))
        db.session.commit()
    except Exception as exc:                                  # noqa: BLE001
        db.session.rollback()
        current_app.logger.warning('[DT-AI] 실행 기록 실패: %s', exc)


@bp_v2.route('/ai/agent/runs', methods=['GET'])
@auth_required
def ai_agent_runs():
    """
    최근 에이전트 실행 기록. **관리자 전용** — 남의 질문이 그대로 들어 있다.

    질의
        limit    최대 100 (기본 30)
        verdict  'good' | 'bad' | 'none'(미판정) 로 거르기
        failed   true 면 오류 난 것만
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    if actor.role != UserRole.ADMIN:
        return error_response('관리자만 볼 수 있습니다.', status_code=403)

    q = Dt2AgentRun.query
    v = request.args.get('verdict')
    if v == 'none':
        q = q.filter(Dt2AgentRun.verdict.is_(None))
    elif v in ('good', 'bad'):
        q = q.filter(Dt2AgentRun.verdict == v)
    if request.args.get('failed') in ('1', 'true'):
        q = q.filter(Dt2AgentRun.error.isnot(None))
    try:
        limit = min(max(int(request.args.get('limit') or 30), 1), 100)
    except (TypeError, ValueError):
        limit = 30

    rows = q.order_by(Dt2AgentRun.created_at.desc()).limit(limit).all()
    return success_response({'items': [{
        'id': r.id,
        'createdAt': iso_kst(r.created_at) if r.created_at else None,
        'userId': r.user_id,
        'query': r.question,
        'answer': r.answer,
        'trace': r.trace or [],
        'hops': r.hops,
        'toolCalls': r.tool_calls,
        'model': r.model,
        'readonly': r.readonly,
        'truncated': r.truncated,
        'durationMs': r.duration_ms,
        'error': r.error,
        'verdict': r.verdict,
        'verdictNote': r.verdict_note,
    } for r in rows]})


@bp_v2.route('/ai/agent/runs/<int:run_id>/verdict', methods=['POST'])
@auth_required
def ai_agent_run_verdict(run_id):
    """실행 하나에 사람이 판정을 단다 ('good'|'bad'|null).

    이 표시가 **골든셋의 씨앗**이다 — 'bad' 로 모인 질문이 곧 고쳐야 할 목록이고,
    'good' 은 회귀 시험으로 승격할 후보다. 실제 사용 로그에서 뽑는 것이
    책상에서 지어낸 질문보다 훨씬 낫다."""
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    if actor.role != UserRole.ADMIN:
        return error_response('관리자만 판정할 수 있습니다.', status_code=403)

    row = Dt2AgentRun.query.get(run_id)
    if row is None:
        return error_response('기록을 찾을 수 없습니다.', status_code=404)

    body = request.get_json(silent=True) or {}
    v = body.get('verdict')
    if v not in (None, '', 'good', 'bad'):
        return error_response("verdict 는 'good' | 'bad' | null 이어야 합니다.",
                              status_code=400)
    row.verdict = v or None
    row.verdict_note = (body.get('note') or '').strip()[:1000] or None
    db.session.commit()
    return success_response({'id': row.id, 'verdict': row.verdict})


# ─────────────────────────────────────────────────────────────────────────────
# 폼 채우기 도우미 — LLM 이 **편집 화면의 칸을 채우기만** 한다
#
# 에이전트(`/ai/agent`)와 **다른 물건이다.** 저 쪽은 LLM 이 도구를 골라 스스로 고치고
# 핵심 필드는 202 로 확인을 받는다. 여기는 **아무것도 쓰지 않는다** — 값을 돌려줄 뿐이고,
# 사람이 편집창에서 보고 고치고 저장을 누른다. 그 저장은 평소와 **완전히 같은 경로**로
# 가므로 권한·낙관적 락·변경 이력이 그대로 걸린다.
#
# 그래서 관문의 기준도 다르다
#     에이전트  **관리자 전용** — LLM 이 스스로 쓰기 때문에 관찰이 끝날 때까지 좁혔다
#     여기      **그 과제를 고칠 수 있는 사람**(can_edit_project) — 자기가 어차피 손으로
#               채울 칸을 대신 채우는 것이라, 편집 권한 밖으로 새는 것이 없다.
#               (권한이 없으면 값을 받아도 저장이 막힌다 — 미리 막아 헛수고를 던다.)
#
# ⚠️ 두 경로 모두 **읽기 전용이라 컷오버 쓰기 차단에서 뺐다**(`_READ_ONLY_ENDPOINTS`).
#    그 목록의 규칙대로 여기에 DB 쓰기를 한 줄이라도 넣으면 차단이 뚫린다 —
#    진단 기록조차 넣지 않고 로그로만 남기는 이유다.
# ─────────────────────────────────────────────────────────────────────────────

def _form_assist_target(uuid):
    """폼 도우미 공통 관문 → `(project, None)` 또는 `(None, 오류응답)`.

    LLM 미설정(503)을 **권한 검사보다 뒤에** 둔다 — 남의 과제를 집었을 때
    "AI 가 꺼져 있다" 고 답하면 권한 실패를 설정 문제로 오진한다.
    """
    actor = _actor()
    if actor is None:
        return None, error_response('로그인이 필요합니다.', status_code=401)

    p = Dt2Project.query.filter_by(uuid=uuid).first() if uuid else None
    if p is None:
        return None, error_response('과제를 찾을 수 없습니다.', status_code=404)
    if not P.can_edit_project(actor, p):
        return None, error_response(P.deny_reason(actor, p), status_code=403)

    if not dt_llm.is_configured():
        return None, error_response(
            'AI 서버가 설정되지 않았습니다. 관리자에게 문의하세요.', status_code=503)
    return p, None


def _form_assist_call(fn, **kwargs):
    """LLM 호출을 감싸 오류를 사용자 문장으로 바꾼다. 두 경로가 같은 문구를 쓴다."""
    try:
        return fn(**kwargs), None
    except dt_llm.LLMNotConfigured as exc:
        return None, error_response(str(exc), status_code=503)
    except dt_llm.LLMError as exc:
        # 모델·네트워크 문제는 서버 결함이 아니다. 문장을 그대로 보여준다.
        current_app.logger.warning('[DT-AI/form] %s', exc)
        return None, error_response(str(exc), status_code=503)


@bp_v2.route('/ai/form/project-fill', methods=['POST'])
@auth_required
def ai_form_project_fill():
    """
    붙여넣은 글 → **편집 폼에 넣을 값**. 아무것도 저장하지 않는다.

    본문
        uuid         과제 uuid (필수 — 권한을 이 과제로 판정한다)
        text         붙여넣은 원문
        instruction  사용자의 추가 지시 (선택, 예: "설명만 다듬어줘")
        current      화면이 **지금 들고 있는** 값 {한글키: 값} (선택)
                     ⚠️ 저장된 값이 아니라 편집 중인 값이다 — 그래야
                        "이미 채운 칸은 건드리지 마라" 가 성립한다.

    응답 200 `{patch: {키: {value, tab}}, notes[], skipped[{key, why}], model}`
        `patch` 는 **제안**이다. 화면이 before → after 를 보여주고 사람이 고른다.
    """
    p, failed = _form_assist_target((request.get_json(silent=True) or {}).get('uuid'))
    if failed is not None:
        return failed

    body = request.get_json(silent=True) or {}
    text = (body.get('text') or '').strip()
    instruction = (body.get('instruction') or '').strip()
    if not text and not instruction:
        return error_response('붙여넣을 글이나 지시가 필요합니다.', status_code=400)

    current = body.get('current')
    if not isinstance(current, dict):
        current = {}

    started = time.perf_counter()
    result, failed = _form_assist_call(
        dt_form.fill_project_form, current=current, source=text, instruction=instruction)
    if failed is not None:
        return failed

    current_app.logger.info(
        '[DT-AI/form] fill %s — 원문 %d자 → %d칸 제안 (%dms)',
        p.uuid, len(text), len(result.get('patch') or {}),
        int((time.perf_counter() - started) * 1000))
    return success_response(result)


@bp_v2.route('/ai/form/action-items', methods=['POST'])
@auth_required
def ai_form_action_items():
    """
    붙여넣은 글(회의록·메일·주간보고) → **액션아이템 후보.** 아무것도 저장하지 않는다.

    본문
        uuid      과제 uuid (필수)
        text      원문 (필수)
        existing  이미 있는 액션아이템 제목 [] (선택) — 같은 일을 다시 만들지 않게 한다

    응답 200 `{items: [{제목, 목표일, 세부항목목록[{내용}], duplicate}], notes[], model}`
        **완료 여부는 담기지 않는다.** 진행률·진행상태가 액션아이템에서 파생되므로
        완료 표시는 사람이 화면에서 한다(form_assist 머리말 참고).

    과제년도·기간·과제명은 **서버가 저장된 과제에서 읽는다** — 화면이 보낸 값을 믿으면
    편집 중에 연도를 바꾼 상태로 뽑아 목표일이 통째로 어긋난다.
    """
    p, failed = _form_assist_target((request.get_json(silent=True) or {}).get('uuid'))
    if failed is not None:
        return failed

    body = request.get_json(silent=True) or {}
    text = (body.get('text') or '').strip()
    if not text:
        return error_response('붙여넣을 글이 필요합니다.', status_code=400)

    existing = body.get('existing')
    if not isinstance(existing, list):
        existing = []

    # 과제년도가 비어 있으면 **화면과 같은 값으로** 물러선다 — 편집창의 날짜 칸도
    # `과제년도 || 올해` 로 제한을 건다. 여기만 None 으로 두면 목표일이 전부 버려진다.
    year = p.year or datetime.now().year

    started = time.perf_counter()
    result, failed = _form_assist_call(
        dt_form.extract_action_items,
        source=text, year=year, project_name=p.title or '',
        start_month=p.start_month, end_month=p.end_month,
        existing_titles=[str(t)[:200] for t in existing[:100]])
    if failed is not None:
        return failed

    current_app.logger.info(
        '[DT-AI/form] action-items %s — 원문 %d자 → %d건 (%dms)',
        p.uuid, len(text), len(result.get('items') or []),
        int((time.perf_counter() - started) * 1000))
    return success_response(result)


@bp_v2.route('/ai/form/kpi-links', methods=['POST'])
@auth_required
def ai_form_kpi_links():
    """
    과제 내용 → **연결할 만한 DX KPI 후보.** 아무것도 저장하지 않는다.

    ⚠️ 이 자리는 AI 쓰기가 **403 으로 막혀 있다**(`replace_project_kpi_links`) —
       "추측으로 채우면 매트릭스의 빈칸(=계획의 구멍)이 가짜로 메워진다" 는 판단이다.
       **그 403 은 그대로다.** 여기는 연결을 만들지 않고 **후보와 근거만** 낸다:
       화면이 자동으로 체크하지 않고 사람이 하나씩 고르며, 저장은 평소의 KPI 경로다.

    본문
        uuid         과제 uuid (필수)
        instruction  추가 지시 (선택)

    응답 200 `{items: [{kpiDefinitionId, label, category, unit, kind, 근거}], notes[]}`
        **대상 사업부·기여 방법은 담기지 않는다.** 그 규칙(자기 사업부만 / 기능조직은
        골라야 함 / 사업부 전용 지표)은 화면의 `toggleKpi` 가 이미 지킨다 — 여기서
        또 만들면 두 곳이 갈린다.
    """
    from app.modules.dx_kpi_management.models import KpiDefinition

    p, failed = _form_assist_target((request.get_json(silent=True) or {}).get('uuid'))
    if failed is not None:
        return failed

    body = request.get_json(silent=True) or {}

    defs = (KpiDefinition.query
            .order_by(KpiDefinition.sort_order.asc(), KpiDefinition.id.asc())
            .all())
    available = [{
        'kpiDefinitionId': d.id,
        'label': d.label,
        'category': d.category,
        'unit': d.unit,
        'kind': d.kind or 'metric',
        'divisions': d.divisions or [],
    } for d in defs]
    linked = [ln.kpi_definition_id for ln, _k in _kpi_links_of(p.uuid)]

    # 과제 내용을 서버가 읽어 넘긴다 — 화면이 보낸 값을 믿으면 편집 중인 임시 상태로
    # 판단하게 되고, 무엇보다 **읽기 권한을 이미 통과한 값**만 프롬프트에 실린다.
    #
    # 🚩 **상세 과제 정보가 근거의 중심이다.** 실제 데이터에서는 `과제상세설명` 보다
    #    이쪽에 내용이 적혀 있는 경우가 많다(2026-08-08 사용자 확인). 그래서 JSON 을
    #    그대로 문자열로 만들지 않고 **섹션 이름이 붙은 줄글**로 옮겨 싣는다
    #    (`render_detail_text` — repr 을 실으면 토큰만 먹고 모델은 못 읽는다).
    detail = DR.render_detail_text({
        key: getattr(p, col, None) for key, col in DR.KEY_TO_COL.items()
    })

    started = time.perf_counter()
    result, failed = _form_assist_call(
        dt_form.suggest_kpi_links,
        project={'과제명': p.title or '', '사업부': p.division or '',
                 '프로세스': p.process or '', '과제영역': p.domain or '',
                 '과제구분': p.category or '', '과제상세설명': p.description or '',
                 '상세정보': detail},
        available=available,
        linked_ids=linked,
        instruction=(body.get('instruction') or '').strip())
    if failed is not None:
        return failed

    current_app.logger.info(
        '[DT-AI/form] kpi %s — 후보 %d개 (%dms)',
        p.uuid, len(result.get('items') or []),
        int((time.perf_counter() - started) * 1000))
    return success_response(result)


def _people_candidates(name: str) -> list:
    """이름 → 계정 후보. `/people/search` 와 **같은 규칙**을 쓴다(복제 금지).

    **줄이지 않고 다 준다.** 하나로 골라 주면 화면이 그걸 정답으로 믿고 넣게 되는데,
    여기 들어간 사람은 그 과제를 고칠 수 있게 된다. 고르는 것은 사람이어야 한다.
    """
    q = (name or '').strip()
    if not q:
        return []
    rows = (User.query
            .filter(User.is_active.is_(True))
            .filter(User.name == q)          # 이름은 **정확히** 같은 것만
            .order_by(User.name)
            .limit(10)
            .all())
    out = []
    for u in rows:
        email = u.email or ''
        out.append({
            '이름': u.name,
            'knoxId': email.split('@')[0] if '@' in email else '',
            '부서': getattr(u, 'department', '') or '',
        })
    for r in out:
        r['동명이인'] = len(out) > 1
    return out


# ─────────────────────────────────────────────────────────────────────────────
# 과제PL·작성자 ↔ 계정 일괄 연결 (관리자·사무국)
#
# 왜 필요한가
#     운영에 **이름만 적히고 knoxId 가 빈** 과제가 많다. 그 상태에서는
#       · 과제PL   그 사람이 자기 과제를 **못 고친다**(`is_project_pl` 은 knoxId 로만 본다)
#       · 작성자   화면에 **'연결 안 됨'** 으로 뜬다(표시 전용이라 권한과는 무관)
#     참여인력은 `/members/audit` + `/members/knox` 로 이미 정리할 수 있는데,
#     이 둘은 창구가 없어서 편집창을 하나씩 열어야 했다.
#
# 참여인력 일괄(`patch_member_knox`)과 **같은 안전장치**를 쓴다 —
#   · 대상 과제 목록을 **화면이 준다**(서버가 찾지 않는다. 안 보인 과제가 바뀌면 안 된다)
#   · 과제마다 행 락 + 변경 이력 1행
#   · 전부 성공 아니면 전부 취소
#
# ⚠️ **이름 매칭을 서버가 자동 적용하지 않는다.** 후보만 계산해 주고 고르는 것은 사람이다.
#    특히 과제PL 은 knoxId 가 곧 **편집 권한**이라, 동명이인을 잘못 고르면 남의 과제를
#    고칠 수 있게 된다. (`_fill_author_knox` 가 작성자에 한해 자동 채움을 하는 것은
#     그쪽이 표시 전용이고 '이름이 유일할 때' 로 좁혀져 있기 때문이다)
# ─────────────────────────────────────────────────────────────────────────────

_OWNER_KINDS = {
    # kind: (이름 컬럼, knoxId 컬럼, 사람에게 보여줄 이름)
    'pl': ('pl_name', 'pl_knox_id', '과제PL'),
    'author': ('author_name', 'author_knox_id', '작성자'),
}

# 이름 뒤에 붙는 직함. 표기 흔들림을 줄이는 데만 쓰고, **저장값은 건드리지 않는다.**
_TITLE_SUFFIX_RE = re.compile(
    r'\s*(님|씨|책임|선임|프로|매니저|연구원|수석|파트장|그룹장|팀장|과장|부장|차장)$')

# 직함을 떼고 **남는 이름의 최소 길이.** 이보다 짧아지면 직함이 아니라 이름의 일부다.
_NAME_MIN = 2


def _name_key(s) -> str:
    """이름 비교용 열쇠 — 공백 제거 + 직함 제거. 원본은 그대로 둔다.

    운영 데이터에 `홍길동 책임`·`홍 길동` 처럼 적힌 것이 있어서, 정확 일치만 보면
    **고칠 수 있는 것도 못 찾는다.** 다만 이건 **후보를 넓히는 용도**일 뿐이고,
    무엇을 넣을지는 사람이 고른다.

    🐞 **떼고 나서 이름이 한 글자면 안 뗀다** — `김선임`·`이수석` 처럼 직함과 같은
       글자가 이름에 들어간 사람이 있다. 그대로 떼면 `김` 이 되어 **엉뚱한 사람이
       후보로 올라오고, 정작 본인은 안 올라온다.**
    """
    raw = str(s or '').strip()
    stripped = _TITLE_SUFFIX_RE.sub('', raw)
    if len(stripped.replace(' ', '')) < _NAME_MIN:
        stripped = raw                      # 직함이 아니라 이름의 일부였다
    return stripped.replace(' ', '')


@bp_v2.route('/owner-links/audit', methods=['GET'])
@auth_required
def audit_owner_links():
    """
    **이름만 있고 계정이 안 붙은** 과제PL·작성자를 이름 단위로 묶어 돌려준다. 읽기 전용.

    질의  kind = 'pl' | 'author' | 'all'(기본)

    응답 data `[{kind, kindLabel, name, projectCount, projects[{uuid, code, title}],
                candidates[{이름, knoxId, 부서}], exact}]`
        `exact=true` 는 이름이 **정확히** 같은 계정을 찾았다는 뜻이고,
        false 면 직함·공백을 지워서 찾은 것이라 사람이 더 봐야 한다.
        후보가 비면 **아직 가입 전**일 수 있다 — knoxId 를 직접 넣어 두면 가입하는
        순간 권한이 생긴다(`is_project_pl` 은 요청할 때마다 다시 판정한다).
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    if actor.role not in P.GLOBAL_EDIT_ROLES:
        return error_response('계정 연결 점검은 관리자·사무국만 볼 수 있습니다.',
                              status_code=403)

    kind_arg = (request.args.get('kind') or 'all').strip()
    kinds = list(_OWNER_KINDS) if kind_arg == 'all' else [kind_arg]
    if any(k not in _OWNER_KINDS for k in kinds):
        return error_response("kind 는 'pl' | 'author' | 'all' 이어야 합니다.",
                              status_code=400)

    # 활성 사용자 한 번만 읽는다(이름 하나마다 질의하면 수백 번 왕복한다).
    users = User.query.filter(User.is_active.is_(True)).all()
    by_exact, by_loose = {}, {}
    for u in users:
        name = (u.name or '').strip()
        if not name:
            continue
        email = u.email or ''
        row = {'이름': u.name, 'knoxId': email.split('@')[0] if '@' in email else '',
               '부서': getattr(u, 'department', '') or ''}
        by_exact.setdefault(name, []).append(row)
        by_loose.setdefault(_name_key(name), []).append(row)

    live = Dt2Project.query.filter(
        Dt2Project.is_deleted.is_(False),
        Dt2Project.is_permanently_deleted.is_(False))

    groups = {}
    for p in live.all():
        for kind in kinds:
            name_col, knox_col, label = _OWNER_KINDS[kind]
            name = (getattr(p, name_col, None) or '').strip()
            knox = (getattr(p, knox_col, None) or '').strip()
            if not name or knox:
                continue                      # 이름이 없거나 이미 연결돼 있다
            key = (kind, name)
            g = groups.setdefault(key, {
                'kind': kind, 'kindLabel': label, 'name': name, 'projects': [],
            })
            g['projects'].append({'uuid': p.uuid, 'code': p.code, 'title': p.title})

    out = []
    for g in groups.values():
        exact = by_exact.get(g['name']) or []
        cands = exact or by_loose.get(_name_key(g['name'])) or []
        out.append({**g,
                    'projectCount': len(g['projects']),
                    'candidates': cands[:10],
                    'exact': bool(exact)})

    # 손댈 것이 위로 — 후보가 있는 것 먼저, 그중 과제가 많은 사람 먼저
    out.sort(key=lambda r: (not r['candidates'], -r['projectCount'], r['name']))
    return success_response(out)


@bp_v2.route('/owner-links', methods=['PATCH'])
@auth_required
def patch_owner_links():
    """
    과제PL·작성자의 knoxId 를 **여러 과제에 일괄로** 넣는다.

    본문
        kind          'pl' | 'author'
        name          묶음 기준 — 그 컬럼에 적힌 이름 (이 값과 다른 과제는 건너뛴다)
        knoxId        새 값
        projectUuids  **대상 과제 목록. 서버가 고르지 않는다.**

    ⚠️ `patch_member_knox` 와 **같은 안전장치**다 — 화면이 눈으로 확인한 목록만 바뀐다.
    ⚠️ **이미 knoxId 가 있는 과제는 건너뛴다.** 이 기능은 '비어 있는 것을 채우는' 일이지
       '남이 지정한 계정을 갈아치우는' 일이 아니다. 바꾸려면 편집창에서 한다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    if actor.role not in P.GLOBAL_EDIT_ROLES:
        return error_response('계정 연결은 관리자·사무국만 할 수 있습니다.', status_code=403)

    body = request.get_json(silent=True) or {}
    kind = (body.get('kind') or '').strip()
    name = (body.get('name') or '').strip()
    new_knox = (body.get('knoxId') or '').strip()
    uuids = body.get('projectUuids')

    if kind not in _OWNER_KINDS:
        return error_response("kind 는 'pl' 또는 'author' 여야 합니다.", status_code=400)
    if not name:
        return error_response('이름이 비어 있어 대상을 특정할 수 없습니다.', status_code=400)
    if not new_knox:
        return error_response('새 knoxId 가 비어 있습니다.', status_code=400)
    if not isinstance(uuids, list) or not uuids:
        return error_response('projectUuids 가 비어 있습니다.', status_code=400)
    if len(uuids) > 200:
        return error_response('한 번에 200개 과제까지 처리할 수 있습니다.', status_code=400)

    name_col, knox_col, label = _OWNER_KINDS[kind]
    updated, skipped = [], []
    try:
        for uuid in uuids:
            p = Dt2Project.query.filter_by(uuid=uuid).with_for_update().first()
            if p is None:
                skipped.append({'uuid': uuid, 'reason': '과제를 찾을 수 없습니다'})
                continue
            cur_name = (getattr(p, name_col, None) or '').strip()
            cur_knox = (getattr(p, knox_col, None) or '').strip()
            if cur_name != name:
                skipped.append({'uuid': uuid, 'reason': f'{label} 이름이 다릅니다 ({cur_name})'})
                continue
            if cur_knox:
                skipped.append({'uuid': uuid, 'reason': f'이미 연결돼 있습니다 ({cur_knox})'})
                continue

            setattr(p, knox_col, new_knox)
            p.row_version = (p.row_version or 0) + 1
            db.session.add(Dt2ProjectChange(
                project_uuid=p.uuid, row_version=p.row_version, field=knox_col,
                before_value=None, after_value=new_knox,
                actor_user_id=actor.id, source='ui',
                reason=f'{label} 계정 연결 — {name} → {new_knox}',
            ))
            updated.append({'uuid': p.uuid, 'code': p.code})

        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        current_app.logger.exception('계정 연결 일괄 수정 실패')
        return error_response(f'연결에 실패해 **아무것도 바꾸지 않았습니다**: {exc}',
                              status_code=500)

    return success_response(
        {'updated': updated, 'skipped': skipped,
         'updatedCount': len(updated), 'skippedCount': len(skipped)},
        message=f'{label} {len(updated)}개 과제를 {new_knox} 계정과 연결했습니다.')


@bp_v2.route('/ai/form/people', methods=['POST'])
@auth_required
def ai_form_people():
    """
    붙여넣은 글 → **참여인력 후보.** 아무것도 저장하지 않는다.

    🚨 **AI 는 이름만 뽑고 계정은 서버가 찾는다.** 참여인력에 들어간 사람은 그 과제를
       고칠 수 있게 되는데(`is_project_member`), 원문에는 동명이인을 가릴 정보가 없다.
       모델이 짐작으로 고르면 **엉뚱한 사람에게 편집 권한**이 간다. 그래서
       ① 모델은 이름·근거만 ② 서버가 후보를 붙이고 ③ **사람이 고른다.**

    본문
        uuid      과제 uuid (필수)
        text      원문 (필수)
        existing  이미 등록된 사람 이름 [] (선택)

    응답 200 `{people: [{이름, 근거, candidates[{이름, knoxId, 부서}], 동명이인}], notes[]}`
        `candidates` 가 비면 **아직 가입하지 않았거나 이름 표기가 다른 사람**이다.
        그때는 화면이 knoxId 를 직접 넣게 안내한다(넣어 두면 가입하는 순간 권한이 생긴다).
    """
    p, failed = _form_assist_target((request.get_json(silent=True) or {}).get('uuid'))
    if failed is not None:
        return failed

    body = request.get_json(silent=True) or {}
    text = (body.get('text') or '').strip()
    if not text:
        return error_response('붙여넣을 글이 필요합니다.', status_code=400)

    existing = body.get('existing')
    if not isinstance(existing, list):
        existing = []

    started = time.perf_counter()
    result, failed = _form_assist_call(
        dt_form.extract_people,
        source=text,
        existing_names=[str(n)[:60] for n in existing[:100]],
        resolver=_people_candidates)
    if failed is not None:
        return failed

    current_app.logger.info(
        '[DT-AI/form] people %s — 원문 %d자 → %d명 (%dms)',
        p.uuid, len(text), len(result.get('people') or []),
        int((time.perf_counter() - started) * 1000))
    return success_response(result)


# ─────────────────────────────────────────────────────────────────────────────
# 참여인력 ↔ 계정 연결 상태
#
# 왜 필요한가
#     컷오버로 권한 검사가 실제로 걸리는데, **참여인력이 계정과 연결됐는지 화면에
#     아무 표시가 없다.** 운영 실측(dt3_member_coverage.py)에서 고유 knoxId 282개 중
#     131개가 계정과 안 맞았다. 그런데 그게 오타인지 미가입인지 화면으로는 알 수 없다.
#
#     ⚠️ SSO 가 없어 **사용자가 직접 가입**해야 한다. 하지만 knoxId 는 사내 이메일
#        @앞부분이라 **가입 전에도 값을 안다.** 미리 채워 두면 그 사람이 가입하는 순간
#        권한이 생긴다 — 이 판정은 요청할 때마다 다시 하기 때문이다(`is_project_member`).
#        그래서 "가입할 때까지 기다린다" 가 아니라 **"지금 채워두면 끝"** 이다.
# ─────────────────────────────────────────────────────────────────────────────

@bp_v2.route('/members/resolve', methods=['POST'])
@auth_required
def resolve_members():
    """
    참여인력 원소들이 **각각 어느 계정과 연결되는지** 돌려준다. 아무것도 쓰지 않는다.

    본문 `{"members": [{"knoxId": "...", "이름": "..."}, ...]}`

    **저장 전 입력값도 확인할 수 있게 stateless 로 둔다** — 화면이 타이핑 중에 물어보고
    "이 knoxId 로 가입한 계정이 없습니다" 를 **저장 전에** 보여줄 수 있어야 한다.

    판정은 `permissions.resolve_member` 하나만 쓴다. 규칙을 여기에 복제하면
    **화면은 '연결됨' 이라는데 실제 권한은 안 열리는** 상태가 생긴다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    body = request.get_json(silent=True) or {}
    members = body.get('members')
    if not isinstance(members, list):
        return error_response('members 는 배열이어야 합니다.', status_code=400)
    if len(members) > 200:
        return error_response('한 번에 200명까지 확인할 수 있습니다.', status_code=400)

    index = P.build_member_index()      # 사용자 목록은 한 번만 읽는다
    out = []
    for el in members:
        r = P.resolve_member(el, index)
        u = r['user']
        out.append({
            'knoxId': (el.get('knoxId') if isinstance(el, dict) else '') or '',
            'name': (el.get('이름') if isinstance(el, dict) else el) or '',
            'matched': r['matched'],
            'via': r['via'],
            'userId': u.id if u else None,
            'userName': u.name if u else None,
            'reason': r['reason'],
        })
    return success_response(out)


@bp_v2.route('/people/search', methods=['GET'])
@auth_required
def search_people():
    """
    이름으로 사람을 찾아 **knoxId 를 알려준다.** 아무것도 쓰지 않는다.

    왜 여기에 또 만드나 — `/api/auth/users/search` 가 이미 있는데
        그쪽은 `@jwt_required()` 라 **PAT(dtp_) 로는 못 부른다.** MCP 는 PAT 로
        붙으므로 그 도구를 그대로 쓸 수 없다. 그리고 이 API 의 목적은 자동완성이
        아니라 **AI 가 참여인력·과제PL 을 지정하기 전에 knoxId 를 확정하는 것**이라,
        돌려주는 모양도 다르다(이 도메인의 어휘인 knoxId·부서를 그대로 준다).

    ⚠️ AI 에게 이 도구를 주지 않으면 knoxId 필수 규칙은 그냥 봉쇄와 같다 —
       AI 는 사내 이메일을 알 방법이 없다.

    동명이인은 **줄이지 않고 다 돌려준다.** 하나로 골라 주면 AI 가 그걸 정답으로
    믿고 넣는다. 여러 명이면 사용자에게 고르게 해야 한다(MCP 도구 설명에 적어 뒀다).
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    q = (request.args.get('q') or '').strip()
    if len(q) < 1:
        return success_response([])

    rows = (User.query
            .filter(User.is_active.is_(True))
            .filter(db.or_(User.name.ilike(f'%{q}%'),
                           User.email.ilike(f'{q}%')))
            .order_by(User.name)
            .limit(30)
            .all())

    out = []
    for u in rows:
        email = (u.email or '')
        out.append({
            '이름': u.name,
            'knoxId': email.split('@')[0] if '@' in email else '',
            '부서': getattr(u, 'department', '') or '',
        })
    # 같은 이름이 여럿이면 사람이 부서로 가른다. 그걸 알아보게 표시해 준다.
    names = {}
    for r in out:
        names[r['이름']] = names.get(r['이름'], 0) + 1
    for r in out:
        r['동명이인'] = names[r['이름']] > 1
    return success_response(out)


@bp_v2.route('/members/audit', methods=['GET'])
@auth_required
def audit_members():
    """
    활성 과제 전체의 참여인력을 **사람 단위(이름+부서)로 묶어** 연결 상태를 돌려준다.

    왜 사람 단위인가
        같은 사람이 여러 과제에 참여한다. knoxId 를 **한 번 고치면 그 사람이 낀 모든
        과제가 한꺼번에 풀린다.** 그래서 일괄 작업의 단위는 과제가 아니라 사람이다.

    ⚠️ **이름만으로 묶으면 동명이인이 섞인다.** 한 명의 knoxId 를 넣었는데 다른 사람
       과제까지 바뀌면 **엉뚱한 사람에게 편집 권한이 간다.** 그래서 `부서` 까지 묶음 키에
       넣고, 응답에 **대상 과제 목록을 그대로 실어** 사람이 확인하고 고를 수 있게 한다.

    읽기 전용이다. 고치는 API 는 별건이다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    # 전 과제의 인력 명단을 훑는 것이라 사무국 전용으로 둔다
    if actor.role not in P.GLOBAL_EDIT_ROLES:
        return error_response('참여인력 점검은 관리자·사무국만 볼 수 있습니다.',
                              status_code=403)

    rows = (Dt2Project.query
            .filter(Dt2Project.is_deleted.is_(False))
            .filter(Dt2Project.is_permanently_deleted.is_(False))
            .all())

    index = P.build_member_index()
    people = {}

    for p in rows:
        for el in (p.members_json or []):
            if not isinstance(el, dict):
                continue
            name = (el.get('이름') or '').strip()
            dept = (el.get('부서') or '').strip()
            knox = (el.get('knoxId') or '').strip()
            if not name and not knox:
                continue

            key = (name, dept)
            person = people.get(key)
            if person is None:
                person = {
                    'name': name, 'dept': dept,
                    'knoxIds': [], 'projects': [],
                }
                people[key] = person
            if knox and knox not in person['knoxIds']:
                person['knoxIds'].append(knox)
            person['projects'].append({
                'uuid': p.uuid, 'code': p.code, 'title': p.title,
            })

    out = []
    for person in people.values():
        # 그 사람에게 붙은 knoxId 중 **하나라도** 계정과 맞으면 연결된 것으로 본다.
        # (과제마다 표기가 다를 수 있다 — 그것 자체가 정리 대상이라 knoxIds 를 다 실어 준다)
        best = None
        for knox in (person['knoxIds'] or [None]):
            r = P.resolve_member({'knoxId': knox or '', '이름': person['name']}, index)
            if r['matched'] and (best is None or not best['matched']):
                best = r
            elif best is None:
                best = r
        u = best['user'] if best else None
        out.append({
            'name': person['name'], 'dept': person['dept'],
            'knoxIds': person['knoxIds'],
            'matched': bool(best and best['matched']),
            'via': best['via'] if best else None,
            'userId': u.id if u else None,
            'userName': u.name if u else None,
            'reason': best['reason'] if best else None,
            'projectCount': len(person['projects']),
            'projects': person['projects'],
        })

    # 손댈 것이 위로 오게 — 미연결 먼저, 그중 참여 과제가 많은 사람 먼저
    out.sort(key=lambda r: (r['matched'], -r['projectCount'], r['name']))
    return success_response(out)


@bp_v2.route('/members/knox', methods=['PATCH'])
@auth_required
def patch_member_knox():
    """
    여러 과제의 참여인력 **knoxId 하나를 일괄로 고친다.**

    왜 일괄인가
        같은 사람이 여러 과제에 참여한다. knoxId 를 한 번 고치면 **그 사람이 낀 모든
        과제가 한꺼번에 풀린다.** 그래서 작업 단위가 과제가 아니라 사람이다.

    본문
        name           묶음 기준 — 참여인력 원소의 `이름`
        dept           묶음 기준 — 원소의 `부서` (**동명이인 때문에 이름만으로는 안 된다**)
        matchKnoxIds   지금 값이 이것인 원소만 바꾼다. `""` 는 '비어 있음' 을 뜻한다.
                       생략하면 이름+부서가 맞는 원소를 전부 바꾼다
        knoxId         새 값
        projectUuids   **대상 과제 목록. 서버가 고르지 않는다.**

    ⚠️ **대상을 서버가 찾지 않는 것이 핵심 안전장치다.** "이 이름을 가진 모든 과제" 를
       서버가 알아서 찾으면 화면에 안 보인 과제까지 바뀐다. 사용자가 눈으로 확인한
       목록만 바뀌어야 한다.

    ⚠️ **전부 성공 아니면 전부 취소**다. 한 요청 안에서 끝나므로 부분 적용을 남길 이유가
       없다. 과제마다 행 락을 걸고 `members_json` 을 다시 읽어 고친다 — 남의 동시 수정을
       덮을 창을 좁힌다. 바꾸는 것은 `knoxId` 한 칸뿐이다.

    바꾼 과제마다 `dt2_project_changes` 에 기록을 남긴다 — 나중에 "이 사람이 왜 여기
    들어갔지?" 를 편집창 변경 이력 탭에서 바로 볼 수 있어야 한다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    if actor.role not in P.GLOBAL_EDIT_ROLES:
        return error_response('참여인력 일괄 수정은 관리자·사무국만 할 수 있습니다.',
                              status_code=403)

    body = request.get_json(silent=True) or {}
    name = (body.get('name') or '').strip()
    dept = (body.get('dept') or '').strip()
    new_knox = (body.get('knoxId') or '').strip()
    uuids = body.get('projectUuids')
    match_knox = body.get('matchKnoxIds')

    if not new_knox:
        return error_response('새 knoxId 가 비어 있습니다.', status_code=400)
    if not name and not dept:
        return error_response('이름과 부서가 모두 비어 있어 대상을 특정할 수 없습니다.',
                              status_code=400)
    if not isinstance(uuids, list) or not uuids:
        return error_response('projectUuids 가 비어 있습니다.', status_code=400)
    if len(uuids) > 200:
        return error_response('한 번에 200개 과제까지 처리할 수 있습니다.', status_code=400)
    if match_knox is not None and not isinstance(match_knox, list):
        return error_response('matchKnoxIds 는 배열이어야 합니다.', status_code=400)
    match_set = None if match_knox is None else {str(k or '').strip() for k in match_knox}

    updated = []
    skipped = []
    try:
        for uuid in uuids:
            p = (Dt2Project.query.filter_by(uuid=uuid)
                 .with_for_update().first())
            if p is None:
                skipped.append({'uuid': uuid, 'reason': '과제를 찾을 수 없습니다'})
                continue

            before = p.members_json or []
            if not isinstance(before, list):
                skipped.append({'uuid': uuid, 'reason': '참여인력 목록 형태가 아닙니다'})
                continue

            after = []
            hit = 0
            for el in before:
                if not isinstance(el, dict):
                    after.append(el)
                    continue
                same_person = ((el.get('이름') or '').strip() == name
                               and (el.get('부서') or '').strip() == dept)
                cur = (el.get('knoxId') or '').strip()
                targeted = match_set is None or cur in match_set
                if same_person and targeted and cur != new_knox:
                    el = {**el, 'knoxId': new_knox}
                    hit += 1
                after.append(el)

            if hit == 0:
                skipped.append({'uuid': uuid, 'reason': '바꿀 참여인력이 없습니다'})
                continue

            p.members_json = after
            flag_modified(p, 'members_json')
            p.row_version = (p.row_version or 0) + 1
            db.session.add(Dt2ProjectChange(
                project_uuid=p.uuid, row_version=p.row_version,
                field='members_json',
                before_value=_readable(before), after_value=_readable(after),
                actor_user_id=actor.id, source='ui',
                reason=f'참여인력 계정 점검 — {name or "(이름 없음)"} knoxId → {new_knox}',
            ))
            updated.append({'uuid': p.uuid, 'code': p.code, 'changed': hit})

        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        current_app.logger.exception('참여인력 일괄 수정 실패')
        return error_response(f'일괄 수정에 실패해 **아무것도 바꾸지 않았습니다**: {exc}',
                              status_code=500)

    return success_response({
        'updated': len(updated), 'projects': updated, 'skipped': skipped,
    })


# ─────────────────────────────────────────────────────────────────────────────
# 쓰기 — 이 API 의 핵심
# ─────────────────────────────────────────────────────────────────────────────

def _fields_changed_since(uuid, version):
    """버전 N 이후 실제로 바뀐 필드 이름들. 자동 병합 판정에 쓴다."""
    rows = (db.session.query(Dt2ProjectChange.field)
            .filter(Dt2ProjectChange.project_uuid == uuid)
            .filter(Dt2ProjectChange.row_version > version)
            .distinct().all())
    return {r[0] for r in rows}


@bp_v2.route('/projects/<uuid>', methods=['PATCH'])
@auth_required
def patch_project(uuid):
    """
    과제 1건 부분 수정.

    본문
        patch             {필드: 새값}  — V2 컬럼명과 화면의 한글 키를 **둘 다** 받는다
                          (`진행률` → progress). 같은 칸을 두 이름으로 함께 보내면 400
        expected_version  읽어올 때의 row_version. 없으면 낙관적 락을 건너뛴다
        actor_mode        'human'(기본) | 'ai'
        on_behalf_of      AI 가 대신 쓸 때, 권한 판단의 주체가 될 사용자 id
        reason            변경 사유 (AI 는 필수에 가깝게 쓰길 권함)
        ignore_unknown    true 면 고칠 수 없는 키를 400 대신 **건너뛰고** 응답
        ai_assisted       [한글키] — **AI 폼 도우미가 채워 준 칸.** 그 칸의 변경 이력만
                          `source='ai_fill'` 로 남는다. 저장 주체는 여전히 사람이다
                          (권한·확인 절차는 사람 기준). 표식일 뿐이라 값 판정에는
                          아무 영향이 없고, 모르는 이름은 조용히 버린다.
                          `ignored` 에 담는다. 화면이 전체 diff 를 보낼 때 쓴다.
                          기본값 false.
                          ⚠️ **MCP 경로도 true 로 보낸다**(`mcp_server/server.py`).
                          AI 가 키를 하나 지어냈다고 저장을 통째로 400 으로 막으면 같이 보낸
                          정상 필드까지 날아가서다. 대신 무엇을 건너뛰었는지 `ignored` 로
                          돌려주고, **그것을 사람에게 알리는 책임은 스킬에 있다**
                          (`mcp_server/skill/digitaltwin/SKILL.md` — "조용히 넘기지 말 것").

    응답
        200  반영됨            {applied, ignored, rowVersion}
        202  핵심 필드라 제안 대기열로 넘어감 (AI 경로)
        400  분류표에 없는 필드(ignore_unknown 이 아닐 때) / 빈 패치 / 키 이름 충돌
        403  권한 없음
        404  없음
        409  버전 충돌 — 같은 필드를 남이 먼저 고침
    """
    caller = _actor()
    if caller is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    body = request.get_json(silent=True) or {}
    patch = body.get('patch')
    if not isinstance(patch, dict) or not patch:
        return error_response('patch 가 비어 있습니다.', status_code=400)

    # 화면은 한글 키로 보낸다. 여기서 컬럼명으로 바꾼다 (영어로 보내도 그대로 통과).
    patch, origin, err = _to_columns(patch, PROJECT_FIELD_MAP)
    if err:
        return err

    subject, caller, delegated, deny = _resolve_actors(caller, body)
    if subject is None:
        # 대리 권한이 없어서 막힌 것과 대상이 잘못된 것을 구분한다
        code = 403 if '권한' in (deny or '') else 400
        return error_response(deny, status_code=code)

    # (a) 행 락 — 밀리초 단위. 같은 과제에 동시 요청이 와도 순서가 정해진다.
    p = (Dt2Project.query
         .filter_by(uuid=uuid)
         .with_for_update()
         .first())
    if p is None:
        return error_response('과제를 찾을 수 없습니다.', status_code=404)

    # (b) 권한 — 대리 호출이면 '대신하는 사람' 기준으로 판단한다
    if not P.can_edit_project(subject, p):
        db.session.rollback()
        return error_response(P.deny_reason(subject, p), status_code=403)

    # (c) 필드 분류 — 모르는 필드는 여기서 걸린다
    # 화면은 "무엇이 바뀌었나" 를 통째로 보낸다(extractChanges 전체 비교). 거기엔
    # 다른 API 로 가는 키(`성과목록`), 서버가 정하는 키(`updatedAt`), UI 임시값
    # (`isEditing`) 이 섞인다. 그때마다 400 이면 저장 자체가 막힌다.
    # 그렇다고 화면이 "보낼 수 있는 키 목록" 을 들고 있으면 서버에 필드가 늘 때마다
    # 갈린다 — 사본 문제가 되돌아온다.
    #
    # 그래서 `ignore_unknown` 을 주면 **걸러내고 진행하되 무엇을 건너뛰었는지
    # 응답 `ignored` 에 담는다.** 조용히 버리지 않는다. 기본값은 여전히 400 이라
    # AI·MCP 처럼 정확한 키를 보내야 하는 경로는 그대로 엄격하다.
    # 표시용 사본(담당자·과제참여인력·담당부서)은 **분류에 태우지 않는다.**
    # 정본(참여인력목록·담당부서목록)에서 파생시켜 마지막에 얹는다 —
    # 분류에 태우면 화면이 폼 전체를 보낼 때마다 `ignored` 에 떠서 소음이 된다.
    patch = {k: v for k, v in patch.items() if k not in P.PROJECT_DERIVED_FIELDS}

    ignore_unknown = bool(body.get('ignore_unknown'))
    cls = P.classify_patch(patch)
    ignored = _sent_names(cls.rejected, origin) if cls.rejected else []
    if not cls.ok and not ignore_unknown:
        db.session.rollback()
        return error_response(
            f'수정할 수 없는 필드가 있습니다: {", ".join(ignored)}',
            errors=ignored, status_code=400)

    is_ai = (body.get('actor_mode') == 'ai')

    # (c-1a) 휴지통에 있는 과제는 **AI 만** 막는다.
    #
    # 왜 AI 만인가
    #   `can_edit_project` 는 소프트 삭제된 과제를 일부러 통과시킨다(영구삭제만 막는다) —
    #   복구·영구삭제가 그 판정을 쓰고, 무엇보다 **설정 이름 변경**(사업부·프로세스 rename)이
    #   휴지통 과제까지 닿아야 한다. 안 닿으면 나중에 복구했을 때 옛 이름이 살아난다.
    #   화면은 그 일괄 저장에서 휴지통 과제도 함께 PATCH 한다(dashboardWriteApi.bulkSaveV2).
    #   그래서 여기서 전부 400 으로 막으면 **이름 변경이 통째로 실패한다.**
    #
    #   반면 AI 는 사정이 다르다. `list_projects` 는 휴지통을 안 주므로(기본 제외)
    #   AI 가 휴지통 uuid 를 쥐는 건 사용자가 옛 uuid 를 붙여넣었거나 이력을 훑은 경우뿐이고,
    #   그때 AI 는 그것이 삭제된 과제인 줄 모른 채 고친다. 사용자도 모른다.
    #   (2026-08-06 실측: get_project 는 200 에 `canEdit: true` 까지 준다)
    #
    # 진행률 처리(c-3)와 같은 모양이다 — 화면은 통과, 정확히 지정해야 하는 AI 는 거절.
    if is_ai and p.is_deleted:
        db.session.rollback()
        return error_response(
            f'휴지통에 있는 과제입니다({p.code}). 먼저 복구한 뒤에 수정하세요 — '
            '삭제된 과제를 고치면 사용자가 눈치채지 못합니다.',
            status_code=400)

    # (c-1b) 소유자는 **admin·dt_office 만** 지정할 수 있다. 사람이든 AI 든 같다.
    #
    # 🐞 2026-08-05 이전에는 이 검사가 **생성에만** 있었다. 그래서 일반 사용자가
    #    자기 과제의 소유권을 남에게 PATCH 로 그냥 넘길 수 있었다(실측 200).
    #    같은 일에 기준이 두 곳이면 느슨한 쪽으로 샌다.
    if set(patch) & P.OWNER_ADMIN_ONLY_FIELDS and caller.role not in P.GLOBAL_EDIT_ROLES:
        db.session.rollback()
        return error_response(
            '소유자는 관리자만 지정할 수 있습니다.',
            errors=_sent_names(sorted(set(patch) & P.OWNER_ADMIN_ONLY_FIELDS), origin),
            status_code=403)

    # (c-2) AI 가 건드리면 안 되는 필드 — 지금은 비어 있다(permissions 참고).
    #       금지는 "고칠 방법이 아예 없다" 는 뜻이라 마지막 수단으로만 남긴다.
    if is_ai:
        forbidden = P.ai_forbidden_in(patch)
        if forbidden:
            db.session.rollback()
            return error_response(
                f'AI 는 이 필드를 바꿀 수 없습니다: {", ".join(_korean_names(forbidden))}.',
                errors=_sent_names(forbidden, origin), status_code=403)

        # knoxId 없는 사람은 받지 않는다 — 확인 화면이 이름만 보여주면
        # 사용자는 어느 홍길동인지 모른 채 승인하게 된다.
        missing = P.people_fields_missing_knox(patch)
        if missing:
            db.session.rollback()
            return error_response(
                f'{", ".join(_korean_names(missing))} 는 knoxId 가 있어야 합니다. '
                '이름만으로는 동명이인을 가릴 수 없어 사용자가 확인할 수 없습니다. '
                '`find_people` 로 사람을 찾아 knoxId 를 확인한 뒤 다시 보내세요. '
                '여러 명이 나오면 사용자에게 누구인지 물어보세요.',
                errors=_sent_names(missing, origin), status_code=400)

    # (c-3) 진행률은 액션아이템에서 파생된다 — 직접 쓰기를 막는다.
    #
    # 액션아이템이 있는 과제에서 진행률만 따로 바꿔 봐야 다음 저장 때 파생값으로
    # 덮인다. 쓸 수 있는 것처럼 두면 바꿨다고 믿게 만든다.
    # 다만 화면은 폼 전체를 보내므로 400 으로 막으면 저장 자체가 실패한다.
    # 그래서 화면에는 `ignored` 로 알리고, 정확한 키를 보내야 하는 AI 는 거절한다.
    effective = dict(cls.low_risk)
    effective.update(cls.core)
    has_items = bool(p.action_items_json or [])
    if 'progress' in effective and 'action_items_json' not in effective and has_items:
        if is_ai:
            db.session.rollback()
            return error_response(
                '진행률은 액션아이템 완료에서 자동으로 계산됩니다. 직접 바꿀 수 '
                '없습니다 — 액션아이템의 완료 표시를 바꾸면 진행률이 따라옵니다.',
                errors=_korean_names(['progress']), status_code=400)
        cls.low_risk.pop('progress', None)
        cls.core.pop('progress', None)
        effective.pop('progress')
        ignored = ignored + _korean_names(['progress'])

    # (c-4) 진행상태와 액션아이템이 어긋나면 막는다.
    #
    # 값(상위 완료여부·진행률)은 파생시키지만 진행상태는 서버가 바꾸지 않는다 —
    # 핵심 필드라 AI 경로에서 확인 대기를 우회하게 되기 때문이다. 대신 모순되는
    # 조합을 아예 못 만들게 한다. 확인 대기로 쌓기 **전에** 본다: 반영될 수 없는
    # 제안을 만들어 두면 사용자는 승인한 뒤에야 거절당한다.
    conflict = _status_conflict(p, effective)
    if conflict:
        db.session.rollback()
        return error_response(conflict, status_code=400)

    # (c-5) 내용을 넣었으면 보이게 한다 — 상세정보의 `enabled`, 작성자 knoxId.
    effective, vis_notes = _fill_visibility_flags(effective, set(effective))
    effective, author_note = _fill_author_knox(effective, set(effective))
    if author_note:
        vis_notes = list(vis_notes) + [author_note]
        # 작성자 knoxId 는 저위험이라 이번 저장에 함께 들어가야 한다.
        if 'author_knox_id' in effective:
            cls.low_risk['author_knox_id'] = effective['author_knox_id']
    if vis_notes:
        # 파생 결과를 실제로 저장될 쪽에도 반영한다.
        for col in _DETAIL_SECTION_COLS:
            if col in effective:
                if col in cls.low_risk:
                    cls.low_risk[col] = effective[col]
                if col in cls.core:
                    cls.core[col] = effective[col]

    # (c-6) 화면이 못 읽는 형식(월 번호·날짜·월간진척 키)은 만들기 전에 막는다.
    # JSONB 라 서버는 무엇이든 받으므로, 여기서 안 보면 `applied` 로 성공이 돌아가고
    # 화면에서만 어긋난다 — `ignored` 에도 안 뜨니 부르는 쪽은 끝까지 모른다.
    shape_err = _validate_shapes(effective, origin)
    if shape_err:
        db.session.rollback()
        return shape_err

    # (d) AI + 핵심 필드 → 즉시 반영하지 않고 **확인 대기**로 쌓는다
    #
    # 2026-08-01 방침: 이건 "남의 결재를 기다리는 것" 이 아니라 **시킨 사람이 무엇이
    # 어떻게 바뀌는지 눈으로 보고 한 번 더 예/아니오 하는 것**이다. 그래서 응답에
    # `preview`(before → after)를 반드시 실어 보낸다 — 필드 이름만 주면 AI 가
    # "승인이 필요합니다" 라고만 말하고 정작 **무엇이 바뀌는지 못 보여준다.**
    #
    # 이게 잡아내는 것은 권한 위반이 아니라 **AI 의 오해**다. 엉뚱한 과제를 집었거나,
    # 값이 서버에서 다르게 정규화되거나, 사용자가 말한 것과 다른 칸을 고르는 경우 —
    # 전부 before/after 를 보면 사람 눈에 즉시 걸린다.
    if is_ai and cls.core:
        # 저위험 필드는 원래 즉시 반영한다. 다만 **반만 반영하면 모순이 되는 경우**
        # 는 함께 대기시킨다.
        #
        # 예: 미착수 과제에 `액션아이템목록`(저위험)과 `진행상태`(핵심)를 같이 보내면,
        # 액션아이템만 먼저 들어가고 진행상태는 대기에 남는다. 그 순간 그 과제는
        # "미착수인데 완료된 액션아이템이 있는" 모순 상태가 되어, 승인할 때까지
        # **화면에서조차 어떤 저장도 400** 이 된다. 사용자는 무엇을 잘못했는지 모른 채
        # 과제가 잠긴 것만 본다. (2026-08-03 실측으로 발견)
        immediate = dict(cls.low_risk)
        deferred = {}
        if immediate and _status_conflict(p, immediate):
            deferred, immediate = immediate, {}

        pending_patch = {**cls.core, **deferred}
        before_values = {k: _readable(getattr(p, k, None)) for k in pending_patch}
        proposal = Dt2ChangeProposal(
            project_uuid=p.uuid,
            patch=pending_patch,
            before_values=before_values,
            base_version=p.row_version,
            reason=body.get('reason'),
            proposed_by=caller.id,
            on_behalf_of=subject.id if delegated else None,
            status='pending',
        )
        db.session.add(proposal)
        applied = _apply(p, immediate, caller, subject, delegated,
                         source='ai', reason=body.get('reason')) if immediate else []
        db.session.commit()
        return success_response({
            'applied': applied,
            'ignored': ignored,
            'proposalId': proposal.id,
            'pendingFields': sorted(pending_patch),
            # 모순을 피하려고 **같이 대기시킨** 저위험 필드. 비어 있지 않으면
            # "이것도 아직 반영되지 않았다" 고 사용자에게 알려야 한다.
            'alsoPending': _korean_names(sorted(deferred)) if deferred else [],
            # 사람에게 그대로 보여줄 표. 키는 화면이 쓰는 한글 이름이다.
            'preview': {
                _COL_TO_KOREAN.get(k, k): {
                    'before': before_values.get(k),
                    'after': _readable(v),
                }
                for k, v in cls.core.items()
            },
            # 사람 필드는 값만 봐서는 누구인지 모른다. 이름·knoxId·부서·연결여부를
            # 따로 실어 보낸다 — AI 가 이걸 사용자에게 보여주고 동의를 받아야 한다.
            'peoplePreview': _people_preview(cls.core),
            'projectTitle': p.title,
            'projectCode': p.code,
            'rowVersion': p.row_version,
        }, message='아래 내용이 맞는지 확인한 뒤 반영됩니다.', status_code=202)

    # 사람이 고칠 때는 분류를 적용하지 않는다 — 전부 즉시 반영
    to_apply = dict(cls.low_risk)
    to_apply.update(cls.core)
    _derive_manager(to_apply)
    # 담당자·과제참여인력·담당부서는 정본에서 파생시킨다(사본이라 따로 받지 않는다).
    derived_notes = _derive_people_copies(to_apply, p)

    # (e) 낙관적 락
    merged_with = []
    expected, verr = _expected_version(body)
    if verr:
        db.session.rollback()
        return error_response(verr, status_code=400)
    if expected is not None and expected != p.row_version:
        changed = _fields_changed_since(uuid, expected)
        overlap = changed & set(to_apply.keys())
        if overlap:
            db.session.rollback()
            return error_response(
                '다른 사용자가 같은 항목을 먼저 수정했습니다. 새로고침 후 다시 시도하세요.',
                errors=sorted(overlap), status_code=409)
        # 겹치지 않으면 자동 병합 — 굳이 사용자를 막을 이유가 없다.
        #
        # 다만 **조용히 넘어가면 안 된다.** 이 사용자의 화면은 낡은 상태이고,
        # 남이 무엇을 바꿨는지 모른 채 저장한 것이다. 무엇이 병합됐는지 알려준다.
        merged_with = _korean_names(changed)

    applied = _apply(p, to_apply, caller, subject, delegated,
                     source='ai' if is_ai else 'ui', reason=body.get('reason'),
                     ai_fields=_ai_assisted_cols(body))
    if not applied:
        db.session.rollback()
        return success_response({'applied': [], 'ignored': ignored,
                                 'mergedWith': merged_with,
                                 'rowVersion': p.row_version},
                                message='변경된 값이 없습니다.')

    db.session.commit()
    out = {'applied': applied, 'ignored': ignored,
           # 내가 저장하는 동안 남이 바꿔 놓은 항목들.
           # 비어 있지 않으면 이 사용자의 화면이 낡았다는 뜻이다.
           'mergedWith': merged_with,
           'rowVersion': p.row_version}
    # 서버가 보이게 채운 것(상세정보 enabled·작성자 knoxId)이 있으면 알린다.
    if vis_notes:
        out['normalized'] = vis_notes

    # ── 서버가 **파생시킨 값**은 돌려준다 (2026-08-11) ──────────────────────
    #
    # 🐞 안 돌려줘서 실제로 물렸다. 「내 업무」 화면에서 액션아이템의 **세부항목만**
    #    체크해 보내면, 상위 `완료여부`·`완료일`과 `진행률` 은 서버가 정한다
    #    (`normalize_action_items`·`derive_progress`). 그런데 응답에 그 값이 없어서
    #    화면은 **자기가 보낸 배열**(상위 미완료)을 그대로 들고 있었다 →
    #    세부항목을 다 체크해도 **액션아이템이 안 켜진 것처럼 보였다.**
    #
    #    화면이 같은 파생을 다시 구현하면 규칙이 두 벌이 되고 언젠가 갈린다.
    #    그래서 **서버가 결과를 알려주는 쪽**으로 고쳤다.
    #
    # 키는 화면이 쓰는 **한글 이름**이다 — 받은 쪽이 그대로 덮어쓸 수 있어야 한다.
    if 'action_items_json' in applied or 'progress' in applied:
        out['derived'] = {
            _COL_TO_KOREAN.get('action_items_json', 'action_items_json'):
                p.action_items_json,
            _COL_TO_KOREAN.get('progress', 'progress'): p.progress,
        }
    return success_response(out)


# ─────────────────────────────────────────────────────────────────────────────
# 신규 생성
# ─────────────────────────────────────────────────────────────────────────────

@bp_v2.route('/projects', methods=['POST'])
@auth_required
def create_project():
    """
    신규 과제. 만든 사람이 소유자가 된다 (admin 은 다른 사람을 지정할 수 있다).

    본문은 PATCH 와 같은 필드명을 쓰되 `code`·`uuid` 는 **생성 시에만** 받는다.
    (사후 변경은 IMMUTABLE 이라 막힌다 — 식별자가 바뀌면 참조가 깨진다)

    `uuid` 를 받아주는 이유
        화면은 로컬에서 uuid 를 먼저 만들고 **그 값으로 첨부파일·성과 연결을 건다.**
        서버가 다른 uuid 를 매기면 방금 만든 참조가 전부 어긋난다. V1 도 화면이 만든
        uuid 를 그대로 저장했으므로 같은 계약을 유지한다. 안 주면 서버가 만든다.

    `ignore_unknown` 은 PATCH 와 같다 — 화면이 과제 객체를 통째로 보내기 때문에
    관계 키나 UI 임시값이 섞인다. 걸러내되 `ignored` 로 알려준다.

    `actor_mode='ai'` 를 주면 변경 이력의 `source` 가 **'ai'** 로 남는다.
        PATCH 와 달리 **확인 대기(202)로 보내지 않는다.** 생성은 성격이 다르다 —
        기존 값을 덮어쓰지 않고 **더하기만** 하므로, 잘못 만들어도 잃는 것이 없고
        지우면 된다. 반면 핵심 필드 수정은 원래 값이 사라진다.
        게다가 아직 행이 없어 before → after 를 보여줄 대상 자체가 없다.
        → 대신 **무엇을 만들지는 AI 가 부르기 전에 사람에게 보여주도록** 도구 설명과
          스킬에 못 박았고, `source='ai'` 로 **나중에 골라낼 수 있게** 했다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    if not P.can_create_project(actor):
        return error_response('과제를 생성할 권한이 없습니다.', status_code=403)

    body = request.get_json(silent=True) or {}
    fields = dict(body.get('fields') or {})

    # 한글 키를 컬럼명으로. `과제명`→title, `id`→code 라 아래 pop 이 그대로 걸린다.
    fields, origin, err = _to_columns(fields, PROJECT_FIELD_MAP)
    if err:
        return err

    title = (fields.pop('title', '') or '').strip()
    if not title:
        return error_response('과제명(title)은 필수입니다.', status_code=400)

    code = fields.pop('code', None)
    if code and Dt2Project.query.filter_by(code=code).first():
        return error_response(f'이미 있는 과제 코드입니다: {code}', status_code=409)

    raw_uuid = fields.pop('uuid', None)
    new_uuid = str(raw_uuid).strip() if raw_uuid else ''
    if new_uuid and Dt2Project.query.filter_by(uuid=new_uuid).first():
        return error_response(f'이미 있는 과제 uuid 입니다: {new_uuid}', status_code=409)
    if not new_uuid:
        new_uuid = str(uuidlib.uuid4())

    owner_id = fields.pop('owner_user_id', None)
    if owner_id is not None and actor.role not in P.GLOBAL_EDIT_ROLES:
        return error_response('소유자는 관리자만 지정할 수 있습니다.', status_code=403)

    ignore_unknown = bool(body.get('ignore_unknown'))
    cls = P.classify_patch(fields)
    ignored = _sent_names(cls.rejected, origin) if cls.rejected else []
    if not cls.ok and not ignore_unknown:
        return error_response(
            f'생성 시 지정할 수 없는 필드가 있습니다: {", ".join(ignored)}',
            errors=ignored, status_code=400)

    # 🐞 **AI 금지 필드는 생성에서도 막는다** (2026-08-02 `create_project` MCP 도구를
    #    붙이면서 실측으로 발견 — PATCH 에만 검사가 있었다).
    #    막지 않으면 AI 가 **참여인력을 넣은 채 과제를 새로 만들어** 그 사람들에게
    #    편집 권한을 줄 수 있다(`is_project_member`). 수정은 막고 생성은 열어 두면
    #    "새로 만들어서 넣기" 라는 우회로가 그대로 남는다 — 승인 지점에도 같은 검사를
    #    둔 것과 같은 이유다(입구만 막으면 다른 문으로 들어온다).
    if body.get('actor_mode') == 'ai':
        forbidden = P.ai_forbidden_in(fields)
        if forbidden:
            return error_response(
                'AI 는 소유자·담당자를 지정할 수 없습니다: '
                f'{", ".join(_korean_names(forbidden))}. '
                '이 항목들은 이름만 담을 수 있어 동명이인을 가릴 수 없습니다. '
                '참여인력은 `과제참여인력목록` 을 knoxId 와 함께 쓰세요.',
                errors=_sent_names(forbidden, origin), status_code=403)

        # 참여인력·과제PL 은 **생성에서도 knoxId 를 요구한다.**
        #
        # 생성에는 확인 대기(202)가 없어 즉시 반영된다(2026-08-02 결정). 새로 만드는
        # 빈 과제라 남의 기존 데이터에 접근권을 주는 게 아니고, 만든 사람이 어차피
        # 소유자다. 그래도 **누구인지 특정되지 않은 채로는 넣지 않는다** — 확인
        # 단계가 없는 경로일수록 값 자체가 명확해야 한다.
        missing = P.people_fields_missing_knox(fields)
        if missing:
            return error_response(
                f'{", ".join(_korean_names(missing))} 는 knoxId 가 있어야 합니다. '
                '`find_people` 로 사람을 찾아 knoxId 를 확인한 뒤 다시 보내세요. '
                '여러 명이 나오면 사용자에게 누구인지 물어보세요.',
                errors=_sent_names(missing, origin), status_code=400)

    p = Dt2Project(
        uuid=new_uuid,
        code=code,
        title=title,
        owner_user_id=owner_id if owner_id is not None else actor.id,
        author_name=actor.name,
        row_version=1,
        extra_fields={},
        is_deleted=False,
        is_permanently_deleted=False,
    )
    create_cols = {**cls.low_risk, **cls.core}
    _derive_manager(create_cols)          # 관리자는 과제PL 의 사본이다
    _derive_people_copies(create_cols)    # 담당자·과제참여인력·담당부서도 사본이다

    # 생성도 `_apply` 를 지나지 않는다 — 여기서 같은 규칙을 건다.
    # 안 걸면 "새로 만들어서 넣기" 로 모순된 과제를 만들 수 있다(AI 금지 필드를
    # 생성에서도 막은 것과 같은 이유). 액션아이템이 정본이므로 진행률은 파생시키고,
    # 진행상태가 액션아이템과 어긋나면 만들지 않는다.
    # 신규 과제라 물려받을 것이 없다 — uuid 는 전부 새로 만들어진다.
    create_cols = _derive_action_items(create_cols,
                                       status=create_cols.get('status'))
    create_cols, vis_notes = _fill_visibility_flags(create_cols, set(create_cols))
    create_cols, author_note = _fill_author_knox(create_cols, set(create_cols))
    if author_note:
        vis_notes = list(vis_notes) + [author_note]
    shape_err = _validate_shapes(create_cols, origin)
    if shape_err:
        db.session.rollback()
        return shape_err
    conflict = _status_conflict(None, create_cols)
    if conflict:
        return error_response(conflict, status_code=400)

    for k, v in create_cols.items():
        setattr(p, k, v)

    # 생성에도 같은 규칙 — 사업부 텍스트만 들어오면 id 를 풀어 둔다.
    # 안 하면 새 과제가 division_id 없이 만들어져 manager 가 못 고친다.
    if p.division_id is None and p.division:
        p.division_id = P.resolve_division_id(p.division)

    db.session.add(p)
    db.session.flush()

    # 누가 만들었나 — **사람과 AI 를 갈라 기록한다.** 안 가르면 화면의 `source` 배지가
    # 전부 '사용자' 로 보여서, AI 가 만든 과제를 나중에 골라낼 방법이 없다.
    src = 'ai' if body.get('actor_mode') == 'ai' else 'ui'
    db.session.add(Dt2ProjectChange(
        project_uuid=p.uuid, row_version=1, field='__created__',
        before_value=None, after_value={'title': title, 'code': code},
        actor_user_id=actor.id, source=src, reason=body.get('reason'),
    ))
    record_project_history(p, source=src)
    db.session.commit()

    detail = _project_detail(p)
    detail['ignored'] = ignored
    # 서버가 보이게 채운 것이 있으면 알린다 — 조용히 켜면 부르는 쪽은 자기가
    # 보낸 그대로 저장된 줄 안다.
    if vis_notes:
        detail['normalized'] = vis_notes
    return success_response(
        detail,
        message='과제가 생성되었습니다.' + (f' ({"; ".join(vis_notes)})' if vis_notes else ''),
        status_code=201)


# ─────────────────────────────────────────────────────────────────────────────
# AI 제안 처리
# ─────────────────────────────────────────────────────────────────────────────

def _proposal_dict(pr: Dt2ChangeProposal, project=None, names=None):
    names = names or {}
    # 성과 제안은 붙을 과제가 없다(여러 과제가 공유한다). 대상을 알아볼 수 있게
    # `targetType` 과 성과 이름을 함께 준다 — 목록에 둘이 섞여 나오기 때문이다.
    perf = (Dt2Performance.query.filter_by(uuid=pr.performance_uuid).first()
            if pr.target_type == 'performance' else None)
    return {
        'id': pr.id,
        'targetType': pr.target_type,
        'performanceUuid': pr.performance_uuid,
        'performanceTitle': perf.title if perf is not None else None,
        'projectUuid': pr.project_uuid,
        'projectTitle': project.title if project is not None else None,
        'projectCode': project.code if project is not None else None,
        'patch': pr.patch,
        'beforeValues': pr.before_values,
        'baseVersion': pr.base_version,
        'currentVersion': (perf.row_version if perf is not None
                           else project.row_version if project is not None else None),
        'reason': pr.reason,
        'proposedBy': names.get(pr.proposed_by),
        'onBehalfOf': names.get(pr.on_behalf_of),
        'status': pr.status,
        'reviewedBy': names.get(pr.reviewed_by),
        'reviewedAt': iso_kst(pr.reviewed_at) if pr.reviewed_at else None,
        'reviewNote': pr.review_note,
        'createdAt': iso_kst(pr.created_at) if pr.created_at else None,
    }


@bp_v2.route('/proposals', methods=['GET'])
@auth_required
def list_proposals():
    """
    검토할 제안 목록. **내가 승인할 수 있는 것만** 보인다.

    권한 없는 과제의 제안까지 보여주면 목록이 남의 일로 가득 차고,
    정작 내가 처리해야 할 것이 묻힌다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    status = request.args.get('status', 'pending')
    q = Dt2ChangeProposal.query
    if status != 'all':
        q = q.filter(Dt2ChangeProposal.status == status)
    q = q.order_by(Dt2ChangeProposal.created_at.desc())
    rows = q.limit(min(request.args.get('limit', 200, type=int), 500)).all()

    projects, perfs = {}, {}
    for pr in rows:
        if pr.target_type == 'performance':
            if pr.performance_uuid not in perfs:
                perfs[pr.performance_uuid] = Dt2Performance.query.filter_by(
                    uuid=pr.performance_uuid).first()
        elif pr.project_uuid not in projects:
            projects[pr.project_uuid] = Dt2Project.query.filter_by(uuid=pr.project_uuid).first()

    names = {}
    visible = []
    for pr in rows:
        # 성과 제안은 권한 기준이 다르다 — 연결된 과제 중 하나라도 고칠 수 있으면 된다.
        if pr.target_type == 'performance':
            if not P.can_edit_performance(actor, perfs.get(pr.performance_uuid)):
                continue
            proj = None
        else:
            proj = projects.get(pr.project_uuid)
            allowed, _ = P.can_review_proposal(actor, proj, pr)
            # 이미 처리된 것을 볼 때는 편집 권한만 있으면 된다
            if not allowed and not (status != 'pending'
                                    and P.can_edit_project(actor, proj)):
                continue
        for uid in (pr.proposed_by, pr.on_behalf_of, pr.reviewed_by):
            if uid and uid not in names:
                u = User.query.get(uid)
                names[uid] = u.name if u else f'(삭제된 사용자 {uid})'
        visible.append((pr, proj))

    return success_response({
        'total': len(visible),
        'items': [_proposal_dict(pr, proj, names) for pr, proj in visible],
    })


def _approve_performance_proposal(pr, actor):
    """
    성과 제안을 반영한다. 과제 경로와 **다섯 가지가 다르다** —
    대상(Dt2Performance) · 권한(can_edit_performance) · 분류(classify_performance_patch) ·
    낙관적 락(성과의 row_version) · 이력(record_performance_history).

    ⚠️ **승인 시점에 분류를 다시 본다.** 과제 경로가 그렇게 하는 것과 같은 이유다 —
       방침이 바뀌기 전에 쌓인 대기 건이 출구로 그대로 들어오는 것을 막는다.
    """
    p = (Dt2Performance.query.filter_by(uuid=pr.performance_uuid)
         .with_for_update().first())
    if p is None:
        db.session.rollback()
        return error_response('성과를 찾을 수 없습니다.', status_code=404)
    if pr.status != 'pending':
        db.session.rollback()
        return error_response(
            f'이미 처리된 제안입니다. (현재 상태: {pr.status})', status_code=409)
    if not P.can_edit_performance(actor, p):
        db.session.rollback()
        return error_response(P.deny_reason_performance(actor, p), status_code=403)

    patch = dict(pr.patch or {})
    cls = P.classify_performance_patch(patch)
    if not cls.ok:
        db.session.rollback()
        return error_response(
            f'제안에 수정 불가 필드가 있습니다: {", ".join(sorted(cls.rejected))}',
            errors=sorted(cls.rejected), status_code=400)

    # 그 사이 **제안이 건드리는 바로 그 필드**가 바뀌었으면 낡은 제안이다.
    # 과제 경로와 같은 판단 — 버전만 보고 막으면 무관한 수정에도 걸린다.
    touched = [k for k in patch
               if _readable(getattr(p, k, None)) != pr.before_values.get(k)]
    if touched:
        pr.status = 'stale'
        pr.reviewed_by = actor.id
        pr.reviewed_at = datetime.utcnow()
        db.session.commit()
        return error_response(
            '그 사이 이 성과가 수정되어 반영할 수 없습니다: '
            f'{", ".join(_perf_korean_names(touched))}. '
            '지금 값을 다시 보고 새로 제안하세요.',
            errors=_perf_korean_names(touched), status_code=409)

    to_apply = {**cls.low_risk, **cls.core}
    # 단위는 여기서도 소분류에서 파생시킨다 — 제안이 소분류를 옮기는 경우가 있다.
    derive_src = {'category': to_apply.get('category', p.category),
                  'subcategory': to_apply.get('subcategory', p.subcategory)}
    _derive_perf_from_subcategory(derive_src, p)
    to_apply.update({k: v for k, v in derive_src.items()
                     if k in P.PERF_DERIVED_FIELDS})

    applied = []
    for field, new in to_apply.items():
        if _readable(getattr(p, field, None)) == _readable(new):
            continue
        setattr(p, field, new)
        applied.append(field)

    p.row_version = (p.row_version or 1) + 1
    # PATCH 경로와 **같이** 사본을 맞춘다. 여기를 빼먹으면 AI 제안으로 고친 성과만
    # 과제 화면에서 옛 값으로 남는다 — 경로에 따라 결과가 갈리는 게 제일 나쁘다.
    relinked = propagate_performance_to_links(p, applied)
    pr.status = 'approved'
    pr.reviewed_by = actor.id
    pr.reviewed_at = datetime.utcnow()
    pr.review_note = (request.get_json(silent=True) or {}).get('note')
    db.session.flush()
    record_performance_history(p, source='ai')
    db.session.commit()
    return success_response({
        'applied': applied,
        'proposalId': pr.id,
        'rowVersion': p.row_version,
        'performanceTitle': p.title,
        'affectedProjects': _projects_sharing([p.uuid]),
        'relinkedRows': relinked,
    }, message='성과 변경을 반영했습니다.')


@bp_v2.route('/proposals/<int:proposal_id>/approve', methods=['POST'])
@auth_required
def approve_proposal(proposal_id):
    """
    제안 승인 → 실제 반영.

    승인 시점에 **제안이 아직 유효한지** 다시 본다.
    제안이 만들어진 뒤 누군가 같은 필드를 고쳤다면, 그대로 덮으면 그 수정이 사라진다.
    이건 PATCH 의 낙관적 락과 같은 문제이고 같은 방식으로 판정한다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    # **제안 행도 잠근다.** 과제만 잠그면 둘이 동시에 승인할 때 둘 다 status='pending'
    # 을 읽고, 늦은 쪽이 "그 사이 같은 필드가 바뀌었다" 며 이미 승인된 제안을
    # stale 로 뒤집는다. (2026-07-29 동시성 시험에서 발견)
    pr = (Dt2ChangeProposal.query
          .filter_by(id=proposal_id)
          .with_for_update()
          .first())
    if pr is None:
        return error_response('제안을 찾을 수 없습니다.', status_code=404)

    # 성과 제안은 대상도 권한도 분류도 다르다 — 통째로 다른 경로로 보낸다.
    if pr.target_type == 'performance':
        return _approve_performance_proposal(pr, actor)

    p = (Dt2Project.query.filter_by(uuid=pr.project_uuid).with_for_update().first())
    allowed, reason = P.can_review_proposal(actor, p, pr)
    if not allowed:
        db.session.rollback()
        code = 409 if pr.status != 'pending' else 403
        return error_response(reason, status_code=code)

    patch = dict(pr.patch or {})

    # 성과 연결은 컬럼이 아니라 **별도 테이블**이라 필드 분류표를 지나지 않는다.
    # 먼저 떼어내고 나머지만 분류한다 — 안 떼면 `classify_patch` 가 모르는 필드로
    # 보고 제안 전체를 거절한다.
    link_items = patch.pop('performance_links', None)
    # DX KPI 연결도 같은 이유로 먼저 떼어낸다 (2026-08-12 — AI 제안이 열리면서 생겼다).
    kpi_items = patch.pop('kpi_links', None)

    cls = P.classify_patch(patch)
    if not cls.ok:
        db.session.rollback()
        return error_response(
            f'제안에 수정 불가 필드가 있습니다: {", ".join(sorted(cls.rejected))}',
            errors=sorted(cls.rejected), status_code=400)

    # 금지 필드는 만들어질 때 막지만, **이 방침이 생기기 전에 쌓인 대기 건**이 있을 수
    # 있다. 승인은 그것들을 그대로 반영하는 경로라 여기서도 본다 —
    # 입구만 막고 출구를 열어두면 옛 대기 건으로 그대로 들어온다.
    forbidden = P.ai_forbidden_in(patch)
    if forbidden:
        pr.status = 'rejected'
        pr.reviewed_by = actor.id
        pr.reviewed_at = datetime.utcnow()
        pr.review_note = 'AI 가 바꿀 수 없는 항목이라 자동 취소됨'
        db.session.commit()
        return error_response(
            'AI 는 소유자·담당자를 바꿀 수 없습니다: '
            f'{", ".join(_korean_names(forbidden))}. '
            '화면에서 직접 지정하세요. 이 대기 건은 취소했습니다.',
            errors=forbidden, status_code=403)

    # knoxId 없는 사람이 든 대기 건도 같은 이유로 막는다. 지금은 만들 때 걸리지만,
    # **이 규칙이 생기기 전에 쌓인 건**이 통과하면 확인 없이 이름만으로 권한이 간다.
    missing = P.people_fields_missing_knox(patch)
    if missing:
        pr.status = 'rejected'
        pr.reviewed_by = actor.id
        pr.reviewed_at = datetime.utcnow()
        pr.review_note = 'knoxId 가 없어 누구인지 특정할 수 없어 자동 취소됨'
        db.session.commit()
        return error_response(
            f'{", ".join(_korean_names(missing))} 에 knoxId 가 없어 누구인지 '
            '특정할 수 없습니다. 이 대기 건은 취소했습니다.',
            errors=missing, status_code=400)

    # 제안이 낡았는가 — 그 사이 같은 필드가 바뀌었으면 승인을 막는다.
    # 연결도 `performance_links` 라는 이름으로 변경 로그에 남으므로 같이 본다
    # (_log_link_change 참조) — 안 넣으면 그 사이 누가 연결을 바꿔도 그냥 덮는다.
    changed = _fields_changed_since(pr.project_uuid, pr.base_version)
    keys = set(patch.keys())
    if link_items is not None:
        keys.add('performance_links')
    if kpi_items is not None:
        # 그 사이 누가 KPI 연결을 바꿨으면 그대로 덮으면 안 된다 —
        # `_log_link_change` 가 `kpi_links` 라는 이름으로 남기므로 같이 본다.
        keys.add('kpi_links')
    overlap = changed & keys
    if overlap:
        pr.status = 'stale'
        pr.reviewed_by = actor.id
        pr.reviewed_at = datetime.utcnow()
        pr.review_note = f'제안 이후 같은 항목이 수정됨: {", ".join(sorted(overlap))}'
        db.session.commit()
        return error_response(
            '제안이 만들어진 뒤 같은 항목이 수정되어 그대로 반영할 수 없습니다. '
            'AI 에게 다시 요청하세요.',
            errors=sorted(overlap), status_code=409)

    # 제안이 만들어진 뒤 액션아이템이 바뀌어 이 상태로는 반영할 수 없게 됐을 수 있다.
    # 입구(PATCH)에서만 보면 그 사이의 변화를 놓쳐 진행상태와 액션아이템이 어긋난
    # 채로 굳는다 — 승인은 값을 실제로 넣는 경로라 여기서도 본다.
    conflict = _status_conflict(p, patch)
    if conflict:
        pr.status = 'stale'
        pr.reviewed_by = actor.id
        pr.reviewed_at = datetime.utcnow()
        pr.review_note = '액션아이템과 진행상태가 어긋나 반영할 수 없음'
        db.session.commit()
        return error_response(conflict, status_code=409)

    # 과제PL 승인이면 관리자(사본)도 같이 맞춘다. 여기를 빼면 승인 경로로 들어온
    # PL 변경만 관리자가 옛 이름으로 남는다.
    _derive_manager(patch)
    _derive_people_copies(patch, p)

    _reason = f'제안#{pr.id} 승인' + (f' — {(request.get_json(silent=True) or {}).get("note")}'
                                     if (request.get_json(silent=True) or {}).get('note') else '')

    applied = _apply(
        p, patch, caller=actor, subject=actor, delegated=False,
        source='ai',
        reason=_reason,
        on_behalf_of_id=pr.on_behalf_of,
    ) if patch else []

    # 성과 연결 반영. 화면 PUT 과 **같은 헬퍼**를 지난다 — 갈라 두면 extra_fields
    # 복원 규칙이 어긋나 화면이 그 연결을 고아로 보고 지운다.
    if link_items is not None:
        # 제안이 만들어진 뒤 성과가 지워졌을 수 있다. 그대로 넣으면 깨진 참조가 남는다.
        _, lerr = _validate_link_items(link_items)
        if lerr:
            pr.status = 'stale'
            pr.reviewed_by = actor.id
            pr.reviewed_at = datetime.utcnow()
            pr.review_note = '제안 이후 성과가 삭제되어 연결할 수 없음'
            db.session.commit()
            return lerr
        _replace_links(p, link_items, actor, 'ai', _reason)
        applied = list(applied) + ['performance_links']

    # DX KPI 연결 반영. 화면 PUT 과 **같은 헬퍼**(`_resolve_kpi_items` → `_replace_kpi_links`)
    # 를 지난다 — 갈라 두면 화면에서 되는 조합이 승인으로는 안 되는 칸이 생긴다.
    if kpi_items is not None:
        # 제안이 만들어진 뒤 지표가 지워졌거나 과제 사업부가 바뀌었을 수 있다.
        # 그러면 대상 사업부 규칙이 더 이상 안 맞는다 — 그대로 넣지 않고 stale 로 돌린다.
        resolved, kerr = _resolve_kpi_items(p, kpi_items)
        if kerr:
            pr.status = 'stale'
            pr.reviewed_by = actor.id
            pr.reviewed_at = datetime.utcnow()
            pr.review_note = '제안 이후 지표·사업부가 바뀌어 연결할 수 없음'
            db.session.commit()
            return kerr
        _replace_kpi_links(p, resolved, actor, 'ai', _reason)
        applied = list(applied) + ['kpi_links']

    pr.status = 'approved'
    pr.reviewed_by = actor.id
    pr.reviewed_at = datetime.utcnow()
    pr.review_note = (request.get_json(silent=True) or {}).get('note')
    db.session.commit()

    return success_response({
        'proposalId': pr.id, 'applied': applied, 'rowVersion': p.row_version,
    }, message='제안이 반영되었습니다.')


@bp_v2.route('/proposals/<int:proposal_id>/reject', methods=['POST'])
@auth_required
def reject_proposal(proposal_id):
    """제안 반려. 과제는 건드리지 않는다."""
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    pr = (Dt2ChangeProposal.query
          .filter_by(id=proposal_id)
          .with_for_update()
          .first())
    if pr is None:
        return error_response('제안을 찾을 수 없습니다.', status_code=404)

    if pr.target_type == 'performance':
        # 성과는 권한 기준이 다르다(연결된 과제 중 하나라도 고칠 수 있으면).
        f = Dt2Performance.query.filter_by(uuid=pr.performance_uuid).first()
        if pr.status != 'pending':
            return error_response(
                f'이미 처리된 제안입니다. (현재 상태: {pr.status})', status_code=409)
        if not P.can_edit_performance(actor, f):
            return error_response(P.deny_reason_performance(actor, f), status_code=403)
    else:
        p = Dt2Project.query.filter_by(uuid=pr.project_uuid).first()
        allowed, reason = P.can_review_proposal(actor, p, pr)
        if not allowed:
            code = 409 if pr.status != 'pending' else 403
            return error_response(reason, status_code=code)

    pr.status = 'rejected'
    pr.reviewed_by = actor.id
    pr.reviewed_at = datetime.utcnow()
    pr.review_note = (request.get_json(silent=True) or {}).get('note')
    db.session.commit()
    return success_response({'proposalId': pr.id, 'status': pr.status},
                            message='제안을 반려했습니다.')


# ─────────────────────────────────────────────────────────────────────────────
# 성과
#
# 과제와 결정적으로 다른 점: **성과 하나를 여러 과제가 공유한다.**
# 목표수준·단위를 바꾸면 그 성과를 쓰는 모든 과제의 숫자가 같이 바뀐다.
# 막지는 않되(2026-07-29 결정), 영향 범위를 응답에 담아 화면이 경고하게 한다.
# ─────────────────────────────────────────────────────────────────────────────

def _num(v):
    if v is None:
        return None
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    return v


# 숫자 컬럼에 온 **빈 문자열은 미입력(NULL)** 이다.
#
# 화면의 수준 입력칸은 `type="text"` 라 칸을 비우면 `''` 를 보낸다. 그대로 두면
# psycopg 가 Numeric 컬럼에 `''` 를 넣으려다 DataError 를 내고, 그게 400
# ("보낸 값이 저장할 수 있는 형식이 아닙니다") 으로 나간다 —
# **값을 지워 미입력으로 되돌리는 것 자체가 불가능했다** (2026-08-06 발견).
#
# ⚠️ `''` 를 0 으로 바꾸지 **않는다.** 0 과 미입력은 뜻이 다르다.
#    0 은 "현재 0%" 같은 진짜 값이고(개발서버 실측 54건), 미입력은 "아직 안 정했다" 다.
#    둘을 같은 값으로 접으면 되돌릴 방법이 없어진다. 이관 스크립트의 `to_num` 과 같은 규칙.
_PERF_NULLABLE_NUMBER_COLS = ('year', 'current_level', 'target_level')


def _blank_numbers_to_null(cols: dict) -> dict:
    """숫자 컬럼의 빈 문자열(공백만 있는 것 포함)을 None 으로. 그 외는 손대지 않는다."""
    for col in _PERF_NULLABLE_NUMBER_COLS:
        v = cols.get(col)
        if isinstance(v, str) and not v.strip():
            cols[col] = None
    return cols


def affected_project_count(performance_uuid) -> int:
    """이 성과를 참조하는 살아있는 과제 수. 수정의 파급 범위다."""
    return (db.session.query(Dt2ProjectPerformance)
            .join(Dt2Project, Dt2Project.uuid == Dt2ProjectPerformance.project_uuid)
            .filter(Dt2ProjectPerformance.performance_uuid == performance_uuid)
            .filter(Dt2Project.is_deleted.is_(False))
            .filter(Dt2Project.is_permanently_deleted.is_(False))
            .count())


# 연결 행(`성과목록` 원소)에 **복제되어 있는 성과 본체 필드**.
#   컬럼 → 원소의 한글 키. PERFORMANCE_FIELD_MAP 의 부분집합이다.
#
# ⚠️ 과제별 값은 **`과제기여도`(contribution) 하나뿐이라** 그것만 뺀다.
#
#    `실적수준`(actual_level)·`월별실적`도 처음엔 관계 속성이라 보고 뺐는데
#    **틀렸다** (2026-08-07, 실적수준을 고쳐도 과제 화면이 안 바뀐다는 신고로 드러났다).
#    이 모델의 "진짜 관계 속성은 과제기여도·실적수준뿐" 이라는 문장은 **V1 원소를
#    그대로 복원하기 위한 저장 얘기**이지 제품 규칙이 아니다. 실제로는 —
#      · 화면에 과제별 실적을 입력하는 칸이 **없다.** 성과를 고를 때 정의값을 베껴
#        올 뿐이고 그 뒤로는 읽기 전용이다(PerformanceSection).
#      · `ProjectReportView` 는 이미 정의를 덮어쓰고 기여도만 지킨다.
#    즉 연결 행의 실적수준은 **낡은 사본일 뿐**이다.
_PERF_MIRROR_IN_LINK = {
    'title': '성과항목',
    'category': '대분류',
    'subcategory': '소분류',
    'unit': '단위',
    'current_level': '현재수준',
    'target_level': '목표수준',
    'actual_level': '실적수준',
    'monthly_values_json': '월별실적',
    'is_monthly': '월별실적여부',
}


def propagate_performance_to_links(p: Dt2Performance, changed_cols) -> int:
    """
    성과 정의 수정을 **그 성과를 쓰는 모든 연결 행에 반영**한다. (2026-08-07)

    왜 필요한가
        `성과목록` 원소는 성과 본체를 **베껴** 들고 있고(단위·대분류·목표수준 …),
        `assemble_project()` 는 그 사본(`extra_fields`)만으로 원소를 되돌린다 —
        성과 테이블을 조인하지 않는다. 그래서 성과를 고쳐도 **어느 과제 화면에서도**
        그 줄은 옛 값 그대로였다. 화면이 매번 조회하는 성과항목명만 예외였다.
        (2026-08-07 신고: "대시보드에서 고쳐도 과제 안의 성과 값이 안 바뀐다")

    왜 조립할 때 조인하지 않고 여기서 쓰는가
        `assemble.py` 의 계약은 "원본 원소를 **그대로** 복원한다" 이고 이관 검증
        스크립트가 그 계약에 기대고 있다. 조립을 손대면 그 검증이 흔들린다.
        사본을 **쓸 때 맞춰 두면** 계약도 지키고 읽는 쪽도 전부 옳아진다.

    ★ 실제로 사본이 바뀐 과제는 **`row_version` 을 올린다** (2026-08-07).

        처음엔 "과제 행 자체는 안 바뀌었으니 올리면 근거 없는 409" 라고 보고 안 올렸다.
        그건 틀렸다 — 그 과제의 **연결 데이터가 진짜로 바뀌었다.** 안 올리면 이런
        일이 조용히 일어난다:

            ① A 가 과제 편집창을 열어 둔다 (그때의 실적수준을 formData 에 들고 있다)
            ② B 가 그 성과의 실적수준을 고친다 → 여기서 연결 행까지 갱신된다
            ③ A 가 과제를 저장한다 → `toLinkItems()` 가 A 가 아는 값을 보낸다
               → **B 의 수정이 소리 없이 되돌아간다**

        낙관적 락이 정확히 이걸 막으려고 있는 장치다. 올려 두면 ③ 이 409 가 되고,
        화면은 이미 "다른 사용자가 먼저 수정했습니다. 새로고침 후 다시 시도하세요"
        라고 안내한다. 되돌아가는 것보다 한 번 막히는 편이 낫다.

        ⚠️ **값이 진짜 달라진 과제만** 올린다. 같은 값으로 덮어쓴 과제까지 올리면
           그때는 정말 근거 없는 409 가 된다.

    돌려주는 것: 실제로 값이 달라져 고친 연결 행 수.
    """
    keys = {col: k for col, k in _PERF_MIRROR_IN_LINK.items() if col in set(changed_cols)}
    if not keys:
        return 0

    rows = Dt2ProjectPerformance.query.filter_by(performance_uuid=p.uuid).all()
    touched = 0
    changed_projects = set()
    for ln in rows:
        extra = dict(ln.extra_fields or {})
        before = dict(extra)
        for col, key in keys.items():
            # ⚠️ **이미 들고 있는 사본만** 고친다. 없는 키를 새로 넣지 않는다.
            #    연결 행은 두 모양으로 존재한다 (2026-08-07 실측) —
            #      · V1 에서 이관된 행: 성과 본체가 통째로 복제돼 있다(살찐 행).
            #        고쳐야 할 대상이 이쪽이다.
            #      · V2 연결 API 로 새로 만든 행: `{성과항목UUID, 과제기여도, 실적수준}`
            #        뿐이다(마른 행 — 개발서버 112행 전부 이 모양). 나머지는 성과
            #        테이블에서 읽으라는 뜻이고, 그게 models_v2 가 정한 방향이다.
            #    마른 행에 키를 채워 넣으면 그 설계를 거꾸로 되돌리고, `assemble` 이
            #    내보내는 원소 모양이 과제마다 달라진다.
            if key not in extra:
                continue
            val = getattr(p, col, None)
            # None 은 '값 없음' 이라 사본에서도 지운다 — 남겨 두면 지운 값이 살아난다.
            if val is None:
                extra.pop(key, None)
            else:
                # ⚠️ `현재수준`·`목표수준` 은 Numeric(Decimal) 이다. 그대로 JSONB 에
                #    넣으면 직렬화에서 터진다. **조립이 내보내는 것과 같은 모양**으로
                #    맞춘다 — 안 그러면 사본과 응답값이 9 와 9.0 처럼 갈린다.
                extra[key] = assemble_out(col, val)
        changed = extra != before
        if changed:
            # ⚠️ JSONB 는 **새 dict 를 대입해야** 변경으로 잡힌다 (제자리 수정은 무시된다)
            ln.extra_fields = extra

        # ⚠️ `실적수준` 은 **컬럼도 같이** 맞춘다.
        #    마른 행에는 `extra_fields` 에 이 키가 없고, 그때 `assemble_project` 는
        #    `ln.actual_level` **컬럼**에서 값을 꺼내 원소에 넣는다(assemble.py 참조).
        #    위 사본 갱신은 '있는 키만' 고치므로 마른 행을 못 건드린다 — 컬럼을 안
        #    맞추면 마른 행은 영영 옛 실적을 그대로 내보낸다.
        if 'actual_level' in keys:
            new_actual = p.actual_level
            new_actual = None if new_actual in (None, '') else str(new_actual)
            if ln.actual_level != new_actual:
                ln.actual_level = new_actual
                changed = True

        if changed:
            touched += 1
            changed_projects.add(ln.project_uuid)

    # 바뀐 과제의 낙관적 락을 한 칸 올린다 (★ 머리말 참조).
    if changed_projects:
        for proj in (Dt2Project.query
                     .filter(Dt2Project.uuid.in_(changed_projects)).all()):
            proj.row_version = (proj.row_version or 1) + 1

    return touched


def _perf_dict(p: Dt2Performance):
    return {
        'uuid': p.uuid, 'code': p.code,
        'title': p.title, 'displayName': p.display_name,
        'category': p.category, 'subcategory': p.subcategory,
        'unit': p.unit, 'year': p.year,
        'currentLevel': _num(p.current_level), 'targetLevel': _num(p.target_level),
        'actualLevel': p.actual_level,
        'monthlyValues': p.monthly_values_json or [],
        'isMonthly': p.is_monthly,
        'actionNote': p.action_note,
        'evaluation': p.evaluation,
        'description': p.description,
        'isActive': p.is_active,
        'isDeleted': p.is_deleted,
        # 휴지통 화면이 "언제·누가 지웠나" 를 보여주려면 이 둘이 필요하다.
        # 과제는 `/data` 에 소프트 삭제분이 실려 나가서 화면이 이미 알 수 있었지만,
        # 성과는 `/data` 에서 걸러지므로(assemble.py) **이 API 가 유일한 경로**다.
        'deletedAt': iso_kst(p.deleted_at) if p.deleted_at else None,
        'deletedByName': p.deleted_by_name,
        'isPermanentlyDeleted': p.is_permanently_deleted,
        'rowVersion': p.row_version,
        'createdByUserId': p.created_by_user_id,
    }


@bp_v2.route('/performances', methods=['GET'])
@auth_required
def list_performances():
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    # 영구 삭제분은 **어떤 경우에도 목록에 넣지 않는다** — 과제와 같은 기준.
    # `include_deleted=true` 는 '휴지통까지' 라는 뜻이지 '지운 것 전부' 가 아니다.
    q = Dt2Performance.query.filter(Dt2Performance.is_permanently_deleted.is_(False))
    if request.args.get('include_deleted') != 'true':
        q = q.filter(Dt2Performance.is_deleted.is_(False))
    if request.args.get('year'):
        q = q.filter(Dt2Performance.year == request.args.get('year', type=int))
    if request.args.get('category'):
        q = q.filter(Dt2Performance.category == request.args['category'])
    term = (request.args.get('q') or '').strip()
    if term:
        like = f'%{term}%'
        q = q.filter(or_(Dt2Performance.title.ilike(like),
                         Dt2Performance.code.ilike(like)))

    limit = min(request.args.get('limit', 300, type=int), 1000)
    offset = request.args.get('offset', 0, type=int)
    total = q.count()
    rows = q.order_by(Dt2Performance.year.desc(), Dt2Performance.code)\
            .limit(limit).offset(offset).all()
    return success_response({
        'total': total, 'limit': limit, 'offset': offset,
        'items': [_perf_dict(p) for p in rows],
    })


@bp_v2.route('/performances/<uuid>', methods=['GET'])
@auth_required
def get_performance(uuid):
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    p = Dt2Performance.query.filter_by(uuid=uuid).first()
    if p is None:
        return error_response('성과를 찾을 수 없습니다.', status_code=404)

    d = _perf_dict(p)
    d['canEdit'] = P.can_edit_performance(actor, p)
    d['affectedProjects'] = affected_project_count(uuid)
    return success_response(d)


@bp_v2.route('/performances', methods=['POST'])
@auth_required
def create_performance():
    """만든 사람을 기록한다 — 아직 과제에 안 붙은 성과를 고칠 수 있는 유일한 근거다."""
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    if not P.can_create_project(actor):        # viewer 만 막는 같은 기준
        return error_response('성과를 생성할 권한이 없습니다.', status_code=403)

    body = request.get_json(silent=True) or {}
    fields = dict(body.get('fields') or {})

    # 한글 키를 컬럼명으로. `성과항목`→title, `id`→code
    fields, origin, err = _to_columns(fields, PERFORMANCE_FIELD_MAP)
    if err:
        return err
    _blank_numbers_to_null(fields)

    title = (fields.pop('title', '') or '').strip()
    if not title:
        return error_response('성과항목(title)은 필수입니다.', status_code=400)

    # 사업부 접두어를 여기서 보장한다 — 성과항목은 만든 뒤 못 고치므로(core),
    # 이 지점을 놓치면 그 성과는 영영 `미분류` 로 남는다.
    title, prefix_note, err = _ensure_division_prefix(title)
    if err:
        return err

    # 대분류·소분류를 여기서 본다. 성과는 만든 뒤 이 둘을 못 고치므로(core, 403)
    # 놓치면 그 성과는 영영 잘못된 자리에 남는다.
    cls_err = _validate_perf_classification(
        fields.get('category'), fields.get('subcategory'), required=True)
    if cls_err:
        return cls_err

    code = fields.pop('code', None)
    # 성과코드도 과제코드처럼 겹치면 막는다(409). 유니크 제약이 없어 DB 는 받아주지만,
    # 화면은 `id` 로도 성과를 찾으므로 겹치면 엉뚱한 것이 잡힌다.
    if code and Dt2Performance.query.filter(
            Dt2Performance.code == str(code),
            Dt2Performance.is_deleted.isnot(True)).first():
        return error_response(f'이미 있는 성과코드입니다: {code}', status_code=409)

    # 과제와 같은 이유로 화면이 만든 uuid 를 받아준다 — 화면은 그 값으로 이미
    # 과제의 성과목록 참조를 걸어 두기 때문이다. 안 주면 서버가 만든다.
    raw_uuid = fields.pop('uuid', None)
    new_uuid = str(raw_uuid).strip() if raw_uuid else ''
    if new_uuid and Dt2Performance.query.filter_by(uuid=new_uuid).first():
        return error_response(f'이미 있는 성과 uuid 입니다: {new_uuid}', status_code=409)
    if not new_uuid:
        new_uuid = str(uuidlib.uuid4())

    # 단위·달성형여부는 **분류에 태우지 않는다.** 소분류에서 파생시켜 마지막에 얹는다.
    # 분류에 태우면 `ignored` 에 떠서, 폼 전체를 보내는 화면에는 매번 소음이 된다.
    derived = {k: fields.pop(k) for k in list(fields) if k in P.PERF_DERIVED_FIELDS}
    derived['category'] = fields.get('category')
    derived['subcategory'] = fields.get('subcategory')
    derived_notes = _derive_perf_from_subcategory(derived)

    ignore_unknown = bool(body.get('ignore_unknown'))
    cls = P.classify_performance_patch(fields)
    ignored = _sent_names(cls.rejected, origin) if cls.rejected else []
    if not cls.ok and not ignore_unknown:
        return error_response(
            f'생성 시 지정할 수 없는 필드가 있습니다: {", ".join(ignored)}',
            errors=ignored, status_code=400)

    p = Dt2Performance(
        uuid=new_uuid, code=code, title=title,
        created_by_user_id=actor.id, row_version=1, extra_fields={},
        is_deleted=False,
    )
    # 본문(월별실적·계산로직·DT기여도)만 넣고 '여부' 플래그를 빠뜨리면 화면이
    # 안 읽는다. 넣었으면 보이게 켜 준다 — 상세정보 `enabled` 와 같은 규칙.
    perf_cols, vis_notes = _fill_visibility_flags(
        {**cls.low_risk, **cls.core}, set(fields))
    # 파생값을 얹는다 — 보낸 값이 아니라 **소분류가 정한 값**이다.
    perf_cols.update({k: v for k, v in derived.items()
                      if k in P.PERF_DERIVED_FIELDS})
    for k, v in perf_cols.items():
        setattr(p, k, v)
    db.session.add(p)
    db.session.flush()
    # 누가 만들었나 — **사람과 AI 를 갈라 기록한다.** 과제 생성(create_project)이
    # 같은 방식으로 가른다. 안 가르면 화면의 `source` 배지가 전부 '사용자' 로 보여서
    # AI 가 만든 성과를 나중에 골라낼 방법이 없다.
    record_performance_history(p, source='ai' if body.get('actor_mode') == 'ai' else 'ui')
    db.session.commit()
    detail = _perf_dict(p)
    detail['ignored'] = ignored
    # 서버가 손댄 것은 **반드시 알린다.** 조용히 고치면 부르는 쪽은 자기가 보낸
    # 그대로 저장된 줄 안다.
    notes = ([prefix_note] if prefix_note else []) + vis_notes + derived_notes
    if notes:
        detail['normalized'] = {'성과항목': p.title, 'reason': ' / '.join(notes)}
    return success_response(
        detail,
        message='성과가 생성되었습니다.' + (f' {" ".join(notes)}' if notes else ''),
        status_code=201)


@bp_v2.route('/performances/<uuid>', methods=['PATCH'])
@auth_required
def patch_performance(uuid):
    """
    성과 수정.

    응답에 `affectedProjects` 를 담는다 — 이 성과를 쓰는 과제 수다.
    1보다 크면 화면이 "N개 과제에 영향" 을 알려줄 수 있다.
    """
    caller = _actor()
    if caller is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    body = request.get_json(silent=True) or {}
    patch = body.get('patch')
    if not isinstance(patch, dict) or not patch:
        return error_response('patch 가 비어 있습니다.', status_code=400)

    # 화면은 한글 키로 보낸다. 여기서 컬럼명으로 바꾼다 (영어로 보내도 그대로 통과).
    patch, origin, err = _to_columns(patch, PERFORMANCE_FIELD_MAP)
    if err:
        return err
    _blank_numbers_to_null(patch)

    # 이름을 바꾸는 경우에도 접두어를 보장한다. AI 는 title 이 핵심 필드라 여기까지
    # 오지 않지만(403), **사람 경로로 접두어가 빠지면 그 성과는 미분류가 된다.**
    prefix_note = None
    if patch.get('title'):
        patch = dict(patch)
        patch['title'], prefix_note, err = _ensure_division_prefix(
            str(patch['title']).strip())
        if err:
            return err

    # 분류를 바꾸는 경우에도 짝을 본다. AI 는 core 라 여기까지 못 오지만(403),
    # 사람 경로로 어긋난 조합이 들어가면 화면에서 그 성과가 사라진다.
    if 'category' in patch or 'subcategory' in patch:
        _cur = Dt2Performance.query.filter_by(uuid=uuid).first()
        cls_err = _validate_perf_classification(
            patch.get('category', getattr(_cur, 'category', None)),
            patch.get('subcategory', getattr(_cur, 'subcategory', None)),
            required=False)
        if cls_err:
            return cls_err

    subject, caller, delegated, deny = _resolve_actors(caller, body)
    if subject is None:
        # 대리 권한이 없어서 막힌 것과 대상이 잘못된 것을 구분한다
        code = 403 if '권한' in (deny or '') else 400
        return error_response(deny, status_code=code)

    p = Dt2Performance.query.filter_by(uuid=uuid).with_for_update().first()
    if p is None:
        return error_response('성과를 찾을 수 없습니다.', status_code=404)

    if not P.can_edit_performance(subject, p):
        db.session.rollback()
        return error_response(P.deny_reason_performance(subject, p), status_code=403)

    # 과제 PATCH 와 같다 — 화면이 전체 diff 를 보내므로 걸러내되 무엇을 건너뛰었는지
    # `ignored` 로 알려준다. 기본값은 400 이라 AI·MCP 경로는 그대로 엄격하다.
    # 생성 경로와 같다 — 단위·달성형여부는 분류에 태우지 않고 **소분류에서 파생**시킨다.
    # ⚠️ 소분류만 바꿔 보내도 단위가 **따라와야** 한다. 안 그러면 분류를 옮긴 성과가
    #    옛 단위를 그대로 달고 있게 되고, 화면은 그걸 읽기 전용으로 잠가 손도 못 댄다.
    sent_derived = {k: v for k, v in patch.items() if k in P.PERF_DERIVED_FIELDS}
    patch = {k: v for k, v in patch.items() if k not in P.PERF_DERIVED_FIELDS}

    ignore_unknown = bool(body.get('ignore_unknown'))
    cls = P.classify_performance_patch(patch)
    ignored = _sent_names(cls.rejected, origin) if cls.rejected else []
    if not cls.ok and not ignore_unknown:
        db.session.rollback()
        return error_response(
            f'수정할 수 없는 필드가 있습니다: {", ".join(ignored)}',
            errors=ignored, status_code=400)

    is_ai = (body.get('actor_mode') == 'ai')

    to_apply = {**cls.low_risk, **cls.core}
    # 소분류에서 파생. 소분류를 안 바꿨어도 **지금 값이 어긋나 있으면 여기서 맞춰진다.**
    derive_src = {**sent_derived,
                  'category': to_apply.get('category', p.category),
                  'subcategory': to_apply.get('subcategory', p.subcategory)}
    derived_notes = _derive_perf_from_subcategory(derive_src, p)
    to_apply.update({k: v for k, v in derive_src.items()
                     if k in P.PERF_DERIVED_FIELDS})

    expected, verr = _expected_version(body)
    if verr:
        db.session.rollback()
        return error_response(verr, status_code=400)
    if expected is not None and expected != p.row_version:
        db.session.rollback()
        return error_response(
            '다른 사용자가 이 성과를 먼저 수정했습니다. 새로고침 후 다시 시도하세요.',
            status_code=409)

    # ── AI + 핵심 필드 → 확인 대기 (202) ─────────────────────────────────
    #
    # 2026-08-05 이전에는 여기가 **403** 이었다. 확인 대기로도 안 보낸 이유는
    # "성과는 여러 과제가 공유하는데 승인자가 자기 과제만 보고 승인하면 남의 과제가
    # 조용히 틀어진다" 였다. 그 우려는 `link_performances` 가 이미 푼 방식으로 없앤다 —
    # **막는 대신 `affectedProjects` 를 preview 에 실어 보낸다.**
    #
    # ⚠️ 저위험도 **함께 대기시킨다.** 과제의 `alsoPending` 과 같은 이유다 —
    #    `단위`(소분류 이동)를 대기시키고 `실적수준` 만 즉시 넣으면 숫자의 뜻이 어긋난
    #    채로 남는다(12 가 '%' 인지 '건' 인지 모르는 상태).
    if is_ai and cls.core:
        pending = {**cls.core, **cls.low_risk}
        before_values = {k: _readable(getattr(p, k, None)) for k in pending}
        proposal = Dt2ChangeProposal(
            target_type='performance',
            performance_uuid=p.uuid,
            patch=pending,
            before_values=before_values,
            base_version=p.row_version,
            reason=body.get('reason'),
            proposed_by=caller.id,
            on_behalf_of=subject.id if delegated else None,
            status='pending',
        )
        db.session.add(proposal)
        db.session.commit()
        return success_response({
            'status': 'needs_confirmation',
            'applied': [],
            'ignored': ignored,
            'proposalId': proposal.id,
            'pendingFields': sorted(pending),
            'alsoPending': _perf_korean_names(cls.low_risk) if cls.low_risk else [],
            'preview': {
                _PERF_COL_TO_KOREAN.get(k, k): {
                    'before': before_values.get(k), 'after': _readable(v),
                }
                for k, v in pending.items()
            },
            # ★ 이 성과를 **함께 쓰는 다른 과제**. 이게 없으면 원래 우려가 그대로 남는다.
            'affectedProjects': _projects_sharing([p.uuid]),
            'performanceTitle': p.title,
            'performanceCode': p.code,
        }, message='아래 내용이 맞는지 확인한 뒤 반영됩니다.', status_code=202)

    applied = []
    for field, new in to_apply.items():
        old = getattr(p, field, None)
        if _readable(old) == _readable(new):
            continue
        setattr(p, field, new)
        applied.append(field)

    if not applied:
        db.session.rollback()
        # ⚠️ 여기서도 파생 안내를 실어야 한다. 단위만 바꾸려 한 경우가 이 갈래로 오는데,
        #    "변경된 값이 없습니다" 만 주면 **왜 안 바뀌었는지** 알 수가 없다.
        out = {'applied': [], 'ignored': ignored, 'rowVersion': p.row_version}
        if derived_notes:
            out['normalized'] = {'단위': p.unit, 'reason': ' / '.join(derived_notes)}
        return success_response(
            out, message=' '.join(derived_notes) or '변경된 값이 없습니다.')

    p.row_version = (p.row_version or 1) + 1
    # 이 성과를 쓰는 과제들의 `성과목록` 사본도 같이 맞춘다 — 안 하면 화면이
    # 옛 값을 계속 보여준다 (propagate_performance_to_links 머리말 참조).
    relinked = propagate_performance_to_links(p, applied)
    db.session.flush()
    record_performance_history(p, source='ai' if is_ai else 'ui')
    db.session.commit()

    out = {
        'applied': applied,
        'ignored': ignored,
        'rowVersion': p.row_version,
        'affectedProjects': affected_project_count(uuid),
        # 실제로 사본을 고친 연결 수. 화면이 "N개 과제에 반영" 을 말할 수 있다.
        'relinkedRows': relinked,
    }
    # 서버가 손댄 것은 알린다(생성 경로와 같은 이유).
    notes = ([prefix_note] if prefix_note else []) + derived_notes
    if notes:
        out['normalized'] = {'성과항목': p.title, '단위': p.unit,
                             'reason': ' / '.join(notes)}
    return success_response(out, message=' '.join(notes) or None)


# ─────────────────────────────────────────────────────────────────────────────
# 과제 ↔ 성과 연결
#
# 과제기여도 합계는 **막지 않는다** (2026-07-29 결정). 지금도 100% 가 아닌 건이 있고
# 화면은 '기여도 부적합' 필터로 보여주기만 한다. API 도 같은 태도를 취하되,
# 응답에 합계를 담아 화면이 계속 경고할 수 있게 한다.
#
# 합계 기준은 화면과 같다 — **성과 하나에 연결된 모든 과제의 기여도 합**
# (ContributionEditModal.jsx:505). 과제별 합이 아니다.
# ─────────────────────────────────────────────────────────────────────────────

def _to_contrib(v):
    if v is None or v == '':
        return None
    try:
        return float(str(v).strip())
    except (TypeError, ValueError):
        return None


#
# 성과 이름의 `[사업부] ` 접두어
#
# 성과에는 사업부 컬럼이 **없다.** 화면은 이름 앞 대괄호로 사업부를 가르고
# (AllPerformancesView / KPITreemap 의 extractDivisionFromPerformance),
# 접두어가 없으면 '모든 성과 현황' 에서 통째로 `미분류` 로 떨어진다.
#
# 안내만으로는 막히지 않았다 — 2026-08-03 에 접두어 없는 성과 100건이
# 그대로 만들어졌다. 그래서 **서버가 강제한다.**
#   · 올바른 접두어      그대로 둔다
#   · 모르는 접두어      400. `[무선]` 같은 오타가 새 사업부 그룹을 만들어버린다
#   · 접두어 없음        `[공통] ` 을 붙이고 **응답에 알린다**
#     (거절보다 낫다 — 사업부를 모른다고 성과를 못 만들 이유는 없고,
#      `미분류` 로 두는 것보다 `공통` 이 낫다는 것이 방침이다)
#
COMMON_DIVISION = '공통'
_DIV_PREFIX_RE = re.compile(r'^\[(.+?)\]\s*(.*)$')


def _perf_category_map():
    """활성 대분류 이름 → 그에 딸린 활성 소분류 이름 목록."""
    cats = {c.id: c.name for c in PerformanceCategory.query
            .filter(PerformanceCategory.is_active.is_(True)).all()
            if getattr(c, 'name', None)}
    out = {n: [] for n in cats.values()}
    for s in (PerformanceSubcategory.query
              .filter(PerformanceSubcategory.is_active.is_(True))
              .order_by(PerformanceSubcategory.order,
                        PerformanceSubcategory.id).all()):
        name = cats.get(s.category_id)
        if name and getattr(s, 'name', None):
            out[name].append(s.name)
    return out


def _derive_perf_from_subcategory(cols: dict, current=None):
    """
    `단위`·`달성형여부` 를 **소분류에서 파생**시킨다. `cols` 를 제자리에서 고친다.

    정본은 `performance_subcategories` 다. 성과 행의 값은 사본일 뿐이다 —
    화면도 그렇게 다룬다(소분류에 unit 이 있으면 입력을 잠근다). 그런데 서버 컬럼에는
    검증이 없어서 **2026-08-05 실측 기준 112건 중 35건이 어긋나 있었다.**
    입력을 막는 것만으로는 부족하다 — 소분류를 바꾸면 단위가 **따라와야** 하기 때문이다.
    (`_derive_manager` 가 `과제PL`→`관리자` 에 대해 하는 일과 같다.)

    돌려주는 것: 사용자에게 알릴 문구 목록. **조용히 바꾸지 않는다.**

    소분류에 `unit` 이 비어 있으면 손대지 않는다 — 화면도 그때는 커스텀 입력을 허용한다.
    """
    cat = cols.get('category', getattr(current, 'category', None))
    sub = cols.get('subcategory', getattr(current, 'subcategory', None))
    if not cat or not sub:
        return []

    cats = {c.id: c.name for c in PerformanceCategory.query
            .filter(PerformanceCategory.is_active.is_(True)).all()}
    row = next((s for s in PerformanceSubcategory.query
                .filter(PerformanceSubcategory.is_active.is_(True)).all()
                if cats.get(s.category_id) == cat and s.name == sub), None)
    if row is None:
        return []

    notes = []
    if row.unit:
        sent = cols.get('unit')
        cur = getattr(current, 'unit', None)
        if str(sent or cur or '') != row.unit:
            # 보낸 값이 있으면 "바꿨다", 없으면 소분류 이동에 따라온 것이다
            was = sent if sent is not None else cur
            notes.append(f'단위는 소분류 `{sub}` 가 정합니다 — '
                         f'`{was or "(빈값)"}` 대신 `{row.unit}` 로 저장했습니다.')
        cols['unit'] = row.unit

    want = bool(row.is_achievement_type)
    if bool(cols.get('is_achievement_type',
                     getattr(current, 'is_achievement_type', False))) != want:
        notes.append(f'달성형 여부도 소분류 `{sub}` 를 따릅니다 → `{want}`.')
    cols['is_achievement_type'] = want
    return notes


def _validate_perf_classification(category, subcategory, *, required):
    """
    성과의 대분류·소분류를 검증한다.

    화면은 **사업부 › 대분류 › 소분류** 로 묶는다. 비거나 없는 값이면 그 단계가
    `미분류` 가 되고, **소분류가 대분류에 안 딸린 값이면** 화면 필터가 그 조합을
    못 찾아 사실상 안 보인다. 서버는 JSONB 도 아닌 그냥 문자열 컬럼이라 무엇이든
    받으므로, 여기서 보지 않으면 조용히 잘못 들어간다 — 사업부 접두어와 같은 종류다.

    `required` 는 생성일 때 True. 수정은 보낸 것만 본다.
    """
    tree = _perf_category_map()
    if not tree:
        return None                      # 설정이 비었으면 판단 근거가 없다

    cat = (category or '').strip() or None
    sub = (subcategory or '').strip() or None

    if required and not cat:
        return error_response(
            f'대분류는 필수입니다. 쓸 수 있는 값: {", ".join(sorted(tree))}. '
            "비우면 '모든 성과 현황' 에서 미분류로 떨어집니다.", status_code=400)
    if cat and cat not in tree:
        return error_response(
            f'대분류 `{cat}` 를 알 수 없습니다. '
            f'쓸 수 있는 값: {", ".join(sorted(tree))}.',
            errors=[cat], status_code=400)

    if required and not sub:
        allowed = tree.get(cat) or []
        return error_response(
            '소분류는 필수입니다. '
            + (f'`{cat}` 에 쓸 수 있는 값: {", ".join(allowed)}.' if allowed
               else f'`{cat}` 에는 등록된 소분류가 없습니다. 설정에서 먼저 추가하세요.'),
            status_code=400)
    if sub:
        if not cat:
            return error_response(
                '소분류만 보낼 수 없습니다. 소분류는 대분류에 딸린 값이라 '
                '짝을 확인하려면 대분류가 함께 있어야 합니다.', status_code=400)
        allowed = tree.get(cat) or []
        if sub not in allowed:
            return error_response(
                f'소분류 `{sub}` 는 대분류 `{cat}` 에 속하지 않습니다. '
                f'`{cat}` 에 쓸 수 있는 값: {", ".join(allowed) or "(없음)"}. '
                '짝이 어긋나면 저장은 되지만 화면 필터가 그 조합을 찾지 못합니다.',
                errors=[sub], status_code=400)
    return None


def _division_prefix_names():
    """접두어로 쓸 수 있는 값. 활성 사업부 + `공통`."""
    names = [r.name for r in Division.query
             .filter(Division.is_active.is_(True))
             .order_by(Division.order.asc(), Division.id.asc()).all()
             if getattr(r, 'name', None)]
    return [COMMON_DIVISION] + names


def _ensure_division_prefix(title):
    """
    성과 이름에 사업부 접두어를 보장한다.

    돌려주는 것: `(제목, 안내문 또는 None, 오류응답 또는 None)`
    """
    allowed = _division_prefix_names()
    m = _DIV_PREFIX_RE.match(title or '')
    if m:
        div, rest = m.group(1).strip(), m.group(2).strip()
        if div in allowed:
            # 대괄호 안 공백만 다듬어 다시 붙인다(화면 정규식과 같은 모양으로).
            return f'[{div}] {rest}', None, None
        return None, None, error_response(
            f'성과항목의 사업부 접두어 `[{div}]` 를 알 수 없습니다. '
            f'다음 중 하나를 쓰세요: {", ".join(allowed)}. '
            '성과에는 사업부 컬럼이 없어서 이 접두어로 사업부를 가릅니다.',
            errors=[div], status_code=400)

    return (f'[{COMMON_DIVISION}] {title}',
            f'사업부 접두어가 없어 `[{COMMON_DIVISION}]` 을 붙였습니다. '
            f'다른 사업부라면 만들 때 `[MX] 이름` 처럼 지정하세요 '
            '(만든 뒤에는 성과항목을 고칠 수 없습니다).',
            None)


def contribution_report(performance_uuids) -> list:
    """
    주어진 성과들의 기여도 합계 중 **100 이 아닌 것만** 돌려준다.
    막기 위한 것이 아니라 화면이 표시하기 위한 것이다.
    """
    out = []
    for puid in dict.fromkeys(u for u in performance_uuids if u):
        rows = (db.session.query(Dt2ProjectPerformance.contribution)
                .join(Dt2Project, Dt2Project.uuid == Dt2ProjectPerformance.project_uuid)
                .filter(Dt2ProjectPerformance.performance_uuid == puid)
                .filter(Dt2Project.is_deleted.is_(False))
                .filter(Dt2Project.is_permanently_deleted.is_(False))
                .all())
        vals = [_to_contrib(r[0]) for r in rows]
        # 값이 안 적힌 연결은 화면과 같이 100 으로 친다
        total = sum(v if v is not None else 100.0 for v in vals) if vals else 0.0
        if not vals or abs(total - 100.0) < 1e-9:
            continue
        perf = Dt2Performance.query.filter_by(uuid=puid).first()
        out.append({
            'performanceUuid': puid,
            'title': perf.title if perf else None,
            'sum': round(total, 2),
            'projectCount': len(vals),
        })
    return out


def _link_dict(ln: Dt2ProjectPerformance, perf=None):
    return {
        'performanceUuid': ln.performance_uuid,
        'title': perf.title if perf is not None else None,
        'unit': perf.unit if perf is not None else None,
        'contribution': ln.contribution,
        'actualLevel': ln.actual_level,
        'position': ln.position,
    }


def _links_of(project_uuid):
    links = (Dt2ProjectPerformance.query
             .filter_by(project_uuid=project_uuid)
             .order_by(Dt2ProjectPerformance.position.nullslast(),
                       Dt2ProjectPerformance.id)
             .all())
    perfs = {p.uuid: p for p in Dt2Performance.query.filter(
        Dt2Performance.uuid.in_([l.performance_uuid for l in links])).all()} if links else {}
    return links, perfs


def _log_link_change(project, before, after, actor, source, reason=None,
                     field='performance_links'):
    """
    연결 변경 1건을 변경 로그에 남긴다.

    `field` 는 컬럼이 아니라 **가상 필드명**이다 — 연결은 별도 테이블이라 대응하는
    컬럼이 없다. 화면 라벨은 VIRTUAL_FIELD_LABELS 가 준다.
    기본값이 성과 연결인 것은 먼저 생긴 호출부들을 그대로 두기 위해서다.
    """
    project.row_version = (project.row_version or 1) + 1
    db.session.flush()
    db.session.add(Dt2ProjectChange(
        project_uuid=project.uuid, row_version=project.row_version,
        field=field, before_value=before, after_value=after,
        actor_user_id=actor.id, source=source, reason=reason,
    ))


def _link_actual_level_warnings(items):
    """
    연결에 담긴 `actualLevel` 중 **화면에 보이지 않게 될 것**을 골라낸다.

    실적수준은 두 곳에 있다 — 성과 본체(`dt2_performances.actual_level`)와
    연결(`dt2_project_performance.actual_level`). 그런데 화면은 사실상 **본체만
    보여준다**: 과제 리포트조차 연결 원소 위에 본체를 덮어쓰고
    (ProjectReportView `getEnrichedPerformances`), 대시보드·KPI·트리맵은 처음부터
    본체를 읽는다. 기여도로 나누거나 곱하지도 않는다.

    그래서 연결에 다른 값을 넣으면 **저장은 되는데 아무 데도 안 보인다.**
    막지는 않는다(V1 재조립 경로가 아직 쓴다). 대신 **어긋난 것을 알려준다.**
    """
    wanted = {}
    for it in items:
        if not isinstance(it, dict):
            continue
        av = it.get('actualLevel')
        if av in (None, ''):
            continue
        wanted[str(it.get('performanceUuid'))] = str(av)
    if not wanted:
        return []

    rows = Dt2Performance.query.filter(
        Dt2Performance.uuid.in_(list(wanted))).all()
    out = []
    for f in rows:
        own = '' if f.actual_level is None else str(f.actual_level)
        if own != wanted[f.uuid]:
            out.append({
                'performanceUuid': f.uuid,
                'title': f.title,
                'linkActualLevel': wanted[f.uuid],
                'performanceActualLevel': own or None,
            })
    return out


def _normalize_link_items(items):
    """
    연결 항목을 **제안 큐에 담을 수 있는 최소 모양**으로 줄인다.

    화면이 보내는 원소에는 표시용 필드(title·unit 등)가 섞여 온다. 그대로 쌓아두면
    승인 시점에 성과 이름이 바뀌어 있어도 옛 이름으로 되살아난다 — 참조 키와
    사람이 정한 값만 남긴다.
    """
    out = []
    for it in items:
        one = {'performanceUuid': str(it.get('performanceUuid'))}
        if it.get('contribution') not in (None, ''):
            one['contribution'] = str(it['contribution'])
        if it.get('actualLevel') not in (None, ''):
            one['actualLevel'] = str(it['actualLevel'])
        out.append(one)
    return out


def _replace_links(p: Dt2Project, items, actor, source, reason=None):
    """
    과제의 성과 연결을 통째로 교체하고, 달라졌으면 변경 로그를 남긴다.

    화면 PUT 과 **AI 제안 승인**이 반드시 같은 코드를 지나야 한다 — 갈라 두면
    한쪽만 고쳤을 때 `extra_fields` 복원 규칙이 어긋나고, 그러면 화면이 그 연결을
    고아로 보고 지운다(2026-07-30 실측). 호출부는 검증을 끝낸 뒤 부른다.

    돌려주는 것: (before, after, touched)
    """
    old_links, old_perfs = _links_of(p.uuid)
    before = [_link_dict(l, old_perfs.get(l.performance_uuid)) for l in old_links]
    touched = ({l.performance_uuid for l in old_links}
               | {str(it.get('performanceUuid')) for it in items})
    # 기존 원소에 남아 있던 것(원본 참조 키·성과 본체 복제 필드)을 잃지 않도록 들고 간다.
    prev_extra = {l.performance_uuid: dict(l.extra_fields or {}) for l in old_links}

    Dt2ProjectPerformance.query.filter_by(project_uuid=p.uuid).delete()
    db.session.flush()
    for idx, it in enumerate(items):
        puid_ = str(it.get('performanceUuid'))
        contribution = (str(it['contribution'])
                        if it.get('contribution') not in (None, '') else None)
        actual = (str(it['actualLevel'])
                  if it.get('actualLevel') not in (None, '') else None)

        # extra_fields 는 **원본 `성과목록` 원소를 그대로 복원할 수 있어야 한다**
        # (assemble.py 가 이걸 그대로 되돌린다). 참조 키만 넣으면 재조립에서
        # 기여도·실적이 사라진다. (2026-07-29 왕복 시험에서 발견)
        extra = prev_extra.get(puid_, {})
        # ⚠️ 새로 생기는 연결의 참조 키는 반드시 **`성과항목UUID`** 여야 한다.
        # 화면이 참조를 읽는 곳은 `성과항목UUID || id || 성과항목ID` 뿐이다.
        if not any(k in extra for k in
                   ('성과항목UUID', '성과UUID', 'uuid', '성과항목ID', 'id')):
            extra['성과항목UUID'] = puid_
        extra.pop('과제기여도', None)
        extra.pop('실적수준', None)
        if contribution is not None:
            extra['과제기여도'] = contribution
        if actual is not None:
            extra['실적수준'] = actual

        db.session.add(Dt2ProjectPerformance(
            project_uuid=p.uuid,
            performance_uuid=puid_,
            contribution=contribution,
            actual_level=actual,
            position=idx,
            extra_fields=extra,
        ))
    db.session.flush()

    links, perfs = _links_of(p.uuid)
    after = [_link_dict(l, perfs.get(l.performance_uuid)) for l in links]
    if before != after:
        _log_link_change(p, before, after, actor, source, reason)
    return before, after, touched


def _validate_link_items(items):
    """
    연결 항목 검증. 통과하면 (wanted, None), 아니면 (None, 오류응답).

    제안을 만들기 **전에** 부른다 — 승인 시점에야 "존재하지 않는 성과" 를 알게 되면
    사용자는 이미 예/아니오 를 한 뒤다.
    """
    wanted = [str(it.get('performanceUuid') or '') for it in items if isinstance(it, dict)]
    if len(wanted) != len(items):
        return None, error_response('items 원소는 모두 객체여야 합니다.', status_code=400)
    found = {r[0] for r in db.session.query(Dt2Performance.uuid)
             .filter(Dt2Performance.uuid.in_(wanted)).all()} if wanted else set()
    missing = [u for u in wanted if u not in found]
    if missing:
        return None, error_response(
            f'존재하지 않는 성과입니다: {", ".join(missing[:5])}',
            errors=missing, status_code=400)
    if len(set(wanted)) != len(wanted):
        return None, error_response('같은 성과를 두 번 연결할 수 없습니다.', status_code=400)
    return wanted, None


def _projects_sharing(performance_uuids, exclude_uuid=None):
    """
    주어진 성과들을 **함께 쓰는 다른 과제** 목록.

    연결 변경 제안의 preview 에 싣는다. 승인자는 자기 과제만 보고 예/아니오 하기
    쉬운데, 연결이 바뀌면 여기 나온 과제들의 기여도 합도 같이 흔들린다.
    이 표가 없으면 "남의 과제가 조용히 틀어진다" 는 원래 우려가 그대로 남는다.
    """
    uuids = [u for u in dict.fromkeys(performance_uuids) if u]
    if not uuids:
        return []
    rows = (db.session.query(
                Dt2ProjectPerformance.performance_uuid,
                Dt2Project.uuid, Dt2Project.code, Dt2Project.title,
                Dt2ProjectPerformance.contribution)
            .join(Dt2Project, Dt2Project.uuid == Dt2ProjectPerformance.project_uuid)
            .filter(Dt2ProjectPerformance.performance_uuid.in_(uuids))
            .filter(Dt2Project.is_deleted.is_(False))
            .filter(Dt2Project.is_permanently_deleted.is_(False))
            .all())
    perf_titles = {r.uuid: r.title for r in Dt2Performance.query.filter(
        Dt2Performance.uuid.in_(uuids)).all()}
    out = []
    for puid, prj_uuid, prj_code, prj_title, contrib in rows:
        if exclude_uuid and prj_uuid == exclude_uuid:
            continue
        out.append({
            'performanceUuid': puid,
            'performanceTitle': perf_titles.get(puid),
            'projectUuid': prj_uuid,
            'projectCode': prj_code,
            'projectTitle': prj_title,
            'contribution': contrib,
        })
    return out


@bp_v2.route('/projects/<uuid>/performances', methods=['GET'])
@auth_required
def list_project_links(uuid):
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    p = Dt2Project.query.filter_by(uuid=uuid).first()
    if p is None:
        return error_response('과제를 찾을 수 없습니다.', status_code=404)
    if not P.can_view_project(actor, p):
        return error_response('이 과제를 볼 권한이 없습니다.', status_code=403)

    links, perfs = _links_of(uuid)
    return success_response({
        'projectUuid': uuid,
        'rowVersion': p.row_version,
        'canEdit': P.can_edit_project(actor, p),
        'items': [_link_dict(l, perfs.get(l.performance_uuid)) for l in links],
        'contributionWarnings': contribution_report(
            [l.performance_uuid for l in links]),
    })


@bp_v2.route('/projects/<uuid>/performances', methods=['PUT'])
@auth_required
def replace_project_links(uuid):
    """
    과제의 성과 연결을 **통째로 교체**한다. 화면의 성과목록 편집이 이 모양이다.

    본문
        items            [{performanceUuid, contribution?, actualLevel?}, ...] — 순서가 곧 표시 순서
        expected_version 과제의 row_version
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    body = request.get_json(silent=True) or {}
    is_ai = (body.get('actor_mode') == 'ai')

    items = body.get('items')
    if not isinstance(items, list):
        return error_response('items 는 배열이어야 합니다.', status_code=400)

    p = Dt2Project.query.filter_by(uuid=uuid).with_for_update().first()
    if p is None:
        return error_response('과제를 찾을 수 없습니다.', status_code=404)
    if not P.can_edit_project(actor, p):
        db.session.rollback()
        return error_response(P.deny_reason(actor, p), status_code=403)

    expected, verr = _expected_version(body)
    if verr:
        db.session.rollback()
        return error_response(verr, status_code=400)
    if expected is not None and expected != p.row_version:
        db.session.rollback()
        return error_response(
            '다른 사용자가 이 과제를 먼저 수정했습니다. 새로고침 후 다시 시도하세요.',
            status_code=409)

    # 존재하지 않는 성과를 가리키면 거부한다 — 이관 때와 달리 여기선 조용히
    # 건너뛰면 사용자가 "왜 안 들어갔지" 하게 된다.
    # **제안을 만들기 전에** 본다 — 승인 시점에야 알게 되면 사용자는 이미 승인한 뒤다.
    wanted, verr2 = _validate_link_items(items)
    if verr2:
        db.session.rollback()
        return verr2

    # AI 는 즉시 반영하지 않고 **확인 대기**로 쌓는다.
    #
    # 연결을 바꾸면 그 성과를 쓰는 **다른 과제의 기여도 합**까지 흔들린다. 그래서
    # preview 에 `affectedProjects`(그 성과를 함께 쓰는 다른 과제)와
    # `contributionWarnings`(합이 100 이 아닌 성과)를 반드시 실어 보낸다 —
    # 승인자가 자기 과제만 보고 예/아니오 하면 남의 과제가 조용히 틀어지기 때문이다.
    if is_ai:
        old_links, old_perfs = _links_of(uuid)
        before = [_link_dict(l, old_perfs.get(l.performance_uuid)) for l in old_links]
        proposed = _normalize_link_items(items)
        touched = {l.performance_uuid for l in old_links} | set(wanted)
        proposal = Dt2ChangeProposal(
            project_uuid=p.uuid,
            patch={'performance_links': proposed},
            before_values={'performance_links': before},
            base_version=p.row_version,
            reason=body.get('reason'),
            proposed_by=actor.id,
            status='pending',
        )
        db.session.add(proposal)
        db.session.commit()
        titles = {r.uuid: r.title for r in Dt2Performance.query.filter(
            Dt2Performance.uuid.in_(sorted(touched))).all()} if touched else {}
        return success_response({
            'applied': [],
            'proposalId': proposal.id,
            'pendingFields': ['performance_links'],
            'preview': {
                VIRTUAL_FIELD_LABELS.get('performance_links', '성과 연결'): {
                    'before': before,
                    'after': [dict(it, title=titles.get(it['performanceUuid']))
                              for it in proposed],
                },
            },
            'affectedProjects': _projects_sharing(touched, exclude_uuid=p.uuid),
            'contributionWarnings': contribution_report(touched),
            # 연결에 넣은 실적수준이 성과 본체와 다르면 알린다 — 저장은 되지만
            # 화면은 본체 값을 보여주므로 사용자가 기대한 숫자가 안 나온다.
            'actualLevelWarnings': _link_actual_level_warnings(items),
            'projectTitle': p.title,
            'projectCode': p.code,
            'rowVersion': p.row_version,
        }, message='아래 내용이 맞는지 확인한 뒤 반영됩니다.', status_code=202)

    warn = _link_actual_level_warnings(items)
    before, after, touched = _replace_links(p, items, actor, 'ui', body.get('reason'))
    db.session.commit()

    return success_response({
        'projectUuid': uuid,
        'rowVersion': p.row_version,
        'items': after,
        'contributionWarnings': contribution_report(touched),
        'actualLevelWarnings': warn,
    })


@bp_v2.route('/projects/<uuid>/performances/<perf_uuid>', methods=['DELETE'])
@auth_required
def unlink_project_performance(uuid, perf_uuid):
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    p = Dt2Project.query.filter_by(uuid=uuid).with_for_update().first()
    if p is None:
        return error_response('과제를 찾을 수 없습니다.', status_code=404)
    if not P.can_edit_project(actor, p):
        db.session.rollback()
        return error_response(P.deny_reason(actor, p), status_code=403)

    ln = Dt2ProjectPerformance.query.filter_by(
        project_uuid=uuid, performance_uuid=perf_uuid).first()
    if ln is None:
        db.session.rollback()
        return error_response('연결을 찾을 수 없습니다.', status_code=404)

    before = [_link_dict(ln)]
    db.session.delete(ln)
    _log_link_change(p, before, [], actor, 'ui')
    db.session.commit()
    return success_response({
        'projectUuid': uuid, 'rowVersion': p.row_version,
        'contributionWarnings': contribution_report([perf_uuid]),
    })


# ─────────────────────────────────────────────────────────────────────────────
# 관계도 (읽기 전용 투영)
#
# 저장하는 것이 하나도 없다 — `dt2_*` 를 읽어 노드/엣지로 만들어 줄 뿐이다.
# 규칙은 전부 `graph_view.py` 에 있다. 여기는 질의 문자열을 푸는 얇은 껍데기다.
#
# ★ 권한 (2026-08-09)
#   화면의 **탭 버튼은 admin 에게만** 보인다(`Header.jsx`, 사무국도 뺀다).
#   그런데 **이 API 는 역할로 막지 않는다.** 개발이 끝나면 어차피 모두에게 열
#   것이라, 지금 403 을 걸었다가 나중에 푸는 것은 일만 두 번이기 때문이다.
#
#   그래도 새는 것은 없다 — `build_graph` 가 `can_view_project` 로 과제를 먼저
#   거르고 노드는 전부 거기서 파생된다. 즉 **누가 부르든 자기가 볼 수 있는 것만**
#   나온다. 버튼을 숨긴 것은 "아직 다듬는 중이니 쓰지 말라" 는 안내지
#   비밀을 가리는 장치가 아니다.
# ─────────────────────────────────────────────────────────────────────────────

@bp_v2.route('/graph', methods=['GET'])
@auth_required
def project_graph():
    """
    관계도 한 장.

    질의
        years=2026,2025      비우면 전체
        divisions=MX,VD      비우면 전체
        layers=perf,kpi,dep  비우면 기본값(graph_view.DEFAULT_LAYERS) · `all` 도 된다
        includeDeleted=1     **지금 없는 과제까지** — 휴지통·취소 (기본은 뺀다)
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    layers, unknown = GV.parse_layers(request.args.get('layers'))
    if unknown:
        # 조용히 버리면 화면은 켰다고 믿고 서버는 안 켠 상태가 된다.
        return error_response(
            f'모르는 레이어입니다: {", ".join(unknown)} '
            f'(쓸 수 있는 것: {", ".join(GV.LAYERS)})', status_code=400)

    payload, _ = GV.build_graph(
        actor,
        years=GV._norm_list(request.args.get('years')),
        divisions=GV._norm_list(request.args.get('divisions')),
        layers=layers,
        include_deleted=request.args.get('includeDeleted') in ('1', 'true'),
    )
    return success_response(payload)


@bp_v2.route('/graph/options', methods=['GET'])
@auth_required
def project_graph_options():
    """관계도 필터가 고를 수 있는 값 (볼 수 있는 과제에서만 뽑는다)."""
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    return success_response(GV.filter_options(actor))


# ─────────────────────────────────────────────────────────────────────────────
# 관계도 AI 에이전트
#
# **분석은 파이썬이, 서술은 LLM 이** (`디지털트윈_관계도_AI에이전트_계획.md` §1-①).
# 아래 GET 들은 LLM 을 **전혀 부르지 않는다** — 숫자·순위·경로만 낸다.
# 서술은 `POST /graph/agent/narrate` 로 따로 받는다. 갈라 둔 이유:
#     ① 숫자가 먼저 뜨고 문장이 나중에 붙는다(LLM 이 느려도 화면이 안 멈춘다)
#     ② **LLM 이 죽어도 브리핑은 성립한다** — 그게 이 구조의 실질적 이득이다
# ─────────────────────────────────────────────────────────────────────────────

def _agent_scope():
    """이번 요청의 분석 범위. `(scope, 오류응답)`."""
    actor = _actor()
    if actor is None:
        return None, error_response('로그인이 필요합니다.', status_code=401)
    return GA.Scope(
        actor,
        years=GV._norm_list(request.args.get('years')),
        divisions=GV._norm_list(request.args.get('divisions')),
    ), None


# ─────────────────────────────────────────────────────────────────────────────
# 과제·성과 추이 (읽기 전용)
#
# 서버는 **원시 시계열만** 준다. 단위 환산과 합계·평균은 **화면**이 기존 함수로
# 한다(`trend_view.py` 머리말) — 여기서 다시 구현하면 트리맵과 다른 숫자가 나온다.
# ─────────────────────────────────────────────────────────────────────────────

@bp_v2.route('/trend/projects', methods=['GET'])
@auth_required
def trend_projects():
    """날짜별 사업부별 총 과제 수 (완료 포함·취소 제외, 지워진 날부터 빠진다)."""
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    return success_response(TV.project_trend(
        actor,
        years=GV._norm_list(request.args.get('years')),
        divisions=GV._norm_list(request.args.get('divisions')),
    ))


@bp_v2.route('/trend/performances', methods=['GET'])
@auth_required
def trend_performances():
    """성과 속성 카드별 실적 시계열. **값은 환산 전 원본이다.**"""
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    return success_response(TV.performance_trend(
        actor,
        years=GV._norm_list(request.args.get('years')),
        divisions=GV._norm_list(request.args.get('divisions')),
    ))


@bp_v2.route('/trend/notes', methods=['GET'])
@auth_required
def trend_notes_list():
    """날짜별 변동 사유 메모. 읽기는 탭을 볼 수 있는 사람 전부."""
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    return success_response({
        'notes': TN.list_notes(
            years=GV._norm_list(request.args.get('years')),
            divisions=GV._norm_list(request.args.get('divisions'))),
        # 화면이 편집 버튼을 보일지 말지 — 눌러 보고 403 을 만나게 하지 않는다
        'canEdit': actor.role in P.GLOBAL_EDIT_ROLES,
    })


@bp_v2.route('/trend/changes', methods=['GET'])
@auth_required
def trend_day_changes():
    """
    그날 들어오고 나간 과제. **메모를 쓰기 전에** 무슨 일이 있었는지 보여 준다.

    곡선과 같은 `_project_span` 을 쓰므로 개수가 어긋나지 않는다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    out = TN.day_changes(
        actor, request.args.get('date'),
        years=GV._norm_list(request.args.get('years')),
        divisions=GV._norm_list(request.args.get('divisions')))
    if out.get('error'):
        return error_response(out['error'], status_code=400)
    return success_response(out)


@bp_v2.route('/trend/notes', methods=['POST'])
@auth_required
def trend_notes_save():
    """메모 추가·수정 (사무국·관리자만). `id` 가 있으면 수정이다."""
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    note, err = TN.save_note(actor, request.get_json(silent=True) or {})
    if err:
        return error_response(err, status_code=403 if '권한' in err else 400)
    db.session.commit()
    return success_response({'note': note})


@bp_v2.route('/trend/notes/<note_id>', methods=['DELETE'])
@auth_required
def trend_notes_delete(note_id):
    """메모 삭제 (사무국·관리자만)."""
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    ok, err = TN.delete_note(actor, note_id)
    if err:
        return error_response(err, status_code=403 if '권한' in err else 404)
    db.session.commit()
    return success_response({'deleted': ok})


@bp_v2.route('/graph/agent/gaps', methods=['GET'])
@auth_required
def graph_agent_gaps():
    """0단계 — 데이터 공백 리포트. LLM 을 부르지 않는다."""
    scope, err = _agent_scope()
    if err:
        return err
    return success_response(GA.data_gaps(scope))


@bp_v2.route('/graph/agent/kpi/<int:kpi_id>', methods=['GET'])
@auth_required
def graph_agent_kpi(kpi_id):
    """1단계 — KPI 한 장 브리핑."""
    scope, err = _agent_scope()
    if err:
        return err
    out = GA.kpi_briefing(scope, kpi_id)
    if out.get('error'):
        return error_response(out['error'], status_code=404)
    return success_response(out)


@bp_v2.route('/graph/agent/risky', methods=['GET'])
@auth_required
def graph_agent_risky():
    """3단계 — 위험 지표. 달성률은 KPI 매트릭스와 **같은 계산**을 쓴다."""
    scope, err = _agent_scope()
    if err:
        return err
    years = GV._norm_list(request.args.get('years'))
    # 달성률은 한 해 기준이라야 뜻이 있다. 여러 해가 오면 가장 최근 해로 본다.
    year = None
    if years:
        nums = [int(y) for y in years if str(y).isdigit()]
        year = max(nums) if nums else None
    if year is None:
        year = datetime.utcnow().year
    try:
        limit = max(1, min(int(request.args.get('limit', 5)), 20))
    except (TypeError, ValueError):
        limit = 5
    return success_response(GA.risky_kpis(scope, year, limit))


@bp_v2.route('/graph/agent/hidden', methods=['GET'])
@auth_required
def graph_agent_hidden():
    """4단계 — 숨은 연결 (희소성 가중)."""
    scope, err = _agent_scope()
    if err:
        return err
    try:
        limit = max(1, min(int(request.args.get('limit', GA.HIDDEN_LIMIT)), 50))
    except (TypeError, ValueError):
        limit = GA.HIDDEN_LIMIT
    return success_response(GA.hidden_links(scope, limit))


@bp_v2.route('/graph/agent/stalled', methods=['GET'])
@auth_required
def graph_agent_stalled():
    """멈춘 과제 — **유일하게 시간 축을 여는 분석**(`dt2_project_history`)."""
    scope, err = _agent_scope()
    if err:
        return err
    try:
        days = max(1, min(int(request.args.get('minDays', GA.STALLED_MIN_DAYS)), 365))
    except (TypeError, ValueError):
        days = GA.STALLED_MIN_DAYS
    return success_response(GA.stalled_projects(scope, days))


@bp_v2.route('/graph/agent/schedule', methods=['GET'])
@auth_required
def graph_agent_schedule():
    """일정 쏠림 — 미완료 액션의 목표일이 한 달에 몰린 과제."""
    scope, err = _agent_scope()
    if err:
        return err
    return success_response(GA.schedule_crowding(scope))


@bp_v2.route('/graph/agent/issues', methods=['GET'])
@auth_required
def graph_agent_issues():
    """이슈 적체 — 오래 남은 미해결 이슈, 대응 액션이 없는 과제."""
    scope, err = _agent_scope()
    if err:
        return err
    return success_response(GA.issue_backlog(scope))


@bp_v2.route('/graph/agent/key-projects', methods=['GET'])
@auth_required
def graph_agent_key_projects():
    """중점과제의 말과 실제."""
    scope, err = _agent_scope()
    if err:
        return err
    return success_response(GA.key_project_gap(scope))


@bp_v2.route('/graph/agent/divisions', methods=['GET'])
@auth_required
def graph_agent_divisions():
    """
    사업부별 **데이터 채움**. 진행률·달성률은 **일부러 안 넣는다** —
    기능조직은 자체 지표가 없고 과제 성격도 달라, 나란히 놓으면 구조 때문에
    낮게 보인다(`graph_agent.division_compare` 머리말).
    """
    scope, err = _agent_scope()
    if err:
        return err
    return success_response(GA.division_compare(scope))


@bp_v2.route('/graph/agent/readiness', methods=['GET'])
@auth_required
def graph_agent_readiness():
    """보고 준비도 — 「결과 보고서」 를 쓰기 전 체크리스트."""
    scope, err = _agent_scope()
    if err:
        return err
    return success_response(GA.report_readiness(scope))


@bp_v2.route('/graph/agent/narrate', methods=['POST'])
@auth_required
def graph_agent_narrate():
    """
    분석 결과 → **서술 3~5문장.** 여기서만 LLM 을 부른다.

    본문에 위 GET 들이 돌려준 것을 **그대로** 넣어 보낸다. 서버가 다시 계산하지
    않는 이유는, 다시 계산하면 화면이 보고 있는 숫자와 서술이 갈릴 수 있기 때문이다.

    ⚠️ **실패해도 200 이다.** `narrative: null` + `error` 로 돌려준다 —
       문장이 없다고 이미 화면에 떠 있는 숫자를 오류로 덮으면 안 된다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    body = request.get_json(silent=True) or {}
    payload = body.get('analysis')
    if not isinstance(payload, dict) or not payload.get('kind'):
        return error_response('analysis 에 분석 결과를 그대로 넣어 보내세요.',
                              status_code=400)

    try:
        text = GN.narrate(payload)
        return success_response({'narrative': text, 'error': None})
    except dt_llm.LLMNotConfigured as exc:
        return success_response({'narrative': None, 'error': str(exc)})
    except dt_llm.LLMError as exc:
        return success_response({'narrative': None, 'error': str(exc)})
    except Exception as exc:                                       # noqa: BLE001
        # 서술 실패로 분석을 잃지 않는다. 이유만 알려 준다.
        return success_response({'narrative': None,
                                 'error': f'서술 생성에 실패했습니다: {exc}'})


# ─────────────────────────────────────────────────────────────────────────────
# 과제 ↔ 과제 (선행과제)
#
# 이것만 **과제끼리 잇는 엣지**다. 성과·KPI 연결은 과제에서 다른 종류로 나가지만,
# 여기는 같은 종류 안에서 방향을 갖는다 — 그래서 다음 두 가지가 더 필요하다.
#
#   비순환   A→B→A 가 되면 "이 과제 이전에 무엇이 있었나" 를 따라가는 순회가 끝나지
#            않는다. DB 제약으로는 못 막으므로 **쓰기 경로가 막는다**(`_dep_cycle_error`).
#   역방향   같은 행이 반대에서 보면 '후속 과제'다. 행을 따로 만들지 않고 조회로 낸다.
#            행을 두 벌 두면 반드시 한쪽만 지워지는 날이 온다.
#
# 이력 (2026-07-31 ~ 2026-08-08)
#     테이블·이관·읽기는 있는데 **쓰기 API 만 없었다.** 그래서 이 필드가 바뀐 저장은
#     통째로 V1 으로 물러섰고, 컷오버 뒤에는 그게 조용한 손실이 됐다(V1 에 쓰이고
#     dt2 는 안 바뀌어 새로고침하면 사라진다). 편집 UI 를 숨겨 두었다가 이 API 로
#     되살렸다. `RELATION_FIELDS_WITHOUT_API` 가 비게 된 것이 그 뜻이다.
# ─────────────────────────────────────────────────────────────────────────────

# 사이클 탐색 상한. 정상 데이터에서는 닿을 일이 없다 —
# 손상된 데이터(이미 사이클이 있는 상태)에서도 반드시 끝나게 하는 안전장치다.
_DEP_MAX_WALK = 5000


def _dep_dict(dep_uuid, target=None):
    """
    선행과제 1건. **표시 필드는 지금의 대상 과제에서 읽는다** — 연결 행에 베껴 둔
    사본을 쓰면 대상 과제 이름을 바꾼 뒤에도 옛 이름이 뜬다.
    """
    return {
        'dependsOnUuid': dep_uuid,
        'code': target.code if target is not None else None,
        'title': target.title if target is not None else None,
        'division': target.division if target is not None else None,
        'year': target.year if target is not None else None,
        'plName': target.pl_name if target is not None else None,
        'status': target.status if target is not None else None,
        # 대상 과제가 사라진 연결. 화면이 '(삭제된 과제)' 로 보여줄 수 있게 알린다 —
        # 조용히 빼면 사용자는 연결을 지운 적이 없는데 하나가 없어졌다고 느낀다.
        'missing': target is None,
        # 휴지통에 있는 과제. `missing` 과 다르다 — 되살아날 수 있어서 연결을 끊지 않는다.
        # 이 값이 없으면 화면이 지워진 과제를 멀쩡한 것처럼 보여주게 된다
        # (편집창 후보 목록에서 실제로 그랬다: `/data` 가 소프트 삭제 과제도 함께 준다).
        'isDeleted': bool(target.is_deleted) if target is not None else False,
    }


def _dep_rows(project_uuid):
    """
    이 과제의 선행과제 행. **순서는 넣은 순서(id)** 다.

    `position` 컬럼을 두지 않았다 — 선행 관계에는 표시 순서에 의미가 없고,
    순서 컬럼을 만들면 그것만 어긋나는 자리가 하나 더 생긴다.
    """
    return (Dt2ProjectDependency.query
            .filter_by(project_uuid=project_uuid)
            .order_by(Dt2ProjectDependency.id.asc())
            .all())


def _projects_by_uuid(uuids):
    uuids = [u for u in dict.fromkeys(uuids) if u]
    if not uuids:
        return {}
    return {p.uuid: p for p in Dt2Project.query.filter(Dt2Project.uuid.in_(uuids)).all()}


def _deps_of(project_uuid):
    """(표시용 dict 목록). 대상 과제를 한 번에 읽어 붙인다."""
    rows = _dep_rows(project_uuid)
    targets = _projects_by_uuid([r.depends_on_uuid for r in rows])
    return [_dep_dict(r.depends_on_uuid, targets.get(r.depends_on_uuid)) for r in rows]


def _successors_of(project_uuid):
    """
    이 과제를 **선행으로 삼는** 과제들. 읽기 전용이다.

    같은 행을 반대에서 본 것이라 저장할 것이 없다. 여기서 편집하게 하면 한 관계를
    양쪽에서 고칠 수 있게 되고, 두 화면이 서로를 덮어쓴다.
    """
    rows = (db.session.query(Dt2ProjectDependency.project_uuid)
            .filter(Dt2ProjectDependency.depends_on_uuid == project_uuid)
            .all())
    targets = _projects_by_uuid([r[0] for r in rows])
    out = []
    for (puid,) in rows:
        t = targets.get(puid)
        if t is None or t.is_permanently_deleted:
            continue
        out.append(_dep_dict(puid, t))
    out.sort(key=lambda d: ((d['year'] or 0), d['code'] or '', d['title'] or ''))
    return out


def _dep_cycle_error(project_uuid, wanted):
    """
    `project_uuid` 가 `wanted` 를 선행으로 삼으면 순환이 생기는가.
    생기면 오류 문구, 아니면 None.

    엣지의 뜻은 "project_uuid 는 depends_on_uuid **뒤에** 온다" 이므로,
    각 대상에서 그 대상의 선행을 계속 따라 올라가다가 자기 자신에 닿으면 순환이다.

    ⚠️ 이 과제의 **기존 행은 셈에서 뺀다.** 통째로 교체하는 중이라 곧 사라질 것들이다.
       빼지 않으면 "A→B 를 지우면서 B→A 를 넣는" 정상적인 교체가 거절된다.
    """
    wanted = [u for u in dict.fromkeys(wanted) if u]
    if not wanted:
        return None

    edges = {}
    for row in db.session.query(Dt2ProjectDependency.project_uuid,
                                Dt2ProjectDependency.depends_on_uuid).all():
        src, dst = row
        if src == project_uuid:
            continue                      # 지금 교체되는 것 — 없는 셈 친다
        edges.setdefault(src, []).append(dst)

    seen = set()
    frontier = list(wanted)
    steps = 0
    while frontier:
        steps += 1
        if steps > _DEP_MAX_WALK:
            # 여기 닿았다는 것은 이미 데이터가 손상됐다는 뜻이다. 통과시키지 않는다.
            return ('선행 과제 관계가 너무 깊거나 이미 순환이 있어 확인하지 못했습니다. '
                    '관리자에게 알려주세요.')
        node = frontier.pop()
        if node == project_uuid:
            return ('선행 과제가 서로를 가리키게 됩니다(순환). '
                    '이 과제를 이미 선행으로 삼고 있는 과제는 선행으로 지정할 수 없습니다.')
        if node in seen:
            continue
        seen.add(node)
        frontier.extend(edges.get(node, ()))
    return None


def _validate_dep_items(p, actor, items):
    """
    선행과제 항목 검증. 통과하면 (uuid 목록, None), 아니면 (None, 오류응답).

    막는 것
        · 자기 자신
        · 없는 과제
        · **영구 삭제된** 과제 (소프트 삭제는 통과시킨다 — 휴지통에서 되살릴 수 있고,
          기존 연결을 그대로 다시 저장하는 것까지 막으면 그 과제를 저장할 수 없게 된다)
        · 볼 수 없는 과제 (사업부 내 공개 과제의 제목이 새 나가는 자리다)
        · 중복
        · 순환
    """
    wanted = []
    for it in items:
        if not isinstance(it, dict):
            return None, error_response('items 원소는 모두 객체여야 합니다.', status_code=400)
        raw = it.get('dependsOnUuid') or it.get('uuid')
        if not raw:
            return None, error_response('dependsOnUuid 가 필요합니다.', status_code=400)
        wanted.append(str(raw))

    if p.uuid in wanted:
        return None, error_response('과제 자신을 선행 과제로 지정할 수 없습니다.',
                                    status_code=400)
    if len(set(wanted)) != len(wanted):
        return None, error_response('같은 과제를 두 번 선행으로 지정할 수 없습니다.',
                                    status_code=400)

    targets = _projects_by_uuid(wanted)
    missing = [u for u in wanted if u not in targets]
    if missing:
        # 사람이 할 수 있는 일을 말해 준다. uuid 만 늘어놓으면 화면 앞의 사람은
        # 그게 어느 줄인지 알 수 없다 — 옛 데이터에 이미 끊긴 연결이 있을 수 있고
        # (대상 과제가 영구 삭제된 경우), 그러면 그 과제는 선행 연결을 영영 못 고친다.
        # 편집창은 그런 줄을 '삭제되었거나 볼 수 없는 과제' 로 흐리게 보여 준다.
        return None, error_response(
            f'이미 없어진 과제를 가리키는 연결이 {len(missing)}건 있습니다. '
            f'목록에서 "삭제되었거나 볼 수 없는 과제" 로 표시된 줄을 지운 뒤 저장하세요.',
            errors=missing, status_code=400)

    gone = [u for u in wanted if targets[u].is_permanently_deleted]
    if gone:
        titles = [targets[u].title or u for u in gone[:5]]
        return None, error_response(
            f'영구 삭제된 과제는 선행으로 지정할 수 없습니다: {", ".join(titles)}',
            errors=gone, status_code=400)

    hidden = [u for u in wanted if not P.can_view_project(actor, targets[u])]
    if hidden:
        return None, error_response(
            f'볼 수 없는 과제는 선행으로 지정할 수 없습니다 ({len(hidden)}건).',
            errors=hidden, status_code=403)

    cyc = _dep_cycle_error(p.uuid, wanted)
    if cyc:
        return None, error_response(cyc, status_code=400)

    return wanted, None


def _replace_deps(p: Dt2Project, wanted, actor, source, reason=None):
    """
    과제의 선행과제 연결을 통째로 교체하고, 달라졌으면 변경 로그를 남긴다.
    호출부는 `_validate_dep_items` 를 통과한 뒤 부른다.

    돌려주는 것: (before, after)
    """
    before = _deps_of(p.uuid)

    Dt2ProjectDependency.query.filter_by(project_uuid=p.uuid).delete()
    db.session.flush()

    targets = _projects_by_uuid(wanted)
    for dep_uuid in wanted:
        t = targets.get(dep_uuid)
        # `extra_fields` 는 V1 `선행과제목록` 원소를 되돌리기 위한 자리다(assemble.py).
        # 표시 필드는 사본이라 낡을 수 있으므로, **읽을 때** 살아 있는 행으로 덮어쓴다.
        # 여기 넣어 두는 것은 대상 과제가 사라진 뒤에도 무엇이었는지 남기기 위해서다.
        db.session.add(Dt2ProjectDependency(
            project_uuid=p.uuid,
            depends_on_uuid=dep_uuid,
            extra_fields={
                'uuid': dep_uuid,
                '과제명': (t.title or '') if t is not None else '',
                '사업부': (t.division or '') if t is not None else '',
                '과제년도': (t.year if t is not None and t.year is not None else ''),
                '과제PL': (t.pl_name or '') if t is not None else '',
            },
        ))
    db.session.flush()

    after = _deps_of(p.uuid)
    if before != after:
        _log_link_change(p, before, after, actor, source, reason, field='dependencies')
    return before, after


@bp_v2.route('/projects/<uuid>/dependencies', methods=['GET'])
@auth_required
def list_project_dependencies(uuid):
    """
    이 과제의 **선행 과제**(items)와 **후속 과제**(successors).

    후속은 읽기 전용이다 — 같은 행을 반대에서 본 것이라 여기서 고칠 것이 없다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    p = Dt2Project.query.filter_by(uuid=uuid).first()
    if p is None:
        return error_response('과제를 찾을 수 없습니다.', status_code=404)
    if not P.can_view_project(actor, p):
        return error_response('이 과제를 볼 권한이 없습니다.', status_code=403)

    return success_response({
        'projectUuid': uuid,
        'rowVersion': p.row_version,
        'canEdit': P.can_edit_project(actor, p),
        'items': _deps_of(uuid),
        'successors': _successors_of(uuid),
    })


@bp_v2.route('/projects/<uuid>/dependencies', methods=['PUT'])
@auth_required
def replace_project_dependencies(uuid):
    """
    과제의 선행 과제 연결을 **통째로 교체**한다. (성과 연결 PUT 과 같은 모양)

    본문
        items            [{dependsOnUuid}, ...]  — `uuid` 키로 보내도 받는다
        expected_version 과제의 row_version (선택)
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    body = request.get_json(silent=True) or {}
    if body.get('actor_mode') == 'ai':
        # KPI 연결과 같은 이유로 막는다. 선행 관계는 **사람이 선언하는 계보**다 —
        # 이 과제가 무엇을 이어받았는가는 문서에 안 적혀 있는 경우가 대부분이고,
        # LLM 이 제목이 비슷하다는 이유로 이으면 없던 이력이 데이터가 된다.
        # 게다가 이 엣지는 앞으로 그래프 순회의 뼈대가 되므로 틀리면 멀리 퍼진다.
        return error_response('AI 는 선행 과제 연결을 변경할 수 없습니다.', status_code=403)

    items = body.get('items')
    if not isinstance(items, list):
        return error_response('items 는 배열이어야 합니다.', status_code=400)

    p = Dt2Project.query.filter_by(uuid=uuid).with_for_update().first()
    if p is None:
        return error_response('과제를 찾을 수 없습니다.', status_code=404)
    if not P.can_edit_project(actor, p):
        db.session.rollback()
        return error_response(P.deny_reason(actor, p), status_code=403)

    expected, verr = _expected_version(body)
    if verr:
        db.session.rollback()
        return error_response(verr, status_code=400)
    if expected is not None and expected != p.row_version:
        db.session.rollback()
        return error_response(
            '다른 사용자가 이 과제를 먼저 수정했습니다. 새로고침 후 다시 시도하세요.',
            status_code=409)

    wanted, verr2 = _validate_dep_items(p, actor, items)
    if verr2:
        db.session.rollback()
        return verr2

    _before, after = _replace_deps(p, wanted, actor, 'ui', body.get('reason'))
    db.session.commit()

    return success_response({
        'projectUuid': uuid,
        'rowVersion': p.row_version,
        'items': after,
        'successors': _successors_of(uuid),
    })


@bp_v2.route('/projects/<uuid>/dependencies/<dep_uuid>', methods=['DELETE'])
@auth_required
def unlink_project_dependency(uuid, dep_uuid):
    """선행 과제 연결 1건 해제. (성과 연결 DELETE 와 같은 모양)"""
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    p = Dt2Project.query.filter_by(uuid=uuid).with_for_update().first()
    if p is None:
        return error_response('과제를 찾을 수 없습니다.', status_code=404)
    if not P.can_edit_project(actor, p):
        db.session.rollback()
        return error_response(P.deny_reason(actor, p), status_code=403)

    row = Dt2ProjectDependency.query.filter_by(
        project_uuid=uuid, depends_on_uuid=dep_uuid).first()
    if row is None:
        db.session.rollback()
        return error_response('연결을 찾을 수 없습니다.', status_code=404)

    before = _deps_of(uuid)
    db.session.delete(row)
    db.session.flush()
    after = _deps_of(uuid)
    _log_link_change(p, before, after, actor, 'ui', field='dependencies')
    db.session.commit()
    return success_response({
        'projectUuid': uuid, 'rowVersion': p.row_version, 'items': after,
    })


# ─────────────────────────────────────────────────────────────────────────────
# 과제 ↔ DX KPI 연결
#
# 성과 연결(위)과 **의도적으로 다르다.**
#   성과   금액·시간이라 여러 과제가 물리면 쪼개야 한다 → 기여도(가중치)가 있다
#   KPI    비율·건수 지표라 쪼갤 게 없다 → 연관이 있는가 없는가뿐이다
# 그래서 여기엔 가중치도, 주/부 구분도, 순서도 없다. (models_v2.Dt2ProjectKpi 주석)
#
# KPI 정의 자체(`kpi_definitions`)는 dx_kpi_management 모듈 소유다. 여기서는 **읽기만**
# 한다 — 정의를 이쪽에서 만들거나 고치면 두 모듈이 같은 표를 각자 관리하게 된다.
# ─────────────────────────────────────────────────────────────────────────────

# 기여 등급 (2026-08-06). `dt2_project_kpi.relation_type` 에 넣는다.
#
# ⚠️ **더하면 안 되는 값이다.** 순서척도라 '주 1건'과 '간접 3건'을 비교할 근거가 없다.
#    세는 것은 등급별로 따로 센다. 그래프에서 굵기로 쓸 때도 합이 아니라 범주다.
#
# 판정 기준 (화면 툴팁과 **같은 문구를 쓴다** — 두 곳이 갈리면 사람마다 다르게 채운다)
#   primary   이 과제가 없으면 그 KPI 목표 달성이 어렵다
#   support   기여하지만 다른 과제로도 대체 가능하다
#   indirect  기반·환경을 만든다 (플랫폼·표준화 등)
#   None      미지정 — 아직 안 정함. **일괄로 채우지 않는다**(없는 데이터를 지어내는 것)
KPI_RELATION_TYPES = ('primary', 'support', 'indirect')
# 사람이 읽는 이름. 일괄 편집 미리보기가 이 문구를 그대로 보여 준다 —
# 'primary' 를 화면에 내면 저장된 값과 화면 어휘가 갈린다.
KPI_RELATION_LABEL = {'primary': '주기여', 'support': '보조기여',
                      'indirect': '간접기여', None: '등급 미지정'}


def _resolve_link_target(p, kid, raw_target, kpi_scope, divisions):
    """
    연결 1건의 **대상 사업부**를 확정한다. `(target, 오류문구)` 를 돌려준다.

    한 곳에만 둔다 — 과제 하나짜리 PUT 과 일괄 POST 가 규칙을 따로 구현하면
    반드시 갈리고, 갈리는 순간 "화면에서는 되는데 일괄로는 안 되는" 칸이 생긴다.

    규칙 (2026-08-01 결정)
      · 사업부 과제   자기 사업부 **고정**. 다른 값이 오면 조용히 고치지 않고 알린다
      · 기능조직 과제 지원할 사업부를 **반드시 지목**해야 한다 (자기 사업부엔 지표가 없다)
      · 어느 쪽이든 그 사업부가 실제로 그 지표를 관리해야 한다
    """
    owners = {d['name']: d for d in divisions if d['isKpiOwner']}
    own = next((d for d in divisions if d['name'] == (p.division or '')), None)
    is_functional = own is not None and not own['isKpiOwner']

    target = str(raw_target).strip() if raw_target not in (None, '') else ''

    if not is_functional:
        if target and target != (p.division or ''):
            return None, (f'{p.division} 과제는 자기 사업부의 지표만 연결할 수 있습니다 '
                          f'(보낸 대상: {target}).')
        target = p.division or ''
        if not target:
            return None, ('과제에 사업부가 지정되어 있지 않아 KPI 를 연결할 수 없습니다. '
                          '기본정보에서 사업부를 먼저 지정하세요.')
    elif not target:
        return None, f'{p.division} 은(는) 기능조직이라 지원할 사업부를 골라야 합니다.'

    if target not in owners:
        return None, f'{target} 은(는) DX KPI 를 관리하는 사업부가 아닙니다.'

    # 사업부 전용 지표를 엉뚱한 사업부 대상으로 걸 수 없다.
    if kpi_scope and owners[target]['code'] not in kpi_scope:
        return None, (f'이 지표는 {target} 에서 관리하지 않습니다 '
                      f'(대상: {", ".join(kpi_scope)}).')
    return target, None


def _resolve_kpi_items(p, items):
    """
    KPI 연결 요청을 **검증하고 확정한다.** `(resolved, 오류응답)`.

    `resolved` 는 `[{kpiDefinitionId, targetDivision, relationType, note}]` — 대상
    사업부까지 확정된 모양이라, 그대로 저장해도 되고 제안 큐에 담아도 된다.

    ⚠️ 화면 PUT 과 **AI 제안 승인이 같은 함수를 지난다.** 갈라 두면 "화면에서는
       되는데 승인으로는 안 되는" 조합이 생긴다 (`_replace_links` 와 같은 이유).
       대상 사업부 규칙 자체는 `_resolve_link_target` 이 정본이다.
    """
    from app.modules.dx_kpi_management.models import KpiDefinition

    if not isinstance(items, list):
        return None, error_response('items 는 배열이어야 합니다.', status_code=400)
    if not all(isinstance(it, dict) for it in items):
        return None, error_response('items 원소는 모두 객체여야 합니다.', status_code=400)

    wanted = []
    for it in items:
        raw = it.get('kpiDefinitionId')
        try:
            wanted.append(int(raw))
        except (TypeError, ValueError):
            return None, error_response(
                f'kpiDefinitionId 는 정수여야 합니다: {raw!r}', status_code=400)

    found = {r[0]: r[1] for r in db.session.query(
        KpiDefinition.id, KpiDefinition.divisions)
        .filter(KpiDefinition.id.in_(wanted)).all()} if wanted else {}
    missing = [i for i in wanted if i not in found]
    if missing:
        return None, error_response(
            f'존재하지 않는 KPI 입니다: {", ".join(str(m) for m in missing[:5])}',
            errors=missing, status_code=400)

    divisions = _kpi_owner_divisions()
    resolved = []
    for it, kid in zip(items, wanted):
        target, terr = _resolve_link_target(p, kid, it.get('targetDivision'),
                                            found.get(kid) or [], divisions)
        if terr:
            return None, error_response(terr, status_code=400)

        # 기여 등급 — 셋 중 하나이거나 미지정(null). 그 외는 400 으로 거절한다.
        # 조용히 null 로 떨구면 "골라 보냈는데 저장이 안 된" 상태가 된다.
        rel = it.get('relationType')
        if rel not in (None, '') and rel not in KPI_RELATION_TYPES:
            return None, error_response(
                f'기여 등급은 {", ".join(KPI_RELATION_TYPES)} 중 하나여야 합니다 '
                f'(받은 값 {rel!r}).', status_code=400)

        note = it.get('note')
        note = str(note).strip()[:300] if note not in (None, '') else None
        resolved.append({
            'kpiDefinitionId': kid,
            'targetDivision': target,
            'relationType': rel if rel in KPI_RELATION_TYPES else None,
            'note': note,
        })

    pairs = [(r['kpiDefinitionId'], r['targetDivision']) for r in resolved]
    if len(set(pairs)) != len(pairs):
        return None, error_response(
            '같은 KPI 를 같은 대상 사업부에 두 번 연결할 수 없습니다.', status_code=400)
    return resolved, None


def _replace_kpi_links(p, resolved, actor, source, reason):
    """확정된 KPI 연결로 **통째 교체**하고 변경 로그를 남긴다. 바뀐 게 있으면 True."""
    before = [_kpi_link_dict(ln, kdef) for ln, kdef in _kpi_links_of(p.uuid)]

    Dt2ProjectKpi.query.filter_by(project_uuid=p.uuid).delete()
    db.session.flush()
    for r in resolved:
        db.session.add(Dt2ProjectKpi(
            project_uuid=p.uuid,
            kpi_definition_id=r['kpiDefinitionId'],
            target_division=r['targetDivision'],
            note=r['note'],
            # 미지정은 None 으로 남긴다. 기본값을 넣지 않는다 —
            # '보조기여' 같은 걸 채우면 아무도 판단하지 않은 값이 데이터가 된다.
            relation_type=r['relationType'],
            created_by=actor.id,
        ))
    db.session.flush()

    after = [_kpi_link_dict(ln, kdef) for ln, kdef in _kpi_links_of(p.uuid)]
    if before != after:
        _log_link_change(p, before, after, actor, source, reason, field='kpi_links')
        return True
    return False


def _kpi_preview_rows(resolved):
    """승인 화면이 사람에게 보여줄 모양 — **지표 이름까지** 채워서.

    id 만 보여주면 승인자는 무엇에 동의하는지 알 수 없다. 그게 이 연결을 AI 에게
    막아 뒀던 이유("빈칸이 가짜로 메워진다")를 푸는 유일한 방법이라,
    이름이 안 풀리면 그 사실도 그대로 드러낸다.
    """
    from app.modules.dx_kpi_management.models import KpiDefinition

    ids = sorted({r['kpiDefinitionId'] for r in resolved})
    labels = ({k.id: k.label for k in KpiDefinition.query
               .filter(KpiDefinition.id.in_(ids)).all()} if ids else {})
    return [dict(r, label=labels.get(r['kpiDefinitionId'], f"(이름 없음 #{r['kpiDefinitionId']})"))
            for r in resolved]


def _join_methods(methods):
    """기여 방법 목록 → note 문자열. 300자를 넘으면 `(None, 오류)`.

    한 줄이 잘려 뜻이 달라지느니 그 칸을 통째로 건너뛰고 **왜 건너뛰었는지 말한다.**
    과제 하나씩 고칠 때는 화면이 미리 막지만, 일괄은 사람이 한 칸씩 보지 않는다.
    """
    text = NOTE_SEP.join(methods)
    if len(text) > 300:
        return None, f'기여방법이 300자를 넘습니다 ({len(text)}자).'
    return (text or None), None



def _kpi_link_dict(ln, kdef=None):
    """연결 1건 + (있으면) 지표 정의를 화면이 쓰는 모양으로."""
    return {
        'kpiDefinitionId': ln.kpi_definition_id,
        'targetDivision': ln.target_division or '',
        # 미지정은 null 로 낸다 — 빈 문자열로 내면 '골랐는데 비어 있음' 과 구분이 안 된다
        'relationType': ln.relation_type or None,
        'label': kdef.label if kdef is not None else None,
        'category': kdef.category if kdef is not None else None,
        'unit': kdef.unit if kdef is not None else None,
        # 지표가 어느 사업부 것인지. 화면이 '전사 공통' 과 '사업부 전용' 을 구분해 보여준다.
        'divisions': (kdef.divisions or []) if kdef is not None else [],
        'note': ln.note,
    }


def _kpi_links_of(project_uuid):
    """
    연결 목록. 정렬은 **`kpi_definitions.sort_order`** 를 따른다.

    연결 테이블에 순서를 따로 두지 않은 이유가 이것이다 — 후보 목록과 연결 목록이
    같은 순서로 보여야 사람이 대조할 수 있다. 두 순서를 각자 관리하면 반드시 갈린다.
    """
    from app.modules.dx_kpi_management.models import KpiDefinition

    rows = (db.session.query(Dt2ProjectKpi, KpiDefinition)
            .outerjoin(KpiDefinition,
                       KpiDefinition.id == Dt2ProjectKpi.kpi_definition_id)
            .filter(Dt2ProjectKpi.project_uuid == project_uuid)
            .order_by(KpiDefinition.sort_order.asc().nullslast(),
                      Dt2ProjectKpi.kpi_definition_id.asc(),
                      Dt2ProjectKpi.target_division.asc())
            .all())
    return rows


def _kpi_owner_divisions():
    """
    DX KPI 를 직접 관리하는 사업부. **매트릭스의 열이자 연결의 대상 후보**다.

    코드에 이름을 박지 않는다 — 조직이 바뀌면 화면이 조용히 틀어진다.
    `code` 를 함께 준다: 프론트가 자기 매핑표를 들면 반드시 서버와 갈린다
    (`field_maps.DIVISION_KPI_CODE` 가 단일 출처).
    """
    rows = (Division.query
            .filter(Division.is_active.is_(True))
            .order_by(Division.order.asc(), Division.id.asc())
            .all())
    return [{
        'name': d.name,
        'color': d.color,
        'code': division_kpi_code(d.name),
        'isKpiOwner': bool(d.is_kpi_owner),
    } for d in rows]


@bp_v2.route('/projects/<uuid>/kpi-links', methods=['GET'])
@auth_required
def list_project_kpi_links(uuid):
    """
    이 과제가 연결된 DX KPI 목록.

    후보 목록(`available`)을 같이 준다 — 화면이 dx-kpi-management API 를 따로 부르지
    않아도 되고, 무엇보다 **정렬·사업부 판정 규칙이 서버 한 곳에만 있게 된다.**
    """
    from app.modules.dx_kpi_management.models import KpiDefinition

    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    p = Dt2Project.query.filter_by(uuid=uuid).first()
    if p is None:
        return error_response('과제를 찾을 수 없습니다.', status_code=404)
    if not P.can_view_project(actor, p):
        return error_response('이 과제를 볼 권한이 없습니다.', status_code=403)

    rows = _kpi_links_of(uuid)
    defs = (KpiDefinition.query
            .order_by(KpiDefinition.sort_order.asc(), KpiDefinition.id.asc())
            .all())

    divisions = _kpi_owner_divisions()
    own = next((d for d in divisions if d['name'] == (p.division or '')), None)
    # 자기 사업부가 KPI 를 관리하지 않으면(GTR·SR·CS) **기능조직**이다.
    # 이 과제는 지원할 사업부를 직접 골라야 한다 — 자기 사업부엔 지표가 없다.
    is_functional = own is not None and not own['isKpiOwner']

    return success_response({
        'projectUuid': uuid,
        'rowVersion': p.row_version,
        'canEdit': P.can_edit_project(actor, p),
        'items': [_kpi_link_dict(ln, kdef) for ln, kdef in rows],
        'available': [{
            'kpiDefinitionId': d.id,
            'label': d.label,
            'category': d.category,
            'unit': d.unit,
            'divisions': d.divisions or [],
            # 'metric' 측정되는 지표 / 'platform' 플랫폼 구축(측정값 없음).
            # 화면이 둘을 다른 자리에 보여준다 — 고르는 이유가 다르기 때문이다.
            'kind': d.kind or 'metric',
        } for d in defs],
        'projectDivision': p.division,
        'divisions': divisions,
        'isFunctionalOrg': is_functional,
        # 기능조직이면 비어 있다 — 화면이 고르게 해야 한다.
        # 아니면 자기 사업부 하나. (2026-08-01 결정: 사업부 과제가 남의 지표를 미는
        # 경우는 없다. 서버도 그 규칙을 강제한다 — 아래 PUT 참조)
        'defaultTargets': [] if is_functional else ([p.division] if own else []),
    })


def _kpi_metrics(defs, divisions, year, period=None):
    """
    매트릭스 셀의 목표·실적·달성률. **(지표 × KPI보유 사업부) 전 조합**을 돌려준다.

    왜 서버가 계산하나
        달성률 규칙(망대/망소·분수 목표·0 나눗셈)이 화면마다 따로 있었고 둘이 달랐다.
        `dx_kpi_management.achievement` 가 유일한 출처다 — 그 파일 머리말 참조.

    왜 '해당 없음' 까지 서버가 판정하나
        지표는 사업부 전용일 수 있다(예: 디지털 인체 팬텀 = medical). 그 판정은
        사업부 이름 → 코드 매핑을 알아야 하는데, 화면이 그 표를 따로 들면 반드시
        서버와 갈린다. 갈리면 **실적이 엉뚱한 열에 붙는다** — 빗금 위치가 어긋나는
        것과 달리 이건 숫자가 틀리는 사고다. 그래서 판정까지 여기서 한다.

    기간
        period 없음  연 목표(Q4→Q1 첫 유효값) 대비 **오늘까지의 최신 실적**.
                     "올해 잘 가고 있나" 를 묻는 매트릭스의 기본값이고,
                     DT 대시보드 '전체 요약' 과 같은 규칙이라 두 화면이 안 갈린다.
        period 있음  그 기간의 목표(없으면 분기로 폴백) 대비 그 기간 내 최신 실적.

    돌려주는 것
        (metrics, unmatched)
        unmatched 는 실적/목표가 **한 건도 안 붙은** 지표다. 두 표가 라벨 문자열로
        물려 있어(kpi_records.kpi) 라벨이 어긋나면 조용히 빈칸이 되는데, 그걸
        '아직 입력 안 함' 과 구분할 수 있어야 한다.
    """
    from app.modules.dx_kpi_management.models import KpiRecord, KpiTarget
    from app.modules.dx_kpi_management import achievement as A

    kind = A.period_kind(period) if period else None
    if period and kind is None:
        period = None          # 알 수 없는 기간은 무시하고 연 기준으로 (조용히 비우지 않는다)

    rq = KpiRecord.query
    if year is not None:
        rq = rq.filter(KpiRecord.base_date.like(f'{year}%'))
    records = rq.all()

    tq = KpiTarget.query
    if year is not None:
        tq = tq.filter(KpiTarget.year == year)
    targets = {}
    for t in tq.all():
        targets[f'{t.division}|{t.year}|{t.kpi}|{t.period}'] = {
            'value': t.target_value,
            'numerator': t.target_numerator,
            'denominator': t.target_denominator,
        }

    # (사업부, 지표라벨) → 실적 목록. 둘 다 이름/라벨 문자열이 키다.
    by_cell = {}
    for r in records:
        by_cell.setdefault((r.division, r.kpi), []).append(r)

    today = datetime.utcnow().strftime('%Y-%m-%d')
    owners = [d for d in divisions if d.get('isKpiOwner')]

    metrics = []
    matched_labels = set()

    for d in defs:
        # 플랫폼 구축은 **측정값이 없다.** 목표·실적·달성률을 계산하지 않고
        # 상태를 'platform' 으로 둔다 — 'no_target'(목표 미설정)으로 두면
        # "목표를 세우라" 는 안건 목록에 섞여, 세울 수 없는 목표를 요구하게 된다.
        if (d.kind or 'metric') != 'metric':
            for div in owners:
                metrics.append({
                    'kpiDefinitionId': d.id,
                    'division': div['name'],
                    'applicable': True,          # 어느 사업부든 플랫폼을 만들 수 있다
                    'target': None, 'actual': None, 'achievement': None,
                    'status': 'platform',
                    'baseDate': None, 'prevActual': None, 'prevBaseDate': None,
                    'change': None, 'trend': None,
                })
            matched_labels.add(d.label)   # 실적이 없는 게 정상이라 '미매칭' 이 아니다
            continue

        for div in owners:
            applicable = A.is_applicable(d.divisions, div['code'])
            cell = by_cell.get((div['name'], d.label), [])

            direction = d.direction or 'higher'

            if period:
                inPeriod = [r for r in cell if A.period_of(r.base_date, kind) == period]
                target = A.period_target(targets, div['name'], year, d.label, period) \
                    if year is not None else None
                latest = A.pick_latest(inPeriod)
                # 직전 기간의 마지막 실적. 분기/월을 한 칸 되돌린다.
                prevP = A.previous_period(period)
                prev = A.pick_latest(
                    [r for r in cell if A.period_of(r.base_date, kind) == prevP]) \
                    if prevP else None
            else:
                target = A.yearly_target(targets, div['name'], year, d.label) \
                    if year is not None else None
                latest = A.pick_latest(cell, up_to=today)
                # 연 기준에서는 '직전 측정' 이 직전이다 — 최신 하나를 빼고 다시 고른다.
                prev = A.pick_latest(
                    [r for r in cell if r.id != latest.id], up_to=today) \
                    if latest is not None else None

            actual = A.to_number(latest.value) if latest is not None else None
            prevActual = A.to_number(prev.value) if prev is not None else None
            rate = A.achievement(target, actual, direction)

            if target is not None or actual is not None:
                matched_labels.add(d.label)

            metrics.append({
                'kpiDefinitionId': d.id,
                'division': div['name'],
                'applicable': applicable,
                'target': target,
                'actual': actual,
                'achievement': round(rate, 1) if rate is not None else None,
                'status': A.status(rate,
                                   has_target=target is not None,
                                   has_actual=actual is not None,
                                   applicable=applicable),
                'baseDate': latest.base_date if latest is not None else None,
                # 직전 대비. **좋아졌는지는 서버가 판정한다** — 망소는 내려가야
                # 좋아진 것이라, 화면이 다시 판단하면 화살표 방향이 거짓말을 한다.
                'prevActual': prevActual,
                'prevBaseDate': prev.base_date if prev is not None else None,
                'change': A.change_of(prevActual, actual, direction),
                # 스파크라인용 월별 실적 12칸 (없는 달은 null)
                'trend': A.monthly_series(cell, year) if year is not None else None,
            })

    # 목표도 실적도 어디에도 안 붙은 지표. 라벨 어긋남과 미입력을 화면이 구분하려면
    # 개수만으로는 부족해서 라벨을 같이 준다.
    unmatched = [{'kpiDefinitionId': d.id, 'label': d.label}
                 for d in defs if d.label not in matched_labels]

    return metrics, unmatched


#
# 기여 방법은 `dt2_project_kpi.note` 에 **줄바꿈으로 이어 붙여** 여러 개를 담는다.
#
#   왜 컬럼을 안 바꾸나 — `note` 는 `String(300)` 이고 화면 입력은 한 줄짜리 `<input>`
#   이었다. 즉 **기존 값에는 줄바꿈이 없다.** 그래서 줄바꿈을 구분자로 삼으면 옛 값이
#   그대로 '방법 1개' 로 읽히고, 마이그레이션도 재해석도 필요 없다.
#   JSON 컬럼으로 바꾸면 이걸 읽는 화면·보고서·MCP 를 전부 같이 고쳐야 한다.
#
NOTE_SEP = '\n'


def _note_methods(note):
    """note 문자열 → 기여 방법 목록. 빈 줄은 버린다."""
    return [x.strip() for x in str(note or '').split(NOTE_SEP) if x.strip()]


@bp_v2.route('/kpi-contribution-methods/rename', methods=['POST'])
@auth_required
def rename_kpi_contribution_method():
    """
    기여 방법 문구를 **그 지표의 모든 연결에서 한꺼번에** 바꾼다. (2026-08-07)

    설정에서 방법 이름을 고치면 이미 그 방법으로 적어 둔 연결들도 같이 바뀌어야 한다.
    안 그러면 사전에는 새 이름, 데이터에는 옛 이름이 남아 **같은 뜻이 두 개**가 된다 —
    자유 텍스트를 사전으로 바꾼 이유가 바로 그걸 없애려는 것이었다.

    본문
        kpiDefinitionId  대상 지표
        from             바꿀 문구 (정확히 일치하는 것만)
        to               새 문구. 빈 문자열이면 **그 방법만 지운다**
        dryRun           true 면 세기만 하고 쓰지 않는다

    ⚠️ 정확히 일치하는 줄만 바꾼다. 부분 일치로 치환하면 "시제작 감소" 가
       "시제작 감소율 개선" 안까지 파고든다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    if not (getattr(actor, 'is_admin', False) or getattr(actor, 'role', '') in ('admin', 'dt_office')):
        return error_response('KPI 기여방법 편집 권한이 없습니다.', status_code=403)

    body = request.get_json(silent=True) or {}
    try:
        kid = int(body.get('kpiDefinitionId'))
    except (TypeError, ValueError):
        return error_response('kpiDefinitionId 가 필요합니다.', status_code=400)
    src = str(body.get('from') or '').strip()
    dst = str(body.get('to') or '').strip()
    if not src:
        return error_response('바꿀 문구(from)가 비어 있습니다.', status_code=400)
    dry = bool(body.get('dryRun'))

    rows = Dt2ProjectKpi.query.filter_by(kpi_definition_id=kid).all()
    changed = 0
    for ln in rows:
        methods = _note_methods(ln.note)
        if src not in methods:
            continue
        if dst:
            # 이미 새 이름이 있으면 중복으로 남기지 않는다
            out, seen = [], set()
            for m in methods:
                v = dst if m == src else m
                if v in seen:
                    continue
                seen.add(v)
                out.append(v)
        else:
            out = [m for m in methods if m != src]
        new_note = NOTE_SEP.join(out)
        if len(new_note) > 300:
            return error_response(
                f'바꾸면 어떤 연결의 기여 방법이 300자를 넘습니다(과제 {ln.project_uuid[:8]}). '
                '문구를 줄이거나 그 연결의 방법 수를 줄이세요.', status_code=400)
        if not dry:
            ln.note = new_note
        changed += 1

    if dry:
        db.session.rollback()
    else:
        db.session.commit()
    return success_response({
        'kpiDefinitionId': kid, 'from': src, 'to': dst,
        'changed': changed, 'dryRun': dry,
    }, message=(f'{changed}건의 연결에서 바꿉니다.' if dry
                else f'{changed}건의 연결에 반영했습니다.'))


@bp_v2.route('/kpi-matrix', methods=['GET'])
@auth_required
def kpi_matrix():
    """
    KPI × 사업부 매트릭스의 원재료. (`?year=` 필수 아님 — 없으면 전 연도)

    **집계하지 않고 평평하게 돌려준다.**
        화면은 곧 다른 축으로도 돌려보고 싶어진다(진행상태별·과제구분별·중점과제만 …).
        서버가 셀을 미리 만들어 주면 그때마다 API 를 고쳐야 한다. 링크는 많아야
        수백 행이라 보내는 비용이 집계 로직을 서버에 가두는 비용보다 싸다.

    **과제 정보를 같이 담는 이유**
        화면의 `projects` 상태와 조인해도 되지만, 그러면 **셀의 숫자가 클라이언트
        상태와 어긋날 수 있다**(연도 필터·삭제 반영 시점 차이). 매트릭스는 보고에
        쓰이는 숫자라 그 자체로 완결돼야 한다. 과제명 같은 표시용 값만 얹는다.

    응답
        divisions  설정의 활성 사업부 (표시 순서 그대로 — 열 순서가 된다)
        kpis       지표 정의 (행 순서). `divisions` 가 빈 배열이면 전사 공통
        projects   그 해에 볼 수 있는 과제 (매트릭스 분모 · 미연결 계산에 쓴다)
        links      [projectUuid, kpiDefinitionId] 쌍
    """
    from app.modules.dx_kpi_management.models import KpiDefinition

    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    year = request.args.get('year', type=int)

    q = (Dt2Project.query
         .filter(Dt2Project.is_deleted.is_(False))
         .filter(Dt2Project.is_permanently_deleted.is_(False)))
    if year is not None:
        q = q.filter(Dt2Project.year == year)
    rows = q.all()

    # 권한. 대부분은 첫 조건에서 바로 통과한다(사업부 한정 공개가 아닌 과제).
    visible = [p for p in rows if P.can_view_project(actor, p)]
    uuids = {p.uuid for p in visible}

    links = []
    if uuids:
        for puid, kid, target, note, rel in (db.session.query(Dt2ProjectKpi.project_uuid,
                                                              Dt2ProjectKpi.kpi_definition_id,
                                                              Dt2ProjectKpi.target_division,
                                                              Dt2ProjectKpi.note,
                                                              Dt2ProjectKpi.relation_type)
                                             .filter(Dt2ProjectKpi.project_uuid.in_(uuids)).all()):
            # [과제, 지표, **대상 사업부**, 기여 내용, 기여 등급] — 대상이 곧 매트릭스의 열이다.
            # 과제의 소속이 아니다: 기능조직(GTR·SR·CS) 과제는 소속과 대상이 다르다.
            #
            # `note`·`relation_type` 은 **(과제, 지표, 대상) 줄마다** 다를 수 있다 —
            # 같은 과제가 MX 와 VD 를 지원해도 기여 방식·강도가 다를 수 있어서다.
            # 뒤에 덧붙이는 자리라 `[puid, kid, target]` 로 읽던 옛 화면도 그대로 돈다.
            links.append([puid, kid, target or '', note or '', rel or ''])

    defs = (KpiDefinition.query
            .order_by(KpiDefinition.sort_order.asc(), KpiDefinition.id.asc())
            .all())

    from app.modules.dx_kpi_management import achievement as A

    # 알 수 없는 기간은 무시하고 연 기준으로 계산한다. 그때 **요청값을 그대로
    # 되돌려주면 안 된다** — 화면은 그 기간으로 표시하는데 숫자는 연간이라
    # 조용히 어긋난다. 실제로 쓴 값을 돌려준다.
    raw_period = request.args.get('period') or None
    period = raw_period if (raw_period and A.period_kind(raw_period)) else None

    divisions = _kpi_owner_divisions()
    metrics, unmatched = _kpi_metrics(defs, divisions, year, period)

    return success_response({
        'year': year,
        'period': period,
        'divisions': divisions,
        # 셀 하나하나의 목표·실적·달성률·상태. **모든 (지표 × 사업부) 조합**이 들어 있다
        # — '해당 없음'(n_a) 까지 서버가 판정해서 준다. 화면이 사업부 코드 표를 따로
        # 들면 반드시 서버와 갈리고, 그러면 실적이 엉뚱한 열에 붙는다.
        'metrics': metrics,
        # 실적/목표가 지표 **라벨 문자열**로 물려 있어(kpi_records.kpi), 라벨이
        # 어긋나면 조용히 빈칸이 된다. 몇 개가 못 붙었는지 화면이 말할 수 있게 준다.
        'unmatched': unmatched,
        'kpis': [{
            'kpiDefinitionId': d.id,
            'label': d.label,
            'category': d.category,
            'unit': d.unit,
            'direction': d.direction or 'higher',
            'divisions': d.divisions or [],
            'kind': d.kind or 'metric',
        } for d in defs],
        'projects': [{
            'uuid': p.uuid,
            'code': p.code,
            'title': p.title,
            'division': p.division,
            # 화면의 프로세스 필터(개발·제조·품질 …)가 쓴다. 2026-08-07 추가 —
            # 이 API 는 **집계하지 않고 평평하게** 주고 축은 화면이 정한다(머리말).
            # 필터를 서버에 넣으면 축이 늘 때마다 API 를 고쳐야 한다.
            'process': p.process,
            'status': p.status,
            'progress': p.progress,
            'isKey': bool(p.is_key),
        } for p in visible],
        'links': links,
    })


@bp_v2.route('/kpi-links/bulk', methods=['POST'])
@auth_required
def bulk_kpi_links():
    """
    여러 과제의 DX KPI 연결을 **한 번에** 세운다. (2026-08-08)

    ── 왜 과제 하나짜리 PUT 을 여러 번 부르지 않나 ──────────────────────────
    그쪽은 **통째로 교체**다. 연결 하나를 더하려면 기존 집합을 먼저 읽어 합쳐서
    보내야 하고(요청 2N번), 그 사이에 남이 고치면 덮어써 버린다. 무엇보다
    "고르지 않은 연결이 조용히 지워지는" 사고가 나기 쉽다.
    여기는 **칸(과제 × 지표 × 대상사업부) 단위 패치**다. 안 보낸 칸은 손대지 않는다.

    ── 해제는 **칸마다 명시적으로만** ───────────────────────────────────────
    `remove: true` 인 칸만 지운다 (2026-08-08 추가). '이 열 전부 해제' 같은 것은
    일부러 만들지 않았다 — 한 번의 오조작이 되돌리기 어려운 크기로 번진다.
    사람이 칸 하나씩 눌러야 하고, 미리보기에 `해제` 로 따로 세어 보여 준다.

    본문
        cells       [{projectUuid, kpiDefinitionId, relationType?, methods?[],
                      targetDivision?, remove?}, ...]
                    remove:true 면 그 연결을 **지운다** (나머지 값은 무시)
        methodMode  'append'(기본, 합집합) | 'replace'(갈아끼움)
        dryRun      true 면 **세기만 하고 쓰지 않는다**
        reason      이력에 남길 사유

    응답 data
        summary  {created, relation, methods, unchanged, skipped}
        rows     칸마다 무슨 일이 일어나는지 (kind + detail)
        note     참고 문구들

    ⚠️ AI 는 부를 수 없다. 과제 하나짜리 PUT 이 AI 를 막아 둔 이유(추측으로 채우면
       매트릭스의 빈칸=계획의 구멍이 가짜로 메워진다)가 여기선 N배로 커진다.
    """
    from app.modules.dx_kpi_management.models import KpiDefinition

    # ⚠️ PAT(외부 토큰·MCP)을 **먼저** 막는다. `_actor()` 안에서 PAT 이 사람 계정으로
    #    풀리기 때문에, 뒤에서 역할만 보면 admin 이 발급한 토큰이 그대로 통과한다.
    #    `body['actor_mode'] == 'ai'` 만으로는 부족하다 — 그건 **호출자가 스스로
    #    밝힐 때만** 걸리는 자진신고다. (일괄 삭제 `_bulk_delete_actor` 와 같은 순서)
    if pat_user() is not None:
        return error_response(
            'KPI 연결 일괄 편집은 외부 토큰(PAT·MCP)으로 호출할 수 없습니다. '
            '대시보드 화면에서 실행하세요.', status_code=403)

    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    # 기여방법 사전 편집(rename)과 **같은 문지기**를 쓴다 — 같은 데이터를 건드린다.
    if not (getattr(actor, 'is_admin', False)
            or getattr(actor, 'role', '') in ('admin', 'dt_office')):
        return error_response('KPI 연결을 일괄 편집할 권한이 없습니다.', status_code=403)

    body = request.get_json(silent=True) or {}
    if body.get('actor_mode') == 'ai':
        return error_response('AI 는 과제-KPI 연결을 변경할 수 없습니다.', status_code=403)

    cells = body.get('cells')
    if not isinstance(cells, list) or not cells:
        return error_response('cells 는 비어 있지 않은 배열이어야 합니다.', status_code=400)
    if len(cells) > 2000:
        return error_response('한 번에 2000칸까지만 처리합니다.', status_code=400)
    mode = body.get('methodMode') or 'append'
    if mode not in ('append', 'replace'):
        return error_response("methodMode 는 'append' 또는 'replace' 여야 합니다.",
                              status_code=400)
    dry = bool(body.get('dryRun'))

    # ── 재료를 한 번에 읽는다 (칸마다 조회하면 N+1) ──────────────────────────
    puids, kids = set(), set()
    for c in cells:
        if not isinstance(c, dict):
            return error_response('cells 원소는 모두 객체여야 합니다.', status_code=400)
        puids.add(str(c.get('projectUuid') or ''))
        try:
            kids.add(int(c.get('kpiDefinitionId')))
        except (TypeError, ValueError):
            return error_response(
                f"kpiDefinitionId 는 정수여야 합니다: {c.get('kpiDefinitionId')!r}",
                status_code=400)

    q = Dt2Project.query.filter(Dt2Project.uuid.in_(puids))
    projects = {p.uuid: p for p in (q.with_for_update().all() if not dry else q.all())}
    kdefs = {d.id: d for d in KpiDefinition.query.filter(KpiDefinition.id.in_(kids)).all()}
    divisions = _kpi_owner_divisions()

    existing = {}
    for ln in Dt2ProjectKpi.query.filter(Dt2ProjectKpi.project_uuid.in_(puids)).all():
        existing[(ln.project_uuid, ln.kpi_definition_id, ln.target_division or '')] = ln

    # 과제별 편집 권한은 **한 번만** 묻는다 (칸마다 물으면 같은 답을 수십 번 낸다)
    editable = {u: (p is not None and P.can_edit_project(actor, p))
                for u, p in ((u, projects.get(u)) for u in puids)}

    rows, touched, seen = [], {}, set()
    summary = {'created': 0, 'relation': 0, 'methods': 0, 'removed': 0,
               'unchanged': 0, 'skipped': 0}

    def add(kind, c, detail, p=None, kd=None, target=''):
        summary[kind] += 1
        rows.append({
            'projectUuid': c.get('projectUuid'),
            'code': getattr(p, 'code', None),
            'title': getattr(p, 'title', None),
            'kpiDefinitionId': c.get('kpiDefinitionId'),
            'kpiLabel': getattr(kd, 'label', None),
            'targetDivision': target,
            'kind': kind,
            'detail': detail,
        })

    for c in cells:
        puid = str(c.get('projectUuid') or '')
        kid = int(c.get('kpiDefinitionId'))
        p, kd = projects.get(puid), kdefs.get(kid)

        if p is None:
            add('skipped', c, '과제를 찾을 수 없습니다.'); continue
        if kd is None:
            add('skipped', c, '지표를 찾을 수 없습니다.', p); continue
        if p.is_deleted:
            add('skipped', c, '삭제된 과제입니다.', p, kd); continue
        if not editable.get(puid):
            add('skipped', c, P.deny_reason(actor, p), p, kd); continue

        target, terr = _resolve_link_target(p, kid, c.get('targetDivision'),
                                            kd.divisions or [], divisions)
        if terr:
            add('skipped', c, terr, p, kd); continue

        rel = c.get('relationType')
        if rel in ('', None):
            rel = None
        elif rel not in KPI_RELATION_TYPES:
            add('skipped', c,
                f"기여 등급이 잘못되었습니다: {rel!r} "
                f"({', '.join(KPI_RELATION_TYPES)} 중 하나여야 합니다)", p, kd, target)
            continue

        key = (puid, kid, target)
        if key in seen:
            add('skipped', c, '같은 칸이 두 번 들어왔습니다.', p, kd, target); continue
        seen.add(key)

        ln = existing.get(key)

        # ── 해제 ─────────────────────────────────────────────────────────
        # 등급·방법보다 **먼저** 본다. 지울 칸에 무엇을 적어 보냈든 상관없다.
        if c.get('remove'):
            if ln is None:
                add('unchanged', c, '연결이 없어 해제할 것이 없습니다.', p, kd, target)
                continue
            add('removed', c,
                f"연결 해제 ({KPI_RELATION_LABEL.get(ln.relation_type, ln.relation_type)}"
                + (f" · 방법 {len(_note_methods(ln.note))}개" if _note_methods(ln.note) else '')
                + ')', p, kd, target)
            if not dry:
                db.session.delete(ln)
                touched.setdefault(puid, p)
            continue

        want = [str(m).strip() for m in (c.get('methods') or []) if str(m).strip()]
        cur = _note_methods(ln.note) if ln is not None else []
        # append = 합집합(순서 유지·중복 제거). 일괄의 기본은 **더하기**다 —
        # 갈아끼우기를 기본으로 두면 남이 적어 둔 방법이 소리 없이 사라진다.
        merged = (cur + [m for m in want if m not in cur]) if mode == 'append' else want

        note, nerr = _join_methods(merged)
        if nerr:
            add('skipped', c, nerr, p, kd, target); continue

        added = [m for m in merged if m not in cur]
        if ln is None:
            add('created', c,
                f"신규 연결 · {KPI_RELATION_LABEL.get(rel, rel)}"
                + (f" · 방법 {len(merged)}개" if merged else ''), p, kd, target)
        elif (ln.relation_type or None) != rel:
            add('relation', c,
                f"등급 {KPI_RELATION_LABEL.get(ln.relation_type, ln.relation_type)}"
                f" → {KPI_RELATION_LABEL.get(rel, rel)}"
                + (f" · 방법 +{len(added)}" if added else ''), p, kd, target)
        elif added or (mode == 'replace' and merged != cur):
            # 무엇이 늘고 무엇이 **빠지는지** 둘 다 말한다. 화면이 replace 로 보내는
            # 이상 빠지는 경우가 실제로 생기는데, '갈아끼움' 한 마디로는 지워지는 것을
            # 누르기 전에 알 수 없다.
            removed = [m for m in cur if m not in merged]
            bits = []
            if added:
                bits.append(f"+{len(added)}"
                            f" ({', '.join(added[:2])}{'…' if len(added) > 2 else ''})")
            if removed:
                bits.append(f"−{len(removed)}"
                            f" ({', '.join(removed[:2])}{'…' if len(removed) > 2 else ''})")
            add('methods', c, '방법 ' + (' · '.join(bits) if bits else '변경'),
                p, kd, target)
        else:
            add('unchanged', c, '이미 같습니다.', p, kd, target); continue

        if dry:
            continue
        if ln is None:
            db.session.add(Dt2ProjectKpi(
                project_uuid=puid, kpi_definition_id=kid, target_division=target,
                note=note, relation_type=rel, created_by=actor.id))
        else:
            ln.relation_type = rel
            ln.note = note
        touched.setdefault(puid, p)

    if dry:
        return success_response({'summary': summary, 'rows': rows, 'dryRun': True})

    # ── 이력 · row_version ────────────────────────────────────────────────────
    # 연결을 바꿔도 과제 자체는 안 바뀌지만 **열려 있는 편집창이 낡았다는 걸 알아야**
    # 한다. 안 올리면 그 창이 자기 사본을 그대로 저장해 방금 넣은 연결을 지운다.
    db.session.flush()
    for puid, p in touched.items():
        after = [_kpi_link_dict(ln, kd) for ln, kd in _kpi_links_of(puid)]
        _log_link_change(p, None, after, actor, 'ui',
                         body.get('reason') or 'KPI 연결 일괄 편집', field='kpi_links')
        p.row_version = (p.row_version or 1) + 1
    db.session.commit()

    return success_response({
        'summary': summary,
        'rows': rows,
        'dryRun': False,
        'projects': len(touched),
    })


@bp_v2.route('/projects/<uuid>/kpi-links', methods=['PUT'])
@auth_required
def replace_project_kpi_links(uuid):
    """
    과제의 DX KPI 연결을 **통째로 교체**한다. (성과 연결 PUT 과 같은 모양)

    본문
        items            [{kpiDefinitionId, targetDivision?, relationType?, note?}, ...]
        expected_version 과제의 row_version (선택)
        actor_mode='ai'  → **즉시 반영하지 않고 확인 대기(202)** 로 간다
        reason           왜 이 연결인지. **AI 경로에서는 필수** (아래 참조)

    ── AI 경로가 403 에서 202 로 바뀐 이유 (2026-08-12) ──────────────────────
    원래 `actor_mode='ai'` 는 **403** 이었다. 이 연결은 사람이 "이 과제가 무엇에
    기여하는가" 를 선언하는 값이라, AI 가 추측으로 채우면 매트릭스의 빈칸
    (=계획의 구멍)이 **가짜로 메워진다**는 판단이었다.

    그 우려를 **없애는 쪽**으로 바꿨다 — 과제-성과 연결이 지나간 길 그대로다
    (그쪽도 "남의 과제 숫자가 조용히 틀어진다" 는 같은 종류의 우려로 403 이었고,
     막는 대신 202 + `preview.affectedProjects` 로 풀었다).

        · 즉시 반영하지 않는다. **사람이 승인해야** 들어간다
        · preview 에 **지표 이름·대상 사업부·기여 등급**을 다 실어 보낸다 —
          id 만 보여주면 승인자는 무엇에 동의하는지 알 수 없고, 그러면 승인이
          형식이 되어 원래 우려가 그대로 돌아온다
        · **`reason` 을 필수로 받는다.** 근거 없는 제안은 승인자가 판단할 수
          없으므로 아예 만들지 않는다(400). 이것이 "추측으로 채우는 것" 을 막는
          실질적인 장치다
        · 대상 사업부·기여 등급 규칙(`_resolve_link_target`)은 **그대로 걸린다.**
          제안을 만들기 전에 검증하므로, 규칙에 어긋난 조합은 대기 목록에조차
          쌓이지 않는다

    ⚠️ **일괄 편집(`/kpi-links/bulk`)은 여전히 PAT 자체를 막는다.** 한 번의
       오조작이 N배로 번지고, 승인 화면도 칸마다 보여주기 어렵다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    body = request.get_json(silent=True) or {}
    is_ai = (body.get('actor_mode') == 'ai')

    p = Dt2Project.query.filter_by(uuid=uuid).with_for_update().first()
    if p is None:
        return error_response('과제를 찾을 수 없습니다.', status_code=404)
    if not P.can_edit_project(actor, p):
        db.session.rollback()
        return error_response(P.deny_reason(actor, p), status_code=403)

    expected, verr = _expected_version(body)
    if verr:
        db.session.rollback()
        return error_response(verr, status_code=400)
    if expected is not None and expected != p.row_version:
        db.session.rollback()
        return error_response(
            '다른 사용자가 이 과제를 먼저 수정했습니다. 새로고침 후 다시 시도하세요.',
            status_code=409)

    # 규칙 검증은 **제안을 만들기 전에** 끝낸다. 승인 시점에야 알게 되면
    # 사용자는 이미 승인을 누른 뒤다 (성과 연결과 같은 순서).
    resolved, rerr = _resolve_kpi_items(p, body.get('items'))
    if rerr:
        db.session.rollback()
        return rerr

    if is_ai:
        reason = str(body.get('reason') or '').strip()
        if not reason:
            db.session.rollback()
            return error_response(
                'AI 가 KPI 연결을 제안하려면 `reason`(왜 이 지표인지)이 필요합니다. '
                '근거 없이는 승인자가 판단할 수 없어 제안을 만들지 않습니다.',
                status_code=400)

        before = [_kpi_link_dict(ln, kdef) for ln, kdef in _kpi_links_of(uuid)]
        proposal = Dt2ChangeProposal(
            project_uuid=p.uuid,
            patch={'kpi_links': resolved},
            before_values={'kpi_links': before},
            base_version=p.row_version,
            reason=reason,
            proposed_by=actor.id,
            status='pending',
        )
        db.session.add(proposal)
        db.session.commit()
        return success_response({
            'applied': [],
            'proposalId': proposal.id,
            'pendingFields': ['kpi_links'],
            'preview': {
                VIRTUAL_FIELD_LABELS.get('kpi_links', 'DX KPI 연결'): {
                    'before': before,
                    'after': _kpi_preview_rows(resolved),
                },
            },
            'reason': reason,
        }, message='KPI 연결은 사람이 확인해야 반영됩니다. 근거와 함께 보여주고 '
                   '동의를 받은 뒤 confirm_change 를 부르세요.', status_code=202)

    _replace_kpi_links(p, resolved, actor, 'ui', body.get('reason'))
    db.session.commit()

    return success_response({
        'projectUuid': uuid,
        'rowVersion': p.row_version,
        'items': [_kpi_link_dict(ln, kdef) for ln, kdef in _kpi_links_of(uuid)],
    })


# ─────────────────────────────────────────────────────────────────────────────
# 삭제 / 복구
#
# V1 과 동작을 맞춘다.
#   과제 삭제      _deleted 플래그만. 연결은 그대로 둔다 (복구하면 되살아나야 하므로)
#   과제 영구삭제  _permanentlyDeleted. 화면 조회에서 완전히 빠진다
#   성과 삭제      _deleted + **모든 과제에서 그 참조를 제거** ← V1 이 이렇게 한다
#
# V1 은 이 경로들에 권한 검사가 없었다. 로그인만 하면 남의 과제도 지울 수 있었다.
# Phase 3 가 고치는 것이 바로 이 부분이라 여기서는 반드시 검사한다.
# ─────────────────────────────────────────────────────────────────────────────

@bp_v2.route('/projects/<uuid>/delete', methods=['POST'])
@auth_required
def soft_delete_project(uuid):
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    p = Dt2Project.query.filter_by(uuid=uuid).with_for_update().first()
    if p is None:
        return error_response('과제를 찾을 수 없습니다.', status_code=404)
    if not P.can_edit_project(actor, p):
        db.session.rollback()
        return error_response(P.deny_reason(actor, p), status_code=403)
    if p.is_deleted:
        db.session.rollback()
        return error_response('이미 삭제된 과제입니다.', status_code=400)

    p.is_deleted = True
    p.deleted_at = datetime.utcnow()
    p.deleted_by_name = actor.name
    p.row_version = (p.row_version or 1) + 1
    db.session.flush()
    db.session.add(Dt2ProjectChange(
        project_uuid=uuid, row_version=p.row_version, field='is_deleted',
        before_value=False, after_value=True,
        actor_user_id=actor.id, source='ui',
        reason=(request.get_json(silent=True) or {}).get('reason'),
    ))
    db.session.commit()
    return success_response({'uuid': uuid, 'isDeleted': True,
                             'rowVersion': p.row_version},
                            message='과제를 삭제했습니다.')


@bp_v2.route('/projects/<uuid>/restore', methods=['POST'])
@auth_required
def restore_project(uuid):
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    p = Dt2Project.query.filter_by(uuid=uuid).with_for_update().first()
    if p is None:
        return error_response('과제를 찾을 수 없습니다.', status_code=404)
    if p.is_permanently_deleted:
        db.session.rollback()
        return error_response('영구 삭제된 과제는 복구할 수 없습니다.', status_code=400)
    if not p.is_deleted:
        db.session.rollback()
        return error_response('이 과제는 삭제된 상태가 아닙니다.', status_code=400)

    # can_edit_project 는 삭제된 과제도 통과시킨다(영구삭제만 막는다).
    # 복구는 삭제와 같은 권한으로 본다 — 지울 수 있으면 되돌릴 수도 있어야 한다.
    if not P.can_edit_project(actor, p):
        db.session.rollback()
        return error_response(P.deny_reason(actor, p), status_code=403)

    p.is_deleted = False
    p.deleted_at = None
    p.deleted_by_raw = None
    p.deleted_by_name = None
    p.row_version = (p.row_version or 1) + 1
    db.session.flush()
    db.session.add(Dt2ProjectChange(
        project_uuid=uuid, row_version=p.row_version, field='is_deleted',
        before_value=True, after_value=False,
        actor_user_id=actor.id, source='ui',
    ))
    db.session.commit()
    return success_response({'uuid': uuid, 'isDeleted': False,
                             'rowVersion': p.row_version},
                            message='과제를 복구했습니다.')


@bp_v2.route('/projects/<uuid>', methods=['DELETE'])
@auth_required
def permanent_delete_project(uuid):
    """
    영구 삭제. **admin / dt_office 만 가능하다.**

    화면 조회에서 완전히 빠지고 복구 경로가 없다. V1 은 아무나 할 수 있었는데
    되돌릴 방법이 없는 조작을 그렇게 두는 건 위험하다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    if actor.role not in P.GLOBAL_EDIT_ROLES:
        return error_response('영구 삭제는 관리자만 할 수 있습니다.', status_code=403)

    p = Dt2Project.query.filter_by(uuid=uuid).with_for_update().first()
    if p is None:
        return error_response('과제를 찾을 수 없습니다.', status_code=404)
    if p.is_permanently_deleted:
        db.session.rollback()
        return error_response('이미 영구 삭제된 과제입니다.', status_code=400)

    p.is_deleted = True
    p.is_permanently_deleted = True
    p.permanently_deleted_at = datetime.utcnow()
    p.permanently_deleted_by_name = actor.name
    p.row_version = (p.row_version or 1) + 1
    db.session.flush()
    db.session.add(Dt2ProjectChange(
        project_uuid=uuid, row_version=p.row_version,
        field='is_permanently_deleted', before_value=False, after_value=True,
        actor_user_id=actor.id, source='ui',
        reason=(request.get_json(silent=True) or {}).get('reason'),
    ))
    db.session.commit()
    return success_response({'uuid': uuid, 'isPermanentlyDeleted': True},
                            message='과제를 영구 삭제했습니다.')


@bp_v2.route('/performances/<uuid>', methods=['DELETE'])
@auth_required
def delete_performance(uuid):
    """
    성과 삭제. V1 과 같이 **연결된 모든 과제에서 참조도 제거**한다.

    파급이 크다 — 남의 과제에서도 이 성과가 사라진다.
    막지는 않되(연결된 과제를 고칠 수 있으면 성과도, 2026-07-29 결정)
    **어느 과제들이 영향받았는지 응답과 로그에 남긴다.**
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    f = Dt2Performance.query.filter_by(uuid=uuid).with_for_update().first()
    if f is None:
        return error_response('성과를 찾을 수 없습니다.', status_code=404)
    if f.is_deleted:
        db.session.rollback()
        return error_response('이미 삭제된 성과입니다.', status_code=400)
    if not P.can_edit_performance(actor, f):
        db.session.rollback()
        return error_response(P.deny_reason_performance(actor, f), status_code=403)

    links = Dt2ProjectPerformance.query.filter_by(performance_uuid=uuid).all()
    affected = []
    for ln in links:
        proj = Dt2Project.query.filter_by(uuid=ln.project_uuid).first()
        if proj is not None:
            affected.append({'uuid': proj.uuid, 'code': proj.code, 'title': proj.title})
            proj.row_version = (proj.row_version or 1) + 1
            db.session.add(Dt2ProjectChange(
                project_uuid=proj.uuid, row_version=proj.row_version,
                field='performance_links',
                before_value=[{'performanceUuid': uuid, 'contribution': ln.contribution}],
                after_value=[],
                actor_user_id=actor.id, source='ui',
                reason=f'성과 삭제로 연결 해제: {f.title}',
            ))
        db.session.delete(ln)

    f.is_deleted = True
    f.deleted_at = datetime.utcnow()
    f.deleted_by_name = actor.name
    f.row_version = (f.row_version or 1) + 1
    db.session.flush()
    db.session.commit()

    return success_response({
        'uuid': uuid, 'isDeleted': True,
        'unlinkedProjects': affected,
    }, message=f'성과를 삭제했습니다. 연결이 해제된 과제 {len(affected)}건.')


@bp_v2.route('/performances/<uuid>/restore', methods=['POST'])
@auth_required
def restore_performance(uuid):
    """
    성과 복구. **연결은 되살아나지 않는다** — 삭제할 때 지웠기 때문이다.
    필요하면 과제에서 다시 연결해야 한다. V1 도 같다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    f = Dt2Performance.query.filter_by(uuid=uuid).with_for_update().first()
    if f is None:
        return error_response('성과를 찾을 수 없습니다.', status_code=404)
    if f.is_permanently_deleted:
        db.session.rollback()
        return error_response('영구 삭제된 성과는 복구할 수 없습니다.', status_code=400)
    if not f.is_deleted:
        db.session.rollback()
        return error_response('이 성과는 삭제된 상태가 아닙니다.', status_code=400)
    # 삭제된 성과는 can_edit_performance 가 막으므로 여기서는 역할로 판단한다.
    # 연결이 이미 끊겨 있어 '연결된 과제' 규칙을 쓸 수 없다.
    if actor.role not in P.GLOBAL_EDIT_ROLES and f.created_by_user_id != actor.id:
        return error_response(
            '삭제된 성과의 복구는 관리자 또는 만든 사람만 할 수 있습니다. '
            '(삭제 시 과제 연결이 모두 해제되어 담당 과제로는 판단할 수 없습니다)',
            status_code=403)

    f.is_deleted = False
    f.deleted_at = None
    f.deleted_by_raw = None
    f.deleted_by_name = None
    f.row_version = (f.row_version or 1) + 1
    db.session.commit()
    return success_response({'uuid': uuid, 'isDeleted': False},
                            message='성과를 복구했습니다. 과제 연결은 다시 지정해야 합니다.')


@bp_v2.route('/performances/<uuid>/permanent', methods=['DELETE'])
@auth_required
def permanent_delete_performance(uuid):
    """
    성과 영구 삭제 (2026-08-06). **휴지통에 있는 것만** 지울 수 있다.

    과제의 영구 삭제와 같은 규칙이다.
      · 관리자(GLOBAL_EDIT_ROLES)만
      · 행을 지우지 않고 `is_permanently_deleted` 로 표시한다 —
        이력(dt2_performance_history)이 가리킬 대상이 남아야 하고,
        "지운 그 성과가 뭐였나" 를 나중에 답할 수 있어야 한다.
      · 되돌릴 수 없다. 그래서 **휴지통을 거치지 않은 성과는 거절한다** —
        실수로 살아있는 성과를 영구 삭제하는 경로를 아예 만들지 않는다.

    과제 연결은 이미 소프트 삭제 때 끊겼으므로 여기서 손댈 것이 없다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    if actor.role not in P.GLOBAL_EDIT_ROLES:
        return error_response('영구 삭제는 관리자만 할 수 있습니다.', status_code=403)

    f = Dt2Performance.query.filter_by(uuid=uuid).with_for_update().first()
    if f is None:
        return error_response('성과를 찾을 수 없습니다.', status_code=404)
    if f.is_permanently_deleted:
        db.session.rollback()
        return error_response('이미 영구 삭제된 성과입니다.', status_code=400)
    if not f.is_deleted:
        db.session.rollback()
        return error_response(
            '휴지통에 있는 성과만 영구 삭제할 수 있습니다. 먼저 삭제하세요.',
            status_code=400)

    f.is_permanently_deleted = True
    f.permanently_deleted_at = datetime.utcnow()
    # `_by_raw` 는 채우지 않는다 — User 에 knoxId 필드가 없어 넣을 값이 없고,
    # 과제의 영구 삭제(permanent_delete_project)도 이름만 남긴다. 기준을 맞춘다.
    f.permanently_deleted_by_name = actor.name
    f.row_version = (f.row_version or 1) + 1
    db.session.commit()
    return success_response({'uuid': uuid, 'isPermanentlyDeleted': True},
                            message='성과를 영구 삭제했습니다.')


# ─────────────────────────────────────────────────────────────────────────────
# 연도 단위 일괄 삭제 (2026-08-02)
#
# 왜 서버에 이게 필요한가
#     화면 상단의 '전체 삭제'는 IndexedDB/localStorage 만 비웠다. 원래는 그 뒤에
#     '서버에 저장'(수동 업로드·덮어쓰기)으로 확정하는 2단 동작이었는데, 그 메뉴가
#     V2 컷오버 때 내려가면서(Header.jsx 의 주석 참고) **서버에 닿지 않는 버튼**만
#     남았다. 눌러도 새로고침 시 자동 다운로드가 그대로 되살려 놓는다.
#     즉 지금 그 버튼은 "지웠다고 믿게 만드는" 상태다. 그래서 서버 경로를 만든다.
#
# 왜 '전체'가 아니라 연도별인가
#     실제로 필요한 건 "지난 연도 정리"이지 "전부 지우기"가 아니다. 전부를 원하면
#     연도를 다 고르면 된다 — **별도의 '전체' 모드를 두지 않는다.** 그런 모드가 있으면
#     연도 목록이 비어 들어왔을 때 그것을 전체로 해석하는 길이 생긴다. 실수 한 번이
#     전 과제 삭제가 되는 분기는 아예 만들지 않는다(아래 400 검사).
#
# 왜 admin 만인가 — 1건 영구삭제보다 좁다
#     `permanent_delete_project` 는 GLOBAL_EDIT_ROLES(admin·dt_office)인데 여기는
#     admin 뿐이다. 1건과 수백 건은 되돌리는 비용이 다르다. (2026-08-02 결정)
#
# 왜 PAT(MCP·AI)은 아예 막는가
#     AI 는 과제 **1건의 핵심 필드**를 고치는 것조차 사람 승인 대기(202)로 보낸다.
#     그 방어를 해 놓고 "연도 전체를 한 번에" 도구를 열어 두면 앞의 것이 무의미해진다.
#
# 소프트 삭제만 한다 — 휴지통 화면에서 연도별로 되살릴 수 있다.
# ─────────────────────────────────────────────────────────────────────────────

def _bulk_delete_actor(what='연도별 일괄 삭제'):
    """
    일괄 삭제 구역의 주체. `(actor, None)` 또는 `(None, 오류응답)`.

    권한 판단을 이 한 함수에 모은다 — 조회(대상 요약)와 실행이 **같은 조건**이어야
    화면에 목록이 보이는데 누르면 403 같은 어긋남이 안 생긴다.

    `what` 은 오류 문구에만 쓴다. 판단 기준은 어느 호출부든 같다 —
    문구가 달라도 **조건이 갈리면 안 된다.**
    """
    # PAT 은 `_actor()` 안에서 먼저 처리되므로 그 전에 걸러야 한다.
    if pat_user() is not None:
        return None, error_response(
            f'{what}는 외부 토큰(PAT·MCP)으로는 호출할 수 없습니다. '
            '대시보드 화면에서 관리자 계정으로 실행하세요.', status_code=403)

    actor = _actor()
    if actor is None:
        return None, error_response('로그인이 필요합니다.', status_code=401)
    # ⚠️ GLOBAL_EDIT_ROLES 를 쓰지 않는다. 사무국(dt_office)도 제외하는 것이 의도다.
    if not (actor.role == UserRole.ADMIN or actor.is_admin):
        return None, error_response(
            f'{what}는 관리자(admin)만 할 수 있습니다.', status_code=403)
    return actor, None


@bp_v2.route('/projects/year-summary', methods=['GET'])
@auth_required
def project_year_summary():
    """
    연도별 과제 건수. 삭제 모달의 연도 목록이 이걸로 그려진다.

    화면이 들고 있는 로컬 데이터로 세지 않는 이유 — 로컬에는 **내가 볼 수 있는 것만**
    있고, 지울 대상은 서버 전체다. 로컬 기준으로 "12건" 이라고 보여주고 실제로는
    40건이 지워지면 그게 사고다.
    """
    _, err = _bulk_delete_actor()
    if err:
        return err

    # is_deleted 가 NULL 인 옛 행이 있어도 안전하도록 isnot(True)/is_(True) 로 본다.
    # 영구삭제는 is_deleted 도 True 라 active 에서 자동으로 빠진다.
    active = dict(db.session.query(Dt2Project.year, func.count(Dt2Project.uuid))
                  .filter(Dt2Project.is_deleted.isnot(True))
                  .group_by(Dt2Project.year).all())
    trashed = dict(db.session.query(Dt2Project.year, func.count(Dt2Project.uuid))
                   .filter(Dt2Project.is_deleted.is_(True),
                           Dt2Project.is_permanently_deleted.isnot(True))
                   .group_by(Dt2Project.year).all())

    # 최신 연도부터. 연도가 없는 행(None)은 맨 뒤로 — 지울지 말지 판단이 다르다.
    years = sorted(set(active) | set(trashed), key=lambda y: (y is None, -(y or 0)))
    return success_response({
        'years': [{'year': y,
                   'activeCount': int(active.get(y, 0)),
                   'trashedCount': int(trashed.get(y, 0))} for y in years],
    })


@bp_v2.route('/projects/bulk-delete', methods=['POST'])
@auth_required
def bulk_delete_projects_by_year():
    """
    지정한 연도들의 과제를 **한 번에 소프트 삭제**한다. admin 전용.

    본문
        years         [2024, 2025]  필수. 비었으면 400 — 전체로 해석하지 않는다.
        expectedCount 화면이 본 대상 건수. 서버가 센 것과 다르면 409 로 멈춘다.
        reason        변경 이력에 남길 사유(선택).

    `expectedCount` 를 받는 이유
        모달을 열어둔 사이 다른 사람이 과제를 추가했으면, 관리자가 "12건"을 보고
        눌렀는데 15건이 지워진다. 본 것과 지울 것이 다르면 **일단 멈추는 게** 맞다.
    """
    actor, err = _bulk_delete_actor()
    if err:
        return err

    body = request.get_json(silent=True) or {}
    raw_years = body.get('years')
    if not isinstance(raw_years, list) or not raw_years:
        return error_response(
            '삭제할 연도를 최소 하나 지정해야 합니다(years). '
            '빈 목록을 "전체"로 해석하지 않습니다.', status_code=400)

    years = []
    for y in raw_years:
        try:
            years.append(int(y))
        except (TypeError, ValueError):
            return error_response(f'연도 값이 올바르지 않습니다: {y!r}', status_code=400)
    years = sorted(set(years))

    targets = (Dt2Project.query
               .filter(Dt2Project.year.in_(years),
                       Dt2Project.is_deleted.isnot(True))
               .with_for_update()
               .all())

    expected = body.get('expectedCount')
    if expected is not None:
        try:
            expected = int(expected)
        except (TypeError, ValueError):
            db.session.rollback()
            return error_response('expectedCount 는 숫자여야 합니다.', status_code=400)
        if expected != len(targets):
            db.session.rollback()
            return error_response(
                f'대상 건수가 화면에서 본 것과 다릅니다 '
                f'(화면 {expected}건 · 지금 {len(targets)}건). '
                '그 사이 과제가 추가·삭제되었을 수 있습니다. '
                '목록을 새로 불러온 뒤 다시 시도하세요.', status_code=409)

    if not targets:
        db.session.rollback()
        return error_response(
            f'{", ".join(f"{y}년" for y in years)}에 삭제할 과제가 없습니다.',
            status_code=404)

    year_label = ', '.join(f'{y}년' for y in years)
    reason = (body.get('reason') or '').strip() or f'{year_label} 과제 일괄 삭제'

    now = datetime.utcnow()
    deleted = []
    for p in targets:
        p.is_deleted = True
        p.deleted_at = now
        p.deleted_by_name = actor.name
        p.row_version = (p.row_version or 1) + 1
        deleted.append({'uuid': p.uuid, 'code': p.code, 'title': p.title,
                        'year': p.year, 'rowVersion': p.row_version})
        db.session.add(Dt2ProjectChange(
            project_uuid=p.uuid, row_version=p.row_version, field='is_deleted',
            before_value=False, after_value=True,
            actor_user_id=actor.id, source='ui', reason=reason,
        ))
    db.session.flush()

    # '최근 수정 사항' 화면에도 한 줄 남긴다. 과제별 이력(dt2_project_changes)은
    # 위에서 이미 건별로 남았고, 이건 **한 번의 관리자 조작**이라는 사실의 기록이다.
    # 과제 목록은 앞 200건만 — 로그 한 행이 수백 건 본문을 들고 있을 이유는 없다.
    db.session.add(DashboardActivityLog(
        action='BULK_DELETE',
        target_type='PROJECT',
        target_name=f'{year_label} 과제 일괄 삭제 ({len(deleted)}건)',
        summary=(f'{actor.name}이(가) {year_label} 과제 {len(deleted)}건을 '
                 f'삭제했습니다. (휴지통에서 복구 가능)'),
        changes={
            'years': years,
            'count': len(deleted),
            'reason': reason,
            'projects': [{'code': d['code'], 'title': d['title'], 'year': d['year']}
                         for d in deleted[:200]],
            'truncated': len(deleted) > 200,
        },
        user_id=actor.id,
        user_name=actor.name,
        source='server',
    ))
    db.session.commit()

    by_year = {}
    for d in deleted:
        by_year[str(d['year'])] = by_year.get(str(d['year']), 0) + 1

    return success_response(
        {'years': years, 'count': len(deleted), 'byYear': by_year,
         'projects': deleted},
        message=f'{year_label} 과제 {len(deleted)}건을 삭제했습니다. '
                f'휴지통에서 복구할 수 있습니다.')


@bp_v2.route('/projects/bulk-restore', methods=['POST'])
@auth_required
def bulk_restore_projects_by_year():
    """
    연도별 일괄 복구. 위 일괄 삭제의 **짝**이다.

    왜 짝이 필요한가
        일괄 삭제가 "휴지통에서 복구할 수 있습니다" 라고 말하는데, 복구가 1건씩만
        된다면 200건을 지운 관리자에게 그 말은 사실상 거짓이다(200번 클릭).
        되돌릴 수 있다고 말하려면 **되돌리는 비용도 같아야** 한다.

    영구삭제된 과제는 대상에서 빠진다 — 그건 원래 복구 경로가 없다.
    """
    actor, err = _bulk_delete_actor()
    if err:
        return err

    body = request.get_json(silent=True) or {}
    raw_years = body.get('years')
    if not isinstance(raw_years, list) or not raw_years:
        return error_response(
            '복구할 연도를 최소 하나 지정해야 합니다(years).', status_code=400)

    years = []
    for y in raw_years:
        try:
            years.append(int(y))
        except (TypeError, ValueError):
            return error_response(f'연도 값이 올바르지 않습니다: {y!r}', status_code=400)
    years = sorted(set(years))

    targets = (Dt2Project.query
               .filter(Dt2Project.year.in_(years),
                       Dt2Project.is_deleted.is_(True),
                       Dt2Project.is_permanently_deleted.isnot(True))
               .with_for_update()
               .all())
    if not targets:
        db.session.rollback()
        return error_response(
            f'{", ".join(f"{y}년" for y in years)}에 복구할 과제가 없습니다.',
            status_code=404)

    year_label = ', '.join(f'{y}년' for y in years)
    reason = (body.get('reason') or '').strip() or f'{year_label} 과제 일괄 복구'

    restored = []
    for p in targets:
        p.is_deleted = False
        p.deleted_at = None
        p.deleted_by_raw = None
        p.deleted_by_name = None
        p.row_version = (p.row_version or 1) + 1
        restored.append({'uuid': p.uuid, 'code': p.code, 'title': p.title,
                         'year': p.year, 'rowVersion': p.row_version})
        db.session.add(Dt2ProjectChange(
            project_uuid=p.uuid, row_version=p.row_version, field='is_deleted',
            before_value=True, after_value=False,
            actor_user_id=actor.id, source='ui', reason=reason,
        ))
    db.session.flush()

    db.session.add(DashboardActivityLog(
        action='BULK_UPDATE',
        target_type='PROJECT',
        target_name=f'{year_label} 과제 일괄 복구 ({len(restored)}건)',
        summary=(f'{actor.name}이(가) {year_label} 과제 {len(restored)}건을 '
                 f'휴지통에서 복구했습니다.'),
        changes={
            'years': years,
            'count': len(restored),
            'reason': reason,
            'projects': [{'code': r['code'], 'title': r['title'], 'year': r['year']}
                         for r in restored[:200]],
            'truncated': len(restored) > 200,
        },
        user_id=actor.id,
        user_name=actor.name,
        source='server',
    ))
    db.session.commit()

    return success_response(
        {'years': years, 'count': len(restored), 'projects': restored},
        message=f'{year_label} 과제 {len(restored)}건을 복구했습니다.')


# ─────────────────────────────────────────────────────────────────────────────
# 성과 전체 삭제 (admin 전용)
#
# 왜 별도 엔드포인트인가
#     '새 성과 추가' 모달의 '전체 삭제'는 원래 **로컬(IndexedDB/localStorage) 사본만**
#     비웠다. 새로고침하면 서버에서 다시 내려와 되살아나는데 화면은 "삭제되었습니다"
#     라고 말했다 — 연도별 일괄 삭제가 고친 것과 **같은 종류의 거짓말**이다.
#     성과를 한 건씩 지우는 API 는 있지만, 수백 건을 건별로 부르면 중간에 끊겼을 때
#     절반만 지워진 상태가 남는다. 한 트랜잭션으로 처리한다.
#
# 파급
#     성과를 지우면 **그 성과를 쓰던 모든 과제의 연결도 함께 사라진다**(단건 삭제와
#     같다). 복구해도 연결은 돌아오지 않으므로, 영향받는 과제 수를 미리 보여준다.
#
# 소프트 삭제만 한다 — is_deleted 로 내리고 행은 남긴다.
# ─────────────────────────────────────────────────────────────────────────────

_PERF_BULK_LABEL = '성과 전체 삭제'


@bp_v2.route('/performances/delete-summary', methods=['GET'])
@auth_required
def performance_delete_summary():
    """
    전체 삭제가 실제로 건드릴 대상 수. 확인 모달이 이걸로 문구를 그린다.

    화면이 들고 있는 목록으로 세지 않는 이유 — 모달을 열어둔 사이 남이 성과를
    추가했을 수 있고, 화면 목록은 연도 필터가 걸려 있을 수도 있다. **본 것과 지울
    것이 다르면** 관리자가 잘못된 숫자를 보고 누르게 된다.
    """
    _, err = _bulk_delete_actor(_PERF_BULK_LABEL)
    if err:
        return err

    active = (db.session.query(func.count(Dt2Performance.uuid))
              .filter(Dt2Performance.is_deleted.isnot(True)).scalar() or 0)
    # 연결이 끊길 과제 수 — **연결을 하나라도 가진** 살아있는 과제.
    #
    # ⚠️ 여기서 성과의 `is_deleted` 를 보면 안 된다. bulk-delete 는 **연결을 전부**
    #    지우므로(이미 삭제된 성과를 가리키는 것까지), 여기서만 살아있는 성과로
    #    좁히면 **확인 화면에서 본 숫자보다 실제로 더 많은 과제가 바뀐다.**
    #    (2026-08-05: 지우는 범위를 넓히면서 세는 범위도 같이 넓혔다. 두 곳이
    #     갈리면 관리자가 잘못된 숫자를 보고 누른다 — 이 함수가 있는 이유 자체다.)
    affected = (db.session.query(
                    func.count(func.distinct(Dt2ProjectPerformance.project_uuid)))
                .join(Dt2Project,
                      Dt2Project.uuid == Dt2ProjectPerformance.project_uuid)
                .filter(Dt2Project.is_deleted.isnot(True))
                .scalar() or 0)
    return success_response({
        'activeCount': int(active),
        'affectedProjectCount': int(affected),
    })


@bp_v2.route('/performances/bulk-delete', methods=['POST'])
@auth_required
def bulk_delete_performances():
    """
    **모든 성과를 한 번에 소프트 삭제**한다. admin 전용.

    본문
        expectedCount 화면이 본 대상 건수. 서버가 센 것과 다르면 409 로 멈춘다.
        reason        변경 이력에 남길 사유(선택).

    `expectedCount` 를 받는 이유는 연도별 일괄 삭제와 같다 — 모달을 열어둔 사이
    누가 성과를 추가했으면, 관리자가 본 숫자와 지워지는 숫자가 달라진다.
    """
    actor, err = _bulk_delete_actor(_PERF_BULK_LABEL)
    if err:
        return err

    body = request.get_json(silent=True) or {}

    targets = (Dt2Performance.query
               .filter(Dt2Performance.is_deleted.isnot(True))
               .with_for_update()
               .all())

    expected = body.get('expectedCount')
    if expected is not None:
        try:
            expected = int(expected)
        except (TypeError, ValueError):
            db.session.rollback()
            return error_response('expectedCount 는 숫자여야 합니다.', status_code=400)
        if expected != len(targets):
            db.session.rollback()
            return error_response(
                f'대상 건수가 화면에서 본 것과 다릅니다 '
                f'(화면 {expected}건 · 지금 {len(targets)}건). '
                '그 사이 성과가 추가·삭제되었을 수 있습니다. '
                '목록을 새로 불러온 뒤 다시 시도하세요.', status_code=409)

    if not targets:
        db.session.rollback()
        return error_response('삭제할 성과가 없습니다.', status_code=404)

    reason = (body.get('reason') or '').strip() or '성과 전체 삭제'

    # 연결 해제 — 과제별로 **어느 성과가 빠졌는지** 이력에 남긴다.
    # 단건 삭제(delete_performance)와 같은 모양으로 남겨야 나중에 읽을 때 갈리지 않는다.
    #
    # ⚠️ **삭제 대상의 연결만 지우면 안 된다** — 전부 지운다.
    #    이 조작이 끝나면 살아있는 성과가 하나도 안 남는데, 그때 남은 연결은 전부
    #    **이미 삭제된 성과를 가리키는 연결**이다. 화면은 성과 목록에서 삭제된 것을
    #    걸러내므로(assemble 의 `is_deleted` 필터) 그 연결은 가리킬 대상이 없는
    #    빈 참조가 되고, 과제를 휴지통에서 되살리면 그대로 따라 올라온다.
    #    (2026-08-05 실측: 개발 DB 에 218건이 그렇게 쌓여 있었다 — 휴지통 과제
    #     211건에 붙은, 2026-08-02 에 지워진 성과 208건을 가리키는 연결.)
    #    `delete-summary` 도 같은 범위로 센다. 두 곳이 갈리면 확인 화면에서 본
    #    숫자와 실제로 바뀌는 과제 수가 어긋난다.
    links = Dt2ProjectPerformance.query.all()
    by_project = {}
    for ln in links:
        by_project.setdefault(ln.project_uuid, []).append(ln)

    # ⚠️ 이력은 **삭제된 과제에도** 남긴다 — 휴지통에서 되살렸을 때 "연결이 왜
    #    없어졌나" 를 설명할 수 있어야 한다.
    #    다만 보고 건수(affected_projects)에는 **살아있는 과제만** 넣는다.
    #    delete-summary 가 살아있는 과제만 세므로, 여기서 휴지통 과제까지 세면
    #    확인 화면에서 본 숫자와 결과 메시지가 어긋난다.
    affected_projects = []
    for proj_uuid, plinks in by_project.items():
        proj = Dt2Project.query.filter_by(uuid=proj_uuid).first()
        if proj is not None:
            if not proj.is_deleted:
                affected_projects.append({'uuid': proj.uuid, 'code': proj.code,
                                          'title': proj.title})
            proj.row_version = (proj.row_version or 1) + 1
            db.session.add(Dt2ProjectChange(
                project_uuid=proj.uuid, row_version=proj.row_version,
                field='performance_links',
                before_value=[{'performanceUuid': ln.performance_uuid,
                               'contribution': ln.contribution} for ln in plinks],
                after_value=[],
                actor_user_id=actor.id, source='ui',
                reason=f'{reason}로 연결 해제',
            ))
        for ln in plinks:
            db.session.delete(ln)

    now = datetime.utcnow()
    deleted = []
    for f in targets:
        f.is_deleted = True
        f.deleted_at = now
        f.deleted_by_name = actor.name
        f.row_version = (f.row_version or 1) + 1
        deleted.append({'uuid': f.uuid, 'title': f.title, 'year': f.year})
    db.session.flush()

    # '최근 수정 사항' 화면에 **한 번의 관리자 조작**이라는 사실을 남긴다.
    # 성과 목록은 앞 200건만 — 로그 한 행이 수백 건 본문을 들고 있을 이유는 없다.
    db.session.add(DashboardActivityLog(
        action='BULK_DELETE',
        target_type='PERFORMANCE',
        target_name=f'성과 전체 삭제 ({len(deleted)}건)',
        summary=(f'{actor.name}이(가) 성과 {len(deleted)}건을 삭제했습니다. '
                 f'연결이 해제된 과제 {len(affected_projects)}건.'),
        changes={
            'count': len(deleted),
            'affectedProjectCount': len(affected_projects),
            'reason': reason,
            'performances': [{'title': d['title'], 'year': d['year']}
                             for d in deleted[:200]],
            'truncated': len(deleted) > 200,
        },
        user_id=actor.id,
        user_name=actor.name,
        source='server',
    ))
    db.session.commit()

    return success_response(
        {'count': len(deleted),
         'unlinkedProjects': affected_projects,
         'affectedProjectCount': len(affected_projects)},
        message=(f'성과 {len(deleted)}건을 삭제했습니다. '
                 f'연결이 해제된 과제 {len(affected_projects)}건.'))


# ─────────────────────────────────────────────────────────────────────────────
# metadata
#
# 컷오버 후 dashboard_data 가 없어지므로 module_settings 로 옮긴다(마이그레이션 불필요).
#
# 동시에 계획서 7-5 가 지적한 **"metadata 무조건 덮어쓰기" 버그**를 고친다.
#   지금은 저장할 때마다 그 사용자의 로컬 metadata 가 전역 값을 통째로 덮는다.
#   A 가 화면 모드를 간트로 바꾸고 저장하면 **모두의** 서버 metadata 가 간트가 된다.
#
#   그래서 두 부류를 나눈다.
#     settings.*                사용자별 화면 취향 → 서버가 받지 않는다(무시)
#     projectCount/performanceCount  세면 나오는 값 → 저장하지 않고 읽을 때 계산
#     그 외 (lastBackupDate 등)  진짜 전역 값 → 저장
# ─────────────────────────────────────────────────────────────────────────────

_META_MODULE = 'digital_twin_dashboard'
_META_KEY = 'dashboard_metadata'

# 사용자별 화면 취향. 서버에 올라와도 무시한다.
_META_PER_USER_KEYS = {'settings'}
# 저장하지 않고 읽을 때 센다. 저장하면 곧 어긋난다.
_META_DERIVED_KEYS = {'projectCount', 'performanceCount'}


def _meta_row(create=False):
    row = ModuleSettings.query.filter_by(
        module_name=_META_MODULE, settings_key=_META_KEY).first()
    if row is None and create:
        row = ModuleSettings(module_name=_META_MODULE, settings_key=_META_KEY,
                             settings_data={},
                             description='대시보드 metadata (V2). 사용자별 화면 취향은 담지 않는다.')
        db.session.add(row)
        db.session.flush()
    return row


def _meta_payload(stored: dict) -> dict:
    """저장된 전역값 + 지금 센 개수. 응답 형태는 V1 과 같게 유지한다."""
    out = dict(stored or {})
    out['projectCount'] = Dt2Project.query.filter(
        Dt2Project.is_deleted.is_(False),
        Dt2Project.is_permanently_deleted.is_(False)).count()
    out['performanceCount'] = Dt2Performance.query.filter(
        Dt2Performance.is_deleted.is_(False)).count()
    return out


@bp_v2.route('/metadata', methods=['GET'])
@auth_required
def get_metadata():
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    row = _meta_row()
    return success_response(_meta_payload(row.settings_data if row else {}))


@bp_v2.route('/metadata', methods=['PUT'])
@auth_required
def put_metadata():
    """
    전역 metadata 갱신.

    `settings`(화면 취향)와 개수는 **받지 않는다.** 보내도 조용히 버린다 —
    거부하면 기존 화면이 저장할 때마다 실패하게 되고, 그건 이 버그를 고치는
    방법으로 적절하지 않다. 대신 무엇이 무시됐는지 응답에 담아 알려준다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    if actor.role == UserRole.VIEWER:
        return error_response('metadata 를 수정할 권한이 없습니다.', status_code=403)

    body = request.get_json(silent=True) or {}
    incoming = body.get('metadata')
    if not isinstance(incoming, dict):
        return error_response('metadata 는 객체여야 합니다.', status_code=400)

    row = _meta_row(create=True)
    stored = dict(row.settings_data or {})
    ignored = []
    for k, v in incoming.items():
        if k in _META_PER_USER_KEYS:
            ignored.append(k)
            continue
        if k in _META_DERIVED_KEYS:
            ignored.append(k)
            continue
        stored[k] = v
    stored['updatedAt'] = now_utc_iso_z()
    stored['updatedBy'] = actor.name

    row.settings_data = stored
    flag_modified(row, 'settings_data')
    db.session.commit()

    return success_response({
        **_meta_payload(stored),
        'ignoredKeys': sorted(ignored),
    })


def _readable(v):
    """JSONB 에 넣을 수 있게 변환. 날짜 등은 문자열로."""
    if v is None or isinstance(v, (str, int, float, bool, list, dict)):
        return v
    return str(v)


def _apply(p: Dt2Project, patch: dict, caller: User, subject: User,
           delegated: bool, source: str, reason=None, on_behalf_of_id=None,
           ai_fields=None):
    """
    실제로 값을 넣고 변경 로그·진척 이력을 남긴다.

    **값이 실제로 달라진 필드만** 기록한다. 화면이 폼 전체를 보내면
    안 바뀐 필드까지 로그가 쌓여서 병합 판정이 과하게 보수적으로 변한다.

    `ai_fields`  **AI 폼 도우미가 채워 준 칸**(컬럼명 집합). 그 칸만 `source='ai_fill'`
        로 남는다 — 나머지는 사람이 직접 친 값이라 `source` 그대로다.

        왜 필드마다 가르나
            이 저장은 **사람이 누른 것**이라 `actor_mode='ai'` 가 아니다(권한·확인
            절차도 사람 기준으로 걸린다). 그래서 저장 하나에 AI 가 채운 칸과 사람이
            친 칸이 **섞여 있다.** 저장 단위로 하나만 적으면 둘 중 하나가 거짓이 된다.
        `ai`(에이전트가 스스로 쓴 것)와도 갈라 둔다 — 그쪽은 확인 절차(202)를 거쳤고
        이쪽은 사람이 화면에서 보고 저장했다. 나중에 되짚을 때 성격이 다르다.
    """
    # 사업부 텍스트가 바뀌면 division_id 도 함께 다시 푼다.
    #
    # **모든 쓰기 경로가 이 함수를 지나므로 여기 한 곳에 둔다** — 화면 PATCH 도,
    # AI 제안 승인도 같이 걸린다. 호출부마다 넣으면 언젠가 하나를 빠뜨린다.
    # 안 하면 사업부를 옮긴 과제의 권한이 옛 사업부에 남는다(P.resolve_division_id 참조).
    if 'division' in patch and 'division_id' not in patch:
        patch = dict(patch)
        patch['division_id'] = P.resolve_division_id(patch['division'])

    # 액션아이템이 오면 상위 완료여부·완료일·진행률을 서버가 파생시킨다.
    # 사업부와 같은 이유로 여기에 둔다 — 화면 PATCH 도 AI 제안 승인도 이 함수를
    # 지나므로, 호출부마다 넣으면 언젠가 하나를 빠뜨린다.
    #
    # **저장 전 값을 함께 넘긴다.** uuid 없이 들어온 항목이 기존 uuid 를 물려받는
    # 자리다 — 이관 중(백필 전·옛 화면) 저장에서 uuid 가 새로 발급되는 것을 막는다.
    # status 는 **이 저장이 끝난 뒤의** 값이어야 한다 — patch 에 있으면 그것,
    # 없으면 지금 DB 값. (액션아이템 0건일 때만 진행률이 여기에 좌우된다)
    patch = _derive_action_items(patch, _stored_action_items(p),
                                 status=patch.get('status', p.status))

    # setattr 하고 나면 이전 값을 알 수 없다. 바꾸기 **전에** 같이 담아둔다.
    pending = []
    for field, new in patch.items():
        old = getattr(p, field, None)
        if _readable(old) == _readable(new):
            continue
        pending.append((field, _readable(old), _readable(new)))

    if not pending:
        return []

    for field, _old, new in pending:
        setattr(p, field, new)

    p.row_version = (p.row_version or 1) + 1
    db.session.flush()

    ai_cols = set(ai_fields or ())
    for field, old, new in pending:
        db.session.add(Dt2ProjectChange(
            project_uuid=p.uuid,
            row_version=p.row_version,
            field=field,
            before_value=old,
            after_value=new,
            actor_user_id=caller.id,
            # 제안 승인 경로는 원래의 대리 관계를 그대로 물려받는다
            on_behalf_of=on_behalf_of_id if on_behalf_of_id is not None
                         else (subject.id if delegated else None),
            source='ai_fill' if field in ai_cols else source,
            reason=reason,
        ))

    # 진척 지표가 바뀌었으면 시계열에도 한 점 남는다.
    # 안 바뀌었으면 이 함수가 알아서 None 을 돌려주고 아무것도 안 쓴다.
    record_project_history(p, source=source)
    return [f for f, _o, _n in pending]


# ─────────────────────────────────────────────────────────────────────────────
# 「내 일」 (2026-08-11) — 로그인한 사람이 지금 손대야 하는 것
#
# 계산은 전부 `worklist.py` 에 있다. 여기서는 인자를 풀고 권한 관문만 지난다.
# ─────────────────────────────────────────────────────────────────────────────

@bp_v2.route('/me/worklist', methods=['GET'])
@auth_required
def my_worklist():
    """
    「내 일」 한 판.

        ?lens=mine|division|office   없으면 역할이 정한 기본값
        ?year=2026                   과제년도. 없으면 전체
        ?summary=1                   **급한 카드 셋만** — 배지 숫자용

    왜 summary 를 가르나 — 배지는 로그인 직후 자동으로 부른다. 전체를 만들면
    `stalled` 가 진척 이력을 통째로 읽어 첫 화면 로딩에 그대로 얹힌다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    year = request.args.get('year', type=int)
    return success_response(WL.build(
        actor,
        lens=request.args.get('lens'),
        years=[year] if year else None,
        summary=request.args.get('summary') in ('1', 'true', 'yes'),
    ))


@bp_v2.route('/me/worklist/snooze', methods=['POST'])
@auth_required
def my_worklist_snooze():
    """
    항목 하나를 30일 미룬다. 본문 `{"itemKey": "...", "card": "stalled"}`.

    ⚠️ **자기 것만 미룰 수 있다** — `user_id` 를 본문에서 받지 않고 토큰에서 꺼낸다.
       남의 목록을 대신 지워 줄 이유가 없고, 받으면 그게 곧 구멍이다.

    ⚠️ 항목이 실재하는지 검사하지 않는다. 미룸은 **표시 상태**일 뿐 권한이나
       데이터를 바꾸지 않고, 검사하려면 카드 전체를 다시 만들어야 한다(비싸다).
       엉뚱한 키를 넣어도 아무 카드에도 안 걸려 아무 일이 일어나지 않는다.
    """
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    body = request.get_json(silent=True) or {}
    item_key = str(body.get('itemKey') or '').strip()
    if not item_key:
        return error_response('itemKey 가 필요합니다.', status_code=400)
    if len(item_key) > 200:
        return error_response('itemKey 가 너무 깁니다(200자).', status_code=400)

    row = WL.snooze(actor.id, item_key, card=body.get('card'))
    return success_response({
        'itemKey': item_key,
        # 저장은 naive UTC, 응답은 KST 오프셋 — 이 저장소의 시각 규칙 그대로다.
        'until': iso_kst(row.until),
        'days': WL.SNOOZE_DAYS,
    })


@bp_v2.route('/me/worklist/snooze', methods=['DELETE'])
@auth_required
def my_worklist_unsnooze():
    """미뤄둔 것을 도로 꺼낸다. `?itemKey=...` 또는 본문."""
    actor = _actor()
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)

    body = request.get_json(silent=True) or {}
    item_key = str(request.args.get('itemKey') or body.get('itemKey') or '').strip()
    if not item_key:
        return error_response('itemKey 가 필요합니다.', status_code=400)

    return success_response({'itemKey': item_key,
                             'removed': WL.unsnooze(actor.id, item_key)})
