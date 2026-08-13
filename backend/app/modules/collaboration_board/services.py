"""
Collaboration Board Services
협업 게시판 서비스
"""
import os
from datetime import datetime
from app.extensions import db
from app.modules.collaboration_board.models import (
    BoardCategory, BoardPost, BoardComment, BoardAttachment, UPLOAD_FOLDER,
    Survey, SurveyQuestion, SurveyResponse, SurveyAnswer
)


class CategoryService:
    """게시판 카테고리 서비스"""

    @staticmethod
    def get_all(include_inactive=False):
        query = BoardCategory.query.order_by(BoardCategory.order.asc())
        if not include_inactive:
            query = query.filter_by(is_active=True)
        return query.all()

    @staticmethod
    def get_by_id(category_id):
        return BoardCategory.query.get(category_id)

    @staticmethod
    def get_by_slug(slug):
        return BoardCategory.query.filter_by(slug=slug, is_active=True).first()

    @staticmethod
    def create(data):
        category = BoardCategory(
            name=data['name'],
            slug=data['slug'],
            description=data.get('description'),
            color=data.get('color', '#3b82f6'),
            icon=data.get('icon', 'FileText'),
            order=data.get('order', 0),
            allow_comments=data.get('allowComments', True),
            allow_attachments=data.get('allowAttachments', True),
            is_anonymous=data.get('isAnonymous', False)
        )
        db.session.add(category)
        db.session.commit()
        return category

    @staticmethod
    def update(category_id, data):
        category = BoardCategory.query.get(category_id)
        if not category:
            return None

        if 'name' in data:
            category.name = data['name']
        if 'slug' in data:
            category.slug = data['slug']
        if 'description' in data:
            category.description = data['description']
        if 'color' in data:
            category.color = data['color']
        if 'icon' in data:
            category.icon = data['icon']
        if 'order' in data:
            category.order = data['order']
        if 'isActive' in data:
            category.is_active = data['isActive']
        if 'allowComments' in data:
            category.allow_comments = data['allowComments']
        if 'allowAttachments' in data:
            category.allow_attachments = data['allowAttachments']
        if 'isAnonymous' in data:
            category.is_anonymous = data['isAnonymous']

        db.session.commit()
        return category

    @staticmethod
    def delete(category_id):
        category = BoardCategory.query.get(category_id)
        if category:
            db.session.delete(category)
            db.session.commit()
            return True
        return False


class PostService:
    """게시글 서비스"""

    @staticmethod
    def get_all(category_id=None, page=1, per_page=20, search=None):
        query = BoardPost.query.filter_by(is_active=True)

        if category_id:
            query = query.filter_by(category_id=category_id)

        if search:
            search_term = f'%{search}%'
            query = query.filter(
                db.or_(
                    BoardPost.title.ilike(search_term),
                    BoardPost.content.ilike(search_term)
                )
            )

        # 공지사항과 고정글 우선 정렬
        query = query.order_by(
            BoardPost.is_notice.desc(),
            BoardPost.is_pinned.desc(),
            BoardPost.created_at.desc()
        )

        return query.paginate(page=page, per_page=per_page, error_out=False)

    @staticmethod
    def get_by_id(post_id):
        return BoardPost.query.filter_by(id=post_id, is_active=True).first()

    @staticmethod
    def create(data, author_id):
        post = BoardPost(
            category_id=data['categoryId'],
            author_id=author_id,
            title=data['title'],
            content=data['content'],
            is_pinned=data.get('isPinned', False),
            is_notice=data.get('isNotice', False)
        )
        db.session.add(post)
        db.session.commit()
        return post

    @staticmethod
    def update(post_id, data, user_id):
        post = BoardPost.query.get(post_id)
        if not post:
            return None

        # 작성자 본인 또는 관리자만 수정 가능 (관리자 체크는 라우트에서)
        if 'title' in data:
            post.title = data['title']
        if 'content' in data:
            post.content = data['content']
        if 'categoryId' in data:
            post.category_id = data['categoryId']
        if 'isPinned' in data:
            post.is_pinned = data['isPinned']
        if 'isNotice' in data:
            post.is_notice = data['isNotice']

        db.session.commit()
        return post

    @staticmethod
    def delete(post_id):
        post = BoardPost.query.get(post_id)
        if post:
            post.is_active = False  # Soft delete
            db.session.commit()
            return True
        return False

    @staticmethod
    def increment_view_count(post_id):
        post = BoardPost.query.get(post_id)
        if post:
            post.view_count = (post.view_count or 0) + 1
            db.session.commit()


