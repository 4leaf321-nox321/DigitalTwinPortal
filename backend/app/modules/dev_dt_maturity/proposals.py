# -*- coding: utf-8 -*-
"""AI 가 매긴 것은 **제안으로 들어온다** — 사람이 화면에서 보고 승인해야 판에 오른다. (2026-08-30)

왜 이렇게 하나
    이 모듈이 지키는 한 가지는 「근거 없이는 매기지 않는다」다. 그 규칙이 막는 것은
    **빈 근거**이지 **지어낸 근거**가 아니다 — 그리고 AI 는 정확히 그럴듯한 근거를
    만들어 내는 기계다. 실제로 MCP 로 몰아 보다가 「낙하 시험 8건과 비교, 오차 5.4%」
    라는, 본 적 없는 시험을 근거로 적어 넣었고 판에는 92%(현상 재현)가 사실인 양 섰다.

왜 **별도 표**인가 (중요)
    대기 상태를 `MaturityAssessment` 에 깃발로 두면 판·요약·변화·모판·추출·전사 셈
    **전부에서 걸러야** 한다. 이 모듈에서 여태 난 결함이 대부분 그런 자리였다.
    제안을 딴 표에 두면 그 표들은 아무것도 안 바꿔도 된다 — 대기 중인 것은 애초에
    `MaturityAssessment` 에 없으니까. **구조적으로 안 샌다.**

무엇이 제안이고 무엇이 바로 들어가나
    제안 — **판단**: 축 매기기 · 불량 유형 표 · 도달 시점
    즉시 — **자료**: 대상·수단 만들기, 연계 잇기, 일괄 입력, 건 기록, 스레드 사전
    사실을 적는 것은 틀리면 고치면 된다. 판단은 근거가 걸려 있어 다르다.
    자료 세우기까지 승인을 받게 하면 「엑셀 30줄 올려줘」가 승인 30번이 되어 아무도 안 쓴다.

⚠️ 승인하면 **사람이 매긴 것**이 된다 — 그 사람이 근거를 읽고 눌렀으니 그 판단이다.
   이력의 actor 는 승인한 사람이고, 「AI 가 제안했다」는 이 표에 남는다.
"""
from datetime import datetime

from sqlalchemy.orm import joinedload

from app.extensions import db

from . import definitions as D
from .models import MaturityPair
from .services import Refused

KINDS = ('assess', 'defect', 'reached')
# superseded — 같은 자리에 새 제안이 와서 밀려난 것. 지우지 않는다(무엇을 냈었는지 남는다).
STATUS = ('pending', 'approved', 'rejected', 'superseded')


class MaturityProposal(db.Model):
    """AI 가 낸 판단 하나. 승인되기 전에는 **어느 셈에도 들지 않는다.**"""
    __tablename__ = 'dt_maturity_proposal'

    id = db.Column(db.Integer, primary_key=True)
    pair_id = db.Column(db.Integer, db.ForeignKey('dt_maturity_pair.id', ondelete='CASCADE'),
                        nullable=False, index=True)
    division_id = db.Column(db.Integer, nullable=False, index=True)   # 목록을 사업부로 가른다
    kind = db.Column(db.String(20), nullable=False)                   # assess · defect · reached
    axis = db.Column(db.String(40), nullable=False)
    payload = db.Column(db.JSON, nullable=False, default=dict)        # 그 길이 받는 몸 그대로
    note = db.Column(db.Text, nullable=False, default='')             # 근거 — 사람이 읽고 판단한다
    actor_user_id = db.Column(db.Integer)
    actor_name = db.Column(db.String(100))
    source = db.Column(db.String(20), nullable=False, default='ai')   # 지금은 ai 하나
    status = db.Column(db.String(20), nullable=False, default='pending', index=True)
    decided_by_id = db.Column(db.Integer)
    decided_by_name = db.Column(db.String(100))
    decided_at = db.Column(db.DateTime)
    decided_note = db.Column(db.Text)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    pair = db.relationship('MaturityPair')

    def to_dict(self, now=None):
        """`now` 는 밖에서 **모아 읽어** 넣어 준다 — 줄마다 읽으면 N+1 이다(2026-08-30)."""
        d = {'id': self.id, 'pair_id': self.pair_id, 'division_id': self.division_id,
             'kind': self.kind, 'axis': self.axis, 'payload': self.payload or {},
             'note': self.note, 'source': self.source, 'status': self.status,
             'actor_name': self.actor_name, 'superseded': getattr(self, 'superseded', 0),
             'decided_by_name': self.decided_by_name, 'decided_note': self.decided_note,
             'created_at': self.created_at.isoformat() if self.created_at else None,
             'decided_at': self.decided_at.isoformat() if self.decided_at else None,
             'now': now}
        pair = self.pair
        if pair is not None:
            d['subject_name'] = pair.subject.name if pair.subject else None
            d['agent_name'] = pair.agent.name if pair.agent else None
            d['sector'] = pair.subject.sector if pair.subject else None
            axis = D.axis_of(d['sector'], self.axis) if d['sector'] else None
            d['axis_label'] = (axis or {}).get('label') or self.axis
        return d


