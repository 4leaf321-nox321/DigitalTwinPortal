"""관계도 「멈춘 과제」의 **지난주 대비**.

무엇을 지키나
    분석이 오늘의 스냅샷만 내면 같은 숫자를 매주 보게 되고, 세 번째부터는 아무도
    안 읽는다. 그래서 지난주 같은 자리에서 본 값을 함께 낸다.

⚠️ **지킬 것 둘.**

    ① 지난주를 셀 때는 **그때 이미 있던 기록만** 본다. 오늘 것을 그대로 두고
       날짜만 바꾸면 "지난주에도 이랬다" 가 되어 움직임이 통째로 사라진다.

    ② 견줄 수 없으면 **숫자를 안 낸다.** 그 시점에 이력이 없었으면 "0건이었다" 가
       아니라 **모른다** 다. 0 으로 적으면 없던 증가가 생긴다.

개발 DB 로는 이걸 볼 수 없다 — 이력이 20일치뿐이고 대부분 간격이 10일이라
14일 문턱을 못 넘는다. 그래서 여기서 이력을 직접 만들어 넣는다.
"""
import uuid as uuidlib
from datetime import datetime, timedelta

import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.digital_twin_dashboard.ai import graph_agent as GA
from app.modules.digital_twin_dashboard.models_v2 import (
    Dt2Project, Dt2ProjectHistory,
)

YEAR = 2026


@pytest.fixture()
def admin(make_user):
    return make_user('agent-admin@test.local', UserRole.ADMIN)


def _project(code, status='정상진행'):
    p = Dt2Project(uuid=str(uuidlib.uuid4()), code=code, title=f'{code} 과제', division='MX',
                   status=status, year=YEAR, is_deleted=False, progress=10)
    _db.session.add(p)
    _db.session.flush()
    return p


def _history(p, *points):
    """`points` 는 (며칠 전, 진행률) 짝. 오늘로부터 거슬러 올라간다."""
    now = datetime.utcnow()
    for days_ago, progress in points:
        _db.session.add(Dt2ProjectHistory(
            project_uuid=p.uuid,
            observed_at=now - timedelta(days=days_ago),
            status=p.status, progress=progress,
            action_total=4, action_done=1,
            issue_total=0, issue_open=0,
            year=YEAR, source='test', change_kind='test', value_hash=f'{p.code}-{days_ago}'))
    _db.session.flush()


def _run(admin):
    return GA.stalled_projects(GA.Scope(admin, years=[YEAR]))


def test_지난주에는_안_멈췄던_과제가_이번주에_멈춘다(db, admin):
    # 40일 전 10% → 20일 전 30% 까지 움직이다가 그 뒤로 그대로.
    # 지난주(7일 전) 기준으로는 멈춘 지 13일이라 14일 문턱 아래다.
    _history(_project('MX-01'), (40, 10), (20, 30), (1, 30))

    r = _run(admin)
    assert len(r['stalled']) == 1, '오늘은 멈춘 것으로 잡혀야 한다'
    t = r['trend']
    assert 'unavailable' not in t, f'견줄 수 있어야 한다: {t}'
    assert t['prevStalled'] == 0, '지난주에는 아직 문턱 아래였다'
    assert t['deltaStalled'] == 1
    assert '지난주보다 1개 늘었습니다' in r['headline']


def test_지난주에도_멈춰_있었으면_증감이_0(db, admin):
    # 60일 전에 한 번 움직이고 그 뒤로 내내 그대로 — 지난주에도 이미 멈춤이었다.
    # ⚠️ 지난주 시점에도 **간격이 14일 이상**이어야 판정이 된다. 가까이만 두면
    #    「판단 불가」가 나오지, 코드가 틀린 것이 아니다.
    _history(_project('MX-02'), (60, 10), (40, 20), (1, 20))

    r = _run(admin)
    assert len(r['stalled']) == 1
    t = r['trend']
    assert t['prevStalled'] == 1
    assert t['deltaStalled'] == 0
    assert '지난주와 같습니다' in r['headline']


def test_지난주에_아직_없던_기록은_그때_안_센다(db, admin):
    """①번 규칙. 이 시험이 없으면 「그때 이미 있던 것만」이 조용히 풀린다."""
    p = _project('MX-03')
    # 이력이 **전부 지난주 뒤**에 생겼다. 지난주 시점에는 판단할 것이 없다.
    _history(p, (3, 10), (1, 10))

    t = _run(admin)['trend']
    assert 'unavailable' in t, '그때 없던 기록으로 지난주를 판단하면 안 된다'


def test_견줄_수_없으면_숫자를_안_낸다(db, admin):
    """②번 규칙. 모르는 것을 0 으로 적으면 없던 증가가 생긴다."""
    _history(_project('MX-04'), (2, 10), (1, 20))

    t = _run(admin)['trend']
    assert 'prevStalled' not in t, '모르는 값을 0 으로 채우면 안 된다'
    assert t['unavailable']
    assert t['days'] == GA.STALLED_COMPARE_DAYS


def test_완료_과제는_멈췄다고_하지_않는다(db, admin):
    # 안 움직이는 게 정상인 상태는 판정에서 뺀다 — 오늘도 지난주도.
    _history(_project('MX-05', status='완료'), (60, 100), (50, 100), (1, 100))

    r = _run(admin)
    assert len(r['stalled']) == 0
    assert r['trend'].get('prevStalled') in (0, None)


def test_진행률이_내려간_것도_지난주와_견준다(db, admin):
    # 액션아이템을 늘리면 파생 진행률이 내려간다 — 나쁜 게 아니라 계획이 커진 것.
    # 지난주 시점에도 볼 기록이 둘 있어야 견줄 수 있다(60일ㆍ20일 전).
    _history(_project('MX-06'), (60, 50), (20, 50), (3, 30), (1, 30))

    r = _run(admin)
    assert len(r['regressed']) == 1
    t = r['trend']
    assert 'unavailable' not in t
    assert t['prevRegressed'] == 0, '내려간 것은 3일 전 일이라 지난주엔 없었다'
    assert t['deltaRegressed'] == 1
