"""시뮬레이션에 「수행 디지털 트윈 과제」 — 대시보드 과제를 여럿 매단다

한 시뮬레이션을 여러 과제가 함께 키우기도 하고(예: 낙하 해석이 자동화 과제와 정확도 과제에
같이 걸린다), 한 과제가 여러 시뮬레이션을 건드리기도 한다. 그래서 하나가 아니라 목록이다.

옛 `project_uuid`(하나)는 그대로 두고 목록으로 옮겨 담는다 — 엑셀 들여오기가 아직 그 칸을 쓴다.
FK 는 아니다. 대시보드 과제 표가 갈려도 여기가 안 깨지게 uuid 만 든다(department_id 와 같은 결).

Revision ID: e1b9c7a25d08
Revises: d0a8b6f14c97
"""
import sqlalchemy as sa
from alembic import op

revision = 'e1b9c7a25d08'
down_revision = 'd0a8b6f14c97'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('dt_maturity_agent', sa.Column('project_uuids', sa.JSON(), nullable=True))
    op.execute("UPDATE dt_maturity_agent SET project_uuids = json_build_array(project_uuid)::json "
               "WHERE project_uuid IS NOT NULL AND project_uuid <> ''")


def downgrade():
    op.drop_column('dt_maturity_agent', 'project_uuids')
