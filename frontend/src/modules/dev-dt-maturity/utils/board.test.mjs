// 판 셈의 규칙 — 축은 순서형이라 평균을 내지 않고, 필터는 연계이 안 남는 시험을 뺀다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  colorFor, distribution, applyFilters, filtersToParams, filtersFromParams,
  accuracyLabel, changesByMonth, tabInSector,
} from './board.js';

const AXES = [
  { key: 'automation', rungs: [{ key: 'a' }, { key: 'b' }, { key: 'c' }] },
  { key: 'scope', rungs: [{ key: 'x' }, { key: 'y' }] },
];
const pair = (id, assessments, agent = {}) => ({
  id, agent, assessments,
  unassessed: AXES.map(a => a.key).filter(k => !assessments[k]),
});
const SUBJECTS = [
  { id: 1, name: '낙하', product_families: ['S'], pairs: [
    pair(11, { automation: { rung_index: 2, stale: false } }, { model_kind: 'physics' }),
    pair(12, { automation: { rung_index: 0, stale: true }, scope: { rung_index: 1, stale: false } }, { model_kind: 'data' }),
  ] },
  { id: 2, name: '온도', product_families: ['A'], pairs: [pair(21, {})] },
];

test('색은 서열로 정해지고 미평가는 회색', () => {
  assert.equal(colorFor(null, 5), '#e2e8f0');
  assert.equal(colorFor(0, 3), '#dbeafe');
  assert.equal(colorFor(2, 3), '#1e3a8a');        // 마지막 칸은 가장 진하다
  assert.equal(colorFor(4, 5), '#1e3a8a');
});

test('분포는 칸마다 세고 미평가를 따로 센다 — 평균이 없다', () => {
  const d = distribution(SUBJECTS, AXES);
  assert.deepEqual(d.automation, { counts: [1, 0, 1], unassessed: 1 });
  assert.deepEqual(d.scope, { counts: [0, 1], unassessed: 2 });
});

test('필터는 연계을 좁히고, 연계이 안 남는 시험은 뺀다', () => {
  // 12 는 두 축을 다 매겼다 — 미평가가 없으니 빠진다
  assert.deepEqual(applyFilters(SUBJECTS, { unassessedOnly: true }).map(s => s.pairs.map(p => p.id)),
    [[11], [21]]);
  assert.deepEqual(applyFilters(SUBJECTS, { staleOnly: true }).map(s => s.pairs.map(p => p.id)), [[12]]);
  assert.deepEqual(applyFilters(SUBJECTS, { family: 'A' }).map(s => s.id), [2]);
  assert.deepEqual(applyFilters(SUBJECTS, { modelKind: 'physics' }).map(s => s.pairs.map(p => p.id)), [[11]]);
  assert.deepEqual(applyFilters(SUBJECTS, { axis: 'automation', minRung: 1 }).map(s => s.pairs.map(p => p.id)), [[11]]);
  assert.deepEqual(applyFilters(SUBJECTS, {}).length, 2);
  // 연계 없는 시험 — 조건이 없으면 보이고, 연계 조건이 켜지면 빠진다
  const withEmpty = [...SUBJECTS, { id: 3, name: '빈 시험', product_families: [], pairs: [] }];
  assert.deepEqual(applyFilters(withEmpty, {}).map(s => s.id), [1, 2, 3]);
  assert.deepEqual(applyFilters(withEmpty, { unassessedOnly: true }).map(s => s.id), [1, 2]);
});

test('필터는 URL 로 오가고 돌아온다', () => {
  const f = { unassessedOnly: true, staleOnly: false, family: 'S', modelKind: '', axis: 'scope', minRung: 1 };
  const p = filtersToParams(f);
  assert.deepEqual(p, { unassessed: '1', family: 'S', axis: 'scope', min: '1' });
  assert.deepEqual(filtersFromParams(k => p[k] ?? null), f);
  assert.equal(filtersFromParams(k => ({ axis: 'scope', min: 'abc' })[k] ?? null).minRung, null);
});

