"""기술정보 — 저장 규칙.

라우트에서 이리로 뺀 이유
    MCP 도구(2단계)가 **같은 규칙**으로 넣어야 한다. 라우트에 규칙을 두면 MCP 가
    HTTP 를 한 번 더 타거나 규칙을 복제하게 되고, 복제하는 순간 갈린다.
"""
import uuid as uuidlib
from datetime import date, datetime, timedelta

from sqlalchemy import func

from app.extensions import db
from app.modules.digital_twin_intel.models import (
    CPT_KEYS, ORIGINS, STAGES, TECH_KINDS, IntelChange, IntelDivisionStage,
    IntelEvidence, IntelLink, IntelNews, IntelTech,
)


def _uuid():
    return str(uuidlib.uuid4())


def _norm(s):
    """이름 맞대보기용. 대소문자ㆍ공백ㆍ하이픈을 지운다.

    ⚠️ 이것이 레이더가 잡동사니가 되는 것을 막는 마지막 문이다 —
       'NVIDIA Omniverse' 와 'nvidia-omniverse' 가 두 줄이 되면 끝이다.
    """
    return ''.join((s or '').lower().split()).replace('-', '').replace('_', '')


def _parse_date(v):
    """`YYYY-MM-DD` 만 받는다. 못 읽으면 None — **오늘로 채우지 않는다.**

    ⚠️ 발표일을 모르는 것과 오늘 발표된 것은 다르다. 오늘로 채우면 3년 전 논문이
       목록 맨 위에 선다.
    """
    if isinstance(v, date):
        return v
    if not v:
        return None
    try:
        return datetime.strptime(str(v)[:10], '%Y-%m-%d').date()
    except ValueError:
        return None


def _clean_list(v):
    if not isinstance(v, (list, tuple)):
        return []
    return [str(x).strip() for x in v if str(x).strip()]


def log_change(kind, uuid, name, field, before, after, *,
               reason=None, actor=None, source='ui', scope=None):
    """무엇이 언제 왜 바뀌었나. **커밋은 부르는 쪽이 한다**(같은 트랜잭션이어야 한다).

    ⚠️ 값이 안 바뀌었으면 안 남긴다. 안 그러면 저장 누를 때마다 이력이 한 줄씩 늘어
       **진짜 변경이 잡음에 묻힌다.**
    """
    if (before or None) == (after or None):
        return None
    row = IntelChange(
        subject_kind=kind, subject_uuid=uuid, subject_name=(name or '')[:300],
        field=field,
        before_value=(str(before)[:200] if before is not None else None),
        after_value=(str(after)[:200] if after is not None else None),
        reason=reason,
        # ⚠️ 비어 있으면 **전사**의 판단이다. 안 실으면 이력에서 전사와 사업부가
        #    뒤섞이고, 레이더의 이동 화살표가 거짓말을 한다.
        scope=scope,
        actor_user_id=getattr(actor, 'id', None),
        actor_name=getattr(actor, 'name', None),
        source=source if source in ORIGINS else 'ui')
    db.session.add(row)
    return row


