"""
Digital Twin Dashboard — V2 정규화 모델 (Phase 2)

목적
    지금은 모든 과제·성과가 dashboard_data 한 행에 JSON 배열로 들어 있다(싱글톤).
    그래서 ①과제 하나만 고쳐도 전량이 다시 쓰이고 ②권한을 걸 "대상(행)"이 없으며
    ③무결성을 코드로 손수 유지해야 한다.

    V2는 과제를 **행**으로 저장한다. 여기에 owner_user_id(권한의 근거)와
    row_version(과제별 낙관적 락)이 붙으면서 비로소 "과제별 수정 권한"이 가능해진다.
    (원래 목표: AI(MCP)가 과제를 수정하되 과제별로 권한을 통제하는 것)

안전 원칙 — 이 파일은 **기존 테이블을 일절 건드리지 않는다**
    전부 신규 테이블(dt2_*)이며, 마이그레이션은 create_table 뿐이고
    downgrade 는 drop_table 뿐이다. 컷오버 전까지 V1(dashboard_data)이 계속 정본이고
    V2 는 복사본이다. 잘못되면 DROP 후 다시 복사하면 된다.

컬럼명은 영문이다
    운영서버는 AI 없이 런북으로 진단 쿼리를 돌려야 하는데, 한글 컬럼명은
    Windows 콘솔에서 psql -c 인코딩 오류를 일으킨다(2026-07-28 반복 발생).
    JSON 키 ↔ 컬럼 매핑은 field_maps.py 에 모아 둔다 (이관 스크립트와 공유하는 단일 출처).
"""

import uuid as uuidlib

from sqlalchemy.dialects.postgresql import JSONB
from app.extensions import db
from app.shared.models import BaseModel


# ─────────────────────────────────────────────────────────────────────────────
# JSON 키 ↔ 컬럼 매핑은 field_maps.py 에 있다 (단일 출처)
#
# 여기에 두면 이관 스크립트(scripts/dt2_import.py)가 쓸 수 없다 —
# 그 스크립트는 운영서버에서 **Flask 앱 없이** 돌아야 하는데, 이 파일을 import 하면
# db.Column·BaseModel 이 딸려온다. 그래서 예전엔 스크립트가 사본을 들고 있었고,
# 사본이 갈리면 조용히 필드가 사라졌다.
#
# 지금은 의존성이 없는 field_maps.py 만 양쪽이 읽는다. 매핑을 고칠 일이 있으면
# **field_maps.py 한 곳만** 고치면 된다.
# ─────────────────────────────────────────────────────────────────────────────


# ─────────────────────────────────────────────────────────────────────────────
# 과제
# ─────────────────────────────────────────────────────────────────────────────

