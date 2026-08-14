"""add strategy_issue table

Revision ID: b71ac3ed145b
Revises: cc9f0d26ff10
Create Date: 2026-08-14 17:36:39.564033

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b71ac3ed145b'
down_revision = 'cc9f0d26ff10'
branch_labels = None
depends_on = None


def upgrade():
    # ⚠️ autogenerate 가 매번 dt2_agent_runs 의 created_at 인덱스 드롭을 끼워
    #    넣는다(이 마이그레이션까지 네 번째). 이 변경과 무관하므로 지웠다.
    #    모델과 실제 DB 의 인덱스 상태가 어긋나 있다는 뜻이라 따로 봐야 한다.
    op.create_table('strategy_issue',
    sa.Column('plan_id', sa.Integer(), nullable=False),
    sa.Column('crux_id', sa.Integer(), nullable=True),
    sa.Column('title', sa.String(length=300), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('root_cause', sa.Text(), nullable=True),
    sa.Column('division_id', sa.Integer(), nullable=True),
    sa.Column('source_type', sa.String(length=20), nullable=False),
    sa.Column('source_ref', sa.String(length=200), nullable=True),
    sa.Column('impact', sa.Integer(), nullable=True),
    sa.Column('feasibility', sa.Integer(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('order', sa.Integer(), nullable=False),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['crux_id'], ['strategy_crux.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['plan_id'], ['strategy_plan.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('strategy_issue', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_strategy_issue_crux_id'), ['crux_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_strategy_issue_division_id'), ['division_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_strategy_issue_plan_id'), ['plan_id'], unique=False)


def downgrade():
    with op.batch_alter_table('strategy_issue', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_strategy_issue_plan_id'))
        batch_op.drop_index(batch_op.f('ix_strategy_issue_division_id'))
        batch_op.drop_index(batch_op.f('ix_strategy_issue_crux_id'))

    op.drop_table('strategy_issue')
    # ### end Alembic commands ###
