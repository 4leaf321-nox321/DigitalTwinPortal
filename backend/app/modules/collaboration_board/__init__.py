"""
Collaboration Board Module
협업 게시판 모듈
"""
from flask import Blueprint

bp = Blueprint('collaboration_board', __name__, url_prefix='/api/collaboration-board')

from app.modules.collaboration_board import routes
from app.modules.collaboration_board import models


def init_default_categories():
    """Initialize default board categories if none exist."""
    from app.extensions import db
    from app.modules.collaboration_board.models import BoardCategory

    # Update existing '자유게시판' to '토론 게시판' if needed
    # (slug='discussion'이 이미 존재하면 스킵하여 unique 위반 방지)
    free_board = BoardCategory.query.filter_by(slug='free').first()
    discussion_exists = BoardCategory.query.filter_by(slug='discussion').first()
    if free_board and not discussion_exists:
        free_board.name = '토론 게시판'
        free_board.slug = 'discussion'
        free_board.description = '안건 기반 토론 게시판'
        free_board.icon = 'MessagesSquare'
        free_board.is_discussion = True
        db.session.commit()

    # Deactivate '공지사항' category (no longer needed)
    notices_board = BoardCategory.query.filter_by(slug='notices').first()
    if notices_board and notices_board.is_active:
        notices_board.is_active = False
        db.session.commit()

    # Deactivate '프로젝트 협업' category (no longer needed)
    projects_board = BoardCategory.query.filter_by(slug='projects').first()
    if projects_board and projects_board.is_active:
        projects_board.is_active = False
        db.session.commit()

    # 필수 카테고리 정의 (없으면 생성)
    required_categories = [
        {
            'name': '자유 게시판',
            'slug': 'free',
            'description': '자유롭게 이야기를 나누는 공간입니다.',
            'color': '#22c55e',
            'icon': 'Coffee',
            'order': 1,
            'allow_comments': True,
            'allow_attachments': True,
            'is_anonymous': False
        },
        {
            'name': '익명 게시판',
            'slug': 'anonymous',
            'description': '익명으로 의견을 나누는 공간입니다.',
            'color': '#6366f1',
            'icon': 'UserX',
            'order': 2,
            'allow_comments': True,
            'allow_attachments': True,
            'is_anonymous': True
        },
        {
            'name': '자료실',
            'slug': 'resources',
            'description': '업무 관련 자료 공유',
            'color': '#3b82f6',
            'icon': 'FolderOpen',
            'order': 3,
            'allow_comments': True,
            'allow_attachments': True
        },
        {
            'name': 'Q&A',
            'slug': 'qna',
            'description': '질문과 답변 게시판',
            'color': '#10b981',
            'icon': 'HelpCircle',
            'order': 4,
            'allow_comments': True,
            'allow_attachments': True
        },
        {
            'name': '토론 게시판',
            'slug': 'discussion',
            'description': '안건 기반 토론 게시판',
            'color': '#8b5cf6',
            'icon': 'MessagesSquare',
            'order': 5,
            'allow_comments': True,
            'allow_attachments': True,
            'is_discussion': True
        }
    ]

    # 없는 카테고리만 생성
    existing_slugs = [c.slug for c in BoardCategory.query.all()]
    categories_created = False

    for cat_data in required_categories:
        if cat_data['slug'] not in existing_slugs:
            category = BoardCategory(**cat_data)
            db.session.add(category)
            categories_created = True
            print(f"[Init] Created category: {cat_data['name']}")

    if categories_created:
        db.session.commit()
        print("[Init] Default board categories initialized.")
