"""설문 API 테스트.

**권한과 익명성부터 본다.** 이 두 가지는 틀려도 화면에서는 멀쩡해 보이고,
사고가 난 뒤에야 드러난다.

  · 대상자가 아닌 사람이 URL 로 직접 제출할 수 있는가
  · 응답자 신원이 일반 열람에 섞여 나가는가

계획서: frontend/src/modules/digital-twin-strategy/SURVEY_PLAN.md
"""
import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_strategy.models import (
    StrategyPlan, StrategySurvey, StrategySurveyQuestion,
    StrategySurveyResponse, StrategySurveyAccessLog,
)

ADMIN_BASE = '/api/digital-twin-strategy'
RESPOND_BASE = '/api/surveys'


@pytest.fixture()
def plan(db):
    row = StrategyPlan(year=2099, title='시험용 전략')
    db.session.add(row)
    db.session.commit()
    return row


@pytest.fixture()
def office(make_user):
    return make_user('office@test.local', UserRole.DT_OFFICE_MEMBER)


@pytest.fixture()
def staff(make_user):
    return make_user('staff@test.local', UserRole.USER, name='홍길동',
                     department='생산기술팀')


def _make_survey(plan, target_type='all', target_refs=None, status='open'):
    survey = StrategySurvey(
        plan_id=plan.id, title='조직 역량 설문',
        target_type=target_type, target_refs=target_refs or [],
        status=status,
    )
    _db.session.add(survey)
    _db.session.flush()
    _db.session.add(StrategySurveyQuestion(
        survey_id=survey.id, order=0, text='우리 부서의 준비도는?',
        qtype='scale', required=True,
        options={'min': 1, 'max': 5},
        link_category='organization', link_dimension='readiness',
    ))
    _db.session.commit()
    return survey


# ── 권한 ──────────────────────────────────────────────────────────────────

def test_일반_사용자는_설문을_만들_수_없다(client, plan, staff, auth):
    res = client.post(f'{ADMIN_BASE}/plans/{plan.year}/surveys',
                      json={'title': '몰래 만든 설문'}, headers=auth(staff))
    assert res.status_code == 403


def test_사무국은_설문을_만들_수_있다(client, plan, office, auth):
    res = client.post(f'{ADMIN_BASE}/plans/{plan.year}/surveys', json={
        'title': '조직 역량 설문',
        'questions': [{'text': '준비도는?', 'qtype': 'scale',
                       'link_category': 'organization',
                       'link_dimension': 'readiness'}],
    }, headers=auth(office))
    assert res.status_code == 201
    data = res.get_json()['data']
    assert data['status'] == 'draft'          # 만들자마자 배포되지 않는다
    assert len(data['questions']) == 1


def test_대상이_아니면_설문이_보이지_않는다(client, plan, staff, make_user, auth):
    other = make_user('other@test.local', UserRole.USER)
    _make_survey(plan, target_type='user', target_refs=[other.id])

    res = client.get(f'{RESPOND_BASE}/mine', headers=auth(staff))
    assert res.status_code == 200
    assert res.get_json()['data'] == []


def test_대상이_아니면_URL로도_제출할_수_없다(client, plan, staff, make_user, auth):
    """목록에서 가리는 것만으로는 방어가 아니다. 이게 진짜 관문이다."""
    other = make_user('other@test.local', UserRole.USER)
    survey = _make_survey(plan, target_type='user', target_refs=[other.id])
    qid = survey.questions.first().id

    res = client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                      json={'answers': {str(qid): 4}}, headers=auth(staff))
    assert res.status_code == 404             # 존재 자체를 알려주지 않는다
    assert StrategySurveyResponse.query.count() == 0


def test_대상이_아니면_문항도_못_본다(client, plan, staff, make_user, auth):
    other = make_user('other@test.local', UserRole.USER)
    survey = _make_survey(plan, target_type='user', target_refs=[other.id])

    res = client.get(f'{RESPOND_BASE}/{survey.id}/form', headers=auth(staff))
    assert res.status_code == 404


def test_역할로_대상을_지정할_수_있다(client, plan, staff, office, auth):
    _make_survey(plan, target_type='role', target_refs=[UserRole.USER])

    assert len(client.get(f'{RESPOND_BASE}/mine',
                          headers=auth(staff)).get_json()['data']) == 1
    assert client.get(f'{RESPOND_BASE}/mine',
                      headers=auth(office)).get_json()['data'] == []


# ── 상태 ──────────────────────────────────────────────────────────────────

def test_draft_설문에는_응답할_수_없다(client, plan, staff, auth):
    survey = _make_survey(plan, status='draft')
    qid = survey.questions.first().id

    assert client.get(f'{RESPOND_BASE}/mine', headers=auth(staff)).get_json()['data'] == []
    res = client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                      json={'answers': {str(qid): 4}}, headers=auth(staff))
    assert res.status_code == 409


def test_문항_없는_설문은_배포할_수_없다(client, plan, office, auth):
    survey = StrategySurvey(plan_id=plan.id, title='빈 설문', status='draft')
    _db.session.add(survey)
    _db.session.commit()

    res = client.put(f'{ADMIN_BASE}/surveys/{survey.id}/status',
                     json={'status': 'open'}, headers=auth(office))
    assert res.status_code == 400


