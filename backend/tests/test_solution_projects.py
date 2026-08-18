"""솔루션 ↔ 과제 연결 — 전략과 실행이 닫히는 자리.

**지표 연결만으로는 폐루프가 안 닫힌다.** "가상검증률을 올리겠다"는 겨냥이고,
그것을 **누가 무엇으로 하는가**는 과제다.

  · 없는 과제에는 못 건다 — 하고 있는 것처럼 보이면 안 된다
  · 과제가 지워져도 솔루션은 남는다 — 근거가 사라진 것이지 틀린 것이 아니다
  · 「어느 솔루션에도 안 걸린 과제」를 ① 진단이 짚는다
"""
import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_strategy.models import (
    StrategyPlan, StrategySolution,
)

BASE = '/api/digital-twin-strategy'
YEAR = 2026


@pytest.fixture()
def office(make_user):
    return make_user('office@test.local', UserRole.DT_OFFICE_MEMBER)


@pytest.fixture(autouse=True)
def local_source(app, monkeypatch):
    """근거 원천을 **시험이 직접 정한다.**

    ⚠️ 기본값은 fixture 이고, 합성 과제에는 uuid 가 없어 「전략 미연결」 규칙이
       아무것도 안 짚는다(그건 규칙이 의도한 동작이다). 그러면 짚어야 할 때를
       보는 시험은 실패하고, **안 짚어야 할 때를 보는 시험은 틀린 이유로
       통과한다** — 뒤쪽이 더 나쁘다. 규칙을 통째로 지워도 초록으로 남는다.

    ⚠️ 개발자 .env 에 STRATEGY_EVIDENCE_SOURCE=local 이 있어 로컬에서는 통과하고
       CI 에서만 깨졌다. **추적되지 않는 파일에 기댄 시험은 시험이 아니다.**
    """
    monkeypatch.setitem(app.config, 'STRATEGY_EVIDENCE_SOURCE', 'local')


@pytest.fixture()
def world(db):
    from app.modules.digital_twin_dashboard.models import Division
    from app.modules.digital_twin_dashboard.models_v2 import Dt2Project

    mx = Division(name='MX', is_kpi_owner=True, is_active=True, order=1)
    plan = StrategyPlan(year=YEAR, title=f'{YEAR}년 전략')
    _db.session.add_all([mx, plan])
    _db.session.flush()

    projects = [
        Dt2Project(uuid=f'p-{i}', code=f'MX-{i}', title=f'과제 {i}',
                   division='MX', division_id=mx.id, year=YEAR, status='진행')
        for i in range(1, 6)
    ]
    # 다른 해의 과제. 검색어 없이는 안 나와야 한다.
    old = Dt2Project(uuid='p-old', code='MX-0', title='작년 과제',
                     division='MX', division_id=mx.id, year=YEAR - 1)
    _db.session.add_all(projects + [old])
    _db.session.commit()
    return {'mx': mx, 'plan': plan, 'projects': projects, 'old': old}


def _solution(client, office, auth, **kw):
    payload = {'tows': 'SO', 'title': '가상검증 확대', **kw}
    res = client.post(f'{BASE}/plans/{YEAR}/solutions', headers=auth(office),
                      json=payload)
    assert res.status_code == 201, res.get_json()
    return res.get_json()['data']['id']


def _plan(client, office, auth):
    res = client.get(f'{BASE}/plans/{YEAR}', headers=auth(office))
    assert res.status_code == 200, res.get_json()
    return res.get_json()['data']


def test_과제를_걸_수_있다(client, world, office, auth):
    sid = _solution(client, office, auth, project_uuids=['p-1', 'p-2'])
    assert StrategySolution.query.get(sid).project_uuids == ['p-1', 'p-2']

    plan = _plan(client, office, auth)
    assert plan['solutions'][0]['project_uuids'] == ['p-1', 'p-2']
    # 화면이 uuid 대신 이름을 보여줄 수 있어야 한다.
    assert plan['linkedProjects']['p-1']['title'] == '과제 1'
    assert plan['linkedProjects']['p-1']['code'] == 'MX-1'


def test_없는_과제에는_못_건다(client, world, office, auth):
    """⚠️ 걸어 두면 그 솔루션은 아무것도 안 하는 것과 같은데 하고 있는 것처럼
    보인다."""
    res = client.post(f'{BASE}/plans/{YEAR}/solutions', headers=auth(office),
                      json={'tows': 'SO', 'title': '수',
                            'project_uuids': ['p-1', 'p-없음']})
    assert res.status_code == 400
    assert '없는 과제입니다' in res.get_json()['message']
    assert StrategySolution.query.count() == 0


def test_과제가_지워져도_솔루션은_남는다(client, world, office, auth):
    """근거가 사라진 것이지 솔루션이 틀린 것이 아니다(전략 요소와 같은 규칙)."""
    from app.modules.digital_twin_dashboard.models_v2 import Dt2Project

    sid = _solution(client, office, auth, project_uuids=['p-1'])
    Dt2Project.query.filter_by(uuid='p-1').delete()
    _db.session.commit()

    plan = _plan(client, office, auth)
    assert plan['solutions'][0]['title'] == '가상검증 확대'
    assert StrategySolution.query.get(sid).project_uuids == ['p-1']
    # 화면은 못 찾는 것을 조용히 뺀다 — 없는 것을 있는 척하지 않는다.
    assert 'p-1' not in plan['linkedProjects']


