"""
Digital Twin Tech Level Models
디지털 트윈 메가 과제 현황 데이터 저장 모델
"""
from datetime import datetime, timezone, timedelta
from sqlalchemy.dialects.postgresql import JSON
from app.extensions import db
from app.shared.models import BaseModel
from app.shared.timeutil import iso_kst

# 한국 시간대 (UTC+9)
KST = timezone(timedelta(hours=9))


class TechLevelData(BaseModel):
    """
    디지털 트윈 메가 과제 현황 저장 테이블
    - 메가 과제, 구성 요소, 설정 등을 JSON으로 저장
    """
    __tablename__ = 'tech_level_data'

    name = db.Column(db.String(200), nullable=False)  # 저장 이름
    description = db.Column(db.Text)  # 설명

    # 메가 과제 데이터
    goals = db.Column(JSON, nullable=False, default=list)  # 메가 과제 목록
    components = db.Column(JSON, nullable=False, default=list)  # 구성 요소 목록

    # 설정 데이터
    level_options = db.Column(JSON, nullable=False, default=list)  # 수준 옵션
    category_options = db.Column(JSON, nullable=False, default=list)  # 카테고리 옵션
    business_unit_options = db.Column(JSON, nullable=False, default=list)  # 사업부 옵션
    tech_type_options = db.Column(JSON, nullable=False, default=list)  # 기술 구분 옵션
    graph_heights = db.Column(JSON, nullable=True, default=dict)  # 카드 뷰 그래프 높이 설정
    card_graph_zoom_pan = db.Column(JSON, nullable=True, default=dict)  # 카드 뷰 그래프 줌/팬 상태
    graph_view_state = db.Column(JSON, nullable=True, default=dict)  # 그래프 뷰 상태 (zoom, pan)

    # 메타데이터
    data_metadata = db.Column(JSON, nullable=False, default=dict)  # 추가 메타데이터

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

    def _to_kst(self, dt):
        """UTC datetime을 한국 시간으로 변환 (규칙은 shared/timeutil 한 곳에)"""
        return iso_kst(dt)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'goals': self.goals,
            'components': self.components,
            'level_options': self.level_options,
            'category_options': self.category_options,
            'business_unit_options': self.business_unit_options,
            'tech_type_options': self.tech_type_options,
            'graph_heights': self.graph_heights,
            'card_graph_zoom_pan': self.card_graph_zoom_pan,
            'graph_view_state': self.graph_view_state,
            'metadata': self.data_metadata,
            'user_id': self.user_id,
            'is_public': self.is_public,
            'created_by': self.created_by,
            'created_by_name': self.created_by_name,
            'updated_by': self.updated_by,
            'updated_by_name': self.updated_by_name,
            'created_at': self._to_kst(self.created_at),
            'updated_at': self._to_kst(self.updated_at)
        }

    def to_list_dict(self):
        """목록 조회용 간략 정보"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'goal_count': len(self.goals) if self.goals else 0,
            'component_count': len(self.components) if self.components else 0,
            'user_id': self.user_id,
            'is_public': self.is_public,
            'created_by_name': self.created_by_name,
            'updated_by_name': self.updated_by_name,
            'created_at': self._to_kst(self.created_at),
            'updated_at': self._to_kst(self.updated_at)
        }

    def __repr__(self):
        return f'<TechLevelData {self.name}>'
