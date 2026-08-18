"""
Digital Twin Strategy Models
연도별 전략 기획 — ① 진단 ~ ⑤ 기획서

계획서: frontend/src/modules/digital-twin-strategy/PLAN.md

⚠️ **안 쓰는 표를 두지 않는다.** 한동안 `strategy_evidence`(근거 시점 스냅샷)가
   여기 있었는데 한 번도 안 썼다. 그 목적은 이미 다른 것들이 하고 있다 —
   확정본은 `strategy_document.snapshot` 이, 설문 근거는 볼 때마다 계산이.
   안 쓰는 표가 남아 있으면 다음 사람은 그게 쓰이는 줄 알고 거기에 맞춰 짠다.
"""
from app.extensions import db
from app.shared.models import BaseModel
from sqlalchemy.dialects.postgresql import JSON


class StrategyPlan(BaseModel):
    """연도별 전략 1건. 이 모듈의 모든 데이터가 여기에 매달린다."""
    __tablename__ = 'strategy_plan'

    year = db.Column(db.Integer, nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    # draft: 작성 중 / confirmed: 확정
    #
    # ⚠️ **기획서(⑤)를 확정하면 여기가 따라 바뀐다.** 두 곳에서 따로 정하게 두면
    #    "전략은 확정인데 기획서는 초안" 같은 상태가 생기고, 그때 무엇이 맞는지
    #    아무도 모른다. 확정의 정의는 하나다 — **기획서를 굳혔는가.**
    #
    #    'review'(검토) 는 두지 않는다. 정의만 있고 아무도 안 바꾸던 값이었다.
    #    검토 단계가 실제로 필요해지면 그때 넣는 것이 맞다.
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

    # crux: 난제를 쪼갬 / gap: 진단 격차에서 / metric: 지표 미달에서
    # finding: 발견 사항에서 바로(설문이 짚은 것 — 격차가 아니라 지목이라
    #          목표 레벨 없이도 이슈가 된다) / manual: 손으로
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


class StrategyElement(BaseModel):
    """
    ③ 분석. SWOT 의 한 칸에 들어가는 **전략 요소** 하나.

    ⚠️ **발견 사항과 겹치는 것은 정상이다.** 쓰이는 곳이 다르다.

        발견 사항 → 핵심 난제 → 이슈       올해 다룰 것을 고르는 길
        S·W·O·T  → TOWS(④)   → 솔루션     조합해서 솔루션을 만드는 재료

    ④ TOWS 가 S×O, W×O, S×T, W×T 네 조합에서 솔루션을 뽑으므로 네 칸이 다
    있어야 한다. 그래서 발견 사항을 **후보로 제시하되 사람이 골라 승격**한다 —
    자동으로 옮기면 이 칸이 발견 사항의 복사본이 되고, 그러면 조합할 것이
    없어진다.

    ⚠️ **status 를 두지 않는다.** 이슈에는 dropped 가 있지만(올해는 안 한다는
    판단의 기록), 전략 요소에는 그 상태가 뜻이 없다. 아니면 지운다.

    ⚠️ 근거의 무게가 칸마다 다르다. S·W 는 진단에서 나오지만 **O·T 는 포탈에
    없는 정보**라 설문이나 사람 손에서 온다(source_type). 화면이 그 차이를
    보여야 한다 — 넷을 같은 무게로 두면 O·T 가 인상평으로 채워진다.
    """
    __tablename__ = 'strategy_element'

    plan_id = db.Column(
        db.Integer, db.ForeignKey('strategy_plan.id', ondelete='CASCADE'),
        nullable=False, index=True
    )
    # S 강점 / W 약점 / O 기회 / T 위협
    kind = db.Column(db.String(1), nullable=False)
    title = db.Column(db.String(300), nullable=False)
    detail = db.Column(db.Text)
    # 특정 사업부의 것이면 지정, 전사면 비운다.
    division_id = db.Column(db.Integer, nullable=True, index=True)

    # 어디서 왔나. assessment(진단 레벨) / finding(발견 사항) / survey / manual
    source_type = db.Column(db.String(20), nullable=False, default='manual')
    source_ref = db.Column(db.String(200))
    order = db.Column(db.Integer, nullable=False, default=0)


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
class StrategySolution(BaseModel):
    """
    ④ 솔루션. **SWOT 을 엮어 만든 솔루션** 하나.

    TOWS 는 SWOT 을 분석에서 끝내지 않고 솔루션으로 바꾸는 도구다. 네 갈래가 있다.

        SO  강점으로 기회를 잡는다
        WO  약점을 메워 기회를 잡는다
        ST  강점으로 위협을 막는다
        WT  약점과 위협이 겹치는 곳 — 최소한의 방어

    ⚠️ **조합 격자를 그리지 않는다.** 강점 5개 × 기회 5개면 25칸이고, 그걸
       채우라고 하면 이 모듈이 계속 피해 온 「격자 채우기」가 그대로 재현된다 —
       진단 격자를 접어 내리고, SWOT 을 후보로 내밀고, 프로세스 축에 격자를 안
       늘린 이유가 전부 그것이었다.

       대신 네 갈래를 **바구니**로 두고, 솔루션을 적을 때 무엇과 무엇을 엮은
       것인지를 고르게 한다. 빈 칸이 아니라 **빈 목록**이라 채울 의무가 없다.

    ⚠️ element_ids 는 **근거**다. 그 요소가 지워지면 근거가 사라진 것이므로
       화면에서 조용히 빠진다 — 없는 것을 있는 척 보여주지 않는다.
    """
    __tablename__ = 'strategy_solution'

    plan_id = db.Column(
        db.Integer, db.ForeignKey('strategy_plan.id', ondelete='CASCADE'),
        nullable=False, index=True
    )
    # SO | WO | ST | WT
    tows = db.Column(db.String(2), nullable=False)
    title = db.Column(db.String(300), nullable=False)
    detail = db.Column(db.Text)
    # 특정 사업부의 솔루션이면 지정, 전사면 비운다.
    division_id = db.Column(db.Integer, nullable=True, index=True)
    # 엮은 전략 요소(StrategyElement) id 목록.
    element_ids = db.Column(JSON, nullable=False, default=list)

    # 사분면용. 1~5, **둘 다 nullable** — 이슈와 같은 규칙이다.
    #
    # ⚠️ **안 매긴 것을 0 으로 두지 않는다.** 그러면 아직 판단하지 않은 솔루션이
    #    「영향 낮음 × 어려움」 칸으로 조용히 굴러떨어져 '하지 않는다'로 읽힌다.
    #    안 매긴 것은 사분면 밖에 따로 세어 보여준다.
    impact = db.Column(db.Integer, nullable=True)
    feasibility = db.Column(db.Integer, nullable=True)

    # 이 솔루션이 움직이려는 지표(KpiDefinition) id 목록. **전략과 실행을 잇는 자리**다 —
    # 여기까지 와야 ① 진단에서 본 'KPI 에 안 걸린 과제' 문제가 반대편에서 닫힌다.
    kpi_ids = db.Column(JSON, nullable=False, default=list)

    # 이 솔루션을 **실제로 해내는 과제**(dt2_projects.uuid) 목록.
    #
    # ⚠️ 지표 연결만으로는 폐루프가 안 닫힌다. "가상검증률을 올리겠다"는 겨냥이고,
    #    그것을 **누가 무엇으로 하는가**는 과제다. 여기가 비어 있으면 그 솔루션은
    #    아직 말뿐이고, 그 사실이 화면과 문서에 보여야 한다.
    #
    # ⚠️ 외래키를 걸지 않는다. 과제는 `dt2_projects` 의 것이고 전략이 그 표의
    #    수명을 좌우해서는 안 된다 — 과제가 지워지면 근거가 사라진 것이지 이
    #    솔루션이 틀린 것이 아니다(element_ids 와 같은 규칙).
    project_uuids = db.Column(JSON, nullable=False, default=list)

    order = db.Column(db.Integer, nullable=False, default=0)


class StrategyGate(BaseModel):
    """
    AX-5R 횡단 게이트. 지금은 ④ 솔루션에 붙는다.

    솔루션을 하나 낼 때마다 다섯 가지를 묻는다 — 준비도·업무 정착·역할·리스크·성과.
    **진단의 조직 역량과 같은 다섯 축이지만 시제가 다르다**(definitions.GATES).

    ⚠️ **막는 관문이 아니다.** 다 안 채웠다고 저장을 거절하면 사람은 아무 말이나
       적어 넣는다. 안 채워진 것은 화면에 그대로 보이기만 한다 — "그럴듯한
       전략"과 "실행 가능한 전략"을 가르는 표시다.

    ⚠️ **답을 적은 게이트만 행이 생긴다.** 솔루션을 만들 때 빈 다섯 줄을 미리 깔면
       그 빈 줄이 "답했는데 내용이 없는 것"과 구별되지 않는다.

    ⚠️ target_id 에는 외래키가 없다(횡단이라 붙을 곳이 여럿이다). 그래서 **대상을
       지울 때 여기도 같이 지워야 한다** — routes 의 삭제 경로가 그 일을 한다.
       안 지우면 나중에 같은 번호를 받은 다른 솔루션에 남의 답이 붙는다.
    """
    __tablename__ = 'strategy_gate'

    plan_id = db.Column(
        db.Integer, db.ForeignKey('strategy_plan.id', ondelete='CASCADE'),
        nullable=False, index=True
    )
    # 지금은 'solution' 뿐. 게이트는 횡단이라 나중에 이슈에도 붙을 수 있다.
    target_type = db.Column(db.String(30), nullable=False)
    target_id = db.Column(db.Integer, nullable=False)
    # readiness | redesign | role | risk | return
    gate = db.Column(db.String(20), nullable=False)
    answer = db.Column(db.Text, nullable=False)
    # answered | na — '해당 없음'도 이유를 적어야 남는다.
    status = db.Column(db.String(10), nullable=False, default='answered')

    __table_args__ = (
        db.UniqueConstraint('target_type', 'target_id', 'gate',
                            name='uq_strategy_gate_target'),
        db.Index('ix_strategy_gate_target', 'target_type', 'target_id'),
    )


class StrategyDocument(BaseModel):
    """
    ⑤ 기획서. **전략 하나에 한 벌**이다.

    ⚠️ 본문을 저장하지 않는다. 진단·이슈·SWOT·솔루션은 이미 각 단계에 있고,
       그것을 여기에 복사해 두면 그 순간부터 둘이 갈라진다. 평소에는 볼 때마다
       **지금 데이터로 조립**한다(document.assemble).

       여기 담기는 것은 두 가지뿐이다.
         sections  사람이 정한 것 — 포함 여부와 손으로 쓴 구간의 글
         snapshot  **확정한 시점**의 조립 결과

    ⚠️ **확정하면 굳는다.** 승인받은 기획서가 뒤에서 조용히 바뀌면 그 문서로
       한 결정을 되짚을 수 없다. 그래서 확정 시점의 조립 결과를 통째로 복사해
       둔다. 다시 확정하면 그때
       것으로 덮는다(판을 쌓지는 않는다. 필요해지면 그때 표를 나눈다).
    """
    __tablename__ = 'strategy_document'

    plan_id = db.Column(
        db.Integer, db.ForeignKey('strategy_plan.id', ondelete='CASCADE'),
        nullable=False, unique=True, index=True
    )
    # {구간키: {'included': bool, 'text': str}}
    sections = db.Column(JSON, nullable=False, default=dict)
    # draft | confirmed
    status = db.Column(db.String(10), nullable=False, default='draft')
    confirmed_at = db.Column(db.DateTime)
    confirmed_by = db.Column(db.Integer)
    # 확정 시점의 조립 결과. draft 면 None 이다.
    snapshot = db.Column(JSON)
