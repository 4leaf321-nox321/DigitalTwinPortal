"""디지털 트윈 기술정보 API.

두 탭에 대응한다 — `/news` (소식) · `/tech` (기술 레이더).

⚠️ **모든 쓰기 길에 권한 검사가 있다.** `@jwt_required()` 만으로는 부족하다 —
   그건 "로그인했다" 지 "이걸 해도 된다" 가 아니다. 2026-08-25 조사에서 아홉 모듈이
   그 상태였고, 이 모듈은 거기 끼지 않는다. 규칙은 `permissions.py` 한 곳에 있다.
"""
from flask import current_app, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.modules.digital_twin_intel import bp
from app.modules.digital_twin_intel import permissions as P
from app.modules.digital_twin_intel import services as S
from app.modules.digital_twin_intel.models import (
    CPT_GROUPS, DEFAULT_SECTORS, NEWS_STATUSES, ORIGINS, STAGES, TECH_KINDS,
    IntelEvidence, IntelNews, IntelTech,
)
from app.shared.responses import (
    created_response, error_response, not_found_response, success_response,
)
from app.shared.utils import get_request_json

MODULE_NAME = 'digital_twin_intel'

# 레이더에 「어디서 왔는지」 화살표를 그리는 기간.
#
# ⚠️ **화면에 같은 숫자를 박지 않는다.** 한때 `RadarChart.jsx` 에도 90 이 박혀 있었다 —
#    여기만 바꾸면 범례가 「최근 90일」이라 말하면서 실제로는 다른 기간을 그린다.
#    설정 응답(`movedWindowDays`)으로 내려보내 **화면이 서버 값을 읽게** 한다.
MOVED_WINDOW_DAYS = 90

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
        # ⚠️ **원문(`body`)까지 찾는다.** 담는 이유가 「나중에 읽으려고」인데
        #    못 찾으면 안 읽는다. 3천 자짜리 본문을 넣어 두고 제목으로만 찾던 것을
        #    2026-08-25 에 고쳤다.
        q = q.filter(db.or_(IntelNews.title.ilike(like),
                            IntelNews.summary.ilike(like),
                            IntelNews.source.ilike(like),
                            IntelNews.body.ilike(like)))
    if request.args.get('techUuid'):
        subs = db.session.query(IntelEvidence.news_uuid).filter(
            IntelEvidence.tech_uuid == request.args['techUuid'])
        q = q.filter(IntelNews.uuid.in_(subs))

    rows = q.order_by(IntelNews.published_at.desc().nullslast(),
                      IntelNews.id.desc()).limit(500).all()
    uuids = [r.uuid for r in rows]
    ev = S.evidence_for_news(uuids)
    # ⚠️ 「아직 우리 것과 안 이어진 소식」을 목록에서 거르려면 **셈이 함께 와야 한다.**
    #    없으면 화면이 소식마다 연결을 따로 물어봐야 하고, 수백 건이면 그만큼 왕복한다.
    links = S.links_for('news', uuids)
    out = []
    for r in rows:
        d = r.to_dict(evidence=ev.get(r.uuid, []))
        d['linkCount'] = len(links.get(r.uuid, []))
        out.append(d)
    return success_response(out)


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
    # ⚠️ 아는 값만 받는다. 오타가 들어가면 그 소식은 **어느 거르기에도 안 걸려**
    #    목록에서 조용히 사라진다.
    if 'status' in data and data['status'] not in NEWS_STATUSES:
        return error_response(
            f'상태는 {" · ".join(NEWS_STATUSES)} 중 하나여야 합니다.', status_code=400)
    if 'status' in data and data['status'] != n.status:
        S.log_change('news', n.uuid, n.title, 'status', n.status, data['status'],
                     actor=actor, source=_origin_of(data))

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

    # ⚠️⚠️ 사업부를 고르면 **그 사업부 눈으로 다시 그린다**(거르는 것이 아니다).
    #    「우리 사업부와 관련된 것만」이 아니라 「우리 사업부는 어디까지 왔나」가
    #    묻고 싶은 것이다 — 관련 없는 것은 전사 값 그대로 서면 되고 그게 정확하다.
    division = (request.args.get('division') or '').strip()

    q = IntelTech.query
    # ⚠️ 사업부 눈일 때는 단계 거르기를 SQL 에서 하면 안 된다 — 컬럼 값과 화면에
    #    그려지는 값이 다르다. 아래에서 **푼 값**으로 거른다.
    if request.args.get('stage') and not division:
        q = q.filter(IntelTech.stage == request.args['stage'])
    if request.args.get('category'):
        q = q.filter(IntelTech.category == request.args['category'])
    if request.args.get('q'):
        like = f"%{request.args['q'].strip()}%"
        q = q.filter(db.or_(IntelTech.name.ilike(like),
                            IntelTech.vendor.ilike(like),
                            IntelTech.summary.ilike(like),
                            IntelTech.description.ilike(like)))
    if request.args.get('includeArchived') not in ('1', 'true', 'yes'):
        q = q.filter(IntelTech.is_archived.is_(False))
    if request.args.get('kind') in TECH_KINDS:
        q = q.filter(IntelTech.kind == request.args['kind'])
    if request.args.get('parentUuid'):
        q = q.filter(IntelTech.parent_uuid == request.args['parentUuid'])

    """
    ⚠️ **레이더에 그리는 것은 「역량 + 부모 없는 도구」다**(`radar=1`).
       역량 밑에 매달린 도구까지 그리면 같은 것이 두 번 서고, 층을 나눈 뜻이 사라진다.
       역량 정의가 안 끝나도 돌아야 하므로 **부모 없는 도구는 그대로 뜬다.**
    """
    if request.args.get('radar') in ('1', 'true', 'yes'):
        q = q.filter(db.or_(IntelTech.kind == 'capability',
                            IntelTech.parent_uuid.is_(None)))

    rows = q.order_by(IntelTech.name.asc()).all()
    uuids = [r.uuid for r in rows]
    # 역량은 자식(도구)의 근거를 함께 센다 — 안 그러면 만들자마자 「낡음」이 된다.
    stats = S.evidence_stats(uuids)
    kids = S.children_of([r.uuid for r in rows if r.kind == 'capability'])
    # ⚠️ 「움직였다」만이 아니라 **어디서 왔는지**를 함께 준다. 레이더의 값은
    #    「무엇이 안쪽으로 들어왔나」에 있다.
    # ⚠️ 이동 화살표도 **그 사업부의 이력**만 본다. 안 나누면 화면은 「MX 기준」이라
    #    써 놓고 화살표는 전사 이동을 그린다 — 거짓말하는 화살표는 없느니만 못하다.
    moves = S.recent_moves(uuids, days=MOVED_WINDOW_DAYS, scope=division or None)
    # 상위 이름. ⚠️ 걸러 본 목록에는 그 역량이 없을 수 있으므로 따로 물어 온다.
    parents = S.names_of([r.parent_uuid for r in rows if r.parent_uuid])
    dstages = S.division_stages(uuids, division) if division else {}
    # ⚠️ 도구 이름을 목록에 함께 싣는다. 화면이 줄마다 따로 물으면 수십 번 왕복한다.
    dtools = S.tools_of(list(dstages.values())) if dstages else {}
    out = []
    for r in rows:
        cnt, last = stats.get(r.uuid, (0, None))
        d = r.to_dict(last_evidence_at=last, evidence_count=cnt,
                      parent_name=parents.get(r.parent_uuid),
                      division=division or None,
                      division_stage=dstages.get(r.uuid),
                      division_tools=(dtools.get(dstages[r.uuid].id)
                                      if r.uuid in dstages else None),
                      children=kids.get(r.uuid, []) if r.kind == 'capability' else None)
        mv = moves.get(r.uuid)
        # ⚠️ **푼 값과 견준다.** 컬럼 값과 견주면 사업부 눈에서 화살표가 사라진다 —
        #    전사가 「시험」인데 MX 가 「도입」으로 갔으면 출발점(시험)이 컬럼과
        #    같아서 「안 움직였다」로 읽힌다. 단계 거르기와 같은 부류의 실수다.
        if mv and mv[0] and mv[0] != d['stage']:
            d['movedFrom'] = mv[0]
            d['movedAt'] = mv[1].isoformat() if mv[1] else None
        out.append(d)

    # ⚠️ **낡음 판정은 서버가 한다.** 단계마다 기준 일수가 다르고, 그 표가 화면에
    #    복제되면 갈린다. 그래서 거르기도 여기서 한다.
    if request.args.get('stale') in ('1', 'true', 'yes'):
        out = [t for t in out if t.get('isStale')]
    # 사업부 눈일 때의 단계 거르기 — **푼 값**으로 한다(위 참고).
    if request.args.get('stage') and division:
        out = [t for t in out if t.get('stage') == request.args['stage']]
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
    if 'kind' in data and data['kind'] in TECH_KINDS:
        # ⚠️ 자식이 달린 역량을 도구로 내리면 그 자식들이 부모 없는 도구가 되어
        #    레이더에 갑자기 쏟아진다. 먼저 떼어 내게 한다.
        if data['kind'] == 'tool' and t.kind == 'capability':
            if S.children_of([t.uuid]).get(t.uuid):
                return error_response(
                    '이 역량에 매달린 도구가 있습니다. 먼저 떼어 낸 뒤 바꾸세요.',
                    status_code=400)
        t.kind = data['kind']
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


