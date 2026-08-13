"""Add kpi_criteria and kpi_attachments tables

Revision ID: f5a3b2e91c47
Revises: c4a1f8b2d703
Create Date: 2026-04-29 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'f5a3b2e91c47'
down_revision = 'c4a1f8b2d703'
branch_labels = None
depends_on = None


def upgrade():
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'kpi_criteria' not in existing_tables:
        op.create_table(
            'kpi_criteria',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('kpi', sa.String(length=200), nullable=False),
            sa.Column('criteria', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('kpi', name='uq_kpi_criteria_kpi'),
        )

    if 'kpi_attachments' not in existing_tables:
        op.create_table(
            'kpi_attachments',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('division', sa.String(length=50), nullable=False),
            sa.Column('kpi', sa.String(length=200), nullable=False),
            sa.Column('year', sa.Integer(), nullable=False),
            sa.Column('month', sa.String(length=10), nullable=False),
            sa.Column('original_filename', sa.String(length=255), nullable=False),
            sa.Column('stored_filename', sa.String(length=255), nullable=False),
            sa.Column('file_size', sa.Integer(), nullable=True, server_default='0'),
            sa.Column('mime_type', sa.String(length=100), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
        )


def downgrade():
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'kpi_attachments' in existing_tables:
        op.drop_table('kpi_attachments')
    if 'kpi_criteria' in existing_tables:
        op.drop_table('kpi_criteria')
