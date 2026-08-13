"""dt2 change proposals: allow performance target

제안 대기열을 **과제 전용에서 과제+성과**로 넓힌다.

왜
    성과의 핵심 필드(목표수준·현재수준 등)가 AI 에게 403 이었다. 확인 대기로도 가지
    않아 `confirm_change` 를 찾을 수조차 없었다. 그걸 과제와 같은 202 절차로 여는데,
    **성과는 과제에 속하지 않아서**(여러 과제가 공유한다) 담을 자리가 없었다.

무엇
    target_type       'project' | 'performance'  — 기존 행은 전부 'project'
    project_uuid      NOT NULL → NULL 허용
    performance_uuid  신규 (FK dt2_performances, ondelete CASCADE)

⚠️ `target_type` 을 두는 이유 — uuid 유무로 추론하면 둘 다 비었거나 둘 다 찬 행이
   생겼을 때 분기가 **조용히** 틀어진다. 대상 종류는 명시해서 읽는다.

Revision ID: 8c4d2b02a4a2
Revises: b7a3c1e05d92
Create Date: 2026-08-05 13:41:14.634968

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8c4d2b02a4a2'
down_revision = 'b7a3c1e05d92'
branch_labels = None
depends_on = None

# ⚠️ 제약 이름을 **직접 준다.** 자동 생성(None)에 맡기면 downgrade 의
#    drop_constraint(None) 이 이름을 못 찾아 실패한다.
_FK = 'fk_dt2_change_proposals_performance_uuid'


def upgrade():
    with op.batch_alter_table('dt2_change_proposals', schema=None) as batch_op:
        # server_default='project' 라 **기존 행이 전부 과제 제안으로 채워진다.**
        # 이게 없으면 NOT NULL 추가가 기존 행에서 실패한다.
        batch_op.add_column(sa.Column('target_type', sa.String(length=20),
                                      server_default='project', nullable=False))
        batch_op.add_column(sa.Column('performance_uuid', sa.String(length=64),
                                      nullable=True))
        batch_op.alter_column('project_uuid',
                              existing_type=sa.VARCHAR(length=64),
                              nullable=True)
        batch_op.create_index(batch_op.f('ix_dt2_change_proposals_performance_uuid'),
                              ['performance_uuid'], unique=False)
        batch_op.create_index(batch_op.f('ix_dt2_change_proposals_target_type'),
                              ['target_type'], unique=False)
        batch_op.create_foreign_key(_FK, 'dt2_performances',
                                    ['performance_uuid'], ['uuid'], ondelete='CASCADE')


def downgrade():
    # ⚠️ 되돌리기 전에 **성과 제안을 지운다.** 남겨 두면 project_uuid 를 NOT NULL 로
    #    되돌릴 때 그 행들이 NULL 이라 실패한다.
    op.execute("DELETE FROM dt2_change_proposals WHERE target_type = 'performance'")
    with op.batch_alter_table('dt2_change_proposals', schema=None) as batch_op:
        batch_op.drop_constraint(_FK, type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_dt2_change_proposals_target_type'))
        batch_op.drop_index(batch_op.f('ix_dt2_change_proposals_performance_uuid'))
        batch_op.alter_column('project_uuid',
                              existing_type=sa.VARCHAR(length=64),
                              nullable=False)
        batch_op.drop_column('performance_uuid')
        batch_op.drop_column('target_type')
