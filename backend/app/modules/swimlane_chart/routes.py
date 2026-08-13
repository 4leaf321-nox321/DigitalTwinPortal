"""
Swimlane Chart Routes
"""
from flask import request
from app.modules.swimlane_chart import bp
from app.shared.responses import success_response


@bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return success_response({'status': 'healthy', 'module': 'swimlane-chart'})


@bp.route('/processes', methods=['GET'])
def get_processes():
    """Get all processes."""
    # TODO: Implement with database
    return success_response([])
