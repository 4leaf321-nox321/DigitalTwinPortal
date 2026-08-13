"""
Collaboration Board Models
협업 게시판 모델
"""
import os
import uuid
from app.extensions import db
from app.shared.models import BaseModel
from app.shared.timeutil import iso_kst

# Upload folder path
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'uploads', 'collaboration-board')


class BoardCategory(BaseModel):
    """
    게시판 카테고리 모델
    - 공지사항, 자료실, Q&A, 자유게시판 등
    """
    __tablename__ = 'board_categories'

    name = db.Column(db.String(100), nullable=False)  # 카테고리 이름
    slug = db.Column(db.String(100), unique=True, nullable=False)  # URL용 슬러그
    description = db.Column(db.Text)  # 설명
    color = db.Column(db.String(20), default='#3b82f6')  # 표시 색상
    icon = db.Column(db.String(50), default='FileText')  # 아이콘 이름
    order = db.Column(db.Integer, default=0)  # 정렬 순서
    is_active = db.Column(db.Boolean, default=True)

    # 권한 설정
    allow_comments = db.Column(db.Boolean, default=True)  # 댓글 허용
    allow_attachments = db.Column(db.Boolean, default=True)  # 첨부파일 허용
    is_discussion = db.Column(db.Boolean, default=False)  # 토론 게시판 여부 (스레드 형식)
    is_anonymous = db.Column(db.Boolean, default=False)  # 익명 게시판 여부

    # Relationships
    posts = db.relationship('BoardPost', back_populates='category', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'description': self.description,
            'color': self.color,
            'icon': self.icon,
            'order': self.order,
            'isActive': self.is_active,
            'allowComments': self.allow_comments,
            'allowAttachments': self.allow_attachments,
            'isDiscussion': self.is_discussion,
            'isAnonymous': self.is_anonymous,
            'postCount': self.posts.filter_by(is_active=True).count() if self.posts else 0,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None
        }


