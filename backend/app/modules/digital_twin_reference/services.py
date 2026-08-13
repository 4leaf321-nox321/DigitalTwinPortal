"""
Digital Twin Reference Services
"""
from app.extensions import db
from sqlalchemy.orm.attributes import flag_modified
from app.modules.digital_twin_reference.models import DtReferenceTask


class DtReferenceTaskService:
    """과제 CRUD 서비스"""

    @staticmethod
    def get_all(division_id=None):
        query = DtReferenceTask.query
        if division_id:
            query = query.filter_by(division_id=division_id)
        return query.order_by(DtReferenceTask.order, DtReferenceTask.id).all()

    @staticmethod
    def get_by_id(task_id):
        return DtReferenceTask.query.get(task_id)

    @staticmethod
    def create(name, division_id=None, test_item=None, test_item_detail=None,
               category=None, product_family=None, year=None, status=None,
               connected_dt_task=None, description=None, order=0):
        task = DtReferenceTask(
            name=name,
            division_id=division_id,
            test_item=test_item,
            test_item_detail=test_item_detail,
            category=category,
            product_family=product_family,
            year=year,
            status=status,
            connected_dt_task=connected_dt_task,
            description=description,
            order=order,
        )
        db.session.add(task)
        db.session.commit()
        return task

    @staticmethod
    def update(task_id, **kwargs):
        task = DtReferenceTask.query.get(task_id)
        if not task:
            return None

        field_map = {
            'name': 'name',
            'divisionId': 'division_id',
            'testItem': 'test_item',
            'testItemDetail': 'test_item_detail',
            'category': 'category',
            'productFamily': 'product_family',
            'year': 'year',
            'status': 'status',
            'connectedDtTask': 'connected_dt_task',
            'description': 'description',
            'order': 'order',
        }

        for camel, snake in field_map.items():
            if camel in kwargs:
                setattr(task, snake, kwargs[camel])

        if 'connectedDtTask' in kwargs:
            flag_modified(task, 'connected_dt_task')
        if 'productFamily' in kwargs:
            flag_modified(task, 'product_family')

        db.session.commit()
        return task

    @staticmethod
    def delete(task_id):
        task = DtReferenceTask.query.get(task_id)
        if not task:
            return False
        db.session.delete(task)
        db.session.commit()
        return True
