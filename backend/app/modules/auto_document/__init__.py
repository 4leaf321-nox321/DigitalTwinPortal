from flask import Blueprint

bp = Blueprint('auto_document', __name__)

from app.modules.auto_document import routes
