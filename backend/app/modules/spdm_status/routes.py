"""
SPDM Status Routes
SPDM 현황 관리 API
"""
import io
import zipfile
import os
from flask import request, send_file
from datetime import datetime
from sqlalchemy.orm.attributes import flag_modified
from app.modules.spdm_status import bp
from app.modules.spdm_status.services import (
    SpdmGroupService, SpdmIssueService,
    SpdmIssueHistoryService, SpdmAttachmentService,
    SpdmScheduleDepartmentService, SpdmScheduleItemService,
    SpdmModuleService, SpdmSpecKeySuggestionService
)
from app.extensions import db
from app.shared.responses import (
    success_response, error_response, created_response, not_found_response
)
from app.shared.utils import get_request_json, validate_required_fields


# ============== Group Routes ==============

@bp.route('/groups', methods=['GET'])
def get_groups():
    """Get all groups."""
    groups = SpdmGroupService.get_all()
    return success_response([g.to_dict() for g in groups])


@bp.route('/groups/<int:group_id>', methods=['GET'])
def get_group(group_id):
    """Get a single group."""
    group = SpdmGroupService.get_by_id(group_id)
    if not group:
        return not_found_response('Group not found')
    return success_response(group.to_dict(include_issues=True))


@bp.route('/groups', methods=['POST'])
def create_group():
    """Create a new group."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['name'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    group = SpdmGroupService.create(
        name=data['name'],
        color=data.get('color', '#3b82f6'),
        description=data.get('description'),
        order=data.get('order', 0)
    )
    return created_response(group.to_dict())


@bp.route('/groups/<int:group_id>', methods=['PUT'])
def update_group(group_id):
    """Update a group."""
    data = get_request_json()
    group = SpdmGroupService.update(group_id, **data)
    if not group:
        return not_found_response('Group not found')
    return success_response(group.to_dict())


@bp.route('/groups/<int:group_id>', methods=['DELETE'])
def delete_group(group_id):
    """Delete a group."""
    if SpdmGroupService.delete(group_id):
        return success_response(message='Group deleted successfully')
    return not_found_response('Group not found')


# ============== Issue Routes ==============

@bp.route('/issues', methods=['GET'])
def get_issues():
    """Get all issues."""
    group_id = request.args.get('groupId', type=int)
    if group_id:
        issues = SpdmIssueService.get_by_group(group_id)
    else:
        issues = SpdmIssueService.get_all()
    return success_response([i.to_dict() for i in issues])


@bp.route('/issues/<int:issue_id>', methods=['GET'])
def get_issue(issue_id):
    """Get a single issue with history."""
    issue = SpdmIssueService.get_by_id(issue_id)
    if not issue:
        return not_found_response('Issue not found')
    return success_response(issue.to_dict(include_history=True))


@bp.route('/issues', methods=['POST'])
def create_issue():
    """Create a new issue."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['groupId', 'title', 'assignee'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    # Parse due date if provided
    due_date = None
    if data.get('dueDate'):
        try:
            due_date = datetime.strptime(data['dueDate'], '%Y-%m-%d').date()
        except ValueError:
            return error_response('Invalid date format. Use YYYY-MM-DD')

    issue = SpdmIssueService.create(
        group_id=data['groupId'],
        title=data['title'],
        assignee=data['assignee'],
        description=data.get('description'),
        status=data.get('status', 'registered'),
        due_date=due_date,
        departments=data.get('departments', [])
    )
    return created_response(issue.to_dict())


@bp.route('/issues/<int:issue_id>', methods=['PUT'])
def update_issue(issue_id):
    """Update an issue."""
    data = get_request_json()

    # Parse due date if provided
    if 'dueDate' in data:
        if data['dueDate']:
            try:
                data['dueDate'] = datetime.strptime(data['dueDate'], '%Y-%m-%d').date()
            except ValueError:
                return error_response('Invalid date format. Use YYYY-MM-DD')
        else:
            data['dueDate'] = None

    issue = SpdmIssueService.update(issue_id, **data)
    if not issue:
        return not_found_response('Issue not found')
    return success_response(issue.to_dict())


