"""
Digital Twin Reference Module
개발 디지털 트윈 로드맵 정보 - 과제 관리
"""
from flask import Blueprint

bp = Blueprint('digital_twin_reference', __name__)

from app.modules.digital_twin_reference import routes