def recent_moves(tech_uuids, days=90, scope=None):
    """기술마다 **최근에 어느 단계에서 왔는지**. `{uuid: (before, when)}`.

    ⚠️ 지금까지는 「움직였다」만 테두리로 표시했다. 그런데 레이더의 값은 **어디서
       어디로 갔나**에 있다 — ThoughtWorks 가 매 판마다 이동을 표시하는 이유가
       그것이다. 「관찰에 뭐가 있나」보다 **「무엇이 안쪽으로 들어왔나」**가 판단에 쓰인다.

    ⚠️ 같은 기술이 여러 번 움직였으면 **가장 오래된 출발점**을 쓴다. 관찰→시험→도입 을
       두 화살표로 그리면 어지럽고, 사람이 알고 싶은 것은 「그 사이에 어디서
       여기까지 왔나」다.

    ⚠️⚠️ **사업부 눈으로 볼 때는 그 사업부의 이력만 본다**(`scope`). 안 나누면
       화면은 「MX 기준」이라고 써 놓고 화살표는 전사 이동을 그리게 된다 — 테와
       화살표가 같은 값을 보게 맞춰 놓은 것과 같은 이유다. 거짓말하는 화살표는
       없는 화살표보다 나쁘다.
    """
    if not tech_uuids:
        return {}
    since = datetime.utcnow() - timedelta(days=days)
    rows = (IntelChange.query
            .filter(IntelChange.subject_kind == 'tech',
                    IntelChange.field == 'stage',
                    IntelChange.scope == scope,
                    IntelChange.subject_uuid.in_(list(tech_uuids)),
                    IntelChange.created_at >= since)
            .order_by(IntelChange.id.asc()).all())
    out = {}
    for r in rows:
        # 먼저 온 것(가장 오래된 출발점)만 남긴다.
        if r.subject_uuid not in out:
            out[r.subject_uuid] = (r.before_value, r.created_at)
    return out


def co_occurring(tech_uuid, limit=8):
    """**같은 소식에 함께 걸린 기술**과 그 횟수.

    ⚠️ 레이더는 기술을 하나씩 따로 보여준다. 그런데 실제 판단은 「이걸 하려면 저것도
       필요한가」다 — OpenUSD 없이 Omniverse 를 말할 수 없다. 그 정보는 `IntelEvidence`
       에 **이미 있는데 아무 데도 안 보였다.**
    """
    mine = [e.news_uuid for e in
            IntelEvidence.query.filter_by(tech_uuid=tech_uuid).all()]
    if not mine:
        return []
    rows = (db.session.query(IntelEvidence.tech_uuid, func.count(IntelEvidence.id))
            .filter(IntelEvidence.news_uuid.in_(mine),
                    IntelEvidence.tech_uuid != tech_uuid)
            .group_by(IntelEvidence.tech_uuid)
            .order_by(func.count(IntelEvidence.id).desc()).limit(limit).all())
    if not rows:
        return []
    techs = {t.uuid: t for t in IntelTech.query.filter(
        IntelTech.uuid.in_([r[0] for r in rows])).all()}
    out = []
    for uuid, n in rows:
        t = techs.get(uuid)
        if t is None:
            continue
        out.append({'uuid': t.uuid, 'name': t.name, 'stage': t.stage,
                    'category': t.category, 'summary': t.summary, 'together': n})
    return out


def overview(actor=None):
    """화면 맨 위에 띄울 **「오늘 뭘 봐야 하나」**.

    ⚠️ 지금은 열면 기술 100여 개가 깔린다. 무엇을 봐야 하는지가 없으면 사람은
       **훑다가 닫는다.** 전부 이미 계산되는 값이라 세기만 하면 된다.
    """
    unread = IntelNews.query.filter_by(status='신규').count()
    techs = IntelTech.query.filter(IntelTech.is_archived.is_(False)).all()
    stats = evidence_stats([t.uuid for t in techs])
    stale = no_evidence = 0
    for t in techs:
        cnt, last = stats.get(t.uuid, (0, None))
        if cnt == 0:
            no_evidence += 1
        if t.is_stale(last):
            stale += 1
    moved = len(recent_moves([t.uuid for t in techs], days=30))
    # 링크가 안 걸린 소식 — 「그래서 우리한테 뭔데」가 아직 안 붙은 것
    linked = {l.subject_uuid for l in IntelLink.query.filter_by(
        subject_kind='news').all()}
    unlinked_news = IntelNews.query.filter(
        ~IntelNews.uuid.in_(linked) if linked else True).count()
    return {
        'unreadNews': unread,
        'staleTech': stale,
        'noEvidenceTech': no_evidence,
        'movedIn30d': moved,
        'unlinkedNews': unlinked_news,
        'totalNews': IntelNews.query.count(),
        'totalTech': len(techs),
    }


def changes_for(kind, uuid, limit=50):
    return (IntelChange.query
            .filter_by(subject_kind=kind, subject_uuid=uuid)
            .order_by(IntelChange.id.desc()).limit(limit).all())


