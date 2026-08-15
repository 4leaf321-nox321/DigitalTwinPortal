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
from app.modules.survey.models import (
    Survey, SurveyQuestion, SurveyResponse, SurveyAccessLog,
)

ADMIN_BASE = '/api/surveys/manage'
RESPOND_BASE = '/api/surveys'


@pytest.fixture()
def office(make_user):
    return make_user('office@test.local', UserRole.DT_OFFICE_MEMBER)


@pytest.fixture()
def staff(make_user):
    return make_user('staff@test.local', UserRole.USER, name='홍길동',
                     department='생산기술팀')


def _make_survey(target_type='all', target_refs=None, status='open'):
    survey = Survey(
        title='조직 역량 설문',
        # 설문은 전략에 안 매여도 된다. 여기서는 매달지 않는다 —
        # 그래야 이 모듈이 정말 독립인지 시험이 된다.
        target_type=target_type, target_refs=target_refs or [],
        status=status,
    )
    _db.session.add(survey)
    _db.session.flush()
    _db.session.add(SurveyQuestion(
        survey_id=survey.id, order=0, text='우리 부서의 준비도는?',
        qtype='scale', required=True,
        options={'min': 1, 'max': 5},
        link_type='strategy_dimension', link_key='organization:readiness',
    ))
    _db.session.commit()
    return survey


# ── 권한 ──────────────────────────────────────────────────────────────────

def test_일반_사용자는_설문을_만들_수_없다(client, staff, auth):
    res = client.post(ADMIN_BASE,
                      json={'title': '몰래 만든 설문'}, headers=auth(staff))
    assert res.status_code == 403


def test_사무국은_설문을_만들_수_있다(client, office, auth):
    res = client.post(ADMIN_BASE, json={
        'title': '조직 역량 설문',
        'questions': [{'text': '준비도는?', 'qtype': 'scale',
                       'link_type': 'strategy_dimension',
                       'link_key': 'organization:readiness'}],
    }, headers=auth(office))
    assert res.status_code == 201
    data = res.get_json()['data']
    assert data['status'] == 'draft'          # 만들자마자 배포되지 않는다
    assert len(data['questions']) == 1


def test_대상이_아니면_설문이_보이지_않는다(client, staff, make_user, auth):
    other = make_user('other@test.local', UserRole.USER)
    _make_survey(target_type='user', target_refs=[other.id])

    res = client.get(f'{RESPOND_BASE}/mine', headers=auth(staff))
    assert res.status_code == 200
    assert res.get_json()['data'] == []


def test_대상이_아니면_URL로도_제출할_수_없다(client, staff, make_user, auth):
    """목록에서 가리는 것만으로는 방어가 아니다. 이게 진짜 관문이다."""
    other = make_user('other@test.local', UserRole.USER)
    survey = _make_survey(target_type='user', target_refs=[other.id])
    qid = survey.questions.first().id

    res = client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                      json={'answers': {str(qid): 4}}, headers=auth(staff))
    assert res.status_code == 404             # 존재 자체를 알려주지 않는다
    assert SurveyResponse.query.count() == 0


def test_대상이_아니면_문항도_못_본다(client, staff, make_user, auth):
    other = make_user('other@test.local', UserRole.USER)
    survey = _make_survey(target_type='user', target_refs=[other.id])

    res = client.get(f'{RESPOND_BASE}/{survey.id}/form', headers=auth(staff))
    assert res.status_code == 404


def test_역할로_대상을_지정할_수_있다(client, staff, office, auth):
    _make_survey(target_type='role', target_refs=[UserRole.USER])

    assert len(client.get(f'{RESPOND_BASE}/mine',
                          headers=auth(staff)).get_json()['data']) == 1
    assert client.get(f'{RESPOND_BASE}/mine',
                      headers=auth(office)).get_json()['data'] == []


# ── 상태 ──────────────────────────────────────────────────────────────────

