"""
Digital Twin Strategy Routes
연도별 전략 기획 API

접근 권한: 사무국/관리자 전용. 화면에서 카드를 가리는 것만으로는 URL 직접 접근을
막지 못하므로 여기서도 같은 기준으로 검사한다.
"""
from functools import wraps

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.modules.auth.models import User, UserRole
from .models import StrategyPlan, StrategyAssessment
from .evidence import get_evidence_source, DIMENSIONS

bp = Blueprint('digital_twin_strategy', __name__, url_prefix='/api/digital-twin-strategy')

ALLOWED_ROLES = (UserRole.ADMIN, UserRole.DT_OFFICE_MEMBER)


def office_required(fn):
    """사무국/관리자만 통과시킨다."""
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = User.query.get(int(get_jwt_identity()))
        if not user or user.role not in ALLOWED_ROLES:
            return jsonify({
                'success': False,
                'message': '전략 기획은 사무국/관리자만 접근할 수 있습니다.'
            }), 403
        return fn(*args, **kwargs)
    return wrapper


def _error(message, status=500):
    return jsonify({'success': False, 'message': message}), status


@bp.route('/meta', methods=['GET'])
@office_required
def get_meta():
    """성숙도 차원 목록과 현재 근거 원천 모드.

    화면은 mode 가 fixture 면 합성 데이터 경고 띠를 띄운다.
    """
    source = get_evidence_source()
    return jsonify({
        'success': True,
        'data': {
            'dimensions': [{'key': k, 'label': l} for k, l in DIMENSIONS],
            'evidenceMode': source.mode,
            'levelRange': {'min': 1, 'max': 5},
        }
    })


@bp.route('/plans/<int:year>', methods=['GET'])
@office_required
def get_plan(year):
    """해당 연도 전략 조회. 없으면 data 가 None 이다(404 가 아니다 — 아직 안 만든
    것은 오류가 아니라 정상 상태다)."""
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return jsonify({'success': True, 'data': None})

        assessments = plan.assessments.all()
        by_dimension = {a.dimension: a.to_dict() for a in assessments}

        return jsonify({
            'success': True,
            'data': {
                **plan.to_dict(),
                'assessments': [
                    by_dimension.get(key) or {
                        'dimension': key,
                        'current_level': None,
                        'target_level': None,
                        'gap': None,
                        'basis': 'manual',
                        'note': None,
                    }
                    for key, _ in DIMENSIONS
                ],
            }
        })
    except Exception as e:
        return _error(str(e))


@bp.route('/plans', methods=['POST'])
@office_required
def create_plan():
    """연도별 전략 생성. 같은 해에 두 번 만들 수 없다."""
    try:
        payload = request.get_json() or {}
        year = payload.get('year')
        if not isinstance(year, int):
            return _error('year 가 필요합니다.', 400)

        if StrategyPlan.query.filter_by(year=year).first():
            return _error(f'{year}년 전략이 이미 있습니다.', 409)

        plan = StrategyPlan(
            year=year,
            title=payload.get('title') or f'{year}년 디지털 트윈 전략',
            owner_id=int(get_jwt_identity()),
        )
        db.session.add(plan)
        db.session.flush()

        # 차원별 진단 칸을 미리 만들어 둔다. 빈 화면보다 채울 칸이 보이는 편이 낫다.
        for key, _ in DIMENSIONS:
            db.session.add(StrategyAssessment(plan_id=plan.id, dimension=key))

        db.session.commit()
        return jsonify({'success': True, 'data': plan.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


@bp.route('/plans/<int:year>/assessments/<dimension>', methods=['PUT'])
@office_required
def update_assessment(year, dimension):
    """진단 항목 수정."""
    try:
        valid = {k for k, _ in DIMENSIONS}
        if dimension not in valid:
            return _error(f'알 수 없는 차원입니다: {dimension}', 400)

        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)

        assessment = StrategyAssessment.query.filter_by(
            plan_id=plan.id, dimension=dimension
        ).first()
        if not assessment:
            assessment = StrategyAssessment(plan_id=plan.id, dimension=dimension)
            db.session.add(assessment)

        payload = request.get_json() or {}
        for field in ('current_level', 'target_level'):
            if field in payload:
                value = payload[field]
                # 0 과 미입력은 다른 뜻이다. None 은 그대로 둔다.
                if value is not None and not (1 <= int(value) <= 5):
                    return _error(f'{field} 는 1~5 여야 합니다.', 400)
                setattr(assessment, field, value if value is None else int(value))
        if 'note' in payload:
            assessment.note = payload['note']
        if 'basis' in payload:
            assessment.basis = payload['basis']

        db.session.commit()
        return jsonify({'success': True, 'data': assessment.to_dict()})
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


@bp.route('/evidence-preview/<int:year>', methods=['GET'])
@office_required
def evidence_preview(year):
    """근거 원천이 실제로 무엇을 돌려주는지 확인용.

    Phase 2 에서 진단 자동 채움을 붙이기 전에, 원천 계층이 붙어 있는지부터
    눈으로 보기 위한 것이다. local 모드에서는 아직 NotImplementedError 가 난다.
    """
    source = get_evidence_source()
    try:
        projects = source.get_projects(year)
        kpis = source.get_kpis(year)
    except NotImplementedError as e:
        return jsonify({
            'success': False,
            'mode': source.mode,
            'message': str(e),
        }), 501

    return jsonify({
        'success': True,
        'data': {
            'mode': source.mode,
            'projectCount': len(projects),
            'kpiCount': len(kpis),
            'sampleProject': projects[0] if projects else None,
        }
    })
