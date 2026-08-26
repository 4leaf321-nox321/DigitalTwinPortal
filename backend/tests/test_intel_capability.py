"""역량 층 — 사업부 비교를 가능하게 하는 구조.

⚠️⚠️ **왜 층을 나누나.** 도구 단위로만 두면 사업부 비교가 **원리적으로 불가능**하다 —
   MX 가 LS-DYNA 도입, VD 가 RADIOSS 도입이면 둘 다 「도입」인데 서로 다른 줄이라
   누가 앞섰는지 읽을 수 없다. 반대로 역량만 두면 소식이 안 걸린다 — 소식은
   「Ansys 가 LS-DYNA 에 X 추가」처럼 **도구 이름**으로 들어온다.

   실측(2026-08-25): 개발 자료 116개 중 **100개가 제품**이었고, 같은 일을 하는 도구가
   3~4개씩 겹쳐 있었다.

⚠️ 그래서 소식은 도구에 걸리고 **근거가 역량으로 굴러 올라간다.** 이게 안 되면
   역량은 근거 0건이라 **만들어지자마자 전부 「낡음」**이 되고, 그 순간 낡음 표시가
   아무 신호도 아니게 된다. 이 파일이 지키는 것이 그 성질이다.
"""
from datetime import datetime, timedelta

import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_intel import services as S
from app.modules.digital_twin_intel.models import IntelTech

BASE = '/api/digital-twin-intel'


@pytest.fixture()
def admin(make_user):
    return make_user('cap@test.local', UserRole.ADMIN)


@pytest.fixture()
def plain(make_user):
    return make_user('cap-plain@test.local', UserRole.USER)


def _cap(admin, name):
    t, err = S.create_tech(actor_id=admin.id, name=name, kind='capability')
    assert err is None, err
    return t


def _tool(admin, name, parent=None):
    t, err = S.create_tech(actor_id=admin.id, name=name,
                           capabilityUuids=([parent.uuid] if parent else []))
    assert err is None, err
    return t


def _caps_of(t):
    """그 도구가 걸린 역량 uuid 들. ⚠️ 이제 **여럿일 수 있다.**"""
    return sorted(c['uuid'] for c in S.capabilities_of([t.uuid]).get(t.uuid, []))


def _news(client, auth, user, url, techs):
    r = client.post(f'{BASE}/news',
                    json={'title': f'소식 {url}', 'url': url, 'technologies': techs},
                    headers=auth(user))
    assert r.status_code == 201, f'{r.status_code} · {r.get_json()}'
    return (r.get_json() or {}).get('data')


# ── 층 ───────────────────────────────────────────────────────────────────────

def test_기본은_도구다(db, admin):
    """
    ⚠️ MCPㆍ소식으로 들어오는 것의 대부분이 제품이다. 기본을 역량으로 두면
       **역량 목록이 곧바로 잡동사니가 된다.**
    """
    t = _tool(admin, '그냥 넣은 것')
    assert t.kind == 'tool'


def test_소식에서_저절로_생긴_기술도_도구다(db, client, auth, admin):
    _news(client, auth, admin, 'https://e.test/k1', [{'name': 'LS-DYNA'}])
    assert IntelTech.query.filter_by(name='LS-DYNA').first().kind == 'tool'


# ── 근거가 굴러 올라간다 (이 파일의 핵심) ────────────────────────────────────

def test_도구의_근거가_역량으로_올라간다(db, client, auth, admin):
    cap = _cap(admin, 'explicit 해석')
    a = _tool(admin, 'LS-DYNA', cap)
    b = _tool(admin, 'RADIOSS', cap)

    _news(client, auth, admin, 'https://e.test/r1', [{'name': 'LS-DYNA'}])
    _news(client, auth, admin, 'https://e.test/r2', [{'name': 'RADIOSS'}])
    _news(client, auth, admin, 'https://e.test/r3', [{'name': 'RADIOSS'}])

    stats = S.evidence_stats([cap.uuid, a.uuid, b.uuid])
    assert stats[a.uuid][0] == 1
    assert stats[b.uuid][0] == 2
    assert stats[cap.uuid][0] == 3, '역량이 자식 근거를 합쳐 세야 한다'


