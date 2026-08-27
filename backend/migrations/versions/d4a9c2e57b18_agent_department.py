"""시뮬레이션(수단)에 담당 부서 — 포탈 부서 표에서 고른다

그 시뮬레이션의 사업부에 속한 활성 부서만 고를 수 있다(services 가 검사). FK 는 아니다 —
부서 표가 정리돼도 여기가 안 깨진다. 이름은 읽을 때 붙인다.

Revision ID: d4a9c2e57b18
Revises: c3f8a1d47b26
"""
import sqlalchemy as sa
from alembic import op

revision = 'd4a9c2e57b18'
down_revision = 'c3f8a1d47b26'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('dt_maturity_agent', sa.Column('department_id', sa.Integer(), nullable=True))
    op.create_index('ix_dt_maturity_agent_department_id', 'dt_maturity_agent', ['department_id'])


def downgrade():
    op.drop_index('ix_dt_maturity_agent_department_id', table_name='dt_maturity_agent')
    op.drop_column('dt_maturity_agent', 'department_id')