test('항목 정확도 한 줄 — 부분 채움과 미입력을 말한다', () => {
  assert.equal(accuracyLabel({ accuracy: 84, accuracy_filled: 2, accuracy_total: 2 }), '84%');
  assert.equal(accuracyLabel({ accuracy: 88, accuracy_filled: 1, accuracy_total: 3 }), '88% (1/3)');
  assert.equal(accuracyLabel({ accuracy: null, accuracy_filled: 0, accuracy_total: 2 }), '미입력 2/2');
  assert.equal(accuracyLabel({ accuracy: null, accuracy_filled: 0, accuracy_total: 0 }), '—');
});

test('이력은 연계·달로 묶인다', () => {
  const m = changesByMonth([
    { pair_id: 1, created_at: '2026-02-03T10:00:00' },
    { pair_id: 1, created_at: '2026-02-20T10:00:00' },
    { pair_id: 2, created_at: '2026-05-01T10:00:00' },
    { pair_id: 3, created_at: null },
  ]);
  assert.deepEqual(Object.keys(m), ['1', '2']);
  assert.equal(m[1]['2026-02'].length, 2);
});

// ── reachedDates: 「지금 이어지고 있는 도달의 시작」 — 껐다 선택한 것·내려온 칸은 시점이 없다 ──
import { reachedDates, REACHED_NOTE } from './board.js';

const SET_AXIS = { key: 'automation', kind: 'set', rungs: [{ key: 'manual' }, { key: 'pre' }, { key: 'run' }, { key: 'post' }] };
const RUNG_AXIS = { key: 'scope', kind: 'rung', rungs: [{ key: 'issue' }, { key: 'basic' }, { key: 'all' }] };
const at = (m) => `${m}-01T12:00:00`;

test('묶음 축: 선택했다 해제한 항목은 시점이 없고, 다시 선택하면 그 달부터', () => {
  const changes = [
    { id: 1, axis: 'automation', before: null, after: 'pre,run', created_at: at('2025-01') },
    { id: 2, axis: 'automation', before: 'pre,run', after: 'pre', created_at: at('2025-03') },      // run 끔
    { id: 3, axis: 'automation', before: 'pre', after: 'pre,run', created_at: at('2025-06') },      // run 다시 켬
    { id: 4, axis: 'automation', before: 'pre,run', after: 'manual', created_at: at('2025-08') },   // 전부 끔
    { id: 5, axis: 'automation', before: 'manual', after: 'post', created_at: at('2025-09') },
  ];
  const d = reachedDates(changes.slice(0, 3), SET_AXIS);
  assert.equal(d.pre, at('2025-01'));
  assert.equal(d.run, at('2025-06'));                                    // 처음 켠 1월이 아니라 다시 켠 6월
  const d2 = reachedDates(changes, SET_AXIS);
  assert.deepEqual(d2, { post: at('2025-09') });                         // 끈 것은 없다
});

test('칸 축: 내려온 칸은 시점이 없고, 아래 칸은 위로 올라갈 때 같이 찍힌다', () => {
  const changes = [
    { id: 1, axis: 'scope', before: null, after: 'all', created_at: at('2025-02') },
    { id: 2, axis: 'scope', before: 'all', after: 'issue', created_at: at('2025-05') },
    { id: 3, axis: 'scope', before: 'issue', after: 'basic', created_at: at('2025-07') },
  ];
  assert.deepEqual(reachedDates(changes.slice(0, 1), RUNG_AXIS), { issue: at('2025-02'), basic: at('2025-02'), all: at('2025-02') });
  assert.deepEqual(reachedDates(changes, RUNG_AXIS), { issue: at('2025-02'), basic: at('2025-07') });   // all 은 없다
});

test('「시점 적기」 이력은 그 칸만 적고 다른 칸을 내리지 않는다 · 순서는 날짜순', () => {
  const changes = [
    { id: 2, axis: 'scope', before: null, after: 'basic', created_at: at('2025-05') },
    { id: 9, axis: 'scope', before: null, after: 'issue', note: REACHED_NOTE, created_at: at('2023-11') },
    { id: 3, axis: 'automation', before: null, after: 'pre,run', created_at: at('2025-05') },
    { id: 10, axis: 'automation', before: null, after: 'run', note: REACHED_NOTE, created_at: at('2024-02') },
  ];
  assert.deepEqual(reachedDates(changes, RUNG_AXIS), { issue: at('2023-11'), basic: at('2025-05') });   // 적은 시점이 남는다
  assert.equal(reachedDates(changes, SET_AXIS).pre, at('2025-05'));
  assert.equal(reachedDates(changes, SET_AXIS).run, at('2024-02'));      // 적은 시점이 이어진다
});

