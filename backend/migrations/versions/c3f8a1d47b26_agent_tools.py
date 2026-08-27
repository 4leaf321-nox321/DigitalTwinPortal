"""시뮬레이션(수단)에 도구 목록 — 인스턴스로

시뮬레이션 하나에 쓰는 도구 여럿(예: LS-DYNA, HyperMesh)을 이름 목록으로 든다.
인텔의 도구 표와 FK 로 묶지 않는다 — 참고일 뿐이고, 저쪽이 바뀌어도 여기가 안 깨진다.

Revision ID: c3f8a1d47b26
Revises: b7e4d2c91a05
"""
import sqlalchemy as sa
from alembic import op

revision = 'c3f8a1d47b26'
down_revision = 'b7e4d2c91a05'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('dt_maturity_agent', sa.Column('tools', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('dt_maturity_agent', 'tools')
