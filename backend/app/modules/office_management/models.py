"""
Office Management Models - Week, Agenda, and Attachment
"""
import os
import uuid
from app.extensions import db
from app.shared.models import BaseModel
from app.shared.timeutil import iso_kst

# Upload folder path
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'uploads', 'office-management')


class Week(BaseModel):
    """Weekly Report model - represents a week."""
    __tablename__ = 'office_weeks'

    year = db.Column(db.Integer, nullable=False)
    week = db.Column(db.Integer, nullable=False)

    # Relationships
    agendas = db.relationship('Agenda', backref='week_ref', lazy='dynamic', cascade='all, delete-orphan')

    __table_args__ = (
        db.UniqueConstraint('year', 'week', name='unique_year_week'),
    )

    def to_dict(self, include_agendas=True):
        result = {
            'id': self.id,
            'year': self.year,
            'week': self.week,
            'created_at': iso_kst(self.created_at) if self.created_at else None,
            'updated_at': iso_kst(self.updated_at) if self.updated_at else None,
        }
        if include_agendas:
            result['agendas'] = [agenda.to_dict() for agenda in self.agendas]
        return result


class Agenda(BaseModel):
    """Agenda model - represents an agenda item within a week."""
    __tablename__ = 'office_agendas'

    week_id = db.Column(db.Integer, db.ForeignKey('office_weeks.id'), nullable=False)
    title = db.Column(db.String(500), nullable=False)
    content = db.Column(db.Text)
    linked_agenda_title = db.Column(db.String(500))  # Reference to another agenda by title

    # Relationships
    attachments = db.relationship('Attachment', backref='agenda_ref', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self, include_attachments=True):
        result = {
            'id': self.id,
            'week_id': self.week_id,
            'title': self.title,
            'content': self.content or '',
            'linkedAgendaTitle': self.linked_agenda_title,
            'created_at': iso_kst(self.created_at) if self.created_at else None,
            'updated_at': iso_kst(self.updated_at) if self.updated_at else None,
        }
        if include_attachments:
            result['attachments'] = [att.to_dict() for att in self.attachments]
        return result


class Attachment(BaseModel):
    """Attachment model - represents a file attached to an agenda."""
    __tablename__ = 'office_attachments'

    agenda_id = db.Column(db.Integer, db.ForeignKey('office_agendas.id'), nullable=False)
    original_filename = db.Column(db.String(500), nullable=False)  # Original file name
    stored_filename = db.Column(db.String(500), nullable=False)    # UUID-based stored name
    file_size = db.Column(db.Integer)  # File size in bytes
    mime_type = db.Column(db.String(100))  # MIME type

    def to_dict(self):
        return {
            'id': self.id,
            'agenda_id': self.agenda_id,
            'originalFilename': self.original_filename,
            'storedFilename': self.stored_filename,
            'fileSize': self.file_size,
            'mimeType': self.mime_type,
            'created_at': iso_kst(self.created_at) if self.created_at else None,
        }

    @staticmethod
    def generate_stored_filename(original_filename):
        """Generate a unique filename for storage."""
        ext = os.path.splitext(original_filename)[1]
        return f"{uuid.uuid4().hex}{ext}"


class BusinessContact(BaseModel):
    """Business Contact model - stores business unit contact information as JSON."""
    __tablename__ = 'office_business_contacts'

    data = db.Column(db.JSON, default=dict)  # JSON object storing all contacts

    def to_dict(self):
        return {
            'id': self.id,
            'data': self.data or {},
            'created_at': iso_kst(self.created_at) if self.created_at else None,
            'updated_at': iso_kst(self.updated_at) if self.updated_at else None,
        }
