"""설문 → 진단 연결 테스트. (LINK_PLAN 1·3·4단계)

**여기서 지키는 것은 숫자가 아니라 판단의 규칙이다.**

  · 1인 1표인가 — 문항을 많이 받은 역할이 더 세어지면 그건 집계가 아니라
    설계의 부작용이다
  · 표본이 모자란 칸을 제안하는가 — 세 명의 의견이 사업부의 진단이 되면 안 된다
  · 사람이 매긴 값을 조용히 덮어쓰는가 — 덮어쓰면 다음부터 아무도 판단을 안 적는다
  · 진단 대상 밖 응답을 버리는가 — 버리면 "답했는데 아무 데도 안 잡힌" 사람이 생긴다
"""
import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_strategy.models import StrategyAssessment, StrategyPlan
from app.modules.survey.models import Survey, SurveyQuestion, SurveyResponse, SurveyAnswer

STRATEGY_BASE = '/api/digital-twin-strategy'
RESPOND_BASE = '/api/surveys'
YEAR = 2026


@pytest.fixture()
def office(make_user):
    return make_user('office@test.local', UserRole.DT_OFFICE_MEMBER)


@pytest.fixture()
def staff(make_user):
    return make_user('staff@test.local', UserRole.USER, department='생산기술팀')


@pytest.fixture()
def world(db):
    """사업부 둘(진단 대상) + 하나(대상 밖) + 전략 하나."""
    from app.modules.digital_twin_dashboard.models import Division

    mx = Division(name='MX', is_kpi_owner=True, is_active=True, order=1)
    vd = Division(name='VD', is_kpi_owner=True, is_active=True, order=2)
    gtr = Division(name='GTR', is_kpi_owner=False, is_active=True, order=3)
    plan = StrategyPlan(year=YEAR, title=f'{YEAR}년 디지털 트윈 전략')
    _db.session.add_all([mx, vd, gtr, plan])
    _db.session.commit()
    return {'mx': mx, 'vd': vd, 'gtr': gtr, 'plan': plan}


def _survey(plan, title='조직 역량 진단', status='closed'):
    survey = Survey(title=title, target_type='all', status=status,
                    context_type='strategy_plan', context_id=plan.id,
                    roles=['PL', '과제 참여인력'])
    _db.session.add(survey)
    _db.session.flush()
    return survey


def _question(survey, text, link_key, order=0):
    q = SurveyQuestion(survey_id=survey.id, order=order, text=text, qtype='scale',
                       required=True, options={'min': 1, 'max': 5},
                       link_key=link_key, link_type='strategy_dimension')
    _db.session.add(q)
    _db.session.flush()
    return q


def _answer(survey, division, scores, role='PL', user_id=None):
    """한 사람의 응답. scores 는 {문항: 점수}."""
    _answer.seq = getattr(_answer, 'seq', 0) + 1
    response = SurveyResponse(
        survey_id=survey.id, user_id=user_id or (10_000 + _answer.seq),
        division_id=division.id if division else None,
        division_source='profile' if division else 'unknown',
        respondent_role=role, role_source='derived',
        submitted_at=_now(),
    )
    _db.session.add(response)
    _db.session.flush()
    for question, value in scores.items():
        _db.session.add(SurveyAnswer(response_id=response.id,
                                     question_id=question.id, value_number=value))
    return response


def _now():
    from datetime import datetime
    return datetime.utcnow()


def _evidence(client, office, auth):
    res = client.get(f'{STRATEGY_BASE}/plans/{YEAR}', headers=auth(office))
    assert res.status_code == 200, res.get_json()
    return res.get_json()['data']['surveyEvidence']


# ── 1단계: 근거를 읽어 온다 ────────────────────────────────────────────────

def test_한_사람이_한_표다(client, world, office, auth):
    """⚠️ 이 설문은 **역할마다 문항 수가 다른 것이 설계**다. 답을 그냥 모아
    평균 내면 문항을 많이 받은 역할이 그만큼 더 세어진다.

    PL 은 준비도 문항 3개(5,5,5), 참여인력은 1개(1). 답 단위면 (5+5+5+1)/4=4.0,
    사람 단위면 (5+1)/2=3.0 이다. **3.0 이어야 한다.**
    """
    survey = _survey(world['plan'])
    q1 = _question(survey, '준비도 1', 'organization:readiness', 0)
    q2 = _question(survey, '준비도 2', 'organization:readiness', 1)
    q3 = _question(survey, '준비도 3', 'organization:readiness', 2)
    _db.session.commit()

    _answer(survey, world['mx'], {q1: 5, q2: 5, q3: 5}, role='PL')
    _answer(survey, world['mx'], {q1: 1}, role='과제 참여인력')
    _db.session.commit()

    cells = _evidence(client, office, auth)['cells']
    cell = next(c for c in cells if c['dimension'] == 'readiness')
    assert cell['average'] == 3.0
    assert cell['respondent_count'] == 2


def test_표본이_모자라면_제안하지_않는다(client, world, office, auth):
    """세 명의 의견이 사업부의 진단이 되면 안 되고, 칸의 표본이 한둘로 내려가면
    익명이라던 응답이 사실상 지목이 된다. 기본 하한은 5명이다."""
    survey = _survey(world['plan'])
    q = _question(survey, '준비도', 'organization:readiness')
    _db.session.commit()
    for _ in range(3):
        _answer(survey, world['mx'], {q: 4})
    _db.session.commit()

    cell = next(c for c in _evidence(client, office, auth)['cells']
                if c['dimension'] == 'readiness')
    assert cell['respondent_count'] == 3
    assert cell['insufficient'] is True
    assert cell['suggested_level'] is None
    assert cell['average'] == 4.0        # 평균은 보여준다. 숨기지 않는다


