"""
Collaboration Board Routes
협업 게시판 API
"""
import io
import os
import zipfile
from flask import request, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.modules.collaboration_board import bp
from app.modules.collaboration_board.services import (
    CategoryService, PostService, CommentService, AttachmentService,
    SurveyService, SurveyResponseService
)
from app.modules.auth.services import UserService
from app.shared.responses import (
    success_response, error_response, created_response, not_found_response
)
from app.shared.utils import get_request_json, validate_required_fields


# ============== Category Routes ==============

@bp.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    """Get all categories."""
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    categories = CategoryService.get_all(include_inactive=include_inactive)
    return success_response([c.to_dict() for c in categories])


@bp.route('/categories/<int:category_id>', methods=['GET'])
@jwt_required()
def get_category(category_id):
    """Get a single category."""
    category = CategoryService.get_by_id(category_id)
    if not category:
        return not_found_response('Category not found')
    return success_response(category.to_dict())


@bp.route('/categories', methods=['POST'])
@jwt_required()
def create_category():
    """Create a new category (admin only)."""
    user_id = int(get_jwt_identity())
    user = UserService.get_by_id(user_id)

    if not user or not user.is_admin_user():
        return error_response('관리자 권한이 필요합니다.', 403)

    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['name', 'slug'])
    if not is_valid:
        return error_response(f'필수 항목이 누락되었습니다: {", ".join(missing)}')

    try:
        category = CategoryService.create(data)
        return created_response(category.to_dict())
    except Exception as e:
        return error_response(f'카테고리 생성 실패: {str(e)}')


@bp.route('/categories/<int:category_id>', methods=['PUT'])
@jwt_required()
def update_category(category_id):
    """Update a category (admin only)."""
    user_id = int(get_jwt_identity())
    user = UserService.get_by_id(user_id)

    if not user or not user.is_admin_user():
        return error_response('관리자 권한이 필요합니다.', 403)

    data = get_request_json()
    category = CategoryService.update(category_id, data)

    if not category:
        return not_found_response('Category not found')

    return success_response(category.to_dict())


@bp.route('/categories/<int:category_id>', methods=['DELETE'])
@jwt_required()
def delete_category(category_id):
    """Delete a category (admin only)."""
    user_id = int(get_jwt_identity())
    user = UserService.get_by_id(user_id)

    if not user or not user.is_admin_user():
        return error_response('관리자 권한이 필요합니다.', 403)

    if CategoryService.delete(category_id):
        return success_response(message='카테고리가 삭제되었습니다.')
    return not_found_response('Category not found')


# ============== Post Routes ==============

