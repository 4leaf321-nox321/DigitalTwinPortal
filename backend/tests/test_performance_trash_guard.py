"""휴지통에 있는 성과는 고칠 수 없다.

왜 이 시험이 생겼나
    반출 체크리스트에 「`patch_performance` 의 휴지통 가드 — §4-16 을 성과에도」가
    남아 있었다(2026-08-24 확인). 과제 쪽에는 `if is_ai and p.is_deleted` 가드가
    있는데 성과에는 없어 보였기 때문이다.

    **그런데 성과는 이미 막혀 있었다.** 다른 자리에서, 더 엄하게.

        과제    can_edit_project 는 소프트 삭제를 **일부러 통과**시킨다.
                설정 이름 변경(사업부ㆍ프로세스 rename)이 휴지통 과제까지 닿아야
                복구했을 때 옛 이름이 안 살아난다. 그래서 라우트에서 AI 만 막는다.

        성과    can_edit_performance 가 `is_deleted` 를 보고 **누구에게나** False 다
                (permissions.py:918). 라우트까지 가기 전에 403 으로 끝난다.

    그래서 라우트에 가드를 더 넣으면 **닿지 않는 죽은 코드**가 된다. 실제로 넣어
    보고 확인했다 — 권한 검사가 먼저 걸려 그 줄은 한 번도 안 돈다.

⚠️ 그러면 왜 시험을 남기나. 보호가 **`can_edit_performance` 한 줄에 매달려 있기**
   때문이다. 누가 그 줄을 「관리자는 되게 하자」로 풀면 조용히 뚫린다. 삭제된 성과가
   638건이라(2026-08 실측) AI 가 옛 uuid 를 쥘 확률이 과제보다 높다.
"""
import uuid as uuidlib

import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_dashboard import permissions as P
from app.modules.digital_twin_dashboard.models_v2 import Dt2Performance

BASE = '/api/dt-v2'
YEAR = 2026


@pytest.fixture()
def admin(make_user):
    return make_user('perf-guard@test.local', UserRole.ADMIN)


def _perf(deleted=False, title='[MX] 해석 리드타임 단축'):
    p = Dt2Performance(
        # 사업부는 별도 칸이 아니라 **제목 접두어**로 들어간다(_ensure_division_prefix).
        uuid=str(uuidlib.uuid4()), title=title, year=YEAR,
        category='정량', subcategory='시간', unit='hrs',
        is_deleted=deleted,
    )
    _db.session.add(p)
    # ⚠️ flush 로는 안 된다. 요청이 거절하며 rollback 을 부르면 커밋 안 된 시험
    #    데이터까지 함께 되돌아가 성과가 사라진다.
    _db.session.commit()
    return p


def _patch(client, auth, admin, perf, patch, *, ai=False):
    body = {'patch': patch}
    if ai:
        body['actor_mode'] = 'ai'
    return client.patch(f'{BASE}/performances/{perf.uuid}',
                        json=body, headers=auth(admin))


def test_AI_는_휴지통_성과를_못_고친다(db, client, auth, admin):
    p = _perf(deleted=True)
    r = _patch(client, auth, admin, p, {'목표수준': 10}, ai=True)

    assert r.status_code == 403, f'{r.status_code} · {r.get_json()}'
    assert '삭제' in (r.get_json() or {}).get('message', '')


def test_사람도_휴지통_성과는_못_고친다(db, client, auth, admin):
    """
    ⚠️ 과제와 **다른 점**이다. 과제는 사람에게 열어 둔다 — 설정 이름 변경이
       휴지통 과제까지 닿아야 하기 때문이다. 성과에는 그 사정이 없다
       (`saveSettingsRename` 이 성과 단계를 아예 안 만든다).
    """
    p = _perf(deleted=True)
    r = _patch(client, auth, admin, p, {'목표수준': 10})

    assert r.status_code == 403, f'{r.status_code} · {r.get_json()}'


def test_관리자여도_막힌다(db, admin):
    """`admin` 은 대개 통과하는 자리라, 여기서만은 안 통한다는 것을 못 박는다."""
    assert admin.role == UserRole.ADMIN
    p = _perf(deleted=True)
    assert P.can_edit_performance(admin, p) is False


def test_살아있는_성과는_고칠_수_있다(db, client, auth, admin):
    """가드가 너무 넓게 걸리지 않았는지. 이게 없으면 「전부 막기」와 구분이 안 된다."""
    p = _perf(deleted=False)
    assert P.can_edit_performance(admin, p) is True

    r = _patch(client, auth, admin, p, {'목표수준': 10})
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'


def test_AI_가_살아있는_성과를_고치면_확인_대기로_간다(db, client, auth, admin):
    """
    목표수준은 핵심 필드라 AI 가 바로 못 바꾼다 — 202 로 제안이 되고 사람이 확인한다.
    거절(403)과 **다른 길**이라는 것을 갈라 둔다.
    """
    p = _perf(deleted=False)
    r = _patch(client, auth, admin, p, {'목표수준': 10}, ai=True)

    assert r.status_code == 202, f'{r.status_code} · {r.get_json()}'
    assert (r.get_json() or {}).get('data', {}).get('status') == 'needs_confirmation'


def test_막힌_뒤에는_값이_안_바뀌어_있다(db, client, auth, admin):
    """거절하면서 값은 바뀌어 있으면 최악이다."""
    p = _perf(deleted=True)
    before = p.target_level

    _patch(client, auth, admin, p, {'목표수준': 999}, ai=True)

    _db.session.expire_all()
    after = Dt2Performance.query.filter_by(uuid=p.uuid).first()
    assert after is not None
    assert after.target_level == before, '거절했는데 값이 바뀌었다'


def test_과제는_반대로_사람에게_열려_있다(db):
    """
    두 곳이 **일부러 다르다**는 것을 적어 둔다. 다음 사람이 「왜 한쪽만」을 물을 때,
    그것이 실수가 아니라 결정이었음을 여기서 읽을 수 있어야 한다.
    """
    import io
    import os

    backend = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = io.open(os.path.join(backend, 'app', 'modules', 'digital_twin_dashboard',
                               'routes_v2.py'), encoding='utf-8-sig').read()
    assert 'if is_ai and p.is_deleted:' in src, (
        '과제 쪽 휴지통 가드가 사라졌다. 성과와 달리 과제는 권한 계층에서 안 막으므로 '
        '(설정 이름 변경이 휴지통 과제까지 닿아야 한다) 이 가드가 유일한 방어다.')
