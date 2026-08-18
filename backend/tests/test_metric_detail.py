"""관측값을 풀어 보기 — 「62.5%」가 어느 과제인지 말해 준다.

숫자만 보여주는 진단은 읽고 끝난다. 사람이 다음 행동으로 가려면 그 비율이 어느
과제들인지 알아야 한다.

  · 셈법과 분자·분모를 말한다 — 무엇을 무엇으로 나눴는가
  · 그 수를 만든 과제를 목록으로 낸다
  · **세는 단위가 과제가 아닌 지표**가 있다(연결 등급) — 그것을 밝힌다
"""
import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_strategy.models import StrategyPlan

BASE = '/api/digital-twin-strategy'
YEAR = 2026


@pytest.fixture()
def office(make_user):
    return make_user('office@test.local', UserRole.DT_OFFICE_MEMBER)


@pytest.fixture(autouse=True)
def local_source(app, monkeypatch):
    """합성 과제에는 uuid·부서가 없어 풀어 볼 것이 없다. 진짜 원천으로 본다."""
    monkeypatch.setitem(app.config, 'STRATEGY_EVIDENCE_SOURCE', 'local')


@pytest.fixture()
def world(db):
    from app.modules.digital_twin_dashboard.models import Division
    from app.modules.digital_twin_dashboard.models_v2 import (
        Dt2Project, Dt2ProjectKpi,
    )
    from app.modules.dx_kpi_management.models import KpiDefinition

    mx = Division(name='MX', is_kpi_owner=True, is_active=True, order=1)
    plan = StrategyPlan(year=YEAR, title=f'{YEAR}년 전략')
    kpi = KpiDefinition(label='가상검증률', category='활용', unit='%')
    _db.session.add_all([mx, plan, kpi])
    _db.session.flush()

    # 넷 중 하나만 KPI 에 건다 → 미연결 75%.
    projects = []
    for i in range(1, 5):
        p = Dt2Project(uuid=f'p-{i}', code=f'MX-{i}', title=f'과제 {i}',
                       division='MX', division_id=mx.id, year=YEAR,
                       status='진행', pl_name='홍길동' if i < 4 else '김철수',
                       depts_json=['CAE그룹'] if i < 3 else ['사무국'])
        projects.append(p)
    _db.session.add_all(projects)
    _db.session.flush()
    # ⚠️ 연결은 (지표 × 사업부) 단위다 — 'MX 의 가상검증률' 과 'VD 의 가상검증률'
    #    은 다른 숫자라 대상을 지목해야 한다(Dt2ProjectKpi 주석).
    _db.session.add(Dt2ProjectKpi(project_uuid='p-1', kpi_definition_id=kpi.id,
                                  target_division='MX', relation_type='primary'))
    _db.session.commit()
    return {'mx': mx, 'plan': plan}


def _get(client, office, auth, key, **params):
    q = '&'.join(f'{k}={v}' for k, v in params.items())
    res = client.get(f'{BASE}/plans/{YEAR}/metrics/{key}/detail'
                     + (f'?{q}' if q else ''), headers=auth(office))
    assert res.status_code == 200, res.get_json()
    return res.get_json()['data']


def test_과제_수는_목록이_곧_답이다(client, world, office, auth):
    data = _get(client, office, auth, 'project_count')
    assert data['total'] == 4
    assert len(data['projects']) == 4
    assert {p['title'] for p in data['projects']} == {f'과제 {i}' for i in range(1, 5)}


def test_비율은_분자_분모를_밝힌다(client, world, office, auth):
    """「75%」만으로는 4건 중 3건인지 100건 중 75건인지 알 수 없다."""
    data = _get(client, office, auth, 'no_kpi_link_rate')

    assert data['numerator']['count'] == 3      # p-2 · p-3 · p-4
    assert data['denominator']['count'] == 4
    assert len(data['projects']) == 3
    assert 'p-1' not in {p['uuid'] for p in data['projects']}


def test_연결_등급은_과제가_아니라_연결을_센다(client, world, office, auth):
    """⚠️ 분모가 과제 수가 아니다. 안 밝히면 목록 길이와 안 맞아 보인다."""
    data = _get(client, office, auth, 'primary_link_rate')

    assert '연결' in data['denominator']['label']
    assert '연결을 셉니다' in data['formula']
    assert data['numerator']['count'] == 1


def test_편중은_어느_쪽에_몰렸는지_말한다(client, world, office, auth):
    """「55%」만 보여주면 어느 부서인지 몰라 아무 데도 못 간다."""
    data = _get(client, office, auth, 'dept_concentration')

    top = data['breakdown'][0]
    assert top['name'] == 'CAE그룹' and top['count'] == 2
    # 분모는 과제 수가 아니라 **부서별 참여 합계**다.
    assert data['denominator']['count'] == 4
    assert len(data['projects']) == 2


def test_사업부를_고르면_그_조직만_본다(client, world, office, auth):
    data = _get(client, office, auth, 'project_count',
                division_id=world['mx'].id)
    assert data['scope'] == 'MX'
    assert data['isCompany'] is False


def test_전사면_합친_값임을_말한다(client, world, office, auth):
    """합친 값을 합친 값이라고 안 하면 사업부 하나의 이야기로 읽힌다."""
    data = _get(client, office, auth, 'project_count')
    assert data['isCompany'] is True
    assert data['scope'] == '전사'


def test_모르는_지표는_400(client, world, office, auth):
    res = client.get(f'{BASE}/plans/{YEAR}/metrics/없는지표/detail',
                     headers=auth(office))
    assert res.status_code == 400


def test_조회_권한만_있어도_볼_수_있다(client, world, make_user, auth):
    """진단을 읽을 수 있으면 그 근거도 읽을 수 있어야 한다."""
    viewer = make_user('viewer@test.local', UserRole.USER)
    res = client.get(f'{BASE}/plans/{YEAR}/metrics/project_count/detail',
                     headers=auth(viewer))
    assert res.status_code == 200
