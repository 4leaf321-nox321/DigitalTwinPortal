"""
Digital Twin Strategy Models
연도별 전략 기획 — 진단 / 이슈 / 근거

계획서: frontend/src/modules/digital-twin-strategy/PLAN.md
현재 범위는 ① 진단 ~ ② 이슈다. 분석 이후 단계는 뒤 Phase 에서 붙인다.
"""
from app.extensions import db
from app.shared.models import BaseModel
from sqlalchemy.dialects.postgresql import JSON


class StrategyPlan(BaseModel):
    """연도별 전략 1건. 이 모듈의 모든 데이터가 여기에 매달린다."""
    __tablename__ = 'strategy_plan'

    year = db.Column(db.Integer, nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    # draft: 작성 중 / review: 검토 / confirmed: 확정
    status = db.Column(db.String(20), nullable=False, default='draft')
    owner_id = db.Column(db.Integer, nullable=True)

    __table_args__ = (
        # 한 해에 전략은 하나다. 여러 벌을 두면 어느 것이 정본인지 갈린다.
        db.UniqueConstraint('year', name='uq_strategy_plan_year'),
    )

    assessments = db.relationship(
        'StrategyAssessment', backref='plan', lazy='dynamic',
        cascade='all, delete-orphan'
    )

    def to_dict(self):
        d = super().to_dict()
        d['assessment_count'] = self.assessments.count()
        return d


class StrategyAssessment(BaseModel):
    """
    ① 현재 상태 진단. 사업부별로, 성숙도 차원별로 현재 수준과 목표 수준을 매긴다.

    이슈를 격차(gap)로 정의하기 위한 출발점이다. 목표에서 현재를 뺀 값이
    다음 단계의 이슈 후보가 된다.

    사업부 단위인 이유: 포탈 데이터가 전부 사업부로 쌓이고 성숙도도 사업부마다
    크게 다르다. 전사 하나로 뭉치면 "평균 3단계" 같은 쓸모없는 숫자만 남는다.

    division_id 에 FK 를 걸지 않는다. divisions 는 대시보드 모듈의 테이블이라
    하드 결합을 만들지 않고, 이름은 읽을 때 붙인다(사업부명이 바뀌어도 따라간다).
    """
    __tablename__ = 'strategy_assessment'

    plan_id = db.Column(
        db.Integer, db.ForeignKey('strategy_plan.id', ondelete='CASCADE'),
        nullable=False, index=True
    )
    division_id = db.Column(db.Integer, nullable=False, index=True)
    # technical: 기술 성숙도 / organization: 조직 역량
    # 둘 다 1~5 로 매기지만 레벨의 뜻이 다르다(definitions.py 참고).
    category = db.Column(db.String(20), nullable=False, default='technical')
    dimension = db.Column(db.String(50), nullable=False)
    current_level = db.Column(db.Integer, nullable=True)   # 1~5, 미입력이면 None
    target_level = db.Column(db.Integer, nullable=True)
    # auto: 포탈 데이터로 채움 / survey: 설문 / manual: 손으로 입력
    basis = db.Column(db.String(20), nullable=False, default='manual')
    note = db.Column(db.Text)

    __table_args__ = (
        db.UniqueConstraint(
            'plan_id', 'division_id', 'category', 'dimension',
            name='uq_assessment_plan_division_category_dimension'
        ),
    )

    @property
    def gap(self):
        """목표 - 현재. 둘 중 하나라도 없으면 격차를 말할 수 없다."""
        if self.current_level is None or self.target_level is None:
            return None
        return self.target_level - self.current_level

    def to_dict(self):
        d = super().to_dict()
        d['gap'] = self.gap
        return d


class StrategyMetricTarget(BaseModel):
    """
    B. 활용·성과 지표의 목표값.

    관측값은 저장하지 않는다 — 포탈 데이터에서 매번 계산한다(metrics.py).
    저장하면 원본이 바뀌었을 때 조용히 낡은 값을 보여주게 된다.

    목표만 사람이 정하므로 그것만 남긴다. 목표가 없으면 관측값만 보이고
    격차는 없다.
    """
    __tablename__ = 'strategy_metric_target'

    plan_id = db.Column(
        db.Integer, db.ForeignKey('strategy_plan.id', ondelete='CASCADE'),
        nullable=False, index=True
    )
    division_id = db.Column(db.Integer, nullable=False, index=True)
    metric_key = db.Column(db.String(50), nullable=False)
    target_value = db.Column(db.Float, nullable=True)
    note = db.Column(db.Text)

    __table_args__ = (
        db.UniqueConstraint(
            'plan_id', 'division_id', 'metric_key',
            name='uq_metric_target_plan_division_key'
        ),
    )


class StrategyCrux(BaseModel):
    """
    진단의 산출물. 올해 넘어야 할 결정적 지점 1~3개.

    격자를 다 채우는 것이 진단의 끝이 아니다. Rumelt 가 말하는 진단은 "무슨 일이
    벌어지고 있는가"에 대한 정직한 설명과 그 안의 **크럭스** — 노력이 실제로
    결실을 맺는 지점 — 를 짚는 것이다. 점수 75개가 아니라 이 몇 줄이 다음 단계
    (② 이슈)로 넘어간다.

    많이 만들지 않는 것이 핵심이다. 전부가 중요하면 아무것도 중요하지 않다.
    """
    __tablename__ = 'strategy_crux'

    plan_id = db.Column(
        db.Integer, db.ForeignKey('strategy_plan.id', ondelete='CASCADE'),
        nullable=False, index=True
    )
    title = db.Column(db.String(300), nullable=False)
    # 왜 이것이 크럭스인가. 근거 없이 고르면 그냥 인상이다.
    rationale = db.Column(db.Text)
    # 특정 사업부의 문제면 지정, 전사면 비운다.
    division_id = db.Column(db.Integer, nullable=True, index=True)
    # 어느 관측에서 출발했는지. findings 의 key 를 담는다(계산값이라 FK 가 없다).
    source_finding = db.Column(db.String(50))
    order = db.Column(db.Integer, nullable=False, default=0)


class StrategyIssue(BaseModel):
    """
    ② 이슈. 핵심 난제를 **풀 수 있는 크기로 쪼갠 것**이다.

    난제는 "넘어야 할 지점"이라 그대로는 손댈 수 없다. 이슈는 손댈 수 있는
    단위여야 하고, 그래서 다음 단계(③ 분석)의 입력이 된다.

    crux_id 를 비울 수 있게 둔 것이 이 표의 요점이다. 어느 난제에도 매달리지
    않은 이슈가 보이면 그것은 **전략과 무관한 일을 하고 있다는 신호**다.
    지우지 않고 드러낸다 — 난제 쪽이 틀렸을 수도 있기 때문이다.

    난제가 지워져도 이슈는 남는다(SET NULL). 딸려 지우면 사람이 쓴 것이
    조용히 사라진다.
    """
    __tablename__ = 'strategy_issue'

    plan_id = db.Column(
        db.Integer, db.ForeignKey('strategy_plan.id', ondelete='CASCADE'),
        nullable=False, index=True
    )
    crux_id = db.Column(
        db.Integer, db.ForeignKey('strategy_crux.id', ondelete='SET NULL'),
        nullable=True, index=True
    )
    title = db.Column(db.String(300), nullable=False)
    description = db.Column(db.Text)
    # 왜 아직 안 풀렸는가. 5 Whys 를 한 칸으로 줄인 것이다. 단계를 다섯 칸으로
    # 나눠 받으면 채우는 것이 목적이 되고 마지막 두 칸은 늘 비어 있다.
    root_cause = db.Column(db.Text)
    # 특정 사업부의 이슈면 지정, 전사면 비운다.
    division_id = db.Column(db.Integer, nullable=True, index=True)

    # crux: 난제를 쪼갬 / gap: 진단 격차에서 / metric: 지표 미달에서 / manual: 손으로
    source_type = db.Column(db.String(20), nullable=False, default='manual')
    source_ref = db.Column(db.String(200))

    # 1~5. **비워둘 수 있다.** 근거 없이 매긴 점수는 판단을 돕지 못한다 —
    # 진단 격자와 같은 이유로 강제하지 않는다. ④ 솔루션 우선순위에서 쓰인다.
    impact = db.Column(db.Integer, nullable=True)       # 풀면 얼마나 달라지는가
    feasibility = db.Column(db.Integer, nullable=True)  # 올해 손댈 수 있는가

    # open: 다룬다 / dropped: 올해는 안 한다(지우지 않고 남긴다 — 판단의 기록이다)
    status = db.Column(db.String(20), nullable=False, default='open')
    order = db.Column(db.Integer, nullable=False, default=0)

    @property
    def priority_score(self):
        """영향도 × 실행가능성. 둘 다 있어야 말이 된다."""
        if self.impact is None or self.feasibility is None:
            return None
        return self.impact * self.feasibility

    def to_dict(self):
        d = super().to_dict()
        d['priority_score'] = self.priority_score
        return d


# ── 설문 ──────────────────────────────────────────────────────────────────
#
# 설문은 단계가 아니라 **두 번째 근거 원천**이다. 포탈 데이터가 "시스템이 아는
# 것"이라면 설문은 "사람만 아는 것"을 가져온다 — 특히 진단의 조직 역량 5축은
# 시스템이 알 방법이 없어 설문이 정석이다(definitions.py 의 survey_recommended).
#
# ⚠️ 익명성은 **한 가지 방식만** 있다. 응답자명은 숨기고 소속만 보이되,
#    관리자는 확인할 수 있다. 그리고 그 사실을 응답 화면에 반드시 고지한다.
#    익명이라 해놓고 추적 가능하면, 그게 알려지는 순간 이후 어떤 설문도
#    솔직한 답을 못 받는다. 그래서 켜고 끄는 설정으로 두지 않는다.


class StrategySurvey(BaseModel):
    """설문 한 벌."""
    __tablename__ = 'strategy_survey'

    plan_id = db.Column(
        db.Integer, db.ForeignKey('strategy_plan.id', ondelete='CASCADE'),
        nullable=False, index=True
    )
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    # 어느 단계에 쓸 설문인가. assessment 면 조직 역량 축에 연결된다.
    stage = db.Column(db.String(20), nullable=False, default='assessment')

    # 누구에게 묻는가. all: 전사 / department: 부서 / role: 역할 / user: 지정 인원
    target_type = db.Column(db.String(20), nullable=False, default='all')
    # department 면 부서 id, role 이면 역할 문자열, user 면 사용자 id 목록.
    target_refs = db.Column(JSON, nullable=False, default=list)

    # draft: 작성 중(응답 못 받음) / open: 응답 받는 중 / closed: 마감
    status = db.Column(db.String(20), nullable=False, default='draft')
    closes_at = db.Column(db.DateTime, nullable=True)
    created_by = db.Column(db.Integer, nullable=True)

    questions = db.relationship(
        'StrategySurveyQuestion', backref='survey', lazy='dynamic',
        cascade='all, delete-orphan',
        order_by='StrategySurveyQuestion.order'
    )
    responses = db.relationship(
        'StrategySurveyResponse', backref='survey', lazy='dynamic',
        cascade='all, delete-orphan'
    )


class StrategySurveyQuestion(BaseModel):
    """문항 하나."""
    __tablename__ = 'strategy_survey_question'

    survey_id = db.Column(
        db.Integer, db.ForeignKey('strategy_survey.id', ondelete='CASCADE'),
        nullable=False, index=True
    )
    order = db.Column(db.Integer, nullable=False, default=0)
    text = db.Column(db.String(500), nullable=False)
    help_text = db.Column(db.Text)

    # scale: 1~5 척도 / choice: 객관식 / rank: 순위 / text: 자유서술
    qtype = db.Column(db.String(20), nullable=False, default='scale')
    required = db.Column(db.Boolean, nullable=False, default=True)
    # choice·rank 의 보기 목록, scale 의 양끝 이름 등 유형별 부가 정의.
    options = db.Column(JSON, nullable=False, default=dict)

    # 진단 연결 — 이 문항이 어느 축을 묻는가.
    # 이게 있어야 설문 결과가 숫자 구경으로 끝나지 않고 진단 칸으로 들어간다.
    link_category = db.Column(db.String(20))    # 'organization' 등
    link_dimension = db.Column(db.String(50))   # 'readiness' 등


class StrategySurveyResponse(BaseModel):
    """한 사람의 응답 한 벌.

    user_id 를 남기는 이유는 두 가지다. **중복 응답을 막고**, 고지한 대로
    관리자가 확인할 수 있게 하기 위해서다. 일반 열람에는 절대 실리지 않는다 —
    그 판단은 라우트가 아니라 직렬화 함수 한 곳에서 한다(routes 참고).

    소속을 응답 시점에 **복사해 둔다.** 나중에 조직이 바뀌어도 "그때 이
    부서가 이렇게 답했다"가 남아야 집계가 검증된다.
    """
    __tablename__ = 'strategy_survey_response'

    survey_id = db.Column(
        db.Integer, db.ForeignKey('strategy_survey.id', ondelete='CASCADE'),
        nullable=False, index=True
    )
    user_id = db.Column(db.Integer, nullable=False, index=True)

    department_name = db.Column(db.String(100))
    division_id = db.Column(db.Integer, nullable=True, index=True)
    # profile: 사용자 소속에서 유도 / picked: 응답자가 직접 고름 / unknown: 못 정함
    #
    # ⚠️ users.department 와 departments.division_id 가 비어 있으면 유도가 안 된다.
    #    그때는 응답자가 직접 고르게 하고, 그것도 없으면 unknown 으로 남긴다.
    #    사업부를 모르는 응답을 조용히 아무 데나 넣으면 집계가 거짓말을 한다.
    division_source = db.Column(db.String(20), nullable=False, default='unknown')

    submitted_at = db.Column(db.DateTime, nullable=True)

    answers = db.relationship(
        'StrategySurveyAnswer', backref='response', lazy='dynamic',
        cascade='all, delete-orphan'
    )

    __table_args__ = (
        # 한 사람이 한 설문에 한 번. 여러 벌 받으면 집계가 기울어진다.
        db.UniqueConstraint('survey_id', 'user_id', name='uq_strategy_survey_response_user'),
    )


class StrategySurveyAnswer(BaseModel):
    """문항 하나에 대한 답.

    유형마다 담기는 칸이 다르다. 한 칸에 전부 문자열로 밀어넣으면 집계할 때
    매번 파싱해야 하고, 숫자가 아닌 값이 섞여도 모른다.
    """
    __tablename__ = 'strategy_survey_answer'

    response_id = db.Column(
        db.Integer, db.ForeignKey('strategy_survey_response.id', ondelete='CASCADE'),
        nullable=False, index=True
    )
    question_id = db.Column(
        db.Integer, db.ForeignKey('strategy_survey_question.id', ondelete='CASCADE'),
        nullable=False, index=True
    )

    value_number = db.Column(db.Float, nullable=True)   # scale
    value_text = db.Column(db.Text, nullable=True)      # text
    value_json = db.Column(JSON, nullable=True)         # choice(다중) · rank

    __table_args__ = (
        db.UniqueConstraint('response_id', 'question_id',
                            name='uq_strategy_survey_answer_response_question'),
    )


class StrategySurveyAccessLog(BaseModel):
    """관리자가 응답자를 확인한 기록.

    "관리자는 확인할 수 있습니다"라고 고지하는 이상, 실제로 누가 언제 봤는지
    남아야 그 고지가 말뿐이 아니게 된다. 남기지 않으면 고지는 면피 문구다.
    """
    __tablename__ = 'strategy_survey_access_log'

    survey_id = db.Column(
        db.Integer, db.ForeignKey('strategy_survey.id', ondelete='CASCADE'),
        nullable=False, index=True
    )
    # 본 사람 (관리자)
    viewer_id = db.Column(db.Integer, nullable=False, index=True)
    # 어떤 응답을 봤는가. 전체 목록을 열었으면 비운다.
    response_id = db.Column(db.Integer, nullable=True)
    action = db.Column(db.String(30), nullable=False)   # list_identities | view_identity


class StrategyEvidence(BaseModel):
    """
    모든 단계 공용 근거. 포탈 데이터와 설문 결과가 함께 들어온다.

    snapshot 이 핵심이다. 근거로 삼은 **시점의 값을 복사**해 둔다. 원본 과제
    데이터가 나중에 바뀌어도 "그때 이 숫자를 보고 이렇게 판단했다"가 남아야
    전략 문서가 검증 가능하다.

    source_mode 는 그 근거가 진짜 데이터인지 개발용 합성 데이터인지 구분한다.
    fixture 로 만든 전략이 운영 산출물로 오인되면 안 된다.
    """
    __tablename__ = 'strategy_evidence'

    plan_id = db.Column(
        db.Integer, db.ForeignKey('strategy_plan.id', ondelete='CASCADE'),
        nullable=False, index=True
    )
    # 어느 항목에 붙은 근거인가 (assessment / issue / element / solution)
    target_type = db.Column(db.String(30), nullable=False)
    target_id = db.Column(db.Integer, nullable=False)

    kind = db.Column(db.String(20), nullable=False, default='portal')  # portal | survey
    source_module = db.Column(db.String(50), nullable=False)  # digital_twin_dashboard 등
    source_ref = db.Column(db.String(200))                    # 원본 식별자
    source_mode = db.Column(db.String(20), nullable=False, default='local')  # local | fixture

    snapshot = db.Column(JSON, nullable=False, default=dict)
    label = db.Column(db.String(300))  # 화면에 보일 한 줄 요약

    __table_args__ = (
        db.Index('ix_evidence_target', 'target_type', 'target_id'),
    )
