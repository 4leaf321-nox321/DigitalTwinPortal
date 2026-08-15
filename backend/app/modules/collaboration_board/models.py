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