@bp.route('/tech/<uuid>/division-stages', methods=['GET'])
@jwt_required()
def list_division_stages(uuid):
    """이 기술을 **사업부별로 죽 편다.** 상세 화면의 표가 이걸 그린다.

    ⚠️ 예외가 걸린 사업부만 온다. 나머지는 전사 값을 따르는 것이고, 그것이 정상이다.
    """
    actor = _actor()
    denied = _deny_read(actor)
    if denied is not None:
        return denied

    t = IntelTech.query.filter_by(uuid=uuid).first()
    if t is None:
        return not_found_response('기술을 찾을 수 없습니다.')

    rows = S.stages_by_division(uuid)
    tnames = S.tools_of(list(rows.values()))
    return success_response({
        'companyStage': t.stage,
        'divisions': S.known_divisions(),
        # ⚠️ 고를 수 있는 도구는 **이 역량 밑에 매달린 것**뿐이다. 화면이 목록
        #    전체에서 고르게 하면 「explicit 해석을 Grafana 로 한다」가 생긴다.
        'toolChoices': S.children_of([uuid]).get(uuid, []),
        # ⚠️ `stage` 가 비어 있는 줄은 **예외가 아니다** — 전사를 따르면서 도구나
        #    메모만 적어 둔 줄이다. 화면이 이 둘을 갈라 보여야 한다.
        'overrides': [{
            'division': d,
            'stage': r.stage,
            'followsCompany': r.follows_company(),
            'reason': r.reason,
            'tools': r.tools or [],
            'toolNames': tnames.get(r.id, []),
            'changedAt': r.changed_at.isoformat() if r.changed_at else None,
        } for d, r in rows.items()],
    })


