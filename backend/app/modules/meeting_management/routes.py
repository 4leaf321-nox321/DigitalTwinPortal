"""
Meeting Management Routes
협의체/회의체/보고 관리 API
"""
import io
import zipfile
from flask import request, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.extensions import db
from app.modules.meeting_management import bp
from app.modules.meeting_management.services import (
    MeetingGroupService, MeetingSessionService,
    MeetingAgendaItemService, MeetingAttachmentService,
    ReportPlanService, ReportPlanCommentService, ConflictError
)
from app.shared.responses import (
    success_response, error_response, created_response,
    not_found_response, conflict_response
)
from app.shared.utils import get_request_json, validate_required_fields
from app.shared.timeutil import iso_kst


def _is_report_plan_editor(user_id):
    """Check if user has report plan edit permission based on role permissions."""
    from app.modules.auth.models import User, UserRole
    user = User.query.get(user_id)
    if not user:
        return False
    # Admin always has permission
    if user.role == UserRole.ADMIN:
        return True
    try:
        from app.modules.digital_twin_dashboard.models import ModuleSettings
        setting = ModuleSettings.query.filter_by(
            module_name='auth',
            settings_key='role_module_permissions'
        ).first()
        if not setting or not setting.settings_data:
            # No restrictions set → allow by default
            return True
        role_perms = setting.settings_data.get(user.role, {})
        # If explicitly set to false → blocked
        if role_perms.get('/meeting-management-edit') is False:
            return False
        return True
    except Exception:
        return True


def _can_delete_meeting_session(user_id):
    """회차(세션) 삭제 권한: admin 또는 dt_office 만 허용. manager 등 다른 권한은 불가."""
    from app.modules.auth.models import User, UserRole
    user = User.query.get(user_id)
    if not user:
        return False
    return user.role in (UserRole.ADMIN, UserRole.DT_OFFICE_MEMBER)


# ============== Meeting Group Routes ==============

@bp.route('/groups', methods=['GET'])
def get_groups():
    """Get all meeting groups."""
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    groups = MeetingGroupService.get_all(include_inactive=include_inactive)
    return success_response([g.to_dict() for g in groups])


@bp.route('/groups/<int:group_id>', methods=['GET'])
def get_group(group_id):
    """Get a single meeting group with sessions."""
    group = MeetingGroupService.get_by_id(group_id)
    if not group:
        return not_found_response('Meeting group not found')
    return success_response(group.to_dict(include_sessions=True))