@bp.route('/issues/<int:issue_id>/status', methods=['PUT'])
def change_issue_status(issue_id):
    """Change issue status."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['status'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    author = data.get('author', '시스템')
    issue = SpdmIssueService.change_status(issue_id, data['status'], author)
    if not issue:
        return not_found_response('Issue not found')
    return success_response(issue.to_dict())


@bp.route('/issues/<int:issue_id>', methods=['DELETE'])
def delete_issue(issue_id):
    """Delete an issue."""
    if SpdmIssueService.delete(issue_id):
        return success_response(message='Issue deleted successfully')
    return not_found_response('Issue not found')


# ============== History Routes ==============

@bp.route('/issues/<int:issue_id>/history', methods=['GET'])
def get_issue_history(issue_id):
    """Get all history for an issue."""
    issue = SpdmIssueService.get_by_id(issue_id)
    if not issue:
        return not_found_response('Issue not found')

    history = SpdmIssueHistoryService.get_by_issue(issue_id)
    return success_response([h.to_dict() for h in history])


@bp.route('/issues/<int:issue_id>/history', methods=['POST'])
def add_issue_history(issue_id):
    """Add a history entry (comment) to an issue."""
    issue = SpdmIssueService.get_by_id(issue_id)
    if not issue:
        return not_found_response('Issue not found')

    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['content', 'author'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    history = SpdmIssueHistoryService.create(
        issue_id=issue_id,
        history_type=data.get('type', 'comment'),
        content=data['content'],
        author=data['author'],
        department_id=data.get('departmentId'),
        attachment=data.get('attachment')
    )
    return created_response(history.to_dict())


@bp.route('/history/<int:history_id>', methods=['DELETE'])
def delete_history(history_id):
    """Delete a history entry."""
    if SpdmIssueHistoryService.delete(history_id):
        return success_response(message='History entry deleted successfully')
    return not_found_response('History entry not found')


# ============== Attachment Routes ==============

@bp.route('/issues/<int:issue_id>/attachments', methods=['GET'])
def get_attachments(issue_id):
    """Get all attachments for an issue."""
    attachments = SpdmAttachmentService.get_by_issue(issue_id)
    return success_response([a.to_dict() for a in attachments])


@bp.route('/issues/<int:issue_id>/attachments', methods=['POST'])
def upload_attachment(issue_id):
    """Upload a file attachment to an issue."""
    issue = SpdmIssueService.get_by_id(issue_id)
    if not issue:
        return not_found_response('Issue not found')

    if 'file' not in request.files:
        return error_response('No file provided')

    file = request.files['file']
    if file.filename == '':
        return error_response('No file selected')

    try:
        attachment = SpdmAttachmentService.create(issue_id, file)
        return created_response(attachment.to_dict())
    except Exception as e:
        return error_response(f'Failed to upload file: {str(e)}')


@bp.route('/attachments/<int:attachment_id>', methods=['GET'])
def get_attachment(attachment_id):
    """Get attachment info."""
    attachment = SpdmAttachmentService.get_by_id(attachment_id)
    if not attachment:
        return not_found_response('Attachment not found')
    return success_response(attachment.to_dict())


@bp.route('/attachments/<int:attachment_id>/download', methods=['GET'])
def download_attachment(attachment_id):
    """Download an attachment file as ZIP to bypass DRM blocking."""
    attachment = SpdmAttachmentService.get_by_id(attachment_id)
    if not attachment:
        return not_found_response('Attachment not found')

    file_path = SpdmAttachmentService.get_file_path(attachment)
    if not file_path or not os.path.exists(file_path):
        return not_found_response('File not found')

    try:
        # Create ZIP in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            zip_file.write(file_path, attachment.original_filename)
        zip_buffer.seek(0)

        # Generate ZIP filename
        base_name = os.path.splitext(attachment.original_filename)[0]
        zip_filename = f'{base_name}.zip'

        return send_file(
            zip_buffer,
            as_attachment=True,
            download_name=zip_filename,
            mimetype='application/zip'
        )
    except Exception as e:
        return error_response(f'Failed to download file: {str(e)}')


@bp.route('/attachments/<int:attachment_id>', methods=['DELETE'])
def delete_attachment(attachment_id):
    """Delete an attachment."""
    if SpdmAttachmentService.delete(attachment_id):
        return success_response(message='Attachment deleted successfully')
    return not_found_response('Attachment not found')


# ============== Schedule Department Routes ==============

@bp.route('/schedule/departments', methods=['GET'])
def get_schedule_departments():
    """Get all schedule departments with their schedules."""
    departments = SpdmScheduleDepartmentService.get_all()
    return success_response([d.to_dict() for d in departments])


@bp.route('/schedule/departments/<int:dept_id>', methods=['GET'])
def get_schedule_department(dept_id):
    """Get a single schedule department."""
    dept = SpdmScheduleDepartmentService.get_by_id(dept_id)
    if not dept:
        return not_found_response('Department not found')
    return success_response(dept.to_dict())


@bp.route('/schedule/departments', methods=['POST'])
def create_schedule_department():
    """Create a new schedule department."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['name'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    dept = SpdmScheduleDepartmentService.create(
        name=data['name'],
        color=data.get('color', '#8b5cf6'),
        order=data.get('order')
    )
    return created_response(dept.to_dict())