def test_응답이_있으면_문항을_바꿀_수_없다(client, plan, staff, office, auth):
    survey = _make_survey(plan)
    qid = survey.questions.first().id
    client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                json={'answers': {str(qid): 4}}, headers=auth(staff))

    res = client.put(f'{ADMIN_BASE}/surveys/{survey.id}',
                     json={'questions': [{'text': '바뀐 질문', 'qtype': 'scale'}]},
                     headers=auth(office))
    assert res.status_code == 409


# ── 응답 ──────────────────────────────────────────────────────────────────

def test_응답을_제출하면_저장된다(client, plan, staff, auth):
    survey = _make_survey(plan)
    qid = survey.questions.first().id

    res = client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                      json={'answers': {str(qid): 4}}, headers=auth(staff))
    assert res.status_code == 201

    saved = StrategySurveyResponse.query.one()
    assert saved.user_id == staff.id
    assert saved.department_name == '생산기술팀'
    # 개발 DB 처럼 부서→사업부 연결이 없으면 unknown 으로 남아야 한다.
    # 모르는 것을 아무 사업부에나 넣으면 집계가 거짓말을 한다.
    assert saved.division_source == 'unknown'
    assert saved.answers.one().value_number == 4


def test_한_사람은_한_번만_응답할_수_있다(client, plan, staff, auth):
    survey = _make_survey(plan)
    qid = survey.questions.first().id
    body = {'answers': {str(qid): 4}}

    assert client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                       json=body, headers=auth(staff)).status_code == 201
    assert client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                       json=body, headers=auth(staff)).status_code == 409
    assert StrategySurveyResponse.query.count() == 1


def test_필수_문항을_비우면_거부된다(client, plan, staff, auth):
    survey = _make_survey(plan)
    res = client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                      json={'answers': {}}, headers=auth(staff))
    assert res.status_code == 400
    assert StrategySurveyResponse.query.count() == 0


def test_답이_일부만_저장되지_않는다(client, plan, staff, auth):
    """알 수 없는 문항이 섞이면 통째로 되돌아가야 한다.

    일부만 저장되면 집계가 조용히 틀어진다 — 그게 가장 잡기 어렵다.
    """
    survey = _make_survey(plan)
    qid = survey.questions.first().id

    res = client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                      json={'answers': {str(qid): 4, '999999': 3}},
                      headers=auth(staff))
    assert res.status_code == 400
    assert StrategySurveyResponse.query.count() == 0


def test_미응답_건수가_홈_배지용으로_나온다(client, plan, staff, auth):
    survey = _make_survey(plan)
    qid = survey.questions.first().id

    res = client.get(f'{RESPOND_BASE}/mine/count', headers=auth(staff))
    assert res.get_json()['data']['pending'] == 1

    client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                json={'answers': {str(qid): 4}}, headers=auth(staff))
    res = client.get(f'{RESPOND_BASE}/mine/count', headers=auth(staff))
    assert res.get_json()['data']['pending'] == 0


# ── 익명성 ────────────────────────────────────────────────────────────────

def test_집계에는_응답자_신원이_없다(client, plan, staff, office, auth):
    """이게 새면 설문 신뢰가 무너지고, 그 뒤로는 어떤 설문도 솔직한 답을 못 받는다."""
    survey = _make_survey(plan)
    qid = survey.questions.first().id
    client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                json={'answers': {str(qid): 4}}, headers=auth(staff))

    res = client.get(f'{ADMIN_BASE}/surveys/{survey.id}/results', headers=auth(office))
    assert res.status_code == 200
    body = res.get_data(as_text=True)
    assert str(staff.id) not in body or '"user_id"' not in body
    assert 'user_id' not in body
    assert '홍길동' not in body
    assert 'staff@test.local' not in body


def test_집계에_응답수와_소속미확인이_같이_나온다(client, plan, staff, office, auth):
    """몇 명이 답했는지 모르는 평균은 숫자 구경이다."""
    survey = _make_survey(plan)
    qid = survey.questions.first().id
    client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                json={'answers': {str(qid): 4}}, headers=auth(staff))

    data = client.get(f'{ADMIN_BASE}/surveys/{survey.id}/results',
                      headers=auth(office)).get_json()['data']
    assert data['response_count'] == 1
    assert data['target_count'] >= 1
    assert data['unknown_division_count'] == 1     # 숨기지 않는다
    assert data['questions'][0]['average'] == 4.0


def test_관리자가_응답자를_확인하면_감사로그가_남는다(client, plan, staff, office, auth):
    """고지한 대로 남기지 않으면 그 고지는 면피 문구다."""
    survey = _make_survey(plan)
    qid = survey.questions.first().id
    client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                json={'answers': {str(qid): 4}}, headers=auth(staff))

    res = client.get(f'{ADMIN_BASE}/surveys/{survey.id}/identities', headers=auth(office))
    assert res.status_code == 200
    assert res.get_json()['data'][0]['user_name'] == '홍길동'

    log = StrategySurveyAccessLog.query.one()
    assert log.viewer_id == office.id
    assert log.action == 'list_identities'


def test_일반_사용자는_응답자를_확인할_수_없다(client, plan, staff, auth):
    survey = _make_survey(plan)
    res = client.get(f'{ADMIN_BASE}/surveys/{survey.id}/identities', headers=auth(staff))
    assert res.status_code == 403
    assert StrategySurveyAccessLog.query.count() == 0


def test_로그인하지_않으면_아무것도_못_한다(client, plan):
    survey = _make_survey(plan)
    assert client.get(f'{RESPOND_BASE}/mine').status_code == 401
    assert client.get(f'{RESPOND_BASE}/{survey.id}/form').status_code == 401
    assert client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                       json={'answers': {}}).status_code == 401