class Dt2Project(BaseModel):
    """과제 1건 = 1행. V2의 핵심."""
    __tablename__ = 'dt2_projects'

    # BaseModel 의 id(Integer PK)는 쓰지 않고 uuid 를 논리 키로 삼는다.
    # (운영 스캔: 과제 uuid 전부 존재·고유)
    uuid = db.Column(db.String(64), unique=True, nullable=False, index=True)
    code = db.Column(db.String(32), index=True)          # "VD-1"

    # 기본정보
    title = db.Column(db.String(500), nullable=False, default='', server_default='')
    division = db.Column(db.String(50), index=True)      # 원문 보존
    division_id = db.Column(db.Integer, db.ForeignKey('divisions.id'), index=True)  # ★ 권한용
    process = db.Column(db.String(100))
    domain = db.Column(db.String(100))
    category = db.Column(db.String(100))
    status = db.Column(db.String(50), index=True)
    year = db.Column(db.Integer, index=True)
    start_month = db.Column(db.Integer)                  # ⚠️ 월 번호(1~12). 날짜 아님
    end_month = db.Column(db.Integer)
    progress = db.Column(db.Integer)
    description = db.Column(db.Text)
    is_poc = db.Column(db.Boolean, default=False)
    is_key = db.Column(db.Boolean, default=False)
    is_division_public = db.Column(db.Boolean, default=False)

    # 담당정보 (이름은 표시용 원문 — 권한 판단은 owner_user_id 와 아래 knoxId 로 한다)
    pl_name = db.Column(db.String(100))
    author_name = db.Column(db.String(100))
    # ★ 계정 연결용 knoxId (사내 이메일 @앞부분 = users.email 로컬파트).
    #
    #   왜 users.id FK 가 아닌가
    #       SSO 가 없어 **본인이 직접 가입**해야 하는데, knoxId 는 가입 전에도 값을 알 수
    #       있다. 미리 채워 두면 그 사람이 가입하는 순간 연결된다. FK 는 없는 행을
    #       가리킬 수 없어 이걸 못 한다 — members_json 이 knoxId 를 쓰는 것과 같은 이유.
    #
    #   ⚠️ pl_knox_id 는 **편집 권한을 부여한다**(can_edit_project → is_project_pl).
    #      pl_name 을 바꾸는 것과 질이 다르다. AI 금지 필드다.
    #      author_knox_id 는 권한을 주지 않는다 — 보고서를 쓴 사람의 기록일 뿐이다.
    pl_knox_id = db.Column(db.String(100))
    author_knox_id = db.Column(db.String(100))
    manager_name = db.Column(db.String(100))
    dept_name = db.Column(db.String(200))
    member_names = db.Column(db.String(500))
    owners_json = db.Column(JSONB, default=list)
    depts_json = db.Column(JSONB, default=list)
    members_json = db.Column(JSONB, default=list)

    # 목록류 — 1차 정규화에서는 행 내 JSON 으로 유지 (자식 테이블 분리는 후속)
    action_items_json = db.Column(JSONB, default=list)
    issues_json = db.Column(JSONB, default=list)
    monthly_progress_json = db.Column(JSONB, default=dict)

    # 상세과제정보
    detail_overview_json = db.Column(JSONB)
    detail_background_json = db.Column(JSONB)
    detail_goal_json = db.Column(JSONB)
    detail_content_json = db.Column(JSONB)
    detail_result_json = db.Column(JSONB)
    detail_output_json = db.Column(JSONB)
    detail_plan_json = db.Column(JSONB)
    detail_completed = db.Column(db.Boolean, default=False)
    image_group1_category = db.Column(db.String(50))
    image_group2_category = db.Column(db.String(50))
    # {"이미지_좌측": [{"imageId": 12, "caption": "...", "fileName": "..."}], ...}
    image_refs_json = db.Column(JSONB, default=dict)

    # 보고 확인 상태 — module_settings.reportConfirmations 가 과제 uuid 키 맵이라 흡수
    report_confirmation = db.Column(JSONB)

    # ★ 권한 / 동시성
    owner_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), index=True)
    row_version = db.Column(db.Integer, nullable=False, default=1, server_default='1')
    updated_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    # 삭제 / 취소 상태
    is_deleted = db.Column(db.Boolean, nullable=False, default=False, server_default='false', index=True)
    deleted_at = db.Column(db.DateTime)
    deleted_by_raw = db.Column(db.String(50))            # 원본이 문자열 id 라 그대로 보존
    deleted_by_name = db.Column(db.String(100))
    is_permanently_deleted = db.Column(db.Boolean, nullable=False, default=False, server_default='false', index=True)
    permanently_deleted_at = db.Column(db.DateTime)
    permanently_deleted_by_raw = db.Column(db.String(50))
    permanently_deleted_by_name = db.Column(db.String(100))
    canceled_at = db.Column(db.DateTime)

    # ★★★ 매핑되지 않은 키를 통째로 보관 — 인벤토리가 틀려도 유실이 없게
    extra_fields = db.Column(JSONB, nullable=False, default=dict, server_default='{}')

    owner = db.relationship('User', foreign_keys=[owner_user_id])

    __table_args__ = (
        db.Index('ix_dt2_projects_active', 'is_deleted', 'is_permanently_deleted', 'status'),
        # 과제PL 권한 판정(member_sql_condition)이 목록 조회마다 이 식으로 비교한다.
        # ⚠️ **모델에도 선언해야 한다.** 마이그레이션에만 두면 autogenerate 가
        #    "모델에 없는 인덱스" 로 보고 다음 `flask db migrate` 에 drop_index 를
        #    끼워 넣는다 — 아무도 눈치 못 채는 사이 인덱스가 사라진다.
        db.Index('ix_dt2_projects_pl_knox_id', db.text('lower(btrim(pl_knox_id))')),
    )

    def __repr__(self):
        return f'<Dt2Project {self.code} {self.title[:20]}>'


# ─────────────────────────────────────────────────────────────────────────────
# 성과
# ─────────────────────────────────────────────────────────────────────────────

class Dt2Performance(BaseModel):
    """성과 1건 = 1행."""
    __tablename__ = 'dt2_performances'

    uuid = db.Column(db.String(64), unique=True, nullable=False, index=True)
    code = db.Column(db.String(64), index=True)

    title = db.Column(db.String(500))
    display_name = db.Column(db.String(500))
    category = db.Column(db.String(200), index=True)
    subcategory = db.Column(db.String(200))
    unit = db.Column(db.String(50))
    year = db.Column(db.Integer, index=True)

    current_level = db.Column(db.Numeric)
    target_level = db.Column(db.Numeric)
    actual_level = db.Column(db.String(100))            # 문자열 혼재라 원형 보존
    monthly_values_json = db.Column(JSONB, default=list)
    is_monthly = db.Column(db.Boolean, default=False)
    is_achievement_type = db.Column(db.Boolean, default=False)

    action_note = db.Column(db.Text)
    action_notes_json = db.Column(JSONB, default=list)
    report_status_json = db.Column(JSONB, default=list)
    evaluation = db.Column(db.String(200))

    calc_logic_json = db.Column(JSONB)
    has_calc_logic = db.Column(db.Boolean, default=False)
    dt_contribution = db.Column(db.String(50))
    has_dt_contribution = db.Column(db.Boolean, default=False)
    description = db.Column(db.Text)
    legacy_uuid = db.Column(db.String(64), index=True)   # 성과항목UUID

    is_active = db.Column(db.Boolean, default=True)
    is_from_sample = db.Column(db.Boolean, default=False)

    # 성과에는 '소유자' 개념이 없다 — 전사 공용이고 여러 과제가 참조한다.
    # 편집 권한은 '연결된 과제를 고칠 수 있으면 성과도' 규칙을 쓴다(2026-07-29 결정).
    # 다만 **막 만들어 아직 아무 과제에도 안 붙은 성과**는 그 규칙으로 아무도 못 고친다.
    # 만든 사람만 그 구멍을 메우면 되므로 생성자만 기록한다.
    created_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), index=True)

    is_deleted = db.Column(db.Boolean, nullable=False, default=False, server_default='false', index=True)
    deleted_at = db.Column(db.DateTime)
    deleted_by_raw = db.Column(db.String(50))
    deleted_by_name = db.Column(db.String(100))

    # 영구 삭제 (2026-08-06). 과제와 **같은 방식** — 행을 지우지 않고 표시만 한다.
    # 하드 삭제를 안 하는 이유는 과제와 같다: 이력(dt2_performance_history)과
    # 감사 흔적이 남아야 하고, 지운 뒤에 "그 성과가 뭐였나" 를 답할 수 있어야 한다.
    # (휴지통에서 빼는 것이 목적이지 기록을 없애는 것이 아니다)
    is_permanently_deleted = db.Column(db.Boolean, nullable=False, default=False,
                                       server_default='false', index=True)
    permanently_deleted_at = db.Column(db.DateTime)
    permanently_deleted_by_raw = db.Column(db.String(50))
    permanently_deleted_by_name = db.Column(db.String(100))

    row_version = db.Column(db.Integer, nullable=False, default=1, server_default='1')
    extra_fields = db.Column(JSONB, nullable=False, default=dict, server_default='{}')

    def __repr__(self):
        return f'<Dt2Performance {self.code} {(self.title or "")[:20]}>'


