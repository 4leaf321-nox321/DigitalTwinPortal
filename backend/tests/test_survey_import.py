"""표 일괄 입력과 역할·프로세스 분기 테스트.

── 무엇을 지키나 ──────────────────────────────────────────────────────────
**운영 서버에서는 코드를 못 고친다.** 그래서 표를 붙여넣으면 설문이 통째로
만들어져야 한다. 그 경로가 조용히 틀리면 아무도 못 고친다 — 그래서 여기서
막는다.

  · 오류난 표로 **반쯤 만들어진 설문**이 남지 않는가
  · 오류 메시지에 **행 번호**가 있는가 (없으면 수십 행짜리 표를 못 고친다)
  · 빈 audience 가 **전원**으로 읽히는가 (아무도로 읽히면 설문이 죽는다)
  · 다른 역할의 필수 문항이 내 제출을 막지 않는가

계획서: frontend/src/modules/digital-twin-strategy/SURVEY_PLAN.md
"""
import csv
import io

import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.survey.importer import parse_table
from app.modules.survey.models import Survey, SurveyAnswer, SurveyResponse

ADMIN_BASE = '/api/surveys/manage'
RESPOND_BASE = '/api/surveys'


@pytest.fixture()
def office(make_user):
    return make_user('office@test.local', UserRole.DT_OFFICE_MEMBER)


@pytest.fixture()
def staff(make_user):
    return make_user('staff@test.local', UserRole.USER, name='홍길동',
                     department='생산기술팀')


@pytest.fixture()
def staff2(make_user):
    return make_user('staff2@test.local', UserRole.USER, name='김철수',
                     department='설계팀')


# ── 표 ────────────────────────────────────────────────────────────────────
#
# 운영에서 AI 가 만들어 줄 표의 모양 그대로다. 열 순서가 고정이고 첫 행은 머리글.
HEADER = ['섹션', '역할', '프로세스', '문항', '유형', '보기', '필수', '도움말', '연결키']
TABLE_ROWS = [
    HEADER,
    # 도움말에 일부러 쉼표를 넣는다 — CSV 로 붙여넣을 때 따옴표 처리가 되는지
    # 같이 시험하기 위해서다. 이게 깨지면 열이 통째로 밀린다.
    ['공통', '', '', '디지털 전환 준비도는?', '척도', '', '예',
     '1: 낮음, 5: 높음', 'organization:readiness'],
    ['', '', '', '가장 큰 걸림돌은?', '서술', '', '아니오', '', ''],
    ['역할별', 'PL', '', 'PL 로서 리소스는 충분한가?', '척도', '', '예', '', ''],
    ['', '과제 참여인력', '', '맡은 과제의 목표가 분명한가?', '척도', '', 'Y', '', ''],
    ['프로세스별', '', '개발', '개발 단계에서 쓰는 도구는?', '객관식',
     'CATIA|NX|기타', '예', '', ''],
]


def _tsv(rows):
    """엑셀에서 복사한 모양."""
    return '\n'.join('\t'.join(cell for cell in row) for row in rows)


def _csv(rows):
    """CSV 로 붙여넣은 모양. 쉼표가 든 칸은 csv 모듈이 따옴표로 감싼다."""
    buf = io.StringIO()
    csv.writer(buf, lineterminator='\n').writerows(rows)
    return buf.getvalue()


# ══ 파서 (DB 가 필요 없다) ═════════════════════════════════════════════════

def test_탭_구분과_쉼표_구분이_같게_읽힌다():
    """엑셀 복사(탭)와 CSV 는 **같은 결과**여야 한다.

    다르게 읽히면, 붙여넣는 방법에 따라 설문이 달라진다. 그걸 알아채는 방법이
    없다 — 둘 다 오류 없이 통과해 버리기 때문이다.
    """
    from_tab = parse_table(_tsv(TABLE_ROWS))
    from_comma = parse_table(_csv(TABLE_ROWS))

    assert from_tab['rows'] == from_comma['rows']
    assert from_tab['error_count'] == 0
    # 쉼표가 든 도움말이 두 칸으로 쪼개지지 않았다.
    assert from_comma['rows'][0]['help_text'] == '1: 낮음, 5: 높음'


def test_섹션이_비면_직전_행을_잇는다():
    """엑셀에서 셀을 병합해 쓰는 습관을 그대로 받는다."""
    rows = parse_table(_tsv(TABLE_ROWS))['rows']
    assert [r['section'] for r in rows] == [
        '공통', '공통', '역할별', '역할별', '프로세스별',
    ]


def test_역할과_프로세스가_비면_전원이_본다():
    """⚠️ 빈 칸의 뜻은 '전원'이다.

    '아무도'로 읽으면 임포트 한 번 잘못해서 아무도 답 못 하는 설문이 만들어지고,
    그걸 눈치채는 데 며칠 걸린다.
    """
    rows = parse_table(_tsv(TABLE_ROWS))['rows']
    assert rows[0]['roles'] == [] and rows[0]['processes'] == []
    assert rows[2]['roles'] == ['PL']
    assert rows[4]['processes'] == ['개발']


