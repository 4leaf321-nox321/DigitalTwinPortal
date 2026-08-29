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

from app.modules.dev_dt_maturity import definitions as D

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


def _sys_names(client, auth, user):
    return [x['name'] for x in client.get(f'{BASE}/systems', headers=auth(user)).get_json()['data']]


def _table(*rows):
    """붙여넣은 표를 흉내 — 탭으로 칸을, 줄바꿈으로 줄을 나눈다."""
    return chr(10).join(chr(9).join(r) for r in rows)


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
    _assess(client, auth, mx_user, p['id'], 'automation', {'flags': ['pre', 'robot'], 'note': 'x'}, expect=400)
    _assess(client, auth, mx_user, p['id'], 'scope', {'rung': 'robot', 'note': 'x'}, expect=400)
    _assess(client, auth, mx_user, p['id'], 'no_such_axis', {'rung': 'run', 'note': 'x'}, expect=400)


def test_자동화는_토글_묶음으로_매기고_수동이면_전부_꺼진다(client, auth, world, mx_user):
    _, _, p = _pair(client, auth, mx_user, world['mx'])
    out = _assess(client, auth, mx_user, p['id'], 'automation', {'flags': ['post', 'pre'], 'note': '전처리·후처리'})
    a = out['data']['assessments']['automation']
    assert a['rung'] == 'pre,post' and a['flags'] == ['pre', 'post'] and a['rung_index'] == 2
    out = _assess(client, auth, mx_user, p['id'], 'automation', {'flags': [], 'note': '다시 수동'})
    a = out['data']['assessments']['automation']
    assert a['rung'] == 'manual' and a['flags'] == [] and a['rung_index'] == 0
    assert [(c['before'], c['after']) for c in out['data']['changes']][:2] == [('pre,post', 'manual'), (None, 'pre,post')]
    # 옛 모양(rung 하나)도 받는다
    out = _assess(client, auth, mx_user, p['id'], 'automation', {'rung': 'run', 'note': '옛 화면'})
    assert out['data']['assessments']['automation']['flags'] == ['run']


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
    _assess(client, auth, mx_user, p1['id'], 'automation', {'flags': ['pre', 'run'], 'note': 'x'})
    _assess(client, auth, mx_user, p2['id'], 'automation', {'flags': [], 'note': 'x'})

    res = client.get(f'{BASE}/board?division_id={world["mx"].id}', headers=auth(mx_user))
    row = res.get_json()['data']['subjects'][0]
    sm = row['summary']
    assert (sm['accuracy'], sm['accuracy_filled'], sm['accuracy_total']) == (88.0, 1, 2)
    assert sm['best_rung_index']['automation'] == 2          # 켠 개수 2 — 평균이 아니라 최고
    assert sm['best_rung_index']['scope'] is None
    assert sm['unassessed'] == 3 + 4                          # p1 은 5축 중 2개 매김, p2 는 1개
    assert res.get_json()['data']['deny_reason'] is None


def test_사업부_없이는_판을_못_열고_전체는_사업부마다_묶어_준다(client, auth, world, mx_user, office):
    res = client.get(f'{BASE}/board', headers=auth(mx_user))
    assert res.status_code == 400
    _pair(client, auth, mx_user, world['mx'])
    _pair(client, auth, office, world['vd'], subject='VD 시험', agent='VD 해석')
    d = client.get(f'{BASE}/board?division_id=all', headers=auth(mx_user)).get_json()['data']
    assert [b['division_name'] for b in d['boards']] == ['MX', 'VD']
    assert d['totals']['subjects'] == 2 and d['totals']['pairs'] == 2
    assert d['boards'][1]['subjects'][0]['division_name'] == 'VD'


# ── 태그 사전 · 설정 ───────────────────────────────────────────────────────

def test_설정은_사무국만_바꾼다(client, auth, world, mx_user, office):
    res = client.put(f'{BASE}/settings', json={'stale_days': 180}, headers=auth(mx_user))
    assert res.status_code == 403
    res = client.put(f'{BASE}/settings', json={'stale_days': 180}, headers=auth(office))
    assert res.status_code == 200
    res = client.get(f'{BASE}/definitions', headers=auth(mx_user))
    d = res.get_json()['data']
    assert d['stale_days'] == 180
    assert [s['key'] for s in d['sectors'] if s['active']] == ['simulation', 'manufacturing_monitoring', 'digital_thread']
    assert all(s['hidden'] is False for s in d['sectors'])          # 기본은 아무 부문도 안 감춘다
    assert d['my_division_id'] == world['mx'].id


def test_닫힌_부문에는_대상을_못_만든다(client, auth, world, office):
    out = _post(client, auth, office, '/subjects',
                {'division_id': world['mx'].id, 'name': 'x', 'sector': 'design_automation'},
                expect=400)
    assert '열리지' in out['message']


def test_사업부_이력은_연계_이름을_달고_최근순이다(client, auth, world, mx_user):
    _, _, p = _pair(client, auth, mx_user, world['mx'])
    _assess(client, auth, mx_user, p['id'], 'automation', {'rung': 'pre', 'note': 'a'})
    _assess(client, auth, mx_user, p['id'], 'automation', {'rung': 'run', 'note': 'b'})
    res = client.get(f'{BASE}/changes?division_id={world["mx"].id}', headers=auth(mx_user))
    rows = res.get_json()['data']
    assert [(r['before'], r['after']) for r in rows] == [('pre', 'run'), (None, 'pre')]
    assert rows[0]['subject_name'] == '낙하 시험' and rows[0]['agent_name'] == '구조 해석'
    assert client.get(f'{BASE}/changes?division_id={world["vd"].id}', headers=auth(mx_user)).get_json()['data'] == []


def test_시뮬레이션의_도구는_목록으로_들고_정돈된다(client, auth, world, mx_user):
    a = _post(client, auth, mx_user, '/agents',
              {'division_id': world['mx'].id, 'name': '구조 해석',
               'tools': ['LS-DYNA', ' HyperMesh ', 'LS-DYNA', '']})['data']
    assert a['tools'] == ['LS-DYNA', 'HyperMesh']            # 공백·중복·빈칸 정돈
    res = client.put(f'{BASE}/agents/{a["id"]}', json={'tools': 'Abaqus, HyperMesh'}, headers=auth(mx_user))
    assert res.get_json()['data']['tools'] == ['Abaqus', 'HyperMesh']   # 쉼표 글자도 받는다
    res = client.put(f'{BASE}/agents/{a["id"]}', json={'kind': '구조'}, headers=auth(mx_user))
    assert res.get_json()['data']['tools'] == ['Abaqus', 'HyperMesh']   # 안 보낸 칸은 그대로


