"""
Office Management Module - Weekly Report Management
"""
from flask import Blueprint

bp = Blueprint('office_management', __name__)

from app.modules.office_management import routes
