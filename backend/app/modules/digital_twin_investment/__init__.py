"""
Digital Twin Investment Module
디지털 트윈 투자 현황
"""
from flask import Blueprint

bp = Blueprint('digital_twin_investment', __name__)

from app.modules.digital_twin_investment import routes  # noqa: E402,F401
