"""
Digital Twin Investment Routes
디지털 트윈 투자 현황 API
"""
from flask import request
from sqlalchemy.orm.attributes import flag_modified

from app.extensions import db
from app.modules.digital_twin_investment import bp
from app.modules.digital_twin_investment.services import InvestmentService
from app.shared.responses import (
    success_response, error_response, created_response, not_found_response
)
from app.shared.utils import get_request_json, validate_required_fields

MODULE_NAME = 'digital_twin_investment'

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
def get_investments():
    """투자 건 목록. year / division / category1 로 걸러낼 수 있다."""
    investments = InvestmentService.get_all(
        year=request.args.get('year'),
        division=request.args.get('division'),
        category1=request.args.get('category1'),
    )
    return success_response([i.to_dict() for i in investments])


@bp.route('/investments', methods=['POST'])
def create_investment():
    """투자 건 하나 등록."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['name'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    investment = InvestmentService.create(**data)
    return created_response(investment.to_dict())


@bp.route('/investments/bulk', methods=['POST'])
def create_bulk_investments():
    """투자 건 여러 개를 한 번에 등록."""
    data = get_request_json()
    items = data.get('investments', [])
    if not items:
        return error_response('No investments provided')

    created = InvestmentService.create_many(items)
    if not created:
        return error_response('No investments provided')
    return created_response([i.to_dict() for i in created])


@bp.route('/investments/<int:investment_id>', methods=['PUT'])
def update_investment(investment_id):
    """투자 건 수정."""
    data = get_request_json()
    investment = InvestmentService.update(investment_id, **data)
    if not investment:
        return not_found_response('Investment not found')
    return success_response(investment.to_dict())


@bp.route('/investments/<int:investment_id>', methods=['DELETE'])
def delete_investment(investment_id):
    """투자 건 삭제."""
    if InvestmentService.delete(investment_id):
        return success_response(message='Investment deleted successfully')
    return not_found_response('Investment not found')


# ============================================
# 설정 API
# ============================================

@bp.route('/settings', methods=['GET'])
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
