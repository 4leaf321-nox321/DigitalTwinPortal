# -*- coding: utf-8 -*-
"""개발 디지털 트윈 성숙도 — 시험 하나에 대해 시뮬레이션이 어디까지 왔는가.

계획: frontend/src/modules/dev-dt-maturity/PLAN.md
정의의 단일 출처: definitions.py (부문 · 축 · 사다리 · 정확도 규칙 · 가져오기 틀)
판단: services.py · permissions.py — 라우트는 배선만
"""
from flask import Blueprint

bp = Blueprint('dev_dt_maturity', __name__)

from app.modules.dev_dt_maturity import routes  # noqa: E402,F401
