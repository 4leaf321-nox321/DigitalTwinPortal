"""Add KPI records and targets tables

Revision ID: 79ab24168859
Revises: b7fbe3bc113d
Create Date: 2026-03-26 19:47:05.188783

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '79ab24168859'
down_revision = 'b7fbe3bc113d'
branch_labels = None
depends_on = None


def upgrade():
    # 중복 마이그레이션: b7fbe3bc113d에서 이미 kpi_records, kpi_targets 생성됨
    pass


def downgrade():
    pass
