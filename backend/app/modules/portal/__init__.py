"""
메인 화면(포털) 설정.
"""
from flask import Blueprint

bp = Blueprint('portal', __name__)

from app.modules.portal import routes    # noqa: E402,F401