def test_진단_대상_밖_응답은_버리지_않고_따로_센다(client, world, office, auth):
    """GTR 은 기능조직이라 진단 대상이 아니다. 소속 미확인도 마찬가지다.
    그냥 빠뜨리면 "답했는데 아무 데도 안 잡힌" 사람이 생기고, 응답 수 합계가
    안 맞는데 화면 어디에도 그 이유가 없다."""
    survey = _survey(world['plan'])
    q = _question(survey, '준비도', 'organization:readiness')
    _db.session.commit()
    _answer(survey, world['gtr'], {q: 4})
    _answer(survey, None, {q: 2})        # 소속 미확인
    _answer(survey, world['mx'], {q: 3})
    _db.session.commit()

    evidence = _evidence(client, office, auth)
    assert [c['division_id'] for c in evidence['cells']] == [world['mx'].id]
    out = {o['division_name']: o['respondent_count'] for o in evidence['out_of_scope']}
    assert out == {'GTR': 1, '소속 미확인': 1}


def test_대상_밖_인원은_축마다_세지_않고_사람으로_센다(client, world, office, auth):
    """⚠️ 실제로 났던 버그다. 축별 칸의 인원을 더해서, 다섯 축에 답한 5명이
    **21명**으로 보였다. 사람 수를 말하는 자리에서는 사람을 세야 한다."""
    survey = _survey(world['plan'])
    q1 = _question(survey, '준비도', 'organization:readiness', 0)
    q2 = _question(survey, '역할', 'organization:role', 1)
    q3 = _question(survey, '리스크', 'organization:risk', 2)
    _db.session.commit()
    for _ in range(4):
        _answer(survey, world['gtr'], {q1: 3, q2: 3, q3: 3})
    _db.session.commit()

    out = _evidence(client, office, auth)['out_of_scope']
    assert [o['respondent_count'] for o in out] == [4]     # 12 이 아니다
    assert out[0]['division_name'] == 'GTR'


def test_진행_중인_설문은_근거가_아니다(client, world, office, auth):
    """사람이 답할 때마다 진단이 움직이면, 어제 본 숫자와 오늘 숫자가 다른데
    아무도 왜인지 모른다."""
    survey = _survey(world['plan'], status='open')
    q = _question(survey, '준비도', 'organization:readiness')
    _db.session.commit()
    for _ in range(6):
        _answer(survey, world['mx'], {q: 4})
    _db.session.commit()

    assert _evidence(client, office, auth)['cells'] == []


def test_설문끼리_섞지_않는다(client, world, office, auth):
    """같은 축을 가리켜도 묻는 맥락이 다르다. 합쳐 놓으면 그게 무엇의 평균인지
    아무도 말할 수 없다. **설문마다 한 줄**이어야 한다."""
    a = _survey(world['plan'], title='조직 역량 진단')
    qa = _question(a, '준비도', 'organization:readiness')
    b = _survey(world['plan'], title='과제 애로사항 조사')
    qb = _question(b, '준비도', 'organization:readiness')
    _db.session.commit()
    for _ in range(5):
        _answer(a, world['mx'], {qa: 4})
    for _ in range(5):
        _answer(b, world['mx'], {qb: 2})
    _db.session.commit()

    cells = [c for c in _evidence(client, office, auth)['cells']
             if c['dimension'] == 'readiness']
    assert len(cells) == 2
    assert sorted(c['average'] for c in cells) == [2.0, 4.0]   # 3.0 으로 뭉치지 않는다


# ── 3단계: 반영 ────────────────────────────────────────────────────────────

def _apply(client, office, auth, cells, **extra):
    return client.post(f'{STRATEGY_BASE}/plans/{YEAR}/assessments/apply-survey',
                       json={'cells': cells, **extra}, headers=auth(office))


def test_반영하면_진단값과_근거가_같이_남는다(client, world, office, auth):
    survey = _survey(world['plan'])
    q = _question(survey, '준비도', 'organization:readiness')
    _db.session.commit()
    for _ in range(5):
        _answer(survey, world['mx'], {q: 4})
    _db.session.commit()

    res = _apply(client, office, auth, [{
        'survey_id': survey.id, 'division_id': world['mx'].id,
        'dimension': 'readiness',
    }])
    assert res.status_code == 200, res.get_json()
    assert res.get_json()['data']['applied'][0]['level'] == 4

    saved = StrategyAssessment.query.one()
    assert saved.current_level == 4
    assert saved.basis == 'survey'
    # ⚠️ 근거가 문장으로 남아야 나중에 "왜 4지?" 에 답할 수 있다.
    assert '조직 역량 진단' in saved.note
    assert '응답 5명' in saved.note


def test_사람이_매긴_값은_조용히_덮어쓰지_않는다(client, world, office, auth):
    """사무국의 판단을 설문이 지우면, 다음부터 아무도 이 화면에 판단을 안 적는다."""
    survey = _survey(world['plan'])
    q = _question(survey, '준비도', 'organization:readiness')
    _db.session.add(StrategyAssessment(
        plan_id=world['plan'].id, division_id=world['mx'].id,
        category='organization', dimension='readiness',
        current_level=2, basis='manual'))
    _db.session.commit()
    for _ in range(5):
        _answer(survey, world['mx'], {q: 4})
    _db.session.commit()

    cell = {'survey_id': survey.id, 'division_id': world['mx'].id,
            'dimension': 'readiness'}
    res = _apply(client, office, auth, [cell])
    assert res.status_code == 200
    assert res.get_json()['data']['applied'] == []
    assert '사람이 매긴 값' in res.get_json()['data']['skipped'][0]['reason']
    assert StrategyAssessment.query.one().current_level == 2      # 그대로다

    # 정말 바꾸려면 명시해야 한다. 그때도 이전 값은 note 에 남는다.
    res = _apply(client, office, auth, [cell], overwrite_manual=True)
    assert res.get_json()['data']['applied'][0]['previous_level'] == 2
    assert '이전 값 2' in StrategyAssessment.query.one().note


def test_표본이_모자란_칸은_반영되지_않는다(client, world, office, auth):
    survey = _survey(world['plan'])
    q = _question(survey, '준비도', 'organization:readiness')
    _db.session.commit()
    _answer(survey, world['mx'], {q: 4})
    _db.session.commit()

    res = _apply(client, office, auth, [{
        'survey_id': survey.id, 'division_id': world['mx'].id,
        'dimension': 'readiness',
    }])
    assert res.get_json()['data']['applied'] == []
    assert '표본 부족' in res.get_json()['data']['skipped'][0]['reason']
    assert StrategyAssessment.query.count() == 0