def test_굴려_올린_덕에_역량이_낡음이_안_된다(db, client, auth, admin):
    """
    ⚠️ **이게 이 설계의 급소다.** 역량에는 직접 걸리는 근거가 거의 없다. 안 굴려
       올리면 역량이 전부 낡음으로 뜨고, 그러면 낡음 표시 자체가 못 쓰게 된다.
    """
    cap = _cap(admin, 'CFD')
    tool = _tool(admin, 'OpenFOAM', cap)
    # 역량을 오래 전에 만든 것으로 돌려 둔다 — 근거가 없으면 낡았어야 할 상태.
    cap.created_at = datetime.utcnow() - timedelta(days=400)
    cap.stage_changed_at = cap.created_at
    _db.session.commit()

    _news(client, auth, admin, 'https://e.test/fresh', [{'name': 'OpenFOAM'}])

    r = client.get(f'{BASE}/tech', headers=auth(admin))
    row = next(x for x in (r.get_json() or {}).get('data') or [] if x['name'] == 'CFD')
    assert row['evidenceCount'] == 1
    assert row['isStale'] is False, '자식의 새 근거로 역량도 살아 있어야 한다'
    assert tool.uuid


def test_역량_목록에_자식이_실린다(db, client, auth, admin):
    cap = _cap(admin, '1D 시스템')
    _tool(admin, 'Amesim', cap)
    _tool(admin, 'Dymola', cap)

    r = client.get(f'{BASE}/tech', headers=auth(admin))
    row = next(x for x in (r.get_json() or {}).get('data') or [] if x['name'] == '1D 시스템')
    assert sorted(c['name'] for c in row['children']) == ['Amesim', 'Dymola']


# ── 레이더가 그리는 것 ───────────────────────────────────────────────────────

def test_레이더는_역량과_부모없는_도구만_그린다(db, client, auth, admin):
    """
    ⚠️ 매달린 도구까지 그리면 같은 것이 두 번 서고 **층을 나눈 뜻이 사라진다.**
    ⚠️ 부모 없는 도구는 **그대로 뜬다** — 역량 정의가 안 끝나도 모듈이 돌아야 한다.
       「먼저 다 정리하라」고 하면 아무도 안 한다.
    """
    cap = _cap(admin, 'explicit 해석')
    _tool(admin, 'LS-DYNA', cap)          # 매달림 → 레이더에서 빠진다
    _tool(admin, '아직 안 매단 도구')       # 부모 없음 → 레이더에 뜬다

    r = client.get(f'{BASE}/tech?radar=1', headers=auth(admin))
    names = sorted(x['name'] for x in (r.get_json() or {}).get('data') or [])
    assert names == ['explicit 해석', '아직 안 매단 도구'], names


def test_층으로_걸러_볼_수_있다(db, client, auth, admin):
    cap = _cap(admin, 'CFD')
    _tool(admin, 'OpenFOAM', cap)

    caps = client.get(f'{BASE}/tech?kind=capability', headers=auth(admin)).get_json()['data']
    tools = client.get(f'{BASE}/tech?kind=tool', headers=auth(admin)).get_json()['data']
    assert [c['name'] for c in caps] == ['CFD']
    assert [t['name'] for t in tools] == ['OpenFOAM']


# ── 매달기 규칙 ──────────────────────────────────────────────────────────────

def test_누구나_매달_수_있다(db, client, auth, plain, admin):
    """
    ⚠️ 매다는 것은 **판단이 아니라 정리**다. 여기서 막으면 도구가 영영 부모 없이
       남는다 — 단계 변경(조직의 판단)과는 다르다.
    """
    cap = _cap(admin, 'CFD')
    tool = _tool(admin, 'OpenFOAM')
    r = client.put(f'{BASE}/tech/{tool.uuid}/capabilities',
                   json={'capabilityUuids': [cap.uuid]}, headers=auth(plain))
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'
    _db.session.expire_all()
    assert _caps_of(tool) == [cap.uuid]


