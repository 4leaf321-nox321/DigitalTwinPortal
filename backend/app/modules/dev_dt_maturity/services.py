# -*- coding: utf-8 -*-
"""연계 · 평가 · 이력 · 사업부 판 셈. **판단의 규칙은 전부 여기**, 라우트는 배선만.

⚠️ 파생값은 매번 센다(항목 정확도 · 축별 최고 칸 · 미평가 · 재평가 필요). 저장하지 않는다.
"""
from datetime import datetime, timedelta

from app.extensions import db

from . import definitions as D
from .models import (
    MaturityAgent, MaturityAssessment, MaturityChange, MaturityPair, MaturitySubject,
)


class Refused(Exception):
    """사람이 고칠 수 있는 이유로 거절. 메시지가 그대로 화면에 간다."""


# ── 대상 · 수단 ─────────────────────────────────────────────────────────────

def _sector_or_refuse(sector):
    if sector not in D.SECTOR_BY_KEY:
        raise Refused('모르는 부문입니다.')
    if not D.sector_is_active(sector):
        raise Refused(f'「{D.SECTOR_BY_KEY[sector]["label"]}」 부문은 아직 열리지 않았습니다.')
    return sector


def create_subject(division_id, sector, name, detail=None, product_families=None,
                   accuracy_rule='auto', roadmap_task_id=None):
    _sector_or_refuse(sector)
    name = (name or '').strip()
    if not name:
        raise Refused('대상 이름이 필요합니다.')
    if accuracy_rule not in D.ACCURACY_RULES:
        raise Refused('집계 규칙은 auto · single · mean 중 하나입니다.')
    row = MaturitySubject(
        division_id=int(division_id), sector=sector, name=name[:300],
        detail=(detail or '')[:500] or None,
        product_families=_clean_list(product_families),
        accuracy_rule=accuracy_rule, roadmap_task_id=roadmap_task_id,
    )
    db.session.add(row)
    db.session.flush()
    return row


def _move_division(row, payload):
    """사업부를 옮긴다 — **걸린 연계이 없을 때만.** 연계은 같은 사업부끼리만 잇는다(create_pair).
    연계이 걸린 채 옮기면 MX 시험에 VD 시뮬레이션이 걸린 꼴이 되어 어느 사업부의 평가인지 사라진다.
    """
    if 'division_id' not in payload or payload['division_id'] in (None, ''):
        return
    try:
        target = int(payload['division_id'])
    except (TypeError, ValueError):
        raise Refused('사업부가 올바르지 않습니다.')
    if target == row.division_id:
        return
    if row.pairs:
        raise Refused(f'걸린 연계이 {len(row.pairs)}개 있어 사업부를 옮길 수 없습니다. 먼저 연계을 끊으세요.')
    row.division_id = target


def update_subject(row, payload):
    _move_division(row, payload)
    if 'name' in payload:
        name = (payload.get('name') or '').strip()
        if not name:
            raise Refused('대상 이름이 필요합니다.')
        row.name = name[:300]
    if 'detail' in payload:
        row.detail = (payload.get('detail') or '')[:500] or None
    if 'product_families' in payload:
        row.product_families = _clean_list(payload.get('product_families'))
    if 'accuracy_rule' in payload:
        if payload['accuracy_rule'] not in D.ACCURACY_RULES:
            raise Refused('집계 규칙은 auto · single · mean 중 하나입니다.')
        row.accuracy_rule = payload['accuracy_rule']
    if 'roadmap_task_id' in payload:
        row.roadmap_task_id = payload.get('roadmap_task_id') or None
    if 'order' in payload and isinstance(payload['order'], int):
        row.order = payload['order']
    return row


def departments_of(division_id):
    """이 사업부의 활성 부서 — 담당 부서 고르기의 재료. 포탈 부서 표를 읽기만 한다."""
    from app.modules.digital_twin_dashboard.models import Department
    rows = (Department.query.filter_by(division_id=int(division_id), is_active=True)
            .order_by(Department.name).all())
    return [{'id': r.id, 'name': r.name} for r in rows]


def _department_or_refuse(division_id, department_id):
    """담당 부서는 **그 사업부의 활성 부서**여야 한다. 아니면 거절 — 다른 사업부 부서를
    달면 어느 사업부의 시뮬레이션인지가 흐려진다. None 은 「안 정함」."""
    if department_id in (None, ''):
        return None
    try:
        dep_id = int(department_id)
    except (TypeError, ValueError):
        raise Refused('담당 부서가 올바르지 않습니다.')
    if not any(d['id'] == dep_id for d in departments_of(division_id)):
        raise Refused('담당 부서는 그 시뮬레이션의 사업부에 속한 부서여야 합니다.')
    return dep_id


