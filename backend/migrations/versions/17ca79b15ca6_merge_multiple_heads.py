"""merge multiple heads

Revision ID: 17ca79b15ca6
Revises: add_achievement_type, fbc50a1929a2
Create Date: 2026-01-26 16:22:40.420760

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '17ca79b15ca6'
down_revision = ('add_achievement_type', 'fbc50a1929a2')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
