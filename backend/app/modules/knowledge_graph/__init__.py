"""
Knowledge Graph Module
"""
from flask import Blueprint

bp = Blueprint('knowledge_graph', __name__)

from app.modules.knowledge_graph import routes