def test_draft_설문에는_응답할_수_없다(client, staff, auth):
    survey = _make_survey(status='draft')
    qid = survey.questions.first().id

    assert client.get(f'{RESPOND_BASE}/mine', headers=auth(staff)).get_json()['data'] == []
    res = client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                      json={'answers': {str(qid): 4}}, headers=auth(staff))
    assert res.status_code == 409


def test_문항_없는_설문은_배포할_수_없다(client, office, auth):
    survey = Survey(title='빈 설문', status='draft')
    _db.session.add(survey)
    _db.session.commit()

    res = client.put(f'{ADMIN_BASE}/{survey.id}/status',
                     json={'status': 'open'}, headers=auth(office))
    assert res.status_code == 400


def test_응답이_있으면_문항을_바꿀_수_없다(client, staff, office, auth):
    survey = _make_survey()
    qid = survey.questions.first().id
    client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                json={'answers': {str(qid): 4}}, headers=auth(staff))

    res = client.put(f'{ADMIN_BASE}/{survey.id}',
                     json={'questions': [{'text': '바뀐 질문', 'qtype': 'scale'}]},
                     headers=auth(office))
    assert res.status_code == 409


# ── 응답 ──────────────────────────────────────────────────────────────────

def test_응답을_제출하면_저장된다(client, staff, auth):
    survey = _make_survey()
    qid = survey.questions.first().id

    res = client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                      json={'answers': {str(qid): 4}}, headers=auth(staff))
    assert res.status_code == 201

    saved = SurveyResponse.query.one()
    assert saved.user_id == staff.id
    assert saved.department_name == '생산기술팀'
    # 개발 DB 처럼 부서→사업부 연결이 없으면 unknown 으로 남아야 한다.
    # 모르는 것을 아무 사업부에나 넣으면 집계가 거짓말을 한다.
    assert saved.division_source == 'unknown'
    assert saved.answers.one().value_number == 4


def test_사업부는_계정에서_정하고_응답자가_보낸_값은_무시한다(client, db, staff, auth):
    """소속은 **계정의 소속그룹**이 정한다. 응답자가 고를 수 있으면 소속이
    자칭이 되어 사업부별 집계가 "이 사업부 사람들"이 아니라 "이 사업부라고 고른
    사람들"이 되고, 익명 설문에서는 남의 사업부로 답을 흘려 넣을 수 있다.

    옛 화면이 브라우저 캐시에 남아 division_id 를 계속 보낼 수 있으므로,
    막지 말고 **버려야** 한다 — 400 을 주면 새 창을 열기 전까지 제출이 안 된다.
    """
    from app.modules.digital_twin_dashboard.models import Department, Division

    division = Division(name='메모리사업부')
    db.session.add(division)
    db.session.flush()
    #  ⚠️ 같은 이름의 비활성 옛 행을 **먼저** 둔다. 사업부가 안 붙은 그 행이
    #     걸리면 실제로는 아는 소속이 미상이 되는데, filter_by(name=...) 뒤에
    #     first() 를 그냥 쓰면 어느 행이 걸리는지가 그때그때 달라진다.
    db.session.add(Department(name='생산기술팀', division_id=None, is_active=False))
    db.session.add(Department(name='  생산기술팀 ', division_id=division.id,
                              is_active=True))
    db.session.commit()

    survey = _make_survey()
    qid = survey.questions.first().id

    res = client.post(
        f'{RESPOND_BASE}/{survey.id}/responses',
        json={'answers': {str(qid): 3}, 'division_id': division.id + 999},
        headers=auth(staff),
    )
    assert res.status_code == 201, res.get_json()

    saved = SurveyResponse.query.one()
    assert saved.division_id == division.id      # 계정에서 유도한 값
    assert saved.division_source == 'profile'

    # 응답 화면도 같은 값을 **읽기 전용으로** 받는다.
    form = client.get(f'{RESPOND_BASE}/{survey.id}/form', headers=auth(staff))
    data = form.get_json()['data']
    assert data['division_id'] == division.id
    assert data['division_name'] == '메모리사업부'
    assert data['division_source'] == 'profile'


