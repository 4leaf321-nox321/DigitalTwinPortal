"""
JSON 키 ↔ dt2_* 컬럼 매핑 — 단일 출처

왜 별도 파일인가
    이 매핑은 **세 곳**이 함께 봐야 한다.
        이관·동기화   scripts/dt2_import.py   (운영서버에서 앱 없이 단독 실행)
        재조립        assemble.py             (V2 → V1 형태 복원)
        검증          scripts/dt2_verify.py · dt2_compare_api.py

    그런데 이관 스크립트는 **Flask 앱을 띄우지 않고** 돌아야 한다(운영 런북에서
    psycopg 만으로 실행). 그래서 `models_v2.py` 를 import 할 수 없었고
    (db.Column·BaseModel 이 딸려온다), 결국 스크립트가 사본을 들고 있었다.

    사본은 갈렸을 때 **조용히 필드가 사라진다.** 실제로 해시·SKIP_KEYS·필드맵에서
    세 번 물렸다. 그래서 매핑만 떼어 **의존성이 하나도 없는 파일**로 만들었다.
    스크립트는 `history_hash.py` 와 같은 방식으로 이 파일만 경로로 직접 읽는다.

이 파일의 유일한 규칙
    **import 를 추가하지 말 것.** 표준 라이브러리조차 필요 없다.
    무언가를 import 하는 순간 스크립트 쪽 단독 실행이 깨질 수 있다.

컬럼명이 영문인 이유
    운영서버는 AI 없이 런북으로 진단 쿼리를 돌려야 하는데, 한글 컬럼명은
    Windows 콘솔에서 psql -c 인코딩 오류를 일으킨다(2026-07-28 반복 발생).

여기에 없는 키는 extra_fields 로 흘려보내 유실을 구조적으로 막는다.
"""

# ─────────────────────────────────────────────────────────────────────────────
# 과제
# ─────────────────────────────────────────────────────────────────────────────

PROJECT_FIELD_MAP = {
    # 식별자
    'uuid': 'uuid',
    'id': 'code',                       # "VD-1" 형태. id 는 PK 와 헷갈려 code 로
    # 기본정보
    '과제명': 'title',
    '사업부': 'division',
    '프로세스': 'process',
    '과제영역': 'domain',
    '과제구분': 'category',
    '진행상태': 'status',
    '과제년도': 'year',
    '시작': 'start_month',              # ⚠️ 날짜가 아니라 월 번호(1~12)
    '종료': 'end_month',
    '진행률': 'progress',
    '과제상세설명': 'description',
    'PoC과제여부': 'is_poc',
    '중점과제여부': 'is_key',
    '사업부내공개여부': 'is_division_public',
    # 담당정보
    '과제PL': 'pl_name',
    '작성자': 'author_name',
    # 계정 연결용 knoxId. 이름과 짝이지만 **뜻이 다르다** — 이름은 표시용이고
    # 이쪽이 실제 계정이다. 과제PL_knoxId 는 편집 권한까지 준다(is_project_pl).
    '과제PL_knoxId': 'pl_knox_id',
    '작성자_knoxId': 'author_knox_id',
    '관리자': 'manager_name',
    '담당부서': 'dept_name',            # 레거시 단수
    '과제참여인력': 'member_names',     # 레거시 단수
    '담당자': 'owners_json',
    '담당부서목록': 'depts_json',
    '과제참여인력목록': 'members_json',  # {knoxId, 부서, 이름, 순번}
    # 목록류
    '액션아이템목록': 'action_items_json',
    '이슈목록': 'issues_json',
    '월간진척현황': 'monthly_progress_json',
    # 상세과제정보
    '상세정보_과제개요': 'detail_overview_json',
    '상세정보_추진배경': 'detail_background_json',
    '상세정보_과제목표': 'detail_goal_json',
    '상세정보_상세내용': 'detail_content_json',
    '상세정보_성과': 'detail_result_json',
    '상세정보_산출물': 'detail_output_json',
    '상세정보_향후계획': 'detail_plan_json',
    '상세정보_입력완료': 'detail_completed',
    '이미지_그룹1_카테고리': 'image_group1_category',
    '이미지_그룹2_카테고리': 'image_group2_category',
    # 시스템 / 삭제
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    '_canceledAt': 'canceled_at',
    '_deleted': 'is_deleted',
    '_deletedAt': 'deleted_at',
    '_deletedBy': 'deleted_by_raw',
    '_deletedByName': 'deleted_by_name',
    '_permanentlyDeleted': 'is_permanently_deleted',
    '_permanentlyDeletedAt': 'permanently_deleted_at',
    '_permanentlyDeletedBy': 'permanently_deleted_by_raw',
    '_permanentlyDeletedByName': 'permanently_deleted_by_name',
}

# 보고서 이미지 슬롯. Phase 1-2 이후 각 슬롯에 imageId 참조 배열이 들어 있고,
# 이관에서 image_refs_json 으로 모은다.
IMAGE_SLOTS = ['이미지_좌측', '이미지_우측', '이미지_개요그림',
               '이미지_상세내용그림', '이미지_향후계획그림']

# 별도 테이블로 풀어내므로 위 매핑에 넣지 않는 키
#   성과목록      → dt2_project_performance
#   선행과제목록  → dt2_project_dependencies
#   이미지_*      → image_refs_json (dt_report_images 참조)
# IMAGE_SLOTS 에서 만들어 둘이 어긋날 수 없게 한다.
PROJECT_RELATION_KEYS = {'성과목록', '선행과제목록'} | set(IMAGE_SLOTS)


# ─────────────────────────────────────────────────────────────────────────────
# 성과
# ─────────────────────────────────────────────────────────────────────────────

