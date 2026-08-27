"""
Digital Twin Strategy Routes
연도별 전략 기획 API

접근 권한: 사무국/관리자 전용. 화면에서 카드를 가리는 것만으로는 URL 직접 접근을
막지 못하므로 여기서도 같은 기준으로 검사한다.
"""
from datetime import datetime
from functools import wraps

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.shared.timeutil import KST, iso_kst
from app.modules.auth.models import User, UserRole
from .models import (
    StrategyPlan, StrategyAssessment, StrategyMetricTarget, StrategyCrux,
    StrategyIssue, StrategyElement, StrategySolution, StrategyGate,
    StrategyDocument,
)
from .evidence import get_evidence_source
from .metrics import (
    compute_metrics, compute_kpi_coverage, compute_process_metrics,
)
from .findings import (
    derive_findings, derive_kpi_findings, derive_process_findings,
    derive_strategy_link_findings, attach_rules,
)
from .survey_link import (
    attach_current, collect, derive_choice_findings, derive_survey_findings,
)
from .survey_voice import is_available as voices_available, summarize as summarize_voices
from .issues import (
    derive_issue_candidates, derive_survey_candidates, summarize_coverage,
)
from . import intel_link
from .elements import (
    derive_element_candidates, derive_survey_candidates as derive_element_survey,
    summarize_elements,
)
from .threshold_preview import summarize as summarize_thresholds, curve as threshold_curve
from .metric_detail import explain as explain_metric
from .document import (
    SECTIONS as DOC_SECTIONS, SECTION_KEYS, MANUAL_KEYS, assemble, summarize,
)
from .definitions import (
    CATEGORIES, CATEGORY_ORGANIZATION, CATEGORY_TECHNICAL,
    DIMENSION_KEYS_BY_CATEGORY,
    ALL_ASSESSMENT_SLOTS,
    METRICS, METRIC_KEYS, LEVEL_MIN, LEVEL_MAX,
    THRESHOLDS, THRESHOLD_KEYS, THRESHOLD_MAX, DEFAULT_THRESHOLDS,
    GATES, GATE_KEYS, GATE_STATUSES,
    MODULE_KEY, THRESHOLD_SETTINGS_KEY,
    get_target_divisions, get_thresholds,
)

bp = Blueprint('digital_twin_strategy', __name__, url_prefix='/api/digital-twin-strategy')

# ── 권한 ───────────────────────────────────────────────────────────────────
#
# **조회는 모두, 편집은 매니저 이상.**
#
# ⚠️ 한동안 전 화면이 사무국 전용이었다. 그러면 사업부장이 자기 사업부 진단조차
#    못 보고, 전략은 "사무국이 만든 남의 문서"가 된다 — 정작 실행할 조직이 안
#    읽는다. 설문으로 의견은 받으면서 결과는 안 보여주는 구조이기도 했다.
EDIT_ROLES = (UserRole.ADMIN, UserRole.DT_OFFICE_MEMBER, UserRole.MANAGER)


def _current_user():
    return User.query.get(int(get_jwt_identity()))


def can_edit(user):
    return bool(user) and user.role in EDIT_ROLES

# 진단값을 무엇으로 매겼나. models.StrategyAssessment 의 주석과 같은 집합이다.
#   auto  포탈 데이터로 채움 / survey  설문 / manual  손으로 입력
ASSESSMENT_BASIS = {'auto', 'survey', 'manual'}


def view_required(fn):
    """로그인한 사람은 모두 본다.

    ⚠️ **읽기 전용 경로에만 붙인다.** 무엇을 바꾸는 경로에 이걸 달면 아무나
       진단을 고칠 수 있게 된다 — GET 인지 아닌지가 아니라 **바꾸는지**로 가른다.
    """
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        if not _current_user():
            return jsonify({'success': False,
                            'message': '로그인이 필요합니다.'}), 403
        return fn(*args, **kwargs)
    return wrapper


def edit_required(fn):
    """매니저 이상만 바꾼다."""
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        if not can_edit(_current_user()):
            return jsonify({
                'success': False,
                'message': '전략 기획의 편집은 매니저 이상만 할 수 있습니다. '
                           '조회는 그대로 하실 수 있습니다.'
            }), 403
        return fn(*args, **kwargs)
    return wrapper


def _error(message, status=500):
    return jsonify({'success': False, 'message': message}), status


def _crashed():
    """예상 못 한 오류.

    ⚠️ **예외 문자열을 화면에 내보내지 않는다.** `str(e)` 를 그대로 돌려주면
       DB 오류의 테이블·컬럼 이름과 SQL 조각이 사용자 화면에 뜬다. 그리고
       그걸 본 사람은 무엇을 해야 할지 모른다.

    ⚠️ **대신 로그에 남긴다.** 지금까지는 어디에도 안 남아서, 500 이 나면
       원인을 추측할 수밖에 없었다(2026-08-17 실제로 겪음). traceback 이
       있어야 다음에 같은 일이 나도 십 분 안에 찾는다.
    """
    current_app.logger.exception('[전략] %s 실패', request.endpoint or '?')
    return _error('처리 중 오류가 생겼습니다. 잠시 후 다시 해보시고, '
                  '계속되면 관리자에게 알려주세요.')


@bp.route('/meta', methods=['GET'])
@view_required
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
            # 화면이 편집 단추를 감출지 정하는 값. **서버가 정본**이고,
            # 이건 편의다 — 감춰도 막는 것은 위 데코레이터다.
            'canEdit': can_edit(_current_user()),
            'gates': GATES,
            # ④ 에서 솔루션을 지표에 건다. 이름이 아니라 **번호로** 건다 —
            # kpi_records 가 이름 문자열로 물려 있어 라벨이 바뀌면 조용히
            # 끊기는 문제를 여기서까지 반복하지 않는다.
            'kpis': list_kpi_definitions(),
            'thresholdDefinitions': THRESHOLDS,
            'thresholds': get_thresholds(),
        }
    })


