"""
Meeting Management Services
협의체/회의체/보고 관리 서비스
"""
import os
from datetime import datetime
from app.extensions import db
from app.modules.meeting_management.models import (
    MeetingGroup, MeetingSession, MeetingAgendaItem, MeetingAttachment, UPLOAD_FOLDER,
    ReportPlanRound, ReportPlanItem, ReportPlanMeta, ReportPlanComment
)
from app.shared.timeutil import iso_kst


class MeetingGroupService:
    """Service for MeetingGroup operations."""

    @staticmethod
    def get_all(include_inactive=False):
        """Get all meeting groups."""
        query = MeetingGroup.query
        if not include_inactive:
            query = query.filter_by(is_active=True)
        return query.order_by(MeetingGroup.order, MeetingGroup.name).all()

    @staticmethod
    def get_by_id(group_id):
        """Get a meeting group by ID."""
        return MeetingGroup.query.get(group_id)

    @staticmethod
    def create(name, meeting_type, cycle=None, description=None, participants=None, color='#3b82f6'):
        """Create a new meeting group."""
        group = MeetingGroup(
            name=name,
            meeting_type=meeting_type,
            cycle=cycle,
            description=description,
            participants=participants,
            color=color
        )
        db.session.add(group)
        db.session.commit()
        return group

    @staticmethod
    def update(group_id, **kwargs):
        """Update a meeting group."""
        group = MeetingGroup.query.get(group_id)
        if not group:
            return None

        updateable_fields = ['name', 'meeting_type', 'cycle', 'description',
                            'participants', 'color', 'is_active', 'order']

        for field in updateable_fields:
            # camelCase to snake_case mapping
            camel_field = ''.join(word.capitalize() if i > 0 else word
                                  for i, word in enumerate(field.split('_')))
            if camel_field in kwargs:
                setattr(group, field, kwargs[camel_field])
            elif field in kwargs:
                setattr(group, field, kwargs[field])

        db.session.commit()
        return group

    @staticmethod
    def delete(group_id):
        """Delete a meeting group and all its sessions."""
        group = MeetingGroup.query.get(group_id)
        if not group:
            return False

        db.session.delete(group)
        db.session.commit()
        return True


class MeetingSessionService:
    """Service for MeetingSession operations."""

    @staticmethod
    def get_all_by_group(group_id):
        """Get all sessions for a group."""
        return MeetingSession.query.filter_by(group_id=group_id)\
            .order_by(MeetingSession.session_date.desc()).all()

    @staticmethod
    def get_by_id(session_id):
        """Get a session by ID."""
        return MeetingSession.query.get(session_id)

    @staticmethod
    def get_next_session_number(group_id, year):
        """Get the next session number for a group in a specific year."""
        max_num = db.session.query(db.func.max(MeetingSession.session_number))\
            .filter(MeetingSession.group_id == group_id, MeetingSession.year == year).scalar()
        return (max_num or 0) + 1

    @staticmethod
    def create(group_id, year, session_number, session_date, session_time=None,
               location=None, summary=None, agenda_items=None):
        """Create a new session."""
        session = MeetingSession(
            group_id=group_id,
            year=year,
            session_number=session_number,
            session_date=session_date,
            session_time=session_time,
            location=location,
            summary=summary
        )
        db.session.add(session)
        db.session.flush()

        # Add agenda items if provided
        if agenda_items:
            for i, item_data in enumerate(agenda_items):
                item = MeetingAgendaItem(
                    session_id=session.id,
                    title=item_data.get('title', ''),
                    content=item_data.get('content', ''),
                    order=item_data.get('order', i)
                )
                db.session.add(item)

        db.session.commit()
        return session

    @staticmethod
    def update(session_id, **kwargs):
        """Update a session."""
        session = MeetingSession.query.get(session_id)
        if not session:
            return None

        updateable_fields = ['year', 'session_number', 'session_date', 'session_time',
                            'location', 'summary']

        for field in updateable_fields:
            camel_field = ''.join(word.capitalize() if i > 0 else word
                                  for i, word in enumerate(field.split('_')))
            if camel_field in kwargs:
                setattr(session, field, kwargs[camel_field])
            elif field in kwargs:
                setattr(session, field, kwargs[field])

        db.session.commit()
        return session

    @staticmethod
    def delete(session_id):
        """Delete a session and all its items."""
        session = MeetingSession.query.get(session_id)
        if not session:
            return False

        # Delete attached files from disk
        for attachment in session.attachments:
            file_path = os.path.join(UPLOAD_FOLDER, attachment.stored_filename)
            if os.path.exists(file_path):
                os.remove(file_path)

        db.session.delete(session)
        db.session.commit()
        return True


