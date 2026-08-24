"""Add url to dt_intel_tech (기술 레이더 항목의 공식 문서 주소)

Revision ID: d5b82f6c1a94
Revises: c3a71e4b9d28
Create Date: 2026-08-25 12:00:00.000000

왜 필요했나
    소식에는 `url`(원문)이 있는데 기술에는 없었다. 레이더의 목적이 **참고**인데,
    이름과 요약만 있으면 더 알아보려고 결국 검색을 다시 해야 한다. 공식 문서 주소가
    레이더 항목에서 가장 자주 눌리는 칸이 된다.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd5b82f6c1a94'
down_revision = 'c3a71e4b9d28'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('dt_intel_tech', sa.Column('url', sa.String(length=1000), nullable=True))


def downgrade():
    op.drop_column('dt_intel_tech', 'url')
