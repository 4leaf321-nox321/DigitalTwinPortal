"""역량에 남은 옛 「단계 이유」를 지운다

⚠️ 앞선 옮김(e3f0a25b7d41)이 역량의 `stage` 만 비우고 `stage_reason` 은 그대로 뒀다.
   역량은 이제 단계가 없으므로 그 이유도 **가리킬 단계가 없는 글**이다 — 화면
   어디에서도 지울 길이 없고, 견주기 표에는 그대로 떠서 있지도 않은 판단을 보여준다.

⚠️ 되돌릴 것이 없다 — 지운 글은 못 살린다. 애초에 뜻을 잃은 값이다.

Revision ID: f4a1c62d90e7
Revises: e3f0a25b7d41
"""
import sqlalchemy as sa
from alembic import op

revision = 'f4a1c62d90e7'
down_revision = 'e3f0a25b7d41'
branch_labels = None
depends_on = None


def upgrade():
    op.get_bind().execute(sa.text(
        "UPDATE dt_intel_tech SET stage_reason = NULL "
        "WHERE kind = 'capability' AND stage IS NULL"))


def downgrade():
    # 지운 글은 못 살린다.
    pass
