"""
Authentication Routes
"""
from flask import request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.modules.auth import bp, pat
from app.modules.auth.services import AuthService, UserService
from app.modules.auth.models import Notice, AccessLog
from app.extensions import db
from app.shared.responses import success_response, error_response, created_response
from app.shared.utils import get_request_json, validate_required_fields
from app.shared.timeutil import iso_kst


# ============== Authentication Routes ==============

@bp.route('/register', methods=['POST'])
def register():
    """Register a new user."""
    data = get_request_json()

    # Validate required fields
    is_valid, missing = validate_required_fields(data, ['email', 'password', 'name'])
    if not is_valid:
        return error_response(f'필수 항목이 누락되었습니다: {", ".join(missing)}')

    user, error = AuthService.register(
        email=data['email'],
        password=data['password'],
        name=data['name'],
        department=data.get('department'),
        position=data.get('position'),
        phone=data.get('phone')
    )

    if error:
        return error_response(error)

    return created_response(user.to_dict(), '회원가입이 완료되었습니다.')


@bp.route('/login', methods=['POST'])
def login():
    """Login and get access tokens."""
    data = get_request_json()

    # Validate required fields
    is_valid, missing = validate_required_fields(data, ['email', 'password'])
    if not is_valid:
        return error_response(f'필수 항목이 누락되었습니다: {", ".join(missing)}')

    # Get client info
    user_agent = request.headers.get('User-Agent')
    ip_address = request.remote_addr

    tokens, error = AuthService.login(
        email=data['email'],
        password=data['password'],
        user_agent=user_agent,
        ip_address=ip_address
    )

    if error:
        return error_response(error, status_code=401)

    # 접속 이력 기록
    try:
        logged_in_user = tokens.get('user', {})
        log = AccessLog(
            user_id=logged_in_user.get('id'),
            user_email=data['email'],
            user_name=logged_in_user.get('name', ''),
            action='LOGIN',
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        print(f"[AccessLog] Login log failed: {e}")

    return success_response(tokens, '로그인 성공')


@bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logout (revoke refresh token)."""
    data = get_request_json()
    refresh_token = data.get('refresh_token')

    if refresh_token:
        AuthService.logout(refresh_token)

    return success_response(message='로그아웃 되었습니다.')


@bp.route('/logout-all', methods=['POST'])
@jwt_required()
def logout_all():
    """Logout from all devices."""
    user_id = int(get_jwt_identity())
    AuthService.logout_all(user_id)

    return success_response(message='모든 기기에서 로그아웃 되었습니다.')


@bp.route('/refresh', methods=['POST'])
def refresh_token():
    """Refresh access token."""
    data = get_request_json()

    is_valid, missing = validate_required_fields(data, ['refresh_token'])
    if not is_valid:
        return error_response('리프레시 토큰이 필요합니다.')

    result, error = AuthService.refresh_access_token(data['refresh_token'])

    if error:
        return error_response(error, status_code=401)

    return success_response(result)


# ============== 개인 액세스 토큰 (MCP 등 외부 클라이언트용) ==============
#
# 왜 JWT 를 그대로 쓰지 않나
#     MCP 등록은 헤더에 토큰을 **박아넣는** 방식이라(`claude mcp add --header ...`)
#     갱신이 안 되는데, JWT 액세스 토큰은 12시간이면 만료된다. 게다가 JWT 는
#     stateless 라 **폐기할 수단이 없다**(secret 교체 = 전원 재로그인).
#     그래서 GitHub PAT 과 같은 방식을 쓴다 — `app/modules/auth/pat.py`.
#
# ⚠️ 여기서 발급하는 토큰은 **그 사용자 권한 그대로**다. 만능 토큰이 아니다.

@bp.route('/me/mcp-tokens', methods=['GET'])
@jwt_required()
def list_my_mcp_tokens():
    """내 토큰 목록. **평문은 들어 있지 않다**(해시만 보관하므로 되돌릴 수 없다)."""
    user_id = int(get_jwt_identity())
    return success_response([t.to_dict() for t in pat.list_tokens(user_id)])


@bp.route('/me/mcp-tokens', methods=['POST'])
@jwt_required()
def create_my_mcp_token():
    """
    새 토큰 발급.

    ⚠️ 평문(`token`)은 **이 응답에서 딱 한 번만** 나온다. 목록 조회로는 다시 볼 수 없다 —
       DB 에 해시만 두기 때문이고, 그게 의도다.
    """
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    name = data.get('name') or 'MCP 토큰'
    expires_days = data.get('expiresDays', pat.DEFAULT_EXPIRES_DAYS)

    row, plaintext = pat.create_token(user_id, name, expires_days)
    return success_response(
        {'token': plaintext, 'info': row.to_dict()},
        message='토큰이 발급되었습니다. 지금 복사하세요 — 다시 볼 수 없습니다.',
        status_code=201,
    )


@bp.route('/me/mcp-tokens/<int:token_id>', methods=['DELETE'])
@jwt_required()
def delete_my_mcp_token(token_id):
    """토큰 폐기 — 행을 지운다. **즉시 무효**가 되고 목록에서도 사라진다."""
    user_id = int(get_jwt_identity())
    if not pat.delete_token(user_id, token_id):
        return error_response('토큰을 찾을 수 없습니다.', status_code=404)
    return success_response(None, message='토큰을 폐기했습니다.')


# ============== User Profile Routes ==============

@bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current user's profile."""
    user_id = int(get_jwt_identity())
    user = UserService.get_by_id(user_id)

    if not user:
        return error_response('사용자를 찾을 수 없습니다.', status_code=404)

    return success_response(user.to_dict())


@bp.route('/me', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update current user's profile."""
    user_id = int(get_jwt_identity())
    data = get_request_json()

    user, error = UserService.update_profile(user_id, **data)

    if error:
        return error_response(error)

    return success_response(user.to_dict(), '프로필이 업데이트되었습니다.')


@bp.route('/me/password', methods=['PUT'])
@jwt_required()
def change_password():
    """Change current user's password."""
    user_id = int(get_jwt_identity())
    data = get_request_json()

    is_valid, missing = validate_required_fields(data, ['current_password', 'new_password'])
    if not is_valid:
        return error_response(f'필수 항목이 누락되었습니다: {", ".join(missing)}')

    user, error = UserService.change_password(
        user_id,
        data['current_password'],
        data['new_password']
    )

    if error:
        return error_response(error)

    return success_response(message='비밀번호가 변경되었습니다. 다시 로그인해주세요.')


# ============== User Search ==============

@bp.route('/users/search', methods=['GET'])
@jwt_required()
def search_users():
    """Search users by name (for autocomplete)."""
    q = request.args.get('q', '').strip()
    if len(q) < 1:
        return success_response([])

    from app.modules.auth.models import User
    users = User.query.filter(
        User.name.ilike(f'%{q}%'),
        User.is_active == True
    ).limit(10).all()

    results = [
        {
            'id': u.id,
            'name': u.name,
            'email': u.email,
            'department': u.department or ''
        }
        for u in users
    ]
    return success_response(results)


# ============== Admin Routes ==============

@bp.route('/roles', methods=['GET'])
@jwt_required()
def get_roles():
    """Get all available roles."""
    from app.modules.auth.models import UserRole
    roles = [
        {'id': 'admin', 'name': 'Admin', 'description': '관리자 - 모든 권한'},
        {'id': 'manager', 'name': 'Manager', 'description': '매니저 - 관리 권한'},
        {'id': 'user', 'name': 'User', 'description': '사용자 - 일반 권한'},
        {'id': 'viewer', 'name': 'Viewer', 'description': '뷰어 - 읽기 전용'},
    ]
    return success_response(roles)


@bp.route('/users', methods=['GET'])
@jwt_required()
def get_all_users():
    """Get all users (admin only)."""
    user_id = int(get_jwt_identity())
    current_user = UserService.get_by_id(user_id)

    if not current_user or not current_user.is_admin_user():
        return error_response('관리자 권한이 필요합니다.', status_code=403)

    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    users = UserService.get_all(include_inactive=include_inactive)

    return success_response([u.to_dict() for u in users])


@bp.route('/users/<int:target_user_id>', methods=['PUT'])
@jwt_required()
def update_user_info(target_user_id):
    """Update user info (admin only) - name, department, role."""
    from app.modules.auth.models import UserRole

    user_id = int(get_jwt_identity())
    current_user = UserService.get_by_id(user_id)

    if not current_user or not current_user.is_admin_user():
        return error_response('관리자 권한이 필요합니다.', status_code=403)

    target_user = UserService.get_by_id(target_user_id)
    if not target_user:
        return error_response('사용자를 찾을 수 없습니다.', status_code=404)

    data = get_request_json()

    # 이름 업데이트
    if 'name' in data and data['name']:
        target_user.name = data['name'].strip()

    # 부서 업데이트
    if 'department' in data:
        target_user.department = data['department'].strip() if data['department'] else None

    # 권한 업데이트 (자신의 권한은 변경 불가)
    if 'role' in data and data['role']:
        new_role = data['role']
        if new_role not in UserRole.ALL_ROLES:
            return error_response(f'유효하지 않은 권한입니다. 가능한 값: {", ".join(UserRole.ALL_ROLES)}')

        if target_user_id != user_id:
            target_user.role = new_role

    from app import db
    db.session.commit()

    return success_response(target_user.to_dict(), '사용자 정보가 수정되었습니다.')


@bp.route('/users/<int:target_user_id>/role', methods=['PUT'])
@jwt_required()
def update_user_role(target_user_id):
    """Update user role (admin only)."""
    from app.modules.auth.models import UserRole

    user_id = int(get_jwt_identity())
    current_user = UserService.get_by_id(user_id)

    if not current_user or not current_user.is_admin_user():
        return error_response('관리자 권한이 필요합니다.', status_code=403)

    data = get_request_json()
    new_role = data.get('role')

    if not new_role or new_role not in UserRole.ALL_ROLES:
        return error_response(f'유효하지 않은 권한입니다. 가능한 값: {", ".join(UserRole.ALL_ROLES)}')

    # 자신의 권한은 변경 불가
    if target_user_id == user_id:
        return error_response('자신의 권한은 변경할 수 없습니다.')

    user, error = UserService.update_role(target_user_id, new_role)

    if error:
        return error_response(error)

    return success_response(user.to_dict(), f'권한이 {new_role}으로 변경되었습니다.')


@bp.route('/users/<int:target_user_id>/password', methods=['PUT'])
@jwt_required()
def admin_reset_password(target_user_id):
    """Reset user password (admin only)."""
    user_id = int(get_jwt_identity())
    current_user = UserService.get_by_id(user_id)

    if not current_user or not current_user.is_admin_user():
        return error_response('관리자 권한이 필요합니다.', status_code=403)

    # 자신의 비밀번호는 일반 비밀번호 변경 API 사용
    if target_user_id == user_id:
        return error_response('자신의 비밀번호는 "비밀번호 변경" 기능을 사용해주세요.')

    target_user = UserService.get_by_id(target_user_id)
    if not target_user:
        return error_response('사용자를 찾을 수 없습니다.', status_code=404)

    data = get_request_json()
    new_password = data.get('new_password')

    if not new_password:
        return error_response('새 비밀번호를 입력해주세요.')

    if len(new_password) < 4:
        return error_response('비밀번호는 최소 4자 이상이어야 합니다.')

    # 비밀번호 변경
    target_user.set_password(new_password)

    from app import db
    db.session.commit()

    return success_response(message=f'사용자 "{target_user.name}"의 비밀번호가 변경되었습니다.')


@bp.route('/users/<int:target_user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(target_user_id):
    """Delete a user permanently (admin only)."""
    user_id = int(get_jwt_identity())
    current_user = UserService.get_by_id(user_id)

    if not current_user or not current_user.is_admin_user():
        return error_response('관리자 권한이 필요합니다.', status_code=403)

    if target_user_id == user_id:
        return error_response('자신의 계정은 삭제할 수 없습니다.')

    target_user = UserService.get_by_id(target_user_id)
    if not target_user:
        return error_response('사용자를 찾을 수 없습니다.', status_code=404)

    user_name = target_user.name

    # Import all models referencing users.id up-front so a renamed/missing class fails loudly
    # at deploy time rather than silently skipping the cleanup and tripping FK violations later.
    from app import db
    from app.modules.auth.models import RefreshToken
    from app.modules.dx_work_process.models import Graph
    from app.modules.collaboration_board.models import (
        BoardPost, BoardComment, BoardAttachment,
    )
    from app.modules.survey.models import Survey, SurveyResponse
    from app.modules.meeting_management.models import ReportPlanNotice
    from app.modules.digital_twin_task_management.models import TaskManagementData
    from app.modules.digital_twin_dashboard.models import (
        DashboardData, DashboardSnapshot, ProjectAttachment, DashboardActivityLog,
    )
    from app.modules.dev_manufacturing_process.models import ProcessDiagramData
    from app.modules.digital_twin_tech_level.models import TechLevelData

    try:
        # auth: anonymize access logs, drop tokens, transfer notices to current admin
        AccessLog.query.filter_by(user_id=target_user_id).update({'user_id': None})
        RefreshToken.query.filter_by(user_id=target_user_id).delete()
        Notice.query.filter_by(author_id=target_user_id).update({'author_id': user_id})

        # dx_work_process: graphs require an owner, transfer to admin
        Graph.query.filter_by(user_id=target_user_id).update({'user_id': user_id})

        # collaboration_board: posts/comments require an author -> transfer; attachments are nullable -> anonymize
        BoardPost.query.filter_by(author_id=target_user_id).update({'author_id': user_id})
        BoardComment.query.filter_by(author_id=target_user_id).update({'author_id': user_id})
        BoardAttachment.query.filter_by(uploader_id=target_user_id).update({'uploader_id': None})

        # survey: 만든 사람은 관리자에게 넘기고, **응답은 통째로 지운다.**
        #
        # 응답만 익명화(user_id=NULL)하면 안 된다 — user_id 는 NOT NULL 이고,
        # (survey_id, user_id) 유니크로 중복 응답을 막는 칸이라 비우면 그 장치가
        # 무너진다. 그리고 떠난 사람의 응답을 남겨두면 집계 분모(대상자 수)에는
        # 없는데 분자에는 있는 상태가 된다.
        Survey.query.filter_by(created_by=target_user_id).update({'created_by': user_id})
        SurveyResponse.query.filter_by(user_id=target_user_id).delete()

        # meeting_management: report-plan notices require an author -> transfer
        ReportPlanNotice.query.filter_by(author_id=target_user_id).update({'author_id': user_id})

        # digital_twin_task_management: nullable last modifier
        TaskManagementData.query.filter_by(last_modified_by=target_user_id).update({'last_modified_by': None})

        # digital_twin_dashboard: nullable audit/metadata columns
        DashboardData.query.filter_by(last_modified_by=target_user_id).update({'last_modified_by': None})
        DashboardSnapshot.query.filter_by(created_by=target_user_id).update({'created_by': None})
        ProjectAttachment.query.filter_by(uploaded_by=target_user_id).update({'uploaded_by': None})
        DashboardActivityLog.query.filter_by(user_id=target_user_id).update({'user_id': None})

        # dev_manufacturing_process: nullable
        ProcessDiagramData.query.filter_by(user_id=target_user_id).update({'user_id': None})
        ProcessDiagramData.query.filter_by(created_by=target_user_id).update({'created_by': None})
        ProcessDiagramData.query.filter_by(updated_by=target_user_id).update({'updated_by': None})

        # digital_twin_tech_level: nullable
        TechLevelData.query.filter_by(user_id=target_user_id).update({'user_id': None})
        TechLevelData.query.filter_by(created_by=target_user_id).update({'created_by': None})
        TechLevelData.query.filter_by(updated_by=target_user_id).update({'updated_by': None})

        db.session.delete(target_user)
        db.session.commit()

        return success_response(message=f'사용자 "{user_name}"이(가) 삭제되었습니다.')
    except Exception as e:
        db.session.rollback()
        print(f"[User Delete Error] {str(e)}")
        import traceback
        traceback.print_exc()
        return error_response(f'사용자 삭제 중 오류가 발생했습니다: {str(e)}', status_code=500)


@bp.route('/users/<int:target_user_id>/deactivate', methods=['POST'])
@jwt_required()
def deactivate_user(target_user_id):
    """Deactivate a user (admin only)."""
    user_id = int(get_jwt_identity())
    current_user = UserService.get_by_id(user_id)

    if not current_user or not current_user.is_admin_user():
        return error_response('관리자 권한이 필요합니다.', status_code=403)

    if target_user_id == user_id:
        return error_response('자신의 계정은 비활성화할 수 없습니다.')

    if UserService.deactivate(target_user_id):
        return success_response(message='계정이 비활성화되었습니다.')

    return error_response('사용자를 찾을 수 없습니다.', status_code=404)


@bp.route('/users/<int:target_user_id>/activate', methods=['POST'])
@jwt_required()
def activate_user(target_user_id):
    """Activate a user (admin only)."""
    user_id = int(get_jwt_identity())
    current_user = UserService.get_by_id(user_id)

    if not current_user or not current_user.is_admin_user():
        return error_response('관리자 권한이 필요합니다.', status_code=403)

    if UserService.activate(target_user_id):
        return success_response(message='계정이 활성화되었습니다.')

    return error_response('사용자를 찾을 수 없습니다.', status_code=404)


# ============== Dashboard Stats ==============

@bp.route('/stats', methods=['GET'])
def get_dashboard_stats():
    """Get statistics for the main page dashboard."""
    try:
        from app.modules.digital_twin_dashboard.models import DashboardData
        from app.modules.dx_work_process.models import Graph
        from app.modules.dev_manufacturing_process.models import ProcessDiagramData

        # 1. 과제 수 (디지털 트윈 대시보드)
        project_count = 0
        dashboard_data = DashboardData.query.first()
        if dashboard_data and dashboard_data.projects:
            project_count = len(dashboard_data.projects)

        # 2. 지식 그래프 수
        graph_count = Graph.query.count()

        # 3. 데이터/프로세스 정의 수
        diagram_count = ProcessDiagramData.query.count()

        return success_response({
            'projectCount': project_count,
            'graphCount': graph_count,
            'diagramCount': diagram_count
        })

    except Exception as e:
        print(f"[Stats Error] Get stats failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return error_response(f'통계 조회 실패: {str(e)}', status_code=500)


@bp.route('/module-updates', methods=['GET'])
def get_module_updates():
    """Get latest update times for each module."""
    try:
        from app.modules.digital_twin_dashboard.models import DashboardData
        from app.modules.dx_work_process.models import Graph
        from app.modules.dev_manufacturing_process.models import ProcessDiagramData
        from datetime import timezone, timedelta

        # 한국 시간대 (UTC+9)
        KST = timezone(timedelta(hours=9))

        def to_kst_iso(dt):
            """UTC datetime을 KST ISO 문자열로 변환"""
            if dt is None:
                return None
            # naive datetime인 경우 UTC로 가정
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            kst_dt = dt.astimezone(KST)
            return iso_kst(kst_dt)

        modules = []

        # 1. 디지털 트윈 과제 대시보드
        dashboard_latest = DashboardData.query.order_by(DashboardData.updated_at.desc()).first()
        modules.append({
            'id': 'digital-twin-dashboard',
            'name': '디지털 트윈 과제 대시보드',
            'updated_at': to_kst_iso(dashboard_latest.updated_at) if dashboard_latest else None
        })

        # 2. 지식 그래프 모듈
        graph_latest = Graph.query.order_by(Graph.updated_at.desc()).first()
        modules.append({
            'id': 'dx-work-process',
            'name': '지식 그래프 모듈',
            'updated_at': to_kst_iso(graph_latest.updated_at) if graph_latest else None
        })

        # 3. 데이터/프로세스 가시화
        diagram_latest = ProcessDiagramData.query.order_by(ProcessDiagramData.updated_at.desc()).first()
        modules.append({
            'id': 'dev-manufacturing-process',
            'name': '데이터/프로세스 가시화',
            'updated_at': to_kst_iso(diagram_latest.updated_at) if diagram_latest else None
        })

        # updated_at 기준 정렬 (None은 맨 뒤로)
        modules.sort(key=lambda x: x['updated_at'] or '', reverse=True)

        return success_response(modules)

    except Exception as e:
        print(f"[Module Updates Error] Get module updates failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return error_response(f'모듈 업데이트 조회 실패: {str(e)}', status_code=500)


# ============== Notice Routes ==============

@bp.route('/notices', methods=['GET'])
def get_notices():
    """공지사항 목록 조회 (활성화된 것만, 최대 5개)"""
    try:
        limit = request.args.get('limit', 5, type=int)
        notices = Notice.query.filter_by(is_active=True)\
            .order_by(Notice.priority.desc(), Notice.created_at.desc())\
            .limit(limit)\
            .all()
        return success_response([n.to_dict(include_content=False) for n in notices])
    except Exception as e:
        print(f"[Notice Error] Get notices failed: {str(e)}")
        return error_response(f'공지사항 조회 실패: {str(e)}', status_code=500)


@bp.route('/notices/<int:notice_id>', methods=['GET'])
def get_notice(notice_id):
    """공지사항 상세 조회"""
    try:
        notice = Notice.query.get(notice_id)
        if not notice:
            return error_response('공지사항을 찾을 수 없습니다.', status_code=404)
        return success_response(notice.to_dict())
    except Exception as e:
        print(f"[Notice Error] Get notice failed: {str(e)}")
        return error_response(f'공지사항 조회 실패: {str(e)}', status_code=500)


@bp.route('/notices/all', methods=['GET'])
@jwt_required()
def get_all_notices():
    """모든 공지사항 조회 (관리자용)"""
    try:
        user_id = int(get_jwt_identity())
        current_user = UserService.get_by_id(user_id)

        if not current_user or not current_user.is_admin_user():
            return error_response('관리자 권한이 필요합니다.', status_code=403)

        notices = Notice.query.order_by(Notice.priority.desc(), Notice.created_at.desc()).all()
        return success_response([n.to_dict() for n in notices])
    except Exception as e:
        print(f"[Notice Error] Get all notices failed: {str(e)}")
        return error_response(f'공지사항 조회 실패: {str(e)}', status_code=500)


@bp.route('/notices', methods=['POST'])
@jwt_required()
def create_notice():
    """공지사항 생성 (관리자만)"""
    try:
        user_id = int(get_jwt_identity())
        current_user = UserService.get_by_id(user_id)

        if not current_user or not current_user.is_admin_user():
            return error_response('관리자 권한이 필요합니다.', status_code=403)

        data = get_request_json()
        is_valid, missing = validate_required_fields(data, ['title', 'content'])
        if not is_valid:
            return error_response(f'필수 항목이 누락되었습니다: {", ".join(missing)}')

        notice = Notice(
            title=data['title'],
            content=data['content'],
            is_active=data.get('is_active', True),
            priority=data.get('priority', 0),
            author_id=user_id
        )
        db.session.add(notice)
        db.session.commit()

        return created_response(notice.to_dict(), '공지사항이 등록되었습니다.')
    except Exception as e:
        db.session.rollback()
        print(f"[Notice Error] Create notice failed: {str(e)}")
        return error_response(f'공지사항 등록 실패: {str(e)}', status_code=500)


@bp.route('/notices/<int:notice_id>', methods=['PUT'])
@jwt_required()
def update_notice(notice_id):
    """공지사항 수정 (관리자만)"""
    try:
        user_id = int(get_jwt_identity())
        current_user = UserService.get_by_id(user_id)

        if not current_user or not current_user.is_admin_user():
            return error_response('관리자 권한이 필요합니다.', status_code=403)

        notice = Notice.query.get(notice_id)
        if not notice:
            return error_response('공지사항을 찾을 수 없습니다.', status_code=404)

        data = get_request_json()

        if 'title' in data:
            notice.title = data['title']
        if 'content' in data:
            notice.content = data['content']
        if 'is_active' in data:
            notice.is_active = data['is_active']
        if 'priority' in data:
            notice.priority = data['priority']

        db.session.commit()

        return success_response(notice.to_dict(), '공지사항이 수정되었습니다.')
    except Exception as e:
        db.session.rollback()
        print(f"[Notice Error] Update notice failed: {str(e)}")
        return error_response(f'공지사항 수정 실패: {str(e)}', status_code=500)


@bp.route('/notices/<int:notice_id>', methods=['DELETE'])
@jwt_required()
def delete_notice(notice_id):
    """공지사항 삭제 (관리자만)"""
    try:
        user_id = int(get_jwt_identity())
        current_user = UserService.get_by_id(user_id)

        if not current_user or not current_user.is_admin_user():
            return error_response('관리자 권한이 필요합니다.', status_code=403)

        notice = Notice.query.get(notice_id)
        if not notice:
            return error_response('공지사항을 찾을 수 없습니다.', status_code=404)

        db.session.delete(notice)
        db.session.commit()

        return success_response(message='공지사항이 삭제되었습니다.')
    except Exception as e:
        db.session.rollback()
        print(f"[Notice Error] Delete notice failed: {str(e)}")
        return error_response(f'공지사항 삭제 실패: {str(e)}', status_code=500)


# ============== Access Logs ==============

@bp.route('/access-logs', methods=['GET'])
@jwt_required()
def get_access_logs():
    """접속 이력 조회 (관리자 전용)"""
    user_id = int(get_jwt_identity())
    current_user = UserService.get_by_id(user_id)

    if not current_user or not current_user.is_admin_user():
        return error_response('관리자 권한이 필요합니다.', status_code=403)

    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        per_page = min(per_page, 200)
        user_filter = request.args.get('user_id', None, type=int)
        action_filter = request.args.get('action', None)

        query = AccessLog.query

        if user_filter:
            query = query.filter_by(user_id=user_filter)
        if action_filter:
            query = query.filter_by(action=action_filter)

        pagination = query.order_by(AccessLog.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return success_response({
            'logs': [log.to_dict() for log in pagination.items],
            'total': pagination.total,
            'page': pagination.page,
            'per_page': per_page,
            'total_pages': pagination.pages
        })
    except Exception as e:
        print(f"[AccessLog Error] {e}")
        return error_response(f'접속 이력 조회 실패: {str(e)}', status_code=500)


@bp.route('/access-logs/stats', methods=['GET'])
@jwt_required()
def access_log_stats():
    """조회수 현황 — 접속 이력을 주·월·연으로 묶어 준다(관리자 전용, 2026-08-30).

    ⚠️ 목록(/access-logs)은 한 번에 200줄까지다. 그래프를 그리려고 수천 줄을 다
       내려받게 할 수는 없어 **DB 에서 묶어** 보낸다.
    ⚠️ 묶는 기준은 **KST**. 화면의 가입자 현황이 로컬(=한국) 기준이라, 여기서 UTC 로
       묶으면 자정 언저리의 건이 다른 칸에 들어가 둘이 어긋난다.

    돌려주는 것 — 칸마다 {bucket, views, visitors, logins}
        views    그 칸의 화면 열람 수(MODULE_ACCESS)
        visitors 그 칸에 실제로 들어온 사람 수(같은 사람은 하나로)
        logins   그 칸의 로그인 수
    누계는 화면에서 더한다 — 가입자 현황과 같은 셈을 쓰기 위해서다.
    """
    user_id = int(get_jwt_identity())
    current_user = UserService.get_by_id(user_id)
    if not current_user or not current_user.is_admin_user():
        return error_response('관리자 권한이 필요합니다.', status_code=403)

    unit = (request.args.get('unit') or 'month').strip()
    if unit not in ('week', 'month', 'year'):
        return error_response('묶는 단위는 week · month · year 입니다.', status_code=400)

    try:
        from sqlalchemy import text
        # date_trunc('week') 는 월요일에 시작한다 — 화면(signupStats.bucketOf)과 같은 결이다.
        rows = db.session.execute(text("""
            SELECT to_char(date_trunc(:unit, created_at + interval '9 hours'),
                           CASE :unit WHEN 'year' THEN 'YYYY'
                                      WHEN 'month' THEN 'YYYY-MM'
                                      ELSE 'YYYY-MM-DD' END)            AS bucket,
                   COUNT(*) FILTER (WHERE action = 'MODULE_ACCESS')     AS views,
                   COUNT(DISTINCT user_email)
                         FILTER (WHERE action = 'MODULE_ACCESS')        AS visitors,
                   COUNT(*) FILTER (WHERE action = 'LOGIN')             AS logins
              FROM access_logs
             GROUP BY 1
             ORDER BY 1
        """), {'unit': unit}).mappings().all()

        # 어느 화면을 많이 보나 — 그래프 옆에 붙는 곁줄. 상위 몇 개면 충분하다.
        top = db.session.execute(text("""
            SELECT COALESCE(module_name, module, '(이름 없음)') AS name, COUNT(*) AS views
              FROM access_logs
             WHERE action = 'MODULE_ACCESS'
             GROUP BY 1 ORDER BY 2 DESC LIMIT 10
        """)).mappings().all()

        return success_response({
            'unit': unit,
            'rows': [{'bucket': r['bucket'], 'views': int(r['views']),
                      'visitors': int(r['visitors']), 'logins': int(r['logins'])} for r in rows],
            'modules': [{'name': r['name'], 'views': int(r['views'])} for r in top],
        })
    except Exception as e:
        print(f"[AccessLog Stats Error] {e}")
        return error_response(f'조회수 집계 실패: {str(e)}', status_code=500)


@bp.route('/access-logs', methods=['POST'])
@jwt_required()
def create_access_log():
    """모듈 접근 이력 기록"""
    user_id = int(get_jwt_identity())
    current_user = UserService.get_by_id(user_id)

    if not current_user:
        return error_response('사용자를 찾을 수 없습니다.', status_code=404)

    try:
        data = get_request_json()
        log = AccessLog(
            user_id=current_user.id,
            user_email=current_user.email,
            user_name=current_user.name,
            action=data.get('action', 'MODULE_ACCESS'),
            module=data.get('module', ''),
            module_name=data.get('module_name', ''),
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent', '')
        )
        db.session.add(log)
        db.session.commit()
        return success_response(log.to_dict())
    except Exception as e:
        print(f"[AccessLog Error] {e}")
        return error_response(f'접속 이력 기록 실패: {str(e)}', status_code=500)


@bp.route('/access-logs', methods=['DELETE'])
@jwt_required()
def clear_access_logs():
    """접속 이력 전체 삭제 (관리자 전용)"""
    user_id = int(get_jwt_identity())
    current_user = UserService.get_by_id(user_id)

    if not current_user or not current_user.is_admin_user():
        return error_response('관리자 권한이 필요합니다.', status_code=403)

    try:
        count = AccessLog.query.delete()
        db.session.commit()
        return success_response(message=f'{count}건의 접속 이력이 삭제되었습니다.')
    except Exception as e:
        db.session.rollback()
        return error_response(f'접속 이력 삭제 실패: {str(e)}', status_code=500)


# ============== Role Module Permissions ==============

@bp.route('/role-permissions', methods=['GET'])
@jwt_required()
def get_role_permissions():
    """역할별 모듈 접근 권한 조회"""
    try:
        from app.modules.digital_twin_dashboard.models import ModuleSettings
        setting = ModuleSettings.query.filter_by(
            module_name='auth',
            settings_key='role_module_permissions'
        ).first()
        data = setting.settings_data if setting else {}
        return success_response(data)
    except Exception as e:
        print(f"[RolePermissions Error] {e}")
        return error_response(f'권한 조회 실패: {str(e)}', status_code=500)


@bp.route('/role-permissions', methods=['PUT'])
@jwt_required()
def update_role_permissions():
    """역할별 모듈 접근 권한 수정 (관리자 전용)"""
    user_id = int(get_jwt_identity())
    current_user = UserService.get_by_id(user_id)

    if not current_user or not current_user.is_admin_user():
        return error_response('관리자 권한이 필요합니다.', status_code=403)

    try:
        from app.modules.digital_twin_dashboard.models import ModuleSettings
        from sqlalchemy.orm.attributes import flag_modified

        data = get_request_json()
        existing = ModuleSettings.query.filter_by(
            module_name='auth',
            settings_key='role_module_permissions'
        ).first()

        if existing:
            existing.settings_data = data
            flag_modified(existing, 'settings_data')
        else:
            setting = ModuleSettings(
                module_name='auth',
                settings_key='role_module_permissions',
                settings_data=data,
                description='역할별 모듈 접근 권한 설정'
            )
            db.session.add(setting)

        db.session.commit()
        return success_response(data, '모듈 접근 권한이 저장되었습니다.')
    except Exception as e:
        db.session.rollback()
        print(f"[RolePermissions Error] {e}")
        return error_response(f'권한 저장 실패: {str(e)}', status_code=500)


# ============== Health Check ==============

@bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return success_response({'status': 'healthy', 'module': 'auth'})
