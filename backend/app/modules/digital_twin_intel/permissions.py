"""누가 무엇을 할 수 있나.

⚠️⚠️ **이 파일이 처음부터 있는 이유.** 2026-08-25 조사에서, 쓰기 라우트가 있는
   21개 모듈 중 **9개가 서버 권한 검사 없이 `@jwt_required()` 만** 걸고 있었다
   (쓰기 라우트 합계 95개). 막고 있는 것은 `ProtectedRoute` 뿐인데 그건 브라우저
   안의 일이라, **토큰만 있으면 누구나 직접 부를 수 있다.** MCP 용 PAT 도 유효한
   토큰이다. 스물여덟 번째 모듈을 그렇게 만들지 않으려고 먼저 적는다.

무엇을 기준으로 나눴나
    이 모듈의 값은 **많이 쌓이는 것**에서 온다. 그래서 넣는 문은 넓게 연다 —
    로그인한 사람이면 소식도 기술도 더할 수 있다. 조사해 온 사람을 막으면
    아무도 안 넣고, 안 넣으면 앞선 셋처럼 죽는다.

    좁히는 것은 **지우는 것과 판단하는 것**이다.

        더하기·고치기   로그인한 사람 누구나
        레이더 단계 바꾸기   admin · dt_office     ← 조직의 판단이다
        지우기          admin · dt_office
        설정(분류 목록)  admin · dt_office

⚠️ **단계 변경을 좁히는 것이 이 파일의 핵심이다.** 「도입 / 시험 / 관찰 / 보류」는
   개인 의견이 아니라 조직이 어디까지 왔는지의 표기다. 아무나 바꾸면 그 표기를
   아무도 안 믿게 되고, 안 믿는 표기는 없는 것과 같다.
"""
from app.modules.auth.models import User, UserRole

# 판단·삭제를 할 수 있는 역할. `digital_twin_dashboard.permissions` 의
# GLOBAL_EDIT_ROLES 와 **같은 둘**이다 — 포털 안에서 기준이 갈리면 안 된다.
CURATOR_ROLES = (UserRole.ADMIN, UserRole.DT_OFFICE_MEMBER)

MODULE_PATH = '/digital-twin-intel'


def actor_from(user_id):
    if user_id is None:
        return None
    return User.query.get(int(user_id))


def can_read(actor):
    """읽기는 모듈 권한 표를 따른다.

    ⚠️ 화면(`ProtectedRoute`)과 **같은 표**를 서버도 본다. 갈리면 메뉴는 막혔는데
       API 는 열려 있는 상태가 된다 — 지금 아홉 모듈이 그 상태다.
    """
    if actor is None or not actor.is_active:
        return False
    if actor.role == UserRole.ADMIN:
        return True
    return not _blocked_by_module_setting(actor)


def can_write(actor):
    """더하기·고치기. **넓게 연다** — 안 쌓이면 이 모듈은 죽는다."""
    return can_read(actor)


def can_curate(actor):
    """레이더 단계 변경 · 삭제 · 설정. 조직의 판단이라 좁힌다."""
    if actor is None or not actor.is_active:
        return False
    return actor.role in CURATOR_ROLES


def _blocked_by_module_setting(actor):
    """`role_module_permissions` 에서 이 모듈이 **명시적으로 false** 인가.

    ⚠️ 표가 없거나 이 모듈이 안 적혀 있으면 **허용**이다(`meeting_management` 와
       같은 규칙). 기본을 차단으로 두면 새 모듈이 조용히 아무에게도 안 보인다.
    """
    try:
        from app.modules.digital_twin_dashboard.models import ModuleSettings
        row = ModuleSettings.query.filter_by(
            module_name='auth', settings_key='role_module_permissions').first()
        if not row or not row.settings_data:
            return False
        perms = (row.settings_data or {}).get(actor.role) or {}
        return perms.get(MODULE_PATH) is False
    except Exception:
        # 권한 표를 못 읽는 것과 「권한 없음」은 다르다. 못 읽으면 통과시킨다 —
        # 설정 테이블 하나 때문에 모듈 전체가 멎으면 안 된다.
        return False
