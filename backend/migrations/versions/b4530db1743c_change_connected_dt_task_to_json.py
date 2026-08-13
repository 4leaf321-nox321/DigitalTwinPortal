"""change connected_dt_task to JSON

Revision ID: b4530db1743c
Revises: fbcabceb8b8a
Create Date: 2026-02-20 16:31:28.424252

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b4530db1743c'
down_revision = 'fbcabceb8b8a'
branch_labels = None
depends_on = None


def upgrade():
    # Clear existing string values to NULL before type change
    op.execute("UPDATE dt_reference_tasks SET connected_dt_task = NULL WHERE connected_dt_task IS NOT NULL")
    op.execute("ALTER TABLE dt_reference_tasks ALTER COLUMN connected_dt_task TYPE JSON USING connected_dt_task::json")


def downgrade():
    op.execute("ALTER TABLE dt_reference_tasks ALTER COLUMN connected_dt_task TYPE VARCHAR(500) USING connected_dt_task::text")
