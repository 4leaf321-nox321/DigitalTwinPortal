"""
DX Work Process Services
"""
from app.extensions import db
from app.modules.dx_work_process.models import Graph, Node, Edge, NodeType, EdgeType


class GraphService:
    """Service for Graph operations."""

    @staticmethod
    def get_all():
        """Get all graphs."""
        return Graph.query.all()

    @staticmethod
    def get_all_by_user(user_id):
        """Get all graphs for a specific user."""
        return Graph.query.filter_by(user_id=user_id).order_by(Graph.updated_at.desc()).all()

    @staticmethod
    def get_all_public():
        """Get all public graphs."""
        return Graph.query.filter_by(is_public=True).order_by(Graph.updated_at.desc()).all()

    @staticmethod
    def get_public_by_id(graph_id, include_data=False):
        """Get a public graph by ID."""
        graph = Graph.query.filter_by(id=graph_id, is_public=True).first()
        if graph and include_data:
            return graph.to_dict(include_data=True)
        return graph

    @staticmethod
    def get_by_id(graph_id, include_data=False):
        """Get graph by ID."""
        graph = Graph.query.get(graph_id)
        if graph and include_data:
            return graph.to_dict(include_data=True)
        return graph

    @staticmethod
    def get_by_id_and_user(graph_id, user_id, include_data=False):
        """Get graph by ID for a specific user."""
        graph = Graph.query.filter_by(id=graph_id, user_id=user_id).first()
        if graph and include_data:
            return graph.to_dict(include_data=True)
        return graph

    @staticmethod
    def create(name, user_id, description=None, settings=None, is_public=False):
        """Create a new graph."""
        graph = Graph(
            name=name,
            user_id=user_id,
            description=description,
            settings=settings or {},
            is_public=is_public
        )
        db.session.add(graph)
        db.session.commit()
        return graph

    @staticmethod
    def update(graph_id, **kwargs):
        """Update a graph."""
        graph = Graph.query.get(graph_id)
        if graph:
            graph.update(**kwargs)
            db.session.commit()
        return graph

    @staticmethod
    def delete(graph_id):
        """Delete a graph."""
        graph = Graph.query.get(graph_id)
        if graph:
            db.session.delete(graph)
            db.session.commit()
            return True
        return False

    @staticmethod
    def save_graph_data(graph_id, nodes_data, edges_data):
        """Save complete graph data (nodes and edges)."""
        graph = Graph.query.get(graph_id)
        if not graph:
            return None

        # Clear existing nodes and edges
        Node.query.filter_by(graph_id=graph_id).delete()
        Edge.query.filter_by(graph_id=graph_id).delete()

        # Add new nodes
        for node_data in nodes_data:
            node = Node(
                graph_id=graph_id,
                node_id=node_data['id'],
                label=node_data.get('label', ''),
                type=node_data.get('type', 'unknown'),
                properties=node_data.get('properties', {}),
                x=node_data.get('x'),
                y=node_data.get('y')
            )
            db.session.add(node)

        # Add new edges
        for edge_data in edges_data:
            edge = Edge(
                graph_id=graph_id,
                edge_id=edge_data['id'],
                from_node=edge_data['from'],
                to_node=edge_data['to'],
                label=edge_data.get('label', ''),
                type=edge_data.get('type', 'unknown'),
                properties=edge_data.get('properties', {})
            )
            db.session.add(edge)

        db.session.commit()
        return graph.to_dict(include_data=True)


class NodeService:
    """Service for Node operations."""

    @staticmethod
    def get_by_graph(graph_id):
        """Get all nodes for a graph."""
        return Node.query.filter_by(graph_id=graph_id).all()

    @staticmethod
    def create(graph_id, node_id, label, node_type='unknown', properties=None, x=None, y=None):
        """Create a new node."""
        node = Node(
            graph_id=graph_id,
            node_id=node_id,
            label=label,
            type=node_type,
            properties=properties or {},
            x=x,
            y=y
        )
        db.session.add(node)
        db.session.commit()
        return node

    @staticmethod
    def update(graph_id, node_id, **kwargs):
        """Update a node."""
        node = Node.query.filter_by(graph_id=graph_id, node_id=node_id).first()
        if node:
            if 'type' in kwargs:
                kwargs['type'] = kwargs.pop('type')
            node.update(**kwargs)
            db.session.commit()
        return node

    @staticmethod
    def delete(graph_id, node_id):
        """Delete a node."""
        node = Node.query.filter_by(graph_id=graph_id, node_id=node_id).first()
        if node:
            db.session.delete(node)
            db.session.commit()
            return True
        return False


class EdgeService:
    """Service for Edge operations."""

    @staticmethod
    def get_by_graph(graph_id):
        """Get all edges for a graph."""
        return Edge.query.filter_by(graph_id=graph_id).all()

    @staticmethod
    def create(graph_id, edge_id, from_node, to_node, label='', edge_type='unknown', properties=None):
        """Create a new edge."""
        edge = Edge(
            graph_id=graph_id,
            edge_id=edge_id,
            from_node=from_node,
            to_node=to_node,
            label=label,
            type=edge_type,
            properties=properties or {}
        )
        db.session.add(edge)
        db.session.commit()
        return edge

    @staticmethod
    def update(graph_id, edge_id, **kwargs):
        """Update an edge."""
        edge = Edge.query.filter_by(graph_id=graph_id, edge_id=edge_id).first()
        if edge:
            if 'type' in kwargs:
                kwargs['type'] = kwargs.pop('type')
            edge.update(**kwargs)
            db.session.commit()
        return edge

    @staticmethod
    def delete(graph_id, edge_id):
        """Delete an edge."""
        edge = Edge.query.filter_by(graph_id=graph_id, edge_id=edge_id).first()
        if edge:
            db.session.delete(edge)
            db.session.commit()
            return True
        return False
