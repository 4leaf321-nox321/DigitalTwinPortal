"""
Dev Manufacturing Process Models
프로세스 다이어그램 데이터 저장 모델
"""
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSON
from app.extensions import db
from app.shared.models import BaseModel
from app.shared.timeutil import iso_kst


class ProcessDiagramData(BaseModel):
    """
    프로세스 다이어그램 저장 테이블
    - 노드, 엣지, 뷰포트 등을 JSON으로 저장
    """
    __tablename__ = 'process_diagram_data'

    name = db.Column(db.String(200), nullable=False)  # 저장 이름
    description = db.Column(db.Text)  # 설명

    # 다이어그램 데이터
    nodes = db.Column(JSON, nullable=False, default=list)  # 노드 목록
    edges = db.Column(JSON, nullable=False, default=list)  # 엣지 목록
    viewport = db.Column(JSON, nullable=False, default=dict)  # 뷰포트 정보 (x, y, zoom)

    # 메타데이터
    diagram_metadata = db.Column(JSON, nullable=False, default=dict)  # 추가 메타데이터

    # 사용자 및 공개 설정
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    is_public = db.Column(db.Boolean, default=False)

    # 생성/수정자 정보
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_by_name = db.Column(db.String(100))
    updated_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    updated_by_name = db.Column(db.String(100))

    # Relationships
    creator = db.relationship('User', foreign_keys=[created_by])
    updater = db.relationship('User', foreign_keys=[updated_by])
    owner = db.relationship('User', foreign_keys=[user_id])

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'nodes': self.nodes,
            'edges': self.edges,
            'viewport': self.viewport,
            'metadata': self.diagram_metadata,
            'user_id': self.user_id,
            'is_public': self.is_public,
            'created_by': self.created_by,
            'created_by_name': self.created_by_name,
            'updated_by': self.updated_by,
            'updated_by_name': self.updated_by_name,
            'created_at': iso_kst(self.created_at) if self.created_at else None,
            'updated_at': iso_kst(self.updated_at) if self.updated_at else None
        }

    def to_list_dict(self):
        """목록 조회용 간략 정보"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'node_count': len(self.nodes) if self.nodes else 0,
            'edge_count': len(self.edges) if self.edges else 0,
            'user_id': self.user_id,
            'is_public': self.is_public,
            'created_by_name': self.created_by_name,
            'updated_by_name': self.updated_by_name,
            'created_at': iso_kst(self.created_at) if self.created_at else None,
            'updated_at': iso_kst(self.updated_at) if self.updated_at else None
        }

    def __repr__(self):
        return f'<ProcessDiagramData {self.name}>'