PERFORMANCE_FIELD_MAP = {
    'uuid': 'uuid',
    'id': 'code',
    '성과항목': 'title',
    'displayName': 'display_name',
    '대분류': 'category',
    '소분류': 'subcategory',
    '단위': 'unit',
    '성과년도': 'year',
    '현재수준': 'current_level',
    '목표수준': 'target_level',
    '실적수준': 'actual_level',
    '월별실적': 'monthly_values_json',
    '월별실적여부': 'is_monthly',
    'isAchievementType': 'is_achievement_type',
    '조치사항': 'action_note',
    '조치사항목록': 'action_notes_json',
    '보고현황목록': 'report_status_json',
    '성과평가': 'evaluation',
    '계산로직': 'calc_logic_json',
    '로직입력여부': 'has_calc_logic',
    '디지털트윈기여도': 'dt_contribution',
    '디지털트윈기여도여부': 'has_dt_contribution',
    '설명': 'description',
    '성과항목UUID': 'legacy_uuid',
    'isActive': 'is_active',
    'isFromSample': 'is_from_sample',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    '_deleted': 'is_deleted',
    '_deletedAt': 'deleted_at',
    '_deletedBy': 'deleted_by_raw',
    '_deletedByName': 'deleted_by_name',
}

PERFORMANCE_RELATION_KEYS = {
    'linkedProjects',   # 파생 캐시. 정본은 과제의 성과목록 → 이관하지 않음
}

# UI 런타임 상태가 저장된 것. 컬럼은 만들지 않지만 **버리지도 않는다** —
# extra_fields 로 흘려보내 원본 복원이 가능하게 둔다.
# (2026-07-29: 처음엔 제외했더니 V2 읽기 응답에서 isEditing 16건이 사라졌다)
PERFORMANCE_SKIP_KEYS = set()

# 월별 실적의 두 번째 표현. 정본은 월별실적(배열)이고 운영 값이 0건이라 컬럼을 만들지 않는다.
# (남아 있어도 extra_fields 가 받아낸다)
PERFORMANCE_LEGACY_MONTHLY_KEYS = {f'실적_{m}월' for m in range(1, 13)}


# ─────────────────────────────────────────────────────────────────────────────
# 화면 키 → 컬럼명 변환
#
# 화면은 한글 키(`진행률`)로 데이터를 들고 있고 dt2 는 영문 컬럼(`progress`)이다.
# 번역은 **서버가** 맡는다. 맵을 프론트에 복제하면 갈릴 자리가 하나 더 생기는데,
# 이 프로젝트는 사본 문제로 이미 세 번 물렸다.
# ─────────────────────────────────────────────────────────────────────────────

def translate_keys(data, field_map):
    """
    보낸 키를 dt2 컬럼명으로 바꾼다.

    규칙 셋
      · 맵에 있는 키          → 컬럼명으로 바꾼다
      · 맵에 없는 키          → **그대로 둔다.** 이미 컬럼명인 영어 키가 여기 해당한다.
                                AI·MCP 는 영어로 부르므로 두 어휘를 다 받는다.
      · 아무데도 없는 키      → 역시 그대로 둔다. 뒤의 분류표가 400 으로 거부한다.
                                여기서 조용히 버리면 "저장했는데 안 들어간" 상태가 된다.

    서로 다른 키가 같은 컬럼을 가리키면(예: `과제명` 과 `title` 을 함께 보냄)
    나중 것이 앞을 덮어써 **조용한 손실**이 된다. 그래서 겹치면 그대로 알려준다.
    값이 같은지 따지지 않는다 — 애초에 그렇게 보낼 이유가 없다.

    반환
        cols       {컬럼명: 값}
        conflicts  [(컬럼명, [보낸 키들]), ...]  비어 있지 않으면 호출부가 거부한다
        origin     {컬럼명: 처음 보낸 키}  오류 메시지를 보낸 이름으로 돌려주는 데 쓴다
    """
    cols = {}
    origin = {}
    seen = {}
    for key, value in data.items():
        col = field_map.get(key, key)
        seen.setdefault(col, []).append(key)
        cols[col] = value
        origin.setdefault(col, key)
    conflicts = [(col, keys) for col, keys in seen.items() if len(keys) > 1]
    return cols, conflicts, origin


# ─────────────────────────────────────────────────────────────────────────────
# 사업부 이름 ↔ DX KPI 코드
#
# 두 모듈이 같은 사업부를 다르게 적는다.
#     digital_twin_dashboard   `divisions.name` · `dt2_projects.division`  'VD' '의료기기'
#     dx_kpi_management        `kpi_definitions.divisions`(JSON)           'vd' 'medical'
#
# 이 표가 없으면 **의료기기 과제가 medical 지표에 '해당 없음' 으로 보이는**
# 조용한 어긋남이 난다. 화면이 각자 표를 들면 반드시 갈리므로(성과 필드맵에서
# 이미 한 번 겪었다) 여기 한 곳에 두고 API 응답에 실어 프론트로 내려보낸다.
#
# 표에 없는 이름은 소문자로 떨어뜨린다 — 지어내지 않고 그대로 비교한다.
# ─────────────────────────────────────────────────────────────────────────────

DIVISION_KPI_CODE = {
    'MX': 'mx',
    'VD': 'vd',
    'DA': 'da',
    'NW': 'nw',
    '의료기기': 'medical',
}


def division_kpi_code(name):
    """사업부 이름 → dx_kpi_management 가 쓰는 코드. 못 찾으면 소문자 이름."""
    if not name:
        return ''
    text = str(name).strip()
    if text in DIVISION_KPI_CODE:
        return DIVISION_KPI_CODE[text]
    return text.lower()
