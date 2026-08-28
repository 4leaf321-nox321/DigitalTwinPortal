# -*- coding: utf-8 -*-
"""디지털 스레드 부문 — 사전(스레드·표준 구간·시스템·조직)과 사업부 구간, 스레드 단위의 셈. (2026-08-28)

스레드는 제품 생애를 따라 한 데이터가 이어지는 줄이고, 평가 단위는 **구간**이다. 구간의 평가·이력은
기존 틀(대상 = 구간, 수단 없는 연계, 축 다섯)을 그대로 쓰고, 여기서는
  · 사전 — 스레드(전사, 사무국) · 표준 구간 · 시스템(전사 하나, 아래에서 채움 + 정돈) · 조직(포탈 부서·프로세스 노드 참조)
  · 구간의 속성 — 출발 조직·시스템 / 매개 시스템 / 도착 조직·시스템
  · 셈 — 구간을 모아 줄로: 연속성 · 도달 단계 · 최약 구간 · 폐루프 · 비공식 매개 비율 / 시스템 허브도 / 조직 간 연계표
매개가 「비공식 매개」면 연결 방식은 수동 파일 교환 이하로만 — 매개와 축이 어긋난 채 저장되지 않는다.
"""
from collections import Counter, defaultdict

from app.extensions import db

from . import definitions as D
from .models import (
    MaturityAssessment, MaturityPair, MaturitySubject, ThreadCase, ThreadDef, ThreadOrg, ThreadSegment, ThreadSegmentDef, ThreadSystem,
)
from .services import Refused, _clean_list, create_pair, create_subject, pair_dict

SECTOR = 'digital_thread'
STAGE_ORDER = {s['key']: i for i, s in enumerate(D.THREAD_STAGES)}
LINK_AXIS = 'link_mode'
AUTO_FROM = 'auto_file'          # 이 칸 이상이면 「이어진」 구간


# ── 기본 사전 — 표가 비어 있으면 코드의 초안을 넣는다(멱등) ──────────────────

def ensure_defaults():
    """표준 스레드·구간과 비공식 매개 항목을 처음 한 번 넣는다. key 로 멱등."""
    made = 0
    for order, t in enumerate(D.THREAD_DEFAULTS, 1):
        row = ThreadDef.query.filter_by(key=t['key']).first()
        if row is None:
            row = ThreadDef(key=t['key'], name=t['name'], description=t.get('description'),
                            axes_off=list(t.get('axes_off') or []), order=order)
            db.session.add(row)
            db.session.flush()
            made += 1
        for so, seg in enumerate(t.get('segments') or [], 1):
            if not ThreadSegmentDef.query.filter_by(thread_id=row.id, key=seg['key']).first():
                db.session.add(ThreadSegmentDef(thread_id=row.id, key=seg['key'], name=seg['name'],
                                                from_stage=seg['from'], to_stage=seg['to'], order=so))
                made += 1
    for name in D.INFORMAL_ITEMS:
        if not ThreadSystem.query.filter_by(name=name).first():
            db.session.add(ThreadSystem(name=name, kind='informal', link_means='none', status='active', note='비공식 매개 — 코드 기본'))
            made += 1
    if made:
        db.session.flush()
    return made


# ── 사전 CRUD ───────────────────────────────────────────────────────────────

def _stage_or_refuse(key):
    if key not in STAGE_ORDER:
        raise Refused('없는 생애 단계입니다.')
    return key


def thread_dict(t, with_segments=True):
    d = t.to_dict()
    if with_segments:
        d['segments'] = [s.to_dict() for s in sorted(t.segment_defs, key=lambda s: (s.order, s.id))]
    return d


def list_threads(active_only=True):
    ensure_defaults()
    q = ThreadDef.query
    if active_only:
        q = q.filter_by(is_active=True)
    return [thread_dict(t) for t in q.order_by(ThreadDef.order, ThreadDef.id).all()]


