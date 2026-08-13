"""
디지털 트윈 대시보드 — 과제별 쓰기 권한 (Phase 3-1)

이 파일이 존재하는 이유
    지금 구조는 모든 쓰기가 `dashboard_data` 싱글톤 한 행을 통째로 다시 쓴다.
    그래서 "이 사람이 이 과제를 고쳐도 되는가" 를 물을 **대상**이 없었다.
    Phase 2 에서 과제가 행이 되었으므로 이제 물을 수 있다.

    **모든 쓰기 경로(사람 UI · MCP · 스크립트)가 이 파일의 함수를 반드시 경유한다.**
    권한 판단이 여러 곳에 흩어지면 한 곳만 빠뜨려도 구멍이 된다.

설계 원칙
    - **실패 시 거부(fail closed).** 판단할 수 없으면 False 다. 애매하면 막는다.
    - **모르는 필드는 거부.** 분류표에 없는 필드는 저위험으로 처리하지 않는다.
      필드가 추가됐는데 분류를 안 했다면 그건 실수이지 저위험이 아니다.
    - 권한 판단에 쓰는 값이 없으면(소유자 미지정 등) 그 경로만 닫히고
      admin 경로는 남는다. 아무도 못 고치는 상태가 되지 않는다.
"""

from __future__ import annotations

from flask import g

from app import db
from app.modules.auth.models import User, UserRole
from app.modules.digital_twin_dashboard.models import Department, Division


# 과제 소유·사업부와 무관하게 전 과제를 편집할 수 있는 역할.
# dt_office(디지털트윈 사무국)는 대시보드를 운영하는 주체라 사업부를 넘나들며
# 데이터를 바로잡아야 한다. 권한 레벨도 70 으로 manager(50) 위에 있다.
# (2026-07-29 결정. 운영 인원 2명. 변경은 row_version 과 변경 로그로 추적된다)
GLOBAL_EDIT_ROLES = frozenset({UserRole.ADMIN, UserRole.DT_OFFICE_MEMBER})


# ─────────────────────────────────────────────────────────────────────────────
# 필드 분류 — 실행계획 7-2
#
# 사람이 UI 에서 편집할 때는 이 분류를 쓰지 않는다. 전부 즉시 반영된다.
# **AI(MCP) 쓰기에만 적용된다.** 결정된 방침:
#   저위험 → 즉시 커밋 / 핵심 → dt2_change_proposals 에 쌓고 사람이 승인
# ─────────────────────────────────────────────────────────────────────────────

LOW_RISK_FIELDS = frozenset({
    'progress',                  # 진행률
    'monthly_progress_json',     # 월간진척현황
    'action_items_json',         # 액션아이템목록
    'issues_json',               # 이슈목록
    'description',               # 과제상세설명
    'detail_overview_json', 'detail_background_json', 'detail_goal_json',
    'detail_content_json', 'detail_result_json', 'detail_output_json',
    'detail_plan_json', 'detail_completed',
    # 작성자 — **표시용 이름**. 권한은 `author_knox_id` 로만 판단하므로 이름은 저위험이다
    # (`pl_name` 과 달리 CORE 가 아닌 이유도 같다 — 이름으로는 권한이 안 열린다).
    'author_name',
    # ⚠️ `author_knox_id` 는 **2026-08-11 에 CORE 로 옮겼다.** 여기 없다.
    #    작성자는 운영에서 그 과제 정보를 실제로 입력한 사람이라 편집 권한을 갖는다
    #    (can_edit_project → is_project_author). 권한을 주는 필드는 저위험일 수 없다.
    'image_group1_category', 'image_group2_category',   # 이미지 그룹 이름표
})

CORE_FIELDS = frozenset({
    'title',                     # 과제명
    'start_month', 'end_month',  # 일정
    'status',                    # 진행상태
    'canceled_at',               # 취소 전환 시각 — status 와 한 쌍이다
    'division', 'division_id',   # 사업부
    'process',                   # 프로세스 — 사업부·과제구분과 같은 분류 축
    'pl_name', 'owner_user_id',  # 과제PL / 소유자
    'category',                  # 과제구분
    'domain',                    # 과제영역
    'year',                      # 과제년도
    'is_deleted', 'deleted_at',  # 삭제/복구 — 휴지통이라 되돌릴 수 있다
    # ⚠️ `is_permanently_deleted` 는 여기 없다 → IMMUTABLE 로 내렸다. 아래 참조.
    'is_poc', 'is_key',          # PoC/중점 — 집계에 직접 반영되므로 핵심으로 둔다
    # ★ 아래 여섯은 **편집 권한을 부여하는 필드**다.
    #   can_edit_project → is_project_member 가 members_json / owners_json 을,
    #   is_project_pl 이 pl_knox_id 를, is_project_author 가 author_knox_id 를 본다.
    #   여기 이름이 들어가면 그 사람이 이 과제를 고칠 수 있게 된다. 저위험일 수 없다.
    'members_json',
    'pl_knox_id',                # 과제PL 의 계정 — pl_name(표시용)과 뜻이 다르다
    # 작성자의 계정 — author_name(표시용)과 뜻이 다르다. 2026-08-11 LOW_RISK 에서 옮겼다.
    'author_knox_id',
    'depts_json',
    # ⚠️ `owners_json`·`member_names`·`dept_name` 은 여기 없다 →
    #    PROJECT_DERIVED_FIELDS. 위 둘의 **표시용 사본**이라 서버가 만든다.
    'owner_user_id',             # 소유자 — 아래 OWNER_ADMIN_ONLY 참조
    'is_division_public',        # 사업부 내 공개 여부 — 가시성을 바꾼다
    # 보고서 이미지 슬롯(이미지_좌측 등 5개)이 이 컬럼 하나에 담긴다.
    # 원래 IMMUTABLE 이었고 주석은 '이미지 API 로만' 이었는데 **그 API 가 없었다** —
    # 그래서 상세정보에서 이미지를 넣으면 저장이 통째로 V1 으로 물러섰다(2026-07-30 실측).
    # 사람이 큐레이션하는 값이라 AI 는 제안 큐를 거치게 핵심으로 둔다.
    'image_refs_json',
})

