"""**한 판에 다 적는 표** — 사업부가 실제로 채우게 만드는 자리.

왜 이 화면이 있나
    역량 하나를 적으려면 레이더에서 점을 찾아 → 창을 열고 → 사업부 칸을 펴고 →
    고르고 → 저장하기를 63번 해야 했다. 아무도 안 했다 — 504칸 중 24칸(4.8%)만
    찼고, 비교표도 분야별 그림도 전부 거기서 막혔다.

⚠️⚠️ **가장 싼 입력이 「단계는 그대로, 도구만 적기」다.** 이유를 안 묻고, 판단도
   아니고, 사업부가 이미 아는 것이다. 이게 막히면 이 화면은 있으나 마나다.
"""
import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_intel import services as S
from app.modules.digital_twin_intel.models import IntelDivisionStage

BASE = '/api/digital-twin-intel'


@pytest.fixture()
def admin(make_user):
    return make_user('divsheet@test.local', UserRole.ADMIN)


@pytest.fixture()
def plain(make_user):
    return make_user('divsheet-plain@test.local', UserRole.USER)


@pytest.fixture()
def divs(db):
    from app.modules.digital_twin_dashboard.models import Division
    for i, name in enumerate(['MX', 'VD']):
        if Division.query.filter_by(name=name).first() is None:
            _db.session.add(Division(name=name, order=i, is_active=True))
    _db.session.commit()
    return ['MX', 'VD']


@pytest.fixture()
def tree(db, admin):
    """역량 둘, 그 밑에 도구 셋. 한 도구는 두 역량에 걸친다."""
    cfd, _ = S.create_tech(actor_id=admin.id, name='CFD', kind='capability',
                           stage='시험', category='시뮬레이션·해석')
    ai, _ = S.create_tech(actor_id=admin.id, name='대리모델', kind='capability',
                          stage='감지', category='AI')
    star, _ = S.create_tech(actor_id=admin.id, name='STAR-CCM+', kind='tool')
    of, _ = S.create_tech(actor_id=admin.id, name='OpenFOAM', kind='tool')
    ml, _ = S.create_tech(actor_id=admin.id, name='SimAI', kind='tool')
    S.set_capabilities(star.uuid, [cfd.uuid], actor=admin)
    S.set_capabilities(of.uuid, [cfd.uuid], actor=admin)
    S.set_capabilities(ml.uuid, [cfd.uuid, ai.uuid], actor=admin)
    return {'cfd': cfd, 'ai': ai, 'star': star, 'of': of, 'ml': ml}


def _sheet(client, auth, user, division='MX'):
    r = client.get(f'{BASE}/division-sheet?division={division}',
                   headers=auth(user))
    assert r.status_code == 200, r.get_json()
    return (r.get_json() or {})['data']


def _save(client, auth, user, items, division='MX'):
    return client.put(f'{BASE}/division-sheet',
                      json={'division': division, 'items': items},
                      headers=auth(user))


def _of(sheet, name):
    return next(r for r in sheet['rows'] if r['name'] == name)


# ── 표를 펴 준다 ─────────────────────────────────────────────────────────────

def test_역량만_담고_도구는_선택지로만_나온다(db, client, auth, admin, divs, tree):
    """
    ⚠️ **줄이 적어서 채울 만한 것**이 이 화면의 전부다. 도구까지 줄로 세우면
       63줄이 546줄이 되고, 그러면 다시 아무도 안 채운다.
    """
    s = _sheet(client, auth, admin)
    names = [r['name'] for r in s['rows']]
    assert 'CFD' in names and '대리모델' in names
    assert 'STAR-CCM+' not in names, '도구가 줄로 서면 안 된다'
    assert {c['name'] for c in _of(s, 'CFD')['toolChoices']} == {
        'STAR-CCM+', 'OpenFOAM', 'SimAI'}
    # 한 도구가 여러 역량에 걸린다 — 양쪽 모두에 나와야 한다.
    assert 'SimAI' in {c['name'] for c in _of(s, '대리모델')['toolChoices']}


def test_아직_안_적힌_줄은_비어서_온다(db, client, auth, admin, divs, tree):
    """⚠️ 빈 것이 곧 「기본 설정을 따른다」다 — 값을 채워 보내면 안 된다."""
    row = _of(_sheet(client, auth, admin), 'CFD')
    assert row['stage'] is None
    assert row['companyStage'] == '시험'
    assert row['reason'] == '' and row['tools'] == []


def test_분야_차례대로_묶여_온다(db, client, auth, admin, divs, tree):
    s = _sheet(client, auth, admin)
    assert s['sectors'].index('시뮬레이션·해석') < s['sectors'].index('AI')
    assert [r['name'] for r in s['rows']] == ['CFD', '대리모델']


def test_얼마나_찼는지_함께_온다(db, client, auth, admin, divs, tree):
    """⚠️ 이 숫자가 이 화면을 여는 이유다 — 안 보이면 아무도 안 연다."""
    s = _sheet(client, auth, admin)
    assert (s['filled'], s['total']) == (0, 2)
    _save(client, auth, admin, [{'uuid': tree['cfd'].uuid,
                                 'tools': [tree['star'].uuid]}])
    assert _sheet(client, auth, admin)['filled'] == 1


# ── 가장 싼 입력: 단계는 그대로, 도구만 ──────────────────────────────────────

