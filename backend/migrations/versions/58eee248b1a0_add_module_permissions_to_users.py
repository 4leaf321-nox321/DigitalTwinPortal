"""add module_permissions to users

Revision ID: 58eee248b1a0
Revises: 33bf2148c59b
Create Date: 2026-03-12 22:17:13.943281

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '58eee248b1a0'
down_revision = '33bf2148c59b'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('module_permissions', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('users', 'module_permissions')
