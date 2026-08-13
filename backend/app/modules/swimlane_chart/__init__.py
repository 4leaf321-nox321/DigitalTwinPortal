"""
Swimlane Chart Module
"""
from flask import Blueprint

bp = Blueprint('swimlane_chart', __name__)

from app.modules.swimlane_chart import routes
