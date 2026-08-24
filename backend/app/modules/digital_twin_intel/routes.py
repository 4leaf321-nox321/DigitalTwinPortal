"""디지털 트윈 기술정보 API.

두 탭에 대응한다 — `/news` (소식) · `/tech` (기술 레이더).

⚠️ **모든 쓰기 길에 권한 검사가 있다.** `@jwt_required()` 만으로는 부족하다 —
   그건 "로그인했다" 지 "이걸 해도 된다" 가 아니다. 2026-08-25 조사에서 아홉 모듈이
   그 상태였고, 이 모듈은 거기 끼지 않는다. 규칙은 `permissions.py` 한 곳에 있다.
"""
from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.modules.digital_twin_intel import bp
from app.modules.digital_twin_intel import permissions as P
from app.modules.digital_twin_intel import services as S
from app.modules.digital_twin_intel.models import (
    CPT_GROUPS, DEFAULT_SECTORS, ORIGINS, STAGES, IntelEvidence, IntelNews, IntelTech,
)
from app.shared.responses import (
    created_response, error_response, not_found_response, success_response,
)
from app.shared.utils import get_request_json

MODULE_NAME = 'digital_twin_intel'

# 분류 목록의 초기값. **설정에서 늘린다** — 코드에 박으면 조직이 바뀔 때 화면이
# 조용히 틀어진다(투자 모듈의 `category2Options` 와 같은 방식).
DEFAULT_SETTINGS = {
    'newsCategories': ['기술 발표', '시장', '경쟁사', '규제·표준', '사례', '연구'],
    # 레이더의 부채꼴. 뜻과 「시각화를 왜 뺐는지」는 `models.DEFAULT_SECTORS` 참고.
    'techCategories': list(DEFAULT_SECTORS),
}


def _origin_of(data):
    """어디로 들어왔는지. **부르는 쪽이 밝힌다.**

    ⚠️ MCP 도 사람도 **같은 REST 길**로 들어온다. 그래서 서버는 둘을 구분할 방법이
       없다 — 라우트에 `'ui'` 를 박아 두면 바깥 AI 가 밀어 넣은 것까지 「사람이 적음」
       으로 남는다(2026-08-25 실측). 그러면 나중에 「이거 누가 확인한 거야?」에
       답할 수 없고, `origin` 을 만든 이유가 통째로 무너진다.

    ⚠️ 이건 **권한이 아니라 출처 표시**라 부르는 쪽을 믿는다 — `patch_project` 의
       `actor_mode='ai'` 와 같은 방식이다. 거짓으로 적어도 얻는 것이 없다.
       다만 아는 값만 받는다(모르면 'ui').
    """
    v = (data or {}).get('origin')
    return v if v in ORIGINS else 'ui'


def _actor():
    """이번 요청을 한 사람. 없으면 None."""
    try:
        uid = get_jwt_identity()
    except (TypeError, ValueError):
        return None
    return P.actor_from(uid)


def _deny_read(actor):
    if actor is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    if not P.can_read(actor):
        return error_response('이 모듈을 볼 권한이 없습니다.', status_code=403)
    return None


def _deny_write(actor):
    d = _deny_read(actor)
    if d is not None:
        return d
    if not P.can_write(actor):
        return error_response('기술정보를 추가할 권한이 없습니다.', status_code=403)
    return None


def _deny_curate(actor):
    d = _deny_read(actor)
    if d is not None:
        return d
    if not P.can_curate(actor):
        # ⚠️ 왜 막혔는지를 말한다. "권한 없음" 만으로는 관리자에게 무엇을 요청해야
        #    하는지 모른다.
        return error_response(
            '레이더 단계 변경·삭제는 관리자 또는 사무국만 할 수 있습니다.',
            status_code=403)
    return None


# ─────────────────────────────────────────────────────────────────────────────
# 소식
# ─────────────────────────────────────────────────────────────────────────────

