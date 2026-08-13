"""
Office Management Routes
"""
import io
import os
import zipfile
from flask import request, send_file
from app.modules.office_management import bp
from app.modules.office_management.services import WeekService, AgendaService, BulkService, AttachmentService, BusinessContactService
from app.shared.responses import success_response, error_response, created_response, not_found_response, conflict_response
from datetime import datetime
from app.shared.utils import get_request_json, validate_required_fields


# ============== Week Routes ==============

@bp.route('/weeks', methods=['GET'])
def get_weeks():
    """Get all weeks with agendas."""
    weeks = WeekService.get_all()
    return success_response([w.to_dict(include_agendas=True) for w in weeks])


@bp.route('/weeks/<int:week_id>', methods=['GET'])
def get_week(week_id):
    """Get a single week."""
    week = WeekService.get_by_id(week_id)
    if not week:
        return not_found_response('Week not found')
    return success_response(week.to_dict(include_agendas=True))


@bp.route('/weeks', methods=['POST'])
def create_week():
    """Create a new week."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['year', 'week'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    week = WeekService.create(
        year=data['year'],
        week=data['week']
    )
    return created_response(week.to_dict(include_agendas=True))


@bp.route('/weeks/<int:week_id>', methods=['PUT'])
def update_week(week_id):
    """Update a week."""
    data = get_request_json()
    week = WeekService.update(week_id, **data)
    if not week:
        return not_found_response('Week not found')
    return success_response(week.to_dict(include_agendas=True))


@bp.route('/weeks/<int:week_id>', methods=['DELETE'])
def delete_week(week_id):
    """Delete a week and all its agendas."""
    if WeekService.delete(week_id):
        return success_response(message='Week deleted successfully')
    return not_found_response('Week not found')


# ============== Agenda Routes ==============

@bp.route('/weeks/<int:week_id>/agendas', methods=['GET'])
def get_agendas(week_id):
    """Get all agendas for a week."""
    agendas = AgendaService.get_by_week(week_id)
    return success_response([a.to_dict() for a in agendas])


@bp.route('/weeks/<int:week_id>/agendas', methods=['POST'])
def create_agenda(week_id):
    """Create a new agenda."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['title'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    # Check if week exists
    week = WeekService.get_by_id(week_id)
    if not week:
        return not_found_response('Week not found')

    agenda = AgendaService.create(
        week_id=week_id,
        title=data['title'],
        content=data.get('content'),
        linked_agenda_title=data.get('linkedAgendaTitle')
    )
    return created_response(agenda.to_dict())


@bp.route('/agendas/<int:agenda_id>', methods=['GET'])
def get_agenda(agenda_id):
    """Get a single agenda."""
    agenda = AgendaService.get_by_id(agenda_id)
    if not agenda:
        return not_found_response('Agenda not found')
    return success_response(agenda.to_dict())


@bp.route('/agendas/<int:agenda_id>', methods=['PUT'])
def update_agenda(agenda_id):
    """Update an agenda with optimistic locking."""
    data = get_request_json()

    # 낙관적 잠금: 클라이언트가 보낸 updated_at과 DB 값 비교
    client_updated_at = data.pop('updated_at', None)

    # 기존 안건 조회
    agenda = AgendaService.get_by_id(agenda_id)
    if not agenda:
        return not_found_response('Agenda not found')

    # updated_at 비교 (클라이언트가 값을 보낸 경우에만)
    if client_updated_at:
        # ISO 형식 문자열을 datetime으로 변환
        try:
            client_dt = datetime.fromisoformat(client_updated_at.replace('Z', '+00:00'))
            server_dt = agenda.updated_at

            # 타임존 정보 제거하여 비교 (naive datetime으로 통일)
            if client_dt.tzinfo:
                client_dt = client_dt.replace(tzinfo=None)
            if server_dt.tzinfo:
                server_dt = server_dt.replace(tzinfo=None)

            # 시간 차이가 1초 이상이면 충돌로 판단
            time_diff = abs((server_dt - client_dt).total_seconds())
            if time_diff > 1:
                return conflict_response(
                    '다른 사용자가 이 안건을 수정했습니다. 새로고침 후 다시 시도해주세요.',
                    {'current': agenda.to_dict()}
                )
        except (ValueError, TypeError):
            # 파싱 실패 시 잠금 검증 생략
            pass

    # 업데이트 실행
    updated_agenda = AgendaService.update(agenda_id, **data)
    return success_response(updated_agenda.to_dict())


