"""
설문 API.

**`routes.py` 와 파일을 나눈 이유는 권한 기준이 다르기 때문이다.** 그쪽은 모든
엔드포인트에 `office_required` 가 걸려 있는데, 설문 응답은 전사 대상이라 로그인만
요구한다. 같은 파일에 두면 데코레이터를 실수로 붙이거나 빠뜨렸을 때 조용히
막히거나 조용히 열린다.

    admin_bp   /api/digital-twin-strategy/...   사무국·관리자 — 만들기·집계
    respond_bp /api/surveys/...                 전원 — 내가 받은 설문에 응답

계획서: frontend/src/modules/digital-twin-strategy/SURVEY_PLAN.md
"""
from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.modules.auth.models import User
from .models import (
    StrategyPlan, StrategySurvey, StrategySurveyQuestion,
    StrategySurveyResponse, StrategySurveyAnswer, StrategySurveyAccessLog,
)
from .routes import office_required, _error

admin_bp = Blueprint(
    'strategy_survey_admin', __name__,
    url_prefix='/api/digital-twin-strategy'
)
respond_bp = Blueprint('strategy_survey_respond', __name__, url_prefix='/api/surveys')


QTYPES = {'scale', 'choice', 'rank', 'text'}
TARGET_TYPES = {'all', 'department', 'role', 'user'}
STATUSES = {'draft', 'open', 'closed'}


# ── 대상자 판정 ────────────────────────────────────────────────────────────
#
# ⚠️ **이 함수 하나만 쓴다.** 목록·조회·제출 세 곳에 판정을 흩어 쓰면, 목록에는
#    안 뜨는데 URL 로는 제출되는 구멍이 생긴다. 화면에서 가리는 것은 방어가
#    아니다 — 막는 곳은 여기 한 곳이다.

def is_target(user, survey):
    """이 사용자가 이 설문의 대상인가."""
    refs = survey.target_refs or []

    if survey.target_type == 'all':
        return True
    if survey.target_type == 'role':
        return user.role in refs
    if survey.target_type == 'user':
        # JSON 에서 온 값이라 문자열일 수 있다. 숫자로 맞춰 비교한다 —
        # 비교가 어긋나면 '아무도 대상이 아닌 설문'이 조용히 만들어진다.
        return user.id in {int(r) for r in refs if str(r).lstrip('-').isdigit()}
    if survey.target_type == 'department':
        # 부서는 이름으로 맞춘다. users.department 가 비어 있으면 대상이 아니다.
        return bool(user.department) and user.department in refs
    return False


def target_user_ids(survey):
    """대상자 id 목록. 응답률을 말하려면 분모가 있어야 한다.

    "3.2점"만 보여주는 집계는 몇 명이 답했는지 모르는 평균이라 판단에 못 쓴다.
    """
    users = User.query.filter_by(is_active=True).all()
    return [u.id for u in users if is_target(u, survey)]


def resolve_division(user):
    """응답자의 사업부를 유도한다.

    users.department → departments.division_id 로 잇는다. 개발 DB 에서는 둘 다
    비어 있어 대부분 (None, 'unknown') 이 나온다(SURVEY_PLAN 5절). 그때는
    응답자가 직접 고르게 하고, 그것도 없으면 unknown 으로 남긴다 —
    **모르는 것을 아무 사업부에나 넣으면 집계가 거짓말을 한다.**
    """
    if not user.department:
        return None, 'unknown'
    try:
        from app.modules.digital_twin_dashboard.models import Department
        row = Department.query.filter_by(name=user.department).first()
    except Exception:
        return None, 'unknown'
    if row and row.division_id:
        return row.division_id, 'profile'
    return None, 'unknown'


# ── 직렬화 ────────────────────────────────────────────────────────────────
#
# ⚠️ **응답을 내보내는 곳은 이 함수 하나뿐이다.** 라우트마다 user_id 를 지우는
#    코드를 쓰면 한 곳만 빠뜨려도 신원이 샌다. 기본값이 '가린다' 인 것이 요점 —
#    깜빡하면 가려지는 쪽으로 실패해야 한다.

def serialize_response(response, reveal=False, user_names=None):
    """응답 한 벌을 화면에 보낼 모양으로. reveal=True 는 관리자 확인용이다."""
    data = {
        'id': response.id,
        'department_name': response.department_name,
        'division_id': response.division_id,
        'division_source': response.division_source,
        'submitted_at': response.submitted_at.isoformat() if response.submitted_at else None,
        'answers': [
            {
                'question_id': a.question_id,
                'value_number': a.value_number,
                'value_text': a.value_text,
                'value_json': a.value_json,
            }
            for a in response.answers.all()
        ],
    }
    if reveal:
        data['user_id'] = response.user_id
        data['user_name'] = (user_names or {}).get(response.user_id)
    return data


