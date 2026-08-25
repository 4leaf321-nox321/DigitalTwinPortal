"""「무엇으로 하나」 — 사업부 단계에 이유와 도구를 붙인다.

⚠️⚠️ **단계만 있고 왜ㆍ무엇으로가 없으면 이 표는 앞선 세 번의 시도와 똑같아진다** —
   적혀는 있는데 아무도 왜인지 모르는 표(tech_radar · tech_archive ·
   digital_twin_solution 이 그렇게 죽었다). 「MX 도입」 네 글자는 6개월 뒤 아무 뜻도
   아니다. 사업부 비교의 알맹이는 **「MX 는 explicit 해석을 도입했고 LS-DYNA 를
   쓴다」** 한 문장이다.

여기서 지키는 것 세 가지
    ① 예외를 만들려면 **이유가 있어야 한다**
    ② 기본 설정을 따르면서 **도구만** 적을 수 있다 (가장 흔한 경우다)
    ③ 도구는 **그 역량 밑에 매달린 것**에서만 고른다
"""
import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_intel import services as S
from app.modules.digital_twin_intel.models import IntelDivisionStage, IntelTech

BASE = '/api/digital-twin-intel'


@pytest.fixture()
def admin(make_user):
    return make_user('divtools@test.local', UserRole.ADMIN)


@pytest.fixture()
def divs(db):
    from app.modules.digital_twin_dashboard.models import Division
    for i, name in enumerate(['MX', 'VD']):
        if Division.query.filter_by(name=name).first() is None:
            _db.session.add(Division(name=name, order=i, is_active=True))
    _db.session.commit()
    return ['MX', 'VD']


def _cap(admin, name, stage='관찰'):
    t, err = S.create_tech(actor_id=admin.id, name=name, kind='capability',
                           stage=stage)
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


def _put(client, auth, user, t, division, **body):
    return client.put(f'{BASE}/tech/{t.uuid}/division-stage',
                      json={'division': division, **body}, headers=auth(user))


def _row(client, auth, user, url, name):
    r = client.get(url, headers=auth(user))
    return next(x for x in (r.get_json() or {}).get('data') or []
                if x['name'] == name)


# ── ① 이유 없이는 예외를 못 만든다 ───────────────────────────────────────────

def test_이유_없이는_예외를_못_만든다(db, client, auth, admin, divs):
    """
    ⚠️⚠️ **이 시험이 이 판의 요점이다.** 예전에는 드롭다운으로 단계만 고르면
       끝이었다. 한 번 누르면 「MX 도입」이 박히는데, 왜 그런지는 아무 데도 없었다.
    """
    cap = _cap(admin, 'CFD', stage='관찰')
    r = _put(client, auth, admin, cap, 'MX', stage='도입')
    assert r.status_code == 400
    assert '이유' in (r.get_json() or {}).get('message', '')
    assert IntelDivisionStage.query.count() == 0, '막혔으면 줄도 안 남아야 한다'

    assert _put(client, auth, admin, cap, 'MX', stage='도입',
                reason='3년째 쓰는 중').status_code == 200


# ── ② 기본 설정을 따르면서 도구만 ────────────────────────────────────────────────

def test_기본설정을_따르면서_도구만_적을_수_있다(db, client, auth, admin, divs):
    """
    ⚠️⚠️ **가장 흔한 경우다** — 기본 설정도 도입, 우리도 도입, 우리는 LS-DYNA 를 쓴다.
       예외를 만들어야만 도구를 적을 수 있으면 이 경우를 **아예 못 적는다.**
       그래서 단계를 비운 줄을 허락한다: 기본 설정이 움직이면 **같이 움직인다.**
    """
    cap = _cap(admin, 'explicit 해석', stage='도입')
    dyna = _tool(admin, 'LS-DYNA', cap)

    r = _put(client, auth, admin, cap, 'MX', stage='', tools=[dyna.uuid])
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'

    mx = _row(client, auth, admin, f'{BASE}/tech?division=MX', 'explicit 해석')
    assert mx['isDivisionOverride'] is False, '예외가 아니다 — 기본 설정을 따른다'
    assert mx['stage'] == '도입'
    assert mx['divisionTools'] == ['LS-DYNA']

    # 기본 설정이 움직이면 MX 도 따라간다. 적어 둔 도구는 그대로 남는다.
    client.put(f'{BASE}/tech/{cap.uuid}/stage',
               json={'stage': '보류', 'reason': '기본 설정 차원 중단'},
               headers=auth(admin))
    mx2 = _row(client, auth, admin, f'{BASE}/tech?division=MX', 'explicit 해석')
    assert mx2['stage'] == '보류', '붙박이면 안 된다'
    assert mx2['divisionTools'] == ['LS-DYNA']


