"""구간에 「데이터 종류」— 이 구간으로 무엇이 흐르나(요구사항·형상·해석 결과·BOM·시험 결과·불량·원가…)

매기는 축이 아니라 구간의 속성이다. 표준 어휘(definitions.DATA_KINDS)에서 여럿 고르고, 없으면
직접 적는다. 표준 구간 정의에도 기본값이 있어 고르면 채워진다.

Revision ID: d0a8b6f14c97
Revises: c9f7a5e03b86
"""
import sqlalchemy as sa
from alembic import op

revision = 'd0a8b6f14c97'
down_revision = 'c9f7a5e03b86'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('dt_thread_segment', sa.Column('data_kinds', sa.JSON(), nullable=True))
    op.add_column('dt_thread_segment_def', sa.Column('data_kinds', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('dt_thread_segment_def', 'data_kinds')
    op.drop_column('dt_thread_segment', 'data_kinds')
