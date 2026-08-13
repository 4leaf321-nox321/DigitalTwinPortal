"""add dt2_project_kpi.target_division (누구의 지표를 미는가)

DX KPI 는 지표 하나가 아니라 **(지표 × 사업부)** 단위로 측정된다 —
`kpi_records`/`kpi_targets` 가 division 별로 쌓이고, 'MX 의 가상검증률' 과
'VD 의 가상검증률' 은 다른 숫자다(실측 2026-08-01: 가상 검증률이 MX 8 · VD 2 ·
DA 1 · NW 1 · 의료기기 1 로 따로 쌓여 있다).

과제 소속으로 갈음할 수 없는 이유
    GTR·SR·CS 는 기능조직이라 자기 지표가 없다(kpi_records 0건). 이들이 MX 의
    가상검증률에 기여하는 경우가 실제로 있는데, 소속으로 집계하면 그 기여가
    GTR 칸에 찍히고 MX 칸은 과소 계상된다.

백필
    기존 연결은 **과제의 사업부**를 대상으로 넣는다. 지금 연결은 소속이
    KPI 보유 사업부인 과제뿐이라(개발 실측 MX 2 · VD 1) 그대로 맞는 값이다.
    사업부를 못 찾는 행은 빈 문자열로 남고 매트릭스에서 제외된다 — 지어내지 않는다.

유니크 제약
    (과제, 지표) → (과제, 지표, 대상) 으로 넓힌다.
    "GTR 과제가 MX 와 VD 를 동시에 지원" 이 두 행이기 때문이다.

Revision ID: b7e2d90c4f15
Revises: a1c48f70b2d3
Create Date: 2026-08-01

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b7e2d90c4f15'
down_revision = 'a1c48f70b2d3'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'dt2_project_kpi',
        sa.Column('target_division', sa.String(length=50),
                  nullable=False, server_default=''))

    # 기존 연결 백필 — 과제의 사업부를 대상으로 본다.
    op.execute("""
        UPDATE dt2_project_kpi AS l
           SET target_division = COALESCE(p.division, '')
          FROM dt2_projects AS p
         WHERE p.uuid = l.project_uuid
           AND l.target_division = ''
    """)

    op.create_index('ix_dt2_project_kpi_target_division',
                    'dt2_project_kpi', ['target_division'])

    # 대상을 포함하도록 유니크를 넓힌다 (기존 것을 먼저 내린다)
    op.drop_constraint('uq_dt2_project_kpi', 'dt2_project_kpi', type_='unique')
    op.create_unique_constraint(
        'uq_dt2_project_kpi', 'dt2_project_kpi',
        ['project_uuid', 'kpi_definition_id', 'target_division'])


def downgrade():
    # 되돌릴 때는 대상이 여럿인 연결이 (과제,지표) 로 겹칠 수 있다.
    # 좁은 유니크를 다시 걸기 전에 **가장 오래된 것만 남긴다.**
    op.execute("""
        DELETE FROM dt2_project_kpi a
         USING dt2_project_kpi b
         WHERE a.project_uuid = b.project_uuid
           AND a.kpi_definition_id = b.kpi_definition_id
           AND a.id > b.id
    """)
    op.drop_constraint('uq_dt2_project_kpi', 'dt2_project_kpi', type_='unique')
    op.create_unique_constraint(
        'uq_dt2_project_kpi', 'dt2_project_kpi',
        ['project_uuid', 'kpi_definition_id'])
    op.drop_index('ix_dt2_project_kpi_target_division',
                  table_name='dt2_project_kpi')
    op.drop_column('dt2_project_kpi', 'target_division')
