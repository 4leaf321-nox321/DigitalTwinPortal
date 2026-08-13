"""
DX Work Process Routes
"""
from flask import request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.modules.dx_work_process import bp
from app.modules.dx_work_process.services import GraphService, NodeService, EdgeService
from app.shared.responses import success_response, error_response, created_response, not_found_response
from app.shared.utils import get_request_json, validate_required_fields


# ============== Graph Routes ==============

@bp.route('/graphs', methods=['GET'])
def get_graphs():
    """Get all graphs (public)."""
    graphs = GraphService.get_all()
    return success_response([g.to_dict() for g in graphs])


@bp.route('/my-graphs', methods=['GET'])
@jwt_required()
def get_my_graphs():
    """Get all graphs for the current user."""
    user_id = int(get_jwt_identity())
    graphs = GraphService.get_all_by_user(user_id)
    return success_response([g.to_dict() for g in graphs])


@bp.route('/public-graphs', methods=['GET'])
def get_public_graphs():
    """Get all public graphs."""
    graphs = GraphService.get_all_public()
    return success_response([g.to_dict() for g in graphs])


@bp.route('/public-graphs/<int:graph_id>', methods=['GET'])
def get_public_graph(graph_id):
    """Get a single public graph with optional data."""
    include_data = request.args.get('include_data', 'false').lower() == 'true'
    graph = GraphService.get_public_by_id(graph_id, include_data=include_data)
    if not graph:
        return not_found_response('Graph not found')
    if isinstance(graph, dict):
        return success_response(graph)
    return success_response(graph.to_dict())


@bp.route('/graphs/<int:graph_id>', methods=['GET'])
def get_graph(graph_id):
    """Get a single graph with optional data."""
    include_data = request.args.get('include_data', 'false').lower() == 'true'
    graph = GraphService.get_by_id(graph_id, include_data=include_data)
    if not graph:
        return not_found_response('Graph not found')
    if isinstance(graph, dict):
        return success_response(graph)
    return success_response(graph.to_dict())


@bp.route('/my-graphs/<int:graph_id>', methods=['GET'])
@jwt_required()
def get_my_graph(graph_id):
    """Get a single graph for the current user with optional data."""
    user_id = int(get_jwt_identity())
    include_data = request.args.get('include_data', 'false').lower() == 'true'
    graph = GraphService.get_by_id_and_user(graph_id, user_id, include_data=include_data)
    if not graph:
        return not_found_response('Graph not found')
    if isinstance(graph, dict):
        return success_response(graph)
    return success_response(graph.to_dict())


@bp.route('/graphs', methods=['POST'])
def create_graph():
    """Create a new graph (legacy, without user)."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['name'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    graph = GraphService.create(
        name=data['name'],
        user_id=data.get('user_id', 1),  # Default user_id for legacy
        description=data.get('description'),
        settings=data.get('settings')
    )
    return created_response(graph.to_dict())


@bp.route('/my-graphs', methods=['POST'])
@jwt_required()
def create_my_graph():
    """Create a new graph for the current user."""
    user_id = int(get_jwt_identity())
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['name'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    graph = GraphService.create(
        name=data['name'],
        user_id=user_id,
        description=data.get('description'),
        settings=data.get('settings'),
        is_public=data.get('is_public', False)
    )
    return created_response(graph.to_dict())


@bp.route('/graphs/<int:graph_id>', methods=['PUT'])
def update_graph(graph_id):
    """Update a graph."""
    data = get_request_json()
    graph = GraphService.update(graph_id, **data)
    if not graph:
        return not_found_response('Graph not found')
    return success_response(graph.to_dict())


@bp.route('/my-graphs/<int:graph_id>', methods=['PUT'])
@jwt_required()
def update_my_graph(graph_id):
    """Update a graph for the current user."""
    user_id = int(get_jwt_identity())
    # Verify ownership
    graph = GraphService.get_by_id_and_user(graph_id, user_id)
    if not graph:
        return not_found_response('Graph not found')

    data = get_request_json()
    graph = GraphService.update(graph_id, **data)
    return success_response(graph.to_dict())


@bp.route('/graphs/<int:graph_id>', methods=['DELETE'])
def delete_graph(graph_id):
    """Delete a graph."""
    if GraphService.delete(graph_id):
        return success_response(message='Graph deleted successfully')
    return not_found_response('Graph not found')


@bp.route('/my-graphs/<int:graph_id>', methods=['DELETE'])
@jwt_required()
def delete_my_graph(graph_id):
    """Delete a graph for the current user."""
    user_id = int(get_jwt_identity())
    # Verify ownership
    graph = GraphService.get_by_id_and_user(graph_id, user_id)
    if not graph:
        return not_found_response('Graph not found')

    if GraphService.delete(graph_id):
        return success_response(message='Graph deleted successfully')
    return not_found_response('Graph not found')


@bp.route('/graphs/<int:graph_id>/data', methods=['POST'])
def save_graph_data(graph_id):
    """Save complete graph data (nodes and edges)."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['nodes', 'edges'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    result = GraphService.save_graph_data(
        graph_id,
        data['nodes'],
        data['edges']
    )
    if not result:
        return not_found_response('Graph not found')
    return success_response(result)