def test_표에_나온_역할과_프로세스가_모인다():
    result = parse_table(_tsv(TABLE_ROWS))
    assert result['roles'] == ['PL', '과제 참여인력']      # 등장 순서
    assert result['processes'] == ['개발']


def test_보기_없는_객관식은_행_번호와_함께_오류다():
    """보기 없는 객관식은 응답 화면에서 막다른 길이다 — 고를 것이 없다.

    그리고 **행 번호가 없으면 수십 행짜리 표를 고칠 수 없다.**
    """
    rows = list(TABLE_ROWS)
    rows.append(['기타', '', '', '어떤 도구를 쓰나?', '객관식', '', '예', '', ''])
    result = parse_table(_tsv(rows))

    assert result['error_count'] == 1
    bad = result['rows'][-1]
    assert bad['line'] == 7                       # 머리글 포함 7번째 줄
    assert any('7행' in m for m in bad['errors'])
    assert any('보기' in m for m in bad['errors'])


def test_척도에_보기가_붙으면_오류다():
    """경고가 아니라 오류다. 사람이 열을 밀려 쓴 것이라, 그대로 저장하면
    응답 화면이 엉뚱하게 그려진다."""
    rows = [HEADER, ['공통', '', '', '준비도는?', '척도', '높음|낮음', '예', '', '']]
    result = parse_table(_tsv(rows))
    assert result['error_count'] == 1
    assert any('2행' in m for m in result['rows'][0]['errors'])


def test_모르는_유형은_조용한_기본값_대신_오류다():
    """'척도형'은 척도가 아니다.

    눈치껏 받아주면 열을 잘못 쓴 표까지 통과한다. 조용한 기본값은 나중에 왜
    이렇게 됐는지 못 찾는다.
    """
    rows = [HEADER, ['공통', '', '', '준비도는?', '척도형', '', '예', '', '']]
    result = parse_table(_tsv(rows))
    assert result['error_count'] == 1
    assert any('척도형' in m for m in result['rows'][0]['errors'])


def test_필수_표기를_한글_영문_숫자로_받는다():
    rows = [HEADER]
    for token in ['예', 'Y', 'true', '1', '']:
        rows.append(['공통', '', '', f'{token} 문항', '서술', '', token, '', ''])
    for token in ['아니오', 'N', 'false', '0']:
        rows.append(['공통', '', '', f'{token} 문항', '서술', '', token, '', ''])
    result = parse_table(_tsv(rows))

    assert result['error_count'] == 0
    assert [r['required'] for r in result['rows']] == [True] * 5 + [False] * 4


def test_모르는_필수_표기는_오류다():
    rows = [HEADER, ['공통', '', '', '준비도는?', '서술', '', '글쎄요', '', '']]
    result = parse_table(_tsv(rows))
    assert result['error_count'] == 1
    assert any('2행' in m for m in result['rows'][0]['errors'])


def test_빈_줄은_건너뛴다():
    text = _tsv(TABLE_ROWS).replace('\n', '\n\n')
    assert parse_table(text)['ok_count'] == len(TABLE_ROWS) - 1


# ══ 임포트 API ═════════════════════════════════════════════════════════════

def test_일반_사용자는_표를_넣을_수_없다(client, staff, auth):
    res = client.post(f'{ADMIN_BASE}/import',
                      json={'title': '몰래', 'text': _tsv(TABLE_ROWS)},
                      headers=auth(staff))
    assert res.status_code == 403
    assert Survey.query.count() == 0


def test_미리보기는_아무것도_저장하지_않는다(client, office, auth):
    """미리보기가 저장까지 하면, 확인하려고 눌렀을 뿐인데 설문이 생긴다."""
    res = client.post(f'{ADMIN_BASE}/import/preview',
                      json={'text': _tsv(TABLE_ROWS)}, headers=auth(office))
    assert res.status_code == 200
    data = res.get_json()['data']
    assert data['ok_count'] == 5 and data['error_count'] == 0
    assert data['roles'] == ['PL', '과제 참여인력']
    assert Survey.query.count() == 0          # ← 요점


def test_표에서_설문이_통째로_만들어진다(client, office, auth):
    res = client.post(f'{ADMIN_BASE}/import', json={
        'title': '2026 디지털 전환 진단', 'text': _tsv(TABLE_ROWS),
    }, headers=auth(office))
    assert res.status_code == 201

    data = res.get_json()['data']
    assert data['status'] == 'draft'           # 만들자마자 배포되지 않는다
    assert data['roles'] == ['PL', '과제 참여인력']
    assert data['processes'] == ['개발']
    assert len(data['questions']) == 5

    first, choice = data['questions'][0], data['questions'][4]
    assert first['section'] == '공통'
    assert first['audience_roles'] == []       # 빈 배열 = 전원
    assert first['link_key'] == 'organization:readiness'
    assert choice['qtype'] == 'choice'
    assert choice['options']['choices'] == ['CATIA', 'NX', '기타']
    assert data['questions'][2]['audience_roles'] == ['PL']


