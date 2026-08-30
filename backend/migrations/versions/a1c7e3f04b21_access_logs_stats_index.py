"""접속 이력 집계용 인덱스

조회수 현황이 (action, created_at) 로 묶어 세는데 인덱스가 없어 매번 전체를 훑었다.
지금은 몇천 줄이라 티가 안 나지만, 이력은 사람 수가 아니라 **클릭 수**로 는다.

Revision ID: a1c7e3f04b21
Revises: c4a71fb8d902
Create Date: 2026-08-30
"""
from alembic import op

revision = 'a1c7e3f04b21'
down_revision = 'c4a71fb8d902'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index('ix_access_logs_action_created', 'access_logs', ['action', 'created_at'])


def downgrade():
    op.drop_index('ix_access_logs_action_created', table_name='access_logs')
