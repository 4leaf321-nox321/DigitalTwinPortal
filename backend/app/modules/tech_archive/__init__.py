"""
Tech Archive Module
"""
from flask import Blueprint

bp = Blueprint('tech_archive', __name__)

from app.modules.tech_archive import routes
