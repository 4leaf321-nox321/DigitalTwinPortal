"""③ 분석 — 전략 요소 테스트.

**여기서 지키는 것은 근거의 무게다.**

  · S·W 는 진단에서 후보가 나오지만 O·T 는 나오지 않는다 — 포탈에 없는 정보를
    규칙이 만들어내면 그건 근거가 아니라 창작이다
  · 자동으로 승격하지 않는다 — 그러면 이 칸이 발견 사항의 복사본이 되고,
    ④ TOWS 에서 조합할 것이 없어진다
"""
import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_strategy.models import (
    StrategyAssessment, StrategyElement, StrategyPlan,
)

BASE = '/api/digital-twin-strategy'
YEAR = 2026


@pytest.fixture()
def office(make_user):
    return make_user('office@test.local', UserRole.DT_OFFICE_MEMBER)


@pytest.fixture()
def world(db):
    from app.modules.digital_twin_dashboard.models import Division

    mx = Division(name='MX', is_kpi_owner=True, is_active=True, order=1)
    vd = Division(name='VD', is_kpi_owner=True, is_active=True, order=2)
    plan = StrategyPlan(year=YEAR, title=f'{YEAR}년 전략')
    _db.session.add_all([mx, vd, plan])
    _db.session.commit()
    return {'mx': mx, 'vd': vd, 'plan': plan}


def _plan(client, office, auth):
    res = client.get(f'{BASE}/plans/{YEAR}', headers=auth(office))
    assert res.status_code == 200, res.get_json()
    return res.get_json()['data']


def _grade(world, division, dimension, level):
    _db.session.add(StrategyAssessment(
        plan_id=world['plan'].id, division_id=division.id,
        category='organization', dimension=dimension,
        current_level=level, basis='manual'))
    _db.session.commit()


def test_진단의_양_끝이_강점과_약점_후보가_된다(client, world, office, auth):
    _grade(world, world['mx'], 'readiness', 5)     # 강점
    _grade(world, world['vd'], 'return', 1)        # 약점
    _grade(world, world['mx'], 'role', 3)          # 가운데 — 후보가 아니다

    candidates = _plan(client, office, auth)['elementCandidates']
    kinds = {c['kind'] for c in candidates}
    assert 'S' in kinds and 'W' in kinds

    strong = [c for c in candidates if c['kind'] == 'S']
    assert any('MX' in c['title'] and '준비도' in c['title'] for c in strong)
    # 3단계는 강점도 약점도 아니다.
    assert not any('역할' in c['title'] for c in candidates)


def test_기회와_위협은_후보를_만들지_않는다(client, world, office, auth):
    """⚠️ 포탈에 없는 정보를 규칙이 지어내면 그건 근거가 아니라 창작이다.
    그 자리는 설문이 메운다(ANALYSIS_PLAN 3절)."""
    _grade(world, world['mx'], 'readiness', 5)
    _grade(world, world['vd'], 'return', 1)

    candidates = _plan(client, office, auth)['elementCandidates']
    assert {c['kind'] for c in candidates} <= {'S', 'W'}


def test_후보는_자동으로_요소가_되지_않는다(client, world, office, auth):
    """자동으로 옮기면 이 칸이 발견 사항의 복사본이 되고, ④ TOWS 에서 조합할
    것이 없어진다."""
    _grade(world, world['mx'], 'readiness', 5)

    data = _plan(client, office, auth)
    assert len(data['elementCandidates']) > 0
    assert data['elements'] == []          # ← 요점


def test_승격한_후보는_목록에서_빠진다(client, world, office, auth):
    """안 빼면 같은 것이 계속 남아, 무엇을 아직 안 봤는지 읽을 수 없다."""
    _grade(world, world['mx'], 'readiness', 5)
    candidate = _plan(client, office, auth)['elementCandidates'][0]

    res = client.post(f'{BASE}/plans/{YEAR}/elements', headers=auth(office),
                      json={'kind': candidate['kind'], 'title': candidate['title'],
                            'detail': candidate['detail'],
                            'division_id': candidate['division_id'],
                            'source_type': candidate['source_type'],
                            'source_ref': candidate['key']})
    assert res.status_code == 201, res.get_json()

    after = _plan(client, office, auth)
    assert len(after['elements']) == 1
    assert candidate['key'] not in {c['key'] for c in after['elementCandidates']}


def test_빈_칸을_세지만_틀렸다고_하지_않는다(client, world, office, auth):
    """⚠️ 특히 O·T 는 설문을 돌리기 전에는 빌 수밖에 없다. ④ TOWS 가 어느 조합을
    못 만드는지만 말해 준다."""
    client.post(f'{BASE}/plans/{YEAR}/elements', headers=auth(office),
                json={'kind': 'S', 'title': 'CAE 해석 역량'})

    summary = _plan(client, office, auth)['elementSummary']
    assert summary['counts'] == {'S': 1, 'W': 0, 'O': 0, 'T': 0}
    assert set(summary['emptyKinds']) == {'W', 'O', 'T'}


def test_알_수_없는_구분은_거절한다(client, world, office, auth):
    res = client.post(f'{BASE}/plans/{YEAR}/elements', headers=auth(office),
                      json={'kind': 'X', 'title': '아무거나'})
    assert res.status_code == 400
    assert 'S·W·O·T' in res.get_json()['message']
    assert StrategyElement.query.count() == 0
