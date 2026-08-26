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
from app.modules.digital_twin_intel.models import (
    IntelDivisionStage, IntelEvidence, IntelNews, IntelTech)

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


def test_일반_사용자는_단계_길을_못_연다(db, client, auth, plain, admin):
    """
    ⚠️ 단계는 개인 의견이 아니라 **조직이 어디까지 왔는지의 표기**다. 아무나 바꾸면
       아무도 그 표기를 안 믿게 되고, 안 믿는 표기는 없는 것과 같다.

    ⚠️⚠️ 이제 이 길은 **아무한테도 안 열린다**(2026-08-27) — 단계는 사업부 줄에만
       산다. 그래도 권한 문은 그대로 앞에 서 있어야 한다: 못 쓰는 사람에게는
       403 이, 쓸 수 있는 사람에게는 **왜 안 되는지**가 돌아가야 한다.
    """
    tech, err = S.create_tech(actor_id=admin.id, name='Omniverse')
    assert err is None, err

    r = client.put(f'{BASE}/tech/{tech.uuid}/stage',
                   json={'stage': '도입'}, headers=auth(plain))
    assert r.status_code == 403, f'{r.status_code} · {r.get_json()}'

    _db.session.expire_all()
    assert IntelTech.query.filter_by(uuid=tech.uuid).first().stage is None


def test_단계는_이_길로는_못_바꾼다(db, client, auth, office, admin):
    """
    ⚠️⚠️ **단계는 사업부 줄에만 산다**(2026-08-27). 역량은 2026-08-26 에 걷어냈고,
       도구는 「제품이 우리 손에 어디까지 들어와 있나라 하나로 말이 된다」는 이유로
       남겨 뒀는데 자료가 그 말을 안 받쳐 줬다 — 547개가 전부 「감지」였고 사람이
       옮긴 기록이 0건이었다.

    ⚠️ 길 자체는 남겨 둔다. MCP 나 옛 화면이 부를 수 있고, 그때 **왜 안 되는지
       말해 주는 편**이 조용히 404 를 내는 것보다 낫다.
    """
    tech, _ = S.create_tech(actor_id=admin.id, name='Omniverse')
    r = client.put(f'{BASE}/tech/{tech.uuid}/stage',
                   json={'stage': '시험'}, headers=auth(office))
    assert r.status_code == 400, f'{r.status_code} · {r.get_json()}'
    assert '사업부' in (r.get_json() or {}).get('message', '')

    _db.session.expire_all()
    assert IntelTech.query.filter_by(uuid=tech.uuid).first().stage is None


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
    assert IntelTech.query.filter_by(uuid=tech.uuid).first().stage is None


def test_새로_들어온_것은_단계가_없다(db, client, auth, admin):
    """
    ⚠️⚠️ 예전에는 「감지」로 들어왔다. 이제는 **아무 단계도 아니다** — 어느 사업부도
       아직 이걸 두고 아무 말도 안 했기 때문이다. 「안 쓰기로 한 판단은 근거가
       남아야 한다」는 규칙은 사업부 줄로 옮겨 갔다
       (test_intel_division_stage.py::test_보류로_둘_때만_이유를_묻는다).
    """
    tech, _ = S.create_tech(actor_id=admin.id, name='Omniverse')
    assert tech.stage is None
    assert tech.stage_reason is None

    # 값을 억지로 줘도 안 붙는다 — 뒷문을 열어 두면 그 한 줄 때문에 화면이 두
    # 규칙을 다 다뤄야 한다.
    forced, err = S.create_tech(actor_id=admin.id, name='억지로 넣은 도구',
                                kind='tool', stage='도입')
    assert err is None, err
    assert forced.stage is None