# ─────────────────────────────────────────────────────────────────────────────
# 과제 ↔ 성과 (관계 속성 포함)
# ─────────────────────────────────────────────────────────────────────────────

class Dt2ProjectPerformance(BaseModel):
    """
    과제-성과 연결. 원본 `성과목록` 원소를 풀어낸 것.

    원소에는 성과 본체가 복제되어 있지만(단위·대분류·목표수준 등),
    진짜 관계 속성은 과제기여도·실적수준뿐이다. 나머지는 성과 테이블에서 조인한다.
    복제본과 본체가 다른 경우는 이관 시 리포트한다.

    성과→과제 역방향(`linkedProjects`)은 화면에서 계산된 파생 캐시가 저장된 것이라
    정본으로 쓰지 않는다. (운영 실측: 정방향 전용 53건 / 역방향 전용 36건 불일치)
    """
    __tablename__ = 'dt2_project_performance'

    project_uuid = db.Column(
        db.String(64), db.ForeignKey('dt2_projects.uuid', ondelete='CASCADE'),
        nullable=False, index=True
    )
    performance_uuid = db.Column(
        db.String(64), db.ForeignKey('dt2_performances.uuid', ondelete='CASCADE'),
        nullable=False, index=True
    )
    contribution = db.Column(db.String(50))     # 과제기여도 (문자열 혼재)
    actual_level = db.Column(db.String(100))    # 실적수준

    # 원본 `성과목록` 배열에서의 위치. 순서를 잃으면 화면이 다른 순서로 그린다.
    # (2026-07-29 응답 대조에서 발견 — 조회 순서대로 담아 원본 순서가 뒤바뀌었다)
    position = db.Column(db.Integer)

    # 원본 원소를 **그대로** 담는다. 위 두 컬럼은 질의용 사본일 뿐이다.
    # 원칙: extra_fields 만으로 원본 원소를 복원할 수 있어야 한다.
    extra_fields = db.Column(JSONB, nullable=False, default=dict, server_default='{}')

    __table_args__ = (
        db.UniqueConstraint('project_uuid', 'performance_uuid', name='uq_dt2_proj_perf'),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 과제 ↔ DX KPI 연결
# ─────────────────────────────────────────────────────────────────────────────

class Dt2ProjectKpi(BaseModel):
    """
    과제가 어느 **DX KPI 지표**(가상 검증률·One Time Pass율 …)와 관련되는가.

    왜 필요한가
        DX KPI 는 `dx_kpi_management` 모듈(`kpi_definitions`/`kpi_records`)에 있고,
        거기엔 **과제를 가리키는 컬럼이 하나도 없다.** 두 모듈이 DB 수준에서 끊겨 있어
        "이 KPI 를 밀고 있는 과제가 무엇인가" 를 물을 방법이 없었다.
        (2026-08-01 챔피언 지시 — KPI 향상에 각 과제가 어떻게 기여하는지 안 보인다)

    ★ 가중치가 없다 — 기여도(`Dt2ProjectPerformance.contribution`)와 다르다
        경영성과는 **금액·시간**이라 여러 과제가 물리면 쪼개야 한다(그래서 기여도가 있다).
        DX KPI 는 비율·건수 지표라 쪼갤 대상이 없다. **연관이 있는가 없는가**뿐이다.
        여기에 가중치를 들이면 현업이 합계 100% 를 맞추느라 없는 숫자를 지어낸다.

    ★ 주/부 구분을 두지 않는다 (2026-08-01 결정)
        시뮬레이션 기술개발 같은 과제는 가상검증·OTP·시험완료 리드타임에 **비슷하게**
        영향을 준다. 주 KPI 하나를 고르게 하면 없는 우선순위를 만들어내 데이터가 왜곡된다.
        연결 개수는 제약할 대상이 아니라 **산출물**이다 — 많이 걸린 과제가 곧 기반 과제다.

        └ 2026-08-06 **부분적으로 다시 열었다** (`relation_type` 참조).
          위 결정을 뒤집는 것이 아니다 — 그때 막은 건 "주 KPI **하나**만 고르게" 였고,
          지금 넣은 것은 **3단계·복수 허용**이라 우선순위를 강제하지 않는다.
          한 과제가 두 KPI에 모두 '주기여' 일 수 있다.
          다시 연 이유: KPI 하나에 과제가 10몇 개씩 붙으면서 **연결이 전부 동등해
          아무것도 못 읽는** 상태가 됐다. 등급은 그 소음을 거르는 필터로 쓴다.
          ⚠️ 여전히 **가중치가 아니다** — 아래 relation_type 주석 참조.

    ⚠️ `kpi_definition_id` 로 건다 (label 이 아니라)
        `kpi_records.kpi` 는 String(200) 이라 지표를 **이름으로** 식별한다.
        같은 방식으로 연결을 걸면 지표 이름을 바꾸는 순간 조용히 끊긴다.

    ⚠️ FK 는 RESTRICT 다
        `dx_kpi_management.delete_kpi_definition` 에 아무 가드가 없었다(2026-08-01 확인).
        CASCADE 로 두면 KPI 하나를 지울 때 과제 수십 건의 연결이 소리 없이 날아간다.
        DB 가 먼저 막고, 그 위에 사람이 읽을 안내를 라우트에서 얹는다.

    표시 순서를 저장하지 않는 이유
        후보가 `kpi_definitions.sort_order` 로 이미 정렬돼 있다. 순서를 여기 또 두면
        두 순서가 갈린다. (성과 연결은 원본 배열 순서를 복원해야 해서 position 이 있다 —
        여기엔 복원할 원본이 없다.)
    """
    __tablename__ = 'dt2_project_kpi'

    project_uuid = db.Column(
        db.String(64), db.ForeignKey('dt2_projects.uuid', ondelete='CASCADE'),
        nullable=False, index=True
    )
    kpi_definition_id = db.Column(
        db.Integer, db.ForeignKey('kpi_definitions.id', ondelete='RESTRICT'),
        nullable=False, index=True
    )

    # ★ **누구의** 지표를 미는가. (2026-08-01 추가)
    #
    # DX KPI 는 지표 하나가 아니라 **(지표 × 사업부)** 단위로 측정된다 —
    # `kpi_records`/`kpi_targets` 가 division 별로 쌓이고, 'MX 의 가상검증률' 과
    # 'VD 의 가상검증률' 은 다른 숫자다. 그래서 연결도 대상을 지목해야 한다.
    #
    # 왜 과제의 사업부로 갈음할 수 없나
    #     GTR·SR·CS 는 **기능조직**이라 자기 지표가 없다(실측: kpi_records 0건).
    #     이들이 MX 의 가상검증률에 기여하는 경우가 실제로 있는데, 과제 소속으로
    #     집계하면 그 기여가 GTR 칸에 찍히고 **MX 칸은 과소 계상된다.**
    #
    # 한 과제가 여러 사업부를 지원하면 대상마다 한 행이다 (그래서 유니크에 들어간다).
    target_division = db.Column(db.String(50), nullable=False,
                                server_default='', index=True)

    # 어떻게 기여하는지 한 줄 (선택). 매트릭스 셀 툴팁이 된다.
    # 강제하지 않는다 — 다만 한 줄 쓸 자리가 있는 것만으로 무작정 전부 체크하는 걸 줄인다.
    note = db.Column(db.String(300))

    # 기여 등급 (2026-08-06 부터 사용). 예약해 둔 자리를 그대로 켰다 — 마이그레이션 없음.
    #
    #   primary   이 과제가 없으면 그 KPI 목표 달성이 어렵다
    #   support   기여하지만 다른 과제로도 대체 가능하다
    #   indirect  기반·환경을 만든다 (플랫폼·표준화 등)
    #   NULL      미지정
    #
    # ⚠️ **순서척도다. 더하면 안 된다.**
    #    주=3·보조=2·간접=1 처럼 점수를 매겨 합하면 '간접 3건'과 '주 1건'이 같아진다.
    #    주와 보조의 간격이 보조와 간접의 간격과 같다는 근거가 없다.
    #    세는 것은 **등급별로 따로** 센다(`주 2 · 보조 5 · 간접 8`).
    #    그래프에서 굵기로 쓸 때도 합이 아니라 범주여야 한다.
    #
    # ⚠️ **기존 행을 일괄로 채우지 않는다.** 아무도 판단하지 않은 값이 데이터가 된다.
    #    미지정은 미지정으로 두고 화면이 그 건수를 드러낸다.
    relation_type = db.Column(db.String(20))

    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    __table_args__ = (
        # 대상까지 포함해야 "GTR 과제가 MX 와 VD 를 동시에 지원" 이 표현된다.
        db.UniqueConstraint('project_uuid', 'kpi_definition_id', 'target_division',
                            name='uq_dt2_project_kpi'),
    )

    def __repr__(self):
        return (f'<Dt2ProjectKpi {self.project_uuid[:8]} kpi={self.kpi_definition_id} '
                f'→{self.target_division}>')


# ─────────────────────────────────────────────────────────────────────────────
# 선행과제 (과제 간 참조)
# ─────────────────────────────────────────────────────────────────────────────

class Dt2ProjectDependency(BaseModel):
    """
    `선행과제목록` 을 풀어낸 것. **과제 → 과제 방향성 엣지**다.

    방향  `project_uuid` 가 `depends_on_uuid` **뒤에 온다**.
          화면 어휘로는 "이 과제(project_uuid)의 이전 과제(depends_on_uuid)".
          역방향(후속 과제)은 `depends_on_uuid` 로 조회하면 나온다 — 행을 따로 두지 않는다.

    ⚠️ **비순환이어야 한다.** DB 제약으로는 못 막으므로 쓰기 경로가 막는다
       (`routes_v2._dep_cycle_error`). 사이클이 들어가면 "이 과제 이전에 무엇이
       있었나" 를 따라가는 순회가 끝나지 않는다.

    ⚠️ `depends_on_uuid` 에는 **FK 를 걸지 않았다.** 대상 과제가 소프트 삭제되거나
       이관 중 순서가 뒤바뀌어도 연결을 잃지 않기 위해서다. 존재 검증은 쓰기 경로가 한다.

    `extra_fields` 는 V1 `선행과제목록` 원소를 되돌리기 위한 자리다(`assemble.py`).
    과제명·사업부 같은 **사본**이 들어 있지만 화면이 읽는 정본이 아니다 —
    읽을 때 살아 있는 과제 행에서 다시 채운다(사본은 이름이 바뀌면 낡는다).
    """
    __tablename__ = 'dt2_project_dependencies'

    project_uuid = db.Column(
        db.String(64), db.ForeignKey('dt2_projects.uuid', ondelete='CASCADE'),
        nullable=False, index=True
    )
    depends_on_uuid = db.Column(db.String(64), nullable=False, index=True)
    extra_fields = db.Column(JSONB, nullable=False, default=dict, server_default='{}')

    __table_args__ = (
        db.UniqueConstraint('project_uuid', 'depends_on_uuid', name='uq_dt2_proj_dep'),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 첨부파일 (기존 project_attachments 의 project_id 를 FK 로 승격)
# ─────────────────────────────────────────────────────────────────────────────

class Dt2ProjectAttachment(BaseModel):
    """
    첨부파일. 파일 실체는 uploads/ 에 그대로 두고 메타만 옮긴다.

    project_uuid 는 NULL 을 허용한다 — 과제가 사라졌는데 첨부만 남은 고아가
    운영에 6건 있고, 정보를 잃지 않기 위해 '미연결' 상태로 함께 옮기기로 했다.
    """
    __tablename__ = 'dt2_project_attachments'

    legacy_id = db.Column(db.Integer, unique=True, index=True)   # 원본 project_attachments.id
    project_uuid = db.Column(
        db.String(64), db.ForeignKey('dt2_projects.uuid', ondelete='SET NULL'),
        nullable=True, index=True
    )
    original_filename = db.Column(db.String(255), nullable=False)
    stored_filename = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.Integer, default=0)
    mime_type = db.Column(db.String(100))
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    uploaded_by_name = db.Column(db.String(100))


# ─────────────────────────────────────────────────────────────────────────────
# 권한 (Phase 3 에서 사용)
# ─────────────────────────────────────────────────────────────────────────────

class Dt2ProjectEditor(BaseModel):
    """
    과제별 명시적 편집자.

    채택한 권한 모델은 '소유자 + 같은 부서 manager + admin' 이라 당장은 쓰지 않는다.
    예외적으로 특정인에게 편집을 열어야 할 때를 위해 자리를 만들어 둔다.
    """
    __tablename__ = 'dt2_project_editors'

    project_uuid = db.Column(
        db.String(64), db.ForeignKey('dt2_projects.uuid', ondelete='CASCADE'),
        nullable=False, index=True
    )
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    granted_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    __table_args__ = (
        db.UniqueConstraint('project_uuid', 'user_id', name='uq_dt2_proj_editor'),
    )


class Dt2PerformanceHistory(BaseModel):
    """
    성과 수준값의 시계열. **추가만 하고 고치거나 지우지 않는다(append-only).**

    왜 필요한가
        dt2_performances 는 "지금 값"만 들고 있다. 덮어쓰면 이전 값은 사라진다.
        화면의 '1주 전 대비' 는 액션아이템 완료일을 역산해 만든 것이라
        완료일이 없는 성과 수준값에는 쓸 수 없다. 그래서 별도로 쌓는다.

    언제 한 행이 생기나
        추적 대상 값(현재/목표/실적/월별/단위)이 **직전 기록과 다를 때만** 쓴다.
        값이 그대로면 아무것도 남기지 않는다. 매 이관마다 596행씩 쌓이면
        1년이면 20만 행인데, 그중 의미 있는 건 극소수다.

    단위를 왜 같이 저장하나
        단위가 '건'에서 '%' 로 바뀌면 과거 값과의 비교가 무의미해진다.
        값만 저장하면 나중에 이 사실을 알아낼 방법이 없다.

    해상도의 한계 (정직하게)
        Phase 2 에서 dt2 를 채우는 건 배치 이관 스크립트다.
        따라서 이력의 시간 해상도 = **이관을 돌리는 주기**다. 주 1회 돌리면 주 단위다.
        Phase 3 에서 과제별 쓰기 API 가 생기면 같은 함수를 그 경로에서 불러
        해상도가 '실제 변경 시점' 으로 올라간다. change_kind 로 구분한다.
    """
    __tablename__ = 'dt2_performance_history'

    # FK 를 걸지 않는다. 성과가 물리 삭제돼도 이력은 남아야 하기 때문이다.
    # (CASCADE 면 같이 지워지고, RESTRICT 면 삭제가 막힌다. 둘 다 원하는 게 아니다.)
    performance_uuid = db.Column(db.String(64), nullable=False, index=True)

    # 이 값을 '확인한' 시각. 실제 변경 시각이 아니다 (배치 주기만큼 늦을 수 있다).
    observed_at = db.Column(db.DateTime, nullable=False, index=True)
    # 원본 레코드의 updatedAt. 성과의 아무 필드나 바뀌어도 갱신되므로
    # '수준값이 바뀐 시각' 의 상한선일 뿐이다. 참고용.
    source_updated_at = db.Column(db.DateTime)

    year = db.Column(db.Integer, index=True)
    unit = db.Column(db.String(50))

    current_level = db.Column(db.Numeric)
    target_level = db.Column(db.Numeric)
    actual_level = db.Column(db.String(100))       # 본체와 같이 문자열 혼재 → 원형 보존
    monthly_values_json = db.Column(JSONB)

    # 추적 대상 값들의 정규화 해시. 직전 행과 같으면 새 행을 만들지 않는다.
    value_hash = db.Column(db.String(64), nullable=False)
    changed_fields = db.Column(JSONB, nullable=False, default=list, server_default='[]')

    # seed  : 최초 1회. 이관 이전의 값이라 observed_at 이 근사치다.
    # import: 배치 이관이 변경을 감지해 남긴 것.
    # api   : Phase 3 쓰기 API 가 실제 변경 시점에 남긴 것.
    change_kind = db.Column(db.String(20), nullable=False, default='import',
                            server_default='import', index=True)
    source = db.Column(db.String(100))             # 스크립트명 / 사용자 식별자

    __table_args__ = (
        # 시계열 조회(한 성과의 전체 추이)와 최신값 조회를 한 인덱스로 커버
        db.Index('ix_dt2_perf_hist_uuid_observed', 'performance_uuid', 'observed_at'),
    )

    def __repr__(self):
        return f'<Dt2PerformanceHistory {self.performance_uuid[:8]} @{self.observed_at}>'


class Dt2ProjectHistory(BaseModel):
    """
    과제 진척 상태의 시계열. append-only. [[Dt2PerformanceHistory]] 와 같은 방식이다.

    성과와 달리 '진척률' 한 칸으로 정리되지 않아서 묶음으로 추적한다.
        status          진행상태. 개발 데이터 기준 100% 채워져 있는 유일한 상태 지표
        progress        저장된 진행률. 대부분 비어 있지만 있으면 같이 본다
        action_*        액션아이템 분모/분자 — 화면 진척률의 실제 재료
        issue_*         이슈 총계/미해결
        start/end_month 일정(월 번호). 종료월이 밀리는 것을 잡는다

    왜 액션아이템 분모·분자를 박아두나
        화면 진척률은 액션아이템 완료 비율로 계산된다. 그런데 이 값은 **소급 변경된다** —
        오늘 액션아이템을 3개 추가하면 '지난달 진척률' 을 역산한 값이 어제와 달라진다.
        분모가 바뀌기 때문이다. 역산은 '지금 기준으로 본 과거' 이지 '그때의 실제 값' 이 아니다.
        그래서 그 시점의 분자·분모를 그대로 남긴다.

        덧붙여, 완료 표시가 있는데 완료일이 없는 액션아이템이 개발 데이터에 11% 있다.
        완료일 역산 방식은 이만큼을 구조적으로 놓친다.
    """
    __tablename__ = 'dt2_project_history'

    # 성과 이력과 같은 이유로 FK 를 걸지 않는다 (과제가 지워져도 이력은 남아야 한다)
    project_uuid = db.Column(db.String(64), nullable=False, index=True)

    observed_at = db.Column(db.DateTime, nullable=False, index=True)
    source_updated_at = db.Column(db.DateTime)
    year = db.Column(db.Integer, index=True)

    status = db.Column(db.String(50), index=True)
    progress = db.Column(db.Integer)
    action_total = db.Column(db.Integer)
    action_done = db.Column(db.Integer)
    issue_total = db.Column(db.Integer)
    issue_open = db.Column(db.Integer)
    start_month = db.Column(db.Integer)      # ⚠️ 날짜가 아니라 월 번호(1~12)
    end_month = db.Column(db.Integer)

    value_hash = db.Column(db.String(64), nullable=False)
    changed_fields = db.Column(JSONB, nullable=False, default=list, server_default='[]')
    change_kind = db.Column(db.String(20), nullable=False, default='import',
                            server_default='import', index=True)
    source = db.Column(db.String(100))

    __table_args__ = (
        db.Index('ix_dt2_proj_hist_uuid_observed', 'project_uuid', 'observed_at'),
    )

    def __repr__(self):
        return f'<Dt2ProjectHistory {self.project_uuid[:8]} {self.status} @{self.observed_at}>'


class Dt2ProjectChange(BaseModel):
    """
    과제 필드 변경 로그. **바뀐 필드마다 1행.** append-only.

    두 가지 일을 한다.

    1) **자동 병합 판정** (실행계획 7-4)
       낙관적 락에서 버전이 어긋났을 때, 무조건 409 를 내면 사용자가 화를 낸다.
       "내가 고친 필드를 남이 안 건드렸다면" 그냥 통과시켜도 안전하다.
       그 판단을 하려면 '버전 N 이후 어떤 필드가 바뀌었는가' 를 알아야 하고,
       그건 이 테이블에만 있다.

           SELECT DISTINCT field FROM dt2_project_changes
            WHERE project_uuid = ? AND row_version > expected_version

    2) **감사 추적**
       누가·언제·무엇을·어떤 값에서 어떤 값으로 바꿨는지.
       AI 가 쓰기 시작하면 이게 없으면 사고를 되짚을 수 없다.
       `on_behalf_of` 는 AI 가 누구를 대신해 쓴 것인지를 남긴다.

    [[Dt2ProjectHistory]] 와 헷갈리지 말 것.
        이 테이블   모든 필드, 변경 1건 = 1행, 감사·병합용
        History     진척 지표만, 시계열 조회용 (차트가 읽는다)
    """
    __tablename__ = 'dt2_project_changes'

    # FK 를 걸지 않는다 — 과제가 지워져도 '누가 지웠는지' 는 남아야 한다.
    project_uuid = db.Column(db.String(64), nullable=False, index=True)

    # 이 변경이 만들어낸 버전. 즉 변경 **후** 의 row_version.
    row_version = db.Column(db.Integer, nullable=False)

    field = db.Column(db.String(100), nullable=False, index=True)
    before_value = db.Column(JSONB)
    after_value = db.Column(JSONB)

    actor_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), index=True)
    on_behalf_of = db.Column(db.Integer, db.ForeignKey('users.id'))
    # ui / ai / script / import
    source = db.Column(db.String(20), nullable=False, default='ui', server_default='ui', index=True)
    reason = db.Column(db.Text)              # AI 가 제시한 근거, 또는 승인 메모

    __table_args__ = (
        # 병합 판정 쿼리(project_uuid + row_version >)가 이 인덱스를 탄다
        db.Index('ix_dt2_proj_chg_uuid_version', 'project_uuid', 'row_version'),
    )

    def __repr__(self):
        return f'<Dt2ProjectChange {self.project_uuid[:8]} v{self.row_version} {self.field}>'


