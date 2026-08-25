"""되돌리기ㆍ병합ㆍ판단의 기록 — 모듈을 쓸 만하게 만드는 나머지 절반.

⚠️⚠️ **못 무르는 기능은 안 쓰는 기능이다.** AI 제안을 눌러 잘못 연결했는데 무를
   방법이 없으면, 한 번 데인 사람은 그다음부터 안 누른다. 2026-08-25 까지 근거와
   연결에 **POST 만 있고 DELETE 가 없었다** — 4단계에서 「사람이 고른다」로 안전장치를
   걸어 놓고 정작 **잘못 고른 걸 못 무르게** 해 뒀다.

⚠️ **끊는 권한을 좁히지 않는다.** 거는 것이 누구나인데 끊는 것만 사무국이면, 실수한
   사람이 자기 실수를 못 치운다. 근거ㆍ연결은 값싸고 다시 걸 수 있다 — 소식ㆍ기술
   자체를 지우는 것은 여전히 사무국만이다.
"""
import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_intel import services as S
from app.modules.digital_twin_intel.models import (
    IntelChange, IntelEvidence, IntelLink, IntelNews, IntelTech,
)

BASE = '/api/digital-twin-intel'


@pytest.fixture()
def admin(make_user):
    return make_user('undo-admin@test.local', UserRole.ADMIN)


@pytest.fixture()
def plain(make_user):
    return make_user('undo-plain@test.local', UserRole.USER)


def _news(client, auth, user, url, **over):
    body = {'title': '시험 소식', 'url': url}
    body.update(over)
    r = client.post(f'{BASE}/news', json=body, headers=auth(user))
    assert r.status_code == 201, f'{r.status_code} · {r.get_json()}'
    return (r.get_json() or {}).get('data')


# ── A. 되돌리기 ──────────────────────────────────────────────────────────────

def test_잘못_건_근거를_끊을_수_있다(db, client, auth, plain):
    n = _news(client, auth, plain, 'https://e.test/1',
              technologies=[{'name': 'Omniverse', 'note': '잘못 건 것'}])
    t = IntelTech.query.filter_by(name='Omniverse').first()
    assert IntelEvidence.query.count() == 1

    r = client.delete(f'{BASE}/evidence?newsUuid={n["uuid"]}&techUuid={t.uuid}',
                      headers=auth(plain))
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'
    assert IntelEvidence.query.count() == 0
    # 기술 자체는 남는다 — 근거만 끊은 것이다.
    assert IntelTech.query.filter_by(uuid=t.uuid).first() is not None


def test_없는_근거를_끊으면_404(db, client, auth, plain):
    r = client.delete(f'{BASE}/evidence?newsUuid=a&techUuid=b', headers=auth(plain))
    assert r.status_code == 404


def test_잘못_건_연결을_끊을_수_있다(db, client, auth, plain):
    """AI 제안을 눌러 걸었다가 아니다 싶을 때. **이게 없으면 아무도 안 누른다.**"""
    n = _news(client, auth, plain, 'https://e.test/2')
    r = client.post(f'{BASE}/links',
                    json={'subjectKind': 'news', 'subjectUuid': n['uuid'],
                          'targetKind': 'project', 'targetRef': 'p-1'},
                    headers=auth(plain))
    assert r.status_code == 201
    lid = (r.get_json() or {}).get('data', {}).get('id')

    r2 = client.delete(f'{BASE}/links/{lid}', headers=auth(plain))
    assert r2.status_code == 200, f'{r2.status_code} · {r2.get_json()}'
    assert IntelLink.query.count() == 0


def test_소식_제목도_고칠_수_있다(db, client, auth, plain):
    """
    ⚠️ 예전에는 화면이 본문만 보냈다. 오타 난 제목이 영원히 남았다 — 라우트는
       받고 있었는데 **보내는 쪽이 없었다.**
    """
    n = _news(client, auth, plain, 'https://e.test/3', title='오타 잇는 제목')
    r = client.patch(f'{BASE}/news/{n["uuid"]}',
                     json={'title': '고친 제목', 'summary': '요약도'},
                     headers=auth(plain))
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'
    _db.session.expire_all()
    got = IntelNews.query.filter_by(uuid=n['uuid']).first()
    assert got.title == '고친 제목' and got.summary == '요약도'


# ── B. 할 일 보이기 ──────────────────────────────────────────────────────────

