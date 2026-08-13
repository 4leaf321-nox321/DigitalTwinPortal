"""
DX 부문 KPI 관리 Module
"""
from flask import Blueprint

bp = Blueprint('dx_kpi_management', __name__)

from app.modules.dx_kpi_management import routes