def test_오류가_하나라도_있으면_설문이_안_만들어진다(client, office, auth):
    """⚠️ 반쯤 만들어진 설문이 남는 것이 가장 나쁘다.

    목록에는 보이는데 문항이 빠져 있고, 고치려고 보면 그 사이 누가 답해 버려
    문항이 잠겨 있다.
    """
    rows = list(TABLE_ROWS)
    rows.append(['기타', '', '', '어떤 도구를 쓰나?', '객관식', '', '예', '', ''])

    res = client.post(f'{ADMIN_BASE}/import',
                      json={'title': '깨진 표', 'text': _tsv(rows)},
                      headers=auth(office))
    assert res.status_code == 400
    assert any('7행' in m for m in res.get_json()['errors'])
    assert Survey.query.count() == 0           # ← 요점: 하나도 안 남는다


# ══ 역할·프로세스 분기 ═════════════════════════════════════════════════════

def _import_and_open(client, office, auth, rows=None, title='분기 설문'):
    """표로 설문을 만들고 배포까지 한다."""
    res = client.post(f'{ADMIN_BASE}/import',
                      json={'title': title, 'text': _tsv(rows or TABLE_ROWS)},
                      headers=auth(office))
    assert res.status_code == 201, res.get_json()
    survey_id = res.get_json()['data']['id']
    assert client.put(f'{ADMIN_BASE}/{survey_id}/status',
                      json={'status': 'open'},
                      headers=auth(office)).status_code == 200
    return survey_id


def test_문항은_걸러지지_않고_통째로_내려간다(client, office, staff, auth):
    """⚠️ 서버가 미리 거르면 응답자가 역할을 바꿀 때마다 다시 불러야 하고,
    그 사이 적어 둔 답이 날아간다. **거르는 것은 화면, 검증은 서버**다."""
    survey_id = _import_and_open(client, office, auth)

    data = client.get(f'{RESPOND_BASE}/{survey_id}/form',
                      headers=auth(staff)).get_json()['data']
    assert len(data['questions']) == 5                 # 하나도 안 걸렀다
    assert data['roles'] == ['PL', '과제 참여인력']         # 물을 선택지가 같이 온다
    assert data['processes'] == ['개발']
    assert data['questions'][2]['audience_roles'] == ['PL']


def test_다른_역할의_필수_문항이_제출을_막지_않는다(client, office, staff, auth):
    """PL 용 필수 문항 때문에 과제 참여인력가 영영 제출을 못 하면 안 된다.

    화면에는 안 보이는 문항을 서버가 요구하는 꼴이라, 사용자는 왜 막혔는지
    알 방법조차 없다.
    """
    survey_id = _import_and_open(client, office, auth)
    data = client.get(f'{RESPOND_BASE}/{survey_id}/form',
                      headers=auth(staff)).get_json()['data']
    qs = {q['text']: q['id'] for q in data['questions']}

    res = client.post(f'{RESPOND_BASE}/{survey_id}/responses', json={
        'respondent_role': '과제 참여인력',
        'respondent_process': '개발',
        'answers': {
            str(qs['디지털 전환 준비도는?']): 4,
            str(qs['맡은 과제의 목표가 분명한가?']): 5,
            str(qs['개발 단계에서 쓰는 도구는?']): 'CATIA',
            # 'PL 로서 리소스는 충분한가?' 는 필수지만 내 역할이 아니다.
        },
    }, headers=auth(staff))

    assert res.status_code == 201, res.get_json()
    saved = SurveyResponse.query.one()
    assert saved.respondent_role == '과제 참여인력'
    assert saved.respondent_process == '개발'


def test_내_역할의_필수_문항은_여전히_요구된다(client, office, staff, auth):
    """분기를 붙였다고 필수 검증이 헐거워지면 안 된다."""
    survey_id = _import_and_open(client, office, auth)
    data = client.get(f'{RESPOND_BASE}/{survey_id}/form',
                      headers=auth(staff)).get_json()['data']
    qs = {q['text']: q['id'] for q in data['questions']}

    res = client.post(f'{RESPOND_BASE}/{survey_id}/responses', json={
        'respondent_role': 'PL', 'respondent_process': '개발',
        'answers': {
            str(qs['디지털 전환 준비도는?']): 4,
            str(qs['개발 단계에서 쓰는 도구는?']): 'NX',
            # 'PL 로서 리소스는 충분한가?' 가 빠졌다 — 내 역할의 필수 문항이다.
        },
    }, headers=auth(staff))
    assert res.status_code == 400
    assert SurveyResponse.query.count() == 0


