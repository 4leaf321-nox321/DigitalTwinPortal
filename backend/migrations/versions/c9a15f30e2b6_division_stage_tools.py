"""사업부 줄에 「무엇으로 하나」와 「왜」를 담는다

⚠️⚠️ **`stage` 를 nullable 로 연다.** 전사와 **같은 단계**인 사업부도 「우리는
   LS-DYNA 를 쓴다」를 적을 자리가 있어야 하기 때문이다. 예외를 만들어야만 도구를
   적을 수 있으면, 가장 흔한 경우(전사 도입 · 우리도 도입 · 도구는 LS-DYNA)를
   아예 못 적는다.

       stage = NULL   전사를 따른다. 전사가 움직이면 같이 움직인다
       stage = '도입'  전사와 다르게 본다 (예외)

⚠️ 표가 어제 나갔고 운영에는 아직 한 줄도 없다. 지금 여는 것이 가장 싸다.

Revision ID: c9a15f30e2b6
Revises: b8f27e04c1a5
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = 'c9a15f30e2b6'
down_revision = 'b8f27e04c1a5'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('dt_intel_division_stage', 'stage',
                    existing_type=sa.String(length=10), nullable=True)
    # 그 사업부가 이 역량을 **무엇으로** 하나. 기술 uuid 목록.
    # ⚠️ FK 를 안 건다 — 도구가 지워져도 줄은 남아야 하고, 읽을 때 없는 것은 버린다.
    op.add_column('dt_intel_division_stage',
                  sa.Column('tools', postgresql.JSONB(astext_type=sa.Text()),
                            nullable=True, server_default='[]'))


def downgrade():
    op.drop_column('dt_intel_division_stage', 'tools')
    # ⚠️ 되돌리려면 전사를 따르는 줄(stage IS NULL)을 먼저 지워야 한다 —
    #    그 줄들은 예전 구조에 자리가 없다.
    op.execute('DELETE FROM dt_intel_division_stage WHERE stage IS NULL')
    op.alter_column('dt_intel_division_stage', 'stage',
                    existing_type=sa.String(length=10), nullable=False)