# ─────────────────────────────────────────────────────────────────────────────
# AI 는 아예 못 건드리는 필드. **사람은 화면에서 고칠 수 있다** — 불변이 아니다.
#
# 왜 확인(202)으로 안 되고 금지인가
#     확인 화면은 before → after 를 **이름으로** 보여준다. 그런데 참여인력·소유자는
#     **동명이인이면 이름만 봐서 구분이 안 된다**(개발 실측에서 한 이름이 여러
#     (이름,부서) 묶음에 걸친 게 4종). 사용자가 "홍길동 추가" 를 보고 예라고 해도
#     그게 어느 홍길동인지 모른 채 승인하는 것이다.
#
#     그리고 결과가 다른 필드와 질이 다르다 — 여기 이름이 들어가면 그 사람이
#     **이 과제를 고칠 수 있게 된다**(`is_project_member` 가 members_json/owners_json 을
#     읽는다). 되돌린다고 끝이 아니고, 그 사이에 접근이 열려 있었다.
#
#     그래서 이 필드들은 knoxId 를 **눈으로 대조하며** 고르는 전용 화면으로 보냈다
#     (참여인력 계정 점검 · 과제 편집창의 참여인력 배지).
#
# 2026-08-02 완화 — **참여인력·과제PL 은 knoxId 를 요구하며 연다.**
#     위 반대 근거의 핵심은 "이름만으로는 누구인지 가릴 수 없다" 였다. knoxId 는
#     users.email 로컬파트와 1:1 이라 그 모호함이 없다. 그래서 금지를 푸는 대신
#     **knoxId 를 필수로 만들고**(people_fields_missing_knox) 확인 절차는 그대로 둔다.
#     확인 preview 에는 이름·knoxId·부서를 같이 실어, 어느 홍길동인지 눈에 보이게 한다.
#
#     AI 가 knoxId 를 알아낼 방법도 같이 줬다 — MCP `find_people`
#     (GET /api/dt-v2/people/search). 이게 없으면 knoxId 필수는 그냥 봉쇄와 같다.
#
# ⚠️ 남겨 둔 것들
#     owner_user_id  소유자는 권한의 뿌리다. 화면에도 없고 관리자만 지정한다.
#     owners_json    담당자 — **문자열 배열이라 knoxId 를 담을 자리가 없다.**
#                    이름으로만 매칭되므로 동명이인 문제가 그대로 남는다.
#     member_names   참여인력의 레거시 표시용 문자열. 역시 이름뿐이다.
#                    members_json 만 열어도 화면은 그쪽을 읽으므로 불편이 없다.
# ⚠️ **지금은 비어 있다** (2026-08-05). 셋이 들어 있었는데 전부 다른 방법으로 옮겼다 —
# 금지는 "고칠 방법이 아예 없다" 는 뜻이라 마지막 수단이어야 하기 때문이다.
#
#   owners_json     담당자      → 파생. `과제참여인력목록` 의 이름 사본이다.
#   member_names    과제참여인력 → 파생. 동상(문자열 join).
#   owner_user_id   소유자      → **금지가 아니라 권한 문제였다.** int 사용자 id 라
#                                이미 사람을 특정한다(동명이인 문제 없음). 화면도
#                                admin 만 지정할 수 있다 → 같은 검사를 태운다.
#
# 되살릴 때는 **"이름만 담겨서 누구인지 못 가린다"** 처럼 값의 모양 자체가 확인을
# 불가능하게 만드는 경우여야 한다. 권한이 문제면 권한 검사로, 사본이면 파생으로 푼다.
AI_FORBIDDEN_FIELDS = frozenset()

# 소유자는 **admin·dt_office 만** 지정할 수 있다. 사람이든 AI 든 같다.
#
#   🐞 2026-08-05 실측: 생성(`create_project`)에는 이 검사가 있는데 **수정에는 없어서**,
#      일반 사용자가 자기 과제의 소유권을 남에게 그냥 넘길 수 있었다(PATCH → 200).
#      같은 일에 기준이 두 곳이면 느슨한 쪽으로 샌다 — 영구삭제 때와 같은 함정이다.
OWNER_ADMIN_ONLY_FIELDS = frozenset({'owner_user_id'})

# ─── `과제참여인력목록`·`담당부서목록` 에서 **파생**되는 표시용 사본 ──────────────
#
# 화면이 이미 그렇게 만든다(`ProjectModal/utils/formUtils.js`) —
#     담당자     = 과제참여인력목록.map(p => p.이름)
#     과제참여인력 = 그 이름들을 ', ' 로 join
#     담당부서    = 담당부서목록.join(', ')
# 주석도 "이전 버전과의 호환성을 위한 데이터(문자열 형태)" 라고 말한다.
#
# 그런데 서버에는 그 규칙이 없어서 **갈라진다** (2026-08-05 실측):
#   · 담당자·과제참여인력  110건 중 5건에만 있다. 나머지는 참여인력이 있는데도 비어 있다.
#   · 담당부서            100건 중 44건이 어긋나 있었다 — **첫 부서만** 남은 낡은 값이다
#     (부서가 2개가 됐는데 사본은 1개 그대로).
#
# `manager_name`(과제PL 의 사본) · 성과 `unit`(소분류의 사본)과 같은 구조다.
PROJECT_DERIVED_FIELDS = frozenset({
    'owners_json',               # 담당자
    'member_names',              # 과제참여인력 (문자열)
    'dept_name',                 # 담당부서 (문자열)
})

# knoxId 없이는 AI 가 못 건드리는 필드. 값이 **누구인지 특정되어야만** 통과한다.
#   members_json    [{knoxId, 이름, 부서}, ...]  원소마다 knoxId 가 있어야 한다
#   pl_knox_id      문자열 하나
#   author_knox_id  문자열 하나 (2026-08-11 추가 — 편집 권한을 주게 되면서)
#
# 계정으로 안 풀려도 막지 않는다 — knoxId 는 사내 이메일 앞부분이라 **가입 전에도
# 미리 채울 수 있고**, 계정이 없으면 권한도 안 생긴다(is_project_member 는 실제
# 계정과 대조한다). 확인 preview 에 '가입 대기' 로 표시해 사람이 판단하게 한다.
AI_KNOX_REQUIRED_FIELDS = frozenset({'members_json', 'pl_knox_id', 'author_knox_id'})

# 위 중 **문자열 하나**인 것들 (나머지는 배열이라 원소마다 본다).
_KNOX_SCALAR_FIELDS = frozenset({'pl_knox_id', 'author_knox_id'})


def ai_forbidden_in(patch: dict) -> list[str]:
    """patch 안에 있는 **AI 금지 필드**. 사람 경로에서는 부르지 않는다."""
    return sorted(k for k in (patch or {}) if k in AI_FORBIDDEN_FIELDS)


