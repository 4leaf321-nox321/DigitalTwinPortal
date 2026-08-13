"""
Digital Twin SW Resource Services
"""
from app.extensions import db
from sqlalchemy.orm.attributes import flag_modified
from app.modules.digital_twin_sw_resource.models import SwResource


class SwResourceService:
    """S/W 자원 CRUD 서비스"""

    @staticmethod
    def get_all(category=None, division=None):
        query = SwResource.query
        if category:
            query = query.filter(SwResource.category.contains([category]))
        if division:
            query = query.filter_by(division=division)
        return query.order_by(SwResource.order, SwResource.id).all()

    @staticmethod
    def get_by_id(resource_id):
        return SwResource.query.get(resource_id)

    @staticmethod
    def create(**kwargs):
        field_map = {
            'name': 'name',
            'vendor': 'vendor',
            'category': 'category',
            'version': 'version',
            'licenseType': 'license_type',
            'licenseNature': 'license_nature',
            'licenseCount': 'license_count',
            'licenseUnit': 'license_unit',
            'description': 'description',
            'division': 'division',
            'department': 'department',
            'usingDepartments': 'using_departments',
            'copyCount': 'copy_count',
            'order': 'order',
        }
        mapped = {}
        for camel, snake in field_map.items():
            if camel in kwargs:
                mapped[snake] = kwargs[camel]

        resource = SwResource(**mapped)
        db.session.add(resource)
        db.session.commit()
        return resource

    @staticmethod
    def update(resource_id, **kwargs):
        resource = SwResource.query.get(resource_id)
        if not resource:
            return None

        field_map = {
            'name': 'name',
            'vendor': 'vendor',
            'category': 'category',
            'version': 'version',
            'licenseType': 'license_type',
            'licenseNature': 'license_nature',
            'licenseCount': 'license_count',
            'licenseUnit': 'license_unit',
            'description': 'description',
            'division': 'division',
            'department': 'department',
            'usingDepartments': 'using_departments',
            'copyCount': 'copy_count',
            'order': 'order',
        }

        for camel, snake in field_map.items():
            if camel in kwargs:
                setattr(resource, snake, kwargs[camel])

        if 'category' in kwargs:
            flag_modified(resource, 'category')
        if 'usingDepartments' in kwargs:
            flag_modified(resource, 'using_departments')

        db.session.commit()
        return resource

    @staticmethod
    def delete(resource_id):
        resource = SwResource.query.get(resource_id)
        if not resource:
            return False
        db.session.delete(resource)
        db.session.commit()
        return True
