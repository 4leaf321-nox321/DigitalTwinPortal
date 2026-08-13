"""
DX Work Process (Knowledge Graph) Module
"""
from flask import Blueprint

bp = Blueprint('dx_work_process', __name__)

from app.modules.dx_work_process import routes