def test_따르기만_할_땐_이유를_안_묻는다(db, client, auth, admin, divs):
    """⚠️ 「우리도 기본 설정과 같다」는 주장이 아니다. 이유를 물을 자리가 아니다."""
    cap = _cap(admin, 'CFD', stage='도입')
    tool = _tool(admin, 'OpenFOAM', cap)
    r = _put(client, auth, admin, cap, 'MX', tools=[tool.uuid])
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'
    assert IntelDivisionStage.query.count() == 1


def test_아무것도_안_담긴_줄은_안_남는다(db, client, auth, admin, divs):
    """
    ⚠️ 빈 줄이 남으면 「다르게 보는 사업부」 셈이 부푼다. 그 숫자가 이 화면의
       답이라, 부풀면 곧바로 못 믿게 된다.
    """
    cap = _cap(admin, 'CFD', stage='관찰')
    r = _put(client, auth, admin, cap, 'MX', stage='', tools=[])
    assert r.status_code == 200
    assert IntelDivisionStage.query.count() == 0


# ── ③ 도구는 그 역량 밑에서만 ───────────────────────────────────────────────

def test_사업부마다_다른_도구를_적는다(db, client, auth, admin, divs):
    """**이 한 문장이 사업부 비교의 알맹이다.**"""
    cap = _cap(admin, 'explicit 해석', stage='관찰')
    dyna = _tool(admin, 'LS-DYNA', cap)
    rad = _tool(admin, 'RADIOSS', cap)

    _put(client, auth, admin, cap, 'MX', stage='도입', reason='3년째 쓰는 중',
         tools=[dyna.uuid])
    _put(client, auth, admin, cap, 'VD', stage='도입', reason='차체 충돌 본업',
         tools=[rad.uuid])

    mx = _row(client, auth, admin, f'{BASE}/tech?division=MX', 'explicit 해석')
    vd = _row(client, auth, admin, f'{BASE}/tech?division=VD', 'explicit 해석')
    assert mx['divisionTools'] == ['LS-DYNA']
    assert vd['divisionTools'] == ['RADIOSS']


def test_그_역량_밑에_없는_도구는_안_받는다(db, client, auth, admin, divs):
    """
    ⚠️⚠️ 아무거나 받으면 「MX 는 explicit 해석을 Grafana 로 한다」가 조용히 생기고,
       「어느 사업부가 무엇을 쓰나」를 되짚을 때 답이 엉킨다. 안 매달린 도구를
       쓰고 있다면 **먼저 그 도구를 이 역량에 매다는 것**이 맞다 — 그 정리가
       역량 층의 값이다.
    """
    cap = _cap(admin, 'explicit 해석', stage='관찰')
    other = _tool(admin, 'Grafana')

    _put(client, auth, admin, cap, 'MX', stage='도입', reason='쓴다',
         tools=[other.uuid])
    mx = _row(client, auth, admin, f'{BASE}/tech?division=MX', 'explicit 해석')
    assert mx['divisionTools'] == [], '남의 역량 도구는 안 붙는다'


def test_고를_수_있는_도구를_함께_준다(db, client, auth, admin, divs):
    """⚠️ 화면이 목록 전체에서 고르게 하면 위 시험이 막는 일이 계속 일어난다."""
    cap = _cap(admin, 'explicit 해석')
    _tool(admin, 'LS-DYNA', cap)
    _tool(admin, 'RADIOSS', cap)
    _tool(admin, '남의 도구')

    r = client.get(f'{BASE}/tech/{cap.uuid}/division-stages', headers=auth(admin))
    d = (r.get_json() or {}).get('data') or {}
    assert sorted(c['name'] for c in d['toolChoices']) == ['LS-DYNA', 'RADIOSS']


# ── 되짚기 ───────────────────────────────────────────────────────────────────