def test_떼어_낼_수_있다(db, client, auth, admin):
    cap = _cap(admin, 'CFD')
    tool = _tool(admin, 'OpenFOAM', cap)
    client.put(f'{BASE}/tech/{tool.uuid}/capabilities',
               json={'capabilityUuids': []}, headers=auth(admin))
    _db.session.expire_all()
    assert _caps_of(tool) == []


def test_자기_자신을_상위로_못_둔다(db, client, auth, admin):
    """고리가 생기면 근거를 굴려 올릴 때 무한히 돈다."""
    t = _tool(admin, 'X')
    r = client.put(f'{BASE}/tech/{t.uuid}/capabilities',
                   json={'capabilityUuids': [t.uuid]}, headers=auth(admin))
    assert r.status_code == 400


def test_도구_밑에_도구를_못_매단다(db, client, auth, admin):
    a = _tool(admin, 'A')
    b = _tool(admin, 'B')
    # ⚠️ 옛 길(`/parent` + `parentUuid`)로 불러도 같은 검사가 걸린다 — 배포 중에
    #    옛 화면이 잠깐 살아 있을 수 있어 그 길을 남겨 뒀다.
    r = client.put(f'{BASE}/tech/{b.uuid}/parent', json={'parentUuid': a.uuid},
                   headers=auth(admin))
    assert r.status_code == 400
    assert '역량이어야' in (r.get_json() or {}).get('message', '')


def test_역량은_다른_것_밑에_못_매단다(db, client, auth, admin):
    """⚠️ 층은 둘까지다 — 셋이 되면 「어디까지 굴려 올릴 것인가」가 사람마다 달라진다."""
    a = _cap(admin, '상위')
    b = _cap(admin, '하위')
    r = client.put(f'{BASE}/tech/{b.uuid}/parent', json={'parentUuid': a.uuid},
                   headers=auth(admin))
    assert r.status_code == 400
    assert '층은 둘까지' in (r.get_json() or {}).get('message', '')


def test_자식이_달린_역량은_도구로_못_내린다(db, client, auth, admin):
    """
    ⚠️ 그냥 내리면 자식들이 부모 없는 도구가 되어 **레이더에 갑자기 쏟아진다.**
    """
    cap = _cap(admin, 'CFD')
    _tool(admin, 'OpenFOAM', cap)
    r = client.patch(f'{BASE}/tech/{cap.uuid}', json={'kind': 'tool'},
                     headers=auth(admin))
    assert r.status_code == 400
    assert '떼어' in (r.get_json() or {}).get('message', '')


def test_자식을_뗀_뒤에는_내릴_수_있다(db, client, auth, admin):
    cap = _cap(admin, 'CFD')
    tool = _tool(admin, 'OpenFOAM', cap)
    client.put(f'{BASE}/tech/{tool.uuid}/capabilities',
               json={'capabilityUuids': []}, headers=auth(admin))
    r = client.patch(f'{BASE}/tech/{cap.uuid}', json={'kind': 'tool'},
                     headers=auth(admin))
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'


def test_도구는_속한_역량을_이름까지_함께_받는다(db, client, auth, admin):
    """
    ⚠️ uuid 만 주면 화면이 「어느 역량인가」를 보여주려고 목록 전체를 뒤져야 하는데,
       **걸러 본 목록에는 그 역량이 아예 없을 수 있다** — 그러면 빈칸이 뜬다.
    """
    a = _cap(admin, 'explicit 해석')
    b = _cap(admin, '공정 성형 해석')
    t = _tool(admin, 'LS-DYNA', a)
    client.put(f'{BASE}/tech/{t.uuid}/capabilities',
               json={'capabilityUuids': [a.uuid, b.uuid]}, headers=auth(admin))

    r = client.get(f'{BASE}/tech?kind=tool', headers=auth(admin))
    row = next(x for x in (r.get_json() or {}).get('data') or [] if x['name'] == 'LS-DYNA')
    # ⚠️ **여럿이 온다.** 하나만 보내면 「LS-DYNA 는 explicit」이라고만 말하게 되고,
    #    성형 쪽에서 찾는 사람은 못 찾는다.
    assert sorted(c['name'] for c in row['capabilities'])         == ['explicit 해석', '공정 성형 해석']
    assert sorted(row['capabilityUuids']) == sorted([a.uuid, b.uuid])


