"""Add dt_intel tables (디지털 트윈 기술정보 — 소식 + 기술 레이더)

Revision ID: c3a71e4b9d28
Revises: b7d4e21a9c36
Create Date: 2026-08-25 10:00:00.000000

표 넷 —
    dt_intel_news       바깥 소식 하나
    dt_intel_tech       기술 레이더 한 줄
    dt_intel_evidence   소식 → 기술 근거. **이 표가 레이더를 살린다**
    dt_intel_links      소식·기술 → 과제/KPI/보유SW

⚠️ evidence·links 에 **FK 를 걸지 않는다.** 소식이 지워져도 "그때 이런 근거가
   있었다" 는 남아야 하고, 연결 대상(과제 uuid · KPI id · SW id)은 타입이 제각각이라
   한 컬럼으로 받는다. `dt_investment_changes` 가 FK 를 안 거는 것과 같은 판단이다.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'c3a71e4b9d28'
down_revision = 'b7d4e21a9c36'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'dt_intel_news',
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('source', sa.String(length=200), nullable=True),
        sa.Column('url', sa.String(length=1000), nullable=True),
        # ⚠️ created_at 과 **다른 것**이다. 옛 글도 뒤늦게 들어온다.
        sa.Column('published_at', sa.Date(), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('divisions', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        # ui | mcp | file | llm — 어디로 들어왔나. 품질이 달라 반드시 구분한다.
        sa.Column('origin', sa.String(length=20), nullable=False, server_default='ui'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='신규'),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid'),
    )
    op.create_index(op.f('ix_dt_intel_news_uuid'), 'dt_intel_news', ['uuid'])
    op.create_index(op.f('ix_dt_intel_news_published_at'), 'dt_intel_news', ['published_at'])
    op.create_index(op.f('ix_dt_intel_news_category'), 'dt_intel_news', ['category'])
    op.create_index(op.f('ix_dt_intel_news_origin'), 'dt_intel_news', ['origin'])
    op.create_index(op.f('ix_dt_intel_news_status'), 'dt_intel_news', ['status'])
    op.create_index(op.f('ix_dt_intel_news_created_by'), 'dt_intel_news', ['created_by'])
    # 목록의 기본 정렬(발표일 내림차순)을 그대로 받는 인덱스.
    op.create_index('ix_dt_intel_news_pub_desc', 'dt_intel_news', ['published_at', 'id'])

    op.create_table(
        'dt_intel_tech',
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=300), nullable=False),
        # 같은 기술이 기사마다 다른 이름으로 나온다. 별칭이 없으면 레이더가
        # 잡동사니가 된다.
        sa.Column('aliases', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('vendor', sa.String(length=300), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=True),
        # 도입 / 시험 / 관찰 / 보류
        sa.Column('stage', sa.String(length=20), nullable=False, server_default='관찰'),
        # ⚠️ '보류' 의 이유가 특히 중요하다. 안 남기면 6개월 뒤 같은 논의를 다시 한다.
        sa.Column('stage_reason', sa.Text(), nullable=True),
        sa.Column('stage_changed_at', sa.DateTime(), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('divisions', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('origin', sa.String(length=20), nullable=False, server_default='ui'),
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid'),
    )
    op.create_index(op.f('ix_dt_intel_tech_uuid'), 'dt_intel_tech', ['uuid'])
    op.create_index(op.f('ix_dt_intel_tech_category'), 'dt_intel_tech', ['category'])
    op.create_index(op.f('ix_dt_intel_tech_stage'), 'dt_intel_tech', ['stage'])
    op.create_index(op.f('ix_dt_intel_tech_origin'), 'dt_intel_tech', ['origin'])
    op.create_index(op.f('ix_dt_intel_tech_is_archived'), 'dt_intel_tech', ['is_archived'])
    op.create_index(op.f('ix_dt_intel_tech_created_by'), 'dt_intel_tech', ['created_by'])

    op.create_table(
        'dt_intel_evidence',
        sa.Column('news_uuid', sa.String(length=36), nullable=False),
        sa.Column('tech_uuid', sa.String(length=36), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('source', sa.String(length=20), nullable=False, server_default='ui'),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('news_uuid', 'tech_uuid', name='uq_dt_intel_evidence'),
    )
    op.create_index(op.f('ix_dt_intel_evidence_news_uuid'), 'dt_intel_evidence', ['news_uuid'])
    op.create_index(op.f('ix_dt_intel_evidence_tech_uuid'), 'dt_intel_evidence', ['tech_uuid'])
    op.create_index(op.f('ix_dt_intel_evidence_created_by'), 'dt_intel_evidence', ['created_by'])

    op.create_table(
        'dt_intel_links',
        sa.Column('subject_kind', sa.String(length=10), nullable=False),   # news | tech
        sa.Column('subject_uuid', sa.String(length=36), nullable=False),
        sa.Column('target_kind', sa.String(length=20), nullable=False),    # project | kpi | sw
        # 과제는 uuid, KPI 는 정의 id, SW 는 id — 타입이 제각각이라 문자열로 받는다.
        sa.Column('target_ref', sa.String(length=64), nullable=False),
        sa.Column('relevance', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('source', sa.String(length=20), nullable=False, server_default='ui'),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('subject_kind', 'subject_uuid', 'target_kind', 'target_ref',
                            name='uq_dt_intel_link'),
    )
    op.create_index(op.f('ix_dt_intel_links_subject_kind'), 'dt_intel_links', ['subject_kind'])
    op.create_index(op.f('ix_dt_intel_links_subject_uuid'), 'dt_intel_links', ['subject_uuid'])
    op.create_index(op.f('ix_dt_intel_links_target_kind'), 'dt_intel_links', ['target_kind'])
    op.create_index(op.f('ix_dt_intel_links_target_ref'), 'dt_intel_links', ['target_ref'])
    op.create_index(op.f('ix_dt_intel_links_created_by'), 'dt_intel_links', ['created_by'])


def downgrade():
    # ⚠️ 되돌리면 **모아 둔 소식과 레이더가 통째로 사라진다.** 바깥에서 조사해 넣은
    #    것이라 다시 만들 방법이 없다. 되돌릴 일이 생기면 백업 복원을 먼저 볼 것.
    op.drop_table('dt_intel_links')
    op.drop_table('dt_intel_evidence')
    op.drop_table('dt_intel_tech')
    op.drop_table('dt_intel_news')
