// 판 셈의 규칙 — 축은 순서형이라 평균을 내지 않고, 필터는 쌍이 안 남는 시험을 뺀다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  colorFor, distribution, applyFilters, filtersToParams, filtersFromParams,
  accuracyLabel, changesByMonth,
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

test('필터는 쌍을 좁히고, 쌍이 안 남는 시험은 뺀다', () => {
  // 12 는 두 축을 다 매겼다 — 미평가가 없으니 빠진다
  assert.deepEqual(applyFilters(SUBJECTS, { unassessedOnly: true }).map(s => s.pairs.map(p => p.id)),
    [[11], [21]]);
  assert.deepEqual(applyFilters(SUBJECTS, { staleOnly: true }).map(s => s.pairs.map(p => p.id)), [[12]]);
  assert.deepEqual(applyFilters(SUBJECTS, { family: 'A' }).map(s => s.id), [2]);
  assert.deepEqual(applyFilters(SUBJECTS, { modelKind: 'physics' }).map(s => s.pairs.map(p => p.id)), [[11]]);
  assert.deepEqual(applyFilters(SUBJECTS, { axis: 'automation', minRung: 1 }).map(s => s.pairs.map(p => p.id)), [[11]]);
  assert.deepEqual(applyFilters(SUBJECTS, {}).length, 2);
  // 쌍 없는 시험 — 조건이 없으면 보이고, 쌍 조건이 켜지면 빠진다
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

test('이력은 쌍·달로 묶인다', () => {
  const m = changesByMonth([
    { pair_id: 1, created_at: '2026-02-03T10:00:00' },
    { pair_id: 1, created_at: '2026-02-20T10:00:00' },
    { pair_id: 2, created_at: '2026-05-01T10:00:00' },
    { pair_id: 3, created_at: null },
  ]);
  assert.deepEqual(Object.keys(m), ['1', '2']);
  assert.equal(m[1]['2026-02'].length, 2);
});

// ── reachedDates: 「지금 이어지고 있는 도달의 시작」 — 껐다 켠 것·내려온 칸은 시점이 없다 ──
import { reachedDates, REACHED_NOTE } from './board.js';

const SET_AXIS = { key: 'automation', kind: 'set', rungs: [{ key: 'manual' }, { key: 'pre' }, { key: 'run' }, { key: 'post' }] };
const RUNG_AXIS = { key: 'scope', kind: 'rung', rungs: [{ key: 'issue' }, { key: 'basic' }, { key: 'all' }] };
const at = (m) => `${m}-01T12:00:00`;

test('묶음 축: 켰다 끈 항목은 시점이 없고, 다시 켜면 그 달부터', () => {
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
