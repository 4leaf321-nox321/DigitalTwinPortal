"""연계 개발 기록 — 시스템 연동·도입·폐지·정합화 건을 누적한다

계획서의 「PLM 새로 넣겠다 / SPDM 만들겠다 / 허브로 잇겠다」가 여기 한 줄씩 들어가고, 끝나면
그 구간의 연결 방식이 몇 칸 올라갔는지(전 → 후)를 같이 적어 계획과 상태가 이어진다.
해석 활용 기록처럼 건마다 한 줄, 연간으로 센다.

Revision ID: c9f7a5e03b86
Revises: b8e6f4d92a75
"""
import sqlalchemy as sa
from alembic import op

revision = 'c9f7a5e03b86'
down_revision = 'b8e6f4d92a75'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'dt_thread_case',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('division_id', sa.Integer(), nullable=False),
        sa.Column('month', sa.Date(), nullable=False),
        sa.Column('action', sa.String(20), nullable=False),        # integrate · adopt · retire · harmonize · other
        sa.Column('thread_id', sa.Integer(), sa.ForeignKey('dt_thread_def.id', ondelete='SET NULL')),
        sa.Column('segment_id', sa.Integer(), sa.ForeignKey('dt_thread_segment.id', ondelete='SET NULL')),
        sa.Column('system_id', sa.Integer()),                      # 대상 시스템 — FK 아님
        sa.Column('system_name', sa.String(200)),
        sa.Column('org_id', sa.Integer()),
        sa.Column('link_from', sa.String(30)),                     # 연결 방식 칸 key — 전
        sa.Column('link_to', sa.String(30)),                       # 후
        sa.Column('status', sa.String(20), nullable=False, server_default='done'),   # planned · doing · done
        sa.Column('note', sa.Text()),
        sa.Column('actor_user_id', sa.Integer()),
        sa.Column('actor_name', sa.String(100)),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('updated_at', sa.DateTime()),
    )
    op.create_index('ix_dt_thread_case_division_id', 'dt_thread_case', ['division_id'])
    op.create_index('ix_dt_thread_case_month', 'dt_thread_case', ['month'])


def downgrade():
    op.drop_index('ix_dt_thread_case_month', table_name='dt_thread_case')
    op.drop_index('ix_dt_thread_case_division_id', table_name='dt_thread_case')
    op.drop_table('dt_thread_case')
