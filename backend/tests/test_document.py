"""⑤ 기획서 테스트.

**여기서 지키는 것은 「문서가 단계와 갈라지지 않는 것」이다.**

  · 본문을 저장하지 않는다 — 진단을 고치면 문서도 따라 바뀐다
  · 빈 장을 감추지 않는다 — 없는 것은 없다고 적어야 검토가 된다
  · 확정하면 굳는다 — 승인받은 문서가 뒤에서 바뀌면 안 된다
"""
import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_strategy.models import (
    StrategyCrux, StrategyDocument, StrategyElement, StrategyPlan,
    StrategySolution,
)

BASE = '/api/digital-twin-strategy'
YEAR = 2026


@pytest.fixture()
def office(make_user):
    return make_user('office@test.local', UserRole.DT_OFFICE_MEMBER)


@pytest.fixture()
def world(db):
    from app.modules.digital_twin_dashboard.models import Division

    mx = Division(name='MX', is_kpi_owner=True, is_active=True, order=1)
    plan = StrategyPlan(year=YEAR, title=f'{YEAR}년 전략')
    _db.session.add_all([mx, plan])
    _db.session.commit()
    return {'mx': mx, 'plan': plan}


def _doc(client, office, auth):
    res = client.get(f'{BASE}/plans/{YEAR}/document', headers=auth(office))
    assert res.status_code == 200, res.get_json()
    return res.get_json()['data']


def _section(doc, key):
    return next(s for s in doc['sections'] if s['key'] == key)


def _titles(section):
    return [i['title'] for b in section['blocks'] for i in b.get('items', [])]


def test_빈_장을_감추지_않는다(client, world, office, auth):
    """⚠️ 장을 빼면 읽는 사람은 그 장이 없다는 것도 모른 채 「검토했겠거니」 한다."""
    doc = _doc(client, office, auth)

    keys = [s['key'] for s in doc['sections']]
    assert 'cruxes' in keys and 'solutions' in keys      # 비어도 목록에 있다
    assert _section(doc, 'cruxes')['empty'] is True
    assert _section(doc, 'cruxes')['included'] is True
    assert '4. 핵심 난제' in doc['summary']['emptyTitles']


def test_본문을_저장하지_않아_단계를_따라간다(client, world, office, auth):
    """진단을 고치면 문서도 바뀐다. 복사해 두면 그 순간부터 갈라진다."""
    assert _section(_doc(client, office, auth), 'cruxes')['empty'] is True

    _db.session.add(StrategyCrux(plan_id=world['plan'].id,
                                 title='데이터가 안 쌓인다',
                                 rationale='수기로 모은다'))
    _db.session.commit()

    section = _section(_doc(client, office, auth), 'cruxes')
    assert section['empty'] is False
    assert '데이터가 안 쌓인다' in _titles(section)


def test_할_일_없는_난제가_문서에_그대로_보인다(client, world, office, auth):
    """넘겠다고 적어 놓고 아무것도 안 하는 것이 문서에서 안 보이면 검토가 안 된다."""
    _db.session.add(StrategyCrux(plan_id=world['plan'].id, title='난제'))
    _db.session.commit()

    section = _section(_doc(client, office, auth), 'cruxes')
    tags = [i['tag'] for b in section['blocks'] for i in b.get('items', [])]
    assert '이슈 없음' in tags


def test_사람이_쓰는_구간만_글을_받는다(client, world, office, auth):
    res = client.put(f'{BASE}/plans/{YEAR}/document', headers=auth(office),
                     json={'sections': {'background': {'text': '올해는 …'}}})
    assert res.status_code == 200, res.get_json()
    blocks = _section(res.get_json()['data'], 'background')['blocks']
    assert blocks[0]['text'] == '올해는 …'

    # ⚠️ 조립 구간에 글을 넣게 두면 그 글이 단계와 갈라진다.
    res = client.put(f'{BASE}/plans/{YEAR}/document', headers=auth(office),
                     json={'sections': {'cruxes': {'text': '손으로 쓴 난제'}}})
    assert res.status_code == 400
    assert '단계에서 조립됩니다' in res.get_json()['message']


def test_뺀_구간도_목록에는_남는다(client, world, office, auth):
    """목차에서 사라지면 왜 빠졌는지 다음 사람이 알 수 없다."""
    client.put(f'{BASE}/plans/{YEAR}/document', headers=auth(office),
               json={'sections': {'kpi': {'included': False}}})
    doc = _doc(client, office, auth)
    assert _section(doc, 'kpi')['included'] is False
    assert doc['summary']['included'] == doc['summary']['total'] - 1


