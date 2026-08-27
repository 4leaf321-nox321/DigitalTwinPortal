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
                             p.get('project_uuid'), p.get('tools'))
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


# ── 가져오기 · 어긋남 (PLAN 6절) ──────────────────────────────────────────
#
# 틀 내려받기 → 사람이 손봄 → 미리보기(저장 안 함) → 넣기. 전부 사업부 단위.

from flask import Response          # noqa: E402
from . import importer as I         # noqa: E402


@bp.route('/import/template', methods=['GET'])
@read_required
def import_template(actor):
    division_id = _int_arg('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    try:
        rows = I.template_rows(division_id)
        name = _division_name(division_id) or division_id
        return Response(
            I.render_csv(rows), mimetype='text/csv; charset=utf-8',
            headers={'Content-Disposition':
                     f"attachment; filename*=UTF-8''maturity_{name}.csv"})
    except Exception:
        return _crashed()


@bp.route('/import/preview', methods=['POST'])
@read_required
def import_preview(actor):
    p = request.get_json() or {}
    division_id = p.get('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    if not isinstance(p.get('text'), str):
        return error_response('text 는 문자열이어야 합니다.', status_code=400)
    try:
        return success_response(I.plan(p['text'], int(division_id)))
    except I.TableFormatError as e:
        return error_response(str(e), status_code=400)
    except Exception:
        return _crashed()


@bp.route('/import', methods=['POST'])
@read_required
def import_apply(actor):
    p = request.get_json() or {}
    division_id = p.get('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    if not isinstance(p.get('text'), str):
        return error_response('text 는 문자열이어야 합니다.', status_code=400)
    denied = _deny(actor, division_id)
    if denied:
        return denied
    try:
        out = I.apply(p['text'], int(division_id), actor,
                      with_accuracy=bool(p.get('with_accuracy')),
                      source_label=(p.get('source_label') or '')[:100] or None)
        db.session.commit()
        return success_response(out)
    except I.TableFormatError as e:
        db.session.rollback()
        return error_response(str(e), status_code=400)
    except S.Refused as e:
        db.session.rollback()
        return error_response(str(e), status_code=400)
    except Exception:
        return _crashed()


@bp.route('/reconcile', methods=['GET'])
@read_required
def reconcile(actor):
    division_id = _int_arg('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    try:
        return success_response(I.reconcile(division_id))
    except Exception:
        return _crashed()


@bp.route('/changes', methods=['GET'])
@read_required
def changes(actor):
    division_id = _int_arg('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    sector = request.args.get('sector') or 'simulation'
    days = _int_arg('days') or 365
    try:
        return success_response(S.recent_changes(division_id, sector, days))
    except Exception:
        return _crashed()


@bp.route('/tool-names', methods=['GET'])
@read_required
def tool_names(actor):
    """도구 이름 제안 — 인텔 모듈의 도구 표(이름만). **읽기 전용 결합.**

    ⚠️ 인텔의 /tech 는 근거 건수·낡음까지 계산해 무겁다. 여기서는 이름만 뽑는다.
       FK 로 묶지 않는다 — 제안일 뿐이고, 인텔에 없는 이름도 적을 수 있다.
    """
    try:
        from app.modules.digital_twin_intel.models import IntelTech
        rows = (IntelTech.query
                .filter(IntelTech.kind != 'capability', IntelTech.is_archived.is_(False))
                .with_entities(IntelTech.name).order_by(IntelTech.name).all())
        return success_response(sorted({(r[0] or '').strip() for r in rows if (r[0] or '').strip()}))
    except Exception:
        # 인텔이 없거나 표가 비어도 이 모듈은 돌아야 한다 — 제안이 없을 뿐이다.
        return success_response([])


@bp.route('/tool-audit', methods=['GET'])
@read_required
def tool_audit(actor):
    division_id = _int_arg('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    try:
        return success_response(S.tool_audit(division_id))
    except Exception:
        return _crashed()


@bp.route('/tools/rename', methods=['POST'])
@read_required
def rename_tool(actor):
    p = request.get_json() or {}
    division_id = p.get('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    denied = _deny(actor, division_id)
    if denied:
        return denied
    try:
        n = S.rename_tool(int(division_id), p.get('from'), p.get('to'))
        db.session.commit()
        return success_response({'renamed': n})
    except S.Refused as e:
        db.session.rollback()
        return error_response(str(e), status_code=400)
    except Exception:
        return _crashed()


@bp.route('/tool-catalog', methods=['GET'])
@read_required
def tool_catalog(actor):
    """도구 찾기 창의 재료 — 인텔 도구의 이름·분야·공급사. 이름만으로는 684개를 못 찾는다.

    ⚠️ /tool-names 와 같이 읽기 전용 결합이고 FK 는 없다. 인텔이 없으면 빈 목록.
    """
    try:
        from app.modules.digital_twin_intel.models import IntelTech
        rows = (IntelTech.query
                .filter(IntelTech.kind != 'capability', IntelTech.is_archived.is_(False))
                .with_entities(IntelTech.name, IntelTech.category, IntelTech.vendor)
                .order_by(IntelTech.category, IntelTech.name).all())
        seen, out = set(), []
        for name, category, vendor in rows:
            n = (name or '').strip()
            if not n or n in seen:
                continue
            seen.add(n)
            out.append({'name': n, 'category': (category or '').strip() or '기타',
                        'vendor': (vendor or '').strip() or None})
        return success_response(out)
    except Exception:
        return success_response([])
