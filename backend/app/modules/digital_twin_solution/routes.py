"""
Digital Twin Solution Routes
"""
from flask import request
from app.modules.digital_twin_solution import bp
from app.shared.responses import success_response


@bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return success_response({'status': 'healthy', 'module': 'digital-twin-solution'})


@bp.route('/technologies', methods=['GET'])
def get_technologies():
    """Get all technologies."""
    # TODO: Implement with database
    return success_response([])
