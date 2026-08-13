"""add dt2_project_kpi (과제 ↔ DX KPI 연결)

DX KPI(`kpi_definitions`)와 과제(`dt2_projects`)는 지금까지 DB 수준에서 끊겨 있었다.
"이 KPI 를 밀고 있는 과제가 무엇인가" 를 물을 수 있게 연결 테이블 하나를 만든다.

가중치·주부 구분이 없다. 연관이 있는가 없는가뿐이다 (모델 주석 참조).

★ kpi_definitions FK 는 RESTRICT 다
  연결이 있는 KPI 는 DB 가 먼저 삭제를 막는다. dx_kpi_management 의 삭제 라우트에
  가드가 없었기 때문에(2026-08-01 확인), 코드가 아니라 DB 에 마지막 방어선을 둔다.

신규 테이블 하나만 만든다 — 기존 테이블은 건드리지 않으므로 downgrade 는 drop_table 뿐이다.

Revision ID: a1c48f70b2d3
Revises: 860bcaf47aa8
Create Date: 2026-08-01

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1c48f70b2d3'
down_revision = '860bcaf47aa8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'dt2_project_kpi',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_uuid', sa.String(length=64), nullable=False),
        sa.Column('kpi_definition_id', sa.Integer(), nullable=False),
        sa.Column('note', sa.String(length=300), nullable=True),
        # 지금 쓰지 않는다. 나중에 강도 구분이 필요해질 때를 위한 자리.
        sa.Column('relation_type', sa.String(length=20), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_uuid'], ['dt2_projects.uuid'],
                                ondelete='CASCADE'),
        # ★ RESTRICT — 연결이 남아 있는 KPI 는 지울 수 없다
        sa.ForeignKeyConstraint(['kpi_definition_id'], ['kpi_definitions.id'],
                                ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_uuid', 'kpi_definition_id',
                            name='uq_dt2_project_kpi'),
    )
    op.create_index('ix_dt2_project_kpi_project_uuid',
                    'dt2_project_kpi', ['project_uuid'])
    op.create_index('ix_dt2_project_kpi_kpi_definition_id',
                    'dt2_project_kpi', ['kpi_definition_id'])


def downgrade():
    op.drop_index('ix_dt2_project_kpi_kpi_definition_id',
                  table_name='dt2_project_kpi')
    op.drop_index('ix_dt2_project_kpi_project_uuid',
                  table_name='dt2_project_kpi')
    op.drop_table('dt2_project_kpi')
