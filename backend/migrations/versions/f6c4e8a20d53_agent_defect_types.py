"""시뮬레이션(수단)에 불량 유형 — 도구처럼 인스턴스 목록

이 시뮬레이션이 다루는 불량 유형(예: 크랙, 변색, 접점 마모)을 이름으로 든다. 자유 텍스트,
FK 없음. 모델링 수준의 현상 태그와는 다르다 — 그쪽은 「재현되는 현상」의 평가 증빙이고,
이쪽은 시뮬레이션의 속성이다.

Revision ID: f6c4e8a20d53
Revises: e5b3d7f19c42
"""
import sqlalchemy as sa
from alembic import op

revision = 'f6c4e8a20d53'
down_revision = 'e5b3d7f19c42'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('dt_maturity_agent', sa.Column('defect_types', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('dt_maturity_agent', 'defect_types')