class BoardPost(BaseModel):
    """
    게시글 모델
    """
    __tablename__ = 'board_posts'

    category_id = db.Column(db.Integer, db.ForeignKey('board_categories.id'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    title = db.Column(db.String(300), nullable=False)  # 제목
    content = db.Column(db.Text, nullable=False)  # 내용 (HTML 지원)

    # 상태
    is_pinned = db.Column(db.Boolean, default=False)  # 상단 고정
    is_notice = db.Column(db.Boolean, default=False)  # 공지사항 여부
    is_active = db.Column(db.Boolean, default=True)  # 활성 상태

    # 통계
    view_count = db.Column(db.Integer, default=0)  # 조회수

    # Relationships
    category = db.relationship('BoardCategory', back_populates='posts')
    author = db.relationship('User', foreign_keys=[author_id])
    comments = db.relationship('BoardComment', back_populates='post', lazy='dynamic', cascade='all, delete-orphan')
    attachments = db.relationship('BoardAttachment', back_populates='post', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self, include_content=True, include_comments=False):
        data = {
            'id': self.id,
            'categoryId': self.category_id,
            'categoryName': self.category.name if self.category else None,
            'categorySlug': self.category.slug if self.category else None,
            'authorId': self.author_id,
            'authorName': self.author.name if self.author else None,
            'title': self.title,
            'isPinned': self.is_pinned,
            'isNotice': self.is_notice,
            'isActive': self.is_active,
            'viewCount': self.view_count,
            'commentCount': self.comments.count() if self.comments else 0,
            'attachmentCount': self.attachments.count() if self.attachments else 0,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None
        }

        if include_content:
            data['content'] = self.content

        if include_comments:
            data['comments'] = [c.to_dict() for c in self.comments.filter_by(parent_id=None).order_by(BoardComment.created_at.asc()).all()]

        data['attachments'] = [a.to_dict() for a in self.attachments.all()]

        return data


class BoardComment(BaseModel):
    """
    댓글 모델 (대댓글 지원)
    """
    __tablename__ = 'board_comments'

    post_id = db.Column(db.Integer, db.ForeignKey('board_posts.id'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('board_comments.id'), nullable=True)  # 대댓글용

    content = db.Column(db.Text, nullable=False)  # 댓글 내용
    is_active = db.Column(db.Boolean, default=True)  # 활성 상태 (삭제 시 False)

    # Relationships
    post = db.relationship('BoardPost', back_populates='comments')
    author = db.relationship('User', foreign_keys=[author_id])
    parent = db.relationship('BoardComment', remote_side='BoardComment.id', backref='replies')

    def to_dict(self):
        return {
            'id': self.id,
            'postId': self.post_id,
            'authorId': self.author_id,
            'authorName': self.author.name if self.author else None,
            'parentId': self.parent_id,
            'content': self.content if self.is_active else '삭제된 댓글입니다.',
            'isActive': self.is_active,
            'replies': [r.to_dict() for r in self.replies] if self.replies else [],
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None
        }


class BoardAttachment(BaseModel):
    """
    첨부파일 모델
    """
    __tablename__ = 'board_attachments'

    post_id = db.Column(db.Integer, db.ForeignKey('board_posts.id'), nullable=False)
    uploader_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    original_filename = db.Column(db.String(500), nullable=False)  # 원본 파일명
    stored_filename = db.Column(db.String(500), nullable=False)  # 저장된 파일명
    file_size = db.Column(db.Integer)  # 파일 크기 (bytes)
    mime_type = db.Column(db.String(100))  # MIME 타입

    # Relationships
    post = db.relationship('BoardPost', back_populates='attachments')
    uploader = db.relationship('User', foreign_keys=[uploader_id])

    def to_dict(self):
        return {
            'id': self.id,
            'postId': self.post_id,
            'originalFilename': self.original_filename,
            'storedFilename': self.stored_filename,
            'fileSize': self.file_size,
            'mimeType': self.mime_type,
            'uploaderId': self.uploader_id,
            'uploaderName': self.uploader.name if self.uploader else None,
            'createdAt': iso_kst(self.created_at) if self.created_at else None
        }

    @staticmethod
    def generate_stored_filename(original_filename):
        """Generate unique stored filename."""
        ext = os.path.splitext(original_filename)[1] if '.' in original_filename else ''
        return f"{uuid.uuid4().hex}{ext}"


# ============== Survey Models ==============

class Survey(BaseModel):
    """
    설문조사 모델
    """
    __tablename__ = 'surveys'

    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    title = db.Column(db.String(300), nullable=False)  # 설문 제목
    description = db.Column(db.Text)  # 설문 설명

    # 설문 기간
    start_date = db.Column(db.DateTime, nullable=True)  # 시작일 (null이면 즉시 시작)
    end_date = db.Column(db.DateTime, nullable=True)  # 종료일 (null이면 무기한)

    # 설정
    is_anonymous = db.Column(db.Boolean, default=False)  # 익명 설문 여부
    allow_multiple_responses = db.Column(db.Boolean, default=False)  # 중복 응답 허용
    is_active = db.Column(db.Boolean, default=True)  # 활성 상태

    # Relationships
    author = db.relationship('User', foreign_keys=[author_id])
    questions = db.relationship('SurveyQuestion', back_populates='survey', lazy='dynamic',
                                cascade='all, delete-orphan', order_by='SurveyQuestion.order')
    responses = db.relationship('SurveyResponse', back_populates='survey', lazy='dynamic',
                                cascade='all, delete-orphan')

    def to_dict(self, include_questions=False, include_stats=False):
        from datetime import datetime
        now = datetime.utcnow()

        # 상태 계산
        if not self.is_active:
            status = 'closed'
        elif self.end_date and now > self.end_date:
            status = 'ended'
        elif self.start_date and now < self.start_date:
            status = 'scheduled'
        else:
            status = 'active'

        data = {
            'id': self.id,
            'authorId': self.author_id,
            'authorName': self.author.name if self.author else None,
            'title': self.title,
            'description': self.description,
            'startDate': iso_kst(self.start_date) if self.start_date else None,
            'endDate': iso_kst(self.end_date) if self.end_date else None,
            'isAnonymous': self.is_anonymous,
            'allowMultipleResponses': self.allow_multiple_responses,
            'isActive': self.is_active,
            'status': status,
            'questionCount': self.questions.count() if self.questions else 0,
            'responseCount': self.responses.count() if self.responses else 0,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None
        }

        if include_questions:
            data['questions'] = [q.to_dict() for q in self.questions.order_by(SurveyQuestion.order).all()]

        if include_stats:
            data['stats'] = self._get_stats()

        return data

    def _get_stats(self):
        """설문 통계 계산"""
        stats = {
            'totalResponses': self.responses.count(),
            'questions': []
        }

        for question in self.questions.order_by(SurveyQuestion.order).all():
            q_stat = {
                'questionId': question.id,
                'questionText': question.question_text,
                'questionType': question.question_type,
                'answers': []
            }

            if question.question_type in ['single', 'multiple', 'dropdown']:
                # 선택형: 각 옵션별 선택 수
                options = question.options or []
                # 모든 응답을 가져와서 Python에서 처리 (DB 호환성)
                all_answers = SurveyAnswer.query.filter(
                    SurveyAnswer.question_id == question.id
                ).all()
                for opt in options:
                    count = sum(1 for a in all_answers if a.selected_options and opt in a.selected_options)
                    q_stat['answers'].append({'option': opt, 'count': count})

            elif question.question_type == 'scale':
                # 척도: 각 값별 선택 수
                scale_min = question.scale_min or 1
                scale_max = question.scale_max or 5
                for val in range(scale_min, scale_max + 1):
                    count = SurveyAnswer.query.filter(
                        SurveyAnswer.question_id == question.id,
                        SurveyAnswer.scale_value == val
                    ).count()
                    q_stat['answers'].append({'value': val, 'count': count})

                # 평균 계산
                answers = SurveyAnswer.query.filter(
                    SurveyAnswer.question_id == question.id,
                    SurveyAnswer.scale_value.isnot(None)
                ).all()
                if answers:
                    avg = sum(a.scale_value for a in answers) / len(answers)
                    q_stat['average'] = round(avg, 2)

            else:
                # 주관식: 텍스트 답변 목록
                answers = SurveyAnswer.query.filter(
                    SurveyAnswer.question_id == question.id,
                    SurveyAnswer.answer_text.isnot(None)
                ).all()
                q_stat['answers'] = [{'text': a.answer_text} for a in answers]

            stats['questions'].append(q_stat)

        return stats


class SurveyQuestion(BaseModel):
    """
    설문 문항 모델
    """
    __tablename__ = 'survey_questions'

    survey_id = db.Column(db.Integer, db.ForeignKey('surveys.id'), nullable=False)

    question_text = db.Column(db.Text, nullable=False)  # 질문 내용
    question_type = db.Column(db.String(50), nullable=False)  # 문항 유형: single, multiple, text, textarea, scale, dropdown, date

    # 선택형 옵션 (JSON 배열)
    options = db.Column(db.JSON, default=list)  # ['옵션1', '옵션2', ...]

    # 척도형 설정
    scale_min = db.Column(db.Integer, default=1)  # 최소값
    scale_max = db.Column(db.Integer, default=5)  # 최대값
    scale_min_label = db.Column(db.String(100))  # 최소값 라벨 (예: '매우 불만족')
    scale_max_label = db.Column(db.String(100))  # 최대값 라벨 (예: '매우 만족')

    # 설정
    is_required = db.Column(db.Boolean, default=False)  # 필수 여부
    order = db.Column(db.Integer, default=0)  # 순서

    # Relationships
    survey = db.relationship('Survey', back_populates='questions')
    answers = db.relationship('SurveyAnswer', back_populates='question', lazy='dynamic',
                              cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'surveyId': self.survey_id,
            'questionText': self.question_text,
            'questionType': self.question_type,
            'options': self.options or [],
            'scaleMin': self.scale_min,
            'scaleMax': self.scale_max,
            'scaleMinLabel': self.scale_min_label,
            'scaleMaxLabel': self.scale_max_label,
            'isRequired': self.is_required,
            'order': self.order,
            'createdAt': iso_kst(self.created_at) if self.created_at else None
        }


class SurveyResponse(BaseModel):
    """
    설문 응답 세션 모델
    """
    __tablename__ = 'survey_responses'

    survey_id = db.Column(db.Integer, db.ForeignKey('surveys.id'), nullable=False)
    respondent_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # 익명이면 null

    is_complete = db.Column(db.Boolean, default=False)  # 완료 여부
    submitted_at = db.Column(db.DateTime, nullable=True)  # 제출 시각

    # Relationships
    survey = db.relationship('Survey', back_populates='responses')
    respondent = db.relationship('User', foreign_keys=[respondent_id])
    answers = db.relationship('SurveyAnswer', back_populates='response', lazy='dynamic',
                              cascade='all, delete-orphan')

    def to_dict(self, include_answers=False):
        data = {
            'id': self.id,
            'surveyId': self.survey_id,
            'respondentId': self.respondent_id,
            'respondentName': self.respondent.name if self.respondent else '익명',
            'isComplete': self.is_complete,
            'submittedAt': iso_kst(self.submitted_at) if self.submitted_at else None,
            'createdAt': iso_kst(self.created_at) if self.created_at else None
        }

        if include_answers:
            data['answers'] = [a.to_dict() for a in self.answers.all()]

        return data


class SurveyAnswer(BaseModel):
    """
    개별 답변 모델
    """
    __tablename__ = 'survey_answers'

    response_id = db.Column(db.Integer, db.ForeignKey('survey_responses.id'), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey('survey_questions.id'), nullable=False)

    # 답변 데이터 (유형에 따라 사용)
    answer_text = db.Column(db.Text)  # 주관식 답변
    selected_options = db.Column(db.JSON, default=list)  # 선택한 옵션들 (JSON 배열)
    scale_value = db.Column(db.Integer)  # 척도 값

    # Relationships
    response = db.relationship('SurveyResponse', back_populates='answers')
    question = db.relationship('SurveyQuestion', back_populates='answers')

    def to_dict(self):
        return {
            'id': self.id,
            'responseId': self.response_id,
            'questionId': self.question_id,
            'answerText': self.answer_text,
            'selectedOptions': self.selected_options or [],
            'scaleValue': self.scale_value,
            'createdAt': iso_kst(self.created_at) if self.created_at else None
        }