def create_thread(payload):
    key = (payload.get('key') or '').strip().lower().replace(' ', '_')[:60]
    name = (payload.get('name') or '').strip()[:200]
    if not key or not name:
        raise Refused('스레드의 key 와 이름이 필요합니다.')
    if ThreadDef.query.filter_by(key=key).first():
        raise Refused('같은 key 의 스레드가 있습니다.')
    axes_off = [a for a in _clean_list(payload.get('axes_off')) if a in {x['key'] for x in D.AXES[SECTOR]}]
    last = db.session.query(db.func.max(ThreadDef.order)).scalar() or 0
    row = ThreadDef(key=key, name=name, description=(payload.get('description') or '').strip() or None,
                    axes_off=axes_off, order=last + 1)
    db.session.add(row)
    db.session.flush()
    return row


def update_thread(row, payload):
    if 'name' in payload:
        name = (payload.get('name') or '').strip()[:200]
        if not name:
            raise Refused('스레드 이름이 필요합니다.')
        row.name = name
    if 'description' in payload:
        row.description = (payload.get('description') or '').strip() or None
    if 'axes_off' in payload:
        row.axes_off = [a for a in _clean_list(payload.get('axes_off')) if a in {x['key'] for x in D.AXES[SECTOR]}]
    if 'is_active' in payload:
        row.is_active = bool(payload.get('is_active'))
    if 'order' in payload:
        try:
            row.order = int(payload.get('order'))
        except (TypeError, ValueError):
            raise Refused('순서는 정수입니다.')
    return row


def add_segment_def(thread, payload):
    key = (payload.get('key') or '').strip().lower().replace(' ', '_')[:60]
    name = (payload.get('name') or '').strip()[:200]
    if not key or not name:
        raise Refused('구간의 key 와 이름이 필요합니다.')
    if ThreadSegmentDef.query.filter_by(thread_id=thread.id, key=key).first():
        raise Refused('이 스레드에 같은 key 의 구간이 있습니다.')
    last = max([s.order for s in thread.segment_defs] or [0])
    row = ThreadSegmentDef(thread_id=thread.id, key=key, name=name,
                           from_stage=_stage_or_refuse(payload.get('from_stage')), to_stage=_stage_or_refuse(payload.get('to_stage')),
                           order=last + 1)
    db.session.add(row)
    db.session.flush()
    return row


def update_segment_def(row, payload):
    if 'name' in payload:
        name = (payload.get('name') or '').strip()[:200]
        if not name:
            raise Refused('구간 이름이 필요합니다.')
        row.name = name
    if 'from_stage' in payload:
        row.from_stage = _stage_or_refuse(payload.get('from_stage'))
    if 'to_stage' in payload:
        row.to_stage = _stage_or_refuse(payload.get('to_stage'))
    if 'order' in payload:
        try:
            row.order = int(payload.get('order'))
        except (TypeError, ValueError):
            raise Refused('순서는 정수입니다.')
    return row


# 시스템 — 전사 하나. 스레드 주체(개발 조직)가 자기 구간을 적으며 채운다. 처음 적은 사업부나 사무국이 고친다.
def list_systems():
    ensure_defaults()
    return [s.to_dict() for s in ThreadSystem.query.order_by(ThreadSystem.kind, ThreadSystem.name).all()]


def create_system(payload, division_id=None):
    name = (payload.get('name') or '').strip()[:200]
    if not name:
        raise Refused('시스템 이름이 필요합니다.')
    if ThreadSystem.query.filter_by(name=name).first():
        raise Refused('같은 이름의 시스템이 이미 있습니다 — 그것을 고르세요.')
    kind = payload.get('kind') or 'other'
    if kind not in D.SYSTEM_KIND_KEYS:
        raise Refused('없는 시스템 종류입니다.')
    row = ThreadSystem(name=name, kind=kind, created_division_id=division_id)
    _fill_system(row, payload)
    db.session.add(row)
    db.session.flush()
    return row