def people_fields_missing_knox(patch: dict) -> list[str]:
    """
    knoxId 가 빠진 사람 필드를 골라낸다. **AI 경로에서만 부른다.**

    사람은 화면에서 이름만 적어 둘 수 있다(나중에 [참여인력 계정 점검] 에서 채운다).
    AI 는 안 된다 — 이름만 들어가면 확인 화면이 "홍길동 추가" 만 보여주게 되고,
    그건 사용자가 **아무것도 확인하지 못한 채 승인**하는 것이다.
    """
    out = []
    for key, value in (patch or {}).items():
        if key not in AI_KNOX_REQUIRED_FIELDS:
            continue
        if key in _KNOX_SCALAR_FIELDS:
            # 빈 값은 '연결 해제' 라 허용한다. 권한을 주는 방향이 아니다.
            if value is not None and str(value).strip() == '':
                continue
            if not str(value or '').strip():
                out.append(key)
            continue
        # members_json — 원소마다 본다. 배열이 아니면 형태부터 틀린 것이다.
        if not isinstance(value, list):
            out.append(key)
            continue
        for el in value:
            if not isinstance(el, dict) or not str(el.get('knoxId') or '').strip():
                out.append(key)
                break
    return sorted(set(out))


# 어떤 경로로도 PATCH 를 받지 않는 필드. 서버가 정하거나 다른 API 로만 바뀐다.
IMMUTABLE_FIELDS = frozenset({
    'id', 'uuid', 'code',
    'row_version',               # 서버가 증가시킨다
    'created_at', 'updated_at',
    # 관리자 — **과제PL 의 사본이다. 독립된 값이 아니다.**
    #
    #   화면에는 입력 칸이 없고(예전에 제거됐다), 저장할 때 과제PL 값이 복사돼
    #   들어갔다. 그런데 별도 필드로 노출돼 있어서 **AI 는 이것만 따로 바꿀 수
    #   있었다** — 확인(202)까지 거쳐 반영한 값이 다음 저장 때 과제PL 로 조용히
    #   덮였다. 아무도 읽지 않는 칸이라 되돌아간 것도 알 수 없었다.
    #   (2026-08-02 실측: 활성 226건 중 207건이 빈 값, 18건이 과제PL 과 동일)
    #
    #   이제 **서버가 pl_name 에서 파생시킨다**(_derive_manager). 그래서 여기서는
    #   불변이고, describe_fields 의 "서버가 정한다" 가 사실이 된다.
    'manager_name',
    # 영구삭제 — **PATCH 로는 못 한다. 전용 라우트(admin·dt_office)로만.**
    #
    #   2026-08-05 실측: 핵심 필드였을 때 `patch_project({'_permanentlyDeleted': True})`
    #   가 202 → confirm 으로 **통과했다.** 그것도 admin 이 아니라 **그 과제를 고칠 수
    #   있는 일반 사용자**로 됐다(role=user 소유자로 확인). 즉 같은 일에 권한 기준이
    #   두 곳에 있었고, 느슨한 쪽으로 샜다 —
    #     · permanent_delete_project   GLOBAL_EDIT_ROLES(admin·dt_office)
    #     · patch 경로                 can_edit_project (소유자·참여인력·과제PL)
    #
    #   소프트 삭제(`is_deleted`)와 달리 **되돌릴 수 없다.** 휴지통에도 안 남는다.
    #   그래서 확인 절차로 감쌀 수 있는 종류가 아니라고 보고 경로 자체를 하나로 모았다.
    #   (화면은 이 필드를 보내지 않는다 — 2026-08-05 전수 확인)
    'is_permanently_deleted',
    'extra_fields',              # 이관 산물. 손으로 고칠 값이 아니다
    'report_confirmation',       # 보고 확인 API 로만
    # 누가 지웠는지는 삭제 API 가 기록한다. 본문으로 받으면 위조할 수 있다.
    'deleted_by_raw', 'deleted_by_name',
    'permanently_deleted_at',
    'permanently_deleted_by_raw', 'permanently_deleted_by_name',
})


# ─── 성과 필드 분류 ──────────────────────────────────────────────────────────
# 과제와 기준이 하나 다르다. 성과는 여러 과제가 공유하므로,
# **다른 과제의 숫자까지 바꾸는 필드**는 전부 핵심으로 둔다.

PERF_LOW_RISK_FIELDS = frozenset({
    'actual_level',              # 실적수준 — 실제로 달성한 값
    'monthly_values_json',       # 월별실적
    'action_note',               # 조치사항
    'action_notes_json',
    'report_status_json',        # 보고현황목록
    'evaluation',                # 성과평가
    'description',               # 설명
})

PERF_CORE_FIELDS = frozenset({
    'title',                     # 성과항목 (이름)
    'display_name',
    'category', 'subcategory',   # 대분류 / 소분류
    # ⚠️ `unit` · `is_achievement_type` 은 여기 없다 → PERF_DERIVED_FIELDS. 아래 참조.
    'year',
    'current_level',             # ★ 현재수준 — 이 성과를 쓰는 모든 과제의 기준선
    'target_level',              # ★ 목표수준 — 동상
    'is_monthly',
    'calc_logic_json', 'has_calc_logic',
    'dt_contribution', 'has_dt_contribution',
    'is_active',
    'is_deleted', 'deleted_at',
})

PERF_IMMUTABLE_FIELDS = frozenset({
    'id', 'uuid', 'code',
    'legacy_uuid',               # 옛 참조를 푸는 열쇠. 바뀌면 연결이 끊긴다
    'row_version', 'created_at', 'updated_at',
    'deleted_by_raw', 'deleted_by_name',   # 삭제 API 가 기록한다
    'created_by_user_id',
    'extra_fields', 'is_from_sample',
})

