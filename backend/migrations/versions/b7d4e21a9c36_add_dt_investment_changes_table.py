"""Add dt_investment_changes table

Revision ID: b7d4e21a9c36
Revises: a1c7e93b52d4
Create Date: 2026-08-20 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'b7d4e21a9c36'
down_revision = 'a1c7e93b52d4'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'dt_investment_changes',
        # 투자 건이 지워져도 이력은 남아야 하므로 FK 를 걸지 않는다.
        sa.Column('investment_id', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(length=20), nullable=False),
        sa.Column('field', sa.String(length=50), nullable=True),
        sa.Column('before_value', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('after_value', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('investment_name', sa.String(length=500), nullable=True),
        sa.Column('actor_user_id', sa.Integer(), nullable=True),
        sa.Column('source', sa.String(length=20), nullable=False, server_default='ui'),
        # delete 행을 되살려 만든 새 건의 id. 두 번 되살리는 것을 막는 표시다.
        sa.Column('restored_investment_id', sa.Integer(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_dt_investment_changes_investment_id'),
                    'dt_investment_changes', ['investment_id'])
    op.create_index(op.f('ix_dt_investment_changes_action'),
                    'dt_investment_changes', ['action'])
    op.create_index(op.f('ix_dt_investment_changes_actor_user_id'),
                    'dt_investment_changes', ['actor_user_id'])
    op.create_index('ix_dt_inv_chg_investment_created',
                    'dt_investment_changes', ['investment_id', 'created_at'])


def downgrade():
    op.drop_index('ix_dt_inv_chg_investment_created', table_name='dt_investment_changes')
    op.drop_index(op.f('ix_dt_investment_changes_actor_user_id'), table_name='dt_investment_changes')
    op.drop_index(op.f('ix_dt_investment_changes_action'), table_name='dt_investment_changes')
    op.drop_index(op.f('ix_dt_investment_changes_investment_id'), table_name='dt_investment_changes')
    op.drop_table('dt_investment_changes')
