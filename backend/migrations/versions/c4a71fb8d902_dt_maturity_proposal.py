"""성숙도 — AI 가 낸 판단은 제안으로 들어온다(2026-08-30)

「근거 없이는 매기지 않는다」가 막는 것은 빈 근거이지 **지어낸 근거**가 아니다.
AI 는 그럴듯한 근거를 만들어 내므로, 판단(축 매기기·불량 유형 표·도달 시점)은
사람이 화면에서 보고 승인해야 판에 오른다.

⚠️ **별도 표**인 것이 핵심이다. 대기 상태를 평가 표에 깃발로 두면 판·요약·변화·모판·
   추출·전사 셈 전부에서 걸러야 하고, 이 모듈에서 여태 난 결함이 대부분 그런 자리였다.
   딴 표에 두면 그 셈들은 아무것도 안 바꿔도 된다 — 대기 중인 것은 애초에 평가 표에 없다.

Revision ID: c4a71fb8d902
Revises: eded9c9d9133
Create Date: 2026-08-30 14:05:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'c4a71fb8d902'
down_revision = 'eded9c9d9133'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'dt_maturity_proposal',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('pair_id', sa.Integer(), nullable=False),
        sa.Column('division_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('axis', sa.String(length=40), nullable=False),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('note', sa.Text(), nullable=False),
        sa.Column('actor_user_id', sa.Integer(), nullable=True),
        sa.Column('actor_name', sa.String(length=100), nullable=True),
        sa.Column('source', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('decided_by_id', sa.Integer(), nullable=True),
        sa.Column('decided_by_name', sa.String(length=100), nullable=True),
        sa.Column('decided_at', sa.DateTime(), nullable=True),
        sa.Column('decided_note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        # 연계를 지우면 그 제안도 같이 간다 — 갈 곳 없는 제안은 뜻이 없다
        sa.ForeignKeyConstraint(['pair_id'], ['dt_maturity_pair.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('dt_maturity_proposal', schema=None) as b:
        b.create_index(b.f('ix_dt_maturity_proposal_pair_id'), ['pair_id'], unique=False)
        b.create_index(b.f('ix_dt_maturity_proposal_division_id'), ['division_id'], unique=False)
        b.create_index(b.f('ix_dt_maturity_proposal_status'), ['status'], unique=False)


def downgrade():
    with op.batch_alter_table('dt_maturity_proposal', schema=None) as b:
        b.drop_index(b.f('ix_dt_maturity_proposal_status'))
        b.drop_index(b.f('ix_dt_maturity_proposal_division_id'))
        b.drop_index(b.f('ix_dt_maturity_proposal_pair_id'))
    op.drop_table('dt_maturity_proposal')
