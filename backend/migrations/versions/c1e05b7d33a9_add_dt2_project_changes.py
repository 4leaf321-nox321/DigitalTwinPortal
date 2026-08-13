"""add dt2_project_changes (Phase 3 변경 로그)

과제 필드 변경 로그. 낙관적 락의 자동 병합 판정과 감사 추적에 쓴다.
생성만 하므로 downgrade 는 drop_table 하나다.

Revision ID: c1e05b7d33a9
Revises: b7d48e2af115
Create Date: 2026-07-29

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c1e05b7d33a9'
down_revision = 'b7d48e2af115'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'dt2_project_changes',
        sa.Column('id', sa.Integer(), nullable=False),
        # 과제 uuid. FK 를 걸지 않는다 — 과제가 지워져도 '누가 지웠는지' 는 남아야 한다.
        sa.Column('project_uuid', sa.String(length=64), nullable=False),
        sa.Column('row_version', sa.Integer(), nullable=False),
        sa.Column('field', sa.String(length=100), nullable=False),
        sa.Column('before_value', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('after_value', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('actor_user_id', sa.Integer(), nullable=True),
        sa.Column('on_behalf_of', sa.Integer(), nullable=True),
        sa.Column('source', sa.String(length=20), server_default='ui', nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['actor_user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['on_behalf_of'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_dt2_project_changes_project_uuid',
                    'dt2_project_changes', ['project_uuid'])
    op.create_index('ix_dt2_project_changes_field',
                    'dt2_project_changes', ['field'])
    op.create_index('ix_dt2_project_changes_actor_user_id',
                    'dt2_project_changes', ['actor_user_id'])
    op.create_index('ix_dt2_project_changes_source',
                    'dt2_project_changes', ['source'])
    # 병합 판정 쿼리(project_uuid + row_version >)가 타는 인덱스
    op.create_index('ix_dt2_proj_chg_uuid_version',
                    'dt2_project_changes', ['project_uuid', 'row_version'])


def downgrade():
    op.drop_index('ix_dt2_proj_chg_uuid_version', table_name='dt2_project_changes')
    op.drop_index('ix_dt2_project_changes_source', table_name='dt2_project_changes')
    op.drop_index('ix_dt2_project_changes_actor_user_id', table_name='dt2_project_changes')
    op.drop_index('ix_dt2_project_changes_field', table_name='dt2_project_changes')
    op.drop_index('ix_dt2_project_changes_project_uuid', table_name='dt2_project_changes')
    op.drop_table('dt2_project_changes')
