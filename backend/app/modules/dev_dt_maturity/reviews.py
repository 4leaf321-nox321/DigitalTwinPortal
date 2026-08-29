# -*- coding: utf-8 -*-
"""해석 활용 기록 — 시험과 짝이 없는 스팟성 시뮬레이션을 **건(件)**으로 쌓는다. (2026-08-28)

시험 항목은 상태(연계마다 사다리 하나)이고, 여기는 사건(건마다 한 줄, 누적)이다.
  · 한 줄 = 시뮬레이션으로 검토한 건 하나: 연-월 · 종류(스펙 검토/원인 분석) · 대상 · 항목 ·
    쓴 시뮬레이션 · 시점 · 결정 반영 · 판정 근거 · 리드타임(일) · 메모
  · 연간으로 센다: 건수 · 「스펙 확정 전 이상」 % · 「관문 이상」 % · 「검증됨」 % · 리드타임 중앙값
  · 같은 시뮬레이션 × 항목이 한 해에 N건(기본 3) 이상이면 「정착 후보」 — 상시 항목으로 올릴 재료
  · 엑셀에 있던 것을 CSV 로 붙여 넣는다(틀 내려받기 → 미리보기 → 넣기)
"""
import csv
import io
import statistics
from collections import Counter
from datetime import date, datetime

from app.extensions import db

from . import definitions as D
from .importer import TableFormatError, _read_rows, norm
from .models import MaturityAgent, MaturityReviewCase
from .services import Refused


# ── 한 건 ──────────────────────────────────────────────────────────────────

def _month(value):
    """'2026-03' / '2026-03-15' / date → 그 달 1일. 미래는 거절."""
    if isinstance(value, date):
        d = value
    else:
        s = str(value or '').strip()
        for fmt in ('%Y-%m', '%Y-%m-%d', '%Y.%m', '%Y/%m'):
            try:
                d = datetime.strptime(s[:len('2026-03-15')] if fmt == '%Y-%m-%d' else s[:7], fmt).date()
                break
            except ValueError:
                continue
        else:
            raise Refused('연-월은 「2026-03」 꼴로 적어 주세요.')
    d = d.replace(day=1)
    today = date.today()
    if (d.year, d.month) > (today.year, today.month):
        raise Refused('미래의 달입니다.')
    if d.year < 2000:
        raise Refused('너무 오래된 달입니다.')
    return d


def _choice(field, value, required=False):
    keys = [o['key'] for o in D.vocab(f'review_{field}')]
    v = (value or '').strip() if isinstance(value, str) else value
    if not v:
        if required:
            raise Refused(f'「{D.REVIEW_FIELDS[field]["label"]}」을 고르세요.')
        return None
    if v not in keys:
        # 라벨로 와도 받는다(엑셀)
        by_label = {norm(o['label']): o['key'] for o in D.vocab(f'review_{field}')}
        v = by_label.get(norm(v))
        if v is None:
            raise Refused(f'「{D.REVIEW_FIELDS[field]["label"]}」에 없는 값입니다.')
    return v


def _agent(division_id, agent_id, agent_name):
    """시뮬레이션 — 관리 목록의 것이면 id 로, 아니면 이름만. 다른 사업부의 것은 거절."""
    if agent_id not in (None, ''):
        row = MaturityAgent.query.get(int(agent_id))
        if row is None or row.division_id != int(division_id):
            raise Refused('이 사업부의 시뮬레이션이 아닙니다.')
        return row.id, row.name
    name = (agent_name or '').strip()[:300]
    if name:
        row = MaturityAgent.query.filter_by(division_id=int(division_id), name=name).first()
        if row is not None:
            return row.id, row.name
    return None, (name or None)


def _fill(row, payload, division_id):
    if 'kind' in payload or row.kind is None:
        kind = (payload.get('kind') or row.kind or '').strip()
        if kind not in D.vocab_keys('review_kind'):
            raise Refused('종류는 설계 스펙 검토 · 원인 분석 중 하나입니다.')
        row.kind = kind
    if 'month' in payload or row.month is None:
        row.month = _month(payload.get('month') or row.month)
    if 'target' in payload:
        row.target = (payload.get('target') or '').strip()[:300] or None
    if 'item' in payload:
        row.item = (payload.get('item') or '').strip()[:300] or None
    if 'agent_id' in payload or 'agent_name' in payload:
        row.agent_id, row.agent_name = _agent(division_id, payload.get('agent_id'), payload.get('agent_name') or row.agent_name)
    for f in ('timing', 'decision', 'basis'):
        if f in payload:
            setattr(row, f, _choice(f, payload.get(f)))
    if 'lead_days' in payload:
        v = payload.get('lead_days')
        if v in (None, ''):
            row.lead_days = None
        else:
            try:
                row.lead_days = float(v)
            except (TypeError, ValueError):
                raise Refused('리드타임은 숫자(일)입니다.')
            if row.lead_days < 0:
                raise Refused('리드타임은 0 이상입니다.')
    if 'note' in payload:
        row.note = (payload.get('note') or '').strip()[:2000] or None
    if not row.agent_id and not row.agent_name:
        raise Refused('쓴 시뮬레이션을 적으세요 — 관리 목록에서 고르거나 이름만이라도.')
    return row


def create(division_id, payload, actor):
    row = MaturityReviewCase(division_id=int(division_id),
                             actor_user_id=getattr(actor, 'id', None), actor_name=getattr(actor, 'name', None))
    _fill(row, payload, division_id)
    db.session.add(row)
    db.session.flush()
    return row


def update(row, payload, actor):
    _fill(row, payload, row.division_id)
    row.actor_user_id = getattr(actor, 'id', None)
    row.actor_name = getattr(actor, 'name', None)
    return row


