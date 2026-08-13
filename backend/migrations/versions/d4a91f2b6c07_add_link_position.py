"""add dt2_project_performance.position (원본 배열 순서 보존)

V1 응답 대조에서 `성과목록` 원소 순서가 뒤바뀌는 것이 드러났다.
조회 순서대로 담아 원본 배열 위치를 잃었기 때문이다.

기존 컬럼을 바꾸지 않고 nullable 컬럼 하나만 추가한다.
값은 재이관에서 채워진다 (기존 행은 NULL 로 남아도 동작에 지장 없음).

Revision ID: d4a91f2b6c07
Revises: c1e05b7d33a9
Create Date: 2026-07-29

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd4a91f2b6c07'
down_revision = 'c1e05b7d33a9'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('dt2_project_performance',
                  sa.Column('position', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('dt2_project_performance', 'position')
