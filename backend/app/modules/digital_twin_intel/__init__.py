"""
Digital Twin Intel Module
디지털 트윈 기술정보 — 바깥 소식과 기술 레이더를 한자리에서.
"""
from flask import Blueprint

bp = Blueprint('digital_twin_intel', __name__)

from app.modules.digital_twin_intel import routes  # noqa: E402,F401