def test_이_도구를_쓰는_사업부를_되짚는다(db, client, auth, admin, divs):
    """
    ⚠️ 적어 넣는 쪽만 있고 되짚는 쪽이 없으면 **적을 이유가 절반으로 준다.**
       「LS-DYNA 를 누가 쓰나」에 답이 나와야 사람이 「무엇으로 하나」를 채운다.
    """
    cap = _cap(admin, 'explicit 해석', stage='관찰')
    dyna = _tool(admin, 'LS-DYNA', cap)
    _put(client, auth, admin, cap, 'MX', stage='도입', reason='3년째',
         tools=[dyna.uuid])
    _put(client, auth, admin, cap, 'VD', stage='시험', reason='검토 중',
         tools=[dyna.uuid])

    r = client.get(f'{BASE}/tech/{dyna.uuid}/used-by', headers=auth(admin))
    rows = (r.get_json() or {}).get('data') or []
    assert [x['division'] for x in rows] == ['MX', 'VD']
    assert rows[0]['capability'] == 'explicit 해석'
    assert rows[0]['stage'] == '도입'


def test_안_쓰이는_도구는_빈_목록(db, client, auth, admin, divs):
    cap = _cap(admin, 'CFD')
    tool = _tool(admin, '아무도 안 쓰는 것', cap)
    r = client.get(f'{BASE}/tech/{tool.uuid}/used-by', headers=auth(admin))
    assert (r.get_json() or {}).get('data') == []


# ── 합치기가 열어 둔 구멍 ────────────────────────────────────────────────────

def test_역량을_합치면_매달린_도구가_따라간다(db, client, auth, admin, divs):
    """
    ⚠️⚠️ **역량 층을 넣으면서 생긴 구멍이다.** 합치기는 근거와 연결만 옮기고 있었다.
       안 옮기면 지는 쪽 밑 도구가 **없어진 uuid** 를 가리키고, 레이더는 「역량이거나
       부모 없는 도구」만 그리므로 그 도구들이 화면에서 **통째로 사라진다.**
    """
    keep = _cap(admin, 'explicit 해석', stage='관찰')
    drop = _cap(admin, '충돌해석', stage='관찰')
    dyna = _tool(admin, 'LS-DYNA', drop)

    r = client.post(f'{BASE}/tech/{drop.uuid}/merge',
                    json={'intoUuid': keep.uuid}, headers=auth(admin))
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'
    _db.session.expire_all()

    assert _caps_of(dyna) == [keep.uuid]

    r2 = client.get(f'{BASE}/tech?radar=1', headers=auth(admin))
    names = sorted(x['name'] for x in (r2.get_json() or {}).get('data') or [])
    assert names == ['explicit 해석'], names


def test_역량을_합치면_사업부_줄도_따라간다(db, client, auth, admin, divs):
    keep = _cap(admin, 'explicit 해석', stage='관찰')
    drop = _cap(admin, '충돌해석', stage='관찰')
    _put(client, auth, admin, drop, 'MX', stage='도입', reason='3년째')

    client.post(f'{BASE}/tech/{drop.uuid}/merge',
                json={'intoUuid': keep.uuid}, headers=auth(admin))
    _db.session.expire_all()

    rows = IntelDivisionStage.query.filter_by(tech_uuid=keep.uuid).all()
    assert [r.division for r in rows] == ['MX']
    assert IntelDivisionStage.query.filter_by(tech_uuid=drop.uuid).count() == 0


def test_도구를_합치면_무엇으로_하나도_따라간다(db, client, auth, admin, divs):
    """⚠️ 안 바꾸면 「무엇으로 하나」가 없어진 uuid 를 가리켜 **빈칸이 된다.**"""
    cap = _cap(admin, 'explicit 해석', stage='관찰')
    keep = _tool(admin, 'LS-DYNA', cap)
    drop = _tool(admin, '엘에스다이나', cap)
    _put(client, auth, admin, cap, 'MX', stage='도입', reason='3년째',
         tools=[drop.uuid])

    client.post(f'{BASE}/tech/{drop.uuid}/merge',
                json={'intoUuid': keep.uuid}, headers=auth(admin))
    _db.session.expire_all()

    mx = _row(client, auth, admin, f'{BASE}/tech?division=MX', 'explicit 해석')
    assert mx['divisionTools'] == ['LS-DYNA']


# ── 지우기ㆍ떼어내기가 남기는 자국 ───────────────────────────────────────────

