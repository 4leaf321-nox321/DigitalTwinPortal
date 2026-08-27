# -*- coding: utf-8 -*-
"""기술정보 → 전략 연결 테스트. (AUDIT_PLAN 3-1)

**여기서 지키는 것은 환산 공식이 아니라 판단의 규칙이다.**

  · 표본이 얇은 칸에 후보를 내는가 — 역량 한두 개로 차원 하나를 말하면
    그건 관찰이 아니라 확대해석이다
  · 5(폐루프)를 자동으로 주장하는가 — 도구를 들였다는 사실이 「결과가 현실로
    되돌아간다」까지 말해 주지는 않는다
  · application 에 후보를 내는가 — 도구 목록은 의사결정 활용을 말할 수 없다
  · 사람이 매긴 값을 조용히 덮어쓰는가 — 설문 반영과 같은 규칙이어야 한다
  · 근거 안 걸린 소식을 O·T 후보로 내는가 — 내면 후보 목록이 뉴스 피드가 된다
"""
import uuid as uuid_mod
from datetime import date, datetime, timedelta

import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_strategy import intel_link
from app.modules.digital_twin_strategy.models import StrategyAssessment, StrategyPlan
from app.modules.digital_twin_intel.models import (
    IntelDivisionStage, IntelEvidence, IntelNews, IntelTech,
)

STRATEGY_BASE = '/api/digital-twin-strategy'
YEAR = 2026


@pytest.fixture()
def office(make_user):
    return make_user('office@test.local', UserRole.DT_OFFICE_MEMBER)


@pytest.fixture()
def world(db):
    """진단 대상 사업부 둘 + 전략 하나."""
    from app.modules.digital_twin_dashboard.models import Division

    mx = Division(name='MX', is_kpi_owner=True, is_active=True, order=1)
    vd = Division(name='VD', is_kpi_owner=True, is_active=True, order=2)
    plan = StrategyPlan(year=YEAR, title=f'{YEAR}년 디지털 트윈 전략')
    _db.session.add_all([mx, vd, plan])
    _db.session.commit()
    return {'mx': mx, 'vd': vd, 'plan': plan, 'divisions': [mx, vd]}


def _cap(name, sector='데이터·연결'):
    cap = IntelTech(uuid=str(uuid_mod.uuid4()), name=name, kind='capability',
                    category=sector)
    _db.session.add(cap)
    _db.session.flush()
    return cap


def _mark(cap, division, stage, days_ago=0):
    """사업부 줄 — 인텔은 사업부를 이름으로 든다."""
    row = IntelDivisionStage(
        tech_uuid=cap.uuid, division=division.name, stage=stage,
        changed_at=datetime.utcnow() - timedelta(days=days_ago))
    _db.session.add(row)
    _db.session.flush()
    return row


# ── collect: 단계 → 후보 레벨 ──────────────────────────────────────────────

def test_단계_가중_평균이_후보_레벨이_된다(world):
    """도입(4)·시험(3)·시험(3) → 3.33 → 반올림 3."""
    for name, stage in [('a', '도입'), ('b', '시험'), ('c', '시험')]:
        _mark(_cap(name), world['mx'], stage)
    _db.session.commit()

    cells = intel_link.collect(world['divisions'])['cells']
    cell = next(c for c in cells
                if c['division_id'] == world['mx'].id and c['dimension'] == 'data')
    assert cell['suggested_level'] == 3
    assert cell['considered'] == 3
    assert cell['insufficient'] is None
    # 「무엇을 보고 이 레벨인가」 — 도입이 맨 앞이다
    assert cell['examples'][0] == 'a'


def test_표본이_얇으면_후보를_안_낸다(world):
    """역량 두 개의 단계로 차원 하나를 말하면 확대해석이다. 기본 하한은 3개다."""
    _mark(_cap('a'), world['mx'], '도입')
    _mark(_cap('b'), world['mx'], '도입')
    _cap('c')                             # 판에는 있지만 MX 가 안 적었다
    _db.session.commit()

    cell = next(c for c in intel_link.collect(world['divisions'])['cells']
                if c['division_id'] == world['mx'].id and c['dimension'] == 'data')
    assert cell['suggested_level'] is None
    assert '2개뿐' in cell['insufficient']

    # 하한은 ⚙설정이다 — 내리면 후보가 나온다
    cell = next(c for c in intel_link.collect(
        world['divisions'], {'intel_min_caps': 2})['cells']
                if c['division_id'] == world['mx'].id and c['dimension'] == 'data')
    assert cell['suggested_level'] == 4