def _clean_cpt(v):
    """CPT 는 **정해진 여섯 개만** 받는다.

    ⚠️ 자유 입력을 허용하면 오타가 섞이고, 그 순간 「업계 기준으로 우리가 어디를
       보고 있나」를 못 센다. 모르는 값은 조용히 버린다 — 400 을 내면 MCP 로 들어오는
       것이 통째로 막히는데, 이 칸 하나 때문에 소식을 잃는 것이 더 나쁘다.
    """
    seen, out = set(), []
    for x in _clean_list(v):
        if x in CPT_KEYS and x not in seen:
            seen.add(x)
            out.append(x)
    return out


# ─────────────────────────────────────────────────────────────────────────────
# 기술 (레이더)
# ─────────────────────────────────────────────────────────────────────────────

def find_tech_by_name(name):
    """이름이나 **별칭**으로 찾는다. 없으면 None.

    별칭까지 보는 것이 요점이다 — 기사마다 다른 이름으로 나오기 때문이다.
    """
    key = _norm(name)
    if not key:
        return None
    for t in IntelTech.query.all():
        if _norm(t.name) == key:
            return t
        if any(_norm(a) == key for a in (t.aliases or [])):
            return t
    return None


def create_tech(actor_id=None, origin='ui', **data):
    name = (data.get('name') or '').strip()
    if not name:
        return None, '기술 이름이 비어 있습니다.'

    dup = find_tech_by_name(name)
    if dup is not None:
        # 조용히 새로 만들면 레이더에 같은 기술이 두 줄이 된다. 있는 것을 돌려준다.
        return dup, None

    stage = (data.get('stage') or '관찰').strip()
    if stage not in STAGES:
        return None, f'단계는 {" · ".join(STAGES)} 중 하나여야 합니다.'

    # ⚠️ 기본은 **도구**다. MCPㆍ소식으로 들어오는 것의 대부분이 제품이라, 기본을
    #    역량으로 두면 역량 목록이 곧바로 잡동사니가 된다.
    kind = data.get('kind') if data.get('kind') in TECH_KINDS else 'tool'

    parent_uuid = (data.get('parentUuid') or data.get('parent_uuid') or '').strip()
    if parent_uuid:
        """
        ⚠️⚠️ **만들면서 매다는 길에도 같은 검사를 건다.** 안 걸면 여기가
           `set_parent` 의 층 규칙을 통째로 우회하는 뒷문이 된다 — MCP 는 만들기와
           매달기를 한 번에 하므로 이 길로만 들어오는 줄이 실제로 생긴다.
        """
        p = IntelTech.query.filter_by(uuid=parent_uuid).first()
        if p is None:
            return None, '상위 역량을 찾을 수 없습니다.'
        if p.kind != 'capability':
            return None, '상위는 역량이어야 합니다. 도구 밑에 도구를 매달 수 없습니다.'
        if kind == 'capability':
            return None, '역량은 다른 것 밑에 매달 수 없습니다. 층은 둘까지입니다.'
    else:
        parent_uuid = None

    t = IntelTech(
        uuid=_uuid(), name=name,
        aliases=_clean_list(data.get('aliases')),
        vendor=(data.get('vendor') or '').strip() or None,
        category=(data.get('category') or '').strip() or None,
        url=(data.get('url') or '').strip() or None,
        stage=stage,
        stage_reason=data.get('stageReason') or data.get('stage_reason'),
        stage_changed_at=datetime.utcnow(),
        summary=data.get('summary'),
        description=data.get('description'),
        divisions=_clean_list(data.get('divisions')),
        tags=_clean_list(data.get('tags')),
        cpt=_clean_cpt(data.get('cpt')),
        # ⚠️ 기본은 **도구**다. MCPㆍ소식으로 들어오는 것의 대부분이 제품이라,
        #    기본을 역량으로 두면 역량 목록이 곧바로 잡동사니가 된다.
        kind=kind,
        parent_uuid=parent_uuid,
        origin=origin if origin in ORIGINS else 'ui',
        created_by=actor_id,
    )
    db.session.add(t)
    db.session.commit()
    return t, None


