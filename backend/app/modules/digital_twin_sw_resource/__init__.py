"""
Digital Twin SW Resource Module
전사 디지털 트윈 S/W 자원 정보
"""
from flask import Blueprint

bp = Blueprint('digital_twin_sw_resource', __name__)

from app.modules.digital_twin_sw_resource import routes
