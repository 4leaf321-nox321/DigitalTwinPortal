"""③ 분석 — 전략 요소 테스트.

**여기서 지키는 것은 근거의 무게다.**

  · S·W 는 진단에서 후보가 나오지만 O·T 는 나오지 않는다 — 포탈에 없는 정보를
    규칙이 만들어내면 그건 근거가 아니라 창작이다
  · 자동으로 승격하지 않는다 — 그러면 이 칸이 발견 사항의 복사본이 되고,
    ④ TOWS 에서 조합할 것이 없어진다
"""
import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_strategy.models import (
    StrategyAssessment, StrategyElement, StrategyPlan,
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
    vd = Division(name='VD', is_kpi_owner=True, is_active=True, order=2)
    plan = StrategyPlan(year=YEAR, title=f'{YEAR}년 전략')
    _db.session.add_all([mx, vd, plan])
    _db.session.commit()
    return {'mx': mx, 'vd': vd, 'plan': plan}


def _plan(client, office, auth):
    res = client.get(f'{BASE}/plans/{YEAR}', headers=auth(office))
    assert res.status_code == 200, res.get_json()
    return res.get_json()['data']


def _grade(world, division, dimension, level):
    _db.session.add(StrategyAssessment(
        plan_id=world['plan'].id, division_id=division.id,
        category='organization', dimension=dimension,
        current_level=level, basis='manual'))
    _db.session.commit()


def test_진단의_양_끝이_강점과_약점_후보가_된다(client, world, office, auth):
    _grade(world, world['mx'], 'readiness', 5)     # 강점
    _grade(world, world['vd'], 'return', 1)        # 약점
    _grade(world, world['mx'], 'role', 3)          # 가운데 — 후보가 아니다

    candidates = _plan(client, office, auth)['elementCandidates']
    kinds = {c['kind'] for c in candidates}
    assert 'S' in kinds and 'W' in kinds

    strong = [c for c in candidates if c['kind'] == 'S']
    assert any('MX' in c['title'] and '준비도' in c['title'] for c in strong)
    # 3단계는 강점도 약점도 아니다.
    assert not any('역할' in c['title'] for c in candidates)


def test_기회와_위협은_후보를_만들지_않는다(client, world, office, auth):
    """⚠️ 포탈에 없는 정보를 규칙이 지어내면 그건 근거가 아니라 창작이다.
    그 자리는 설문이 메운다(ANALYSIS_PLAN 3절)."""
    _grade(world, world['mx'], 'readiness', 5)
    _grade(world, world['vd'], 'return', 1)

    candidates = _plan(client, office, auth)['elementCandidates']
    assert {c['kind'] for c in candidates} <= {'S', 'W'}


def test_후보는_자동으로_요소가_되지_않는다(client, world, office, auth):
    """자동으로 옮기면 이 칸이 발견 사항의 복사본이 되고, ④ TOWS 에서 조합할
    것이 없어진다."""
    _grade(world, world['mx'], 'readiness', 5)

    data = _plan(client, office, auth)
    assert len(data['elementCandidates']) > 0
    assert data['elements'] == []          # ← 요점


def test_승격한_후보는_목록에서_빠진다(client, world, office, auth):
    """안 빼면 같은 것이 계속 남아, 무엇을 아직 안 봤는지 읽을 수 없다."""
    _grade(world, world['mx'], 'readiness', 5)
    candidate = _plan(client, office, auth)['elementCandidates'][0]

    res = client.post(f'{BASE}/plans/{YEAR}/elements', headers=auth(office),
                      json={'kind': candidate['kind'], 'title': candidate['title'],
                            'detail': candidate['detail'],
                            'division_id': candidate['division_id'],
                            'source_type': candidate['source_type'],
                            'source_ref': candidate['key']})
    assert res.status_code == 201, res.get_json()

    after = _plan(client, office, auth)
    assert len(after['elements']) == 1
    assert candidate['key'] not in {c['key'] for c in after['elementCandidates']}


def test_빈_칸을_세지만_틀렸다고_하지_않는다(client, world, office, auth):
    """⚠️ 특히 O·T 는 설문을 돌리기 전에는 빌 수밖에 없다. ④ TOWS 가 어느 조합을
    못 만드는지만 말해 준다."""
    client.post(f'{BASE}/plans/{YEAR}/elements', headers=auth(office),
                json={'kind': 'S', 'title': 'CAE 해석 역량'})

    summary = _plan(client, office, auth)['elementSummary']
    assert summary['counts'] == {'S': 1, 'W': 0, 'O': 0, 'T': 0}
    assert set(summary['emptyKinds']) == {'W', 'O', 'T'}


def test_알_수_없는_구분은_거절한다(client, world, office, auth):
    res = client.post(f'{BASE}/plans/{YEAR}/elements', headers=auth(office),
                      json={'kind': 'X', 'title': '아무거나'})
    assert res.status_code == 400
    assert 'S·W·O·T' in res.get_json()['message']
    assert StrategyElement.query.count() == 0


# ── O·T 는 설문에서 온다 ───────────────────────────────────────────────────

def test_설문_객관식이_기회와_위협_후보가_된다(client, world, office, auth):
    """포탈에 없는 정보라 규칙이 만들어낼 수 없다. 「가장 큰 위협은?」을
    analysis:threat 에 연결해 두면 보기 하나하나가 후보가 된다."""
    from app.modules.survey.models import (
        Survey, SurveyAnswer, SurveyQuestion, SurveyResponse,
    )
    from datetime import datetime

    survey = Survey(title='환경 조사', target_type='all', status='closed',
                    context_type='strategy_plan', context_id=world['plan'].id)
    _db.session.add(survey)
    _db.session.flush()
    q = SurveyQuestion(
        survey_id=survey.id, order=0, text='앞으로 가장 큰 위협은?',
        qtype='choice', required=True, link_key='analysis:threat',
        link_type='strategy_dimension',
        options={'choices': ['인력 이탈', '기술 격차', '예산 축소']})
    _db.session.add(q)
    _db.session.commit()

    # MX 에서 6명 — 인력 이탈 4, 기술 격차 2.
    for i, label in enumerate(['인력 이탈'] * 4 + ['기술 격차'] * 2):
        response = SurveyResponse(
            survey_id=survey.id, user_id=700000 + i,
            division_id=world['mx'].id, division_source='profile',
            submitted_at=datetime.utcnow())
        _db.session.add(response)
        _db.session.flush()
        _db.session.add(SurveyAnswer(response_id=response.id,
                                     question_id=q.id, value_json=label))
    _db.session.commit()

    candidates = _plan(client, office, auth)['elementCandidates']
    threats = [c for c in candidates if c['kind'] == 'T']
    # ⚠️ **1위만 내지 않는다.** 여기는 튀는 것을 짚는 자리가 아니라 재료를
    #    모으는 자리다 — 2위도 위협이다.
    assert {c['title'] for c in threats} == {'인력 이탈', '기술 격차'}
    top = next(c for c in threats if c['title'] == '인력 이탈')
    assert top['division_id'] == world['mx'].id     # 사업부별로 나뉜다
    assert '4명(66.7%)' in top['detail']
    assert '현장이 인식하는' in top['detail']        # 한계를 같이 적는다


def test_표본이_모자란_설문은_후보를_안_만든다(client, world, office, auth):
    """세 명이 꼽은 것을 사업부의 위협으로 세우면, 진단에서 표본 하한을 둔 이유가
    분석에서 무너진다."""
    from app.modules.survey.models import (
        Survey, SurveyAnswer, SurveyQuestion, SurveyResponse,
    )
    from datetime import datetime

    survey = Survey(title='환경 조사', target_type='all', status='closed',
                    context_type='strategy_plan', context_id=world['plan'].id)
    _db.session.add(survey)
    _db.session.flush()
    q = SurveyQuestion(survey_id=survey.id, order=0, text='위협은?',
                       qtype='choice', required=True, link_key='analysis:threat',
                       link_type='strategy_dimension',
                       options={'choices': ['가', '나']})
    _db.session.add(q)
    _db.session.commit()
    for i in range(3):
        response = SurveyResponse(
            survey_id=survey.id, user_id=710000 + i,
            division_id=world['mx'].id, division_source='profile',
            submitted_at=datetime.utcnow())
        _db.session.add(response)
        _db.session.flush()
        _db.session.add(SurveyAnswer(response_id=response.id,
                                     question_id=q.id, value_json='가'))
    _db.session.commit()

    candidates = _plan(client, office, auth)['elementCandidates']
    assert not [c for c in candidates if c['kind'] == 'T']


def test_사업부_격차의_강점은_잘하는_쪽에_붙는다(client, world, office, auth):
    """⚠️ 실제로 났던 문제다. 격차 자체는 전사 사실이지만("사업부 간 1.4점
    벌어져 있다"), 그것을 **강점**으로 세우면서 전사로 두면 격차의 **약한 쪽
    사업부 아래에도 강점으로** 뜬다. NW 가 자기 화면에서 "준비도가 강점" 을
    보게 되는 것이다.
    """
    from datetime import datetime
    from app.modules.survey.models import (
        Survey, SurveyAnswer, SurveyQuestion, SurveyResponse,
    )

    survey = Survey(title='역량 진단', target_type='all', status='closed',
                    context_type='strategy_plan', context_id=world['plan'].id)
    _db.session.add(survey)
    _db.session.flush()
    q = SurveyQuestion(survey_id=survey.id, order=0, text='준비도는?',
                       qtype='scale', required=True, options={'min': 1, 'max': 5},
                       link_key='organization:readiness',
                       link_type='strategy_dimension')
    _db.session.add(q)
    _db.session.commit()

    # MX 는 5점, VD 는 2점 — 3점 벌어진다.
    seq = 0
    for division, score in ((world['mx'], 5), (world['vd'], 2)):
        for _ in range(6):
            seq += 1
            response = SurveyResponse(
                survey_id=survey.id, user_id=720000 + seq,
                division_id=division.id, division_source='profile',
                submitted_at=datetime.utcnow())
            _db.session.add(response)
            _db.session.flush()
            _db.session.add(SurveyAnswer(response_id=response.id,
                                         question_id=q.id, value_number=score))
    _db.session.commit()

    candidates = _plan(client, office, auth)['elementCandidates']
    strengths = [c for c in candidates if c['kind'] == 'S']
    assert len(strengths) == 1
    # ← 요점. 전사가 아니라 **MX** 의 강점이다.
    assert strengths[0]['division_id'] == world['mx'].id
    assert 'MX' in strengths[0]['title']
    # 그리고 강점으로 읽혀야 한다 — '편차 3점' 은 관찰이지 강점이 아니다.
    assert '가장 높습니다' in strengths[0]['title']


def test_요소의_사업부를_고칠_수_있다(client, world, office, auth):
    """후보가 달아 준 사업부가 늘 맞지는 않는다. 특히 **전사로 잘못 들어간 것은
    모든 사업부에 다 뜬다** — 화면에서 고칠 수 있어야 한다."""
    res = client.post(f'{BASE}/plans/{YEAR}/elements', headers=auth(office),
                      json={'kind': 'S', 'title': 'CAE 해석 역량'})
    element_id = res.get_json()['data']['id']
    assert StrategyElement.query.get(element_id).division_id is None

    res = client.put(f'{BASE}/plans/{YEAR}/elements/{element_id}',
                     json={'division_id': world['mx'].id}, headers=auth(office))
    assert res.status_code == 200
    assert StrategyElement.query.get(element_id).division_id == world['mx'].id

    # 전사로 되돌리는 것도 된다.
    client.put(f'{BASE}/plans/{YEAR}/elements/{element_id}',
               json={'division_id': None}, headers=auth(office))
    assert StrategyElement.query.get(element_id).division_id is None


def test_강점_기준을_설정에서_낮추면_후보가_늘어난다(client, world, office, auth):
    """⚠️ 이 값이 코드에 박혀 있으면 조정하려면 배포해야 한다. **5가 맞는지는
    실제 진단값 분포를 보기 전에는 아무도 모른다** — 만든 사람도 모른다."""
    _grade(world, world['mx'], 'readiness', 4)     # 기본값(5)에서는 안 걸린다

    assert not [c for c in _plan(client, office, auth)['elementCandidates']
                if c['kind'] == 'S']

    res = client.put(f'{BASE}/settings/thresholds',
                     json={'thresholds': {'element_strong_at': 4}},
                     headers=auth(office))
    assert res.status_code == 200

    strengths = [c for c in _plan(client, office, auth)['elementCandidates']
                 if c['kind'] == 'S']
    assert len(strengths) == 1
    assert '준비도 4단계' in strengths[0]['title']


# ── Value Chain: 프로세스 축 ──────────────────────────────────────────────

def test_프로세스로도_같은_지표를_센다():
    """⚠️ 축마다 따로 세면 같은 지표가 두 곳에서 계산되고, 그러면 "사업부 합과
    프로세스 합이 다른" 날이 온다. 세는 것은 measure() 하나다."""
    from app.modules.digital_twin_strategy.metrics import measure

    items = [
        {'프로세스': '개발', 'performance_count': 0, 'kpi_links': []},
        {'프로세스': '개발', 'performance_count': 1,
         'kpi_links': [{'relation_type': 'primary'}]},
    ]
    m, _ctx = measure(items)
    assert m['project_count'] == 2
    assert m['no_performance_rate'] == 50.0
    assert m['no_kpi_link_rate'] == 50.0


class _Div:
    """사업부 대역. 이름·id 만 있으면 된다."""

    def __init__(self, id, name):
        self.id, self.name = id, name


_MX, _VD = _Div(1, 'MX'), _Div(2, 'VD')


def test_같은_사업부_안에서_튀는_프로세스만_짚는다():
    """⚠️ **프로세스는 사업부 아래에 있다.** MX 의 개발과 VD 의 개발은 서로
    독립적인 조직이라, 합쳐서 "개발이 나쁘다" 고 하면 어느 사업부 이야기인지 알
    수 없고 한 사업부가 나쁜 것이 나머지까지 나쁜 것처럼 보인다.

    그리고 **그 사업부의 프로세스가 전부 나쁘면 안 짚는다** — 그건 프로세스
    문제가 아니라 그 사업부의 문제이고, 사업부 축 규칙이 이미 짚는다.
    """
    from app.modules.digital_twin_strategy.findings import derive_process_findings

    by_division = {
        # MX: 제조만 나쁘다 → 짚는다
        1: {'개발': {'project_count': 10, 'no_performance_rate': 5.0},
            '제조': {'project_count': 10, 'no_performance_rate': 90.0}},
        # VD: 둘 다 나쁘다 → 사업부 문제라 안 짚는다
        2: {'개발': {'project_count': 10, 'no_performance_rate': 88.0},
            '제조': {'project_count': 10, 'no_performance_rate': 92.0}},
    }
    totals = {'개발': {'project_count': 20}, '제조': {'project_count': 20}}

    hits = [f for f in derive_process_findings(by_division, totals,
                                               ['개발', '제조'], [_MX, _VD])
            if 'no_performance' in f['key']]
    assert len(hits) == 1
    assert 'MX · 제조' in hits[0]['title']
    assert hits[0]['division_id'] == 1        # 그 사업부의 발견이다


def test_과제가_너무_적은_프로세스는_판정하지_않는다():
    """세 건 중 세 건이 성과 미정의면 100% 지만, 그 100% 는 조직의 성질이 아니라
    표본의 성질이다."""
    from app.modules.digital_twin_strategy.findings import derive_process_findings

    by_division = {
        1: {'개발': {'project_count': 10, 'no_performance_rate': 5.0},
            '제조': {'project_count': 3, 'no_performance_rate': 100.0}},
    }
    hits = [f for f in derive_process_findings(
        by_division, {'개발': {'project_count': 10}, '제조': {'project_count': 3}},
        ['개발', '제조'], [_MX]) if 'no_performance' in f['key']]
    assert hits == []


def test_어디서도_거의_안_하는_프로세스를_짚는다():
    """한 사업부에서만 적은 것은 그 사업부의 선택일 수 있지만, **어디서도 안
    하고 있으면** 조직이 그 프로세스를 비워 둔 것이다."""
    from app.modules.digital_twin_strategy.findings import derive_process_findings

    by_division = {
        1: {'개발': {'project_count': 100}, '연계': {'project_count': 1}},
        2: {'개발': {'project_count': 0}, '연계': {'project_count': 1}},
    }
    totals = {'개발': {'project_count': 100}, '연계': {'project_count': 2}}
    thin = [f for f in derive_process_findings(by_division, totals,
                                               ['개발', '연계'], [_MX, _VD])
            if f['key'].startswith('process_thin:')]
    assert len(thin) == 1
    assert '연계' in thin[0]['title'] and '2건' in thin[0]['title']
    # 어느 사업부가 손대고 있는지 말해 준다.
    assert 'MX' in thin[0]['detail'] and 'VD' in thin[0]['detail']


def test_프로세스를_안_적은_과제를_숨기지_않는다():
    """숨기면 합계가 안 맞는데 이유가 안 보인다."""
    from app.modules.digital_twin_strategy.findings import derive_process_findings

    found = derive_process_findings({1: {'개발': {'project_count': 10}}},
                                    {'개발': {'project_count': 10}},
                                    ['개발'], [_MX], unknown_count=7)
    unknown = [f for f in found if f['key'] == 'process_unknown']
    assert len(unknown) == 1
    assert '7건' in unknown[0]['title']
