"""Add kind/parent_uuid to dt_intel_tech (역량 층)

Revision ID: a4d61c9e83b7
Revises: f1e83b7c5a92
Create Date: 2026-08-25 16:00:00.000000

⚠️⚠️ **왜 층을 나누나.** 도구 단위로만 두면 **사업부 비교가 원리적으로 불가능**하다 —
   MX 가 LS-DYNA 도입, VD 가 RADIOSS 도입이면 둘 다 「도입」인데 서로 다른 줄이라
   누가 앞섰는지 읽을 수 없다. 반대로 역량만 두면 소식이 안 걸린다 — 소식은
   「Ansys 가 LS-DYNA 에 X 추가」처럼 도구 이름으로 들어온다.

   실측(2026-08-25): 개발 자료 116개 중 **100개가 제품**이었고, 같은 일을 하는 도구가
   이미 3~4개씩 겹쳐 있었다(구조해석 4 · CFD 3 · 1D 4 · 이산사건 3).

⚠️ 기존 행은 전부 `tool` 이 된다. 부모 없는 도구는 레이더에 그대로 서므로 **화면이
   바뀌지 않는다** — 역량을 만들어 매달기 시작할 때부터 접힌다.
"""
from alembic import op
import sqlalchemy as sa


revision = 'a4d61c9e83b7'
down_revision = 'f1e83b7c5a92'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('dt_intel_tech',
                  sa.Column('kind', sa.String(length=16), nullable=False,
                            server_default='tool'))
    # ⚠️ FK 를 안 건다 — 역량이 지워져도 도구는 남아야 한다(부모 없는 도구가 된다).
    op.add_column('dt_intel_tech', sa.Column('parent_uuid', sa.String(length=36),
                                             nullable=True))
    op.create_index(op.f('ix_dt_intel_tech_kind'), 'dt_intel_tech', ['kind'])
    op.create_index(op.f('ix_dt_intel_tech_parent_uuid'), 'dt_intel_tech', ['parent_uuid'])


def downgrade():
    op.drop_index(op.f('ix_dt_intel_tech_parent_uuid'), table_name='dt_intel_tech')
    op.drop_index(op.f('ix_dt_intel_tech_kind'), table_name='dt_intel_tech')
    op.drop_column('dt_intel_tech', 'parent_uuid')
    op.drop_column('dt_intel_tech', 'kind')