class MeetingAgendaItemService:
    """Service for MeetingAgendaItem operations."""

    @staticmethod
    def get_by_session(session_id):
        """Get all agenda items for a session."""
        return MeetingAgendaItem.query.filter_by(session_id=session_id)\
            .order_by(MeetingAgendaItem.order).all()

    @staticmethod
    def get_by_id(item_id):
        """Get an agenda item by ID."""
        return MeetingAgendaItem.query.get(item_id)

    @staticmethod
    def create(session_id, title, content=None, order=0):
        """Create a new agenda item."""
        item = MeetingAgendaItem(
            session_id=session_id,
            title=title,
            content=content,
            order=order
        )
        db.session.add(item)
        db.session.commit()
        return item

    @staticmethod
    def update(item_id, **kwargs):
        """Update an agenda item."""
        item = MeetingAgendaItem.query.get(item_id)
        if not item:
            return None

        if 'title' in kwargs:
            item.title = kwargs['title']
        if 'content' in kwargs:
            item.content = kwargs['content']
        if 'order' in kwargs:
            item.order = kwargs['order']

        db.session.commit()
        return item

    @staticmethod
    def delete(item_id):
        """Delete an agenda item."""
        item = MeetingAgendaItem.query.get(item_id)
        if not item:
            return False

        db.session.delete(item)
        db.session.commit()
        return True

    @staticmethod
    def bulk_update(session_id, items_data):
        """Bulk update agenda items for a session."""
        # Delete existing items
        MeetingAgendaItem.query.filter_by(session_id=session_id).delete()

        # Create new items
        for i, item_data in enumerate(items_data):
            item = MeetingAgendaItem(
                session_id=session_id,
                title=item_data.get('title', ''),
                content=item_data.get('content', ''),
                order=item_data.get('order', i)
            )
            db.session.add(item)

        db.session.commit()
        return MeetingAgendaItemService.get_by_session(session_id)


class MeetingAttachmentService:
    """Service for MeetingAttachment operations."""

    @staticmethod
    def ensure_upload_folder():
        """Ensure upload folder exists."""
        if not os.path.exists(UPLOAD_FOLDER):
            os.makedirs(UPLOAD_FOLDER)

    @staticmethod
    def get_by_id(attachment_id):
        """Get an attachment by ID."""
        return MeetingAttachment.query.get(attachment_id)

    @staticmethod
    def get_by_session(session_id):
        """Get all attachments for a session."""
        return MeetingAttachment.query.filter_by(session_id=session_id).all()

    @staticmethod
    def create(session_id, file, file_type='etc'):
        """Create a new attachment."""
        MeetingAttachmentService.ensure_upload_folder()

        original_filename = file.filename
        stored_filename = MeetingAttachment.generate_stored_filename(original_filename)
        file_path = os.path.join(UPLOAD_FOLDER, stored_filename)

        # Save file to disk
        file.save(file_path)

        # Get file size
        file_size = os.path.getsize(file_path)

        # Create attachment record
        attachment = MeetingAttachment(
            session_id=session_id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            file_size=file_size,
            mime_type=file.content_type,
            file_type=file_type
        )
        db.session.add(attachment)
        db.session.commit()

        return attachment

    @staticmethod
    def delete(attachment_id):
        """Delete an attachment and its file."""
        attachment = MeetingAttachment.query.get(attachment_id)
        if not attachment:
            return False

        # Delete file from disk
        file_path = os.path.join(UPLOAD_FOLDER, attachment.stored_filename)
        if os.path.exists(file_path):
            os.remove(file_path)

        # Delete record
        db.session.delete(attachment)
        db.session.commit()
        return True

    @staticmethod
    def get_file_path(attachment):
        """Get the file path for an attachment."""
        return os.path.join(UPLOAD_FOLDER, attachment.stored_filename)


# ============== Report Plan Service ==============

