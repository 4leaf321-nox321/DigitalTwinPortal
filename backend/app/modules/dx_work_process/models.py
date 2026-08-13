"""
DX Work Process Models
"""
from app.extensions import db
from app.shared.models import BaseModel


class Graph(BaseModel):
    """Knowledge Graph model."""
    __tablename__ = 'dx_graphs'

    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    is_public = db.Column(db.Boolean, default=False)  # 공용 데이터 여부
    settings = db.Column(db.JSON, default={})  # Node types, edge types settings

    # Relationships
    user = db.relationship('User', backref=db.backref('dx_graphs', lazy='dynamic'))
    nodes = db.relationship('Node', backref='graph', lazy='dynamic', cascade='all, delete-orphan')
    edges = db.relationship('Edge', backref='graph', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self, include_data=False):
        result = super().to_dict()
        if include_data:
            result['nodes'] = [node.to_dict() for node in self.nodes]
            result['edges'] = [edge.to_dict() for edge in self.edges]
        return result


class Node(BaseModel):
    """Graph Node model."""
    __tablename__ = 'dx_nodes'

    graph_id = db.Column(db.Integer, db.ForeignKey('dx_graphs.id'), nullable=False)
    node_id = db.Column(db.String(100), nullable=False)  # Frontend node ID
    label = db.Column(db.String(255), nullable=False)
    type = db.Column(db.String(100), default='unknown')
    properties = db.Column(db.JSON, default={})
    x = db.Column(db.Float)  # Position X
    y = db.Column(db.Float)  # Position Y

    __table_args__ = (
        db.UniqueConstraint('graph_id', 'node_id', name='unique_graph_node'),
    )

    def to_dict(self):
        return {
            'id': self.node_id,
            'label': self.label,
            'type': self.type,
            'properties': self.properties or {},
            'x': self.x,
            'y': self.y
        }


class Edge(BaseModel):
    """Graph Edge model."""
    __tablename__ = 'dx_edges'

    graph_id = db.Column(db.Integer, db.ForeignKey('dx_graphs.id'), nullable=False)
    edge_id = db.Column(db.String(100), nullable=False)  # Frontend edge ID
    from_node = db.Column(db.String(100), nullable=False)
    to_node = db.Column(db.String(100), nullable=False)
    label = db.Column(db.String(255))
    type = db.Column(db.String(100), default='unknown')
    properties = db.Column(db.JSON, default={})

    __table_args__ = (
        db.UniqueConstraint('graph_id', 'edge_id', name='unique_graph_edge'),
    )

    def to_dict(self):
        return {
            'id': self.edge_id,
            'from': self.from_node,
            'to': self.to_node,
            'label': self.label,
            'type': self.type,
            'properties': self.properties or {}
        }


class NodeType(BaseModel):
    """Node Type Configuration model."""
    __tablename__ = 'dx_node_types'

    graph_id = db.Column(db.Integer, db.ForeignKey('dx_graphs.id'), nullable=False)
    type_id = db.Column(db.String(100), nullable=False)
    label = db.Column(db.String(255), nullable=False)
    color = db.Column(db.String(50))
    icon = db.Column(db.String(100))

    __table_args__ = (
        db.UniqueConstraint('graph_id', 'type_id', name='unique_graph_node_type'),
    )


class EdgeType(BaseModel):
    """Edge Type Configuration model."""
    __tablename__ = 'dx_edge_types'

    graph_id = db.Column(db.Integer, db.ForeignKey('dx_graphs.id'), nullable=False)
    type_id = db.Column(db.String(100), nullable=False)
    label = db.Column(db.String(255), nullable=False)
    default_edge_label = db.Column(db.String(255))
    color = db.Column(db.String(50))

    __table_args__ = (
        db.UniqueConstraint('graph_id', 'type_id', name='unique_graph_edge_type'),
    )