def create_agent(division_id, sector, name, kind=None, model_kind=None, project_uuid=None,
                 tools=None, department_id=None, defect_types=None):
    _sector_or_refuse(sector)
    if not D.SECTOR_BY_KEY[sector]['has_agent']:
        raise Refused('이 부문은 수단 없이 대상에 직접 매깁니다.')
    name = (name or '').strip()
    if not name:
        raise Refused('수단 이름이 필요합니다.')
    if model_kind and model_kind not in D.MODEL_KIND_KEYS:
        raise Refused('모델 종류는 물리 기반 · 데이터 기반 · 하이브리드 중 하나입니다.')
    row = MaturityAgent(
        division_id=int(division_id), sector=sector, name=name[:300],
        kind=(kind or '')[:100] or None, model_kind=model_kind or None,
        project_uuid=(project_uuid or '')[:64] or None,
        tools=_clean_list(tools),
        defect_types=_clean_list(defect_types),
        department_id=_department_or_refuse(division_id, department_id),
    )
    db.session.add(row)
    db.session.flush()
    return row


def update_agent(row, payload):
    _move_division(row, payload)
    if 'name' in payload:
        name = (payload.get('name') or '').strip()
        if not name:
            raise Refused('수단 이름이 필요합니다.')
        row.name = name[:300]
    if 'kind' in payload:
        row.kind = (payload.get('kind') or '')[:100] or None
    if 'model_kind' in payload:
        mk = payload.get('model_kind') or None
        if mk and mk not in D.MODEL_KIND_KEYS:
            raise Refused('모델 종류는 물리 기반 · 데이터 기반 · 하이브리드 중 하나입니다.')
        row.model_kind = mk
    if 'project_uuid' in payload:
        row.project_uuid = (payload.get('project_uuid') or '')[:64] or None
    if 'tools' in payload:
        row.tools = _clean_list(payload.get('tools'))
    if 'defect_types' in payload:
        row.defect_types = _clean_list(payload.get('defect_types'))
    if 'department_id' in payload:
        row.department_id = _department_or_refuse(row.division_id, payload.get('department_id'))
    elif 'division_id' in payload and row.department_id:
        # 사업부를 옮겼는데 부서가 옛 사업부 것이면 비운다 — 잘못된 짝을 남기지 않는다
        if not any(d['id'] == row.department_id for d in departments_of(row.division_id)):
            row.department_id = None
    return row


# ── 연계 ─────────────────────────────────────────────────────────────────────

def create_pair(subject, agent=None):
    """대상 × 수단. **같은 사업부·같은 부문**이어야 한다.

    ⚠️ MX 의 시험에 VD 의 시뮬레이션을 걸면 어느 사업부의 평가인지가 사라진다.
    """
    sector = D.SECTOR_BY_KEY[subject.sector]
    if sector['has_agent']:
        if agent is None:
            raise Refused('이 부문은 수단이 필요합니다.')
        if agent.division_id != subject.division_id:
            raise Refused('대상과 수단의 사업부가 다릅니다. 같은 사업부끼리만 잇습니다.')
        if agent.sector != subject.sector:
            raise Refused('대상과 수단의 부문이 다릅니다.')
        dup = MaturityPair.query.filter_by(subject_id=subject.id, agent_id=agent.id).first()
    else:
        if agent is not None:
            raise Refused('이 부문은 수단 없이 대상에 직접 매깁니다.')
        # NULL 은 유일 제약이 못 잡는다 — 여기서 잡는다.
        dup = MaturityPair.query.filter_by(subject_id=subject.id, agent_id=None).first()
    if dup:
        raise Refused('이미 이어져 있습니다.')
    row = MaturityPair(subject_id=subject.id, agent_id=agent.id if agent else None)
    db.session.add(row)
    db.session.flush()
    return row


def delete_pair(pair):
    """연결을 끊으면 평가·이력이 같이 사라진다. 몇 건인지 돌려준다 — 확인 문구에 쓴다."""
    n_assess = len(pair.assessments)
    n_change = len(pair.changes)
    db.session.delete(pair)
    return {'assessments': n_assess, 'changes': n_change}


# ── 평가 ───────────────────────────────────────────────────────────────────