def set_stage(tech_uuid, stage, reason=None, actor=None, source='ui'):
    """레이더 단계를 옮긴다. **이유 없이 '보류' 로 못 간다.**

    ⚠️ 안 쓰기로 한 판단이야말로 근거가 남아야 한다. 안 남기면 6개월 뒤 같은 논의를
       처음부터 다시 하고, 그때 아무도 지난번에 왜 접었는지 모른다.
    """
    if stage not in STAGES:
        return None, f'단계는 {" · ".join(STAGES)} 중 하나여야 합니다.'
    t = IntelTech.query.filter_by(uuid=tech_uuid).first()
    if t is None:
        return None, '기술을 찾을 수 없습니다.'

    reason = (reason or '').strip()
    if stage == '보류' and not reason:
        return None, "'보류' 로 옮길 때는 이유를 적어야 합니다."

    if t.stage != stage:
        t.stage_changed_at = datetime.utcnow()
        # ⚠️ **이 한 줄이 판단의 기록이다.** 단계를 관리자ㆍ사무국으로 좁혀 놓고
        #    기록을 안 남기면, 「왜 작년에 도입이었다가 보류로 내려갔지」에 답할 수 없다.
        log_change('tech', t.uuid, t.name, 'stage', t.stage, stage,
                   reason=reason, actor=actor, source=source)
    t.stage = stage
    if reason:
        t.stage_reason = reason
    db.session.commit()
    return t, None


def evidence_stats(tech_uuids, rollup=True):
    """기술마다 (근거 건수, 마지막 근거 시각). 낡음 판정에 쓴다.

    ⚠️ 목록마다 기술 하나씩 세면 수백 번 왕복한다. 한 번에 모아 온다.

    ⚠️⚠️ **역량은 자식(도구)의 근거를 함께 센다**(`rollup`). 소식은 도구 이름으로
       들어오므로 역량에는 직접 걸리는 근거가 거의 없다 — 굴려 올리지 않으면
       **역량이 만들어지자마자 전부 「낡음」**이 되고, 그 순간 낡음 표시가 아무
       신호도 아니게 된다.
    """
    if not tech_uuids:
        return {}
    want = list(tech_uuids)

    # 자식까지 한 번에 모으려면 (역량 → 도구) 표가 필요하다.
    kids = {}
    if rollup:
        for uuid, parent in (db.session.query(IntelTech.uuid, IntelTech.parent_uuid)
                             .filter(IntelTech.parent_uuid.in_(want)).all()):
            kids.setdefault(parent, []).append(uuid)

    lookup = set(want)
    for v in kids.values():
        lookup.update(v)

    rows = (db.session.query(
                IntelEvidence.tech_uuid,
                func.count(IntelEvidence.id),
                func.max(IntelEvidence.created_at))
            .filter(IntelEvidence.tech_uuid.in_(list(lookup)))
            .group_by(IntelEvidence.tech_uuid).all())
    raw = {r[0]: (r[1], r[2]) for r in rows}

    out = {}
    for uuid in want:
        cnt, last = raw.get(uuid, (0, None))
        for kid in kids.get(uuid, []):
            kc, kl = raw.get(kid, (0, None))
            cnt += kc
            if kl and (last is None or kl > last):
                last = kl
        out[uuid] = (cnt, last)
    return out


def division_stages(tech_uuids, division):
    """그 사업부에 **따로 정해 둔** 단계들. `{tech_uuid: row}`.

    ⚠️ 없는 것이 정상이다 — 전사 값이 정본이고 여기 있는 것은 예외뿐이다.
    """
    if not tech_uuids or not division:
        return {}
    rows = (IntelDivisionStage.query
            .filter(IntelDivisionStage.division == division,
                    IntelDivisionStage.tech_uuid.in_(list(tech_uuids))).all())
    return {r.tech_uuid: r for r in rows}