@bp.route('/plans/<int:year>/assessments/targets/bump', methods=['POST'])
@edit_required
def bump_targets(year):
    """**목표를 한 번에 한 단계 위로.**

    ⚠️ 진단 격자가 사업부 5 × 차원 10 = 50칸이고, 현재와 목표를 따로 매기면
       클릭이 백 번이다. 그 벽에서 사람은 두 번째 해에 화면을 안 연다.
       그런데 목표는 실제로 거의 늘 「올해 한 단계」다.

    ⚠️ **현재 레벨은 손대지 않는다.** 목표는 의지의 표현이라 일괄로 정해도
       거짓이 안 되지만, 현재 레벨을 복사하면 **안 본 칸이 매긴 값으로 남는다** —
       이 모듈이 계속 피해 온 것(안 매긴 것을 0으로 두지 않는다)과 같은 종류다.

    ⚠️ **이미 정한 목표는 안 덮는다.** 사람이 신중히 정한 값이 단추 하나로
       날아가면 안 된다. 덮고 싶으면 overwrite 를 준다.
    """
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)

        payload = request.get_json() or {}
        step = int(payload.get('step') or 1)
        overwrite = bool(payload.get('overwrite'))
        if not 1 <= step <= 4:
            return _error('한 번에 1~4단계까지만 올립니다.', 400)

        rows = StrategyAssessment.query.filter_by(plan_id=plan.id).all()
        changed, skipped_empty, kept = 0, 0, 0
        for a in rows:
            if a.current_level is None:
                # 현재를 안 매긴 칸은 기준이 없어 목표를 정할 수 없다.
                skipped_empty += 1
                continue
            if a.target_level is not None and not overwrite:
                kept += 1
                continue
            wanted = min(LEVEL_MAX, a.current_level + step)
            if wanted != a.target_level:
                a.target_level = wanted
                changed += 1

        db.session.commit()
        return jsonify({'success': True, 'data': {
            'changed': changed,
            # 안 채운 이유를 돌려준다. 「50칸인데 12칸만 바뀌었다」가 왜인지
            # 화면이 말할 수 있어야 한다.
            'skippedNoLevel': skipped_empty,
            'keptExisting': kept,
        }})
    except Exception:
        db.session.rollback()
        return _crashed()


@bp.route('/plans/<int:year>/thresholds/preview', methods=['GET'])
@edit_required
def threshold_preview(year):
    """지금 설정이면 몇 건인가. key 를 주면 그 값을 **범위 전체로** 훑는다.

    ⚠️ **누를 때만 부른다.** 규칙 전체를 다시 돌리는 일이라 진단 화면을 열
       때마다 하면 안 된다. ⚙ 설정에서만 부른다.

    ⚠️ 편집 권한자만이다. 조회만 하는 사람은 이 값을 바꿀 수 없으니 「이 값이면
       몇 건」을 보여 줄 이유가 없다.
    """
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)

        values = get_thresholds()
        source = get_evidence_source()
        key = (request.args.get('key') or '').strip()

        if key:
            try:
                data = threshold_curve(plan, build_plan_payload, values,
                                       source, key)
            except ValueError as e:
                return _error(str(e), 400)
        else:
            data = {'base': summarize_thresholds(
                plan, build_plan_payload, values, source)}
        return jsonify({'success': True, 'data': data})
    except Exception:
        return _crashed()


@bp.route('/plans/<int:year>/metrics/<metric_key>/detail', methods=['GET'])
@view_required
def metric_detail(year, metric_key):
    """관측값 하나를 **풀어서** 보여준다 — 어떻게 셌고 어느 과제가 그 수를 만들었나.

    division_id  그 사업부만 (없으면 전사)
    process      그 프로세스만. **사업부와 같이 주는 것이 정상**이다 —
                 MX 의 개발과 VD 의 개발은 다른 조직이라 합치면 뜻이 없다
                 (compute_process_metrics 주석과 같은 규칙).

    ⚠️ **누를 때만 부른다.** 관측을 그릴 때마다 지표 10개 × 사업부 5개를 미리
       풀면 payload 가 열 배가 된다.

    ⚠️ 묶는 방법이 compute_metrics 와 **같아야** 한다. 여기서 다르게 묶으면
       화면의 숫자와 목록의 건수가 어긋난다 — 그때 어느 쪽이 맞는지 알 수 없다.
    """
    try:
        source = get_evidence_source()
        projects = source.get_projects(year) or []

        division_id = request.args.get('division_id', type=int)
        process = (request.args.get('process') or '').strip()
        scope = []
        if division_id:
            names = {d.id: d.name for d in get_target_divisions()}
            name = names.get(division_id)
            if not name:
                return _error('대상 사업부가 아닙니다.', 400)
            projects = [p for p in projects if p.get('사업부') == name]
            scope.append(name)
        if process:
            projects = [p for p in projects if (p.get('프로세스') or '') == process]
            scope.append(process)

        data = explain_metric(metric_key, projects)
        data['scope'] = ' · '.join(scope) if scope else '전사'
        # 합친 값임을 화면이 말할 수 있어야 한다(프로세스 전사 합계와 같은 이유).
        data['isCompany'] = not division_id
        return jsonify({'success': True, 'data': data})
    except ValueError as e:
        return _error(str(e), 400)
    except Exception:
        return _crashed()


@bp.route('/settings/thresholds', methods=['PUT'])
@edit_required
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
    except Exception:
        db.session.rollback()
        return _crashed()


