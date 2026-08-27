# -*- coding: utf-8 -*-
"""성숙도 API 시험. (PLAN 9절 B 판)

**여기서 지키는 것은 판단의 규칙이다.**

  · 근거 없이 저장되는가 — 되면 사다리가 인상평이 된다
  · 정확도를 칸으로 매길 수 있는가 — 되면 정확도가 둘이 된다
  · 다른 사업부 사람이 매길 수 있는가 — 되면 인상이고, 못 하면 이유가 적혀야 한다
  · 값이 안 바뀌었는데 이력이 남는가 — 남으면 진짜 변경이 잡음에 묻힌다
  · 연결을 끊으면 평가·이력이 같이 가고, 몇 건인지 말해 주는가
  · 항목 정확도가 안 잰 시뮬레이션을 0 으로 세는가
"""
import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.dev_dt_maturity.models import (
    MaturityAssessment, MaturityChange, MaturityPair,
)

BASE = '/api/dev-dt-maturity'


@pytest.fixture()
def world(db):
    """사업부 둘 + 각 사업부에 부서 하나(계정→사업부를 잇는 다리)."""
    from app.modules.digital_twin_dashboard.models import Department, Division

    mx = Division(name='MX', is_kpi_owner=True, is_active=True, order=1)
    vd = Division(name='VD', is_kpi_owner=True, is_active=True, order=2)
    _db.session.add_all([mx, vd])
    _db.session.flush()
    _db.session.add_all([
        Department(name='MX생기', division_id=mx.id, is_active=True),
        Department(name='VD생기', division_id=vd.id, is_active=True),
    ])
    _db.session.commit()
    return {'mx': mx, 'vd': vd}


@pytest.fixture()
def office(make_user):
    return make_user('office@test.local', UserRole.DT_OFFICE_MEMBER)


@pytest.fixture()
def mx_user(make_user, world):
    return make_user('mx@test.local', UserRole.USER, department='MX생기')


@pytest.fixture()
def vd_user(make_user, world):
    return make_user('vd@test.local', UserRole.USER, department='VD생기')


@pytest.fixture()
def viewer(make_user, world):
    return make_user('viewer@test.local', UserRole.VIEWER, department='MX생기')


def _post(client, auth, user, path, payload, expect=201):
    res = client.post(f'{BASE}{path}', json=payload, headers=auth(user))
    assert res.status_code == expect, res.get_json()
    return res.get_json()


def _pair(client, auth, user, division, subject='낙하 시험', agent='구조 해석', **agent_kw):
    s = _post(client, auth, user, '/subjects',
              {'division_id': division.id, 'name': subject})['data']
    a = _post(client, auth, user, '/agents',
              {'division_id': division.id, 'name': agent, **agent_kw})['data']
    p = _post(client, auth, user, '/pairs', {'subject_id': s['id'], 'agent_id': a['id']})['data']
    return s, a, p


def _assess(client, auth, user, pair_id, axis, payload, expect=200):
    res = client.put(f'{BASE}/pairs/{pair_id}/assessments/{axis}',
                     json=payload, headers=auth(user))
    assert res.status_code == expect, res.get_json()
    return res.get_json()


# ── 근거 · 축 종류 ─────────────────────────────────────────────────────────

def test_근거_없이는_저장하지_않는다(client, auth, world, mx_user):
    _, _, p = _pair(client, auth, mx_user, world['mx'])
    out = _assess(client, auth, mx_user, p['id'], 'automation', {'rung': 'run'}, expect=400)
    assert '근거' in out['message']
    assert MaturityAssessment.query.count() == 0


def test_정확도는_값으로만_매기고_칸은_환산된다(client, auth, world, mx_user):
    _, _, p = _pair(client, auth, mx_user, world['mx'])
    out = _assess(client, auth, mx_user, p['id'], 'accuracy',
                  {'rung': 'correlated', 'note': 'x'}, expect=400)
    assert '값으로' in out['message']

    out = _assess(client, auth, mx_user, p['id'], 'accuracy',
                  {'value': 88, 'note': '24년 낙하 12건 비교, 오차 ±8%',
                   'evidence': {'compared_tests': 12, 'error_pct': 8, 'junk': 'x'}})
    acc = out['data']['assessments']['accuracy']
    assert acc['value'] == 88.0
    assert acc['rung'] == 'quantitative'          # 기본 문턱 70~90
    assert acc['rung_index'] == 1
    assert acc['evidence'] == {'compared_tests': 12, 'error_pct': 8.0}   # 모르는 키는 버림


