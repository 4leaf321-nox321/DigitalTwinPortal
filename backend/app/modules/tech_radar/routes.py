"""
Tech Radar Routes
"""
from flask import request
from app.modules.tech_radar import bp
from app.shared.responses import success_response


@bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return success_response({'status': 'healthy', 'module': 'tech-radar'})


@bp.route('/technologies', methods=['GET'])
def get_technologies():
    """Get all technologies."""
    # TODO: Implement with database
    return success_response([])
