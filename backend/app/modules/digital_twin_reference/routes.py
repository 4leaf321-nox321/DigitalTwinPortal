"""
Digital Twin Reference Routes
개발 디지털 트윈 로드맵 정보 API
"""
from flask import request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm.attributes import flag_modified
from app.modules.digital_twin_reference import bp
from app.modules.digital_twin_reference.models import DtReferenceTask
from app.modules.digital_twin_reference.services import DtReferenceTaskService
from app.extensions import db
from app.shared.responses import (
    success_response, error_response, created_response, not_found_response
)
from app.shared.utils import get_request_json, validate_required_fields


# ============== Task Routes ==============

@bp.route('/tasks', methods=['GET'])
def get_tasks():
    """Get all tasks, optionally filtered by divisionId."""
    division_id = request.args.get('divisionId')
    tasks = DtReferenceTaskService.get_all(division_id=division_id)
    return success_response([t.to_dict() for t in tasks])


@bp.route('/tasks', methods=['POST'])
def create_task():
    """Create a new task."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['name'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    task = DtReferenceTaskService.create(
        name=data['name'],
        division_id=data.get('divisionId'),
        test_item=data.get('testItem'),
        test_item_detail=data.get('testItemDetail'),
        category=data.get('category'),
        product_family=data.get('productFamily'),
        year=data.get('year'),
        status=data.get('status'),
        connected_dt_task=data.get('connectedDtTask'),
        description=data.get('description'),
        order=data.get('order', 0),
    )
    return created_response(task.to_dict())


@bp.route('/tasks/bulk', methods=['POST'])
def create_bulk_tasks():
    """Create multiple tasks at once."""
    data = get_request_json()
    tasks_data = data.get('tasks', [])
    if not tasks_data:
        return error_response('No tasks provided')

    created = []
    for item in tasks_data:
        if not item.get('name', '').strip():
            continue
        task = DtReferenceTask(
            name=item['name'].strip(),
            division_id=item.get('divisionId') or None,
            test_item=item.get('testItem') or None,
            test_item_detail=item.get('testItemDetail') or None,
            category=item.get('category') or None,
            product_family=item.get('productFamily') or None,
            year=item.get('year') or None,
            status=item.get('status') or None,
            description=item.get('description') or None,
            order=item.get('order', 0),
        )
        db.session.add(task)
        created.append(task)

    db.session.commit()
    return created_response([t.to_dict() for t in created])


@bp.route('/tasks/reorder', methods=['PUT'])
def reorder_tasks():
    """Bulk update task order."""
    data = get_request_json()
    orders = data.get('orders', [])
    if not orders:
        return error_response('No order data provided')

    for item in orders:
        task_id = item.get('id')
        order = item.get('order')
        if task_id is not None and order is not None:
            task = DtReferenceTask.query.get(task_id)
            if task:
                task.order = order

    db.session.commit()
    return success_response(message='Order updated successfully')


@bp.route('/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    """Update a task."""
    data = get_request_json()
    task = DtReferenceTaskService.update(task_id, **data)
    if not task:
        return not_found_response('Task not found')
    return success_response(task.to_dict())


@bp.route('/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Delete a task."""
    if DtReferenceTaskService.delete(task_id):
        return success_response(message='Task deleted successfully')
    return not_found_response('Task not found')


@bp.route('/tasks/delete-all', methods=['DELETE'])
@jwt_required()
def delete_all_tasks():
    """Delete all tasks (admin only)."""
    from app.modules.auth.services import UserService
    user_id = int(get_jwt_identity())
    current_user = UserService.get_by_id(user_id)

    if not current_user or not current_user.is_admin_user():
        return error_response('관리자 권한이 필요합니다.', status_code=403)

    count = DtReferenceTask.query.count()
    DtReferenceTask.query.delete()
    db.session.commit()
    return success_response(message=f'{count}개 과제가 삭제되었습니다.')


# ============== Settings (categories / statuses) ==============

MODULE_NAME = 'digital_twin_reference'

DEFAULT_SETTINGS = {
    'categories': ['시뮬레이션', '검증 자동화', '설계 자동화'],
    'statuses': ['완료', '진행', '계획'],
    'product_families': [],
    'roadmap_config': {'itemOrder': {}, 'cellMerge': []},
}


def _get_module_settings_model():
    from app.modules.digital_twin_dashboard.models import ModuleSettings
    return ModuleSettings


def _save_setting(key, data, desc=''):
    """ModuleSettings 테이블에 digital_twin_reference 설정 저장 (upsert)"""
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


@bp.route('/settings', methods=['GET'])
def get_settings():
    """Get digital_twin_reference settings (categories, statuses)."""
    ModuleSettings = _get_module_settings_model()
    rows = ModuleSettings.query.filter_by(module_name=MODULE_NAME).all()
    result = {}
    for row in rows:
        result[row.settings_key] = row.settings_data

    for key in ('categories', 'statuses', 'product_families', 'roadmap_config'):
        if key not in result:
            result[key] = DEFAULT_SETTINGS[key]

    return success_response(result)


@bp.route('/settings', methods=['PUT'])
def update_settings():
    """Update digital_twin_reference settings (categories, statuses)."""
    data = get_request_json()

    if 'categories' in data:
        _save_setting('categories', data['categories'], '구분 목록')
    if 'statuses' in data:
        _save_setting('statuses', data['statuses'], '상태 목록')
    if 'product_families' in data:
        _save_setting('product_families', data['product_families'], '적용 제품군 목록')
    if 'roadmap_config' in data:
        _save_setting('roadmap_config', data['roadmap_config'], '로드맵 설정 (항목순서/셀합치기)')

    db.session.commit()
    return success_response(message='Settings updated successfully')
