"""사업부별 단계 — 「우리 사업부는 어디까지 왔나」.

⚠️⚠️ **기본 설정 값이 정본이고, 저장하는 것은 예외뿐이다.** 사업부 8개 × 역량 39개 =
   312칸을 채우게 하면 아무도 안 채우고, 채운 것도 곧 낡아 **표 전체를 못 믿게
   된다.** 없으면 기본 설정 값을 쓴다 — 그래서 「기본 설정과 같음」과 「아직 안 정함」이
   같은 뜻이 되고, 그게 맞다.

⚠️ 이 층은 **역량 위에서만 뜻이 있다**(test_intel_capability.py 참고). 도구
   단위로는 원리적으로 비교가 안 된다 — MX 가 LS-DYNA 도입, VD 가 RADIOSS 도입이면
   둘 다 「도입」인데 서로 다른 줄이라 누가 앞섰는지 읽을 수 없다.
"""
from datetime import datetime, timedelta

import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_intel import services as S
from app.modules.digital_twin_intel.models import IntelChange, IntelDivisionStage

BASE = '/api/digital-twin-intel'


@pytest.fixture()
def admin(make_user):
    return make_user('divstage@test.local', UserRole.ADMIN)


@pytest.fixture()
def plain(make_user):
    return make_user('divstage-plain@test.local', UserRole.USER)


@pytest.fixture()
def divs(db):
    """포털의 사업부 표. ⚠️ 이름을 모듈에 박지 않기로 했으므로 실제 표를 쓴다."""
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


def _put(client, auth, user, t, division, stage, reason='그냥', tools=None):
    """⚠️ 이유가 **기본값으로** 들어간다. 이제 이유 없이는 예외가 안 선다 —
       이유를 안 주는 경우를 시험하려면 `reason=''` 로 **또렷이** 비운다."""
    body = {'division': division, 'stage': stage}
    if reason:
        body['reason'] = reason
    if tools is not None:
        body['tools'] = tools
    return client.put(f'{BASE}/tech/{t.uuid}/division-stage', json=body,
                      headers=auth(user))


def _row(client, auth, user, url, name):
    r = client.get(url, headers=auth(user))
    return next(x for x in (r.get_json() or {}).get('data') or []
                if x['name'] == name)


# ── 정본과 예외 ──────────────────────────────────────────────────────────────

def test_안_적었으면_단계가_아예_없다(db, client, auth, admin, divs):
    """
    ⚠️⚠️ **이게 이 설계의 뼈대다.** 역량 자체는 단계를 안 갖는다 — 「우리 회사가
       이 역량에서 어디까지 왔나」에는 하나의 답이 없다. 아무도 안 적었으면
       비어 있는 것이 맞다. 예전에는 여기에 「기본 설정」을 두었는데, 아무도 안
       적은 역량 48개가 죄다 그 값 하나로 레이더에 뭉쳤다.
    """
    _cap(admin, 'CFD')
    row = _row(client, auth, admin, f'{BASE}/tech?division=MX', 'CFD')
    assert row['stage'] is None
    assert row['companyStage'] is None
    assert row['isDivisionOverride'] is False
    assert IntelDivisionStage.query.count() == 0


def test_사업부마다_다르게_선다(db, client, auth, admin, divs):
    """레이더가 사업부 눈으로 **다시 그려진다** — 거르는 것이 아니다."""
    cap = _cap(admin, 'explicit 해석')
    assert _put(client, auth, admin, cap, 'MX', '도입').status_code == 200
    assert _put(client, auth, admin, cap, 'VD', '시험').status_code == 200

    mx = _row(client, auth, admin, f'{BASE}/tech?division=MX', 'explicit 해석')
    vd = _row(client, auth, admin, f'{BASE}/tech?division=VD', 'explicit 해석')
    assert (mx['stage'], mx['isDivisionOverride']) == ('도입', True)
    assert (vd['stage'], vd['isDivisionOverride']) == ('시험', True)
    assert mx['companyStage'] is None, '역량에는 기준 단계가 없다'

    # 사업부를 안 고르면 **아무 단계도 아니다** — 누가 어디 있는지만 따로 온다.
    all_ = _row(client, auth, admin, f'{BASE}/tech', 'explicit 해석')
    assert all_['stage'] is None
    assert all_['divisionMarks'] == [{'division': 'MX', 'stage': '도입'},
                                     {'division': 'VD', 'stage': '시험'}]


