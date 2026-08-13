"""
Digital Twin Reference Models
"""
from app.extensions import db
from app.shared.models import BaseModel
from app.shared.timeutil import iso_kst


class DtReferenceTask(BaseModel):
    """개발 디지털 트윈 로드맵 정보 과제"""
    __tablename__ = 'dt_reference_tasks'

    name = db.Column(db.String(500), nullable=False)
    division_id = db.Column(db.String(50))
    test_item = db.Column(db.String(500))
    test_item_detail = db.Column(db.String(500))
    category = db.Column(db.String(100))
    product_family = db.Column(db.JSON, default=list)
    year = db.Column(db.String(20))
    status = db.Column(db.String(100))
    connected_dt_task = db.Column(db.JSON, default=list)
    description = db.Column(db.Text)
    order = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'divisionId': self.division_id,
            'testItem': self.test_item,
            'testItemDetail': self.test_item_detail,
            'category': self.category,
            'productFamily': self.product_family or [],
            'year': self.year,
            'status': self.status,
            'connectedDtTask': self.connected_dt_task or [],
            'description': self.description,
            'order': self.order,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }
