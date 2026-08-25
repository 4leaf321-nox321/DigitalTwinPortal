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
    CPT_KEYS, MOVED_WINDOW_DAYS, ORIGINS, STAGES, TECH_KINDS, IntelChange,
    IntelDivisionStage, IntelEvidence, IntelLink, IntelNews, IntelTech,
    IntelTechCapability, shows_vendor,
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


def overview(actor=None, moved_days=MOVED_WINDOW_DAYS):
    """화면 맨 위에 띄울 **「오늘 뭘 봐야 하나」**.

    ⚠️⚠️ **셈은 「눌렀을 때 보이는 것」과 같아야 한다.** 안 그러면 「낡은 기술 200」을
       눌렀는데 화면에 20개만 뜨고, 그 순간 이 막대를 아무도 안 믿는다. 그래서
       기술 셈은 **레이더에 서는 줄**(역량 + 안 매달린 도구)로만 센다 — 매달린
       도구는 레이더에 안 서므로 눌러도 안 보인다.

       실측(2026-08-25) — 전체 322줄 중 레이더에 서는 것은 **63개**뿐이었다.

    ⚠️ 이동도 **보는 사람이 고른 기간**으로 센다(`moved_days`). 막대는 「최근 30일」
       이라 써 놓고 레이더는 90일을 그리고 있었다.
    """
    unread = IntelNews.query.filter_by(status='신규').count()
    every = IntelTech.query.filter(IntelTech.is_archived.is_(False)).all()
    # 레이더가 그리는 것과 **같은 규칙**이다(routes 의 `radar=1` 과 한 몸).
    linked = linked_tech_uuids()
    techs = [t for t in every
             if t.kind == 'capability' or t.uuid not in linked]

    stats = evidence_stats([t.uuid for t in techs])
    stale = no_evidence = 0
    for t in techs:
        cnt, last = stats.get(t.uuid, (0, None))
        if cnt == 0:
            no_evidence += 1
        if t.is_stale(last):
            stale += 1
    moved = len(recent_moves([t.uuid for t in techs], days=moved_days))
    # 링크가 안 걸린 소식 — 「그래서 우리한테 뭔데」가 아직 안 붙은 것
    linked = {l.subject_uuid for l in IntelLink.query.filter_by(
        subject_kind='news').all()}
    unlinked_news = IntelNews.query.filter(
        ~IntelNews.uuid.in_(linked) if linked else True).count()
    return {
        'unreadNews': unread,
        'staleTech': stale,
        'noEvidenceTech': no_evidence,
        # ⚠️ 이름에 30을 박지 않는다 — 기간이 바뀌는 값이 됐다.
        'movedRecent': moved,
        'movedWindowDays': moved_days,
        'unlinkedNews': unlinked_news,
        'totalNews': IntelNews.query.count(),
        # ⚠️ **레이더에 서는 수**다. 매달린 도구까지 세면 화면과 안 맞는다.
        'totalTech': len(techs),
        'capabilityCount': sum(1 for t in every if t.kind == 'capability'),
        'toolCount': sum(1 for t in every if t.kind != 'capability'),
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

    """
    ⚠️⚠️ **만들면서 매다는 길에도 같은 검사를 건다.** 안 걸면 여기가 `set_capabilities`
       의 층 규칙을 통째로 우회하는 뒷문이 된다 — MCP 는 만들기와 매달기를 한 번에
       하므로 이 길로만 들어오는 줄이 실제로 생긴다.
    """
    want = data.get('capabilityUuids') or data.get('parentUuid') or []
    if isinstance(want, str):
        want = [want] if want.strip() else []
    want = [str(u).strip() for u in want if str(u or '').strip()]
    if want:
        if kind == 'capability':
            return None, '역량은 다른 것 밑에 매달 수 없습니다. 층은 둘까지입니다.'
        found = {c.uuid: c for c in IntelTech.query
                 .filter(IntelTech.uuid.in_(want)).all()}
        for u in want:
            if u not in found:
                return None, '상위 역량을 찾을 수 없습니다.'
            if found[u].kind != 'capability':
                return None, '상위는 역량이어야 합니다. 도구 밑에 도구를 매달 수 없습니다.'

    t = IntelTech(
        uuid=_uuid(), name=name,
        aliases=_clean_list(data.get('aliases')),
        # ⚠️ 역량은 **파는 회사가 없다.** 받아도 버린다 — 안 버리면 아무 데도
        #    안 보이는 값이 남아, 나중에 도구로 내렸을 때 엉뚱하게 되살아난다.
        vendor=((data.get('vendor') or '').strip() or None
                if shows_vendor(kind) else None),
        category=(data.get('category') or '').strip() or None,
        url=((data.get('url') or '').strip() or None
             if shows_vendor(kind) else None),
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
        origin=origin if origin in ORIGINS else 'ui',
        created_by=actor_id,
    )
    db.session.add(t)
    db.session.flush()          # uuid 를 연결 표가 써야 한다
    for u in want:
        db.session.add(IntelTechCapability(tech_uuid=t.uuid, capability_uuid=u))
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
        for tech_uuid, cap in (db.session.query(
                    IntelTechCapability.tech_uuid,
                    IntelTechCapability.capability_uuid)
                .filter(IntelTechCapability.capability_uuid.in_(want)).all()):
            kids.setdefault(cap, []).append(tech_uuid)

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


def set_division_stage(tech_uuid, division, stage, reason=None, tools=None,
                       actor=None, source='ui'):
    """그 사업부가 이 역량을 **어디까지 · 왜 · 무엇으로** 하는지 적는다.

    ⚠️⚠️ **이유 없이 예외를 만들 수 없다.** 예전에는 드롭다운으로 단계만 고르면
       끝이었는데, 그러면 이 표는 앞선 세 번의 시도(tech_radarㆍtech_archiveㆍ
       digital_twin_solution)와 똑같아진다 — **적혀는 있는데 아무도 왜인지 모르는
       표.** 「MX 도입」 네 글자는 6개월 뒤 아무 뜻도 아니다.

    ⚠️⚠️ **단계를 안 정하고 도구만 적을 수 있다**(`stage` 를 비운다). 가장 흔한
       경우가 「전사도 도입, 우리도 도입, 우리는 LS-DYNA 를 쓴다」인데, 예외를
       만들어야만 도구를 적을 수 있으면 그 경우를 아예 못 적는다.

           stage 없음   전사를 따른다. **전사가 움직이면 같이 움직인다**
           stage 있음   전사와 다르게 본다 → 이유가 있어야 한다

    ⚠️ 전사와 **같은 값**을 보내면 「안 정함」으로 되돌린다. 굳이 붙박아 두면 전사가
       움직였을 때 이 사업부만 옛 값에 남는다.
    """
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

    stage = (stage or '').strip() or None
    if stage is not None and stage not in STAGES:
        return None, f'단계는 {" · ".join(STAGES)} 중 하나여야 합니다.'
    # 전사와 같아졌다 → 예외가 아니라 「따름」이다.
    if stage == t.stage:
        stage = None

    reason = (reason or '').strip()
    if stage is not None and not reason:
        return None, ('전사(%s)와 다르게 「%s」 로 보는 이유를 적어야 합니다. '
                      '이유 없는 줄은 6개월 뒤 아무 뜻도 아닙니다.' % (t.stage, stage))

    tools = _clean_tools(tools, parent=t)

    row = IntelDivisionStage.query.filter_by(
        tech_uuid=tech_uuid, division=division).first()
    before = (row.stage if row else None) or t.stage
    after = stage or t.stage

    """
    ⚠️ **담을 것이 있는지 먼저 본다.** 넣고 나서 비었으면 지우는 식으로 짜면, 아직
       저장도 안 된 줄을 지우려다 터진다(시험이 잡았다). 그리고 아무것도 안 담긴
       줄을 남기면 「다르게 보는 사업부」 셈이 부풀고, 그 숫자가 이 화면의 답이라
       곧바로 못 믿게 된다.
    """
    empty = stage is None and not reason and not tools
    if empty:
        if row is not None:
            if before != after:
                log_change('tech', t.uuid, t.name, 'stage', before, after,
                           reason='전사 값을 따르도록 되돌렸습니다.',
                           actor=actor, source=source, scope=division)
            db.session.delete(row)
            db.session.commit()
        return None, None

    if row is None:
        row = IntelDivisionStage(tech_uuid=tech_uuid, division=division,
                                 changed_at=datetime.utcnow())
        db.session.add(row)
    row.stage = stage
    row.reason = reason or None
    row.tools = tools
    row.changed_by = getattr(actor, 'id', None)

    if before != after:
        row.changed_at = datetime.utcnow()
        log_change('tech', t.uuid, t.name, 'stage', before, after,
                   reason=reason or '전사 값을 따르도록 되돌렸습니다.',
                   actor=actor, source=source, scope=division)

    db.session.commit()
    return row, None


def _clean_tools(tools, parent=None):
    """적어 둔 도구 uuid 를 추린다.

    ⚠️⚠️ **그 역량 밑에 매달린 도구만 받는다.** 아무거나 받으면 「MX 는 explicit
       해석을 Grafana 로 한다」 같은 줄이 조용히 생기고, 그러면 「어느 사업부가
       무엇을 쓰나」를 되짚을 때 답이 엉킨다. 없는 도구를 쓰고 있다면 **먼저 그
       도구를 이 역량에 매다는 것**이 맞다 — 그 정리가 이 층의 값이다.

    ⚠️ 도구 자신에 적는 경우(역량이 아닌 줄)에는 고를 것이 없다. 빈 목록이 된다.
    """
    want = [str(u).strip() for u in (tools or []) if str(u or '').strip()]
    if not want or parent is None or parent.kind != 'capability':
        return []
    allowed = {r.tech_uuid for r in IntelTechCapability.query
               .filter_by(capability_uuid=parent.uuid).all()}
    out = []
    for u in want:
        if u in allowed and u not in out:
            out.append(u)
    return out


def tools_of(rows):
    """사업부 줄들이 가리키는 도구 이름. `{tech_uuid: {division: [이름…]}}` 가 아니라
    줄 하나씩 풀어 쓰기 좋게 `{id: [이름…]}` 로 준다.

    ⚠️ 없어진 도구는 조용히 빠진다 — FK 를 안 건 값이다.
    """
    rows = [r for r in rows if r is not None]
    ids = {u for r in rows for u in (r.tools or [])}
    names = names_of(ids)
    return {r.id: [names[u] for u in (r.tools or []) if u in names] for r in rows}


def used_by_division(tool_uuid):
    """**이 도구를 쓰는 사업부.** 사업부 줄을 거꾸로 읽는다.

    ⚠️ 이게 없으면 도구를 열었을 때 「누가 이걸 쓰나」에 답이 없다. 적어 넣은 쪽만
       있고 되짚는 쪽이 없으면, 적을 이유도 절반으로 준다.
    """
    t = IntelTech.query.filter_by(uuid=tool_uuid).first()
    if t is None:
        return []
    rows = (IntelDivisionStage.query
            .filter(IntelDivisionStage.tools.contains([tool_uuid]))
            .order_by(IntelDivisionStage.division.asc()).all())
    caps = names_of([r.tech_uuid for r in rows])
    return [{
        'division': r.division,
        'capability': caps.get(r.tech_uuid),
        'capabilityUuid': r.tech_uuid,
        'stage': r.stage,                      # 비어 있으면 전사를 따른다
        'reason': r.reason,
    } for r in rows]


def clear_division_stage(tech_uuid, division, actor=None, source='ui'):
    """그 사업부 줄을 통째로 지운다 — 단계ㆍ이유ㆍ도구가 함께 사라진다.

    ⚠️ 「전사로 되돌리기」와 「적어 둔 것 지우기」를 **한 단추로 묶지 않는다**.
       단계만 되돌리고 도구는 남기고 싶으면 단계를 「전사를 따름」으로 고르면 된다.
       이 길은 그 사업부에 대해 적어 둔 것을 전부 무르는 자리다.
    """
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


def _drop_from_division_tools(tool_uuid, capability_uuid):
    """그 역량의 사업부 줄에서 이 도구를 뺀다. **커밋은 부르는 쪽이 한다.**

    ⚠️⚠️ 도구를 떼어 내거나 다른 역량으로 옮기면, 옛 역량의 「무엇으로 하나」에
       적힌 이 도구는 **거짓말이 된다** — 「MX 는 explicit 해석을 LS-DYNA 로 한다」고
       적혀 있는데 LS-DYNA 가 더는 explicit 해석에 속하지 않는 상태. 저장할 때
       걸러지긴 하지만, 그때까지 화면은 틀린 것을 보여준다.
    """
    if not capability_uuid:
        return
    rows = (IntelDivisionStage.query
            .filter(IntelDivisionStage.tech_uuid == capability_uuid,
                    IntelDivisionStage.tools.contains([tool_uuid])).all())
    for r in rows:
        r.tools = [u for u in (r.tools or []) if u != tool_uuid]


def remove_tech(tech_uuid, actor=None):
    """기술 한 줄을 지운다. **딸린 것을 먼저 추스른다.**

    ⚠️⚠️ **역량을 지우면 그 밑 도구가 없어진 uuid 를 가리킨다.** 레이더는 「역량이거나
       부모 없는 도구」만 그리므로, 그 도구들이 **화면에서 통째로 사라진다.**
       합치기에서 겪은 것과 같은 구멍이다 — 여기서는 자식을 **떼어 내** 미아로
       돌린다. 미아는 레이더에 그대로 서므로 아무것도 안 사라진다.

    ⚠️ 도구를 지우면 사업부들이 적어 둔 「무엇으로 하나」에서도 뺀다. 안 빼면 없는
       이름을 가리키는 칸이 남고, 화면은 그냥 빈칸으로 보인다.
    """
    t = IntelTech.query.filter_by(uuid=tech_uuid).first()
    if t is None:
        return None, '기술을 찾을 수 없습니다.'

    """
    ⚠️ 역량을 지우면 그 연결 줄이 사라지고, 다른 역량에 안 걸린 도구는 **미아**가
       되어 레이더에 그대로 선다 — 화면에서 사라지면 안 된다는 성질은 그대로다.
    """
    freed = 0
    if t.kind == 'capability':
        rows = IntelTechCapability.query.filter_by(capability_uuid=t.uuid).all()
        for r in rows:
            _drop_from_division_tools(r.tech_uuid, t.uuid)
            db.session.delete(r)
        others = {x.tech_uuid for x in IntelTechCapability.query.filter(
            IntelTechCapability.tech_uuid.in_([r.tech_uuid for r in rows] or ['-']),
            IntelTechCapability.capability_uuid != t.uuid).all()}
        freed = len([r for r in rows if r.tech_uuid not in others])
    IntelTechCapability.query.filter_by(tech_uuid=t.uuid).delete()

    IntelDivisionStage.query.filter_by(tech_uuid=t.uuid).delete()
    for r in IntelDivisionStage.query.filter(
            IntelDivisionStage.tools.contains([t.uuid])).all():
        r.tools = [u for u in (r.tools or []) if u != t.uuid]

    IntelEvidence.query.filter_by(tech_uuid=t.uuid).delete()
    log_change('tech', t.uuid, t.name, 'delete', t.name, None,
               reason=(f'매달린 도구 {freed}개는 떼어 냈습니다.' if freed else None),
               actor=actor)
    db.session.delete(t)
    db.session.commit()
    return freed, None


def names_of(uuids):
    """uuid → 이름. 상위 역량 이름을 곁들일 때 쓴다."""
    if not uuids:
        return {}
    rows = (db.session.query(IntelTech.uuid, IntelTech.name)
            .filter(IntelTech.uuid.in_(list(set(uuids)))).all())
    return {u: n for u, n in rows}


def children_of(capability_uuids):
    """역량에 매달린 도구들. 화면이 「무엇으로 하나」를 보여줄 때 쓴다.

    ⚠️ 한 도구가 **여러 역량에 나온다** — 그게 연결 표로 바꾼 이유다.
    """
    if not capability_uuids:
        return {}
    rows = (db.session.query(IntelTechCapability.capability_uuid, IntelTech)
            .join(IntelTech, IntelTech.uuid == IntelTechCapability.tech_uuid)
            .filter(IntelTechCapability.capability_uuid.in_(list(capability_uuids)))
            .order_by(IntelTech.name.asc()).all())
    out = {}
    for cap, t in rows:
        out.setdefault(cap, []).append({
            'uuid': t.uuid, 'name': t.name, 'stage': t.stage,
            'vendor': t.vendor, 'summary': t.summary,
        })
    return out


def capabilities_of(tech_uuids):
    """도구마다 **속한 역량들**. `{tech_uuid: [{uuid, name}…]}`.

    ⚠️ 이름까지 함께 준다 — uuid 만 주면 화면이 목록 전체를 뒤져야 하고, 걸러 본
       목록에는 그 역량이 아예 없을 수도 있다.
    """
    if not tech_uuids:
        return {}
    rows = (db.session.query(IntelTechCapability.tech_uuid, IntelTech.uuid,
                             IntelTech.name)
            .join(IntelTech, IntelTech.uuid == IntelTechCapability.capability_uuid)
            .filter(IntelTechCapability.tech_uuid.in_(list(tech_uuids)))
            .order_by(IntelTech.name.asc()).all())
    out = {}
    for tech_uuid, cap_uuid, cap_name in rows:
        out.setdefault(tech_uuid, []).append({'uuid': cap_uuid, 'name': cap_name})
    return out


def linked_tech_uuids():
    """어느 역량엔가 매달린 도구의 uuid 들. 레이더가 **미아만** 그리는 데 쓴다."""
    return {r[0] for r in db.session.query(IntelTechCapability.tech_uuid).all()}


def set_capabilities(tech_uuid, capability_uuids, actor=None):
    """도구가 **어느 역량들에** 속하는지 정한다. 빈 목록이면 전부 떼어 낸다.

    ⚠️⚠️ 예전에는 부모 칸 하나였다. 자료로 세어 보니 도구 546개 중 **58개(11%)** 가
       두 역량 이상에 걸쳤다 — MATLAB/Simulink 는 1D 시스템이면서 제어 검증이고
       대리모델이기도 하다. 칸 하나로는 그 중 하나만 적을 수 있었다.

    ⚠️ **역량은 다른 것에 못 매단다.** 층은 둘까지다 — 셋이 되면 「어디까지 굴려
       올릴 것인가」가 사람마다 달라진다.
    ⚠️ **자기 자신을 상위로 둘 수 없다.** 고리가 생기면 근거를 굴려 올릴 때 무한히 돈다.
    """
    t = IntelTech.query.filter_by(uuid=tech_uuid).first()
    if t is None:
        return None, '기술을 찾을 수 없습니다.'

    want = []
    for u in (capability_uuids or []):
        u = (u or '').strip()
        if u and u not in want:
            want.append(u)

    if want and t.kind == 'capability':
        return None, '역량은 다른 것 밑에 매달 수 없습니다. 층은 둘까지입니다.'
    if tech_uuid in want:
        return None, '자기 자신을 상위로 둘 수 없습니다.'
    if want:
        caps = IntelTech.query.filter(IntelTech.uuid.in_(want)).all()
        found = {c.uuid: c for c in caps}
        for u in want:
            if u not in found:
                return None, '상위 역량을 찾을 수 없습니다.'
            if found[u].kind != 'capability':
                return None, '상위는 역량이어야 합니다. 도구 밑에 도구를 매달 수 없습니다.'

    have = {r.capability_uuid: r for r in IntelTechCapability.query.filter_by(
        tech_uuid=tech_uuid).all()}
    for u in want:
        if u not in have:
            db.session.add(IntelTechCapability(tech_uuid=tech_uuid,
                                               capability_uuid=u))
    for u, row in have.items():
        if u not in want:
            """
            ⚠️⚠️ 뗀 역량의 「무엇으로 하나」에서 이 도구를 함께 뺀다. 안 빼면
               「MX 는 explicit 해석을 LS-DYNA 로 한다」가 **거짓말이 된다** —
               LS-DYNA 가 더는 그 역량에 속하지 않는 상태이기 때문이다.
            """
            _drop_from_division_tools(tech_uuid, u)
            db.session.delete(row)

    db.session.commit()
    return t, None


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

    """
    ⚠️⚠️ **매달린 것과 사업부 줄도 함께 옮긴다.** 안 옮기면 지는 쪽 밑에 있던 도구가
       **없어진 uuid 를 가리키게 되고**, 레이더는 「역량이거나 부모 없는 도구」만
       그리므로 그 도구들이 화면에서 통째로 사라진다. 역량 층을 넣으면서 생긴
       구멍이다 — 합치기는 원래 근거와 연결만 옮기고 있었다.
    """
    # 지는 역량에 매달렸던 도구를 이기는 역량으로. 이미 있으면 버린다(유니크 제약).
    have_c = {r.tech_uuid for r in IntelTechCapability.query.filter_by(
        capability_uuid=winner.uuid).all()}
    for r in IntelTechCapability.query.filter_by(
            capability_uuid=loser.uuid).all():
        if r.tech_uuid in have_c:
            db.session.delete(r)
        else:
            r.capability_uuid = winner.uuid
    # 지는 **도구**가 걸려 있던 역량들도 이기는 도구로 옮긴다.
    have_t = {r.capability_uuid for r in IntelTechCapability.query.filter_by(
        tech_uuid=winner.uuid).all()}
    for r in IntelTechCapability.query.filter_by(tech_uuid=loser.uuid).all():
        if r.capability_uuid in have_t:
            db.session.delete(r)
        else:
            r.tech_uuid = winner.uuid
    have_d = {d.division for d in IntelDivisionStage.query.filter_by(
        tech_uuid=winner.uuid).all()}
    for d in IntelDivisionStage.query.filter_by(tech_uuid=loser.uuid).all():
        # 같은 사업부 줄이 양쪽에 있으면 이기는 쪽을 남긴다(유니크 제약).
        if d.division in have_d:
            db.session.delete(d)
        else:
            d.tech_uuid = winner.uuid
    # ⚠️ 「무엇으로 하나」에 지는 쪽 uuid 가 적혀 있으면 이기는 쪽으로 바꾼다.
    for d in IntelDivisionStage.query.filter(
            IntelDivisionStage.tools.contains([loser.uuid])).all():
        d.tools = [winner.uuid if u == loser.uuid else u for u in (d.tools or [])]

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
