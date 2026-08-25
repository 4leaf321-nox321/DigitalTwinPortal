"""Add dt_intel_changes (레이더 단계 판단의 기록)

Revision ID: f1e83b7c5a92
Revises: e7c94a3d2f61
Create Date: 2026-08-25 14:00:00.000000

⚠️ 단계를 「조직의 판단」이라며 관리자ㆍ사무국으로 좁혀 놓고 **그 판단의 기록이
   없었다.** `stage`ㆍ`stage_reason` 은 지금 값만 들고 있어서 「왜 작년에 도입이었다가
   보류로 내려갔지」에 답할 수 없다. 판단을 좁혔으면 그 판단이 남아야 한다.

⚠️ FK 를 안 건다 — 기술이 지워져도 그때의 판단은 남아야 한다
   (`dt2_project_changes`ㆍ`dt_investment_changes` 와 같은 결정).
"""
from alembic import op
import sqlalchemy as sa


revision = 'f1e83b7c5a92'
down_revision = 'e7c94a3d2f61'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'dt_intel_changes',
        sa.Column('subject_kind', sa.String(length=10), nullable=False),
        sa.Column('subject_uuid', sa.String(length=36), nullable=False),
        # 대상이 지워져도 무엇에 대한 기록인지 알아야 한다.
        sa.Column('subject_name', sa.String(length=300), nullable=True),
        sa.Column('field', sa.String(length=30), nullable=False),
        sa.Column('before_value', sa.String(length=200), nullable=True),
        sa.Column('after_value', sa.String(length=200), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('actor_user_id', sa.Integer(), nullable=True),
        sa.Column('actor_name', sa.String(length=100), nullable=True),
        sa.Column('source', sa.String(length=20), nullable=False, server_default='ui'),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_dt_intel_changes_subject_kind'),
                    'dt_intel_changes', ['subject_kind'])
    op.create_index(op.f('ix_dt_intel_changes_subject_uuid'),
                    'dt_intel_changes', ['subject_uuid'])
    op.create_index(op.f('ix_dt_intel_changes_actor_user_id'),
                    'dt_intel_changes', ['actor_user_id'])


def downgrade():
    op.drop_table('dt_intel_changes')