def test_도구_이름_제안은_인텔_도구_표에서_온다(client, auth, world, mx_user):
    from app.modules.digital_twin_intel.models import IntelTech
    import uuid as _u
    _db.session.add_all([
        IntelTech(uuid=str(_u.uuid4()), name='LS-DYNA', kind='tool'),
        IntelTech(uuid=str(_u.uuid4()), name=' HyperMesh ', kind='tool'),
        IntelTech(uuid=str(_u.uuid4()), name='구조 해석', kind='capability'),      # 역량은 제안이 아니다
        IntelTech(uuid=str(_u.uuid4()), name='옛 도구', kind='tool', is_archived=True),
    ])
    _db.session.commit()
    res = client.get(f'{BASE}/tool-names', headers=auth(mx_user))
    assert res.status_code == 200
    assert res.get_json()['data'] == ['HyperMesh', 'LS-DYNA']


def test_도구_정돈은_표기_차이와_없는_이름을_가려_제안한다(client, auth, world, mx_user, vd_user):
    from app.modules.digital_twin_intel.models import IntelTech
    import uuid as _u
    _db.session.add_all([IntelTech(uuid=str(_u.uuid4()), name=n, kind='tool')
                         for n in ['Altair HyperMesh', 'LS-DYNA', 'Ansys Fluent', '3D Slicer']])
    _db.session.commit()
    _post(client, auth, mx_user, '/agents', {'division_id': world['mx'].id, 'name': 'a', 'tools': ['HyperMesh', 'ls-dyna', '사내툴']})
    _post(client, auth, mx_user, '/agents', {'division_id': world['mx'].id, 'name': 'b', 'tools': ['HyperMesh', 'Ansys Fluent', '3D']})

    audit = client.get(f'{BASE}/tool-audit?division_id={world["mx"].id}', headers=auth(mx_user)).get_json()['data']
    by = {r['name']: r for r in audit['tools']}
    assert by['HyperMesh'] == {'name': 'HyperMesh', 'count': 2, 'in_intel': False, 'suggestion': 'Altair HyperMesh', 'known_variant': False}
    assert by['ls-dyna']['suggestion'] == 'LS-DYNA' and by['ls-dyna']['known_variant'] is True   # 표기만 다름
    assert by['사내툴']['suggestion'] is None                                                     # 인텔에 없음
    assert by['3D']['suggestion'] is None                                                         # 너무 짧아 안 맞춘다
    assert by['Ansys Fluent']['in_intel'] is True
    assert audit['off_standard'] == 4
    # 표준 것은 뒤로, 제안 있는 것이 앞으로
    assert audit['tools'][-1]['name'] == 'Ansys Fluent'

    # 맞추기 — 사업부 전체에서. 다른 사업부 사람은 못 한다.
    res = client.post(f'{BASE}/tools/rename', json={'division_id': world['mx'].id, 'from': 'HyperMesh', 'to': 'Altair HyperMesh'}, headers=auth(vd_user))
    assert res.status_code == 403
    res = client.post(f'{BASE}/tools/rename', json={'division_id': world['mx'].id, 'from': 'HyperMesh', 'to': 'Altair HyperMesh'}, headers=auth(mx_user))
    assert res.get_json()['data'] == {'renamed': 2}
    names = sorted(t for a in client.get(f'{BASE}/agents?division_id={world["mx"].id}', headers=auth(mx_user)).get_json()['data'] for t in a['tools'])
    assert 'HyperMesh' not in names and names.count('Altair HyperMesh') == 2


def test_도구_목록은_분야와_공급사를_같이_준다(client, auth, world, mx_user):
    from app.modules.digital_twin_intel.models import IntelTech
    import uuid as _u
    _db.session.add_all([
        IntelTech(uuid=str(_u.uuid4()), name='LS-DYNA', kind='tool', category='시뮬레이션·해석', vendor='Ansys'),
        IntelTech(uuid=str(_u.uuid4()), name='분야없음', kind='tool'),
        IntelTech(uuid=str(_u.uuid4()), name='LS-DYNA', kind='tool', category='시뮬레이션·해석'),   # 겹치면 하나
    ])
    _db.session.commit()
    rows = client.get(f'{BASE}/tool-catalog', headers=auth(mx_user)).get_json()['data']
    assert {r['name']: (r['category'], r['vendor']) for r in rows} == {
        'LS-DYNA': ('시뮬레이션·해석', 'Ansys'), '분야없음': ('기타', None)}


def test_제품군은_로드맵_설정이_표준이고_찾기_정돈_바꾸기가_도구와_같다(client, auth, world, mx_user):
    from app.modules.digital_twin_dashboard.models import ModuleSettings
    _db.session.add(ModuleSettings(module_name='digital_twin_reference', settings_key='product_families',
                                   settings_data=[{'divisionId': str(world['mx'].id), 'name': 'S 시리즈'},
                                                  {'divisionId': str(world['mx'].id), 'name': 'Z 폴드'},
                                                  {'divisionId': str(world['vd'].id), 'name': 'Neo QLED'}]))
    _db.session.commit()
    _post(client, auth, mx_user, '/subjects', {'division_id': world['mx'].id, 'name': '낙하', 'product_families': ['S시리즈', '사내전용']})
    _post(client, auth, mx_user, '/subjects', {'division_id': world['mx'].id, 'name': '굽힘', 'product_families': ['S시리즈', 'Z 폴드']})

    cat = client.get(f'{BASE}/family-catalog?division_id={world["mx"].id}', headers=auth(mx_user)).get_json()['data']
    by = {r['name']: r for r in cat}
    assert by['S시리즈']['category'] == '이 사업부가 쓰는 것' and by['S시리즈']['vendor'] == '2개 시험'
    assert by['S 시리즈']['category'] == '로드맵 정보의 제품군'
    assert by['Neo QLED'] == {'name': 'Neo QLED', 'category': '다른 사업부의 제품군', 'vendor': 'VD'}
    assert by['Z 폴드']['category'] == '이 사업부가 쓰는 것'          # 쓰는 것이 로드맵보다 앞

    audit = client.get(f'{BASE}/family-audit?division_id={world["mx"].id}', headers=auth(mx_user)).get_json()['data']
    rows = {r['name']: r for r in audit['families']}
    assert rows['S시리즈']['suggestion'] == 'S 시리즈' and rows['S시리즈']['known_variant'] is True
    assert rows['사내전용']['suggestion'] is None
    assert rows['Z 폴드']['in_standard'] is True
    assert (audit['standard_count'], audit['off_standard']) == (2, 2)

    res = client.post(f'{BASE}/families/rename', json={'division_id': world['mx'].id, 'from': 'S시리즈', 'to': 'S 시리즈'}, headers=auth(mx_user))
    assert res.get_json()['data'] == {'renamed': 2}
    subs = client.get(f'{BASE}/subjects?division_id={world["mx"].id}', headers=auth(mx_user)).get_json()['data']
    assert all('S시리즈' not in s['product_families'] and 'S 시리즈' in s['product_families'] for s in subs)


