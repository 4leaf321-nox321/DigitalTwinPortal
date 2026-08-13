"""
Digital Twin Task Management Module
"""
from flask import Blueprint

bp = Blueprint('digital_twin_task_management', __name__)

from app.modules.digital_twin_task_management import routes  # noqa