def test_한_사람의_응답은_한_벌이고_마감_전엔_고칠_수_있다(client, staff, auth):
    """다시 내면 **갈아끼운다.** 여러 벌 쌓이면 어느 것이 정본인지 갈린다.

    한 번 내면 끝이면 오타 하나에도 손쓸 방법이 없고, 그러면 사람들은 확신이
    설 때까지 안 내고 미루거나 잘못 낸 채로 둔다. 둘 다 응답 품질을 떨어뜨린다.
    """
    survey = _make_survey()
    qid = survey.questions.first().id

    assert client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                       json={'answers': {str(qid): 4}},
                       headers=auth(staff)).status_code == 201
    assert client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                       json={'answers': {str(qid): 2}},
                       headers=auth(staff)).status_code == 201

    assert SurveyResponse.query.count() == 1
    saved = SurveyResponse.query.one()
    assert saved.answers.count() == 1          # 답이 쌓이지 않는다
    assert saved.answers.one().value_number == 2
    first_submitted = saved.submitted_at
    assert first_submitted is not None         # 처음 낸 때가 남는다


def test_마감한_뒤에는_고칠_수_없다(client, staff, office, auth):
    """마감은 '더 안 받는다'는 뜻이다. 그 뒤에 답이 바뀌면 집계가 뒤에서 움직인다."""
    survey = _make_survey()
    qid = survey.questions.first().id
    client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                json={'answers': {str(qid): 4}}, headers=auth(staff))

    client.put(f'{ADMIN_BASE}/{survey.id}/status',
               json={'status': 'closed'}, headers=auth(office))

    res = client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                      json={'answers': {str(qid): 1}}, headers=auth(staff))
    assert res.status_code == 409
    assert SurveyResponse.query.one().answers.one().value_number == 4


def test_이미_낸_답이_폼에_실려_온다(client, staff, auth):
    """안 실어 주면 고치려는 사람이 처음부터 다시 적어야 한다."""
    survey = _make_survey()
    qid = survey.questions.first().id
    client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                json={'answers': {str(qid): 3}}, headers=auth(staff))

    data = client.get(f'{RESPOND_BASE}/{survey.id}/form',
                      headers=auth(staff)).get_json()['data']
    assert data['already_answered'] is True
    assert data['my_answers'] == {str(qid): 3.0}


def test_필수_문항을_비우면_거부된다(client, staff, auth):
    survey = _make_survey()
    res = client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                      json={'answers': {}}, headers=auth(staff))
    assert res.status_code == 400
    assert SurveyResponse.query.count() == 0


def test_답이_일부만_저장되지_않는다(client, staff, auth):
    """알 수 없는 문항이 섞이면 통째로 되돌아가야 한다.

    일부만 저장되면 집계가 조용히 틀어진다 — 그게 가장 잡기 어렵다.
    """
    survey = _make_survey()
    qid = survey.questions.first().id

    res = client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                      json={'answers': {str(qid): 4, '999999': 3}},
                      headers=auth(staff))
    assert res.status_code == 400
    assert SurveyResponse.query.count() == 0


def test_미응답_건수가_홈_배지용으로_나온다(client, staff, auth):
    survey = _make_survey()
    qid = survey.questions.first().id

    res = client.get(f'{RESPOND_BASE}/mine/count', headers=auth(staff))
    assert res.get_json()['data']['pending'] == 1

    client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                json={'answers': {str(qid): 4}}, headers=auth(staff))
    res = client.get(f'{RESPOND_BASE}/mine/count', headers=auth(staff))
    assert res.get_json()['data']['pending'] == 0


# ── 익명성 ────────────────────────────────────────────────────────────────

