"""
Digital Twin Investment Routes
디지털 트윈 투자 현황 API
"""
from flask import request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm.attributes import flag_modified

from app.extensions import db
from app.modules.digital_twin_investment import bp
from app.modules.digital_twin_investment.services import InvestmentService
from app.shared.responses import (
    success_response, error_response, created_response, not_found_response
)
from app.shared.utils import get_request_json, validate_required_fields
from app.modules.auth.models import User

MODULE_NAME = 'digital_twin_investment'


def _actor_id():
    """
    이번 요청을 한 사람. 변경 이력의 '누가' 에 들어간다.

    모든 길에 @jwt_required() 가 걸려 있으므로 보통은 값이 있다. 토큰이 이상하면
    None 을 돌려 **이력은 남기되 사람만 비운다** — 여기서 터뜨리면 저장 자체가
    막히는데, 그건 이력을 남기려다 본 일을 망치는 것이다.
    """
    try:
        uid = get_jwt_identity()
        return int(uid) if uid is not None else None
    except (TypeError, ValueError):
        return None

# 투자 유형은 고정이다(코드에 박는다). 디지털 트윈 영역만 설정에서 늘린다 —
# 늘어나는 쪽만 데이터로 두는 게 요구사항이다.
CATEGORY1_OPTIONS = ['H/W', 'S/W', '플랫폼']

DEFAULT_SETTINGS = {
    'category2Options': ['시뮬레이션', '검증 자동화', '설계 자동화', '모니터링'],
}


def _get_module_settings_model():
    from app.modules.digital_twin_dashboard.models import ModuleSettings
    return ModuleSettings


def _save_setting(key, data, desc=''):
    """ModuleSettings 테이블에 digital_twin_investment 설정 저장 (upsert)"""
    ModuleSettings = _get_module_settings_model()
    existing = ModuleSettings.query.filter_by(
        module_name=MODULE_NAME,
        settings_key=key
    ).first()

    if existing:
        existing.settings_data = data
        existing.description = desc
        flag_modified(existing, 'settings_data')
    else:
        db.session.add(ModuleSettings(
            module_name=MODULE_NAME,
            settings_key=key,
            settings_data=data,
            description=desc
        ))


# ============================================
# 투자 건 API
# ============================================

@bp.route('/investments', methods=['GET'])
@jwt_required()
def get_investments():
    """투자 건 목록. year / division / category1 로 걸러낼 수 있다."""
    investments = InvestmentService.get_all(
        year=request.args.get('year'),
        division=request.args.get('division'),
        category1=request.args.get('category1'),
    )
    return success_response([i.to_dict() for i in investments])


@bp.route('/investments', methods=['POST'])
@jwt_required()
def create_investment():
    """투자 건 하나 등록."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['name'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    investment = InvestmentService.create(actor_id=_actor_id(), **data)
    return created_response(investment.to_dict())


@bp.route('/investments/bulk', methods=['POST'])
@jwt_required()
def create_bulk_investments():
    """투자 건 여러 개를 한 번에 등록."""
    data = get_request_json()
    items = data.get('investments', [])
    if not items:
        return error_response('No investments provided')

    created = InvestmentService.create_many(items, actor_id=_actor_id())
    if not created:
        return error_response('No investments provided')
    return created_response([i.to_dict() for i in created])


@bp.route('/investments/<int:investment_id>', methods=['PUT'])
@jwt_required()
def update_investment(investment_id):
    """투자 건 수정."""
    data = get_request_json()
    investment = InvestmentService.update(investment_id, actor_id=_actor_id(), **data)
    if not investment:
        return not_found_response('Investment not found')
    return success_response(investment.to_dict())


@bp.route('/investments/<int:investment_id>', methods=['DELETE'])
@jwt_required()
def delete_investment(investment_id):
    """투자 건 삭제."""
    if InvestmentService.delete(investment_id, actor_id=_actor_id()):
        return success_response(message='Investment deleted successfully')
    return not_found_response('Investment not found')


# ============================================
# 변경 이력 API
# ============================================

def _history_response(rows):
    """사용자 id 를 이름으로 바꿔 붙인다. 지워진 사용자도 그대로 드러낸다."""
    names = {}
    for r in rows:
        uid = r.actor_user_id
        if uid and uid not in names:
            u = User.query.get(uid)
            names[uid] = u.name if u else f'(삭제된 사용자 {uid})'
    return success_response([r.to_dict(names.get(r.actor_user_id)) for r in rows])


@bp.route('/investments/<int:investment_id>/history', methods=['GET'])
@jwt_required()
def get_investment_history(investment_id):
    """투자 건 하나의 변경 이력."""
    return _history_response(InvestmentService.history(investment_id=investment_id))


@bp.route('/history/<int:change_id>/restore', methods=['POST'])
@jwt_required()
def restore_investment(change_id):
    """삭제 이력을 되살린다. 새 건으로 등록되고, 그 사실이 이력에 남는다."""
    investment, err = InvestmentService.restore(change_id, actor_id=_actor_id())
    if err:
        return error_response(err)
    return created_response(investment.to_dict())


@bp.route('/history', methods=['GET'])
@jwt_required()
def get_all_history():
    """
    전체 변경 이력. **지워진 건까지 포함한다** — 목록에 없는 건의 이력을 볼 수 있는
    유일한 길이다.
    """
    try:
        limit = min(int(request.args.get('limit', 200)), 1000)
    except (TypeError, ValueError):
        limit = 200
    return _history_response(InvestmentService.history(limit=limit))


# ============================================
# 설정 API
# ============================================

@bp.route('/settings', methods=['GET'])
@jwt_required()
def get_settings():
    """디지털 트윈 영역 목록 등 모듈 설정 조회. 저장된 값이 없으면 기본값을 준다."""
    ModuleSettings = _get_module_settings_model()
    rows = ModuleSettings.query.filter_by(module_name=MODULE_NAME).all()
    result = {row.settings_key: row.settings_data for row in rows}

    for key, default in DEFAULT_SETTINGS.items():
        if key not in result:
            result[key] = default

    result['category1Options'] = CATEGORY1_OPTIONS
    return success_response(result)


@bp.route('/settings', methods=['PUT'])
@jwt_required()
def update_settings():
    """디지털 트윈 영역 목록 저장."""
    data = get_request_json()

    if 'category2Options' in data:
        options = [
            str(v).strip() for v in (data['category2Options'] or [])
            if str(v).strip()
        ]
        # 순서는 유지하면서 중복만 걷어낸다.
        deduped = list(dict.fromkeys(options))
        _save_setting('category2Options', deduped, '디지털 트윈 영역 목록')

    db.session.commit()
    return success_response(message='Settings updated successfully')