def test_비우면_그_사업부_줄이_사라진다(db, client, auth, admin, divs):
    """
    ⚠️ 「아직 안 정했다」는 **줄이 없는 것**으로 적는다. 빈 줄을 남기면 「적은
       사업부」 셈이 부풀고, 그 숫자가 이 화면의 답이라 곧바로 못 믿게 된다.
    """
    cap = _cap(admin, 'CFD')
    _put(client, auth, admin, cap, 'MX', '도입')
    assert IntelDivisionStage.query.count() == 1

    _put(client, auth, admin, cap, 'MX', '', reason='')
    assert IntelDivisionStage.query.count() == 0
    assert _row(client, auth, admin, f'{BASE}/tech?division=MX', 'CFD')['stage']         is None


def test_도구만_적을_수는_없다(db, client, auth, admin, divs):
    """
    ⚠️⚠️ 예전에는 단계를 비운 채 도구만 적을 수 있었고, 그 줄은 「기본 설정을
       따른다」는 뜻이었다. 기본 설정이 없어진 지금 그런 줄은 **어디에 있는지를
       말하지 않는 줄**이라 레이더에 찍을 자리가 없다.
    """
    cap = _cap(admin, 'CFD')
    tool, err = S.create_tech(actor_id=admin.id, name='OpenFOAM', kind='tool')
    assert err is None, err
    S.set_capabilities(tool.uuid, [cap.uuid], actor=admin)

    r = client.put(f'{BASE}/tech/{cap.uuid}/division-stage',
                   json={'division': 'MX', 'tools': [tool.uuid]},
                   headers=auth(admin))
    assert r.status_code == 400
    assert '단계' in (r.get_json() or {}).get('message', '')
    assert IntelDivisionStage.query.count() == 0


def test_예외를_지우면_기본설정을_따른다(db, client, auth, admin, divs):
    cap = _cap(admin, 'CFD', stage='관찰')
    _put(client, auth, admin, cap, 'MX', '도입')
    r = client.delete(f'{BASE}/tech/{cap.uuid}/division-stage?division=MX',
                      headers=auth(admin))
    assert r.status_code == 200
    assert IntelDivisionStage.query.count() == 0


# ── 낡음 판정이 그 사업부의 단계를 읽는다 ────────────────────────────────────

def test_낡음_기준이_그_사업부의_단계를_따른다(db, client, auth, admin, divs):
    """
    ⚠️⚠️ 단계마다 기준 일수가 다르다(도입 540 · 관찰 180). 사업부가 「관찰」이라
       적었으면 그 사업부한테는 180일이 기준이다.

    ⚠️ **아무도 안 적은 역량은 낡을 것이 없다.** 「여기 있다」고 말한 적이 없는데
       「그 말이 낡았다」고 할 수는 없다. 기본값 270일을 물리면 역량 63개가
       만들자마자 죄다 「낡음」이 된다.
    """
    cap = _cap(admin, '느린 것')
    cap.stage_changed_at = datetime.utcnow() - timedelta(days=300)
    cap.created_at = cap.stage_changed_at
    _db.session.commit()
    _put(client, auth, admin, cap, 'MX', '관찰')

    nobody = _row(client, auth, admin, f'{BASE}/tech', '느린 것')
    assert nobody['staleAfterDays'] is None
    assert nobody['isStale'] is False

    mx = _row(client, auth, admin, f'{BASE}/tech?division=MX', '느린 것')
    assert mx['staleAfterDays'] == 180, '그 사업부의 단계로 잰다'
    assert mx['isStale'] is True


def test_이동_화살표가_그_사업부_이력만_본다(db, client, auth, admin, divs):
    """
    ⚠️⚠️ 안 나누면 화면은 「MX 기준」이라 써 놓고 화살표는 **남의 이동**을 그린다.
       거짓말하는 화살표는 없는 화살표보다 나쁘다.

    ⚠️ **처음 적은 것은 이동이 아니다.** 없던 자리에서 생긴 것이라 「어디서 왔는지」가
       없다 — 그때 화살표를 그리면 오지도 않은 길을 그린다.
    """
    cap = _cap(admin, '움직인 역량')
    _put(client, auth, admin, cap, 'MX', '시험')           # 처음 적음
    first = _row(client, auth, admin, f'{BASE}/tech?division=MX', '움직인 역량')
    assert 'movedFrom' not in first, '처음 적은 것은 이동이 아니다'

    _put(client, auth, admin, cap, 'MX', '도입')           # MX: 시험 → 도입
    mx = _row(client, auth, admin, f'{BASE}/tech?division=MX', '움직인 역량')
    assert mx['stage'] == '도입'
    assert mx['movedFrom'] == '시험'

    # 옆 사업부는 안 움직였다 — 남의 이력을 끌어오면 안 된다.
    _put(client, auth, admin, cap, 'VD', '관찰')
    vd = _row(client, auth, admin, f'{BASE}/tech?division=VD', '움직인 역량')
    assert 'movedFrom' not in vd


