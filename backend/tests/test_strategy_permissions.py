"""전략 모듈 권한 — 조회는 모두, 편집은 매니저 이상.

⚠️ **화면에서 단추를 감추는 것은 방어가 아니다.** 여기가 방어선이다. URL 을 직접
   부르면 화면은 아무 역할도 못 한다.

한동안 전 화면이 사무국 전용이었다. 그러면 사업부장이 자기 사업부 진단조차 못
보고, 전략은 「사무국이 만든 남의 문서」가 된다 — 정작 실행할 조직이 안 읽는다.
"""
import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_strategy.models import StrategyPlan

BASE = '/api/digital-twin-strategy'
YEAR = 2026

# 레벨: ADMIN 100 · DT_OFFICE 70 · MANAGER 50 · USER 20 · VIEWER 10
EDITORS = (UserRole.ADMIN, UserRole.DT_OFFICE_MEMBER, UserRole.MANAGER)
VIEWERS = (UserRole.USER, UserRole.VIEWER)


@pytest.fixture()
def plan(db):
    from app.modules.digital_twin_dashboard.models import Division

    _db.session.add_all([
        Division(name='MX', is_kpi_owner=True, is_active=True, order=1),
        StrategyPlan(year=YEAR, title=f'{YEAR}년 전략'),
    ])
    _db.session.commit()
    return StrategyPlan.query.one()


def _user(make_user, role):
    return make_user(f'{role}@test.local', role)


@pytest.mark.parametrize('role', EDITORS + VIEWERS)
def test_조회는_모두_할_수_있다(client, plan, make_user, auth, role):
    """사업부장도 자기 조직 진단을 봐야 한다. 안 보여주면 안 읽는다."""
    user = _user(make_user, role)
    for path in (f'{BASE}/meta',
                 f'{BASE}/plans/{YEAR}',
                 f'{BASE}/plans/{YEAR}/document',
                 f'{BASE}/plans/{YEAR}/projects'):
        res = client.get(path, headers=auth(user))
        assert res.status_code == 200, f'{role} 이 {path} 를 못 봅니다'


@pytest.mark.parametrize('role', VIEWERS)
def test_조회만_되는_역할은_못_고친다(client, plan, make_user, auth, role):
    """⚠️ **URL 을 직접 부르는 것을 막는 것이 요점이다.**"""
    user = _user(make_user, role)
    calls = [
        ('post', f'{BASE}/plans/{YEAR}/cruxes', {'title': '난제'}),
        ('post', f'{BASE}/plans/{YEAR}/issues', {'title': '이슈'}),
        ('post', f'{BASE}/plans/{YEAR}/elements',
         {'kind': 'S', 'title': '강점'}),
        ('post', f'{BASE}/plans/{YEAR}/solutions',
         {'tows': 'SO', 'title': '솔루션'}),
        ('put', f'{BASE}/plans/{YEAR}/document',
         {'sections': {'background': {'text': '몰래'}}}),
        ('put', f'{BASE}/plans/{YEAR}/document/status', {'status': 'confirmed'}),
        ('put', f'{BASE}/settings/thresholds', {'thresholds': {}}),
        ('post', f'{BASE}/plans', {'year': YEAR + 1}),
    ]
    for method, path, body in calls:
        res = getattr(client, method)(path, headers=auth(user), json=body)
        assert res.status_code == 403, f'{role} 이 {method.upper()} {path} 를 했습니다'
        assert '매니저' in res.get_json()['message']


@pytest.mark.parametrize('role', EDITORS)
def test_매니저_이상은_고칠_수_있다(client, plan, make_user, auth, role):
    user = _user(make_user, role)
    res = client.post(f'{BASE}/plans/{YEAR}/cruxes', headers=auth(user),
                      json={'title': f'{role} 가 만든 난제'})
    assert res.status_code == 201, res.get_json()


