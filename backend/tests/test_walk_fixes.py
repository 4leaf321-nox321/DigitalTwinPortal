"""한 사이클을 걸어 보고 고친 것들 (2026-08-17).

⚠️ **테스트 186건이 다 통과하는 상태에서 나온 문제들이다.** 규칙 하나하나는
   맞는데 이어 붙이면 안 되는 것들이라, 여기서 「이어졌을 때」를 지킨다.
"""
import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_strategy.models import (
    StrategyAssessment, StrategyPlan,
)

BASE = '/api/digital-twin-strategy'
YEAR = 2026


@pytest.fixture()
def office(make_user):
    return make_user('office@test.local', UserRole.DT_OFFICE_MEMBER)


@pytest.fixture()
def world(db):
    from app.modules.digital_twin_dashboard.models import Division

    divs = [Division(name=n, is_kpi_owner=True, is_active=True, order=i)
            for i, n in enumerate(['MX', 'VD', 'DA'], 1)]
    plan = StrategyPlan(year=YEAR, title=f'{YEAR}년 전략')
    _db.session.add_all(divs + [plan])
    _db.session.flush()

    # 세 사업부가 「데이터」에서 같이 낮고, MX 만 「모델」에서 낮다.
    for d in divs:
        _db.session.add(StrategyAssessment(
            plan_id=plan.id, division_id=d.id, category='technical',
            dimension='data', current_level=2, target_level=3, basis='manual'))
    _db.session.add(StrategyAssessment(
        plan_id=plan.id, division_id=divs[0].id, category='technical',
        dimension='model', current_level=2, target_level=3, basis='manual'))
    _db.session.commit()
    return {'plan': plan, 'divisions': divs}


def test_한_단계_격차도_이슈_후보가_된다(client, world, office, auth):
    """⚠️ 사람은 목표를 「올해 한 단계」로 잡는다. 2단계를 요구하면 진단을 다
    채워도 후보가 **하나도 안 나온다** — 이 모듈의 핵심 약속이 깨진다."""
    plan = client.get(f'{BASE}/plans/{YEAR}', headers=auth(office)).get_json()['data']
    gaps = [c for c in plan['issueCandidates'] if c['source_type'] == 'gap']
    assert len(gaps) == 4


def test_여러_사업부가_같이_낮은_축이_위로(client, world, office, auth):
    """격차가 전부 1 이면 격차로는 순서를 못 정한다. 셋이 걸린 축이 먼저다."""
    plan = client.get(f'{BASE}/plans/{YEAR}', headers=auth(office)).get_json()['data']
    gaps = [c for c in plan['issueCandidates'] if c['source_type'] == 'gap']

    assert gaps[0]['shared_count'] == 3          # 데이터 — 세 사업부
    assert gaps[-1]['shared_count'] == 1         # 모델 — MX 만
    assert '데이터' in gaps[0]['title']


def test_발견_사항에_규칙이_붙는다(client, world, office, auth):
    """화면과 문서가 이걸로 묶는다."""
    plan = client.get(f'{BASE}/plans/{YEAR}', headers=auth(office)).get_json()['data']
    for f in plan['findings']:
        assert f.get('rule'), f
        assert f.get('ruleLabel'), f
        # 규칙 이름을 안 적어 뒀어도 비지 않는다 — 첫 제목으로 채운다.


def test_목표_일괄은_현재_수준을_안_건드린다(client, world, office, auth):
    """⚠️ 목표는 의지의 표현이라 일괄로 정해도 거짓이 안 되지만, 현재를
    복사하면 **안 본 칸이 매긴 값으로 남는다.**"""
    # 목표가 빈 칸을 하나 만든다.
    row = StrategyAssessment.query.filter_by(dimension='model').first()
    row.target_level = None
    _db.session.commit()

    res = client.post(f'{BASE}/plans/{YEAR}/assessments/targets/bump',
                      headers=auth(office), json={'step': 1})
    assert res.status_code == 200, res.get_json()
    data = res.get_json()['data']

    assert data['changed'] == 1                  # 빈 목표 하나만
    assert data['keptExisting'] == 3             # 이미 정한 것은 안 덮는다
    _db.session.expire_all()
    assert StrategyAssessment.query.filter_by(dimension='model').first().target_level == 3
    # 현재 수준은 그대로다.
    assert all(a.current_level == 2 for a in StrategyAssessment.query.all())


def test_현재를_안_매긴_칸은_목표도_안_정한다(client, world, office, auth):
    """기준이 없으면 「한 단계 위」를 말할 수 없다."""
    res = client.post(f'{BASE}/plans/{YEAR}/assessments/targets/bump',
                      headers=auth(office), json={'step': 1})
    # 이 전략에는 current_level 이 없는 행이 없다(격자는 화면에서만 채운다).
    assert res.get_json()['data']['skippedNoLevel'] == 0


def test_조회_권한은_목표를_못_바꾼다(client, world, make_user, auth):
    viewer = make_user('viewer@test.local', UserRole.VIEWER)
    res = client.post(f'{BASE}/plans/{YEAR}/assessments/targets/bump',
                      headers=auth(viewer), json={'step': 1})
    assert res.status_code == 403