def test_사업부는_속성이고_걸린_연계이_없을_때만_옮긴다(client, auth, world, mx_user, office):
    s, a, p = _pair(client, auth, mx_user, world['mx'])
    assert s['division_id'] == world['mx'].id and a['division_id'] == world['mx'].id
    # 연계이 걸린 채로는 못 옮긴다
    res = client.put(f'{BASE}/subjects/{s["id"]}', json={'division_id': world['vd'].id}, headers=auth(office))
    assert res.status_code == 400 and '먼저 연계을 끊으세요' in res.get_json()['message']
    client.delete(f'{BASE}/pairs/{p["id"]}', headers=auth(mx_user))
    # MX 사람은 VD 로 못 보낸다 — 가는 쪽도 손댈 수 있어야 한다
    res = client.put(f'{BASE}/subjects/{s["id"]}', json={'division_id': world['vd'].id}, headers=auth(mx_user))
    assert res.status_code == 403 and 'VD' in res.get_json()['message']
    # 사무국은 된다
    res = client.put(f'{BASE}/agents/{a["id"]}', json={'division_id': world['vd'].id}, headers=auth(office))
    assert res.status_code == 200 and res.get_json()['data']['division_id'] == world['vd'].id
    # 같은 사업부로 보내는 것은 아무 일도 아니다
    res = client.put(f'{BASE}/subjects/{s["id"]}', json={'division_id': world['mx'].id, 'detail': 'x'}, headers=auth(mx_user))
    assert res.status_code == 200 and res.get_json()['data']['division_id'] == world['mx'].id


def test_담당_부서는_그_사업부의_활성_부서에서만_고른다(client, auth, world, mx_user, office):
    from app.modules.digital_twin_dashboard.models import Department
    mx_dep = Department.query.filter_by(name='MX생기').one()
    vd_dep = Department.query.filter_by(name='VD생기').one()
    _db.session.add(Department(name='MX옛부서', division_id=world['mx'].id, is_active=False))
    _db.session.commit()

    deps = client.get(f'{BASE}/departments?division_id={world["mx"].id}', headers=auth(mx_user)).get_json()['data']
    assert [d['name'] for d in deps] == ['MX생기']                     # 비활성은 안 나온다

    a = _post(client, auth, mx_user, '/agents', {'division_id': world['mx'].id, 'name': '구조 해석', 'department_id': mx_dep.id})['data']
    assert a['department_id'] == mx_dep.id and a['department_name'] == 'MX생기'

    res = client.put(f'{BASE}/agents/{a["id"]}', json={'department_id': vd_dep.id}, headers=auth(mx_user))
    assert res.status_code == 400 and '사업부에 속한 부서' in res.get_json()['message']
    res = client.put(f'{BASE}/agents/{a["id"]}', json={'department_id': None}, headers=auth(mx_user))
    assert res.get_json()['data']['department_name'] is None          # 「안 정함」으로 비운다

    # 사업부를 옮기면 옛 사업부의 부서는 비워진다
    res = client.put(f'{BASE}/agents/{a["id"]}', json={'department_id': mx_dep.id}, headers=auth(mx_user))
    res = client.put(f'{BASE}/agents/{a["id"]}', json={'division_id': world['vd'].id}, headers=auth(office))
    assert res.get_json()['data']['division_id'] == world['vd'].id and res.get_json()['data']['department_id'] is None

    grouped = client.get(f'{BASE}/departments?division_id=all', headers=auth(mx_user)).get_json()['data']
    assert grouped[str(world['vd'].id)] == [{'id': vd_dep.id, 'name': 'VD생기'}]


def test_평가_시점은_연월이고_옛_자료는_그_달로_들어간다(client, auth, world, mx_user):
    _, _, p = _pair(client, auth, mx_user, world['mx'])
    out = _assess(client, auth, mx_user, p['id'], 'scope', {'rung': 'basic', 'note': '옛 자료', 'assessed_at': '2025-03'})
    a = out['data']['assessments']['scope']
    assert a['assessed_at'].startswith('2025-03-01')
    assert out['data']['changes'][0]['created_at'].startswith('2025-03-01')       # 이력도 그 달
    _assess(client, auth, mx_user, p['id'], 'scope', {'rung': 'all', 'note': '미래', 'assessed_at': '2099-01'}, expect=400)
    _assess(client, auth, mx_user, p['id'], 'scope', {'rung': 'all', 'note': '꼴', 'assessed_at': '2025/03'}, expect=400)
    out = _assess(client, auth, mx_user, p['id'], 'scope', {'rung': 'all', 'note': '날짜도 받는다', 'assessed_at': '2026-02-17'})
    assert out['data']['assessments']['scope']['assessed_at'].startswith('2026-02-01')


def test_칸의_도달_시점을_그_자리에서_적는다(client, auth, world, mx_user):
    _, _, p = _pair(client, auth, mx_user, world['mx'])
    _assess(client, auth, mx_user, p['id'], 'scope', {'rung': 'basic', 'note': 'a'})     # 이력: None→basic (오늘)
    _assess(client, auth, mx_user, p['id'], 'scope', {'rung': 'all', 'note': 'b'})       # 이력: basic→all (오늘)

    def reached(rung, month, expect=200):
        res = client.put(f'{BASE}/pairs/{p["id"]}/reached/scope/{rung}', json={'month': month}, headers=auth(mx_user))
        assert res.status_code == expect, res.get_json()
        return res.get_json()

    out = reached('basic', '2024-06')
    dates = {c['after']: c['created_at'][:7] for c in out['data']['changes']}
    assert dates['basic'] == '2024-06' and dates['all'] != '2024-06'                      # 그 칸의 이력만 옮긴다
    # 이력이 없는 아래 칸(issue)은 「시점 적기」 이력을 만든다
    out = reached('issue', '2023-11')
    made = [c for c in out['data']['changes'] if c['after'] == 'issue']
    assert len(made) == 1 and made[0]['created_at'][:7] == '2023-11' and made[0]['note'] == '시점 적기'
    # 아직 안 올라온 칸 · 미래 · 값 축은 거절
    _assess(client, auth, mx_user, p['id'], 'scope', {'rung': 'basic', 'note': '내림'})
    reached('all', '2024-01', expect=400)
    reached('basic', '2099-01', expect=400)
    res = client.put(f'{BASE}/pairs/{p["id"]}/reached/accuracy/trend', json={'month': '2024-01'}, headers=auth(mx_user))
    assert res.status_code == 400

    # 묶음 축: 선택한 항목만, 그 항목을 켠 이력의 날짜를 옮긴다
    _assess(client, auth, mx_user, p['id'], 'automation', {'flags': ['pre', 'run'], 'note': 'x'})
    res = client.put(f'{BASE}/pairs/{p["id"]}/reached/automation/run', json={'month': '2025-02'}, headers=auth(mx_user))
    assert res.status_code == 200
    assert any(c['axis'] == 'automation' and 'run' in c['after'] and c['created_at'][:7] == '2025-02' for c in res.get_json()['data']['changes'])
    res = client.put(f'{BASE}/pairs/{p["id"]}/reached/automation/post', json={'month': '2025-02'}, headers=auth(mx_user))
    assert res.status_code == 400


