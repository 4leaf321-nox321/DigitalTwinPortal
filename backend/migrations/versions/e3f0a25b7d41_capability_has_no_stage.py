"""역량에서 단계를 걷어낸다 — 단계는 사업부 줄에만 산다

⚠️⚠️ 「기본 설정」이라 부르던 값이다. 회사 전체의 답이라는 것이 애초에 없었고,
   아무도 안 적은 역량 48개가 전부 그 값 하나로 레이더에 뭉쳐 그림이 안 읽혔다
   (2026-08-26 신고: 「역량 표시방법이 애매하다」).

⚠️⚠️ **비우기 전에 옮긴다.** 사업부 줄 중 `stage` 가 비어 있던 것들은 「기본
   설정을 따른다」는 뜻이었다 — 기본 설정을 지우면 그 줄들은 **어디에 있는지를
   잃는다.** 그래서 먼저 그 값을 각 줄에 박아 넣고, 그다음에 역량을 비운다.
   순서가 바뀌면 자료가 조용히 사라진다.

⚠️ 도구는 그대로 둔다. 도구의 단계는 「이 제품이 우리 손에 어디까지 들어와 있나」라
   하나로 말이 되고, 도구 관리 화면이 그 값을 쓴다.

⚠️ 되돌리기는 **원래 값을 살릴 수 없다.** 어느 역량이 무슨 단계였는지는 지우는
   순간 사라진다 — 되돌리면 전부 「감지」(아직 아무도 안 봄)로 놓는다. 그것이
   가장 덜 거짓말하는 값이다.

Revision ID: e3f0a25b7d41
Revises: d2b8f1a47c93
"""
import sqlalchemy as sa
from alembic import op

revision = 'e3f0a25b7d41'
down_revision = 'd2b8f1a47c93'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # ① 「기본 설정을 따르던」 사업부 줄에 그 값을 박아 넣는다. **먼저.**
    conn.execute(sa.text("""
        UPDATE dt_intel_division_stage AS d
           SET stage = t.stage
          FROM dt_intel_tech AS t
         WHERE t.uuid = d.tech_uuid
           AND d.stage IS NULL
           AND t.stage IS NOT NULL
    """))

    # ② 이제 칸을 비울 수 있게 한다.
    op.alter_column('dt_intel_tech', 'stage',
                    existing_type=sa.String(length=20), nullable=True)

    # ③ 역량만 비운다. 도구는 그대로.
    conn.execute(sa.text(
        "UPDATE dt_intel_tech SET stage = NULL WHERE kind = 'capability'"))


def downgrade():
    conn = op.get_bind()
    # ⚠️ 원래 값은 없다 — 「감지」로 놓는다(아직 아무도 안 봄).
    conn.execute(sa.text(
        "UPDATE dt_intel_tech SET stage = '감지' WHERE stage IS NULL"))
    op.alter_column('dt_intel_tech', 'stage',
                    existing_type=sa.String(length=20), nullable=False)
