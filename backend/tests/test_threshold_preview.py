"""⚙ 임계값 미리보기.

임계값 스물한 개가 **전부 짐작**이다. 조정 도구가 없으면 조정이 안 일어난다.

⚠️ **여기서 지키는 것은 「미리보기가 화면과 같은 규칙을 쓴다」이다.** 따로
   계산하면 미리보기와 진단 화면이 다른 숫자를 말하는 날이 온다.
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

    mx = Division(name='MX', is_kpi_owner=True, is_active=True, order=1)
    plan = StrategyPlan(year=YEAR, title=f'{YEAR}년 전략')
    _db.session.add_all([mx, plan])
    _db.session.flush()

    # 조직 역량을 낮게 매겨 둔다 — 약점 후보가 나와야 곡선이 움직인다.
    for dimension, level in (('readiness', 2), ('role', 3), ('return', 1)):
        _db.session.add(StrategyAssessment(
            plan_id=plan.id, division_id=mx.id, category='organization',
            dimension=dimension, current_level=level, basis='manual'))
    _db.session.commit()
    return {'mx': mx, 'plan': plan}


def test_지금_몇_건인지_알려준다(client, world, office, auth):
    res = client.get(f'{BASE}/plans/{YEAR}/thresholds/preview',
                     headers=auth(office))
    assert res.status_code == 200, res.get_json()
    base = res.get_json()['data']['base']
    assert set(base) == {'findings', 'issueCandidates',
                         'elementCandidates', 'nowSolutions'}
    assert all(isinstance(v, int) for v in base.values())


def test_미리보기가_화면과_같은_숫자를_말한다(client, world, office, auth):
    """⚠️ **이것이 이 기능의 요점이다.** 규칙을 따로 구현했으면 여기서 갈린다."""
    base = client.get(f'{BASE}/plans/{YEAR}/thresholds/preview',
                      headers=auth(office)).get_json()['data']['base']
    plan = client.get(f'{BASE}/plans/{YEAR}',
                      headers=auth(office)).get_json()['data']

    assert base['findings'] == len(plan['findings'])
    assert base['elementCandidates'] == len(plan['elementCandidates'])


def test_값_하나를_범위_전체로_훑는다(client, world, office, auth):
    res = client.get(f'{BASE}/plans/{YEAR}/thresholds/preview'
                     f'?key=element_weak_at', headers=auth(office))
    assert res.status_code == 200, res.get_json()
    curve = res.get_json()['data']

    assert curve['key'] == 'element_weak_at'
    assert curve['counts'] == 'elementCandidates'
    assert 2 <= len(curve['points']) <= 9
    # 지금 값이 반드시 들어 있어야 비교가 된다.
    assert curve['now'] in [p['value'] for p in curve['points']]
    # 레벨은 1부터다. 0단계는 뜻이 없다.
    assert min(p['value'] for p in curve['points']) >= 1


def test_약점_기준을_올리면_후보가_는다(client, world, office, auth):
    """진단 레벨 1·2·3 을 매겨 뒀다. 기준을 올릴수록 약점 후보가 늘어야 한다."""
    curve = client.get(f'{BASE}/plans/{YEAR}/thresholds/preview'
                       f'?key=element_weak_at',
                       headers=auth(office)).get_json()['data']
    counts = [p['count'] for p in sorted(curve['points'],
                                         key=lambda p: p['value'])]
    assert counts == sorted(counts), f'단조롭지 않습니다: {counts}'
    assert counts[-1] > counts[0]
    assert curve['flat'] is False


def test_아무_일도_안_하는_값은_그렇다고_말한다(client, world, office, auth):
    """⚠️ **이걸 안 알려주면 사람은 값을 계속 만지며 시간을 쓴다.**

    설문이 없으니 설문 임계값은 무엇으로 두든 건수가 그대로다.
    """
    curve = client.get(f'{BASE}/plans/{YEAR}/thresholds/preview'
                       f'?key=survey_role_gap',
                       headers=auth(office)).get_json()['data']
    assert curve['flat'] is True


def test_모르는_값은_거절한다(client, world, office, auth):
    res = client.get(f'{BASE}/plans/{YEAR}/thresholds/preview?key=없는값',
                     headers=auth(office))
    assert res.status_code == 400
    assert '알 수 없는 임계값' in res.get_json()['message']


def test_조회_권한만으로는_못_본다(client, world, make_user, auth):
    """바꿀 수 없는 사람에게 「낮추면 몇 건」을 보여 줄 이유가 없다."""
    viewer = make_user('viewer@test.local', UserRole.VIEWER)
    res = client.get(f'{BASE}/plans/{YEAR}/thresholds/preview',
                     headers=auth(viewer))
    assert res.status_code == 403


def test_근거_원천을_한_번만_읽는다(client, world, office, auth):
    """⚠️ 곡선 하나에 아홉 번 다시 계산한다. 과제 목록을 아홉 번 읽으면
    설정 화면이 그만큼 멈춘다."""
    from app.modules.digital_twin_strategy import threshold_preview as tp

    calls = {'projects': 0}

    class Counting:
        mode = 'fixture'

        def get_projects(self, year):
            calls['projects'] += 1
            return []

        def get_kpis(self, year):
            return []

    once = tp._ReadOnce(Counting())
    for _ in range(9):
        once.get_projects(YEAR)
    assert calls['projects'] == 1