def test_기본설정_이력에_사업부_판단이_안_섞인다(db, client, auth, admin, divs):
    cap = _cap(admin, 'CFD', stage='관찰')
    _put(client, auth, admin, cap, 'MX', '도입')

    row = _row(client, auth, admin, f'{BASE}/tech', 'CFD')
    assert 'movedFrom' not in row, '기본 설정은 안 움직였다'
    assert IntelChange.query.filter_by(scope='MX').count() == 1


# ── 거르기 ───────────────────────────────────────────────────────────────────

def test_단계로_거를_때도_푼_값을_쓴다(db, client, auth, admin, divs):
    """
    ⚠️ 단계 거르기를 SQL 로 하면 **컬럼 값**을 보게 되는데, 화면에 그려지는 것은
       푼 값이다. 「도입만」을 눌렀는데 도입 아닌 것이 나오거나 그 반대가 된다.
    """
    a = _cap(admin, '기본 설정만 도입', stage='도입')
    b = _cap(admin, 'MX 만 도입', stage='관찰')
    _put(client, auth, admin, b, 'MX', '도입')
    _put(client, auth, admin, a, 'MX', '보류', reason='우리는 안 쓴다')

    r = client.get(f'{BASE}/tech?division=MX&stage=도입', headers=auth(admin))
    names = sorted(x['name'] for x in (r.get_json() or {}).get('data') or [])
    assert names == ['MX 만 도입'], names


# ── 판단을 좁힌 것을 지킨다 ──────────────────────────────────────────────────

def test_아무나_못_옮긴다(db, client, auth, plain, admin, divs):
    """
    ⚠️ 사업부별이라고 아무나 옮기게 하면, 좁혀 둔 「조직의 판단」이 **옆문으로**
       새어 나간다. 매달기(정리)와 달리 이건 판단이다.
    """
    cap = _cap(admin, 'CFD')
    assert _put(client, auth, plain, cap, 'MX', '도입').status_code == 403


def test_보류로_둘_때만_이유를_묻는다(db, client, auth, admin, divs):
    """
    ⚠️⚠️ 예전에는 단계를 적는 것이 곧 「기본 설정과 다르게 본다」는 주장이라 늘
       이유를 물었다. 기본 설정이 없어진 지금 단계는 주장이 아니라 **사실**이고,
       63줄마다 이유를 쓰게 하면 아무도 안 적는다.

    ⚠️ 다만 **안 쓰기로 한 판단**은 여전히 근거가 남아야 한다 — 그것만 6개월 뒤에
       처음부터 되풀이된다.
    """
    cap = _cap(admin, 'CFD')
    assert _put(client, auth, admin, cap, 'MX', '도입',
                reason='').status_code == 200, '사실을 적는 데는 이유가 필요 없다'

    r = _put(client, auth, admin, cap, 'VD', '보류', reason='')
    assert r.status_code == 400
    assert '이유' in (r.get_json() or {}).get('message', '')
    assert IntelDivisionStage.query.filter_by(division='VD').count() == 0

    assert _put(client, auth, admin, cap, 'VD', '보류',
                '라이선스가 과제 예산을 넘는다').status_code == 200


def test_보류도_마찬가지다(db, client, auth, admin, divs):
    cap = _cap(admin, 'CFD')
    assert _put(client, auth, admin, cap, 'MX', '보류', reason='').status_code == 400
    assert _put(client, auth, admin, cap, 'MX', '보류',
                '우리 제품엔 안 맞음').status_code == 200


def test_모르는_사업부는_안_받는다(db, client, auth, admin, divs):
    """⚠️ 지어낸 이름을 받으면 **아무 데도 안 보이는 줄**이 조용히 쌓인다."""
    cap = _cap(admin, 'CFD')
    r = _put(client, auth, admin, cap, '없는사업부', '도입', '아무 이유')
    assert r.status_code == 400
    assert '모르는 사업부' in (r.get_json() or {}).get('message', '')


def test_한_기술_한_사업부에_두_줄이_안_생긴다(db, client, auth, admin, divs):
    cap = _cap(admin, 'CFD', stage='관찰')
    _put(client, auth, admin, cap, 'MX', '도입')
    _put(client, auth, admin, cap, 'MX', '시험')
    assert IntelDivisionStage.query.filter_by(tech_uuid=cap.uuid,
                                              division='MX').count() == 1