def test_빈_답은_필수를_통과하지_못한다(client, office, staff, auth):
    """`null`·`""` 로 채워 보내는 것은 답한 것이 아니다.

    통과시키면 value_number 가 None 인 채로 저장돼, **제출은 됐는데 집계
    분모에는 없는** 답이 된다. 그게 제일 잡기 어렵다.
    """
    survey_id = _import_and_open(client, office, auth)
    data = client.get(f'{RESPOND_BASE}/{survey_id}/form',
                      headers=auth(staff)).get_json()['data']
    qs = {q['text']: q['id'] for q in data['questions']}

    res = client.post(f'{RESPOND_BASE}/{survey_id}/responses', json={
        'respondent_role': 'PL', 'respondent_process': '개발',
        'answers': {
            str(qs['디지털 전환 준비도는?']): None,
            str(qs['PL 로서 리소스는 충분한가?']): 3,
            str(qs['개발 단계에서 쓰는 도구는?']): '',
        },
    }, headers=auth(staff))
    assert res.status_code == 400
    assert SurveyResponse.query.count() == 0


def test_해당_없는_문항의_답은_조용히_버려진다(client, office, staff, auth):
    """화면에서 역할을 바꾸면 앞서 적은 답이 남아 있을 수 있다.

    그걸 400 으로 막으면 사용자는 이유를 모른 채 제출이 안 된다. 버리되
    저장하지는 않는다 — 남기면 그 역할이 답한 적 없는 문항에 답이 생긴다.
    """
    survey_id = _import_and_open(client, office, auth)
    data = client.get(f'{RESPOND_BASE}/{survey_id}/form',
                      headers=auth(staff)).get_json()['data']
    qs = {q['text']: q['id'] for q in data['questions']}
    stale = qs['PL 로서 리소스는 충분한가?']

    res = client.post(f'{RESPOND_BASE}/{survey_id}/responses', json={
        'respondent_role': '과제 참여인력', 'respondent_process': '개발',
        'answers': {
            str(qs['디지털 전환 준비도는?']): 4,
            str(qs['맡은 과제의 목표가 분명한가?']): 5,
            str(qs['개발 단계에서 쓰는 도구는?']): 'CATIA',
            str(stale): 2,                       # ← PL 문항. 나는 과제 참여인력다.
        },
    }, headers=auth(staff))

    assert res.status_code == 201                # 오류가 아니다
    assert SurveyAnswer.query.filter_by(question_id=stale).count() == 0


def test_모르는_역할은_거부된다(client, office, staff, auth):
    """오타 하나로 필수 검증이 통째로 사라지면 안 된다.

    아무 문자열이나 받아주면 그 값에 걸린 문항이 전부 '해당 없음'이 된다.
    """
    survey_id = _import_and_open(client, office, auth)
    res = client.post(f'{RESPOND_BASE}/{survey_id}/responses', json={
        'respondent_role': 'PL님', 'respondent_process': '개발', 'answers': {},
    }, headers=auth(staff))
    assert res.status_code == 400
    assert SurveyResponse.query.count() == 0


def test_역할을_묻는_설문에서_안_고르면_거부된다(client, office, staff, auth):
    """안 고르는 것만으로 역할별 필수 문항을 통째로 건너뛸 수 있으면 안 된다."""
    survey_id = _import_and_open(client, office, auth)
    res = client.post(f'{RESPOND_BASE}/{survey_id}/responses',
                      json={'answers': {}}, headers=auth(staff))
    assert res.status_code == 400
    assert SurveyResponse.query.count() == 0


def test_아무도_못_보는_문항이_있으면_배포가_막힌다(client, office, auth):
    """역할 이름이 어긋나면 그 문항은 조용히 없는 것이 된다.

    응답이 들어온 뒤에는 문항이 잠겨 못 고친다. 그래서 배포 직전에 막는다 —
    그 전이면 표를 고쳐 다시 넣으면 그만이다.
    """
    res = client.post(f'{ADMIN_BASE}/import', json={
        'title': '어긋난 설문', 'text': _tsv(TABLE_ROWS),
        # 표에는 PL 문항이 있는데 설문은 그 역할을 안 묻는다.
        # (오타 이름은 이제 임포트에서 막히므로 — 아래 테스트 참고 —
        #  '아무도 못 보는 문항'은 이렇게 **목록에서 빠뜨렸을 때** 생긴다.)
        'roles': ['과제 참여인력'],
    }, headers=auth(office))
    assert res.status_code == 201
    survey_id = res.get_json()['data']['id']

    res = client.put(f'{ADMIN_BASE}/{survey_id}/status',
                     json={'status': 'open'}, headers=auth(office))
    assert res.status_code == 400
    assert 'PL 로서 리소스는 충분한가?' in res.get_json()['message']
    assert Survey.query.get(survey_id).status == 'draft'


