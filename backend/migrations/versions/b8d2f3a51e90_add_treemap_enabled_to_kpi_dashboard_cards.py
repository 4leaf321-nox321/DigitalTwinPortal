"""Add treemap_enabled column to kpi_dashboard_cards

Revision ID: b8d2f3a51e90
Revises: a7c5b9e21d80
Create Date: 2026-04-28 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'b8d2f3a51e90'
down_revision = 'a7c5b9e21d80'
branch_labels = None
depends_on = None


def upgrade():
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)

    if 'kpi_dashboard_cards' not in inspector.get_table_names():
        return

    existing_cols = [c['name'] for c in inspector.get_columns('kpi_dashboard_cards')]
    if 'treemap_enabled' in existing_cols:
        return

    # 기본값 True로 컬럼 추가 (기존 행은 모두 활성화 상태로)
    op.add_column(
        'kpi_dashboard_cards',
        sa.Column('treemap_enabled', sa.Boolean(), nullable=False, server_default=sa.true())
    )


def downgrade():
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)

    if 'kpi_dashboard_cards' not in inspector.get_table_names():
        return

    existing_cols = [c['name'] for c in inspector.get_columns('kpi_dashboard_cards')]
    if 'treemap_enabled' not in existing_cols:
        return

    op.drop_column('kpi_dashboard_cards', 'treemap_enabled')
