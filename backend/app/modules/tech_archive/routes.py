"""
Tech Archive Routes
"""
from flask import request
from app.modules.tech_archive import bp
from app.shared.responses import success_response


@bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return success_response({'status': 'healthy', 'module': 'tech-archive'})


@bp.route('/archives', methods=['GET'])
def get_archives():
    """Get all archives."""
    # TODO: Implement with database
    return success_response([])
