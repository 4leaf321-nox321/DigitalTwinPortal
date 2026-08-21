"""
Digital Twin Investment Models
"""
from sqlalchemy.dialects.postgresql import JSONB

from app.extensions import db
from app.shared.models import BaseModel
from app.shared.timeutil import iso_kst


class Investment(BaseModel):
    """디지털 트윈 투자 건 하나."""
    __tablename__ = 'dt_investments'

    name = db.Column(db.String(500), nullable=False)     # 투자명
    # 사업부·프로세스·투자부서는 디지털 트윈 대시보드의 설정(divisions /
    # process_categories / departments)에서 고른다. 다만 **이름을 그대로 담는다** —
    # 대시보드 쪽 id 를 참조하면 그 모듈의 설정을 지웠을 때 여기 값이 같이 무너진다.
    division = db.Column(db.String(100))                 # 사업부
    process = db.Column(db.String(100))                  # 프로세스 (개발/제조 등)
    department = db.Column(db.String(200))               # 투자부서
    year = db.Column(db.Integer)                         # 투자년도
    # 계획/실적 모두 단위는 **억원**이다. 소수점을 쓰므로 Float 이다.
    plan_amount = db.Column(db.Float, default=0)         # 계획값 (억원)
    actual_amount = db.Column(db.Float, default=0)       # 실적값 (억원)
    category1 = db.Column(db.String(50))                 # 투자 유형 (H/W, S/W, 플랫폼)
    category2 = db.Column(db.String(100))                # 디지털 트윈 영역 (설정에서 늘린다)
    order = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'division': self.division,
            'process': self.process,
            'department': self.department,
            'year': self.year,
            'planAmount': self.plan_amount or 0,
            'actualAmount': self.actual_amount or 0,
            'category1': self.category1,
            'category2': self.category2,
            'order': self.order,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }


class InvestmentChange(BaseModel):
    """
    투자 건의 변경 이력. **추가만 하고 고치거나 지우지 않는다(append-only).**

    왜 필요한가
        dt_investments 는 '지금 값' 만 들고 있다. 고치면 이전 값이, 지우면 건 자체가
        사라져 무엇이 있었는지 되짚을 방법이 없었다. 금액을 다루는 표라 특히
        '누가 언제 얼마에서 얼마로 바꿨나' 를 남겨야 한다.

    한 행이 무엇을 담나
        update : **바뀐 필드마다 한 행.** field/before/after 가 찬다.
        create : 한 행. snapshot 에 등록 시점의 전체 값.
        delete : 한 행. snapshot 에 지우기 **직전** 의 전체 값.

    왜 FK 를 걸지 않나
        투자 건이 지워져도 이력은 남아야 한다. CASCADE 면 같이 지워지고
        RESTRICT 면 삭제가 막힌다 — 둘 다 원하는 게 아니다.
        (대시보드의 dt2_project_changes 도 같은 이유로 FK 를 걸지 않는다)

    field 는 왜 화면 키(camelCase)인가
        이 모듈의 열 이름표 정본은 프론트의 constants.js(COLUMNS) 다. 서버에 한글
        이름표를 또 두면 사본이 둘로 갈린다. 그래서 화면이 그대로 알아볼 수 있는
        키를 담고, 이름표는 화면이 붙인다.
    """
    __tablename__ = 'dt_investment_changes'

    investment_id = db.Column(db.Integer, nullable=False, index=True)
    action = db.Column(db.String(20), nullable=False, index=True)   # create | update | delete

    field = db.Column(db.String(50))          # update 일 때만
    before_value = db.Column(JSONB)
    after_value = db.Column(JSONB)
    snapshot = db.Column(JSONB)               # create / delete 시점의 전체 값

    # 지워진 뒤에도 목록에 무엇이었는지 보여야 한다. 스냅샷에서 꺼내 쓸 수도 있지만
    # 목록 정렬·검색에 쓰려면 컬럼으로 있어야 편하다.
    investment_name = db.Column(db.String(500))

    actor_user_id = db.Column(db.Integer, index=True)
    source = db.Column(db.String(20), nullable=False, default='ui', server_default='ui')

    # delete 행에만 찬다. 이 삭제를 되살려 만든 새 투자 건의 id.
    # 값이 있으면 그 삭제는 이미 되살린 것이라 다시 되살리지 못하게 막는다
    # (버튼을 두 번 누르면 사본이 둘 생기는데, 그건 되살리기가 아니라 사고다).
    restored_investment_id = db.Column(db.Integer)

    __table_args__ = (
        # 한 건의 이력을 시간 차례로 훑는 질의가 이 인덱스를 탄다
        db.Index('ix_dt_inv_chg_investment_created', 'investment_id', 'created_at'),
    )

    def to_dict(self, actor_name=None):
        return {
            'id': self.id,
            'investmentId': self.investment_id,
            'investmentName': self.investment_name,
            'action': self.action,
            'field': self.field,
            'before': self.before_value,
            'after': self.after_value,
            'snapshot': self.snapshot,
            'actor': actor_name,
            'actorUserId': self.actor_user_id,
            'source': self.source,
            'restoredInvestmentId': self.restored_investment_id,
            'changedAt': iso_kst(self.created_at) if self.created_at else None,
        }