def _guard(pair, kind, axis_key, payload):
    """제안할 때도 **같은 규칙**을 본다 — 승인할 때가 되어서야 안 된다고 하면 늦다.

    ⚠️ 값까지 본다. 여태는 갈래·축·근거만 봐서, 없는 칸을 낸 제안이 202 로 받아들여지고
       확인 대기에 쌓였다. 사람이 승인을 눌러야 「없는 칸입니다」가 나오고, 그 카드는
       아무리 눌러도 안 올라간다 — 거절 말고는 치울 길이 없었다(2026-08-30 실측).
       내는 쪽(AI·MCP)도 그 자리에서 바로 고칠 수 있어야 한다.
    """
    if kind not in KINDS:
        raise Refused('모르는 제안 갈래입니다.')
    axis = D.axis_of(pair.subject.sector, axis_key)
    if axis is None:
        raise Refused('이 부문에 없는 축입니다.')
    if kind in ('assess', 'reached') and not (payload.get('note') or '').strip():
        raise Refused('근거가 필요합니다. 무엇을 보고 이렇게 매겼는지 한 줄로 적으세요.')
    if kind == 'assess':
        from .services import check_axis_value
        check_axis_value(pair.subject.sector, axis_key, payload)
    return axis


def create(pair, kind, axis_key, payload, actor):
    """제안 하나. **자료는 아무것도 안 바뀐다** — 승인해야 그때 들어간다.

    ⚠️ 같은 자리(연계 × 축 × 갈래)에 대기 중인 것이 있으면 **밀어낸다**(superseded).
       AI 가 고쳐 다시 내면 똑같은 카드가 쌓여, 사람이 어느 것이 최신인지 모른다.
       지우지는 않는다 — 아무도 안 누른 것이라도 「이렇게도 제안했다」는 기록이다.
    """
    _guard(pair, kind, axis_key, payload)
    old = MaturityProposal.query.filter_by(pair_id=pair.id, axis=axis_key, kind=kind,
                                           status='pending').all()
    for o in old:
        o.status = 'superseded'
        o.decided_at = datetime.utcnow()
    row = MaturityProposal(
        pair_id=pair.id, division_id=pair.subject.division_id, kind=kind, axis=axis_key,
        payload={k: v for k, v in (payload or {}).items() if k != 'actor_mode'},
        note=(payload.get('note') or '').strip(),
        actor_user_id=getattr(actor, 'id', None), actor_name=getattr(actor, 'name', None))
    db.session.add(row)
    db.session.flush()
    row.superseded = len(old)          # 화면·MCP 가 「앞의 것을 밀어냈다」를 말할 수 있게
    return row


def _now_map(rows):
    """(pair_id, axis) → 지금 값. **한 질의로** 모은다.

    ⚠️ 예전에는 줄마다 pair_dict() 를 불렀다 — 한 칸을 보려고 그 연계의 평가 전부·수단·
       부서·문턱·재평가 여부를 다시 셌다. 줄당 질의 8회였다(2026-08-30 실측).
    """
    from .models import MaturityAssessment
    keys = {(r.pair_id, r.axis) for r in rows}
    if not keys:
        return {}
    got = (MaturityAssessment.query
           .filter(MaturityAssessment.pair_id.in_({p for p, _ in keys}))
           .filter(MaturityAssessment.axis.in_({a for _, a in keys})).all())
    return {(a.pair_id, a.axis): {'rung': a.rung, 'value': a.value, 'note': a.note}
            for a in got if (a.pair_id, a.axis) in keys}