@bp.route('/news', methods=['GET'])
@jwt_required()
def list_news():
    """소식 목록. `category` · `status` · `q` · `techUuid` 로 거른다.

    ⚠️ **`published_at` 으로 세운다**(없으면 뒤로). `created_at` 으로 세우면 뒤늦게
       넣은 3년 전 글이 맨 위에 선다.
    """
    actor = _actor()
    denied = _deny_read(actor)
    if denied is not None:
        return denied

    q = IntelNews.query
    if request.args.get('category'):
        q = q.filter(IntelNews.category == request.args['category'])
    if request.args.get('status'):
        q = q.filter(IntelNews.status == request.args['status'])
    if request.args.get('q'):
        like = f"%{request.args['q'].strip()}%"
        q = q.filter(db.or_(IntelNews.title.ilike(like),
                            IntelNews.summary.ilike(like),
                            IntelNews.source.ilike(like)))
    if request.args.get('techUuid'):
        subs = db.session.query(IntelEvidence.news_uuid).filter(
            IntelEvidence.tech_uuid == request.args['techUuid'])
        q = q.filter(IntelNews.uuid.in_(subs))

    rows = q.order_by(IntelNews.published_at.desc().nullslast(),
                      IntelNews.id.desc()).limit(500).all()
    ev = S.evidence_for_news([r.uuid for r in rows])
    return success_response([r.to_dict(evidence=ev.get(r.uuid, [])) for r in rows])


@bp.route('/news/<uuid>', methods=['GET'])
@jwt_required()
def get_news(uuid):
    """소식 하나 — **보관된 원문까지** 준다.

    ⚠️ 목록과 나눈 이유는 본문 때문이다. 기사 전문을 목록에 실으면 수백 건일 때
       응답이 메가바이트가 된다. 읽을 때만 가져온다.
    """
    actor = _actor()
    denied = _deny_read(actor)
    if denied is not None:
        return denied

    n = IntelNews.query.filter_by(uuid=uuid).first()
    if n is None:
        return not_found_response('소식을 찾을 수 없습니다.')
    ev = S.evidence_for_news([n.uuid])
    return success_response(n.to_dict(evidence=ev.get(n.uuid, []), with_body=True))


@bp.route('/news', methods=['POST'])
@jwt_required()
def create_news():
    """소식 하나. `technologies` 를 같이 보내면 **그 자리에서 레이더가 채워진다.**"""
    actor = _actor()
    denied = _deny_write(actor)
    if denied is not None:
        return denied

    data = get_request_json() or {}
    origin = _origin_of(data)
    data.pop('origin', None)
    news, err = S.create_news(actor_id=actor.id, origin=origin,
                              technologies=data.pop('technologies', None), **data)
    if err:
        return error_response(err, status_code=400)
    ev = S.evidence_for_news([news.uuid])
    return created_response(news.to_dict(evidence=ev.get(news.uuid, [])))


@bp.route('/news/<uuid>', methods=['PATCH'])
@jwt_required()
def update_news(uuid):
    actor = _actor()
    denied = _deny_write(actor)
    if denied is not None:
        return denied

    n = IntelNews.query.filter_by(uuid=uuid).first()
    if n is None:
        return not_found_response('소식을 찾을 수 없습니다.')

    data = get_request_json() or {}
    for key, col in (('title', 'title'), ('summary', 'summary'), ('body', 'body'),
                     ('source', 'source'), ('url', 'url'), ('category', 'category'),
                     ('status', 'status')):
        if key in data:
            setattr(n, col, data[key])
    if 'tags' in data:
        n.tags = S._clean_list(data['tags'])
    if 'divisions' in data:
        n.divisions = S._clean_list(data['divisions'])
    if 'publishedAt' in data:
        n.published_at = S._parse_date(data['publishedAt'])
    db.session.commit()
    ev = S.evidence_for_news([n.uuid])
    return success_response(n.to_dict(evidence=ev.get(n.uuid, [])))


@bp.route('/news/<uuid>', methods=['DELETE'])
@jwt_required()
def delete_news(uuid):
    actor = _actor()
    denied = _deny_curate(actor)
    if denied is not None:
        return denied

    n = IntelNews.query.filter_by(uuid=uuid).first()
    if n is None:
        return not_found_response('소식을 찾을 수 없습니다.')
    # 근거도 같이 지운다. 남기면 없는 소식을 가리키는 줄이 레이더에 뜬다.
    IntelEvidence.query.filter_by(news_uuid=uuid).delete()
    db.session.delete(n)
    db.session.commit()
    return success_response(message='소식을 지웠습니다.')


# ─────────────────────────────────────────────────────────────────────────────
# 기술 (레이더)
# ─────────────────────────────────────────────────────────────────────────────

