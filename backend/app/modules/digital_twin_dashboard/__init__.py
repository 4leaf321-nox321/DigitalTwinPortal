"""
Digital Twin Dashboard Module
"""
from flask import Blueprint

bp = Blueprint('digital_twin_dashboard', __name__)

from app.modules.digital_twin_dashboard import routes
from app.modules.digital_twin_dashboard import models
from app.modules.digital_twin_dashboard import models_v2   # Phase 2 정규화 테이블 (dt2_*)

# Phase 3 — 과제별 쓰기 API. URL 이 /api/dt-v2/* 라 기존 화면과 겹치지 않는다.
from app.modules.digital_twin_dashboard.routes_v2 import bp_v2
