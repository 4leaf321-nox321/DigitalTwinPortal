# -*- coding: utf-8 -*-
"""성숙도 가져오기 시험. (PLAN 6절 · 9절 C 판)

**여기서 지키는 것:**

  · 미리보기는 아무것도 저장하지 않는가
  · 이름이 같으면 있는 것을 쓰는가 — 두 번 넣어도 같은가(멱등)
  · 다른 사업부 줄·빈 줄·겹친 줄이 **빠지지 않고 오류로 남는가**
  · 로드맵에서 뽑은 틀이 시험×과제 한 줄씩이고, 레거시 id 는 uuid 칸에 안 들어가는가
  · 정확도는 시키지 않으면 안 쓰고, 시키면 근거가 「표 가져오기」로 남는가
  · 어긋남 칸이 양쪽을 다 세는가
"""
import pytest

from app.extensions import db as _db
from app.modules.auth.models import UserRole
from app.modules.dev_dt_maturity.models import (
    MaturityAgent, MaturityAssessment, MaturityPair, MaturitySubject,
)

BASE = '/api/dev-dt-maturity'
UUID = '11111111-2222-4333-8444-555555555555'


@pytest.fixture()
def world(db):
    from app.modules.digital_twin_dashboard.models import Department, Division
    from app.modules.digital_twin_reference.models import DtReferenceTask

    mx = Division(name='MX', is_kpi_owner=True, is_active=True, order=1)
    vd = Division(name='VD', is_kpi_owner=True, is_active=True, order=2)
    _db.session.add_all([mx, vd])
    _db.session.flush()
    _db.session.add(Department(name='MX생기', division_id=mx.id, is_active=True))
    # 로드맵: 시험 둘. 하나는 과제 둘에 걸림(레거시 id + uuid), 하나는 연결 없음
    _db.session.add_all([
        DtReferenceTask(name='낙하 과제', division_id=str(mx.id), test_item='낙하 시험',
                        test_item_detail='1.2m', product_family=['S 시리즈'], order=1,
                        connected_dt_task=[{'projectId': 42, 'projectName': '구조 해석', 'year': '2025'},
                                           {'projectId': UUID, 'projectName': 'CFD', 'year': '2026'}]),
        DtReferenceTask(name='온도 과제', division_id=str(mx.id), test_item='온도 사이클', order=2,
                        connected_dt_task=[]),
        DtReferenceTask(name='남의 것', division_id=str(vd.id), test_item='VD 시험', order=1),
    ])
    _db.session.commit()
    return {'mx': mx, 'vd': vd}


@pytest.fixture()
def mx_user(make_user, world):
    return make_user('mx@test.local', UserRole.USER, department='MX생기')


TABLE = (
    '사업부\t시험 항목\t세부\t적용 제품군\t시뮬레이션\t모델 종류\t정확도(%)\t로드맵 항목 id\t대시보드 과제 uuid\n'
    'MX\t낙하 시험\t1.2m\tS 시리즈, A 시리즈\t구조 해석\t물리 기반\t88\t\t\n'
    'MX\t낙하 시험\t\t\tCFD\t\t\t\t' + UUID + '\n'
    '\t온도 사이클\t\t\t열 해석\t데이터 기반\t\t\t\n'
)


def _preview(client, auth, user, division, text):
    res = client.post(f'{BASE}/import/preview', json={'division_id': division.id, 'text': text},
                      headers=auth(user))
    assert res.status_code == 200, res.get_json()
    return res.get_json()['data']


def _apply(client, auth, user, division, text, **extra):
    res = client.post(f'{BASE}/import', json={'division_id': division.id, 'text': text, **extra},
                      headers=auth(user))
    assert res.status_code == 200, res.get_json()
    return res.get_json()['data']


# ── 틀 ────────────────────────────────────────────────────────────────────

def test_틀은_로드맵에서_시험_과제_한_줄씩_뽑는다(client, auth, world, mx_user):
    res = client.get(f'{BASE}/import/template?division_id={world["mx"].id}', headers=auth(mx_user))
    assert res.status_code == 200
    body = res.get_data(as_text=True)
    assert body.startswith('﻿')                          # 엑셀이 한글을 제대로 열게
    lines = [l for l in body.lstrip('﻿').splitlines() if l]
    assert lines[0].startswith('사업부,시험 항목,세부')
    assert len(lines) == 1 + 3                                # 낙하×2 + 온도(연결 없음) 1
    assert 'MX,낙하 시험,1.2m,S 시리즈,구조 해석,,,' in lines[1]
    assert lines[1].endswith(',')                             # 레거시 id 42 → uuid 칸 비움
    assert lines[2].endswith(UUID)                            # uuid 모양은 실림
    assert 'VD 시험' not in body                               # 남의 사업부는 안 나온다


# ── 미리보기 ──────────────────────────────────────────────────────────────

def test_미리보기는_저장하지_않고_새로_생길_것을_센다(client, auth, world, mx_user):
    p = _preview(client, auth, mx_user, world['mx'], TABLE)
    assert p['summary'] == {'rows': 3, 'errors': 0, 'new_subjects': 2, 'new_agents': 3,
                            'new_pairs': 3, 'existing_pairs': 0, 'accuracy_values': 1}
    assert MaturitySubject.query.count() == 0
    assert [r['status'] for r in p['rows']] == ['new_pair'] * 3
    assert p['rows'][2]['division'] == 'MX'                   # 빈 사업부 칸은 요청한 사업부