def test_소식_상태를_바꿀_수_있다(db, client, auth, plain):
    """
    ⚠️ `status` 는 **거르기만 되고 바꾸는 길이 없어 죽은 칸**이었다 — 전부 영원히
       「신규」였다. 읽었다는 표시를 못 하면 「무엇을 처리해야 하나」가 안 보인다.
    """
    n = _news(client, auth, plain, 'https://e.test/4')
    assert IntelNews.query.filter_by(uuid=n['uuid']).first().status == '신규'

    r = client.patch(f'{BASE}/news/{n["uuid"]}', json={'status': '확인됨'},
                     headers=auth(plain))
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'
    _db.session.expire_all()
    assert IntelNews.query.filter_by(uuid=n['uuid']).first().status == '확인됨'


def test_모르는_상태는_거절한다(db, client, auth, plain):
    """
    ⚠️ 오타가 들어가면 그 소식은 **어느 거르기에도 안 걸려** 목록에서 조용히 사라진다.
    """
    n = _news(client, auth, plain, 'https://e.test/5')
    r = client.patch(f'{BASE}/news/{n["uuid"]}', json={'status': '읽는중'},
                     headers=auth(plain))
    assert r.status_code == 400
    _db.session.expire_all()
    assert IntelNews.query.filter_by(uuid=n['uuid']).first().status == '신규'


def test_낡은_것만_모아볼_수_있다(db, client, auth, admin):
    """
    낡음 표시가 있어도 **모아 보는 자리가 없으면** 하나씩 찾아다녀야 한다.
    ⚠️ 거르기도 서버가 한다 — 단계마다 기준 일수가 다르고, 그 표가 화면에 복제되면 갈린다.
    """
    from datetime import datetime, timedelta

    # ⚠️ 둘 다 '관찰' 로 둔다 — 기본값 '감지' 는 낡음을 **아예 안 잰다.**
    fresh, _ = S.create_tech(actor_id=admin.id, name='새 기술', stage='관찰')
    old, _ = S.create_tech(actor_id=admin.id, name='낡은 기술', stage='관찰')
    old.stage_changed_at = datetime.utcnow() - timedelta(days=400)
    old.created_at = old.stage_changed_at
    _db.session.commit()

    r = client.get(f'{BASE}/tech?stale=1', headers=auth(admin))
    names = [t['name'] for t in (r.get_json() or {}).get('data') or []]
    assert names == ['낡은 기술'], names


# ── D. 병합 ──────────────────────────────────────────────────────────────────

def test_두_줄_된_기술을_합친다(db, client, auth, admin):
    """
    ⚠️ 별칭으로 대부분 막지만 표기가 많이 다르면 두 줄이 선다. 합칠 방법이 없으면
       근거가 둘로 갈려 **어느 쪽도 제대로 안 보인다.**
    """
    win, _ = S.create_tech(actor_id=admin.id, name='NVIDIA Omniverse')
    lose, _ = S.create_tech(actor_id=admin.id, name='엔비디아 옴니버스',
                            summary='지는 쪽에만 있는 설명')
    n1 = _news(client, auth, admin, 'https://e.test/m1')
    S.link_evidence(n1['uuid'], lose.uuid, note='지는 쪽 근거')
    _db.session.commit()

    r = client.post(f'{BASE}/tech/{lose.uuid}/merge',
                    json={'intoUuid': win.uuid}, headers=auth(admin))
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'

    _db.session.expire_all()
    assert IntelTech.query.filter_by(uuid=lose.uuid).first() is None
    kept = IntelTech.query.filter_by(uuid=win.uuid).first()
    # 근거가 옮겨왔다
    assert IntelEvidence.query.filter_by(tech_uuid=win.uuid).count() == 1
    # 비어 있던 칸을 물려받았다
    assert kept.summary == '지는 쪽에만 있는 설명'


def test_합칠_때_지는_이름이_별칭으로_남는다(db, client, auth, admin):
    """
    ⚠️ **이게 없으면 지운 줄이 곧바로 다시 생긴다.** 다음 소식이 그 이름으로 들어오면
       서버가 못 알아보고 새로 만든다.
    """
    win, _ = S.create_tech(actor_id=admin.id, name='NVIDIA Omniverse')
    lose, _ = S.create_tech(actor_id=admin.id, name='엔비디아 옴니버스')
    client.post(f'{BASE}/tech/{lose.uuid}/merge', json={'intoUuid': win.uuid},
                headers=auth(admin))

    _db.session.expire_all()
    assert '엔비디아 옴니버스' in (IntelTech.query.filter_by(uuid=win.uuid).first().aliases or [])

    # 실제로 그 이름으로 소식을 넣어도 새 줄이 안 생긴다
    _news(client, auth, admin, 'https://e.test/again',
          technologies=[{'name': '엔비디아 옴니버스'}])
    assert IntelTech.query.count() == 1


