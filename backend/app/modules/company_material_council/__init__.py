"""
Company Material Council Module
전사 물성 협의체 모듈
"""

from flask import Blueprint

bp = Blueprint('company_material_council', __name__)

from app.modules.company_material_council import routes
