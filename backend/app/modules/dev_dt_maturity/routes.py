# -*- coding: utf-8 -*-
"""API — 배선만. 판단은 services · permissions · definitions 에.

    GET  /definitions                       부문 · 축(설정 문구 반영) · 모델 종류 · 가져오기 틀
    GET  /divisions                         사업부 목록 + 내가 손댈 수 있는지(deny_reason)
    GET  /board?division_id&sector          사업부 판
    GET  /subjects|/agents ?division_id&sector     POST · PUT/<id> · DELETE/<id>
    GET  /pairs/<id>                        쌍 상세(이력 포함)
    POST /pairs  {subject_id, agent_id}     DELETE /pairs/<id>  → 같이 지워진 평가·이력 수
    PUT  /pairs/<id>/assessments/<axis>     {rung|value, note, evidence}
    GET  /settings · PUT /settings          사무국

⚠️ 예외 문자열을 화면에 내보내지 않는다(_crashed). Refused 만 그대로 간다 —
   그건 사람이 고칠 수 있는 이유라서 문장 자체가 안내다.
"""
from functools import wraps

from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.shared.responses import error_response, success_response

from . import definitions as D
from . import permissions as P
from . import services as S
from .models import MaturityAgent, MaturityPair, MaturitySubject
from . import bp


def _actor():
    try:
        return P.actor_from(get_jwt_identity())
    except (TypeError, ValueError):
        return None


def _crashed():
    db.session.rollback()
    return error_response('처리 중 오류가 났습니다. 다시 시도해도 같으면 관리자에게 알려 주세요.',
                          status_code=500)


def read_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        actor = _actor()
        if actor is None:
            return error_response('로그인이 필요합니다.', status_code=401)
        if not P.can_read(actor):
            return error_response('이 모듈을 볼 권한이 없습니다.', status_code=403)
        return fn(actor, *args, **kwargs)
    return wrapper


def _deny(actor, division_id):
    """자기 사업부가 아니면 이유를 돌려준다. 할 수 있으면 None."""
    name = _division_name(division_id)
    reason = P.deny_reason(actor, division_id, name)
    return error_response(reason, status_code=403) if reason else None


def _division_name(division_id):
    from app.modules.digital_twin_dashboard.models import Division
    d = Division.query.get(int(division_id)) if division_id is not None else None
    return d.name if d else None


def _int_arg(name):
    v = request.args.get(name)
    try:
        return int(v) if v not in (None, '') else None
    except ValueError:
        return None


# ── 정의 · 사업부 ───────────────────────────────────────────────────────────

@bp.route('/definitions', methods=['GET'])
@read_required
def definitions(actor):
    return success_response({
        'sectors': [{**s, 'active': D.sector_is_active(s['key'])} for s in D.SECTORS],
        'axes': {k: D.get_axes(k) for k in D.SECTOR_KEYS},
        'model_kinds': D.MODEL_KINDS,
        'accuracy_rules': sorted(D.ACCURACY_RULES),
        'import_columns': D.IMPORT_COLUMNS,
        'stale_days': D.get_stale_days(),
        'can_curate': P.can_curate(actor),
        'my_division_id': P.actor_division_id(actor),
    })


@bp.route('/divisions', methods=['GET'])
@read_required
def divisions(actor):
    from app.modules.digital_twin_dashboard.models import Division
    rows = (Division.query.filter_by(is_active=True)
            .order_by(Division.order, Division.id).all())
    return success_response([{
        'id': d.id, 'name': d.name,
        'deny_reason': P.deny_reason(actor, d.id, d.name),
    } for d in rows])


@bp.route('/board', methods=['GET'])
@read_required
def board(actor):
    division_id = _int_arg('division_id')
    sector = request.args.get('sector') or 'simulation'
    if division_id is None:
        return error_response('사업부를 고르세요. 이 판에는 「전체」가 없습니다.', status_code=400)
    if not D.sector_is_active(sector):
        return error_response('아직 열리지 않은 부문입니다.', status_code=400)
    try:
        data = S.board(division_id, sector)
        data['deny_reason'] = P.deny_reason(actor, division_id, _division_name(division_id))
        return success_response(data)
    except Exception:
        return _crashed()


