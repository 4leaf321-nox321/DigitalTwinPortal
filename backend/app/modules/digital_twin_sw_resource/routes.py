"""
Digital Twin SW Resource Routes
전사 디지털 트윈 S/W 자원 정보 API
"""
from flask import request
from app.modules.digital_twin_sw_resource import bp
from app.modules.digital_twin_sw_resource.services import SwResourceService
from app.shared.responses import (
    success_response, error_response, created_response, not_found_response
)
from app.shared.utils import get_request_json, validate_required_fields


@bp.route('/resources', methods=['GET'])
def get_resources():
    """Get all SW resources, optionally filtered."""
    category = request.args.get('category')
    division = request.args.get('division')
    resources = SwResourceService.get_all(category=category, division=division)
    return success_response([r.to_dict() for r in resources])


@bp.route('/resources', methods=['POST'])
def create_resource():
    """Create a new SW resource."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['name'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    resource = SwResourceService.create(**data)
    return created_response(resource.to_dict())


@bp.route('/resources/bulk', methods=['POST'])
def create_bulk_resources():
    """Create multiple SW resources at once."""
    data = get_request_json()
    items = data.get('resources', [])
    if not items:
        return error_response('No resources provided')

    created = []
    for item in items:
        if not item.get('name', '').strip():
            continue
        resource = SwResourceService.create(**item)
        created.append(resource)

    return created_response([r.to_dict() for r in created])


@bp.route('/resources/<int:resource_id>', methods=['PUT'])
def update_resource(resource_id):
    """Update a SW resource."""
    data = get_request_json()
    resource = SwResourceService.update(resource_id, **data)
    if not resource:
        return not_found_response('Resource not found')
    return success_response(resource.to_dict())


@bp.route('/resources/<int:resource_id>', methods=['DELETE'])
def delete_resource(resource_id):
    """Delete a SW resource."""
    if SwResourceService.delete(resource_id):
        return success_response(message='Resource deleted successfully')
    return not_found_response('Resource not found')