@bp.route('/posts', methods=['GET'])
@jwt_required()
def get_posts():
    """Get posts with pagination and filtering."""
    category_id = request.args.get('category_id', type=int)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search')

    pagination = PostService.get_all(
        category_id=category_id,
        page=page,
        per_page=per_page,
        search=search
    )

    return success_response({
        'posts': [p.to_dict(include_content=False) for p in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'currentPage': pagination.page,
        'hasNext': pagination.has_next,
        'hasPrev': pagination.has_prev
    })


@bp.route('/posts/<int:post_id>', methods=['GET'])
@jwt_required()
def get_post(post_id):
    """Get a single post with comments."""
    post = PostService.get_by_id(post_id)
    if not post:
        return not_found_response('Post not found')

    # Increment view count
    PostService.increment_view_count(post_id)

    return success_response(post.to_dict(include_content=True, include_comments=True))


@bp.route('/posts', methods=['POST'])
@jwt_required()
def create_post():
    """Create a new post."""
    user_id = int(get_jwt_identity())
    data = get_request_json()

    is_valid, missing = validate_required_fields(data, ['categoryId', 'title', 'content'])
    if not is_valid:
        return error_response(f'필수 항목이 누락되었습니다: {", ".join(missing)}')

    try:
        post = PostService.create(data, user_id)
        return created_response(post.to_dict())
    except Exception as e:
        return error_response(f'게시글 작성 실패: {str(e)}')


@bp.route('/posts/<int:post_id>', methods=['PUT'])
@jwt_required()
def update_post(post_id):
    """Update a post."""
    user_id = int(get_jwt_identity())
    user = UserService.get_by_id(user_id)
    post = PostService.get_by_id(post_id)

    if not post:
        return not_found_response('Post not found')

    # 작성자 본인 또는 관리자만 수정 가능
    if post.author_id != user_id and not user.is_admin_user():
        return error_response('수정 권한이 없습니다.', 403)

    data = get_request_json()
    updated_post = PostService.update(post_id, data, user_id)

    return success_response(updated_post.to_dict())


@bp.route('/posts/<int:post_id>', methods=['DELETE'])
@jwt_required()
def delete_post(post_id):
    """Delete a post."""
    user_id = int(get_jwt_identity())
    user = UserService.get_by_id(user_id)
    post = PostService.get_by_id(post_id)

    if not post:
        return not_found_response('Post not found')

    # 작성자 본인 또는 관리자만 삭제 가능
    if post.author_id != user_id and not user.is_admin_user():
        return error_response('삭제 권한이 없습니다.', 403)

    if PostService.delete(post_id):
        return success_response(message='게시글이 삭제되었습니다.')
    return error_response('삭제 실패')


# ============== Comment Routes ==============

@bp.route('/posts/<int:post_id>/comments', methods=['GET'])
@jwt_required()
def get_comments(post_id):
    """Get all comments for a post."""
    comments = CommentService.get_by_post(post_id)
    return success_response([c.to_dict() for c in comments])


@bp.route('/comments', methods=['POST'])
@jwt_required()
def create_comment():
    """Create a new comment."""
    user_id = int(get_jwt_identity())
    data = get_request_json()

    is_valid, missing = validate_required_fields(data, ['postId', 'content'])
    if not is_valid:
        return error_response(f'필수 항목이 누락되었습니다: {", ".join(missing)}')

    try:
        comment = CommentService.create(data, user_id)
        return created_response(comment.to_dict())
    except Exception as e:
        return error_response(f'댓글 작성 실패: {str(e)}')


@bp.route('/comments/<int:comment_id>', methods=['PUT'])
@jwt_required()
def update_comment(comment_id):
    """Update a comment."""
    user_id = int(get_jwt_identity())
    user = UserService.get_by_id(user_id)
    comment = CommentService.get_by_id(comment_id)

    if not comment:
        return not_found_response('Comment not found')

    if comment.author_id != user_id and not user.is_admin_user():
        return error_response('수정 권한이 없습니다.', 403)

    data = get_request_json()
    updated_comment = CommentService.update(comment_id, data)

    return success_response(updated_comment.to_dict())


@bp.route('/comments/<int:comment_id>', methods=['DELETE'])
@jwt_required()
def delete_comment(comment_id):
    """Delete a comment."""
    user_id = int(get_jwt_identity())
    user = UserService.get_by_id(user_id)
    comment = CommentService.get_by_id(comment_id)

    if not comment:
        return not_found_response('Comment not found')

    if comment.author_id != user_id and not user.is_admin_user():
        return error_response('삭제 권한이 없습니다.', 403)

    if CommentService.delete(comment_id):
        return success_response(message='댓글이 삭제되었습니다.')
    return error_response('삭제 실패')


# ============== Attachment Routes ==============

@bp.route('/posts/<int:post_id>/attachments', methods=['POST'])
@jwt_required()
def upload_attachment(post_id):
    """Upload a file attachment to a post."""
    user_id = int(get_jwt_identity())
    post = PostService.get_by_id(post_id)

    if not post:
        return not_found_response('Post not found')

    if 'file' not in request.files:
        return error_response('파일이 없습니다.')

    file = request.files['file']
    if file.filename == '':
        return error_response('파일이 선택되지 않았습니다.')

    try:
        attachment = AttachmentService.create(post_id, file, user_id)
        return created_response(attachment.to_dict())
    except Exception as e:
        return error_response(f'파일 업로드 실패: {str(e)}')


@bp.route('/attachments/<int:attachment_id>/download', methods=['GET'])
@jwt_required()
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
        return error_response(f'파일 다운로드 실패: {str(e)}')


@bp.route('/attachments/<int:attachment_id>', methods=['DELETE'])
@jwt_required()
def delete_attachment(attachment_id):
    """Delete an attachment."""
    user_id = int(get_jwt_identity())
    user = UserService.get_by_id(user_id)
    attachment = AttachmentService.get_by_id(attachment_id)

    if not attachment:
        return not_found_response('Attachment not found')

    post = PostService.get_by_id(attachment.post_id)
    if post and post.author_id != user_id and not user.is_admin_user():
        return error_response('삭제 권한이 없습니다.', 403)

    if AttachmentService.delete(attachment_id):
        return success_response(message='첨부파일이 삭제되었습니다.')
    return error_response('삭제 실패')


# ============== Survey Routes ==============

@bp.route('/surveys', methods=['GET'])
@jwt_required()
def get_surveys():
    """Get all surveys."""
    status = request.args.get('status')
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    surveys = SurveyService.get_all(include_inactive=include_inactive, status=status)
    return success_response([s.to_dict() for s in surveys])


@bp.route('/surveys/<int:survey_id>', methods=['GET'])
@jwt_required()
def get_survey(survey_id):
    """Get a single survey with questions."""
    user_id = int(get_jwt_identity())
    survey = SurveyService.get_by_id(survey_id)
    if not survey:
        return not_found_response('Survey not found')

    data = survey.to_dict(include_questions=True)

    # 사용자의 기존 응답 확인
    user_response = SurveyResponseService.get_user_response(survey_id, user_id)
    data['hasResponded'] = user_response is not None

    return success_response(data)


@bp.route('/surveys/<int:survey_id>/stats', methods=['GET'])
@jwt_required()
def get_survey_stats(survey_id):
    """Get survey statistics."""
    survey = SurveyService.get_by_id(survey_id)
    if not survey:
        return not_found_response('Survey not found')

    return success_response(survey.to_dict(include_questions=True, include_stats=True))


@bp.route('/surveys', methods=['POST'])
@jwt_required()
def create_survey():
    """Create a new survey."""
    user_id = int(get_jwt_identity())
    data = get_request_json()

    is_valid, missing = validate_required_fields(data, ['title'])
    if not is_valid:
        return error_response(f'필수 항목이 누락되었습니다: {", ".join(missing)}')

    # Parse dates if provided
    from datetime import datetime
    if data.get('startDate'):
        try:
            data['startDate'] = datetime.fromisoformat(data['startDate'].replace('Z', '+00:00'))
        except ValueError:
            pass
    if data.get('endDate'):
        try:
            data['endDate'] = datetime.fromisoformat(data['endDate'].replace('Z', '+00:00'))
        except ValueError:
            pass

    try:
        survey = SurveyService.create(data, user_id)
        return created_response(survey.to_dict(include_questions=True))
    except Exception as e:
        return error_response(f'설문 생성 실패: {str(e)}')


@bp.route('/surveys/<int:survey_id>', methods=['PUT'])
@jwt_required()
def update_survey(survey_id):
    """Update a survey."""
    user_id = int(get_jwt_identity())
    user = UserService.get_by_id(user_id)
    survey = SurveyService.get_by_id(survey_id)

    if not survey:
        return not_found_response('Survey not found')

    # 작성자 본인 또는 관리자만 수정 가능
    if survey.author_id != user_id and not user.is_admin_user():
        return error_response('수정 권한이 없습니다.', 403)

    data = get_request_json()

    # Parse dates if provided
    from datetime import datetime
    if data.get('startDate'):
        try:
            data['startDate'] = datetime.fromisoformat(data['startDate'].replace('Z', '+00:00'))
        except ValueError:
            pass
    if data.get('endDate'):
        try:
            data['endDate'] = datetime.fromisoformat(data['endDate'].replace('Z', '+00:00'))
        except ValueError:
            pass

    updated_survey = SurveyService.update(survey_id, data)
    return success_response(updated_survey.to_dict(include_questions=True))


@bp.route('/surveys/<int:survey_id>', methods=['DELETE'])
@jwt_required()
def delete_survey(survey_id):
    """Delete a survey."""
    user_id = int(get_jwt_identity())
    user = UserService.get_by_id(user_id)
    survey = SurveyService.get_by_id(survey_id)

    if not survey:
        return not_found_response('Survey not found')

    # 작성자 본인 또는 관리자만 삭제 가능
    if survey.author_id != user_id and not user.is_admin_user():
        return error_response('삭제 권한이 없습니다.', 403)

    if SurveyService.delete(survey_id):
        return success_response(message='설문이 삭제되었습니다.')
    return error_response('삭제 실패')


@bp.route('/surveys/<int:survey_id>/close', methods=['POST'])
@jwt_required()
def close_survey(survey_id):
    """Close a survey."""
    user_id = int(get_jwt_identity())
    user = UserService.get_by_id(user_id)
    survey = SurveyService.get_by_id(survey_id)

    if not survey:
        return not_found_response('Survey not found')

    if survey.author_id != user_id and not user.is_admin_user():
        return error_response('권한이 없습니다.', 403)

    closed_survey = SurveyService.close(survey_id)
    return success_response(closed_survey.to_dict())


@bp.route('/surveys/<int:survey_id>/responses', methods=['GET'])
@jwt_required()
def get_survey_responses(survey_id):
    """Get all responses for a survey."""
    user_id = int(get_jwt_identity())
    user = UserService.get_by_id(user_id)
    survey = SurveyService.get_by_id(survey_id)

    if not survey:
        return not_found_response('Survey not found')

    # 작성자 또는 관리자만 응답 목록 조회 가능
    if survey.author_id != user_id and not user.is_admin_user():
        return error_response('권한이 없습니다.', 403)

    responses = SurveyResponseService.get_by_survey(survey_id)
    return success_response([r.to_dict(include_answers=True) for r in responses])


@bp.route('/surveys/<int:survey_id>/respond', methods=['POST'])
@jwt_required()
def submit_survey_response(survey_id):
    """Submit a survey response."""
    user_id = int(get_jwt_identity())
    data = get_request_json()

    answers = data.get('answers', [])
    if not answers:
        return error_response('답변이 없습니다.')

    try:
        response = SurveyResponseService.submit(survey_id, user_id, answers)
        return created_response(response.to_dict())
    except ValueError as e:
        return error_response(str(e))
    except Exception as e:
        return error_response(f'응답 제출 실패: {str(e)}')


@bp.route('/surveys/<int:survey_id>/my-response', methods=['GET'])
@jwt_required()
def get_my_survey_response(survey_id):
    """Get current user's response to a survey."""
    user_id = int(get_jwt_identity())
    response = SurveyResponseService.get_user_response(survey_id, user_id)

    if not response:
        return not_found_response('아직 응답하지 않았습니다.')

    return success_response(response.to_dict(include_answers=True))


@bp.route('/surveys/<int:survey_id>/my-response', methods=['PUT'])
@jwt_required()
def update_my_survey_response(survey_id):
    """Update current user's response to a survey."""
    user_id = int(get_jwt_identity())
    data = get_request_json()

    answers = data.get('answers', [])
    if not answers:
        return error_response('답변이 없습니다.')

    # 기존 응답 찾기
    response = SurveyResponseService.get_user_response(survey_id, user_id)
    if not response:
        return not_found_response('수정할 응답이 없습니다.')

    try:
        updated_response = SurveyResponseService.update_response(response.id, user_id, answers)
        return success_response(updated_response.to_dict(include_answers=True))
    except ValueError as e:
        return error_response(str(e))
    except Exception as e:
        return error_response(f'응답 수정 실패: {str(e)}')


@bp.route('/surveys/<int:survey_id>/export-csv', methods=['GET'])
@jwt_required()
def export_survey_csv(survey_id):
    """Export survey responses as CSV."""
    import csv
    from io import StringIO
    from flask import Response

    user_id = int(get_jwt_identity())
    user = UserService.get_by_id(user_id)
    survey = SurveyService.get_by_id(survey_id)

    if not survey:
        return not_found_response('Survey not found')

    # 작성자 또는 관리자만 내보내기 가능
    if survey.author_id != user_id and not user.is_admin_user():
        return error_response('권한이 없습니다.', 403)

    # CSV 데이터 생성
    output = StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_ALL)  # 모든 필드를 따옴표로 감싸기

    # 헤더 행 생성
    from app.modules.collaboration_board.models import SurveyQuestion
    questions = survey.questions.order_by(SurveyQuestion.order).all()
    header = ['응답번호', '응답자', '응답일시']
    for q in questions:
        header.append(q.question_text)
    writer.writerow(header)

    # 응답 데이터 행 생성
    responses = SurveyResponseService.get_by_survey(survey_id)
    for idx, resp in enumerate(responses, 1):
        row = [
            idx,
            resp.respondent.name if resp.respondent else '익명',
            resp.submitted_at.strftime('%Y-%m-%d %H:%M:%S') if resp.submitted_at else ''
        ]

        # 각 질문에 대한 응답 찾기
        answers_dict = {a.question_id: a for a in resp.answers.all()}
        for q in questions:
            answer = answers_dict.get(q.id)
            if answer:
                if q.question_type in ['single', 'multiple', 'dropdown']:
                    # 선택형: 선택한 옵션들을 쉼표로 구분
                    row.append(', '.join(answer.selected_options or []))
                elif q.question_type == 'scale':
                    row.append(str(answer.scale_value) if answer.scale_value else '')
                else:
                    # 텍스트형
                    row.append(answer.answer_text or '')
            else:
                row.append('')

        writer.writerow(row)

    # CSV 파일 반환
    output.seek(0)
    # UTF-8 BOM 추가 (Excel 호환성)
    csv_content = '\ufeff' + output.getvalue()

    return Response(
        csv_content,
        mimetype='text/csv; charset=utf-8',
        headers={
            'Content-Disposition': f'attachment; filename=survey_{survey_id}_responses.csv'
        }
    )


# ============== Health Check ==============

@bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return success_response({'status': 'healthy', 'module': 'collaboration-board'})
