# -*- coding: utf-8 -*-
"""성숙도 정의의 순수 함수 시험. (PLAN 9절 A 판)

**여기서 지키는 것은 문구가 아니라 규칙이다.**

  · 사다리 key 는 유일하고 순서가 곧 서열인가 — 이력과 평가가 key 로 묶인다
  · 값 없는 정확도는 첫 칸이 아니라 **미평가(None)** 인가
  · 경계값(정확히 90)이 설정한 방향대로 가는가 — 시험 없이 두면 언젠가 뒤집힌다
  · 평균은 값 있는 것만으로 내는가 — 안 잰 시뮬레이션이 항목을 끌어내리면 안 된다
  · 설정이 문구는 덮되 **칸을 만들거나 지우지는 못하는가**
"""
import pytest

from app.modules.dev_dt_maturity import definitions as D


# ── 구조 ──────────────────────────────────────────────────────────────────

def test_부문과_축의_key_는_유일하고_종류가_맞다():
    assert len(D.SECTOR_KEYS) == len(set(D.SECTOR_KEYS))
    for sector, axes in D.AXES.items():
        assert sector in D.SECTOR_BY_KEY
        keys = [a['key'] for a in axes]
        assert len(keys) == len(set(keys)), sector
        for a in axes:
            assert a['kind'] in D.AXIS_KINDS
            rungs = D.rung_keys(a)
            assert len(rungs) == len(set(rungs)), (sector, a['key'])
            assert len(rungs) >= 3, (sector, a['key'])          # 사다리가 두 칸이면 스위치다


def test_시뮬레이션만_살아_있고_나머지는_자리만_있다():
    assert D.sector_is_active('simulation')
    for k in ('verification_automation', 'design_automation', 'digital_thread'):
        assert not D.sector_is_active(k)
    assert D.SECTOR_BY_KEY['digital_thread']['has_agent'] is False   # 수단 없는 연계


def test_자동화는_묶음이다_서열은_켠_개수():
    """전처리·실행·후처리·보고·파이프라인은 선후가 없다. 수동 = 아무것도 안 켬 = 0."""
    axis = D.axis_of('simulation', 'automation')
    assert axis['kind'] == 'set'
    assert D.set_flag_keys(axis) == ['pre', 'run', 'post', 'report', 'pipeline']
    assert D.set_rung(axis, ['post', 'pre']) == 'pre,post'              # 정해진 순서로 저장
    assert D.set_rung(axis, []) == 'manual'
    assert D.set_flags(axis, 'pre,post') == ['pre', 'post']
    assert D.set_flags(axis, 'manual') == [] and D.set_flags(axis, '') == []
    assert D.set_flags(axis, 'pre,robot') is None                       # 모르는 항목
    assert D.rung_index(axis, 'manual') == 0
    assert D.rung_index(axis, 'pre,run,post') == 3
    assert D.rung_index(axis, 'robot') is None


def test_모델링_수준은_바탕_토글과_불량_유형_표를_서열_하나로_접는다():
    axis = D.axis_of('simulation', 'modeling')
    assert axis['kind'] == 'matrix' and axis['hide_empty'] is True
    assert D.set_flag_keys(axis) == ['geometry', 'performance']
    assert [c['key'] for c in axis['columns']] == ['test', 'market']
    assert D.set_rung(axis, ['performance']) == 'performance'
    names = ['크랙', '변색']
    lv = lambda rung, defects: D.matrix_level(axis, rung, defects, names)[0]   # noqa: E731
    assert lv('none', {}) == 0
    assert lv('geometry', {}) == 1
    assert lv('geometry,performance', {}) == 2
    assert lv('performance', {'크랙': {'test': '2025-03'}}) == 3
    assert lv('performance', {'크랙': {'test': '2025-03'}, '변색': {'test': '2025-08'}}) == 4
    assert lv('performance', {'크랙': {'test': '2025-03', 'market': '2026-01'}}) == 5
    assert lv('none', {'없는유형': {'test': '2025-03'}}) == 0                    # 지운 유형은 안 센다
    assert D.matrix_level(axis, 'performance', {'크랙': {'test': '2025-03'}}, names)[1] == {'test': 1, 'market': 0, 'total': 2}


def test_시험_대체도_묶음이다_오른쪽일수록_앞선_것():
    axis = D.axis_of('simulation', 'substitution')
    assert axis['kind'] == 'set'
    assert D.set_flag_keys(axis) == ['reference', 'cause_analysis', 'screening', 'cert_gate', 'full']
    assert axis['hide_empty'] is True and D.set_flags(axis, 'none') == []
    assert D.set_flags(axis, 'reference') == ['reference']                      # 시험 병행도 켜는 항목
    assert D.set_rung(axis, ['screening']) == 'screening'
    assert D.set_rung(axis, ['full']) == 'reference,cause_analysis,screening,cert_gate,full'   # 완전 대체는 다 켠다
    assert D.rung_index(axis, 'reference') == 1


def test_칸의_서열은_index_이고_없는_칸은_None():
    axis = D.axis_of('simulation', 'scope')
    assert D.rung_index(axis, 'issue') == 0
    assert D.rung_index(axis, 'all') == 3
    assert D.rung_index(axis, '없는칸') is None      # 0 으로 두면 첫 칸과 미평가가 섞인다


# ── 정확도: 값 → 칸 ───────────────────────────────────────────────────────

def test_값이_없으면_칸이_아니라_미평가이다():
    assert D.rung_for_value(None) is None
    assert D.rung_for_value('') is None
    assert D.rung_for_value('abc') is None


