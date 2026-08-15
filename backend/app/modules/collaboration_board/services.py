"""
Collaboration Board Services
협업 게시판 서비스
"""
import os
from datetime import datetime
from app.extensions import db
from app.modules.collaboration_board.models import (
    BoardCategory, BoardPost, BoardComment, BoardAttachment, UPLOAD_FOLDER,
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