def build_plan_payload(plan, thresholds=None, source=None):
    """전략 하나의 **모든 계산 결과**를 조립한다.

    ⚠️ 화면(get_plan)과 ⑤ 기획서와 ⚙ 임계값 미리보기가 **같은 것을 본다.**
       각자 계산하면 "화면에는 발견 사항 12건인데 기획서에는 9건"인 날이 오고,
       그때 어느 쪽이 맞는지 아무도 모른다. 임계값을 한 곳에 모은 것과 같은
       이유다. 그래서 규칙을 다시 구현하는 대신 **이 함수를 다른 임계값으로
       다시 부른다.**

    thresholds  없으면 저장된 값을 쓴다. 미리보기가 「이 값이면 몇 건인가」를
                물을 때 후보 값을 넣는다
    source      없으면 설정이 정한 원천. 미리보기는 **읽은 것을 재사용하는**
                감싼 원천을 넣어 같은 질의를 마흔 번 하지 않게 한다

    저장하지 않는다. 관측·발견 사항·후보는 원본이 바뀌면 따라 바뀌어야 한다.
    """
    year = plan.year
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
    source = source or get_evidence_source()
    try:
        observed, observed_context = compute_metrics(source, year, divisions)
        kpi_coverage = compute_kpi_coverage(source, year, divisions)
        # 같은 과제를 **프로세스로도** 자른다(Value Chain). 사람이 채울
        # 격자가 늘지 않는다 — 축만 바꿔 다시 세는 것이다.
        from app.modules.survey.roles import process_names
        process_list = process_names()
        process_by_division, process_totals, process_unknown = (
            compute_process_metrics(source, year, process_list, divisions))
        metric_error = None
    except NotImplementedError as e:
        observed = {d.id: {k: None for k in METRIC_KEYS} for d in divisions}
        observed_context = {}
        kpi_coverage = []
        process_list, process_by_division, process_totals = [], {}, {}
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
    thresholds = thresholds if thresholds is not None else get_thresholds()
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
            # 같은 과제를 프로세스로 자른 것. 사업부 축이 못 보는 것을 본다.
            + derive_process_findings(process_by_division, process_totals,
                                      process_list, divisions,
                                      thresholds, process_unknown)
        )
    # 설문 규칙은 지표를 못 읽어도 돌아야 한다. 둘은 서로 다른 원천이다.
    findings += derive_survey_findings(survey_evidence, thresholds, min_sample)

    """
    ⚠️ 기술정보(intel)는 **없어도 되는** 원천이다 — 표가 아직 없거나(새 DB) 모듈이
       빠져도 전략 화면은 떠야 한다. 그래서 조용히 빈 값이 아니라 **무엇이 안
       됐는지**를 intelError 로 실어 보낸다(metricsError 와 같은 규칙).
    """
    try:
        intel_evidence = intel_link.attach_current(
            intel_link.collect(divisions, thresholds), assessments)
        findings += intel_link.derive_findings(
            intel_evidence, divisions, thresholds)
        intel_error = None
    except Exception as e:
        intel_evidence = {'cells': [], 'divisions': [], 'total_caps': 0}
        intel_error = str(e)
    findings += derive_choice_findings(plan, thresholds, min_sample, divisions)
    # ⚠️ 정렬은 아래에서 한다. 전략 ↔ 실행 규칙은 솔루션을 읽어야 해서 여기서
    #    낼 수 없고, 여기서 정렬하면 그 규칙만 목록 끝에 붙는다.

    cruxes = [
        c.to_dict() for c in StrategyCrux.query.filter_by(plan_id=plan.id)
        .order_by(StrategyCrux.order, StrategyCrux.id).all()
    ]
    issues = [
        i.to_dict() for i in StrategyIssue.query.filter_by(plan_id=plan.id)
        .order_by(StrategyIssue.order, StrategyIssue.id).all()
    ]
    solutions = [
        x.to_dict() for x in StrategySolution.query.filter_by(plan_id=plan.id)
        .order_by(StrategySolution.tows, StrategySolution.order,
                  StrategySolution.id).all()
    ]
    attach_gates(plan.id, 'solution', solutions)
    # 화면이 uuid 대신 이름을 보여줄 수 있게 한 번에 읽는다.
    linked_uuids = {u for x in solutions for u in (x.get('project_uuids') or [])}
    linked_projects = load_projects(linked_uuids)

    # 전략 ↔ 실행. **④ 를 채운 뒤라야 값이 생긴다** — 솔루션이 하나도 없으면
    # 전부 미연결이라, 짚어 봐야 "아직 시작 안 했다"는 말밖에 안 된다.
    if solutions and not metric_error:
        findings += derive_strategy_link_findings(
            source.get_projects(year), linked_uuids, divisions, thresholds)
    order = {'high': 0, 'medium': 1, 'info': 2}
    findings.sort(key=lambda f: (order.get(f['severity'], 9), f['title']))
    # 어느 규칙에서 나왔는지 붙인다. 화면과 문서가 이걸로 묶는다.
    attach_rules(findings)
    elements = [
        e.to_dict() for e in StrategyElement.query.filter_by(plan_id=plan.id)
        .order_by(StrategyElement.kind, StrategyElement.order,
                  StrategyElement.id).all()
    ]
    # 이미 요소로 올린 것은 후보에서 뺀다. 안 빼면 같은 것이 목록에 계속
    # 남아, 무엇을 아직 안 봤는지 읽을 수 없다(이슈 후보와 같은 규칙).
    taken_elements = {e['source_ref'] for e in elements if e.get('source_ref')}

    # ⚠️ O·T 는 설문과 **기술 소식**에서 온다. 「포탈에 없다」던 시절의 주석은
    #    intel 모듈이 생기면서 낡았다 — 근거가 걸린 소식이 곧 기회·위협의 재료다.
    try:
        intel_elements = intel_link.derive_element_candidates()
    except Exception:
        intel_elements = []
    element_candidates = [
        c for c in (derive_element_candidates(assessments, findings,
                                              divisions, thresholds)
                    + derive_element_survey(plan, min_sample)
                    + intel_elements)
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
        c for c in (derive_issue_candidates(assessments, metrics, divisions,
                                            thresholds)
                    + derive_survey_candidates(findings, promoted))
        if c['key'] not in taken
    ]

    return {
    **plan.to_dict(),
    'assessments': assessments,
    'metrics': metrics,
    'kpiCoverage': kpi_coverage,
    'findings': findings,
    'surveyEvidence': survey_evidence,
    'intelEvidence': intel_evidence,
    'intelError': intel_error,
    # 버튼을 띄울지 정하는 데만 쓴다. 부르는 것은 사람이 누를 때다.
    'surveyVoicesAvailable': voices_available(),
    'cruxes': cruxes,
    'issues': issues,
    'issueCandidates': candidates,
    'issueCoverage': summarize_coverage(cruxes, issues),
    'elements': elements,
    'elementCandidates': element_candidates,
    'elementSummary': summarize_elements(
        elements, element_candidates, assessments, thresholds),
    'solutions': solutions,
    # uuid → 과제. 못 찾는 것은 여기 없다(지워진 과제).
    'linkedProjects': linked_projects,
    # 프로세스 축. 지표 정의는 사업부 축과 **같은 것**을 쓴다 —
    # 축이 다르다고 다른 지표를 재면 두 화면을 견줄 수 없다.
    'processMetrics': {
        'processes': process_list,
        # ⚠️ **사업부 아래에 프로세스가 있다.** MX 의 개발과 VD 의
        #    개발은 다른 조직이라 같은 칸에 놓을 수 없다.
        'byDivision': process_by_division,
        # 전사 합계는 **참고용**이다. 화면이 합친 값임을 말해야 한다.
        'totals': process_totals,
        # 프로세스가 안 적힌 과제. 숨기면 합계가 안 맞는데 이유가
        # 안 보인다.
        'unknownCount': process_unknown,
    },
    'metricsMode': source.mode,
    'metricsError': metric_error,
    }


@bp.route('/plans/<int:year>', methods=['GET'])
@view_required
def get_plan(year):
    """해당 연도 전략 조회. 없으면 data 가 None 이다(404 가 아니다 — 아직 안 만든
    것은 오류가 아니라 정상 상태다)."""
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return jsonify({'success': True, 'data': None})
        return jsonify({'success': True, 'data': build_plan_payload(plan)})
    except Exception:
        return _crashed()


