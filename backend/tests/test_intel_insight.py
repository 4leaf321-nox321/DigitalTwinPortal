"""이미 있는 데이터에서 더 꺼내 쓰는 것들 — 움직임ㆍ공출현ㆍ원문검색ㆍ요약.

넷 다 **표를 새로 만들지 않는다.** 쌓아 둔 것을 안 쓰고 있었을 뿐이다.
"""
from datetime import datetime, timedelta

import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_intel import services as S

BASE = '/api/digital-twin-intel'


@pytest.fixture()
def admin(make_user):
    return make_user('insight@test.local', UserRole.ADMIN)


def _news(client, auth, user, url, **over):
    body = {'title': '시험 소식', 'url': url}
    body.update(over)
    r = client.post(f'{BASE}/news', json=body, headers=auth(user))
    assert r.status_code == 201, f'{r.status_code} · {r.get_json()}'
    return (r.get_json() or {}).get('data')


# ── ① 어디서 왔나 ────────────────────────────────────────────────────────────

def test_최근에_어느_단계에서_왔는지_알려준다(db, client, auth, admin):
    """
    ⚠️ 지금까지는 「움직였다」만 표시했다. 레이더의 값은 **어디서 어디로 갔나**에
       있다 — 「관찰에 뭐가 있나」보다 「무엇이 안쪽으로 들어왔나」가 판단에 쓰인다.
    """
    t, _ = S.create_tech(actor_id=admin.id, name='움직인 기술')
    client.put(f'{BASE}/tech/{t.uuid}/stage', json={'stage': '시험'}, headers=auth(admin))

    r = client.get(f'{BASE}/tech', headers=auth(admin))
    row = next(x for x in (r.get_json() or {}).get('data') or []
               if x['name'] == '움직인 기술')
    assert row['movedFrom'] == '관찰'
    assert row['stage'] == '시험'
    assert row['movedAt']


def test_여러_번_움직였으면_가장_오래된_출발점을_쓴다(db, client, auth, admin):
    """
    ⚠️ 관찰→시험→도입 을 두 화살표로 그리면 어지럽다. 사람이 알고 싶은 것은
       「그 사이에 어디서 여기까지 왔나」다.
    """
    t, _ = S.create_tech(actor_id=admin.id, name='두 번 움직인 기술')
    client.put(f'{BASE}/tech/{t.uuid}/stage', json={'stage': '시험'}, headers=auth(admin))
    client.put(f'{BASE}/tech/{t.uuid}/stage', json={'stage': '도입'}, headers=auth(admin))

    r = client.get(f'{BASE}/tech', headers=auth(admin))
    row = next(x for x in (r.get_json() or {}).get('data') or []
               if x['name'] == '두 번 움직인 기술')
    assert row['movedFrom'] == '관찰', '중간 단계가 아니라 출발점이어야 한다'
    assert row['stage'] == '도입'


def test_오래된_이동은_안_실린다(db, client, auth, admin):
    """화살표가 영원히 남으면 **전부 움직인 것처럼 보여** 아무 신호도 아니게 된다."""
    from app.modules.digital_twin_intel.models import IntelChange

    t, _ = S.create_tech(actor_id=admin.id, name='옛날에 움직인 기술')
    client.put(f'{BASE}/tech/{t.uuid}/stage', json={'stage': '시험'}, headers=auth(admin))
    row = IntelChange.query.filter_by(subject_uuid=t.uuid).first()
    row.created_at = datetime.utcnow() - timedelta(days=200)
    _db.session.commit()

    r = client.get(f'{BASE}/tech', headers=auth(admin))
    got = next(x for x in (r.get_json() or {}).get('data') or []
               if x['name'] == '옛날에 움직인 기술')
    assert 'movedFrom' not in got


def test_안_움직인_것에는_안_붙는다(db, client, auth, admin):
    S.create_tech(actor_id=admin.id, name='가만있는 기술')
    r = client.get(f'{BASE}/tech', headers=auth(admin))
    got = next(x for x in (r.get_json() or {}).get('data') or []
               if x['name'] == '가만있는 기술')
    assert 'movedFrom' not in got


# ── ② 함께 나온 기술 ─────────────────────────────────────────────────────────

def test_같은_소식에_함께_걸린_기술을_센다(db, client, auth, admin):
    """
    ⚠️ 레이더는 기술을 하나씩 따로 보여준다. 실제 판단은 「이걸 하려면 저것도
       필요한가」인데, 그 정보는 근거 표에 **이미 있었고 아무 데도 안 보였다.**
    """
    _news(client, auth, admin, 'https://e.test/c1',
          technologies=[{'name': 'Omniverse'}, {'name': 'OpenUSD'}])
    _news(client, auth, admin, 'https://e.test/c2',
          technologies=[{'name': 'Omniverse'}, {'name': 'OpenUSD'}, {'name': 'FMI'}])

    from app.modules.digital_twin_intel.models import IntelTech
    ov = IntelTech.query.filter_by(name='Omniverse').first()
    r = client.get(f'{BASE}/tech/{ov.uuid}/related', headers=auth(admin))
    rows = (r.get_json() or {}).get('data') or []
    by = {x['name']: x['together'] for x in rows}
    assert by.get('OpenUSD') == 2, by
    assert by.get('FMI') == 1, by
    assert 'Omniverse' not in by, '자기 자신은 안 센다'


