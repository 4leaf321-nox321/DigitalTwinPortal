"""
Survey Models — 포탈 공용 설문.

계획서: frontend/src/modules/digital-twin-strategy/SURVEY_PLAN.md

── 이 모듈은 무엇에도 의존하지 않는다 ──────────────────────────────────────
설문은 전략 기획의 부품이 아니라 **포탈의 공용 기능**이다. 그래서 이 모듈은
전략 모듈을 import 하지 않고, 전략의 표에 FK 도 걸지 않는다. 대신 어디에서
쓰이는 설문인지를 **불투명한 두 칸**으로만 들고 있는다.

    context_type / context_id     이 설문이 매달린 것 (예: 'strategy_plan', 12)
    question.link_type / link_key 이 문항이 무엇에 연결되는가
                                  (예: 'strategy_dimension', 'organization:readiness')

이 값들의 **뜻은 쓰는 쪽이 안다.** 설문 모듈은 문자열로 보관하고 그대로 돌려줄
뿐이다. 그래야 나중에 전략 말고 다른 데서 설문을 써도 이 모듈을 안 고친다.

── 이름에 대하여 (2026-08-15) ──────────────────────────────────────────────
협업 게시판에 같은 이름의 모델이 있었고, 그것을 걷어내고 이 모듈이 자리를
가져왔다. **같은 declarative base 에 같은 클래스 이름이 둘이면 매퍼 설정이
실패해 모든 DB 질의가 죽는다** — 실제로 v0.1.22 가 그 상태로 릴리스됐다.
`backend/scripts/check_models.py` 가 CI 에서 그것을 막는다.
"""
from app.extensions import db
from app.shared.models import BaseModel
from sqlalchemy.dialects.postgresql import JSON


class Survey(BaseModel):
    """설문 한 벌."""
    __tablename__ = 'surveys'

    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)

    # 어디에 매달린 설문인가. 둘 다 비어 있어도 된다 — 아무 데도 안 매단
    # 독립 설문이 가능해야 이 모듈이 전략에 종속되지 않는다.
    context_type = db.Column(db.String(40), index=True)   # 'strategy_plan' 등
    context_id = db.Column(db.Integer, index=True)
    # 쓰는 쪽이 자기 사정으로 나누는 값. 설문 모듈은 해석하지 않는다.
    context_tag = db.Column(db.String(40))                # 전략의 단계 등

    # 누구에게 묻는가. all: 전사 / department: 부서 / role: 역할 / user: 지정 인원
    target_type = db.Column(db.String(20), nullable=False, default='all')
    target_refs = db.Column(JSON, nullable=False, default=list)

    # draft: 작성 중(응답 못 받음) / open: 응답 받는 중 / closed: 마감
    status = db.Column(db.String(20), nullable=False, default='draft')
    closes_at = db.Column(db.DateTime, nullable=True)
    created_by = db.Column(db.Integer, nullable=True)

    questions = db.relationship(
        'SurveyQuestion', backref='survey', lazy='dynamic',
        cascade='all, delete-orphan', order_by='SurveyQuestion.order'
    )
    responses = db.relationship(
        'SurveyResponse', backref='survey', lazy='dynamic',
        cascade='all, delete-orphan'
    )


class SurveyQuestion(BaseModel):
    """문항 하나."""
    __tablename__ = 'survey_questions'

    survey_id = db.Column(
        db.Integer, db.ForeignKey('surveys.id', ondelete='CASCADE'),
        nullable=False, index=True
    )
    order = db.Column(db.Integer, nullable=False, default=0)
    text = db.Column(db.String(500), nullable=False)
    help_text = db.Column(db.Text)

    # scale: 1~5 척도 / choice: 객관식 / rank: 순위 / text: 자유서술
    qtype = db.Column(db.String(20), nullable=False, default='scale')
    required = db.Column(db.Boolean, nullable=False, default=True)
    # 유형별 부가 정의(보기 목록, 척도 양끝 이름 등).
    options = db.Column(JSON, nullable=False, default=dict)

    # 이 문항이 무엇에 연결되는가. 설문 모듈은 뜻을 모른다 — 문자열로 보관하고
    # 그대로 돌려준다. 전략 모듈이 이걸 읽어 진단 축에 꽂는다.
    link_type = db.Column(db.String(40))   # 'strategy_dimension' 등
    link_key = db.Column(db.String(80))    # 'organization:readiness' 등


class SurveyResponse(BaseModel):
    """한 사람의 응답 한 벌.

    user_id 를 남기는 이유는 두 가지다. **중복 응답을 막고**, 고지한 대로
    관리자가 확인할 수 있게 하기 위해서다. 일반 열람에는 절대 실리지 않는다 —
    그 판단은 라우트가 아니라 직렬화 함수 한 곳에서 한다.

    소속을 응답 시점에 **복사해 둔다.** 나중에 조직이 바뀌어도 "그때 이
    부서가 이렇게 답했다"가 남아야 집계가 검증된다.
    """
    __tablename__ = 'survey_responses'

    survey_id = db.Column(
        db.Integer, db.ForeignKey('surveys.id', ondelete='CASCADE'),
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
        'SurveyAnswer', backref='response', lazy='dynamic',
        cascade='all, delete-orphan'
    )

    __table_args__ = (
        # 한 사람이 한 설문에 한 번. 여러 벌 받으면 집계가 기울어진다.
        db.UniqueConstraint('survey_id', 'user_id', name='uq_survey_response_user'),
    )


class SurveyAnswer(BaseModel):
    """문항 하나에 대한 답.

    유형마다 담기는 칸이 다르다. 한 칸에 전부 문자열로 밀어넣으면 집계할 때
    매번 파싱해야 하고, 숫자가 아닌 값이 섞여도 모른다.
    """
    __tablename__ = 'survey_answers'

    response_id = db.Column(
        db.Integer, db.ForeignKey('survey_responses.id', ondelete='CASCADE'),
        nullable=False, index=True
    )
    question_id = db.Column(
        db.Integer, db.ForeignKey('survey_questions.id', ondelete='CASCADE'),
        nullable=False, index=True
    )

    value_number = db.Column(db.Float, nullable=True)   # scale
    value_text = db.Column(db.Text, nullable=True)      # text
    value_json = db.Column(JSON, nullable=True)         # choice(다중) · rank

    __table_args__ = (
        db.UniqueConstraint('response_id', 'question_id',
                            name='uq_survey_answer_response_question'),
    )


class SurveyAccessLog(BaseModel):
    """관리자가 응답자를 확인한 기록.

    "관리자는 확인할 수 있습니다"라고 고지하는 이상, 실제로 누가 언제 봤는지
    남아야 그 고지가 말뿐이 아니게 된다. 남기지 않으면 고지는 면피 문구다.
    """
    __tablename__ = 'survey_access_logs'

    survey_id = db.Column(
        db.Integer, db.ForeignKey('surveys.id', ondelete='CASCADE'),
        nullable=False, index=True
    )
    viewer_id = db.Column(db.Integer, nullable=False, index=True)
    response_id = db.Column(db.Integer, nullable=True)
    action = db.Column(db.String(30), nullable=False)   # list_identities | view_identity