def stages_by_division(tech_uuid):
    """한 기술을 사업부별로 죽 편다. 상세 화면의 표가 이걸 그린다."""
    rows = (IntelDivisionStage.query
            .filter_by(tech_uuid=tech_uuid)
            .order_by(IntelDivisionStage.division.asc()).all())
    return {r.division: r for r in rows}


def known_divisions():
    """포털의 사업부 표. ⚠️ 이름을 여기 박지 않는다 — 조직이 바뀌면 조용히 틀어진다."""
    try:
        from app.modules.digital_twin_dashboard.models import Division
        return [d.name for d in Division.query
                .filter(Division.is_active.is_(True))
                .order_by(Division.order.asc(), Division.id.asc()).all()]
    except Exception:
        return []


def set_division_stage(tech_uuid, division, stage, reason=None, actor=None,
                       source='ui'):
    """한 사업부만 전사와 다르게 본다고 적는다.

    ⚠️⚠️ **전사와 같은 값으로 맞추면 예외를 지운다.** 「전사와 같다」와 「아직 안
       정했다」는 화면에서 구별할 수 없고, 구별할 필요도 없다. 같은 값을 굳이
       한 줄로 남겨 두면 나중에 전사가 움직였을 때 **이 사업부만 옛 값에 붙박여**
       따라가지 않는다 — 그게 표를 못 믿게 만드는 방식이다.

    ⚠️ '보류' 는 여기서도 이유가 있어야 한다. 오히려 전사와 **다르게** 접는
       판단이라 이유가 더 중요하다.
    """
    if stage not in STAGES:
        return None, f'단계는 {" · ".join(STAGES)} 중 하나여야 합니다.'
    division = (division or '').strip()
    if not division:
        return None, '사업부를 골라야 합니다.'
    known = known_divisions()
    if known and division not in known:
        # ⚠️ 지어낸 이름을 받으면 아무 데도 안 보이는 줄이 조용히 쌓인다.
        return None, f'모르는 사업부입니다: {division}'

    t = IntelTech.query.filter_by(uuid=tech_uuid).first()
    if t is None:
        return None, '기술을 찾을 수 없습니다.'

    reason = (reason or '').strip()
    if stage == '보류' and not reason:
        return None, "'보류' 로 옮길 때는 이유를 적어야 합니다."

    row = IntelDivisionStage.query.filter_by(
        tech_uuid=tech_uuid, division=division).first()
    before = row.stage if row else t.stage

    if stage == t.stage:
        # 전사와 같아졌다 → 예외를 지우고 전사를 따라가게 둔다.
        if row is not None:
            log_change('tech', t.uuid, t.name, 'stage', before, stage,
                       reason=reason or '전사 값과 같아져 사업부 예외를 지웠습니다.',
                       actor=actor, source=source, scope=division)
            db.session.delete(row)
            db.session.commit()
        return None, None

    if row is None:
        row = IntelDivisionStage(tech_uuid=tech_uuid, division=division,
                                 stage=stage)
        db.session.add(row)
    if before != stage:
        log_change('tech', t.uuid, t.name, 'stage', before, stage,
                   reason=reason, actor=actor, source=source, scope=division)
        row.changed_at = datetime.utcnow()
    row.stage = stage
    if reason:
        row.reason = reason
    row.changed_by = getattr(actor, 'id', None)
    db.session.commit()
    return row, None


def clear_division_stage(tech_uuid, division, actor=None, source='ui'):
    """사업부 예외를 지우고 **전사 값을 따라가게** 되돌린다."""
    row = IntelDivisionStage.query.filter_by(
        tech_uuid=tech_uuid, division=division).first()
    if row is None:
        return None, None
    t = IntelTech.query.filter_by(uuid=tech_uuid).first()
    log_change('tech', tech_uuid, t.name if t else None, 'stage',
               row.stage, t.stage if t else None,
               reason='사업부 예외를 지우고 전사 값을 따릅니다.',
               actor=actor, source=source, scope=division)
    db.session.delete(row)
    db.session.commit()
    return True, None


