"""add links json column to spdm_modules

Revision ID: c3a7f1d2e5b8
Revises: b8c3e1f2a4d6
Create Date: 2026-02-20 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision = 'c3a7f1d2e5b8'
down_revision = 'b8c3e1f2a4d6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('spdm_modules', schema=None) as batch_op:
        batch_op.add_column(sa.Column('links', JSON, nullable=True, server_default='[]'))

    # 기존 데이터 마이그레이션: is_linked=True인 레코드의 레거시 필드를 links로 변환
    conn = op.get_bind()
    modules = conn.execute(
        sa.text("SELECT id, is_linked, link_system_from, link_system_to, link_method FROM spdm_modules WHERE is_linked = true AND link_system_from IS NOT NULL")
    ).fetchall()

    import json
    for mod in modules:
        links = [{'from': mod[2] or '', 'to': mod[3] or '', 'method': mod[4] or ''}]
        conn.execute(
            sa.text("UPDATE spdm_modules SET links = :links WHERE id = :id"),
            {'links': json.dumps(links), 'id': mod[0]}
        )


def downgrade():
    with op.batch_alter_table('spdm_modules', schema=None) as batch_op:
        batch_op.drop_column('links')
