"""Add tags and cpt to dt_intel_tech (기술이 여러 갈래에 얽히는 것을 담는다)

Revision ID: e7c94a3d2f61
Revises: d5b82f6c1a94
Create Date: 2026-08-25 15:00:00.000000

왜 필요했나
    부채꼴(`category`)은 **하나**여야 그림이 그려진다. 그런데 실제 기술은 여러
    갈래에 얽힌다 —

        OPC UA        데이터·연결 + 표준화
        FMI / FMU     시뮬레이션  + 표준화
        Simcenter ROM 시뮬레이션  + AI

    ⚠️ 특히 「표준화」는 다른 것들의 **형제가 아니라 성질**이다. OpenUSD 는
       *3D 데이터 교환의* 표준이고 FMI 는 *시뮬레이션 모델 교환의* 표준이다.

    그래서 `category` 는 **자리를 정하는 대표 하나**로 두고, 얽힌 나머지는
    `tags` 에 남긴다. 안 남기면 그 사실이 사라진다.

`cpt` 는 왜 따로인가
    Digital Twin Consortium 의 **Capabilities Periodic Table v1.1** 여섯 묶음이다
    (Data Services · Integration · Intelligence · UX · Management · Trustworthiness).
    ⚠️ 이건 **우리 분류가 아니라 외부 표준**이라 값이 정해져 있다. 자유 태그와 섞으면
       오타가 섞이고, 그 순간 「업계 기준으로 우리가 어디를 보고 있나」를 못 센다.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'e7c94a3d2f61'
down_revision = 'd5b82f6c1a94'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('dt_intel_tech',
                  sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('dt_intel_tech',
                  sa.Column('cpt', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade():
    op.drop_column('dt_intel_tech', 'cpt')
    op.drop_column('dt_intel_tech', 'tags')
