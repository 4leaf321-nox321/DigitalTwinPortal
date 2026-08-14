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
from .models import (
    StrategyPlan, StrategyAssessment, StrategyMetricTarget, StrategyCrux,
)
from .evidence import get_evidence_source
from .metrics import compute_metrics
from .findings import derive_findings
from .definitions import (
    CATEGORIES, DIMENSION_KEYS_BY_CATEGORY, ALL_ASSESSMENT_SLOTS,
    METRICS, METRIC_KEYS, LEVEL_MIN, LEVEL_MAX,
    get_target_divisions,
)

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
    """진단 기준과 대상 사업부, 근거 원천 모드.

    차원·레벨 정의를 함께 내려 화면이 툴팁으로 띄운다. 정의 없이 1~5 만 두면
    사람마다 다르게 매겨 격차 숫자가 의미를 잃는다.
    """
    source = get_evidence_source()
    divisions = get_target_divisions()
    return jsonify({
        'success': True,
        'data': {
            'categories': CATEGORIES,
            'metrics': METRICS,
            'divisions': [{'id': d.id, 'name': d.name, 'color': d.color} for d in divisions],
            'evidenceMode': source.mode,
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

        divisions = get_target_divisions()
        saved = {
            (a.division_id, a.category, a.dimension): a
            for a in plan.assessments.all()
        }

        # 사업부 × 차원 격자를 항상 채워서 내려준다. 빈 칸도 자리가 보여야
        # 무엇을 아직 안 매겼는지 알 수 있다.
        assessments = []
        for division in divisions:
            for category, dimension in ALL_ASSESSMENT_SLOTS:
                a = saved.get((division.id, category, dimension))
                assessments.append(a.to_dict() if a else {
                    'division_id': division.id,
                    'category': category,
                    'dimension': dimension,
                    'current_level': None,
                    'target_level': None,
                    'gap': None,
                    'basis': 'manual',
                    'note': None,
                })

        # B 는 저장하지 않고 매번 계산한다. 원본이 바뀌면 따라 바뀌어야 한다.
        source = get_evidence_source()
        try:
            observed, observed_context = compute_metrics(source, year, divisions)
            metric_error = None
        except NotImplementedError as e:
            observed = {d.id: {k: None for k in METRIC_KEYS} for d in divisions}
            observed_context = {}
            metric_error = str(e)

        targets = {
            (t.division_id, t.metric_key): t
            for t in StrategyMetricTarget.query.filter_by(plan_id=plan.id).all()
        }
        metrics = []
        for division in divisions:
            for key in METRIC_KEYS:
                t = targets.get((division.id, key))
                value = observed.get(division.id, {}).get(key)
                target_value = t.target_value if t else None
                gap = None
                if value is not None and target_value is not None:
                    gap = round(target_value - value, 1)
                metrics.append({
                    'division_id': division.id,
                    'metric_key': key,
                    'value': value,
                    'target_value': target_value,
                    'gap': gap,
                    'note': t.note if t else None,
                })

        # 데이터가 먼저 말하는 부분. 사람이 아무것도 안 매겨도 볼 것이 있어야 한다.
        findings = (
            derive_findings(observed, divisions, observed_context)
            if not metric_error else []
        )

        cruxes = StrategyCrux.query.filter_by(plan_id=plan.id) \
            .order_by(StrategyCrux.order, StrategyCrux.id).all()

        return jsonify({
            'success': True,
            'data': {
                **plan.to_dict(),
                'assessments': assessments,
                'metrics': metrics,
                'findings': findings,
                'cruxes': [c.to_dict() for c in cruxes],
                'metricsMode': source.mode,
                'metricsError': metric_error,
            }
        })
    except Exception as e:
        return _error(str(e))


@bp.route('/plans/<int:year>/cruxes', methods=['POST'])
@office_required
def create_crux(year):
    """크럭스 추가. 진단의 산출물이며 다음 단계의 입력이 된다."""
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)

        payload = request.get_json() or {}
        title = (payload.get('title') or '').strip()
        if not title:
            return _error('title 이 필요합니다.', 400)

        existing = StrategyCrux.query.filter_by(plan_id=plan.id).count()
        crux = StrategyCrux(
            plan_id=plan.id,
            title=title,
            rationale=payload.get('rationale'),
            division_id=payload.get('division_id'),
            source_finding=payload.get('source_finding'),
            order=existing,
        )
        db.session.add(crux)
        db.session.commit()
        return jsonify({'success': True, 'data': crux.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


@bp.route('/plans/<int:year>/cruxes/<int:crux_id>', methods=['PUT', 'DELETE'])
@office_required
def modify_crux(year, crux_id):
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)

        crux = StrategyCrux.query.filter_by(id=crux_id, plan_id=plan.id).first()
        if not crux:
            return _error('크럭스를 찾을 수 없습니다.', 404)

        if request.method == 'DELETE':
            db.session.delete(crux)
            db.session.commit()
            return jsonify({'success': True})

        payload = request.get_json() or {}
        if 'title' in payload:
            title = (payload['title'] or '').strip()
            if not title:
                return _error('title 은 비울 수 없습니다.', 400)
            crux.title = title
        for field in ('rationale', 'division_id', 'source_finding'):
            if field in payload:
                setattr(crux, field, payload[field])

        db.session.commit()
        return jsonify({'success': True, 'data': crux.to_dict()})
    except Exception as e:
        db.session.rollback()
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

        divisions = get_target_divisions()
        if not divisions:
            return _error('진단 대상 사업부가 없습니다. 사업부 설정을 확인하세요.', 400)

        plan = StrategyPlan(
            year=year,
            title=payload.get('title') or f'{year}년 디지털 트윈 전략',
            owner_id=int(get_jwt_identity()),
        )
        db.session.add(plan)
        db.session.flush()

        # 사업부 × 차원 칸을 미리 만들어 둔다. 빈 화면보다 채울 칸이 보이는 편이 낫다.
        for division in divisions:
            for category, dimension in ALL_ASSESSMENT_SLOTS:
                db.session.add(StrategyAssessment(
                    plan_id=plan.id, division_id=division.id,
                    category=category, dimension=dimension,
                ))

        db.session.commit()
        return jsonify({'success': True, 'data': plan.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


@bp.route('/plans/<int:year>/assessments/<int:division_id>/<category>/<dimension>',
          methods=['PUT'])
@office_required
def update_assessment(year, division_id, category, dimension):
    """진단 항목 수정."""
    try:
        valid = DIMENSION_KEYS_BY_CATEGORY.get(category)
        if not valid:
            return _error(f'알 수 없는 구분입니다: {category}', 400)
        if dimension not in valid:
            return _error(f'{category} 에 없는 차원입니다: {dimension}', 400)

        if division_id not in {d.id for d in get_target_divisions()}:
            return _error('진단 대상 사업부가 아닙니다.', 400)

        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)

        assessment = StrategyAssessment.query.filter_by(
            plan_id=plan.id, division_id=division_id,
            category=category, dimension=dimension,
        ).first()
        if not assessment:
            assessment = StrategyAssessment(
                plan_id=plan.id, division_id=division_id,
                category=category, dimension=dimension,
            )
            db.session.add(assessment)

        payload = request.get_json() or {}
        for field in ('current_level', 'target_level'):
            if field in payload:
                value = payload[field]
                # 0 과 미입력은 다른 뜻이다. None 은 그대로 둔다.
                if value is not None and not (LEVEL_MIN <= int(value) <= LEVEL_MAX):
                    return _error(f'{field} 는 {LEVEL_MIN}~{LEVEL_MAX} 여야 합니다.', 400)
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


@bp.route('/plans/<int:year>/metric-targets/<int:division_id>/<metric_key>',
          methods=['PUT'])
@office_required
def update_metric_target(year, division_id, metric_key):
    """활용·성과 지표의 목표값 설정. 관측값은 계산되므로 저장하지 않는다."""
    try:
        if metric_key not in METRIC_KEYS:
            return _error(f'알 수 없는 지표입니다: {metric_key}', 400)
        if division_id not in {d.id for d in get_target_divisions()}:
            return _error('진단 대상 사업부가 아닙니다.', 400)

        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)

        row = StrategyMetricTarget.query.filter_by(
            plan_id=plan.id, division_id=division_id, metric_key=metric_key
        ).first()
        if not row:
            row = StrategyMetricTarget(
                plan_id=plan.id, division_id=division_id, metric_key=metric_key
            )
            db.session.add(row)

        payload = request.get_json() or {}
        if 'target_value' in payload:
            value = payload['target_value']
            row.target_value = None if value is None else float(value)
        if 'note' in payload:
            row.note = payload['note']

        db.session.commit()
        return jsonify({'success': True, 'data': row.to_dict()})
    except (TypeError, ValueError):
        db.session.rollback()
        return _error('target_value 는 숫자여야 합니다.', 400)
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


@bp.route('/evidence-preview/<int:year>', methods=['GET'])
@office_required
def evidence_preview(year):
    """근거 원천이 실제로 무엇을 돌려주는지 확인용."""
    source = get_evidence_source()
    try:
        projects = source.get_projects(year)
        kpis = source.get_kpis(year)
    except NotImplementedError as e:
        return jsonify({'success': False, 'mode': source.mode, 'message': str(e)}), 501

    return jsonify({
        'success': True,
        'data': {
            'mode': source.mode,
            'projectCount': len(projects),
            'kpiCount': len(kpis),
            'sampleProject': projects[0] if projects else None,
        }
    })
