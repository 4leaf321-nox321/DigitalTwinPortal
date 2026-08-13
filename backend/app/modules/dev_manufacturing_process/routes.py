"""
Dev Manufacturing Process Routes
프로세스 다이어그램 저장/불러오기 API
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from app.extensions import db
from .models import ProcessDiagramData

bp = Blueprint('dev_manufacturing_process', __name__, url_prefix='/api/dev-manufacturing-process')


def get_current_user_id():
    """현재 로그인한 사용자 ID 반환 (로그인하지 않은 경우 None)"""
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        return int(identity) if identity else None
    except:
        return None


@bp.route('/diagrams', methods=['GET'])
def get_diagrams():
    """저장된 다이어그램 목록 조회 (전체)"""
    try:
        diagrams = ProcessDiagramData.query.order_by(ProcessDiagramData.updated_at.desc()).all()
        return jsonify({
            'success': True,
            'data': [d.to_list_dict() for d in diagrams]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/diagrams/my', methods=['GET'])
@jwt_required()
def get_my_diagrams():
    """내 다이어그램 목록 조회"""
    try:
        user_id = int(get_jwt_identity())
        diagrams = ProcessDiagramData.query.filter_by(user_id=user_id).order_by(ProcessDiagramData.updated_at.desc()).all()
        return jsonify({
            'success': True,
            'data': [d.to_list_dict() for d in diagrams]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/diagrams/public', methods=['GET'])
def get_public_diagrams():
    """공용 다이어그램 목록 조회"""
    try:
        diagrams = ProcessDiagramData.query.filter_by(is_public=True).order_by(ProcessDiagramData.updated_at.desc()).all()
        return jsonify({
            'success': True,
            'data': [d.to_list_dict() for d in diagrams]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/diagrams', methods=['POST'])
def create_diagram():
    """새 다이어그램 저장"""
    try:
        data = request.get_json()
        user_id = get_current_user_id()

        if not data.get('name'):
            return jsonify({
                'success': False,
                'message': '저장 이름을 입력해주세요.'
            }), 400

        diagram = ProcessDiagramData(
            name=data.get('name'),
            description=data.get('description', ''),
            nodes=data.get('nodes', []),
            edges=data.get('edges', []),
            viewport=data.get('viewport', {}),
            diagram_metadata=data.get('metadata', {}),
            user_id=user_id,
            is_public=data.get('is_public', False),
            created_by=user_id,
            created_by_name=data.get('created_by_name', 'Anonymous'),
            updated_by=user_id,
            updated_by_name=data.get('created_by_name', 'Anonymous')
        )

        db.session.add(diagram)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '다이어그램이 저장되었습니다.',
            'data': diagram.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/diagrams/<int:diagram_id>', methods=['GET'])
def get_diagram(diagram_id):
    """특정 다이어그램 조회"""
    try:
        diagram = ProcessDiagramData.query.get(diagram_id)

        if not diagram:
            return jsonify({
                'success': False,
                'message': '다이어그램을 찾을 수 없습니다.'
            }), 404

        return jsonify({
            'success': True,
            'data': diagram.to_dict()
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/diagrams/<int:diagram_id>', methods=['PUT'])
def update_diagram(diagram_id):
    """다이어그램 수정"""
    try:
        diagram = ProcessDiagramData.query.get(diagram_id)
        user_id = get_current_user_id()

        if not diagram:
            return jsonify({
                'success': False,
                'message': '다이어그램을 찾을 수 없습니다.'
            }), 404

        # 소유자 확인 (소유자가 있는 경우에만)
        # 관리자는 소유자 없는 레거시 데이터 수정 가능
        if diagram.user_id and diagram.user_id != user_id:
            # 관리자 여부 확인
            from app.modules.auth.services import UserService
            current_user = UserService.get_by_id(user_id) if user_id else None
            is_admin = current_user and current_user.is_admin_user()

            if not is_admin:
                return jsonify({
                    'success': False,
                    'message': '수정 권한이 없습니다.'
                }), 403

        data = request.get_json()

        # 소유자가 없는 레거시 데이터를 수정하면 수정한 사람이 소유자가 됨
        if not diagram.user_id and user_id:
            diagram.user_id = user_id
            diagram.created_by = user_id

        if 'name' in data:
            diagram.name = data['name']
        if 'description' in data:
            diagram.description = data['description']
        if 'nodes' in data:
            diagram.nodes = data['nodes']
        if 'edges' in data:
            diagram.edges = data['edges']
        if 'viewport' in data:
            diagram.viewport = data['viewport']
        if 'metadata' in data:
            diagram.diagram_metadata = data['metadata']
        if 'is_public' in data:
            diagram.is_public = data['is_public']
        if 'updated_by_name' in data:
            diagram.updated_by_name = data['updated_by_name']

        diagram.updated_by = user_id

        db.session.commit()

        return jsonify({
            'success': True,
            'message': '다이어그램이 수정되었습니다.',
            'data': diagram.to_dict()
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/diagrams/<int:diagram_id>', methods=['DELETE'])
def delete_diagram(diagram_id):
    """다이어그램 삭제"""
    try:
        diagram = ProcessDiagramData.query.get(diagram_id)
        user_id = get_current_user_id()

        if not diagram:
            return jsonify({
                'success': False,
                'message': '다이어그램을 찾을 수 없습니다.'
            }), 404

        # 소유자 확인 (소유자가 있는 경우에만)
        if diagram.user_id and diagram.user_id != user_id:
            return jsonify({
                'success': False,
                'message': '삭제 권한이 없습니다.'
            }), 403

        db.session.delete(diagram)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '다이어그램이 삭제되었습니다.'
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500
