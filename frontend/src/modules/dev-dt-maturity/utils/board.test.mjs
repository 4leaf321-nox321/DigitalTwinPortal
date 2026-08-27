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
