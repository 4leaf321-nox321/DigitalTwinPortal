"""
Digital Twin SW Resource Models
"""
from app.extensions import db
from app.shared.models import BaseModel
from app.shared.timeutil import iso_kst


class SwResource(BaseModel):
    """전사 디지털 트윈 S/W 자원 정보"""
    __tablename__ = 'sw_resources'

    name = db.Column(db.String(300), nullable=False)
    vendor = db.Column(db.String(300))
    category = db.Column(db.JSON, default=list)
    version = db.Column(db.String(100))
    license_type = db.Column(db.String(100))
    license_nature = db.Column(db.String(50), default='base')
    license_count = db.Column(db.Integer, default=0)
    license_unit = db.Column(db.String(100))
    description = db.Column(db.Text)
    division = db.Column(db.String(200))
    department = db.Column(db.String(200))
    using_departments = db.Column(db.JSON, default=list)
    copy_count = db.Column(db.Integer, default=0)
    order = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'vendor': self.vendor,
            'category': self.category or [],
            'version': self.version,
            'licenseType': self.license_type,
            'licenseNature': self.license_nature,
            'licenseCount': self.license_count,
            'licenseUnit': self.license_unit,
            'copyCount': self.copy_count,
            'description': self.description,
            'division': self.division,
            'department': self.department,
            'usingDepartments': self.using_departments or [],
            'order': self.order,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }
