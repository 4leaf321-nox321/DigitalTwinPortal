"""add divisions.is_kpi_owner (DX KPI 를 직접 관리하는 사업부인가)

MX·VD·DA·NW·의료기기 는 지표를 갖고 목표·실적을 쌓는다.
GTR·SR·CS 는 **기능조직**이라 자기 지표가 없고 위 사업부들을 지원한다.
KPI 매트릭스의 **열이 이 값으로 정해진다.**

왜 컬럼인가 (코드에 이름을 박지 않는 이유)
    조직은 바뀐다. 사업부 이름을 화면·API 에 박아 두면 그때 조용히 틀어지고,
    어디를 고쳐야 하는지도 흩어진다. 데이터로 두면 한 줄 UPDATE 로 끝난다.

백필 규칙 — **측정 실적이 있는 사업부만 true**
    `kpi_records`/`kpi_targets` 에 한 번이라도 등장한 이름을 KPI 보유로 본다.
    (두 테이블의 division 은 `divisions.name` 과 같은 표기를 쓴다)

    ⚠️ 아직 실적을 한 건도 안 올린 KPI 보유 사업부가 있으면 false 로 잡힌다.
       그래서 **반입 후 반드시 확인**한다 — 런북에 확인 쿼리를 넣을 것:
         SELECT name, is_kpi_owner FROM divisions WHERE is_active ORDER BY "order";
       기대값은 GTR·SR·CS 만 false 다. 다르면 UPDATE 한 줄로 바로잡는다.

Revision ID: c8f3a15e6b27
Revises: b7e2d90c4f15
Create Date: 2026-08-01

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c8f3a15e6b27'
down_revision = 'b7e2d90c4f15'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'divisions',
        sa.Column('is_kpi_owner', sa.Boolean(),
                  nullable=False, server_default=sa.true()))

    # 측정 실적·목표가 한 건도 없는 사업부 = 기능조직으로 본다.
    op.execute("""
        UPDATE divisions
           SET is_kpi_owner = false
         WHERE name NOT IN (
               SELECT division FROM kpi_records  WHERE division IS NOT NULL
               UNION
               SELECT division FROM kpi_targets  WHERE division IS NOT NULL)
    """)


def downgrade():
    op.drop_column('divisions', 'is_kpi_owner')
