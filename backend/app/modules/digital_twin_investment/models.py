"""
Digital Twin Investment Models
"""
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