@bp.route('/tech/<uuid>/used-by', methods=['GET'])
@jwt_required()
def used_by(uuid):
    """**이 도구를 쓰는 사업부.** 사업부 줄을 거꾸로 읽는다.

    ⚠️ 적어 넣는 쪽만 있고 되짚는 쪽이 없으면 적을 이유가 절반으로 준다. 「LS-DYNA
       를 누가 쓰나」에 답이 나와야 사람이 「무엇으로 하나」를 채운다.
    """
    actor = _actor()
    denied = _deny_read(actor)
    if denied is not None:
        return denied
    return success_response(S.used_by_division(uuid))


@bp.route('/tech/<uuid>/division-stage', methods=['PUT'])
@jwt_required()
def set_division_stage(uuid):
    """한 사업부만 전사와 다르게 본다고 적는다.

    ⚠️ **단계 변경과 같은 권한이다**(관리자ㆍ사무국). 사업부별이라고 해서 아무나
       옮길 수 있게 하면, 좁혀 둔 「조직의 판단」이 옆문으로 새어 나간다.

    ⚠️ 전사와 **같은 값**을 보내면 예외를 지운다 — 「전사와 같다」와 「아직 안
       정했다」는 구별할 필요가 없고, 굳이 남겨 두면 전사가 움직였을 때 이 사업부만
       옛 값에 붙박인다.
    """
    actor = _actor()
    denied = _deny_curate(actor)
    if denied is not None:
        return denied

    data = get_request_json() or {}
    row, err = S.set_division_stage(
        uuid, data.get('division'), data.get('stage'),
        reason=data.get('reason'), tools=data.get('tools'),
        actor=actor, source=_origin_of(data))
    if err:
        return error_response(err, status_code=400)
    if row is None:
        return success_response(None)
    return success_response(row.to_dict(
        tool_names=S.tools_of([row]).get(row.id, [])))


