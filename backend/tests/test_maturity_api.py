# -*- coding: utf-8 -*-
"""성숙도 API 시험. (PLAN 9절 B 판)

**여기서 지키는 것은 판단의 규칙이다.**

  · 근거 없이 저장되는가 — 되면 척도가 인상평이 된다
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
    assert {s['name'] for s in systems if s['kind'] == 'informal'} == {x['label'] for x in D.INFORMAL_ITEMS}
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
    assert dry['summary'] == {'rows': 3, 'new': 2, 'exists': 1, 'updated': 0, 'errors': 0}   # 셋째 줄은 첫 줄과 같은 이름
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


def test_기준_정보는_설정에서_고치고_고친_말이_모든_문으로_나간다(client, auth, world, mx_user, office):
    """선택지를 코드에 박아 두면 말을 바꿀 때마다 배포해야 한다. 설정이 코드를 이긴다.

    ⚠️ key 는 자료에 박히는 값이라 안 바뀐다 — 지운 값을 쓰던 자료는 그대로 남는다.
    """
    mx = world['mx'].id
    vocabs = client.get(f'{BASE}/vocabs', headers=auth(mx_user)).get_json()['data']
    by = {v['key']: v for v in vocabs}
    assert '시스템 종류' in {v['label'] for v in vocabs}
    assert all(v['is_custom'] is False for v in vocabs)          # 처음엔 코드의 값 그대로

    # 사무국만 고친다
    kinds = by['system_kinds']['items']
    assert client.put(f'{BASE}/settings', json={'vocab': {'system_kinds': kinds}},
                      headers=auth(mx_user)).status_code == 403

    # 말을 고치고, 하나 더하고, 하나 뺀다
    edited = [{**kinds[0], 'label': '제품 수명주기 관리'}] + kinds[2:] + [{'key': 'wms', 'label': '창고 관리'}]
    res = client.put(f'{BASE}/settings', json={'vocab': {'system_kinds': edited}}, headers=auth(office))
    assert res.status_code == 200
    now = {v['key']: v for v in client.get(f'{BASE}/vocabs', headers=auth(mx_user)).get_json()['data']}
    assert now['system_kinds']['is_custom'] is True
    labels = [x['label'] for x in now['system_kinds']['items']]
    assert labels[0] == '제품 수명주기 관리' and '창고 관리' in labels
    assert len(labels) == len(kinds)                              # 하나 빼고 하나 더했다
    assert now['thread_stages']['is_custom'] is False             # 손 안 댄 사전은 그대로

    # 나가는 문마다 같은 말 — 정의, 일괄 입력의 선택지, 그리고 저장 검사
    defs = client.get(f'{BASE}/definitions', headers=auth(mx_user)).get_json()['data']
    assert '제품 수명주기 관리' in [x['label'] for x in defs['thread']['system_kinds']]
    kinds_api = client.get(f'{BASE}/bulk/kinds?sector=digital_thread&division_id={mx}',
                           headers=auth(mx_user)).get_json()['data']
    assert '제품 수명주기 관리' in next(k for k in kinds_api if k['key'] == 'system')['choices']['종류']
    assert client.post(f'{BASE}/systems', json={'name': '창고', 'kind': 'wms'},
                       headers=auth(mx_user)).status_code == 201          # 새로 더한 값도 받는다
    assert client.post(f'{BASE}/systems', json={'name': '없는 종류', 'kind': 'nope'},
                       headers=auth(mx_user)).status_code == 400

    # 빈 이름·겹친 key·모르는 사전은 버린다. 다 버려지면 코드의 기본으로 돌아간다.
    client.put(f'{BASE}/settings', json={'vocab': {
        'system_kinds': [{'key': 'plm', 'label': 'PLM'}, {'key': 'plm', 'label': '겹침'},
                         {'key': 'x', 'label': '  '}, '줄이 아님'],
        'nope': [{'key': 'a', 'label': 'A'}],
        'thread_stages': [],
    }}, headers=auth(office))
    after = {v['key']: v for v in client.get(f'{BASE}/vocabs', headers=auth(mx_user)).get_json()['data']}
    assert [x['key'] for x in after['system_kinds']['items']] == ['plm']
    assert after['thread_stages']['is_custom'] is False           # 빈 목록은 화면을 못 쓰게 만든다 — 되돌린다
    assert 'nope' not in {v['key'] for v in after.values()}
    # 지운 값을 쓰던 자료는 남는다 — 없는 말로 조용히 바뀌지 않는다
    assert 'wms' in {s['kind'] for s in client.get(f'{BASE}/systems', headers=auth(mx_user)).get_json()['data']}


def test_척도_문구도_기준_정보에서_고치되_칸은_못_늘린다(client, auth, world, mx_user, office):
    """평가할 때 고르는 칸이 가장 큰 선택지인데 고칠 길이 없었다(설정 키만 있고 화면이 없었다).

    ⚠️ 칸의 key 는 평가·이력이 묶인 자리다 — **문구만** 바뀌고 칸은 늘지도 줄지도 않는다.
    """
    mx = world['mx'].id
    rows = client.get(f'{BASE}/vocabs', headers=auth(mx_user)).get_json()['data']
    by = {v['key']: v for v in rows}

    # 여태 빠져 있던 것들이 들어왔다
    assert '비시스템 매개' in {v['label'] for v in rows}
    assert by['accuracy_rules']['fixed'] is True and by['informal_items']['fixed'] is False
    ladder = by['ladder:simulation:automation']
    assert ladder['fixed'] is True and ladder['has_description'] is True and ladder['sector_label'] == '시뮬레이션'
    assert [x['key'] for x in ladder['items']] == ['manual', 'pre', 'run', 'post', 'report', 'pipeline']
    assert all(v['store'] in ('vocab', 'ladders', 'sector_words') for v in rows)

    # 문구를 고친다 — 칸을 더하려 해도 안 는다
    edited = [{**x} for x in ladder['items']]
    edited[1] = {**edited[1], 'label': '앞단 자동', 'description': '형상·메시가 자동'}
    res = client.put(f'{BASE}/settings', json={'ladders': {'simulation': {
        'automation': {'label': '해석 자동화', 'question': '어디까지 저절로 도는가',
                       'rungs': edited + [{'key': '__new__', 'label': '몰래 넣은 칸'}]},
        'nope': {'rungs': [{'key': 'x', 'label': 'x'}]},
    }}}, headers=auth(office))
    assert res.status_code == 200
    axes = client.get(f'{BASE}/definitions', headers=auth(mx_user)).get_json()['data']['axes']['simulation']
    automation = next(a for a in axes if a['key'] == 'automation')
    assert automation['label'] == '해석 자동화' and automation['question'] == '어디까지 저절로 도는가'
    rungs = automation['rungs']
    assert [r['key'] for r in rungs] == ['manual', 'pre', 'run', 'post', 'report', 'pipeline']   # 칸은 그대로
    assert rungs[1]['label'] == '앞단 자동' and rungs[1]['description'] == '형상·메시가 자동'
    after = {v['key']: v for v in client.get(f'{BASE}/vocabs', headers=auth(mx_user)).get_json()['data']}
    assert after['ladder:simulation:automation']['is_custom'] is True
    assert after['ladder:simulation:accuracy']['is_custom'] is False

    # 못 박힌 사전도 마찬가지 — 문구만 바뀌고 줄은 안 는다
    client.put(f'{BASE}/settings', json={'vocab': {'accuracy_rules': [
        {'key': 'auto', 'label': '자동(사업부 규칙)'}, {'key': 'zzz', 'label': '없는 규칙'}]}}, headers=auth(office))
    rules = client.get(f'{BASE}/definitions', headers=auth(mx_user)).get_json()['data']['accuracy_rules']
    assert [r['key'] for r in rules] == ['auto', 'mean', 'single']
    assert rules[0]['label'] == '자동(사업부 규칙)'

    # 비시스템 매개 — 더한 것은 시스템 사전에 줄로 선다
    items = by['informal_items']['items']
    client.put(f'{BASE}/settings', json={'vocab': {'informal_items': items + [{'key': 'call', 'label': '전화'}]}},
               headers=auth(office))
    names = {s['name'] for s in client.get(f'{BASE}/systems', headers=auth(mx_user)).get_json()['data']
             if s['kind'] == 'informal'}
    assert '전화' in names and '메일' in names
    assert '전화' in client.get(f'{BASE}/definitions', headers=auth(mx_user)).get_json()['data']['thread']['informal_items']
    _ = mx


def test_축의_문구와_부문의_말도_기준_정보에서_고친다(client, auth, world, mx_user, office):
    """칸만 고칠 수 있으면 반쪽이다 — 축 이름·묻는 것·바탕·열, 그리고 부문의 이름표까지.

    ⚠️ 어느 것도 **줄을 늘리지 않는다.** 화면의 짜임과 이력이 key 로 묶여 있다.
    """
    rows = client.get(f'{BASE}/vocabs', headers=auth(mx_user)).get_json()['data']
    by = {v['key']: v for v in rows}

    # ① 모델링 수준에는 바탕·열이 딸린다 — 여태 고칠 길이 없던 자리
    modeling = by['ladder:simulation:modeling']
    assert [f['key'] for f in modeling['fields']] == ['label', 'question', 'evidence_label']
    assert [x['key'] for x in modeling['extras']] == ['base', 'columns']
    client.put(f'{BASE}/settings', json={'ladders': {'simulation': {'modeling': {
        'evidence_label': '불량 표',
        'base': [{'key': 'geometry', 'label': '형상만'}, {'key': '__no__', 'label': '몰래'}],
        'columns': [{'key': 'market', 'label': '시장 재현', 'short': '시장'}],
    }}}}, headers=auth(office))
    axis = next(a for a in client.get(f'{BASE}/definitions', headers=auth(mx_user)).get_json()['data']['axes']['simulation']
                if a['key'] == 'modeling')
    assert axis['evidence_label'] == '불량 표'
    assert [b['key'] for b in axis['base']] == ['geometry', 'performance']       # 줄은 안 는다
    assert axis['base'][0]['label'] == '형상만' and axis['base'][1]['label'] == '거동 재현'
    assert next(c for c in axis['columns'] if c['key'] == 'market')['label'] == '시장 재현'

    # ② 부문의 말 — 화면 전체의 이름표
    words = by['sector_words']
    assert words['fixed'] is True and words['sector_label'] == '공통'
    assert {'simulation:subject_label', 'manufacturing_monitoring:agent_label'} <= {x['key'] for x in words['items']}
    assert 'digital_thread:agent_label' not in {x['key'] for x in words['items']}   # 수단 없는 부문은 자리도 없다
    client.put(f'{BASE}/settings', json={'sector_words': {
        'simulation': {'subject_label': '검증 항목'},
        'nope': {'label': 'x'},
    }}, headers=auth(office))
    sec = next(s for s in client.get(f'{BASE}/definitions', headers=auth(mx_user)).get_json()['data']['sectors']
               if s['key'] == 'simulation')
    assert sec['subject_label'] == '검증 항목' and sec['agent_label'] == '시뮬레이션'
    # 일괄 입력의 갈래 이름도 같이 따라온다 — 한 군데만 고쳐지면 화면끼리 말이 어긋난다
    kinds = client.get(f'{BASE}/bulk/kinds?sector=simulation&division_id={world["mx"].id}',
                       headers=auth(mx_user)).get_json()['data']
    assert next(k for k in kinds if k['key'] == 'subject')['label'] == '검증 항목'


def test_기준_정보에서_빼도_자료는_지키고_점검에서_옮긴다(client, auth, world, mx_user, office):
    """빼는 것은 목록에서 빼는 것이지 자료를 지우는 것이 아니다.

    ⚠️ 예전에는 두 가지로 굴었다 — 생애 단계는 **말없이 걸러졌고**(자료가 조용히 줄었다),
       종류·수단·상태는 저장이 통째로 막혀 그 줄을 아예 못 고쳤다. 둘 다 고쳤다.
    """
    mx = world['mx'].id
    client.get(f'{BASE}/threads', headers=auth(mx_user))          # 사전 초안
    sysrow = client.post(f'{BASE}/systems', json={'name': '옛 시스템', 'kind': 'plm', 'link_means': 'api',
                                                 'status': 'active', 'stages': ['planning', 'development']},
                         headers=auth(mx_user)).get_json()['data']

    # 기준 정보에서 plm 과 planning 을 뺀다
    kinds = [k for k in D.vocab('system_kinds') if k['key'] != 'plm']
    stages = [x for x in D.vocab('thread_stages') if x['key'] != 'planning']
    assert client.put(f'{BASE}/settings', json={'vocab': {'system_kinds': kinds, 'thread_stages': stages}},
                      headers=auth(office)).status_code == 200

    # ① 자료는 그대로다
    got = next(x for x in client.get(f'{BASE}/systems', headers=auth(mx_user)).get_json()['data']
               if x['id'] == sysrow['id'])
    assert got['kind'] == 'plm' and 'planning' in got['stages']

    # ② 다른 칸을 고쳐도 저장이 막히지 않는다 — 없는 값을 그대로 되보내도 통과
    res = client.put(f'{BASE}/systems/{sysrow["id"]}',
                     json={'owner_org': 'PLM 운영팀', 'kind': 'plm', 'link_means': 'api',
                           'status': 'active', 'stages': ['planning', 'development']}, headers=auth(office))
    assert res.status_code == 200, res.get_json()
    kept = res.get_json()['data']
    assert kept['kind'] == 'plm' and kept['stages'] == ['planning', 'development']   # 말없이 줄지 않는다
    # 새로 없는 값을 넣는 것은 여전히 막는다
    assert client.put(f'{BASE}/systems/{sysrow["id"]}', json={'kind': 'nope'}, headers=auth(office)).status_code == 400

    # ③ 점검 — 어긋난 값을 세어 준다
    scan = client.get(f'{BASE}/vocabs/mismatches', headers=auth(mx_user)).get_json()['data']
    by = {m['vocab']: m for m in scan}
    plm = next(b for b in by['system_kinds']['bad'] if b['value'] == 'plm')
    assert plm['count'] >= 1 and '시스템 사전 — 종류' in plm['where']
    planning = next(b for b in by['thread_stages']['bad'] if b['value'] == 'planning')
    assert planning['count'] >= 1                                   # 시스템의 생애 단계 + 구간의 출발 단계
    assert {'시스템 사전 — 생애 단계', '스레드 구간 — 출발 단계'} <= set(planning['where'])
    assert by['system_kinds']['can_clear'] is False                 # 종류는 비울 수 없다

    # ④ 지금 있는 값으로 한꺼번에 옮긴다 — 사무국만
    assert client.post(f'{BASE}/vocabs/remap', json={'vocab': 'system_kinds', 'moves': [{'from': 'plm', 'to': 'mes'}]},
                       headers=auth(mx_user)).status_code == 403
    assert client.post(f'{BASE}/vocabs/remap', json={'vocab': 'system_kinds', 'moves': [{'from': 'plm', 'to': '없음'}]},
                       headers=auth(office)).status_code == 400     # 지금 목록에 없는 값으로는 못 옮긴다
    assert client.post(f'{BASE}/vocabs/remap', json={'vocab': 'system_kinds', 'moves': [{'from': 'plm', 'to': ''}]},
                       headers=auth(office)).status_code == 400     # 비울 수 없는 칸
    out = client.post(f'{BASE}/vocabs/remap', json={'vocab': 'system_kinds', 'moves': [{'from': 'plm', 'to': 'mes'}]},
                      headers=auth(office)).get_json()['data']
    assert out['rows'] >= 1
    moved = next(x for x in client.get(f'{BASE}/systems', headers=auth(mx_user)).get_json()['data']
                 if x['id'] == sysrow['id'])
    assert moved['kind'] == 'mes'

    # ⑤ 여럿인 칸(생애 단계)도 옮긴다 — 겹치면 하나로 모은다
    client.post(f'{BASE}/vocabs/remap', json={'vocab': 'thread_stages', 'moves': [{'from': 'planning', 'to': 'development'}]},
                headers=auth(office))
    after = next(x for x in client.get(f'{BASE}/systems', headers=auth(mx_user)).get_json()['data']
                 if x['id'] == sysrow['id'])
    assert after['stages'] == ['development']

    # ⑥ 다 옮기고 나면 그 사전은 깨끗하다
    scan2 = {m['vocab']: m for m in client.get(f'{BASE}/vocabs/mismatches', headers=auth(mx_user)).get_json()['data']}
    assert not [b for b in scan2['system_kinds']['bad'] if b['value'] == 'plm']
    assert not [b for b in scan2['thread_stages']['bad'] if b['value'] == 'planning']
    _ = mx


def test_정착_후보를_상시_시험_항목으로_올린다(client, auth, world, mx_user, vd_user):
    """되풀이되는 스팟 해석은 상시 항목이 되어야 한다 — 여태 세어만 주고 올릴 길이 없었다.

    ⚠️ 평가는 만들지 않는다. 근거 없이 저장 못 하는 규칙(assess)을 우회하게 된다.
    """
    mx = world['mx'].id
    agent = client.post(f'{BASE}/agents', json={'division_id': mx, 'name': '낙하 해석'},
                        headers=auth(mx_user)).get_json()['data']

    def _case(item, month):
        return client.post(f'{BASE}/reviews', json={
            'division_id': mx, 'kind': 'spec', 'month': month, 'target': 'A제품', 'item': item,
            'agent_id': agent['id'], 'timing': 'before_spec', 'decision': 'gate', 'basis': 'confirmed',
        }, headers=auth(mx_user))

    for m in ('2026-01', '2026-03', '2026-05'):
        assert _case('모서리 낙하', m).status_code == 201
    _case('한 번뿐', '2026-02')

    def _promote_list():
        st = client.get(f'{BASE}/reviews/stats?division_id={mx}&year=2026', headers=auth(mx_user)).get_json()['data']
        return st['kinds']['spec']['promote']

    # ① 세 건 이상만 후보 — 한 번뿐인 것은 아니다
    cands = _promote_list()
    assert [(c['item'], c['count']) for c in cands] == [('모서리 낙하', 3)]

    # ② 남의 사업부는 못 올린다
    assert client.post(f'{BASE}/reviews/promote', json={'division_id': mx, 'agent_name': '낙하 해석',
                                                        'item': '모서리 낙하'}, headers=auth(vd_user)).status_code == 403

    # ③ 올리면 시험 항목 × 시뮬레이션 연계가 선다 — 이름은 고칠 수 있다
    res = client.post(f'{BASE}/reviews/promote',
                      json={'division_id': mx, 'agent_name': '낙하 해석', 'item': '모서리 낙하',
                            'subject_name': '모서리 낙하 시험'}, headers=auth(mx_user))
    assert res.status_code == 201, res.get_json()
    out = res.get_json()['data']
    assert out['made'] == {'subject': True, 'agent': False, 'pair': True} and out['cases'] == 3

    pair = client.get(f'{BASE}/pairs/{out["pair_id"]}', headers=auth(mx_user)).get_json()['data']
    assert pair['subject']['name'] == '모서리 낙하 시험' and pair['agent']['name'] == '낙하 해석'
    assert all(v is None for v in pair['assessments'].values())   # ⚠️ 평가는 안 만든다 — 근거는 사람이 적는다

    # ④ 올린 짝은 후보에서 빠진다 — 안 그러면 해마다 같은 제안이 온다
    assert _promote_list() == []
    # 기록은 그대로 남고, 올라간 건은 어느 연계로 갔는지 스스로 안다
    # ⚠️ 이름으로 밟으면 여기서 끊긴다 — 기록의 「모서리 낙하」와 항목 「모서리 낙하 시험」은 다른 글자다
    kept = client.get(f'{BASE}/reviews?division_id={mx}&year=2026', headers=auth(mx_user)).get_json()['data']
    assert len(kept) == 4
    assert [r['promoted_pair_id'] for r in kept if r['item'] == '모서리 낙하'] == [out['pair_id']] * 3
    assert [r['promoted_pair_id'] for r in kept if r['item'] == '한 번뿐'] == [None]

    # ⑤ 두 번 눌러도 하나다(멱등)
    again = client.post(f'{BASE}/reviews/promote',
                        json={'division_id': mx, 'agent_name': '낙하 해석', 'item': '모서리 낙하',
                              'subject_name': '모서리 낙하 시험'}, headers=auth(mx_user)).get_json()['data']
    assert again['pair_id'] == out['pair_id'] and again['made'] == {'subject': False, 'agent': False, 'pair': False}

    # ⑥ 사전에 없는 시뮬레이션은 묻고 나서 만든다
    blocked = client.post(f'{BASE}/reviews/promote', json={'division_id': mx, 'agent_name': '없는 해석',
                                                           'item': '굽힘'}, headers=auth(mx_user))
    assert blocked.status_code == 400 and '사전에 없습니다' in blocked.get_json()['message']
    made = client.post(f'{BASE}/reviews/promote', json={'division_id': mx, 'agent_name': '없는 해석',
                                                        'item': '굽힘', 'make_agent': True},
                       headers=auth(mx_user)).get_json()['data']
    assert made['made'] == {'subject': True, 'agent': True, 'pair': True}


def test_포탈_부서는_저절로_들어오고_없어져도_지우지_않는다(client, auth, db, world, mx_user, office):
    """단추를 눌러야 채워지면 대개 안 채워진다 — 목록을 읽을 때마다 맞춰 온다(2026-08-30).

    ⚠️ 없어진 부서를 자동으로 지우면 구간이 가리키던 조직이 말없이 사라진다.
    """
    from app.modules.digital_twin_dashboard.models import Department
    mx = world['mx'].id

    def _orgs():
        return client.get(f'{BASE}/orgs?division_id={mx}', headers=auth(mx_user)).get_json()['data']

    d1 = Department(division_id=mx, name='CAE그룹(MX)', is_active=True)
    d2 = Department(division_id=mx, name='Mecha그룹(MX)', is_active=True)
    db.session.add_all([d1, d2])
    db.session.commit()

    # ① 누르지 않아도 들어와 있다
    rows = _orgs()
    by = {o['name']: o for o in rows}
    assert {'CAE그룹(MX)', 'Mecha그룹(MX)'} <= set(by)
    assert by['CAE그룹(MX)']['source_kind'] == 'portal'
    assert not by['CAE그룹(MX)'].get('gone')

    # ② 두 번 읽어도 하나 — 같은 부서를 또 만들지 않는다
    assert len([o for o in _orgs() if o['name'] == 'CAE그룹(MX)']) == 1

    # ③ 포탈이 이름을 바꾸면 따라간다
    d1.name = 'CAE解석그룹(MX)'
    db.session.commit()
    assert 'CAE解석그룹(MX)' in {o['name'] for o in _orgs()}

    # ④ 사람이 이름을 고치면 그때부터 포탈이 안 덮는다 — 손댔으면 이 사람의 것이다
    mine = next(o for o in _orgs() if o['name'] == 'CAE解석그룹(MX)')
    client.put(f'{BASE}/orgs/{mine["id"]}', json={'name': '우리식 이름'}, headers=auth(mx_user))
    d1.name = '또 바꾼 이름'
    db.session.commit()
    after = {o['name']: o for o in _orgs()}
    assert '우리식 이름' in after and after['우리식 이름']['source_kind'] == 'manual'
    assert '또 바꾼 이름' in after           # 부서와의 끈이 끊겼으니 새 줄이 하나 선다

    # ⑤ 부서가 꺼지면 — 지우지 않고 짚는다
    used = next(o for o in _orgs() if o['name'] == 'Mecha그룹(MX)')
    d2.is_active = False
    db.session.commit()
    gone = next(o for o in _orgs() if o['id'] == used['id'])
    assert gone['gone'] is True and gone['usage'] == 0

    # ⑥ 쓰는 구간이 있으면 정리해도 남는다
    threads = client.get(f'{BASE}/threads', headers=auth(mx_user)).get_json()['data']
    seg_def = threads[1]['segments'][0]
    client.post(f'{BASE}/segments', json={'division_id': mx, 'segment_def_id': seg_def['id'],
                                          'from_org_id': used['id']}, headers=auth(mx_user))
    still = next(o for o in _orgs() if o['id'] == used['id'])
    assert still['gone'] is True and still['usage'] == 1
    out = client.post(f'{BASE}/orgs/prune', json={'division_id': mx}, headers=auth(office)).get_json()['data']
    assert out == {'deleted': 0, 'names': [], 'kept': 1}
    assert used['id'] in {o['id'] for o in _orgs()}          # 쓰는 것은 지우지 않는다

    # ⑦ 안 쓰는 없어진 줄만 정리된다
    d3 = Department(division_id=mx, name='버릴그룹(MX)', is_active=True)
    db.session.add(d3)
    db.session.commit()
    spare = next(o for o in _orgs() if o['name'] == '버릴그룹(MX)')
    d3.is_active = False
    db.session.commit()
    out2 = client.post(f'{BASE}/orgs/prune', json={'division_id': mx}, headers=auth(office)).get_json()['data']
    assert out2['deleted'] == 1 and out2['names'] == ['버릴그룹(MX)'] and out2['kept'] == 1
    assert spare['id'] not in {o['id'] for o in _orgs()}


def test_일괄_입력_표의_머리글은_겹치지_않는다(client, auth, world, mx_user):
    """겹치면 **한 칸이 닿지 않는다** — 읽는 쪽이 이름으로 칸을 찾기 때문이다.

    ⚠️ 2026-08-30 실측: 모니터링은 대상의 이름표가 「공정」인데 공정 단계 열도 「공정」이라
       「사업부 | 공정 | 라인·사업장 | 공정 | 세부」가 됐다. 첫 번째가 이겨서 **이름 칸이
       공정 단계로 읽히고** 진짜 공정 단계 칸은 조용히 버려졌다. 눈으로는 못 잡는다.
    """
    mx = world['mx'].id
    for sector in D.SECTOR_KEYS:
        rows = client.get(f'{BASE}/bulk/kinds?sector={sector}&division_id={mx}',
                          headers=auth(mx_user)).get_json()['data']
        for k in rows:
            cols = k['columns']
            dup = [c for c in cols if cols.count(c) > 1]
            assert not dup, f'{sector}/{k["key"]} 머리글이 겹친다: {dup} — {cols}'
            # 고를 수 있는 값을 붙인 열은 실제로 그 표에 있어야 한다
            for col in (k.get('choices') or {}):
                assert col in cols, f'{sector}/{k["key"]} 「{col}」 은 표에 없는 열이다'


def test_모니터링_일괄_입력은_이름과_공정_단계를_따로_읽는다(client, auth, world, mx_user):
    """겹친 머리글을 고친 뒤 — 이름 칸과 공정 단계 칸이 서로를 안 먹는다."""
    mx = world['mx'].id
    kinds = client.get(f'{BASE}/bulk/kinds?sector=manufacturing_monitoring&division_id={mx}',
                       headers=auth(mx_user)).get_json()['data']
    cols = next(k for k in kinds if k['key'] == 'subject')['columns']
    assert '공정 단계' in cols
    steps = D.vocab('process_steps')
    # 이름은 공정 단계 이름과 **다르게**, 공정 단계는 사전의 값으로
    text = _table(tuple(cols), tuple(
        ['MX' if c == '사업부' else ('A라인' if c == '라인·사업장'
         else (steps[1]['label'] if c == '공정 단계' else ('3라인 실장부' if c == cols[1] else '')))
         for c in cols]))
    res = client.post(f'{BASE}/bulk', json={'division_id': mx, 'sector': 'manufacturing_monitoring',
                                            'kind': 'subject', 'text': text, 'dry_run': False},
                      headers=auth(mx_user))
    assert res.status_code == 200, res.get_json()
    rows = client.get(f'{BASE}/subjects?division_id={mx}&sector=manufacturing_monitoring',
                      headers=auth(mx_user)).get_json()['data']
    made = next(r for r in rows if r['name'] == '3라인 실장부')
    assert made['process'] == steps[1]['key']       # 이름이 아니라 그 칸에서 읽는다
    assert made['line'] == 'A라인'


def test_없는_칸을_보내면_무엇이_맞는지_함께_말해_준다(client, auth, world, mx_user):
    """화면은 단추라 안 겪지만 API·MCP 는 칸 key 를 지어 보낸다.

    「없는 칸입니다」만 듣고는 고칠 수가 없다 — 쓸 수 있는 것을 같이 줘야 다음에 맞게 보낸다.
    (2026-08-30, MCP 로 직접 매겨 보다가.)
    """
    _, _, p = _pair(client, auth, mx_user, world['mx'])
    r = client.put(f'{BASE}/pairs/{p["id"]}/assessments/scope',
                   json={'rung': '지어낸칸', 'note': '근거'}, headers=auth(mx_user))
    assert r.status_code == 400
    msg = r.get_json()['message']
    assert '없는 칸' in msg and 'issue' in msg and 'basic' in msg, msg

    r2 = client.put(f'{BASE}/pairs/{p["id"]}/assessments/automation',
                    json={'flags': ['지어낸항목'], 'note': '근거'}, headers=auth(mx_user))
    assert r2.status_code == 400
    msg2 = r2.get_json()['message']
    assert '없는 항목' in msg2 and 'pre' in msg2 and 'pipeline' in msg2, msg2


def test_AI_가_낸_판단은_제안으로_가고_사람이_승인해야_판에_오른다(client, auth, world, mx_user, vd_user):
    """「근거 없이는 매기지 않는다」가 막는 것은 빈 근거이지 **지어낸 근거**가 아니다.

    AI 는 그럴듯한 근거를 만들어 내므로 판단은 사람이 읽고 승인해야 오른다.
    ⚠️ 대기 중인 제안은 **딴 표에 있다** — 판·요약·변화·추출 어디에도 들지 않는다.
       그래서 저 셈들은 이 기능 때문에 아무것도 안 바꿨다. 그것을 여기서 확인한다.
    """
    mx = world['mx'].id
    _, _, p = _pair(client, auth, mx_user, world['mx'])

    # ① AI 가 매기면 202 — 자료는 아무것도 안 바뀐다
    res = client.put(f'{BASE}/pairs/{p["id"]}/assessments/scope',
                     json={'actor_mode': 'ai', 'rung': 'basic', 'note': 'AI 가 적은 근거'},
                     headers=auth(mx_user))
    assert res.status_code == 202, res.get_json()
    body = res.get_json()
    pid = body['data']['proposal_id']
    assert body['data']['pending_in_division'] == 1
    assert '확인 대기' in body['message']

    pair = client.get(f'{BASE}/pairs/{p["id"]}', headers=auth(mx_user)).get_json()['data']
    assert pair['assessments']['scope'] is None                  # 판에는 안 올랐다
    board = client.get(f'{BASE}/board?division_id={mx}&sector=simulation',
                       headers=auth(mx_user)).get_json()['data']
    assert board['totals']['unassessed'] > 0                      # 셈에도 안 든다
    assert client.get(f'{BASE}/changes?division_id={mx}&sector=simulation',
                      headers=auth(mx_user)).get_json()['data'] == []   # 이력도 없다

    # ② 근거가 없으면 제안조차 안 된다 — 같은 규칙을 여기서도 본다
    assert client.put(f'{BASE}/pairs/{p["id"]}/assessments/scope',
                      json={'actor_mode': 'ai', 'rung': 'basic', 'note': ' '},
                      headers=auth(mx_user)).status_code == 400
    # 없는 칸도 제안 때 걸린다 — 승인할 때가 되어서야 안 된다고 하면 늦다
    assert client.put(f'{BASE}/pairs/{p["id"]}/assessments/없는축',
                      json={'actor_mode': 'ai', 'rung': 'basic', 'note': 'x'},
                      headers=auth(mx_user)).status_code == 400

    # ③ 대기 목록과 수
    rows = client.get(f'{BASE}/proposals?division_id={mx}', headers=auth(mx_user)).get_json()['data']
    assert len(rows) == 1 and rows[0]['axis_label'] == '적용 범위'
    assert rows[0]['now'] is None and rows[0]['payload']['rung'] == 'basic'
    assert client.get(f'{BASE}/proposals/count?division_id={mx}',
                      headers=auth(mx_user)).get_json()['data']['pending'] == 1

    # ④ 남의 사업부 사람은 결정 못 한다
    assert client.post(f'{BASE}/proposals/{pid}/approve', headers=auth(vd_user)).status_code == 403

    # ⑤ 승인하면 **사람이 매긴 것**이 된다 — 이력의 actor 는 승인한 사람
    ok = client.post(f'{BASE}/proposals/{pid}/approve', headers=auth(mx_user))
    assert ok.status_code == 200, ok.get_json()
    after = client.get(f'{BASE}/pairs/{p["id"]}', headers=auth(mx_user)).get_json()['data']
    assert after['assessments']['scope']['rung'] == 'basic'
    assert after['assessments']['scope']['assessed_by_name'] == mx_user.name
    ch = client.get(f'{BASE}/changes?division_id={mx}&sector=simulation',
                    headers=auth(mx_user)).get_json()['data']
    assert len(ch) == 1 and ch[0]['actor_name'] == mx_user.name

    # ⑥ 두 번 결정 못 한다
    assert client.post(f'{BASE}/proposals/{pid}/approve', headers=auth(mx_user)).status_code == 400
    assert client.get(f'{BASE}/proposals/count?division_id={mx}',
                      headers=auth(mx_user)).get_json()['data']['pending'] == 0

    # ⑦ 거절하면 아무것도 안 바뀐다
    res2 = client.put(f'{BASE}/pairs/{p["id"]}/assessments/scope',
                      json={'actor_mode': 'ai', 'rung': 'all', 'note': '더 올리자'},
                      headers=auth(mx_user))
    pid2 = res2.get_json()['data']['proposal_id']
    assert res2.get_json()['data']['preview']['now']['rung'] == 'basic'    # 지금 값을 보여 준다
    client.post(f'{BASE}/proposals/{pid2}/reject', json={'note': '근거가 약함'},
                headers=auth(mx_user))
    still = client.get(f'{BASE}/pairs/{p["id"]}', headers=auth(mx_user)).get_json()['data']
    assert still['assessments']['scope']['rung'] == 'basic'                # 그대로
    done = client.get(f'{BASE}/proposals?division_id={mx}&status=rejected',
                      headers=auth(mx_user)).get_json()['data']
    assert done[0]['decided_note'] == '근거가 약함'      # 왜 거절했는지 남는다

    # ⑧ **자료는 제안이 아니다** — 사람이 세우는 것과 같은 길로 바로 들어간다
    made = client.post(f'{BASE}/subjects', json={'division_id': mx, 'sector': 'simulation',
                                                 'name': 'AI 가 세운 항목', 'actor_mode': 'ai'},
                       headers=auth(mx_user))
    assert made.status_code == 201        # 202 가 아니다 — 승인 30번이 되면 아무도 안 쓴다


def test_같은_자리에_다시_제안하면_앞의_것을_밀어낸다(client, auth, db, world, mx_user):
    """AI 가 고쳐 다시 내면 똑같은 카드가 쌓여, 사람이 어느 것이 최신인지 모른다.

    ⚠️ 지우지는 않는다 — 아무도 안 누른 것이라도 「이렇게도 제안했다」는 기록이다.
    """
    mx = world['mx'].id
    _, _, p = _pair(client, auth, mx_user, world['mx'])

    def _propose(rung, note):
        r = client.put(f'{BASE}/pairs/{p["id"]}/assessments/scope',
                       json={'actor_mode': 'ai', 'rung': rung, 'note': note},
                       headers=auth(mx_user))
        assert r.status_code == 202
        return r.get_json()['data']

    first = _propose('issue', '처음 판단')
    assert first['preview']['superseded'] == 0
    second = _propose('basic', '다시 보니 대표 모델')
    assert second['preview']['superseded'] == 1        # 하나를 밀어냈다

    rows = client.get(f'{BASE}/proposals?division_id={mx}', headers=auth(mx_user)).get_json()['data']
    assert len(rows) == 1 and rows[0]['id'] == second['proposal_id']      # 카드는 하나
    assert rows[0]['payload']['rung'] == 'basic'
    assert client.get(f'{BASE}/proposals/count?division_id={mx}',
                      headers=auth(mx_user)).get_json()['data']['pending'] == 1

    # 밀려난 것은 남는다 — 무엇을 냈었는지 볼 수 있다
    old = client.get(f'{BASE}/proposals?division_id={mx}&status=superseded',
                     headers=auth(mx_user)).get_json()['data']
    assert [x['id'] for x in old] == [first['proposal_id']]
    assert old[0]['payload']['rung'] == 'issue'

    # 다른 축은 따로 선다 — 「같은 자리」는 연계 × 축 × 갈래다
    client.put(f'{BASE}/pairs/{p["id"]}/assessments/automation',
               json={'actor_mode': 'ai', 'flags': ['pre'], 'note': '다른 축'},
               headers=auth(mx_user))
    assert client.get(f'{BASE}/proposals/count?division_id={mx}',
                      headers=auth(mx_user)).get_json()['data']['pending'] == 2


def test_확인_대기_목록은_줄_수와_무관하게_질의가_는다(client, auth, db, world, mx_user):
    """줄마다 pair_dict() 를 부르면 한 칸 보려고 연계 전부를 다시 센다 — 줄당 질의 8회였다.

    ⚠️ 200건이면 1600회다. 「지금 값」은 한 질의로 모아 읽고, 연계·대상·수단은 함께 당긴다.
    """
    from sqlalchemy import event
    from app.modules.dev_dt_maturity import proposals as PR
    mx = world['mx'].id
    made = []
    for i in range(6):
        _, _, p = _pair(client, auth, mx_user, world['mx'],
                        subject=f'대상 q{i}', agent=f'수단 q{i}')
        client.put(f'{BASE}/pairs/{p["id"]}/assessments/scope',
                   json={'actor_mode': 'ai', 'rung': 'basic', 'note': f'{i}번'},
                   headers=auth(mx_user))
        made.append(p['id'])

    n = [0]

    def _count(*a):
        n[0] += 1

    event.listen(db.engine, 'before_cursor_execute', _count)
    try:
        PR.listing(mx, 'pending')          # 데워 두고
        n[0] = 0
        rows = PR.listing(mx, 'pending')
    finally:
        event.remove(db.engine, 'before_cursor_execute', _count)
    assert len(rows) >= 6
    # 줄 수에 따라 늘지 않는다 — 목록 + 지금 값, 두어 질의면 된다
    assert n[0] <= 4, f'{len(rows)}건에 질의 {n[0]}회 — 줄마다 읽고 있다'
    assert rows[0]['subject_name'] and rows[0]['axis_label']      # 그래도 다 채워 온다


def test_지난_제안도_볼_수_있다_감사_기록이다(client, auth, world, mx_user):
    """제안 표에 다 남는데 화면이 대기만 보여 주면 「지난달에 뭘 거절했나」를 못 본다.

    ⚠️ 밀려난 것(superseded)도 함께 본다 — 아무도 안 누른 것이라도 「AI 가 이렇게도
       제안했다」는 기록이다.
    """
    mx = world['mx'].id
    _, _, p = _pair(client, auth, mx_user, world['mx'])

    def _propose(axis, body, note):
        r = client.put(f'{BASE}/pairs/{p["id"]}/assessments/{axis}',
                       json={'actor_mode': 'ai', 'note': note, **body}, headers=auth(mx_user))
        return r.get_json()['data']['proposal_id']

    ok_id = _propose('scope', {'rung': 'basic'}, '승인될 것')
    client.post(f'{BASE}/proposals/{ok_id}/approve', headers=auth(mx_user))
    no_id = _propose('scope', {'rung': 'all'}, '거절될 것')
    client.post(f'{BASE}/proposals/{no_id}/reject', json={'note': '근거가 약하다'},
                headers=auth(mx_user))
    old_id = _propose('automation', {'flags': ['pre']}, '밀려날 것')
    live_id = _propose('automation', {'flags': ['pre', 'run']}, '새로 낸 것')

    done = client.get(f'{BASE}/proposals?division_id={mx}&status=done',
                      headers=auth(mx_user)).get_json()['data']
    by = {r['id']: r for r in done}
    assert {ok_id, no_id, old_id} <= set(by), '지난 것 셋이 다 보여야 한다'
    assert live_id not in by, '아직 대기 중인 것은 지난 것이 아니다'
    assert by[ok_id]['status'] == 'approved' and by[ok_id]['decided_by_name'] == mx_user.name
    assert by[no_id]['status'] == 'rejected' and by[no_id]['decided_note'] == '근거가 약하다'
    assert by[old_id]['status'] == 'superseded'
    # 무엇을 냈었는지 그대로 남는다 — 그게 기록의 값이다
    assert by[no_id]['payload']['rung'] == 'all' and by[no_id]['note'] == '거절될 것'
    assert by[old_id]['payload']['flags'] == ['pre']

    # 대기는 대기대로 — 섞이지 않는다
    pend = client.get(f'{BASE}/proposals?division_id={mx}', headers=auth(mx_user)).get_json()['data']
    assert [r['id'] for r in pend] == [live_id]


def test_확인_대기_배지는_내가_결정할_수_있는_것만_센다(client, auth, db, world, mx_user, vd_user, office):
    """「4건」이라 눌렀는데 하나가 403 이면 그 수는 거짓말이다.

    ⚠️ 목록은 다 보여 준다 — 이 모듈은 읽기가 전사 허용이다(전사 현황을 봐야 한다).
       다만 못 누르는 줄에는 **왜 못 하는지**를 붙인다.
    """
    mx, vd = world['mx'].id, world['vd'].id
    _, _, pm = _pair(client, auth, mx_user, world['mx'])
    _, _, pv = _pair(client, auth, vd_user, world['vd'], subject='VD 시험', agent='VD 해석')
    for p, who in ((pm, mx_user), (pv, vd_user)):
        client.put(f'{BASE}/pairs/{p["id"]}/assessments/scope',
                   json={'actor_mode': 'ai', 'rung': 'basic', 'note': 'AI 판단'}, headers=auth(who))

    # MX 사람이 「전체」로 볼 때 — 배지는 자기 것만
    cnt = client.get(f'{BASE}/proposals/count', headers=auth(mx_user)).get_json()['data']
    assert cnt['pending'] == 1, f'남의 사업부까지 셌다: {cnt}'

    # 목록에는 둘 다 보인다 — 남의 것에는 이유가 붙는다
    rows = client.get(f'{BASE}/proposals', headers=auth(mx_user)).get_json()['data']
    by = {r['division_id']: r for r in rows}
    assert set(by) == {mx, vd}
    assert by[mx]['deny_reason'] is None                       # 내 것은 누를 수 있다
    assert '사업부 인력만' in (by[vd]['deny_reason'] or '')     # 남의 것은 이유가 붙는다
    assert by[vd]['division_name']                             # 어느 사업부인지도 보여 준다

    # 그래도 누르면 막힌다 — 화면이 꺼도 문은 잠겨 있어야 한다
    assert client.post(f'{BASE}/proposals/{by[vd]["id"]}/approve',
                       headers=auth(mx_user)).status_code == 403

    # 사무국은 전부 셈에 든다
    assert client.get(f'{BASE}/proposals/count',
                      headers=auth(office)).get_json()['data']['pending'] == 2
    all_rows = client.get(f'{BASE}/proposals', headers=auth(office)).get_json()['data']
    assert all(r['deny_reason'] is None for r in all_rows)


def test_일괄_입력_왕복_불러오고_고쳐_되넣는다(client, auth, world, mx_user):
    """「추출 → 엑셀에서 고치기 → 붙여넣기」가 돌아야 한다.

    여태는 이름이 같으면 건너뛰고 나머지 칸을 손대지 않아 **고친 것이 아무 일도 안 했다.**
    ⚠️ 덮어쓰기는 켜야 돈다. 그리고 **빈 칸은 안 지운다** — 엑셀에서 열을 지우고 붙여넣었다고
       자료가 비워지면 고치기가 지우기가 된다.
    """
    mx = world['mx'].id
    client.post(f'{BASE}/subjects', json={'division_id': mx, 'sector': 'simulation',
                                          'name': '낙하 시험', 'detail': '1.2m',
                                          'product_families': ['S 시리즈']}, headers=auth(mx_user))

    # ① 지금 자료를 그 표의 머리글 그대로 받는다
    got = client.get(f'{BASE}/bulk/rows?division_id={mx}&sector=simulation&kind=subject',
                     headers=auth(mx_user)).get_json()['data']
    kinds = client.get(f'{BASE}/bulk/kinds?sector=simulation&division_id={mx}',
                       headers=auth(mx_user)).get_json()['data']
    assert got['columns'] == next(k for k in kinds if k['key'] == 'subject')['columns']
    line = next(r for r in got['rows'] if r[1] == '낙하 시험')
    assert line[2] == '1.2m' and line[3] == 'S 시리즈'       # 값이 실려 온다

    # ② 세부만 고쳐서 되넣는다 — 덮어쓰기를 안 켜면 아무 일도 안 일어난다
    line[2] = '1.5m 6면 26모서리'
    text = '\t'.join(got['columns']) + '\n' + '\t'.join(line)
    body = {'division_id': mx, 'sector': 'simulation', 'kind': 'subject', 'text': text}
    keep = client.post(f'{BASE}/bulk', json={**body, 'dry_run': False}, headers=auth(mx_user)).get_json()['data']
    assert keep['summary']['exists'] == 1 and keep['summary']['updated'] == 0
    row = next(r for r in client.get(f'{BASE}/subjects?division_id={mx}&sector=simulation',
                                     headers=auth(mx_user)).get_json()['data'] if r['name'] == '낙하 시험')
    assert row['detail'] == '1.2m', '덮어쓰기를 안 켰는데 바뀌었다'

    # ③ 미리보기가 **무엇이 무엇으로** 바뀌는지 말해 준다 — 보고 나서 올린다
    pre = client.post(f'{BASE}/bulk', json={**body, 'mode': 'update'},
                      headers=auth(mx_user)).get_json()['data']
    assert pre['summary']['updated'] == 1
    ch = next(r for r in pre['rows'] if r['name'] == '낙하 시험')['changes']
    assert ch == [{'col': '세부', 'field': 'detail', 'before': '1.2m', 'after': '1.5m 6면 26모서리'}]
    row = next(r for r in client.get(f'{BASE}/subjects?division_id={mx}&sector=simulation',
                                     headers=auth(mx_user)).get_json()['data'] if r['name'] == '낙하 시험')
    assert row['detail'] == '1.2m', '미리보기가 저장했다'

    # ④ 올린다
    ok = client.post(f'{BASE}/bulk', json={**body, 'mode': 'update', 'dry_run': False},
                     headers=auth(mx_user)).get_json()['data']
    assert ok['summary']['updated'] == 1
    row = next(r for r in client.get(f'{BASE}/subjects?division_id={mx}&sector=simulation',
                                     headers=auth(mx_user)).get_json()['data'] if r['name'] == '낙하 시험')
    assert row['detail'] == '1.5m 6면 26모서리'
    assert row['product_families'] == ['S 시리즈']          # 손 안 댄 칸은 그대로

    # ⑤ 다시 넣으면 「고칠 것 없음」 — 같은 표를 두 번 올려도 조용하다
    again = client.post(f'{BASE}/bulk', json={**body, 'mode': 'update', 'dry_run': False},
                        headers=auth(mx_user)).get_json()['data']
    assert again['summary']['updated'] == 0
    assert next(r for r in again['rows'])['status'] == 'same'

    # ⑥ **빈 칸은 안 지운다** — 제품군 열을 비워 보낸다
    blank = list(line)
    blank[3] = ''
    text2 = '\t'.join(got['columns']) + '\n' + '\t'.join(blank)
    client.post(f'{BASE}/bulk', json={'division_id': mx, 'sector': 'simulation', 'kind': 'subject',
                                      'text': text2, 'mode': 'update', 'dry_run': False},
                headers=auth(mx_user))
    row = next(r for r in client.get(f'{BASE}/subjects?division_id={mx}&sector=simulation',
                                     headers=auth(mx_user)).get_json()['data'] if r['name'] == '낙하 시험')
    assert row['product_families'] == ['S 시리즈'], '빈 칸이 자료를 지웠다'


def test_한_칸에_여럿이면_파이프로_나눈다_값에_가운뎃점이_들어도_안_쪼갠다(client, auth, world, mx_user):
    """여럿을 담는 칸의 구분자는 ` | ` 다.

    ⚠️ 여태는 ` · ` 였는데 **값 자체에 · 가 든 것**이 있다 — 「원가·단가」·「요구사항·스펙」·
       「SPI·AOI 검사」. 그래서 한 칸이 둘로 쪼개져 **둘 다 못 찾는 값**이 됐다.
       불러오기가 준 판을 그대로 되붙여도 자료가 같아야 왕복이라 할 수 있다.
    """
    mx = world['mx'].id
    client.post(f'{BASE}/subjects', json={'division_id': mx, 'sector': 'simulation', 'name': '낙하 시험',
                                          'product_families': ['S 시리즈', 'A 시리즈']}, headers=auth(mx_user))

    # ① 불러오기는 | 로 이어 준다
    got = client.get(f'{BASE}/bulk/rows?division_id={mx}&sector=simulation&kind=subject',
                     headers=auth(mx_user)).get_json()['data']
    line = next(r for r in got['rows'] if r[1] == '낙하 시험')
    assert line[3] == 'S 시리즈 | A 시리즈'

    # ② 그대로 되붙이면 「고칠 것 없음」 — 왕복해도 자료가 안 흔들린다
    text = '\t'.join(got['columns']) + '\n' + '\t'.join(line)
    out = client.post(f'{BASE}/bulk', json={'division_id': mx, 'sector': 'simulation', 'kind': 'subject',
                                            'text': text, 'mode': 'update', 'dry_run': False},
                      headers=auth(mx_user)).get_json()['data']
    assert out['summary']['updated'] == 0 and out['rows'][0]['status'] == 'same'

    # ③ 옛 표(·)도 받는다 — 이미 내보낸 판이 세상에 있다
    old = list(line)
    old[3] = 'S 시리즈 · B 시리즈'
    client.post(f'{BASE}/bulk', json={'division_id': mx, 'sector': 'simulation', 'kind': 'subject',
                                      'text': '\t'.join(got['columns']) + '\n' + '\t'.join(old),
                                      'mode': 'update', 'dry_run': False}, headers=auth(mx_user))
    row = next(r for r in client.get(f'{BASE}/subjects?division_id={mx}&sector=simulation',
                                     headers=auth(mx_user)).get_json()['data'] if r['name'] == '낙하 시험')
    assert row['product_families'] == ['S 시리즈', 'B 시리즈']

    # ── 여기가 이 규칙의 이유 — 값 안에 · 가 있는 「데이터 종류」 ──────────────
    threads = client.get(f'{BASE}/threads', headers=auth(mx_user)).get_json()['data']
    cost = next(t for t in threads if t['key'] == 'cost')
    d1, d2 = cost['segments'][0], cost['segments'][1]
    seg = client.post(f'{BASE}/segments', json={'division_id': mx, 'segment_def_id': d1['id']},
                      headers=auth(mx_user)).get_json()['data']
    assert seg['data_kind_labels'] == ['원가·단가', 'BOM(E/M)']

    # ④ 불러오기 — 값 안의 · 는 그대로 두고, 값 사이만 | 로 가른다
    sg = client.get(f'{BASE}/bulk/rows?division_id={mx}&sector=digital_thread&kind=segment',
                    headers=auth(mx_user)).get_json()['data']
    srow = next(r for r in sg['rows'] if r[1] == d1['name'])
    assert srow[7] == '원가·단가 | BOM(E/M)'

    # ⑤ 그 칸을 그대로 붙여 새 구간을 만든다 — **라벨이 아니라 표준 key 로** 들어가야 한다
    new = list(srow)
    new[1] = d2['name']
    client.post(f'{BASE}/bulk', json={'division_id': mx, 'sector': 'digital_thread', 'kind': 'segment',
                                      'text': '\t'.join(sg['columns']) + '\n' + '\t'.join(new),
                                      'dry_run': False}, headers=auth(mx_user))
    made = next(s for s in client.get(f'{BASE}/segments?division_id={mx}',
                                      headers=auth(mx_user)).get_json()['data'] if s['name'] == d2['name'])
    assert made['data_kinds'] == ['cost', 'bom'], made['data_kinds']
    assert made['data_kind_labels'] == ['원가·단가', 'BOM(E/M)']

    # ⑥ 하나뿐이어도 안 쪼갠다 — 「원가·단가」는 한 값이다
    seg3 = client.post(f'{BASE}/segments', json={'division_id': mx, 'segment_def_id': cost['segments'][2]['id']},
                       headers=auth(mx_user)).get_json()['data']
    client.put(f'{BASE}/segments/{seg3["id"]}', json={'data_kinds': []}, headers=auth(mx_user))
    sg2 = client.get(f'{BASE}/bulk/rows?division_id={mx}&sector=digital_thread&kind=segment',
                     headers=auth(mx_user)).get_json()['data']
    one = list(next(r for r in sg2['rows'] if r[1] == d1['name']))
    one[1], one[7] = '원가 되짚기', '원가·단가'
    client.post(f'{BASE}/bulk', json={'division_id': mx, 'sector': 'digital_thread', 'kind': 'segment',
                                      'text': '\t'.join(sg2['columns']) + '\n' + '\t'.join(one),
                                      'dry_run': False}, headers=auth(mx_user))
    solo = next(s for s in client.get(f'{BASE}/segments?division_id={mx}',
                                      headers=auth(mx_user)).get_json()['data'] if s['name'] == '원가 되짚기')
    assert solo['data_kinds'] == ['cost'], solo['data_kinds']


def _sheet(cols, *rows):
    return '\n'.join(['\t'.join(cols)] + ['\t'.join(r) for r in rows])


def _bulk(client, auth, user, div, sector, kind, text, mode='add', dry=False):
    r = client.post(f'{BASE}/bulk', json={'division_id': div, 'sector': sector, 'kind': kind,
                                          'text': text, 'mode': mode, 'dry_run': dry}, headers=auth(user))
    j = r.get_json() or {}
    return r.status_code, (j.get('data') if r.status_code < 400 else j.get('message'))


def test_전체로_열어도_남의_사업부_줄은_못_넣는다(client, auth, world, mx_user, office):
    """⚠️ 사업부를 하나 골라 열면 화면이 막지만, 「전체」로 열면 사업부가 **줄마다** 온다.

    그 줄의 사업부를 안 보면 엑셀에서 그 열만 고쳐 붙여넣는 것으로 남의 사업부에 자료가
    들어간다 — 성숙도는 사업부가 자기 것을 적는 판이라 이러면 판 자체가 무너진다.
    """
    mx, vd = world['mx'].id, world['vd'].id
    cols = ['사업부', '시험 항목', '세부', '제품군']
    text = _sheet(cols, ['VD', '남의 사업부에 몰래', '', ''])

    st, d = _bulk(client, auth, mx_user, 'all', 'simulation', 'subject', text)
    assert st == 200 and d['summary']['errors'] == 1
    assert 'VD 사업부 인력만' in d['rows'][0]['message']
    got = client.get(f'{BASE}/subjects?division_id={vd}&sector=simulation', headers=auth(mx_user)).get_json()['data']
    assert not [r for r in got if r['name'] == '남의 사업부에 몰래'], '남의 사업부에 들어갔다'

    # 내 것은 그대로 들어간다 — 막는 것이 「전체」 자체가 아니다
    st, d = _bulk(client, auth, mx_user, 'all', 'simulation', 'subject',
                  _sheet(cols, ['MX', '내 사업부', '', '']))
    assert d['summary']['new'] == 1

    # 사무국은 두 사업부를 한 표로 — 이게 「전체」가 있는 이유다
    st, d = _bulk(client, auth, office, 'all', 'simulation', 'subject',
                  _sheet(cols, ['MX', '사무국이 넣은 것', '', ''], ['VD', '사무국이 넣은 저것', '', '']))
    assert d['summary']['new'] == 2, d['rows']


def test_담당_부서가_붙은_수단도_왕복한다(client, auth, world, mx_user):
    """불러온 판을 손대지 않고 되붙이면 아무 일도 없어야 한다.

    ⚠️ 담당 부서는 **숫자**로 담긴다. 그걸 글자처럼 다듬으려다 터져서, 부서가 붙은 수단은
       고치기가 통째로 「넣지 못했습니다」로 끝났다(2026-08-30 실측).
    """
    mx = world['mx'].id
    dept = client.get(f'{BASE}/departments?division_id={mx}', headers=auth(mx_user)).get_json()['data'][0]
    client.post(f'{BASE}/agents', json={'division_id': mx, 'sector': 'simulation', 'name': '구조 해석',
                                        'kind': '구조', 'tools': ['LS-DYNA', 'Abaqus'],
                                        'department_id': dept['id']}, headers=auth(mx_user))

    got = client.get(f'{BASE}/bulk/rows?division_id={mx}&sector=simulation&kind=agent',
                     headers=auth(mx_user)).get_json()['data']
    line = next(r for r in got['rows'] if r[1] == '구조 해석')
    assert line[4] == 'LS-DYNA | Abaqus' and line[6] == dept['name']

    text = '\n'.join(['\t'.join(got['columns']), '\t'.join(line)])
    st, d = _bulk(client, auth, mx_user, mx, 'simulation', 'agent', text, mode='update')
    assert st == 200 and d['summary']['errors'] == 0, d['rows']
    assert d['rows'][0]['status'] == 'same', d['rows']

    # 한 칸만 고치면 그 칸만
    line[6] = ''
    line[2] = '구조·충격'
    st, d = _bulk(client, auth, mx_user, mx, 'simulation', 'agent',
                  '\n'.join(['\t'.join(got['columns']), '\t'.join(line)]), mode='update')
    assert d['summary']['updated'] == 1
    row = next(r for r in client.get(f'{BASE}/agents?division_id={mx}&sector=simulation',
                                     headers=auth(mx_user)).get_json()['data'] if r['name'] == '구조 해석')
    assert row['kind'] == '구조·충격'
    assert row['department_id'] == dept['id'], '빈 칸이 부서를 지웠다'


def test_구간_일괄_입력은_됐다고_말한다(client, auth, world, mx_user):
    """⚠️ 구간은 「넣지 못했습니다」를 띄우면서 **실제로는 들어가 있었다.**

    돌려주는 값이 하나 모자라 run() 이 터졌는데, 터진 자리에서 이미 만든 구간이 그대로
    커밋됐다. 사람은 안 됐다고 믿고 다시 누른다 — 말과 자료가 어긋나면 안 된다.
    """
    mx = world['mx'].id
    th = client.get(f'{BASE}/threads', headers=auth(mx_user)).get_json()['data']
    cost = next(t for t in th if t['key'] == 'cost')
    # 시스템은 사전에 박힌 것을 쓴다 — 기준 정보를 고치는 시험이 앞에 돌아도 안 흔들리게
    sysname = client.get(f'{BASE}/systems', headers=auth(mx_user)).get_json()['data'][0]['name']
    client.post(f'{BASE}/orgs', json={'division_id': mx, 'name': 'MX 설계그룹'}, headers=auth(mx_user))
    cols = ['스레드', '구간', '출발 조직', '출발 시스템', '매개 시스템', '도착 조직', '도착 시스템', '데이터 종류']

    st, d = _bulk(client, auth, mx_user, mx, 'digital_thread', 'segment',
                  _sheet(cols, [cost['name'], cost['segments'][0]['name'], 'MX 설계그룹', sysname,
                                '', 'MX 설계그룹', sysname, '원가·단가 | BOM(E/M)']))
    assert st == 200 and d['summary']['new'] == 1, d['rows']
    assert d['rows'][0]['status'] == 'new'
    seg = client.get(f'{BASE}/segments?division_id={mx}', headers=auth(mx_user)).get_json()['data']
    assert len(seg) == 1 and seg[0]['data_kinds'] == ['cost', 'bom']

    # 또 올리면 이미 있음 — 겹쳐 만들지 않는다
    st, d = _bulk(client, auth, mx_user, mx, 'digital_thread', 'segment',
                  _sheet(cols, [cost['key'], cost['segments'][0]['name'], '', '', '', '', '', '']))
    assert d['summary']['exists'] == 1 and d['summary']['errors'] == 0, d['rows']


def test_오류가_난_줄은_저장되지_않는다(client, auth, world, mx_user, monkeypatch):
    """줄 하나가 반쯤 되다 터지면 **그 줄은 없던 일이** 되어야 한다.

    ⚠️ 예전엔 줄마다 되돌림점이 없어서, 오류를 세어 놓고 끝에 통째로 커밋했다. 그래서
       「넣지 못했습니다」라고 말한 줄의 자료가 판에 남았다. 성한 줄은 그대로 들어간다.
    """
    from app.modules.dev_dt_maturity import bulk as B
    mx = world['mx'].id
    cols = ['사업부', '시험 항목', '세부', '제품군']
    real = B._one

    def half(division_id, sector, kind, spec, cell, cells, actor, dry_run, T, mode='add'):
        out = real(division_id, sector, kind, spec, cell, cells, actor, dry_run, T, mode=mode)
        if cell(cells, '시험 항목') == '반쯤 하다 터짐':
            raise RuntimeError('만들다 말았다')
        return out

    monkeypatch.setattr(B, '_one', half)
    st, d = _bulk(client, auth, mx_user, mx, 'simulation', 'subject',
                  _sheet(cols, ['MX', '멀쩡한 줄', '', ''], ['MX', '반쯤 하다 터짐', '', '']))
    assert st == 200 and d['summary']['new'] == 1 and d['summary']['errors'] == 1
    names = [r['name'] for r in client.get(f'{BASE}/subjects?division_id={mx}&sector=simulation',
                                           headers=auth(mx_user)).get_json()['data']]
    assert '멀쩡한 줄' in names, '성한 줄까지 날아갔다'
    assert '반쯤 하다 터짐' not in names, '오류라고 말해 놓고 저장했다'


def test_없는_값을_낸_제안은_쌓이기_전에_막는다(client, auth, world, mx_user):
    """⚠️ 제안도 **저장 전에** 값을 본다.

    여태는 갈래·축·근거만 보고 payload 를 그대로 담았다. 그래서 AI 가 없는 칸을 내면
    202 로 받아 확인 대기에 쌓이고, **사람이 승인을 누를 때에야** 「없는 칸입니다」가
    떴다. 그 카드는 아무리 눌러도 안 올라가고 거절 말고는 치울 길이 없었다.
    내는 쪽(MCP·AI)도 202 를 받았으니 됐다고 여겨 스스로 못 고쳤다(2026-08-30 실측).
    """
    mx = world['mx'].id
    sub = client.post(f'{BASE}/subjects', json={'division_id': mx, 'sector': 'simulation',
                                                'name': '낙하 시험'}, headers=auth(mx_user)).get_json()['data']
    ag = client.post(f'{BASE}/agents', json={'division_id': mx, 'sector': 'simulation',
                                             'name': '구조 해석'}, headers=auth(mx_user)).get_json()['data']
    pair = client.post(f'{BASE}/pairs', json={'subject_id': sub['id'], 'agent_id': ag['id']},
                       headers=auth(mx_user)).get_json()['data']

    bad = client.put(f'{BASE}/pairs/{pair["id"]}/assessments/automation',
                     json={'rung': '없는칸', 'note': '지어낸 근거', 'actor_mode': 'ai'}, headers=auth(mx_user))
    assert bad.status_code == 400, bad.get_json()
    msg = bad.get_json()['message']
    # 무엇을 쓸 수 있는지 함께 준다 — 「없는 칸」만 듣고는 AI 도 사람도 못 고친다
    assert '쓸 수 있는 것' in msg and 'pipeline' in msg, msg
    assert client.get(f'{BASE}/proposals?division_id={mx}',
                      headers=auth(mx_user)).get_json()['data'] == [], '못 쓸 값이 확인 대기에 쌓였다'

    # 근거가 비면 여전히 근거부터 — 값 검사가 근거 검사를 밀어내지 않는다
    no_note = client.put(f'{BASE}/pairs/{pair["id"]}/assessments/automation',
                         json={'rung': 'run', 'actor_mode': 'ai'}, headers=auth(mx_user))
    assert no_note.status_code == 400 and '근거' in no_note.get_json()['message']

    # 쓸 수 있는 값이면 그대로 제안으로 간다
    ok = client.put(f'{BASE}/pairs/{pair["id"]}/assessments/automation',
                    json={'rung': 'run', 'note': '해석 실행이 자동', 'actor_mode': 'ai'}, headers=auth(mx_user))
    assert ok.status_code == 202, ok.get_json()
    ps = client.get(f'{BASE}/proposals?division_id={mx}', headers=auth(mx_user)).get_json()['data']
    assert len(ps) == 1 and ps[0]['status'] == 'pending'

    # 그리고 승인이 **된다** — 쌓인 것은 반드시 처리할 수 있어야 한다
    got = client.post(f'{BASE}/proposals/{ps[0]["id"]}/approve', json={}, headers=auth(mx_user))
    assert got.status_code == 200, got.get_json()
    one = client.get(f'{BASE}/pairs/{pair["id"]}', headers=auth(mx_user)).get_json()['data']
    assert one['assessments']['automation']['rung'] == 'run'
