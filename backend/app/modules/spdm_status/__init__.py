"""
SPDM Status Module
SPDM 현황 관리 - 이슈 공유 및 추적
"""
from flask import Blueprint

bp = Blueprint('spdm_status', __name__)

from app.modules.spdm_status import routes
