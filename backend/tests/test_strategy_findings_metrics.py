# -*- coding: utf-8 -*-
"""발견 사항·관측의 순수 함수 시험. (AUDIT_PLAN 3-4)

지금까지 이 판은 무시험이었다 — 임계값 경계, 조사(이/가) 문법, 전사 접기,
`measure` 의 셈. 화면 없이 도는 순수 함수들이라 시험 비용이 가장 싼 곳인데,
인텔에서 「검사가 규칙 복사본을 보다가 데인」 것과 같은 부류의 위험이 있었다.

**여기서 지키는 것:**

  · 임계값은 **같아도** 짚는다(>=) — 경계를 시험 없이 두면 언젠가 > 로 바뀐다
  · 전사 접기는 **전부 걸렸을 때만** — 자료가 빈 사업부가 있으면 「전
    사업부」는 거짓말이고, 개별 줄과 이중 보고가 된다(실제로 그랬다)
  · 조사는 데이터에서 온 이름에 붙는다 — 'DA1팀가' 가 화면에 나오면 신뢰가 깎인다
  · 빈 목록·부분 결측은 0이 아니라 **None** — 없는 것을 나쁜 값으로 만들지 않는다
"""
from types import SimpleNamespace as NS

from app.modules.digital_twin_strategy.findings import (
    _all_divisions_hit, _object_particle, _subject_particle, _topic_particle,
    derive_findings, derive_strategy_link_findings,
)
from app.modules.digital_twin_strategy.metrics import measure

MX = NS(id=1, name='MX')
VD = NS(id=2, name='VD')
DIVS = [MX, VD]


# ── 조사 — 받침·영문·숫자 ─────────────────────────────────────────────────

def test_조사는_받침을_가린다():
    assert _subject_particle('부문') == '이'      # 받침 있음
    assert _subject_particle('데이터') == '가'    # 받침 없음
    assert _object_particle('연결') == '을'
    assert _object_particle('데이터') == '를'
    assert _topic_particle('연결') == '은'
    assert _topic_particle('데이터') == '는'


def test_조사는_영문_숫자면_병기한다():
    """영문·숫자로 끝나면 받침을 판단할 수 없다 — 틀린 조사 하나를 고르느니
    병기가 낫다."""
    assert _subject_particle('MX') == '이(가)'
    assert _subject_particle('팀1') == '이(가)'
    assert _object_particle('KPI') == '을(를)'
    assert _topic_particle('AI') == '은(는)'
    assert _subject_particle('') == '가'          # 빈 이름은 기본값


# ── 임계값 경계 ────────────────────────────────────────────────────────────

def test_임계값은_같아도_짚는다():
    """기본 no_performance=30.0. 30.0 이면 짚고 29.9 면 안 짚는다 — 경계가
    시험에 못 박혀 있지 않으면 언젠가 > 로 바뀌어도 아무도 모른다."""
    out = derive_findings({1: {'no_performance_rate': 29.9},
                           2: {'no_performance_rate': 30.0}}, DIVS)
    hits = [f for f in out if f['key'] == 'gap_performance']
    assert [f['division_id'] for f in hits] == [VD.id]
    assert '30.0%' in hits[0]['title']


# ── 전사 접기 — 전부 / 일부 / 자료 부족 ───────────────────────────────────

def test_전부_걸리면_전사_한_줄로_접는다():
    out = derive_findings({1: {'no_performance_rate': 80.0},
                           2: {'no_performance_rate': 100.0}}, DIVS)
    keys = [f['key'] for f in out]
    assert 'company_gap_performance' in keys
    assert 'gap_performance' not in keys          # 사업부별 반복은 없다
    company = next(f for f in out if f['key'] == 'company_gap_performance')
    assert company['division_id'] is None
    assert company['evidence']['no_performance_rate'] == {'min': 80.0, 'max': 100.0}


def test_일부만_걸리면_그_사업부만_짚는다():
    out = derive_findings({1: {'no_performance_rate': 10.0},
                           2: {'no_performance_rate': 100.0}}, DIVS)
    keys = [f['key'] for f in out]
    assert keys.count('gap_performance') == 1
    assert 'company_gap_performance' not in keys


def test_자료가_빈_사업부가_있으면_전사라고_말하지_않는다():
    """⚠️ 이 시험이 잡은 것이다 — MX 에 자료가 아예 없는데 「전 사업부에서
    비어 있습니다」가 VD 개별 줄과 **같이** 나왔다. 전사 판정은 전부 자료가
    있고 전부 걸렸을 때만이다."""
    out = derive_findings({1: {'no_performance_rate': None},
                           2: {'no_performance_rate': 100.0}}, DIVS)
    keys = [f['key'] for f in out]
    assert 'company_gap_performance' not in keys
    assert keys.count('gap_performance') == 1