// ── matrixLevel: 바탕 토글 + 불량 유형 표 → 서열 하나 (서버 matrix_level 과 같은 셈) ──
import { matrixLevel, flagDefs } from './board.js';

const MATRIX_AXIS = { key: 'modeling', kind: 'matrix', base: [{ key: 'geometry' }, { key: 'performance' }],
  columns: [{ key: 'test' }, { key: 'market' }], rungs: [{ key: 'none' }, { key: 'geometry' }, { key: 'performance' }, { key: 'test_some' }, { key: 'test_all' }, { key: 'market' }] };

test('matrixLevel — 없음 0 · 형상 1 · 거동 2 · 일부 시험 3 · 전 유형 4 · 시장 5', () => {
  const names = ['크랙', '변색'];
  assert.equal(matrixLevel(MATRIX_AXIS, [], {}, names).level, 0);
  assert.equal(matrixLevel(MATRIX_AXIS, ['geometry'], {}, names).level, 1);
  assert.equal(matrixLevel(MATRIX_AXIS, ['geometry', 'performance'], {}, names).level, 2);
  assert.equal(matrixLevel(MATRIX_AXIS, ['performance'], { 크랙: { test: '2025-03' } }, names).level, 3);
  assert.deepEqual(matrixLevel(MATRIX_AXIS, ['performance'], { 크랙: { test: '2025-03' }, 변색: { test: '2025-08' } }, names), { level: 4, test: 2, market: 0, total: 2 });
  assert.equal(matrixLevel(MATRIX_AXIS, [], { 크랙: { test: '2025-03', market: '2026-01' } }, names).level, 5);
  assert.equal(matrixLevel(MATRIX_AXIS, [], { 없는유형: { test: '2025-03' } }, names).level, 0);   // 지운 유형은 안 센다
  assert.equal(matrixLevel(MATRIX_AXIS, ['performance'], {}, []).level, 2);                   // 유형이 없으면 바탕까지만
});

test('flagDefs — 묶음 축은 첫 칸을 뺀 칸들, 표 축은 바탕', () => {
  assert.deepEqual(flagDefs(MATRIX_AXIS).map(r => r.key), ['geometry', 'performance']);
  assert.deepEqual(flagDefs(SET_AXIS).map(r => r.key), ['pre', 'run', 'post']);
});


// ── divisionSummary: 축 종류마다 다른 대표 수치 ──
import { divisionSummary } from './board.js';

test('divisionSummary — 값은 평균, 택1은 「이상 %」, 묶음은 채택률, 표는 재현률', () => {
  const axes = [
    { key: 'accuracy', kind: 'value', rungs: [{ key: 'trend' }, { key: 'quantitative' }, { key: 'correlated' }] },
    { key: 'scope', kind: 'rung', rungs: [{ key: 'issue' }, { key: 'basic' }, { key: 'derived_some' }, { key: 'all' }] },
    { key: 'automation', kind: 'set', rungs: [{ key: 'manual' }, { key: 'pre' }, { key: 'run' }] },
    MATRIX_AXIS,
  ];
  const board = { subjects: [{ pairs: [
    { unassessed: [], agent: { defect_types: ['a', 'b'] }, assessments: {
      accuracy: { value: 80, rung_index: 1, stale: false }, scope: { rung_index: 3, stale: true },
      automation: { flags: ['pre', 'run'], rung_index: 2 }, modeling: { flags: ['geometry'], rung_index: 3, summary: { test: 1, market: 0, total: 2 } } } },
    { unassessed: ['accuracy', 'modeling'], agent: { defect_types: ['c'] }, assessments: {
      accuracy: null, scope: { rung_index: 1 }, automation: { flags: [], rung_index: 0 }, modeling: null } },
  ] }] };
  const s = divisionSummary(board, axes);
  assert.equal(s.pairs, 2); assert.equal(s.unassessed, 2); assert.equal(s.stale, 1);
  assert.deepEqual(s.axes.accuracy, { total: 2, unassessed: 1, filled: 1, counts: [0, 1, 0], mean: 80 });
  assert.deepEqual(s.axes.scope.atLeast, [100, 100, 50, 50]);
  assert.equal(s.axes.automation.avg, 1);
  assert.deepEqual(s.axes.automation.adoption, { pre: 50, run: 50 });
  assert.equal(s.axes.modeling.testRate, 33);            // 유형 칸 3개 중 1
  assert.deepEqual(s.axes.modeling.adoption, { geometry: 100, performance: 0 });
});