def test_오류_줄은_빠지지_않고_이유가_붙는다(client, auth, world, mx_user):
    text = (
        '사업부\t시험 항목\t세부\t적용 제품군\t시뮬레이션\t모델 종류\t정확도(%)\t로드맵 항목 id\t대시보드 과제 uuid\n'
        'VD\t낙하 시험\t\t\t구조 해석\t\t\t\t\n'          # 다른 사업부
        'MX\t낙하 시험\t\t\t구조 해석\t양자\t120\t\t\n'   # 모델 종류·정확도 틀림
        'MX\t낙하 시험\t\t\t구조 해석\t\t\t\t\n'          # 위와 겹침
        '\t\t\t\t\t\t\t\t\n'                             # 빈 줄(공백뿐) — 건너뜀
        'MX\t온도 사이클\t\t\t\t\t\t\t\n'                # 시뮬레이션 빔
    )
    p = _preview(client, auth, mx_user, world['mx'], text)
    rows = p['rows']
    assert len(rows) == 4                                     # 공백뿐인 줄은 애초에 안 센다
    assert 'VD' in rows[0]['errors'][0] and 'MX' in rows[0]['errors'][0]
    assert any('모델 종류' in e for e in rows[1]['errors'])
    assert any('0~100' in e for e in rows[1]['errors'])
    assert any('같은 시험×시뮬레이션' in e for e in rows[2]['errors'])
    assert any('시뮬레이션이 비었' in e for e in rows[3]['errors'])
    assert p['summary']['errors'] == 4 and p['summary']['new_pairs'] == 0


def test_머리글이_없으면_줄_단위가_아니라_표_단위로_말한다(client, auth, world, mx_user):
    res = client.post(f'{BASE}/import/preview',
                      json={'division_id': world['mx'].id, 'text': 'a\tb\nc\td'},
                      headers=auth(mx_user))
    assert res.status_code == 400
    assert '머리글' in res.get_json()['message']


# ── 넣기 ──────────────────────────────────────────────────────────────────

def test_넣으면_생기고_두_번_넣어도_같다(client, auth, world, mx_user):
    out = _apply(client, auth, mx_user, world['mx'], TABLE)
    assert out['done'] == {'subjects': 2, 'agents': 3, 'pairs': 3, 'accuracy': 0, 'skipped': 0}
    assert MaturityAssessment.query.count() == 0             # 시키지 않으면 정확도는 안 쓴다
    s = MaturitySubject.query.filter_by(name='낙하 시험').one()
    assert s.product_families == ['S 시리즈', 'A 시리즈']
    a = MaturityAgent.query.filter_by(name='CFD').one()
    assert a.project_uuid == UUID
    assert MaturityAgent.query.filter_by(name='열 해석').one().model_kind == 'data'

    again = _apply(client, auth, mx_user, world['mx'], TABLE)
    assert again['done'] == {'subjects': 0, 'agents': 0, 'pairs': 0, 'accuracy': 0, 'skipped': 0}
    assert MaturityPair.query.count() == 3
    p = _preview(client, auth, mx_user, world['mx'], TABLE)
    assert p['summary']['existing_pairs'] == 3


def test_정확도는_시키면_근거를_달고_쓴다(client, auth, world, mx_user):
    out = _apply(client, auth, mx_user, world['mx'], TABLE, with_accuracy=True,
                 source_label='MX_가상검증_2026Q3.xlsx')
    assert out['done']['accuracy'] == 1
    a = MaturityAssessment.query.one()
    assert a.axis == 'accuracy' and a.value == 88.0
    assert a.note == '표 가져오기 (MX_가상검증_2026Q3.xlsx)'
    assert a.assessed_by_name == mx_user.name


def test_오류_줄은_건너뛰고_나머지는_넣는다(client, auth, world, mx_user):
    text = TABLE + 'VD\t남의 시험\t\t\t해석\t\t\t\t\n'
    out = _apply(client, auth, mx_user, world['mx'], text)
    assert out['done']['skipped'] == 1 and out['done']['pairs'] == 3


def test_다른_사업부에는_못_넣는다(client, auth, world, mx_user):
    res = client.post(f'{BASE}/import', json={'division_id': world['vd'].id, 'text': TABLE},
                      headers=auth(mx_user))
    assert res.status_code == 403
    assert 'VD' in res.get_json()['message']


# ── 어긋남 ────────────────────────────────────────────────────────────────

def test_어긋남은_양쪽을_다_센다(client, auth, world, mx_user):
    text = (
        '사업부\t시험 항목\t시뮬레이션\n'
        'MX\t낙하 시험\t구조 해석\n'
        'MX\t여기만 있는 시험\t해석\n'
    )
    _apply(client, auth, mx_user, world['mx'], text)
    res = client.get(f'{BASE}/reconcile?division_id={world["mx"].id}', headers=auth(mx_user))
    d = res.get_json()['data']
    assert d['missing_here'] == ['온도 사이클']
    assert d['only_here'] == ['여기만 있는 시험']
    assert (d['roadmap_count'], d['here_count']) == (2, 2)