def test_역량을_지우면_밑의_도구는_떼어져_살아남는다(db, client, auth, admin, divs):
    """
    ⚠️⚠️ **합치기에서 겪은 것과 같은 구멍이 지우기에도 있었다.** 안 추스르면 그 밑
       도구가 없어진 uuid 를 가리키고, 레이더는 「역량이거나 부모 없는 도구」만
       그리므로 그 도구들이 **화면에서 통째로 사라진다.** 미아로 돌리면 레이더에
       그대로 서므로 아무것도 안 사라진다.
    """
    cap = _cap(admin, 'explicit 해석')
    dyna = _tool(admin, 'LS-DYNA', cap)

    r = client.delete(f'{BASE}/tech/{cap.uuid}', headers=auth(admin))
    assert r.status_code == 200
    _db.session.expire_all()

    left = IntelTech.query.filter_by(uuid=dyna.uuid).first()
    assert left is not None, '도구까지 지워지면 안 된다'
    assert _caps_of(left) == [], '미아로 돌아야 한다'

    r2 = client.get(f'{BASE}/tech?radar=1', headers=auth(admin))
    names = [x['name'] for x in (r2.get_json() or {}).get('data') or []]
    assert 'LS-DYNA' in names, '레이더에서 사라지면 안 된다'


def test_역량을_지우면_사업부_줄도_사라진다(db, client, auth, admin, divs):
    cap = _cap(admin, 'CFD')
    _put(client, auth, admin, cap, 'MX', stage='도입', reason='쓴다')
    client.delete(f'{BASE}/tech/{cap.uuid}', headers=auth(admin))
    assert IntelDivisionStage.query.count() == 0


def test_도구를_지우면_무엇으로_하나에서도_빠진다(db, client, auth, admin, divs):
    """⚠️ 안 빼면 없는 이름을 가리키는 칸이 남고, 화면에는 그냥 빈칸으로 보인다."""
    cap = _cap(admin, 'explicit 해석')
    dyna = _tool(admin, 'LS-DYNA', cap)
    rad = _tool(admin, 'RADIOSS', cap)
    _put(client, auth, admin, cap, 'MX', stage='도입', reason='쓴다',
         tools=[dyna.uuid, rad.uuid])

    client.delete(f'{BASE}/tech/{dyna.uuid}', headers=auth(admin))
    _db.session.expire_all()

    mx = _row(client, auth, admin, f'{BASE}/tech?division=MX', 'explicit 해석')
    assert mx['divisionTools'] == ['RADIOSS']
    row = IntelDivisionStage.query.filter_by(tech_uuid=cap.uuid).first()
    assert dyna.uuid not in (row.tools or []), '가리키는 값까지 빠져야 한다'


def test_도구를_떼어_내면_그_역량의_무엇으로_하나에서_빠진다(db, client, auth,
                                                           admin, divs):
    """
    ⚠️⚠️ 떼어 내면 「MX 는 explicit 해석을 LS-DYNA 로 한다」는 **거짓말이 된다** —
       LS-DYNA 가 더는 explicit 해석에 속하지 않기 때문이다. 저장할 때 걸러지긴
       하지만, 그때까지 화면은 틀린 것을 보여준다.
    """
    cap = _cap(admin, 'explicit 해석')
    dyna = _tool(admin, 'LS-DYNA', cap)
    _put(client, auth, admin, cap, 'MX', stage='도입', reason='쓴다',
         tools=[dyna.uuid])

    client.put(f'{BASE}/tech/{dyna.uuid}/capabilities',
               json={'capabilityUuids': []}, headers=auth(admin))
    _db.session.expire_all()

    mx = _row(client, auth, admin, f'{BASE}/tech?division=MX', 'explicit 해석')
    assert mx.get('divisionTools', []) == []


def test_다른_역량으로_옮겨도_옛_역량에서_빠진다(db, client, auth, admin, divs):
    cap = _cap(admin, 'explicit 해석')
    other = _cap(admin, '충돌ㆍ고속 해석')
    dyna = _tool(admin, 'LS-DYNA', cap)
    _put(client, auth, admin, cap, 'MX', stage='도입', reason='쓴다',
         tools=[dyna.uuid])

    client.put(f'{BASE}/tech/{dyna.uuid}/capabilities',
               json={'capabilityUuids': [other.uuid]}, headers=auth(admin))
    _db.session.expire_all()

    mx = _row(client, auth, admin, f'{BASE}/tech?division=MX', 'explicit 해석')
    assert mx.get('divisionTools', []) == []
    assert _caps_of(dyna) == [other.uuid]