def _fill_system(row, payload):
    if 'kind' in payload:
        if payload['kind'] not in D.SYSTEM_KIND_KEYS:
            raise Refused('없는 시스템 종류입니다.')
        row.kind = payload['kind']
    if 'owner_org' in payload:
        row.owner_org = (payload.get('owner_org') or '').strip()[:200] or None
    if 'stages' in payload:
        row.stages = [s for s in _clean_list(payload.get('stages')) if s in STAGE_ORDER]
    if 'link_means' in payload:
        if payload['link_means'] not in D.LINK_MEANS_KEYS:
            raise Refused('연계 수단은 api · file · none · unknown 중 하나입니다.')
        row.link_means = payload['link_means']
    if 'status' in payload:
        if payload['status'] not in D.SYSTEM_STATUS_KEYS:
            raise Refused('상태는 active · adopting · retiring 중 하나입니다.')
        row.status = payload['status']
    if 'note' in payload:
        row.note = (payload.get('note') or '').strip() or None
    if row.kind == 'informal':
        row.link_means = 'none'
    return row


def update_system(row, payload, actor_division_id=None, curator=False):
    if not curator and row.created_division_id not in (None, actor_division_id):
        raise Refused('다른 사업부가 처음 적은 시스템입니다 — 사무국이나 그 사업부만 고칩니다.')
    if 'name' in payload:
        name = (payload.get('name') or '').strip()[:200]
        if not name:
            raise Refused('시스템 이름이 필요합니다.')
        dup = ThreadSystem.query.filter(ThreadSystem.name == name, ThreadSystem.id != row.id).first()
        if dup:
            raise Refused('같은 이름의 시스템이 있습니다 — 「정돈」으로 합치세요.')
        row.name = name
    return _fill_system(row, payload)


def system_usage(system_id):
    return ThreadSegment.query.filter(
        (ThreadSegment.from_system_id == system_id) | (ThreadSegment.via_system_id == system_id) | (ThreadSegment.to_system_id == system_id)).count()


def merge_systems(keep_id, drop_id):
    """정돈 — drop 을 쓰는 구간을 keep 으로 돌리고 drop 을 지운다(같은 시스템이 다른 글자로 쌓였을 때)."""
    if keep_id == drop_id:
        raise Refused('같은 시스템입니다.')
    keep, drop = ThreadSystem.query.get(keep_id), ThreadSystem.query.get(drop_id)
    if keep is None or drop is None:
        raise Refused('없는 시스템입니다.')
    n = 0
    for seg in ThreadSegment.query.filter(
            (ThreadSegment.from_system_id == drop_id) | (ThreadSegment.via_system_id == drop_id) | (ThreadSegment.to_system_id == drop_id)).all():
        for f in ('from_system_id', 'via_system_id', 'to_system_id'):
            if getattr(seg, f) == drop_id:
                setattr(seg, f, keep_id)
        n += 1
    db.session.delete(drop)
    return n


# 조직 — 포탈 부서·프로세스 노드를 참조하거나 손으로.
def list_orgs(division_id=None):
    q = ThreadOrg.query
    if division_id is not None:
        q = q.filter((ThreadOrg.division_id == int(division_id)) | (ThreadOrg.division_id.is_(None)))
    return [o.to_dict() for o in q.order_by(ThreadOrg.name).all()]


def create_org(payload, division_id=None):
    name = (payload.get('name') or '').strip()[:200]
    if not name:
        raise Refused('조직 이름이 필요합니다.')
    source_kind = payload.get('source_kind') or 'manual'
    if source_kind not in ('portal', 'process', 'manual'):
        raise Refused('출처는 portal · process · manual 중 하나입니다.')
    source_id = (str(payload.get('source_id') or '').strip() or None)
    dup = ThreadOrg.query.filter_by(name=name, division_id=division_id).first()
    if dup:
        return dup                                   # 같은 사업부의 같은 이름이면 그것을 쓴다 — 조용히
    role = payload.get('role') or None
    if role and role not in STAGE_ORDER:
        raise Refused('없는 생애 단계 역할입니다.')
    row = ThreadOrg(name=name, role=role, division_id=division_id, source_kind=source_kind, source_id=source_id,
                    note=(payload.get('note') or '').strip() or None)
    db.session.add(row)
    db.session.flush()
    return row