def names_of(uuids):
    """uuid → 이름. 상위 역량 이름을 곁들일 때 쓴다."""
    if not uuids:
        return {}
    rows = (db.session.query(IntelTech.uuid, IntelTech.name)
            .filter(IntelTech.uuid.in_(list(set(uuids)))).all())
    return {u: n for u, n in rows}


def children_of(parent_uuids):
    """역량 밑에 달린 도구들. 화면이 「무엇으로 하나」를 보여줄 때 쓴다."""
    if not parent_uuids:
        return {}
    rows = (IntelTech.query
            .filter(IntelTech.parent_uuid.in_(list(parent_uuids)))
            .order_by(IntelTech.name.asc()).all())
    out = {}
    for t in rows:
        out.setdefault(t.parent_uuid, []).append({
            'uuid': t.uuid, 'name': t.name, 'stage': t.stage,
            'vendor': t.vendor, 'summary': t.summary,
        })
    return out


def set_parent(tech_uuid, parent_uuid, actor=None):
    """도구를 역량 밑에 매단다. `parent_uuid` 가 비면 떼어 낸다.

    ⚠️ **자기 자신ㆍ자기 자식을 부모로 삼을 수 없다.** 고리가 생기면 근거를 굴려
       올릴 때 무한히 돈다.
    ⚠️ **역량을 다른 것 밑에 매달지 않는다.** 층은 둘까지다 — 셋이 되면 「어디까지
       굴려 올릴 것인가」가 사람마다 달라진다.
    """
    t = IntelTech.query.filter_by(uuid=tech_uuid).first()
    if t is None:
        return None, '기술을 찾을 수 없습니다.'

    parent_uuid = (parent_uuid or '').strip()
    if not parent_uuid:
        t.parent_uuid = None
        db.session.commit()
        return t, None

    if parent_uuid == tech_uuid:
        return None, '자기 자신을 상위로 둘 수 없습니다.'
    p = IntelTech.query.filter_by(uuid=parent_uuid).first()
    if p is None:
        return None, '상위 역량을 찾을 수 없습니다.'
    if p.kind != 'capability':
        return None, '상위는 역량이어야 합니다. 도구 밑에 도구를 매달 수 없습니다.'
    if t.kind == 'capability':
        return None, '역량은 다른 것 밑에 매달 수 없습니다. 층은 둘까지입니다.'
    if p.parent_uuid == tech_uuid:
        return None, '서로를 상위로 두면 고리가 생깁니다.'

    t.parent_uuid = parent_uuid
    db.session.commit()
    return t, None


# ─────────────────────────────────────────────────────────────────────────────
# 소식
# ─────────────────────────────────────────────────────────────────────────────

def find_news_by_url(url):
    """같은 원문이 이미 있나. 같은 기사를 두 번 넣는 것을 막는다."""
    url = (url or '').strip()
    if not url:
        return None
    return IntelNews.query.filter_by(url=url).first()


def create_news(actor_id=None, origin='ui', technologies=None, **data):
    """소식 하나. `technologies` 를 같이 받아 **그 자리에서 레이더를 채운다.**

    ⚠️ 이게 이 모듈의 자정 장치 ①이다. 레이더를 따로 채우는 일로 만들면 아무도
       안 채운다 — 앞선 세 번이 그렇게 죽었다. 소식을 넣는 김에 채워져야 한다.

    ⚠️ 기술 이름이 이미 있으면 **새로 만들지 않고 잇는다**(`find_tech_by_name` 이
       별칭까지 본다). 안 그러면 레이더에 같은 기술이 여러 줄 선다.
    """
    title = (data.get('title') or '').strip()
    if not title:
        return None, '제목이 비어 있습니다.'

    url = (data.get('url') or '').strip() or None
    if url:
        dup = find_news_by_url(url)
        if dup is not None:
            return dup, None      # 이미 있는 것. 조용히 돌려준다

    n = IntelNews(
        uuid=_uuid(), title=title,
        summary=data.get('summary'), body=data.get('body'),
        source=(data.get('source') or '').strip() or None,
        url=url,
        published_at=_parse_date(data.get('publishedAt') or data.get('published_at')),
        category=(data.get('category') or '').strip() or None,
        tags=_clean_list(data.get('tags')),
        divisions=_clean_list(data.get('divisions')),
        origin=origin if origin in ORIGINS else 'ui',
        status='신규',
        created_by=actor_id,
    )
    db.session.add(n)
    db.session.flush()

    for item in (technologies or []):
        if isinstance(item, str):
            item = {'name': item}
        name = (item.get('name') or '').strip()
        if not name:
            continue
        t = find_tech_by_name(name)
        if t is None:
            t, err = create_tech(actor_id=actor_id, origin=origin,
                                 name=name, category=item.get('category'),
                                 vendor=item.get('vendor'))
            if err:
                continue
        link_evidence(n.uuid, t.uuid, note=item.get('note'),
                      actor_id=actor_id, source=origin)

    db.session.commit()
    return n, None


def link_evidence(news_uuid, tech_uuid, note=None, actor_id=None, source='ui'):
    """소식 ↔ 기술. 이미 있으면 아무것도 안 한다."""
    exists = IntelEvidence.query.filter_by(
        news_uuid=news_uuid, tech_uuid=tech_uuid).first()
    if exists is not None:
        return exists
    e = IntelEvidence(news_uuid=news_uuid, tech_uuid=tech_uuid,
                      note=note, created_by=actor_id, source=source)
    db.session.add(e)
    db.session.flush()
    return e


def unlink_evidence(news_uuid, tech_uuid):
    """소식 ↔ 기술 근거를 끊는다.

    ⚠️ **되돌릴 수 있어야 한다.** AI 제안을 눌러 잘못 걸었는데 무를 방법이 없으면,
       한 번 데인 사람은 **그다음부터 안 누른다.** 못 무르는 기능은 안 쓰는 기능이다.
    """
    row = IntelEvidence.query.filter_by(
        news_uuid=news_uuid, tech_uuid=tech_uuid).first()
    if row is None:
        return False
    db.session.delete(row)
    db.session.commit()
    return True


def evidence_for_news(news_uuids):
    """소식마다 걸린 기술 목록. 목록 화면이 한 번에 쓴다."""
    if not news_uuids:
        return {}
    rows = (db.session.query(IntelEvidence, IntelTech)
            .join(IntelTech, IntelTech.uuid == IntelEvidence.tech_uuid)
            .filter(IntelEvidence.news_uuid.in_(list(news_uuids))).all())
    out = {}
    for ev, tech in rows:
        out.setdefault(ev.news_uuid, []).append({
            'uuid': tech.uuid, 'name': tech.name, 'stage': tech.stage,
            'note': ev.note,
        })
    return out


# ─────────────────────────────────────────────────────────────────────────────
# 포털 안쪽과의 연결
# ─────────────────────────────────────────────────────────────────────────────

LINK_TARGETS = ('project', 'kpi', 'sw')


def add_link(subject_kind, subject_uuid, target_kind, target_ref,
             relevance=None, actor_id=None, source='ui'):
    if subject_kind not in ('news', 'tech'):
        return None, "subject_kind 는 'news' 또는 'tech' 여야 합니다."
    if target_kind not in LINK_TARGETS:
        return None, f'target_kind 는 {" · ".join(LINK_TARGETS)} 중 하나여야 합니다.'
    target_ref = (str(target_ref or '')).strip()
    if not target_ref:
        return None, '연결 대상이 비어 있습니다.'

    exists = IntelLink.query.filter_by(
        subject_kind=subject_kind, subject_uuid=subject_uuid,
        target_kind=target_kind, target_ref=target_ref).first()
    if exists is not None:
        return exists, None

    ln = IntelLink(subject_kind=subject_kind, subject_uuid=subject_uuid,
                   target_kind=target_kind, target_ref=target_ref,
                   relevance=relevance, created_by=actor_id, source=source)
    db.session.add(ln)
    db.session.commit()
    return ln, None


