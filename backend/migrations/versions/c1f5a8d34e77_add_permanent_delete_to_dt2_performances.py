"""dt2 performances: add permanent delete

성과에 **영구 삭제**를 넣는다. 과제(dt2_projects)와 같은 모양이다.

왜
    성과는 소프트 삭제밖에 없었다(`is_deleted`). 그래서 휴지통 화면을 만들자마자
    문제가 드러났다 — 이관·시험 잔재 638건이 영원히 휴지통에 남아, 정작 되살려야 할
    성과를 찾을 수 없게 된다. 치울 방법이 필요하다.

왜 행을 지우지 않나
    과제의 영구 삭제와 같은 판단이다. 행을 지우면 `dt2_performance_history` 의
    이력이 가리키는 대상이 사라지고(그쪽은 FK 가 없어 CASCADE 도 안 걸린다),
    "지워진 그 성과가 뭐였나" 를 나중에 답할 수 없다.
    **휴지통에서 빼는 것이 목적이지 기록을 없애는 것이 아니다.**

무엇
    is_permanently_deleted      NOT NULL, 기본 false (기존 행은 전부 false)
    permanently_deleted_at      언제
    permanently_deleted_by_raw  누가 (knoxId 등 원본 식별자)
    permanently_deleted_by_name 누가 (이름 — 계정이 지워져도 남는다)

⚠️ 인덱스를 **모델에도 선언**했다. 마이그레이션에만 두면 다음 `flask db migrate` 가
   "모델에 없는 인덱스" 로 보고 drop_index 를 끼워 넣는다(dt2_projects 에서 겪었다).

Revision ID: c1f5a8d34e77
Revises: 8c4d2b02a4a2
Create Date: 2026-08-06 15:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c1f5a8d34e77'
down_revision = '8c4d2b02a4a2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('dt2_performances', schema=None) as batch_op:
        # server_default='false' 라 **기존 750행이 전부 false 로 채워진다.**
        # 이게 없으면 NOT NULL 추가가 기존 행에서 실패한다.
        batch_op.add_column(sa.Column('is_permanently_deleted', sa.Boolean(),
                                      server_default='false', nullable=False))
        batch_op.add_column(sa.Column('permanently_deleted_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('permanently_deleted_by_raw', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('permanently_deleted_by_name', sa.String(length=100), nullable=True))
        batch_op.create_index(batch_op.f('ix_dt2_performances_is_permanently_deleted'),
                              ['is_permanently_deleted'], unique=False)


def downgrade():
    with op.batch_alter_table('dt2_performances', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_dt2_performances_is_permanently_deleted'))
        batch_op.drop_column('permanently_deleted_by_name')
        batch_op.drop_column('permanently_deleted_by_raw')
        batch_op.drop_column('permanently_deleted_at')
        batch_op.drop_column('is_permanently_deleted')