@bp.route('/tech/<uuid>/division-stage', methods=['DELETE'])
@jwt_required()
def clear_division_stage(uuid):
    """사업부 예외를 지우고 **전사 값을 따라가게** 되돌린다."""
    actor = _actor()
    denied = _deny_curate(actor)
    if denied is not None:
        return denied

    division = (request.args.get('division') or '').strip()
    if not division:
        return error_response('사업부를 골라야 합니다.', status_code=400)
    S.clear_division_stage(uuid, division, actor=actor)
    return success_response({'division': division, 'cleared': True})


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
                            reason=data.get('reason'), actor=actor,
                            source=_origin_of(data))
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


@bp.route('/evidence', methods=['DELETE'])
@jwt_required()
def remove_evidence():
    """근거를 끊는다. 질의 `newsUuid`ㆍ`techUuid`.

    ⚠️ **되돌릴 수 있어야 한다.** AI 제안을 눌러 잘못 걸었는데 무를 방법이 없으면
       한 번 데인 사람은 그다음부터 안 누른다 — **못 무르는 기능은 안 쓰는 기능이다.**

    ⚠️ 지우는 권한을 사무국으로 좁히지 **않는다.** 거는 것이 누구나인데 끊는 것만
       좁히면, 실수한 사람이 자기 실수를 못 치운다. 근거는 값싸고 다시 걸 수 있다
       (소식ㆍ기술 자체를 지우는 것은 여전히 사무국만).
    """
    actor = _actor()
    denied = _deny_write(actor)
    if denied is not None:
        return denied

    news_uuid = (request.args.get('newsUuid') or '').strip()
    tech_uuid = (request.args.get('techUuid') or '').strip()
    if not news_uuid or not tech_uuid:
        return error_response('newsUuid 와 techUuid 가 모두 필요합니다.', status_code=400)
    if not S.unlink_evidence(news_uuid, tech_uuid):
        return not_found_response('그 근거를 찾을 수 없습니다.')
    return success_response(message='근거를 끊었습니다.')


@bp.route('/tech/<uuid>/related', methods=['GET'])
@jwt_required()
def related_tech(uuid):
    """**같은 소식에 함께 걸린 기술**과 그 횟수.

    ⚠️ 레이더는 기술을 하나씩 따로 보여준다. 그런데 실제 판단은 「이걸 하려면 저것도
       필요한가」다. 그 정보는 근거 표에 **이미 있었는데 아무 데도 안 보였다.**
    """
    actor = _actor()
    denied = _deny_read(actor)
    if denied is not None:
        return denied
    return success_response(S.co_occurring(uuid))


@bp.route('/overview', methods=['GET'])
@jwt_required()
def overview():
    """화면 맨 위의 **「오늘 뭘 봐야 하나」**.

    ⚠️ 열면 기술 100여 개가 깔린다. 무엇을 봐야 하는지가 없으면 사람은 훑다가 닫는다.
       전부 이미 계산되는 값이라 세기만 한다.
    """
    actor = _actor()
    denied = _deny_read(actor)
    if denied is not None:
        return denied
    return success_response(S.overview(actor))


@bp.route('/tech/<uuid>/parent', methods=['PUT'])
@jwt_required()
def set_parent(uuid):
    """도구를 역량 밑에 매단다. 본문 `parentUuid` (비우면 떼어 낸다).

    ⚠️ 매다는 것은 **판단이 아니라 정리**라 누구나 할 수 있다. 단계와 다르다 —
       거기서 막으면 도구가 영영 부모 없이 남는다.
    """
    actor = _actor()
    denied = _deny_write(actor)
    if denied is not None:
        return denied

    data = get_request_json() or {}
    t, err = S.set_parent(uuid, data.get('parentUuid'), actor=actor)
    if err:
        code = 404 if '찾을 수 없' in err else 400
        return error_response(err, status_code=code)
    cnt, last = S.evidence_stats([t.uuid]).get(t.uuid, (0, None))
    return success_response(t.to_dict(last_evidence_at=last, evidence_count=cnt))


