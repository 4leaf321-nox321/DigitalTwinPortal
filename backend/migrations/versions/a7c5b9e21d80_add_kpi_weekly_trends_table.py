"""Add kpi_weekly_trends table

Revision ID: a7c5b9e21d80
Revises: d1f9a2c8b401
Create Date: 2026-04-28 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a7c5b9e21d80'
down_revision = 'd1f9a2c8b401'
branch_labels = None
depends_on = None


def upgrade():
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)

    if 'kpi_weekly_trends' not in inspector.get_table_names():
        op.create_table('kpi_weekly_trends',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('division', sa.String(length=50), nullable=False),
            sa.Column('category', sa.String(length=20), nullable=False),
            sa.Column('year', sa.Integer(), nullable=False),
            sa.Column('week', sa.Integer(), nullable=False),
            sa.Column('content', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('division', 'category', 'year', 'week', name='uq_weekly_trend'),
        )


def downgrade():
    op.drop_table('kpi_weekly_trends')