# ─── 소분류에서 **파생**되는 필드 ────────────────────────────────────────────
#
# `performance_subcategories` 가 정본이다. 성과 행의 값은 그 사본일 뿐이다.
#
#   화면은 이미 그렇게 다룬다 — 소분류에 `unit` 이 있으면 입력을 `disabled + readOnly`
#   로 잠근다(`AddPerformanceModal.jsx`). 활성 소분류 35개가 **전부** `unit` 을 갖고
#   있으므로 화면에서 단위는 **항상 읽기 전용**이다.
#
#   그런데 서버 컬럼에는 검증이 없었다. 그 결과:
#     · 2026-08-05 실측 — 살아있는 성과 112건 중 **35건(31%)** 이 소분류와 달랐다.
#     · 더 나쁜 것은 **화면에서 고칠 수도 없다**는 점이다. 수정 창은 저장된 값을
#       그대로 싣고 잠근다(소분류에서 다시 계산하지 않는다) → **틀린 채로 굳는다.**
#
#   `manager_name`(과제PL 의 사본)과 같은 구조이고, 결론도 같다 —
#   **입력을 막는 것만으로는 부족하다. 서버가 파생시켜야 한다**(`_derive_perf_from_subcategory`).
#
# ⚠️ IMMUTABLE 에 넣지 않는다. 넣으면 화면이 보낼 때마다 `ignored` 에 떠서 소음이 된다
#    (화면은 폼 전체를 보낸다). 대신 **분류 전에 떼어내고** 서버 값으로 채운다.
#    보낸 값과 다르면 응답 `normalized` 로 알린다 — 조용히 바꾸지 않는다.
PERF_DERIVED_FIELDS = frozenset({
    'unit',                      # 단위
    'is_achievement_type',       # 달성형 여부
})


class PatchClassification:
    """PATCH 본문을 분류한 결과."""

    def __init__(self, low_risk: dict, core: dict, rejected: list[str]):
        self.low_risk = low_risk
        self.core = core
        self.rejected = rejected      # 모르는 필드 + 불변 필드

    @property
    def ok(self) -> bool:
        return not self.rejected

    def __repr__(self):
        return (f'<PatchClassification low={list(self.low_risk)} '
                f'core={list(self.core)} rejected={self.rejected}>')


def _classify(patch: dict, low_set, core_set, immutable_set) -> PatchClassification:
    low, core, rejected = {}, {}, []
    for key, value in (patch or {}).items():
        if key in immutable_set:
            rejected.append(key)
        elif key in low_set:
            low[key] = value
        elif key in core_set:
            core[key] = value
        else:
            rejected.append(key)
    return PatchClassification(low, core, rejected)


def classify_patch(patch: dict) -> PatchClassification:
    """
    과제 PATCH 본문을 저위험 / 핵심 / 거부로 나눈다.

    분류표에 없는 필드는 **거부**한다. 저위험으로 흘려보내면
    나중에 필드를 추가하고 분류를 깜빡했을 때 조용히 AI 가 고치게 된다.
    """
    return _classify(patch, LOW_RISK_FIELDS, CORE_FIELDS, IMMUTABLE_FIELDS)


def classify_performance_patch(patch: dict) -> PatchClassification:
    """성과 PATCH 본문 분류. 규칙은 과제와 같고 표만 다르다."""
    return _classify(patch, PERF_LOW_RISK_FIELDS, PERF_CORE_FIELDS,
                     PERF_IMMUTABLE_FIELDS)


# ─────────────────────────────────────────────────────────────────────────────
# 사용자 → 사업부 해석
# ─────────────────────────────────────────────────────────────────────────────

def _norm_dept(s) -> str:
    """부서명 비교용 정규화. 공백만 정리한다 — 과하게 다듬으면 오히려 오매칭된다."""
    if not s:
        return ''
    return ' '.join(str(s).replace('　', ' ').split()).strip().lower()


def resolve_division_id(name):
    """
    과제의 `사업부` 텍스트 → `divisions.id`.

    왜 필요한가
        과제의 사업부는 FK 가 아니라 **자유 텍스트**다(V1 계약을 그대로 이어받았다).
        그런데 권한 판단의 manager 분기는 `division_id` 를 본다. 텍스트만 바꾸고 id 를
        그대로 두면 **사업부를 옮긴 과제가 옛 사업부 기준으로 남는다** — 옛 사업부
        manager 가 계속 고칠 수 있고, 새 사업부 manager 는 못 고친다.

    규칙은 이관 스크립트(dt2_import.load_refs)와 같다 —
    **활성 사업부만**, 이름은 앞뒤 공백만 정리해 정확히 비교.
    (비활성 행은 설정을 저장할 때마다 쌓인 옛 버전이라 맞으면 안 된다)

    못 찾으면 None 을 준다. 값을 지어내지 않는다 — 틀린 사업부에 붙는 것보다
    '미상' 이 낫다(can_edit_project 가 None 이면 비교 자체를 하지 않는다).
    """
    if name is None:
        return None
    text = str(name).strip()
    if not text:
        return None
    row = (Division.query
           .filter(Division.is_active.is_(True), Division.name == text)
           .first())
    return row.id if row else None


def actor_division_id(actor: User):
    """
    사용자가 속한 사업부 id. 못 풀면 None.

    ⚠️ `users.department` 는 FK 가 아니라 **자유 텍스트**다.
       `departments.name` 과 이름으로 맞춰야 한다. 그래서 세 가지로 실패할 수 있다.
         - 부서가 비어 있다
         - 이름이 어느 부서와도 안 맞는다
         - 같은 이름의 부서가 여러 사업부에 있어 확정할 수 없다
       셋 다 None 을 돌려준다(fail closed). 이 사람은 manager 경로를 못 탄다.

       근본 해결은 `users.department_id` FK 를 만드는 것이고,
       그건 컷오버 전에 별도로 처리한다. 지금은 있는 데이터로 최선을 다한다.
    """
    if actor is None:
        return None

    cache = _req_cache('_dt2_division_cache')
    if cache is not None and actor.id in cache:
        return cache[actor.id]

    key = _norm_dept(getattr(actor, 'department', None))
    result = None
    if key:
        rows = (db.session.query(Department.division_id)
                .filter(Department.is_active.is_(True))
                .filter(db.func.lower(db.func.trim(Department.name)) == key)
                .all())
        divs = {r[0] for r in rows if r[0] is not None}
        if len(divs) == 1:
            result = next(iter(divs))
        # 0개(미매칭·division 없음) 또는 2개 이상(이름 중복) → None

    if cache is not None:
        cache[actor.id] = result
    return result


# ─────────────────────────────────────────────────────────────────────────────
# 권한 판단 — 실행계획 7-1
# ─────────────────────────────────────────────────────────────────────────────

