"""add dt2_performance_history (Phase 2 보강)

성과 수준값의 시계열을 쌓기 위한 append-only 테이블.
기존 테이블은 건드리지 않는다. 생성만 하므로 downgrade 는 drop_table 하나다.

Revision ID: a3f21c6d90b4
Revises: fba9e7125df9
Create Date: 2026-07-29

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a3f21c6d90b4'
down_revision = 'fba9e7125df9'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'dt2_performance_history',
        sa.Column('id', sa.Integer(), nullable=False),
        # 성과 uuid. FK 를 걸지 않는다 — 성과가 지워져도 이력은 남아야 한다.
        sa.Column('performance_uuid', sa.String(length=64), nullable=False),
        sa.Column('observed_at', sa.DateTime(), nullable=False),
        sa.Column('source_updated_at', sa.DateTime(), nullable=True),
        sa.Column('year', sa.Integer(), nullable=True),
        sa.Column('unit', sa.String(length=50), nullable=True),
        sa.Column('current_level', sa.Numeric(), nullable=True),
        sa.Column('target_level', sa.Numeric(), nullable=True),
        sa.Column('actual_level', sa.String(length=100), nullable=True),
        sa.Column('monthly_values_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
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
    op.create_index('ix_dt2_performance_history_performance_uuid',
                    'dt2_performance_history', ['performance_uuid'])
    op.create_index('ix_dt2_performance_history_observed_at',
                    'dt2_performance_history', ['observed_at'])
    op.create_index('ix_dt2_performance_history_change_kind',
                    'dt2_performance_history', ['change_kind'])
    op.create_index('ix_dt2_performance_history_year',
                    'dt2_performance_history', ['year'])
    # 한 성과의 추이 조회와 최신 1건 조회를 같이 커버한다.
    op.create_index('ix_dt2_perf_hist_uuid_observed',
                    'dt2_performance_history', ['performance_uuid', 'observed_at'])


def downgrade():
    op.drop_index('ix_dt2_perf_hist_uuid_observed', table_name='dt2_performance_history')
    op.drop_index('ix_dt2_performance_history_year', table_name='dt2_performance_history')
    op.drop_index('ix_dt2_performance_history_change_kind', table_name='dt2_performance_history')
    op.drop_index('ix_dt2_performance_history_observed_at', table_name='dt2_performance_history')
    op.drop_index('ix_dt2_performance_history_performance_uuid', table_name='dt2_performance_history')
    op.drop_table('dt2_performance_history')
