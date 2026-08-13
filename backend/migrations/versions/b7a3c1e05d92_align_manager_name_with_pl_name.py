"""manager_name 을 pl_name 에 맞춘다 (관리자 = 과제PL 사본 정리)

`관리자`(manager_name)는 독립된 값이 아니라 과제PL 의 사본이다. 화면에 입력 칸이
없고(예전에 제거됐다) 읽는 코드도 없는데, 저장할 때 화면이 과제PL 값을 복사해
보내고 있었다. 그러면서 별도 필드로 노출돼 있어 **AI 는 이것만 따로 바꿀 수 있었고**,
확인(202)까지 거쳐 반영한 값이 다음 저장 때 조용히 덮였다.

이제 서버가 pl_name 에서 파생시키고(`routes_v2._derive_manager`) 이 컬럼은
불변으로 분류된다. 그 규칙이 **기존 행에도 성립하도록** 여기서 한 번 맞춘다.
안 맞추면 "관리자는 과제PL 과 같다" 는 전제가 옛 데이터에서만 거짓인 채로 남는다.

2026-08-02 개발 DB 실측 (활성 226건)
    203건  manager_name 이 비어 있고 pl_name 에는 값이 있음  → 채운다
     18건  이미 pl_name 과 동일                              → 그대로
      1건  달랐음 — 이번 작업 중 만든 샘플(MX-40)의 흔적      → 맞춘다
    사람이 관리자를 과제PL 과 **다르게** 입력해 둔 행은 없었다.

⚠️ downgrade 로 되돌리지 않는다. 옛 값은 pl_name 의 사본이거나 빈 값이라
   복원할 고유 정보가 없다. 되돌리려면 백업에서 컬럼을 되살려야 한다.

Revision ID: b7a3c1e05d92
Revises: d4e19f7c2b83
Create Date: 2026-08-02

"""
from alembic import op


revision = 'b7a3c1e05d92'
down_revision = 'd4e19f7c2b83'
branch_labels = None
depends_on = None


def upgrade():
    # IS DISTINCT FROM 이라 NULL 도 포함된다 (= 로 비교하면 NULL 행이 빠진다).
    op.execute("""
        UPDATE dt2_projects
           SET manager_name = pl_name
         WHERE manager_name IS DISTINCT FROM pl_name
    """)


def downgrade():
    # 되돌리지 않는다 — 위 주석 참고. 옛 값은 복원할 수 없고 복원할 가치도 없다.
    pass
