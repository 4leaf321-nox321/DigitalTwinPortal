"""④ 솔루션 — TOWS 테스트.

**여기서 지키는 것은 「무엇을 무엇으로 푸는가」의 일관성이다.**

  · SO 는 강점과 기회를 엮는 수다. 거기에 위협을 엮으면 이름과 내용이 어긋난다
  · 조합 격자를 만들지 않는다 — 빈 칸이 아니라 빈 목록이다
"""
import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_strategy.models import (
    StrategyElement, StrategyPlan, StrategySolution,
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

    def element(kind, title):
        e = StrategyElement(plan_id=plan.id, kind=kind, title=title,
                            source_type='manual')
        _db.session.add(e)
        _db.session.flush()
        return e

    world = {'mx': mx, 'plan': plan}
    world['S'] = element('S', 'CAE 해석 역량')
    world['O'] = element('O', '생성형 AI 발전')
    world['T'] = element('T', '경쟁사 개발기간 단축')
    _db.session.commit()
    return world


def _plan(client, office, auth):
    res = client.get(f'{BASE}/plans/{YEAR}', headers=auth(office))
    assert res.status_code == 200, res.get_json()
    return res.get_json()['data']


def test_솔루션을_적고_엮은_요소를_남긴다(client, world, office, auth):
    res = client.post(f'{BASE}/plans/{YEAR}/solutions', headers=auth(office),
                      json={'tows': 'SO', 'title': 'AI 기반 가상검증 확대',
                            'detail': 'CAE 역량에 AI 를 얹는다',
                            'element_ids': [world['S'].id, world['O'].id]})
    assert res.status_code == 201, res.get_json()

    saved = StrategySolution.query.one()
    assert saved.tows == 'SO'
    assert saved.element_ids == sorted([world['S'].id, world['O'].id])
    assert _plan(client, office, auth)['solutions'][0]['title'] == 'AI 기반 가상검증 확대'


def test_갈래에_안_맞는_요소는_거절한다(client, world, office, auth):
    """⚠️ SO 는 **강점으로 기회를 잡는 솔루션**이다. 거기에 위협을 엮으면 그 솔루션이
    무엇을 푸는 것인지 이름과 내용이 어긋난다 — 네 갈래를 나눈 이유가 사라진다.
    """
    res = client.post(f'{BASE}/plans/{YEAR}/solutions', headers=auth(office),
                      json={'tows': 'SO', 'title': '엉뚱한 수',
                            'element_ids': [world['S'].id, world['T'].id]})
    assert res.status_code == 400
    assert 'SO 는 S·O 만 엮습니다' in res.get_json()['message']
    assert StrategySolution.query.count() == 0


def test_남의_전략_요소는_못_엮는다(client, world, office, auth):
    """엮어 두면 그 근거가 이 전략 화면에서는 안 보인다."""
    other = StrategyPlan(year=YEAR + 1, title='다음 해')
    _db.session.add(other)
    _db.session.flush()
    stranger = StrategyElement(plan_id=other.id, kind='S', title='남의 강점',
                               source_type='manual')
    _db.session.add(stranger)
    _db.session.commit()

    res = client.post(f'{BASE}/plans/{YEAR}/solutions', headers=auth(office),
                      json={'tows': 'SO', 'title': '수',
                            'element_ids': [stranger.id]})
    assert res.status_code == 400
    assert '이 전략의 요소가 아닙니다' in res.get_json()['message']


def test_요소를_안_엮어도_적을_수_있다(client, world, office, auth):
    """⚠️ **채울 의무가 없다.** 근거를 대라고 막으면 사람은 아무거나 엮는다."""
    res = client.post(f'{BASE}/plans/{YEAR}/solutions', headers=auth(office),
                      json={'tows': 'WT', 'title': '일단 적어 두는 수'})
    assert res.status_code == 201
    assert StrategySolution.query.one().element_ids == []


def test_알_수_없는_갈래는_거절한다(client, world, office, auth):
    res = client.post(f'{BASE}/plans/{YEAR}/solutions', headers=auth(office),
                      json={'tows': 'XX', 'title': '수'})
    assert res.status_code == 400
    assert 'SO·WO·ST·WT' in res.get_json()['message']


def test_엮은_요소가_지워져도_솔루션은_남는다(client, world, office, auth):
    """근거가 사라진 것이지 솔루션이 틀린 것이 아니다. 딸려 지우면 사람이 쓴 것이
    조용히 사라진다(이슈와 난제의 관계와 같은 규칙)."""
    client.post(f'{BASE}/plans/{YEAR}/solutions', headers=auth(office),
                json={'tows': 'SO', 'title': '수', 'element_ids': [world['S'].id]})
    client.delete(f"{BASE}/plans/{YEAR}/elements/{world['S'].id}",
                  headers=auth(office))

    solution = StrategySolution.query.one()
    assert solution.element_ids == [world['S'].id]

    # 근거는 사라졌다. 화면은 못 찾는 id 를 조용히 뺀다 — 없는 것을 있는 척하지 않는다.
    plan = _plan(client, office, auth)
    assert world['S'].id not in {e['id'] for e in plan['elements']}
    assert plan['solutions'][0]['title'] == '수'


# ── AX-5R 게이트 ─────────────────────────────────────────────────────────
#
# **막는 관문이 아니라 표시다.** 다 안 채웠다고 저장을 거절하면 사람은 아무 말이나
# 적어 넣고, 그러면 게이트란 전체가 거짓말이 된다.

def _solution(client, office, auth, tows='SO', title='수'):
    res = client.post(f'{BASE}/plans/{YEAR}/solutions', headers=auth(office),
                      json={'tows': tows, 'title': title})
    assert res.status_code == 201, res.get_json()
    return res.get_json()['data']['id']


def test_게이트는_같은_다섯_축이다():
    """⚠️ 진단의 조직 역량과 게이트가 갈라지면 안 된다. 시제만 다르다."""
    from app.modules.digital_twin_strategy.definitions import (
        GATES, GATE_KEYS, ORGANIZATION_DIMENSIONS,
    )
    assert GATE_KEYS == [d['key'] for d in ORGANIZATION_DIMENSIONS]
    assert [g['label'] for g in GATES] == [d['label'] for d in ORGANIZATION_DIMENSIONS]
    # 질문 문장은 다르다 — 진단은 "지금 되어 있는가", 게이트는 "이 솔루션을 하면".
    assert all(g['question'] != d['question']
               for g, d in zip(GATES, ORGANIZATION_DIMENSIONS))


def test_답한_게이트만_실려_온다(client, world, office, auth):
    sid = _solution(client, world and office, auth)
    res = client.put(f'{BASE}/plans/{YEAR}/solutions/{sid}/gates/role',
                     headers=auth(office), json={'answer': '개발팀장이 맡는다'})
    assert res.status_code == 200, res.get_json()

    gates = _plan(client, office, auth)['solutions'][0]['gates']
    assert gates == {'role': {'answer': '개발팀장이 맡는다', 'status': 'answered'}}


def test_다_안_채워도_막지_않는다(client, world, office, auth):
    """다섯 중 하나만 답해도 솔루션은 그대로 남는다. 표시일 뿐이다."""
    sid = _solution(client, world and office, auth)
    client.put(f'{BASE}/plans/{YEAR}/solutions/{sid}/gates/risk',
               headers=auth(office), json={'answer': '검증이 늦어질 뿐이다'})

    solution = _plan(client, office, auth)['solutions'][0]
    assert len(solution['gates']) == 1
    assert solution['title'] == '수'


def test_해당_없음도_이유를_적어야_한다(client, world, office, auth):
    """⚠️ 이유 없는 '해당 없음'은 안 답한 것과 구별이 안 되면서 화면에서는 다
    채운 것처럼 보인다."""
    sid = _solution(client, world and office, auth)
    res = client.put(f'{BASE}/plans/{YEAR}/solutions/{sid}/gates/return',
                     headers=auth(office), json={'answer': '  ', 'status': 'na'})
    assert res.status_code == 400
    assert '해당 없음도 이유' in res.get_json()['message']


def test_알_수_없는_게이트는_거절한다(client, world, office, auth):
    sid = _solution(client, world and office, auth)
    res = client.put(f'{BASE}/plans/{YEAR}/solutions/{sid}/gates/budget',
                     headers=auth(office), json={'answer': '있다'})
    assert res.status_code == 400
    assert '알 수 없는 게이트' in res.get_json()['message']


def test_답을_지우면_안_답한_상태로_돌아간다(client, world, office, auth):
    sid = _solution(client, world and office, auth)
    client.put(f'{BASE}/plans/{YEAR}/solutions/{sid}/gates/readiness',
               headers=auth(office), json={'answer': '인력이 없다'})
    res = client.delete(f'{BASE}/plans/{YEAR}/solutions/{sid}/gates/readiness',
                        headers=auth(office))
    assert res.status_code == 200
    assert _plan(client, office, auth)['solutions'][0]['gates'] == {}


def test_솔루션을_지우면_게이트도_지운다(client, world, office, auth):
    """⚠️ target_id 에는 외래키가 없다. 안 지우면 나중에 **같은 번호를 받은 다른
    수에 남의 답이 붙는다** — 그 솔루션은 답한 적이 없는데 답한 것으로 보인다."""
    from app.modules.digital_twin_strategy.models import StrategyGate

    sid = _solution(client, world and office, auth)
    client.put(f'{BASE}/plans/{YEAR}/solutions/{sid}/gates/role',
               headers=auth(office), json={'answer': '개발팀장'})
    assert StrategyGate.query.count() == 1

    client.delete(f'{BASE}/plans/{YEAR}/solutions/{sid}', headers=auth(office))
    assert StrategyGate.query.count() == 0


# ── 사분면 · KPI 연결 ────────────────────────────────────────────────────
#
# ⚠️ **안 매긴 것을 0 으로 두지 않는다.** 그러면 아직 판단하지 않은 솔루션이
#    「영향 낮음 × 어려움」 칸으로 굴러떨어져 '하지 않는다'로 읽힌다.

def test_영향도와_실행가능성은_비울_수_있다(client, world, office, auth):
    sid = _solution(client, world and office, auth)
    saved = StrategySolution.query.get(sid)
    assert saved.impact is None and saved.feasibility is None

    res = client.put(f'{BASE}/plans/{YEAR}/solutions/{sid}', headers=auth(office),
                     json={'impact': 4, 'feasibility': 2})
    assert res.status_code == 200, res.get_json()
    _db.session.expire_all()
    assert StrategySolution.query.get(sid).impact == 4

    # 다시 비울 수 있어야 한다 — 잘못 매긴 것을 되돌릴 길이 없으면 안 매긴다.
    client.put(f'{BASE}/plans/{YEAR}/solutions/{sid}', headers=auth(office),
               json={'impact': None})
    _db.session.expire_all()
    assert StrategySolution.query.get(sid).impact is None


def test_범위를_벗어난_점수는_거절한다(client, world, office, auth):
    sid = _solution(client, world and office, auth)
    res = client.put(f'{BASE}/plans/{YEAR}/solutions/{sid}', headers=auth(office),
                     json={'impact': 9})
    assert res.status_code == 400
    assert '1~5' in res.get_json()['message']


def test_없는_지표에는_못_건다(client, world, office, auth):
    """걸어 두면 그 솔루션은 어느 지표에도 안 걸린 것과 같은데 화면에는 걸린 것처럼
    보인다 — ① 진단이 짚는 'KPI 에 안 걸린 과제'가 여기서 반대로 생긴다."""
    sid = _solution(client, world and office, auth)
    res = client.put(f'{BASE}/plans/{YEAR}/solutions/{sid}', headers=auth(office),
                     json={'kpi_ids': [999999]})
    assert res.status_code == 400
    assert '없는 지표입니다' in res.get_json()['message']


def test_지표에_걸_수_있다(client, world, office, auth):
    from app.modules.dx_kpi_management.models import KpiDefinition

    kpi = KpiDefinition(label='가상검증률', category='개발', unit='%')
    _db.session.add(kpi)
    _db.session.commit()

    sid = _solution(client, world and office, auth)
    res = client.put(f'{BASE}/plans/{YEAR}/solutions/{sid}', headers=auth(office),
                     json={'kpi_ids': [kpi.id]})
    assert res.status_code == 200, res.get_json()

    solution = _plan(client, office, auth)['solutions'][0]
    assert solution['kpi_ids'] == [kpi.id]

    # 화면이 라벨을 붙일 수 있도록 meta 가 목록을 내려준다.
    meta = client.get(f'{BASE}/meta', headers=auth(office)).get_json()['data']
    assert any(k['id'] == kpi.id and k['label'] == '가상검증률' for k in meta['kpis'])
