"""
Digital Twin Investment Services
"""
from app.extensions import db
from app.modules.digital_twin_investment.models import Investment, InvestmentChange

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


# ─────────────────────────────────────────────────────────────────────────────
# 변경 이력
#
# 값을 바꾸는 길은 전부 이 서비스를 지난다(routes 는 여기만 부른다). 그래서 이력을
# 여기서 남긴다 — 화면이 늘어나도 남기는 것을 잊을 자리가 생기지 않는다.
# ─────────────────────────────────────────────────────────────────────────────

def _log(investment, action, actor_id, field=None, before=None, after=None, snapshot=None):
    db.session.add(InvestmentChange(
        investment_id=investment.id,
        investment_name=investment.name,
        action=action,
        field=field,
        before_value=before,
        after_value=after,
        snapshot=snapshot,
        actor_user_id=actor_id,
        source='ui',
    ))


def _log_created(investment, actor_id):
    _log(investment, 'create', actor_id, snapshot=investment.to_dict())


def _log_deleted(investment, actor_id):
    # 지우기 **직전** 의 모습을 통째로 담는다. 행이 사라지면 이것만 남는다.
    _log(investment, 'delete', actor_id, snapshot=investment.to_dict())


def _log_updated(investment, actor_id, before_dict):
    """바뀐 필드마다 한 행. 값이 그대로면 아무것도 남기지 않는다."""
    after_dict = investment.to_dict()
    changed = 0
    for camel in FIELD_MAP:
        before = before_dict.get(camel)
        after = after_dict.get(camel)
        if before == after:
            continue
        _log(investment, 'update', actor_id, field=camel, before=before, after=after)
        changed += 1
    return changed


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
    def create(commit=True, actor_id=None, **kwargs):
        investment = Investment(**_map_fields(kwargs))
        db.session.add(investment)
        # 이력에 넣을 id 가 필요하다. flush 면 커밋 없이 id 가 잡힌다.
        db.session.flush()
        _log_created(investment, actor_id)
        if commit:
            db.session.commit()
        return investment

    @staticmethod
    def create_many(items, actor_id=None):
        """일괄 등록. 투자명이 빈 행은 건너뛰고, 전부 한 트랜잭션으로 넣는다."""
        created = []
        for item in items:
            if not str(item.get('name') or '').strip():
                continue
            created.append(InvestmentService.create(commit=False, actor_id=actor_id, **item))
        db.session.commit()
        return created

    @staticmethod
    def update(investment_id, actor_id=None, **kwargs):
        investment = Investment.query.get(investment_id)
        if not investment:
            return None
        # 고치기 **전** 모습을 떠 둔다. 뒤에 바뀐 필드를 가려내는 데 쓴다.
        before_dict = investment.to_dict()
        for snake, value in _map_fields(kwargs).items():
            setattr(investment, snake, value)
        db.session.flush()
        _log_updated(investment, actor_id, before_dict)
        db.session.commit()
        return investment

    @staticmethod
    def delete(investment_id, actor_id=None):
        investment = Investment.query.get(investment_id)
        if not investment:
            return False
        _log_deleted(investment, actor_id)
        db.session.delete(investment)
        db.session.commit()
        return True

    @staticmethod
    def restore(change_id, actor_id=None):
        """
        삭제 이력의 스냅샷으로 투자 건을 되살린다.

        물리 삭제라 원래 행은 없다. 그래서 **새 건으로 등록**한다 — id 는 새로 붙고
        이력에는 「등록」이 한 줄 더 쌓인다. 되살렸다는 사실은 삭제 행에 표시해 두어
        같은 삭제를 두 번 되살릴 수 없게 한다.

        돌려주는 값: (투자건, 오류메시지). 못 되살리면 (None, 이유).
        """
        change = InvestmentChange.query.get(change_id)
        if not change:
            return None, '이력을 찾을 수 없습니다'
        if change.action != 'delete':
            return None, '삭제 이력만 되살릴 수 있습니다'
        if change.restored_investment_id:
            return None, f'이미 되살린 이력입니다 (투자 id {change.restored_investment_id})'
        if not change.snapshot:
            return None, '되살릴 값이 남아 있지 않습니다'

        # 스냅샷에는 id·시각도 들어 있다. 되살릴 때 쓰는 것은 **입력 필드뿐**이다.
        payload = {k: v for k, v in change.snapshot.items() if k in FIELD_MAP}
        investment = InvestmentService.create(commit=False, actor_id=actor_id, **payload)
        change.restored_investment_id = investment.id
        db.session.commit()
        return investment, None

    @staticmethod
    def history(investment_id=None, limit=200):
        """변경 이력. 건을 지정하지 않으면 **지워진 건까지 포함해** 전부."""
        query = InvestmentChange.query
        if investment_id is not None:
            query = query.filter_by(investment_id=investment_id)
        return (query
                .order_by(InvestmentChange.created_at.desc(), InvestmentChange.id.desc())
                .limit(limit).all())