def test_경계값은_설정한_방향대로_간다():
    """기본 gte: 90 은 위 칸. gt: 90 은 아래 칸. 둘 다 시험에 못 박는다."""
    assert D.rung_for_value(90, boundary='gte') == 'correlated'
    assert D.rung_for_value(90, boundary='gt') == 'quantitative'
    assert D.rung_for_value(89.9) == 'quantitative'
    assert D.rung_for_value(70) == 'quantitative'
    assert D.rung_for_value(69.9) == 'trend'
    assert D.rung_for_value(0) == 'trend'            # 값이 있으면 최소한 첫 칸
    assert D.rung_for_value(90, boundary='이상한값') == 'correlated'   # 모르는 방향은 기본


def test_사업부_문턱을_주면_그것으로_잰다():
    strict = [{'rung': 'trend', 'min': 0}, {'rung': 'quantitative', 'min': 80},
              {'rung': 'correlated', 'min': 95}]
    assert D.rung_for_value(90, thresholds=strict) == 'quantitative'
    assert D.rung_for_value(95, thresholds=strict) == 'correlated'


# ── 정확도: 항목 집계 ─────────────────────────────────────────────────────

def test_평균은_값_있는_것만으로_낸다():
    value, filled, total = D.aggregate_accuracy([88, None, 60])
    assert (value, filled, total) == (74.0, 2, 3)     # (88+60)/2, 안 잰 것은 0 이 아니다


def test_하나면_단일_둘이상이면_평균이_기본이다():
    assert D.aggregate_accuracy([88]) == (88.0, 1, 1)
    assert D.aggregate_accuracy([88, 60]) == (74.0, 2, 2)
    assert D.aggregate_accuracy([88, 60], rule='mean') == (74.0, 2, 2)


def test_단일_규칙인데_값이_여럿이면_정하지_않는다():
    """어느 것이 대표인지 정해져 있지 않다 — 화면이 「대표를 고르세요」를 말해야 한다."""
    assert D.aggregate_accuracy([88, 60], rule='single') == (None, 2, 2)
    assert D.aggregate_accuracy([88, None], rule='single') == (88.0, 1, 2)


def test_전부_비었으면_값이_없다():
    assert D.aggregate_accuracy([None, None]) == (None, 0, 2)
    assert D.aggregate_accuracy([]) == (None, 0, 0)


# ── 설정: 문구는 덮고 칸은 못 만든다 ─────────────────────────────────────

def test_설정은_문구만_덮고_칸을_만들거나_지우지_못한다(monkeypatch):
    monkeypatch.setattr(D, '_setting', lambda key: {
        'simulation': {
            'automation': [
                {'key': 'manual', 'label': '전부 손으로'},           # 문구 덮음
                {'key': 'robot', 'label': '로봇이 함'},              # 모르는 칸 — 무시
            ],
        },
    } if key == 'ladders' else None)
    axes = D.get_axes('simulation')
    auto = next(a for a in axes if a['key'] == 'automation')
    assert D.rung_keys(auto) == D.rung_keys(D.axis_of('simulation', 'automation'))
    assert auto['rungs'][0]['label'] == '전부 손으로'
    assert auto['rungs'][0]['description']                          # 안 덮은 칸은 기본 유지
    assert 'robot' not in D.rung_keys(auto)


def test_사업부_문턱은_사업부_전사_기본_순으로_찾는다(monkeypatch):
    monkeypatch.setattr(D, '_setting', lambda key: {
        '*': {'thresholds': [{'rung': 'trend', 'min': 0}, {'rung': 'quantitative', 'min': 75},
                             {'rung': 'correlated', 'min': 92}], 'boundary': 'gt'},
        '7': {'thresholds': [{'rung': 'correlated', 'min': 95}, {'rung': 'trend', 'min': 0},
                             {'rung': 'quantitative', 'min': 80}]},
    } if key == 'accuracy' else None)
    mine = D.get_accuracy_rule(7)
    assert [t['min'] for t in mine['thresholds']] == [0, 80, 95]    # 순서를 정돈한다
    assert mine['boundary'] == 'gte'                                # 사업부 줄에 없으면 기본
    company = D.get_accuracy_rule(99)
    assert company['boundary'] == 'gt'
    assert company['thresholds'][2]['min'] == 92


def test_깨진_문턱_설정은_기본으로_돌아간다(monkeypatch):
    monkeypatch.setattr(D, '_setting', lambda key: {
        '*': {'thresholds': [{'rung': '없는칸', 'min': 50}], 'boundary': 'sideways'},
    } if key == 'accuracy' else None)
    rule = D.get_accuracy_rule(1)
    assert rule['thresholds'] == D.DEFAULT_ACCURACY_THRESHOLDS
    assert rule['boundary'] == D.DEFAULT_ACCURACY_BOUNDARY


def test_재평가_필요_기간은_양수만_받는다(monkeypatch):
    monkeypatch.setattr(D, '_setting', lambda key: -3 if key == 'stale_days' else None)
    assert D.get_stale_days() == D.DEFAULT_STALE_DAYS
    monkeypatch.setattr(D, '_setting', lambda key: 180 if key == 'stale_days' else None)
    assert D.get_stale_days() == 180


def test_가져오기_틀은_필수_열_셋이다():
    required = [c['key'] for c in D.IMPORT_COLUMNS if c['required']]
    assert required == ['division', 'subject', 'agent']
    keys = [c['key'] for c in D.IMPORT_COLUMNS]
    assert len(keys) == len(set(keys))