# ── 4단계: 발견 사항 ─────────────────────────────────────────────────────────

def _one(found, prefix):
    """그 규칙이 낸 발견 하나. **key 는 축·문항마다 달라야 한다** — 같으면
    하나를 난제로 올릴 때 나머지가 이슈 후보에서 같이 사라진다."""
    hits = [f for k, f in found.items() if k.startswith(prefix)]
    assert len(hits) == 1, f'{prefix} 로 시작하는 발견이 {len(hits)}건'
    return hits[0]


def _findings(client, office, auth):
    res = client.get(f'{STRATEGY_BASE}/plans/{YEAR}', headers=auth(office))
    return {f['key']: f for f in res.get_json()['data']['findings']}


def test_역할이_다르게_보면_짚는다(client, world, office, auth):
    """같은 것을 보고 다르게 말한다면 정보가 한쪽에만 있거나, 한쪽이 보지 못하는
    자리에 있다. 어느 쪽이 맞는지보다 왜 갈리는지가 먼저다."""
    survey = _survey(world['plan'])
    q = _question(survey, '역할이 분명한가', 'organization:role')
    _db.session.commit()
    for _ in range(5):
        _answer(survey, world['mx'], {q: 2}, role='PL')
    for _ in range(5):
        _answer(survey, world['mx'], {q: 4}, role='과제 참여인력')
    _db.session.commit()

    found = _findings(client, office, auth)
    gap = _one(found, 'survey_role_gap:')
    assert '역할·책임' in gap['title']


def test_전사가_다_낮으면_사업부별로_쪼개지_않는다(client, world, office, auth):
    """다섯 사업부가 똑같이 붉은 목록은 읽히지 않는다. 전사 하나로 짚는다."""
    survey = _survey(world['plan'])
    q = _question(survey, '성과를 재는가', 'organization:return')
    _db.session.commit()
    for division in (world['mx'], world['vd']):
        for _ in range(5):
            _answer(survey, division, {q: 2})
    _db.session.commit()

    found = _findings(client, office, auth)
    low = _one(found, 'survey_universal_low:')
    assert low['division_id'] is None            # 전사 하나로
    assert low['severity'] == 'high'


def test_사업부_간_격차를_짚는다(client, world, office, auth):
    """잘하는 곳이 있다는 것은 못 하는 것이 아니라 **안 옮겨진 것**이다."""
    survey = _survey(world['plan'])
    q = _question(survey, '준비도', 'organization:readiness')
    _db.session.commit()
    for _ in range(5):
        _answer(survey, world['mx'], {q: 5})
    for _ in range(5):
        _answer(survey, world['vd'], {q: 3})
    _db.session.commit()

    found = _findings(client, office, auth)
    assert 'MX' in _one(found, 'survey_division_gap:')['title']


def test_객관식_쏠림을_짚는다(client, world, office, auth):
    """'준비도 2.8' 보다 '62% 가 데이터 정합성을 꼽았다' 가 다음에 무엇을 할지
    말해 준다."""
    survey = _survey(world['plan'])
    _question(survey, '준비도', 'organization:readiness')   # 후보 자격용 척도 문항
    choice = SurveyQuestion(
        survey_id=survey.id, order=1, text='가장 큰 걸림돌은?', qtype='choice',
        required=True, options={'choices': ['데이터 정합성', '인력 부족']})
    _db.session.add(choice)
    _db.session.commit()

    for _ in range(6):
        response = _answer(survey, world['mx'], {})
        _db.session.add(SurveyAnswer(response_id=response.id,
                                     question_id=choice.id,
                                     value_json=['데이터 정합성']))
    _db.session.commit()

    # ⚠️ key 에 문항 번호가 붙는다. 안 붙이면 객관식 발견이 전부 같은 key 라,
    #    하나를 난제로 올리는 순간 나머지가 이슈 후보에서 통째로 사라진다.
    found = _findings(client, office, auth)
    top = [f for k, f in found.items() if k.startswith('survey_choice_top:')]
    assert len(top) == 1
    assert '데이터 정합성' in top[0]['title']


def test_설문이_없으면_진단은_그대로_돈다(client, world, office, auth):
    """설문은 진단의 한 재료일 뿐이다. 없다고 화면이 깨지면 안 된다."""
    res = client.get(f'{STRATEGY_BASE}/plans/{YEAR}', headers=auth(office))
    assert res.status_code == 200
    data = res.get_json()['data']
    assert data['surveyEvidence'] == {'surveys': [], 'cells': [], 'out_of_scope': []}


# ── 설문이 이슈 후보가 된다 ────────────────────────────────────────────────

def test_설문이_짚은_것은_목표_없이도_이슈_후보가_된다(client, world, office, auth):
    """격차 후보는 사람이 **목표 레벨을 넣어야** 나온다. 그런데 '63% 가 데이터
    정합성을 꼽았다'는 격차가 아니라 지목이라, 목표를 정하는 것과 상관없이 그대로
    할 일이다. 그 길이 없으면 설문은 진단에서 멈춘다."""
    survey = _survey(world['plan'])
    q = _question(survey, '성과를 재는가', 'organization:return')
    _db.session.commit()
    for division in (world['mx'], world['vd']):
        for _ in range(5):
            _answer(survey, division, {q: 2})
    _db.session.commit()

    res = client.get(f'{STRATEGY_BASE}/plans/{YEAR}', headers=auth(office))
    data = res.get_json()['data']
    assert all(a['target_level'] is None for a in data['assessments'])   # 목표 없음

    low = [c for c in data['issueCandidates']
           if c['source_ref'].startswith('survey_universal_low:')]
    assert len(low) == 1
    assert low[0]['source_type'] == 'finding'
    assert low[0]['group'] == '설문'