class CommentService:
    """댓글 서비스"""

    @staticmethod
    def get_by_post(post_id):
        return BoardComment.query.filter_by(
            post_id=post_id, parent_id=None
        ).order_by(BoardComment.created_at.asc()).all()

    @staticmethod
    def get_by_id(comment_id):
        return BoardComment.query.get(comment_id)

    @staticmethod
    def create(data, author_id):
        comment = BoardComment(
            post_id=data['postId'],
            author_id=author_id,
            parent_id=data.get('parentId'),
            content=data['content']
        )
        db.session.add(comment)
        db.session.commit()
        return comment

    @staticmethod
    def update(comment_id, data):
        comment = BoardComment.query.get(comment_id)
        if not comment:
            return None

        if 'content' in data:
            comment.content = data['content']

        db.session.commit()
        return comment

    @staticmethod
    def delete(comment_id):
        comment = BoardComment.query.get(comment_id)
        if comment:
            # Soft delete - 대댓글이 있을 수 있으므로
            comment.is_active = False
            comment.content = ''
            db.session.commit()
            return True
        return False


class AttachmentService:
    """첨부파일 서비스"""

    @staticmethod
    def ensure_upload_folder():
        """Ensure upload folder exists."""
        if not os.path.exists(UPLOAD_FOLDER):
            os.makedirs(UPLOAD_FOLDER)

    @staticmethod
    def get_by_id(attachment_id):
        return BoardAttachment.query.get(attachment_id)

    @staticmethod
    def get_by_post(post_id):
        return BoardAttachment.query.filter_by(post_id=post_id).all()

    @staticmethod
    def create(post_id, file, uploader_id=None):
        AttachmentService.ensure_upload_folder()

        stored_filename = BoardAttachment.generate_stored_filename(file.filename)
        file_path = os.path.join(UPLOAD_FOLDER, stored_filename)
        file.save(file_path)

        attachment = BoardAttachment(
            post_id=post_id,
            uploader_id=uploader_id,
            original_filename=file.filename,
            stored_filename=stored_filename,
            file_size=os.path.getsize(file_path),
            mime_type=file.content_type
        )
        db.session.add(attachment)
        db.session.commit()
        return attachment

    @staticmethod
    def delete(attachment_id):
        attachment = BoardAttachment.query.get(attachment_id)
        if attachment:
            # Delete physical file
            file_path = os.path.join(UPLOAD_FOLDER, attachment.stored_filename)
            if os.path.exists(file_path):
                os.remove(file_path)

            db.session.delete(attachment)
            db.session.commit()
            return True
        return False

    @staticmethod
    def get_file_path(attachment):
        return os.path.join(UPLOAD_FOLDER, attachment.stored_filename)


# ============== Survey Services ==============

class SurveyService:
    """설문조사 서비스"""

    @staticmethod
    def get_all(include_inactive=False, status=None):
        query = Survey.query

        if not include_inactive:
            query = query.filter_by(is_active=True)

        # 상태 필터링
        now = datetime.utcnow()
        if status == 'active':
            query = query.filter(
                Survey.is_active == True,
                db.or_(Survey.start_date.is_(None), Survey.start_date <= now),
                db.or_(Survey.end_date.is_(None), Survey.end_date > now)
            )
        elif status == 'ended':
            query = query.filter(Survey.end_date <= now)
        elif status == 'scheduled':
            query = query.filter(Survey.start_date > now)

        return query.order_by(Survey.created_at.desc()).all()

    @staticmethod
    def get_by_id(survey_id):
        return Survey.query.get(survey_id)

    @staticmethod
    def create(data, author_id):
        survey = Survey(
            author_id=author_id,
            title=data['title'],
            description=data.get('description'),
            start_date=data.get('startDate'),
            end_date=data.get('endDate'),
            is_anonymous=data.get('isAnonymous', False),
            allow_multiple_responses=data.get('allowMultipleResponses', False)
        )
        db.session.add(survey)
        db.session.flush()  # Get survey ID

        # 문항 추가
        questions = data.get('questions', [])
        for idx, q_data in enumerate(questions):
            question = SurveyQuestion(
                survey_id=survey.id,
                question_text=q_data['questionText'],
                question_type=q_data['questionType'],
                options=q_data.get('options', []),
                scale_min=q_data.get('scaleMin', 1),
                scale_max=q_data.get('scaleMax', 5),
                scale_min_label=q_data.get('scaleMinLabel'),
                scale_max_label=q_data.get('scaleMaxLabel'),
                is_required=q_data.get('isRequired', False),
                order=idx
            )
            db.session.add(question)

        db.session.commit()
        return survey

    @staticmethod
    def update(survey_id, data):
        survey = Survey.query.get(survey_id)
        if not survey:
            return None

        if 'title' in data:
            survey.title = data['title']
        if 'description' in data:
            survey.description = data['description']
        if 'startDate' in data:
            survey.start_date = data['startDate']
        if 'endDate' in data:
            survey.end_date = data['endDate']
        if 'isAnonymous' in data:
            survey.is_anonymous = data['isAnonymous']
        if 'allowMultipleResponses' in data:
            survey.allow_multiple_responses = data['allowMultipleResponses']
        if 'isActive' in data:
            survey.is_active = data['isActive']

        # 문항 업데이트 (전체 교체)
        if 'questions' in data:
            # 기존 문항 삭제
            SurveyQuestion.query.filter_by(survey_id=survey_id).delete()

            # 새 문항 추가
            for idx, q_data in enumerate(data['questions']):
                question = SurveyQuestion(
                    survey_id=survey_id,
                    question_text=q_data['questionText'],
                    question_type=q_data['questionType'],
                    options=q_data.get('options', []),
                    scale_min=q_data.get('scaleMin', 1),
                    scale_max=q_data.get('scaleMax', 5),
                    scale_min_label=q_data.get('scaleMinLabel'),
                    scale_max_label=q_data.get('scaleMaxLabel'),
                    is_required=q_data.get('isRequired', False),
                    order=idx
                )
                db.session.add(question)

        db.session.commit()
        return survey

    @staticmethod
    def delete(survey_id):
        survey = Survey.query.get(survey_id)
        if survey:
            db.session.delete(survey)
            db.session.commit()
            return True
        return False

    @staticmethod
    def close(survey_id):
        """설문 마감"""
        survey = Survey.query.get(survey_id)
        if survey:
            survey.is_active = False
            db.session.commit()
            return survey
        return None


