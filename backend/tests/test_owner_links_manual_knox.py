"""과제PL·작성자 계정 연결 — **미가입자의 knoxId 를 미리 넣을 수 있는가.**

왜 이 시험이 생겼나
    「설정 ▸ 과제PL · 작성자 계정 연결」은 이름만 적히고 knoxId 가 빈 과제를 사람
    단위로 묶어 보여 준다. 그런데 화면이 **후보(가입한 동명 계정)를 고르는 길만**
    열어 두어서, 후보가 없는 사람은 목록에 뜨기만 하고 **아무것도 할 수 없었다.**
    이 화면이 잡아 오는 사람이 바로 **아직 가입 안 한 사람들**이라 그 줄이 쌓인다.

    2026-08-24 에 화면에 **직접 입력**을 열었다. 서버는 원래부터 받고 있었다 —
    `patch_owner_links` 는 그 knoxId 로 가입한 계정이 있는지 **묻지 않는다.**

⚠️ **이 시험이 지키는 것은 그 「묻지 않음」이다.** 나중에 누가 「없는 계정을 넣으면
   안 되지」 하고 존재 검사를 더하면, 화면은 멀쩡히 입력을 받아 놓고 저장만 조용히
   거절당한다. 미가입자에게 미리 넣어 두는 것은 **버그가 아니라 이 기능의 요점**이다
   — `is_project_pl` 은 요청할 때마다 다시 대조하므로, 그 사람이 가입하는 순간
   권한이 생긴다.

같이 못 박는 것 — 이미 연결된 과제는 건너뛴다(덮어쓰기가 아니라 **채우기**다),
이름이 다른 과제는 건너뛴다(화면이 준 목록이라도 서버가 한 번 더 본다).
"""
import uuid as uuidlib

import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project

BASE = '/api/dt-v2'
YEAR = 2026

# 이 knoxId 로 가입한 계정은 없다. 그것이 이 시험의 요점이다.
MISAGIP = 'notyet.joined'


@pytest.fixture()
def admin(make_user):
    return make_user('owner-link@test.local', UserRole.ADMIN)


def _project(code, pl_name='김미가입', pl_knox=None):
    p = Dt2Project(
        uuid=str(uuidlib.uuid4()), code=code, title=f'{code} 과제', division='MX',
        status='진행중', year=YEAR, is_deleted=False, progress=0,
        pl_name=pl_name, pl_knox_id=pl_knox,
        action_items_json=[], issues_json=[],
    )
    _db.session.add(p)
    # ⚠️ flush 로는 안 된다. 요청이 거절하며 rollback 을 부르면 시험 데이터까지 함께
    #    되돌아간다.
    _db.session.commit()
    return p


def _patch(client, auth, admin, name, knox, uuids, kind='pl'):
    return client.patch(
        f'{BASE}/owner-links',
        json={'kind': kind, 'name': name, 'knoxId': knox, 'projectUuids': uuids},
        headers=auth(admin))


def test_가입_안_한_knoxId_도_넣을_수_있다(db, client, auth, admin):
    """이 화면의 **요점**이다. 막히면 미가입자는 영영 연결할 수 없다."""
    p = _project('ML-01')

    r = _patch(client, auth, admin, '김미가입', MISAGIP, [p.uuid])

    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'
    assert (r.get_json() or {}).get('data', {}).get('updatedCount') == 1

    _db.session.expire_all()
    after = Dt2Project.query.filter_by(uuid=p.uuid).first()
    assert after.pl_knox_id == MISAGIP


def test_한_사람의_여러_과제가_한_번에_풀린다(db, client, auth, admin):
    """작업 단위가 과제가 아니라 **사람**이라는 것."""
    ps = [_project(f'ML-1{i}') for i in range(3)]

    r = _patch(client, auth, admin, '김미가입', MISAGIP, [p.uuid for p in ps])

    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'
    assert (r.get_json() or {}).get('data', {}).get('updatedCount') == 3

    _db.session.expire_all()
    for p in ps:
        got = Dt2Project.query.filter_by(uuid=p.uuid).first()
        assert got.pl_knox_id == MISAGIP