def _survey_dict(survey, with_questions=False, counts=None):
    d = {
        'id': survey.id,
        'plan_id': survey.plan_id,
        'title': survey.title,
        'description': survey.description,
        'stage': survey.stage,
        'target_type': survey.target_type,
        'target_refs': survey.target_refs or [],
        'status': survey.status,
        'closes_at': survey.closes_at.isoformat() if survey.closes_at else None,
    }
    if counts:
        d.update(counts)
    if with_questions:
        d['questions'] = [_question_dict(q) for q in survey.questions.all()]
    return d


def _question_dict(q):
    return {
        'id': q.id,
        'order': q.order,
        'text': q.text,
        'help_text': q.help_text,
        'qtype': q.qtype,
        'required': q.required,
        'options': q.options or {},
        'link_category': q.link_category,
        'link_dimension': q.link_dimension,
    }


def _accepting(survey, now=None):
    """지금 응답을 받는 상태인가. 상태와 마감시각을 **둘 다** 본다."""
    now = now or datetime.utcnow()
    if survey.status != 'open':
        return False
    if survey.closes_at and now > survey.closes_at:
        return False
    return True


def _apply_questions(survey, items):
    """문항을 통째로 교체한다. 돌려주는 값은 오류 메시지이며 None 이면 통과."""
    if not isinstance(items, list):
        return 'questions 는 목록이어야 합니다.'

    for q in survey.questions.all():
        db.session.delete(q)

    for i, item in enumerate(items or []):
        text = (item.get('text') or '').strip()
        if not text:
            return f'{i + 1}번 문항의 내용이 비어 있습니다.'
        qtype = item.get('qtype') or 'scale'
        if qtype not in QTYPES:
            return f'{i + 1}번 문항의 유형을 알 수 없습니다: {qtype}'
        db.session.add(StrategySurveyQuestion(
            survey=survey,
            order=item.get('order', i),
            text=text,
            help_text=item.get('help_text'),
            qtype=qtype,
            required=bool(item.get('required', True)),
            options=item.get('options') or {},
            link_category=item.get('link_category'),
            link_dimension=item.get('link_dimension'),
        ))
    return None


# ══ 관리자용 ═══════════════════════════════════════════════════════════════

@admin_bp.route('/plans/<int:year>/surveys', methods=['GET'])
@office_required
def list_surveys(year):
    plan = StrategyPlan.query.filter_by(year=year).first()
    if not plan:
        return jsonify({'success': True, 'data': []})

    surveys = StrategySurvey.query.filter_by(plan_id=plan.id) \
        .order_by(StrategySurvey.id.desc()).all()
    out = []
    for s in surveys:
        targets = target_user_ids(s)
        out.append(_survey_dict(s, counts={
            'target_count': len(targets),
            'response_count': s.responses.filter(
                StrategySurveyResponse.submitted_at.isnot(None)
            ).count(),
            'question_count': s.questions.count(),
        }))
    return jsonify({'success': True, 'data': out})


@admin_bp.route('/plans/<int:year>/surveys', methods=['POST'])
@office_required
def create_survey(year):
    try:
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            return _error(f'{year}년 전략이 없습니다.', 404)

        payload = request.get_json() or {}
        title = (payload.get('title') or '').strip()
        if not title:
            return _error('title 이 필요합니다.', 400)

        target_type = payload.get('target_type') or 'all'
        if target_type not in TARGET_TYPES:
            return _error(f'알 수 없는 대상 구분입니다: {target_type}', 400)

        survey = StrategySurvey(
            plan_id=plan.id,
            title=title,
            description=payload.get('description'),
            stage=payload.get('stage') or 'assessment',
            target_type=target_type,
            target_refs=payload.get('target_refs') or [],
            created_by=int(get_jwt_identity()),
        )
        db.session.add(survey)
        db.session.flush()

        error = _apply_questions(survey, payload.get('questions') or [])
        if error:
            db.session.rollback()
            return _error(error, 400)

        db.session.commit()
        return jsonify({'success': True, 'data': _survey_dict(survey, with_questions=True)}), 201
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