def update_org(row, payload):
    if 'name' in payload:
        name = (payload.get('name') or '').strip()[:200]
        if not name:
            raise Refused('조직 이름이 필요합니다.')
        row.name = name
    if 'role' in payload:
        role = payload.get('role') or None
        if role and role not in STAGE_ORDER:
            raise Refused('없는 생애 단계 역할입니다.')
        row.role = role
    if 'note' in payload:
        row.note = (payload.get('note') or '').strip() or None
    return row


def org_usage(org_id):
    return ThreadSegment.query.filter((ThreadSegment.from_org_id == org_id) | (ThreadSegment.to_org_id == org_id)).count()


def departments_as_orgs(division_id):
    """포탈 부서 표를 조직 후보로 — 이미 조직 사전에 있으면 그 id 를 같이 준다."""
    from .services import departments_of
    have = {(o.source_kind, o.source_id): o.id for o in ThreadOrg.query.filter_by(division_id=int(division_id)).all()}
    return [{'id': d['id'], 'name': d['name'], 'org_id': have.get(('portal', str(d['id'])))} for d in departments_of(division_id)]


# ── 사업부 구간 ─────────────────────────────────────────────────────────────

def _system(sid):
    if sid in (None, ''):
        return None
    row = ThreadSystem.query.get(int(sid))
    if row is None:
        raise Refused('없는 시스템입니다.')
    return row


def _org(oid, division_id):
    if oid in (None, ''):
        return None
    row = ThreadOrg.query.get(int(oid))
    if row is None:
        raise Refused('없는 조직입니다.')
    if row.division_id not in (None, int(division_id)):
        raise Refused('다른 사업부의 조직입니다.')
    return row


def _fill_segment(seg, payload, division_id):
    if 'thread_id' in payload:
        t = ThreadDef.query.get(int(payload['thread_id'])) if payload.get('thread_id') not in (None, '') else None
        if t is None:
            raise Refused('스레드를 고르세요.')
        seg.thread_id = t.id
    if 'segment_def_id' in payload:
        sd = ThreadSegmentDef.query.get(int(payload['segment_def_id'])) if payload.get('segment_def_id') not in (None, '') else None
        if sd is not None and sd.thread_id != seg.thread_id:
            raise Refused('그 표준 구간은 다른 스레드의 것입니다.')
        seg.segment_def_id = sd.id if sd else None
    for f in ('from_system_id', 'via_system_id', 'to_system_id'):
        if f in payload:
            s = _system(payload.get(f))
            setattr(seg, f, s.id if s else None)
    for f in ('from_org_id', 'to_org_id'):
        if f in payload:
            o = _org(payload.get(f), division_id)
            setattr(seg, f, o.id if o else None)
    if 'note' in payload:
        seg.note = (payload.get('note') or '').strip() or None
    if seg.thread_id is None:
        raise Refused('스레드를 고르세요.')
    return seg


def create_segment(division_id, payload):
    """구간 하나 = 대상(sector digital_thread) + 수단 없는 연계 + 구간 속성."""
    name = (payload.get('name') or '').strip()
    sd = ThreadSegmentDef.query.get(int(payload['segment_def_id'])) if payload.get('segment_def_id') not in (None, '') else None
    if not name:
        if sd is None:
            raise Refused('구간 이름이 필요합니다 — 표준 구간을 고르면 그 이름을 씁니다.')
        name = sd.name
    subject = create_subject(division_id, SECTOR, name, detail=(payload.get('detail') or None))
    pair = create_pair(subject, None)
    seg = ThreadSegment(subject_id=subject.id, division_id=int(division_id))
    _fill_segment(seg, {**payload, 'thread_id': payload.get('thread_id') or (sd.thread_id if sd else None)}, division_id)
    db.session.add(seg)
    db.session.flush()
    return seg, subject, pair


def update_segment(seg, payload):
    if 'name' in payload:
        name = (payload.get('name') or '').strip()
        if not name:
            raise Refused('구간 이름이 필요합니다.')
        seg.subject.name = name[:300]
    if 'detail' in payload:
        seg.subject.detail = (payload.get('detail') or '')[:500] or None
    return _fill_segment(seg, payload, seg.division_id)


def delete_segment(seg):
    n = sum(len(p.assessments) for p in seg.subject.pairs)
    db.session.delete(seg.subject)          # 연계·평가·이력·구간이 같이 간다
    return {'assessments': n}


def segment_dict(seg, systems=None, orgs=None, with_pair=True):
    systems = systems if systems is not None else {s.id: s for s in ThreadSystem.query.all()}
    orgs = orgs if orgs is not None else {o.id: o for o in ThreadOrg.query.all()}
    name = lambda m, i: (m.get(i).name if i in m else None)          # noqa: E731
    d = seg.to_dict()
    d['name'] = seg.subject.name
    d['detail'] = seg.subject.detail
    d['thread_key'] = seg.thread.key if seg.thread else None
    d['thread_name'] = seg.thread.name if seg.thread else None
    d['segment_def'] = seg.segment_def.to_dict() if seg.segment_def else None
    for f in ('from_system', 'via_system', 'to_system'):
        d[f'{f}_name'] = name(systems, getattr(seg, f'{f}_id'))
    d['via_informal'] = bool(seg.via_system_id and seg.via_system_id in systems and systems[seg.via_system_id].kind == 'informal')
    for f in ('from_org', 'to_org'):
        d[f'{f}_name'] = name(orgs, getattr(seg, f'{f}_id'))
    if with_pair:
        pair = seg.subject.pairs[0] if seg.subject.pairs else None
        d['pair'] = pair_dict(pair, with_changes=False) if pair else None
        d['pair_id'] = pair.id if pair else None
    return d


def list_segments(division_id):
    systems = {s.id: s for s in ThreadSystem.query.all()}
    orgs = {o.id: o for o in ThreadOrg.query.all()}
    rows = (ThreadSegment.query.filter_by(division_id=int(division_id))
            .join(MaturitySubject, ThreadSegment.subject_id == MaturitySubject.id)
            .order_by(ThreadSegment.thread_id, MaturitySubject.order, MaturitySubject.id).all())
    return [segment_dict(s, systems, orgs) for s in rows]


def segment_of_pair(pair):
    return ThreadSegment.query.filter_by(subject_id=pair.subject_id).first()


def guard_assess(pair, axis_key, payload):
    """매개가 비공식이면 연결 방식은 수동 파일 교환 이하로만."""
    if pair.subject.sector != SECTOR or axis_key != LINK_AXIS:
        return
    seg = segment_of_pair(pair)
    if seg is None or not seg.via_system_id:
        return
    via = ThreadSystem.query.get(seg.via_system_id)
    if via is None or via.kind != 'informal':
        return
    axis = D.axis_of(SECTOR, LINK_AXIS)
    keys = D.rung_keys(axis)
    rung = payload.get('rung')
    if rung in keys and keys.index(rung) > 1:
        raise Refused(f'매개가 「{via.name}」(비공식 매개)이면 연결 방식은 「{axis["rungs"][1]["label"]}」까지만 고를 수 있습니다 — 매개 시스템을 먼저 바꾸세요.')


# ── 스레드 단위의 셈 ───────────────────────────────────────────────────────