@bp.route('/my-graphs/<int:graph_id>/data', methods=['POST'])
@jwt_required()
def save_my_graph_data(graph_id):
    """Save complete graph data for the current user."""
    user_id = int(get_jwt_identity())
    # Verify ownership
    graph = GraphService.get_by_id_and_user(graph_id, user_id)
    if not graph:
        return not_found_response('Graph not found')

    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['nodes', 'edges'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    # Also update settings if provided
    if 'settings' in data:
        GraphService.update(graph_id, settings=data['settings'])

    result = GraphService.save_graph_data(
        graph_id,
        data['nodes'],
        data['edges']
    )
    if not result:
        return not_found_response('Graph not found')
    return success_response(result)


# ============== Node Routes ==============

@bp.route('/graphs/<int:graph_id>/nodes', methods=['GET'])
def get_nodes(graph_id):
    """Get all nodes for a graph."""
    nodes = NodeService.get_by_graph(graph_id)
    return success_response([n.to_dict() for n in nodes])


@bp.route('/graphs/<int:graph_id>/nodes', methods=['POST'])
def create_node(graph_id):
    """Create a new node."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['id', 'label'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    node = NodeService.create(
        graph_id=graph_id,
        node_id=data['id'],
        label=data['label'],
        node_type=data.get('type', 'unknown'),
        properties=data.get('properties'),
        x=data.get('x'),
        y=data.get('y')
    )
    return created_response(node.to_dict())


@bp.route('/graphs/<int:graph_id>/nodes/<node_id>', methods=['PUT'])
def update_node(graph_id, node_id):
    """Update a node."""
    data = get_request_json()
    node = NodeService.update(graph_id, node_id, **data)
    if not node:
        return not_found_response('Node not found')
    return success_response(node.to_dict())


@bp.route('/graphs/<int:graph_id>/nodes/<node_id>', methods=['DELETE'])
def delete_node(graph_id, node_id):
    """Delete a node."""
    if NodeService.delete(graph_id, node_id):
        return success_response(message='Node deleted successfully')
    return not_found_response('Node not found')


# ============== Edge Routes ==============

@bp.route('/graphs/<int:graph_id>/edges', methods=['GET'])
def get_edges(graph_id):
    """Get all edges for a graph."""
    edges = EdgeService.get_by_graph(graph_id)
    return success_response([e.to_dict() for e in edges])


@bp.route('/graphs/<int:graph_id>/edges', methods=['POST'])
def create_edge(graph_id):
    """Create a new edge."""
    data = get_request_json()
    is_valid, missing = validate_required_fields(data, ['id', 'from', 'to'])
    if not is_valid:
        return error_response(f'Missing required fields: {missing}')

    edge = EdgeService.create(
        graph_id=graph_id,
        edge_id=data['id'],
        from_node=data['from'],
        to_node=data['to'],
        label=data.get('label', ''),
        edge_type=data.get('type', 'unknown'),
        properties=data.get('properties')
    )
    return created_response(edge.to_dict())


@bp.route('/graphs/<int:graph_id>/edges/<edge_id>', methods=['PUT'])
def update_edge(graph_id, edge_id):
    """Update an edge."""
    data = get_request_json()
    edge = EdgeService.update(graph_id, edge_id, **data)
    if not edge:
        return not_found_response('Edge not found')
    return success_response(edge.to_dict())


@bp.route('/graphs/<int:graph_id>/edges/<edge_id>', methods=['DELETE'])
def delete_edge(graph_id, edge_id):
    """Delete an edge."""
    if EdgeService.delete(graph_id, edge_id):
        return success_response(message='Edge deleted successfully')
    return not_found_response('Edge not found')


# ============== Health Check ==============

@bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return success_response({'status': 'healthy', 'module': 'dx-work-process'})
