# -*- coding: utf-8 -*-
"""디지털 트윈 성숙도 — 표. (PLAN.md 5절)

    subject      대상 (시험 항목 …)          사업부 · 부문 · 이름
    agent        수단 (시뮬레이션 …)         사업부 · 부문 · 이름 · 모델 종류
    pair         subject × agent             ← 평가·이력·URL 이 전부 여기 붙는다
    assessment   pair × axis 한 줄            rung | value · 근거 · 증빙 · 평가일/평가자
    change       이력                         before → after · 근거 · 누가 · 언제

⚠️⚠️ **연계이 일급이다.** 로드맵 정보처럼 JSON 배열에 연결을 넣으면 연결을 고칠 때마다
   배열이 통째로 갈리고 평가가 사라진다. 연계에 id 가 있어야 URL(?pair=) 도 생긴다.

⚠️ **축마다 한 줄.** 여섯 컬럼이 아니다. 셋만 매긴 상태가 자연스럽고, 축마다
   평가일이 따로 남고, 축을 더 붙여도 표가 안 바뀐다.

⚠️ **파생값은 저장하지 않는다.** 항목 정확도(평균)·적용 범위 비율·재평가 필요·분포는
   매번 센다. 저장하면 원본이 바뀐 뒤에도 재평가 필요한 값이 남는다(전략 모듈과 같은 규칙).

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
    # 제조 모니터링의 대상은 **라인 × 공정 단계**다(f2c8d6b39e14). 다른 부문은 비어 있다.
    # 공정은 표준 어휘(definitions.PROCESS_STEPS)의 key 지만 없는 것은 직접 적는다 — FK 가 아니다.
    line = db.Column(db.String(200))
    process = db.Column(db.String(60))
    order = db.Column(db.Integer, nullable=False, default=0)

    pairs = db.relationship('MaturityPair', backref='subject',
                            cascade='all, delete-orphan', passive_deletes=True)

    def to_dict(self):
        d = super().to_dict()
        d['product_families'] = list(self.product_families or [])
        from .definitions import vocab_labels
        d['process_label'] = vocab_labels('process_steps').get(self.process, self.process)
        return d


def _projects_of(uuids):
    """대시보드 과제 uuid → 화면에 보일 만큼(코드·이름·상태·연도). 없어진 과제는 이름 없이 남긴다."""
    if not uuids:
        return []
    try:
        from app.modules.digital_twin_dashboard.models_v2 import Dt2Project
        rows = {p.uuid: p for p in Dt2Project.query.filter(Dt2Project.uuid.in_(list(uuids))).all()}
    except Exception:
        rows = {}
    out = []
    for u in uuids:
        p = rows.get(u)
        out.append({'uuid': u, 'code': p.code if p else None, 'title': p.title if p else None,
                    'status': p.status if p else None, 'year': p.year if p else None,
                    'division': p.division if p else None, 'missing': p is None})
    return out


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
    # 이 시뮬레이션이 다루는 불량 유형 — 도구처럼 인스턴스 목록(예: 크랙, 변색). 자유 텍스트.
    # 모델링 수준의 현상 태그(평가 증빙)와는 다르다 — 이것은 시뮬레이션의 속성이다. (f6c4e8a20d53)
    defect_types = db.Column(db.JSON, default=list)
    # 담당 부서 — 포탈의 부서 표(departments)에서 고른다. 그 시뮬레이션의 사업부에 속한 부서만.
    # FK 는 아니다(부서 표가 정리돼도 여기가 안 깨지게). 이름은 읽을 때 붙인다.
    department_id = db.Column(db.Integer, index=True)
    project_uuid = db.Column(db.String(64), index=True)   # 옛 칸 하나 — 엑셀 들여오기가 아직 쓴다. FK 아님
    # 수행 디지털 트윈 과제 — 대시보드(dt2_projects)의 uuid 들. 여럿을 매단다(e1b9c7a25d08).
    # FK 는 아니다. 저쪽 표가 갈려도 여기가 안 깨지게 uuid 만 든다(department_id 와 같은 결).
    project_uuids = db.Column(db.JSON, default=list)

    pairs = db.relationship('MaturityPair', backref='agent',
                            cascade='all, delete-orphan', passive_deletes=True)

    def to_dict(self):
        d = super().to_dict()
        d['tools'] = list(self.tools or [])
        d['defect_types'] = list(self.defect_types or [])
        d['project_uuids'] = list(self.project_uuids or ([self.project_uuid] if self.project_uuid else []))
        d['projects'] = _projects_of(d['project_uuids'])          # 이름·코드·상태는 읽을 때 붙인다
        d['department_name'] = None
        if self.department_id:
            try:
                from app.modules.digital_twin_dashboard.models import Department
                dep = Department.query.get(self.department_id)
                d['department_name'] = dep.name if dep else None
            except Exception:
                d['department_name'] = None
        return d


class MaturityPair(BaseModel):
    """대상 × 수단. 디지털 스레드처럼 수단 없는 부문은 agent_id 가 비어 있다.

    ⚠️ (subject_id, agent_id) 유일 제약은 agent_id 가 NULL 이면 안 잡는다(SQL 의 NULL).
       수단 없는 연계이 한 대상에 둘 생기지 않게 하는 것은 services.create_pair 가 한다.
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
    """연계 × 축 한 줄. rung 축은 rung 만, value 축은 value 만 쓴다(칸은 값에서 환산)."""
    __tablename__ = 'dt_maturity_assessment'
    __table_args__ = (
        db.UniqueConstraint('pair_id', 'axis', name='uq_dt_maturity_assessment'),
    )

    pair_id = db.Column(db.Integer, db.ForeignKey('dt_maturity_pair.id', ondelete='CASCADE'),
                        nullable=False, index=True)
    axis = db.Column(db.String(40), nullable=False)
    rung = db.Column(db.String(120))     # set 축은 선택한 항목들을 쉼표로 쌓는다(e5b3d7f19c42)
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
    """무엇이 언제 왜 바뀌었나. 척도의 「이 칸에 언제 올라왔나」가 여기서 나온다."""
    __tablename__ = 'dt_maturity_change'

    pair_id = db.Column(db.Integer, db.ForeignKey('dt_maturity_pair.id', ondelete='CASCADE'),
                        nullable=False, index=True)
    axis = db.Column(db.String(40), nullable=False)
    before = db.Column(db.String(120))
    after = db.Column(db.String(120))
    note = db.Column(db.Text)
    actor_user_id = db.Column(db.Integer)
    actor_name = db.Column(db.String(100))