def test_집계에는_응답자_신원이_없다(client, staff, office, auth):
    """이게 새면 설문 신뢰가 무너지고, 그 뒤로는 어떤 설문도 솔직한 답을 못 받는다."""
    survey = _make_survey()
    qid = survey.questions.first().id
    client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                json={'answers': {str(qid): 4}}, headers=auth(staff))

    res = client.get(f'{ADMIN_BASE}/{survey.id}/results', headers=auth(office))
    assert res.status_code == 200
    body = res.get_data(as_text=True)
    assert str(staff.id) not in body or '"user_id"' not in body
    assert 'user_id' not in body
    assert '홍길동' not in body
    assert 'staff@test.local' not in body


def test_집계에_응답수와_소속미확인이_같이_나온다(client, staff, office, auth):
    """몇 명이 답했는지 모르는 평균은 숫자 구경이다."""
    survey = _make_survey()
    qid = survey.questions.first().id
    client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                json={'answers': {str(qid): 4}}, headers=auth(staff))

    data = client.get(f'{ADMIN_BASE}/{survey.id}/results',
                      headers=auth(office)).get_json()['data']
    assert data['response_count'] == 1
    assert data['target_count'] >= 1
    assert data['unknown_division_count'] == 1     # 숨기지 않는다
    assert data['questions'][0]['average'] == 4.0


def test_관리자가_응답자를_확인하면_감사로그가_남는다(client, staff, office, auth):
    """고지한 대로 남기지 않으면 그 고지는 면피 문구다."""
    survey = _make_survey()
    qid = survey.questions.first().id
    client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                json={'answers': {str(qid): 4}}, headers=auth(staff))

    res = client.get(f'{ADMIN_BASE}/{survey.id}/identities', headers=auth(office))
    assert res.status_code == 200
    assert res.get_json()['data'][0]['user_name'] == '홍길동'

    log = SurveyAccessLog.query.one()
    assert log.viewer_id == office.id
    assert log.action == 'list_identities'


def test_일반_사용자는_응답자를_확인할_수_없다(client, staff, auth):
    survey = _make_survey()
    res = client.get(f'{ADMIN_BASE}/{survey.id}/identities', headers=auth(staff))
    assert res.status_code == 403
    assert SurveyAccessLog.query.count() == 0


def test_로그인하지_않으면_아무것도_못_한다(client, db):
    # db 를 받는 이유는 이 테스트가 쓰지 않아서가 아니라 **치우기 위해서다.**
    # _make_survey() 가 commit 하는데 db 픽스처가 없으면 그 행이 teardown 되지
    # 않고 다음 파일까지 살아남는다. 실제로 test_survey_import.py 가 그 유령
    # 설문 때문에 깨졌다.
    survey = _make_survey()
    assert client.get(f'{RESPOND_BASE}/mine').status_code == 401
    assert client.get(f'{RESPOND_BASE}/{survey.id}/form').status_code == 401
    assert client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                       json={'answers': {}}).status_code == 401


# ── 집계표 내려받기 ────────────────────────────────────────────────────────

def _summary_rows(client, office, auth, survey_id):
    """집계표 CSV 를 받아 행 목록으로. BOM 은 떼고 본다."""
    import csv as _csv
    import io as _io

    res = client.get(f'{ADMIN_BASE}/{survey_id}/export/summary',
                     headers=auth(office))
    assert res.status_code == 200, res.data[:200]
    text = res.data.decode('utf-8-sig')
    return list(_csv.reader(_io.StringIO(text)))


