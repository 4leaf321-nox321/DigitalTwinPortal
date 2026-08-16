"""
Digital Twin Strategy Routes
연도별 전략 기획 API

접근 권한: 사무국/관리자 전용. 화면에서 카드를 가리는 것만으로는 URL 직접 접근을
막지 못하므로 여기서도 같은 기준으로 검사한다.
"""
from datetime import datetime
from functools import wraps

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.modules.auth.models import User, UserRole
from .models import (
    StrategyPlan, StrategyAssessment, StrategyMetricTarget, StrategyCrux,
    StrategyIssue, StrategyElement,
)
from .evidence import get_evidence_source
from .metrics import (
    compute_metrics, compute_kpi_coverage, compute_process_metrics,
)
from .findings import (
    derive_findings, derive_kpi_findings, derive_process_findings,
)
from .survey_link import (
    attach_current, collect, derive_choice_findings, derive_survey_findings,
)
from .survey_voice import is_available as voices_available, summarize as summarize_voices
from .issues import (
    derive_issue_candidates, derive_survey_candidates, summarize_coverage,
)
from .elements import (
    derive_element_candidates, derive_survey_candidates as derive_element_survey,
    summarize_elements,
)
from .definitions import (
    CATEGORIES, CATEGORY_ORGANIZATION, DIMENSION_KEYS_BY_CATEGORY,
    ALL_ASSESSMENT_SLOTS,
    METRICS, METRIC_KEYS, LEVEL_MIN, LEVEL_MAX,
    THRESHOLDS, THRESHOLD_KEYS, THRESHOLD_MAX, DEFAULT_THRESHOLDS,
    MODULE_KEY, THRESHOLD_SETTINGS_KEY,
    get_target_divisions, get_thresholds,
)

bp = Blueprint('digital_twin_strategy', __name__, url_prefix='/api/digital-twin-strategy')

ALLOWED_ROLES = (UserRole.ADMIN, UserRole.DT_OFFICE_MEMBER)

# 진단값을 무엇으로 매겼나. models.StrategyAssessment 의 주석과 같은 집합이다.
#   auto  포탈 데이터로 채움 / survey  설문 / manual  손으로 입력
ASSESSMENT_BASIS = {'auto', 'survey', 'manual'}


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
            'thresholdDefinitions': THRESHOLDS,
            'thresholds': get_thresholds(),
        }
    })