def test_안_매달린_도구는_빈_목록으로_온다(db, client, auth, admin):
    _tool(admin, '혼자 선 도구')
    r = client.get(f'{BASE}/tech', headers=auth(admin))
    row = next(x for x in (r.get_json() or {}).get('data') or []
               if x['name'] == '혼자 선 도구')
    assert row['capabilities'] == []
    assert row['capabilityUuids'] == []


# ── 만들면서 매다는 길 (MCP 가 쓰는 길) ──────────────────────────────────────

def test_만들면서_매달_수_있다(db, client, auth, admin):
    """MCP 는 조사해 온 도구를 넣으면서 바로 매단다 — 두 번 왕복할 이유가 없다."""
    cap = _cap(admin, 'CFD')
    r = client.post(f'{BASE}/tech',
                    json={'name': 'OpenFOAM', 'capabilityUuids': [cap.uuid]},
                    headers=auth(admin))
    assert r.status_code == 201, f'{r.status_code} · {r.get_json()}'
    assert (r.get_json() or {})['data']['capabilityUuids'] == [cap.uuid]


def test_만들면서_매다는_길도_같은_규칙을_받는다(db, client, auth, admin):
    """
    ⚠️⚠️ **여기가 뒷문이 되면 안 된다.** 만들기에 검사를 안 걸면 `set_parent` 의
       층 규칙을 통째로 우회하는 길이 생기고, MCP 는 만들기와 매달기를 한 번에
       하므로 **그 길로만 들어오는 줄이 실제로 생긴다.**
    """
    tool = _tool(admin, '그냥 도구')
    cap = _cap(admin, 'CFD')

    # 도구 밑에 도구 (옛 이름 `parentUuid` 로도 막혀야 한다)
    r = client.post(f'{BASE}/tech', json={'name': 'X', 'parentUuid': tool.uuid},
                    headers=auth(admin))
    assert r.status_code == 400 and '역량이어야' in (r.get_json() or {}).get('message', '')

    # 역량을 다른 것 밑에
    r = client.post(f'{BASE}/tech',
                    json={'name': 'Y', 'kind': 'capability',
                          'capabilityUuids': [cap.uuid]},
                    headers=auth(admin))
    assert r.status_code == 400 and '층은 둘까지' in (r.get_json() or {}).get('message', '')

    # 없는 상위
    r = client.post(f'{BASE}/tech', json={'name': 'Z',
                                         'capabilityUuids': ['no-such']},
                    headers=auth(admin))
    assert r.status_code == 400

    assert IntelTech.query.filter(IntelTech.name.in_(['X', 'Y', 'Z'])).count() == 0, \
        '막혔으면 줄도 안 남아야 한다'


# ── 칸마다 어느 층의 사실인가 ────────────────────────────────────────────────
#
# ⚠️⚠️ 둘 다에 다 보여 주면 「역량의 공급사」 같은 것을 적게 되고, 그 값은 **아무
#    데도 안 쓰이면서 화면만 어지럽힌다.** 규칙은 두 줄이다.
#
#        공급사 · 제품 주소       **도구에만.** 역량은 파는 회사가 없다
#        분류 · 얽힌 갈래 · CPT   **레이더에 서는 줄에만**
#
#    자료로 확인(2026-08-25) — 역량 39개 중 공급사ㆍ주소가 적힌 것 0개. 반대로
#    매달린 도구 116개가 전부 분류를 들고 있었고 그중 3개는 상위와 다른 부채꼴이었다.

