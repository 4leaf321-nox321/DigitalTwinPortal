"""
Common Utility Functions
"""
from flask import request, current_app


def paginate(query, page=None, per_page=None):
    """
    Paginate a SQLAlchemy query.

    Args:
        query: SQLAlchemy query object
        page: Page number (1-indexed)
        per_page: Items per page

    Returns:
        dict with items, pagination info
    """
    if page is None:
        page = request.args.get('page', 1, type=int)
    if per_page is None:
        per_page = request.args.get('per_page', current_app.config['DEFAULT_PAGE_SIZE'], type=int)

    # Limit per_page to MAX_PAGE_SIZE
    per_page = min(per_page, current_app.config['MAX_PAGE_SIZE'])

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return {
        'items': [item.to_dict() for item in pagination.items],
        'pagination': {
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total_pages': pagination.pages,
            'total_items': pagination.total,
            'has_next': pagination.has_next,
            'has_prev': pagination.has_prev
        }
    }


def to_dict(model_list):
    """Convert a list of models to list of dictionaries."""
    return [item.to_dict() for item in model_list]


def get_request_json():
    """Get JSON data from request with error handling."""
    data = request.get_json(silent=True)
    if data is None:
        data = {}
    return data


def validate_required_fields(data, required_fields):
    """
    Validate that required fields are present in data.

    Args:
        data: Dictionary to validate
        required_fields: List of required field names

    Returns:
        tuple: (is_valid, missing_fields)
    """
    missing = [field for field in required_fields if field not in data or data[field] is None]
    return len(missing) == 0, missing