def test_전부_도입이어도_5는_안_나온다(world):
    """폐루프(5)는 사람의 판단이다 — 도구를 들였다는 사실로는 4까지다."""
    for name in ['a', 'b', 'c']:
        _mark(_cap(name), world['mx'], '도입')
    _db.session.commit()

    cell = next(c for c in intel_link.collect(world['divisions'])['cells']
                if c['division_id'] == world['mx'].id and c['dimension'] == 'data')
    assert cell['suggested_level'] == 4


def test_application_차원에는_칸_자체가_없다(world):
    """도구 목록은 「의사결정에 쓰는가」를 말할 수 없다. 빈 것이 정직하다."""
    for name in ['a', 'b', 'c']:
        _mark(_cap(name), world['mx'], '도입')
    _db.session.commit()

    cells = intel_link.collect(world['divisions'])['cells']
    assert not [c for c in cells if c['dimension'] == 'application']


def test_보류는_평균에서_빠지고_기록으로는_센다(world):
    """보류는 수준이 아니라 판단이다. 평균에 넣으면 「그만두기로 했다」가
    레벨을 끌어내리는 값이 되고, 기록에서 빼면 들여다본 흔적이 사라진다."""
    _mark(_cap('a'), world['mx'], '도입')
    _mark(_cap('b'), world['mx'], '도입')
    _mark(_cap('c'), world['mx'], '도입')
    _mark(_cap('d'), world['mx'], '보류')
    _db.session.commit()

    got = intel_link.collect(world['divisions'])
    cell = next(c for c in got['cells']
                if c['division_id'] == world['mx'].id and c['dimension'] == 'data')
    assert cell['considered'] == 3        # 보류는 평균 밖
    assert cell['recorded'] == 4          # 기록으로는 남는다
    assert cell['suggested_level'] == 4
    row = next(r for r in got['divisions'] if r['division_id'] == world['mx'].id)
    assert row['recorded'] == 4


# ── 발견 사항 ──────────────────────────────────────────────────────────────

def test_전부_비었으면_전사_한_줄로_접는다(world):
    """전 사업부가 똑같이 비었으면 사업부 사정이 아니라 판 전체가 빈 것이다."""
    for name in ['a', 'b', 'c', 'd', 'e']:
        _cap(name)
    _db.session.commit()

    got = intel_link.collect(world['divisions'])
    findings = intel_link.derive_findings(got, world['divisions'])
    assert len(findings) == 1
    f = findings[0]
    assert f['key'] == 'intel_coverage:all'
    assert f['severity'] == 'high'
    assert f['division_id'] is None
    assert f['title'] and f['detail']     # 정렬이 title 을 요구한다


def test_일부만_낮으면_그_사업부만_지목한다(world):
    """MX 는 5개 중 3개(60%), VD 는 1개(20%) — VD 한 줄만 나와야 한다."""
    caps = [_cap(n) for n in ['a', 'b', 'c', 'd', 'e']]
    for cap in caps[:3]:
        _mark(cap, world['mx'], '도입')
    _mark(caps[0], world['vd'], '도입')
    _db.session.commit()

    findings = intel_link.derive_findings(
        intel_link.collect(world['divisions']), world['divisions'])
    coverage = [f for f in findings if f['key'].startswith('intel_coverage')]
    assert len(coverage) == 1
    assert coverage[0]['division_id'] == world['vd'].id
    assert coverage[0]['severity'] == 'medium'
    assert '기록률' in coverage[0]['title']


def test_낡은_근거_비율이_넘으면_말한다(world):
    """관찰(180일 기준)로 적고 200일 방치한 줄 둘 + 방금 적은 줄 하나 → 66.7%."""
    _mark(_cap('a'), world['mx'], '관찰', days_ago=200)
    _mark(_cap('b'), world['mx'], '관찰', days_ago=200)
    _mark(_cap('c'), world['mx'], '관찰')          # 방금 적었다 — 낡지 않았다
    _db.session.commit()

    findings = intel_link.derive_findings(
        intel_link.collect(world['divisions']), world['divisions'])
    stale = [f for f in findings if f['key'].startswith('intel_stale')]
    assert len(stale) == 1
    assert stale[0]['division_id'] == world['mx'].id
    assert stale[0]['evidence'] == {'stale': 2, 'recorded': 3}


# ── O·T 후보 ───────────────────────────────────────────────────────────────

