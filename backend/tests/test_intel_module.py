"""디지털 트윈 기술정보 — 소식과 기술 레이더.

이 시험이 지키는 것 셋

⚠️ **① 권한이 서버에 있다.** 2026-08-25 조사에서 쓰기 라우트가 있는 21개 모듈 중
   9개가 `@jwt_required()` 만 걸고 있었다(쓰기 95개). 막는 것이 `ProtectedRoute`
   뿐이면 그건 브라우저 안의 일이라 **토큰만 있으면 누구나 직접 부른다** — MCP 용
   PAT 도 유효한 토큰이다. 이 모듈은 거기 끼지 않는다.

⚠️ **② 레이더가 소식의 부산물로 채워진다.** `tech_radar`·`tech_archive`·
   `digital_twin_solution` 이 전부 껍데기로 죽어 있다. 기술 목록이 **아무의 일도
   아니어서**다. 그래서 소식을 넣을 때 그 자리에서 기술이 만들어지고 이어져야 한다.
   이 성질이 깨지면 이 모듈도 넷째 껍데기가 된다.

⚠️ **③ 레이더가 자기 노후를 스스로 말한다.** 앞선 셋은 낡아도 낡은 줄 몰랐다 —
   표는 늘 그럴듯해 보인다.
"""
from datetime import datetime, timedelta

import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_intel import services as S
from app.modules.digital_twin_intel.models import IntelEvidence, IntelNews, IntelTech

BASE = '/api/digital-twin-intel'


@pytest.fixture()
def admin(make_user):
    return make_user('intel-admin@test.local', UserRole.ADMIN)


@pytest.fixture()
def office(make_user):
    return make_user('intel-office@test.local', UserRole.DT_OFFICE_MEMBER)


@pytest.fixture()
def plain(make_user):
    return make_user('intel-plain@test.local', UserRole.USER)


def _news(client, auth, user, **over):
    body = {'title': 'NVIDIA, Omniverse 에 실시간 물리 해석 추가',
            'source': 'NVIDIA 블로그', 'url': 'https://example.test/ov-physics',
            'publishedAt': '2026-08-01', 'category': '기술 발표'}
    body.update(over)
    return client.post(f'{BASE}/news', json=body, headers=auth(user))


# ── ① 권한 ───────────────────────────────────────────────────────────────────

def test_로그인_없이는_못_본다(db, client):
    r = client.get(f'{BASE}/news')
    assert r.status_code == 401, f'{r.status_code} · {r.get_json()}'


def test_일반_사용자도_소식을_넣을_수_있다(db, client, auth, plain):
    """
    ⚠️ **넣는 문은 넓게 연다.** 조사해 온 사람을 막으면 아무도 안 넣고, 안 넣으면
       앞선 셋처럼 죽는다. 이 모듈의 값은 많이 쌓이는 데서 온다.
    """
    r = _news(client, auth, plain)
    assert r.status_code == 201, f'{r.status_code} · {r.get_json()}'


def test_일반_사용자는_레이더_단계를_못_바꾼다(db, client, auth, plain, admin):
    """
    ⚠️ 단계는 개인 의견이 아니라 **조직이 어디까지 왔는지의 표기**다. 아무나 바꾸면
       아무도 그 표기를 안 믿게 되고, 안 믿는 표기는 없는 것과 같다.
    """
    tech, err = S.create_tech(actor_id=admin.id, name='Omniverse')
    assert err is None, err

    r = client.put(f'{BASE}/tech/{tech.uuid}/stage',
                   json={'stage': '도입'}, headers=auth(plain))
    assert r.status_code == 403, f'{r.status_code} · {r.get_json()}'

    _db.session.expire_all()
    assert IntelTech.query.filter_by(uuid=tech.uuid).first().stage == '관찰'


def test_사무국은_단계를_바꿀_수_있다(db, client, auth, office, admin):
    tech, _ = S.create_tech(actor_id=admin.id, name='Omniverse')
    r = client.put(f'{BASE}/tech/{tech.uuid}/stage',
                   json={'stage': '시험'}, headers=auth(office))
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'
    assert (r.get_json() or {}).get('data', {}).get('stage') == '시험'


