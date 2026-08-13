"""플랫폼 구축을 개발·제조·품질로 나눈다

왜 (2026-08-01, d4a91c07f8e2 바로 뒤)
    처음엔 '플랫폼 구축' 항목 하나로 넣었다. 그런데 매트릭스에서
    구획(플랫폼 구축) → 분류(플랫폼 구축) → 행(플랫폼 구축) 으로 **같은 이름이
    세 번 겹쳐** 위계가 읽히지 않았다.

    DX KPI 가 개발·제조·품질로 나뉘어 관리되는 것처럼, 플랫폼 구축도 그 셋에
    각각 붙는 것이 실제 조직의 모양이다. 분류를 진짜 분류로 채우면 겹침이 사라지고
    "어느 영역의 플랫폼인가" 도 같이 답해진다.

기존 항목은 지우지 않고 **이름만 바꾼다**
    id 가 유지돼야 이미 걸린 연결(dt2_project_kpi.kpi_definition_id)이 살아남는다.
    지우고 새로 만들면 FK 가 RESTRICT 라 막히거나, 막히지 않으면 연결이 사라진다.

Revision ID: e6c73b90a1d5
Revises: d4a91c07f8e2
Create Date: 2026-08-01

"""
from alembic import op


revision = 'e6c73b90a1d5'
down_revision = 'd4a91c07f8e2'
branch_labels = None
depends_on = None


# (라벨, 분류) — 분류는 KPI 정의가 쓰는 값과 **같은 글자**여야 한 표에서 같이 묶인다.
PLATFORMS = [
    ('개발 플랫폼 구축', '개발'),
    ('제조 플랫폼 구축', '제조'),
    ('품질 플랫폼 구축', '품질'),
]


def upgrade():
    # ① 기존 '플랫폼 구축' → '개발 플랫폼 구축' (id 유지 = 연결 보존)
    op.execute("""
        UPDATE kpi_definitions
           SET label = '개발 플랫폼 구축', category = '개발'
         WHERE label = '플랫폼 구축' AND kind = 'platform'
    """)

    # ② 나머지 둘을 추가. 이미 있으면 건너뛴다(재실행 안전).
    for label, category in PLATFORMS:
        op.execute(f"""
            INSERT INTO kpi_definitions
                (label, category, unit, value_type, divisions, sort_order,
                 show_raw_data, direction, kind, created_at, updated_at)
            SELECT '{label}', '{category}', '', 'single', '[]'::json,
                   COALESCE((SELECT MAX(sort_order) FROM kpi_definitions), 0) + 1,
                   false, 'higher', 'platform',
                   NOW() AT TIME ZONE 'utc', NOW() AT TIME ZONE 'utc'
             WHERE NOT EXISTS (
                   SELECT 1 FROM kpi_definitions WHERE label = '{label}')
        """)


def downgrade():
    # 연결이 없는 것만 지우고, 남은 하나는 옛 이름으로 되돌린다.
    op.execute("""
        DELETE FROM kpi_definitions d
         WHERE d.kind = 'platform'
           AND d.label IN ('제조 플랫폼 구축', '품질 플랫폼 구축')
           AND NOT EXISTS (
               SELECT 1 FROM dt2_project_kpi l WHERE l.kpi_definition_id = d.id)
    """)
    op.execute("""
        UPDATE kpi_definitions
           SET label = '플랫폼 구축', category = '플랫폼 구축'
         WHERE label = '개발 플랫폼 구축' AND kind = 'platform'
    """)