def test_핵심_난제로_올린_설문_사실은_후보에서_빠진다(client, world, office, auth):
    """⚠️ 같은 사실이 난제로도 후보로도 남으면 이슈 목록에 두 번 들어온다.
    issues.py 가 findings 를 후보로 안 뽑던 이유가 그것이다."""
    survey = _survey(world['plan'])
    q = _question(survey, '성과를 재는가', 'organization:return')
    _db.session.commit()
    for division in (world['mx'], world['vd']):
        for _ in range(5):
            _answer(survey, division, {q: 2})
    _db.session.commit()

    client.post(f'{STRATEGY_BASE}/plans/{YEAR}/cruxes',
                json={'title': '성과를 재는 법이 없다',
                      'source_finding': 'survey_universal_low:return'},
                headers=auth(office))

    data = client.get(f'{STRATEGY_BASE}/plans/{YEAR}',
                      headers=auth(office)).get_json()['data']
    refs = {c['source_ref'] for c in data['issueCandidates']}
    assert 'survey_universal_low:return' not in refs


def test_지표에서_나온_짚인_것은_후보로_안_간다(client, world, office, auth):
    """지표 쪽은 B(지표 격차)가 이미 같은 것을 낸다. 두 번 내면 중복이다."""
    from app.modules.digital_twin_strategy.issues import derive_survey_candidates

    findings = [
        {'key': 'gap_performance', 'severity': 'high', 'title': 'x', 'detail': ''},
        {'key': 'survey_role_gap', 'severity': 'high', 'title': 'y', 'detail': ''},
    ]
    refs = {c['source_ref'] for c in derive_survey_candidates(findings, set())}
    assert refs == {'survey_role_gap'}


# ── 서술형: 지어낸 인용을 버린다 ───────────────────────────────────────────

def test_원문에_없는_인용은_버린다():
    """⚠️ 있지도 않은 말을 그럴듯하게 지어내는 것이 이 종류 작업의 대표적
    실패다. 근거로 못 쓸 문장이 화면에 남으면 나머지 묶음까지 못 믿게 된다."""
    from app.modules.digital_twin_strategy.survey_voice import _verify_quotes

    corpus = ['데이터를 두 번 입력합니다. 시스템이 이어져 있지 않아서 사람이 옮깁니다.']
    kept, dropped = _verify_quotes([
        '데이터를 두 번 입력합니다',                    # 원문에 있다
        '"데이터를 두 번 입력합니다."',                  # 부호만 다르다 — 인정
        '예산이 부족해서 아무것도 못 합니다',            # 지어낸 말
    ], corpus)
    assert len(kept) == 2
    assert dropped == ['예산이 부족해서 아무것도 못 합니다']


def test_서술형이_적으면_묶지_않는다(client, world, office, auth):
    """두세 건을 묶어 "이런 의견이 있다"고 말하는 것은 요약이 아니라 지목이다."""
    from app.modules.digital_twin_strategy.survey_voice import summarize
    from app.modules.survey.models import SurveyAnswer as _A

    survey = _survey(world['plan'])
    _question(survey, '준비도', 'organization:readiness')
    free = SurveyQuestion(survey_id=survey.id, order=1, text='바라는 점은?',
                          qtype='text', required=False)
    _db.session.add(free)
    _db.session.commit()
    for i in range(3):
        response = _answer(survey, world['mx'], {})
        _db.session.add(_A(response_id=response.id, question_id=free.id,
                           value_text=f'의견 {i}'))
    _db.session.commit()

    out = summarize(world['plan'])
    assert out['themes'] == []
    assert out['answer_count'] == 3
    # 이유를 말해 준다. 빈 화면만 주면 고장인지 데이터가 없는 건지 알 수 없다.
    assert '3건' in out['reason']


def test_서술형을_AI_로_읽으면_감사_로그가_남는다(client, world, office, auth, monkeypatch):
    """익명 응답의 **원문이 다른 시스템으로 나가는** 일이다. 신원을 드러내지는
    않지만, 내보내기·응답자 확인에 기록을 남긴 것과 같은 기준을 대면 이것도
    남아야 한다. 남기지 않으면 「관리자가 열람하면 기록이 남습니다」가 면피
    문구가 된다.
    """
    from app.modules.digital_twin_strategy import survey_voice
    from app.modules.survey.models import SurveyAccessLog, SurveyAnswer as _A

    survey = _survey(world['plan'])
    _question(survey, '준비도', 'organization:readiness')
    free = SurveyQuestion(survey_id=survey.id, order=1, text='바라는 점은?',
                          qtype='text', required=False)
    _db.session.add(free)
    _db.session.commit()
    for i in range(10):
        response = _answer(survey, world['mx'], {})
        _db.session.add(_A(response_id=response.id, question_id=free.id,
                           value_text=f'데이터를 두 번 입력합니다 {i}'))
    _db.session.commit()

    class _Answer:
        content = '{"themes": [{"title": "중복 입력", "summary": "",' \
                  ' "quotes": ["데이터를 두 번 입력합니다 1"]}]}'

    monkeypatch.setattr(survey_voice.dt_llm, 'is_configured', lambda: True)
    monkeypatch.setattr(survey_voice.dt_llm, 'chat', lambda *a, **k: _Answer())

    res = client.post(f'{STRATEGY_BASE}/plans/{YEAR}/survey-voices',
                      json={}, headers=auth(office))
    assert res.status_code == 200, res.get_json()
    assert len(res.get_json()['data']['themes']) == 1

    log = SurveyAccessLog.query.one()
    assert log.action == 'ai_read'
    assert log.survey_id == survey.id
    assert log.viewer_id == office.id


def test_읽을_원문이_모자라면_로그도_안_남는다(client, world, office, auth):
    """부르지 않았으면 남길 것도 없다. 안 나간 것을 나갔다고 적으면 기록이
    거짓이 되고, 그러면 기록 전체를 못 믿는다."""
    from app.modules.survey.models import SurveyAccessLog, SurveyAnswer as _A

    survey = _survey(world['plan'])
    _question(survey, '준비도', 'organization:readiness')
    free = SurveyQuestion(survey_id=survey.id, order=1, text='바라는 점은?',
                          qtype='text', required=False)
    _db.session.add(free)
    _db.session.commit()
    for i in range(2):
        response = _answer(survey, world['mx'], {})
        _db.session.add(_A(response_id=response.id, question_id=free.id,
                           value_text=f'의견 {i}'))
    _db.session.commit()

    res = client.post(f'{STRATEGY_BASE}/plans/{YEAR}/survey-voices',
                      json={}, headers=auth(office))
    assert res.status_code == 200
    assert SurveyAccessLog.query.count() == 0


