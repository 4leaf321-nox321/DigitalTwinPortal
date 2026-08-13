"""dt2_projects 에 pl_knox_id / author_knox_id 추가 (과제PL·작성자 계정 연결)

과제PL·작성자는 지금까지 이름 문자열뿐이라 어느 계정인지 알 수 없었다.
화면의 자동완성이 사용자를 고르게 해 놓고도 `user.name` 만 저장하고 email 을 버렸다.

knoxId(사내 이메일 @앞부분 = users.email 로컬파트)를 같이 저장해 계정과 잇는다.
users.id FK 가 아닌 이유: SSO 가 없어 본인이 직접 가입해야 하는데, knoxId 는
**가입 전에도 미리 채워둘 수 있고** 가입하는 순간 연결된다. FK 는 없는 행을
가리킬 수 없다 (members_json 이 knoxId 를 쓰는 것과 같은 이유).

pl_knox_id 는 편집 권한을 부여한다(can_edit_project → is_project_pl).
author_knox_id 는 표시 전용이다.

기존 행은 NULL 로 남는다 — 이름만으로 계정을 되짚으면 동명이인에게 권한이
갈 수 있어 **자동 채움을 하지 않는다.** 사람이 화면에서 고르며 채운다.

Revision ID: d4e19f7c2b83
Revises: e6c73b90a1d5
Create Date: 2026-08-02

"""
from alembic import op
import sqlalchemy as sa


revision = 'd4e19f7c2b83'
down_revision = 'e6c73b90a1d5'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('dt2_projects', schema=None) as batch_op:
        batch_op.add_column(sa.Column('pl_knox_id', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('author_knox_id', sa.String(length=100), nullable=True))
    # 권한 판정(member_sql_condition)이 목록 조회마다 이 열을 lower() 로 비교한다.
    op.create_index('ix_dt2_projects_pl_knox_id', 'dt2_projects',
                    [sa.text('lower(btrim(pl_knox_id))')], unique=False)


def downgrade():
    op.drop_index('ix_dt2_projects_pl_knox_id', table_name='dt2_projects')
    with op.batch_alter_table('dt2_projects', schema=None) as batch_op:
        batch_op.drop_column('author_knox_id')
        batch_op.drop_column('pl_knox_id')