class SurveyResponseService:
    """설문 응답 서비스"""

    @staticmethod
    def get_by_survey(survey_id):
        return SurveyResponse.query.filter_by(
            survey_id=survey_id, is_complete=True
        ).order_by(SurveyResponse.submitted_at.desc()).all()

    @staticmethod
    def get_by_id(response_id):
        return SurveyResponse.query.get(response_id)

    @staticmethod
    def get_user_response(survey_id, user_id):
        """사용자의 기존 응답 조회"""
        return SurveyResponse.query.filter_by(
            survey_id=survey_id, respondent_id=user_id
        ).first()

    @staticmethod
    def can_respond(survey_id, user_id):
        """응답 가능 여부 확인"""
        survey = Survey.query.get(survey_id)
        if not survey or not survey.is_active:
            return False, '설문이 종료되었습니다.'

        now = datetime.utcnow()
        if survey.start_date and now < survey.start_date:
            return False, '설문이 아직 시작되지 않았습니다.'
        if survey.end_date and now > survey.end_date:
            return False, '설문 기간이 종료되었습니다.'

        # 중복 응답 체크
        if not survey.allow_multiple_responses:
            existing = SurveyResponse.query.filter_by(
                survey_id=survey_id, respondent_id=user_id, is_complete=True
            ).first()
            if existing:
                return False, '이미 응답한 설문입니다.'

        return True, None

    @staticmethod
    def submit(survey_id, user_id, answers_data, is_anonymous=False):
        """설문 응답 제출"""
        can, message = SurveyResponseService.can_respond(survey_id, user_id)
        if not can:
            raise ValueError(message)

        survey = Survey.query.get(survey_id)

        # 응답 세션 생성
        response = SurveyResponse(
            survey_id=survey_id,
            respondent_id=None if (is_anonymous or survey.is_anonymous) else user_id,
            is_complete=True,
            submitted_at=datetime.utcnow()
        )
        db.session.add(response)
        db.session.flush()

        # 답변 저장
        for ans_data in answers_data:
            answer = SurveyAnswer(
                response_id=response.id,
                question_id=ans_data['questionId'],
                answer_text=ans_data.get('answerText'),
                selected_options=ans_data.get('selectedOptions', []),
                scale_value=ans_data.get('scaleValue')
            )
            db.session.add(answer)

        db.session.commit()
        return response

    @staticmethod
    def update_response(response_id, user_id, answers_data):
        """설문 응답 수정"""
        response = SurveyResponse.query.get(response_id)
        if not response:
            raise ValueError('응답을 찾을 수 없습니다.')

        # 본인 응답인지 확인
        if response.respondent_id != user_id:
            raise ValueError('본인의 응답만 수정할 수 있습니다.')

        # 설문이 아직 활성 상태인지 확인
        survey = Survey.query.get(response.survey_id)
        if not survey or not survey.is_active:
            raise ValueError('설문이 종료되어 수정할 수 없습니다.')

        now = datetime.utcnow()
        if survey.end_date and now > survey.end_date:
            raise ValueError('설문 기간이 종료되어 수정할 수 없습니다.')

        # 기존 답변 삭제
        SurveyAnswer.query.filter_by(response_id=response_id).delete()

        # 새 답변 저장
        for ans_data in answers_data:
            answer = SurveyAnswer(
                response_id=response_id,
                question_id=ans_data['questionId'],
                answer_text=ans_data.get('answerText'),
                selected_options=ans_data.get('selectedOptions', []),
                scale_value=ans_data.get('scaleValue')
            )
            db.session.add(answer)

        response.submitted_at = datetime.utcnow()
        db.session.commit()
        return response

    @staticmethod
    def delete(response_id):
        response = SurveyResponse.query.get(response_id)
        if response:
            db.session.delete(response)
            db.session.commit()
            return True
        return False