class MaturityReviewCase(BaseModel):
    """해석 활용 기록의 한 줄 — 시험과 짝이 없는 스팟성 시뮬레이션 한 건(2026-08-28, a7d5f3c81e64).

    연계·평가와는 표가 다르다: 저쪽은 상태(갱신·이력), 여기는 사건(누적). 연간으로 센다.
    """
    __tablename__ = 'dt_maturity_review_case'

    division_id = db.Column(db.Integer, nullable=False, index=True)
    kind = db.Column(db.String(20), nullable=False)            # spec | cause
    month = db.Column(db.Date, nullable=False, index=True)      # 그 달 1일
    target = db.Column(db.String(300))                          # 제품·과제
    item = db.Column(db.String(300))                            # 스펙 항목 / 불량 유형
    agent_id = db.Column(db.Integer, index=True)                # 시뮬레이션 관리의 것 — FK 아님
    agent_name = db.Column(db.String(300))
    timing = db.Column(db.String(20))
    decision = db.Column(db.String(20))
    basis = db.Column(db.String(20))
    lead_days = db.Column(db.Float)
    note = db.Column(db.Text)
    # 이 건이 상시 항목으로 올라갔다면 그 연계 — ⚠️ FK 가 아니다(연계를 지워도 기록은 남는다).
    #    이름으로 뒤를 밟으면 올릴 때 이름을 고치는 순간 끊긴다(2026-08-30).
    promoted_pair_id = db.Column(db.Integer, index=True)
    actor_user_id = db.Column(db.Integer)
    actor_name = db.Column(db.String(100))

    def to_dict(self):
        d = super().to_dict()
        d['month'] = self.month.isoformat() if self.month else None
        return d


# ── 디지털 스레드 부문(2026-08-28, b8e6f4d92a75) ─────────────────────────────

