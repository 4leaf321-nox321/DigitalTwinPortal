// 샘플 뷰의 경로 맞추기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSample } from './sampleResolve.js';

const STORE = {
  '/definitions': { axes: {} },
  '/board?division_id=all&sector=simulation': { boards: [1] },
  '/changes?division_id=17&sector=simulation&days=365': [{ id: 1 }],
  '/reviews?division_id=17&year=2026': [{ id: 9 }],
};

test('정확한 키는 그대로, days 만 다른 키는 같은 사업부의 것을 쓴다', () => {
  assert.deepEqual(resolveSample('/definitions', 'GET', STORE).data, { axes: {} });
  assert.deepEqual(resolveSample('/changes?division_id=17&sector=simulation&days=1825', 'GET', STORE).data, [{ id: 1 }]);
  assert.deepEqual(resolveSample('/reviews?division_id=17&year=2026&kind=cause', 'GET', STORE).data, [{ id: 9 }]);   // kind 는 없는 인자 — 같은 키
});

test('다른 사업부의 키는 빌리지 않고 빈 답 · 저장은 거절', () => {
  assert.deepEqual(resolveSample('/changes?division_id=18&sector=simulation&days=365', 'GET', STORE).data, []);
  assert.equal(resolveSample('/pairs/5', 'GET', STORE).data, null);   // 없는 연계는 null — 화면이 「없는 연계」로 읽는다
  assert.throws(() => resolveSample('/pairs/5/assessments/accuracy', 'PUT', STORE), /저장되지 않습니다/);
});