def _link_idx(seg_d):
    a = (seg_d.get('pair') or {}).get('assessments', {}).get(LINK_AXIS) if seg_d.get('pair') else None
    return a['rung_index'] if a and a.get('rung_index') is not None else None


def thread_stats(division_id):
    """사업부의 스레드마다 — 구간 수·매긴 수·연속성 %·도달 단계·최약 구간·폐루프·비공식 매개 비율."""
    axis = D.axis_of(SECTOR, LINK_AXIS)
    auto_idx = D.rung_keys(axis).index(AUTO_FROM)
    segs = list_segments(division_id)
    by_thread = defaultdict(list)
    for s in segs:
        by_thread[s['thread_id']].append(s)
    out = []
    for t in list_threads():
        rows = by_thread.get(t['id'], [])
        defs = t['segments']
        assessed = [s for s in rows if _link_idx(s) is not None]
        linked = [s for s in assessed if _link_idx(s) >= auto_idx]
        # 도달 단계 — 표준 구간 순서대로 걸어가며 처음 끊기는 곳 앞까지
        reach = None
        for sd in defs:
            inst = next((s for s in rows if s.get('segment_def_id') == sd['id']), None)
            if inst is None or _link_idx(inst) is None or _link_idx(inst) < auto_idx:
                break
            reach = sd['to_stage']
        weakest = min(assessed, key=_link_idx) if assessed else None
        closed = any(STAGE_ORDER.get((s.get('segment_def') or {}).get('to_stage'), 99) < STAGE_ORDER.get((s.get('segment_def') or {}).get('from_stage'), -1)
                     for s in linked)
        informal = sum(1 for s in rows if s.get('via_informal'))
        out.append({
            'thread_id': t['id'], 'thread_key': t['key'], 'thread_name': t['name'],
            'def_count': len(defs), 'segment_count': len(rows), 'assessed': len(assessed),
            'continuity': round(100 * len(linked) / len(assessed)) if assessed else None,
            'reach_stage': reach, 'reach_label': D.STAGE_LABELS.get(reach) if reach else None,
            'weakest': {'id': weakest['id'], 'name': weakest['name'], 'link_index': _link_idx(weakest),
                        'link_label': axis['rungs'][_link_idx(weakest)]['label']} if weakest else None,
            'closed_loop': closed,
            'informal_ratio': round(100 * informal / len(rows)) if rows else None,
            'unassessed': len(rows) - len(assessed),
        })
    return {'division_id': int(division_id), 'threads': out}


def org_matrix(division_id):
    """조직 × 조직 — 둘 사이 구간 수 · 최약 연결 방식 · 지나는 시스템."""
    axis = D.axis_of(SECTOR, LINK_AXIS)
    cells = {}
    for s in list_segments(division_id):
        if not s.get('from_org_id') or not s.get('to_org_id'):
            continue
        k = (s['from_org_id'], s['to_org_id'])
        c = cells.setdefault(k, {'from_org_id': k[0], 'from_org': s['from_org_name'], 'to_org_id': k[1], 'to_org': s['to_org_name'],
                                 'count': 0, 'min_link': None, 'systems': Counter(), 'informal': 0})
        c['count'] += 1
        li = _link_idx(s)
        if li is not None and (c['min_link'] is None or li < c['min_link']):
            c['min_link'] = li
        for f in ('from_system_name', 'via_system_name', 'to_system_name'):
            if s.get(f):
                c['systems'][s[f]] += 1
        if s.get('via_informal'):
            c['informal'] += 1
    out = []
    for c in cells.values():
        c['systems'] = [n for n, _ in c['systems'].most_common()]
        c['min_link_label'] = axis['rungs'][c['min_link']]['label'] if c['min_link'] is not None else None
        out.append(c)
    return sorted(out, key=lambda c: (-c['count'], c['from_org'] or '', c['to_org'] or ''))


