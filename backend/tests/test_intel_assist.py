"""사내 LLM 이 낸 제안을 **실재하는 것에만** 맞춘다.

왜 이 시험이 있나
    MCP 로 소식이 쌓여도 「그래서 우리한테 뭔데」에 답하는 것이 없으면 이 모듈은
    여전히 바깥 소식 게시판이다. 그래서 LLM 이 **우리 과제·KPI 와의 연결 후보**를 낸다.

⚠️⚠️ **모델은 그럴듯한 uuid 를 지어낸다.** 그것을 그대로 보여 주면 사용자가 없는
   과제부터 의심하게 되고, **맞는 제안까지 같이 못 믿는다.** 그래서 `_resolve` 가
   후보 목록에 실제로 있는 것만 통과시킨다. 이 파일이 지키는 것이 그 문이다.

⚠️ 제안은 **저장하지 않는다.** 사람이 고른 것만 `dt_intel_links` 에 들어간다.
   자동으로 걸면 근거 없는 연결이 쌓이고, 그러면 연결 자체를 아무도 안 믿게 된다.
"""
from app.modules.digital_twin_intel import assist
from app.modules.digital_twin_intel.models import CPT_KEYS

SECTORS = ['시뮬레이션·해석', '데이터·연결', 'AI', '플랫폼', '표준화']

PROJECTS = [
    {'uuid': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'title': 'MX 해석 자동화', 'division': 'MX'},
    {'uuid': 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'title': 'VD 설계 검증', 'division': 'VD'},
]
KPIS = [
    {'id': 1, 'label': '가상 검증률', 'category': '개발'},
    {'id': 2, 'label': 'One Time Pass율', 'category': '품질'},
]


def _resolve(raw):
    return assist._resolve(raw, PROJECTS, KPIS, SECTORS)


def test_지어낸_과제는_버린다():
    """**이 파일의 핵심.** 없는 과제를 보여 주면 목록 전체의 신뢰가 무너진다."""
    out = _resolve({'projects': [
        {'uuid': '00000000-0000-0000-0000-000000000000', 'why': '지어낸 것'},
        {'uuid': PROJECTS[0]['uuid'], 'why': '진짜'},
    ]})
    assert [p['uuid'] for p in out['projects']] == [PROJECTS[0]['uuid']]
    assert out['dropped'], '버렸으면 왜 버렸는지 남아야 한다'


def test_지어낸_지표도_버린다():
    out = _resolve({'kpis': [{'id': 999999, 'why': '없음'}, {'id': 2, 'why': '있음'}]})
    assert [k['id'] for k in out['kpis']] == [2]
    assert any('999999' in d for d in out['dropped'])


def test_맞는_것은_이름까지_붙여_돌려준다():
    """
    ⚠️ 버리는 쪽만 시험하면 **아무것도 안 통과시켜도 초록**이다. 받아들이는 길을
       함께 봐야 한다 — 실제로 그 실수를 했다(스텁 정규식에 `re.M` 이 빠져 후보를
       하나도 못 골랐는데 시험은 통과했다, 2026-08-25).
    """
    out = _resolve({'projects': [{'uuid': PROJECTS[1]['uuid'], 'why': '설계 쪽'}],
                    'kpis': [{'id': 1, 'why': '검증률'}]})
    assert out['projects'][0]['title'] == 'VD 설계 검증'
    assert out['projects'][0]['division'] == 'VD'
    assert out['projects'][0]['why'] == '설계 쪽'
    assert out['kpis'][0]['label'] == '가상 검증률'
    assert out['dropped'] == []


def test_없는_분류는_안_쓴다():
    """부채꼴에 없는 값을 그냥 두면 **레이더에 빈 칸이 하나 생긴다.**"""
    out = _resolve({'category': '텔레파시'})
    assert out['category'] is None
    assert any('텔레파시' in d for d in out['dropped'])


def test_있는_분류는_쓴다():
    assert _resolve({'category': 'AI'})['category'] == 'AI'


def test_CPT_는_정해진_값만():
    """외부 표준이라 값이 고정이다. 자유 입력을 허용하면 업계 기준과 대조가 안 된다."""
    out = _resolve({'cpt': ['Integration', '아무거나', 'Intelligence', 'Integration']})
    assert out['cpt'] == ['Integration', 'Intelligence'], '모르는 값·중복이 남았다'
    for c in out['cpt']:
        assert c in CPT_KEYS


def test_제안_개수를_제한한다():
    """
    다섯을 넘기면 사람이 안 읽는다. 안 읽는 제안은 없는 것과 같고, 길면 **틀린 것이
    섞여 있어도 눈에 안 띈다.**
    """
    many = [{'uuid': PROJECTS[0]['uuid'], 'why': str(i)} for i in range(20)]
    assert len(_resolve({'projects': many})['projects']) <= assist.MAX_SUGGEST


def test_빈_답도_터지지_않는다():
    """모델이 아무것도 못 찾는 것은 **정상**이다. 억지로 채우는 것보다 낫다."""
    out = _resolve({})
    assert out['projects'] == [] and out['kpis'] == []
    assert out['summary'] is None


def test_이상한_모양은_건너뛴다():
    """리스트 안에 문자열이 오는 등. 여기서 터지면 제안 전체가 실패한다."""
    out = _resolve({'projects': ['그냥 문자열', None, {'uuid': PROJECTS[0]['uuid']}],
                    'kpis': [42, {'id': 1}]})
    assert len(out['projects']) == 1
    assert len(out['kpis']) == 1


def test_모델_답에서_JSON_을_건진다():
    """코드펜스ㆍ앞뒤 설명이 붙어도 건져야 한다. 못 건지면 기능이 통째로 죽는다."""
    assert assist._json_from('{"a": 1}') == {'a': 1}
    assert assist._json_from('```json\n{"a": 2}\n```') == {'a': 2}
    assert assist._json_from('네, 이렇게요:\n{"a": 3}\n도움이 되었길.') == {'a': 3}
    assert assist._json_from('') is None
    assert assist._json_from('그냥 문장입니다') is None


def test_모르는_종류는_거절한다(db, make_user):
    """
    ⚠️ **입력 검사가 LLM 확인보다 먼저 와야 한다.** 순서가 반대면 잘못된 `kind` 를
       보냈는데 「LLM 서버가 없다」고 답하고, 부르는 쪽이 엉뚱한 곳을 고치게 된다.

    ⚠️ 이 시험은 **LLM 설정이 없어도 통과해야 한다.** 개발 PC 는 `.env` 에 주소가
       있고 CI 는 없다 — 설정에 매인 시험은 **로컬만 초록**이 된다(2026-08-25 실제로
       그랬다. 같은 부류를 `DT2_WRITE_ENABLED` 로 한 번 겪고도 또 했다).
    """
    from app.modules.auth.models import UserRole
    u = make_user('assist-kind@test.local', UserRole.ADMIN)
    out, err = assist.suggest(u, 'ostrich', 'x-y-z')
    assert out is None and 'news' in err