def test_검색어가_없으면_그_해_사업부부터(client, world, office, auth):
    """고를 것이 그 사업부 안에 있을 확률이 높다. 200줄을 훑게 하지 않는다."""
    res = client.get(f'{BASE}/plans/{YEAR}/projects?division_id={world["mx"].id}',
                     headers=auth(office))
    assert res.status_code == 200, res.get_json()
    uuids = {p['uuid'] for p in res.get_json()['data']['items']}
    assert 'p-1' in uuids
    assert 'p-old' not in uuids            # 다른 해


def test_검색하면_범위를_넘어_찾는다(client, world, office, auth):
    """연도를 걸치는 과제가 있다. 찾으러 온 사람을 막지 않는다."""
    res = client.get(f'{BASE}/plans/{YEAR}/projects?q=작년', headers=auth(office))
    assert [p['uuid'] for p in res.get_json()['data']['items']] == ['p-old']


def test_안_잘렸으면_안_잘렸다고_말한다(client, world, office, auth):
    data = client.get(f'{BASE}/plans/{YEAR}/projects',
                      headers=auth(office)).get_json()['data']
    assert data['truncated'] is False
    assert data['total'] == len(data['items'])


def test_잘랐으면_잘랐다고_말한다(client, world, office, auth, monkeypatch):
    """⚠️ 조용히 상한에서 끊으면 **찾던 과제가 없는 것과 구별이 안 된다.**

    개발 DB 실측으로 한 해가 220여 건이라 상한(300)에 잘 안 닿지만, 닿았을 때
    말해 주지 않으면 사람은 목록에 없다고 믿고 포기한다.
    """
    from app.modules.digital_twin_strategy import routes

    monkeypatch.setattr(routes, 'PROJECT_SEARCH_LIMIT', 2)
    data = client.get(f'{BASE}/plans/{YEAR}/projects',
                      headers=auth(office)).get_json()['data']

    assert len(data['items']) == 2
    assert data['total'] == 5              # 그 해 과제 전부
    assert data['truncated'] is True       # 자른 사실이 응답에 있다


def test_전략에_안_걸린_과제를_진단이_짚는다(client, world, office, auth):
    """⚠️ ① 의 「KPI 미연결 과제」와 **다른 것**을 본다.

        KPI 미연결   과제가 무엇을 올리려는지 안 적혔다   (과제 쪽 문제)
        전략 미연결  전략이 그 과제를 자기 것이라 안 했다 (전략 쪽 문제)
    """
    # 다섯 중 하나만 건다 → 80% 미연결. 기본 임계값 70% 를 넘는다.
    _solution(client, office, auth, project_uuids=['p-1'])

    keys = {f['key'] for f in _plan(client, office, auth)['findings']}
    assert any(k.startswith('strategy_unlinked') for k in keys)


def test_다_걸면_안_짚는다(client, world, office, auth):
    _solution(client, office, auth,
              project_uuids=[p.uuid for p in world['projects']])

    keys = {f['key'] for f in _plan(client, office, auth)['findings']}
    assert not any(k.startswith('strategy_unlinked') for k in keys)


def test_솔루션이_없으면_안_짚는다(client, world, office, auth):
    """④ 를 채우기 전에는 전부 미연결이라, 짚어 봐야 "아직 시작 안 했다"는
    말밖에 안 된다."""
    keys = {f['key'] for f in _plan(client, office, auth)['findings']}
    assert not any(k.startswith('strategy_unlinked') for k in keys)


def test_요약_장이_먼저_할_일과_빈_장을_싣는다(client, world, office, auth):
    """⚠️ 임원은 첫 장만 본다. 그리고 **비었다는 사실도 첫 장에 적는다.**"""
    from app.modules.digital_twin_strategy.models import StrategyCrux

    _db.session.add(StrategyCrux(plan_id=world['plan'].id,
                                 title='데이터가 안 쌓인다'))
    _db.session.commit()
    _solution(client, office, auth, impact=5, feasibility=4,
              project_uuids=['p-1'])

    res = client.get(f'{BASE}/plans/{YEAR}/document', headers=auth(office))
    assert res.status_code == 200, res.get_json()
    doc = res.get_json()['data']

    head = doc['sections'][0]
    assert head['key'] == 'summary' and head['title'] == '0. 한 장 요약'
    dump = str(head['blocks'])
    assert '넘으려는 것' in dump and '데이터가 안 쌓인다' in dump
    assert '먼저 할 일' in dump and '가상검증 확대' in dump
    assert '과제 1건' in dump            # 실행으로 이어졌는지가 요약에 보인다
    assert '아직 비어 있음' in dump      # 검토 안 한 장을 첫 장에서 알린다
    # 자기 자신을 「비어 있음」으로 세지 않는다.
    assert '0. 한 장 요약' not in dump


def test_먼저_할_일이_과제로_안_이어지면_보인다(client, world, office, auth):
    _solution(client, office, auth, impact=5, feasibility=5)

    res = client.get(f'{BASE}/plans/{YEAR}/document', headers=auth(office))
    assert '과제 없음' in str(res.get_json()['data']['sections'][0]['blocks'])