def test_집계표는_객관식을_세고_안_물은_문항을_0으로_찍지_않는다(
        client, db, staff, office, make_user, auth):
    """객관식을 세지 않으면 유형화가 안 되고, '묻지 않음'을 0 으로 찍으면
    아무도 안 답한 것으로 읽힌다. **둘 다 보고서에 그대로 실린다.**
    """
    survey = Survey(title='역할별 설문', target_type='all', status='open',
                    roles=['PL', '과제 참여인력'])
    _db.session.add(survey)
    _db.session.flush()
    common = SurveyQuestion(
        survey_id=survey.id, order=0, text='가장 큰 걸림돌은?',
        qtype='choice', required=True,
        options={'choices': ['데이터 정합성', '기준 불일치', '인력 부족']},
    )
    pl_only = SurveyQuestion(
        survey_id=survey.id, order=1, text='PL 로서 준비도는?',
        qtype='scale', required=True, options={'min': 1, 'max': 5},
        audience_roles=['PL'],
    )
    _db.session.add_all([common, pl_only])
    _db.session.commit()

    other = make_user('member@test.local', UserRole.USER)
    client.post(f'{RESPOND_BASE}/{survey.id}/responses', headers=auth(staff),
                json={'respondent_role': 'PL',
                      'answers': {str(common.id): ['데이터 정합성'],
                                  str(pl_only.id): 4}})
    client.post(f'{RESPOND_BASE}/{survey.id}/responses', headers=auth(other),
                json={'respondent_role': '과제 참여인력',
                      'answers': {str(common.id): ['데이터 정합성']}})

    rows = _summary_rows(client, office, auth, survey.id)
    head = rows.index([r for r in rows if r and r[0] == '섹션'][0])
    cols = {name: i for i, name in enumerate(rows[head])}
    body = [r for r in rows[head + 1:] if r]

    def find(text, kind, value):
        for r in body:
            if (r[cols['문항']] == text and r[cols['구분']] == kind
                    and r[cols['값']] == value):
                return r
        raise AssertionError(f'{text} / {kind} / {value} 줄이 없습니다')

    # 객관식이 세어진다. 두 사람 다 같은 보기를 골랐다.
    assert find('가장 큰 걸림돌은?', '선택지', '데이터 정합성')[cols['응답수']] == '2'
    assert find('가장 큰 걸림돌은?', '선택지', '데이터 정합성')[cols['비율(%)']] == '100.0'
    # 아무도 안 고른 보기도 0 으로 남는다 — 그것도 결과다.
    assert find('가장 큰 걸림돌은?', '선택지', '인력 부족')[cols['응답수']] == '0'

    # ⚠️ 요점. PL 전용 문항은 '과제 참여인력' 에게 **묻지 않았다.**
    #    응답수 0 으로 찍으면 "물었는데 아무도 안 답했다"로 읽힌다.
    not_asked = find('PL 로서 준비도는?', '역할', '과제 참여인력')
    assert not_asked[cols['응답수']] == ''
    assert not_asked[cols['비고']] == '묻지 않음'
    assert find('PL 로서 준비도는?', '역할', 'PL')[cols['응답수']] == '1'


def test_집계표의_숫자는_화면과_같다(client, staff, office, auth):
    """따로 세면 어긋난다. 어긋나는 순간 둘 다 못 믿게 된다."""
    survey = _make_survey()
    qid = survey.questions.first().id
    client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                json={'answers': {str(qid): 4}}, headers=auth(staff))

    screen = client.get(f'{ADMIN_BASE}/{survey.id}/results',
                        headers=auth(office)).get_json()['data']
    rows = _summary_rows(client, office, auth, survey.id)
    head = rows.index([r for r in rows if r and r[0] == '섹션'][0])
    cols = {name: i for i, name in enumerate(rows[head])}
    total = [r for r in rows[head + 1:] if r and r[cols['구분']] == '전체'][0]

    assert total[cols['평균']] == str(screen['questions'][0]['average'])
    assert total[cols['응답수']] == str(screen['questions'][0]['answer_count'])


# ── 잠금과 권한 ────────────────────────────────────────────────────────────
#
# 여기 넷은 전부 **한 번씩 실제로 뚫려 있던 것**이다. 화면에서는 멀쩡해 보이고
# 사고가 난 뒤에야 드러나는 종류라, 재현 테스트로 박아 둔다.

@pytest.fixture()
def boss(make_user):
    return make_user('boss@test.local', UserRole.MANAGER)


def test_manager도_설문을_관리할_수_있다(client, boss, auth):
    """roles.py 는 manager 를 '사업부 사무국'으로 인정하는데 관리 화면은 403 을
    줬다. 역할은 붙여 주면서 그 역할로 할 일은 못 하게 하는 상태였다."""
    assert client.get(ADMIN_BASE, headers=auth(boss)).status_code == 200


