"""
Meeting Management Module
협의체/회의체/보고 관리
"""
from flask import Blueprint

bp = Blueprint('meeting_management', __name__)

from app.modules.meeting_management import routes
