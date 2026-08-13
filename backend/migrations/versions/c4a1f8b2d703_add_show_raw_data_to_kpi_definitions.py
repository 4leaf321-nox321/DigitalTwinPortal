"""Add show_raw_data column to kpi_definitions

Revision ID: c4a1f8b2d703
Revises: b8d2f3a51e90
Create Date: 2026-04-28 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'c4a1f8b2d703'
down_revision = 'b8d2f3a51e90'
branch_labels = None
depends_on = None


def upgrade():
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)

    if 'kpi_definitions' not in inspector.get_table_names():
        return

    existing_cols = [c['name'] for c in inspector.get_columns('kpi_definitions')]
    if 'show_raw_data' in existing_cols:
        return

    # 기본값 True: 기존 fraction 항목들은 분자/분모 원본 표기를 유지
    op.add_column(
        'kpi_definitions',
        sa.Column('show_raw_data', sa.Boolean(), nullable=False, server_default=sa.true())
    )


def downgrade():
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)

    if 'kpi_definitions' not in inspector.get_table_names():
        return

    existing_cols = [c['name'] for c in inspector.get_columns('kpi_definitions')]
    if 'show_raw_data' not in existing_cols:
        return

    op.drop_column('kpi_definitions', 'show_raw_data')
