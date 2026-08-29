"""제조 모니터링 — 대상에 「라인·사업장」과 「공정 단계」

대상은 설비 개체가 아니라 **라인 × 공정 단계**다(PLAN-monitoring 2-2). 설비 개체로 두면
사업부마다 다른 설비 수백 대를 세워야 하고 교체할 때마다 줄과 이력이 사라진다.
같은 공정의 설비 사이 차이는 근거의 비율(「상태 8/12대」)로 받는다.

공정은 코드가 주는 표준 어휘(definitions.PROCESS_STEPS)에서 고른다 — 라인 이름이 갈려도
공정끼리는 비교돼야 하기 때문이다. 없는 공정은 직접 적는다(그래서 FK 가 아니라 문자열).

Revision ID: f2c8d6b39e14
Revises: e1b9c7a25d08
"""
import sqlalchemy as sa
from alembic import op

revision = 'f2c8d6b39e14'
down_revision = 'e1b9c7a25d08'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('dt_maturity_subject', sa.Column('line', sa.String(200), nullable=True))
    op.add_column('dt_maturity_subject', sa.Column('process', sa.String(60), nullable=True))


def downgrade():
    op.drop_column('dt_maturity_subject', 'process')
    op.drop_column('dt_maturity_subject', 'line')
