# -*- coding: utf-8 -*-
"""누가 무엇을 할 수 있나. (PLAN.md 8절)

    읽기            로그인한 사람 누구나 (모듈 권한 표를 따른다)
    평가·연결·목록   **자기 사업부의 것만** — USER 이상
    설정 · 전 사업부   admin · dt_office

⚠️ **자기 사업부**는 인텔·전략과 다른 새 규칙이다. 평가는 그 시험을 아는 사람이
   하는 것이고, 다른 사업부의 쌍을 매기는 것은 인상이다. 다만 화면에서는 단추가
   사라지는 게 아니라 **이유가 적힌 채 꺼진다** — `deny_reason` 이 그 문장이다.

⚠️ 사업부는 계정에서만 정한다(`users.department` → `departments.division_id`).
   대시보드의 `actor_division_id` 를 그대로 쓴다 — 포탈 안에서 「내 사업부」의
   답이 두 개면 안 된다. 못 풀면 None 이고, 그 사람은 사무국이 아닌 한 평가를 못 한다.
"""
from app.modules.auth.models import User, UserRole

CURATOR_ROLES = (UserRole.ADMIN, UserRole.DT_OFFICE_MEMBER)
ASSESS_MIN_LEVEL = UserRole.get_level(UserRole.USER)

MODULE_PATH = '/dev-dt-maturity'


def actor_from(user_id):
    if user_id is None:
        return None
    return User.query.get(int(user_id))


def can_read(actor):
    if actor is None or not actor.is_active:
        return False
    if actor.role == UserRole.ADMIN:
        return True
    return not _blocked_by_module_setting(actor)


def can_curate(actor):
    """설정 · 전 사업부 평가 · 삭제."""
    if actor is None or not actor.is_active:
        return False
    return actor.role in CURATOR_ROLES


def actor_division_id(actor):
    from app.modules.digital_twin_dashboard.permissions import actor_division_id as _adi
    return _adi(actor)


def can_touch_division(actor, division_id):
    """평가·연결·목록 편집. 사무국은 전부, 나머지는 자기 사업부만."""
    if not can_read(actor):
        return False
    if can_curate(actor):
        return True
    if UserRole.get_level(actor.role) < ASSESS_MIN_LEVEL:
        return False
    mine = actor_division_id(actor)
    return mine is not None and int(division_id) == int(mine)


def deny_reason(actor, division_id, division_name=None):
    """왜 못 하는가 — 꺼진 단추에 붙는 문장. 할 수 있으면 None."""
    if can_touch_division(actor, division_id):
        return None
    if actor is None or not can_read(actor):
        return '로그인이 필요합니다.'
    if UserRole.get_level(actor.role) < ASSESS_MIN_LEVEL:
        return '조회 전용 계정입니다.'
    if actor_division_id(actor) is None:
        return '계정의 부서로 사업부를 알 수 없어 평가할 수 없습니다. 관리자에게 부서를 확인하세요.'
    return f'{division_name or "이"} 사업부 인력만 평가합니다.'


def _blocked_by_module_setting(actor):
    """`role_module_permissions` 에서 이 모듈이 명시적으로 false 인가. 없으면 허용."""
    try:
        from app.modules.digital_twin_dashboard.models import ModuleSettings
        row = ModuleSettings.query.filter_by(
            module_name='auth', settings_key='role_module_permissions').first()
        if not row or not row.settings_data:
            return False
        per_role = row.settings_data.get(actor.role) or {}
        return per_role.get(MODULE_PATH) is False
    except Exception:
        return False