# ── 대상 · 수단 ─────────────────────────────────────────────────────────────

def _list(model):
    division_id = _int_arg('division_id')
    sector = request.args.get('sector') or 'simulation'
    q = model.query.filter_by(sector=sector)
    if division_id is not None:
        q = q.filter_by(division_id=division_id)
    order = (model.order, model.id) if hasattr(model, 'order') else (model.id,)
    return [r.to_dict() for r in q.order_by(*order).all()]


@bp.route('/subjects', methods=['GET'])
@read_required
def list_subjects(actor):
    return success_response(_list(MaturitySubject))


@bp.route('/subjects', methods=['POST'])
@read_required
def create_subject(actor):
    p = request.get_json() or {}
    if p.get('division_id') is None:
        return error_response('사업부가 필요합니다.', status_code=400)
    denied = _deny(actor, p['division_id'])
    if denied:
        return denied
    try:
        row = S.create_subject(p['division_id'], p.get('sector') or 'simulation',
                               p.get('name'), p.get('detail'), p.get('product_families'),
                               p.get('accuracy_rule') or 'auto', p.get('roadmap_task_id'))
        db.session.commit()
        return success_response(row.to_dict(), status_code=201)
    except S.Refused as e:
        db.session.rollback()
        return error_response(str(e), status_code=400)
    except Exception:
        return _crashed()


@bp.route('/subjects/<int:row_id>', methods=['PUT'])
@read_required
def update_subject(actor, row_id):
    row = MaturitySubject.query.get(row_id)
    if not row:
        return error_response('없는 대상입니다.', status_code=404)
    denied = _deny(actor, row.division_id)
    if denied:
        return denied
    try:
        S.update_subject(row, request.get_json() or {})
        db.session.commit()
        return success_response(row.to_dict())
    except S.Refused as e:
        db.session.rollback()
        return error_response(str(e), status_code=400)
    except Exception:
        return _crashed()


@bp.route('/subjects/<int:row_id>', methods=['DELETE'])
@read_required
def delete_subject(actor, row_id):
    row = MaturitySubject.query.get(row_id)
    if not row:
        return error_response('없는 대상입니다.', status_code=404)
    denied = _deny(actor, row.division_id)
    if denied:
        return denied
    try:
        gone = {'pairs': len(row.pairs),
                'assessments': sum(len(p.assessments) for p in row.pairs)}
        db.session.delete(row)
        db.session.commit()
        return success_response(gone)
    except Exception:
        return _crashed()


@bp.route('/agents', methods=['GET'])
@read_required
def list_agents(actor):
    return success_response(_list(MaturityAgent))


@bp.route('/agents', methods=['POST'])
@read_required
def create_agent(actor):
    p = request.get_json() or {}
    if p.get('division_id') is None:
        return error_response('사업부가 필요합니다.', status_code=400)
    denied = _deny(actor, p['division_id'])
    if denied:
        return denied
    try:
        row = S.create_agent(p['division_id'], p.get('sector') or 'simulation',
                             p.get('name'), p.get('kind'), p.get('model_kind'),
                             p.get('project_uuid'))
        db.session.commit()
        return success_response(row.to_dict(), status_code=201)
    except S.Refused as e:
        db.session.rollback()
        return error_response(str(e), status_code=400)
    except Exception:
        return _crashed()


@bp.route('/agents/<int:row_id>', methods=['PUT'])
@read_required
def update_agent(actor, row_id):
    row = MaturityAgent.query.get(row_id)
    if not row:
        return error_response('없는 수단입니다.', status_code=404)
    denied = _deny(actor, row.division_id)
    if denied:
        return denied
    try:
        S.update_agent(row, request.get_json() or {})
        db.session.commit()
        return success_response(row.to_dict())
    except S.Refused as e:
        db.session.rollback()
        return error_response(str(e), status_code=400)
    except Exception:
        return _crashed()


