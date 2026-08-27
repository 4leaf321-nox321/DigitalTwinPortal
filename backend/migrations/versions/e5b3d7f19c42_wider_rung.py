"""묶음 축의 rung 이 길어졌다 — 칸 이름 40자로는 「시험 대체」 다섯 항목이 안 들어간다

set 축(자동화·시험 대체)은 rung 에 켠 항목들을 'reference,cause_analysis,screening,cert_gate,full'
꼴로 쌓는다(49자). 평가의 rung 과 이력의 before/after 를 120 으로 넓힌다. 값은 그대로.

Revision ID: e5b3d7f19c42
Revises: d4a9c2e57b18
"""
import sqlalchemy as sa
from alembic import op

revision = 'e5b3d7f19c42'
down_revision = 'd4a9c2e57b18'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('dt_maturity_assessment') as b:
        b.alter_column('rung', type_=sa.String(120), existing_type=sa.String(40))
    with op.batch_alter_table('dt_maturity_change') as b:
        b.alter_column('before', type_=sa.String(120), existing_type=sa.String(60))
        b.alter_column('after', type_=sa.String(120), existing_type=sa.String(60))


def downgrade():
    with op.batch_alter_table('dt_maturity_change') as b:
        b.alter_column('after', type_=sa.String(60), existing_type=sa.String(120))
        b.alter_column('before', type_=sa.String(60), existing_type=sa.String(120))
    with op.batch_alter_table('dt_maturity_assessment') as b:
        b.alter_column('rung', type_=sa.String(40), existing_type=sa.String(120))