def test_정확도는_줄줄이_쌓이고_옛_달은_현재를_덮지_않는다(client, auth, world, mx_user):
    _, _, p = _pair(client, auth, mx_user, world['mx'])
    out = _assess(client, auth, mx_user, p['id'], 'accuracy', {'value': 88, 'note': '5월 비교', 'assessed_at': '2026-05'})
    out = _assess(client, auth, mx_user, p['id'], 'accuracy', {'value': 88, 'note': '6월 비교', 'assessed_at': '2026-06'})
    rows = [c for c in out['data']['changes'] if c['axis'] == 'accuracy']
    assert len(rows) == 2                                                        # 같은 값이어도 줄이 붙는다
    assert out['data']['assessments']['accuracy']['note'] == '6월 비교'
    # 옛 달(3월)로 넣으면 줄만 붙고 현재(6월 88)는 그대로
    out = _assess(client, auth, mx_user, p['id'], 'accuracy', {'value': 60, 'note': '3월 비교', 'assessed_at': '2026-03'})
    a = out['data']['assessments']['accuracy']
    assert a['value'] == 88 and a['note'] == '6월 비교' and a['assessed_at'].startswith('2026-06')
    rows = sorted((c for c in out['data']['changes'] if c['axis'] == 'accuracy'), key=lambda c: c['created_at'])
    assert [c['after'] for c in rows] == ['60', '88', '88']

    # 줄 지우기 — 가장 늦은 줄을 지우면 그 앞 줄이 현재가 된다
    latest = max(rows, key=lambda c: c['created_at'])
    res = client.delete(f'{BASE}/pairs/{p["id"]}/changes/{latest["id"]}', headers=auth(mx_user))
    assert res.status_code == 200, res.get_json()
    a = res.get_json()['data']['assessments']['accuracy']
    assert a['note'] == '5월 비교' and a['assessed_at'].startswith('2026-05')
    # 다 지우면 미평가
    for c in [c for c in res.get_json()['data']['changes'] if c['axis'] == 'accuracy']:
        res = client.delete(f'{BASE}/pairs/{p["id"]}/changes/{c["id"]}', headers=auth(mx_user))
        assert res.status_code == 200
    assert 'accuracy' in res.get_json()['data']['unassessed']
    # 칸 축의 이력은 못 지운다
    out = _assess(client, auth, mx_user, p['id'], 'scope', {'rung': 'basic', 'note': 'a'})
    c = out['data']['changes'][0]
    res = client.delete(f'{BASE}/pairs/{p["id"]}/changes/{c["id"]}', headers=auth(mx_user))
    assert res.status_code == 400


def test_시뮬레이션의_불량_유형은_도구처럼_인스턴스_목록이다(client, auth, world, mx_user):
    res = client.post(f'{BASE}/agents', json={'division_id': world['mx'].id, 'name': '열 해석',
                      'defect_types': [' 크랙 ', '변색', '크랙', '']}, headers=auth(mx_user))
    assert res.status_code == 201, res.get_json()
    a = res.get_json()['data']
    assert a['defect_types'] == ['크랙', '변색']                      # 다듬고 겹침 뺌
    res = client.put(f'{BASE}/agents/{a["id"]}', json={'defect_types': ['접점 마모']}, headers=auth(mx_user))
    assert res.status_code == 200 and res.get_json()['data']['defect_types'] == ['접점 마모']
    res = client.put(f'{BASE}/agents/{a["id"]}', json={'name': '열 해석 2'}, headers=auth(mx_user))
    assert res.get_json()['data']['defect_types'] == ['접점 마모']    # 안 보내면 그대로


def test_모델링_수준은_불량_유형마다_시험_시장_열을_켠다(client, auth, world, mx_user):
    s = client.post(f'{BASE}/subjects', json={'division_id': world['mx'].id, 'name': '낙하 시험'}, headers=auth(mx_user)).get_json()['data']
    a = client.post(f'{BASE}/agents', json={'division_id': world['mx'].id, 'name': '구조 해석', 'defect_types': ['크랙', '변색']}, headers=auth(mx_user)).get_json()['data']
    p = client.post(f'{BASE}/pairs', json={'subject_id': s['id'], 'agent_id': a['id']}, headers=auth(mx_user)).get_json()['data']
    out = _assess(client, auth, mx_user, p['id'], 'modeling', {
        'flags': ['performance'], 'note': '낙하 3건 비교',
        'evidence': {'defects': {'크랙': {'test': '2025-03', 'market': None}, '변색': {'test': True}, '없는유형': {'test': '2025-01'}, '접점': {}}}})
    m = out['data']['assessments']['modeling']
    assert m['flags'] == ['performance']
    assert m['defects']['크랙'] == {'test': '2025-03'}                     # None 열은 빠진다
    assert 'test' in m['defects']['변색'] and len(m['defects']['변색']['test']) == 7   # True 는 이번 달
    assert '접점' not in m['defects'] and '없는유형' in m['defects']     # 켠 게 없는 유형은 버림 · 모르는 유형은 남되 안 센다
    assert m['summary'] == {'test': 2, 'market': 0, 'total': 2} and m['rung'] == 'test_all' and m['rung_index'] == 4
    assert out['data']['changes'][0]['after'] == 'performance|t3/m0'     # 이력엔 선택한 칸 수(모르는 유형 포함)
    # 시장 열을 선택하면 5
    out = _assess(client, auth, mx_user, p['id'], 'modeling', {
        'flags': ['performance'], 'note': 'x', 'evidence': {'defects': {'크랙': {'test': '2025-03', 'market': '2026-01'}}}})
    assert out['data']['assessments']['modeling']['rung_index'] == 5
    # 미래 달은 거절
    _assess(client, auth, mx_user, p['id'], 'modeling', {'flags': [], 'note': 'x', 'evidence': {'defects': {'크랙': {'test': '2099-01'}}}}, expect=400)
    # 불량 유형이 없는 시뮬레이션에 표를 보내면 거절, 바탕만은 된다
    b = client.post(f'{BASE}/agents', json={'division_id': world['mx'].id, 'name': '열 해석'}, headers=auth(mx_user)).get_json()['data']
    p2 = client.post(f'{BASE}/pairs', json={'subject_id': s['id'], 'agent_id': b['id']}, headers=auth(mx_user)).get_json()['data']
    _assess(client, auth, mx_user, p2['id'], 'modeling', {'flags': ['geometry'], 'note': 'x', 'evidence': {'defects': {'크랙': {'test': '2025-03'}}}}, expect=400)
    out = _assess(client, auth, mx_user, p2['id'], 'modeling', {'flags': ['geometry'], 'note': 'x'})
    assert out['data']['assessments']['modeling']['rung_index'] == 1