class ReportPlanService:
    """Service for Report Plan (보고 계획) operations."""

    @staticmethod
    def get_tab_meta(tab_key):
        """Get meta info (updatedAt) for a tab."""
        meta = ReportPlanMeta.query.get(tab_key)
        return meta

    @staticmethod
    def get_rounds_by_tab(tab_key):
        """Get all rounds for a tab."""
        return ReportPlanRound.query.filter_by(tab_key=tab_key)\
            .order_by(ReportPlanRound.round_number).all()

    @staticmethod
    def save_tab_data(tab_key, rounds_data, client_updated_at=None):
        """
        Save entire tab data (replace all).
        Deletes existing rounds for the tab and recreates from data.
        Returns (rounds, meta). Raises ConflictError if version mismatch.
        """
        # 낙관적 잠금: client_updated_at이 있으면 서버 버전과 비교
        meta = ReportPlanMeta.query.get(tab_key)
        if client_updated_at and meta:
            server_ts = iso_kst(meta.updated_at) if meta.updated_at else None
            if server_ts and server_ts != client_updated_at:
                # 충돌 발생 — 서버의 현재 데이터를 반환
                current_rounds = ReportPlanRound.query.filter_by(tab_key=tab_key)\
                    .order_by(ReportPlanRound.round_number).all()
                raise ConflictError(
                    current_rounds=[r.to_dict() for r in current_rounds],
                    server_updated_at=server_ts,
                )

        # Delete existing rounds for this tab
        existing = ReportPlanRound.query.filter_by(tab_key=tab_key).all()
        for r in existing:
            db.session.delete(r)
        db.session.flush()

        # Create new rounds
        created_rounds = []
        for r_data in rounds_data:
            round_obj = ReportPlanRound(
                tab_key=tab_key,
                round_number=r_data.get('roundNumber', 1),
                schedule=r_data.get('schedule', ''),
                time_start=r_data.get('timeStart', ''),
                time_end=r_data.get('timeEnd', ''),
                status=r_data.get('status', '미정'),
            )
            db.session.add(round_obj)
            db.session.flush()  # get round_obj.id

            for idx, item_data in enumerate(r_data.get('items', [])):
                divisions_val = item_data.get('divisions', [])
                if isinstance(divisions_val, list):
                    divisions_val = ','.join(divisions_val)
                item = ReportPlanItem(
                    round_id=round_obj.id,
                    category=item_data.get('category', ''),
                    divisions=divisions_val,
                    agenda=item_data.get('agenda', ''),
                    content=item_data.get('content', ''),
                    order=idx,
                    category_merged=item_data.get('categoryMerged', True),
                    linked_id=item_data.get('linkedId', None),
                )
                db.session.add(item)

            created_rounds.append(round_obj)

        # Update meta timestamp
        now = datetime.utcnow()
        if meta:
            meta.updated_at = now
        else:
            meta = ReportPlanMeta(tab_key=tab_key, updated_at=now)
            db.session.add(meta)

        db.session.commit()
        return created_rounds, meta


# ============== Report Plan Comment Service ==============

class ReportPlanCommentService:
    """Service for Report Plan Comment (보고 계획 의견) operations."""

    @staticmethod
    def get_by_tab(tab_key, status_filter=None):
        """Get all top-level comments for a tab."""
        query = ReportPlanComment.query.filter_by(tab_key=tab_key, parent_id=None)
        if status_filter:
            query = query.filter_by(status=status_filter)
        return query.order_by(ReportPlanComment.created_at.desc()).all()

    @staticmethod
    def get_by_id(comment_id):
        return ReportPlanComment.query.get(comment_id)

    @staticmethod
    def create(tab_key, author, content, parent_id=None):
        comment = ReportPlanComment(
            tab_key=tab_key,
            author=author,
            content=content,
            parent_id=parent_id,
        )
        db.session.add(comment)
        db.session.commit()
        return comment

    @staticmethod
    def update(comment_id, **kwargs):
        comment = ReportPlanComment.query.get(comment_id)
        if not comment:
            return None
        if 'content' in kwargs:
            comment.content = kwargs['content']
        if 'status' in kwargs:
            comment.status = kwargs['status']
        db.session.commit()
        return comment

    @staticmethod
    def delete(comment_id):
        comment = ReportPlanComment.query.get(comment_id)
        if not comment:
            return False
        db.session.delete(comment)
        db.session.commit()
        return True


class ConflictError(Exception):
    """낙관적 잠금 충돌 에러"""
    def __init__(self, current_rounds, server_updated_at):
        self.current_rounds = current_rounds
        self.server_updated_at = server_updated_at
        super().__init__('Conflict')
