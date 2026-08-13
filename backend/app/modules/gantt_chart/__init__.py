"""
Gantt Chart Module
"""
from flask import Blueprint

bp = Blueprint('gantt_chart', __name__)

from app.modules.gantt_chart import routes