// ── monthlySeries: 이력을 달마다 되감는다 ──
import { monthlySeries, monthKeys } from './board.js';

test('monthKeys — 최근 n 달, 오래된 달부터', () => {
  assert.deepEqual(monthKeys(3, new Date(2026, 7, 15)), ['2026-06', '2026-07', '2026-08']);
  assert.deepEqual(monthKeys(2, new Date(2026, 0, 3)), ['2025-12', '2026-01']);
});

test('monthlySeries — 그 달 말의 상태로 평균·이상 %·단계 수·재현률을 낸다', () => {
  const axes = [
    { key: 'accuracy', kind: 'value', rungs: [{ key: 'a' }, { key: 'b' }, { key: 'c' }] },
    { key: 'scope', kind: 'rung', rungs: [{ key: 'issue' }, { key: 'basic' }, { key: 'derived_some' }, { key: 'all' }] },
    SET_AXIS, MATRIX_AXIS,
  ];
  const subjects = [{ pairs: [{ id: 1, agent: { defect_types: ['a', 'b'] } }, { id: 2, agent: { defect_types: ['c'] } }] }];
  const changes = [
    { id: 1, pair_id: 1, axis: 'accuracy', before: null, after: '70', created_at: '2026-05-10T00:00:00' },
    { id: 2, pair_id: 1, axis: 'accuracy', before: '70', after: '90', created_at: '2026-07-02T00:00:00' },
    { id: 3, pair_id: 2, axis: 'accuracy', before: null, after: '50', created_at: '2026-07-20T00:00:00' },
    { id: 4, pair_id: 1, axis: 'scope', before: null, after: 'basic', created_at: '2026-05-01T00:00:00' },
    { id: 5, pair_id: 1, axis: 'scope', before: 'basic', after: 'all', created_at: '2026-06-15T00:00:00' },
    { id: 6, pair_id: 1, axis: 'scope', before: null, after: 'issue', note: REACHED_NOTE, created_at: '2024-01-01T00:00:00' },   // 시점 적기 — 뺀다
    { id: 7, pair_id: 1, axis: 'automation', before: null, after: 'pre,run', created_at: '2026-06-01T00:00:00' },
    { id: 8, pair_id: 2, axis: 'automation', before: null, after: 'manual', created_at: '2026-07-01T00:00:00' },
    { id: 9, pair_id: 1, axis: 'modeling', before: null, after: 'geometry|t1/m0', created_at: '2026-07-05T00:00:00' },
  ];
  const rows = monthlySeries(subjects, changes, axes, ['2026-04', '2026-05', '2026-06', '2026-07']);
  assert.deepEqual(rows.map(r => r.accuracy.value), [null, 70, 70, 70]);        // 7월: (90+50)/2
  assert.deepEqual(rows.map(r => r.accuracy.changes), [0, 1, 0, 2]);
  assert.deepEqual(rows.map(r => r.scope.value), [null, 0, 100, 100]);          // derived_some 이상 %
  assert.deepEqual(rows.map(r => r.automation.value), [null, null, 2, 1]);      // 7월: (2+0)/2
  assert.deepEqual(rows.map(r => r.modeling.value), [null, null, null, 50]);    // 유형 칸 2개 중 1
});

import { pairSeries } from './board.js';
test('pairSeries — 연계마다 선 하나, 이력 없는 연계는 빠진다', () => {
  const subjects = [{ name: '낙하', pairs: [{ id: 1, agent: { name: '구조', defect_types: [] } }, { id: 2, agent: { name: '열', defect_types: [] } }] }];
  const changes = [
    { id: 1, pair_id: 1, axis: 'accuracy', before: null, after: '70', created_at: '2026-05-10T00:00:00' },
    { id: 2, pair_id: 1, axis: 'accuracy', before: '70', after: '90', created_at: '2026-07-02T00:00:00' },
  ];
  const axis = { key: 'accuracy', kind: 'value', rungs: [] };
  const rows = pairSeries(subjects, changes, axis, ['2026-04', '2026-05', '2026-06', '2026-07']);
  assert.deepEqual(rows, [{ id: 1, name: '낙하 × 구조', points: [null, 70, 70, 90] }]);
});

