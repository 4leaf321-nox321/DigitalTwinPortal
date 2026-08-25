"""도구 ↔ 역량을 **연결 표**로 — 한 도구가 여러 역량에 걸친다

⚠️⚠️ `dt_intel_tech.parent_uuid` 칸 하나로는 「MATLAB 은 1D 시스템이면서 제어
   검증이기도 하다」를 적을 수 없었다. 자료로 세어 보니 도구 546개 중 **58개(11%)**
   가 두 역량 이상에 걸쳤다.

⚠️ **있던 값을 먼저 옮기고 칸을 지운다.** 순서가 바뀌면 매달림이 통째로 사라지고,
   그 도구들이 전부 미아가 되어 레이더에 쏟아진다.

⚠️ 되돌리기는 **첫 연결 하나만** 남길 수밖에 없다(칸이 하나다). 그래서 되돌리면
   걸쳐 있던 정보가 준다 — 그 사실을 아래에 적어 둔다.

Revision ID: d2b8f1a47c93
Revises: c9a15f30e2b6
"""
import sqlalchemy as sa
from alembic import op

revision = 'd2b8f1a47c93'
down_revision = 'c9a15f30e2b6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'dt_intel_tech_capability',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tech_uuid', sa.String(length=36), nullable=False),
        sa.Column('capability_uuid', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        # ⚠️ 같은 짝이 두 줄이면 「도구 3개」가 4개로 세어진다.
        sa.UniqueConstraint('tech_uuid', 'capability_uuid',
                            name='uq_intel_tech_capability'),
    )
    op.create_index('ix_dt_intel_tech_capability_tech_uuid',
                    'dt_intel_tech_capability', ['tech_uuid'])
    op.create_index('ix_dt_intel_tech_capability_capability_uuid',
                    'dt_intel_tech_capability', ['capability_uuid'])

    # ⚠️ **먼저 옮긴다.** 지우고 나면 되살릴 데가 없다.
    op.execute("""
        INSERT INTO dt_intel_tech_capability
            (tech_uuid, capability_uuid, created_at, updated_at)
        SELECT uuid, parent_uuid, NOW(), NOW()
          FROM dt_intel_tech
         WHERE parent_uuid IS NOT NULL
    """)

    op.drop_index('ix_dt_intel_tech_parent_uuid', table_name='dt_intel_tech')
    op.drop_column('dt_intel_tech', 'parent_uuid')


def downgrade():
    op.add_column('dt_intel_tech',
                  sa.Column('parent_uuid', sa.String(length=36), nullable=True))
    op.create_index('ix_dt_intel_tech_parent_uuid', 'dt_intel_tech',
                    ['parent_uuid'])
    # ⚠️ 칸이 하나라 **첫 연결만** 되돌아온다 — 걸쳐 있던 나머지는 잃는다.
    op.execute("""
        UPDATE dt_intel_tech t
           SET parent_uuid = (
                 SELECT l.capability_uuid
                   FROM dt_intel_tech_capability l
                  WHERE l.tech_uuid = t.uuid
                  ORDER BY l.id ASC
                  LIMIT 1)
    """)
    op.drop_index('ix_dt_intel_tech_capability_capability_uuid',
                  table_name='dt_intel_tech_capability')
    op.drop_index('ix_dt_intel_tech_capability_tech_uuid',
                  table_name='dt_intel_tech_capability')
    op.drop_table('dt_intel_tech_capability')
