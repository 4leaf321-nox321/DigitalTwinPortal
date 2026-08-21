"""재검토 요청 → **보완했습니다** → 사무국 재확인.

무엇을 지키나
    ⚠️ 예전에는 재검토 요청을 **받은 사람이 없앨 방법이 없었다.** 보고서를 고쳐도
       도장은 `rejected` 그대로여서, 사무국이 다시 열어 「사무국 확인」을 눌러 주기
       전까지 배지 숫자가 안 줄었다. 「내 일」의 원칙이 「끝낼 수 없는 것은 넣지
       않는다」인데 정작 끝낼 수 없는 카드였다(2026-08-22 신고).

    ⚠️ **끝나는 것이 아니라 넘어가는 것이다.** 내 카드에서 빠지고 사무국의
       「재확인 대기」로 떠야 한다. 한쪽만 되면 일이 공중에 뜬다 — 사람은 알렸는데
       사무국은 모른다.

    ⚠️ 누를 수 있는 사람은 **수신자이거나 그 과제가 내 것**인 경우뿐이다. 카드를
       보여 주는 규칙과 같은 잣대여야 한다 — 갈리면 안 보이는데 누를 수 있게 된다.
"""
import uuid as uuidlib

import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_dashboard import worklist as WL
from app.modules.digital_twin_dashboard.models import ModuleSettings
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project

YEAR = 2026


@pytest.fixture()
def pl(make_user):
    return make_user('pl@test.local', UserRole.USER, name='담당자')


@pytest.fixture()
def other(make_user):
    return make_user('other@test.local', UserRole.USER, name='남')


def _project(owner, code='RJ-01'):
    """`owner` 가 과제PL 인 과제. `relation='mine'` 이 이걸로 잡는다."""
    p = Dt2Project(
        uuid=str(uuidlib.uuid4()), code=code, title=f'{code} 과제', division='MX',
        status='완료', year=YEAR, is_deleted=False, progress=100,
        pl_knox_id=(owner.email or '').split('@')[0], pl_name=owner.name,
        owner_user_id=owner.id,
        action_items_json=[], issues_json=[],
    )
    _db.session.add(p)
    _db.session.flush()
    return p


def _seal(project_uuid, **kw):
    data = {'status': 'rejected', 'comment': '성과 근거가 부족합니다.', **kw}
    row = ModuleSettings.query.filter_by(
        module_name='digital_twin_dashboard', settings_key='reportConfirmations').first()
    if row is None:
        row = ModuleSettings(module_name='digital_twin_dashboard',
                             settings_key='reportConfirmations', settings_data={})
        _db.session.add(row)
    row.settings_data = {**(row.settings_data or {}), project_uuid: data}
    _db.session.flush()
    return data


def _seal_now(project_uuid):
    row = ModuleSettings.query.filter_by(
        module_name='digital_twin_dashboard', settings_key='reportConfirmations').first()
    return ((row.settings_data or {}) if row else {}).get(project_uuid)


def test_수신자가_보완했다고_누르면_도장이_바뀐다(db, pl):
    p = _project(pl)
    _seal(p.uuid, recipients=[{'id': pl.id, 'email': pl.email, 'name': pl.name}])

    seal, err = WL.mark_resubmitted(pl, p.uuid)
    assert err is None, err
    assert seal['status'] == 'resubmitted'
    assert _seal_now(p.uuid)['status'] == 'resubmitted'


def test_요청_사유는_지우지_않는다(db, pl):
    """사무국이 재확인할 때 **무엇을 지적했는지**를 다시 읽어야 한다."""
    p = _project(pl)
    _seal(p.uuid, recipients=[{'id': pl.id, 'email': pl.email, 'name': pl.name}])

    WL.mark_resubmitted(pl, p.uuid)
    after = _seal_now(p.uuid)
    assert after['comment'] == '성과 근거가 부족합니다.'
    assert after['recipients']
    assert after['resubmittedBy'] == pl.id
    assert after['resubmittedByName']


def test_남의_재검토_요청은_못_닫는다(db, pl, other):
    p = _project(pl)
    # 수신자가 pl 인데 other 가 누른다. other 는 이 과제와 아무 관계가 없다.
    _seal(p.uuid, recipients=[{'id': pl.id, 'email': pl.email, 'name': pl.name}])

    seal, err = WL.mark_resubmitted(other, p.uuid)
    assert seal is None
    assert err
    assert _seal_now(p.uuid)['status'] == 'rejected', '남이 눌렀는데 바뀌었다'


def test_수신자가_비어_있으면_내_과제인지로_판정한다(db, pl, other):
    """옛 도장에는 수신자가 없다. 카드도 그때는 「내 과제면 보여준다」로 판정한다."""
    p = _project(pl)
    _seal(p.uuid)                      # recipients 없음

    seal, err = WL.mark_resubmitted(pl, p.uuid)
    assert err is None, err
    assert seal['status'] == 'resubmitted'


def test_재검토_상태가_아니면_거절한다(db, pl):
    p = _project(pl)
    _seal(p.uuid, status='confirmed')

    seal, err = WL.mark_resubmitted(pl, p.uuid)
    assert seal is None
    assert '재검토 요청 상태가 아닙니다' in err


def test_도장이_없으면_거절한다(db, pl):
    p = _project(pl)
    seal, err = WL.mark_resubmitted(pl, p.uuid)
    assert seal is None and err


def test_두_번_누르면_두_번째는_거절된다(db, pl):
    """이미 넘어간 것을 또 넘길 수는 없다 — 사무국이 되돌리기 전까지는."""
    p = _project(pl)
    _seal(p.uuid, recipients=[{'id': pl.id, 'email': pl.email, 'name': pl.name}])

    assert WL.mark_resubmitted(pl, p.uuid)[1] is None
    seal, err = WL.mark_resubmitted(pl, p.uuid)
    assert seal is None and err


def test_사무국_카드가_보완된_것을_받는다(db, pl, make_user):
    """
    ⚠️ **공이 넘어가는 양쪽을 함께 본다.** 내 카드에서 빠지기만 하고 사무국이
       못 받으면 일이 공중에 뜬다.
    """
    office = make_user('office@test.local', UserRole.DT_OFFICE_MEMBER)
    p = _project(pl)
    _seal(p.uuid, recipients=[{'id': pl.id, 'email': pl.email, 'name': pl.name}])

    before = WL.build(pl, lens='mine')
    rj = next(c for c in before['cards'] if c['key'] == 'reportReject')
    assert rj['count'] == 1, '보완 전에는 내 카드에 있어야 한다'

    WL.mark_resubmitted(pl, p.uuid)

    after = WL.build(pl, lens='mine')
    rj2 = next(c for c in after['cards'] if c['key'] == 'reportReject')
    assert rj2['count'] == 0, '보완 뒤에는 내 카드에서 빠져야 한다'

    off = WL.build(office, lens='office')
    rc = next(c for c in off['cards'] if c['key'] == 'reportRecheck')
    assert rc['count'] == 1, '사무국의 재확인 대기로 넘어와야 한다'
    assert rc['urgent'] == 1, '남이 기다리는 것이므로 배지에도 세야 한다'