def can_view_project(actor: User, project) -> bool:
    """
    읽기 권한. 대시보드는 원래 전사 공유가 전제라 활성 사용자면 볼 수 있다.
    `사업부내공개여부(is_division_public)` 가 켜진 과제만 같은 사업부로 제한한다.

    ⚠️ **당사자는 사업부와 무관하게 본다 (2026-08-11 추가).**
       그전에는 소유자만 예외였다. 그래서 사업부가 다른 과제PL·참여인력·작성자는
       **고칠 수는 있는데 목록에는 안 보이는** 상태였다(`can_edit_project` 는 통과,
       여기서 탈락). 어느 쪽으로도 설명이 안 되는 조합이라 맞췄다 —
       **고칠 수 있으면 볼 수 있어야 한다.**
    """
    if actor is None or not actor.is_active:
        return False
    if actor.role in GLOBAL_EDIT_ROLES:
        return True
    if not getattr(project, 'is_division_public', False):
        return True
    if project.owner_user_id == actor.id:
        return True
    if (is_project_pl(actor, project)
            or is_project_member(actor, project)
            or is_project_author(actor, project)):
        return True
    div = actor_division_id(actor)
    return div is not None and div == project.division_id


# ─────────────────────────────────────────────────────────────────────────────
# 과제 참여인력 → 편집 권한 (2026-07-29 결정)
#
# 소유자 한 명만으로는 현업이 돌아가지 않는다. 과제에 참여인력으로 등록된 사람도
# 자기 과제를 고칠 수 있어야 한다.
#
# 데이터 형태
#   members_json  [{knoxId, 부서, 이름, 순번}]   ← knoxId 가 빈 문자열인 경우가 있다
#   owners_json   ["이름", ...]                  ← 문자열 배열
#
# ⚠️ 이름 매칭의 함정
#   knoxId 는 users.email 로컬파트와 1:1 이라 안전하다.
#   그런데 이름은 **동명이인**이 있으면 엉뚱한 사람에게 편집 권한을 준다.
#   활성 사용자가 300명이 넘으므로 실제로 일어날 수 있다.
#   그래서 이름은 **그 이름을 가진 활성 사용자가 정확히 한 명일 때만** 인정한다.
# ─────────────────────────────────────────────────────────────────────────────

def _req_cache(key):
    """
    요청 스코프 캐시. 앱 컨텍스트 밖(스크립트·단위시험)에서는 None 을 돌려준다.

    `getattr(g, ...)` 자체가 컨텍스트 밖에서 RuntimeError 를 던지므로
    읽기까지 감싸야 한다.
    """
    try:
        cache = getattr(g, key, None)
        if cache is None:
            cache = {}
            setattr(g, key, cache)
        return cache
    except RuntimeError:
        return None


def actor_match_tokens(actor: User):
    """
    참여인력 목록에서 이 사용자를 찾을 때 쓸 열쇠. (knoxId용 로컬파트, 이름 또는 None)

    이름은 **유일할 때만** 돌려준다. 동명이인이면 None 이라 이름으로는 매칭되지 않는다.
    이름 유일성을 확인할 수 없는 상황(DB 접근 불가)에서는 이름을 버린다 — 권한은
    판단할 수 없을 때 좁게 잡는다.
    """
    if actor is None:
        return None, None

    cache = _req_cache('_dt2_match_cache')
    if cache is not None and actor.id in cache:
        return cache[actor.id]

    email = (getattr(actor, 'email', '') or '')
    local = email.split('@')[0].strip().lower() if '@' in email else ''

    name = (getattr(actor, 'name', '') or '').strip()
    if name:
        try:
            same = (db.session.query(db.func.count(User.id))
                    .filter(User.is_active.is_(True))
                    .filter(db.func.btrim(User.name) == name)
                    .scalar())
        except Exception:
            same = None              # 확인 불가 → 이름으로 판단하지 않는다
        if same != 1:
            name = ''

    result = (local or None, name or None)
    if cache is not None:
        cache[actor.id] = result
    return result


def is_project_pl(actor: User, project) -> bool:
    """
    이 사람이 과제PL 인가. **knoxId 로만 판단한다.**

    ⚠️ 참여인력과 달리 **이름으로는 매칭하지 않는다.** 이름까지 인정하면
       `pl_name`(표시용, 핵심 필드라 AI 도 확인만 거치면 고친다)을 바꾸는 것만으로
       편집 권한이 생긴다. 그러면 권한이 걸린 필드를 하나 더 막아야 하고,
       동명이인이 있을 때 엉뚱한 사람에게 권한이 간다.
       knoxId 는 users.email 로컬파트와 1:1 이라 그런 구멍이 없다.

    그래서 이름만 적힌 옛 과제는 **여기서 걸리지 않는다.** 화면에서 PL 을 다시
    고르면(자동완성) knoxId 가 채워지고 그때부터 권한이 생긴다. 이름으로 되짚어
    자동으로 채우지 않는 것은 의도다 — 동명이인에게 권한을 줄 수 없다.
    """
    if actor is None or project is None:
        return False
    local, _name = actor_match_tokens(actor)
    if not local:
        return False
    pl_knox = (getattr(project, 'pl_knox_id', None) or '').strip().lower()
    return bool(pl_knox) and pl_knox == local


def is_project_author(actor: User, project) -> bool:
    """
    이 사람이 작성자인가. **knoxId 로만 판단한다** — `is_project_pl` 과 같은 이유다.

    작성자는 보고서를 쓴 사람이 아니라 **그 과제 정보를 실제로 입력한 사람**이다
    (2026-08-11 확인). 그래서 편집 권한을 갖는다.

    ⚠️ `author_name`(표시용)은 보지 않는다. 이름으로 열면 표시용 칸을 바꾸는 것만으로
       권한이 생기고, 동명이인이면 엉뚱한 사람에게 간다.
    """
    if actor is None or project is None:
        return False
    local, _name = actor_match_tokens(actor)
    if not local:
        return False
    author = (getattr(project, 'author_knox_id', None) or '').strip().lower()
    return bool(author) and author == local


def is_project_member(actor: User, project) -> bool:
    """
    참여인력(members_json) 또는 담당자(owners_json)에 이 사람이 있는가.

    **knoxId 로만 판단한다 (2026-08-11).** 그전에는 이름도 인정했다 — 그 이름을 가진
    활성 사용자가 정확히 한 명일 때만이라는 단서가 붙었지만, 그래도
      · 동명이인이 **한 명만 새로 가입해도** 권한이 조용히 끊기고
      · 그때까지는 엉뚱한 사람이 열려 있었을 수 있다
    운영에서는 과제마다 과제PL·작성자·참여인력 중 knoxId 보유자가 한 명 이상 있어
    (2026-08-11 확인) 이름 경로 없이도 본인 편집이 막히지 않는다.

    ⚠️ `owners_json` 은 **이름 문자열 배열**이라 knoxId 가 아예 없는 원소가 많다.
       그런 원소는 이제 권한을 열지 않는다 — 그 사람은 참여인력에 knoxId 로
       등록되어 있어야 한다([참여인력 계정 점검] 이 그 일을 한다).
    """
    local, _name = actor_match_tokens(actor)
    if not local:
        return False

    for el in (getattr(project, 'members_json', None) or []):
        if not isinstance(el, dict):
            continue
        if (el.get('knoxId') or '').strip().lower() == local:
            return True

    for el in (getattr(project, 'owners_json', None) or []):
        if isinstance(el, dict) and (el.get('knoxId') or '').strip().lower() == local:
            return True
    return False