def test_불량_유형_표의_칸은_근거_없이_바로_켜고_끈다(client, auth, world, mx_user):
    s = client.post(f'{BASE}/subjects', json={'division_id': world['mx'].id, 'name': '낙하 시험'}, headers=auth(mx_user)).get_json()['data']
    a = client.post(f'{BASE}/agents', json={'division_id': world['mx'].id, 'name': '구조 해석', 'defect_types': ['크랙', '변색']}, headers=auth(mx_user)).get_json()['data']
    p = client.post(f'{BASE}/pairs', json={'subject_id': s['id'], 'agent_id': a['id']}, headers=auth(mx_user)).get_json()['data']

    def cell(name, col, month, expect=200):
        res = client.put(f'{BASE}/pairs/{p["id"]}/defects/modeling', json={'name': name, 'col': col, 'month': month}, headers=auth(mx_user))
        assert res.status_code == expect, res.get_json()
        return res.get_json().get('data')

    d = cell('크랙', 'test', '2025-03')                                   # 평가 줄이 없어도 「없음」 바탕으로 생긴다
    m = d['assessments']['modeling']
    assert m['flags'] == [] and m['defects'] == {'크랙': {'test': '2025-03'}} and m['rung_index'] == 3
    assert d['changes'][0]['after'] == 'none|t1/m0' and '선택' in d['changes'][0]['note']
    d = cell('크랙', 'market', True)                                        # True 는 이번 달
    assert d['assessments']['modeling']['rung_index'] == 5
    d = cell('크랙', 'test', None)                                          # 끔
    assert d['assessments']['modeling']['defects'] == {'크랙': {'market': d['assessments']['modeling']['defects']['크랙']['market']}}
    d = cell('크랙', 'market', None)
    assert d['assessments']['modeling']['defects'] == {} and d['assessments']['modeling']['rung_index'] == 0
    cell('없는유형', 'test', '2025-03', expect=400)
    cell('크랙', 'weird', '2025-03', expect=400)
    cell('크랙', 'test', '2099-01', expect=400)
    # 바탕을 근거와 함께 매겨도 표는 남는다
    cell('변색', 'test', '2025-06')
    out = _assess(client, auth, mx_user, p['id'], 'modeling', {'flags': ['performance'], 'note': '거동 확인',
                  'evidence': {'defects': {'변색': {'test': '2025-06'}}}})
    assert out['data']['assessments']['modeling']['rung_index'] == 3


def test_설정에서_뺀_조직은_사업부_목록과_전체_판에서_빠진다(client, auth, world, mx_user, office):
    vd = world['vd'].id
    res = client.put(f'{BASE}/settings', json={'hidden_divisions': [vd, 'x']}, headers=auth(office))
    assert res.status_code == 200
    ids = [d['id'] for d in client.get(f'{BASE}/divisions', headers=auth(mx_user)).get_json()['data']]
    assert vd not in ids and world['mx'].id in ids
    allrows = client.get(f'{BASE}/divisions?all=1', headers=auth(mx_user)).get_json()['data']
    assert any(d['id'] == vd and d['hidden'] for d in allrows)
    res = client.get(f'{BASE}/board?division_id=all', headers=auth(mx_user))
    assert vd not in [b['division_id'] for b in res.get_json()['data']['boards']]
    client.put(f'{BASE}/settings', json={'hidden_divisions': []}, headers=auth(office))
    ids = [d['id'] for d in client.get(f'{BASE}/divisions', headers=auth(mx_user)).get_json()['data']]
    assert vd in ids


def test_검토_대장은_건으로_쌓고_연간으로_센다(client, auth, world, mx_user, vd_user):
    mx = world['mx'].id
    a = client.post(f'{BASE}/agents', json={'division_id': mx, 'name': '폴딩 응력 해석'}, headers=auth(mx_user)).get_json()['data']

    def add(p, expect=201):
        res = client.post(f'{BASE}/reviews', json={'division_id': mx, **p}, headers=auth(mx_user))
        assert res.status_code == expect, res.get_json()
        return res.get_json().get('data')

    r1 = add({'month': '2026-03', 'kind': 'spec', 'item': '힌지 강성', 'agent_id': a['id'], 'timing': 'before_spec', 'decision': 'gate', 'basis': 'margin', 'lead_days': 4})
    assert r1['month'] == '2026-03-01' and r1['agent_name'] == '폴딩 응력 해석'
    add({'month': '2026-04', 'kind': 'spec', 'item': '힌지 강성', 'agent_name': '폴딩 응력 해석', 'timing': 'concept', 'decision': 'rule', 'basis': 'confirmed', 'lead_days': 2})
    add({'month': '2026-05', 'kind': 'spec', 'item': '힌지 강성', 'agent_name': '폴딩 응력 해석', 'timing': 'after_issue', 'decision': 'reference'})
    add({'month': '2026-06', 'kind': 'cause', 'item': '크랙', 'agent_name': '이름만 있는 해석', 'timing': 'after_issue', 'decision': 'change_basis', 'basis': '실측·시험 검증', 'lead_days': 6})
    add({'month': '2099-01', 'kind': 'spec', 'agent_name': 'x'}, expect=400)                       # 미래
    add({'month': '2026-01', 'kind': 'spec'}, expect=400)                                          # 시뮬레이션 없음
    add({'month': '2026-01', 'kind': 'spec', 'agent_name': 'x', 'timing': '이상한값'}, expect=400)
    add({'month': '2025-12', 'kind': 'spec', 'agent_name': 'x'})                                   # 작년

    rows = client.get(f'{BASE}/reviews?division_id={mx}&year=2026', headers=auth(mx_user)).get_json()['data']
    assert len(rows) == 4 and rows[0]['month'] == '2026-06-01'                                     # 늦은 달이 위
    assert [r['kind'] for r in client.get(f'{BASE}/reviews?division_id={mx}&year=2026&kind=cause', headers=auth(mx_user)).get_json()['data']] == ['cause']
    assert client.get(f'{BASE}/reviews/years?division_id={mx}', headers=auth(mx_user)).get_json()['data'] == [2026, 2025]

    s = client.get(f'{BASE}/reviews/stats?division_id={mx}&year=2026', headers=auth(mx_user)).get_json()['data']['kinds']
    assert s['spec']['count'] == 3 and s['spec']['early'] == 67 and s['spec']['gate'] == 67 and s['spec']['confirmed'] == 50
    assert s['spec']['lead_median'] == 3.0
    assert s['spec']['promote'] == [{'agent_name': '폴딩 응력 해석', 'item': '힌지 강성', 'count': 3}]   # 연 3건 → 정착 후보
    assert s['cause']['count'] == 1 and s['cause']['confirmed'] == 100 and s['cause']['promote'] == []

    allst = client.get(f'{BASE}/reviews/stats?division_id=all&year=2026', headers=auth(mx_user)).get_json()['data']
    assert any(d['division_id'] == mx and d['kinds']['spec']['count'] == 3 for d in allst['divisions'])

    # 고치기·지우기 — 자기 사업부만
    res = client.put(f'{BASE}/reviews/{r1["id"]}', json={'lead_days': 5, 'note': '두께 축소'}, headers=auth(mx_user))
    assert res.status_code == 200 and res.get_json()['data']['lead_days'] == 5
    assert client.put(f'{BASE}/reviews/{r1["id"]}', json={'note': 'x'}, headers=auth(vd_user)).status_code == 403
    assert client.delete(f'{BASE}/reviews/{r1["id"]}', headers=auth(mx_user)).status_code == 200
    assert len(client.get(f'{BASE}/reviews?division_id={mx}&year=2026', headers=auth(mx_user)).get_json()['data']) == 3