def test_없는_칸_없는_축은_거절한다(client, auth, world, mx_user):
    _, _, p = _pair(client, auth, mx_user, world['mx'])
    _assess(client, auth, mx_user, p['id'], 'automation', {'rung': 'robot', 'note': 'x'}, expect=400)
    _assess(client, auth, mx_user, p['id'], 'no_such_axis', {'rung': 'run', 'note': 'x'}, expect=400)


# ── 권한 — 자기 사업부만 ──────────────────────────────────────────────────

def test_다른_사업부_사람은_못_매기고_이유가_적힌다(client, auth, world, mx_user, vd_user, office):
    _, _, p = _pair(client, auth, mx_user, world['mx'])
    out = _assess(client, auth, vd_user, p['id'], 'automation',
                  {'rung': 'run', 'note': 'x'}, expect=403)
    assert 'MX' in out['message']
    # 조회는 되고, 왜 못 누르는지도 실려 온다
    res = client.get(f'{BASE}/pairs/{p["id"]}', headers=auth(vd_user))
    assert res.status_code == 200
    assert 'MX' in res.get_json()['data']['deny_reason']
    # 사무국은 전 사업부
    _assess(client, auth, office, p['id'], 'automation', {'rung': 'run', 'note': '사무국 확인'})


def test_조회_전용_계정은_못_매긴다(client, auth, world, mx_user, viewer):
    _, _, p = _pair(client, auth, mx_user, world['mx'])
    out = _assess(client, auth, viewer, p['id'], 'automation',
                  {'rung': 'run', 'note': 'x'}, expect=403)
    assert '조회 전용' in out['message']


def test_사업부_목록에_내가_손댈_수_있는지가_실린다(client, auth, world, mx_user):
    res = client.get(f'{BASE}/divisions', headers=auth(mx_user))
    rows = {r['name']: r['deny_reason'] for r in res.get_json()['data']}
    assert rows['MX'] is None
    assert 'VD' in rows['VD']


def test_다른_사업부의_대상과_수단은_잇지_못한다(client, auth, world, office):
    s = _post(client, auth, office, '/subjects', {'division_id': world['mx'].id, 'name': '낙하'})['data']
    a = _post(client, auth, office, '/agents', {'division_id': world['vd'].id, 'name': 'CFD'})['data']
    out = _post(client, auth, office, '/pairs', {'subject_id': s['id'], 'agent_id': a['id']}, expect=400)
    assert '사업부' in out['message']


# ── 이력 ───────────────────────────────────────────────────────────────────

def test_바뀐_때만_이력이_남는다(client, auth, world, mx_user):
    _, _, p = _pair(client, auth, mx_user, world['mx'])
    _assess(client, auth, mx_user, p['id'], 'automation', {'rung': 'pre', 'note': '전처리 스크립트'})
    _assess(client, auth, mx_user, p['id'], 'automation', {'rung': 'pre', 'note': '근거만 고침'})
    out = _assess(client, auth, mx_user, p['id'], 'automation', {'rung': 'run', 'note': '템플릿 도입'})
    changes = out['data']['changes']
    assert [(c['before'], c['after']) for c in changes] == [('pre', 'run'), (None, 'pre')]
    assert changes[0]['actor_name'] == mx_user.name
    assert changes[0]['note'] == '템플릿 도입'


def test_연결을_끊으면_평가와_이력이_같이_가고_수를_말한다(client, auth, world, mx_user):
    _, _, p = _pair(client, auth, mx_user, world['mx'])
    _assess(client, auth, mx_user, p['id'], 'automation', {'rung': 'pre', 'note': 'a'})
    _assess(client, auth, mx_user, p['id'], 'scope', {'rung': 'basic', 'note': 'b'})
    res = client.delete(f'{BASE}/pairs/{p["id"]}', headers=auth(mx_user))
    assert res.get_json()['data'] == {'assessments': 2, 'changes': 2}
    assert MaturityPair.query.count() == 0
    assert MaturityAssessment.query.count() == 0
    assert MaturityChange.query.count() == 0


# ── 사업부 판 ──────────────────────────────────────────────────────────────