def test_축을_안_묻는_설문은_역할_없이도_제출된다(client, office, staff, auth):
    """역할 칸이 빈 표로 만든 설문은 예전처럼 그냥 답하면 된다."""
    rows = [HEADER, ['공통', '', '', '준비도는?', '척도', '', '예', '', '']]
    survey_id = _import_and_open(client, office, auth, rows, title='축 없는 설문')

    data = client.get(f'{RESPOND_BASE}/{survey_id}/form',
                      headers=auth(staff)).get_json()['data']
    assert data['roles'] == [] and data['processes'] == []

    qid = data['questions'][0]['id']
    res = client.post(f'{RESPOND_BASE}/{survey_id}/responses',
                      json={'answers': {str(qid): 4}}, headers=auth(staff))
    assert res.status_code == 201
    assert SurveyResponse.query.one().respondent_role is None


# ══ 집계 ═══════════════════════════════════════════════════════════════════

def test_집계가_역할별로_갈린다(client, office, staff, staff2, auth):
    survey_id = _import_and_open(client, office, auth)
    data = client.get(f'{RESPOND_BASE}/{survey_id}/form',
                      headers=auth(staff)).get_json()['data']
    qs = {q['text']: q['id'] for q in data['questions']}
    common = qs['디지털 전환 준비도는?']

    client.post(f'{RESPOND_BASE}/{survey_id}/responses', json={
        'respondent_role': 'PL', 'respondent_process': '개발',
        'answers': {str(common): 2,
                    str(qs['PL 로서 리소스는 충분한가?']): 2,
                    str(qs['개발 단계에서 쓰는 도구는?']): 'NX'},
    }, headers=auth(staff))
    client.post(f'{RESPOND_BASE}/{survey_id}/responses', json={
        'respondent_role': '과제 참여인력', 'respondent_process': '개발',
        'answers': {str(common): 4,
                    str(qs['맡은 과제의 목표가 분명한가?']): 5,
                    str(qs['개발 단계에서 쓰는 도구는?']): 'CATIA'},
    }, headers=auth(staff2))

    body = client.get(f'{ADMIN_BASE}/{survey_id}/results',
                      headers=auth(office)).get_json()['data']

    # 기존 필드는 그대로 있어야 한다 — 화면이 쓰고 있다.
    assert body['response_count'] == 2
    assert body['questions'][0]['average'] == 3.0        # (2 + 4) / 2
    assert body['questions'][0]['section'] == '공통'

    by_role = body['by_role']
    assert set(by_role) == {'PL', '과제 참여인력'}
    assert by_role['PL']['count'] == 1
    assert by_role['PL']['questions'][str(common)]['average'] == 2.0
    assert by_role['과제 참여인력']['questions'][str(common)]['average'] == 4.0
    # 역할별 칸에는 원문을 싣지 않는다 — 한 명까지 좁혀지면 기명이 된다.
    assert 'values' not in by_role['PL']['questions'][str(common)]

    assert body['by_process']['개발']['count'] == 2


def test_역할을_안_고른_응답은_미지정으로_따로_센다(client, office, staff, auth):
    """⚠️ 조용히 아무 역할에나 넣으면 그 역할의 평균이 거짓말을 한다."""
    rows = [HEADER, ['공통', '', '', '준비도는?', '척도', '', '예', '', '']]
    survey_id = _import_and_open(client, office, auth, rows, title='축 없는 설문')
    qid = Survey.query.get(survey_id).questions.first().id

    client.post(f'{RESPOND_BASE}/{survey_id}/responses',
                json={'answers': {str(qid): 4}}, headers=auth(staff))

    body = client.get(f'{ADMIN_BASE}/{survey_id}/results',
                      headers=auth(office)).get_json()['data']
    assert body['by_role'] == {'미지정': {'count': 1, 'questions': {
        str(qid): {'answer_count': 1, 'average': 4.0, 'distribution': {'4': 1}},
    }}}


def test_역할별_집계에도_신원이_없다(client, office, staff, auth):
    """축을 하나 늘렸다고 신원이 새면 안 된다."""
    survey_id = _import_and_open(client, office, auth)
    qid = Survey.query.get(survey_id).questions.first().id
    client.post(f'{RESPOND_BASE}/{survey_id}/responses', json={
        'respondent_role': 'PL', 'respondent_process': '개발',
        'answers': {str(qid): 4,
                    str(Survey.query.get(survey_id).questions.all()[2].id): 3,
                    str(Survey.query.get(survey_id).questions.all()[4].id): 'NX'},
    }, headers=auth(staff))

    body = client.get(f'{ADMIN_BASE}/{survey_id}/results',
                      headers=auth(office)).get_data(as_text=True)
    assert 'user_id' not in body
    assert '홍길동' not in body
    assert 'staff@test.local' not in body
    assert '생산기술팀' not in body      # 부서 + 역할이면 사람이 좁혀진다