class ThreadDef(BaseModel):
    """스레드 사전(전사) — 제품 생애를 따라 한 데이터가 이어지는 줄. 사무국이 고친다."""
    __tablename__ = 'dt_thread_def'
    key = db.Column(db.String(60), nullable=False, unique=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    axes_off = db.Column(db.JSON, default=list)             # 이 스레드에서 안 쓰는 축
    order = db.Column(db.Integer, nullable=False, default=0)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    segment_defs = db.relationship('ThreadSegmentDef', backref='thread', cascade='all, delete-orphan', passive_deletes=True)

    def to_dict(self):
        d = super().to_dict()
        d['axes_off'] = list(self.axes_off or [])
        return d


class ThreadSegmentDef(BaseModel):
    """표준 구간 — 스레드 위에서 데이터가 한 단계를 건너는 자리(from_stage → to_stage)."""
    __tablename__ = 'dt_thread_segment_def'
    thread_id = db.Column(db.Integer, db.ForeignKey('dt_thread_def.id', ondelete='CASCADE'), nullable=False, index=True)
    key = db.Column(db.String(60), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    from_stage = db.Column(db.String(30), nullable=False)
    to_stage = db.Column(db.String(30), nullable=False)
    order = db.Column(db.Integer, nullable=False, default=0)
    data_kinds = db.Column(db.JSON, default=list)           # 이 구간으로 흐르는 것의 기본값

    def to_dict(self):
        d = super().to_dict()
        d['data_kinds'] = list(self.data_kinds or [])
        return d


class ThreadSystem(BaseModel):
    """시스템 사전(전사 하나) — 스레드 주체가 자기 구간을 적으며 채운다. 「비시스템 매개」(메일·엑셀…)도 한 종류."""
    __tablename__ = 'dt_thread_system'
    name = db.Column(db.String(200), nullable=False, unique=True)
    kind = db.Column(db.String(30), nullable=False)
    owner_org = db.Column(db.String(200))
    stages = db.Column(db.JSON, default=list)
    link_means = db.Column(db.String(20), nullable=False, default='unknown')
    status = db.Column(db.String(20), nullable=False, default='active')
    created_division_id = db.Column(db.Integer)
    note = db.Column(db.Text)

    def to_dict(self):
        d = super().to_dict()
        d['stages'] = list(self.stages or [])
        return d


class ThreadOrg(BaseModel):
    """조직 사전 — 포탈 부서·프로세스 노드를 참조하거나 손으로. 구간의 출발·도착이 이것을 가리킨다."""
    __tablename__ = 'dt_thread_org'
    name = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(30))
    division_id = db.Column(db.Integer, index=True)
    source_kind = db.Column(db.String(20), nullable=False, default='manual')
    source_id = db.Column(db.String(100))
    note = db.Column(db.Text)


class ThreadSegment(BaseModel):
    """사업부 구간 — 대상(sector digital_thread) 하나에 붙는 속성. 평가·이력은 대상의 연계에 있다."""
    __tablename__ = 'dt_thread_segment'
    subject_id = db.Column(db.Integer, db.ForeignKey('dt_maturity_subject.id', ondelete='CASCADE'), nullable=False, unique=True)
    division_id = db.Column(db.Integer, nullable=False, index=True)
    thread_id = db.Column(db.Integer, db.ForeignKey('dt_thread_def.id', ondelete='SET NULL'), index=True)
    segment_def_id = db.Column(db.Integer, db.ForeignKey('dt_thread_segment_def.id', ondelete='SET NULL'))
    from_org_id = db.Column(db.Integer)
    from_system_id = db.Column(db.Integer)
    via_system_id = db.Column(db.Integer)
    to_org_id = db.Column(db.Integer)
    to_system_id = db.Column(db.Integer)
    data_kinds = db.Column(db.JSON, default=list)           # 무엇이 흐르나 — 표준 어휘 key 또는 직접 적은 글
    note = db.Column(db.Text)
    subject = db.relationship('MaturitySubject', backref=db.backref('thread_segment', uselist=False, cascade='all, delete-orphan', passive_deletes=True))
    thread = db.relationship('ThreadDef')
    segment_def = db.relationship('ThreadSegmentDef')


class ThreadCase(BaseModel):
    """연계 개발 기록의 한 줄 — 연동·도입·정합화·자동화·폐지 건(2026-08-28, c9f7a5e03b86).

    끝나면 그 구간의 연결 방식이 전 → 후로 몇 칸 올라갔는지를 같이 적는다 — 계획과 상태가 이어진다.
    """
    __tablename__ = 'dt_thread_case'
    division_id = db.Column(db.Integer, nullable=False, index=True)
    month = db.Column(db.Date, nullable=False, index=True)
    action = db.Column(db.String(20), nullable=False)
    thread_id = db.Column(db.Integer, db.ForeignKey('dt_thread_def.id', ondelete='SET NULL'))
    segment_id = db.Column(db.Integer, db.ForeignKey('dt_thread_segment.id', ondelete='SET NULL'))
    system_id = db.Column(db.Integer)
    system_name = db.Column(db.String(200))
    org_id = db.Column(db.Integer)
    link_from = db.Column(db.String(30))
    link_to = db.Column(db.String(30))
    status = db.Column(db.String(20), nullable=False, default='done')
    note = db.Column(db.Text)
    actor_user_id = db.Column(db.Integer)
    actor_name = db.Column(db.String(100))
    thread = db.relationship('ThreadDef')
    segment = db.relationship('ThreadSegment')

    def to_dict(self):
        d = super().to_dict()
        d['month'] = self.month.isoformat() if self.month else None
        return d