class Dt2ChangeProposal(BaseModel):
    """
    AI 제안 대기열 (Phase 4).

    결정된 방침: 저위험 필드(진행률·액션아이템·월간진척 등)는 AI 가 즉시 반영하고,
    핵심 필드(과제명·일정·진행상태·성과연결·소유자 등)는 여기에 쌓아 사람이 승인한다.

    **대상이 둘이다 (2026-08-05)** — 과제와 성과.
        원래는 과제 전용이라 `project_uuid` 가 NOT NULL 이었다. 성과 핵심 필드를
        확인 대기로 열면서(403 → 202) 성과 제안을 담을 자리가 필요해졌는데,
        **성과는 과제에 속하지 않는다** — 여러 과제가 공유하기 때문이다.

        ⚠️ `target_type` 을 **명시한다.** uuid 유무로 추론하지 않는다 —
           둘 다 비었거나 둘 다 찬 행이 생겼을 때 분기가 **조용히** 틀어진다.
    """
    __tablename__ = 'dt2_change_proposals'

    # 'project' | 'performance'
    target_type = db.Column(db.String(20), nullable=False,
                            default='project', server_default='project', index=True)
    project_uuid = db.Column(
        db.String(64), db.ForeignKey('dt2_projects.uuid', ondelete='CASCADE'),
        nullable=True, index=True
    )
    performance_uuid = db.Column(
        db.String(64), db.ForeignKey('dt2_performances.uuid', ondelete='CASCADE'),
        nullable=True, index=True
    )
    patch = db.Column(JSONB, nullable=False)          # {필드: 새값}
    before_values = db.Column(JSONB, nullable=False)  # 제안 시점의 원래 값
    base_version = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.Text)                       # AI 가 제시한 근거

    proposed_by = db.Column(db.Integer, db.ForeignKey('users.id'))    # 서비스 계정
    on_behalf_of = db.Column(db.Integer, db.ForeignKey('users.id'))   # 시킨 사람
    status = db.Column(db.String(20), nullable=False, default='pending', server_default='pending', index=True)
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    reviewed_at = db.Column(db.DateTime)
    review_note = db.Column(db.Text)