# ─────────────────────────────────────────────────────────────────────────────
# 「내 일」 화면 — "이 과제가 내 것인가" (2026-08-11)
#
# ⚠️ **`can_edit_project` 를 쓰면 안 된다.** 그 함수는 manager 에게 **사업부 전체**를
#    통과시킨다. 그것으로 「내가 하는 일」을 만들면 매니저의 내 일이 사업부 전 과제가
#    되어 「우리 사업부」 렌즈와 같아진다 — 렌즈를 나눈 뜻이 사라진다.
#
#    그래서 여기서는 **역할을 보지 않는다.** 사람과 과제가 직접 이어진 것만 센다.
#    「우리 사업부」 렌즈는 `actor_division_id` 로 따로 판다.
# ─────────────────────────────────────────────────────────────────────────────

# 관계가 여럿이면 **강한 것 하나로** 말한다. 숫자가 작을수록 강하다.
#   왜 강도가 필요한가 — manager 가 자기 사업부 과제의 **작성자**인 경우가 흔하다.
#   전부 같은 무게로 섞으면 그 사람의 목록이 작성자 과제로 덮여 정작 자기가 PL 인
#   과제가 뒤로 밀린다. 카드마다 상한(5건)이 있어서 뒤로 밀리면 안 보인다.
RELATION_STRENGTH = {'pl': 0, 'member': 1, 'owner': 2, 'author': 3}


def project_relation(actor: User, project) -> str | None:
    """
    이 사람과 과제의 **가장 강한** 관계. 없으면 None.

    반환: 'pl' | 'member' | 'owner' | 'author' | None

    ⚠️ 'owner'(소유자)를 'author'(작성자)보다 강하게 두었지만 둘의 차이는 크지 않다.
       실제로 이관이 작성자를 소유자로 채운 과제가 많아 둘은 자주 같은 사람이다.
       PL·참여인력이 앞서는 것이 이 순서의 요점이다.
    """
    if actor is None or project is None:
        return None
    if is_project_pl(actor, project):
        return 'pl'
    if is_project_member(actor, project):
        return 'member'
    if project.owner_user_id is not None and project.owner_user_id == actor.id:
        return 'owner'
    if is_project_author(actor, project):
        return 'author'
    return None


def is_my_project(actor: User, project) -> bool:
    """
    「내가 하는 일」 렌즈의 모수. **역할로는 열리지 않는다** (위 주석 참조).

    viewer 는 어차피 아무것도 못 고치므로 「내 일」이 성립하지 않는다 — 뺀다.
    """
    if actor is None or not getattr(actor, 'is_active', False):
        return False
    if actor.role == UserRole.VIEWER:
        return False
    return project_relation(actor, project) is not None


def build_member_index():
    """
    활성 사용자를 **참여인력 원소와 맞춰 볼 수 있는 형태**로 한 번에 불러온다.

    반환: `(로컬파트→User, 유일한이름→User)`

    ⚠️ `actor_match_tokens` 와 **같은 규칙이어야 한다** — 그쪽은 "이 사람을 목록에서 어떻게
       찾나"(actor → 원소)이고 이쪽은 그 역방향(원소 → actor)이다. 규칙이 갈리면
       **화면은 '연결됨' 이라고 하는데 실제 권한은 안 열리는** 최악의 상태가 된다.
         · 이메일은 @앞부분, 공백 제거, 소문자
         · 이름은 **활성 사용자 중 유일할 때만** 쓴다 (동명이인이면 이름으로 못 찾는다)
         · 비활성 계정은 아예 제외 — `can_edit_project` 가 `is_active` 를 먼저 보기 때문
    """
    rows = User.query.filter(User.is_active.is_(True)).all()

    by_local = {}
    name_seen = {}
    for u in rows:
        if u.email and '@' in u.email:
            by_local.setdefault(u.email.split('@')[0].strip().lower(), u)
        key = (u.name or '').strip()
        if key:
            name_seen[key] = name_seen.get(key, 0) + 1

    by_name = {}
    for u in rows:
        key = (u.name or '').strip()
        if key and name_seen[key] == 1:
            by_name.setdefault(key, u)

    return by_local, by_name


def resolve_member(element, index=None):
    """
    참여인력 원소 하나가 **어느 계정과 연결되는가**. `is_project_member` 의 역방향이다.

    반환: `{matched, user, via, reason}`
        via  'knoxId' | 'name' | None
        reason  matched 가 False 일 때만 — 사람에게 보여줄 이유

    ⚠️ **"계정 없음" 과 "오타" 는 구분할 수 없다.** 둘 다 그냥 못 찾는 것이다.
       knoxId 는 사내 이메일 @앞부분이라 **가입 전에도 값을 알 수 있고**, 미리 채워 두면
       그 사람이 가입하는 순간 권한이 생긴다(이 판정은 요청할 때마다 다시 한다).
       그래서 화면은 "미입력" 과 "가입 대기" 를 나눠 보여줘야 한다 — 손댈 것은 전자뿐이다.
    """
    by_local, by_name = index if index else build_member_index()

    if isinstance(element, str):
        knox, name = '', element.strip()
    elif isinstance(element, dict):
        knox = (element.get('knoxId') or '').strip()
        name = (element.get('이름') or '').strip()
    else:
        knox, name = '', ''

    if knox:
        u = by_local.get(knox.lower())
        if u is not None:
            return {'matched': True, 'user': u, 'via': 'knoxId', 'reason': None}

    if name:
        u = by_name.get(name)
        if u is not None:
            # 이름은 **권한을 열지 않는다 (2026-08-11)** — `matched` 는 False 다.
            # 그래도 어느 계정인지는 알려준다: [참여인력 계정 점검] 이 이 값을 그대로
            # 채워 넣을 수 있어야 하고, 그게 이 도구의 존재 이유다.
            # (`user` 가 실려 있지만 `matched` 가 False 인 유일한 갈래다)
            return {'matched': False, 'user': u, 'via': 'name',
                    'reason': f'이름은 {u.name} 계정과 같지만 knoxId 가 없어 '
                              f'권한이 열리지 않습니다 — knoxId 를 채우세요'}

    if not knox and not name:
        return {'matched': False, 'user': None, 'via': None, 'reason': '이름·knoxId 가 모두 비어 있습니다'}
    if not knox:
        return {'matched': False, 'user': None, 'via': None, 'reason': 'knoxId 가 비어 있습니다'}
    return {'matched': False, 'user': None, 'via': None,
            'reason': '이 knoxId 로 가입한 계정이 없습니다 (미가입이거나 표기가 다릅니다)'}


