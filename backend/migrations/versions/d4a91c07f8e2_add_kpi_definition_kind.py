"""add kpi_definitions.kind + '플랫폼 구축' 항목

왜 필요한가 (2026-08-01)
    과제 중에는 **지표를 올리는 게 아니라 시스템을 만드는** 것들이 있다.
    디지털 트윈 플랫폼 구축이 그렇다 — 가상 검증률을 몇 % 올렸는지로 설명되지
    않고, 그런 잣대를 들이대면 "기여 KPI 없음" 으로 잘못 분류된다.
    실제로 그 과제들이 KPI 연결에서 빠지면서 **왜 하는지 설명되지 않는 과제**로
    보였다.

왜 kpi_definitions 안에 두나 (별도 표가 아니라)
    연결의 뜻은 같다 — "이 과제는 이것에 기여한다". 다른 것은 **그 대상이 측정되는
    지표인가** 뿐이다. 별도 표로 빼면 dt2_project_kpi 가 두 곳을 가리켜야 하고
    (nullable FK + 종류 컬럼), 연결을 읽는 모든 경로가 두 갈래가 된다.
    한 표에 두고 `kind` 로 가르면 FK·유니크·정렬이 그대로 산다.

kind
    metric    측정되는 DX KPI. 목표·실적·달성률이 있다 (기존 전부)
    platform  플랫폼 구축. 측정값이 없고 **연결만** 한다

    DX KPI 관리 화면은 `kind='metric'` 만 받는다(API 가 기본으로 거른다).
    거기 섞이면 목표를 세우라고 요구하는 표에 목표가 있을 수 없는 항목이 낀다.

Revision ID: d4a91c07f8e2
Revises: c8f3a15e6b27
Create Date: 2026-08-01

"""
from alembic import op
import sqlalchemy as sa


revision = 'd4a91c07f8e2'
down_revision = 'c8f3a15e6b27'
branch_labels = None
depends_on = None


PLATFORM_LABEL = '플랫폼 구축'


def upgrade():
    op.add_column(
        'kpi_definitions',
        sa.Column('kind', sa.String(length=20), nullable=False,
                  server_default='metric'))
    op.create_index('ix_kpi_definitions_kind', 'kpi_definitions', ['kind'])

    # 항목 자체를 여기서 만든다 — 화면이 없으면 만들 수 없는 값이고,
    # 코드가 "없으면 만든다" 를 매 요청에 하면 지운 뒤에도 되살아난다.
    #   divisions = [] : 어느 사업부든 플랫폼을 만들 수 있다
    #   sort_order     : 맨 뒤. 기존 지표 순서를 건드리지 않는다
    op.execute("""
        INSERT INTO kpi_definitions
            (label, category, unit, value_type, divisions, sort_order,
             show_raw_data, direction, kind, created_at, updated_at)
        SELECT '플랫폼 구축', '플랫폼 구축', '', 'single', '[]'::json,
               COALESCE((SELECT MAX(sort_order) FROM kpi_definitions), 0) + 1,
               false, 'higher', 'platform',
               NOW() AT TIME ZONE 'utc', NOW() AT TIME ZONE 'utc'
         WHERE NOT EXISTS (
               SELECT 1 FROM kpi_definitions WHERE label = '플랫폼 구축')
    """)


def downgrade():
    # 연결이 걸려 있으면 지우지 않는다 — FK 가 RESTRICT 라 어차피 막히지만,
    # 그러면 IntegrityError 로 끝나 이유가 안 보인다.
    op.execute("""
        DELETE FROM kpi_definitions d
         WHERE d.kind = 'platform'
           AND NOT EXISTS (
               SELECT 1 FROM dt2_project_kpi l WHERE l.kpi_definition_id = d.id)
    """)
    op.drop_index('ix_kpi_definitions_kind', table_name='kpi_definitions')
    op.drop_column('kpi_definitions', 'kind')