def remove_link(link_id):
    row = IntelLink.query.filter_by(id=link_id).first()
    if row is None:
        return False
    db.session.delete(row)
    db.session.commit()
    return True


def merge_tech(loser_uuid, winner_uuid, actor=None):
    """두 줄이 된 기술을 하나로 합친다.

    ⚠️ **레이더가 잡동사니가 되는 마지막 구멍이다.** 별칭으로 대부분 막지만, 표기가
       많이 다르면(「Omniverse」 vs 「엔비디아 옴니버스」) 두 줄이 선다. 합칠 방법이
       없으면 그 두 줄은 영원히 남고, 근거도 둘로 갈려 **어느 쪽도 제대로 안 보인다.**

    지는 쪽의 **이름을 이기는 쪽 별칭에 넣는다** — 그래야 다음에 그 이름으로 소식이
    들어와도 같은 줄에 붙는다. 이걸 안 하면 지운 줄이 곧바로 다시 생긴다.
    """
    if loser_uuid == winner_uuid:
        return None, '같은 기술입니다.'
    loser = IntelTech.query.filter_by(uuid=loser_uuid).first()
    winner = IntelTech.query.filter_by(uuid=winner_uuid).first()
    if loser is None or winner is None:
        return None, '기술을 찾을 수 없습니다.'

    # 근거 옮기기 — 이미 같은 짝이 있으면 버린다(유니크 제약).
    have = {e.news_uuid for e in IntelEvidence.query.filter_by(
        tech_uuid=winner.uuid).all()}
    for e in IntelEvidence.query.filter_by(tech_uuid=loser.uuid).all():
        if e.news_uuid in have:
            db.session.delete(e)
        else:
            e.tech_uuid = winner.uuid

    # 포털 연결 옮기기 — 같은 대상이 이미 있으면 버린다.
    have_l = {(l.target_kind, l.target_ref) for l in IntelLink.query.filter_by(
        subject_kind='tech', subject_uuid=winner.uuid).all()}
    for l in IntelLink.query.filter_by(subject_kind='tech',
                                       subject_uuid=loser.uuid).all():
        if (l.target_kind, l.target_ref) in have_l:
            db.session.delete(l)
        else:
            l.subject_uuid = winner.uuid

    # ⚠️ 지는 이름을 별칭에 넣는다. 안 넣으면 다음 소식이 그 이름으로 들어와
    #    **지운 줄이 곧바로 다시 생긴다.**
    aliases = list(winner.aliases or [])
    for name in [loser.name] + list(loser.aliases or []):
        if name and _norm(name) != _norm(winner.name) \
                and not any(_norm(a) == _norm(name) for a in aliases):
            aliases.append(name)
    winner.aliases = aliases

    # 이기는 쪽이 비어 있으면 지는 쪽 설명을 물려받는다 — 버리면 아까운 것만.
    for col in ('summary', 'description', 'vendor', 'url', 'category'):
        if not getattr(winner, col) and getattr(loser, col):
            setattr(winner, col, getattr(loser, col))

    log_change('tech', winner.uuid, winner.name, 'merge', loser.name, winner.name,
               reason=f'「{loser.name}」 를 합쳤습니다.', actor=actor)
    db.session.delete(loser)
    db.session.commit()
    return winner, None


def links_for(subject_kind, subject_uuids):
    if not subject_uuids:
        return {}
    rows = IntelLink.query.filter(
        IntelLink.subject_kind == subject_kind,
        IntelLink.subject_uuid.in_(list(subject_uuids))).all()
    out = {}
    for ln in rows:
        out.setdefault(ln.subject_uuid, []).append({
            'id': ln.id, 'targetKind': ln.target_kind, 'targetRef': ln.target_ref,
            'relevance': ln.relevance,
        })
    return out