@admin_bp.route('/surveys/<int:survey_id>', methods=['GET', 'PUT', 'DELETE'])
@office_required
def modify_survey(survey_id):
    try:
        survey = StrategySurvey.query.get(survey_id)
        if not survey:
            return _error('설문을 찾을 수 없습니다.', 404)

        if request.method == 'GET':
            return jsonify({'success': True, 'data': _survey_dict(
                survey, with_questions=True,
                counts={'target_count': len(target_user_ids(survey))},
            )})

        if request.method == 'DELETE':
            db.session.delete(survey)
            db.session.commit()
            return jsonify({'success': True})

        payload = request.get_json() or {}

        # 응답이 들어온 뒤 문항을 바꾸면 이미 받은 답이 무엇에 대한 답이었는지
        # 알 수 없게 된다. 제목·설명은 고칠 수 있어도 문항은 잠근다.
        has_responses = survey.responses.count() > 0
        if 'questions' in payload and has_responses:
            return _error('이미 응답이 있어 문항을 바꿀 수 없습니다. '
                          '새 설문을 만드세요.', 409)

        if 'title' in payload:
            title = (payload['title'] or '').strip()
            if not title:
                return _error('title 은 비울 수 없습니다.', 400)
            survey.title = title
        if 'target_type' in payload:
            if payload['target_type'] not in TARGET_TYPES:
                return _error(f"알 수 없는 대상 구분입니다: {payload['target_type']}", 400)
            survey.target_type = payload['target_type']
        for field in ('description', 'stage', 'target_refs'):
            if field in payload:
                setattr(survey, field, payload[field])

        if 'questions' in payload:
            error = _apply_questions(survey, payload['questions'])
            if error:
                db.session.rollback()
                return _error(error, 400)

        db.session.commit()
        return jsonify({'success': True, 'data': _survey_dict(survey, with_questions=True)})
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


@admin_bp.route('/surveys/<int:survey_id>/status', methods=['PUT'])
@office_required
def set_survey_status(survey_id):
    """배포(open)·마감(close). 되돌리는 것도 여기서 한다."""
    try:
        survey = StrategySurvey.query.get(survey_id)
        if not survey:
            return _error('설문을 찾을 수 없습니다.', 404)

        payload = request.get_json() or {}
        status = payload.get('status')
        if status not in STATUSES:
            return _error(f'알 수 없는 상태입니다: {status}', 400)

        # 문항 없는 설문을 배포하면 받는 사람이 빈 화면을 본다.
        if status == 'open' and survey.questions.count() == 0:
            return _error('문항이 없는 설문은 배포할 수 없습니다.', 400)

        if 'closes_at' in payload:
            value = payload['closes_at']
            survey.closes_at = datetime.fromisoformat(value) if value else None

        survey.status = status
        db.session.commit()
        return jsonify({'success': True, 'data': _survey_dict(survey)})
    except ValueError:
        db.session.rollback()
        return _error('closes_at 형식이 올바르지 않습니다.', 400)
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