def test_역량은_공급사를_안_받는다(db, client, auth, admin):
    r = client.post(f'{BASE}/tech',
                    json={'name': 'explicit 해석', 'kind': 'capability',
                          'vendor': 'Ansys', 'url': 'https://x.test'},
                    headers=auth(admin))
    assert r.status_code == 201
    d = (r.get_json() or {})['data']
    assert d['vendor'] is None and d['url'] is None


def test_도구는_공급사를_받는다(db, client, auth, admin):
    r = client.post(f'{BASE}/tech',
                    json={'name': 'LS-DYNA', 'vendor': 'Ansys',
                          'url': 'https://lsdyna.test'},
                    headers=auth(admin))
    assert r.status_code == 201
    d = (r.get_json() or {})['data']
    assert d['vendor'] == 'Ansys' and d['url'] == 'https://lsdyna.test'


def test_도구를_역량으로_올리면_공급사가_지워진다(db, client, auth, admin):
    """
    ⚠️ 안 지우면 **화면에 안 보이는 값이 남는다.** 나중에 도구로 되돌렸을 때
       옛 공급사가 엉뚱하게 되살아난다.
    """
    t = _tool(admin, 'X')
    client.patch(f'{BASE}/tech/{t.uuid}',
                 json={'vendor': 'Ansys', 'url': 'https://x.test'},
                 headers=auth(admin))
    r = client.patch(f'{BASE}/tech/{t.uuid}', json={'kind': 'capability'},
                     headers=auth(admin))
    assert r.status_code == 200
    d = (r.get_json() or {})['data']
    assert d['vendor'] is None and d['url'] is None


# ── 한 도구가 여러 역량에 걸친다 (연결 표로 바꾼 이유) ───────────────────────
#
# ⚠️⚠️ 자료로 세어 보니 도구 546개 중 **58개(11%)** 가 두 역량 이상에 걸쳤다 —
#    MATLAB/Simulink 는 1D 시스템이면서 제어 검증이고 대리모델이기도 하다.
#    칸 하나(`parent_uuid`)로는 그 중 하나만 적을 수 있었다.

def test_한_도구가_여러_역량에_걸린다(db, client, auth, admin):
    a = _cap(admin, '1D 시스템 시뮬레이션')
    b = _cap(admin, '제어 설계ㆍ검증')
    c = _cap(admin, '대리모델')
    t = _tool(admin, 'MATLAB / Simulink')

    r = client.put(f'{BASE}/tech/{t.uuid}/capabilities',
                   json={'capabilityUuids': [a.uuid, b.uuid, c.uuid]},
                   headers=auth(admin))
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'
    assert _caps_of(t) == sorted([a.uuid, b.uuid, c.uuid])

    # 세 역량 모두의 「무엇으로 하나」 후보에 나온다.
    for cap in (a, b, c):
        kids = S.children_of([cap.uuid]).get(cap.uuid, [])
        assert [k['name'] for k in kids] == ['MATLAB / Simulink']


def test_근거가_걸친_역량_모두로_굴러_올라간다(db, client, auth, admin):
    """
    ⚠️⚠️ **이게 중복 셈 걱정의 답이다.** 같은 소식이 세 역량을 함께 떠받치는 것은
       사실이고, 셋이 각각 「1건」이라 말하는 것이 맞다. 어디에서도 합치지 않으므로
       부풀 총합이 없다 — 낡음 판정도 건수가 아니라 **마지막 시각**을 본다.
    """
    a = _cap(admin, '충돌ㆍ고속 비선형 해석')
    b = _cap(admin, '공정 성형 해석')
    t = _tool(admin, 'LS-DYNA')
    client.put(f'{BASE}/tech/{t.uuid}/capabilities',
               json={'capabilityUuids': [a.uuid, b.uuid]}, headers=auth(admin))

    _news(client, auth, admin, 'https://e.test/dyna', [{'name': 'LS-DYNA'}])

    st = S.evidence_stats([a.uuid, b.uuid, t.uuid])
    assert st[t.uuid][0] == 1
    assert st[a.uuid][0] == 1, '충돌도 이 소식이 떠받친다'
    assert st[b.uuid][0] == 1, '성형도 같은 소식이 떠받친다'