def test_응답이_있는_설문은_삭제되지_않는다(client, staff, office, auth):
    """문항 한 줄은 잠가 놓고 설문 통째로는 지워졌다. 지우면 응답과 함께
    **열람 기록까지** 사라진다 — '관리자가 열람하면 기록이 남습니다'라고
    고지해 놓고 그 기록을 지우는 버튼이 관리자에게 있었던 셈이다."""
    survey = _make_survey()
    qid = survey.questions.first().id
    client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                json={'answers': {str(qid): 4}}, headers=auth(staff))
    client.get(f'{ADMIN_BASE}/{survey.id}/identities', headers=auth(office))

    res = client.delete(f'{ADMIN_BASE}/{survey.id}', headers=auth(office))
    assert res.status_code == 409
    assert SurveyResponse.query.count() == 1
    assert SurveyAccessLog.query.count() == 1


def test_응답이_있으면_역할_목록에서_뺄_수_없고_더할_수는_있다(
        client, staff, office, auth):
    """'PL'로 답한 응답이 있는데 목록에서 PL 을 빼면, 그 응답은 집계에서 갈 곳을
    잃고 그 역할인 사람은 그 순간부터 제출도 못 한다. 더하는 것은 막지 않는다 —
    전용 문항이 없는 역할을 뒤늦게 넣어야 그 사람이 답할 수 있다."""
    survey = Survey(title='역할 설문', target_type='all', status='open',
                    roles=['PL', '과제 참여인력'])
    _db.session.add(survey)
    _db.session.flush()
    _db.session.add(SurveyQuestion(survey_id=survey.id, order=0, text='준비도는?',
                                   qtype='scale', required=True,
                                   options={'min': 1, 'max': 5}))
    _db.session.commit()
    qid = survey.questions.first().id
    client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                json={'respondent_role': 'PL', 'answers': {str(qid): 4}},
                headers=auth(staff))

    narrow = client.put(f'{ADMIN_BASE}/{survey.id}',
                        json={'roles': ['과제 참여인력']}, headers=auth(office))
    assert narrow.status_code == 409
    assert Survey.query.get(survey.id).roles == ['PL', '과제 참여인력']

    wider = client.put(f'{ADMIN_BASE}/{survey.id}',
                       json={'roles': ['PL', '과제 참여인력', '사무국장']},
                       headers=auth(office))
    assert wider.status_code == 200


def test_보기에_없는_답은_저장되지_않는다(client, staff, auth):
    """화면은 버튼만 주지만 서버는 아무 문자열이나 받아 저장했다. 그 답은
    집계에서 **새 선택지**가 되어 나타나고, 객관식으로 물은 이유가 사라진다."""
    survey = Survey(title='객관식 설문', target_type='all', status='open')
    _db.session.add(survey)
    _db.session.flush()
    q = SurveyQuestion(survey_id=survey.id, order=0, text='가장 큰 걸림돌은?',
                       qtype='choice', required=True,
                       options={'choices': ['데이터 정합성', '기준 불일치']})
    _db.session.add(q)
    _db.session.commit()

    bad = client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                      json={'answers': {str(q.id): '아무말이나'}},
                      headers=auth(staff))
    assert bad.status_code == 400
    assert '보기에 없는 답' in bad.get_json()['message']
    assert SurveyResponse.query.count() == 0

    ok = client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                     json={'answers': {str(q.id): '데이터 정합성'}},
                     headers=auth(staff))
    assert ok.status_code == 201


def test_척도에_소수를_넣을_수_없다(client, staff, auth):
    """평균은 3.7 로 오르는데 분포 막대는 int() 로 '3점'에 선다. 같은 화면의 두
    숫자가 다른 이야기를 하게 된다."""
    survey = _make_survey()
    qid = survey.questions.first().id
    res = client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                      json={'answers': {str(qid): 3.7}}, headers=auth(staff))
    assert res.status_code == 400
    assert '정수' in res.get_json()['message']