def test_함께_나온_것이_없으면_빈_목록(db, client, auth, admin):
    _news(client, auth, admin, 'https://e.test/c3', technologies=[{'name': '혼자'}])
    from app.modules.digital_twin_intel.models import IntelTech
    t = IntelTech.query.filter_by(name='혼자').first()
    r = client.get(f'{BASE}/tech/{t.uuid}/related', headers=auth(admin))
    assert (r.get_json() or {}).get('data') == []


# ── ③ 원문까지 찾는다 ────────────────────────────────────────────────────────

def test_원문_속_한_단어로도_찾힌다(db, client, auth, admin):
    """
    ⚠️ 원문을 담는 이유가 「나중에 읽으려고」인데 **못 찾으면 안 읽는다.**
       3천 자를 넣어 두고 제목으로만 찾던 것을 고쳤다.
    """
    _news(client, auth, admin, 'https://e.test/body', title='제목엔 없다',
          body='본문 안에만 있는 낱말: 형상관리특이점')

    r = client.get(f'{BASE}/news?q=형상관리특이점', headers=auth(admin))
    rows = (r.get_json() or {}).get('data') or []
    assert len(rows) == 1 and rows[0]['title'] == '제목엔 없다'


def test_기술_설명_속_낱말로도_찾힌다(db, client, auth, admin):
    S.create_tech(actor_id=admin.id, name='이름은 평범',
                  description='설명에만 있는 낱말: 리드타임단축')
    r = client.get(f'{BASE}/tech?q=리드타임단축', headers=auth(admin))
    rows = (r.get_json() or {}).get('data') or []
    assert len(rows) == 1 and rows[0]['name'] == '이름은 평범'


# ── ④ 오늘 뭘 봐야 하나 ──────────────────────────────────────────────────────

def test_요약이_할_일을_센다(db, client, auth, admin):
    """
    ⚠️ 열면 기술 100여 개가 깔린다. 무엇을 봐야 하는지가 없으면 **훑다가 닫는다.**
    """
    _news(client, auth, admin, 'https://e.test/o1')
    _news(client, auth, admin, 'https://e.test/o2')
    S.create_tech(actor_id=admin.id, name='근거 없는 기술')

    r = client.get(f'{BASE}/overview', headers=auth(admin))
    d = (r.get_json() or {}).get('data') or {}
    assert d['unreadNews'] == 2
    assert d['totalNews'] == 2
    assert d['noEvidenceTech'] >= 1
    assert d['unlinkedNews'] == 2, '아직 우리 것과 안 이어진 소식'


def test_소식_목록에_연결_수가_실린다(db, client, auth, admin):
    """
    ⚠️ 「아직 우리 것과 안 이어진 소식」을 거르려면 **셈이 목록에 함께 와야 한다.**
       없으면 화면이 소식마다 따로 물어야 하고, 수백 건이면 그만큼 왕복한다.
    """
    n = _news(client, auth, admin, 'https://e.test/lc')
    r = client.get(f'{BASE}/news', headers=auth(admin))
    got = next(x for x in (r.get_json() or {}).get('data') or [] if x['uuid'] == n['uuid'])
    assert got['linkCount'] == 0

    client.post(f'{BASE}/links',
                json={'subjectKind': 'news', 'subjectUuid': n['uuid'],
                      'targetKind': 'project', 'targetRef': 'p-x'},
                headers=auth(admin))
    r2 = client.get(f'{BASE}/news', headers=auth(admin))
    got2 = next(x for x in (r2.get_json() or {}).get('data') or [] if x['uuid'] == n['uuid'])
    assert got2['linkCount'] == 1


def test_읽은_것은_안_읽은_수에서_빠진다(db, client, auth, admin):
    n = _news(client, auth, admin, 'https://e.test/o3')
    client.patch(f'{BASE}/news/{n["uuid"]}', json={'status': '확인됨'},
                 headers=auth(admin))
    r = client.get(f'{BASE}/overview', headers=auth(admin))
    assert (r.get_json() or {}).get('data', {}).get('unreadNews') == 0


# ── 「최근 며칠」을 보는 사람이 고른다 ───────────────────────────────────────