def system_hubs(division_ids=None):
    """시스템마다 — 지나는 스레드 수·구간 수·평균 연결 방식·연계 수단 미확인."""
    q = ThreadSegment.query
    if division_ids:
        q = q.filter(ThreadSegment.division_id.in_(list(division_ids)))
    segs = q.all()
    systems = {s.id: s for s in ThreadSystem.query.all()}
    axis = D.axis_of(SECTOR, LINK_AXIS)
    agg = {}
    link_of = {}
    for seg in segs:
        pair = seg.subject.pairs[0] if seg.subject.pairs else None
        a = next((x for x in (pair.assessments if pair else []) if x.axis == LINK_AXIS), None)
        link_of[seg.id] = D.rung_index(axis, a.rung) if a else None
        for f in ('from_system_id', 'via_system_id', 'to_system_id'):
            sid = getattr(seg, f)
            if not sid or sid not in systems:
                continue
            h = agg.setdefault(sid, {'system': systems[sid].to_dict(), 'threads': set(), 'segments': 0, 'links': []})
            h['segments'] += 1
            if seg.thread_id:
                h['threads'].add(seg.thread_id)
            if link_of[seg.id] is not None:
                h['links'].append(link_of[seg.id])
    out = []
    for h in agg.values():
        links = h['links']
        out.append({**h['system'], 'threads': len(h['threads']), 'segments': h['segments'],
                    'avg_link': round(sum(links) / len(links), 1) if links else None,
                    'unknown_means': h['system'].get('link_means') == 'unknown'})
    return sorted(out, key=lambda x: (-x['threads'], -x['segments'], x['name']))


def decorate_board(board):
    """판의 대상(구간)에 스레드·출발/매개/도착을 붙인다 — 상세 표가 시험 대신 구간을 그린다."""
    subs = board.get('subjects') or []
    if not subs:
        return board
    ids = [s['id'] for s in subs]
    systems = {s.id: s for s in ThreadSystem.query.all()}
    orgs = {o.id: o for o in ThreadOrg.query.all()}
    segs = {seg.subject_id: seg for seg in ThreadSegment.query.filter(ThreadSegment.subject_id.in_(ids)).all()}
    for s in subs:
        seg = segs.get(s['id'])
        s['segment'] = segment_dict(seg, systems, orgs, with_pair=False) if seg else None
    # 스레드 순으로 — 표에서 스레드가 묶음이 된다
    subs.sort(key=lambda s: ((s.get('segment') or {}).get('thread_id') or 0, s.get('order') or 0, s['id']))
    return board



# ── 연계 개발 기록 — 건마다 한 줄, 연간으로 센다(2026-08-28) ─────────────────

def _case_month(value):
    from .reviews import _month
    return _month(value)


def _fill_case(row, payload, division_id):
    axis = D.axis_of(SECTOR, LINK_AXIS)
    keys = D.rung_keys(axis)
    if 'month' in payload or row.month is None:
        row.month = _case_month(payload.get('month') or row.month)
    if 'action' in payload or row.action is None:
        action = payload.get('action') or row.action
        if action not in D.THREAD_CASE_ACTION_KEYS:
            raise Refused('「무엇을」을 고르세요 — 연동 · 도입 · 정합화 · 자동화 · 폐지 · 기타.')
        row.action = action
    if 'status' in payload:
        st = payload.get('status') or 'done'
        if st not in D.THREAD_CASE_STATUS_KEYS:
            raise Refused('상태는 계획 · 진행 중 · 완료 중 하나입니다.')
        row.status = st
    if 'segment_id' in payload:
        sid = payload.get('segment_id')
        seg = ThreadSegment.query.get(int(sid)) if sid not in (None, '') else None
        if sid not in (None, '') and (seg is None or seg.division_id != int(division_id)):
            raise Refused('이 사업부의 구간이 아닙니다.')
        row.segment_id = seg.id if seg else None
        if seg is not None:
            row.thread_id = seg.thread_id
    if 'thread_id' in payload and not row.segment_id:
        tid = payload.get('thread_id')
        row.thread_id = int(tid) if tid not in (None, '') else None
    if 'system_id' in payload or 'system_name' in payload:
        sid = payload.get('system_id')
        if sid not in (None, ''):
            sysrow = ThreadSystem.query.get(int(sid))
            if sysrow is None:
                raise Refused('없는 시스템입니다.')
            row.system_id, row.system_name = sysrow.id, sysrow.name
        else:
            row.system_id, row.system_name = None, ((payload.get('system_name') or '').strip()[:200] or row.system_name)
    if 'org_id' in payload:
        oid = payload.get('org_id')
        row.org_id = int(oid) if oid not in (None, '') else None
    for f in ('link_from', 'link_to'):
        if f in payload:
            v = payload.get(f) or None
            if v is not None and v not in keys:
                raise Refused('연결 방식 칸이 아닙니다.')
            setattr(row, f, v)
    if 'note' in payload:
        row.note = (payload.get('note') or '').strip()[:2000] or None
    if not row.system_id and not row.system_name and not row.segment_id:
        raise Refused('대상 시스템이나 구간 가운데 하나는 적으세요.')
    return row


