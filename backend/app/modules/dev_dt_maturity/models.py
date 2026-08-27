# -*- coding: utf-8 -*-
"""개발 디지털 트윈 성숙도 — 표. (PLAN.md 5절)

    subject      대상 (시험 항목 …)          사업부 · 부문 · 이름
    agent        수단 (시뮬레이션 …)         사업부 · 부문 · 이름 · 모델 종류
    pair         subject × agent             ← 평가·이력·URL 이 전부 여기 붙는다
    assessment   pair × axis 한 줄            rung | value · 근거 · 증빙 · 평가일/평가자
    change       이력                         before → after · 근거 · 누가 · 언제

⚠️⚠️ **쌍이 일급이다.** 로드맵 정보처럼 JSON 배열에 연결을 넣으면 연결을 고칠 때마다
   배열이 통째로 갈리고 평가가 사라진다. 쌍에 id 가 있어야 URL(?pair=) 도 생긴다.

⚠️ **축마다 한 줄.** 여섯 컬럼이 아니다. 셋만 매긴 상태가 자연스럽고, 축마다
   평가일이 따로 남고, 축을 더 붙여도 표가 안 바뀐다.

⚠️ **파생값은 저장하지 않는다.** 항목 정확도(평균)·적용 범위 비율·낡음·분포는
   매번 센다. 저장하면 원본이 바뀐 뒤에도 낡은 값이 남는다(전략 모듈과 같은 규칙).

⚠️ 로드맵 항목·대시보드 과제로 가는 링크는 **FK 가 아니다.** 저쪽이 바뀌어도 여기가
   안 깨진다. 있으면 「로드맵에서 보기」「과제 열기」 문이 열릴 뿐이다.
"""
from datetime import datetime

from app.extensions import db
from app.shared.models import BaseModel


class MaturitySubject(BaseModel):
    """대상 — 시뮬레이션 부문이면 시험 항목."""
    __tablename__ = 'dt_maturity_subject'

    division_id = db.Column(db.Integer, nullable=False, index=True)
    sector = db.Column(db.String(40), nullable=False, index=True)
    name = db.Column(db.String(300), nullable=False)
    detail = db.Column(db.String(500))
    product_families = db.Column(db.JSON, default=list)
    # 항목 정확도의 집계 규칙 — auto | single | mean (definitions.ACCURACY_RULES)
    accuracy_rule = db.Column(db.String(10), nullable=False, default='auto')
    roadmap_task_id = db.Column(db.Integer)          # 참고 링크. FK 아님
    order = db.Column(db.Integer, nullable=False, default=0)

    pairs = db.relationship('MaturityPair', backref='subject',
                            cascade='all, delete-orphan', passive_deletes=True)

    def to_dict(self):
        d = super().to_dict()
        d['product_families'] = list(self.product_families or [])
        return d


class MaturityAgent(BaseModel):
    """수단 — 시뮬레이션 부문이면 시뮬레이션(엑셀 행 단위)."""
    __tablename__ = 'dt_maturity_agent'

    division_id = db.Column(db.Integer, nullable=False, index=True)
    sector = db.Column(db.String(40), nullable=False, index=True)
    name = db.Column(db.String(300), nullable=False)
    kind = db.Column(db.String(100))                 # 구조 / 열 / 유동 … 자유 텍스트
    # 물리 기반 / 데이터 기반 / 하이브리드 — 부문이 아니라 속성이다(PLAN 2절)
    model_kind = db.Column(db.String(20))
    # 이 시뮬레이션에 쓰는 도구들 — 인스턴스 목록(예: LS-DYNA, HyperMesh). 자유 텍스트,
    # 이름으로만 든다. 인텔의 도구 표와 FK 로 묶지 않는다 — 저쪽이 바뀌어도 여기가 안 깨진다.
    tools = db.Column(db.JSON, default=list)
    project_uuid = db.Column(db.String(64), index=True)   # 참고 링크. FK 아님

    pairs = db.relationship('MaturityPair', backref='agent',
                            cascade='all, delete-orphan', passive_deletes=True)

    def to_dict(self):
        d = super().to_dict()
        d['tools'] = list(self.tools or [])
        return d


class MaturityPair(BaseModel):
    """대상 × 수단. 디지털 스레드처럼 수단 없는 부문은 agent_id 가 비어 있다.

    ⚠️ (subject_id, agent_id) 유일 제약은 agent_id 가 NULL 이면 안 잡는다(SQL 의 NULL).
       수단 없는 쌍이 한 대상에 둘 생기지 않게 하는 것은 services.create_pair 가 한다.
    """
    __tablename__ = 'dt_maturity_pair'
    __table_args__ = (
        db.UniqueConstraint('subject_id', 'agent_id', name='uq_dt_maturity_pair'),
    )

    subject_id = db.Column(db.Integer, db.ForeignKey('dt_maturity_subject.id', ondelete='CASCADE'),
                           nullable=False, index=True)
    agent_id = db.Column(db.Integer, db.ForeignKey('dt_maturity_agent.id', ondelete='CASCADE'),
                         nullable=True, index=True)

    assessments = db.relationship('MaturityAssessment', backref='pair',
                                  cascade='all, delete-orphan', passive_deletes=True)
    changes = db.relationship('MaturityChange', backref='pair',
                              cascade='all, delete-orphan', passive_deletes=True)


class MaturityAssessment(BaseModel):
    """쌍 × 축 한 줄. rung 축은 rung 만, value 축은 value 만 쓴다(칸은 값에서 환산)."""
    __tablename__ = 'dt_maturity_assessment'
    __table_args__ = (
        db.UniqueConstraint('pair_id', 'axis', name='uq_dt_maturity_assessment'),
    )

    pair_id = db.Column(db.Integer, db.ForeignKey('dt_maturity_pair.id', ondelete='CASCADE'),
                        nullable=False, index=True)
    axis = db.Column(db.String(40), nullable=False)
    rung = db.Column(db.String(40))
    value = db.Column(db.Float)
    note = db.Column(db.Text, nullable=False, default='')     # 근거 — 비우고는 저장 못 한다
    evidence = db.Column(db.JSON, default=dict)              # 축마다 모양이 다르다
    assessed_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    assessed_by_id = db.Column(db.Integer)
    assessed_by_name = db.Column(db.String(100))

    def to_dict(self):
        d = super().to_dict()
        d['evidence'] = dict(self.evidence or {})
        d['assessed_at'] = self.assessed_at.isoformat() if self.assessed_at else None
        return d


class MaturityChange(BaseModel):
    """무엇이 언제 왜 바뀌었나. 사다리의 「이 칸에 언제 올라왔나」가 여기서 나온다."""
    __tablename__ = 'dt_maturity_change'

    pair_id = db.Column(db.Integer, db.ForeignKey('dt_maturity_pair.id', ondelete='CASCADE'),
                        nullable=False, index=True)
    axis = db.Column(db.String(40), nullable=False)
    before = db.Column(db.String(60))
    after = db.Column(db.String(60))
    note = db.Column(db.Text)
    actor_user_id = db.Column(db.Integer)
    actor_name = db.Column(db.String(100))