def test_사업부별로_죽_펴서_본다(db, client, auth, admin, divs):
    """상세 화면의 표. ⚠️ 적은 사업부만 온다 — 나머지는 아직 아무 말도 안 했다."""
    cap = _cap(admin, 'explicit 해석')
    _put(client, auth, admin, cap, 'MX', '도입', '3년째 쓰는 중')

    r = client.get(f'{BASE}/tech/{cap.uuid}/division-stages', headers=auth(admin))
    d = (r.get_json() or {}).get('data') or {}
    assert d['companyStage'] is None, '역량에는 기준 단계가 없다'
    assert 'MX' in d['divisions']
    assert len(d['overrides']) == 1
    o = d['overrides'][0]
    assert (o['division'], o['stage'], o['reason']) == ('MX', '도입', '3년째 쓰는 중')
    assert o['changedAt']

# ── 이력이 거짓말하지 않는다 ─────────────────────────────────────────────────

def test_처음_적은_줄에_없는_이유가_안_박힌다(db, client, auth, admin, divs):
    """
    ⚠️⚠️ 예전에는 이유를 안 적으면 「기본 설정 값을 따르도록 되돌렸습니다」가 박혔다.
       **처음 적는 줄에도** 그렇게 남아서, 이력만 보면 무슨 일이 있었는지 정반대로
       읽힌다. 기본 설정은 이제 없는 개념이기도 하다.
    """
    cap = _cap(admin, 'CFD')
    _put(client, auth, admin, cap, 'MX', '도입', reason='')

    rows = (client.get(f'{BASE}/tech/{cap.uuid}/changes',
                       headers=auth(admin)).get_json() or {})['data']
    mine = [c for c in rows if c['field'] == 'stage']
    assert len(mine) == 1
    assert mine[0]['before_value'] is None, '처음 적은 것은 어디서 온 것이 아니다'
    assert mine[0]['after_value'] == '도입'
    assert not mine[0]['reason'], f"없는 말이 박혔다: {mine[0]['reason']}"
    assert mine[0]['scope'] == 'MX', '어느 사업부 것인지 남아야 한다'


def test_적어_둔_것을_지우면_그렇게_남는다(db, client, auth, admin, divs):
    """⚠️ 「기본 설정 값을 따르도록」은 이제 없는 말이다 — 따를 기본 설정이 없다."""
    cap = _cap(admin, 'CFD')
    _put(client, auth, admin, cap, 'MX', '도입', reason='')
    _put(client, auth, admin, cap, 'MX', '', reason='')

    rows = (client.get(f'{BASE}/tech/{cap.uuid}/changes',
                       headers=auth(admin)).get_json() or {})['data']
    # ⚠️ 이력은 **새것부터** 온다 — [-1] 은 처음 적은 줄이다.
    last = [c for c in rows if c['field'] == 'stage'][0]
    assert (last['before_value'], last['after_value']) == ('도입', None)
    assert last['reason'] == '적어 둔 것을 지웠습니다.'


# ── 합치기ㆍ층 바꾸기 ────────────────────────────────────────────────────────

def test_층이_다르면_못_합친다(db, client, auth, admin, divs):
    """
    ⚠️⚠️ 역량을 도구에 합치면 그 역량에 매달려 있던 도구들의 연결이 **도구를**
       가리키게 되고, 그러면 그 도구들은 「어딘가에 매달린 것」으로 잡혀 레이더에서
       통째로 사라진다 — 어느 역량 밑에도 안 나오고 미아 목록에도 안 뜬다.
    """
    cap = _cap(admin, 'CFD')
    tool, err = S.create_tech(actor_id=admin.id, name='OpenFOAM', kind='tool')
    assert err is None
    S.set_capabilities(tool.uuid, [cap.uuid], actor=admin)

    _, err = S.merge_tech(cap.uuid, tool.uuid, actor=admin)
    assert err and '층' in err, err
    _, err2 = S.merge_tech(tool.uuid, cap.uuid, actor=admin)
    assert err2 and '층' in err2, err2


def test_층을_바꾸면_단계도_함께_손본다(db, client, auth, admin, divs):
    """
    ⚠️⚠️ 역량은 단계를 안 갖고 도구는 갖는다. 안 건드리면 도구를 역량으로 올렸을 때
       **단계를 든 역량**이 생기는데, 상세 창에 역량용 칸이 없어 지울 길이 없다.
    """
    tool, err = S.create_tech(actor_id=admin.id, name='어떤 도구', kind='tool')
    assert err is None and tool.stage == '감지'

    r = client.patch(f'{BASE}/tech/{tool.uuid}', json={'kind': 'capability'},
                     headers=auth(admin))
    assert r.status_code == 200, r.get_json()
    assert (r.get_json() or {})['data']['stage'] is None

    r2 = client.patch(f'{BASE}/tech/{tool.uuid}', json={'kind': 'tool'},
                      headers=auth(admin))
    assert (r2.get_json() or {})['data']['stage'] == '감지', '도구로 내리면 다시 갖는다'
