"""add dt2_performances.created_by_user_id

성과에는 소유자 개념이 없다(전사 공용, 여러 과제가 참조).
편집 권한은 "연결된 과제를 고칠 수 있으면 성과도" 규칙을 쓰는데,
막 만들어 아직 아무 과제에도 안 붙은 성과는 그 규칙으로 아무도 못 고친다.
그 구멍만 메우기 위해 생성자를 기록한다.

nullable 컬럼 추가만 한다. 기존 596행은 NULL 로 남고 동작에 지장 없다
(그 성과들은 이미 과제에 붙어 있거나 admin/dt_office 가 다룬다).

Revision ID: e2c73f8a15b6
Revises: d4a91f2b6c07
Create Date: 2026-07-29

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e2c73f8a15b6'
down_revision = 'd4a91f2b6c07'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('dt2_performances',
                  sa.Column('created_by_user_id', sa.Integer(), nullable=True))
    op.create_index('ix_dt2_performances_created_by_user_id',
                    'dt2_performances', ['created_by_user_id'])
    op.create_foreign_key('fk_dt2_performances_created_by', 'dt2_performances',
                          'users', ['created_by_user_id'], ['id'])


def downgrade():
    op.drop_constraint('fk_dt2_performances_created_by', 'dt2_performances',
                       type_='foreignkey')
    op.drop_index('ix_dt2_performances_created_by_user_id',
                  table_name='dt2_performances')
    op.drop_column('dt2_performances', 'created_by_user_id')
