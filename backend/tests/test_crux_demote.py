"""난제를 이슈로 내리기 — 올린 것을 되돌리는 길.

⚠️ **이 길이 없으면 잘못 올린 난제를 지우는 수밖에 없다.** 한 사이클을 실제로
   돌려 보니 난제 열 개 중 여덟이 이슈 0건이었다(2026-08-17). 관측 문장이 난제
   자리에 올라가 있었고, 그것들이 갈 곳은 삭제가 아니라 **다른 난제 아래의
   이슈**였다.
"""
import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_strategy.models import (
    StrategyCrux, StrategyIssue, StrategyPlan,
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
    plan = StrategyPlan(year=YEAR, title=f'{YEAR}년 전략')
    _db.session.add_all([mx, plan])
    _db.session.flush()

    keep = StrategyCrux(plan_id=plan.id, title='데이터가 안 쌓인다')
    wrong = StrategyCrux(plan_id=plan.id, division_id=mx.id,
                         title='NW 과제 55.0% 가 성과를 정의하지 않았습니다',
                         rationale='관측입니다',
                         source_finding='gap_performance:4')
    _db.session.add_all([keep, wrong])
    _db.session.flush()

    child = StrategyIssue(plan_id=plan.id, crux_id=wrong.id,
                          title='딸려 있던 이슈', source_type='manual')
    _db.session.add(child)
    _db.session.commit()
    return {'plan': plan, 'keep': keep, 'wrong': wrong, 'child': child}


def test_난제가_이슈가_된다(client, world, office, auth):
    res = client.post(
        f"{BASE}/plans/{YEAR}/cruxes/{world['wrong'].id}/demote",
        headers=auth(office), json={'crux_id': world['keep'].id})
    assert res.status_code == 200, res.get_json()

    assert StrategyCrux.query.count() == 1          # 잘못 올린 것이 사라짐
    moved = StrategyIssue.query.filter_by(
        title='NW 과제 55.0% 가 성과를 정의하지 않았습니다').one()
    assert moved.crux_id == world['keep'].id
    # 근거는 설명으로 내려간다 — 왜 이것을 다루기로 했는지가 거기 있다.
    assert moved.description == '관측입니다'
    assert moved.source_type == 'crux'
    assert moved.division_id == world['wrong'].division_id


def test_딸린_이슈도_같이_옮긴다(client, world, office, auth):
    """⚠️ 안 옮기면 고아가 된다 — 화면이 빨갛게 경고하는 그 상태를, 정리하려다
    만들게 된다."""
    res = client.post(
        f"{BASE}/plans/{YEAR}/cruxes/{world['wrong'].id}/demote",
        headers=auth(office), json={'crux_id': world['keep'].id})
    assert res.get_json()['data']['movedChildren'] == 1

    _db.session.expire_all()
    assert StrategyIssue.query.get(world['child'].id).crux_id == world['keep'].id


def test_난제를_안_고르면_고아가_된다(client, world, office, auth):
    """막지 않는다. 화면이 고아 이슈를 이미 드러내고, 거기서 묶을 수 있다."""
    res = client.post(
        f"{BASE}/plans/{YEAR}/cruxes/{world['wrong'].id}/demote",
        headers=auth(office), json={})
    assert res.status_code == 200, res.get_json()

    _db.session.expire_all()
    assert all(i.crux_id is None for i in StrategyIssue.query.all())


def test_자기_자신_아래로는_못_내린다(client, world, office, auth):
    res = client.post(
        f"{BASE}/plans/{YEAR}/cruxes/{world['wrong'].id}/demote",
        headers=auth(office), json={'crux_id': world['wrong'].id})
    assert res.status_code == 400
    assert '자기 자신' in res.get_json()['message']


def test_남의_전략_난제로는_못_옮긴다(client, world, office, auth):
    other = StrategyPlan(year=YEAR + 1, title='다음 해')
    _db.session.add(other)
    _db.session.flush()
    stranger = StrategyCrux(plan_id=other.id, title='남의 난제')
    _db.session.add(stranger)
    _db.session.commit()

    res = client.post(
        f"{BASE}/plans/{YEAR}/cruxes/{world['wrong'].id}/demote",
        headers=auth(office), json={'crux_id': stranger.id})
    assert res.status_code == 404


def test_실패하면_아무것도_안_바뀐다(client, world, office, auth):
    """⚠️ 한 트랜잭션이다. 난제만 지워지고 이슈가 안 생기면 사람이 판단한 것이
    조용히 사라진다."""
    before_cruxes = StrategyCrux.query.count()
    before_issues = StrategyIssue.query.count()

    client.post(f"{BASE}/plans/{YEAR}/cruxes/{world['wrong'].id}/demote",
                headers=auth(office), json={'crux_id': 999999})

    assert StrategyCrux.query.count() == before_cruxes
    assert StrategyIssue.query.count() == before_issues


def test_조회_권한은_못_내린다(client, world, make_user, auth):
    viewer = make_user('viewer@test.local', UserRole.VIEWER)
    res = client.post(
        f"{BASE}/plans/{YEAR}/cruxes/{world['wrong'].id}/demote",
        headers=auth(viewer), json={})
    assert res.status_code == 403