def test_전사_판정_규칙():
    m = {1: {'x': 50.0}, 2: {'x': 60.0}}
    assert _all_divisions_hit(m, DIVS, 'x', 50.0) is True          # 같음도 걸림
    assert _all_divisions_hit(m, DIVS, 'x', 55.0) is False         # 하나 미달
    assert _all_divisions_hit({1: {'x': 50.0}, 2: {}}, DIVS, 'x', 10.0) is False
    assert _all_divisions_hit({1: {'x': 50.0}}, [MX], 'x', 10.0) is False  # 혼자면 접을 것이 없다
    assert _all_divisions_hit(m, DIVS, 'x', 60.0, worse='lower') is True


# ── measure — 빈 목록 · 부분 결측 ─────────────────────────────────────────

def test_빈_목록은_빈_관측이다():
    """과제 0건이면 0% 가 아니라 None 이다 — 없는 것을 값으로 만들면
    「성과 미정의 0%」 같은 좋은 소식이 지어진다."""
    m, ctx = measure([])
    assert m['project_count'] == 0
    assert ctx == {}
    assert all(v is None for k, v in m.items() if k != 'project_count')


def test_부분_결측은_없는_대로_둔다():
    """연결이 하나도 없으면 등급 미지정 비율은 **셀 수 없다** — 100% 도 0% 도
    아니라 None 이어야 한다. 미연결 비율(100%)이 그 상태를 말한다."""
    m, _ = measure([
        {'performance_count': 1, 'kpi_links': [], '담당부서목록': []},
        {'performance_count': 0, 'kpi_links': [], '담당부서목록': []},
    ])
    assert m['no_kpi_link_rate'] == 100.0
    assert m['unclassified_link_rate'] is None
    assert m['primary_link_rate'] is None
    assert m['dept_concentration'] is None        # 부서 기록이 없다
    assert m['pl_concentration'] is None
    assert m['deadline_crowding'] is None
    assert m['no_performance_rate'] == 50.0


def test_한_과제_여러_부서는_각각_센다():
    """참여했는지를 보는 것이지 지분을 나누는 것이 아니다."""
    m, ctx = measure([
        {'담당부서목록': ['제조기술', '품질'], 'kpi_links': []},
        {'담당부서목록': ['제조기술'], 'kpi_links': []},
    ])
    assert m['dept_spread'] == 2
    assert m['dept_concentration'] == 66.7        # 제조기술 2 / 배정 3
    assert ctx['top_dept'] == '제조기술'
    assert [r['name'] for r in ctx['dept_ranking']] == ['제조기술', '품질']


# ── 솔루션 커버리지 — 전사 접기 (3-3) ────────────────────────────────────

def _proj(uuid, division):
    return {'_uuid': uuid, '사업부': division}


def test_전_사업부가_미연결이면_한_줄로_접는다():
    projects = [_proj('a', 'MX'), _proj('b', 'MX'),
                _proj('c', 'VD'), _proj('d', 'VD')]
    out = derive_strategy_link_findings(projects, [], DIVS)
    assert [f['key'] for f in out] == ['strategy_unlinked:all']
    f = out[0]
    assert '통째로' in f['title']
    assert f['evidence']['total'] == 4
    assert f['evidence']['by_division'] == {'MX': 100.0, 'VD': 100.0}


def test_일부_사업부만_미연결이면_그_사업부만():
    projects = [_proj('a', 'MX'), _proj('b', 'MX'),
                _proj('c', 'VD'), _proj('d', 'VD')]
    out = derive_strategy_link_findings(projects, ['c', 'd'], DIVS)
    assert [f['key'] for f in out] == [f'strategy_unlinked:{MX.id}']
    assert out[0]['division_name'] == 'MX'


def test_식별자_없는_원천은_판단하지_않는다():
    """fixture 과제에는 uuid 가 없어 무조건 100% 미연결이 나온다 — 그건 조직의
    상태가 아니라 모드의 성질이다."""
    assert derive_strategy_link_findings(
        [{'사업부': 'MX'}, {'사업부': 'VD'}], [], DIVS) == []


def test_사업부_미상_과제만_넘으면_전사로_짚는다():
    """사업부를 못 붙인 과제는 사업부별 셈에 못 들어간다 — 그래도 전체 비율이
    넘으면 전사로 한 번은 말해야 한다."""
    projects = [_proj('a', '이름없는조직'), _proj('b', '이름없는조직')]
    out = derive_strategy_link_findings(projects, [], DIVS)
    assert [f['key'] for f in out] == ['strategy_unlinked:all']
    assert out[0]['evidence']['share'] == 100.0