def test_근거가_걸린_소식만_후보가_된다(world):
    cap = _cap('OpenUSD 파이프라인')
    linked = IntelNews(uuid=str(uuid_mod.uuid4()), title='OpenUSD ISO 표준화',
                       summary='산업 확대.', published_at=date.today())
    orphan = IntelNews(uuid=str(uuid_mod.uuid4()), title='근거 없는 소식',
                       published_at=date.today())
    _db.session.add_all([linked, orphan])
    _db.session.flush()
    _db.session.add(IntelEvidence(news_uuid=linked.uuid, tech_uuid=cap.uuid))
    _db.session.commit()

    out = intel_link.derive_element_candidates()
    assert [c['key'] for c in out] == [f'intel_news:{linked.uuid}']
    c = out[0]
    assert c['kind'] == 'O'               # 기회/위협 판단은 승격하는 사람 몫
    assert c['source_type'] == 'intel'
    assert 'OpenUSD 파이프라인' in c['detail']
    assert 'T 로 바꾸세요' in c['detail']


# ── apply-intel: 반영 ──────────────────────────────────────────────────────

def _apply(client, office, auth, cells, **extra):
    return client.post(f'{STRATEGY_BASE}/plans/{YEAR}/assessments/apply-intel',
                       json={'cells': cells, **extra}, headers=auth(office))


def _three_caps_at_도입(world):
    for name in ['a', 'b', 'c']:
        _mark(_cap(name), world['mx'], '도입')
    _db.session.commit()


def test_반영하면_auto_근거와_이전_값이_남는다(client, world, office, auth):
    _three_caps_at_도입(world)
    res = _apply(client, office, auth,
                 [{'division_id': world['mx'].id, 'dimension': 'data'}])
    assert res.status_code == 200, res.get_json()
    data = res.get_json()['data']
    assert [a['level'] for a in data['applied']] == [4]
    assert data['skipped'] == []

    saved = StrategyAssessment.query.filter_by(
        division_id=world['mx'].id, dimension='data').one()
    assert saved.current_level == 4
    assert saved.basis == 'auto'
    assert '기술 레이더 반영' in saved.note
    assert '역량 3개' in saved.note


def test_사람이_매긴_칸은_건너뛴다(client, world, office, auth):
    """설문 반영과 같은 규칙이다 — 갈리면 「왜 설문은 안 덮는데 인텔은 덮지?」."""
    _three_caps_at_도입(world)
    _db.session.add(StrategyAssessment(
        plan_id=world['plan'].id, division_id=world['mx'].id,
        category='technical', dimension='data', current_level=2, basis='manual'))
    _db.session.commit()

    res = _apply(client, office, auth,
                 [{'division_id': world['mx'].id, 'dimension': 'data'}])
    data = res.get_json()['data']
    assert data['applied'] == []
    assert '사람이 매긴 값(2)' in data['skipped'][0]['reason']
    saved = StrategyAssessment.query.filter_by(
        division_id=world['mx'].id, dimension='data').one()
    assert saved.current_level == 2 and saved.basis == 'manual'

    # 명시하고 덮으면 — 이전 값이 자취로 남는다
    res = _apply(client, office, auth,
                 [{'division_id': world['mx'].id, 'dimension': 'data'}],
                 overwrite_manual=True)
    assert res.get_json()['data']['applied']
    saved = StrategyAssessment.query.filter_by(
        division_id=world['mx'].id, dimension='data').one()
    assert saved.basis == 'auto'
    assert '이전 값 2' in saved.note


def test_후보_없는_칸은_반영을_거절한다(client, world, office, auth):
    _three_caps_at_도입(world)
    res = _apply(client, office, auth, [
        {'division_id': world['mx'].id, 'dimension': 'model'},        # 표본 부족
        {'division_id': world['mx'].id, 'dimension': 'application'},  # 칸 없음
    ])
    data = res.get_json()['data']
    assert data['applied'] == []
    reasons = [s['reason'] for s in data['skipped']]
    assert '0개뿐' in reasons[0]
    assert reasons[1] == '그 칸에는 후보가 없습니다.'


# ── 조회 배선 ──────────────────────────────────────────────────────────────

def test_조회에_인텔_근거와_발견_사항이_실려_나온다(client, world, office, auth):
    _three_caps_at_도입(world)
    res = client.get(f'{STRATEGY_BASE}/plans/{YEAR}', headers=auth(office))
    assert res.status_code == 200, res.get_json()
    data = res.get_json()['data']
    assert data['intelError'] is None
    cell = next(c for c in data['intelEvidence']['cells']
                if c['division_id'] == world['mx'].id and c['dimension'] == 'data')
    assert cell['suggested_level'] == 4
    assert 'current_level' in cell        # 지금 값이 옆에 붙는다
    assert any(f['key'].startswith('intel_') for f in data['findings'])
