"""디지털 스레드 부문 — 사전 넷과 사업부 구간

스레드 = 제품 생애(기획→개발→제조기술→제조→품질→구매→시장→경영)를 따라 한 데이터가 이어지는 줄.
평가 단위는 구간(데이터가 한 조직·시스템에서 다른 곳으로 건너는 자리). 구간의 평가·이력은
기존 대상/연계/평가 표를 그대로 쓴다(sector='digital_thread', 수단 없는 연계) — 여기는 구간의
속성(스레드 · 출발/매개/도착 조직·시스템)과 전사 사전(스레드·표준 구간·시스템·조직)만 둔다.

Revision ID: b8e6f4d92a75
Revises: a7d5f3c81e64
"""
import sqlalchemy as sa
from alembic import op

revision = 'b8e6f4d92a75'
down_revision = 'a7d5f3c81e64'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'dt_thread_def',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('key', sa.String(60), nullable=False, unique=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('axes_off', sa.JSON()),                # 이 스레드에서 안 쓰는 축 key 들
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('updated_at', sa.DateTime()),
    )
    op.create_table(
        'dt_thread_segment_def',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('thread_id', sa.Integer(), sa.ForeignKey('dt_thread_def.id', ondelete='CASCADE'), nullable=False),
        sa.Column('key', sa.String(60), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('from_stage', sa.String(30), nullable=False),
        sa.Column('to_stage', sa.String(30), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('updated_at', sa.DateTime()),
        sa.UniqueConstraint('thread_id', 'key', name='uq_dt_thread_segment_def'),
    )
    op.create_index('ix_dt_thread_segment_def_thread_id', 'dt_thread_segment_def', ['thread_id'])
    op.create_table(
        'dt_thread_system',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False, unique=True),
        sa.Column('kind', sa.String(30), nullable=False),          # plm · erp · … · informal
        sa.Column('owner_org', sa.String(200)),
        sa.Column('stages', sa.JSON()),
        sa.Column('link_means', sa.String(20), nullable=False, server_default='unknown'),   # api · file · none · unknown
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),        # active · adopting · retiring
        sa.Column('created_division_id', sa.Integer()),
        sa.Column('note', sa.Text()),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('updated_at', sa.DateTime()),
    )
    op.create_table(
        'dt_thread_org',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('role', sa.String(30)),                           # 생애 단계 역할
        sa.Column('division_id', sa.Integer()),
        sa.Column('source_kind', sa.String(20), nullable=False, server_default='manual'),   # portal · process · manual
        sa.Column('source_id', sa.String(100)),
        sa.Column('note', sa.Text()),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('updated_at', sa.DateTime()),
    )
    op.create_index('ix_dt_thread_org_division_id', 'dt_thread_org', ['division_id'])
    op.create_table(
        'dt_thread_segment',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('subject_id', sa.Integer(), sa.ForeignKey('dt_maturity_subject.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('division_id', sa.Integer(), nullable=False),
        sa.Column('thread_id', sa.Integer(), sa.ForeignKey('dt_thread_def.id', ondelete='SET NULL')),
        sa.Column('segment_def_id', sa.Integer(), sa.ForeignKey('dt_thread_segment_def.id', ondelete='SET NULL')),
        sa.Column('from_org_id', sa.Integer()),
        sa.Column('from_system_id', sa.Integer()),
        sa.Column('via_system_id', sa.Integer()),
        sa.Column('to_org_id', sa.Integer()),
        sa.Column('to_system_id', sa.Integer()),
        sa.Column('note', sa.Text()),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('updated_at', sa.DateTime()),
    )
    op.create_index('ix_dt_thread_segment_division_id', 'dt_thread_segment', ['division_id'])
    op.create_index('ix_dt_thread_segment_thread_id', 'dt_thread_segment', ['thread_id'])


def downgrade():
    op.drop_index('ix_dt_thread_segment_thread_id', table_name='dt_thread_segment')
    op.drop_index('ix_dt_thread_segment_division_id', table_name='dt_thread_segment')
    op.drop_table('dt_thread_segment')
    op.drop_index('ix_dt_thread_org_division_id', table_name='dt_thread_org')
    op.drop_table('dt_thread_org')
    op.drop_table('dt_thread_system')
    op.drop_index('ix_dt_thread_segment_def_thread_id', table_name='dt_thread_segment_def')
    op.drop_table('dt_thread_segment_def')
    op.drop_table('dt_thread_def')
