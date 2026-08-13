"""rename category to categories as JSON array

Revision ID: b8c3e1f2a4d6
Revises: 037f84e8184e
Create Date: 2026-02-19 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision = 'b8c3e1f2a4d6'
down_revision = '037f84e8184e'
branch_labels = None
depends_on = None


def upgrade():
    # 1. 새 JSON 컬럼 추가
    with op.batch_alter_table('spdm_modules', schema=None) as batch_op:
        batch_op.add_column(sa.Column('categories', JSON, nullable=True))

    # 2. 기존 category 값을 categories 배열로 마이그레이션
    conn = op.get_bind()
    modules = conn.execute(sa.text("SELECT id, category FROM spdm_modules WHERE category IS NOT NULL AND category != ''"))
    for row in modules:
        # 단일 카테고리 문자열을 JSON 배열로 변환
        import json
        categories_json = json.dumps([row[1]])
        conn.execute(
            sa.text("UPDATE spdm_modules SET categories = :cats WHERE id = :id"),
            {"cats": categories_json, "id": row[0]}
        )
    # NULL인 경우 빈 배열로 설정
    conn.execute(sa.text("UPDATE spdm_modules SET categories = '[]' WHERE categories IS NULL"))

    # 3. 기존 category 컬럼 삭제
    with op.batch_alter_table('spdm_modules', schema=None) as batch_op:
        batch_op.drop_column('category')


def downgrade():
    # 1. category 컬럼 복원
    with op.batch_alter_table('spdm_modules', schema=None) as batch_op:
        batch_op.add_column(sa.Column('category', sa.String(length=100), nullable=True))

    # 2. categories 배열의 첫 번째 값을 category로 복원
    conn = op.get_bind()
    modules = conn.execute(sa.text("SELECT id, categories FROM spdm_modules WHERE categories IS NOT NULL"))
    for row in modules:
        import json
        try:
            cats = json.loads(row[1]) if isinstance(row[1], str) else row[1]
            if cats and len(cats) > 0:
                conn.execute(
                    sa.text("UPDATE spdm_modules SET category = :cat WHERE id = :id"),
                    {"cat": cats[0], "id": row[0]}
                )
        except (json.JSONDecodeError, TypeError):
            pass

    # 3. categories 컬럼 삭제
    with op.batch_alter_table('spdm_modules', schema=None) as batch_op:
        batch_op.drop_column('categories')