# ── 점수 붙은 객관식 ───────────────────────────────────────────────────────

def _scored(survey, text, link_key, order=0):
    """'얼마나 자주' 처럼 **순서가 있는** 객관식. 보기마다 점수가 적혀 있다."""
    q = SurveyQuestion(
        survey_id=survey.id, order=order, text=text, qtype='choice',
        required=True, link_key=link_key, link_type='strategy_dimension',
        options={'choices': ['매일', '주 1~2회', '가끔', '쓰지 않음'],
                 'scores': [5, 4, 2, 1]})
    _db.session.add(q)
    _db.session.flush()
    return q


def _pick(survey, division, question, label, role='PL'):
    from app.modules.survey.models import SurveyAnswer as _A
    response = _answer(survey, division, {}, role=role)
    _db.session.add(_A(response_id=response.id, question_id=question.id,
                       value_json=label))
    return response


def test_점수가_붙은_객관식은_레벨에_들어간다(client, world, office, auth):
    """'얼마나 자주 쓰십니까'는 사실상 척도인데 보기로 물었을 뿐이다. 보기에
    점수를 적어 두면 척도 문항과 **같은 자격**으로 진단에 들어가야 한다."""
    survey = _survey(world['plan'])
    q = _scored(survey, '도구를 얼마나 자주 쓰십니까?', 'organization:redesign')
    _db.session.commit()
    for label in ['매일', '매일', '주 1~2회', '가끔', '쓰지 않음']:
        _pick(survey, world['mx'], q, label)
    _db.session.commit()

    cell = next(c for c in _evidence(client, office, auth)['cells']
                if c['dimension'] == 'redesign')
    assert cell['respondent_count'] == 5
    assert cell['average'] == 3.4          # (5+5+4+2+1)/5
    assert cell['suggested_level'] == 3


def test_점수와_척도가_한_사람_안에서_같이_평균된다(client, world, office, auth):
    """둘 다 1~5 라는 같은 자에서 나온 값이다. 한 사람이 척도 하나와 점수 객관식
    하나를 받았으면 **그 둘의 평균**이 그 사람의 점수다."""
    from app.modules.survey.models import SurveyAnswer as _A

    survey = _survey(world['plan'])
    scale_q = _question(survey, '자리잡았습니까?', 'organization:redesign', 0)
    choice_q = _scored(survey, '얼마나 자주?', 'organization:redesign', 1)
    _db.session.commit()
    for _ in range(5):
        response = _answer(survey, world['mx'], {scale_q: 5})
        _db.session.add(_A(response_id=response.id, question_id=choice_q.id,
                           value_json='가끔'))          # 2점
    _db.session.commit()

    cell = next(c for c in _evidence(client, office, auth)['cells']
                if c['dimension'] == 'redesign')
    assert cell['average'] == 3.5          # (5 + 2) / 2
    assert cell['respondent_count'] == 5   # 문항이 둘이어도 한 사람이다


def test_점수_없는_객관식은_레벨에_안_들어간다(client, world, office, auth):
    """'데이터 정합성'과 '인력 부족' 중 어느 쪽이 높은 단계인지는 정해질 수 없다.
    순서가 없는 보기라서다 — 시스템이 짐작해 매기면 그 매핑을 아무도 설명하지
    못한다."""
    survey = _survey(world['plan'])
    _question(survey, '준비도', 'organization:readiness', 0)   # 후보 자격용
    plain = SurveyQuestion(
        survey_id=survey.id, order=1, text='가장 큰 걸림돌은?', qtype='choice',
        required=True, link_key='organization:redesign',
        link_type='strategy_dimension',
        options={'choices': ['데이터 정합성', '인력 부족']})
    _db.session.add(plain)
    _db.session.commit()
    for _ in range(6):
        _pick(survey, world['mx'], plain, '데이터 정합성')
    _db.session.commit()

    dims = {c['dimension'] for c in _evidence(client, office, auth)['cells']}
    assert 'redesign' not in dims


def test_응답자에게는_보기_점수를_보여주지_않는다(client, world, staff, auth):
    """'매일=5, 쓰지 않음=1' 이 보이면 사람들은 높은 쪽을 고른다 — 재려던 것이
    사라지고 점수만 남는다."""
    survey = _survey(world['plan'], status='open')
    q = _scored(survey, '얼마나 자주?', 'organization:redesign')
    _db.session.commit()

    res = client.get(f'{RESPOND_BASE}/{survey.id}/form', headers=auth(staff))
    assert res.status_code == 200
    options = res.get_json()['data']['questions'][0]['options']
    assert options['choices'] == ['매일', '주 1~2회', '가끔', '쓰지 않음']
    assert 'scores' not in options        # ← 요점


