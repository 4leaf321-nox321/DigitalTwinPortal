"""도구에서도 단계를 걷어낸다 — 단계는 사업부 줄에만 산다

⚠️⚠️ 역량은 앞서 걷어냈다(e3f0a25b7d41). 도구는 「제품이 우리 손에 어디까지 들어와
   있나라 하나로 말이 된다」는 이유로 남겨 뒀는데, **자료가 그 말을 안 받쳐 줬다**:
   도구 547개가 전부 「감지」였고(씨뿌리기 기본값) 사람이 옮긴 기록이 **0건**이었다.
   값이 하나뿐이니 정보가 없다.

   논리도 역량과 똑같다 — MX 는 Ansys 계약이 있고 VD 는 없으면 「우리가 Ansys 를
   도입했나」에 하나의 답이 없다.

⚠️ **잃는 자료가 없다.** 도구의 자리는 이제 그 도구를 「무엇으로 하나」에 적은
   사업부 줄에서 온다(`division_marks`) — 없던 것을 만드는 게 아니라 이미 적혀 있는
   것을 거꾸로 읽는다. 지우는 값은 전부 씨뿌리기 기본값 하나뿐이다.

⚠️ 되돌리면 전부 「감지」로 놓는다. 원래도 그 값 하나였으니 잃는 것이 없다.

Revision ID: a7d3e51f8c02
Revises: f4a1c62d90e7
"""
import sqlalchemy as sa
from alembic import op

revision = 'a7d3e51f8c02'
down_revision = 'f4a1c62d90e7'
branch_labels = None
depends_on = None


def upgrade():
    op.get_bind().execute(sa.text(
        'UPDATE dt_intel_tech SET stage = NULL, stage_reason = NULL '
        'WHERE stage IS NOT NULL OR stage_reason IS NOT NULL'))


def downgrade():
    op.get_bind().execute(sa.text(
        "UPDATE dt_intel_tech SET stage = '감지' "
        "WHERE kind <> 'capability' AND stage IS NULL"))