def test_단계는_그대로_두고_도구만_적을_수_있다(db, client, auth, admin, divs, tree):
    """
    ⚠️⚠️ **이유를 안 묻는다.** 「기본 설정도 시험, 우리도 시험, 우리는 STAR-CCM+ 를
       쓴다」는 판단이 아니라 사실이다. 여기서 이유를 물으면 아무도 안 적는다.
    """
    r = _save(client, auth, admin, [{'uuid': tree['cfd'].uuid, 'stage': None,
                                     'tools': [tree['star'].uuid,
                                               tree['of'].uuid]}])
    assert r.status_code == 200, r.get_json()
    d = r.get_json()['data']
    assert (d['saved'], d['failed']) == (1, [])

    row = _of(_sheet(client, auth, admin), 'CFD')
    assert row['stage'] is None, '예외가 아니라 따르는 중이다'
    assert set(row['tools']) == {tree['star'].uuid, tree['of'].uuid}


def test_그_역량_밑에_없는_도구는_안_들어간다(db, client, auth, admin, divs, tree):
    """⚠️ 「CFD 를 SimAI 로」는 되고 「대리모델을 OpenFOAM 으로」는 안 된다."""
    _save(client, auth, admin, [{'uuid': tree['ai'].uuid,
                                 'tools': [tree['of'].uuid]}])
    assert _of(_sheet(client, auth, admin), '대리모델')['tools'] == []


# ── 예외에는 이유가 있어야 한다 ──────────────────────────────────────────────

def test_이유_없는_예외는_그_줄만_튕기고_나머지는_담긴다(db, client, auth, admin,
                                                    divs, tree):
    """
    ⚠️⚠️ **한 줄이 틀렸다고 나머지를 버리면 다시는 안 적는다.** 40줄 적고 한 줄
       때문에 전부 날아가는 화면을 사람은 두 번 열지 않는다.
    """
    r = _save(client, auth, admin, [
        {'uuid': tree['cfd'].uuid, 'tools': [tree['star'].uuid]},   # 멀쩡한 줄
        {'uuid': tree['ai'].uuid, 'stage': '도입', 'reason': ''},    # 이유 없음
    ])
    d = r.get_json()['data']
    assert d['saved'] == 1
    assert len(d['failed']) == 1
    assert d['failed'][0]['name'] == '대리모델', '어느 줄이 틀렸는지 이름으로 온다'

    s = _sheet(client, auth, admin)
    assert _of(s, 'CFD')['tools'] == [tree['star'].uuid], '멀쩡한 줄은 담겼다'
    assert _of(s, '대리모델')['stage'] is None, '틀린 줄은 안 담겼다'


def test_이유가_있으면_예외가_선다(db, client, auth, admin, divs, tree):
    r = _save(client, auth, admin, [{'uuid': tree['cfd'].uuid, 'stage': '도입',
                                     'reason': '3년째 상시 사용',
                                     'tools': [tree['star'].uuid]}])
    assert r.get_json()['data']['saved'] == 1
    row = _of(_sheet(client, auth, admin), 'CFD')
    assert (row['stage'], row['reason']) == ('도입', '3년째 상시 사용')


def test_기본설정과_같은_값을_보내면_따름으로_되돌린다(db, client, auth, admin,
                                                  divs, tree):
    """⚠️ 붙박아 두면 기본 설정이 움직였을 때 이 사업부만 옛 값에 남는다."""
    _save(client, auth, admin, [{'uuid': tree['cfd'].uuid, 'stage': '도입',
                                 'reason': '쓴다'}])
    _save(client, auth, admin, [{'uuid': tree['cfd'].uuid, 'stage': '시험',
                                 'reason': '쓴다'}])   # 기본 설정과 같다
    assert _of(_sheet(client, auth, admin), 'CFD')['stage'] is None


def test_다_비우면_줄이_사라진다(db, client, auth, admin, divs, tree):
    """⚠️ 빈 줄을 남기면 「다르게 보는 사업부」 셈이 부풀고 곧 못 믿게 된다."""
    _save(client, auth, admin, [{'uuid': tree['cfd'].uuid,
                                 'tools': [tree['star'].uuid]}])
    assert IntelDivisionStage.query.filter_by(division='MX').count() == 1
    _save(client, auth, admin, [{'uuid': tree['cfd'].uuid, 'tools': []}])
    assert IntelDivisionStage.query.filter_by(division='MX').count() == 0


# ── 사업부는 갈려 있어야 한다 ────────────────────────────────────────────────

def test_한_사업부에_적은_것이_옆_사업부에_안_샌다(db, client, auth, admin, divs,
                                              tree):
    _save(client, auth, admin, [{'uuid': tree['cfd'].uuid,
                                 'tools': [tree['star'].uuid]}], division='MX')
    assert _of(_sheet(client, auth, admin, 'VD'), 'CFD')['tools'] == []


def test_모르는_사업부는_안_받는다(db, client, auth, admin, divs, tree):
    """⚠️ 지어낸 이름을 받으면 아무 데도 안 보이는 줄이 조용히 쌓인다."""
    r = client.get(f'{BASE}/division-sheet?division=없는사업부',
                   headers=auth(admin))
    assert r.status_code == 400
    r2 = _save(client, auth, admin, [{'uuid': tree['cfd'].uuid}],
               division='없는사업부')
    assert r2.get_json()['data']['saved'] == 0


# ── 권한 ─────────────────────────────────────────────────────────────────────

def test_읽는_것은_누구나_적는_것은_사무국만(db, client, auth, admin, plain, divs,
                                        tree):
    """
    ⚠️ 읽기를 막으면 옆 사업부가 이미 적어 둔 답을 못 보고 처음부터 다시 고른다.
       반대로 쓰기는 **한 번에 63줄이 움직이는 자리**라 오히려 더 좁아야 한다.
    """
    r = client.get(f'{BASE}/division-sheet?division=MX', headers=auth(plain))
    assert r.status_code == 200
    assert _save(client, auth, plain,
                 [{'uuid': tree['cfd'].uuid}]).status_code in (401, 403)