def test_최근_며칠로_볼지_고를_수_있다(db, client, auth, admin):
    """
    ⚠️⚠️ **이 값은 서버가 쥔다.** 화면이 따로 재면 화살표ㆍ테ㆍ범례가 서로 다른
       기간을 말하게 되고, 그 순간 셋 다 못 믿게 된다.
    """
    from app.modules.digital_twin_intel.models import IntelChange

    t, _ = S.create_tech(actor_id=admin.id, name='반년 전에 움직인 기술')
    client.put(f'{BASE}/tech/{t.uuid}/stage', json={'stage': '시험'},
               headers=auth(admin))
    row = IntelChange.query.filter_by(subject_uuid=t.uuid).first()
    row.created_at = datetime.utcnow() - timedelta(days=150)
    _db.session.commit()

    def moved(qs=''):
        r = client.get(f'{BASE}/tech{qs}', headers=auth(admin))
        got = next(x for x in (r.get_json() or {}).get('data') or []
                   if x['name'] == '반년 전에 움직인 기술')
        return got.get('movedFrom')

    assert moved() is None, '기본 90일로는 안 보인다'
    assert moved('?movedDays=200') == '관찰', '200일로 보면 보인다'
    assert moved('?movedDays=30') is None, '30일로 좁히면 다시 안 보인다'


def test_말도_안_되는_기간은_물린다(db, client, auth, admin):
    """
    ⚠️ 너무 길면 **전부 움직인 것처럼 보여** 아무 신호도 아니게 된다. 0ㆍ음수ㆍ글자도
       기본값으로 되돌린다 — 화면이 잘못 보내도 표가 거짓말하면 안 된다.
    """
    for bad in ('0', '-5', '99999', 'abc', ''):
        r = client.get(f'{BASE}/tech?movedDays={bad}', headers=auth(admin))
        assert r.status_code == 200, bad


def test_고를_수_있는_범위를_알려준다(db, client, auth, admin):
    r = client.get(f'{BASE}/settings', headers=auth(admin))
    d = (r.get_json() or {}).get('data') or {}
    assert d['movedWindowDays'] == 90
    assert d['movedWindowRange'] == [7, 1095]


# ── 요약 막대의 셈이 「눌렀을 때 보이는 것」과 같아야 한다 ───────────────────

def test_요약은_레이더에_서는_것만_센다(db, client, auth, admin):
    """
    ⚠️⚠️ **안 맞으면 이 막대를 아무도 안 믿는다.** 「낡은 기술 200」을 눌렀는데
       화면에 20개만 뜨면 그렇게 된다. 매달린 도구는 레이더에 안 서므로 눌러도
       안 보인다 — 그러니 세지도 않는다.
       실측(2026-08-25) — 전체 322줄 중 레이더에 서는 것은 63개뿐이었다.
    """
    cap, _ = S.create_tech(actor_id=admin.id, name='explicit 해석',
                           kind='capability')
    S.create_tech(actor_id=admin.id, name='LS-DYNA', parentUuid=cap.uuid)
    S.create_tech(actor_id=admin.id, name='아직 안 매단 도구')

    d = (client.get(f'{BASE}/overview', headers=auth(admin)).get_json() or {})['data']
    assert d['totalTech'] == 2, '역량 + 안 매달린 도구만 (매달린 LS-DYNA 는 뺀다)'
    assert d['capabilityCount'] == 1
    assert d['toolCount'] == 2, '도구 수는 따로, 전부 센다'

    # 눌렀을 때 보이는 것과 같은지 — 레이더 목록과 맞춰 본다.
    r = client.get(f'{BASE}/tech?radar=1', headers=auth(admin))
    assert len(r.get_json()['data']) == d['totalTech']


def test_요약의_이동도_고른_기간을_따른다(db, client, auth, admin):
    """
    ⚠️ 막대는 「최근 30일」이라 써 놓고 레이더는 90일을 그리고 있었다. 같은 값을
       봐야 한다 — 안 그러면 눌러서 뜨는 수와 적힌 수가 다르다.
    """
    from app.modules.digital_twin_intel.models import IntelChange

    t, _ = S.create_tech(actor_id=admin.id, name='두 달 전에 움직인 기술')
    client.put(f'{BASE}/tech/{t.uuid}/stage', json={'stage': '시험'},
               headers=auth(admin))
    row = IntelChange.query.filter_by(subject_uuid=t.uuid).first()
    row.created_at = datetime.utcnow() - timedelta(days=60)
    _db.session.commit()

    def n(qs=''):
        d = (client.get(f'{BASE}/overview{qs}',
                        headers=auth(admin)).get_json() or {})['data']
        return d['movedRecent'], d['movedWindowDays']

    assert n() == (1, 90), '기본이 레이더와 **같은 90일**이라 잡힌다'
    assert n('?movedDays=30') == (0, 30), '30일로 좁히면 안 잡힌다'
    assert n('?movedDays=180') == (1, 180), '넓히면 그대로 잡힌다'
