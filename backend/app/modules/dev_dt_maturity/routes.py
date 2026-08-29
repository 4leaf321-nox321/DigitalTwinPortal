# -*- coding: utf-8 -*-
"""API — 배선만. 판단은 services · permissions · definitions 에.

    GET  /definitions                       부문 · 축(설정 문구 반영) · 모델 종류 · 가져오기 틀
    GET  /divisions                         사업부 목록 + 내가 손댈 수 있는지(deny_reason)
    GET  /board?division_id&sector          사업부 판
    GET  /subjects|/agents ?division_id&sector     POST · PUT/<id> · DELETE/<id>
    GET  /pairs/<id>                        연계 상세(이력 포함)
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
from . import bulk as B
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
        # 감춘 부문은 목록에 남기되 hidden 을 달아 보낸다 — 설정 화면이 그것을 켜고 끈다.
        'sectors': [{**s, 'active': D.sector_is_active(s['key']), 'hidden': s['key'] in D.get_hidden_sectors()}
                    for s in D.sectors()],
        'axes': {k: D.get_axes(k) for k in D.SECTOR_KEYS},
        'model_kinds': D.vocab('model_kinds'),
        'accuracy_rules': D.vocab('accuracy_rules'),   # key 만이 아니라 문구까지 — 화면이 그대로 쓴다
        'import_columns': D.IMPORT_COLUMNS,
        'stale_days': D.get_stale_days(),
        'review': D.review_definitions(),
        'thread': D.thread_definitions(),
        'monitoring': D.monitoring_definitions(),
        'can_curate': P.can_curate(actor),
        'my_division_id': P.actor_division_id(actor),
    })


@bp.route('/divisions', methods=['GET'])
@read_required
def divisions(actor):
    """활성 사업부. 설정에서 뺀 조직(SR·GTR·CS 같은 비사업부)은 기본으로 안 준다 — ?all=1 이면 hidden 표시와 함께 전부."""
    from app.modules.digital_twin_dashboard.models import Division
    hidden = D.get_hidden_divisions()
    rows = (Division.query.filter_by(is_active=True)
            .order_by(Division.order, Division.id).all())
    everything = request.args.get('all') in ('1', 'true')
    # 순서는 대시보드 설정(Division.order)이 정본 — 화면마다 배열을 박지 않는다(2026-08-28)
    return success_response([{
        'id': d.id, 'name': d.name, 'order': d.order or 0,
        'deny_reason': P.deny_reason(actor, d.id, d.name),
        'hidden': d.id in hidden,
    } for d in rows if everything or d.id not in hidden])


@bp.route('/board', methods=['GET'])
@read_required
def board(actor):
    sector = request.args.get('sector') or 'simulation'
    if not D.sector_is_active(sector):
        return error_response('아직 열리지 않은 부문입니다.', status_code=400)
    # 「전체」 — 사업부마다 판을 돌려 묶는다. 사업부별 셈은 그대로다.
    if request.args.get('division_id') == 'all':
        try:
            data = S.board_all(sector)
            if sector == 'digital_thread':
                for b in data.get('boards', []):
                    T.decorate_board(b)
            return success_response(data)
        except Exception:
            return _crashed()
    division_id = _int_arg('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    try:
        data = S.board(division_id, sector)
        if sector == 'digital_thread':
            T.decorate_board(data)
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
                               p.get('accuracy_rule') or 'auto', p.get('roadmap_task_id'),
                               p.get('line'), p.get('process'))
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
    p = request.get_json() or {}
    denied = _deny(actor, row.division_id) or (
        _deny(actor, p['division_id']) if p.get('division_id') not in (None, '') else None)
    if denied:
        return denied
    try:
        S.update_subject(row, p)
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
                             p.get('project_uuid'), p.get('tools'), p.get('department_id'),
                             p.get('defect_types'), p.get('project_uuids'))
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
    p = request.get_json() or {}
    denied = _deny(actor, row.division_id) or (
        _deny(actor, p['division_id']) if p.get('division_id') not in (None, '') else None)
    if denied:
        return denied
    try:
        S.update_agent(row, p)
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


# ── 연계 ─────────────────────────────────────────────────────────────────────

@bp.route('/pairs/<int:pair_id>', methods=['GET'])
@read_required
def get_pair(actor, pair_id):
    pair = MaturityPair.query.get(pair_id)
    if not pair:
        return error_response('없는 연계입니다.', status_code=404)
    try:
        d = S.pair_dict(pair, with_changes=True)
        d['deny_reason'] = P.deny_reason(actor, pair.subject.division_id,
                                         _division_name(pair.subject.division_id))
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
        return error_response('없는 연계입니다.', status_code=404)
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
        return error_response('없는 연계입니다.', status_code=404)
    denied = _deny(actor, pair.subject.division_id)
    if denied:
        return denied
    try:
        payload = request.get_json() or {}
        T.guard_assess(pair, axis, payload)
        S.assess(pair, axis, payload, actor)
        db.session.commit()
        return success_response(S.pair_dict(pair, with_changes=True))
    except S.Stale as e:
        # 그 사이 남이 같은 축을 고쳤다 — 덮지 않고 409. 화면은 다시 읽어 보여 준다.
        db.session.rollback()
        return error_response(str(e), status_code=409)
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
            if key == 'vocab':
                row.settings_data = D.clean_vocab_payload(p[key])
                D.forget_vocab_cache()   # 같은 요청 안에서 옛 값을 되돌려 주지 않게
            elif key == 'ladders':
                row.settings_data = D.clean_ladders_payload(p[key])
            elif key == 'sector_words':
                row.settings_data = D.clean_sector_words_payload(p[key])
            else:
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

    ⚠️ 인텔의 /tech 는 근거 건수·재평가 필요까지 계산해 무겁다. 여기서는 이름만 뽑는다.
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


# ── 제품군 — 도구와 같은 셋 ──────────────────────────────────────────────────

@bp.route('/family-catalog', methods=['GET'])
@read_required
def family_catalog(actor):
    division_id = _int_arg('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    try:
        return success_response(S.family_catalog(division_id))
    except Exception:
        return _crashed()


@bp.route('/family-audit', methods=['GET'])
@read_required
def family_audit(actor):
    division_id = _int_arg('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    try:
        return success_response(S.family_audit(division_id))
    except Exception:
        return _crashed()


@bp.route('/families/rename', methods=['POST'])
@read_required
def rename_family(actor):
    p = request.get_json() or {}
    division_id = p.get('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    denied = _deny(actor, division_id)
    if denied:
        return denied
    try:
        n = S.rename_family(int(division_id), p.get('from'), p.get('to'))
        db.session.commit()
        return success_response({'renamed': n})
    except S.Refused as e:
        db.session.rollback()
        return error_response(str(e), status_code=400)
    except Exception:
        return _crashed()


@bp.route('/departments', methods=['GET'])
@read_required
def departments(actor):
    """담당 부서 고르기의 재료 — 사업부의 활성 부서. division_id=all 이면 사업부별로 묶어 준다."""
    if request.args.get('division_id') == 'all':
        from app.modules.digital_twin_dashboard.models import Division
        ids = [d.id for d in Division.query.filter_by(is_active=True).all()]
        return success_response({str(i): S.departments_of(i) for i in ids})
    division_id = _int_arg('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    try:
        return success_response(S.departments_of(division_id))
    except Exception:
        return _crashed()


@bp.route('/bulk', methods=['POST'])
@read_required
def bulk_input(actor):
    """일괄 입력 — 「추출」과 같은 머리글의 표를 붙여넣어 한 번에 세운다(bulk.py).

    dry_run 이면 아무것도 저장하지 않고 줄마다 어떻게 될지만 돌려준다.
    """
    p = request.get_json() or {}
    raw_div = p.get('division_id')
    division_id = None if raw_div in (None, '', 'all') else int(raw_div)
    if division_id is not None:
        denied = _deny(actor, division_id)
        if denied:
            return denied
    sector = p.get('sector') or 'simulation'
    if not D.sector_is_active(sector):
        return error_response('아직 열리지 않은 부문입니다.', status_code=400)
    try:
        out = B.run(division_id if division_id is not None else 'all', sector, p.get('kind'),
                    p.get('text') or '', actor, dry_run=bool(p.get('dry_run', True)))
        return success_response(out)
    except (B.TableFormatError, S.Refused) as e:
        db.session.rollback()
        return error_response(str(e), status_code=400)
    except Exception:
        db.session.rollback()
        return _crashed()


@bp.route('/vocabs', methods=['GET'])
@read_required
def get_vocabs(actor):
    """기준 정보 — 화면의 선택지들과 지금 값. 설정 화면이 이걸로 표를 그린다(2026-08-30)."""
    return success_response(D.vocab_all() + [D.sector_words_all()] + D.ladder_all())


@bp.route('/bulk/kinds', methods=['GET'])
@read_required
def bulk_kinds(actor):
    """그 부문에서 고를 수 있는 종류와 머리글 — 화면이 드롭다운과 안내를 그대로 그린다."""
    raw_div = request.args.get('division_id')
    div = None if raw_div in (None, '', 'all') else int(raw_div)
    return success_response(B.kinds_for(request.args.get('sector') or 'simulation', div))


@bp.route('/projects', methods=['GET'])
@read_required
def list_projects(actor):
    """「수행 디지털 트윈 과제」 고르기의 재료 — 대시보드 과제. all 이면 전 사업부."""
    q, process = request.args.get('q'), request.args.get('process')
    if request.args.get('division_id') == 'all':
        return _refused(lambda: success_response(S.projects_of(None, q, process)))
    division_id = _int_arg('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    return _refused(lambda: success_response(S.projects_of(division_id, q, process)))


@bp.route('/pairs/<int:pair_id>/reached/<axis>/<rung>', methods=['PUT'])
@read_required
def set_reached(actor, pair_id, axis, rung):
    """칸의 도달 시점(연-월)을 그 자리에서 적는다. {month: '2025-03'}"""
    pair = MaturityPair.query.get(pair_id)
    if not pair:
        return error_response('없는 연계입니다.', status_code=404)
    denied = _deny(actor, pair.subject.division_id)
    if denied:
        return denied
    try:
        S.set_reached(pair, axis, rung, (request.get_json() or {}).get('month'), actor)
        db.session.commit()
        return success_response(S.pair_dict(pair, with_changes=True))
    except S.Refused as e:
        db.session.rollback()
        return error_response(str(e), status_code=400)
    except Exception:
        return _crashed()


@bp.route('/pairs/<int:pair_id>/changes/<int:change_id>', methods=['DELETE'])
@read_required
def delete_entry(actor, pair_id, change_id):
    """정확도 기록 하나를 지운다 — 값 축만. 남은 줄의 가장 늦은 것이 현재가 된다."""
    pair = MaturityPair.query.get(pair_id)
    if not pair:
        return error_response('없는 연계입니다.', status_code=404)
    denied = _deny(actor, pair.subject.division_id)
    if denied:
        return denied
    try:
        S.delete_entry(pair, change_id, actor)
        db.session.commit()
        return success_response(S.pair_dict(pair, with_changes=True))
    except S.Refused as e:
        db.session.rollback()
        return error_response(str(e), status_code=400)
    except Exception:
        return _crashed()


@bp.route('/pairs/<int:pair_id>/defects/<axis>', methods=['PUT'])
@read_required
def set_defect_cell(actor, pair_id, axis):
    """불량 유형 표의 칸 하나 — {name, col, month|null}. 근거 없이 바로 저장한다."""
    pair = MaturityPair.query.get(pair_id)
    if not pair:
        return error_response('없는 연계입니다.', status_code=404)
    denied = _deny(actor, pair.subject.division_id)
    if denied:
        return denied
    p = request.get_json() or {}
    try:
        S.set_defect_cell(pair, axis, p.get('name'), p.get('col'), p.get('month'), actor)
        db.session.commit()
        return success_response(S.pair_dict(pair, with_changes=True))
    except S.Refused as e:
        db.session.rollback()
        return error_response(str(e), status_code=400)
    except Exception:
        return _crashed()


# ── 해석 활용 기록 (2026-08-28) ─────────────────────────────────────────────────
from . import reviews as R                          # noqa: E402
from .models import MaturityReviewCase              # noqa: E402


def _visible_division_ids():
    from app.modules.digital_twin_dashboard.models import Division
    hidden = D.get_hidden_divisions()
    rows = (Division.query.filter_by(is_active=True, is_kpi_owner=True)
            .order_by(Division.order, Division.id).all())
    return [(d.id, d.name) for d in rows if d.id not in hidden]


@bp.route('/reviews', methods=['GET'])
@read_required
def list_reviews(actor):
    division_id = _int_arg('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    year = _int_arg('year')
    kind = request.args.get('kind') or None
    return success_response([r.to_dict() for r in R.list_cases(division_id, year, kind)])


@bp.route('/reviews/years', methods=['GET'])
@read_required
def review_years(actor):
    return success_response(R.years(_int_arg('division_id')))


@bp.route('/reviews/stats', methods=['GET'])
@read_required
def review_stats(actor):
    """한 사업부 또는 전체(division_id=all)의 연간 셈."""
    year = _int_arg('year') or __import__('datetime').date.today().year
    if request.args.get('division_id') == 'all':
        out = []
        for did, name in _visible_division_ids():
            s = R.stats(did, year)
            s['division_name'] = name
            out.append(s)
        return success_response({'year': year, 'divisions': out})
    division_id = _int_arg('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    return success_response(R.stats(division_id, year))


@bp.route('/reviews', methods=['POST'])
@read_required
def create_review(actor):
    p = request.get_json() or {}
    if p.get('division_id') is None:
        return error_response('사업부가 필요합니다.', status_code=400)
    denied = _deny(actor, p['division_id'])
    if denied:
        return denied
    try:
        row = R.create(p['division_id'], p, actor)
        db.session.commit()
        return success_response(row.to_dict(), status_code=201)
    except S.Refused as e:
        db.session.rollback()
        return error_response(str(e), status_code=400)
    except Exception:
        return _crashed()


@bp.route('/reviews/<int:row_id>', methods=['PUT'])
@read_required
def update_review(actor, row_id):
    row = MaturityReviewCase.query.get(row_id)
    if not row:
        return error_response('없는 건입니다.', status_code=404)
    denied = _deny(actor, row.division_id)
    if denied:
        return denied
    try:
        R.update(row, request.get_json() or {}, actor)
        db.session.commit()
        return success_response(row.to_dict())
    except S.Refused as e:
        db.session.rollback()
        return error_response(str(e), status_code=400)
    except Exception:
        return _crashed()


@bp.route('/reviews/<int:row_id>', methods=['DELETE'])
@read_required
def delete_review(actor, row_id):
    row = MaturityReviewCase.query.get(row_id)
    if not row:
        return error_response('없는 건입니다.', status_code=404)
    denied = _deny(actor, row.division_id)
    if denied:
        return denied
    try:
        db.session.delete(row)
        db.session.commit()
        return success_response({'deleted': row_id})
    except Exception:
        return _crashed()


@bp.route('/reviews/template', methods=['GET'])
@read_required
def review_template(actor):
    return Response(R.template_csv(), mimetype='text/csv; charset=utf-8',
                    headers={'Content-Disposition': "attachment; filename*=UTF-8''review_cases.csv"})


@bp.route('/reviews/import/preview', methods=['POST'])
@read_required
def review_import_preview(actor):
    p = request.get_json() or {}
    if p.get('division_id') is None or not isinstance(p.get('text'), str):
        return error_response('사업부와 text 가 필요합니다.', status_code=400)
    try:
        return success_response(R.parse(p['text'], int(p['division_id'])))
    except I.TableFormatError as e:
        return error_response(str(e), status_code=400)
    except Exception:
        return _crashed()


@bp.route('/reviews/import/apply', methods=['POST'])
@read_required
def review_import_apply(actor):
    p = request.get_json() or {}
    if p.get('division_id') is None or not isinstance(p.get('text'), str):
        return error_response('사업부와 text 가 필요합니다.', status_code=400)
    denied = _deny(actor, p['division_id'])
    if denied:
        return denied
    try:
        out = R.apply(p['text'], int(p['division_id']), actor)
        db.session.commit()
        return success_response(out)
    except I.TableFormatError as e:
        db.session.rollback()
        return error_response(str(e), status_code=400)
    except Exception:
        return _crashed()


# ── 디지털 스레드 (2026-08-28) ─────────────────────────────────────────────
from . import threads as T                                                      # noqa: E402
from .models import ThreadDef, ThreadOrg, ThreadSegment, ThreadSegmentDef, ThreadSystem   # noqa: E402


def _curate_or_403(actor):
    return None if P.can_curate(actor) else error_response('사무국·관리자만 고칩니다.', status_code=403)


def _refused(fn):
    """Refused → 400, 나머지 → 500. 사전·구간 라우트의 공통 꼬리."""
    try:
        out = fn()
        db.session.commit()
        return out
    except S.Refused as e:
        db.session.rollback()
        return error_response(str(e), status_code=400)
    except Exception:
        return _crashed()


@bp.route('/threads', methods=['GET'])
@read_required
def list_threads(actor):
    return _refused(lambda: success_response(T.list_threads(active_only=request.args.get('all') not in ('1', 'true'))))


@bp.route('/threads', methods=['POST'])
@read_required
def create_thread(actor):
    denied = _curate_or_403(actor)
    if denied:
        return denied
    return _refused(lambda: success_response(T.thread_dict(T.create_thread(request.get_json() or {})), status_code=201))


@bp.route('/threads/<int:row_id>', methods=['PUT'])
@read_required
def update_thread(actor, row_id):
    denied = _curate_or_403(actor)
    if denied:
        return denied
    row = ThreadDef.query.get(row_id)
    if not row:
        return error_response('없는 스레드입니다.', status_code=404)
    return _refused(lambda: success_response(T.thread_dict(T.update_thread(row, request.get_json() or {}))))


@bp.route('/threads/<int:row_id>/segment-defs', methods=['POST'])
@read_required
def add_segment_def(actor, row_id):
    denied = _curate_or_403(actor)
    if denied:
        return denied
    row = ThreadDef.query.get(row_id)
    if not row:
        return error_response('없는 스레드입니다.', status_code=404)
    return _refused(lambda: success_response(T.add_segment_def(row, request.get_json() or {}).to_dict(), status_code=201))


@bp.route('/threads/segment-defs/<int:row_id>', methods=['PUT', 'DELETE'])
@read_required
def segment_def(actor, row_id):
    denied = _curate_or_403(actor)
    if denied:
        return denied
    row = ThreadSegmentDef.query.get(row_id)
    if not row:
        return error_response('없는 표준 구간입니다.', status_code=404)
    if request.method == 'DELETE':
        def go():
            db.session.delete(row)
            return success_response({'deleted': row_id})
        return _refused(go)
    return _refused(lambda: success_response(T.update_segment_def(row, request.get_json() or {}).to_dict()))


@bp.route('/systems', methods=['GET'])
@read_required
def list_systems(actor):
    return _refused(lambda: success_response(T.list_systems()))


@bp.route('/systems', methods=['POST'])
@read_required
def create_system(actor):
    p = request.get_json() or {}
    return _refused(lambda: success_response(T.create_system(p, P.actor_division_id(actor)).to_dict(), status_code=201))


@bp.route('/systems/<int:row_id>', methods=['PUT', 'DELETE'])
@read_required
def system(actor, row_id):
    row = ThreadSystem.query.get(row_id)
    if not row:
        return error_response('없는 시스템입니다.', status_code=404)
    if request.method == 'DELETE':
        if not P.can_curate(actor) and row.created_division_id not in (None, P.actor_division_id(actor)):
            return error_response('다른 사업부가 처음 적은 시스템입니다.', status_code=403)

        def go():
            if T.system_usage(row.id):
                raise S.Refused('쓰는 구간이 있어 지울 수 없습니다 — 「정돈」으로 합치세요.')
            db.session.delete(row)
            return success_response({'deleted': row_id})
        return _refused(go)
    return _refused(lambda: success_response(T.update_system(row, request.get_json() or {}, P.actor_division_id(actor), P.can_curate(actor)).to_dict()))


@bp.route('/systems/merge', methods=['POST'])
@read_required
def merge_systems(actor):
    denied = _curate_or_403(actor)
    if denied:
        return denied
    p = request.get_json() or {}
    return _refused(lambda: success_response({'moved': T.merge_systems(int(p.get('keep_id')), int(p.get('drop_id')))}))


@bp.route('/systems/hubs', methods=['GET'])
@read_required
def system_hubs(actor):
    raw = request.args.get('division_id')
    ids = None if raw in (None, '', 'all') else [int(raw)]
    if raw == 'all':
        ids = [d for d, _ in _visible_division_ids()]
    return _refused(lambda: success_response(T.system_hubs(ids)))


@bp.route('/orgs', methods=['GET'])
@read_required
def list_orgs(actor):
    return _refused(lambda: success_response(T.list_orgs(_int_arg('division_id'))))


@bp.route('/orgs/from-departments', methods=['GET'])
@read_required
def orgs_from_departments(actor):
    division_id = _int_arg('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    return _refused(lambda: success_response(T.departments_as_orgs(division_id)))


@bp.route('/orgs', methods=['POST'])
@read_required
def create_org(actor):
    p = request.get_json() or {}
    division_id = p.get('division_id')
    if division_id not in (None, ''):
        denied = _deny(actor, division_id)
        if denied:
            return denied
    return _refused(lambda: success_response(T.create_org(p, int(division_id) if division_id not in (None, '') else None).to_dict(), status_code=201))


@bp.route('/orgs/<int:row_id>', methods=['PUT', 'DELETE'])
@read_required
def org(actor, row_id):
    row = ThreadOrg.query.get(row_id)
    if not row:
        return error_response('없는 조직입니다.', status_code=404)
    if row.division_id is not None:
        denied = _deny(actor, row.division_id)
        if denied:
            return denied
    if request.method == 'DELETE':
        def go():
            if T.org_usage(row.id):
                raise S.Refused('쓰는 구간이 있어 지울 수 없습니다.')
            db.session.delete(row)
            return success_response({'deleted': row_id})
        return _refused(go)
    return _refused(lambda: success_response(T.update_org(row, request.get_json() or {}).to_dict()))


@bp.route('/segments', methods=['GET'])
@read_required
def list_segments(actor):
    if request.args.get('division_id') == 'all':      # 시스템 연결도 — 전사 한 그래프
        return _refused(lambda: success_response(T.list_segments(None)))
    division_id = _int_arg('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    return _refused(lambda: success_response(T.list_segments(division_id)))


@bp.route('/segments', methods=['POST'])
@read_required
def create_segment(actor):
    p = request.get_json() or {}
    if p.get('division_id') is None:
        return error_response('사업부가 필요합니다.', status_code=400)
    denied = _deny(actor, p['division_id'])
    if denied:
        return denied

    def go():
        seg, _, _ = T.create_segment(p['division_id'], p)
        db.session.flush()
        return success_response(T.segment_dict(seg), status_code=201)
    return _refused(go)


@bp.route('/segments/<int:row_id>', methods=['PUT', 'DELETE'])
@read_required
def segment(actor, row_id):
    row = ThreadSegment.query.get(row_id)
    if not row:
        return error_response('없는 구간입니다.', status_code=404)
    denied = _deny(actor, row.division_id)
    if denied:
        return denied
    if request.method == 'DELETE':
        return _refused(lambda: success_response(T.delete_segment(row)))
    return _refused(lambda: success_response(T.segment_dict(T.update_segment(row, request.get_json() or {}))))


@bp.route('/threads/stats', methods=['GET'])
@read_required
def thread_stats(actor):
    raw = request.args.get('division_id')
    if raw == 'all':
        def go():
            out = []
            for did, name in _visible_division_ids():
                s = T.thread_stats(did)
                s['division_name'] = name
                out.append(s)
            return success_response({'divisions': out})
        return _refused(go)
    division_id = _int_arg('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    return _refused(lambda: success_response(T.thread_stats(division_id)))


@bp.route('/threads/org-matrix', methods=['GET'])
@read_required
def thread_org_matrix(actor):
    division_id = _int_arg('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    return _refused(lambda: success_response(T.org_matrix(division_id)))


# ── 연계 개발 기록 ─────────────────────────────────────────────────────────
from .models import ThreadCase                                                  # noqa: E402


@bp.route('/thread-cases', methods=['GET'])
@read_required
def list_thread_cases(actor):
    if request.args.get('division_id') == 'all':          # 시스템 창 — 전사 한 묶음
        return _refused(lambda: success_response(T.list_cases(None, _int_arg('year'), request.args.get('status') or None)))
    division_id = _int_arg('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    return _refused(lambda: success_response(T.list_cases(division_id, _int_arg('year'), request.args.get('status') or None)))


@bp.route('/thread-cases/years', methods=['GET'])
@read_required
def thread_case_years(actor):
    return _refused(lambda: success_response(T.case_years(_int_arg('division_id'))))


@bp.route('/thread-cases/stats', methods=['GET'])
@read_required
def thread_case_stats(actor):
    year = _int_arg('year') or __import__('datetime').date.today().year
    if request.args.get('division_id') == 'all':
        def go():
            out = []
            for did, name in _visible_division_ids():
                s = T.case_stats(did, year)
                s['division_name'] = name
                out.append(s)
            return success_response({'year': year, 'divisions': out})
        return _refused(go)
    division_id = _int_arg('division_id')
    if division_id is None:
        return error_response('사업부를 고르세요.', status_code=400)
    return _refused(lambda: success_response(T.case_stats(division_id, year)))


@bp.route('/thread-cases', methods=['POST'])
@read_required
def create_thread_case(actor):
    p = request.get_json() or {}
    if p.get('division_id') is None:
        return error_response('사업부가 필요합니다.', status_code=400)
    denied = _deny(actor, p['division_id'])
    if denied:
        return denied
    return _refused(lambda: success_response(T.case_dict(T.create_case(p['division_id'], p, actor)), status_code=201))


@bp.route('/thread-cases/<int:row_id>', methods=['PUT', 'DELETE'])
@read_required
def thread_case(actor, row_id):
    row = ThreadCase.query.get(row_id)
    if not row:
        return error_response('없는 건입니다.', status_code=404)
    denied = _deny(actor, row.division_id)
    if denied:
        return denied
    if request.method == 'DELETE':
        def go():
            db.session.delete(row)
            return success_response({'deleted': row_id})
        return _refused(go)
    return _refused(lambda: success_response(T.case_dict(T.update_case(row, request.get_json() or {}, actor))))
