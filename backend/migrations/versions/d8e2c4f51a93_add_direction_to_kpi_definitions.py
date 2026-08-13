"""Add direction (망대/망소) column to kpi_definitions

Revision ID: d8e2c4f51a93
Revises: f5a3b2e91c47
Create Date: 2026-06-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'd8e2c4f51a93'
down_revision = 'f5a3b2e91c47'
branch_labels = None
depends_on = None


# 망소 KPI 라벨 (낮을수록 좋음)
LOWER_IS_BETTER_LABELS = [
    '시험완료 Lead Time',
    '시험완료 leadtime',
    '시험완료 LeadTime',
    '시험 완료 Lead Time',
    '시험 완료 leadtime',
    '라인유실률',
    '라인 유실률',
]


def upgrade():
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)

    if 'kpi_definitions' not in inspector.get_table_names():
        return

    existing_cols = [c['name'] for c in inspector.get_columns('kpi_definitions')]
    if 'direction' not in existing_cols:
        op.add_column(
            'kpi_definitions',
            sa.Column(
                'direction', sa.String(length=10),
                nullable=False, server_default='higher'
            )
        )

    # 망소 KPI들을 'lower'로 업데이트
    # 라벨 표기 흔들림(공백 위치, 대소문자) 흡수하기 위해 LIKE 패턴 사용
    bind.execute(sa.text("""
        UPDATE kpi_definitions
        SET direction = 'lower'
        WHERE LOWER(REPLACE(label, ' ', '')) LIKE '%시험완료lead%'
           OR LOWER(REPLACE(label, ' ', '')) LIKE '%라인유실%'
    """))


def downgrade():
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)

    if 'kpi_definitions' not in inspector.get_table_names():
        return

    existing_cols = [c['name'] for c in inspector.get_columns('kpi_definitions')]
    if 'direction' in existing_cols:
        op.drop_column('kpi_definitions', 'direction')