def create_case(division_id, payload, actor):
    row = ThreadCase(division_id=int(division_id), actor_user_id=getattr(actor, 'id', None), actor_name=getattr(actor, 'name', None))
    if 'status' not in payload:
        payload = {**payload, 'status': 'done'}
    _fill_case(row, payload, division_id)
    db.session.add(row)
    db.session.flush()
    return row


def update_case(row, payload, actor):
    _fill_case(row, payload, row.division_id)
    row.actor_user_id = getattr(actor, 'id', None)
    row.actor_name = getattr(actor, 'name', None)
    return row


def case_dict(row):
    axis = D.axis_of(SECTOR, LINK_AXIS)
    keys = D.rung_keys(axis)
    d = row.to_dict()
    d['thread_name'] = row.thread.name if row.thread else None
    d['segment_name'] = row.segment.subject.name if row.segment and row.segment.subject else None
    d['link_from_label'] = axis['rungs'][keys.index(row.link_from)]['label'] if row.link_from in keys else None
    d['link_to_label'] = axis['rungs'][keys.index(row.link_to)]['label'] if row.link_to in keys else None
    d['lift'] = (keys.index(row.link_to) - keys.index(row.link_from)) if row.link_from in keys and row.link_to in keys else None
    return d


def list_cases(division_id, year=None, status=None):
    from datetime import date
    q = ThreadCase.query.filter_by(division_id=int(division_id))
    if year:
        q = q.filter(ThreadCase.month >= date(int(year), 1, 1), ThreadCase.month < date(int(year) + 1, 1, 1))
    if status:
        q = q.filter_by(status=status)
    return [case_dict(r) for r in q.order_by(ThreadCase.month.desc(), ThreadCase.id.desc()).all()]


def case_years(division_id=None):
    from datetime import date
    q = db.session.query(ThreadCase.month)
    if division_id is not None:
        q = q.filter_by(division_id=int(division_id))
    ys = sorted({m.year for (m,) in q.all()}, reverse=True)
    return ys or [date.today().year]


def case_stats(division_id, year):
    """한 사업부·한 해 — 건수 · 상태별 · 무엇을별 · 올라간 칸 합계 · 시스템별 건수."""
    rows = list_cases(division_id, year)
    by_action = Counter(r['action'] for r in rows)
    by_status = Counter(r['status'] for r in rows)
    lift = sum(r['lift'] for r in rows if r['lift'] and r['status'] == 'done')
    systems = Counter(r['system_name'] for r in rows if r['system_name'])
    return {'division_id': int(division_id), 'year': int(year), 'count': len(rows),
            'by_action': dict(by_action), 'by_status': dict(by_status), 'lift': lift,
            'systems': [{'name': n, 'count': c} for n, c in systems.most_common(8)]}
