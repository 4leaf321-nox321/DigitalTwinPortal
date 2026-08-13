"""change product_family to JSON array

Revision ID: 63942d35f81f
Revises: 53b8997af437
Create Date: 2026-02-20 22:27:03.431144

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '63942d35f81f'
down_revision = '53b8997af437'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE dt_reference_tasks
        ALTER COLUMN product_family TYPE JSON
        USING CASE
            WHEN product_family IS NOT NULL THEN to_json(ARRAY[product_family])
            ELSE '[]'::json
        END
    """)


def downgrade():
    op.execute("""
        ALTER TABLE dt_reference_tasks
        ALTER COLUMN product_family TYPE VARCHAR(100)
        USING CASE
            WHEN product_family IS NOT NULL AND json_array_length(product_family) > 0
            THEN product_family->>0
            ELSE NULL
        END
    """)
