# -*- coding: utf-8 -*-
"""기준 정보 점검 — 자료가 가리키는 값이 지금 목록에 있는가(2026-08-30).

사무국이 기준 정보에서 항목을 빼도 **자료는 지우지 않는다**(그게 규칙이다). 대신 그
자료는 없는 값을 가리킨 채 남고, 화면에는 key 가 그대로 보인다. 여기서 그런 줄을 찾아
세어 주고, 지금 있는 값으로 한꺼번에 옮긴다.

⚠️ 자동으로 고치지 않는다. 「메일로 받던 것」이 「파일서버」인지 「비시스템」인지는
   사람만 안다 — 화면이 묻고, 사람이 고르고, 그때 옮긴다.
"""
from app.extensions import db

from . import definitions as D
from .models import (
    MaturityAgent, MaturityReviewCase, MaturitySubject,
    ThreadCase, ThreadSegmentDef, ThreadSystem,
)


class Refused(Exception):
    pass


# (사전, 표, 칸, 여럿인가, 어디에, 직접 적어도 되는 칸인가)
CHECKS = [
    ('model_kinds', MaturityAgent, 'model_kind', False, '수단 — 모델 종류', False),
    ('review_kind', MaturityReviewCase, 'kind', False, '해석 활용 기록 — 종류', False),
    ('review_timing', MaturityReviewCase, 'timing', False, '해석 활용 기록 — 시점', False),
    ('review_decision', MaturityReviewCase, 'decision', False, '해석 활용 기록 — 결정 반영', False),
    ('review_basis', MaturityReviewCase, 'basis', False, '해석 활용 기록 — 판정 근거', False),
    ('system_kinds', ThreadSystem, 'kind', False, '시스템 사전 — 종류', False),
    ('link_means', ThreadSystem, 'link_means', False, '시스템 사전 — 연계 수단', False),
    ('system_status', ThreadSystem, 'status', False, '시스템 사전 — 상태', False),
    ('thread_stages', ThreadSystem, 'stages', True, '시스템 사전 — 생애 단계', False),
    ('thread_stages', ThreadSegmentDef, 'from_stage', False, '스레드 구간 — 출발 단계', False),
    ('thread_stages', ThreadSegmentDef, 'to_stage', False, '스레드 구간 — 도착 단계', False),
    ('case_actions', ThreadCase, 'action', False, '연계 개발 기록 — 무엇을', False),
    ('case_status', ThreadCase, 'status', False, '연계 개발 기록 — 상태', False),
    # 아래는 **직접 적어도 되는 칸**이다 — 표준에 없는 값이 곧 잘못은 아니다.
    ('process_steps', MaturitySubject, 'process', False, '공정 — 공정 단계', True),
    ('data_kinds', ThreadSegmentDef, 'data_kinds', True, '스레드 구간 — 기본 데이터', True),
]

# 비울 수 있는 칸 — 그 밖은 반드시 다른 값으로 옮긴다
NULLABLE = {(MaturityAgent, 'model_kind'), (MaturitySubject, 'process'),
            (MaturityReviewCase, 'timing'), (MaturityReviewCase, 'decision'),
            (MaturityReviewCase, 'basis')}


def _values(model, field, many):
    """그 칸이 쓰는 값을 세어 온다 — {값: 몇 줄}."""
    out = {}
    for (val,) in db.session.query(getattr(model, field)).all():
        for v in (val or []) if many else [val]:
            if v in (None, ''):
                continue
            out[str(v)] = out.get(str(v), 0) + 1
    return out


def scan():
    """사전마다 어긋난 값을 모아 준다. 어긋난 게 없는 사전은 빼지 않는다(0으로 보인다)."""
    by_vocab = {}
    for name, model, field, many, where, free in CHECKS:
        known = D.vocab_keys(name)
        for value, count in _values(model, field, many).items():
            if value in known:
                continue
            row = by_vocab.setdefault(name, {'bad': {}, 'free': False})
            hit = row['bad'].setdefault(value, {'value': value, 'count': 0, 'where': [], 'free': free})
            hit['count'] += count
            hit['where'].append(where)
            hit['free'] = hit['free'] and free      # 한 자리라도 표준이면 표준으로 본다
            row['free'] = row['free'] or free

    out = []
    for v in D.VOCABS:
        name = v['key']
        if not any(c[0] == name for c in CHECKS):
            continue
        bad = sorted((by_vocab.get(name) or {}).get('bad', {}).values(), key=lambda x: -x['count'])
        out.append({
            'vocab': name, 'label': v['label'],
            'sector_label': D.sector_of(v.get('sector')).get('label') or '공통',
            'options': D.vocab(name), 'bad': bad,
            'can_clear': any((c[1], c[2]) in NULLABLE for c in CHECKS if c[0] == name),
        })
    return out


def remap(name, moves, actor=None):
    """어긋난 값을 지금 있는 값으로 옮긴다. moves = [{'from': 옛값, 'to': 새값 또는 ''}].

    ⚠️ 되돌릴 수 없다 — 자료의 칸을 그대로 덮는다. 그래서 「지금 있는 값」으로만 간다.
    """
    if name not in D.VOCAB_BY_KEY:
        raise Refused('모르는 기준 정보입니다.')
    known = D.vocab_keys(name)
    plan = []
    for m in moves if isinstance(moves, list) else []:
        src = str((m or {}).get('from') or '').strip()
        dst = str((m or {}).get('to') or '').strip()
        if not src or src in known:
            continue                                  # 이미 맞는 값은 건드리지 않는다
        if dst and dst not in known:
            raise Refused(f'「{dst}」 은 지금 목록에 없는 값입니다.')
        plan.append((src, dst))
    if not plan:
        return {'moved': 0, 'rows': 0}

    moved = rows = 0
    for check_name, model, field, many, _where, _free in CHECKS:
        if check_name != name:
            continue
        can_clear = (model, field) in NULLABLE
        for src, dst in plan:
            if not dst and not can_clear:
                raise Refused(f'「{field}」 은 비울 수 없는 칸입니다 — 옮길 값을 고르세요.')
            if many:
                for row in model.query.all():
                    vals = list(row.__getattribute__(field) or [])
                    if src not in vals:
                        continue
                    nxt = []
                    for v in vals:
                        v2 = dst if v == src else v
                        if v2 and v2 not in nxt:
                            nxt.append(v2)
                    setattr(row, field, nxt)
                    rows += 1
                    moved += 1
            else:
                hit = model.query.filter(getattr(model, field) == src).all()
                for row in hit:
                    setattr(row, field, dst or None)
                rows += len(hit)
                moved += len(hit)
    if rows:
        db.session.flush()
    return {'moved': moved, 'rows': rows}