def test_일반_사용자는_못_지운다(db, client, auth, plain, admin):
    tech, _ = S.create_tech(actor_id=admin.id, name='Omniverse')
    r = client.delete(f'{BASE}/tech/{tech.uuid}', headers=auth(plain))
    assert r.status_code == 403, f'{r.status_code} · {r.get_json()}'
    assert IntelTech.query.filter_by(uuid=tech.uuid).first() is not None


def test_일반_수정_길로는_단계가_안_바뀐다(db, client, auth, plain, admin):
    """
    ⚠️ 좁혀 둔 권한이 **다른 문으로 새면** 좁힌 의미가 없다. PATCH 는 누구나
       쓸 수 있으므로 여기서 stage 를 받으면 안 된다.
    """
    tech, _ = S.create_tech(actor_id=admin.id, name='Omniverse')
    r = client.patch(f'{BASE}/tech/{tech.uuid}',
                     json={'stage': '도입', 'summary': '설명만 고침'},
                     headers=auth(plain))
    assert r.status_code == 400, f'{r.status_code} · {r.get_json()}'

    _db.session.expire_all()
    assert IntelTech.query.filter_by(uuid=tech.uuid).first().stage == '관찰'


def test_보류로_옮길_때는_이유가_필요하다(db, client, auth, admin):
    """
    ⚠️ **안 쓰기로 한 판단이야말로 근거가 남아야 한다.** 안 남기면 6개월 뒤 같은
       논의를 처음부터 다시 하고, 그때 아무도 지난번에 왜 접었는지 모른다.
    """
    tech, _ = S.create_tech(actor_id=admin.id, name='Omniverse')
    r = client.put(f'{BASE}/tech/{tech.uuid}/stage',
                   json={'stage': '보류'}, headers=auth(admin))
    assert r.status_code == 400, f'{r.status_code} · {r.get_json()}'
    assert '이유' in (r.get_json() or {}).get('message', '')

    r2 = client.put(f'{BASE}/tech/{tech.uuid}/stage',
                    json={'stage': '보류', 'reason': '라이선스 비용이 과제 예산을 넘는다'},
                    headers=auth(admin))
    assert r2.status_code == 200, f'{r2.status_code} · {r2.get_json()}'


# ── ② 레이더는 소식의 부산물로 채워진다 ──────────────────────────────────────

def test_소식을_넣으면_기술이_생긴다(db, client, auth, plain):
    """**이 모듈이 살아남는 방식이다.** 따로 채우게 하면 아무도 안 채운다."""
    r = _news(client, auth, plain, technologies=[{'name': 'Omniverse',
                                                  'note': '실시간 물리 해석 추가'}])
    assert r.status_code == 201, f'{r.status_code} · {r.get_json()}'

    tech = IntelTech.query.filter_by(name='Omniverse').first()
    assert tech is not None, '소식만 들어오고 레이더는 비었다'
    assert tech.stage == '관찰', '새로 본 기술의 기본은 관찰이다'
    assert tech.origin == 'ui'

    got = (r.get_json() or {}).get('data', {}).get('technologies') or []
    assert [t['name'] for t in got] == ['Omniverse']


def test_같은_기술은_두_줄이_되지_않는다(db, client, auth, plain):
    """
    ⚠️ 같은 기술이 여러 줄이 되는 순간 레이더는 목록이 아니라 잡동사니가 된다.
    """
    _news(client, auth, plain, url='https://example.test/a',
          technologies=[{'name': 'NVIDIA Omniverse'}])
    _news(client, auth, plain, url='https://example.test/b',
          technologies=[{'name': 'nvidia-omniverse'}])   # 표기만 다르다

    assert IntelTech.query.count() == 1, '표기가 달라 두 줄이 됐다'


def test_별칭으로도_같은_기술을_찾는다(db, client, auth, plain, admin):
    """기사마다 다른 이름으로 나온다 — 별칭이 없으면 이어지지 않는다."""
    S.create_tech(actor_id=admin.id, name='NVIDIA Omniverse', aliases=['OV', 'Omniverse'])
    _news(client, auth, plain, technologies=[{'name': 'OV'}])

    assert IntelTech.query.count() == 1
    assert IntelEvidence.query.count() == 1


def test_같은_원문은_두_번_안_들어간다(db, client, auth, plain):
    _news(client, auth, plain)
    _news(client, auth, plain)
    assert IntelNews.query.count() == 1


