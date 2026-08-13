"""add report_plan_notices table

Revision ID: 705e7d922c38
Revises: 090e17b9c93f
Create Date: 2026-03-24 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '705e7d922c38'
down_revision = '090e17b9c93f'
branch_labels = None
depends_on = None


def upgrade():
    # Table already exists in DB (created manually), just stamp the migration
    from alembic import context
    if not context.is_offline_mode():
        bind = op.get_bind()
        result = bind.execute(sa.text(
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'report_plan_notices')"
        ))
        if result.scalar():
            return

    op.create_table('report_plan_notices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('scope', sa.String(length=20), nullable=False, server_default='all'),
        sa.Column('author_id', sa.Integer(), nullable=False),
        sa.Column('author_name', sa.String(length=100), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['author_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('report_plan_notices')