class Dt2AgentRun(BaseModel):
    """
    AI 에이전트 실행 1회의 기록. (2026-08-08)

    ── 왜 남기나 ────────────────────────────────────────────────────────────
    "간단한 건 되는데 복잡한 건 못 한다" 를 고치려면 **어디서 어긋났는지**를 봐야
    한다. 답만 봐서는 모른다 — 도구를 잘못 골랐는지, 인자를 틀렸는지, 예산에
    걸려 중간에 끊겼는지, 목록이 limit 에 잘려 잘못 세었는지가 전부 다른 문제고
    고칠 곳도 다르다. 그 판단에 필요한 것이 `trace` 다.

    ⚠️ **추측으로 고치지 않기 위한 자리다.** 이게 없으면 프롬프트를 감으로 만지게 되고,
       나아졌는지도 알 수 없다.

    ⚠️ 답변 본문(`answer`)까지 담는다. trace 만 있으면 "도구는 맞게 불렀는데 답을
       엉뚱하게 썼다" 를 구분할 수 없다.

    보관은 짧게 본다 — 진단용이지 감사(audit)용이 아니다. 감사 기록은
    `dt2_project_changes` 가 따로 남긴다.
    """

    __tablename__ = 'dt2_agent_runs'

    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), index=True)
    # ⚠️ `query` 로 두면 안 된다 — Flask-SQLAlchemy 의 `Model.query` 를 가려서
    #    `Dt2AgentRun.query.filter(...)` 가 컬럼을 가리키게 되고 조회가 통째로 깨진다.
    question = db.Column(db.Text, nullable=False)
    answer = db.Column(db.Text)
    # [{hop, tool, args, summary}] — 루프가 쌓은 그대로
    trace = db.Column(JSONB, nullable=False, default=list)
    hops = db.Column(db.Integer, nullable=False, default=0)
    tool_calls = db.Column(db.Integer, nullable=False, default=0)
    model = db.Column(db.String(80))
    readonly = db.Column(db.Boolean, nullable=False, default=False,
                         server_default='false')
    # 도구 결과가 잘렸나 (_MAX_TOOL_RESULT_CHARS). 잘리면 모델이 없는 값을 지어낸다
    truncated = db.Column(db.Boolean, nullable=False, default=False,
                          server_default='false')
    duration_ms = db.Column(db.Integer)
    # 실패도 남긴다 — 오히려 실패가 고칠 거리를 준다
    error = db.Column(db.Text)
    # 사람이 나중에 표시하는 판정. 골든셋으로 승격할 후보를 고르는 데 쓴다.
    # NULL=미판정 · 'good' · 'bad'
    verdict = db.Column(db.String(10), index=True)
    verdict_note = db.Column(db.Text)


