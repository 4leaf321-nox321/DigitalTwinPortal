"""공장 최적화 — 대상에 「법인」

대상은 **법인 × 라인**이다(2026-09-02). 공정 단계는 배치·물류·계획 같은 결정 단위로 너무
잘고, 법인만으로는 너무 굵다 — 같은 법인 안에서도 라인마다 트윈 유무가 갈린다.
라인은 모니터링의 `line` 을 같이 쓰고, 법인만 새 칸이다.

Revision ID: b7d2e4f6a915
Revises: a1c7e3f04b21
"""
import sqlalchemy as sa
from alembic import op

revision = 'b7d2e4f6a915'
down_revision = 'a1c7e3f04b21'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('dt_maturity_subject', sa.Column('site', sa.String(120), nullable=True))


def downgrade():
    op.drop_column('dt_maturity_subject', 'site')