@bp.route('/tech', methods=['GET'])
@jwt_required()
def list_tech():
    """레이더 목록. 근거 건수와 **낡음 표시**를 함께 준다.

    ⚠️ 낡음 판정을 화면이 하면 안 된다 — 단계마다 기준 일수가 다르고, 그 표가
       화면에 복제되면 서버와 갈린다.
    """
    actor = _actor()
    denied = _deny_read(actor)
    if denied is not None:
        return denied

    q = IntelTech.query
    if request.args.get('stage'):
        q = q.filter(IntelTech.stage == request.args['stage'])
    if request.args.get('category'):
        q = q.filter(IntelTech.category == request.args['category'])
    if request.args.get('q'):
        like = f"%{request.args['q'].strip()}%"
        q = q.filter(db.or_(IntelTech.name.ilike(like),
                            IntelTech.vendor.ilike(like),
                            IntelTech.summary.ilike(like)))
    if request.args.get('includeArchived') not in ('1', 'true', 'yes'):
        q = q.filter(IntelTech.is_archived.is_(False))

    rows = q.order_by(IntelTech.name.asc()).all()
    stats = S.evidence_stats([r.uuid for r in rows])
    out = []
    for r in rows:
        cnt, last = stats.get(r.uuid, (0, None))
        out.append(r.to_dict(last_evidence_at=last, evidence_count=cnt))
    return success_response(out)


@bp.route('/tech', methods=['POST'])
@jwt_required()
def create_tech():
    actor = _actor()
    denied = _deny_write(actor)
    if denied is not None:
        return denied

    data = get_request_json() or {}
    origin = _origin_of(data)
    data.pop('origin', None)
    tech, err = S.create_tech(actor_id=actor.id, origin=origin, **data)
    if err:
        return error_response(err, status_code=400)
    return created_response(tech.to_dict())


@bp.route('/tech/<uuid>', methods=['PATCH'])
@jwt_required()
def update_tech(uuid):
    """기술의 설명·별칭 등을 고친다.

    ⚠️ **단계(`stage`)는 여기서 못 바꾼다.** 전용 길(`/tech/<uuid>/stage`)이 따로
       있고 권한이 다르다. 여기서 함께 받으면 좁혀 둔 권한이 새어 나간다.
    """
    actor = _actor()
    denied = _deny_write(actor)
    if denied is not None:
        return denied

    t = IntelTech.query.filter_by(uuid=uuid).first()
    if t is None:
        return not_found_response('기술을 찾을 수 없습니다.')

    data = get_request_json() or {}
    if 'stage' in data and data['stage'] != t.stage:
        return error_response(
            '단계 변경은 /tech/<uuid>/stage 로 요청하세요.', status_code=400)

    for key in ('name', 'vendor', 'category', 'url', 'summary', 'description'):
        if key in data:
            setattr(t, key, data[key])
    if 'aliases' in data:
        t.aliases = S._clean_list(data['aliases'])
    if 'divisions' in data:
        t.divisions = S._clean_list(data['divisions'])
    if 'tags' in data:
        t.tags = S._clean_list(data['tags'])
    if 'cpt' in data:
        t.cpt = S._clean_cpt(data['cpt'])
    if 'isArchived' in data:
        t.is_archived = bool(data['isArchived'])
    db.session.commit()
    cnt, last = S.evidence_stats([t.uuid]).get(t.uuid, (0, None))
    return success_response(t.to_dict(last_evidence_at=last, evidence_count=cnt))


@bp.route('/tech/<uuid>/stage', methods=['PUT'])
@jwt_required()
def change_stage(uuid):
    """레이더 단계를 옮긴다. **관리자·사무국만.**

    ⚠️ 이 단계는 개인 의견이 아니라 **조직이 어디까지 왔는지의 표기**다. 아무나
       바꾸면 아무도 그 표기를 안 믿게 되고, 안 믿는 표기는 없는 것과 같다.
    """
    actor = _actor()
    denied = _deny_curate(actor)
    if denied is not None:
        return denied

    data = get_request_json() or {}
    tech, err = S.set_stage(uuid, (data.get('stage') or '').strip(),
                            reason=data.get('reason'), actor_id=actor.id)
    if err:
        code = 404 if '찾을 수 없' in err else 400
        return error_response(err, status_code=code)
    cnt, last = S.evidence_stats([tech.uuid]).get(tech.uuid, (0, None))
    return success_response(tech.to_dict(last_evidence_at=last, evidence_count=cnt))


