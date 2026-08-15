"""add survey role and process branching

Revision ID: c691452a8cae
Revises: b0410d38d54c
Create Date: 2026-08-15

한 설문 안에서 **역할과 프로세스에 따라 다른 문항**을 묻기 위한 칸을 붙인다.
과제 멤버 / PL / 사업부 사무국 / 사무국장이 서로 다른 것을 답하고, 프로세스
(개발·제조·품질·연계)에 따라서도 갈린다.

  surveys.roles / processes                  설문이 응답자에게 물을 선택지
  survey_questions.section                   문항 묶음 이름(화면 소제목)
  survey_questions.audience_roles / _processes  이 문항을 볼 사람
  survey_responses.respondent_role / _process   응답자가 고른 값

── 기본값이 왜 `'[]'` 인가 ────────────────────────────────────────────────
**빈 배열은 '전원'이라는 뜻이다.** 그래서 이미 있는 문항은 전부 `[]` 로
채워야 지금까지처럼 모두에게 보인다. 만약 NULL 로 두고 코드가 그걸 '아무도'로
읽으면, 이 마이그레이션 하나로 **기존 설문이 전부 답할 수 없는 상태**가 된다.

server_default 를 남겨 두는 것도 같은 이유다. autogenerate 는 지우라고 하지
않고(compare_server_default 가 꺼져 있다), 마이그레이션·수기 INSERT 같이 ORM 을
안 거치는 경로에서 NULL 이 들어오는 것을 DB 가 직접 막아 준다.

⚠️ NOT NULL 을 server_default 없이 붙이면 **행이 이미 있는 표에서는 ALTER 가
   실패한다.** autogenerate 가 만든 원본이 그 상태였다. 테스트 DB 는 매번
   create_all 로 비어 있게 만들어져서 CI 로는 절대 안 잡힌다 — 운영에서만
   터진다.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'c691452a8cae'
down_revision = 'b0410d38d54c'
branch_labels = None
depends_on = None


# 빈 배열 = 제한 없음. 이 값이 이 마이그레이션의 요점이다.
EMPTY_LIST = sa.text("'[]'::json")


def _json_list(name):
    return sa.Column(
        name, postgresql.JSON(astext_type=sa.Text()),
        nullable=False, server_default=EMPTY_LIST,
    )


def upgrade():
    # 설문이 물을 축. 비어 있으면 응답자에게 그 선택을 묻지 않는다.
    op.add_column('surveys', _json_list('roles'))
    op.add_column('surveys', _json_list('processes'))

    # 문항 묶음 이름. 표로 수십 문항을 한꺼번에 넣으면 소제목이 없이는
    # 응답자가 어디까지가 한 덩어리인지 모른다.
    op.add_column('survey_questions',
                  sa.Column('section', sa.String(length=100), nullable=True))
    # 이 문항을 볼 사람. **빈 배열이면 전원** — 기존 문항이 여기에 해당한다.
    op.add_column('survey_questions', _json_list('audience_roles'))
    op.add_column('survey_questions', _json_list('audience_processes'))

    # 응답자가 고른 값. 안 고른(=묻지 않은) 응답은 NULL 로 남고, 집계에서
    # '미지정'으로 따로 센다. 아무 역할에나 넣으면 그 역할 평균이 거짓말을 한다.
    op.add_column('survey_responses',
                  sa.Column('respondent_role', sa.String(length=50), nullable=True))
    op.add_column('survey_responses',
                  sa.Column('respondent_process', sa.String(length=50), nullable=True))


def downgrade():
    """칸만 지운다.

    ⚠️ 되돌리면 **역할·프로세스 분기 정보와 응답자가 고른 축이 사라진다.**
       칸을 지우는 것이라 복구할 방법이 없다. 스키마는 되돌아가도 그 설문이
       누구에게 무엇을 물었는지는 돌아오지 않는다.
    """
    op.drop_column('survey_responses', 'respondent_process')
    op.drop_column('survey_responses', 'respondent_role')

    op.drop_column('survey_questions', 'audience_processes')
    op.drop_column('survey_questions', 'audience_roles')
    op.drop_column('survey_questions', 'section')

    op.drop_column('surveys', 'processes')
    op.drop_column('surveys', 'roles')
