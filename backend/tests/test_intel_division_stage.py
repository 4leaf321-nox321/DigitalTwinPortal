"""사업부별 단계 — 「우리 사업부는 어디까지 왔나」.

⚠️⚠️ **전사 값이 정본이고, 저장하는 것은 예외뿐이다.** 사업부 8개 × 역량 39개 =
   312칸을 채우게 하면 아무도 안 채우고, 채운 것도 곧 낡아 **표 전체를 못 믿게
   된다.** 없으면 전사 값을 쓴다 — 그래서 「전사와 같음」과 「아직 안 정함」이
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

def test_안_정했으면_전사_값을_쓴다(db, client, auth, admin, divs):
    """
    ⚠️ **이게 이 설계의 뼈대다.** 312칸을 채우게 하면 아무도 안 채운다. 비어 있는
       것이 곧 「전사를 따른다」여야 한다.
    """
    _cap(admin, 'CFD', stage='시험')
    row = _row(client, auth, admin, f'{BASE}/tech?division=MX', 'CFD')
    assert row['stage'] == '시험'
    assert row['companyStage'] == '시험'
    assert row['isDivisionOverride'] is False
    assert IntelDivisionStage.query.count() == 0, '예외가 아니면 한 줄도 안 남는다'


def test_사업부마다_다르게_선다(db, client, auth, admin, divs):
    """레이더가 사업부 눈으로 **다시 그려진다** — 거르는 것이 아니다."""
    cap = _cap(admin, 'explicit 해석', stage='관찰')
    assert _put(client, auth, admin, cap, 'MX', '도입').status_code == 200
    assert _put(client, auth, admin, cap, 'VD', '시험').status_code == 200

    mx = _row(client, auth, admin, f'{BASE}/tech?division=MX', 'explicit 해석')
    vd = _row(client, auth, admin, f'{BASE}/tech?division=VD', 'explicit 해석')
    assert (mx['stage'], mx['companyStage'], mx['isDivisionOverride']) \
        == ('도입', '관찰', True)
    assert (vd['stage'], vd['companyStage'], vd['isDivisionOverride']) \
        == ('시험', '관찰', True)

    # 사업부를 안 고르면 전사 값 그대로다.
    all_ = _row(client, auth, admin, f'{BASE}/tech', 'explicit 해석')
    assert all_['stage'] == '관찰'
    assert 'isDivisionOverride' not in all_


def test_전사와_같게_맞추면_예외를_지운다(db, client, auth, admin, divs):
    """
    ⚠️⚠️ 같은 값을 굳이 한 줄로 남겨 두면, 나중에 **전사가 움직였을 때 이 사업부만
       옛 값에 붙박여** 따라가지 않는다. 그게 표를 못 믿게 만드는 방식이다.
    """
    cap = _cap(admin, 'CFD', stage='관찰')
    _put(client, auth, admin, cap, 'MX', '도입')
    assert IntelDivisionStage.query.count() == 1

    # 전사와 같아졌다 → 「따름」. 담아 둔 것이 없으면 줄까지 사라진다.
    _put(client, auth, admin, cap, 'MX', '관찰', reason='')
    assert IntelDivisionStage.query.count() == 0

    # 전사가 움직이면 MX 도 따라간다.
    client.put(f'{BASE}/tech/{cap.uuid}/stage', json={'stage': '시험'},
               headers=auth(admin))
    assert _row(client, auth, admin, f'{BASE}/tech?division=MX', 'CFD')['stage'] \
        == '시험'


def test_예외를_지우면_전사를_따른다(db, client, auth, admin, divs):
    cap = _cap(admin, 'CFD', stage='관찰')
    _put(client, auth, admin, cap, 'MX', '도입')
    r = client.delete(f'{BASE}/tech/{cap.uuid}/division-stage?division=MX',
                      headers=auth(admin))
    assert r.status_code == 200
    assert IntelDivisionStage.query.count() == 0


# ── 낡음 판정이 그 사업부의 단계를 읽는다 ────────────────────────────────────

def test_낡음_기준이_그_사업부의_단계를_따른다(db, client, auth, admin, divs):
    """
    ⚠️⚠️ 단계마다 기준 일수가 다르다(도입 540 · 관찰 180). 전사가 「도입」인데 우리
       사업부는 「관찰」이면 **우리한테는 벌써 낡은 것**이다. 전사 단계로 재면
       화면은 「관찰」이라 써 놓고 낡음은 540일로 재게 되고, 그 순간 표가 거짓말한다.
    """
    cap = _cap(admin, '느린 것', stage='도입')
    cap.stage_changed_at = datetime.utcnow() - timedelta(days=300)
    cap.created_at = cap.stage_changed_at
    _db.session.commit()
    _put(client, auth, admin, cap, 'MX', '관찰')

    company = _row(client, auth, admin, f'{BASE}/tech', '느린 것')
    assert company['staleAfterDays'] == 540 and company['isStale'] is False

    mx = _row(client, auth, admin, f'{BASE}/tech?division=MX', '느린 것')
    assert mx['staleAfterDays'] == 180, '그 사업부의 단계로 재야 한다'
    assert mx['isStale'] is True


# ── 이동 화살표 ──────────────────────────────────────────────────────────────

def test_이동_화살표가_그_사업부_이력만_본다(db, client, auth, admin, divs):
    """
    ⚠️⚠️ 안 나누면 화면은 「MX 기준」이라 써 놓고 화살표는 **전사 이동**을 그린다.
       거짓말하는 화살표는 없는 화살표보다 나쁘다.
    """
    cap = _cap(admin, '움직인 역량', stage='관찰')
    client.put(f'{BASE}/tech/{cap.uuid}/stage', json={'stage': '시험'},
               headers=auth(admin))                       # 전사: 관찰 → 시험
    _put(client, auth, admin, cap, 'MX', '도입')            # MX:  시험 → 도입

    company = _row(client, auth, admin, f'{BASE}/tech', '움직인 역량')
    assert company['movedFrom'] == '관찰' and company['stage'] == '시험'

    mx = _row(client, auth, admin, f'{BASE}/tech?division=MX', '움직인 역량')
    assert mx['stage'] == '도입'
    assert mx['movedFrom'] == '시험', 'MX 의 이력만 봐야 한다'


def test_전사_이력에_사업부_판단이_안_섞인다(db, client, auth, admin, divs):
    cap = _cap(admin, 'CFD', stage='관찰')
    _put(client, auth, admin, cap, 'MX', '도입')

    row = _row(client, auth, admin, f'{BASE}/tech', 'CFD')
    assert 'movedFrom' not in row, '전사는 안 움직였다'
    assert IntelChange.query.filter_by(scope='MX').count() == 1


# ── 거르기 ───────────────────────────────────────────────────────────────────

def test_단계로_거를_때도_푼_값을_쓴다(db, client, auth, admin, divs):
    """
    ⚠️ 단계 거르기를 SQL 로 하면 **컬럼 값**을 보게 되는데, 화면에 그려지는 것은
       푼 값이다. 「도입만」을 눌렀는데 도입 아닌 것이 나오거나 그 반대가 된다.
    """
    a = _cap(admin, '전사만 도입', stage='도입')
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


def test_이유_없이는_예외를_못_만든다(db, client, auth, admin, divs):
    """
    ⚠️⚠️ **이 시험이 이 판의 요점이다.** 예전에는 드롭다운으로 단계만 고르면
       끝이었다. 그러면 이 표는 앞선 세 번의 시도와 똑같아진다 — 적혀는 있는데
       아무도 왜인지 모르는 표. 「MX 도입」 네 글자는 6개월 뒤 아무 뜻도 아니다.
    """
    cap = _cap(admin, 'CFD')                       # 전사 관찰
    r = _put(client, auth, admin, cap, 'MX', '도입', reason='')
    assert r.status_code == 400
    assert '이유' in (r.get_json() or {}).get('message', '')
    assert IntelDivisionStage.query.count() == 0, '막혔으면 줄도 안 남아야 한다'

    assert _put(client, auth, admin, cap, 'MX', '도입',
                '3년째 쓰는 중').status_code == 200


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
    """상세 화면의 표. ⚠️ 예외가 걸린 사업부만 온다 — 나머지는 전사를 따른다."""
    cap = _cap(admin, 'explicit 해석', stage='관찰')
    _put(client, auth, admin, cap, 'MX', '도입', '3년째 쓰는 중')

    r = client.get(f'{BASE}/tech/{cap.uuid}/division-stages', headers=auth(admin))
    d = (r.get_json() or {}).get('data') or {}
    assert d['companyStage'] == '관찰'
    assert 'MX' in d['divisions']
    assert len(d['overrides']) == 1
    o = d['overrides'][0]
    assert (o['division'], o['stage'], o['reason']) == ('MX', '도입', '3년째 쓰는 중')
    assert o['followsCompany'] is False
    assert o['changedAt']
