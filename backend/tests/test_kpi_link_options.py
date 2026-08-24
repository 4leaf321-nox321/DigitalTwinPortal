"""아직 없는 과제를 위한 DX KPI 후보 — `GET /dt-v2/kpi-links/options`.

왜 생겼나
    신규 과제 추가창에는 uuid 가 없다. 기존 `/projects/<uuid>/kpi-links` 는 과제가
    없으면 404 라, 그대로 쓰면 추가창의 KPI 탭이 **빈 화면**이 된다. 그래서 과제
    없이 **사업부 이름 하나로** 정해지는 것들만 주는 경로를 냈다.

⚠️ **이 시험의 핵심은 「두 경로가 같은 답을 낸다」이다.** 규칙이 두 벌이 되면
   "추가창에서 고를 수 있던 것이 편집창에선 없다" 가 나고, 더 나쁘게는 기능조직
   판정이 갈려 **엉뚱한 사업부 칸에 기여가 찍힌다.** 그래서 두 라우트가
   `_kpi_link_options` 하나를 같이 쓰고, 여기서 그것을 못 박는다.
"""
import uuid as uuidlib

import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project

BASE = '/api/dt-v2'
YEAR = 2026

# 사업부가 KPI 를 직접 관리하는지 여부로 갈린다. 기능조직(GTR·SR·CS)은 자기 지표가
# 없어 지원할 사업부를 골라야 한다.
OWNER_DIV = 'MX'
FUNCTIONAL_DIV = 'GTR'


@pytest.fixture()
def admin(make_user):
    return make_user('kpi-opt@test.local', UserRole.ADMIN)


@pytest.fixture()
def kpi_world(db):
    """사업부 둘과 지표 둘.

    ⚠️ 시험 DB 는 비어 있다. 이 픽스처가 없으면 `available` 도 `divisions` 도 빈
       배열이라 **전부 통과해 버린다** — 아무것도 안 지키는 초록이 된다.
    """
    from app.modules.digital_twin_dashboard.models import Division
    from app.modules.dx_kpi_management.models import KpiDefinition

    _db.session.add_all([
        Division(name=OWNER_DIV, order=1, is_active=True, is_kpi_owner=True),
        # 기능조직 — 자기 지표가 없고 위 사업부를 지원한다.
        Division(name=FUNCTIONAL_DIV, order=2, is_active=True, is_kpi_owner=False),
        KpiDefinition(label='가상 검증률', category='개발', unit='%', sort_order=1),
        KpiDefinition(label='플랫폼 구축', category='플랫폼', unit='',
                      sort_order=2, kind='platform'),
    ])
    _db.session.commit()


def _project(division):
    p = Dt2Project(
        uuid=str(uuidlib.uuid4()), code=f'KO-{division}', title=f'{division} 과제',
        division=division, status='진행중', year=YEAR, is_deleted=False, progress=0,
        action_items_json=[], issues_json=[],
    )
    _db.session.add(p)
    _db.session.commit()
    return p


def _options(client, auth, admin, division=None):
    qs = f'?division={division}' if division is not None else ''
    r = client.get(f'{BASE}/kpi-links/options{qs}', headers=auth(admin))
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'
    return (r.get_json() or {}).get('data') or {}


SHARED = ['available', 'divisions', 'isFunctionalOrg', 'defaultTargets', 'projectDivision']


def test_과제_경로와_같은_답을_낸다(db, kpi_world, client, auth, admin):
    """규칙이 한 곳에 있는지. 갈리면 두 화면이 다른 것을 보여 준다."""
    p = _project(OWNER_DIV)

    r = client.get(f'{BASE}/projects/{p.uuid}/kpi-links', headers=auth(admin))
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'
    old = (r.get_json() or {}).get('data') or {}
    new = _options(client, auth, admin, OWNER_DIV)

    for k in SHARED:
        assert old.get(k) == new.get(k), f'{k} 가 두 경로에서 다르다'


def test_과제_전용_키는_안_준다(db, kpi_world, client, auth, admin):
    """걸 과제가 아직 없다. 있는 척하면 화면이 그것을 믿는다."""
    new = _options(client, auth, admin, OWNER_DIV)
    for k in ('items', 'rowVersion', 'canEdit', 'projectUuid'):
        assert k not in new, f'{k} 는 과제가 있어야 나오는 값이다'


def test_사업부_과제는_자기_사업부로_고정된다(db, kpi_world, client, auth, admin):
    new = _options(client, auth, admin, OWNER_DIV)
    assert new['isFunctionalOrg'] is False
    assert new['defaultTargets'] == [OWNER_DIV]


def test_기능조직은_대상을_직접_골라야_한다(db, kpi_world, client, auth, admin):
    """
    ⚠️ 기능조직(GTR·SR·CS)은 자기 지표가 없다. 여기서 `defaultTargets` 를 채워 주면
       화면이 **고르는 단계를 건너뛰고** 엉뚱한 사업부에 기여가 찍힌다.
    """
    new = _options(client, auth, admin, FUNCTIONAL_DIV)
    assert new['isFunctionalOrg'] is True
    assert new['defaultTargets'] == []


def test_사업부를_안_줘도_200_이다(db, kpi_world, client, auth, admin):
    """
    추가창은 사업부를 **고르기 전에도** 열린다. 400 을 내면 탭이 오류로 보인다 —
    아직 아무 잘못도 안 했는데.
    """
    new = _options(client, auth, admin)
    assert new['defaultTargets'] == []
    assert new['isFunctionalOrg'] is False
    assert new['projectDivision'] is None
    assert isinstance(new['available'], list)


def test_모르는_사업부도_조용히_넘어간다(db, kpi_world, client, auth, admin):
    """오타나 없어진 조직. 후보는 주되 대상은 안 정한다."""
    new = _options(client, auth, admin, '없는사업부')
    assert new['defaultTargets'] == []
    assert new['isFunctionalOrg'] is False


def test_후보_지표를_준다(db, kpi_world, client, auth, admin):
    """빈 목록이면 탭을 열어도 고를 것이 없다 — 기능이 있으나 마나가 된다."""
    new = _options(client, auth, admin, OWNER_DIV)
    assert len(new['available']) > 0
    one = new['available'][0]
    for k in ('kpiDefinitionId', 'label', 'category', 'kind'):
        assert k in one, f'{k} 가 없으면 화면이 지표를 못 그린다'


def test_로그인이_필요하다(db, client):
    r = client.get(f'{BASE}/kpi-links/options?division={OWNER_DIV}')
    assert r.status_code == 401, f'{r.status_code} · {r.get_json()}'


def test_일반_사용자도_볼_수_있다(db, kpi_world, client, auth, make_user):
    """
    지표 정의와 사업부 목록은 **과제별 비밀이 아니다.** 과제를 만들 수 있는 사람이면
    무엇에 걸 수 있는지 봐야 한다 — 여기서 막으면 추가창이 빈 화면이 된다.
    """
    plain = make_user('plain-kpi@test.local', UserRole.USER)
    r = client.get(f'{BASE}/kpi-links/options?division={OWNER_DIV}', headers=auth(plain))
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'
