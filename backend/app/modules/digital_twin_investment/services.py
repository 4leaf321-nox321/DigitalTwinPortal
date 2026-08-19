"""
Digital Twin Investment Services
"""
from app.extensions import db
from app.modules.digital_twin_investment.models import Investment

# 프론트(camelCase) ↔ 모델(snake_case) 대응. 여기 없는 키는 무시한다.
FIELD_MAP = {
    'name': 'name',
    'division': 'division',
    'process': 'process',
    'department': 'department',
    'year': 'year',
    'planAmount': 'plan_amount',
    'actualAmount': 'actual_amount',
    'category1': 'category1',
    'category2': 'category2',
    'order': 'order',
}


def _to_number(value, cast, default=None):
    """빈 문자열/None 은 default 로, 숫자로 못 읽는 값도 default 로."""
    if value is None or value == '':
        return default
    try:
        return cast(value)
    except (TypeError, ValueError):
        return default


def _map_fields(kwargs):
    """요청 본문을 모델 컬럼 dict 으로 옮긴다."""
    mapped = {}
    for camel, snake in FIELD_MAP.items():
        if camel not in kwargs:
            continue
        value = kwargs[camel]
        if snake == 'year':
            value = _to_number(value, int)
        elif snake in ('plan_amount', 'actual_amount'):
            value = _to_number(value, float, 0)
        elif snake == 'order':
            value = _to_number(value, int, 0)
        mapped[snake] = value
    return mapped


class InvestmentService:
    """투자 건 CRUD 서비스"""

    @staticmethod
    def get_all(year=None, division=None, category1=None):
        query = Investment.query
        if year:
            query = query.filter_by(year=_to_number(year, int))
        if division:
            query = query.filter_by(division=division)
        if category1:
            query = query.filter_by(category1=category1)
        return query.order_by(
            Investment.year.desc(), Investment.order, Investment.id
        ).all()

    @staticmethod
    def get_by_id(investment_id):
        return Investment.query.get(investment_id)

    @staticmethod
    def create(commit=True, **kwargs):
        investment = Investment(**_map_fields(kwargs))
        db.session.add(investment)
        if commit:
            db.session.commit()
        return investment

    @staticmethod
    def create_many(items):
        """일괄 등록. 투자명이 빈 행은 건너뛰고, 전부 한 트랜잭션으로 넣는다."""
        created = []
        for item in items:
            if not str(item.get('name') or '').strip():
                continue
            created.append(InvestmentService.create(commit=False, **item))
        db.session.commit()
        return created

    @staticmethod
    def update(investment_id, **kwargs):
        investment = Investment.query.get(investment_id)
        if not investment:
            return None
        for snake, value in _map_fields(kwargs).items():
            setattr(investment, snake, value)
        db.session.commit()
        return investment

    @staticmethod
    def delete(investment_id):
        investment = Investment.query.get(investment_id)
        if not investment:
            return False
        db.session.delete(investment)
        db.session.commit()
        return True