def test_검토_대장_CSV_는_틀_그대로_붙여_넣는다(client, auth, world, mx_user):
    mx = world['mx'].id
    res = client.get(f'{BASE}/reviews/template', headers=auth(mx_user))
    assert res.status_code == 200 and res.data.decode('utf-8-sig').startswith('연-월,종류,대상,항목,시뮬레이션')
    text = '연-월\t종류\t대상\t항목\t시뮬레이션\t시점\t결정 반영\t판정 근거\t리드타임(일)\t메모\n' \
           '2026-03\t설계 스펙 검토\tFold8\t힌지 강성\t폴딩 응력 해석\t스펙 확정 전\t스펙 확정 관문\t정량 마진 산출\t4\t두께 축소\n' \
           '2026-04\t원인 분석\t#1234\t크랙\t낙하 구조 해석\t문제 발생 후\t설계 변경 근거\t\t\t\n' \
           '2099-01\t설계 스펙 검토\t\t\t해석\t\t\t\t\t\n'
    res = client.post(f'{BASE}/reviews/import/preview', json={'division_id': mx, 'text': text}, headers=auth(mx_user))
    plan = res.get_json()['data']
    assert plan['count'] == 2 and len(plan['problems']) == 1 and plan['problems'][0]['line'] == 4
    assert plan['items'][0]['payload']['timing'] == '스펙 확정 전' and plan['items'][0]['agent_known'] is False
    res = client.post(f'{BASE}/reviews/import/apply', json={'division_id': mx, 'text': text}, headers=auth(mx_user))
    assert res.status_code == 400                                                                   # 문제 줄이 있으면 안 넣는다
    good = '\n'.join(text.split('\n')[:3]) + '\n'
    res = client.post(f'{BASE}/reviews/import/apply', json={'division_id': mx, 'text': good}, headers=auth(mx_user))
    assert res.status_code == 200 and res.get_json()['data']['created'] == 2
    rows = client.get(f'{BASE}/reviews?division_id={mx}&year=2026', headers=auth(mx_user)).get_json()['data']
    assert {r['timing'] for r in rows} == {'before_spec', 'after_issue'} and rows[1]['basis'] == 'margin'


# ── 디지털 스레드 ──────────────────────────────────────────────────────────

def test_스레드_사전은_처음_읽을_때_초안이_들어가고_사무국만_고친다(client, auth, world, mx_user, office):
    res = client.get(f'{BASE}/threads', headers=auth(mx_user))
    assert res.status_code == 200
    threads = res.get_json()['data']
    assert [t['key'] for t in threads] == ['simulation', 'cost', 'quality', 'manufacturing', 'bom_change']
    assert len(threads[1]['segments']) == 5 and threads[1]['segments'][0]['from_stage'] == 'planning'
    assert client.get(f'{BASE}/threads', headers=auth(mx_user)).get_json()['data'][0]['id'] == threads[0]['id']   # 멱등
    systems = client.get(f'{BASE}/systems', headers=auth(mx_user)).get_json()['data']
    assert {s['name'] for s in systems if s['kind'] == 'informal'} == set(D.INFORMAL_ITEMS)
    assert client.post(f'{BASE}/threads', json={'key': 'supply', 'name': '부품·공급망'}, headers=auth(mx_user)).status_code == 403
    res = client.post(f'{BASE}/threads', json={'key': 'supply', 'name': '부품·공급망 스레드'}, headers=auth(office))
    assert res.status_code == 201
    tid = res.get_json()['data']['id']
    res = client.post(f'{BASE}/threads/{tid}/segment-defs', json={'key': 'a', 'name': '부품 스펙 → 공급사', 'from_stage': 'development', 'to_stage': 'purchasing'}, headers=auth(office))
    assert res.status_code == 201
    assert client.post(f'{BASE}/threads/{tid}/segment-defs', json={'key': 'b', 'name': 'x', 'from_stage': 'nowhere', 'to_stage': 'purchasing'}, headers=auth(office)).status_code == 400


