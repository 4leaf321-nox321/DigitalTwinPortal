"""
Office Management Services
"""
import os
from app.extensions import db
from app.modules.office_management.models import Week, Agenda, Attachment, BusinessContact, UPLOAD_FOLDER


class WeekService:
    """Service for Week operations."""

    @staticmethod
    def get_all():
        """Get all weeks sorted by year and week descending."""
        return Week.query.order_by(Week.year.desc(), Week.week.desc()).all()

    @staticmethod
    def get_by_id(week_id):
        """Get a week by ID."""
        return Week.query.get(week_id)

    @staticmethod
    def get_by_year_week(year, week):
        """Get a week by year and week number."""
        return Week.query.filter_by(year=year, week=week).first()

    @staticmethod
    def create(year, week):
        """Create a new week."""
        existing = WeekService.get_by_year_week(year, week)
        if existing:
            return existing

        week_obj = Week(year=year, week=week)
        db.session.add(week_obj)
        db.session.commit()
        return week_obj

    @staticmethod
    def update(week_id, **kwargs):
        """Update a week."""
        week = Week.query.get(week_id)
        if not week:
            return None

        if 'year' in kwargs:
            week.year = kwargs['year']
        if 'week' in kwargs:
            week.week = kwargs['week']

        db.session.commit()
        return week

    @staticmethod
    def delete(week_id):
        """Delete a week and all its agendas."""
        week = Week.query.get(week_id)
        if not week:
            return False

        db.session.delete(week)
        db.session.commit()
        return True


class AgendaService:
    """Service for Agenda operations."""

    @staticmethod
    def get_all():
        """Get all agendas."""
        return Agenda.query.all()

    @staticmethod
    def get_by_id(agenda_id):
        """Get an agenda by ID."""
        return Agenda.query.get(agenda_id)

    @staticmethod
    def get_by_week(week_id):
        """Get all agendas for a week."""
        return Agenda.query.filter_by(week_id=week_id).all()

    @staticmethod
    def create(week_id, title, content=None, linked_agenda_title=None):
        """Create a new agenda."""
        agenda = Agenda(
            week_id=week_id,
            title=title,
            content=content,
            linked_agenda_title=linked_agenda_title
        )
        db.session.add(agenda)
        db.session.commit()
        return agenda

    @staticmethod
    def update(agenda_id, **kwargs):
        """Update an agenda."""
        agenda = Agenda.query.get(agenda_id)
        if not agenda:
            return None

        if 'title' in kwargs:
            agenda.title = kwargs['title']
        if 'content' in kwargs:
            agenda.content = kwargs['content']
        if 'linkedAgendaTitle' in kwargs:
            agenda.linked_agenda_title = kwargs['linkedAgendaTitle']
        if 'linked_agenda_title' in kwargs:
            agenda.linked_agenda_title = kwargs['linked_agenda_title']

        db.session.commit()
        return agenda

    @staticmethod
    def delete(agenda_id):
        """Delete an agenda."""
        agenda = Agenda.query.get(agenda_id)
        if not agenda:
            return False

        db.session.delete(agenda)
        db.session.commit()
        return True

    @staticmethod
    def get_all_titles():
        """Get all unique agenda titles."""
        results = db.session.query(Agenda.title).distinct().all()
        return [r[0] for r in results]


class BulkService:
    """Service for bulk operations."""

    @staticmethod
    def bulk_add_agendas(items):
        """
        Bulk add agendas.
        items: list of {year, week, title, content}
        """
        created_weeks = {}
        created_agendas = []

        for item in items:
            year = item['year']
            week = item['week']
            key = (year, week)

            # Get or create week
            if key not in created_weeks:
                week_obj = WeekService.get_by_year_week(year, week)
                if not week_obj:
                    week_obj = Week(year=year, week=week)
                    db.session.add(week_obj)
                    db.session.flush()  # Get ID without committing
                created_weeks[key] = week_obj

            week_obj = created_weeks[key]

            # Create agenda
            agenda = Agenda(
                week_id=week_obj.id,
                title=item['title'],
                content=item.get('content', ''),
                linked_agenda_title=item.get('linkedAgendaTitle')
            )
            db.session.add(agenda)
            created_agendas.append(agenda)

        db.session.commit()

        return {
            'weeks_created': len([w for w in created_weeks.values() if w.id]),
            'agendas_created': len(created_agendas)
        }

    @staticmethod
    def get_all_data():
        """Get all weeks with agendas."""
        weeks = Week.query.order_by(Week.year.desc(), Week.week.desc()).all()
        return [w.to_dict(include_agendas=True) for w in weeks]

    @staticmethod
    def save_all_data(weeks_data):
        """
        Save all data (replace existing).
        weeks_data: list of {year, week, agendas: [{title, content, linkedAgendaTitle}]}
        """
        # Delete all existing data
        Agenda.query.delete()
        Week.query.delete()

        # Create new data
        for week_data in weeks_data:
            week = Week(year=week_data['year'], week=week_data['week'])
            db.session.add(week)
            db.session.flush()

            for agenda_data in week_data.get('agendas', []):
                agenda = Agenda(
                    week_id=week.id,
                    title=agenda_data['title'],
                    content=agenda_data.get('content', ''),
                    linked_agenda_title=agenda_data.get('linkedAgendaTitle')
                )
                db.session.add(agenda)

        db.session.commit()
        return BulkService.get_all_data()


class AttachmentService:
    """Service for Attachment operations."""

    @staticmethod
    def ensure_upload_folder():
        """Ensure upload folder exists."""
        if not os.path.exists(UPLOAD_FOLDER):
            os.makedirs(UPLOAD_FOLDER)

    @staticmethod
    def get_by_id(attachment_id):
        """Get an attachment by ID."""
        return Attachment.query.get(attachment_id)

    @staticmethod
    def get_by_agenda(agenda_id):
        """Get all attachments for an agenda."""
        return Attachment.query.filter_by(agenda_id=agenda_id).all()

    @staticmethod
    def create(agenda_id, file):
        """
        Create a new attachment.
        file: werkzeug FileStorage object
        """
        AttachmentService.ensure_upload_folder()

        original_filename = file.filename
        stored_filename = Attachment.generate_stored_filename(original_filename)
        file_path = os.path.join(UPLOAD_FOLDER, stored_filename)

        # Save file to disk
        file.save(file_path)

        # Get file size
        file_size = os.path.getsize(file_path)

        # Create attachment record
        attachment = Attachment(
            agenda_id=agenda_id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            file_size=file_size,
            mime_type=file.content_type
        )
        db.session.add(attachment)
        db.session.commit()

        return attachment

    @staticmethod
    def delete(attachment_id):
        """Delete an attachment and its file."""
        attachment = Attachment.query.get(attachment_id)
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


class BusinessContactService:
    """Service for Business Contact operations."""

    @staticmethod
    def get_data():
        """Get business contacts data."""
        # Get or create the single record
        contact = BusinessContact.query.first()
        if not contact:
            return {}
        return contact.data or {}

    @staticmethod
    def save_data(data):
        """Save business contacts data."""
        contact = BusinessContact.query.first()
        if not contact:
            contact = BusinessContact(data=data)
            db.session.add(contact)
        else:
            contact.data = data
        db.session.commit()
        return contact.data