@bp.route('/plans/<int:year>/cruxes', methods=['POST'])
@edit_required
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
    except Exception:
        db.session.rollback()
        return _crashed()


@bp.route('/plans/<int:year>/cruxes/<int:crux_id>/demote', methods=['POST'])
@edit_required
def demote_crux(year, crux_id):
    """**난제를 이슈로 내린다.** (위에서 아래로 — 올린 것을 되돌리는 길)

    ⚠️ 이 길이 없으면 잘못 올린 난제를 **지우는 수밖에 없다.** 그러면 그 사실이
       통째로 사라진다 — 발견 사항에서 올린 것이니 근거는 남아 있지만, 사람이
       "이건 다루기로 했다" 고 판단한 기록은 없어진다.

    한 사이클을 실제로 돌려 보니 난제 열 개 중 여덟 개가 **이슈 0건**이었다
    (2026-08-17). 관측 문장이 난제 자리에 올라가 있었던 것이고, 그것들이
    가야 할 곳은 삭제가 아니라 **다른 난제 아래의 이슈**였다.

    ⚠️ **딸린 이슈도 같이 옮긴다.** 안 옮기면 그 이슈들이 고아가 된다 — 화면이
       빨갛게 경고하는 바로 그 상태를, 정리하려다 만들게 된다.

    ⚠️ **한 트랜잭션이다.** 난제만 지워지고 이슈가 안 생기면 사람이 판단한
       것이 조용히 사라진다.
    """
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)
        crux = StrategyCrux.query.filter_by(id=crux_id, plan_id=plan.id).first()
        if not crux:
            return _error('핵심 난제를 찾을 수 없습니다.', 404)

        payload = request.get_json() or {}
        target_id = payload.get('crux_id')
        if target_id is not None:
            target_id = int(target_id)
            if target_id == crux.id:
                return _error('자기 자신 아래로는 내릴 수 없습니다.', 400)
            target = StrategyCrux.query.filter_by(
                id=target_id, plan_id=plan.id).first()
            if not target:
                return _error('옮길 난제를 찾을 수 없습니다.', 404)

        # 1) 난제를 이슈로. 근거(rationale)는 설명으로 내려간다.
        moved = StrategyIssue(
            plan_id=plan.id, crux_id=target_id, title=crux.title,
            description=crux.rationale, division_id=crux.division_id,
            source_type='crux', source_ref=str(crux.id),
            status='open',
            order=StrategyIssue.query.filter_by(plan_id=plan.id).count(),
        )
        db.session.add(moved)

        # 2) 딸려 있던 이슈들을 새 부모로. 안 옮기면 고아가 된다.
        children = StrategyIssue.query.filter_by(
            plan_id=plan.id, crux_id=crux.id).all()
        for child in children:
            child.crux_id = target_id

        db.session.delete(crux)
        db.session.commit()
        return jsonify({'success': True, 'data': {
            'issue': moved.to_dict(),
            'movedChildren': len(children),
        }})
    except Exception:
        db.session.rollback()
        return _crashed()