@bp.route('/schedule/departments/<int:dept_id>', methods=['PUT'])
def update_schedule_department(dept_id):
    """Update a schedule department."""
    data = get_request_json()
    dept = SpdmScheduleDepartmentService.update(dept_id, **data)
    if not dept:
        return not_found_response('Department not found')
    return success_response(dept.to_dict())


@bp.route('/schedule/departments/<int:dept_id>', methods=['DELETE'])
def delete_schedule_department(dept_id):
    """Delete a schedule department."""
    if SpdmScheduleDepartmentService.delete(dept_id):
        return success_response(message='Department deleted successfully')
    return not_found_response('Department not found')


@bp.route('/schedule/departments/reorder', methods=['PUT'])
def reorder_schedule_departments():
    """Reorder schedule departments."""
    data = get_request_json()
    if 'departmentIds' not in data:
        return error_response('Missing departmentIds')

    SpdmScheduleDepartmentService.reorder(data['departmentIds'])
    return success_response(message='Departments reordered successfully')


# ============== Schedule Item Routes ==============

@bp.route('/schedule/items', methods=['GET'])
def get_schedule_items():
    """Get all schedule items."""
    dept_id = request.args.get('departmentId', type=int)
    if dept_id:
        items = SpdmScheduleItemService.get_by_department(dept_id)
    else:
        items = SpdmScheduleItemService.get_all()
    return success_response([i.to_dict() for i in items])


@bp.route('/schedule/items/<int:item_id>', methods=['GET'])
def get_schedule_item(item_id):
    """Get a single schedule item."""
    item = SpdmScheduleItemService.get_by_id(item_id)
    if not item:
        return not_found_response('Schedule item not found')
    return success_response(item.to_dict())


@bp.route('/schedule/items', methods=['POST'])
def create_schedule_item():
    """Create a new schedule item."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['departmentId', 'phase', 'title', 'startDate', 'endDate'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    item = SpdmScheduleItemService.create(
        department_id=data['departmentId'],
        phase=data['phase'],
        title=data['title'],
        start_date=data['startDate'],
        end_date=data['endDate'],
        status=data.get('status', 'planned'),
        contents=data.get('contents'),
        order=data.get('order')
    )
    return created_response(item.to_dict())


@bp.route('/schedule/items/<int:item_id>', methods=['PUT'])
def update_schedule_item(item_id):
    """Update a schedule item."""
    data = get_request_json()
    item = SpdmScheduleItemService.update(item_id, **data)
    if not item:
        return not_found_response('Schedule item not found')
    return success_response(item.to_dict())


@bp.route('/schedule/items/<int:item_id>', methods=['DELETE'])
def delete_schedule_item(item_id):
    """Delete a schedule item."""
    if SpdmScheduleItemService.delete(item_id):
        return success_response(message='Schedule item deleted successfully')
    return not_found_response('Schedule item not found')


@bp.route('/schedule/items/reorder', methods=['PUT'])
def reorder_schedule_items():
    """Reorder schedule items within a department."""
    data = get_request_json()
    if 'departmentId' not in data or 'itemIds' not in data:
        return error_response('Missing departmentId or itemIds')

    SpdmScheduleItemService.reorder(data['departmentId'], data['itemIds'])
    return success_response(message='Items reordered successfully')


# ============== Module Routes ==============

@bp.route('/modules', methods=['GET'])
def get_modules():
    """Get all modules, optionally filtered by division."""
    division_id = request.args.get('divisionId')
    modules = SpdmModuleService.get_all(division_id=division_id)
    return success_response([m.to_dict() for m in modules])


@bp.route('/modules/<int:module_id>', methods=['GET'])
def get_module(module_id):
    """Get a single module."""
    module = SpdmModuleService.get_by_id(module_id)
    if not module:
        return not_found_response('Module not found')
    return success_response(module.to_dict())


@bp.route('/modules', methods=['POST'])
def create_module():
    """Create a new module."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['name', 'divisionId'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    module = SpdmModuleService.create(
        name=data['name'],
        division_id=data['divisionId'],
        categories=data.get('categories', []),
        system_type=data.get('systemType'),
        links=data.get('links', []),
        description=data.get('description'),
        specs=data.get('specs', []),
        order=data.get('order')
    )
    return created_response(module.to_dict())


@bp.route('/modules/<int:module_id>', methods=['PUT'])
def update_module(module_id):
    """Update a module."""
    data = get_request_json()
    module = SpdmModuleService.update(module_id, **data)
    if not module:
        return not_found_response('Module not found')
    return success_response(module.to_dict())


