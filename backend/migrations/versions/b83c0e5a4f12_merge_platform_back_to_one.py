"""플랫폼 구축을 다시 하나로 합친다

왜 (2026-08-06) — e6c73b90a1d5 를 되돌린다
    2026-08-01 에 '플랫폼 구축' 하나를 개발·제조·품질 셋으로 쪼갰다. 이유는
    **화면 문제**였다 — 구획(플랫폼 구축) → 분류(플랫폼 구축) → 행(플랫폼 구축) 으로
    같은 이름이 세 번 겹쳐 위계가 안 읽혔다. 분류를 진짜 분류로 채워 겹침을 없앴다.

    쓰다 보니 그 셋을 나눌 실익이 없었다. 플랫폼 구축 과제는 어느 영역이든
    "지표를 올리는 대신 시스템을 만든다" 는 한 가지를 말하고, 셋을 갈라 두니
    같은 성격의 과제가 세 줄에 흩어져 오히려 한눈에 안 들어왔다.

    겹침 문제는 이번엔 **화면에서** 푼다 — 구획 이름과 분류가 같으면 분류 소제목
    줄을 그리지 않는다(KpiMatrixView 의 skipCat). 데이터로 우회하지 않는다.

연결을 잃지 않는다
    dt2_project_kpi.kpi_definition_id 는 FK(ON DELETE RESTRICT) 라 정의를 그냥
    지울 수 없다. 살아남을 하나로 **옮긴 뒤** 지운다.

    옮기면 (과제, 지표, 대상) 유니크에 걸리는 짝이 생긴다 — 한 과제가 개발과 제조
    플랫폼에 같은 사업부로 걸려 있던 경우다. 그런 짝은 **가장 정보가 많은 줄**을
    남긴다(기여 등급 있는 것 > 기여 내용 있는 것 > 낮은 id). 무엇을 남길지 규칙이
    없으면 실행할 때마다 다른 줄이 살아남는다.

    개발서버 실측(2026-08-06): 연결 44건 → 34건, 겹쳐 사라지는 10건은 모두
    등급·기여 내용이 비어 있는 시험 과제(SR-3)의 것이었다.

Revision ID: b83c0e5a4f12
Revises: c1f5a8d34e77
Create Date: 2026-08-06

"""
from alembic import op
import sqlalchemy as sa


revision = 'b83c0e5a4f12'
down_revision = 'c1f5a8d34e77'
branch_labels = None
depends_on = None

# 이름과 분류를 **다르게** 둔다.
#     분류 '플랫폼' 은 개발·제조·품질과 나란한 한 칸이고, 항목 '플랫폼 구축' 은
#     그 안의 하나다. 둘을 같은 글자로 두면 화면마다 같은 말이 두 번 나온다
#     (과제 편집창의 그룹 제목 = 카드 이름, 매트릭스의 구분 = 행 이름).
#     2026-08-01 에 이걸 피하려고 항목을 셋으로 쪼갰었다 — 분류를 분류답게 쓰면
#     쪼갤 필요가 없다.
MERGED_LABEL = '플랫폼 구축'
MERGED_CATEGORY = '플랫폼'
SPLIT_LABELS = [('개발 플랫폼 구축', '개발'),
                ('제조 플랫폼 구축', '제조'),
                ('품질 플랫폼 구축', '품질')]