@bp.route('/agendas/<int:agenda_id>', methods=['DELETE'])
def delete_agenda(agenda_id):
    """Delete an agenda."""
    if AgendaService.delete(agenda_id):
        return success_response(message='Agenda deleted successfully')
    return not_found_response('Agenda not found')


@bp.route('/agenda-titles', methods=['GET'])
def get_agenda_titles():
    """Get all unique agenda titles."""
    titles = AgendaService.get_all_titles()
    return success_response(titles)


# ============== Bulk Operations ==============

@bp.route('/bulk/add', methods=['POST'])
def bulk_add():
    """Bulk add agendas."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['items'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    items = data['items']
    if not items:
        return error_response('No items to add')

    # Validate each item
    for i, item in enumerate(items):
        if 'year' not in item or 'week' not in item or 'title' not in item:
            return error_response(f'Item {i+1} is missing required fields (year, week, title)')

    result = BulkService.bulk_add_agendas(items)
    return success_response(result)


@bp.route('/data', methods=['GET'])
def get_all_data():
    """Get all weeks and agendas."""
    data = BulkService.get_all_data()
    return success_response(data)


@bp.route('/data', methods=['POST'])
def save_all_data():
    """Save all data (replace existing)."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['weeks'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    result = BulkService.save_all_data(data['weeks'])
    return success_response(result)


# ============== Attachment Routes ==============

@bp.route('/agendas/<int:agenda_id>/attachments', methods=['GET'])
def get_attachments(agenda_id):
    """Get all attachments for an agenda."""
    agenda = AgendaService.get_by_id(agenda_id)
    if not agenda:
        return not_found_response('Agenda not found')

    attachments = AttachmentService.get_by_agenda(agenda_id)
    return success_response([a.to_dict() for a in attachments])


@bp.route('/agendas/<int:agenda_id>/attachments', methods=['POST'])
def upload_attachment(agenda_id):
    """Upload a file attachment to an agenda."""
    agenda = AgendaService.get_by_id(agenda_id)
    if not agenda:
        return not_found_response('Agenda not found')

    if 'file' not in request.files:
        return error_response('No file provided')

    file = request.files['file']
    if file.filename == '':
        return error_response('No file selected')

    try:
        attachment = AttachmentService.create(agenda_id, file)
        return created_response(attachment.to_dict())
    except Exception as e:
        return error_response(f'Failed to upload file: {str(e)}')


@bp.route('/attachments/<int:attachment_id>', methods=['GET'])
def get_attachment(attachment_id):
    """Get attachment info."""
    attachment = AttachmentService.get_by_id(attachment_id)
    if not attachment:
        return not_found_response('Attachment not found')
    return success_response(attachment.to_dict())


@bp.route('/attachments/<int:attachment_id>/download', methods=['GET'])
def download_attachment(attachment_id):
    """Download an attachment file as ZIP to bypass DRM blocking."""
    attachment = AttachmentService.get_by_id(attachment_id)
    if not attachment:
        return not_found_response('Attachment not found')

    file_path = AttachmentService.get_file_path(attachment)
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
    if AttachmentService.delete(attachment_id):
        return success_response(message='Attachment deleted successfully')
    return not_found_response('Attachment not found')


# ============== Business Contacts Routes ==============

@bp.route('/business-contacts', methods=['GET'])
def get_business_contacts():
    """Get all business contacts data."""
    data = BusinessContactService.get_data()
    return success_response(data)


@bp.route('/business-contacts', methods=['PUT'])
def save_business_contacts():
    """Save business contacts data."""
    request_data = get_request_json()
    data = request_data.get('data', {})
    result = BusinessContactService.save_data(data)
    return success_response(result)


# ============== Health Check ==============

@bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return success_response({'status': 'healthy', 'module': 'office-management'})