def list_cases(division_id, year=None, kind=None):
    q = MaturityReviewCase.query.filter_by(division_id=int(division_id))
    if year:
        q = q.filter(MaturityReviewCase.month >= date(int(year), 1, 1), MaturityReviewCase.month < date(int(year) + 1, 1, 1))
    if kind:
        q = q.filter_by(kind=kind)
    return q.order_by(MaturityReviewCase.month.desc(), MaturityReviewCase.id.desc()).all()


def years(division_id=None):
    q = db.session.query(MaturityReviewCase.month)
    if division_id is not None:
        q = q.filter_by(division_id=int(division_id))
    ys = sorted({m.year for (m,) in q.all()}, reverse=True)
    return ys or [date.today().year]


# ── 연간 셈 ────────────────────────────────────────────────────────────────

def _rate(rows, field, at_least_key):
    """그 칸이 at_least_key 이상인 건의 %. 칸을 안 적은 건은 분모에서 뺀다."""
    opts = [o['key'] for o in D.REVIEW_FIELDS[field]['options']]
    got = [getattr(r, field) for r in rows if getattr(r, field) in opts]
    if not got:
        return None
    k = opts.index(at_least_key)
    return round(100 * sum(1 for v in got if opts.index(v) >= k) / len(got))


def stats(division_id, year, promote_min=None):
    """한 사업부·한 해의 셈 — 종류마다 {count, rates, lead_median, promote[]}."""
    promote_min = promote_min or D.get_review_promote_min()
    rows = list_cases(division_id, year)
    out = {'division_id': int(division_id), 'year': int(year), 'kinds': {}}
    for kind in D.vocab_keys('review_kind'):
        rs = [r for r in rows if r.kind == kind]
        leads = [r.lead_days for r in rs if r.lead_days is not None]
        pairs = Counter((r.agent_name or f'#{r.agent_id}', r.item or '') for r in rs if (r.agent_id or r.agent_name) and r.item)
        out['kinds'][kind] = {
            'count': len(rs),
            'early': _rate(rs, 'timing', 'before_spec'),        # 스펙 확정 전 이상
            'gate': _rate(rs, 'decision', 'gate'),              # 관문 이상
            'confirmed': _rate(rs, 'basis', 'confirmed'),       # 실측·시험 검증됨
            'lead_median': round(statistics.median(leads), 1) if leads else None,
            'promote': [{'agent_name': a, 'item': i, 'count': n} for (a, i), n in pairs.most_common() if n >= promote_min],
        }
    return out


def stats_all(year, division_ids):
    return [stats(d, year) for d in division_ids]


# ── CSV ────────────────────────────────────────────────────────────────────

def template_csv():
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([c['label'] for c in D.REVIEW_COLUMNS])
    w.writerow(['2026-03', '설계 스펙 검토', 'Galaxy Z Fold8', '힌지 강성 스펙', '폴딩 응력 해석',
                '스펙 확정 전', '스펙 확정 관문', '정량 마진 산출', '4', '힌지 두께 0.2mm 축소 결정'])
    w.writerow(['2026-05', '원인 분석', 'QM 이슈 #1234', '커버 글라스 크랙', '낙하 구조 해석',
                '문제 발생 후', '설계 변경 근거', '실측·시험 검증', '6', '코너 R 확대'])
    return '﻿' + buf.getvalue()


def _cols_map(header):
    by = {}
    for c in D.REVIEW_COLUMNS:
        by[norm(c['label'])] = c['key']
        by[norm(c['key'])] = c['key']
    mapping = {}
    for i, h in enumerate(header):
        key = by.get(norm(h))
        if key and key not in mapping.values():
            mapping[key] = i
    missing = [c['label'] for c in D.REVIEW_COLUMNS if c['required'] and c['key'] not in mapping]
    if missing:
        raise TableFormatError(f'머리글에 {" · ".join(missing)} 열이 없습니다. 틀을 내려받아 그 머리글로 올려 주세요.')
    return mapping


def parse(text, division_id):
    """붙여 넣은 표 → 건 목록(payload) + 줄별 문제. 저장은 안 한다."""
    rows = _read_rows(text)
    if not rows:
        raise TableFormatError('표가 비어 있습니다.')
    mapping = _cols_map(rows[0][1])
    kind_by_label = {norm(k['label']): k['key'] for k in D.vocab('review_kind')}
    kind_by_label.update({norm(k['key']): k['key'] for k in D.vocab('review_kind')})
    items, problems = [], []
    for line, cells in rows[1:]:
        get = lambda k: (cells[mapping[k]] if k in mapping and mapping[k] < len(cells) else '')   # noqa: E731
        payload = {
            'month': get('month'), 'kind': kind_by_label.get(norm(get('kind')), get('kind')),
            'target': get('target'), 'item': get('item'), 'agent_name': get('agent'),
            'timing': get('timing'), 'decision': get('decision'), 'basis': get('basis'),
            'lead_days': get('lead_days'), 'note': get('note'),
        }
        try:
            probe = MaturityReviewCase(division_id=int(division_id))
            _fill(probe, payload, division_id)
            items.append({'line': line, 'payload': payload, 'agent_known': probe.agent_id is not None})
        except Refused as e:
            problems.append({'line': line, 'message': str(e)})
    return {'items': items, 'problems': problems, 'count': len(items)}


def apply(text, division_id, actor):
    plan = parse(text, division_id)
    if plan['problems']:
        raise TableFormatError(f'{len(plan["problems"])}줄에 문제가 있습니다 — 미리보기에서 고친 뒤 넣으세요.')
    made = [create(division_id, it['payload'], actor) for it in plan['items']]
    return {'created': len(made)}
