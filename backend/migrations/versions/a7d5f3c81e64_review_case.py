"""검토 대장 — 시험과 짝이 없는 스팟성 시뮬레이션(설계 스펙 검토·원인 분석)을 건(件)으로 쌓는다

시험 항목은 **상태**(쌍마다 사다리 하나, 갱신·이력)이고 검토 대장은 **사건**(건마다 한 줄,
누적)이다. 그래서 표가 다르다 — 쌍·평가 표는 안 건드린다. 연간으로 세고, 같은 시뮬레이션 ×
항목이 되풀이되면 「정착 후보」로 표시해 상시 항목(시험 항목)으로 올릴 재료가 된다.

Revision ID: a7d5f3c81e64
Revises: f6c4e8a20d53
"""
import sqlalchemy as sa
from alembic import op

revision = 'a7d5f3c81e64'
down_revision = 'f6c4e8a20d53'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'dt_maturity_review_case',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('division_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(20), nullable=False),          # spec | cause
        sa.Column('month', sa.Date(), nullable=False),              # 그 달 1일
        sa.Column('target', sa.String(300)),                        # 대상 — 제품·과제
        sa.Column('item', sa.String(300)),                          # 스펙 항목 / 불량 유형
        sa.Column('agent_id', sa.Integer()),                        # 시뮬레이션 관리의 것(FK 아님)
        sa.Column('agent_name', sa.String(300)),                    # 이름 — 관리 목록에 없어도 적는다
        sa.Column('timing', sa.String(20)),
        sa.Column('decision', sa.String(20)),
        sa.Column('basis', sa.String(20)),
        sa.Column('lead_days', sa.Float()),
        sa.Column('note', sa.Text()),
        sa.Column('actor_user_id', sa.Integer()),
        sa.Column('actor_name', sa.String(100)),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('updated_at', sa.DateTime()),
    )
    op.create_index('ix_dt_maturity_review_case_division_id', 'dt_maturity_review_case', ['division_id'])
    op.create_index('ix_dt_maturity_review_case_month', 'dt_maturity_review_case', ['month'])
    op.create_index('ix_dt_maturity_review_case_agent_id', 'dt_maturity_review_case', ['agent_id'])


def downgrade():
    op.drop_index('ix_dt_maturity_review_case_agent_id', table_name='dt_maturity_review_case')
    op.drop_index('ix_dt_maturity_review_case_month', table_name='dt_maturity_review_case')
    op.drop_index('ix_dt_maturity_review_case_division_id', table_name='dt_maturity_review_case')
    op.drop_table('dt_maturity_review_case')