def test_객관식_발견은_문항마다_다른_key_를_쓴다(client, world, office, auth):
    """⚠️ 실제로 있던 구멍이다. 객관식 발견이 전부 'survey_choice_top' 하나를
    쓰면, 이슈 후보 중복 제거가 key 로 도는 탓에 **하나를 난제로 올리는 순간
    나머지 객관식 발견이 후보에서 통째로 사라진다.**
    """
    from app.modules.survey.models import SurveyAnswer as _A

    survey = _survey(world['plan'])
    _question(survey, '준비도', 'organization:readiness')
    q1 = SurveyQuestion(survey_id=survey.id, order=1, text='걸림돌은?',
                        qtype='choice', required=True,
                        options={'choices': ['데이터', '인력']})
    q2 = SurveyQuestion(survey_id=survey.id, order=2, text='필요한 것은?',
                        qtype='choice', required=True,
                        options={'choices': ['교육', '도구']})
    _db.session.add_all([q1, q2])
    _db.session.commit()
    for _ in range(6):
        response = _answer(survey, world['mx'], {})
        _db.session.add_all([
            _A(response_id=response.id, question_id=q1.id, value_json='데이터'),
            _A(response_id=response.id, question_id=q2.id, value_json='교육'),
        ])
    _db.session.commit()

    data = client.get(f'{STRATEGY_BASE}/plans/{YEAR}',
                      headers=auth(office)).get_json()['data']
    refs = [c['source_ref'] for c in data['issueCandidates']
            if c['source_ref'].startswith('survey_choice_top')]
    assert len(refs) == 2 and len(set(refs)) == 2

    # 하나를 난제로 올려도 **나머지는 남아야 한다.**
    client.post(f'{STRATEGY_BASE}/plans/{YEAR}/cruxes',
                json={'title': '데이터 정합성', 'source_finding': refs[0]},
                headers=auth(office))
    after = client.get(f'{STRATEGY_BASE}/plans/{YEAR}',
                       headers=auth(office)).get_json()['data']
    left = [c['source_ref'] for c in after['issueCandidates']
            if c['source_ref'].startswith('survey_choice_top')]
    assert left == [refs[1]]


def test_1위와_2위가_붙어_있으면_짚지_않는다(client, world, office, auth):
    """35% 대 33% 를 "압도적 1위" 로 읽게 두면 그 오해가 보고서에 그대로 실린다."""
    from app.modules.survey.models import SurveyAnswer as _A

    survey = _survey(world['plan'])
    _question(survey, '준비도', 'organization:readiness')
    q = SurveyQuestion(survey_id=survey.id, order=1, text='걸림돌은?',
                       qtype='choice', required=True,
                       options={'choices': ['데이터', '인력']})
    _db.session.add(q)
    _db.session.commit()
    # 6 대 5 — 1위 54.5%, 2위 45.5%. 쏠림 기준(50%)은 넘지만 격차는 9%p 다.
    for label in ['데이터'] * 6 + ['인력'] * 5:
        response = _answer(survey, world['mx'], {})
        _db.session.add(_A(response_id=response.id, question_id=q.id,
                           value_json=label))
    _db.session.commit()

    found = _findings(client, office, auth)
    assert not [k for k in found if k.startswith('survey_choice_top')]


def test_역할마다_다른_보기를_고르면_짚는다(client, world, office, auth):
    """평균 차이보다 또렷한 발견이다 — 같은 것을 보고 **다른 것을 지목**했다."""
    from app.modules.survey.models import SurveyAnswer as _A

    survey = _survey(world['plan'])
    _question(survey, '준비도', 'organization:readiness')
    q = SurveyQuestion(survey_id=survey.id, order=1, text='가장 큰 걸림돌은?',
                       qtype='choice', required=True,
                       link_key='organization:role', link_type='strategy_dimension',
                       options={'choices': ['인력 부족', '데이터 정합성']})
    _db.session.add(q)
    _db.session.commit()
    for role, label in (('PL', '인력 부족'), ('과제 참여인력', '데이터 정합성')):
        for _ in range(6):
            response = _answer(survey, world['mx'], {}, role=role)
            _db.session.add(_A(response_id=response.id, question_id=q.id,
                               value_json=label))
    _db.session.commit()

    found = _findings(client, office, auth)
    split = [f for k, f in found.items() if k.startswith('survey_choice_role:')]
    assert len(split) == 1
    assert split[0]['severity'] == 'high'
    assert 'PL' in split[0]['detail'] and '인력 부족' in split[0]['detail']
    # 연결키를 달아 뒀으면 **어느 축의 이야기인지** 말해 준다. 안 그러면 연결한
    # 사람은 연결했다고 믿는데 아무 데도 안 붙는다.
    assert '역할·책임 관련' in split[0]['detail']


# ── 감사에서 나온 것들 ─────────────────────────────────────────────────────

def test_객관식만_있는_설문도_짚는다(client, world, office, auth):
    """⚠️ 레벨을 못 만드는 것과 짚을 게 없는 것은 다른 이야기다. 좁은 후보로
    거르던 때는 8명이 100% 로 한 보기를 꼽아도 진단에 아무것도 안 나타났다 —
    '애로사항 조사'처럼 객관식만 있는 설문이 통째로 사라지는 셈이다.
    """
    from app.modules.survey.models import SurveyAnswer as _A

    survey = _survey(world['plan'])          # 척도 문항을 **안 넣는다**
    q = SurveyQuestion(survey_id=survey.id, order=0, text='무엇이 가장 급합니까?',
                       qtype='choice', required=True,
                       options={'choices': ['표준화', '인력']})
    _db.session.add(q)
    _db.session.commit()
    for _ in range(8):
        response = _answer(survey, world['mx'], {})
        _db.session.add(_A(response_id=response.id, question_id=q.id,
                           value_json='표준화'))
    _db.session.commit()

    found = _findings(client, office, auth)
    assert [k for k in found if k.startswith('survey_choice_top:')]
    # 레벨은 여전히 안 만든다 — 그건 점수가 있어야 한다.
    assert _evidence(client, office, auth)['cells'] == []


def test_갈림은_진단_대상_사업부끼리만_견준다(client, world, office, auth):
    """척도 규칙은 진단 대상만 보는데 객관식만 전사를 보면, 같은 화면의 두 발견이
    서로 다른 모집단을 말한다. 대상 밖은 「따로 센다」고 해놓고 여기로 새는 셈이다."""
    from app.modules.survey.models import SurveyAnswer as _A

    survey = _survey(world['plan'])
    _question(survey, '준비도', 'organization:readiness')
    q = SurveyQuestion(survey_id=survey.id, order=1, text='걸림돌은?',
                       qtype='choice', required=True,
                       options={'choices': ['데이터', '인력']})
    _db.session.add(q)
    _db.session.commit()
    # MX 와 GTR 이 서로 다른 보기를 꼽는다. GTR 은 진단 대상이 아니다.
    for division, label in ((world['mx'], '데이터'), (world['gtr'], '인력')):
        for _ in range(6):
            response = _answer(survey, division, {})
            _db.session.add(_A(response_id=response.id, question_id=q.id,
                               value_json=label))
    _db.session.commit()

    found = _findings(client, office, auth)
    assert not [k for k in found if k.startswith('survey_choice_div:')]