@bp.route('/tech/<uuid>', methods=['DELETE'])
@jwt_required()
def delete_tech(uuid):
    actor = _actor()
    denied = _deny_curate(actor)
    if denied is not None:
        return denied

    t = IntelTech.query.filter_by(uuid=uuid).first()
    if t is None:
        return not_found_response('기술을 찾을 수 없습니다.')
    IntelEvidence.query.filter_by(tech_uuid=uuid).delete()
    db.session.delete(t)
    db.session.commit()
    return success_response(message='기술을 지웠습니다.')


# ─────────────────────────────────────────────────────────────────────────────
# 근거 (소식 ↔ 기술)
# ─────────────────────────────────────────────────────────────────────────────

@bp.route('/evidence', methods=['POST'])
@jwt_required()
def add_evidence():
    actor = _actor()
    denied = _deny_write(actor)
    if denied is not None:
        return denied

    data = get_request_json() or {}
    news_uuid = (data.get('newsUuid') or '').strip()
    tech_uuid = (data.get('techUuid') or '').strip()
    if not news_uuid or not tech_uuid:
        return error_response('newsUuid 와 techUuid 가 모두 필요합니다.', status_code=400)
    if IntelNews.query.filter_by(uuid=news_uuid).first() is None:
        return not_found_response('소식을 찾을 수 없습니다.')
    if IntelTech.query.filter_by(uuid=tech_uuid).first() is None:
        return not_found_response('기술을 찾을 수 없습니다.')

    S.link_evidence(news_uuid, tech_uuid, note=data.get('note'),
                    actor_id=actor.id, source=_origin_of(data))
    db.session.commit()
    return created_response({'newsUuid': news_uuid, 'techUuid': tech_uuid})


@bp.route('/tech/<uuid>/evidence', methods=['GET'])
@jwt_required()
def tech_evidence(uuid):
    """그 기술을 떠받치는 소식들. **왜 이 단계인지**를 여기서 읽는다."""
    actor = _actor()
    denied = _deny_read(actor)
    if denied is not None:
        return denied

    rows = (db.session.query(IntelEvidence, IntelNews)
            .join(IntelNews, IntelNews.uuid == IntelEvidence.news_uuid)
            .filter(IntelEvidence.tech_uuid == uuid)
            .order_by(IntelNews.published_at.desc().nullslast()).all())
    return success_response([{
        'note': ev.note,
        'news': news.to_dict(),
    } for ev, news in rows])


# ─────────────────────────────────────────────────────────────────────────────
# 설정
# ─────────────────────────────────────────────────────────────────────────────

@bp.route('/settings', methods=['GET'])
@jwt_required()
def get_settings():
    actor = _actor()
    denied = _deny_read(actor)
    if denied is not None:
        return denied

    from app.modules.digital_twin_dashboard.models import ModuleSettings
    out = dict(DEFAULT_SETTINGS)
    out['stages'] = list(STAGES)
    # ⚠️ CPT 는 **설정이 아니라 외부 표준**이다. 저장된 값으로 덮이지 않게 아래에서
    #    다시 씌운다 — 늘리거나 이름을 바꾸면 업계 기준과 대조가 안 된다.
    out['cptGroups'] = [{'key': k, 'label': ko} for k, ko in CPT_GROUPS]
    for row in ModuleSettings.query.filter_by(module_name=MODULE_NAME).all():
        if row.settings_key in ('cptGroups', 'stages'):
            continue                      # 표준·고정값은 덮어쓸 수 없다
        out[row.settings_key] = row.settings_data
    return success_response(out)


@bp.route('/settings', methods=['PUT'])
@jwt_required()
def update_settings():
    actor = _actor()
    denied = _deny_curate(actor)
    if denied is not None:
        return denied

    from app.modules.digital_twin_dashboard.models import ModuleSettings
    data = get_request_json() or {}
    for key in ('newsCategories', 'techCategories'):
        if key not in data:
            continue
        # 순서는 유지하면서 중복만 걷어낸다.
        options = list(dict.fromkeys(S._clean_list(data[key])))
        row = ModuleSettings.query.filter_by(
            module_name=MODULE_NAME, settings_key=key).first()
        if row is None:
            row = ModuleSettings(module_name=MODULE_NAME, settings_key=key)
            db.session.add(row)
        row.settings_data = options
    db.session.commit()
    return success_response(message='설정을 저장했습니다.')
