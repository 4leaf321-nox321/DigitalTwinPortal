# -*- coding: utf-8 -*-
"""조회수 현황 — 접속 이력을 주·월·연으로 묶어 주는 집계(2026-08-30).

**여기서 지키는 것**
  · 관리자만 본다 — 누가 무엇을 봤는지는 접속 이력이다
  · 묶는 기준이 KST 다 — UTC 로 묶으면 자정 언저리 건이 다른 칸에 들어가,
    같은 화면의 가입자 현황(브라우저 로컬 = 한국)과 하루씩 어긋난다
  · 조회(MODULE_ACCESS)와 로그인(LOGIN)을 섞어 세지 않는다
"""
from datetime import datetime

import pytest

from app.extensions import db as _db
from app.modules.auth.models import AccessLog, UserRole

BASE = '/api/auth'


@pytest.fixture()
def admin(make_user):
    return make_user('admin@test.local', UserRole.ADMIN)


@pytest.fixture()
def plain(make_user):
    return make_user('plain@test.local', UserRole.USER)


def _log(email, action, when, module='/dashboard'):
    _db.session.add(AccessLog(user_email=email, user_name=email.split('@')[0], action=action,
                              module=module, module_name='대시보드', created_at=when))


def test_조회수를_주월연으로_묶어_준다(client, auth, db, admin):
    _log('a@x.com', 'MODULE_ACCESS', datetime(2026, 3, 2, 1, 0))
    _log('a@x.com', 'MODULE_ACCESS', datetime(2026, 3, 2, 2, 0))
    _log('b@x.com', 'MODULE_ACCESS', datetime(2026, 3, 5, 1, 0))
    _log('a@x.com', 'LOGIN', datetime(2026, 3, 2, 0, 30))
    _log('a@x.com', 'MODULE_ACCESS', datetime(2026, 5, 1, 1, 0))
    _db.session.commit()

    got = client.get(f'{BASE}/access-logs/stats?unit=month', headers=auth(admin))
    assert got.status_code == 200, got.get_json()
    d = got.get_json()['data']
    by = {r['bucket']: r for r in d['rows']}
    assert by['2026-03']['views'] == 3
    assert by['2026-03']['visitors'] == 2          # 같은 사람이 둘 봐도 한 사람
    assert by['2026-03']['logins'] == 1            # 로그인은 조회에 안 섞인다
    assert by['2026-05']['views'] == 1
    # ⚠️ 서버는 **자기가 가진 칸만** 준다 — 빈 4월을 채우는 것은 화면의 몫이다(signupStats).
    assert '2026-04' not in by

    week = client.get(f'{BASE}/access-logs/stats?unit=week', headers=auth(admin)).get_json()['data']
    # 3/2 는 월요일 — date_trunc('week') 도 화면(bucketOf)도 월요일에 시작한다
    assert {r['bucket'] for r in week['rows']} >= {'2026-03-02'}
    year = client.get(f'{BASE}/access-logs/stats?unit=year', headers=auth(admin)).get_json()['data']
    assert [r['bucket'] for r in year['rows']] == ['2026']
    assert year['rows'][0]['views'] == 4


def test_묶는_기준이_KST_다(client, auth, db, admin):
    """⚠️ DB 는 naive UTC 로 담는다. 그대로 묶으면 한국의 하루와 어긋난다.

    UTC 2026-03-31 20:00 은 **KST 4월 1일 05:00** 이다. 화면의 가입자 현황은 브라우저
    로컬(=한국)로 묶으므로, 여기서 UTC 로 묶으면 두 그림이 한 칸씩 밀린다.
    """
    _log('a@x.com', 'MODULE_ACCESS', datetime(2026, 3, 31, 20, 0))
    _db.session.commit()
    d = client.get(f'{BASE}/access-logs/stats?unit=month', headers=auth(admin)).get_json()['data']
    assert [r['bucket'] for r in d['rows']] == ['2026-04'], d['rows']


def test_많이_본_화면도_함께_준다(client, auth, db, admin):
    for _ in range(3):
        _log('a@x.com', 'MODULE_ACCESS', datetime(2026, 3, 2, 1, 0))
    _db.session.add(AccessLog(user_email='a@x.com', user_name='a', action='MODULE_ACCESS',
                              module='/other', module_name='회의 관리',
                              created_at=datetime(2026, 3, 2, 1, 0)))
    _db.session.commit()
    d = client.get(f'{BASE}/access-logs/stats?unit=month', headers=auth(admin)).get_json()['data']
    assert d['modules'][0] == {'name': '대시보드', 'views': 3}
    assert {'name': '회의 관리', 'views': 1} in d['modules']


def test_관리자만_본다(client, auth, db, admin, plain):
    assert client.get(f'{BASE}/access-logs/stats', headers=auth(plain)).status_code == 403
    assert client.get(f'{BASE}/access-logs/stats').status_code in (401, 422)
    assert client.get(f'{BASE}/access-logs/stats?unit=day', headers=auth(admin)).status_code == 400
    # 이력이 하나도 없어도 빈 줄로 답한다 — 처음 켠 서버에서 500 이 나면 안 된다
    empty = client.get(f'{BASE}/access-logs/stats?unit=month', headers=auth(admin))
    assert empty.status_code == 200 and empty.get_json()['data']['rows'] == []