@admin_bp.route('/surveys/<int:survey_id>/results', methods=['GET'])
@office_required
def survey_results(survey_id):
    """집계. **응답자 신원은 실리지 않는다.**

    응답 수를 항상 같이 낸다. 몇 명이 답했는지 모르는 평균은 숫자 구경이다.
    소속을 모르는 응답도 따로 센다 — 숨기면 그럴듯한 사업부별 평균이 나오는데
    실은 절반이 어디 것인지 모르는 상태가 된다.
    """
    survey = StrategySurvey.query.get(survey_id)
    if not survey:
        return _error('설문을 찾을 수 없습니다.', 404)

    responses = survey.responses.filter(
        StrategySurveyResponse.submitted_at.isnot(None)
    ).all()
    questions = survey.questions.all()

    by_question = {}
    for q in questions:
        entry = {
            'question_id': q.id, 'text': q.text, 'qtype': q.qtype,
            'link_category': q.link_category, 'link_dimension': q.link_dimension,
            'answer_count': 0,
        }
        if q.qtype == 'scale':
            entry.update({'average': None, 'distribution': {}, 'by_division': {}})
        else:
            entry['values'] = []
        by_question[q.id] = entry

    division_totals = {}
    for r in responses:
        for a in r.answers.all():
            entry = by_question.get(a.question_id)
            if entry is None:
                continue
            if entry['qtype'] == 'scale':
                if a.value_number is None:
                    continue
                entry['answer_count'] += 1
                key = str(int(a.value_number))
                entry['distribution'][key] = entry['distribution'].get(key, 0) + 1
                bucket = division_totals.setdefault(a.question_id, {})
                # 사업부를 모르면 'unknown' 으로 따로 모은다. 아무 데나 넣지 않는다.
                dkey = str(r.division_id) if r.division_id else 'unknown'
                agg = bucket.setdefault(dkey, {'sum': 0.0, 'n': 0})
                agg['sum'] += a.value_number
                agg['n'] += 1
            else:
                entry['answer_count'] += 1
                # 자유서술이면 원문, 객관식·순위면 JSON. 둘 다 원자료 그대로 둔다 —
                # 집계만 남기면 AI 요약에 근거를 달 수 없다.
                entry['values'].append(
                    a.value_text if a.value_text is not None else a.value_json
                )

    for qid, buckets in division_totals.items():
        entry = by_question[qid]
        total_sum = sum(b['sum'] for b in buckets.values())
        total_n = sum(b['n'] for b in buckets.values())
        entry['average'] = round(total_sum / total_n, 2) if total_n else None
        entry['by_division'] = {
            k: {'average': round(v['sum'] / v['n'], 2), 'count': v['n']}
            for k, v in buckets.items() if v['n']
        }

    targets = target_user_ids(survey)
    unknown = sum(1 for r in responses if not r.division_id)
    return jsonify({'success': True, 'data': {
        'survey': _survey_dict(survey),
        'target_count': len(targets),
        'response_count': len(responses),
        'unknown_division_count': unknown,
        'questions': [by_question[q.id] for q in questions],
    }})


@admin_bp.route('/surveys/<int:survey_id>/identities', methods=['GET'])
@office_required
def survey_identities(survey_id):
    """응답자 확인. **고지한 대로 감사 로그를 남긴다.**

    남기지 않으면 "관리자는 확인할 수 있습니다"라는 고지가 면피 문구가 된다.
    """
    try:
        survey = StrategySurvey.query.get(survey_id)
        if not survey:
            return _error('설문을 찾을 수 없습니다.', 404)

        responses = survey.responses.filter(
            StrategySurveyResponse.submitted_at.isnot(None)
        ).all()
        names = {
            u.id: (u.name or u.email)
            for u in User.query.filter(
                User.id.in_([r.user_id for r in responses] or [0])
            ).all()
        }

        db.session.add(StrategySurveyAccessLog(
            survey_id=survey.id,
            viewer_id=int(get_jwt_identity()),
            action='list_identities',
        ))
        db.session.commit()

        return jsonify({'success': True, 'data': [
            serialize_response(r, reveal=True, user_names=names) for r in responses
        ]})
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


# ══ 응답자용 ═══════════════════════════════════════════════════════════════
#
# 로그인만 요구한다. 역할은 보지 않는다 — 설문은 전사 대상이다.
# 대신 **대상자인지는 반드시 본다.** 그 판정은 is_target() 한 곳에서만 한다.

def _current_user():
    return User.query.get(int(get_jwt_identity()))


def _my_open_surveys(user):
    """내가 받은, 지금 응답 가능한 설문."""
    now = datetime.utcnow()
    surveys = StrategySurvey.query.filter_by(status='open').all()
    return [s for s in surveys if _accepting(s, now) and is_target(user, s)]


@respond_bp.route('/mine', methods=['GET'])
@jwt_required()
def my_surveys():
    user = _current_user()
    if not user:
        return _error('사용자를 찾을 수 없습니다.', 404)

    answered = {
        r.survey_id for r in StrategySurveyResponse.query.filter_by(user_id=user.id)
        .filter(StrategySurveyResponse.submitted_at.isnot(None)).all()
    }
    out = []
    for s in _my_open_surveys(user):
        out.append({
            'id': s.id,
            'title': s.title,
            'description': s.description,
            'closes_at': s.closes_at.isoformat() if s.closes_at else None,
            'question_count': s.questions.count(),
            'answered': s.id in answered,
        })
    # 미응답을 먼저 보여준다.
    out.sort(key=lambda x: (x['answered'], x['id']))
    return jsonify({'success': True, 'data': out})


@respond_bp.route('/mine/count', methods=['GET'])
@jwt_required()
def my_pending_count():
    """홈 카드 배지용. 미응답 건수만 센다."""
    user = _current_user()
    if not user:
        return jsonify({'success': True, 'data': {'pending': 0}})

    answered = {
        r.survey_id for r in StrategySurveyResponse.query.filter_by(user_id=user.id)
        .filter(StrategySurveyResponse.submitted_at.isnot(None)).all()
    }
    pending = sum(1 for s in _my_open_surveys(user) if s.id not in answered)
    return jsonify({'success': True, 'data': {'pending': pending}})


