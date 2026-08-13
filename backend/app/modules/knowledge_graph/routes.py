"""
Knowledge Graph Routes
"""
from flask import request
from app.modules.knowledge_graph import bp
from app.shared.responses import success_response


@bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return success_response({'status': 'healthy', 'module': 'knowledge-graph'})


@bp.route('/graphs', methods=['GET'])
def get_graphs():
    """Get all graphs."""
    # TODO: Implement with database
    return success_response([])
