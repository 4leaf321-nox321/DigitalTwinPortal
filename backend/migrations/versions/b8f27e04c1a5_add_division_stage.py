"""사업부별 단계 — 전사와 다를 때만 한 줄

⚠️⚠️ 전사 값이 정본이고 이 표에는 **예외만** 담는다. 사업부 8개 × 역량 39개 =
   312칸을 채우게 하면 아무도 안 채우고, 채운 것도 곧 낡아 표 전체를 못 믿게 된다.

⚠️ `dt_intel_changes.scope` 도 함께 연다 — 「어느 사업부의 판단인가」가 없으면
   이력에서 전사와 사업부가 뒤섞이고, 레이더의 이동 화살표가 거짓말을 한다.

Revision ID: b8f27e04c1a5
Revises: a4d61c9e83b7
"""
import sqlalchemy as sa
from alembic import op

revision = 'b8f27e04c1a5'
down_revision = 'a4d61c9e83b7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'dt_intel_division_stage',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tech_uuid', sa.String(length=36), nullable=False),
        sa.Column('division', sa.String(length=100), nullable=False),
        sa.Column('stage', sa.String(length=10), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('changed_at', sa.DateTime(), nullable=True),
        sa.Column('changed_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        # ⚠️ 한 기술ㆍ한 사업부에 두 줄이 생기면 어느 것이 참인지 알 수 없다.
        sa.UniqueConstraint('tech_uuid', 'division',
                            name='uq_intel_division_stage'),
    )
    op.create_index('ix_dt_intel_division_stage_tech_uuid',
                    'dt_intel_division_stage', ['tech_uuid'])
    op.create_index('ix_dt_intel_division_stage_division',
                    'dt_intel_division_stage', ['division'])

    op.add_column('dt_intel_changes',
                  sa.Column('scope', sa.String(length=100), nullable=True))
    op.create_index('ix_dt_intel_changes_scope', 'dt_intel_changes', ['scope'])


def downgrade():
    op.drop_index('ix_dt_intel_changes_scope', table_name='dt_intel_changes')
    op.drop_column('dt_intel_changes', 'scope')
    op.drop_index('ix_dt_intel_division_stage_division',
                  table_name='dt_intel_division_stage')
    op.drop_index('ix_dt_intel_division_stage_tech_uuid',
                  table_name='dt_intel_division_stage')
    op.drop_table('dt_intel_division_stage')