@bp.route('/agents/<int:row_id>', methods=['DELETE'])
@read_required
def delete_agent(actor, row_id):
    row = MaturityAgent.query.get(row_id)
    if not row:
        return error_response('없는 수단입니다.', status_code=404)
    denied = _deny(actor, row.division_id)
    if denied:
        return denied
    try:
        gone = {'pairs': len(row.pairs),
                'assessments': sum(len(p.assessments) for p in row.pairs)}
        db.session.delete(row)
        db.session.commit()
        return success_response(gone)
    except Exception:
        return _crashed()


# ── 쌍 ─────────────────────────────────────────────────────────────────────

@bp.route('/pairs/<int:pair_id>', methods=['GET'])
@read_required
def get_pair(actor, pair_id):
    pair = MaturityPair.query.get(pair_id)
    if not pair:
        return error_response('없는 쌍입니다.', status_code=404)
    try:
        d = S.pair_dict(pair, with_changes=True)
        d['deny_reason'] = P.deny_reason(actor, pair.subject.division_id,
                                         _division_name(pair.subject.division_id))
        d['phenomena'] = D.get_phenomena(pair.subject.division_id)
        return success_response(d)
    except Exception:
        return _crashed()


@bp.route('/pairs', methods=['POST'])
@read_required
def create_pair(actor):
    p = request.get_json() or {}
    subject = MaturitySubject.query.get(p.get('subject_id') or 0)
    if not subject:
        return error_response('없는 대상입니다.', status_code=404)
    denied = _deny(actor, subject.division_id)
    if denied:
        return denied
    agent = MaturityAgent.query.get(p['agent_id']) if p.get('agent_id') else None
    if p.get('agent_id') and not agent:
        return error_response('없는 수단입니다.', status_code=404)
    try:
        pair = S.create_pair(subject, agent)
        db.session.commit()
        return success_response(S.pair_dict(pair), status_code=201)
    except S.Refused as e:
        db.session.rollback()
        return error_response(str(e), status_code=400)
    except Exception:
        return _crashed()


@bp.route('/pairs/<int:pair_id>', methods=['DELETE'])
@read_required
def delete_pair(actor, pair_id):
    pair = MaturityPair.query.get(pair_id)
    if not pair:
        return error_response('없는 쌍입니다.', status_code=404)
    denied = _deny(actor, pair.subject.division_id)
    if denied:
        return denied
    try:
        gone = S.delete_pair(pair)
        db.session.commit()
        return success_response(gone)
    except Exception:
        return _crashed()


@bp.route('/pairs/<int:pair_id>/assessments/<axis>', methods=['PUT'])
@read_required
def assess(actor, pair_id, axis):
    pair = MaturityPair.query.get(pair_id)
    if not pair:
        return error_response('없는 쌍입니다.', status_code=404)
    denied = _deny(actor, pair.subject.division_id)
    if denied:
        return denied
    try:
        S.assess(pair, axis, request.get_json() or {}, actor)
        db.session.commit()
        return success_response(S.pair_dict(pair, with_changes=True))
    except S.Refused as e:
        db.session.rollback()
        return error_response(str(e), status_code=400)
    except Exception:
        return _crashed()


# ── 설정 ───────────────────────────────────────────────────────────────────

@bp.route('/settings', methods=['GET'])
@read_required
def get_settings(actor):
    return success_response({k: D._setting(k) for k in D.SETTINGS_KEYS})


@bp.route('/settings', methods=['PUT'])
@read_required
def put_settings(actor):
    if not P.can_curate(actor):
        return error_response('설정은 사무국·관리자만 바꿉니다.', status_code=403)
    from app.modules.digital_twin_dashboard.models import ModuleSettings
    p = request.get_json() or {}
    try:
        for key in D.SETTINGS_KEYS:
            if key not in p:
                continue
            row = ModuleSettings.query.filter_by(
                module_name=D.MODULE_KEY, settings_key=key).first()
            if row is None:
                row = ModuleSettings(module_name=D.MODULE_KEY, settings_key=key,
                                     description=f'성숙도 설정 {key}')
                db.session.add(row)
            row.settings_data = p[key]
        db.session.commit()
        return success_response({k: D._setting(k) for k in D.SETTINGS_KEYS})
    except Exception:
        return _crashed()