def test_기존_설문은_그대로_동작한다(client, office, staff, auth):
    """빈 audience 를 '아무도'로 읽으면 옛 설문이 통째로 죽는다.

    마이그레이션으로 칸만 붙은 문항은 audience 가 비어 있다. 그게 전원이라야
    지금까지 돌던 설문이 계속 돈다.
    """
    survey = Survey(title='옛 설문', target_type='all', status='open')
    _db.session.add(survey)
    _db.session.flush()
    from app.modules.survey.models import SurveyQuestion
    _db.session.add(SurveyQuestion(survey_id=survey.id, order=0,
                                   text='준비도는?', qtype='scale', required=True,
                                   options={'min': 1, 'max': 5}))
    _db.session.commit()
    qid = survey.questions.first().id

    res = client.post(f'{RESPOND_BASE}/{survey.id}/responses',
                      json={'answers': {str(qid): 4}}, headers=auth(staff))
    assert res.status_code == 201


# ══ 기존 설문에 문항 덧붙이기 ═══════════════════════════════════════════════
#
# ── 무엇을 지키나 ──────────────────────────────────────────────────────────
# 운영에서 AI 로 역할별 표를 **여러 벌** 만들어 온다. 첫 표로 설문을 만든 뒤
# 나머지를 같은 설문에 이어 붙이지 못하면, 붙여넣을 때마다 설문이 하나씩 더
# 생긴다. 그래서 `/import` 가 survey_id 를 받는다.
#
#   · 덧붙이기가 **기존 문항을 지우지 않는가** (지우는 길과 더하는 길이 섞이면
#     "제목만 고쳤는데 문항이 사라졌다"가 난다. 응답이 들어오면 못 되돌린다)
#   · order 가 **기존 뒤로** 이어지는가 (0 부터 다시 매기면 순서가 섞인다)
#   · 축이 **합집합으로 넓어지는가** (좁히면 그 역할로 답한 응답이 갈 곳을 잃는다)
#   · 오류난 표가 **한 문항도** 덧붙이지 않는가

EXTRA_ROWS = [
    HEADER,
    ['품질', '사업부 사무국', '품질', '검사 데이터는 자동으로 쌓이나?', '척도', '',
     '예', '', 'organization:readiness'],
    ['품질', '사업부 사무국', '품질', '불량 원인을 어디서 보나?', '객관식',
     'MES|엑셀|기타', '아니오', '', ''],
]


def _import_new(client, office, auth, rows=None, title='덧붙이기 설문', **extra):
    """표로 설문을 새로 만들고 그 응답 본문을 돌려준다."""
    res = client.post(
        f'{ADMIN_BASE}/import',
        json={'title': title, 'text': _tsv(rows or TABLE_ROWS), **extra},
        headers=auth(office),
    )
    assert res.status_code == 201, res.get_json()
    return res.get_json()['data']


def _append(client, office, auth, survey_id, rows=None, **extra):
    return client.post(
        f'{ADMIN_BASE}/import',
        json={'survey_id': survey_id, 'text': _tsv(rows or EXTRA_ROWS), **extra},
        headers=auth(office),
    )


def test_덧붙이면_기존_문항이_남고_뒤에_붙는다(client, office, auth):
    """⚠️ 요점은 **기존 문항이 하나도 안 사라지는 것**이다.

    문항을 통째로 지우고 다시 만드는 길(_replace_questions)을 덧붙이기에
    그대로 쓰면, 두 번째 표를 넣는 순간 첫 표의 문항이 전부 없어진다.
    그리고 order 를 0 부터 다시 매기면 새 문항이 옛 문항 사이에 끼어든다.
    """
    survey = _import_new(client, office, auth)
    res = _append(client, office, auth, survey['id'])
    assert res.status_code == 200, res.get_json()

    data = res.get_json()['data']
    assert data['id'] == survey['id']            # 새 설문이 아니라 그 설문이다
    assert Survey.query.count() == 1             # 하나 더 생기지 않았다
    # 몇 개가 붙었는지 화면이 바로 말할 수 있어야 한다 — 수십 문항을 사람이
    # 세지는 않는다.
    assert data['appended_count'] == 2 and data['question_count'] == 7

    questions = data['questions']
    assert len(questions) == 7                   # 5 + 2
    assert [q['order'] for q in questions] == [0, 1, 2, 3, 4, 5, 6]
    assert [q['text'] for q in questions[:5]] == \
        [q['text'] for q in survey['questions']]  # 앞의 5개는 그대로
    assert questions[5]['text'] == '검사 데이터는 자동으로 쌓이나?'
    assert questions[5]['section'] == '품질'
    assert questions[5]['audience_roles'] == ['사업부 사무국']
    assert questions[6]['options']['choices'] == ['MES', '엑셀', '기타']
    assert questions[6]['required'] is False

    assert Survey.query.get(survey['id']).questions.count() == 7