def listing(division_id=None, status='pending', limit=200, actor=None):
    """`actor` 를 주면 줄마다 **내가 결정할 수 있는지**를 붙인다.

    ⚠️ 목록은 다 보여 준다(읽기는 전사 허용). 못 누르는 것을 감추면 「왜 배지 수와
       목록이 다르지」가 되고, 남의 사업부에서 무엇이 오가는지도 못 본다.
    """
    # ⚠️ 연계·대상·수단을 **한 번에 당긴다** — 안 그러면 줄마다 세 질의가 더 간다.
    q = MaturityProposal.query.options(
        joinedload(MaturityProposal.pair).joinedload(MaturityPair.subject),
        joinedload(MaturityProposal.pair).joinedload(MaturityPair.agent))
    if division_id is not None:
        q = q.filter_by(division_id=int(division_id))
    if status == 'done':
        # 지난 것 — 결정됐거나 밀려난 것 전부. 「무엇을 냈고 우리가 어떻게 했나」를 본다.
        q = q.filter(MaturityProposal.status != 'pending')
    elif status and status != 'all':
        q = q.filter_by(status=status)
    rows = q.order_by(MaturityProposal.id.desc()).limit(limit).all()
    now = _now_map(rows)
    out = []
    for r in rows:
        d = r.to_dict(now.get((r.pair_id, r.axis)))
        if actor is not None:
            from . import permissions as P
            from app.modules.digital_twin_dashboard.models import Division
            div = Division.query.get(r.division_id)
            reason = P.deny_reason(actor, r.division_id, div.name if div else None)
            d['deny_reason'] = reason               # 없으면 내가 결정할 수 있다
            d['division_name'] = div.name if div else None
        out.append(d)
    return out


def count_pending(division_ids=None):
    """⚠️ 부르는 쪽이 **내가 결정할 수 있는 사업부만** 넘긴다 — 배지는 내 할 일이다."""
    q = MaturityProposal.query.filter_by(status='pending')
    if division_ids is not None:
        if not division_ids:
            return 0
        q = q.filter(MaturityProposal.division_id.in_(list(division_ids)))
    return q.count()


def decide(row, ok, actor, note=''):
    """승인하면 **사람이 매긴 것**이 된다 — 사람의 길(services.assess)로 그대로 들어간다.

    ⚠️ 승인 시점에 다시 검사한다. 제안한 뒤 기준 정보가 바뀌었거나 남이 먼저 고쳤을 수
       있다. 안 되면 그 이유를 그대로 올린다 — 조용히 넘기지 않는다.
    """
    from . import services as S
    from . import threads as T
    if row.status != 'pending':
        raise Refused('이미 결정된 제안입니다.')
    row.status = 'approved' if ok else 'rejected'
    row.decided_by_id = getattr(actor, 'id', None)
    row.decided_by_name = getattr(actor, 'name', None)
    row.decided_at = datetime.utcnow()
    row.decided_note = (note or '').strip() or None
    if not ok:
        db.session.flush()
        return None

    pair = MaturityPair.query.get(row.pair_id)
    if pair is None:
        raise Refused('연계가 사라졌습니다 — 제안을 거절하세요.')
    p = dict(row.payload or {})
    p.pop('base_assessed_at', None)      # 승인이 곧 결정 시점이다 — 낡은 기준으로 막지 않는다
    if row.kind == 'assess':
        T.guard_assess(pair, row.axis, p)
        S.assess(pair, row.axis, p, actor)
    elif row.kind == 'defect':
        S.set_defect_cell(pair, row.axis, p.get('name'), p.get('col'), p.get('month'), actor)
    else:
        S.set_reached(pair, row.axis, p.get('rung'), p.get('month'), actor)
    db.session.flush()
    return pair