def upgrade():
    bind = op.get_bind()

    # 살아남을 하나 — kind='platform' 중 가장 낮은 id.
    # (라벨로 고르지 않는다. 운영에서 이름이 손질돼 있을 수 있다.)
    keep = bind.execute(sa.text(
        "SELECT MIN(id) FROM kpi_definitions WHERE kind = 'platform'")).scalar()
    if keep is None:
        return                      # 플랫폼 항목이 없는 DB — 할 일 없음

    # ① (과제, 대상) 마다 한 줄만 남긴다.
    #    합치기 **전에** 정리해야 ② 의 UPDATE 가 유니크에 안 걸린다.
    bind.execute(sa.text("""
        DELETE FROM dt2_project_kpi
         WHERE id IN (
           SELECT id FROM (
             SELECT l.id,
                    ROW_NUMBER() OVER (
                      PARTITION BY l.project_uuid, l.target_division
                      ORDER BY (l.relation_type IS NULL),
                               (COALESCE(l.note, '') = ''),
                               l.kpi_definition_id,
                               l.id) AS rn
               FROM dt2_project_kpi l
               JOIN kpi_definitions d ON d.id = l.kpi_definition_id
              WHERE d.kind = 'platform'
           ) t
          WHERE t.rn > 1)
    """))

    # ② 남은 연결을 살아남을 정의로 옮긴다
    bind.execute(sa.text("""
        UPDATE dt2_project_kpi l
           SET kpi_definition_id = :keep
          FROM kpi_definitions d
         WHERE d.id = l.kpi_definition_id
           AND d.kind = 'platform'
           AND d.id <> :keep
    """), {'keep': keep})

    # ③ 이제 참조가 없으니 나머지 정의를 지운다
    bind.execute(sa.text("""
        DELETE FROM kpi_definitions
         WHERE kind = 'platform' AND id <> :keep
    """), {'keep': keep})

    # ④ 이름 '플랫폼 구축' · 분류 '플랫폼' (위 상수 머리말 참조)
    bind.execute(sa.text("""
        UPDATE kpi_definitions
           SET label = :label, category = :category
         WHERE id = :keep
    """), {'keep': keep, 'label': MERGED_LABEL, 'category': MERGED_CATEGORY})

    # ⑤ 'KPI 선택' 에 지워진 id 가 남아 있으면 걷어낸다.
    #    없는 id 를 숨김 목록에 이고 있어도 지금은 무해하지만, 나중에 id 가
    #    재사용되면 엉뚱한 지표가 조용히 사라진다.
    row = bind.execute(sa.text("""
        SELECT id, settings_data FROM module_settings
         WHERE module_name = 'digital_twin_dashboard'
           AND settings_key = 'kpiMatrixSettings'
    """)).first()
    if row and isinstance(row[1], dict):
        ids = row[1].get('excludedKpiIds')
        if isinstance(ids, list):
            alive = set(bind.execute(sa.text(
                "SELECT id FROM kpi_definitions")).scalars().all())
            cleaned = [i for i in ids if i in alive]
            if cleaned != ids:
                import json
                bind.execute(sa.text("""
                    UPDATE module_settings
                       SET settings_data = CAST(:v AS json)
                     WHERE id = :id
                """), {'id': row[0],
                       'v': json.dumps({**row[1], 'excludedKpiIds': cleaned},
                                       ensure_ascii=False)})


def downgrade():
    """
    ⚠️ **연결까지는 못 되돌린다.**
        어느 연결이 개발/제조/품질 중 무엇이었는지는 upgrade 에서 사라졌다.
        여기서는 정의 셋을 되살리고 살아남은 하나를 '개발 플랫폼 구축' 으로
        돌려놓기만 한다 — 모든 연결은 그 '개발' 쪽에 몰려 있게 된다.
        되살아난 제조·품질은 연결 0건으로 시작한다.
    """
    bind = op.get_bind()
    keep = bind.execute(sa.text(
        "SELECT MIN(id) FROM kpi_definitions WHERE kind = 'platform'")).scalar()
    if keep is None:
        return

    bind.execute(sa.text("""
        UPDATE kpi_definitions
           SET label = '개발 플랫폼 구축', category = '개발'
         WHERE id = :keep
    """), {'keep': keep})

    for label, category in SPLIT_LABELS[1:]:
        # ⚠️ CAST 를 빼지 말 것. 같은 :label 이 INSERT 값으로도, WHERE 의 varchar
        #    비교로도 쓰여서 Postgres 가 타입을 못 정한다
        #    (AmbiguousParameter: inconsistent types deduced for parameter $1).
        bind.execute(sa.text("""
            INSERT INTO kpi_definitions
                (label, category, unit, value_type, divisions, sort_order,
                 show_raw_data, direction, kind, created_at, updated_at)
            SELECT CAST(:label AS VARCHAR), CAST(:category AS VARCHAR),
                   '', 'single', CAST('[]' AS json),
                   COALESCE((SELECT MAX(sort_order) FROM kpi_definitions), 0) + 1,
                   false, 'higher', 'platform',
                   NOW() AT TIME ZONE 'utc', NOW() AT TIME ZONE 'utc'
             WHERE NOT EXISTS (
                   SELECT 1 FROM kpi_definitions
                    WHERE label = CAST(:label AS VARCHAR))
        """), {'label': label, 'category': category})