def test_구간을_적고_매기고_스레드로_센다(client, auth, world, mx_user, office):
    mx = world['mx'].id
    threads = client.get(f'{BASE}/threads', headers=auth(mx_user)).get_json()['data']
    cost = next(t for t in threads if t['key'] == 'cost')
    # 시스템 — 개발 조직이 적는다. 같은 이름은 거절
    plm = client.post(f'{BASE}/systems', json={'name': 'Teamcenter', 'kind': 'plm', 'link_means': 'api', 'stages': ['development']}, headers=auth(mx_user)).get_json()['data']
    costsys = client.post(f'{BASE}/systems', json={'name': '원가 산정 시스템', 'kind': 'cost'}, headers=auth(mx_user)).get_json()['data']
    assert client.post(f'{BASE}/systems', json={'name': 'Teamcenter', 'kind': 'plm'}, headers=auth(mx_user)).status_code == 400
    mail = next(s for s in client.get(f'{BASE}/systems', headers=auth(mx_user)).get_json()['data'] if s['name'] == '메일')
    # 조직 — 손으로 둘
    dev = client.post(f'{BASE}/orgs', json={'division_id': mx, 'name': 'MX 설계그룹', 'role': 'development'}, headers=auth(mx_user)).get_json()['data']
    fin = client.post(f'{BASE}/orgs', json={'division_id': mx, 'name': '원가팀', 'role': 'management'}, headers=auth(mx_user)).get_json()['data']
    # 구간 — 표준 구간 둘: 목표 원가→설계 BOM(API), 설계 BOM→예상 원가(메일 매개)
    d1, d2 = cost['segments'][0], cost['segments'][1]
    s1 = client.post(f'{BASE}/segments', json={'division_id': mx, 'segment_def_id': d1['id'], 'from_org_id': dev['id'], 'from_system_id': plm['id'], 'via_system_id': plm['id'], 'to_org_id': dev['id'], 'to_system_id': plm['id']}, headers=auth(mx_user))
    assert s1.status_code == 201, s1.get_json()
    s1 = s1.get_json()['data']
    assert s1['name'] == d1['name'] and s1['thread_key'] == 'cost' and s1['pair_id'] and s1['via_informal'] is False
    assert s1['data_kinds'] == ['cost', 'bom'] and s1['data_kind_labels'] == ['원가·단가', 'BOM(E/M)']      # 표준 구간의 기본값
    res = client.put(f'{BASE}/segments/{s1["id"]}', json={'data_kinds': ['bom', '단가표(엑셀)', 'bom']}, headers=auth(mx_user))
    assert res.get_json()['data']['data_kind_labels'] == ['BOM(E/M)', '단가표(엑셀)']                       # 직접 적은 것도, 겹침은 뺌
    s2 = client.post(f'{BASE}/segments', json={'division_id': mx, 'segment_def_id': d2['id'], 'from_org_id': dev['id'], 'from_system_id': plm['id'], 'via_system_id': mail['id'], 'to_org_id': fin['id'], 'to_system_id': costsys['id']}, headers=auth(mx_user)).get_json()['data']
    assert s2['via_informal'] is True
    # 매기기 — 기존 평가 API 그대로. 비시스템 매개면 연결 방식은 둘째 칸까지
    _assess(client, auth, mx_user, s1['pair_id'], 'link_mode', {'rung': 'integrated', 'note': 'PLM 내부 링크'})
    _assess(client, auth, mx_user, s2['pair_id'], 'link_mode', {'rung': 'auto_transfer', 'note': 'x'}, expect=400)     # 비시스템 매개면 첫 칸만
    _assess(client, auth, mx_user, s2['pair_id'], 'link_mode', {'rung': 'manual', 'note': '엑셀 메일'})
    out = _assess(client, auth, mx_user, s1['pair_id'], 'capture', {'rung': 'auto', 'note': 'PLM 자동 등록', 'evidence': {'coverage_pct': '85'}})
    assert out['data']['assessments']['capture']['evidence'] == {'coverage_pct': 85.0}
    _assess(client, auth, mx_user, s2['pair_id'], 'capture', {'rung': 'upload', 'note': '담당자 엑셀을 월말에 올림'})
    _assess(client, auth, mx_user, s1['pair_id'], 'usage', {'rung': 'decision', 'note': '원가 승인 근거'})
    out = _assess(client, auth, mx_user, s2['pair_id'], 'quality', {'rung': 'unknown', 'note': '마스터 담당 확인 필요'})   # 「모름」
    q = out['data']['assessments']['quality']
    assert q['rung'] == 'unknown' and q['rung_index'] is None and q['unknown'] is True
    _assess(client, auth, mx_user, s2['pair_id'], 'quality', {'rung': 'nope', 'note': 'x'}, expect=400)
    # 스레드 셈 — 재료비: 구간 2, 이어진 1(50%), 도달 단계는 첫 구간의 to(개발), 최약은 s2, 비시스템 50%, 수집률 50, 활용률 100(매긴 것 중), 확인 필요 1
    st = client.get(f'{BASE}/threads/stats?division_id={mx}', headers=auth(mx_user)).get_json()['data']['threads']
    c = next(t for t in st if t['thread_key'] == 'cost')
    assert c['segment_count'] == 2 and c['assessed'] == 2 and c['continuity'] == 50
    assert c['reach_stage'] == 'development' and c['weakest']['id'] == s2['id'] and c['informal_ratio'] == 50 and c['closed_loop'] is False
    assert c['capture_rate'] == 50 and c['usage_rate'] == 100 and c['unknown'] == 1
    assert c['weak_axis']['segment_id'] == s2['id'] and c['weak_axis']['axis'] in ('link_mode', 'capture')
    # 덮어쓰기 알림 — 그 사이 남이 같은 축을 고쳤으면 409 로 돌려보낸다(같은 축일 때만)
    _stale_pair = s1['pair_id']
    base = client.get(f'{BASE}/pairs/{_stale_pair}', headers=auth(mx_user)).get_json()['data']
    old_at = base['assessments']['link_mode']['assessed_at']
    _assess(client, auth, mx_user, _stale_pair, 'link_mode', {'rung': 'auto_transfer', 'note': '먼저 고침'})
    res = client.put(f'{BASE}/pairs/{_stale_pair}/assessments/link_mode',
                     json={'rung': 'manual', 'note': '늦게 고침', 'base_assessed_at': old_at}, headers=auth(mx_user))
    assert res.status_code == 409 and '다시 읽고' in res.get_json()['message']
    after = client.get(f'{BASE}/pairs/{_stale_pair}', headers=auth(mx_user)).get_json()['data']
    assert after['assessments']['link_mode']['rung'] == 'auto_transfer'          # 덮이지 않았다
    # 최신 시각을 들고 오면 저장된다
    ok = client.put(f'{BASE}/pairs/{_stale_pair}/assessments/link_mode',
                    json={'rung': 'manual', 'note': '다시 읽고 고침',
                          'base_assessed_at': after['assessments']['link_mode']['assessed_at']}, headers=auth(mx_user))
    assert ok.status_code == 200 and ok.get_json()['data']['assessments']['link_mode']['rung'] == 'manual'
    # 부딪히는 것은 **같은 축**뿐이다 — 연결이 그 사이 두 번 바뀌었어도 확보 축은 제 시각만 맞으면 저장된다
    fresh = client.get(f'{BASE}/pairs/{_stale_pair}', headers=auth(mx_user)).get_json()['data']
    other = client.put(f'{BASE}/pairs/{_stale_pair}/assessments/capture',
                       json={'rung': 'auto', 'note': '다른 축', 'evidence': {'coverage_pct': '90'},
                             'base_assessed_at': fresh['assessments']['capture']['assessed_at']}, headers=auth(mx_user))
    assert other.status_code == 200

    # 일괄 입력 — 추출과 같은 머리글의 표를 붙여넣어 한 번에 세운다
    kinds = client.get(f'{BASE}/bulk/kinds?sector=digital_thread&division_id={mx}', headers=auth(mx_user)).get_json()['data']
    assert [k['key'] for k in kinds] == ['system', 'org', 'segment']
    # 열마다 고를 수 있는 값을 함께 준다 — 화면이 드롭다운을 그린다(부문마다 빠뜨리기 쉬운 자리)
    sys_choices = next(k for k in kinds if k['key'] == 'system')['choices']
    assert '종류' in sys_choices and 'PLM' in sys_choices['종류']
    assert '연계 수단' in sys_choices and '상태' in sys_choices
    seg_choices = next(k for k in kinds if k['key'] == 'segment')['choices']
    assert seg_choices['스레드'] and seg_choices['데이터 종류']
    sim = client.get(f'{BASE}/bulk/kinds?sector=simulation&division_id={mx}', headers=auth(mx_user)).get_json()['data']
    assert next(k for k in sim if k['key'] == 'agent')['choices']['모델 종류']
    table = _table(('시스템', '종류', '연계 수단'),
                   ('일괄 PLM', 'PLM', 'API 있음'),
                   ('일괄 MES', 'MES', '파일 배치'),
                   ('일괄 PLM', 'PLM', ''))
    def _bulk(text, dry, kind='system'):
        return client.post(f'{BASE}/bulk', json={'division_id': mx, 'sector': 'digital_thread', 'kind': kind,
                                                 'text': text, 'dry_run': dry}, headers=auth(mx_user))
    dry = _bulk(table, True).get_json()['data']
    assert dry['summary'] == {'rows': 3, 'new': 2, 'exists': 1, 'errors': 0}      # 셋째 줄은 첫 줄과 같은 이름
    assert not [x for x in _sys_names(client, auth, mx_user) if x.startswith('일괄')]   # 미리보기는 저장하지 않는다
    assert _bulk(table, False).get_json()['data']['summary']['new'] == 2
    names = _sys_names(client, auth, mx_user)
    assert '일괄 PLM' in names and '일괄 MES' in names
    # 다시 올려도 같다 — 이름이 같으면 새로 만들지 않는다
    again = _bulk(table, False).get_json()['data']
    assert again['summary']['new'] == 0 and again['summary']['exists'] == 3
    # 모르는 값은 그 줄만 오류로 남고 나머지는 들어간다
    bad = _bulk(_table(('시스템', '종류'), ('일괄 QMS', '없는종류'), ('일괄 CAD', 'CAD')), False).get_json()['data']
    assert bad['summary']['errors'] == 1 and bad['summary']['new'] == 1
    assert '없는종류' in bad['rows'][0]['message']
    # 머리글이 틀리면 표 전체를 거절하고 무엇이 없는지 말한다
    res = _bulk(_table(('이름', '종류'), ('A', 'PLM')), True)
    assert res.status_code == 400 and '머리글' in res.get_json()['message']

    # 전사 연계 개발 기록 — division_id=all (시스템 창)
    _ = client.get(f'{BASE}/thread-cases?division_id=all', headers=auth(mx_user))
    assert _.status_code == 200 and isinstance(_.get_json()['data'], list)
    # 전사 구간 — division_id=all (시스템 연결도)
    alls = client.get(f'{BASE}/segments?division_id=all', headers=auth(mx_user)).get_json()['data']
    assert {x['id'] for x in alls} >= {s1['id'], s2['id']}
    # 조직 연계표 · 시스템 허브
    m = client.get(f'{BASE}/threads/org-matrix?division_id={mx}', headers=auth(mx_user)).get_json()['data']
    assert any(x['from_org'] == 'MX 설계그룹' and x['to_org'] == '원가팀' and x['count'] == 1 and x['min_link_label'] == '사람이 옮김' and '메일' in x['systems'] for x in m)
    hubs = client.get(f'{BASE}/systems/hubs?division_id={mx}', headers=auth(mx_user)).get_json()['data']
    assert hubs[0]['name'] == 'Teamcenter' and hubs[0]['segments'] == 4 and hubs[0]['threads'] == 1
    # 판에도 구간이 대상으로 뜬다(수단 없는 연계)
    b = client.get(f'{BASE}/board?division_id={mx}&sector=digital_thread', headers=auth(mx_user)).get_json()['data']
    assert {s['name'] for s in b['subjects']} == {d1['name'], d2['name']} and b['subjects'][0]['pairs'][0]['agent'] is None
    # 매개를 공식 시스템으로 바꾸면 API 를 고를 수 있다
    client.put(f'{BASE}/segments/{s2["id"]}', json={'via_system_id': plm['id']}, headers=auth(mx_user))
    _assess(client, auth, mx_user, s2['pair_id'], 'link_mode', {'rung': 'integrated', 'note': '허브 연동'})
    # 정돈 — TC 를 Teamcenter 로 합치면 구간이 옮겨 가고 TC 는 사라진다
    tc = client.post(f'{BASE}/systems', json={'name': 'TC', 'kind': 'plm'}, headers=auth(mx_user)).get_json()['data']
    client.put(f'{BASE}/segments/{s1["id"]}', json={'to_system_id': tc['id']}, headers=auth(mx_user))
    assert client.post(f'{BASE}/systems/merge', json={'keep_id': plm['id'], 'drop_id': tc['id']}, headers=auth(mx_user)).status_code == 403
    res = client.post(f'{BASE}/systems/merge', json={'keep_id': plm['id'], 'drop_id': tc['id']}, headers=auth(office))
    assert res.status_code == 200 and res.get_json()['data']['moved'] == 1
    assert 'TC' not in {s['name'] for s in client.get(f'{BASE}/systems', headers=auth(mx_user)).get_json()['data']}
    # 지우면 대상·연계·평가가 같이 간다
    assert client.delete(f'{BASE}/segments/{s1["id"]}', headers=auth(mx_user)).get_json()['data']['assessments'] == 3   # 연결·확보·활용