def test_하나만_떼어도_나머지는_남는다(db, client, auth, admin):
    a = _cap(admin, 'A 역량')
    b = _cap(admin, 'B 역량')
    t = _tool(admin, '걸친 도구')
    client.put(f'{BASE}/tech/{t.uuid}/capabilities',
               json={'capabilityUuids': [a.uuid, b.uuid]}, headers=auth(admin))

    client.put(f'{BASE}/tech/{t.uuid}/capabilities',
               json={'capabilityUuids': [b.uuid]}, headers=auth(admin))
    assert _caps_of(t) == [b.uuid]


def test_어디에도_안_걸린_도구만_레이더에_선다(db, client, auth, admin):
    """
    ⚠️ 예전 `parent_uuid IS NULL` 자리다. 여러 곳에 걸릴 수 있게 됐어도 **하나라도
       걸렸으면 레이더에는 안 선다** — 그 역량이 대신 서기 때문이다.
    """
    a = _cap(admin, 'A 역량')
    b = _cap(admin, 'B 역량')
    t = _tool(admin, '걸친 도구')
    orphan = _tool(admin, '아무 데도 안 걸린 도구')
    client.put(f'{BASE}/tech/{t.uuid}/capabilities',
               json={'capabilityUuids': [a.uuid, b.uuid]}, headers=auth(admin))

    r = client.get(f'{BASE}/tech?radar=1', headers=auth(admin))
    names = sorted(x['name'] for x in (r.get_json() or {}).get('data') or [])
    assert names == ['A 역량', 'B 역량', '아무 데도 안 걸린 도구'], names
    assert orphan.uuid


def test_같은_짝을_두_번_적어도_한_줄이다(db, client, auth, admin):
    """⚠️ 두 줄이 되면 「도구 3개」가 4개로 세어진다."""
    from app.modules.digital_twin_intel.models import IntelTechCapability

    cap = _cap(admin, 'CFD')
    t = _tool(admin, 'OpenFOAM')
    client.put(f'{BASE}/tech/{t.uuid}/capabilities',
               json={'capabilityUuids': [cap.uuid, cap.uuid]}, headers=auth(admin))
    assert IntelTechCapability.query.filter_by(tech_uuid=t.uuid).count() == 1


def test_역량으로_걸러_볼_수_있다(db, client, auth, admin):
    a = _cap(admin, 'A 역량')
    b = _cap(admin, 'B 역량')
    t = _tool(admin, '걸친 도구')
    _tool(admin, '딴 도구', b)
    client.put(f'{BASE}/tech/{t.uuid}/capabilities',
               json={'capabilityUuids': [a.uuid]}, headers=auth(admin))

    r = client.get(f'{BASE}/tech?capabilityUuid={a.uuid}', headers=auth(admin))
    assert [x['name'] for x in (r.get_json() or {}).get('data') or []] == ['걸친 도구']


# ── 「감지」 — 아직 아무도 안 본 자리 ────────────────────────────────────────
#
# ⚠️⚠️ 「감지」와 「관찰」의 차이가 이 층의 요점이다. 앞엣것은 **누가 넣었다**는
#    사실이고 뒤엣것은 **판단**이다. 안 갈려 있어서, 검토하고 동의한 것과 한 번도
#    안 열어 본 것이 화면에서 같아 보였다 — 504칸 중 24칸(4.8%)만 차 있었는데
#    나머지가 전부 「관찰」로 보였다.

def test_새로_들어온_것은_감지다(db, client, auth, admin):
    t = _tool(admin, '방금 들어온 도구')
    assert t.stage == '감지'
    c = _cap(admin, '방금 만든 역량')
    assert c.stage == '감지'