def test_덧붙이면_축이_합집합으로_넓어진다(client, office, auth):
    """⚠️ **좁히지 않는다.**

    이미 그 역할로 답한 사람이 있을 수 있고, 목록에서 빼면 그 응답은 집계에서
    갈 곳을 잃는다. 그리고 전용 문항이 없는 역할(사무국장)은 표의 역할 열에
    아예 안 나타나는데, 표에서 유도만 하면 그 사람은 역할을 못 골라 제출 자체가
    막힌다.
    """
    survey = _import_new(client, office, auth,
                         roles=['PL', '과제 참여인력'])
    assert survey['roles'] == ['PL', '과제 참여인력']

    # 덧붙이는 표에는 '사업부 사무국'이 나오고, payload 로 '사무국장'을 따로
    # 명시한다. 사무국장은 전용 문항이 없어 표에는 안 나타나는 역할이다.
    res = _append(client, office, auth, survey['id'], roles=['사무국장'])
    assert res.status_code == 200, res.get_json()

    data = res.get_json()['data']
    # 기존 → 표 → payload 순으로 이어 붙는다. 기존 것이 안 사라지는 것이 요점.
    assert data['roles'] == ['PL', '과제 참여인력', '사업부 사무국', '사무국장']
    assert data['processes'] == ['개발', '품질']


def test_덧붙인_뒤에도_배포가_막히지_않는다(client, office, auth):
    """축을 안 넓히면 덧붙인 문항이 아무에게도 안 보여 배포가 막힌다.

    그 상태를 알아차리는 곳은 배포 직전 검사뿐인데, 거기서 막히면 사무국은
    왜 막혔는지 모른 채 설문을 다시 만든다.
    """
    survey = _import_new(client, office, auth)
    assert _append(client, office, auth, survey['id']).status_code == 200

    res = client.put(f'{ADMIN_BASE}/{survey["id"]}/status',
                     json={'status': 'open'}, headers=auth(office))
    assert res.status_code == 200, res.get_json()


def test_응답이_있으면_덧붙일_수_없다(client, office, staff, auth):
    """⚠️ 받는 도중에 문항이 늘면 먼저 답한 사람과 나중에 답한 사람이
    **서로 다른 설문에 답한 것**이 된다. 문항 수정을 막는 것과 같은 이유다."""
    survey_id = _import_and_open(client, office, auth)
    form = client.get(f'{RESPOND_BASE}/{survey_id}/form',
                      headers=auth(staff)).get_json()['data']
    qs = {q['text']: q['id'] for q in form['questions']}
    assert client.post(f'{RESPOND_BASE}/{survey_id}/responses', json={
        'respondent_role': 'PL', 'respondent_process': '개발',
        'answers': {str(qs['디지털 전환 준비도는?']): 4,
                    str(qs['PL 로서 리소스는 충분한가?']): 3,
                    str(qs['개발 단계에서 쓰는 도구는?']): 'NX'},
    }, headers=auth(staff)).status_code == 201

    res = _append(client, office, auth, survey_id)
    assert res.status_code == 409
    # 왜 막혔는지 메시지에 있어야 한다 — 없으면 사무국은 다시 시도만 한다.
    assert '응답' in res.get_json()['message']
    assert Survey.query.get(survey_id).questions.count() == 5     # 그대로다


def test_없는_설문에_덧붙이면_404다(client, office, auth):
    """⚠️ 못 찾았다고 **새로 만들어 버리면 안 된다.**

    id 를 잘못 적은 사람은 덧붙였다고 믿는데, 실제로는 반쪽짜리 설문이 하나
    더 생겨 있다. 그걸 알아채는 것은 응답이 갈린 뒤다.
    """
    res = _append(client, office, auth, 999999)
    assert res.status_code == 404
    assert Survey.query.count() == 0


def test_오류난_표는_한_문항도_덧붙이지_않는다(client, office, auth):
    """오류가 한 줄이라도 있으면 아무것도 덧붙이지 않는다.

    절반만 붙으면 어디까지 들어갔는지 알 수 없어, 표를 고쳐 다시 넣으면
    앞부분이 중복된다.
    """
    survey = _import_new(client, office, auth)
    rows = list(EXTRA_ROWS)
    rows.append(['품질', '', '', '어떤 도구를 쓰나?', '객관식', '', '예', '', ''])

    res = _append(client, office, auth, survey['id'], rows=rows)
    assert res.status_code == 400
    assert any('4행' in m for m in res.get_json()['errors'])
    assert Survey.query.get(survey['id']).questions.count() == 5   # ← 요점


def test_덧붙이기는_제목과_대상을_바꾸지_않는다(client, office, auth):
    """덧붙이기는 문항을 더하는 일이지 설문을 다시 정의하는 일이 아니다.

    두 번째 표를 넣다가 제목이나 대상이 바뀌면, 이미 배포된 설문이 다른
    사람들에게 가 버린다.
    """
    survey = _import_new(client, office, auth, title='원래 제목')
    res = _append(client, office, auth, survey['id'],
                  title='엉뚱한 제목', description='엉뚱한 설명',
                  target_type='department', target_refs=['설계팀'])
    assert res.status_code == 200, res.get_json()

    saved = Survey.query.get(survey['id'])
    assert saved.title == '원래 제목'
    assert saved.description is None
    assert saved.target_type == 'all' and saved.target_refs == []