def test_일반_사용자는_못_합친다(db, client, auth, plain, admin):
    """되돌릴 수 없다(한쪽이 지워진다). 지우기와 같은 권한으로 좁힌다."""
    a, _ = S.create_tech(actor_id=admin.id, name='A')
    b, _ = S.create_tech(actor_id=admin.id, name='B')
    r = client.post(f'{BASE}/tech/{a.uuid}/merge', json={'intoUuid': b.uuid},
                    headers=auth(plain))
    assert r.status_code == 403
    assert IntelTech.query.count() == 2


def test_자기_자신과는_못_합친다(db, client, auth, admin):
    a, _ = S.create_tech(actor_id=admin.id, name='A')
    r = client.post(f'{BASE}/tech/{a.uuid}/merge', json={'intoUuid': a.uuid},
                    headers=auth(admin))
    assert r.status_code == 400


# ── E. 판단의 기록 ───────────────────────────────────────────────────────────

def test_단계를_옮기면_기록이_남는다(db, client, auth, admin):
    """
    ⚠️⚠️ 단계를 「조직의 판단」이라며 관리자ㆍ사무국으로 좁혀 놓고 **그 판단의 기록이
       없었다.** 지금 값만 남으면 「왜 작년에 도입이었다가 보류로 내려갔지」에 답할 수
       없다 — 좁힌 의미가 절반이 된다.
    """
    t, _ = S.create_tech(actor_id=admin.id, name='Omniverse')
    client.put(f'{BASE}/tech/{t.uuid}/stage', json={'stage': '시험'}, headers=auth(admin))
    client.put(f'{BASE}/tech/{t.uuid}/stage',
               json={'stage': '보류', 'reason': '라이선스 비용'}, headers=auth(admin))

    r = client.get(f'{BASE}/tech/{t.uuid}/changes', headers=auth(admin))
    rows = (r.get_json() or {}).get('data') or []
    assert len(rows) == 2, rows
    assert rows[0]['before_value'] == '시험' and rows[0]['after_value'] == '보류'
    assert rows[0]['reason'] == '라이선스 비용'
    assert rows[0]['actor_user_id'] == admin.id
    assert rows[1]['before_value'] == '감지' and rows[1]['after_value'] == '시험'


def test_같은_단계로_다시_눌러도_기록이_안_는다(db, client, auth, admin):
    """
    ⚠️ 안 바뀐 것을 남기면 **진짜 변경이 잡음에 묻힌다.** 이유만 고친 것도 마찬가지다.
    """
    t, _ = S.create_tech(actor_id=admin.id, name='Omniverse')
    for _ in range(3):
        # ⚠️ 기본값과 **같은 단계**를 눌러야 「안 바뀐 것」이 된다(이제 기본은 감지).
        client.put(f'{BASE}/tech/{t.uuid}/stage', json={'stage': '감지'},
                   headers=auth(admin))
    assert IntelChange.query.filter_by(subject_uuid=t.uuid, field='stage').count() == 0


def test_소식_상태_변경도_기록된다(db, client, auth, plain):
    n = _news(client, auth, plain, 'https://e.test/log')
    client.patch(f'{BASE}/news/{n["uuid"]}', json={'status': '확인됨'},
                 headers=auth(plain))
    rows = IntelChange.query.filter_by(subject_uuid=n['uuid']).all()
    assert len(rows) == 1
    assert rows[0].field == 'status' and rows[0].after_value == '확인됨'


def test_기술이_지워져도_기록은_남는다(db, client, auth, admin):
    """무엇에 대한 기록이었는지 알아야 하므로 이름도 함께 남긴다."""
    t, _ = S.create_tech(actor_id=admin.id, name='곧 지울 기술')
    client.put(f'{BASE}/tech/{t.uuid}/stage', json={'stage': '시험'}, headers=auth(admin))
    client.delete(f'{BASE}/tech/{t.uuid}', headers=auth(admin))

    rows = IntelChange.query.filter_by(subject_uuid=t.uuid).all()
    assert all(r.subject_name == '곧 지울 기술' for r in rows)
    fields = sorted(r.field for r in rows)
    # ⚠️ **지운 것도 기록이다.** 「이 기술이 왜 없어졌지」에 답이 없으면, 판단을
    #    좁혀 둔 뜻이 절반이다 — 지우기는 사무국만 할 수 있는 판단이다.
    #    역량을 지울 땐 매달린 도구를 몇 개 떼어 냈는지도 그 줄에 적힌다.
    assert fields == ['delete', 'stage'], fields
    moved = next(r for r in rows if r.field == 'stage')
    assert (moved.before_value, moved.after_value) == ('감지', '시험')