@bp.route('/tech/<uuid>/merge', methods=['POST'])
@jwt_required()
def merge_tech(uuid):
    """이 기술을 다른 기술에 **합친다**. 본문 `intoUuid`. 관리자ㆍ사무국만.

    ⚠️ 되돌릴 수 없다(한쪽이 지워진다). 그래서 지우기와 같은 권한으로 좁힌다.
    ⚠️ 지는 쪽 **이름이 이기는 쪽 별칭으로 들어간다** — 안 그러면 다음 소식이 그
       이름으로 들어와 **지운 줄이 곧바로 다시 생긴다.**
    """
    actor = _actor()
    denied = _deny_curate(actor)
    if denied is not None:
        return denied

    into = ((get_request_json() or {}).get('intoUuid') or '').strip()
    if not into:
        return error_response('합칠 대상(intoUuid)이 필요합니다.', status_code=400)
    winner, err = S.merge_tech(uuid, into, actor=actor)
    if err:
        code = 404 if '찾을 수 없' in err else 400
        return error_response(err, status_code=code)
    cnt, last = S.evidence_stats([winner.uuid]).get(winner.uuid, (0, None))
    return success_response(winner.to_dict(last_evidence_at=last, evidence_count=cnt))


@bp.route('/<kind>/<uuid>/changes', methods=['GET'])
@jwt_required()
def list_changes(kind, uuid):
    """무엇이 언제 왜 바뀌었나. 지금은 **레이더 단계와 소식 상태**를 남긴다.

    ⚠️ 단계를 「조직의 판단」이라며 좁혀 놓고 기록이 없으면 좁힌 의미가 절반이다 —
       「왜 작년에 도입이었다가 보류로 내려갔지」에 답할 수 있어야 한다.
    """
    actor = _actor()
    denied = _deny_read(actor)
    if denied is not None:
        return denied
    if kind not in ('news', 'tech'):
        return error_response("kind 는 'news' 또는 'tech' 여야 합니다.", status_code=400)
    return success_response([r.to_dict() for r in S.changes_for(kind, uuid)])


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
# 포털 안쪽과의 연결 — AI 제안 + 사람이 고른 것만 저장
# ─────────────────────────────────────────────────────────────────────────────

@bp.route('/<kind>/<uuid>/suggest', methods=['POST'])
@jwt_required()
def suggest_links(kind, uuid):
    """사내 LLM 이 읽고 **정리와 연결 후보**를 낸다. `kind` 는 news | tech.

    ⚠️⚠️ **제안일 뿐 저장하지 않는다.** 자동으로 걸면 근거 없는 연결이 쌓이고,
       그러면 연결 자체를 아무도 안 믿게 된다 — 안 믿는 연결은 없는 것과 같다.
       사람이 고른 것만 `POST /links` 로 들어간다.

    ⚠️ 후보 과제는 **그 사람이 볼 수 있는 것만** 넣는다. 안 그러면 남의 사업부 과제
       이름이 제안에 실려 새어 나간다.
    """
    actor = _actor()
    denied = _deny_write(actor)      # 읽기만 하지만 LLM 을 태우므로 쓰기 권한과 같이 본다
    if denied is not None:
        return denied

    from app.modules.digital_twin_dashboard.ai import llm as _llm
    from app.modules.digital_twin_intel import assist

    sectors = get_settings_value('techCategories') or list(DEFAULT_SECTORS)
    try:
        out, err = assist.suggest(actor, kind, uuid, sectors=sectors)
    except _llm.LLMNotConfigured as exc:
        # 기능이 꺼진 것이지 고장이 아니다. 503 으로 갈라 화면이 다르게 안내한다.
        return error_response(str(exc), status_code=503)
    except _llm.LLMError as exc:
        current_app.logger.exception('[intel] AI 정리 실패')
        return error_response(f'AI 정리에 실패했습니다: {exc}', status_code=502)

    if err:
        code = 404 if '찾을 수 없' in err else 400
        return error_response(err, status_code=code)
    return success_response(out)


@bp.route('/links', methods=['POST'])
@jwt_required()
def add_link():
    """소식·기술을 과제 / KPI / 보유SW 와 잇는다. **사람이 고른 것만 여기 온다.**"""
    actor = _actor()
    denied = _deny_write(actor)
    if denied is not None:
        return denied

    data = get_request_json() or {}
    ln, err = S.add_link(
        (data.get('subjectKind') or '').strip(),
        (data.get('subjectUuid') or '').strip(),
        (data.get('targetKind') or '').strip(),
        data.get('targetRef'),
        relevance=data.get('relevance'),
        actor_id=actor.id,
        source=_origin_of(data))
    if err:
        return error_response(err, status_code=400)
    return created_response({'id': ln.id, 'targetKind': ln.target_kind,
                             'targetRef': ln.target_ref})


