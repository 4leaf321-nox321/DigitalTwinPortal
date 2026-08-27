"""개발 디지털 트윈 성숙도 — 표 다섯 (대상 · 수단 · 쌍 · 평가 · 이력)

시험 하나에 대해 시뮬레이션이 어디까지 왔는가를 **쌍 단위**로 매기는 새 모듈.
계획: frontend/src/modules/dev-dt-maturity/PLAN.md 5절.

⚠️ **쌍이 일급이다.** 로드맵 정보처럼 JSON 배열로 연결을 두면 연결을 고칠 때마다
   배열이 갈리고 평가가 사라진다. 평가·이력·URL 이 전부 쌍의 id 에 붙는다.

⚠️ **축마다 한 줄**(pair × axis 유일). 여섯 컬럼이 아니다 — 셋만 매긴 상태가
   자연스럽고 축마다 평가일이 따로 남는다.

⚠️ 로드맵 항목 id · 대시보드 과제 uuid 는 **FK 가 아니다.** 참고 링크다. 저쪽이
   바뀌어도 여기가 안 깨진다.

⚠️ 새 표만 만든다. 다른 표는 건드리지 않는다. 되돌리면 다섯 표가 통째로 사라진다 —
   평가 자료가 있으면 되돌리기 전에 내보낼 것.

Revision ID: b7e4d2c91a05
Revises: a7d3e51f8c02
"""
import sqlalchemy as sa
from alembic import op

revision = 'b7e4d2c91a05'
down_revision = 'a7d3e51f8c02'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'dt_maturity_subject',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('division_id', sa.Integer(), nullable=False),
        sa.Column('sector', sa.String(length=40), nullable=False),
        sa.Column('name', sa.String(length=300), nullable=False),
        sa.Column('detail', sa.String(length=500), nullable=True),
        sa.Column('product_families', sa.JSON(), nullable=True),
        sa.Column('accuracy_rule', sa.String(length=10), nullable=False,
                  server_default='auto'),
        sa.Column('roadmap_task_id', sa.Integer(), nullable=True),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_dt_maturity_subject_division_id', 'dt_maturity_subject', ['division_id'])
    op.create_index('ix_dt_maturity_subject_sector', 'dt_maturity_subject', ['sector'])

    op.create_table(
        'dt_maturity_agent',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('division_id', sa.Integer(), nullable=False),
        sa.Column('sector', sa.String(length=40), nullable=False),
        sa.Column('name', sa.String(length=300), nullable=False),
        sa.Column('kind', sa.String(length=100), nullable=True),
        sa.Column('model_kind', sa.String(length=20), nullable=True),
        sa.Column('project_uuid', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_dt_maturity_agent_division_id', 'dt_maturity_agent', ['division_id'])
    op.create_index('ix_dt_maturity_agent_sector', 'dt_maturity_agent', ['sector'])
    op.create_index('ix_dt_maturity_agent_project_uuid', 'dt_maturity_agent', ['project_uuid'])

    op.create_table(
        'dt_maturity_pair',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('subject_id', sa.Integer(), nullable=False),
        sa.Column('agent_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['subject_id'], ['dt_maturity_subject.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['agent_id'], ['dt_maturity_agent.id'], ondelete='CASCADE'),
        # ⚠️ agent_id 가 NULL 이면 이 제약이 안 잡는다(SQL 의 NULL). 수단 없는 쌍의
        #    중복은 services.create_pair 가 막는다.
        sa.UniqueConstraint('subject_id', 'agent_id', name='uq_dt_maturity_pair'),
    )
    op.create_index('ix_dt_maturity_pair_subject_id', 'dt_maturity_pair', ['subject_id'])
    op.create_index('ix_dt_maturity_pair_agent_id', 'dt_maturity_pair', ['agent_id'])

    op.create_table(
        'dt_maturity_assessment',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('pair_id', sa.Integer(), nullable=False),
        sa.Column('axis', sa.String(length=40), nullable=False),
        sa.Column('rung', sa.String(length=40), nullable=True),
        sa.Column('value', sa.Float(), nullable=True),
        sa.Column('note', sa.Text(), nullable=False, server_default=''),
        sa.Column('evidence', sa.JSON(), nullable=True),
        sa.Column('assessed_at', sa.DateTime(), nullable=False),
        sa.Column('assessed_by_id', sa.Integer(), nullable=True),
        sa.Column('assessed_by_name', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['pair_id'], ['dt_maturity_pair.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('pair_id', 'axis', name='uq_dt_maturity_assessment'),
    )
    op.create_index('ix_dt_maturity_assessment_pair_id', 'dt_maturity_assessment', ['pair_id'])

    op.create_table(
        'dt_maturity_change',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('pair_id', sa.Integer(), nullable=False),
        sa.Column('axis', sa.String(length=40), nullable=False),
        sa.Column('before', sa.String(length=60), nullable=True),
        sa.Column('after', sa.String(length=60), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('actor_user_id', sa.Integer(), nullable=True),
        sa.Column('actor_name', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['pair_id'], ['dt_maturity_pair.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_dt_maturity_change_pair_id', 'dt_maturity_change', ['pair_id'])


def downgrade():
    for name in ('dt_maturity_change', 'dt_maturity_assessment', 'dt_maturity_pair',
                 'dt_maturity_agent', 'dt_maturity_subject'):
        op.drop_table(name)
