"""
응답자의 역할과 프로세스 — **서버가 아는 값만 쓴다.**

자유 텍스트로 두면 두 가지가 깨진다. 오타 하나로 '개발'과 '개발 '이 다른
대상이 되어 한쪽 문항이 아무에게도 안 보이고, 무엇보다 **응답자가 자기 역할을
마음대로 고를 수 있어** 역할별 집계가 의미를 잃는다. 그래서 둘 다 목록에서만
고른다.

    프로세스   digital_twin_dashboard 의 process_categories (활성 항목)
    역할       아래 SURVEY_ROLES. 대부분 **데이터에서 유도**한다.

── 역할을 어떻게 아는가 ────────────────────────────────────────────────────

    사무국장          설정에 지정된 사람 (권한으로 구분되지 않아 따로 둔다)
    사업부 사무국     users.role 이 dt_office 또는 manager
    PL                dt2_projects.pl_knox_id 가 이 사람
    과제 참여인력     members_json / owners_json 에 이 사람

⚠️ **knoxId 로만 판단한다.** 이름으로 매칭하지 않는 것은 대시보드 권한 코드가
   의도적으로 정한 규칙이다(permissions.is_project_pl) — 이름을 인정하면
   `pl_name` 만 바꿔도 그 역할이 생기고, 동명이인에게 엉뚱한 역할이 간다.
   여기서 규칙을 느슨하게 하면 그쪽에서 막아 둔 구멍이 이쪽으로 열린다.

⚠️ 그래서 **유도가 안 되는 사람이 많다.** pl_knox_id 는 과제의 일부에만 채워져
   있다(2026-08-15 개발 DB: 410건 중 102건). 그 경우 응답자가 직접 고르고,
   고른 것인지 유도된 것인지를 응답에 남긴다(`role_source`). 집계에서 '자칭
   PL'을 걸러 볼 수 있어야 하기 때문이다.
"""
from app.extensions import db
from app.modules.auth.models import User, UserRole

# 설정 저장 위치. 전략 모듈이 임계값을 두는 것과 같은 표를 쓴다.
MODULE_KEY = 'survey'
OFFICE_HEAD_KEY = 'office_head_user_ids'

ROLE_OFFICE_HEAD = '사무국장'
ROLE_OFFICE = '사업부 사무국'
ROLE_PL = 'PL'
ROLE_MEMBER = '과제 참여인력'

# 좁은 것부터. 여러 개에 해당하면 **첫 번째를 기본값**으로 준다 —
# 사무국장이면서 어느 과제의 참여인력이기도 한 사람은 사무국장으로 묻는 것이 맞다.
SURVEY_ROLES = [ROLE_OFFICE_HEAD, ROLE_OFFICE, ROLE_PL, ROLE_MEMBER]

# 사무국으로 보는 권한. 사용자 확인(2026-08-15): 둘 다 사무국이다.
OFFICE_ROLES = (UserRole.DT_OFFICE_MEMBER, UserRole.MANAGER)


def office_head_ids():
    """사무국장으로 지정된 사용자 id 목록.

    권한으로 구분되지 않아 설정으로 둔다. 비어 있으면 아무도 사무국장이 아니고,
    그 역할은 유도되지 않는다 — **없는 것을 있는 척하지 않는다.**
    """
    from app.modules.digital_twin_dashboard.models import ModuleSettings

    row = ModuleSettings.query.filter_by(
        module_name=MODULE_KEY, settings_key=OFFICE_HEAD_KEY
    ).first()
    if not row or not isinstance(row.settings_data, dict):
        return []
    raw = row.settings_data.get('user_ids') or []
    return [int(x) for x in raw if str(x).lstrip('-').isdigit()]