@bp.route('/settings/thresholds', methods=['PUT'])
@office_required
def update_thresholds():
    """진단 임계값 저장.

    기본값과 다른 값만 저장한다. 전부 저장하면 배포로 기본값이 바뀌어도 옛 값이
    그대로 남아, 손대지 않은 항목까지 과거에 묶인다.
    """
    from app.modules.digital_twin_dashboard.models import ModuleSettings

    try:
        payload = request.get_json() or {}
        incoming = payload.get('thresholds')
        if not isinstance(incoming, dict):
            return _error('thresholds 가 필요합니다.', 400)

        cleaned = {}
        for key, value in incoming.items():
            if key not in THRESHOLD_KEYS:
                return _error(f'알 수 없는 항목입니다: {key}', 400)
            if value is None:
                continue          # 기본값으로 되돌리기
            try:
                number = float(value)
            except (TypeError, ValueError):
                return _error(f'{key} 는 숫자여야 합니다.', 400)
            if number < 0:
                return _error(f'{key} 는 0 이상이어야 합니다.', 400)
            # 상한은 항목마다 다르다. 전부 100 으로 보던 때는 '역할 간 격차
            # 99점' 이 저장됐고, 1~5 척도에서 그런 격차는 나올 수 없으므로 그
            # 규칙이 조용히 죽었다.
            limit = THRESHOLD_MAX.get(key, 100)
            if number > limit:
                meta = next((t for t in THRESHOLDS if t['key'] == key), None)
                name = meta['label'] if meta else key
                unit = meta['unit'] if meta else ''
                return _error(f'{name} 은(는) {limit}{unit} 이하여야 합니다.', 400)
            if number != DEFAULT_THRESHOLDS[key]:
                cleaned[key] = number

        row = ModuleSettings.query.filter_by(
            module_name=MODULE_KEY, settings_key=THRESHOLD_SETTINGS_KEY
        ).first()
        if not row:
            row = ModuleSettings(
                module_name=MODULE_KEY, settings_key=THRESHOLD_SETTINGS_KEY,
                description='전략 진단 임계값 (기본값과 다른 항목만 저장)',
            )
            db.session.add(row)
        row.settings_data = cleaned

        db.session.commit()
        return jsonify({'success': True, 'data': {
            'thresholds': get_thresholds(),
            'overridden': sorted(cleaned),
        }})
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


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
            kpi_coverage = compute_kpi_coverage(source, year, divisions)
            # 같은 과제를 **공정 단계로도** 자른다(Value Chain). 사람이 채울
            # 격자가 늘지 않는다 — 축만 바꿔 다시 세는 것이다.
            from app.modules.survey.roles import process_names
            process_list = process_names()
            process_values, process_context, process_unknown = (
                compute_process_metrics(source, year, process_list))
            metric_error = None
        except NotImplementedError as e:
            observed = {d.id: {k: None for k in METRIC_KEYS} for d in divisions}
            observed_context = {}
            kpi_coverage = []
            process_list, process_values, process_context = [], {}, {}
            process_unknown = 0
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

        # 설문이 말하는 것. **한 번만 계산해서** 제안값과 findings 가 같이 쓴다 —
        # 따로 세면 화면의 제안값과 발견 사항이 서로 다른 숫자를 근거로 삼는다.
        thresholds = get_thresholds()
        min_sample = int(thresholds.get('survey_min_sample', 5) or 5)
        survey_evidence = attach_current(
            collect(plan, divisions, min_sample), assessments)

        # 데이터가 먼저 말하는 부분. 사람이 아무것도 안 매겨도 볼 것이 있어야 한다.
        if metric_error:
            findings = []
        else:
            # 사업부에서 본 것과 지표에서 본 것을 합친다. 뒤집어 봐야만
            # 드러나는 공백이 있다 — 아무도 주기여로 밀지 않는 지표 같은 것.
            findings = (
                derive_findings(observed, divisions, observed_context, thresholds)
                + derive_kpi_findings(kpi_coverage)
                # 같은 과제를 공정 단계로 자른 것. 사업부 축이 못 보는 것을 본다.
                + derive_process_findings(process_values, process_list,
                                          thresholds, process_unknown)
            )
        # 설문 규칙은 지표를 못 읽어도 돌아야 한다. 둘은 서로 다른 원천이다.
        findings += derive_survey_findings(survey_evidence, thresholds, min_sample)
        findings += derive_choice_findings(plan, thresholds, min_sample, divisions)
        order = {'high': 0, 'medium': 1, 'info': 2}
        findings.sort(key=lambda f: (order.get(f['severity'], 9), f['title']))

        cruxes = [
            c.to_dict() for c in StrategyCrux.query.filter_by(plan_id=plan.id)
            .order_by(StrategyCrux.order, StrategyCrux.id).all()
        ]
        issues = [
            i.to_dict() for i in StrategyIssue.query.filter_by(plan_id=plan.id)
            .order_by(StrategyIssue.order, StrategyIssue.id).all()
        ]
        elements = [
            e.to_dict() for e in StrategyElement.query.filter_by(plan_id=plan.id)
            .order_by(StrategyElement.kind, StrategyElement.order,
                      StrategyElement.id).all()
        ]
        # 이미 요소로 올린 것은 후보에서 뺀다. 안 빼면 같은 것이 목록에 계속
        # 남아, 무엇을 아직 안 봤는지 읽을 수 없다(이슈 후보와 같은 규칙).
        taken_elements = {e['source_ref'] for e in elements if e.get('source_ref')}

        element_candidates = [
            c for c in (derive_element_candidates(assessments, findings,
                                                  divisions, thresholds)
                        # O·T 는 포탈에 없다. 설문에서만 온다.
                        + derive_element_survey(plan, min_sample))
            if c['key'] not in taken_elements
        ]

        # 이미 이슈로 만든 후보는 목록에서 뺀다. 같은 격차가 계속 남아 있으면
        # 무엇을 아직 안 다뤘는지 읽을 수 없다.
        taken = {
            f"{i['source_type']}:{i['source_ref']}:{i['division_id']}"
            for i in issues if i.get('source_ref')
        }
        # 설문에서 나온 사실은 **격차가 없어도** 이슈가 될 수 있다. 목표 레벨을
        # 안 넣어도 '63% 가 데이터 정합성을 꼽았다'는 그대로 할 일이다.
        promoted = {c['source_finding'] for c in cruxes if c.get('source_finding')}
        candidates = [
            c for c in (derive_issue_candidates(assessments, metrics, divisions)
                        + derive_survey_candidates(findings, promoted))
            if c['key'] not in taken
        ]

        return jsonify({
            'success': True,
            'data': {
                **plan.to_dict(),
                'assessments': assessments,
                'metrics': metrics,
                'kpiCoverage': kpi_coverage,
                'findings': findings,
                'surveyEvidence': survey_evidence,
                # 버튼을 띄울지 정하는 데만 쓴다. 부르는 것은 사람이 누를 때다.
                'surveyVoicesAvailable': voices_available(),
                'cruxes': cruxes,
                'issues': issues,
                'issueCandidates': candidates,
                'issueCoverage': summarize_coverage(cruxes, issues),
                'elements': elements,
                'elementCandidates': element_candidates,
                'elementSummary': summarize_elements(elements),
                # 프로세스 축. 지표 정의는 사업부 축과 **같은 것**을 쓴다 —
                # 축이 다르다고 다른 지표를 재면 두 화면을 견줄 수 없다.
                'processMetrics': {
                    'processes': process_list,
                    'values': process_values,
                    'context': process_context,
                    # 프로세스가 안 적힌 과제. 숨기면 합계가 안 맞는데 이유가
                    # 안 보인다.
                    'unknownCount': process_unknown,
                },
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


@bp.route('/plans/<int:year>/cruxes/from-issues', methods=['POST'])
@office_required
def crux_from_issues(year):
    """이슈 여러 개를 **묶어서** 핵심 난제를 만든다. (아래에서 위로)

    진단이 난제를 먼저 남기고 그것을 쪼개는 것이 본줄기지만, 실제로는 반대
    방향도 일어난다 — 진단의 여러 곳에서 나온 것을 각각 이슈로 적어 놓고 보니
    **그것들을 관통하는 하나**가 보이는 경우다. 그게 난제다.

    그때 손으로 하려면 난제를 따로 만들고 이슈를 하나씩 열어 난제를 바꿔야
    했다. 다섯 건이면 여섯 번을 눌러야 하고, 중간에 하나를 빠뜨리면 그 이슈는
    고아로 남는다 — 화면이 빨갛게 경고하는 바로 그 상태로.

    ⚠️ **한 트랜잭션이다.** 난제만 만들어지고 이슈가 안 붙으면, 방금 만든 난제가
       빈 채로 남아 "넘겠다고 해놓고 아무것도 안 하는" 난제처럼 보인다.
    """
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)

        payload = request.get_json() or {}
        title = (payload.get('title') or '').strip()
        if not title:
            return _error('난제 제목이 필요합니다.', 400)

        raw_ids = payload.get('issue_ids')
        if not isinstance(raw_ids, list) or not raw_ids:
            return _error('묶을 이슈를 골라 주세요.', 400)
        try:
            issue_ids = {int(x) for x in raw_ids}
        except (TypeError, ValueError):
            return _error('이슈 번호가 올바르지 않습니다.', 400)

        # ⚠️ **이 전략의 이슈만** 묶는다. 번호만 보내면 남의 연도 이슈가 딸려
        #    올 수 있고, 그러면 그 이슈는 두 전략에 걸친다.
        issues = StrategyIssue.query.filter(
            StrategyIssue.plan_id == plan.id,
            StrategyIssue.id.in_(issue_ids),
        ).all()
        missing = issue_ids - {i.id for i in issues}
        if missing:
            return _error(f"이 전략의 이슈가 아닙니다: {sorted(missing)}", 400)

        crux = StrategyCrux(
            plan_id=plan.id,
            title=title,
            rationale=payload.get('rationale'),
            # 여러 사업부의 이슈를 묶었으면 전사 난제다. 하나뿐이면 그 사업부.
            division_id=(issues[0].division_id
                         if len({i.division_id for i in issues}) == 1 else None),
            source_finding=payload.get('source_finding'),
            order=StrategyCrux.query.filter_by(plan_id=plan.id).count(),
        )
        db.session.add(crux)
        db.session.flush()

        moved = []
        for issue in issues:
            # 이미 다른 난제에 매달린 것도 옮긴다. 고른 것은 고른 것이다 —
            # 다만 무엇이 옮겨졌는지 돌려줘서 화면이 말할 수 있게 한다.
            moved.append({'id': issue.id, 'from_crux_id': issue.crux_id})
            issue.crux_id = crux.id

        db.session.commit()
        return jsonify({'success': True, 'data': {
            'crux': crux.to_dict(), 'moved': moved,
        }}), 201
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


# ── ② 이슈 ────────────────────────────────────────────────────────────────

ISSUE_SOURCE_TYPES = {'crux', 'gap', 'metric', 'manual'}
ISSUE_STATUSES = {'open', 'dropped'}
SCORE_MIN, SCORE_MAX = 1, 5


def _apply_issue_fields(issue, payload, plan):
    """이슈의 수정 가능한 필드를 payload 에서 옮긴다.

    생성과 수정이 같은 규칙을 써야 한다. 두 곳에 나눠 쓰면 한쪽만 고쳐진다.
    돌려주는 값은 오류 메시지이며, None 이면 통과다.
    """
    if 'title' in payload:
        title = (payload['title'] or '').strip()
        if not title:
            return 'title 은 비울 수 없습니다.'
        issue.title = title

    if 'crux_id' in payload:
        crux_id = payload['crux_id']
        if crux_id is not None:
            # 남의 전략에 달린 난제에 매달 수 없다.
            crux = StrategyCrux.query.filter_by(id=crux_id, plan_id=plan.id).first()
            if not crux:
                return '핵심 난제를 찾을 수 없습니다.'
        issue.crux_id = crux_id

    for field in ('impact', 'feasibility'):
        if field not in payload:
            continue
        value = payload[field]
        # 비우는 것과 1점은 다른 뜻이다. None 은 "아직 안 매김"이다.
        if value is None:
            setattr(issue, field, None)
            continue
        try:
            number = int(value)
        except (TypeError, ValueError):
            return f'{field} 는 숫자여야 합니다.'
        if not (SCORE_MIN <= number <= SCORE_MAX):
            return f'{field} 는 {SCORE_MIN}~{SCORE_MAX} 여야 합니다.'
        setattr(issue, field, number)

    if 'status' in payload:
        status = payload['status']
        if status not in ISSUE_STATUSES:
            return f'알 수 없는 상태입니다: {status}'
        issue.status = status

    if 'source_type' in payload:
        source_type = payload['source_type']
        if source_type not in ISSUE_SOURCE_TYPES:
            return f'알 수 없는 출처입니다: {source_type}'
        issue.source_type = source_type

    for field in ('description', 'root_cause', 'division_id', 'source_ref'):
        if field in payload:
            setattr(issue, field, payload[field])

    return None


ELEMENT_KINDS = ('S', 'W', 'O', 'T')


def _apply_element_fields(element, payload):
    """요소의 값을 채운다. 오류 메시지를 돌려주며 None 이면 통과."""
    if 'kind' in payload or not element.kind:
        kind = (payload.get('kind') or '').strip().upper()
        if kind not in ELEMENT_KINDS:
            return f"S·W·O·T 중 하나여야 합니다: {payload.get('kind')}"
        element.kind = kind
    if 'title' in payload or not element.title:
        title = (payload.get('title') or '').strip()
        if not title:
            return '내용이 비어 있습니다.'
        element.title = title[:300]
    for field in ('detail', 'division_id', 'source_type', 'source_ref'):
        if field in payload:
            setattr(element, field, payload[field])
    return None


@bp.route('/plans/<int:year>/elements', methods=['POST'])
@office_required
def create_element(year):
    """전략 요소 추가. 후보에서 승격했거나 손으로 적은 것이다."""
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)

        element = StrategyElement(
            plan_id=plan.id, kind='', title='',
            order=StrategyElement.query.filter_by(plan_id=plan.id).count(),
        )
        error = _apply_element_fields(element, request.get_json() or {})
        if error:
            return _error(error, 400)

        db.session.add(element)
        db.session.commit()
        return jsonify({'success': True, 'data': element.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


@bp.route('/plans/<int:year>/elements/<int:element_id>',
          methods=['PUT', 'DELETE'])
@office_required
def modify_element(year, element_id):
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)
        element = StrategyElement.query.filter_by(
            id=element_id, plan_id=plan.id).first()
        if not element:
            return _error('전략 요소를 찾을 수 없습니다.', 404)

        if request.method == 'DELETE':
            db.session.delete(element)
            db.session.commit()
            return jsonify({'success': True})

        error = _apply_element_fields(element, request.get_json() or {})
        if error:
            return _error(error, 400)
        db.session.commit()
        return jsonify({'success': True, 'data': element.to_dict()})
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


@bp.route('/plans/<int:year>/issues', methods=['POST'])
@office_required
def create_issue(year):
    """이슈 추가. 핵심 난제를 쪼갠 것이거나, 진단 격차에서 가져온 것이다."""
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)

        payload = request.get_json() or {}
        if not (payload.get('title') or '').strip():
            return _error('title 이 필요합니다.', 400)

        issue = StrategyIssue(
            plan_id=plan.id,
            title='',   # _apply_issue_fields 가 채운다
            order=StrategyIssue.query.filter_by(plan_id=plan.id).count(),
        )
        error = _apply_issue_fields(issue, payload, plan)
        if error:
            return _error(error, 400)

        db.session.add(issue)
        db.session.commit()
        return jsonify({'success': True, 'data': issue.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


@bp.route('/plans/<int:year>/issues/<int:issue_id>', methods=['PUT', 'DELETE'])
@office_required
def modify_issue(year, issue_id):
    """이슈 수정·삭제.

    '올해는 안 한다'는 삭제가 아니라 status='dropped' 다. 지우면 왜 안 하기로
    했는지가 남지 않는다 — 그것도 전략의 일부다.
    """
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)

        issue = StrategyIssue.query.filter_by(id=issue_id, plan_id=plan.id).first()
        if not issue:
            return _error('이슈를 찾을 수 없습니다.', 404)

        if request.method == 'DELETE':
            db.session.delete(issue)
            db.session.commit()
            return jsonify({'success': True})

        error = _apply_issue_fields(issue, request.get_json() or {}, plan)
        if error:
            return _error(error, 400)

        db.session.commit()
        return jsonify({'success': True, 'data': issue.to_dict()})
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
            # ⚠️ **아는 값만 받는다.** basis 는 표시용이 아니라 판단에 쓰인다 —
            #    설문 반영이 'manual' 인 칸을 건너뛰는 근거가 이것이다. 아무
            #    문자열이나 들어가면 그 칸은 수기 보호를 못 받고, 다음 「반영」에
            #    조용히 덮인다.
            if payload['basis'] not in ASSESSMENT_BASIS:
                return _error(
                    f"알 수 없는 근거 구분입니다: {payload['basis']} "
                    f"(가능: {', '.join(sorted(ASSESSMENT_BASIS))})", 400)
            assessment.basis = payload['basis']

        db.session.commit()
        return jsonify({'success': True, 'data': assessment.to_dict()})
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


@bp.route('/plans/<int:year>/survey-voices', methods=['POST'])
@office_required
def survey_voices(year):
    """설문 서술형을 AI 로 묶어 읽는다.

    ⚠️ **누를 때만 부른다.** 진단 화면을 열 때마다 LLM 을 부르면 화면이 느려지고
       같은 답에 돈을 반복해서 쓴다. 그래서 GET 이 아니라 POST 다 — 값을 바꾸지는
       않지만, 부르는 것 자체가 비용이라 실수로 새로고침에 딸려 나가면 안 된다.

    ⚠️ 결과를 **저장하지 않는다.** 저장하면 원문이 늘어난 뒤에도 낡은 요약이
       남고, 그것이 어느 시점의 것인지 아무도 모른다.
    """
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)
        # 누가 읽었는지가 로그에 남아야 하므로 신원을 넘긴다.
        viewer_id = int(get_jwt_identity())
        return jsonify({'success': True,
                        'data': summarize_voices(plan, viewer_id)})
    except Exception as e:
        return _error(str(e))


@bp.route('/plans/<int:year>/assessments/apply-survey', methods=['POST'])
@office_required
def apply_survey_evidence(year):
    """설문 제안값을 진단에 **반영한다.** 읽기(진단 조회)와 쓰기를 가른 자리다.

    ⚠️ 한 엔드포인트가 보여주면서 저장하면, 화면을 열어 본 것만으로 진단이 바뀐다.
       그래서 제안값은 진단 조회에 실려 나가기만 하고, 바꾸는 것은 여기다.

    ⚠️ **덮어쓰기 전에 이전 값을 note 에 남긴다.** 남기지 않으면 나중에 "왜
       3이지?" 에 답할 수 없다. 진단값은 사람이 설명할 수 있어야 한다.

    ⚠️ **사람이 손으로 매긴 칸(basis='manual')은 건너뛴다.** 사무국의 판단을
       설문이 조용히 지우면, 다음부터 아무도 이 화면에 판단을 안 적는다.
       그 칸을 정말 바꾸려면 화면에서 직접 고치면 된다.
    """
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)

        payload = request.get_json() or {}
        wanted = payload.get('cells')
        if not isinstance(wanted, list) or not wanted:
            return _error('반영할 칸(cells)이 필요합니다.', 400)

        divisions = get_target_divisions()
        thresholds = get_thresholds()
        min_sample = int(thresholds.get('survey_min_sample', 5) or 5)
        evidence = collect(plan, divisions, min_sample)
        by_cell = {
            (c['survey_id'], c['division_id'], c['dimension']): c
            for c in evidence['cells']
        }

        applied, skipped = [], []
        stamp = datetime.utcnow().strftime('%Y-%m-%d')

        for item in wanted:
            try:
                key = (int(item.get('survey_id')), int(item.get('division_id')),
                       str(item.get('dimension')))
            except (TypeError, ValueError):
                skipped.append({'cell': item, 'reason': '칸 지정이 올바르지 않습니다.'})
                continue

            cell = by_cell.get(key)
            if not cell:
                skipped.append({'cell': item, 'reason': '그 설문에 해당 근거가 없습니다.'})
                continue
            if cell['insufficient'] or cell['suggested_level'] is None:
                skipped.append({
                    'cell': item,
                    'reason': f"표본 부족 (응답 {cell['respondent_count']}명, "
                              f'최소 {min_sample}명)',
                })
                continue

            assessment = StrategyAssessment.query.filter_by(
                plan_id=plan.id, division_id=cell['division_id'],
                category=CATEGORY_ORGANIZATION, dimension=cell['dimension'],
            ).first()

            if assessment and assessment.basis == 'manual'                     and assessment.current_level is not None                     and not payload.get('overwrite_manual'):
                skipped.append({
                    'cell': item,
                    'reason': f'사람이 매긴 값({assessment.current_level})이 있습니다. '
                              '바꾸시려면 그 칸을 직접 고치세요.',
                })
                continue

            if not assessment:
                assessment = StrategyAssessment(
                    plan_id=plan.id, division_id=cell['division_id'],
                    category=CATEGORY_ORGANIZATION, dimension=cell['dimension'],
                )
                db.session.add(assessment)

            before = assessment.current_level
            assessment.current_level = cell['suggested_level']
            assessment.basis = 'survey'
            # 근거를 문장으로 남긴다. 나중에 이 칸만 보고도 되짚어갈 수 있어야 한다.
            trace = (f"{stamp} 설문 반영: {cell['survey_title']} "
                     f"평균 {cell['average']} → {cell['suggested_level']} "
                     f"(응답 {cell['respondent_count']}명"
                     + (f", 이전 값 {before}" if before is not None else "")
                     + ")")
            # 덧붙인다. 덮어쓰면 앞선 반영 기록이 사라져서, 이 칸이 어떻게
            # 여기까지 왔는지 되짚을 수 없다.
            assessment.note = (f'{assessment.note}\n{trace}'
                               if assessment.note else trace)

            applied.append({
                'survey_id': cell['survey_id'],
                'division_id': cell['division_id'],
                'dimension': cell['dimension'],
                'level': cell['suggested_level'],
                'previous_level': before,
            })

        db.session.commit()
        return jsonify({'success': True, 'data': {
            'applied': applied, 'skipped': skipped,
        }})
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
