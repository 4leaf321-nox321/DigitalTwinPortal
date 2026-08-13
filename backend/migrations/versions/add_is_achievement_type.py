"""Add is_achievement_type to performance_subcategories

Revision ID: add_achievement_type
Revises: 92b5e89500e8
Create Date: 2026-01-26

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_achievement_type'
down_revision = '92b5e89500e8'
branch_labels = None
depends_on = None


def upgrade():
    # Add is_achievement_type column to performance_subcategories table
    op.add_column('performance_subcategories',
                  sa.Column('is_achievement_type', sa.Boolean(), nullable=True, default=False))

    # Set default value for existing rows
    op.execute("UPDATE performance_subcategories SET is_achievement_type = false WHERE is_achievement_type IS NULL")


def downgrade():
    op.drop_column('performance_subcategories', 'is_achievement_type')
