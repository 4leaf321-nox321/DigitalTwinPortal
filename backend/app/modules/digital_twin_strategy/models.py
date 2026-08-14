"""
Digital Twin Strategy Models
연도별 전략 기획 — 진단 / 이슈 / 근거

계획서: frontend/src/modules/digital-twin-strategy/PLAN.md
Phase 1 범위는 진단(assessment)까지다. 이슈 이후 단계는 뒤 Phase 에서 붙인다.
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
