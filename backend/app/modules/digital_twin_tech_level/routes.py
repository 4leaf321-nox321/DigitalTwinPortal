"""
Digital Twin Tech Level Routes
디지털 트윈 메가 과제 현황 저장/불러오기 API
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from app.extensions import db
from .models import TechLevelData

bp = Blueprint('digital_twin_tech_level', __name__, url_prefix='/api/digital-twin-tech-level')


def get_current_user_id():
    """현재 로그인한 사용자 ID 반환 (로그인하지 않은 경우 None)"""
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        return int(identity) if identity else None
    except:
        return None


@bp.route('/data', methods=['GET'])
def get_all_data():
    """저장된 데이터 목록 조회 (전체)"""
    try:
        data_list = TechLevelData.query.order_by(TechLevelData.updated_at.desc()).all()
        return jsonify({
            'success': True,
            'data': [d.to_list_dict() for d in data_list]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/data/my', methods=['GET'])
@jwt_required()
def get_my_data():
    """내 데이터 목록 조회"""
    try:
        user_id = int(get_jwt_identity())
        data_list = TechLevelData.query.filter_by(user_id=user_id).order_by(TechLevelData.updated_at.desc()).all()
        return jsonify({
            'success': True,
            'data': [d.to_list_dict() for d in data_list]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/data/public', methods=['GET'])
def get_public_data():
    """공용 데이터 목록 조회"""
    try:
        data_list = TechLevelData.query.filter_by(is_public=True).order_by(TechLevelData.updated_at.desc()).all()
        return jsonify({
            'success': True,
            'data': [d.to_list_dict() for d in data_list]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/data', methods=['POST'])
def create_data():
    """새 데이터 저장"""
    try:
        data = request.get_json()
        user_id = get_current_user_id()

        if not data.get('name'):
            return jsonify({
                'success': False,
                'message': '저장 이름을 입력해주세요.'
            }), 400

        tech_level_data = TechLevelData(
            name=data.get('name'),
            description=data.get('description', ''),
            goals=data.get('goals', []),
            components=data.get('components', []),
            level_options=data.get('level_options', []),
            category_options=data.get('category_options', []),
            business_unit_options=data.get('business_unit_options', []),
            tech_type_options=data.get('tech_type_options', []),
            graph_heights=data.get('graph_heights', {}),
            card_graph_zoom_pan=data.get('card_graph_zoom_pan', {}),
            graph_view_state=data.get('graph_view_state', {}),
            data_metadata=data.get('metadata', {}),
            user_id=user_id,
            is_public=data.get('is_public', False),
            created_by=user_id,
            created_by_name=data.get('created_by_name', 'Anonymous'),
            updated_by=user_id,
            updated_by_name=data.get('created_by_name', 'Anonymous')
        )

        db.session.add(tech_level_data)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '데이터가 저장되었습니다.',
            'data': tech_level_data.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/data/<int:data_id>', methods=['GET'])
def get_data(data_id):
    """특정 데이터 조회"""
    try:
        tech_level_data = TechLevelData.query.get(data_id)

        if not tech_level_data:
            return jsonify({
                'success': False,
                'message': '데이터를 찾을 수 없습니다.'
            }), 404

        return jsonify({
            'success': True,
            'data': tech_level_data.to_dict()
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/data/<int:data_id>', methods=['PUT'])
def update_data(data_id):
    """데이터 수정"""
    try:
        tech_level_data = TechLevelData.query.get(data_id)
        user_id = get_current_user_id()

        if not tech_level_data:
            return jsonify({
                'success': False,
                'message': '데이터를 찾을 수 없습니다.'
            }), 404

        # 소유자 확인 (소유자가 있는 경우에만)
        if tech_level_data.user_id and tech_level_data.user_id != user_id:
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
        if not tech_level_data.user_id and user_id:
            tech_level_data.user_id = user_id
            tech_level_data.created_by = user_id

        if 'name' in data:
            tech_level_data.name = data['name']
        if 'description' in data:
            tech_level_data.description = data['description']
        if 'goals' in data:
            tech_level_data.goals = data['goals']
        if 'components' in data:
            tech_level_data.components = data['components']
        if 'level_options' in data:
            tech_level_data.level_options = data['level_options']
        if 'category_options' in data:
            tech_level_data.category_options = data['category_options']
        if 'business_unit_options' in data:
            tech_level_data.business_unit_options = data['business_unit_options']
        if 'tech_type_options' in data:
            tech_level_data.tech_type_options = data['tech_type_options']
        if 'graph_heights' in data:
            tech_level_data.graph_heights = data['graph_heights']
        if 'card_graph_zoom_pan' in data:
            tech_level_data.card_graph_zoom_pan = data['card_graph_zoom_pan']
        if 'graph_view_state' in data:
            tech_level_data.graph_view_state = data['graph_view_state']
        if 'metadata' in data:
            tech_level_data.data_metadata = data['metadata']
        if 'is_public' in data:
            tech_level_data.is_public = data['is_public']
        if 'updated_by_name' in data:
            tech_level_data.updated_by_name = data['updated_by_name']

        tech_level_data.updated_by = user_id

        db.session.commit()

        return jsonify({
            'success': True,
            'message': '데이터가 수정되었습니다.',
            'data': tech_level_data.to_dict()
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/data/<int:data_id>', methods=['DELETE'])
def delete_data(data_id):
    """데이터 삭제"""
    try:
        tech_level_data = TechLevelData.query.get(data_id)
        user_id = get_current_user_id()

        if not tech_level_data:
            return jsonify({
                'success': False,
                'message': '데이터를 찾을 수 없습니다.'
            }), 404

        # 소유자 확인 (소유자가 있는 경우에만)
        if tech_level_data.user_id and tech_level_data.user_id != user_id:
            return jsonify({
                'success': False,
                'message': '삭제 권한이 없습니다.'
            }), 403

        db.session.delete(tech_level_data)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': '데이터가 삭제되었습니다.'
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500