class Dt2WorklistDismissal(BaseModel):
    """
    「내 일」 화면에서 **잠시 내려둔 항목**. 사용자별.

    왜 필요한가
        카드 중에는 **화면에서 없앨 방법이 없는 것**이 있다. 「기한 지난 액션아이템」은
        완료 체크를 하면 사라지지만, 「멈춘 과제」는 진행률이 실제로 올라야 하고
        「이슈 적체」는 60일 넘은 이슈가 해결돼야 사라진다. 협력사 계약을 기다리는
        과제라면 한 달 내내 같은 줄이 뜬다.

        그런 항목이 서너 개 쌓이면 사람은 **배지 숫자를 안 믿기 시작한다**
        ("5개인데 3개는 원래 있는 거야"). 그러면 정작 새로 생긴 급한 항목도 묻힌다.
        그래서 "알고 있다. 나중에 다시 알려달라" 고 말할 수단을 준다.

    왜 브라우저(localStorage)가 아니라 서버인가
        기존 재검토 요청 팝업이 localStorage 를 쓰는데 **PC 를 바꾸면 다시 뜬다.**
        내 일 화면은 항목이 훨씬 많아 같은 문제가 커진다.

    `item_key` 는 **결정적으로** 만든다 (routes_v2._worklist_key).
        stalled:<project_uuid>
        overdue:<project_uuid>:<action_uuid>      ← 액션아이템 uuid 가 있어서 가능하다
        issue:<project_uuid>
      ⚠️ 목록에서의 순서·번호를 키에 넣으면 안 된다. 항목이 하나 늘면 키가 전부
         어긋나 미뤄둔 것이 되살아난다.

    FK 를 과제에 걸지 않는다 — 과제가 지워지면 그 항목은 어차피 안 뜬다.
    행이 남아도 해가 없고, 되살아난 과제의 스누즈는 유지되는 편이 낫다.
    """
    __tablename__ = 'dt2_worklist_dismissals'

    user_id = db.Column(db.Integer, db.ForeignKey('users.id'),
                        nullable=False, index=True)
    item_key = db.Column(db.String(200), nullable=False)
    # 이 시각까지 숨긴다. **naive UTC** 다 (BaseModel 의 created_at 과 같은 기준) —
    # SQL now()(KST)와 직접 비교하면 9시간 어긋난다. 규칙은 shared/timeutil 에 있다.
    until = db.Column(db.DateTime, nullable=False, index=True)
    # 어느 카드에서 눌렀나. 통계용이고 판정에는 안 쓴다.
    card = db.Column(db.String(40))

    __table_args__ = (
        # 같은 사람이 같은 항목을 두 번 미루면 **덮어쓴다**(새 기한으로).
        # 행이 쌓이면 "가장 늦은 것" 을 고르는 셈이 매번 필요해진다.
        db.UniqueConstraint('user_id', 'item_key', name='uq_dt2_worklist_user_item'),
    )

    def __repr__(self):
        return f'<Dt2WorklistDismissal u{self.user_id} {self.item_key} ~{self.until}>'