def test_확정하면_굳는다(client, world, office, auth):
    """⚠️ 승인받은 기획서가 뒤에서 조용히 바뀌면 그 문서로 한 결정을 되짚을 수 없다."""
    _db.session.add(StrategyCrux(plan_id=world['plan'].id,
                                 title='확정 당시의 난제'))
    _db.session.commit()

    res = client.put(f'{BASE}/plans/{YEAR}/document/status',
                     headers=auth(office), json={'status': 'confirmed'})
    assert res.status_code == 200, res.get_json()

    # 확정한 뒤에 단계를 바꿔도 문서는 그대로다.
    _db.session.add(StrategyCrux(plan_id=world['plan'].id,
                                 title='나중에 넣은 난제'))
    _db.session.commit()

    assert _titles(_section(_doc(client, office, auth), 'cruxes')) \
        == ['확정 당시의 난제']

    # 되돌리면 다시 살아난다.
    client.put(f'{BASE}/plans/{YEAR}/document/status', headers=auth(office),
               json={'status': 'draft'})
    assert '나중에 넣은 난제' in _titles(
        _section(_doc(client, office, auth), 'cruxes'))
    assert StrategyDocument.query.one().snapshot is None


def test_전략의_상태가_기획서를_따라간다(client, world, office, auth):
    """⚠️ 두 곳에서 따로 정하면 「전략은 확정인데 기획서는 초안」이 생긴다.
    확정의 정의는 하나다 — 기획서를 굳혔는가."""
    assert StrategyPlan.query.one().status == 'draft'

    client.put(f'{BASE}/plans/{YEAR}/document/status', headers=auth(office),
               json={'status': 'confirmed'})
    _db.session.expire_all()
    assert StrategyPlan.query.one().status == 'confirmed'

    client.put(f'{BASE}/plans/{YEAR}/document/status', headers=auth(office),
               json={'status': 'draft'})
    _db.session.expire_all()
    assert StrategyPlan.query.one().status == 'draft'


def test_확정본은_못_고친다(client, world, office, auth):
    client.put(f'{BASE}/plans/{YEAR}/document/status', headers=auth(office),
               json={'status': 'confirmed'})
    res = client.put(f'{BASE}/plans/{YEAR}/document', headers=auth(office),
                     json={'sections': {'background': {'text': '몰래 고치기'}}})
    assert res.status_code == 409
    assert '확정된 기획서' in res.get_json()['message']


def test_안_매긴_솔루션은_사분면_밖에_남는다(client, world, office, auth):
    """⚠️ 0 으로 놓으면 아직 판단하지 않은 것이 '하지 않는다' 칸에서 사라진다."""
    _db.session.add_all([
        StrategySolution(plan_id=world['plan'].id, tows='SO', title='매긴 것',
                         element_ids=[], kpi_ids=[], impact=5, feasibility=5),
        StrategySolution(plan_id=world['plan'].id, tows='WT', title='안 매긴 것',
                         element_ids=[], kpi_ids=[]),
    ])
    _db.session.commit()

    dump = str(_section(_doc(client, office, auth), 'portfolio')['blocks'])
    assert '먼저 한다' in dump and '아직 안 매긴 것' in dump
    assert '안 매긴 것은 낮은 점수가 아닙니다' in dump


def test_word_로_내보낸다(client, world, office, auth):
    _db.session.add(StrategyElement(plan_id=world['plan'].id, kind='S',
                                    title='CAE 해석 역량', source_type='manual'))
    _db.session.commit()

    res = client.get(f'{BASE}/plans/{YEAR}/document/export', headers=auth(office))
    assert res.status_code == 200, res.get_data(as_text=True)[:400]
    assert res.data[:2] == b'PK'            # docx 는 zip 이다
    assert len(res.data) > 5000

    from io import BytesIO
    from docx import Document

    text = '\n'.join(p.text for p in Document(BytesIO(res.data)).paragraphs)
    assert f'{YEAR}년 디지털 트윈 전략 기획서' in text
    assert 'CAE 해석 역량' in text
    # 초안임이 문서에 박혀 있어야 승인본처럼 돌아다니지 않는다.
    assert '초안' in text
    # 빈 장을 감추지 않는다.
    assert '아직 비어 있습니다' in text