def test_서술형_요약은_편집_권한만(client, plan, make_user, auth):
    """⚠️ 설문 응답자에게 「관리자는 확인 가능」이라고 고지했지 「전 직원이 확인
    가능」이라고 하지 않았다. 서술형은 **원문 인용**을 읽고 감사 로그에 남는다.
    """
    res = client.post(f'{BASE}/plans/{YEAR}/survey-voices',
                      headers=auth(_user(make_user, UserRole.USER)), json={})
    assert res.status_code == 403


def test_meta_가_편집_가능_여부를_알려준다(client, plan, make_user, auth):
    """화면이 단추를 감출지 정하는 값. **편의일 뿐 방어가 아니다.**"""
    editor = client.get(f'{BASE}/meta',
                        headers=auth(_user(make_user, UserRole.MANAGER)))
    assert editor.get_json()['data']['canEdit'] is True

    viewer = client.get(f'{BASE}/meta',
                        headers=auth(_user(make_user, UserRole.VIEWER)))
    assert viewer.get_json()['data']['canEdit'] is False


def test_로그인_안_하면_못_본다(client, plan):
    assert client.get(f'{BASE}/plans/{YEAR}').status_code == 401


# ── 배포 전 점검에서 나온 것 ──────────────────────────────────────────

def test_예외를_화면에_흘리지_않는다(client, plan, make_user, auth, monkeypatch):
    """⚠️ `str(e)` 를 그대로 돌려주면 DB 오류의 **테이블·컬럼 이름과 SQL 조각**이
    사용자 화면에 뜬다. 그리고 그걸 본 사람은 무엇을 해야 할지 모른다."""
    from app.modules.digital_twin_strategy import routes

    def boom(*a, **kw):
        raise RuntimeError('relation "strategy_secret" does not exist')

    monkeypatch.setattr(routes, 'build_plan_payload', boom)
    user = _user(make_user, UserRole.ADMIN)
    res = client.get(f'{BASE}/plans/{YEAR}', headers=auth(user))

    assert res.status_code == 500
    message = res.get_json()['message']
    assert 'strategy_secret' not in message
    assert 'does not exist' not in message
    assert '관리자에게' in message


def test_예외를_로그에는_남긴다(client, plan, make_user, auth, monkeypatch, caplog):
    """⚠️ 지금까지는 어디에도 안 남아서 500 이 나면 원인을 추측할 수밖에
    없었다. traceback 이 있어야 다음에 십 분 안에 찾는다."""
    import logging
    from app.modules.digital_twin_strategy import routes

    def boom(*a, **kw):
        raise RuntimeError('터졌다')

    monkeypatch.setattr(routes, 'build_plan_payload', boom)
    user = _user(make_user, UserRole.ADMIN)
    with caplog.at_level(logging.ERROR):
        client.get(f'{BASE}/plans/{YEAR}', headers=auth(user))

    assert any('전략' in r.message or '터졌다' in str(r.exc_info)
               for r in caplog.records), caplog.text[:400]


def test_확정_시각을_UTC_로_저장한다(client, plan, make_user, auth):
    """⚠️ 이 표의 created_at·updated_at 이 전부 utcnow 이고, 직렬화가 「naive 는
    UTC」로 보고 KST 를 붙인다. 여기만 로컬시로 넣으면 한 표에 시계가 둘이 되고
    확정 시각이 아홉 시간 뒤로 표시된다."""
    from datetime import datetime, timedelta
    from app.modules.digital_twin_strategy.models import StrategyDocument

    user = _user(make_user, UserRole.ADMIN)
    client.put(f'{BASE}/plans/{YEAR}/document/status', headers=auth(user),
               json={'status': 'confirmed'})

    saved = StrategyDocument.query.one().confirmed_at
    # UTC 로 저장했으면 지금 UTC 와 몇 초 차이여야 한다. KST 면 9시간 어긋난다.
    assert abs(saved - datetime.utcnow()) < timedelta(minutes=5), saved

    # 내보낼 때는 KST 오프셋이 붙어야 한다 — 안 붙이면 브라우저가 로컬로 읽는다.
    doc = client.get(f'{BASE}/plans/{YEAR}/document',
                     headers=auth(user)).get_json()['data']
    assert doc['confirmedAt'].endswith('+09:00'), doc['confirmedAt']