def member_sql_condition(actor: User):
    """
    is_project_member + is_project_pl + is_project_author 와 **같은 판정**을 SQL 로.
    목록 필터(editable=true)와 성과 권한(editable_project_exists_for_performance)에 쓴다.

    셋이 갈리면 "보이는데 못 고치는" 과제가 생긴다.
    dt3_test_invariants.py 의 D 항목이 두 경로의 일치를 강제한다.

    **2026-08-11 이름 조건을 전부 뺐다.** 파이썬 쪽도 knoxId 로만 판단한다.
    그래서 토큰이 `local` 하나뿐이고, 없으면 조건 자체가 성립하지 않는다(None).

    knoxId 는 대소문자가 섞여 있어 `@>` containment 로는 못 잡는다. lower() 로 비교한다.
    members_json 이 배열이 아닌 경우 jsonb_array_elements 가 죽으므로 타입을 먼저 본다.
    """
    from sqlalchemy import text
    local, _name = actor_match_tokens(actor)
    if not local:
        return None

    # ⚠️ 없는 토큰은 SQL 에서 아예 뺀다.
    #    `:p IS NOT NULL` 로 우회하면 Postgres 가 NULL 파라미터의 타입을 추론하지 못해
    #    AmbiguousParameter 로 죽는다 (2026-07-29 실측).
    params = {'m_local': local}
    knox_eq = "lower(btrim(%s)) = :m_local"

    def json_any(col):
        """배열 컬럼의 원소 knoxId 중 하나라도 나면 참."""
        return ("(jsonb_typeof(dt2_projects.%s) = 'array' AND EXISTS ("
                "SELECT 1 FROM jsonb_array_elements(dt2_projects.%s) AS e "
                "WHERE nullif(btrim(e->>'knoxId'), '') IS NOT NULL "
                "AND " + knox_eq % "e->>'knoxId'" + "))") % (col, col)

    parts = [
        json_any('members_json'),
        # 담당자 — 이름 문자열 배열이 섞여 있다. 문자열 원소는 knoxId 가 없으므로
        # 이제 권한을 열지 않는다(객체 원소만 본다).
        json_any('owners_json'),
        # 과제PL — is_project_pl 과 같은 판정
        "(nullif(btrim(dt2_projects.pl_knox_id), '') IS NOT NULL AND "
        + knox_eq % 'dt2_projects.pl_knox_id' + ")",
        # 작성자 — is_project_author 와 같은 판정 (2026-08-11 추가)
        "(nullif(btrim(dt2_projects.author_knox_id), '') IS NOT NULL AND "
        + knox_eq % 'dt2_projects.author_knox_id' + ")",
    ]

    return text('(' + ' OR '.join(parts) + ')').bindparams(**params)


def can_edit_project(actor: User, project) -> bool:
    """
    쓰기 권한. **모든 쓰기 경로가 이 함수를 경유한다.**

    결정된 방침: 소유자·과제PL·참여인력·**작성자** + 같은 사업부 manager + admin + dt_office

        admin / dt_office   항상 허용
        소유자               owner_user_id 가 본인
        과제PL               pl_knox_id 가 본인      (2026-08-02 추가)
        참여인력             members_json / owners_json 에 본인이 있음 (2026-07-29 추가)
        작성자               author_knox_id 가 본인  (2026-08-11 추가)
        manager             본인 사업부의 과제
        그 외                거부

    ⚠️ 사람 경로는 전부 **knoxId 로만** 판정한다 (2026-08-11). 이름 매칭은 없다.

    viewer 는 어느 경로로도 편집할 수 없다 — 읽기 전용 역할이라 참여인력이어도 막는다.
    """
    if actor is None or not getattr(actor, 'is_active', False):
        return False
    if project is None:
        return False

    # 영구 삭제된 과제는 누구도 고칠 수 없다 (복구는 별도 API)
    if getattr(project, 'is_permanently_deleted', False):
        return False

    if actor.role in GLOBAL_EDIT_ROLES:
        return True

    # 역할이 viewer 면 소유자·참여인력이어도 쓰기를 주지 않는다.
    # '읽기 전용' 이라는 역할의 뜻이 무의미해지기 때문이다.
    if actor.role == UserRole.VIEWER:
        return False

    if project.owner_user_id is not None and project.owner_user_id == actor.id:
        return True

    # 과제PL — 소유자(=만든 사람)와 다를 수 있다. PL 로 지정된 사람이 자기 과제를
    # 못 고치는 상황을 없애려고 2026-08-02 에 추가했다. knoxId 로만 판정한다.
    if is_project_pl(actor, project):
        return True

    if is_project_member(actor, project):
        return True

    # 작성자 — 운영에서 그 과제 정보를 실제로 입력한 사람이다 (2026-08-11 추가).
    if is_project_author(actor, project):
        return True

    if actor.role == UserRole.MANAGER:
        div = actor_division_id(actor)
        # div 나 project.division_id 가 None 이면 비교하지 않는다.
        # None == None 을 참으로 처리하면 '사업부 미상' 인 사람이
        # '사업부 미상' 인 과제를 전부 고치게 된다.
        if div is not None and project.division_id is not None:
            return div == project.division_id

    return False


# ─────────────────────────────────────────────────────────────────────────────
# 성과 권한 — 2026-07-29 결정: "연결된 과제를 고칠 수 있으면 성과도 고칠 수 있다"
#
# ⚠️ 과제와 성격이 다르다. **성과 하나를 여러 과제가 참조한다.**
#    A 과제 담당자가 성과의 목표수준을 바꾸면 그 성과를 쓰는 B·C 과제의 숫자도
#    같이 바뀐다. 이건 막지 않기로 했지만(현업이 직접 고칠 수 있어야 한다),
#    **몇 개 과제가 영향받는지는 응답에 담아** 화면이 경고할 수 있게 한다.
#    routes_v2.affected_project_count() 참조.
# ─────────────────────────────────────────────────────────────────────────────

