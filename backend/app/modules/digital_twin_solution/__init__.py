"""
Digital Twin Solution Module
"""
from flask import Blueprint

bp = Blueprint('digital_twin_solution', __name__)

from app.modules.digital_twin_solution import routes
