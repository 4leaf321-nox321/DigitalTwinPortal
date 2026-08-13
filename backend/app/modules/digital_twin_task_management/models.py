"""
Digital Twin Task Management Models
- 과제 데이터를 JSON으로 저장하며 버전 관리(Optimistic Locking)로 동시 수정 충돌 방지
"""
from app.extensions import db
from app.shared.models import BaseModel
from sqlalchemy.dialects.postgresql import JSON
from app.shared.timeutil import iso_kst


class TaskManagementData(BaseModel):
    """
    과제 관리 메인 데이터 테이블
    - 과제 목록을 JSON으로 저장
    - 버전 관리로 동시 수정 충돌 방지 (Optimistic Locking)
    """
    __tablename__ = 'task_management_data'

    version = db.Column(db.Integer, nullable=False, default=1)
    tasks = db.Column(JSON, nullable=False, default=list)
    data_metadata = db.Column(JSON, nullable=False, default=dict)

    last_modified_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    last_modified_by_name = db.Column(db.String(100))

    modifier = db.relationship('User', foreign_keys=[last_modified_by])

    def to_dict(self):
        return {
            'id': self.id,
            'version': self.version,
            'tasks': self.tasks,
            'metadata': self.data_metadata,
            'last_modified_by': self.last_modified_by,
            'last_modified_by_name': self.last_modified_by_name,
            'created_at': iso_kst(self.created_at) if self.created_at else None,
            'updated_at': iso_kst(self.updated_at) if self.updated_at else None,
        }

    def __repr__(self):
        return f'<TaskManagementData v{self.version}>'