def test_연계_개발_기록은_건으로_쌓고_올라간_칸을_센다(client, auth, world, mx_user, vd_user):
    mx = world['mx'].id
    threads = client.get(f'{BASE}/threads', headers=auth(mx_user)).get_json()['data']
    cost = next(t for t in threads if t['key'] == 'cost')
    plm = client.post(f'{BASE}/systems', json={'name': 'Teamcenter', 'kind': 'plm'}, headers=auth(mx_user)).get_json()['data']
    seg = client.post(f'{BASE}/segments', json={'division_id': mx, 'segment_def_id': cost['segments'][1]['id'], 'via_system_id': plm['id']}, headers=auth(mx_user)).get_json()['data']

    def add(p, expect=201):
        res = client.post(f'{BASE}/thread-cases', json={'division_id': mx, **p}, headers=auth(mx_user))
        assert res.status_code == expect, res.get_json()
        return res.get_json().get('data')

    c1 = add({'month': '2026-03', 'action': 'integrate', 'segment_id': seg['id'], 'system_id': plm['id'], 'link_from': 'manual', 'link_to': 'integrated', 'note': '허브 연동'})
    assert c1['thread_name'] == '재료비 스레드' and c1['segment_name'] == seg['name'] and c1['lift'] == 2 and c1['status'] == 'done'
    add({'month': '2026-05', 'action': 'adopt', 'system_name': 'SPDM(새 시스템)', 'status': 'doing'})
    add({'month': '2026-06', 'action': 'harmonize', 'system_id': plm['id'], 'link_from': 'integrated', 'link_to': 'closed_loop', 'status': 'planned'})
    add({'month': '2026-01', 'action': 'weird', 'system_id': plm['id']}, expect=400)
    add({'month': '2026-01', 'action': 'integrate'}, expect=400)                                   # 시스템도 구간도 없음
    add({'month': '2026-01', 'action': 'integrate', 'system_id': plm['id'], 'link_to': 'nope'}, expect=400)
    rows = client.get(f'{BASE}/thread-cases?division_id={mx}&year=2026', headers=auth(mx_user)).get_json()['data']
    assert [r['action'] for r in rows] == ['harmonize', 'adopt', 'integrate']
    assert [r['status'] for r in client.get(f'{BASE}/thread-cases?division_id={mx}&year=2026&status=doing', headers=auth(mx_user)).get_json()['data']] == ['doing']
    st = client.get(f'{BASE}/thread-cases/stats?division_id={mx}&year=2026', headers=auth(mx_user)).get_json()['data']
    assert st['count'] == 3 and st['by_action'] == {'integrate': 1, 'adopt': 1, 'harmonize': 1} and st['by_status']['done'] == 1
    assert st['lift'] == 2 and st['systems'][0] == {'name': 'Teamcenter', 'count': 2}     # 완료 건의 올라간 칸만
    assert client.get(f'{BASE}/thread-cases/years?division_id={mx}', headers=auth(mx_user)).get_json()['data'] == [2026]
    assert client.put(f'{BASE}/thread-cases/{c1["id"]}', json={'note': 'x'}, headers=auth(vd_user)).status_code == 403
    res = client.put(f'{BASE}/thread-cases/{c1["id"]}', json={'status': 'doing', 'link_to': 'closed_loop'}, headers=auth(mx_user))
    assert res.status_code == 200 and res.get_json()['data']['lift'] == 3
    assert client.delete(f'{BASE}/thread-cases/{c1["id"]}', headers=auth(mx_user)).status_code == 200