def editable_project_exists_for_performance(actor: User, performance_uuid: str) -> bool:
    """
    이 성과에 연결된 과제 중 actor 가 고칠 수 있는 것이 하나라도 있는가.

    과제를 하나씩 꺼내 can_edit_project 를 부르면 성과당 수십 번 왕복한다.
    같은 판정을 SQL 로 밀어 넣어 한 번에 끝낸다.
    (조건이 can_edit_project 와 어긋나면 안 되므로 여기만 고칠 것)
    """
    from app.modules.digital_twin_dashboard.models_v2 import (
        Dt2Project, Dt2ProjectPerformance,
    )
    from sqlalchemy import or_

    if actor.role == UserRole.VIEWER:
        return False

    conds = [Dt2Project.owner_user_id == actor.id]
    member_cond = member_sql_condition(actor)
    if member_cond is not None:
        conds.append(member_cond)
    if actor.role == UserRole.MANAGER:
        div = actor_division_id(actor)
        if div is not None:
            conds.append(Dt2Project.division_id == div)

    q = (db.session.query(Dt2Project.uuid)
         .join(Dt2ProjectPerformance,
               Dt2ProjectPerformance.project_uuid == Dt2Project.uuid)
         .filter(Dt2ProjectPerformance.performance_uuid == performance_uuid)
         .filter(Dt2Project.is_permanently_deleted.is_(False))
         .filter(Dt2Project.is_deleted.is_(False))
         .filter(or_(*conds)))
    return db.session.query(q.exists()).scalar()


def can_edit_performance(actor: User, perf) -> bool:
    """
    성과 수정 권한.

        admin / dt_office   항상 허용
        생성자              본인이 만든 성과 (아직 아무 과제도 안 붙었을 때를 위해)
        연결된 과제 담당     그 성과를 쓰는 과제 중 하나라도 고칠 수 있으면 허용
        그 외                거부

    생성자 예외가 없으면 "성과를 만들었는데 아직 과제에 안 붙여서 못 고치는" 상태가 된다.
    """
    if actor is None or not getattr(actor, 'is_active', False):
        return False
    if perf is None:
        return False
    if getattr(perf, 'is_deleted', False):
        return False

    if actor.role in GLOBAL_EDIT_ROLES:
        return True
    if getattr(perf, 'created_by_user_id', None) == actor.id:
        return True
    return editable_project_exists_for_performance(actor, perf.uuid)


def deny_reason_performance(actor: User, perf) -> str:
    if actor is None or not getattr(actor, 'is_active', False):
        return '로그인이 필요합니다.'
    if perf is None:
        return '성과를 찾을 수 없습니다.'
    if getattr(perf, 'is_deleted', False):
        return '삭제된 성과는 수정할 수 없습니다.'
    return ('이 성과에 연결된 과제 중 수정 권한이 있는 것이 없습니다. '
            '과제를 먼저 연결하거나 관리자에게 요청하세요.')


def can_create_project(actor: User) -> bool:
    """
    신규 과제 생성. viewer 만 막는다.

    생성은 '남의 것을 고치는' 문제가 아니라 새로 만드는 것이라 소유·사업부 제약이
    없다. 만든 사람이 소유자가 되므로 이후 수정은 자연히 can_edit_project 로 걸린다.
    """
    if actor is None or not getattr(actor, 'is_active', False):
        return False
    return actor.role != UserRole.VIEWER


def can_review_proposal(actor: User, project, proposal) -> tuple[bool, str]:
    """
    AI 제안의 승인/반려 권한. (허용여부, 사유) 를 돌려준다.

    판정은 **그 과제를 고칠 수 있는가** 하나다(`can_edit_project`).

    ⚠️ 2026-08-01 이전에는 **"자기가 낸 제안은 자기가 승인 못 한다"** 는 규칙이 있었다.
       그건 MCP 를 **공용 서비스 계정**으로 돌린다는 전제로 쓴 것이다 — 그 계정이 제안을
       넣고 스스로 도장을 찍어버리는 것을 막으려는.

       그런데 인증을 **개인 PAT** 으로 만들면서 전제가 깨졌다. 이제 `proposed_by` 는
       **AI 를 시킨 사람 본인**이다. 그 사람은 편집창에서 같은 필드를 **손으로 그냥 고칠 수
       있다.** 그러니 승인만 막아 봐야 아무것도 못 막고 클릭만 늘린다 —
       게다가 승인자가 자기뿐인 과제(소유자 1인)는 제안이 **영영 처리되지 않는다.**
       실측에서 그 제안은 목록에서 아예 보이지도 않았다(2026-08-01).

    🔁 **되살려야 할 때**: 사람이 시키지 않는 **자율 에이전트**(Phase 5 GLM 루프)를 붙일 때.
       그때는 `proposed_by` 가 사람이 아니므로 "제안자 ≠ 승인자" 가 다시 의미를 갖는다.
       사람이 부른 것과 자율 실행을 **구분할 표시**(서비스 계정이든 플래그든)를 먼저 두고,
       그 표시가 붙은 제안에만 걸 것. 지금처럼 user_id 만으로 가르면 안 된다.
    """
    if actor is None or not getattr(actor, 'is_active', False):
        return False, '로그인이 필요합니다.'
    if proposal is None:
        return False, '제안을 찾을 수 없습니다.'
    if proposal.status != 'pending':
        return False, f'이미 처리된 제안입니다. (현재 상태: {proposal.status})'
    if not can_edit_project(actor, project):
        return False, deny_reason(actor, project)
    return True, ''


def deny_reason(actor: User, project) -> str:
    """403 응답에 담을 사람이 읽을 사유. 권한 판단 자체는 하지 않는다."""
    if actor is None or not getattr(actor, 'is_active', False):
        return '로그인이 필요합니다.'
    if project is None:
        return '과제를 찾을 수 없습니다.'
    if getattr(project, 'is_permanently_deleted', False):
        return '영구 삭제된 과제는 수정할 수 없습니다.'
    if project.owner_user_id is None:
        return ('이 과제에 소유자가 지정되어 있지 않습니다. '
                '관리자에게 소유자 지정을 요청하세요.')
    if actor.role == UserRole.MANAGER and actor_division_id(actor) is None:
        return ('소속 부서로 사업부를 확인할 수 없습니다. '
                f'프로필의 부서명({actor.department!r})을 관리자에게 확인 요청하세요.')
    return '이 과제를 수정할 권한이 없습니다. 과제 소유자 또는 관리자에게 요청하세요.'