def test_항목_정확도는_값_있는_것만_평균하고_미평가를_센다(client, auth, world, mx_user):
    s, a1, p1 = _pair(client, auth, mx_user, world['mx'], agent='구조 해석')
    a2 = _post(client, auth, mx_user, '/agents', {'division_id': world['mx'].id, 'name': 'CFD'})['data']
    p2 = _post(client, auth, mx_user, '/pairs', {'subject_id': s['id'], 'agent_id': a2['id']})['data']
    _assess(client, auth, mx_user, p1['id'], 'accuracy', {'value': 88, 'note': 'x'})
    _assess(client, auth, mx_user, p1['id'], 'automation', {'rung': 'run', 'note': 'x'})
    _assess(client, auth, mx_user, p2['id'], 'automation', {'rung': 'manual', 'note': 'x'})

    res = client.get(f'{BASE}/board?division_id={world["mx"].id}', headers=auth(mx_user))
    row = res.get_json()['data']['subjects'][0]
    sm = row['summary']
    assert (sm['accuracy'], sm['accuracy_filled'], sm['accuracy_total']) == (88.0, 1, 2)
    assert sm['best_rung_index']['automation'] == 2          # run — 평균이 아니라 최고 칸
    assert sm['best_rung_index']['scope'] is None
    assert sm['unassessed'] == 3 + 4                          # p1 은 5축 중 2개 매김, p2 는 1개
    assert res.get_json()['data']['deny_reason'] is None


def test_판에는_전체가_없다(client, auth, world, mx_user):
    res = client.get(f'{BASE}/board', headers=auth(mx_user))
    assert res.status_code == 400
    assert '전체' in res.get_json()['message']


# ── 태그 사전 · 설정 ───────────────────────────────────────────────────────

def test_현상_태그는_그_사업부_사전에_쌓인다(client, auth, world, mx_user, office):
    _, _, p = _pair(client, auth, mx_user, world['mx'])
    _assess(client, auth, mx_user, p['id'], 'modeling',
            {'rung': 'defect', 'note': '휨 예측 확인', 'evidence': {'phenomena': ['휨', '깨짐', '휨']}})
    res = client.get(f'{BASE}/pairs/{p["id"]}', headers=auth(mx_user))
    assert res.get_json()['data']['phenomena'] == ['휨', '깨짐']
    res = client.get(f'{BASE}/settings', headers=auth(office))
    assert res.get_json()['data']['phenomena'] == {str(world['mx'].id): ['휨', '깨짐']}


def test_설정은_사무국만_바꾼다(client, auth, world, mx_user, office):
    res = client.put(f'{BASE}/settings', json={'stale_days': 180}, headers=auth(mx_user))
    assert res.status_code == 403
    res = client.put(f'{BASE}/settings', json={'stale_days': 180}, headers=auth(office))
    assert res.status_code == 200
    res = client.get(f'{BASE}/definitions', headers=auth(mx_user))
    d = res.get_json()['data']
    assert d['stale_days'] == 180
    assert [s['key'] for s in d['sectors'] if s['active']] == ['simulation']
    assert d['my_division_id'] == world['mx'].id


def test_닫힌_부문에는_대상을_못_만든다(client, auth, world, office):
    out = _post(client, auth, office, '/subjects',
                {'division_id': world['mx'].id, 'name': 'x', 'sector': 'design_automation'},
                expect=400)
    assert '열리지' in out['message']


def test_사업부_이력은_쌍_이름을_달고_최근순이다(client, auth, world, mx_user):
    _, _, p = _pair(client, auth, mx_user, world['mx'])
    _assess(client, auth, mx_user, p['id'], 'automation', {'rung': 'pre', 'note': 'a'})
    _assess(client, auth, mx_user, p['id'], 'automation', {'rung': 'run', 'note': 'b'})
    res = client.get(f'{BASE}/changes?division_id={world["mx"].id}', headers=auth(mx_user))
    rows = res.get_json()['data']
    assert [(r['before'], r['after']) for r in rows] == [('pre', 'run'), (None, 'pre')]
    assert rows[0]['subject_name'] == '낙하 시험' and rows[0]['agent_name'] == '구조 해석'
    assert client.get(f'{BASE}/changes?division_id={world["vd"].id}', headers=auth(mx_user)).get_json()['data'] == []
