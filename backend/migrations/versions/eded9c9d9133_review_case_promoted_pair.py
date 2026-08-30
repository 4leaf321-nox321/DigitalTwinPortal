"""해석 활용 기록 — 상시 항목으로 올라간 연계를 기록이 스스로 안다(2026-08-30)

이름으로 뒤를 밟으면 **올릴 때 이름을 고치는 순간** 끊긴다(기록의 「모서리 낙하」 →
시험 항목 「모서리 낙하 시험」). 그래서 건마다 올라간 연계를 적어 둔다.

⚠️ FK 가 아니다. 연계를 지워도 기록은 남아야 한다 — 기록은 사건이고 연계는 상태다.
⚠️ 자동 생성이 다른 모듈의 인덱스·null 여부까지 끌고 왔다. **이 칸 하나만** 남겼다.

Revision ID: eded9c9d9133
Revises: f2c8d6b39e14
Create Date: 2026-08-30 09:55:23.439256
"""
from alembic import op
import sqlalchemy as sa

revision = 'eded9c9d9133'
down_revision = 'f2c8d6b39e14'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('dt_maturity_review_case', schema=None) as batch_op:
        batch_op.add_column(sa.Column('promoted_pair_id', sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f('ix_dt_maturity_review_case_promoted_pair_id'),
                              ['promoted_pair_id'], unique=False)


def downgrade():
    with op.batch_alter_table('dt_maturity_review_case', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_dt_maturity_review_case_promoted_pair_id'))
        batch_op.drop_column('promoted_pair_id')