def set_office_head_ids(user_ids):
    """사무국장 지정. 실재하는 활성 사용자만 남긴다."""
    from app.modules.digital_twin_dashboard.models import ModuleSettings

    wanted = {int(x) for x in (user_ids or []) if str(x).lstrip('-').isdigit()}
    valid = [
        u.id for u in User.query.filter(User.id.in_(wanted or {0})).all()
        if u.is_active
    ] if wanted else []

    row = ModuleSettings.query.filter_by(
        module_name=MODULE_KEY, settings_key=OFFICE_HEAD_KEY
    ).first()
    if not row:
        row = ModuleSettings(
            module_name=MODULE_KEY, settings_key=OFFICE_HEAD_KEY,
            description='설문에서 사무국장으로 보는 사용자',
        )
        db.session.add(row)
    row.settings_data = {'user_ids': valid}
    return valid


def _knox_local(user):
    """이 사람의 knoxId 로컬파트. 대시보드 권한 코드와 **같은 판정**을 쓴다."""
    try:
        from app.modules.digital_twin_dashboard.permissions import actor_match_tokens
        local, _name = actor_match_tokens(user)
        return (local or '').strip().lower() or None
    except Exception:
        # 대시보드 모듈을 못 읽어도 설문은 돌아야 한다. 그때는 유도가 안 될 뿐이다.
        return None


def _project_roles(user):
    """과제 데이터에서 PL·참여인력을 찾는다. 돌려주는 값은 역할 집합."""
    local = _knox_local(user)
    if not local:
        return set()

    from sqlalchemy import text
    found = set()

    # PL — pl_knox_id 가 이 사람인 과제가 하나라도 있으면 PL 이다.
    pl = db.session.execute(text(
        "SELECT 1 FROM dt2_projects "
        "WHERE nullif(btrim(pl_knox_id), '') IS NOT NULL "
        "AND lower(btrim(pl_knox_id)) = :local LIMIT 1"
    ), {'local': local}).first()
    if pl:
        found.add(ROLE_PL)

    # 참여인력 — members_json / owners_json 의 knoxId.
    #   배열이 아닌 값이 섞여 있으면 jsonb_array_elements 가 죽으므로 타입을 먼저 본다
    #   (permissions.member_sql_condition 과 같은 이유).
    member = db.session.execute(text(
        "SELECT 1 FROM dt2_projects WHERE "
        " (jsonb_typeof(members_json) = 'array' AND EXISTS ("
        "   SELECT 1 FROM jsonb_array_elements(members_json) e "
        "   WHERE lower(btrim(e->>'knoxId')) = :local))"
        " OR (jsonb_typeof(owners_json) = 'array' AND EXISTS ("
        "   SELECT 1 FROM jsonb_array_elements(owners_json) e "
        "   WHERE lower(btrim(e->>'knoxId')) = :local))"
        " LIMIT 1"
    ), {'local': local}).first()
    if member:
        found.add(ROLE_MEMBER)

    return found


def derive_roles(user):
    """이 사람이 실제로 해당하는 역할들. SURVEY_ROLES 순서로 돌려준다.

    빈 목록이면 유도된 것이 없다는 뜻이고, 그때는 응답자가 고른다.
    """
    if user is None:
        return []

    found = set()
    if user.id in office_head_ids():
        found.add(ROLE_OFFICE_HEAD)
    if user.role in OFFICE_ROLES:
        found.add(ROLE_OFFICE)
    try:
        found |= _project_roles(user)
    except Exception:
        # 과제 표를 못 읽어도 설문은 돌아야 한다.
        pass

    return [r for r in SURVEY_ROLES if r in found]


def process_names():
    """고를 수 있는 프로세스. 대시보드의 마스터를 그대로 쓴다.

    설문 모듈이 자기 목록을 따로 들면 조직이 프로세스를 바꿔도 안 따라간다.
    이름이 중복된 행이 있어(비활성 옛 행) 활성만 보고 중복을 없앤다.
    """
    try:
        from app.modules.digital_twin_dashboard.models import ProcessCategory
    except Exception:
        return []
    out = []
    rows = (ProcessCategory.query.filter_by(is_active=True)
            .order_by(ProcessCategory.order, ProcessCategory.id).all())
    for row in rows:
        name = (row.name or '').strip()
        if name and name not in out:
            out.append(name)
    return out