def test_원문을_품은_창작_인용은_버린다():
    """⚠️ 안전장치라고 적어 두고 실제로는 뚫려 있었다. '교육이 부족합니다' 앞뒤에
    없는 말을 붙여 놓으면 그대로 통과했다 — 인용이 원문보다 길다는 것은 없는
    말을 보탰다는 뜻이다."""
    from app.modules.digital_twin_strategy.survey_voice import _verify_quotes

    corpus = ['교육이 부족합니다.']
    kept, dropped = _verify_quotes([
        '교육이 부족합니다',                                    # 그대로
        '예산 문제로 교육이 부족합니다 그래서 전면 재검토합니다',   # 원문을 품은 창작
    ], corpus)
    assert kept == ['교육이 부족합니다']
    assert len(dropped) == 1


def test_임계값에_말이_안_되는_값은_거절한다(client, world, office, auth):
    """⚠️ 전부 '100 이하' 로만 보던 때는 **역할 간 격차 99점**이 저장됐다.
    1~5 척도에서 그런 격차는 나올 수 없으므로 그 규칙이 조용히 죽는데,
    설정에서 값을 넣은 사람은 왜 아무것도 안 짚히는지 알 방법이 없다.
    """
    bad = client.put(f'{STRATEGY_BASE}/settings/thresholds',
                     json={'thresholds': {'survey_role_gap': 99}},
                     headers=auth(office))
    assert bad.status_code == 400
    assert '4점 이하' in bad.get_json()['message']

    ok = client.put(f'{STRATEGY_BASE}/settings/thresholds',
                    json={'thresholds': {'survey_role_gap': 1.2}},
                    headers=auth(office))
    assert ok.status_code == 200


def test_진단값_근거는_아는_값만_받는다(client, world, office, auth):
    """basis 는 표시용이 아니라 **판단에 쓰인다** — 설문 반영이 'manual' 칸을
    건너뛰는 근거가 이것이다. 아무 문자열이나 들어가면 그 칸은 수기 보호를 잃고
    다음 반영에 조용히 덮인다."""
    url = (f"{STRATEGY_BASE}/plans/{YEAR}/assessments/{world['mx'].id}"
           '/organization/readiness')
    bad = client.put(url, json={'basis': '아무말이나'}, headers=auth(office))
    assert bad.status_code == 400
    assert '알 수 없는 근거 구분' in bad.get_json()['message']

    ok = client.put(url, json={'current_level': 3, 'basis': 'manual'},
                    headers=auth(office))
    assert ok.status_code == 200
    assert StrategyAssessment.query.one().basis == 'manual'


# ── 아래에서 위로: 이슈를 묶어 난제 만들기 ─────────────────────────────────

def test_이슈_여러_개를_묶어_난제를_만든다(client, world, office, auth):
    """진단이 난제를 먼저 남기고 쪼개는 것이 본줄기지만, 반대 방향도 일어난다 —
    진단의 여러 곳에서 나온 것을 각각 이슈로 적어 놓고 보니 **그것들을 관통하는
    하나**가 보이는 경우다. 그게 난제다.
    """
    from app.modules.digital_twin_strategy.models import StrategyCrux, StrategyIssue

    made = []
    for title in ('성과 정의가 과제마다 다르다', 'KPI 연결이 비어 있다'):
        res = client.post(f'{STRATEGY_BASE}/plans/{YEAR}/issues',
                          json={'title': title, 'division_id': world['mx'].id},
                          headers=auth(office))
        assert res.status_code == 201, res.get_json()
        made.append(res.get_json()['data']['id'])

    # 묶기 전에는 어느 난제에도 안 걸려 있다.
    assert all(i.crux_id is None for i in StrategyIssue.query.all())

    res = client.post(f'{STRATEGY_BASE}/plans/{YEAR}/cruxes/from-issues',
                      json={'title': '무엇을 성과로 볼지 합의가 없다',
                            'issue_ids': made},
                      headers=auth(office))
    assert res.status_code == 201, res.get_json()

    crux = StrategyCrux.query.one()
    assert crux.title == '무엇을 성과로 볼지 합의가 없다'
    # 두 이슈가 같은 사업부면 난제도 그 사업부다.
    assert crux.division_id == world['mx'].id
    assert {i.crux_id for i in StrategyIssue.query.all()} == {crux.id}


def test_사업부가_섞이면_전사_난제가_된다(client, world, office, auth):
    """MX 의 이슈와 VD 의 이슈를 함께 묶었다면 그것은 한 사업부의 문제가 아니다."""
    from app.modules.digital_twin_strategy.models import StrategyCrux

    ids = []
    for division in (world['mx'], world['vd']):
        res = client.post(f'{STRATEGY_BASE}/plans/{YEAR}/issues',
                          json={'title': f'{division.name} 문제',
                                'division_id': division.id},
                          headers=auth(office))
        ids.append(res.get_json()['data']['id'])

    client.post(f'{STRATEGY_BASE}/plans/{YEAR}/cruxes/from-issues',
                json={'title': '전사 공통', 'issue_ids': ids}, headers=auth(office))
    assert StrategyCrux.query.one().division_id is None


def test_남의_전략_이슈는_묶이지_않는다(client, world, office, auth):
    """번호만 보내면 다른 연도의 이슈가 딸려 올 수 있고, 그러면 그 이슈가 두
    전략에 걸친다. **난제도 안 만들어져야 한다** — 반쯤 된 상태가 제일 나쁘다."""
    from app.modules.digital_twin_strategy.models import StrategyCrux, StrategyPlan

    other = StrategyPlan(year=YEAR + 1, title='다음 해')
    _db.session.add(other)
    _db.session.commit()
    res = client.post(f'{STRATEGY_BASE}/plans/{YEAR + 1}/issues',
                      json={'title': '남의 이슈'}, headers=auth(office))
    stranger = res.get_json()['data']['id']

    res = client.post(f'{STRATEGY_BASE}/plans/{YEAR}/cruxes/from-issues',
                      json={'title': '묶기', 'issue_ids': [stranger]},
                      headers=auth(office))
    assert res.status_code == 400
    assert '이 전략의 이슈가 아닙니다' in res.get_json()['message']
    assert StrategyCrux.query.count() == 0


