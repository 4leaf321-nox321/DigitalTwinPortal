"""add dt2_project_history (Phase 2 보강)

과제 진척 상태의 시계열. 성과 이력과 같은 방식의 append-only 테이블.
생성만 하므로 downgrade 는 drop_table 하나다.

Revision ID: b7d48e2af115
Revises: a3f21c6d90b4
Create Date: 2026-07-29

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'b7d48e2af115'
down_revision = 'a3f21c6d90b4'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'dt2_project_history',
        sa.Column('id', sa.Integer(), nullable=False),
        # 과제 uuid. FK 를 걸지 않는다 — 과제가 지워져도 이력은 남아야 한다.
        sa.Column('project_uuid', sa.String(length=64), nullable=False),
        sa.Column('observed_at', sa.DateTime(), nullable=False),
        sa.Column('source_updated_at', sa.DateTime(), nullable=True),
        sa.Column('year', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('progress', sa.Integer(), nullable=True),
        sa.Column('action_total', sa.Integer(), nullable=True),
        sa.Column('action_done', sa.Integer(), nullable=True),
        sa.Column('issue_total', sa.Integer(), nullable=True),
        sa.Column('issue_open', sa.Integer(), nullable=True),
        sa.Column('start_month', sa.Integer(), nullable=True),
        sa.Column('end_month', sa.Integer(), nullable=True),
        sa.Column('value_hash', sa.String(length=64), nullable=False),
        sa.Column('changed_fields', postgresql.JSONB(astext_type=sa.Text()),
                  server_default='[]', nullable=False),
        sa.Column('change_kind', sa.String(length=20),
                  server_default='import', nullable=False),
        sa.Column('source', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_dt2_project_history_project_uuid',
                    'dt2_project_history', ['project_uuid'])
    op.create_index('ix_dt2_project_history_observed_at',
                    'dt2_project_history', ['observed_at'])
    op.create_index('ix_dt2_project_history_change_kind',
                    'dt2_project_history', ['change_kind'])
    op.create_index('ix_dt2_project_history_year',
                    'dt2_project_history', ['year'])
    op.create_index('ix_dt2_project_history_status',
                    'dt2_project_history', ['status'])
    op.create_index('ix_dt2_proj_hist_uuid_observed',
                    'dt2_project_history', ['project_uuid', 'observed_at'])


def downgrade():
    op.drop_index('ix_dt2_proj_hist_uuid_observed', table_name='dt2_project_history')
    op.drop_index('ix_dt2_project_history_status', table_name='dt2_project_history')
    op.drop_index('ix_dt2_project_history_year', table_name='dt2_project_history')
    op.drop_index('ix_dt2_project_history_change_kind', table_name='dt2_project_history')
    op.drop_index('ix_dt2_project_history_observed_at', table_name='dt2_project_history')
    op.drop_index('ix_dt2_project_history_project_uuid', table_name='dt2_project_history')
    op.drop_table('dt2_project_history')
