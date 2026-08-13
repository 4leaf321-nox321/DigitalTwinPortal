"""
Tech Radar Module
"""
from flask import Blueprint

bp = Blueprint('tech_radar', __name__)

from app.modules.tech_radar import routes