def test_발견_사항_후보를_이슈로_만들_수_있다(client, world, office, auth):
    """⚠️ 실제로 막혀 있었다. 후보는 source_type='finding' 을 달아 보내는데
    이슈 저장 쪽 허용 목록에 그 값이 없어서, 「이슈로」를 누르면
    "알 수 없는 출처입니다: finding" 이 떴다.

    **후보를 내는 쪽과 받는 쪽의 집합이 갈리면 그 후보는 영영 못 쓴다.**
    """
    from app.modules.digital_twin_strategy.models import StrategyIssue

    survey = _survey(world['plan'])
    q = _question(survey, '성과를 재는가', 'organization:return')
    _db.session.commit()
    for division in (world['mx'], world['vd']):
        for _ in range(5):
            _answer(survey, division, {q: 2})
    _db.session.commit()

    data = client.get(f'{STRATEGY_BASE}/plans/{YEAR}',
                      headers=auth(office)).get_json()['data']
    candidate = next(c for c in data['issueCandidates']
                     if c['source_type'] == 'finding')

    res = client.post(f'{STRATEGY_BASE}/plans/{YEAR}/issues', headers=auth(office),
                      json={'title': candidate['title'],
                            'description': candidate['detail'],
                            'division_id': candidate['division_id'],
                            'source_type': candidate['source_type'],
                            'source_ref': candidate['source_ref']})
    assert res.status_code == 201, res.get_json()
    assert StrategyIssue.query.one().source_type == 'finding'


def test_후보의_출처는_전부_이슈로_저장될_수_있다(client, world, office, auth):
    """후보가 내는 source_type 이 저장 쪽 집합 안에 있는지 **전부** 본다.
    한 종류만 확인하면 다음에 늘어난 것이 또 막힌다."""
    from app.modules.digital_twin_strategy.routes import ISSUE_SOURCE_TYPES
    from app.modules.digital_twin_strategy.issues import (
        derive_issue_candidates, derive_survey_candidates,
    )

    findings = [{'key': 'survey_role_gap:role', 'severity': 'high',
                 'title': 'x', 'detail': '', 'division_id': None}]
    produced = {c['source_type'] for c in derive_survey_candidates(findings, set())}
    produced |= {c['source_type'] for c in derive_issue_candidates([], [], [])}
    assert produced <= ISSUE_SOURCE_TYPES, produced - ISSUE_SOURCE_TYPES


def test_후보_여러_개를_한_번에_새_난제로_묶는다(client, world, office, auth):
    """⚠️ 이 길이 없으면 후보를 하나씩 「난제 비움」으로 저장해 고아로 만든 뒤
    다시 골라 묶어야 한다 — 세 건이면 대화상자를 네 번 연다. 같은 일이다.
    """
    from app.modules.digital_twin_strategy.models import StrategyCrux, StrategyIssue

    res = client.post(f'{STRATEGY_BASE}/plans/{YEAR}/cruxes/from-issues',
                      headers=auth(office),
                      json={'title': '성과를 정의하지 않고 일한다',
                            'new_issues': [
                                {'title': 'MX 성과 미정의 70%',
                                 'division_id': world['mx'].id,
                                 'source_type': 'gap', 'source_ref': 'a'},
                                {'title': 'VD 성과 미정의 75%',
                                 'division_id': world['vd'].id,
                                 'source_type': 'gap', 'source_ref': 'b'},
                            ]})
    assert res.status_code == 201, res.get_json()
    data = res.get_json()['data']
    assert len(data['created']) == 2

    crux = StrategyCrux.query.one()
    # 두 사업부를 묶었으니 전사 난제다.
    assert crux.division_id is None
    assert {i.crux_id for i in StrategyIssue.query.all()} == {crux.id}


def test_기존_이슈와_후보를_섞어_묶을_수_있다(client, world, office, auth):
    """고아 이슈 하나와 새 후보 하나가 같은 이야기일 수 있다."""
    from app.modules.digital_twin_strategy.models import StrategyCrux, StrategyIssue

    made = client.post(f'{STRATEGY_BASE}/plans/{YEAR}/issues',
                       json={'title': '이미 적어 둔 것'},
                       headers=auth(office)).get_json()['data']['id']

    res = client.post(f'{STRATEGY_BASE}/plans/{YEAR}/cruxes/from-issues',
                      headers=auth(office),
                      json={'title': '한 이야기', 'issue_ids': [made],
                            'new_issues': [{'title': '후보에서 온 것'}]})
    assert res.status_code == 201, res.get_json()

    crux = StrategyCrux.query.one()
    assert StrategyIssue.query.count() == 2
    assert {i.crux_id for i in StrategyIssue.query.all()} == {crux.id}


def test_후보_하나가_잘못되면_난제도_안_만든다(client, world, office, auth):
    """⚠️ 반쯤 된 상태가 제일 나쁘다. 난제만 만들어지면 빈 난제가 남아
    "넘겠다고 해놓고 아무것도 안 하는" 난제처럼 보인다."""
    from app.modules.digital_twin_strategy.models import StrategyCrux, StrategyIssue

    res = client.post(f'{STRATEGY_BASE}/plans/{YEAR}/cruxes/from-issues',
                      headers=auth(office),
                      json={'title': '묶기', 'new_issues': [
                          {'title': '멀쩡한 것'},
                          {'title': ''},          # 제목이 비었다
                      ]})
    assert res.status_code == 400
    assert '2번째 항목' in res.get_json()['message']
    assert StrategyCrux.query.count() == 0
    assert StrategyIssue.query.count() == 0