def test_미리보기는_survey_id_를_줘도_저장하지_않는다(client, office, auth):
    """확인하려고 눌렀을 뿐인데 문항이 늘어나면 안 된다."""
    survey = _import_new(client, office, auth)
    res = client.post(f'{ADMIN_BASE}/import/preview',
                      json={'survey_id': survey['id'], 'text': _tsv(EXTRA_ROWS)},
                      headers=auth(office))
    assert res.status_code == 200
    assert res.get_json()['data']['ok_count'] == 2
    assert Survey.query.get(survey['id']).questions.count() == 5


def test_survey_id_없이_부르면_예전처럼_새_설문이_만들어진다(client, office, auth):
    """회귀 방지. 덧붙이기를 붙였다고 기존 경로가 달라지면 안 된다."""
    first = _import_new(client, office, auth, title='첫 설문')
    second = _import_new(client, office, auth, rows=EXTRA_ROWS, title='둘째 설문')

    assert first['id'] != second['id']
    assert Survey.query.count() == 2
    assert len(first['questions']) == 5
    assert len(second['questions']) == 2
    assert [q['order'] for q in second['questions']] == [0, 1]


def test_모르는_역할_이름은_임포트에서_막힌다(client, office, auth):
    """역할·프로세스는 **서버가 아는 값만** 쓴다.

    자유 텍스트로 두면 오타 하나로 'PL'과 'PL(과제리더)'가 다른 대상이 되어 그
    문항이 아무에게도 안 보이고, 응답자는 자기 역할을 마음대로 고를 수 있어
    역할별 집계가 의미를 잃는다. 배포 직전 검사보다 **여기서 막는 편**이 낫다 —
    표를 고쳐 다시 넣으면 그만인 시점이기 때문이다.
    """
    res = client.post(f'{ADMIN_BASE}/import', json={
        'title': '오타 설문', 'text': _tsv(TABLE_ROWS),
        'roles': ['PL(과제리더)'],
    }, headers=auth(office))
    assert res.status_code == 400
    assert 'PL(과제리더)' in res.get_json()['message']
    assert Survey.query.count() == 0


def test_모르는_프로세스는_임포트에서_막힌다(client, office, auth):
    """프로세스 목록은 대시보드 마스터(process_categories)가 정본이다."""
    rows = [HEADER, ['프로세스별', '', '설계', '문항', '척도', '', '예', '', '']]
    res = client.post(f'{ADMIN_BASE}/import', json={
        'title': '없는 프로세스', 'text': _tsv(rows),
    }, headers=auth(office))
    assert res.status_code == 400
    assert '설계' in res.get_json()['message']
    assert Survey.query.count() == 0


def test_모르는_연결키는_몇번_문항인지_말하고_거절한다(client, office, auth):
    """연결키는 손으로 타이핑하는 값이라 오타가 난다. 그대로 받으면 그 문항은
    **연결이 안 붙은 채로 저장**되고, 그 사실은 진단을 만들 때가 되어서야
    드러난다 — 그때는 응답이 들어와 문항이 잠겨서 못 고친다.

    역할·프로세스를 목록으로만 받는 것과 같은 이유다(LINK_PLAN 0단계).
    """
    rows = [
        HEADER,
        ['공통', '', '', '준비도는?', '척도', '', '예', '', 'organization:readiness'],
        ['공통', '', '', '역할이 분명한가?', '척도', '', '예', '', 'organizaton:role'],
    ]
    res = client.post(f'{ADMIN_BASE}/import',
                      json={'title': '연결키 설문', 'text': _tsv(rows)},
                      headers=auth(office))
    assert res.status_code == 400
    message = res.get_json()['message']
    assert '2번 문항' in message          # 어느 문항인지 말해 준다
    assert 'organizaton:role' in message  # 무엇이 문제인지도
    # ⚠️ 요점. 한 줄이 틀리면 **한 문항도** 만들지 않는다.
    assert Survey.query.count() == 0


def test_연결_종류는_키마다_따로_정해진다(client, office, auth):
    """예전에는 화면이 표 전체를 보고 정했다 — 연결키 하나가 이상하면 **전부**
    연결이 NULL 로 저장되고 화면은 아무 말도 안 했다."""
    rows = [
        HEADER,
        ['공통', '', '', '준비도는?', '척도', '', '예', '', 'organization:readiness'],
        ['공통', '', '', '그냥 묻는 것', '척도', '', '예', '', ''],
    ]
    res = client.post(f'{ADMIN_BASE}/import',
                      json={'title': '연결 설문', 'text': _tsv(rows)},
                      headers=auth(office))
    assert res.status_code == 201, res.get_json()
    questions = res.get_json()['data']['questions']
    assert questions[0]['link_type'] == 'strategy_dimension'
    assert questions[0]['link_key'] == 'organization:readiness'
    # 연결키가 없는 문항에는 종류도 안 붙는다. 가리키는 것이 없는 종류 이름은
    # 나중에 읽는 쪽을 헷갈리게 한다.
    assert questions[1]['link_type'] is None
