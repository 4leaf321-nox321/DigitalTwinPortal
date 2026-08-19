"""Add dt_investments table

Revision ID: a1c7e93b52d4
Revises: c539faffd12c
Create Date: 2026-08-18 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1c7e93b52d4'
down_revision = 'c539faffd12c'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'dt_investments',
        sa.Column('name', sa.String(length=500), nullable=False),
        sa.Column('division', sa.String(length=100), nullable=True),
        sa.Column('process', sa.String(length=100), nullable=True),
        sa.Column('department', sa.String(length=200), nullable=True),
        sa.Column('year', sa.Integer(), nullable=True),
        sa.Column('plan_amount', sa.Float(), nullable=True),
        sa.Column('actual_amount', sa.Float(), nullable=True),
        sa.Column('category1', sa.String(length=50), nullable=True),
        sa.Column('category2', sa.String(length=100), nullable=True),
        sa.Column('order', sa.Integer(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('dt_investments')
