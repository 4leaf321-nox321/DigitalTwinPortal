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
                           parentUuid=(parent.uuid if parent else None))
    assert err is None, err
    return t


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
    r = client.put(f'{BASE}/tech/{tool.uuid}/parent',
                   json={'parentUuid': cap.uuid}, headers=auth(plain))
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'
    _db.session.expire_all()
    assert IntelTech.query.filter_by(uuid=tool.uuid).first().parent_uuid == cap.uuid


def test_떼어_낼_수_있다(db, client, auth, admin):
    cap = _cap(admin, 'CFD')
    tool = _tool(admin, 'OpenFOAM', cap)
    client.put(f'{BASE}/tech/{tool.uuid}/parent', json={'parentUuid': ''},
               headers=auth(admin))
    _db.session.expire_all()
    assert IntelTech.query.filter_by(uuid=tool.uuid).first().parent_uuid is None


def test_자기_자신을_상위로_못_둔다(db, client, auth, admin):
    """고리가 생기면 근거를 굴려 올릴 때 무한히 돈다."""
    t = _tool(admin, 'X')
    r = client.put(f'{BASE}/tech/{t.uuid}/parent', json={'parentUuid': t.uuid},
                   headers=auth(admin))
    assert r.status_code == 400


def test_도구_밑에_도구를_못_매단다(db, client, auth, admin):
    a = _tool(admin, 'A')
    b = _tool(admin, 'B')
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
    client.put(f'{BASE}/tech/{tool.uuid}/parent', json={'parentUuid': ''},
               headers=auth(admin))
    r = client.patch(f'{BASE}/tech/{cap.uuid}', json={'kind': 'tool'},
                     headers=auth(admin))
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'


def test_도구는_상위_이름까지_함께_온다(db, client, auth, admin):
    """
    ⚠️ uuid 만 주면 화면이 「어느 역량인가」를 보여주려고 목록 전체를 뒤져야 하는데,
       **걸러 본 목록에는 그 역량이 아예 없을 수 있다** — 그러면 빈칸이 뜬다.
    """
    cap = _cap(admin, 'explicit 해석')
    _tool(admin, 'LS-DYNA', cap)

    r = client.get(f'{BASE}/tech?kind=tool', headers=auth(admin))
    row = next(x for x in (r.get_json() or {}).get('data') or [] if x['name'] == 'LS-DYNA')
    assert row['parentUuid'] == cap.uuid
    assert row['parentName'] == 'explicit 해석'


def test_안_매달린_도구는_상위가_비어_온다(db, client, auth, admin):
    _tool(admin, '혼자 선 도구')
    r = client.get(f'{BASE}/tech', headers=auth(admin))
    row = next(x for x in (r.get_json() or {}).get('data') or []
               if x['name'] == '혼자 선 도구')
    assert row['parentUuid'] is None
    assert row.get('parentName') is None


# ── 만들면서 매다는 길 (MCP 가 쓰는 길) ──────────────────────────────────────

def test_만들면서_매달_수_있다(db, client, auth, admin):
    """MCP 는 조사해 온 도구를 넣으면서 바로 매단다 — 두 번 왕복할 이유가 없다."""
    cap = _cap(admin, 'CFD')
    r = client.post(f'{BASE}/tech',
                    json={'name': 'OpenFOAM', 'parentUuid': cap.uuid},
                    headers=auth(admin))
    assert r.status_code == 201, f'{r.status_code} · {r.get_json()}'
    assert (r.get_json() or {})['data']['parentUuid'] == cap.uuid


def test_만들면서_매다는_길도_같은_규칙을_받는다(db, client, auth, admin):
    """
    ⚠️⚠️ **여기가 뒷문이 되면 안 된다.** 만들기에 검사를 안 걸면 `set_parent` 의
       층 규칙을 통째로 우회하는 길이 생기고, MCP 는 만들기와 매달기를 한 번에
       하므로 **그 길로만 들어오는 줄이 실제로 생긴다.**
    """
    tool = _tool(admin, '그냥 도구')
    cap = _cap(admin, 'CFD')

    # 도구 밑에 도구
    r = client.post(f'{BASE}/tech', json={'name': 'X', 'parentUuid': tool.uuid},
                    headers=auth(admin))
    assert r.status_code == 400 and '역량이어야' in (r.get_json() or {}).get('message', '')

    # 역량을 다른 것 밑에
    r = client.post(f'{BASE}/tech',
                    json={'name': 'Y', 'kind': 'capability', 'parentUuid': cap.uuid},
                    headers=auth(admin))
    assert r.status_code == 400 and '층은 둘까지' in (r.get_json() or {}).get('message', '')

    # 없는 상위
    r = client.post(f'{BASE}/tech', json={'name': 'Z', 'parentUuid': 'no-such'},
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
