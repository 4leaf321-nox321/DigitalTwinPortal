"""Add kpi_definitions table and fraction columns

Revision ID: d1f9a2c8b401
Revises: fc4f7fa4863a
Create Date: 2026-04-28 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'd1f9a2c8b401'
down_revision = 'fc4f7fa4863a'
branch_labels = None
depends_on = None


def upgrade():
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)

    # 1. kpi_definitions 테이블
    if 'kpi_definitions' not in inspector.get_table_names():
        op.create_table('kpi_definitions',
            sa.Column('label', sa.String(length=200), nullable=False),
            sa.Column('category', sa.String(length=50), nullable=False, server_default=''),
            sa.Column('unit', sa.String(length=20), nullable=True, server_default=''),
            sa.Column('value_type', sa.String(length=20), nullable=False, server_default='single'),
            sa.Column('divisions', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('sort_order', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('label', name='uq_kpi_definitions_label'),
        )

    # 2. kpi_records: numerator/denominator 컬럼 추가
    record_cols = {c['name'] for c in inspector.get_columns('kpi_records')} if 'kpi_records' in inspector.get_table_names() else set()
    if 'kpi_records' in inspector.get_table_names():
        with op.batch_alter_table('kpi_records') as batch:
            if 'numerator' not in record_cols:
                batch.add_column(sa.Column('numerator', sa.String(length=100), nullable=True))
            if 'denominator' not in record_cols:
                batch.add_column(sa.Column('denominator', sa.String(length=100), nullable=True))

    # 3. kpi_targets: target_numerator/target_denominator 컬럼 추가
    target_cols = {c['name'] for c in inspector.get_columns('kpi_targets')} if 'kpi_targets' in inspector.get_table_names() else set()
    if 'kpi_targets' in inspector.get_table_names():
        with op.batch_alter_table('kpi_targets') as batch:
            if 'target_numerator' not in target_cols:
                batch.add_column(sa.Column('target_numerator', sa.String(length=100), nullable=True))
            if 'target_denominator' not in target_cols:
                batch.add_column(sa.Column('target_denominator', sa.String(length=100), nullable=True))


def downgrade():
    with op.batch_alter_table('kpi_targets') as batch:
        batch.drop_column('target_denominator')
        batch.drop_column('target_numerator')
    with op.batch_alter_table('kpi_records') as batch:
        batch.drop_column('denominator')
        batch.drop_column('numerator')
    op.drop_table('kpi_definitions')