def test_기술을_열면_왜_그_단계인지_읽힌다(db, client, auth, plain):
    """
    ⚠️ 근거를 못 읽으면 레이더는 「누가 왜 그렇게 판단했는지 모르는 표」가 된다.
       그것이 앞선 세 번이 죽은 방식이다.
    """
    _news(client, auth, plain, technologies=[{'name': 'Omniverse',
                                              'note': '실시간 물리 해석 추가'}])
    tech = IntelTech.query.filter_by(name='Omniverse').first()

    r = client.get(f'{BASE}/tech/{tech.uuid}/evidence', headers=auth(plain))
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'
    rows = (r.get_json() or {}).get('data') or []
    assert len(rows) == 1
    assert rows[0]['note'] == '실시간 물리 해석 추가'
    assert rows[0]['news']['title']


# ── ③ 낡음을 스스로 말한다 ───────────────────────────────────────────────────

def test_근거가_오래_없으면_낡음으로_나온다(db, client, auth, admin):
    """
    ⚠️ **자정 장치다.** 앞선 셋은 낡아도 낡은 줄 몰랐다. 화면이 「이 줄은 N개월째
       근거가 없다」고 스스로 말해야 아무도 안 보는 표가 되지 않는다.
    """
    tech, _ = S.create_tech(actor_id=admin.id, name='오래된 기술')
    # '관찰' 의 기준은 180일. 그보다 오래 전으로 돌려 둔다.
    tech.stage_changed_at = datetime.utcnow() - timedelta(days=200)
    tech.created_at = tech.stage_changed_at
    _db.session.commit()

    r = client.get(f'{BASE}/tech', headers=auth(admin))
    row = next(t for t in (r.get_json() or {}).get('data') or []
               if t['name'] == '오래된 기술')
    assert row['isStale'] is True
    assert row['staleAfterDays'] == 180


def test_방금_만든_것은_낡지_않았다(db, client, auth, admin):
    """너무 넓게 걸리면 전부 빨개지고, 전부 빨가면 아무 신호도 아니다."""
    S.create_tech(actor_id=admin.id, name='새 기술')
    r = client.get(f'{BASE}/tech', headers=auth(admin))
    row = next(t for t in (r.get_json() or {}).get('data') or []
               if t['name'] == '새 기술')
    assert row['isStale'] is False


def test_단계마다_낡음_기준이_다르다(db, admin):
    """
    '관찰' 은 **지켜보겠다고 해 놓고 안 보고 있다**는 뜻이라 빨리 걸려야 하고,
    '도입' 은 이미 쓰는 것이라 조용해도 이상하지 않다.
    """
    watch, _ = S.create_tech(actor_id=admin.id, name='관찰중', stage='관찰')
    adopt, _ = S.create_tech(actor_id=admin.id, name='도입함', stage='도입')
    assert watch.stale_after_days() < adopt.stale_after_days()


# ── 레이더 한 줄이 「참고할 수 있는」 것이 되려면 ─────────────────────────────

def test_기술의_참고_칸들이_저장된다(db, client, auth, admin):
    """
    ⚠️ 이름만 있는 줄은 **목록이지 참고 자료가 아니다.** 6개월 뒤 「이게 뭐였지」에
       답을 못 하면 아무도 레이더를 안 본다. 요약과 링크가 그 답이다.
    """
    r = client.post(f'{BASE}/tech', json={
        'name': 'NVIDIA Omniverse', 'vendor': 'NVIDIA', 'category': '플랫폼',
        'url': 'https://example.test/omniverse',
        'summary': 'USD 기반으로 여러 도구의 장면을 한자리에 모으는 협업 플랫폼',
        'description': 'MX 해석 결과를 설계 장면에 얹는 데 쓸 수 있다.',
        'aliases': ['Omniverse', 'OV'],
    }, headers=auth(admin))
    assert r.status_code == 201, f'{r.status_code} · {r.get_json()}'

    t = IntelTech.query.filter_by(name='NVIDIA Omniverse').first()
    assert t.url == 'https://example.test/omniverse', '공식 문서 주소가 안 담겼다'
    assert t.summary and t.description
    assert set(t.aliases) == {'Omniverse', 'OV'}
    assert t.vendor == 'NVIDIA' and t.category == '플랫폼'


