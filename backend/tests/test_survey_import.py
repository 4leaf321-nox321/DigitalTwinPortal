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
    ['', '과제 멤버', '', '맡은 과제의 목표가 분명한가?', '척도', '', 'Y', '', ''],
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
    assert result['roles'] == ['PL', '과제 멤버']      # 등장 순서
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
    assert data['roles'] == ['PL', '과제 멤버']
    assert Survey.query.count() == 0          # ← 요점


def test_표에서_설문이_통째로_만들어진다(client, office, auth):
    res = client.post(f'{ADMIN_BASE}/import', json={
        'title': '2026 디지털 전환 진단', 'text': _tsv(TABLE_ROWS),
    }, headers=auth(office))
    assert res.status_code == 201

    data = res.get_json()['data']
    assert data['status'] == 'draft'           # 만들자마자 배포되지 않는다
    assert data['roles'] == ['PL', '과제 멤버']
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
    assert data['roles'] == ['PL', '과제 멤버']         # 물을 선택지가 같이 온다
    assert data['processes'] == ['개발']
    assert data['questions'][2]['audience_roles'] == ['PL']


def test_다른_역할의_필수_문항이_제출을_막지_않는다(client, office, staff, auth):
    """PL 용 필수 문항 때문에 과제 멤버가 영영 제출을 못 하면 안 된다.

    화면에는 안 보이는 문항을 서버가 요구하는 꼴이라, 사용자는 왜 막혔는지
    알 방법조차 없다.
    """
    survey_id = _import_and_open(client, office, auth)
    data = client.get(f'{RESPOND_BASE}/{survey_id}/form',
                      headers=auth(staff)).get_json()['data']
    qs = {q['text']: q['id'] for q in data['questions']}

    res = client.post(f'{RESPOND_BASE}/{survey_id}/responses', json={
        'respondent_role': '과제 멤버',
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
    assert saved.respondent_role == '과제 멤버'
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
        'respondent_role': '과제 멤버', 'respondent_process': '개발',
        'answers': {
            str(qs['디지털 전환 준비도는?']): 4,
            str(qs['맡은 과제의 목표가 분명한가?']): 5,
            str(qs['개발 단계에서 쓰는 도구는?']): 'CATIA',
            str(stale): 2,                       # ← PL 문항. 나는 과제 멤버다.
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
        # 표에는 'PL'·'과제 멤버'가 있는데 설문은 다른 이름만 묻는다.
        'roles': ['PL(과제리더)', '과제 멤버'],
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
        'respondent_role': '과제 멤버', 'respondent_process': '개발',
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
    assert set(by_role) == {'PL', '과제 멤버'}
    assert by_role['PL']['count'] == 1
    assert by_role['PL']['questions'][str(common)]['average'] == 2.0
    assert by_role['과제 멤버']['questions'][str(common)]['average'] == 4.0
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