@bp.route('/modules/<int:module_id>', methods=['DELETE'])
def delete_module(module_id):
    """Delete a module."""
    if SpdmModuleService.delete(module_id):
        return success_response(message='Module deleted successfully')
    return not_found_response('Module not found')


@bp.route('/modules/reorder', methods=['PUT'])
def reorder_modules():
    """Reorder modules."""
    data = get_request_json()
    if 'moduleIds' not in data:
        return error_response('Missing moduleIds')

    SpdmModuleService.reorder(data['moduleIds'])
    return success_response(message='Modules reordered successfully')


@bp.route('/spec-keys', methods=['GET'])
def get_spec_keys():
    """Get spec key suggestions for autocomplete."""
    search = request.args.get('search', '')
    suggestions = SpdmSpecKeySuggestionService.search(query=search)
    return success_response([s.to_dict() for s in suggestions])


# ============== Module Settings (categories/systems/linkMethods) ==============

SPDM_MODULE_NAME = 'spdm_status'

DEFAULT_SETTINGS = {
    'categories': [],
    'systems': [],
    'linkMethods': [],
}


def _get_module_settings_model():
    from app.modules.digital_twin_dashboard.models import ModuleSettings
    return ModuleSettings


def _save_spdm_setting(key, data, desc=''):
    """ModuleSettings 테이블에 spdm_status 설정 저장 (upsert)"""
    ModuleSettings = _get_module_settings_model()
    existing = ModuleSettings.query.filter_by(
        module_name=SPDM_MODULE_NAME,
        settings_key=key
    ).first()

    if existing:
        existing.settings_data = data
        existing.description = desc
        flag_modified(existing, 'settings_data')
    else:
        db.session.add(ModuleSettings(
            module_name=SPDM_MODULE_NAME,
            settings_key=key,
            settings_data=data,
            description=desc
        ))


@bp.route('/module-settings', methods=['GET'])
def get_module_settings():
    """Get spdm_status module settings (categories, systems, linkMethods)."""
    ModuleSettings = _get_module_settings_model()
    rows = ModuleSettings.query.filter_by(module_name=SPDM_MODULE_NAME).all()
    result = {}
    for row in rows:
        result[row.settings_key] = row.settings_data

    for key in ('categories', 'systems', 'linkMethods'):
        if key not in result:
            result[key] = DEFAULT_SETTINGS[key]
    if 'systemDescriptions' not in result:
        result['systemDescriptions'] = {}
    if 'groups' not in result:
        result['groups'] = []
    if 'categoryGroups' not in result:
        result['categoryGroups'] = {}
    if 'categoryDetails' not in result:
        result['categoryDetails'] = {}
    if 'divisionScores' not in result:
        result['divisionScores'] = {}
    if 'divisionModules' not in result:
        result['divisionModules'] = {}
    if 'divisionComments' not in result:
        result['divisionComments'] = {}

    return success_response(result)


@bp.route('/module-settings', methods=['PUT'])
def update_module_settings():
    """Update spdm_status module settings (categories, systems, linkMethods)."""
    data = get_request_json()

    if 'categories' in data:
        _save_spdm_setting('categories', data['categories'], '모듈 구분 목록')
    if 'systems' in data:
        _save_spdm_setting('systems', data['systems'], '구현 시스템 목록')
    if 'linkMethods' in data:
        _save_spdm_setting('linkMethods', data['linkMethods'], '연계 방식 목록')
    if 'systemDescriptions' in data:
        _save_spdm_setting('systemDescriptions', data['systemDescriptions'], '구현 시스템 설명')
    if 'groups' in data:
        _save_spdm_setting('groups', data['groups'], '그룹 정의 목록')
    if 'categoryGroups' in data:
        _save_spdm_setting('categoryGroups', data['categoryGroups'], '모듈구분-그룹 연결')
    if 'categoryDetails' in data:
        _save_spdm_setting('categoryDetails', data['categoryDetails'], '모듈구분별 세부 항목')
    if 'divisionScores' in data:
        _save_spdm_setting('divisionScores', data['divisionScores'], '사업부별 평가 점수')
    if 'divisionModules' in data:
        _save_spdm_setting('divisionModules', data['divisionModules'], '사업부별 모듈')
    if 'divisionComments' in data:
        _save_spdm_setting('divisionComments', data['divisionComments'], '사업부별 코멘트')

    db.session.commit()
    return success_response(message='Settings updated successfully')


# ============== Health Check ==============

@bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return success_response({'status': 'healthy', 'module': 'spdm-status'})