@bp.route('/links/<int:link_id>', methods=['DELETE'])
@jwt_required()
def remove_link(link_id):
    """연결을 끊는다. **AI 제안을 잘못 눌렀을 때 무르는 자리다.**"""
    actor = _actor()
    denied = _deny_write(actor)
    if denied is not None:
        return denied
    if not S.remove_link(link_id):
        return not_found_response('그 연결을 찾을 수 없습니다.')
    return success_response(message='연결을 끊었습니다.')


@bp.route('/<kind>/<uuid>/links', methods=['GET'])
@jwt_required()
def list_links(kind, uuid):
    """그 소식·기술에 걸린 포털 안쪽 연결. **이름까지 붙여** 돌려준다.

    ⚠️ `target_ref` 만 주면 화면이 과제 uuid 를 다시 조회해야 한다. 목록마다
       왕복이 생기고, 무엇보다 **지워진 과제를 가리키는 줄**을 화면이 알아서 처리해야
       한다. 여기서 한 번에 붙여 준다.
    """
    actor = _actor()
    denied = _deny_read(actor)
    if denied is not None:
        return denied
    if kind not in ('news', 'tech'):
        return error_response("kind 는 'news' 또는 'tech' 여야 합니다.", status_code=400)

    rows = (S.links_for(kind, [uuid]) or {}).get(uuid, [])
    return success_response(_decorate_links(rows))


def _decorate_links(rows):
    """연결에 사람이 읽을 이름을 붙인다. 대상이 사라졌으면 그렇게 표시한다."""
    from app.modules.digital_twin_dashboard.models_v2 import Dt2Project
    from app.modules.dx_kpi_management.models import KpiDefinition

    p_refs = [r['targetRef'] for r in rows if r['targetKind'] == 'project']
    k_refs = [r['targetRef'] for r in rows if r['targetKind'] == 'kpi']
    projects = {p.uuid: p for p in Dt2Project.query.filter(
        Dt2Project.uuid.in_(p_refs)).all()} if p_refs else {}
    kpis = {}
    if k_refs:
        ids = [int(x) for x in k_refs if str(x).isdigit()]
        if ids:
            kpis = {str(d.id): d for d in KpiDefinition.query.filter(
                KpiDefinition.id.in_(ids)).all()}

    out = []
    for r in rows:
        label = None
        if r['targetKind'] == 'project':
            p = projects.get(r['targetRef'])
            label = p.title if p else None
        elif r['targetKind'] == 'kpi':
            d = kpis.get(str(r['targetRef']))
            label = d.label if d else None
        out.append({**r, 'label': label,
                    # 대상이 사라진 줄. 조용히 빈칸으로 두면 「이름 없는 연결」이 남는다.
                    'missing': label is None and r['targetKind'] in ('project', 'kpi')})
    return out


def get_settings_value(key):
    """저장된 설정 하나. 없으면 None."""
    from app.modules.digital_twin_dashboard.models import ModuleSettings
    row = ModuleSettings.query.filter_by(
        module_name=MODULE_NAME, settings_key=key).first()
    return row.settings_data if row else None


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
    out['newsStatuses'] = list(NEWS_STATUSES)
    # 화면 범례가 이 값을 읽는다. 숫자를 두 곳에 두지 않는다.
    out['movedWindowDays'] = MOVED_WINDOW_DAYS
    out['techKinds'] = list(TECH_KINDS)

    # ⚠️ 사업부 이름을 여기 박지 않는다. 조직이 바뀌면 화면이 조용히 틀어진다 —
    #    포털의 사업부 표를 그대로 읽어 **차례까지** 넘긴다(화면은 자료에 실제로
    #    적힌 것만 골라 쓴다).
    try:
        from app.modules.digital_twin_dashboard.models import Division
        out['divisions'] = [d.name for d in Division.query
                            .filter(Division.is_active.is_(True))
                            .order_by(Division.order.asc(), Division.id.asc()).all()]
    except Exception:
        # 사업부 표를 못 읽는다고 설정 전체가 죽으면 안 된다.
        out['divisions'] = []
    for row in ModuleSettings.query.filter_by(module_name=MODULE_NAME).all():
        if row.settings_key in ('cptGroups', 'stages', 'newsStatuses',
                                'movedWindowDays', 'techKinds', 'divisions'):
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