@bp.route('/groups', methods=['POST'])
def create_group():
    """Create a new meeting group."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['name', 'meetingType'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    group = MeetingGroupService.create(
        name=data['name'],
        meeting_type=data['meetingType'],
        cycle=data.get('cycle'),
        description=data.get('description'),
        participants=data.get('participants'),
        color=data.get('color', '#3b82f6')
    )
    return created_response(group.to_dict())


@bp.route('/groups/<int:group_id>', methods=['PUT'])
def update_group(group_id):
    """Update a meeting group."""
    data = get_request_json()
    group = MeetingGroupService.update(group_id, **data)
    if not group:
        return not_found_response('Meeting group not found')
    return success_response(group.to_dict())


@bp.route('/groups/<int:group_id>', methods=['DELETE'])
def delete_group(group_id):
    """Delete a meeting group."""
    if MeetingGroupService.delete(group_id):
        return success_response(message='Meeting group deleted successfully')
    return not_found_response('Meeting group not found')


# ============== Meeting Session Routes ==============

@bp.route('/groups/<int:group_id>/sessions', methods=['GET'])
def get_sessions(group_id):
    """Get all sessions for a meeting group."""
    group = MeetingGroupService.get_by_id(group_id)
    if not group:
        return not_found_response('Meeting group not found')

    sessions = MeetingSessionService.get_all_by_group(group_id)
    return success_response([s.to_dict() for s in sessions])


@bp.route('/sessions/<int:session_id>', methods=['GET'])
def get_session(session_id):
    """Get a single session."""
    session = MeetingSessionService.get_by_id(session_id)
    if not session:
        return not_found_response('Session not found')
    return success_response(session.to_dict())


@bp.route('/groups/<int:group_id>/sessions', methods=['POST'])
def create_session(group_id):
    """Create a new session."""
    group = MeetingGroupService.get_by_id(group_id)
    if not group:
        return not_found_response('Meeting group not found')

    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['sessionDate'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    # Parse date
    try:
        session_date = datetime.strptime(data['sessionDate'], '%Y-%m-%d').date()
    except ValueError:
        return error_response('Invalid date format. Use YYYY-MM-DD')

    # Get year from data or session_date
    year = data.get('year') or session_date.year

    # Get next session number if not provided
    session_number = data.get('sessionNumber')
    if not session_number:
        session_number = MeetingSessionService.get_next_session_number(group_id, year)

    session = MeetingSessionService.create(
        group_id=group_id,
        year=year,
        session_number=session_number,
        session_date=session_date,
        session_time=data.get('sessionTime'),
        location=data.get('location'),
        summary=data.get('summary'),
        agenda_items=data.get('agendaItems', [])
    )
    return created_response(session.to_dict())


@bp.route('/sessions/<int:session_id>', methods=['PUT'])
def update_session(session_id):
    """Update a session with optimistic locking."""
    data = get_request_json()

    # 낙관적 잠금: 클라이언트가 보낸 updatedAt과 DB 값 비교
    client_updated_at = data.pop('updatedAt', None)

    # 기존 세션 조회
    session = MeetingSessionService.get_by_id(session_id)
    if not session:
        return not_found_response('Session not found')

    # updatedAt 비교 (클라이언트가 값을 보낸 경우에만)
    if client_updated_at:
        try:
            client_dt = datetime.fromisoformat(client_updated_at.replace('Z', '+00:00'))
            server_dt = session.updated_at

            # 타임존 정보 제거하여 비교 (naive datetime으로 통일)
            if client_dt.tzinfo:
                client_dt = client_dt.replace(tzinfo=None)
            if server_dt and server_dt.tzinfo:
                server_dt = server_dt.replace(tzinfo=None)

            # 시간 차이가 1초 이상이면 충돌로 판단
            if server_dt:
                time_diff = abs((server_dt - client_dt).total_seconds())
                if time_diff > 1:
                    return conflict_response(
                        '다른 사용자가 이 회차를 수정했습니다. 새로고침 후 다시 시도해주세요.',
                        {'current': session.to_dict()}
                    )
        except (ValueError, TypeError):
            # 파싱 실패 시 잠금 검증 생략
            pass

    # Parse date if provided
    if 'sessionDate' in data:
        try:
            data['sessionDate'] = datetime.strptime(data['sessionDate'], '%Y-%m-%d').date()
        except ValueError:
            return error_response('Invalid date format. Use YYYY-MM-DD')

    # Update agenda items if provided
    if 'agendaItems' in data:
        MeetingAgendaItemService.bulk_update(session_id, data.pop('agendaItems'))

    session = MeetingSessionService.update(session_id, **data)
    if not session:
        return not_found_response('Session not found')
    return success_response(session.to_dict())


@bp.route('/sessions/<int:session_id>', methods=['DELETE'])
@jwt_required()
def delete_session(session_id):
    """Delete a session. Admin 또는 DT Office 멤버만 가능."""
    user_id = int(get_jwt_identity())
    if not _can_delete_meeting_session(user_id):
        return error_response('회차 삭제 권한이 없습니다. 관리자 또는 DT Office 멤버만 가능합니다.', status_code=403)
    if MeetingSessionService.delete(session_id):
        return success_response(message='Session deleted successfully')
    return not_found_response('Session not found')


# ============== Agenda Item Routes ==============

@bp.route('/sessions/<int:session_id>/items', methods=['GET'])
def get_agenda_items(session_id):
    """Get all agenda items for a session."""
    items = MeetingAgendaItemService.get_by_session(session_id)
    return success_response([i.to_dict() for i in items])


@bp.route('/sessions/<int:session_id>/items', methods=['POST'])
def create_agenda_item(session_id):
    """Create a new agenda item."""
    session = MeetingSessionService.get_by_id(session_id)
    if not session:
        return not_found_response('Session not found')

    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['title'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    item = MeetingAgendaItemService.create(
        session_id=session_id,
        title=data['title'],
        content=data.get('content'),
        order=data.get('order', 0)
    )
    return created_response(item.to_dict())


@bp.route('/items/<int:item_id>', methods=['PUT'])
def update_agenda_item(item_id):
    """Update an agenda item."""
    data = get_request_json()
    item = MeetingAgendaItemService.update(item_id, **data)
    if not item:
        return not_found_response('Agenda item not found')
    return success_response(item.to_dict())


@bp.route('/items/<int:item_id>', methods=['DELETE'])
def delete_agenda_item(item_id):
    """Delete an agenda item."""
    if MeetingAgendaItemService.delete(item_id):
        return success_response(message='Agenda item deleted successfully')
    return not_found_response('Agenda item not found')


# ============== Attachment Routes ==============

@bp.route('/sessions/<int:session_id>/attachments', methods=['GET'])
def get_attachments(session_id):
    """Get all attachments for a session."""
    attachments = MeetingAttachmentService.get_by_session(session_id)
    return success_response([a.to_dict() for a in attachments])


@bp.route('/sessions/<int:session_id>/attachments', methods=['POST'])
def upload_attachment(session_id):
    """Upload a file attachment to a session."""
    session = MeetingSessionService.get_by_id(session_id)
    if not session:
        return not_found_response('Session not found')

    if 'file' not in request.files:
        return error_response('No file provided')

    file = request.files['file']
    if file.filename == '':
        return error_response('No file selected')

    file_type = request.form.get('fileType', 'etc')

    try:
        attachment = MeetingAttachmentService.create(session_id, file, file_type)
        return created_response(attachment.to_dict())
    except Exception as e:
        return error_response(f'Failed to upload file: {str(e)}')


@bp.route('/attachments/<int:attachment_id>', methods=['GET'])
def get_attachment(attachment_id):
    """Get attachment info."""
    attachment = MeetingAttachmentService.get_by_id(attachment_id)
    if not attachment:
        return not_found_response('Attachment not found')
    return success_response(attachment.to_dict())


@bp.route('/attachments/<int:attachment_id>/download', methods=['GET'])
def download_attachment(attachment_id):
    """Download an attachment file as ZIP to bypass DRM blocking."""
    import os
    attachment = MeetingAttachmentService.get_by_id(attachment_id)
    if not attachment:
        return not_found_response('Attachment not found')

    file_path = MeetingAttachmentService.get_file_path(attachment)
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
    if MeetingAttachmentService.delete(attachment_id):
        return success_response(message='Attachment deleted successfully')
    return not_found_response('Attachment not found')


# ============== Report Plan Permission Check ==============

@bp.route('/report-plan/can-edit', methods=['GET'])
@jwt_required()
def check_report_plan_edit_permission():
    """Check if current user can edit report plans."""
    user_id = int(get_jwt_identity())
    can_edit = _is_report_plan_editor(user_id)
    return success_response({'canEdit': can_edit})


# ============== Report Plan Routes ==============

REPORT_PLAN_TAB_KEYS = ('ceo', 'cfo', 'issue')
REPORT_PLAN_NOTICE_SCOPES = ('all', 'ceo', 'cfo', 'issue')


@bp.route('/report-plan/<tab_key>', methods=['GET'])
def get_report_plan(tab_key):
    """Get all rounds for a report plan tab (ceo/cfo/issue)."""
    if tab_key not in REPORT_PLAN_TAB_KEYS:
        return error_response('Invalid tab key. Must be "ceo", "cfo", or "issue".')
    rounds = ReportPlanService.get_rounds_by_tab(tab_key)
    meta = ReportPlanService.get_tab_meta(tab_key)
    return success_response({
        'rounds': [r.to_dict() for r in rounds],
        'updatedAt': iso_kst(meta.updated_at) if meta else None,
    })


@bp.route('/report-plan/<tab_key>', methods=['PUT'])
@jwt_required()
def save_report_plan(tab_key):
    """Save (replace) all rounds for a report plan tab."""
    if tab_key not in REPORT_PLAN_TAB_KEYS:
        return error_response('Invalid tab key. Must be "ceo", "cfo", or "issue".')

    # 보고계획 편집 권한 체크
    user_id = int(get_jwt_identity())
    if not _is_report_plan_editor(user_id):
        return error_response('보고계획 편집 권한이 없습니다. 관리자에게 문의하세요.', status_code=403)

    data = get_request_json()
    rounds_data = data.get('rounds', [])
    client_updated_at = data.get('updatedAt', None)
    try:
        rounds, meta = ReportPlanService.save_tab_data(tab_key, rounds_data, client_updated_at)
        return success_response({
            'rounds': [r.to_dict() for r in rounds],
            'updatedAt': iso_kst(meta.updated_at) if meta else None,
        })
    except ConflictError as e:
        return conflict_response(
            '다른 사용자가 보고 계획을 수정했습니다.',
            {
                'current': e.current_rounds,
                'updatedAt': e.server_updated_at,
            }
        )
    except Exception as e:
        return error_response(f'Failed to save report plan: {str(e)}')


# ============== Report Plan Comment Routes ==============

@bp.route('/report-plan/<tab_key>/comments', methods=['GET'])
def get_report_plan_comments(tab_key):
    """Get all comments for a report plan tab."""
    if tab_key not in REPORT_PLAN_TAB_KEYS:
        return error_response('Invalid tab key.')
    status_filter = request.args.get('status', None) or None
    comments = ReportPlanCommentService.get_by_tab(tab_key, status_filter=status_filter)
    return success_response([c.to_dict() for c in comments])


@bp.route('/report-plan/<tab_key>/comments', methods=['POST'])
def create_report_plan_comment(tab_key):
    """Create a new comment."""
    if tab_key not in REPORT_PLAN_TAB_KEYS:
        return error_response('Invalid tab key.')
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['author', 'content'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')
    comment = ReportPlanCommentService.create(
        tab_key=tab_key,
        author=data['author'],
        content=data['content'],
        parent_id=data.get('parentId'),
    )
    return created_response(comment.to_dict())


@bp.route('/report-plan/comments/<int:comment_id>', methods=['PUT'])
def update_report_plan_comment(comment_id):
    """Update a comment (content or resolved status)."""
    data = get_request_json()
    comment = ReportPlanCommentService.update(comment_id, **data)
    if not comment:
        return not_found_response('Comment not found')
    return success_response(comment.to_dict())


@bp.route('/report-plan/comments/<int:comment_id>', methods=['DELETE'])
def delete_report_plan_comment(comment_id):
    """Delete a comment."""
    if ReportPlanCommentService.delete(comment_id):
        return success_response(message='Comment deleted successfully')
    return not_found_response('Comment not found')


# ============== Report Plan Notice Routes ==============

@bp.route('/report-plan/notices', methods=['GET'])
def get_report_plan_notices():
    """Get report plan notices, optionally filtered by scope."""
    from app.modules.meeting_management.models import ReportPlanNotice
    scope = request.args.get('scope', None)
    query = ReportPlanNotice.query.filter_by(is_active=True)
    if scope and scope in REPORT_PLAN_NOTICE_SCOPES:
        # Return notices matching the scope or 'all'
        query = query.filter(ReportPlanNotice.scope.in_([scope, 'all']))
    notices = query.order_by(ReportPlanNotice.created_at.desc()).all()
    return success_response([n.to_dict() for n in notices])


@bp.route('/report-plan/notices', methods=['POST'])
@jwt_required()
def create_report_plan_notice():
    """Create a new report plan notice (edit permission required)."""
    user_id = int(get_jwt_identity())
    if not _is_report_plan_editor(user_id):
        return error_response('공지 작성 권한이 없습니다.', status_code=403)

    from app.modules.auth.models import User
    from app.modules.meeting_management.models import ReportPlanNotice

    user = User.query.get(user_id)
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['title', 'content'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    scope = data.get('scope', 'all')
    if scope not in REPORT_PLAN_NOTICE_SCOPES:
        return error_response('Invalid scope. Must be "all", "ceo", "cfo", or "issue".')

    notice = ReportPlanNotice(
        title=data['title'],
        content=data['content'],
        scope=scope,
        author_id=user_id,
        author_name=user.name if user else '',
    )
    db.session.add(notice)
    db.session.commit()
    return created_response(notice.to_dict())


@bp.route('/report-plan/notices/<int:notice_id>', methods=['PUT'])
@jwt_required()
def update_report_plan_notice(notice_id):
    """Update a report plan notice (edit permission required)."""
    user_id = int(get_jwt_identity())
    if not _is_report_plan_editor(user_id):
        return error_response('공지 수정 권한이 없습니다.', status_code=403)

    from app.modules.meeting_management.models import ReportPlanNotice
    notice = ReportPlanNotice.query.get(notice_id)
    if not notice:
        return not_found_response('Notice not found')

    data = get_request_json()
    if 'title' in data:
        notice.title = data['title']
    if 'content' in data:
        notice.content = data['content']
    if 'scope' in data and data['scope'] in REPORT_PLAN_NOTICE_SCOPES:
        notice.scope = data['scope']
    if 'isActive' in data:
        notice.is_active = data['isActive']

    db.session.commit()
    return success_response(notice.to_dict())


@bp.route('/report-plan/notices/<int:notice_id>', methods=['DELETE'])
@jwt_required()
def delete_report_plan_notice(notice_id):
    """Delete a report plan notice (edit permission required)."""
    user_id = int(get_jwt_identity())
    if not _is_report_plan_editor(user_id):
        return error_response('공지 삭제 권한이 없습니다.', status_code=403)

    from app.modules.meeting_management.models import ReportPlanNotice
    notice = ReportPlanNotice.query.get(notice_id)
    if not notice:
        return not_found_response('Notice not found')

    db.session.delete(notice)
    db.session.commit()
    return success_response(message='공지가 삭제되었습니다.')


# ============== Health Check ==============

@bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return success_response({'status': 'healthy', 'module': 'meeting-management'})