def test_감지는_낡음을_아예_안_잰다(db, client, auth, admin):
    """
    ⚠️⚠️ **재면 안 된다.** 아무도 안 본 것이 수십 개인데 반년 뒤 한꺼번에 켜지면,
       낡음 표시가 신호가 아니라 잡음이 된다 — 이 모듈의 자정 장치를 스스로
       망가뜨리는 셈이다.
    """
    old = _cap(admin, '오래 방치된 감지')
    old.created_at = datetime.utcnow() - timedelta(days=2000)
    old.stage_changed_at = old.created_at
    _db.session.commit()

    row = next(x for x in (client.get(f'{BASE}/tech', headers=auth(admin))
                           .get_json() or {})['data'] if x['name'] == '오래 방치된 감지')
    assert row['stage'] == '감지'
    assert row['isStale'] is False, '감지는 낡을 것이 없다'
    assert row['staleAfterDays'] is None

    # 「지켜보기로 정했다」로 옮기면 그때부터 잰다.
    client.put(f'{BASE}/tech/{old.uuid}/stage', json={'stage': '관찰'},
               headers=auth(admin))
    _db.session.expire_all()
    o2 = IntelTech.query.filter_by(uuid=old.uuid).first()
    o2.stage_changed_at = datetime.utcnow() - timedelta(days=200)
    _db.session.commit()
    row2 = next(x for x in (client.get(f'{BASE}/tech', headers=auth(admin))
                            .get_json() or {})['data'] if x['name'] == '오래 방치된 감지')
    assert row2['staleAfterDays'] == 180 and row2['isStale'] is True


def test_감지도_요약의_낡음_셈에_안_든다(db, client, auth, admin):
    for i in range(3):
        c = _cap(admin, '안 본 역량 %d' % i)
        c.created_at = datetime.utcnow() - timedelta(days=2000)
        c.stage_changed_at = c.created_at
    _db.session.commit()
    d = (client.get(f'{BASE}/overview', headers=auth(admin)).get_json() or {})['data']
    assert d['staleTech'] == 0, '아무도 안 본 것이 낡음으로 세어지면 안 된다'


# ── 점은 사업부가 적은 자리에만 선다 ────────────────────────────────────────

def test_사업부가_어디_있는지를_함께_보낸다(db, client, auth, admin):
    """
    ⚠️⚠️ **레이더가 그리는 것이 이것뿐이다.** 예전에는 기본 설정 고리에 주점을
       하나 놓고 갈리는 사업부만 위성으로 찍었는데, 아무도 안 적은 역량 48개가
       전부 「감지」 고리에 뭉쳐 그림이 안 읽혔다(2026-08-26 신고). 이제 점은
       **사업부가 적은 자리에만** 서고 기본 설정 점은 안 그린다.
    """
    from app.modules.digital_twin_dashboard.models import Division
    for i, nm in enumerate(['MX', 'VD']):
        if Division.query.filter_by(name=nm).first() is None:
            _db.session.add(Division(name=nm, order=i, is_active=True))
    _db.session.commit()

    cap = _cap(admin, 'explicit 해석')
    client.put(f'{BASE}/tech/{cap.uuid}/division-stage',
               json={'division': 'MX', 'stage': '도입', 'reason': '3년째'},
               headers=auth(admin))
    client.put(f'{BASE}/tech/{cap.uuid}/division-stage',
               json={'division': 'VD', 'stage': '시험', 'reason': '검토 중'},
               headers=auth(admin))

    row = next(x for x in (client.get(f'{BASE}/tech', headers=auth(admin))
                           .get_json() or {})['data'] if x['name'] == 'explicit 해석')
    assert row['stage'] == '감지', '기본 설정 값은 그대로 온다 — 안 그릴 뿐이다'
    assert row['divisionMarks'] == [
        {'division': 'MX', 'stage': '도입', 'follows': False},
        {'division': 'VD', 'stage': '시험', 'follows': False}]