@respond_bp.route('/<int:survey_id>/form', methods=['GET'])
@jwt_required()
def survey_form(survey_id):
    """응답 화면이 쓸 문항. **대상자가 아니면 존재 자체를 알려주지 않는다.**"""
    user = _current_user()
    survey = StrategySurvey.query.get(survey_id)
    if not survey or not user or not is_target(user, survey):
        return _error('설문을 찾을 수 없습니다.', 404)
    if not _accepting(survey):
        return _error('지금은 응답을 받지 않는 설문입니다.', 409)

    existing = StrategySurveyResponse.query.filter_by(
        survey_id=survey.id, user_id=user.id
    ).first()
    division_id, source = resolve_division(user)

    return jsonify({'success': True, 'data': {
        **_survey_dict(survey, with_questions=True),
        'already_answered': bool(existing and existing.submitted_at),
        # 유도된 값이 있으면 화면이 기본값으로 쓴다. 없으면 직접 고르게 한다.
        'suggested_division_id': division_id,
        'division_source': source,
        'department_name': user.department,
    }})


@respond_bp.route('/<int:survey_id>/responses', methods=['POST'])
@jwt_required()
def submit_response(survey_id):
    """응답 제출. 1인 1회.

    답을 통째로 한 트랜잭션에 담는다. 일부만 저장되면 집계가 조용히 틀어진다.
    """
    try:
        user = _current_user()
        survey = StrategySurvey.query.get(survey_id)
        if not survey or not user or not is_target(user, survey):
            return _error('설문을 찾을 수 없습니다.', 404)
        if not _accepting(survey):
            return _error('지금은 응답을 받지 않는 설문입니다.', 409)

        if StrategySurveyResponse.query.filter_by(
            survey_id=survey.id, user_id=user.id
        ).filter(StrategySurveyResponse.submitted_at.isnot(None)).first():
            return _error('이미 응답하셨습니다.', 409)

        payload = request.get_json() or {}
        answers = payload.get('answers')
        if not isinstance(answers, dict):
            return _error('answers 가 필요합니다.', 400)

        questions = {q.id: q for q in survey.questions.all()}
        for qid, q in questions.items():
            if q.required and str(qid) not in answers and qid not in answers:
                return _error(f'필수 문항에 답하지 않았습니다: {q.text}', 400)

        # ⚠️ **DB 를 건드리기 전에 전부 검증한다.** 넣으면서 검사하면 중간에
        #    걸렸을 때 앞부분이 이미 들어가 있고, 되돌리는 것을 한 번만 빠뜨려도
        #    답이 일부만 남는다. 그런 데이터는 집계를 조용히 틀어뜨려서
        #    가장 잡기 어렵다.
        prepared = []
        for key, value in answers.items():
            try:
                qid = int(key)
            except (TypeError, ValueError):
                return _error(f'문항 번호가 올바르지 않습니다: {key}', 400)
            q = questions.get(qid)
            if q is None:
                return _error(f'이 설문의 문항이 아닙니다: {qid}', 400)
            if q.qtype == 'scale' and value is not None:
                try:
                    value = float(value)
                except (TypeError, ValueError):
                    return _error(f'척도 문항에는 숫자가 필요합니다: {q.text}', 400)
            prepared.append((q, value))

        division_id, source = resolve_division(user)
        # 응답자가 직접 고른 값이 유도값보다 우선한다. 본인이 제일 잘 안다.
        picked = payload.get('division_id')
        if picked:
            division_id, source = int(picked), 'picked'

        response = StrategySurveyResponse(
            survey_id=survey.id,
            user_id=user.id,
            department_name=user.department,
            division_id=division_id,
            division_source=source,
            submitted_at=datetime.utcnow(),
        )
        db.session.add(response)
        db.session.flush()

        for q, value in prepared:
            answer = StrategySurveyAnswer(response_id=response.id, question_id=q.id)
            if q.qtype == 'scale':
                answer.value_number = value
            elif q.qtype == 'text':
                answer.value_text = value
            else:
                answer.value_json = value
            db.session.add(answer)

        db.session.commit()
        return jsonify({'success': True, 'data': {'id': response.id}}), 201
    except Exception as e:
        db.session.rollback()
        return _error(str(e))
