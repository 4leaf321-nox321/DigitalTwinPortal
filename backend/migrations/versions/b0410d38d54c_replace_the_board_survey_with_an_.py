"""replace the board survey with an independent survey module

Revision ID: b0410d38d54c
Revises: 298c0f1b8fb6
Create Date: 2026-08-15

협업 게시판의 설문 기능을 걷어내고, 그 이름(`surveys` 등)을 독립 설문 모듈이
가져온다. 스키마가 서로 많이 달라 **컬럼을 고치지 않고 표를 다시 만든다.**

⚠️ **게시판 설문 데이터는 여기서 사라진다.** 옮기지 않는 이유는 두 스키마가
   같은 것을 담고 있지 않기 때문이다 — 새 쪽은 대상(부서·역할·인원) 개념이
   있고 익명 정책이 고정이며 응답마다 소속을 복사해 둔다. 옛 행에는 그 값들이
   아예 없어서, 옮기면 전부 '알 수 없음'인 응답만 남는다.
   (2026-08-15 사용자 확인 후 진행. 개발 DB 기준 응답 4건.)

autogenerate 가 만든 ALTER 더미를 쓰지 않았다. 버릴 데이터를 보존하려고
컬럼을 하나씩 고치는 형태였는데, 되돌릴 수도 없고 중간에 실패하면 어느 쪽도
아닌 상태가 된다. 통째로 지우고 새로 만드는 편이 결과가 분명하다.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'b0410d38d54c'
down_revision = '298c0f1b8fb6'
branch_labels = None
depends_on = None


# 자식부터 지운다. FK 가 걸려 있어 순서가 틀리면 실패한다.
OLD_BOARD_TABLES = [
    'survey_answers', 'survey_responses', 'survey_questions', 'surveys',
]
OLD_STRATEGY_TABLES = [
    'strategy_survey_answer', 'strategy_survey_response',
    'strategy_survey_question', 'strategy_survey_access_log',
    'strategy_survey',
]


def upgrade():
    for table in OLD_BOARD_TABLES + OLD_STRATEGY_TABLES:
        op.execute(f'DROP TABLE IF EXISTS {table} CASCADE')

    op.create_table(
        'surveys',
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('context_type', sa.String(length=40), nullable=True),
        sa.Column('context_id', sa.Integer(), nullable=True),
        sa.Column('context_tag', sa.String(length=40), nullable=True),
        sa.Column('target_type', sa.String(length=20), nullable=False),
        sa.Column('target_refs', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('closes_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_surveys_context_type', 'surveys', ['context_type'])
    op.create_index('ix_surveys_context_id', 'surveys', ['context_id'])

    op.create_table(
        'survey_questions',
        sa.Column('survey_id', sa.Integer(), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('text', sa.String(length=500), nullable=False),
        sa.Column('help_text', sa.Text(), nullable=True),
        sa.Column('qtype', sa.String(length=20), nullable=False),
        sa.Column('required', sa.Boolean(), nullable=False),
        sa.Column('options', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('link_type', sa.String(length=40), nullable=True),
        sa.Column('link_key', sa.String(length=80), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['survey_id'], ['surveys.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_survey_questions_survey_id', 'survey_questions', ['survey_id'])

    op.create_table(
        'survey_responses',
        sa.Column('survey_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('department_name', sa.String(length=100), nullable=True),
        sa.Column('division_id', sa.Integer(), nullable=True),
        sa.Column('division_source', sa.String(length=20), nullable=False),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['survey_id'], ['surveys.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('survey_id', 'user_id', name='uq_survey_response_user'),
    )
    op.create_index('ix_survey_responses_survey_id', 'survey_responses', ['survey_id'])
    op.create_index('ix_survey_responses_user_id', 'survey_responses', ['user_id'])
    op.create_index('ix_survey_responses_division_id', 'survey_responses', ['division_id'])

    op.create_table(
        'survey_answers',
        sa.Column('response_id', sa.Integer(), nullable=False),
        sa.Column('question_id', sa.Integer(), nullable=False),
        sa.Column('value_number', sa.Float(), nullable=True),
        sa.Column('value_text', sa.Text(), nullable=True),
        sa.Column('value_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['response_id'], ['survey_responses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['question_id'], ['survey_questions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('response_id', 'question_id',
                            name='uq_survey_answer_response_question'),
    )
    op.create_index('ix_survey_answers_response_id', 'survey_answers', ['response_id'])
    op.create_index('ix_survey_answers_question_id', 'survey_answers', ['question_id'])

    op.create_table(
        'survey_access_logs',
        sa.Column('survey_id', sa.Integer(), nullable=False),
        sa.Column('viewer_id', sa.Integer(), nullable=False),
        sa.Column('response_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(length=30), nullable=False),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['survey_id'], ['surveys.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_survey_access_logs_survey_id', 'survey_access_logs', ['survey_id'])
    op.create_index('ix_survey_access_logs_viewer_id', 'survey_access_logs', ['viewer_id'])


def downgrade():
    """새 표만 지운다.

    게시판 설문 표는 **되살리지 않는다.** 스키마는 되돌릴 수 있어도 그 안에
    있던 응답은 이미 없다. 빈 껍데기를 만들어 두면 "되돌렸다"고 오해하게 된다.
    되살려야 한다면 백업에서 복원하는 것이 맞다.
    """
    for table in ['survey_access_logs', 'survey_answers', 'survey_responses',
                  'survey_questions', 'surveys']:
        op.execute(f'DROP TABLE IF EXISTS {table} CASCADE')
