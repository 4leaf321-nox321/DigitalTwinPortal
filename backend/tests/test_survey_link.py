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
YEAR = 2026


@pytest.fixture()
def office(make_user):
    return make_user('office@test.local', UserRole.DT_OFFICE_MEMBER)


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
    assert 'survey_role_gap' in found
    assert '역할·책임' in found['survey_role_gap']['title']


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
    assert 'survey_universal_low' in found
    assert found['survey_universal_low']['division_id'] is None   # 전사 하나로
    assert found['survey_universal_low']['severity'] == 'high'


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
    assert 'survey_division_gap' in found
    assert 'MX' in found['survey_division_gap']['title']


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

    found = _findings(client, office, auth)
    assert 'survey_choice_top' in found
    assert '데이터 정합성' in found['survey_choice_top']['title']


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

    candidates = {c['source_ref']: c for c in data['issueCandidates']}
    assert 'survey_universal_low' in candidates
    assert candidates['survey_universal_low']['source_type'] == 'finding'
    assert candidates['survey_universal_low']['group'] == '설문'


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
                      'source_finding': 'survey_universal_low'},
                headers=auth(office))

    data = client.get(f'{STRATEGY_BASE}/plans/{YEAR}',
                      headers=auth(office)).get_json()['data']
    refs = {c['source_ref'] for c in data['issueCandidates']}
    assert 'survey_universal_low' not in refs


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