def test_이미_연결된_과제는_건드리지_않는다(db, client, auth, admin):
    """
    ⚠️ 이 기능은 **빈 것을 채우는** 일이지 남이 지정한 계정을 갈아치우는 일이 아니다.
       덮어쓰면 관리자가 화면 한 번 눌러 남의 권한을 조용히 옮길 수 있게 된다.
    """
    p = _project('ML-20', pl_knox='already.linked')

    r = _patch(client, auth, admin, '김미가입', MISAGIP, [p.uuid])

    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'
    data = (r.get_json() or {}).get('data', {})
    assert data.get('updatedCount') == 0
    assert data.get('skippedCount') == 1

    _db.session.expire_all()
    assert Dt2Project.query.filter_by(uuid=p.uuid).first().pl_knox_id == 'already.linked'


def test_이름이_다른_과제는_건너뛴다(db, client, auth, admin):
    """화면이 목록을 주지만 **서버가 한 번 더 본다.** 낡은 목록으로 엉뚱한 과제를
    건드리는 것을 막는다."""
    p = _project('ML-30', pl_name='다른사람')

    r = _patch(client, auth, admin, '김미가입', MISAGIP, [p.uuid])

    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'
    assert (r.get_json() or {}).get('data', {}).get('updatedCount') == 0

    _db.session.expire_all()
    assert not (Dt2Project.query.filter_by(uuid=p.uuid).first().pl_knox_id or '')


def test_바꾼_것은_변경_이력에_남는다(db, client, auth, admin):
    """권한이 걸린 값이다. **누가 언제 무엇을 열어 줬는지** 되짚을 수 있어야 한다."""
    from app.modules.digital_twin_dashboard.models_v2 import Dt2ProjectChange

    p = _project('ML-40')
    _patch(client, auth, admin, '김미가입', MISAGIP, [p.uuid])

    rows = Dt2ProjectChange.query.filter_by(
        project_uuid=p.uuid, field='pl_knox_id').all()
    assert len(rows) == 1
    assert rows[0].after_value == MISAGIP
    assert rows[0].actor_user_id == admin.id


def test_일반_사용자는_못_한다(db, client, auth, make_user):
    """계정 연결은 곧 편집 권한 배포다. 관리자·사무국만."""
    plain = make_user('plain-owner@test.local', UserRole.USER)
    p = _project('ML-50')

    r = _patch(client, auth, plain, '김미가입', MISAGIP, [p.uuid])

    assert r.status_code == 403, f'{r.status_code} · {r.get_json()}'

    _db.session.expire_all()
    assert not (Dt2Project.query.filter_by(uuid=p.uuid).first().pl_knox_id or '')


def test_미연결_목록에_잡힌다(db, client, auth, admin):
    """
    목록과 연결이 **같은 이름 기준**으로 맞물리는지. 여기가 갈리면 화면에 뜬 사람을
    눌러도 「이름이 다릅니다」로 전부 건너뛴다.
    """
    _project('ML-60')
    _project('ML-61')

    r = client.get(f'{BASE}/owner-links/audit?kind=pl', headers=auth(admin))
    assert r.status_code == 200, f'{r.status_code} · {r.get_json()}'

    rows = [x for x in ((r.get_json() or {}).get('data') or [])
            if x.get('name') == '김미가입']
    assert len(rows) == 1, '한 사람으로 묶여야 한다'
    assert rows[0]['projectCount'] == 2
    assert rows[0]['candidates'] == [], '가입한 계정이 없으니 후보도 없다'


def test_연결한_뒤에는_목록에서_사라진다(db, client, auth, admin):
    """끝낼 수 있는 일만 목록에 남아야 한다."""
    p = _project('ML-70')
    _patch(client, auth, admin, '김미가입', MISAGIP, [p.uuid])

    r = client.get(f'{BASE}/owner-links/audit?kind=pl', headers=auth(admin))
    names = [x.get('name') for x in ((r.get_json() or {}).get('data') or [])]
    assert '김미가입' not in names