@bp.route('/plans/<int:year>/cruxes/from-issues', methods=['POST'])
@edit_required
def crux_from_issues(year):
    """이슈 여러 개를 **묶어서** 핵심 난제를 만든다. (아래에서 위로)

    묶는 대상은 두 가지다.

        issue_ids   이미 있는 이슈 (대개 난제에 안 걸린 고아)
        new_issues  아직 이슈가 아닌 것 — **진단 격차·설문 후보**

    ⚠️ new_issues 가 없으면 후보 여러 개를 새 난제로 묶는 길이 사실상 막힌다.
       후보를 하나씩 「난제 비움」으로 저장해 고아로 만든 뒤 다시 골라 묶어야
       하는데, 세 건이면 대화상자를 네 번 연다. 같은 일을 한 번에 한다.

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

        raw_ids = payload.get('issue_ids') or []
        drafts = payload.get('new_issues') or []
        if not isinstance(raw_ids, list) or not isinstance(drafts, list):
            return _error('묶을 대상이 목록이 아닙니다.', 400)
        if not raw_ids and not drafts:
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
        ).all() if issue_ids else []
        missing = issue_ids - {i.id for i in issues}
        if missing:
            return _error(f"이 전략의 이슈가 아닙니다: {sorted(missing)}", 400)

        # 후보를 이슈로 만든다. **난제보다 먼저 검증한다** — 하나가 틀렸는데
        # 난제만 만들어지면, 빈 난제가 남아 "넘겠다고 해놓고 아무것도 안 하는"
        # 난제처럼 보인다.
        made = []
        base_order = StrategyIssue.query.filter_by(plan_id=plan.id).count()
        for i, draft in enumerate(drafts):
            if not isinstance(draft, dict):
                return _error('후보 항목이 올바르지 않습니다.', 400)
            issue = StrategyIssue(plan_id=plan.id, title='',
                                  order=base_order + i)
            error = _apply_issue_fields(issue, draft, plan)
            if error:
                return _error(f'{i + 1}번째 항목: {error}', 400)
            made.append(issue)

        bundled = issues + made
        crux = StrategyCrux(
            plan_id=plan.id,
            title=title,
            rationale=payload.get('rationale'),
            # 여러 사업부의 이슈를 묶었으면 전사 난제다. 하나뿐이면 그 사업부.
            division_id=(bundled[0].division_id
                         if len({i.division_id for i in bundled}) == 1 else None),
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
        for issue in made:
            issue.crux_id = crux.id
            db.session.add(issue)

        db.session.commit()
        return jsonify({'success': True, 'data': {
            'crux': crux.to_dict(), 'moved': moved,
            'created': [i.id for i in made],
        }}), 201
    except Exception:
        db.session.rollback()
        return _crashed()


@bp.route('/plans/<int:year>/cruxes/<int:crux_id>', methods=['PUT', 'DELETE'])
@edit_required
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
    except Exception:
        db.session.rollback()
        return _crashed()


# ── ② 이슈 ────────────────────────────────────────────────────────────────

# 이 이슈가 어디서 왔나. **후보를 내는 쪽과 같은 집합이어야 한다** —
# issues.derive_survey_candidates 가 'finding' 을 달아 보내는데 여기 없어서,
# 「이슈로」를 누르면 "알 수 없는 출처입니다: finding" 으로 막혔다.
# 후보의 source_type 을 늘릴 때는 여기도 같이 늘려야 한다.
ISSUE_SOURCE_TYPES = {'crux', 'gap', 'metric', 'finding', 'manual'}
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


# ④ 솔루션. TOWS 네 갈래 — 무엇을 무엇으로 푸느냐가 이름에 들어 있다.
TOWS_KINDS = ('SO', 'WO', 'ST', 'WT')

# 각 갈래가 엮을 수 있는 요소. SO 는 강점과 기회를 엮는 솔루션이다.
TOWS_ELEMENTS = {
    'SO': ('S', 'O'), 'WO': ('W', 'O'),
    'ST': ('S', 'T'), 'WT': ('W', 'T'),
}


def _apply_solution_fields(solution, payload, plan):
    """솔루션의 값을 채운다. 오류 메시지를 돌려주며 None 이면 통과."""
    if 'tows' in payload or not solution.tows:
        tows = (payload.get('tows') or '').strip().upper()
        if tows not in TOWS_KINDS:
            return f"SO·WO·ST·WT 중 하나여야 합니다: {payload.get('tows')}"
        solution.tows = tows
    if 'title' in payload or not solution.title:
        title = (payload.get('title') or '').strip()
        if not title:
            return '내용이 비어 있습니다.'
        solution.title = title[:300]
    for field in ('detail', 'division_id'):
        if field in payload:
            setattr(solution, field, payload[field])

    # 사분면 축. **비울 수 있다** — 근거 없이 매긴 숫자는 사분면을 거짓말로 만든다.
    for field in ('impact', 'feasibility'):
        if field in payload:
            raw = payload.get(field)
            if raw in (None, ''):
                setattr(solution, field, None)
                continue
            try:
                value = int(raw)
            except (TypeError, ValueError):
                return f'{field} 는 1~5 의 숫자여야 합니다.'
            if not 1 <= value <= 5:
                return f'{field} 는 1~5 여야 합니다: {value}'
            setattr(solution, field, value)

    if 'kpi_ids' in payload:
        raw = payload.get('kpi_ids') or []
        if not isinstance(raw, list):
            return 'kpi_ids 는 목록이어야 합니다.'
        try:
            wanted = {int(x) for x in raw}
        except (TypeError, ValueError):
            return '지표 번호가 올바르지 않습니다.'
        if wanted:
            from app.modules.dx_kpi_management.models import KpiDefinition
            found = {k.id for k in KpiDefinition.query.filter(
                KpiDefinition.id.in_(wanted)).all()}
            missing = wanted - found
            if missing:
                # 없는 지표에 걸어 두면 그 솔루션은 어느 지표에도 안 걸린 것과 같은데
                # 화면에는 걸린 것처럼 보인다.
                return f'없는 지표입니다: {sorted(missing)}'
        solution.kpi_ids = sorted(wanted)

    if 'element_ids' in payload:
        raw = payload.get('element_ids') or []
        if not isinstance(raw, list):
            return 'element_ids 는 목록이어야 합니다.'
        try:
            wanted = {int(x) for x in raw}
        except (TypeError, ValueError):
            return '전략 요소 번호가 올바르지 않습니다.'
        if wanted:
            found = StrategyElement.query.filter(
                StrategyElement.plan_id == plan.id,
                StrategyElement.id.in_(wanted),
            ).all()
            missing = wanted - {e.id for e in found}
            if missing:
                # ⚠️ 남의 전략 요소를 엮으면 그 근거가 이 전략에서는 안 보인다.
                return f'이 전략의 요소가 아닙니다: {sorted(missing)}'
            # 갈래에 맞는 것만 엮는다. SO 에 위협을 엮으면 그 솔루션이 무엇을
            # 푸는 것인지 이름과 내용이 어긋난다.
            allowed = TOWS_ELEMENTS[solution.tows]
            wrong = [e for e in found if e.kind not in allowed]
            if wrong:
                return (f"{solution.tows} 는 {'·'.join(allowed)} 만 엮습니다: "
                        + ', '.join(f'{e.kind} {e.title}' for e in wrong))
        solution.element_ids = sorted(wanted)

    if 'project_uuids' in payload:
        raw = payload.get('project_uuids') or []
        if not isinstance(raw, list):
            return 'project_uuids 는 목록이어야 합니다.'
        wanted = {str(x) for x in raw if str(x).strip()}
        if wanted:
            from app.modules.digital_twin_dashboard.models_v2 import Dt2Project
            # 지운 과제는 **없는 과제로 본다.** 걸 수 있게 두면 휴지통에 있는
            # 것을 근거로 "하고 있다"고 말하는 솔루션이 생긴다.
            found = {p.uuid for p in Dt2Project.query.filter(
                Dt2Project.uuid.in_(wanted),
                Dt2Project.is_deleted.isnot(True)).all()}
            missing = wanted - found
            if missing:
                # 없는 과제에 걸어 두면 그 솔루션은 아무것도 안 하는 것과 같은데
                # 화면에는 하고 있는 것처럼 보인다.
                return f'없는 과제입니다: {sorted(missing)}'
        solution.project_uuids = sorted(wanted)
    return None


def list_kpi_definitions():
    """솔루션을 걸 수 있는 지표 목록.

    platform 종류도 함께 낸다. 달성률이 없을 뿐 **전략이 겨누는 대상**이기는
    같아서다 — 시스템을 만드는 솔루션을 걸 곳이 없으면 그 솔루션만 지표에서 빠진다.
    """
    try:
        from app.modules.dx_kpi_management.models import KpiDefinition
    except Exception:
        return []
    rows = KpiDefinition.query.order_by(
        KpiDefinition.sort_order, KpiDefinition.id).all()
    return [{
        'id': k.id,
        'label': k.label,
        'category': k.category,
        'unit': k.unit,
        'kind': k.kind or 'metric',
        # 빈 배열이면 전 사업부 공통이다.
        'divisions': k.divisions or [],
    } for k in rows]


def attach_gates(plan_id, target_type, items):
    """항목마다 게이트 답을 얹는다. **답한 것만 들어 있다.**

    화면은 다섯 축(meta.gates)을 늘 그리고, 여기 없는 축은 안 답한 것으로 본다.
    빈 다섯 줄을 미리 만들지 않는 이유는 그 빈 줄이 "답했는데 내용이 없는 것"과
    구별되지 않아서다.
    """
    if not items:
        return items
    rows = StrategyGate.query.filter(
        StrategyGate.plan_id == plan_id,
        StrategyGate.target_type == target_type,
        StrategyGate.target_id.in_([x['id'] for x in items]),
    ).all()

    by_target = {}
    for r in rows:
        by_target.setdefault(r.target_id, {})[r.gate] = {
            'answer': r.answer, 'status': r.status,
        }
    for item in items:
        item['gates'] = by_target.get(item['id'], {})
    return items


def clear_gates(plan_id, target_type, target_id):
    """대상을 지울 때 게이트도 지운다.

    ⚠️ target_id 에 외래키가 없어 DB 가 대신 해주지 않는다. 안 지우면 나중에 같은
       번호를 받은 다른 항목에 남의 답이 붙는다.
    """
    StrategyGate.query.filter_by(
        plan_id=plan_id, target_type=target_type, target_id=target_id,
    ).delete(synchronize_session=False)


@bp.route('/plans/<int:year>/solutions/<int:solution_id>/gates/<gate>',
          methods=['PUT', 'DELETE'])
@edit_required
def set_solution_gate(year, solution_id, gate):
    """게이트 하나에 답한다. **막는 관문이 아니라 표시다.**

    PUT    {answer, status}  — status 는 answered | na
    DELETE                   — 답을 지운다(안 답한 상태로 되돌린다)
    """
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)
        if gate not in GATE_KEYS:
            return _error(f'알 수 없는 게이트입니다: {gate}', 400)
        solution = StrategySolution.query.filter_by(
            id=solution_id, plan_id=plan.id).first()
        if not solution:
            return _error('솔루션을 찾을 수 없습니다.', 404)

        row = StrategyGate.query.filter_by(
            plan_id=plan.id, target_type='solution',
            target_id=solution.id, gate=gate).first()

        if request.method == 'DELETE':
            if row:
                db.session.delete(row)
                db.session.commit()
            return jsonify({'success': True})

        payload = request.get_json() or {}
        answer = (payload.get('answer') or '').strip()
        status = (payload.get('status') or 'answered').strip()
        if status not in GATE_STATUSES:
            return _error(f'알 수 없는 상태입니다: {status}', 400)
        if not answer:
            # ⚠️ '해당 없음'도 이유를 적어야 한다. 이유 없는 해당 없음은 안 답한
            #    것과 구별이 안 되면서 화면에서는 다 채운 것처럼 보인다.
            return _error('내용이 비어 있습니다. 해당 없음도 이유를 적어야 합니다.',
                          400)

        if not row:
            row = StrategyGate(plan_id=plan.id, target_type='solution',
                               target_id=solution.id, gate=gate)
            db.session.add(row)
        row.answer = answer
        row.status = status
        db.session.commit()
        return jsonify({'success': True,
                        'data': {'gate': gate, 'answer': answer,
                                 'status': status}})
    except Exception:
        db.session.rollback()
        return _crashed()


def _document_row(plan):
    """기획서 행. 없으면 만든다 — 전략마다 한 벌이라 따로 만들 이유가 없다."""
    row = StrategyDocument.query.filter_by(plan_id=plan.id).first()
    if not row:
        row = StrategyDocument(plan_id=plan.id, sections={}, status='draft')
        db.session.add(row)
        db.session.commit()
    return row


def _document_view(plan, row):
    """확정본이면 굳은 것을, 아니면 지금 데이터로 조립한 것을 돌려준다."""
    if row.status == 'confirmed' and row.snapshot:
        sections = row.snapshot.get('sections') or []
    else:
        payload = build_plan_payload(plan)
        sections = assemble(
            payload,
            [{'id': d.id, 'name': d.name} for d in get_target_divisions()],
            list_kpi_definitions(),
            row.sections or {},
        )
    return {
        'status': row.status,
        # 오프셋 없이 내보내면 브라우저가 로컬로 읽어 아홉 시간 어긋난다.
        'confirmedAt': iso_kst(row.confirmed_at),
        'sections': sections,
        'summary': summarize(sections),
        # 화면이 목차와 도움말을 여기서 받는다. 두 곳에 적으면 갈라진다.
        'definitions': DOC_SECTIONS,
    }


@bp.route('/plans/<int:year>/document', methods=['GET'])
@view_required
def get_document(year):
    """기획서를 본다.

    ⚠️ **평소에는 살아 있다.** 진단을 고치면 문서도 따라 바뀐다 — 본문을
       복사해 두지 않기 때문이다. 확정한 뒤에는 그 시점이 굳는다.
    """
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)
        return jsonify({'success': True,
                        'data': _document_view(plan, _document_row(plan))})
    except Exception:
        return _crashed()


@bp.route('/plans/<int:year>/document', methods=['PUT'])
@edit_required
def update_document(year):
    """사람이 정하는 것만 저장한다 — 구간 포함 여부와 손으로 쓴 글."""
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)
        row = _document_row(plan)
        if row.status == 'confirmed':
            # ⚠️ 확정본을 고치면 승인받은 문서가 조용히 달라진다.
            return _error('확정된 기획서입니다. 되돌린 뒤에 고치세요.', 409)

        payload = request.get_json() or {}
        raw = payload.get('sections')
        if not isinstance(raw, dict):
            return _error('sections 는 객체여야 합니다.', 400)

        saved = dict(row.sections or {})
        for key, conf in raw.items():
            if key not in SECTION_KEYS:
                return _error(f'알 수 없는 구간입니다: {key}', 400)
            if not isinstance(conf, dict):
                return _error(f'{key} 설정이 올바르지 않습니다.', 400)
            entry = dict(saved.get(key) or {})
            if 'included' in conf:
                entry['included'] = bool(conf['included'])
            if 'text' in conf:
                if key not in MANUAL_KEYS:
                    # 조립 구간에 글을 넣게 두면 그 글이 단계와 갈라진다.
                    return _error(f'{key} 는 단계에서 조립됩니다. 글을 넣을 수 '
                                  f'없습니다.', 400)
                entry['text'] = (conf['text'] or '')[:20000]
            saved[key] = entry

        row.sections = saved
        db.session.commit()
        return jsonify({'success': True, 'data': _document_view(plan, row)})
    except Exception:
        db.session.rollback()
        return _crashed()


@bp.route('/plans/<int:year>/document/status', methods=['PUT'])
@edit_required
def set_document_status(year):
    """확정하거나 되돌린다.

    확정하면 **그 시점의 조립 결과를 통째로 복사**해 둔다. 그래야 승인받은
    문서가 뒤에서 바뀌지 않는다.
    """
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)
        row = _document_row(plan)

        status = ((request.get_json() or {}).get('status') or '').strip()
        if status not in ('draft', 'confirmed'):
            return _error(f'알 수 없는 상태입니다: {status}', 400)

        if status == 'confirmed':
            view = _document_view(plan, StrategyDocument(
                plan_id=plan.id, sections=row.sections, status='draft'))
            row.snapshot = {'sections': view['sections']}
            # ⚠️ **UTC 로 저장한다.** 이 표의 created_at·updated_at 이 전부
            #    utcnow 이고, 직렬화가 「naive 는 UTC」로 보고 KST 를 붙인다
            #    (app/shared/timeutil.py). 여기만 로컬시로 넣으면 한 표에 시계가
            #    두 개가 되고, 확정 시각이 아홉 시간 뒤로 표시된다.
            row.confirmed_at = datetime.utcnow()
            row.confirmed_by = int(get_jwt_identity())
        else:
            # 되돌리면 굳은 것을 버린다. 남겨 두면 다음에 확정할 때 어느 쪽이
            # 보이는지 헷갈린다.
            row.snapshot = None
            row.confirmed_at = None
            row.confirmed_by = None
        row.status = status

        # ⚠️ **전략의 상태는 기획서를 따라간다.** 두 곳에서 따로 정하게 두면
        #    "전략은 확정인데 기획서는 초안" 같은 상태가 생기고, 그때 무엇이
        #    맞는지 아무도 모른다. 확정의 정의는 하나다 — 기획서를 굳혔는가.
        plan.status = status
        db.session.commit()
        return jsonify({'success': True, 'data': _document_view(plan, row)})
    except Exception:
        db.session.rollback()
        return _crashed()


@bp.route('/plans/<int:year>/document/export', methods=['GET'])
@view_required
def export_document(year):
    """Word 로 내보낸다.

    ⚠️ **슬라이드가 아니라 문서다.** 난제·발견 사항·솔루션의 근거는 문장이라,
       슬라이드에 넣으면 글자만 빽빽한 장이 된다. 발표용이 필요하면 이 문서에서
       추려 만드는 것이 맞다.
    """
    from io import BytesIO
    from flask import send_file
    from .docx_writer import write_document

    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)
        view = _document_view(plan, _document_row(plan))

        stream = BytesIO()
        write_document(stream, plan, view)
        stream.seek(0)
        return send_file(
            stream, as_attachment=True,
            download_name=f'{plan.year}년_디지털트윈_전략기획서.docx',
            mimetype='application/vnd.openxmlformats-officedocument'
                     '.wordprocessingml.document')
    except Exception:
        return _crashed()


# 과제 검색 상한. 한 해치(개발 DB 실측 220여 건)는 다 내려도 되는 양이라,
# 이 상한은 검색이 폭주하는 것만 막는다. **모듈 상수로 둔 것은 시험하기 위해서다** —
# 함수 안에 숨겨 두면 "잘랐을 때 잘랐다고 말하는가"를 확인할 길이 없다.
PROJECT_SEARCH_LIMIT = 300


def load_projects(uuids):
    """연결된 과제의 이름표. **화면이 uuid 를 그대로 보여줄 수는 없다.**

    못 찾는 것은 조용히 빠진다 — 과제가 지워졌으면 근거가 사라진 것이지 이
    솔루션이 틀린 것이 아니다(전략 요소와 같은 규칙).
    """
    if not uuids:
        return {}
    from app.modules.digital_twin_dashboard.models_v2 import Dt2Project
    rows = Dt2Project.query.filter(Dt2Project.uuid.in_(list(uuids)),
                                   Dt2Project.is_deleted.isnot(True)).all()
    return {p.uuid: {
        'uuid': p.uuid, 'code': p.code, 'title': p.title,
        'division': p.division, 'year': p.year, 'status': p.status,
    } for p in rows}


@bp.route('/plans/<int:year>/projects', methods=['GET'])
@view_required
def search_projects(year):
    """솔루션에 걸 과제를 찾는다.

    개발 DB 실측(2026-08-17): 전체 436건, 그중 2026년 222건, 사업부별 28~97건.
    **한 해치를 다 내려도 되는 양**이지만, 그래도 범위를 좁혀 내민다 — 목록이
    222줄이면 스크롤로 찾는 것보다 검색이 빠르고, 무엇보다 **고를 것이 그
    사업부 안에 있을 확률이 높다.**

    기본은 그 전략 연도이고, 사업부를 주면 그 사업부부터 본다. 이름으로 검색하면
    그 범위를 넘어 찾는다(연도를 걸치는 과제가 있다 — 2027·2028년 것도 9건 있다).

    limit 100 은 검색 결과가 폭주하는 것만 막는 안전장치다. 지금 규모에서는
    거의 안 걸린다.
    """
    from app.modules.digital_twin_dashboard.models_v2 import Dt2Project

    try:
        q = (request.args.get('q') or '').strip()
        division_id = request.args.get('division_id', type=int)

        # 지운 과제는 고를 수 없다. 목록에 내밀면 걸 수 있는 것처럼 보인다.
        query = Dt2Project.query.filter(Dt2Project.is_deleted.isnot(True))
        if q:
            like = f'%{q}%'
            query = query.filter(db.or_(Dt2Project.title.ilike(like),
                                        Dt2Project.code.ilike(like)))
        else:
            # 검색어가 없을 때만 범위를 좁힌다. 찾으러 온 사람을 막지 않는다.
            query = query.filter(Dt2Project.year == year)
            if division_id:
                query = query.filter(Dt2Project.division_id == division_id)

        # ⚠️ **자르면 자른다고 말한다.** 한 해가 220여 건이라 상한에 잘 안
        #    닿지만, 닿았을 때 조용히 100건만 보이면 찾던 과제가 없는 것과
        #    구별이 안 된다 — 이 모듈이 다른 곳에서 거부해 온 동작이다.
        total = query.count()
        rows = (query.order_by(Dt2Project.year.desc(), Dt2Project.code)
                .limit(PROJECT_SEARCH_LIMIT).all())
        return jsonify({'success': True, 'data': {
            'total': total,
            'truncated': total > len(rows),
            'items': [{
                'uuid': p.uuid, 'code': p.code, 'title': p.title,
                'division': p.division, 'year': p.year, 'status': p.status,
            } for p in rows],
        }})
    except Exception:
        return _crashed()


@bp.route('/plans/<int:year>/solutions', methods=['POST'])
@edit_required
def create_solution(year):
    """솔루션 추가. SWOT 을 엮어 만든 솔루션 하나다."""
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)

        solution = StrategySolution(
            plan_id=plan.id, tows='', title='', element_ids=[], kpi_ids=[],
            project_uuids=[],
            order=StrategySolution.query.filter_by(plan_id=plan.id).count(),
        )
        error = _apply_solution_fields(solution, request.get_json() or {}, plan)
        if error:
            return _error(error, 400)

        db.session.add(solution)
        db.session.commit()
        return jsonify({'success': True, 'data': solution.to_dict()}), 201
    except Exception:
        db.session.rollback()
        return _crashed()


@bp.route('/plans/<int:year>/solutions/<int:solution_id>',
          methods=['PUT', 'DELETE'])
@edit_required
def modify_solution(year, solution_id):
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)
        solution = StrategySolution.query.filter_by(
            id=solution_id, plan_id=plan.id).first()
        if not solution:
            return _error('솔루션을 찾을 수 없습니다.', 404)

        if request.method == 'DELETE':
            # 게이트에는 외래키가 없다. 여기서 안 지우면 나중에 같은 번호를
            # 받은 다른 솔루션에 남의 답이 붙는다.
            clear_gates(plan.id, 'solution', solution.id)
            db.session.delete(solution)
            db.session.commit()
            return jsonify({'success': True})

        error = _apply_solution_fields(solution, request.get_json() or {}, plan)
        if error:
            return _error(error, 400)
        db.session.commit()
        return jsonify({'success': True, 'data': solution.to_dict()})
    except Exception:
        db.session.rollback()
        return _crashed()


@bp.route('/plans/<int:year>/elements', methods=['POST'])
@edit_required
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
    except Exception:
        db.session.rollback()
        return _crashed()


@bp.route('/plans/<int:year>/elements/<int:element_id>',
          methods=['PUT', 'DELETE'])
@edit_required
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
    except Exception:
        db.session.rollback()
        return _crashed()


@bp.route('/plans/<int:year>/issues', methods=['POST'])
@edit_required
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
    except Exception:
        db.session.rollback()
        return _crashed()


@bp.route('/plans/<int:year>/issues/<int:issue_id>', methods=['PUT', 'DELETE'])
@edit_required
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
    except Exception:
        db.session.rollback()
        return _crashed()


@bp.route('/plans', methods=['POST'])
@edit_required
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
    except Exception:
        db.session.rollback()
        return _crashed()


@bp.route('/plans/<int:year>/assessments/<int:division_id>/<category>/<dimension>',
          methods=['PUT'])
@edit_required
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
    except Exception:
        db.session.rollback()
        return _crashed()


@bp.route('/plans/<int:year>/survey-voices', methods=['POST'])
@edit_required
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
    except Exception:
        return _crashed()


@bp.route('/plans/<int:year>/assessments/apply-survey', methods=['POST'])
@edit_required
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
        # ⚠️ **사람이 읽는 날짜다.** UTC 로 찍으면 한국시간 자정~아침 아홉 시
        #    사이에 「어제」가 적힌다. 메모에 남는 값이라 나중에 그 날짜를 보고
        #    무슨 일이 있었는지 되짚는다.
        stamp = datetime.now(KST).strftime('%Y-%m-%d')

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
    except Exception:
        db.session.rollback()
        return _crashed()


@bp.route('/plans/<int:year>/assessments/apply-intel', methods=['POST'])
@edit_required
def apply_intel_evidence(year):
    """기술정보 후보 레벨을 technical 진단에 **반영한다.** (apply-survey 의 짝)

    ⚠️ 같은 규칙 셋 — 조회는 보여주기만 하고 반영은 여기서만 · **사람이 손으로
       매긴 칸(basis='manual')은 건너뛴다** · 이전 값과 근거를 note 에 덧붙인다.
       규칙이 설문과 갈리면 「왜 설문은 안 덮는데 인텔은 덮지?」가 된다.
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
        collected = intel_link.collect(divisions, thresholds)
        by_cell = {
            (c['division_id'], c['dimension']): c
            for c in collected['cells']
        }

        applied, skipped = [], []
        stamp = datetime.now(KST).strftime('%Y-%m-%d')

        for item in wanted:
            try:
                key = (int(item.get('division_id')), str(item.get('dimension')))
            except (TypeError, ValueError):
                skipped.append({'cell': item, 'reason': '칸 지정이 올바르지 않습니다.'})
                continue

            cell = by_cell.get(key)
            if not cell:
                skipped.append({'cell': item, 'reason': '그 칸에는 후보가 없습니다.'})
                continue
            if cell['insufficient'] or cell['suggested_level'] is None:
                skipped.append({'cell': item, 'reason': cell['insufficient']
                                or '후보 레벨이 없습니다.'})
                continue

            assessment = StrategyAssessment.query.filter_by(
                plan_id=plan.id, division_id=cell['division_id'],
                category=CATEGORY_TECHNICAL, dimension=cell['dimension'],
            ).first()

            if assessment and assessment.basis == 'manual' \
                    and assessment.current_level is not None \
                    and not payload.get('overwrite_manual'):
                skipped.append({
                    'cell': item,
                    'reason': f'사람이 매긴 값({assessment.current_level})이 있습니다. '
                              '바꾸시려면 그 칸을 직접 고치세요.',
                })
                continue

            if not assessment:
                assessment = StrategyAssessment(
                    plan_id=plan.id, division_id=cell['division_id'],
                    category=CATEGORY_TECHNICAL, dimension=cell['dimension'],
                )
                db.session.add(assessment)

            before = assessment.current_level
            assessment.current_level = cell['suggested_level']
            assessment.basis = 'auto'
            stages = ' · '.join(f'{k} {v}' for k, v in
                                sorted((cell.get('stages') or {}).items()))
            trace = (f"{stamp} 기술 레이더 반영: 역량 {cell['considered']}개"
                     f"({stages}) → {cell['suggested_level']}"
                     + (f", 이전 값 {before}" if before is not None else ""))
            # 덧붙인다 — 덮어쓰면 이 칸이 어떻게 여기까지 왔는지 되짚을 수 없다.
            assessment.note = (assessment.note + '\n' + trace
                               if assessment.note else trace)

            applied.append({
                'division_id': cell['division_id'],
                'dimension': cell['dimension'],
                'level': cell['suggested_level'],
                'previous_level': before,
            })

        db.session.commit()
        return jsonify({'success': True, 'data': {
            'applied': applied, 'skipped': skipped,
        }})
    except Exception:
        db.session.rollback()
        return _crashed()


@bp.route('/plans/<int:year>/metric-targets/<int:division_id>/<metric_key>',
          methods=['PUT'])
@edit_required
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
    except Exception:
        db.session.rollback()
        return _crashed()


@bp.route('/evidence-preview/<int:year>', methods=['GET'])
@edit_required
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