def test_목록에도_요약과_링크가_실린다(db, client, auth, admin):
    """화면이 목록에서 요약을 보여주므로 목록 응답에 있어야 한다."""
    S.create_tech(actor_id=admin.id, name='Omniverse',
                  summary='한 줄 설명', url='https://example.test/ov')
    r = client.get(f'{BASE}/tech', headers=auth(admin))
    row = (r.get_json() or {}).get('data')[0]
    assert row['summary'] == '한 줄 설명'
    assert row['url'] == 'https://example.test/ov'


def test_고치기로_요약과_링크를_채울_수_있다(db, client, auth, plain, admin):
    """
    ⚠️ 고치기는 **누구나** 할 수 있어야 한다. 설명을 채우는 것은 판단이 아니라
       기여다 — 여기까지 막으면 빈 줄이 영영 빈 줄로 남는다.
    """
    tech, _ = S.create_tech(actor_id=admin.id, name='Omniverse')
    assert tech.summary is None

    r = client.patch(f'{BASE}/tech/{tech.uuid}',
                     json={'summary': '나중에 채운 설명', 'url': 'https://example.test/x'},
                     headers=auth(plain))
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'

    _db.session.expire_all()
    got = IntelTech.query.filter_by(uuid=tech.uuid).first()
    assert got.summary == '나중에 채운 설명'
    assert got.url == 'https://example.test/x'


def test_소식에서_만들어진_기술은_요약이_비어_있다(db, client, auth, plain):
    """
    부산물로 생긴 줄이라 이름밖에 없다. **그래서 화면이 [고치기] 로 유도해야 한다** —
    비어 있는 것 자체는 정상이고, 비어 있는 채로 방치되는 것이 문제다.
    """
    _news(client, auth, plain, technologies=[{'name': 'OpenUSD'}])
    t = IntelTech.query.filter_by(name='OpenUSD').first()
    assert t is not None
    assert not t.summary, '이 시험이 깨지면 화면의 「요약 없음」 안내를 다시 볼 것'


# ── 목록의 기본 규칙 ─────────────────────────────────────────────────────────

def test_발표일_순서로_나온다(db, client, auth, plain):
    """
    ⚠️ `created_at` 으로 세우면 **뒤늦게 넣은 3년 전 글이 맨 위**에 선다.
       발표일과 등록일은 다른 것이다.
    """
    _news(client, auth, plain, url='https://example.test/old',
          title='옛날 글', publishedAt='2024-01-01')
    _news(client, auth, plain, url='https://example.test/new',
          title='최근 글', publishedAt='2026-08-20')

    r = client.get(f'{BASE}/news', headers=auth(plain))
    titles = [n['title'] for n in (r.get_json() or {}).get('data') or []]
    assert titles[0] == '최근 글', f'발표일 순서가 아니다: {titles}'


def test_발표일이_YYYY_MM_DD_로_나간다(db, client, auth, plain):
    """
    ⚠️ `published_at` 은 `Date` 라 `BaseModel.to_dict` 의 datetime 변환에 안 걸린다.
       그대로 두면 Flask 가 HTTP 날짜(`Thu, 13 Aug 2026 00:00:00 GMT`)로 내보내고
       **그 문자열이 화면에 그대로 찍힌다** — 2026-08-25 에 개발서버에서 실제로 그랬다.
    """
    _news(client, auth, plain, publishedAt='2026-08-13')
    r = client.get(f'{BASE}/news', headers=auth(plain))
    got = ((r.get_json() or {}).get('data') or [])[0]
    assert got['published_at'] == '2026-08-13', got['published_at']


def test_발표일을_모르면_비워_둔다(db, client, auth, plain):
    """모르는 것과 오늘 발표된 것은 다르다. 오늘로 채우면 목록 맨 위를 차지한다."""
    _news(client, auth, plain, publishedAt='알 수 없음')
    n = IntelNews.query.first()
    assert n.published_at is None


def test_어디로_들어왔는지_남는다(db, client, auth, plain):
    """
    ⚠️ 넷으로 들어온다(손·MCP·파일·LLM). 섞이면 나중에 「이거 누가 확인한 거야?」에
       답할 수 없다.
    """
    _news(client, auth, plain)
    assert IntelNews.query.first().origin == 'ui'

    n, err = S.create_news(actor_id=None, origin='mcp', title='바깥에서 밀어넣음',
                           url='https://example.test/mcp')
    assert err is None, err
    assert n.origin == 'mcp'