import { monthRange } from './board.js';
test('monthRange — 두 연-월 사이, 거꾸로면 바로잡고, 60달 상한', () => {
  assert.deepEqual(monthRange('2025-11', '2026-02'), ['2025-11', '2025-12', '2026-01', '2026-02']);
  assert.deepEqual(monthRange('2026-02', '2025-12'), ['2025-12', '2026-01', '2026-02']);
  assert.deepEqual(monthRange('2026-02', ''), []);
  assert.equal(monthRange('2015-01', '2026-08').length, 60);
});

// ── 날짜 기준 ──
import { baseDate, changedPairsSince, summaryAtDate } from './board.js';

test('baseDate — 1주·2주·1개월·지난 분기 마감', () => {
  const now = new Date(2026, 7, 29);                               // 2026-08-29
  assert.equal(baseDate('w1', now), '2026-08-22');
  assert.equal(baseDate('w2', now), '2026-08-15');
  assert.equal(baseDate('m1', now), '2026-07-29');
  assert.equal(baseDate('quarter', now), '2026-06-30');
  assert.equal(baseDate(null, now), null);
});

test('changedPairsSince — 기준일 뒤에 그 축이 바뀐 연계만, 시점 적기는 뺀다', () => {
  const changes = [
    { pair_id: 1, axis: 'accuracy', before: '70', after: '90', created_at: '2026-08-25T00:00:00' },
    { pair_id: 2, axis: 'accuracy', before: null, after: '60', created_at: '2026-08-10T00:00:00' },
    { pair_id: 3, axis: 'scope', before: null, after: 'basic', created_at: '2026-08-27T00:00:00' },
    { pair_id: 4, axis: 'accuracy', before: null, after: 'basic', note: REACHED_NOTE, created_at: '2026-08-28T00:00:00' },
  ];
  assert.deepEqual([...changedPairsSince(changes, 'accuracy', '2026-08-22')], [1]);
  assert.equal(changedPairsSince(changes, 'accuracy', null).size, 0);
});

test('summaryAtDate — 그 날의 대표 수치(요약 델타의 밑값)', () => {
  const axes = [{ key: 'accuracy', kind: 'value', rungs: [{ key: 'a' }, { key: 'b' }, { key: 'c' }] }];
  const subjects = [{ pairs: [{ id: 1, agent: {} }, { id: 2, agent: {} }] }];
  const changes = [
    { id: 1, pair_id: 1, axis: 'accuracy', before: null, after: '70', created_at: '2026-08-01T00:00:00' },
    { id: 2, pair_id: 1, axis: 'accuracy', before: '70', after: '90', created_at: '2026-08-25T00:00:00' },
    { id: 3, pair_id: 2, axis: 'accuracy', before: null, after: '50', created_at: '2026-08-24T00:00:00' },
  ];
  assert.equal(summaryAtDate(subjects, changes, axes, '2026-08-22').accuracy, 70);
  assert.equal(summaryAtDate(subjects, changes, axes, '2026-08-26').accuracy, 70);   // (90+50)/2
});

test('부문을 옮겨도 보던 탭은 지키되, 그 부문에 없는 탭이면 성숙도로', () => {
  assert.equal(tabInSector('list', 'digital_thread'), 'list');          // 목록은 어느 부문에나 있다
  assert.equal(tabInSector('list', 'manufacturing_monitoring'), 'list');
  assert.equal(tabInSector('reviews', 'simulation'), 'reviews');        // 해석 활용 기록은 시뮬레이션만
  assert.equal(tabInSector('reviews', 'digital_thread'), null);
  assert.equal(tabInSector('cases', 'digital_thread'), 'cases');        // 연계 개발 기록은 스레드만
  assert.equal(tabInSector('cases', 'simulation'), null);
  assert.equal(tabInSector(null, 'simulation'), null);                  // 성숙도는 그대로 성숙도
  assert.equal(tabInSector('board', 'simulation'), null);
});
