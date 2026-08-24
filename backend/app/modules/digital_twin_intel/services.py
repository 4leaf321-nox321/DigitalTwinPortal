"""기술정보 — 저장 규칙.

라우트에서 이리로 뺀 이유
    MCP 도구(2단계)가 **같은 규칙**으로 넣어야 한다. 라우트에 규칙을 두면 MCP 가
    HTTP 를 한 번 더 타거나 규칙을 복제하게 되고, 복제하는 순간 갈린다.
"""
import uuid as uuidlib
from datetime import date, datetime

from sqlalchemy import func

from app.extensions import db
from app.modules.digital_twin_intel.models import (
    CPT_KEYS, ORIGINS, STAGES, IntelEvidence, IntelLink, IntelNews, IntelTech,
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
        origin=origin if origin in ORIGINS else 'ui',
        created_by=actor_id,
    )
    db.session.add(t)
    db.session.commit()
    return t, None


def set_stage(tech_uuid, stage, reason=None, actor_id=None):
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
    t.stage = stage
    if reason:
        t.stage_reason = reason
    db.session.commit()
    return t, None


def evidence_stats(tech_uuids):
    """기술마다 (근거 건수, 마지막 근거 시각). 낡음 판정에 쓴다.

    ⚠️ 목록마다 기술 하나씩 세면 수백 번 왕복한다. 한 번에 모아 온다.
    """
    if not tech_uuids:
        return {}
    rows = (db.session.query(
                IntelEvidence.tech_uuid,
                func.count(IntelEvidence.id),
                func.max(IntelEvidence.created_at))
            .filter(IntelEvidence.tech_uuid.in_(list(tech_uuids)))
            .group_by(IntelEvidence.tech_uuid).all())
    return {r[0]: (r[1], r[2]) for r in rows}


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