def parse_month(value):
    """평가 시점 — **연-월**('2025-11') 또는 날짜('2025-11-03'). 그 달 1일 정오(UTC)로 둔다.

    날짜 단위는 필요 없다(2026-08-28). 옛 자료를 넣을 수 있게 과거는 받고, 미래는 거절한다.
    """
    if value in (None, ''):
        return None
    s = str(value).strip()
    for fmt in ('%Y-%m', '%Y-%m-%d', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%S.%f'):
        try:
            d = datetime.strptime(s[:len('2025-11-03T00:00:00.000000')], fmt)
            break
        except ValueError:
            continue
    else:
        raise Refused('평가 시점은 「2025-11」 꼴(연-월)로 적어 주세요.')
    month = datetime(d.year, d.month, 1, 12, 0, 0)
    now = datetime.utcnow()
    if (month.year, month.month) > (now.year, now.month):
        raise Refused('평가 시점이 미래입니다.')
    if month.year < 2000:
        raise Refused('평가 시점이 너무 오래됐습니다.')
    return month


def assess(pair, axis_key, payload, actor):
    """축 하나를 매긴다. **근거 없이는 저장하지 않는다.** 이력은 바뀌었을 때만.

    rung 축:  payload.rung  (그 축의 칸 key)
    value 축: payload.value (숫자) — 칸은 사업부 문턱으로 환산된다. rung 을 보내면 거절.
    set 축:   payload.flags (선택한 항목 목록)
    assessed_at(선택): 연-월. 옛 자료를 그 시점으로 넣는다 — 평가일과 이력 날짜가 그 달이 된다.
    """
    when = parse_month(payload.get('assessed_at'))
    subject = pair.subject
    axis = D.axis_of(subject.sector, axis_key)
    if axis is None:
        raise Refused('이 부문에 없는 축입니다.')
    note = (payload.get('note') or '').strip()
    if not note:
        raise Refused('근거가 필요합니다. 무엇을 보고 이렇게 매겼는지 한 줄로 적으세요.')

    row = MaturityAssessment.query.filter_by(pair_id=pair.id, axis=axis_key).first()
    before = _mark(row) if row else None
    if axis['kind'] == 'matrix' and not (pair.agent and pair.agent.defect_types):
        raw_defects = (payload.get('evidence') or {}).get('defects') if isinstance(payload.get('evidence'), dict) else None
        if raw_defects:
            raise Refused('이 시뮬레이션에 불량 유형이 없습니다 — 시뮬레이션 관리에서 먼저 넣으세요.')

    if axis['kind'] == 'value':
        if 'rung' in payload and payload.get('rung') is not None:
            raise Refused(f'「{axis["label"]}」은 값으로 매깁니다. 칸은 값에서 정해집니다.')
        value = payload.get('value')
        try:
            value = float(value)
        except (TypeError, ValueError):
            raise Refused(f'「{axis["label"]}」 값(숫자)이 필요합니다.')
        if not (0 <= value <= 100):
            raise Refused('값은 0 에서 100 사이입니다.')
        rung = None
    elif axis['kind'] in ('set', 'matrix'):
        # 묶음 — flags(목록)로 받는다. rung 으로 와도 받는다(옛 화면·씨앗: 'pre,run' 또는 항목 하나).
        flags = payload.get('flags')
        if flags is None:
            flags = D.set_flags(axis, payload.get('rung'))
            if flags is None:
                raise Refused(f'「{axis["label"]}」에 없는 항목입니다.')
        elif not isinstance(flags, list) or any(f not in D.set_flag_keys(axis) for f in flags):
            raise Refused(f'「{axis["label"]}」에 없는 항목입니다.')
        rung = D.set_rung(axis, flags)
        value = None
    else:
        rung = payload.get('rung')
        if rung not in D.rung_keys(axis):
            raise Refused(f'「{axis["label"]}」에 없는 칸입니다.')
        value = None

    evidence = _clean_evidence(axis, payload.get('evidence'))

    # 값 축(정확도)은 **줄줄이** 쌓는다 — 저장마다 이력 한 줄, 같은 값이어도. 현재 값은 가장 늦은 줄.
    # 옛 달로 넣으면(backfill) 줄만 붙고 현재는 그대로다. (2026-08-28)
    backfill = (axis['kind'] == 'value' and when is not None and row is not None
                and row.assessed_at is not None and when < row.assessed_at)
    if row is None:
        row = MaturityAssessment(pair_id=pair.id, axis=axis_key)
        db.session.add(row)
    if not backfill:
        row.rung, row.value, row.note, row.evidence = rung, value, note, evidence
        row.assessed_at = when or datetime.utcnow()
        row.assessed_by_id = getattr(actor, 'id', None)
        row.assessed_by_name = getattr(actor, 'name', None)
    db.session.flush()

    after = f'{value:g}' if axis['kind'] == 'value' else _mark(row)
    if axis['kind'] == 'value' or before != after:
        change = MaturityChange(
            pair_id=pair.id, axis=axis_key, before=before, after=after, note=note,
            actor_user_id=getattr(actor, 'id', None),
            actor_name=getattr(actor, 'name', None))
        db.session.add(change)
        if when is not None:
            # 옛 시점으로 넣었으면 이력도 그 달에 선다 — 사다리의 「언제 올라왔나」가 그것을 읽는다.
            db.session.flush()
            change.created_at = when
    return row


def _mark(row):
    """이력에 적는 한 칸 — rung 축은 칸 key, value 축은 값, matrix 축은 바탕|t시험/m시장."""
    if row is None:
        return None
    if row.value is not None:
        return f'{row.value:g}'
    ev = row.evidence if isinstance(row.evidence, dict) else {}
    if 'defects' in ev:
        cells = list((ev.get('defects') or {}).values())
        t = sum(1 for c in cells if isinstance(c, dict) and c.get('test'))
        m = sum(1 for c in cells if isinstance(c, dict) and c.get('market'))
        return f'{row.rung}|t{t}/m{m}'
    return row.rung


def _clean_evidence(axis, raw):
    """축이 아는 근거 칸만 받는다. 모르는 키는 버린다 — 자유 JSON 은 금방 쓰레기가 된다."""
    if not isinstance(raw, dict):
        return {}
    out = {}
    for key in axis.get('evidence', []):
        if key not in raw or raw[key] in (None, ''):
            continue
        v = raw[key]
        if key in ('phenomena', 'product_families'):
            out[key] = _clean_list(v)
        elif key == 'defects':
            # {유형: {test: '연-월'|None, market: '연-월'|None}} — 켠 열이 하나도 없는 유형은 버린다
            if not isinstance(v, dict):
                continue
            cols = [c['key'] for c in axis.get('columns', [])]
            kept = {}
            for name, cells in v.items():
                if not isinstance(name, str) or not name.strip() or not isinstance(cells, dict):
                    continue
                row = {}
                for c in cols:
                    m = cells.get(c)
                    if m in (None, '', False):
                        continue
                    when = parse_month(m if isinstance(m, str) else None) if m is not True else datetime.utcnow()
                    row[c] = when.strftime('%Y-%m')
                if row:
                    kept[name.strip()] = row
            out[key] = kept
        elif key in ('compared_tests', 'tests_saved_per_year'):
            try:
                out[key] = int(v)
            except (TypeError, ValueError):
                continue
        elif key in ('error_pct', 'hours_per_run'):
            try:
                out[key] = float(v)
            except (TypeError, ValueError):
                continue
        else:
            out[key] = str(v)[:500]
    return out


def _clean_list(v):
    if isinstance(v, str):
        v = v.split(',')
    if not isinstance(v, list):
        return []
    seen, out = set(), []
    for x in v:
        s = str(x).strip()
        if s and s not in seen:
            seen.add(s)
            out.append(s[:100])
    return out


# ── 읽기 · 사업부 판 ───────────────────────────────────────────────────────

def pair_dict(pair, rule=None, stale_days=None, with_changes=False):
    """연계 하나. 평가는 축 key 로 묶고, value 축은 칸을 같이 환산해 준다."""
    subject = pair.subject
    axes = D.get_axes(subject.sector)
    rule = rule or D.get_accuracy_rule(subject.division_id)
    stale_days = stale_days or D.get_stale_days()
    cutoff = datetime.utcnow() - timedelta(days=stale_days)
    by_axis = {a.axis: a for a in pair.assessments}
    out_axes = {}
    for axis in axes:
        a = by_axis.get(axis['key'])
        if a is None:
            out_axes[axis['key']] = None
            continue
        d = a.to_dict()
        if axis['kind'] == 'value':
            d['rung'] = D.rung_for_value(a.value, rule['thresholds'], rule['boundary'])
        if axis['kind'] == 'set':
            d['flags'] = D.set_flags(axis, a.rung) or []
        if axis['kind'] == 'matrix':
            d['flags'] = D.set_flags(axis, a.rung) or []
            ev = a.evidence if isinstance(a.evidence, dict) else {}
            names = list((pair.agent.defect_types or []) if pair.agent else [])
            level, summary = D.matrix_level(axis, a.rung, ev.get('defects'), names)
            d['rung'] = D.rung_keys(axis)[level]
            d['defects'] = ev.get('defects') or {}
            d['summary'] = summary
            d['rung_index'] = level
            d['stale'] = bool(a.assessed_at and a.assessed_at < cutoff)
            out_axes[axis['key']] = d
            continue
        d['rung_index'] = D.rung_index(axis, d['rung'])
        d['stale'] = bool(a.assessed_at and a.assessed_at < cutoff)
        out_axes[axis['key']] = d
    d = {
        'id': pair.id,
        'subject_id': pair.subject_id,
        'agent_id': pair.agent_id,
        'accuracy_rule': rule,          # 화면의 정확도 막대가 세 영역을 이 문턱으로 나눈다
        'subject': subject.to_dict(),
        'agent': pair.agent.to_dict() if pair.agent else None,
        'assessments': out_axes,
        'unassessed': [k for k, v in out_axes.items() if v is None],
    }
    if with_changes:
        d['changes'] = [c.to_dict() for c in sorted(pair.changes, key=lambda c: -c.id)]
    return d


def board(division_id, sector):
    """사업부 판 — 대상마다 연계을 접고, 항목 집계를 센다.

    항목 정확도는 연계들의 값을 subject.accuracy_rule 로 집계한다(값 있는 것만).
    축별 최고 칸은 「이 시험은 어디까지 왔나」의 요약이다 — 평균이 아니다.
    """
    rule = D.get_accuracy_rule(division_id)
    stale_days = D.get_stale_days()
    axes = D.get_axes(sector)
    subjects = (MaturitySubject.query
                .filter_by(division_id=division_id, sector=sector)
                .order_by(MaturitySubject.order, MaturitySubject.id).all())
    rows = []
    for s in subjects:
        pairs = [pair_dict(p, rule, stale_days) for p in
                 sorted(s.pairs, key=lambda p: p.id)]
        acc_values = [(p['assessments'].get('accuracy') or {}).get('value')
                      for p in pairs]
        acc, filled, total = D.aggregate_accuracy(acc_values, s.accuracy_rule)
        best = {}
        for axis in axes:
            idx = [p['assessments'][axis['key']]['rung_index'] for p in pairs
                   if p['assessments'].get(axis['key'])
                   and p['assessments'][axis['key']]['rung_index'] is not None]
            best[axis['key']] = max(idx) if idx else None
        unassessed = sum(len(p['unassessed']) for p in pairs)
        stale = sum(1 for p in pairs for a in p['assessments'].values() if a and a['stale'])
        rows.append({
            **s.to_dict(),
            'pairs': pairs,
            'summary': {
                'accuracy': acc, 'accuracy_filled': filled, 'accuracy_total': total,
                'accuracy_rung': D.rung_for_value(acc, rule['thresholds'], rule['boundary']),
                'best_rung_index': best,
                'unassessed': unassessed,
                'stale': stale,
                'pair_count': len(pairs),
            },
        })
    return {
        'division_id': division_id, 'sector': sector,
        'axes': axes, 'accuracy_rule': rule, 'stale_days': stale_days,
        'subjects': rows,
        'totals': {
            'subjects': len(rows),
            'pairs': sum(r['summary']['pair_count'] for r in rows),
            'unassessed': sum(r['summary']['unassessed'] for r in rows),
            'stale': sum(r['summary']['stale'] for r in rows),
        },
    }


def recent_changes(division_id, sector, days=365, limit=500):
    """사업부의 최근 이력 — 타임라인(「올해 어느 칸이 언제 올라갔나」)의 재료.

    연계의 이름(시험 × 시뮬레이션)을 같이 실어 화면이 다시 찾지 않게 한다.
    """
    since = datetime.utcnow() - timedelta(days=int(days))
    rows = (MaturityChange.query
            .join(MaturityPair, MaturityChange.pair_id == MaturityPair.id)
            .join(MaturitySubject, MaturityPair.subject_id == MaturitySubject.id)
            .filter(MaturitySubject.division_id == division_id,
                    MaturitySubject.sector == sector,
                    MaturityChange.created_at >= since)
            .order_by(MaturityChange.created_at.desc(), MaturityChange.id.desc())
            .limit(limit).all())
    out = []
    for c in rows:
        d = c.to_dict()
        d['subject_name'] = c.pair.subject.name
        d['agent_name'] = c.pair.agent.name if c.pair.agent else None
        out.append(d)
    return out


# ── 도구 이름 정돈 — 인텔 표준 이름과 대본다 ─────────────────────────────────
#
# 같은 도구를 「HyperMesh」「Altair HyperMesh」「hypermesh」로 적으면 셈이 갈린다.
# 인텔 도구 표가 표준 이름이다(FK 는 아니다 — 제안과 정돈의 기준일 뿐).

def _tool_key(name):
    """비교용 열쇠 — 대소문자·공백·기호를 무시한다."""
    import re
    return re.sub(r'[^0-9a-z가-힣]', '', (name or '').lower())


def intel_tool_names():
    try:
        from app.modules.digital_twin_intel.models import IntelTech
        rows = (IntelTech.query
                .filter(IntelTech.kind != 'capability', IntelTech.is_archived.is_(False))
                .with_entities(IntelTech.name).all())
        return sorted({(r[0] or '').strip() for r in rows if (r[0] or '').strip()})
    except Exception:
        return []


def suggest_tool_name(name, standard):
    """인텔 이름 중 무엇으로 맞출지. 없으면 None.

    1) 열쇠가 같으면 그것(표기만 다른 것 — 「hypermesh」→「HyperMesh」)
    2) 내 열쇠가 인텔 이름 열쇠 **안에** 통째로 들어 있으면 그중 가장 짧은 것
       (「HyperMesh」→「Altair HyperMesh」). 세 글자 미만은 안 맞춘다 — 「3D」가 너무 많이 걸린다.
    """
    key = _tool_key(name)
    if not key:
        return None
    by_key = {}
    for s in standard:
        by_key.setdefault(_tool_key(s), s)
    if key in by_key:
        return by_key[key] if by_key[key] != name else None
    if len(key) < 3:
        return None
    hits = [s for k, s in by_key.items() if key in k]
    return min(hits, key=len) if hits else None


def tool_audit(division_id, sector='simulation'):
    """사업부가 쓰는 도구 이름마다 — 몇 개가 쓰나 · 인텔에 있나 · 무엇으로 맞출지."""
    standard = intel_tool_names()
    std_keys = {_tool_key(s) for s in standard}
    counts = {}
    for a in MaturityAgent.query.filter_by(division_id=division_id, sector=sector).all():
        for t in (a.tools or []):
            counts[t] = counts.get(t, 0) + 1
    rows = []
    for name, n in counts.items():
        exact = name in standard
        rows.append({
            'name': name, 'count': n,
            'in_intel': exact,
            'suggestion': None if exact else suggest_tool_name(name, standard),
            # 열쇠는 같은데 표기만 다른가(제안이 곧 답) / 인텔에 아예 없는가
            'known_variant': (not exact) and _tool_key(name) in std_keys,
        })
    rows.sort(key=lambda r: (r['in_intel'], r['suggestion'] is None, -r['count'], r['name']))
    return {'tools': rows, 'standard_count': len(standard),
            'off_standard': sum(1 for r in rows if not r['in_intel'])}


def rename_tool(division_id, old, new, sector='simulation'):
    """사업부의 모든 시뮬레이션에서 도구 이름을 바꾼다. 몇 개를 고쳤는지 돌려준다."""
    old = (old or '').strip()
    new = (new or '').strip()
    if not old or not new:
        raise Refused('바꿀 이름과 새 이름이 둘 다 필요합니다.')
    if old == new:
        return 0
    n = 0
    for a in MaturityAgent.query.filter_by(division_id=division_id, sector=sector).all():
        tools = list(a.tools or [])
        if old not in tools:
            continue
        a.tools = _clean_list([new if t == old else t for t in tools])
        n += 1
    db.session.flush()
    return n


# ── 제품군 — 도구와 같은 방식: 목록(찾기) · 정돈(표준과 대보기) · 이름 바꾸기 ─────
#
# 표준은 **로드맵 정보 모듈의 제품군 설정**(사업부별). 이 모듈이 정본을 따로 두지 않는다 —
# 같은 제품군을 두 모듈이 다른 글자로 부르면 로드맵과의 어긋남 셈이 틀어진다. 읽기 전용, FK 없음.

def roadmap_families(division_id=None):
    """로드맵 정보의 제품군 설정. division_id 를 주면 그 사업부 것만, 없으면 (사업부 id, 이름) 전부."""
    try:
        from app.modules.digital_twin_dashboard.models import ModuleSettings
        row = ModuleSettings.query.filter_by(
            module_name='digital_twin_reference', settings_key='product_families').first()
        rows = row.settings_data if row and isinstance(row.settings_data, list) else []
    except Exception:
        rows = []
    out = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        name = (r.get('name') or '').strip()
        did = str(r.get('divisionId') or '')
        if name and (division_id is None or did == str(division_id)):
            out.append((did, name))
    return out


def family_catalog(division_id, sector='simulation'):
    """찾기 창의 재료 — 이 사업부가 쓰는 것 · 로드맵 정보의 제품군 · 다른 사업부의 제품군."""
    from app.modules.digital_twin_dashboard.models import Division
    names_by_div = {str(d.id): d.name for d in Division.query.all()}
    used = {}
    for s in MaturitySubject.query.filter_by(division_id=division_id, sector=sector).all():
        for f in (s.product_families or []):
            used[f] = used.get(f, 0) + 1
    out, seen = [], set()
    for f, n in sorted(used.items(), key=lambda kv: (-kv[1], kv[0])):
        out.append({'name': f, 'category': '이 사업부가 쓰는 것', 'vendor': f'{n}개 시험'}); seen.add(f)
    for did, f in roadmap_families():
        if f in seen:
            continue
        mine = did == str(division_id)
        out.append({'name': f, 'category': '로드맵 정보의 제품군' if mine else '다른 사업부의 제품군',
                    'vendor': None if mine else names_by_div.get(did)})
        seen.add(f)
    return out


def family_audit(division_id, sector='simulation'):
    """시험 항목이 쓰는 제품군 이름마다 — 몇 개가 쓰나 · 로드맵 표준에 있나 · 무엇으로 맞출지."""
    standard = sorted({f for _d, f in roadmap_families(division_id)})
    std_keys = {_tool_key(s) for s in standard}
    counts = {}
    for s in MaturitySubject.query.filter_by(division_id=division_id, sector=sector).all():
        for f in (s.product_families or []):
            counts[f] = counts.get(f, 0) + 1
    rows = []
    for name, n in counts.items():
        exact = name in standard
        rows.append({'name': name, 'count': n, 'in_standard': exact,
                     'suggestion': None if exact else suggest_tool_name(name, standard),
                     'known_variant': (not exact) and _tool_key(name) in std_keys})
    rows.sort(key=lambda r: (r['in_standard'], r['suggestion'] is None, -r['count'], r['name']))
    return {'families': rows, 'standard_count': len(standard),
            'off_standard': sum(1 for r in rows if not r['in_standard'])}


def rename_family(division_id, old, new, sector='simulation'):
    """사업부의 모든 시험 항목에서 제품군 이름을 바꾼다. 몇 개를 고쳤는지."""
    old = (old or '').strip()
    new = (new or '').strip()
    if not old or not new:
        raise Refused('바꿀 이름과 새 이름이 둘 다 필요합니다.')
    if old == new:
        return 0
    n = 0
    for s in MaturitySubject.query.filter_by(division_id=division_id, sector=sector).all():
        fams = list(s.product_families or [])
        if old not in fams:
            continue
        s.product_families = _clean_list([new if f == old else f for f in fams])
        n += 1
    db.session.flush()
    return n


def board_all(sector='simulation'):
    """전 사업부 판 — 사업부마다 board() 를 돌려 묶는다. 사업부 이름을 실어 화면이 다시 찾지 않게.

    ⚠️ 판의 셈(항목 정확도·재평가 필요)은 **사업부 문턱**으로 하므로 사업부별로 돌린다. 한 번에
       섞어 세면 MX 문턱으로 VD 를 재게 된다.
    """
    from app.modules.digital_twin_dashboard.models import Division
    divisions = (Division.query.filter_by(is_active=True, is_kpi_owner=True)
                 .order_by(Division.order, Division.id).all())
    hidden = D.get_hidden_divisions()
    boards = []
    for d in divisions:
        if d.id in hidden:
            continue
        b = board(d.id, sector)
        b['division_name'] = d.name
        for s in b['subjects']:
            s['division_name'] = d.name
        boards.append(b)
    return {
        'sector': sector,
        'boards': boards,
        'totals': {k: sum(b['totals'][k] for b in boards) for k in ('subjects', 'pairs', 'unassessed', 'stale')},
    }


REACHED_NOTE = '시점 적기'     # 칸의 시점만 적은 이력 — 화면은 이것을 「내려감」으로 읽지 않는다


def delete_entry(pair, change_id, actor):
    """정확도 기록 하나를 지운다. 남은 줄 가운데 가장 늦은 것이 현재가 된다 — 없으면 미평가."""
    change = next((c for c in pair.changes if c.id == change_id), None)
    if change is None:
        raise Refused('없는 줄입니다.')
    axis = D.axis_of(pair.subject.sector, change.axis)
    if axis is None or axis['kind'] != 'value':
        raise Refused('값 축의 줄만 지울 수 있습니다 — 다른 축의 이력은 남습니다.')
    row = MaturityAssessment.query.filter_by(pair_id=pair.id, axis=change.axis).first()
    db.session.delete(change)
    db.session.flush()
    rest = sorted((c for c in pair.changes if c.axis == change.axis and c.id != change_id),
                  key=lambda c: (c.created_at, c.id))
    if not rest:
        if row is not None:
            db.session.delete(row)
        return None
    last = rest[-1]
    if row is None:
        row = MaturityAssessment(pair_id=pair.id, axis=change.axis)
        db.session.add(row)
    try:
        row.value = float(last.after)
    except (TypeError, ValueError):
        row.value = None
    row.rung, row.note = None, last.note
    row.assessed_at, row.assessed_by_id, row.assessed_by_name = last.created_at, last.actor_user_id, last.actor_name
    return row


def set_reached(pair, axis_key, rung_key, month, actor):
    """「이 칸에 언제 올라왔나」를 그 칸에서 바로 적는다. (2026-08-28)

    한 평가에 시점 하나면 사다리를 거슬러 온 이력을 넣으려면 칸마다 저장을 되풀이해야
    한다. 대신 도달한 칸의 연-월을 그 자리에서 고친다 — 이력(change)이 그 칸의 시점이다.
      · 그 칸을 만든 이력이 있으면(after 가 그 칸 / 묶음이면 그 항목을 선택한 것) 가장 이른 것의 날짜를 옮긴다
      · 없으면(가져온 자료 등) 그 칸을 적는 이력을 하나 만든다 — 근거는 「시점 적기」
    현재 칸보다 위의 칸에는 못 적는다 — 아직 안 올라온 칸의 시점은 뜻이 없다.
    """
    subject = pair.subject
    axis = D.axis_of(subject.sector, axis_key)
    if axis is None or axis['kind'] == 'value':
        raise Refused('이 축은 칸의 시점을 따로 적지 않습니다.')
    when = parse_month(month)
    if when is None:
        raise Refused('연-월이 필요합니다.')
    cur = MaturityAssessment.query.filter_by(pair_id=pair.id, axis=axis_key).first()
    if cur is None:
        raise Refused('먼저 이 축을 매기세요 — 매기지 않은 칸의 시점은 뜻이 없습니다.')
    if axis['kind'] in ('set', 'matrix'):
        if rung_key not in D.set_flag_keys(axis):
            raise Refused('이 축에 없는 항목입니다.')
        if rung_key not in (D.set_flags(axis, cur.rung) or []):
            raise Refused('선택하지 않은 항목의 시점은 적을 수 없습니다.')
        hit = lambda c: rung_key in str(c.after or '').split('|')[0].split(',')     # noqa: E731
    else:
        keys = D.rung_keys(axis)
        if rung_key not in keys:
            raise Refused('이 축에 없는 칸입니다.')
        if keys.index(rung_key) > keys.index(cur.rung):
            raise Refused('아직 올라오지 않은 칸의 시점은 적을 수 없습니다.')
        hit = lambda c: c.after == rung_key                             # noqa: E731
    rows = sorted((c for c in pair.changes if c.axis == axis_key and hit(c)), key=lambda c: c.created_at)
    if rows:
        rows[0].created_at = when
        return rows[0]
    change = MaturityChange(pair_id=pair.id, axis=axis_key, before=None, after=rung_key,
                            note=REACHED_NOTE, actor_user_id=getattr(actor, 'id', None),
                            actor_name=getattr(actor, 'name', None))
    db.session.add(change)
    db.session.flush()
    change.created_at = when
    return change


def set_defect_cell(pair, axis_key, name, col, month, actor):
    """불량 유형 표의 칸 하나 — {유형, 열}을 그 달로 켜거나(month) 끈다(None). **근거 없이** 바로 저장한다(2026-08-28).

    근거는 바탕(형상·거동)을 매길 때 적는다. 표의 칸은 「어느 불량이 언제부터 재현됐나」의 사실 하나라
    칸마다 근거를 묻지 않는다. 평가 줄이 없으면 바탕 「없음」으로 하나 만든다. 이력은 바뀌었을 때만.
    """
    subject = pair.subject
    axis = D.axis_of(subject.sector, axis_key)
    if axis is None or axis['kind'] != 'matrix':
        raise Refused('이 축에는 불량 유형 표가 없습니다.')
    names = list((pair.agent.defect_types or []) if pair.agent else [])
    if name not in names:
        raise Refused('이 시뮬레이션에 없는 불량 유형입니다 — 시뮬레이션 관리에서 먼저 넣으세요.')
    if col not in [c['key'] for c in axis['columns']]:
        raise Refused('없는 열입니다.')
    if month is True:                      # True = 이번 달
        when = datetime.utcnow()
    else:
        when = parse_month(month) if month not in (None, '', False) else None
    row = MaturityAssessment.query.filter_by(pair_id=pair.id, axis=axis_key).first()
    before = _mark(row) if row else None
    if row is None:
        row = MaturityAssessment(pair_id=pair.id, axis=axis_key, rung=D.rung_keys(axis)[0], note='', evidence={})
        db.session.add(row)
    ev = dict(row.evidence) if isinstance(row.evidence, dict) else {}
    defects = dict(ev.get('defects') or {})
    cells = dict(defects.get(name) or {})
    if when is None:
        cells.pop(col, None)
    else:
        cells[col] = when.strftime('%Y-%m')
    if cells:
        defects[name] = cells
    else:
        defects.pop(name, None)
    ev['defects'] = defects
    row.evidence = ev
    row.assessed_at = datetime.utcnow()
    row.assessed_by_id = getattr(actor, 'id', None)
    row.assessed_by_name = getattr(actor, 'name', None)
    db.session.flush()
    after = _mark(row)
    if before != after:
        db.session.add(MaturityChange(
            pair_id=pair.id, axis=axis_key, before=before, after=after,
            note=f'{name} · {col}' + (' 선택' if when else ' 해제'),
            actor_user_id=getattr(actor, 'id', None), actor_name=getattr(actor, 'name', None)))
    return row
