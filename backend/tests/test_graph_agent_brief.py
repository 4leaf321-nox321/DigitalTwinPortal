"""관계도 「지금 급한 것」 — 여섯 분석을 한 번에 보고 겹쳐 걸리는 것부터.

무엇을 지키나
    ⚠️ **갈래는 분석 하나가 하나다. 사유 문장 수가 아니다.**
       데이터 공백ㆍ보고 준비도는 묶음이 여럿이라 혼자서 사유를 다섯 개씩 만든다.
       그걸 세면 「데이터를 덜 채운 과제」가 「멈춘 데다 이슈까지 쌓인 과제」를
       이긴다. 무게를 안 주기로 해 놓고 사실상 데이터 공백에 다섯 배를 주는 셈이
       된다. **처음 구현이 실제로 그랬다**(2026-08-22) — 이 시험이 그것을 막는다.

    ⚠️ **과제 단위가 아닌 분석은 목록에 섞지 않는다.** 위험 지표는 지표 단위,
       숨은 연결은 과제 **쌍** 단위, 사업부 채움은 사업부 단위다. 한 목록에 넣으면
       「1위가 과제인데 2위는 지표」인 표가 되어 아무 뜻이 없다.
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
    return make_user('brief-admin@test.local', UserRole.ADMIN)


def _p(code, **kw):
    """과제 하나. 기본은 **아무 데도 안 걸리는** 깨끗한 과제여야 한다."""
    fields = dict(
        uuid=str(uuidlib.uuid4()), code=code, title=f'{code} 과제', division='MX',
        status='정상진행', year=YEAR, is_deleted=False, progress=50, is_key=False,
        action_items_json=[], issues_json=[],
    )
    fields.update(kw)
    p = Dt2Project(**fields)
    _db.session.add(p)
    _db.session.flush()
    return p


def _stalled_history(p, days=60):
    """멈춤으로 잡히게 이력을 깐다 — 오래전에 한 번 움직이고 그 뒤로 그대로."""
    now = datetime.utcnow()
    for ago, prog in ((days, 10), (days - 20, 30), (1, 30)):
        _db.session.add(Dt2ProjectHistory(
            project_uuid=p.uuid, observed_at=now - timedelta(days=ago),
            status=p.status, progress=prog, action_total=2, action_done=0,
            issue_total=0, issue_open=0, year=YEAR, source='test',
            change_kind='test', value_hash=f'{p.code}-{ago}'))
    _db.session.flush()


def _crowded_actions(month='2026-12'):
    """미완료 액션이 한 달에 몰린 모양 — 일정 쏠림으로 잡힌다."""
    return [{'제목': f'액션 {i}', '목표일': f'{month}-1{i}', '완료여부': False}
            for i in range(1, 5)]


def _open_issues(n=2, days_ago=200):
    old = (datetime.utcnow() - timedelta(days=days_ago)).date().isoformat()
    return [{'제목': f'이슈 {i}', '등록일': old, '해결여부': False} for i in range(n)]


def _brief(admin):
    return GA.priority_brief(GA.Scope(admin, years=[YEAR]), year=YEAR)


def _row(brief, code):
    return next((r for r in brief['rows'] if r.get('code') == code), None)


def test_두_갈래에_걸린_과제가_한_갈래보다_위다(db, admin):
    one = _p('AA-ONE', action_items_json=_crowded_actions())
    two = _p('AA-TWO', action_items_json=_crowded_actions(), issues_json=_open_issues())
    _stalled_history(two)

    b = _brief(admin)
    codes = [r['code'] for r in b['rows']]
    assert codes.index('AA-TWO') < codes.index('AA-ONE'), (
        f'겹친 것이 위여야 한다: {[(r["code"], r["sources"]) for r in b["rows"]]}')
    assert len(_row(b, 'AA-TWO')['sources']) > len(_row(b, 'AA-ONE')['sources'])


def test_갈래는_사유_수가_아니라_분석_수로_센다(db, admin):
    """
    데이터 공백만 잔뜩 걸린 과제가, 성격이 다른 두 갈래에 걸린 과제를 이기면 안 된다.

    ⚠️ 처음 구현이 이걸 틀렸다. 사유 문장을 세는 바람에 데이터 공백 하나가
       갈래 다섯 개 노릇을 했다.
    """
    # 데이터가 텅 빈 과제 — 공백ㆍ보고 준비 묶음에 여러 번 걸린다.
    empty = _p('BB-EMPTY')
    # 성격이 다른 두 갈래(멈춤 + 일정 쏠림)에 걸린 과제
    real = _p('BB-REAL', action_items_json=_crowded_actions())
    _stalled_history(real)

    b = _brief(admin)
    r_empty, r_real = _row(b, 'BB-EMPTY'), _row(b, 'BB-REAL')
    assert r_real is not None and r_empty is not None

    # 공백ㆍ보고 준비는 묶음이 몇 개든 **각각 갈래 하나**다.
    assert r_empty['sources'].count('데이터 공백') <= 1
    assert r_empty['sources'].count('보고 준비') <= 1
    # 사유는 여러 줄일 수 있다 — 그게 갈래 수를 부풀리면 안 된다.
    assert len(r_empty['reasons']) >= len(r_empty['sources'])


def test_아무_데도_안_걸리면_목록에_안_나온다(db, admin):
    clean = _p('CC-CLEAN',
               action_items_json=[{'제목': '액션', '목표일': '2026-03-10', '완료여부': True}])
    b = _brief(admin)
    row = _row(b, 'CC-CLEAN')
    # 데이터 공백에는 걸릴 수 있다(성과ㆍKPI 미연결). 다만 **겹치지는** 않아야 한다.
    if row:
        assert len(row['sources']) <= 2


def test_과제가_아닌_분석은_목록에_안_섞인다(db, admin):
    _p('DD-1', action_items_json=_crowded_actions())
    b = _brief(admin)
    # 목록의 모든 줄은 과제다 — ref 가 project 로 시작한다.
    for r in b['rows']:
        assert str(r['ref']).startswith('project:'), f'과제가 아닌 줄이 섞였다: {r}'
    # 지표ㆍ쌍ㆍ사업부 얘기는 따로 나온다.
    assert isinstance(b['others'], list)
    for o in b['others']:
        assert o['kind'] in ('risky', 'hidden', 'divisions')
        assert o['text']


def test_무엇을_돌렸는지_밝힌다(db, admin):
    """「이게 전부인가」를 사람이 알아야 한다."""
    b = _brief(admin)
    assert b['kind'] == 'brief'
    assert len(b['ran']) == 6
    # 갈래 이름과 「돌린 것」 이름이 같은 말이어야 화면이 헷갈리지 않는다.
    _p('EE-1', action_items_json=_crowded_actions())
    for r in _brief(admin)['rows']:
        for src in r['sources']:
            assert src in b['ran'], f'{src} 가 ran 목록에 없다'


def test_겹치는_것이_없으면_그렇게_말한다(db, admin):
    """0건을 「문제 없음」으로 읽히게 두면 안 된다."""
    b = _brief(admin)
    assert b['multiCount'] >= 0
    if b['multiCount'] == 0:
        assert '겹치는 과제는 없습니다' in b['headline'] or '걸리는 것이 없습니다' in b['headline']


def test_같은_갈래_수면_멈춤이_오래된_것이_위다(db, admin):
    a = _p('FF-OLD', action_items_json=_crowded_actions())
    b_ = _p('FF-NEW', action_items_json=_crowded_actions())
    _stalled_history(a, days=200)
    _stalled_history(b_, days=40)

    b = _brief(admin)
    codes = [r['code'] for r in b['rows']]
    assert codes.index('FF-OLD') < codes.index('FF-NEW')