def test_소식을_넣으면_기술이_생긴다(db, client, auth, plain):
    """**이 모듈이 살아남는 방식이다.** 따로 채우게 하면 아무도 안 채운다."""
    r = _news(client, auth, plain, technologies=[{'name': 'Omniverse',
                                                  'note': '실시간 물리 해석 추가'}])
    assert r.status_code == 201, f'{r.status_code} · {r.get_json()}'

    tech = IntelTech.query.filter_by(name='Omniverse').first()
    assert tech is not None, '소식만 들어오고 레이더는 비었다'
    # ⚠️ 단계는 사업부 줄에만 산다 — 새로 들어온 것은 아무 단계도 아니다.
    assert tech.stage is None
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

    ⚠️⚠️ **낡음은 이제 사업부 눈에서만 잰다**(2026-08-27). 기술 자체는 단계가 없고,
       기준 일수는 단계마다 다르다 — 아무도 「여기 있다」고 말한 적 없는 줄에
       「그 말이 낡았다」고 할 수는 없다.
    """
    from app.modules.digital_twin_dashboard.models import Division
    if Division.query.filter_by(name='MX').first() is None:
        _db.session.add(Division(name='MX', order=0, is_active=True))
        _db.session.commit()

    cap, _ = S.create_tech(actor_id=admin.id, name='오래된 역량',
                           kind='capability')
    cap.created_at = datetime.utcnow() - timedelta(days=200)
    _db.session.commit()
    # '관찰' 의 기준은 180일. 적어 둔 지 그보다 오래됐다고 놓는다.
    S.set_division_stage(cap.uuid, 'MX', '관찰', actor=admin)
    row0 = IntelDivisionStage.query.filter_by(
        tech_uuid=cap.uuid, division='MX').first()
    row0.changed_at = datetime.utcnow() - timedelta(days=200)
    _db.session.commit()

    r = client.get(f'{BASE}/tech?division=MX', headers=auth(admin))
    row = next(t for t in (r.get_json() or {}).get('data') or []
               if t['name'] == '오래된 역량')
    assert row['isStale'] is True
    assert row['staleAfterDays'] == 180

    # 사업부를 안 고르면 잴 자가 없다 — 낡을 것도 없다.
    r2 = client.get(f'{BASE}/tech', headers=auth(admin))
    row2 = next(t for t in (r2.get_json() or {}).get('data') or []
                if t['name'] == '오래된 역량')
    assert row2['isStale'] is False
    assert row2['staleAfterDays'] is None


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

    ⚠️ 기준 일수는 **건네받은 단계**로 잰다 — 줄 자체는 단계를 안 갖는다.
    """
    t, _ = S.create_tech(actor_id=admin.id, name='어떤 역량', kind='capability')
    assert t.stale_after_days('관찰') < t.stale_after_days('도입')
    # ⚠️ 아무 단계도 안 주면 **잴 자가 없다** — 기본값을 물리면 만들자마자 낡는다.
    assert t.stale_after_days() is None
    assert t.is_stale(None) is False


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


def test_MCP_로_넣으면_그렇게_남는다(db, client, auth, plain):
    """
    ⚠️⚠️ MCP 도 사람도 **같은 REST 길**로 들어온다. 라우트에 `'ui'` 를 박아 두면
       바깥 AI 가 밀어 넣은 것까지 「사람이 적음」으로 남는다 — 2026-08-25 에 실제로
       그랬다. 그러면 나중에 「이거 누가 확인한 거야?」에 답할 수 없고, `origin` 을
       만든 이유가 통째로 무너진다.

    ⚠️ 출처는 **권한이 아니라 표시**라 부르는 쪽을 믿는다(`actor_mode='ai'` 와 같은
       방식). 다만 아는 값만 받는다.
    """
    r = _news(client, auth, plain, url='https://example.test/from-mcp', origin='mcp')
    assert r.status_code == 201, f'{r.status_code} · {r.get_json()}'
    assert IntelNews.query.filter_by(url='https://example.test/from-mcp').first().origin == 'mcp'

    # 기술도 마찬가지
    r2 = client.post(f'{BASE}/tech', json={'name': '밖에서 온 기술', 'origin': 'mcp'},
                     headers=auth(plain))
    assert r2.status_code == 201, f'{r2.status_code} · {r2.get_json()}'
    assert IntelTech.query.filter_by(name='밖에서 온 기술').first().origin == 'mcp'


def test_모르는_출처는_사람이_적은_것으로_본다(db, client, auth, plain):
    """오타나 새 경로 이름. 400 으로 막으면 이 칸 하나 때문에 소식을 통째로 잃는다."""
    _news(client, auth, plain, url='https://example.test/weird', origin='텔레파시')
    assert IntelNews.query.filter_by(url='https://example.test/weird').first().origin == 'ui'


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

def test_단계_이유는_사업부_줄에만_산다(db, client, auth, admin):
    """
    ⚠️⚠️ 예전에는 기술 줄 자체가 단계와 그 이유를 들었다. 지우고 저장해도 옛 이유가
       그대로 남는 흠이 있었고(2026-08-26 고침), 이제는 **그 칸 자체가 없다**.
       이유는 사업부 줄에만 살고, 거기서는 지울 수 있다
       (test_intel_division_stage.py::test_비우면_그_사업부_줄이_사라진다).
    """
    t, err = S.create_tech(actor_id=admin.id, name='어떤 도구', kind='tool')
    assert err is None
    assert (t.stage, t.stage_reason) == (None, None)

    _, err2 = S.set_stage(t.uuid, '시험', reason='한 과제에 걸어 본다', actor=admin)
    assert err2 and '사업부' in err2, err2
    _db.session.expire_all()
    assert IntelTech.query.filter_by(uuid=t.uuid).first().stage_reason is None
