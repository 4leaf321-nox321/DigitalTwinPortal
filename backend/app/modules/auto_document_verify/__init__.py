from flask import Blueprint

bp = Blueprint('auto_document_verify', __name__)

from app.modules.auto_document_verify import routes