def test_아무도_안_적은_역량은_점이_없다(db, client, auth, admin):
    """
    ⚠️⚠️ **이것이 이번 바꿈의 핵심이다.** 63개 중 48개가 아무도 안 적은 것이었고,
       그것들이 죄다 「감지」 고리에 뭉쳐 있었다. 줄은 그대로 오되(목록ㆍ계통이
       쓴다) **찍을 자리가 없다는 것**이 자료에 드러나야 한다.
    """
    _cap(admin, '아무도 안 본 역량')
    row = next(x for x in (client.get(f'{BASE}/tech', headers=auth(admin))
                           .get_json() or {})['data']
               if x['name'] == '아무도 안 본 역량')
    assert 'divisionMarks' not in row


def test_사업부_눈일_때는_적었는지를_또렷이_말한다(db, client, auth, admin):
    """
    ⚠️ 「내 사업부 눈」인데 남의 점이 널리면 지금 보는 것이 무엇인지 흐려진다 —
       그래서 위성 자료는 안 보낸다.

    ⚠️⚠️ 대신 **적었는지 아닌지**를 서버가 말해 준다. 화면이 `isDivisionOverride`
       나 `divisionTools` 로 짐작하게 두면 「단계만 적고 도구는 안 적은 줄」에서
       조용히 어긋난다.
    """
    from app.modules.digital_twin_dashboard.models import Division
    if Division.query.filter_by(name='MX').first() is None:
        _db.session.add(Division(name='MX', order=0, is_active=True))
        _db.session.commit()

    cap = _cap(admin, 'CFD')
    quiet = _cap(admin, '아무도 안 본 역량2')
    client.put(f'{BASE}/tech/{cap.uuid}/division-stage',
               json={'division': 'MX', 'stage': '도입', 'reason': '쓴다'},
               headers=auth(admin))

    rows = (client.get(f'{BASE}/tech?division=MX', headers=auth(admin))
            .get_json() or {})['data']
    row = next(x for x in rows if x['uuid'] == cap.uuid)
    assert row['stage'] == '도입', '그 사업부 값이 점 자리가 된다'
    assert 'divisionMarks' not in row
    assert row['hasDivisionRow'] is True

    assert next(x for x in rows
                if x['uuid'] == quiet.uuid)['hasDivisionRow'] is False


def test_도구만_적은_줄도_점이_된다(db, client, auth, admin):
    """
    ⚠️⚠️ **가장 싼 입력이 화면에 나타나야 한다.** 「우리도 그대로, 도구는
       OpenFOAM」은 갈림은 아니지만 **어디에 있는지에 대한 답은 맞다.** 게다가
       「사업부 적기」에서 제일 많이 적히는 것이 이 모양이라, 안 그리면 제일 많이
       적은 것이 화면에 없고 — 그러면 적을 까닭이 사라진다.

    ⚠️ 그래도 `follows` 로 갈라 둔다. 「같아서 여기 있다」와 「다르게 보기로 정해서
       여기 있다」는 무게가 다르고, 화면이 그걸 달리 그려야 한다.
    """
    from app.modules.digital_twin_dashboard.models import Division
    if Division.query.filter_by(name='MX').first() is None:
        _db.session.add(Division(name='MX', order=0, is_active=True))
        _db.session.commit()

    cap = _cap(admin, 'CFD')            # 기본 설정 「감지」
    tool = _tool(admin, 'OpenFOAM', cap)
    client.put(f'{BASE}/tech/{cap.uuid}/division-stage',
               json={'division': 'MX', 'tools': [tool.uuid]}, headers=auth(admin))

    row = next(x for x in (client.get(f'{BASE}/tech', headers=auth(admin))
                           .get_json() or {})['data'] if x['name'] == 'CFD')
    # 기본 설정 단계로 풀어서 그 자리에 찍는다.
    assert row['divisionMarks'] == [
        {'division': 'MX', 'stage': '감지', 'follows': True}]
