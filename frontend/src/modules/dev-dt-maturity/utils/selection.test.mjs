// 여럿 고르기 규칙. 마우스 조작은 서버 렌더로 못 보니 여기서 못 박는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangeIds, nextSelection, dragSelection, keepBulkDraft, rightMode } from './selection.js';

const ITEMS = [1, 2, 3, 4, 5].map(id => ({ id }));
const S0 = { selected: [], anchor: null };

test('보통 클릭은 그 하나만', () => {
  assert.deepEqual(nextSelection(ITEMS, { selected: [1, 2], anchor: 1 }, 4), { selected: [4], anchor: 4 });
});

test('Ctrl 로 셋 이상 쌓인다 — 셋째에서 비지 않는다', () => {
  let s = nextSelection(ITEMS, S0, 1);
  s = nextSelection(ITEMS, s, 3, { ctrl: true });
  s = nextSelection(ITEMS, s, 5, { ctrl: true });
  assert.deepEqual(s, { selected: [1, 3, 5], anchor: 5 });
  assert.equal(rightMode(s.selected.length), 'many');
  // 2개→3개: 일괄 초안은 지켜야 한다 — 이것이 깨졌던 자리
  assert.equal(keepBulkDraft(2, 3), true);
  assert.equal(keepBulkDraft(1, 2), false);
  assert.equal(keepBulkDraft(3, 1), false);
});

test('Ctrl 로 이미 고른 것을 누르면 빠진다', () => {
  const s = nextSelection(ITEMS, { selected: [1, 3, 5], anchor: 5 }, 3, { ctrl: true });
  assert.deepEqual(s.selected, [1, 5]);
});

test('Shift 는 anchor 부터 범위, 거꾸로도 된다', () => {
  assert.deepEqual(nextSelection(ITEMS, { selected: [2], anchor: 2 }, 4, { shift: true }), { selected: [2, 3, 4], anchor: 2 });
  assert.deepEqual(nextSelection(ITEMS, { selected: [4], anchor: 4 }, 2, { shift: true }).selected, [2, 3, 4]);
  // anchor 가 없으면 보통 클릭처럼
  assert.deepEqual(nextSelection(ITEMS, S0, 3, { shift: true }), { selected: [3], anchor: 3 });
});

test('드래그는 anchor 부터 지나는 곳까지', () => {
  assert.deepEqual(dragSelection(ITEMS, 1, 3), [1, 2, 3]);
  assert.deepEqual(dragSelection(ITEMS, 5, 3), [3, 4, 5]);
  assert.equal(dragSelection(ITEMS, null, 3), null);
});

test('목록에 없는 id 면 범위 대신 그것만', () => {
  assert.deepEqual(rangeIds(ITEMS, 99, 2), [2]);
});
