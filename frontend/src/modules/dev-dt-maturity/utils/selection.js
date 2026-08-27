// 목록에서 여럿 고르기 — 클릭 · Ctrl+클릭 · Shift+클릭 · 드래그 범위의 규칙.
//
// 화면이 아니라 여기에 두는 이유: 마우스 조작은 서버 렌더로 못 보므로, 규칙을 순수
// 함수로 빼서 시험한다(2026-08-28 — Ctrl 로 셋째를 고르면 화면이 비던 결함이 계기).

/** items 순서에서 a~b 사이의 id 목록. 둘 중 하나가 목록에 없으면 b 만. */
export const rangeIds = (items, a, b) => {
  const ia = items.findIndex(i => i.id === a);
  const ib = items.findIndex(i => i.id === b);
  if (ia < 0 || ib < 0) return [b];
  const [lo, hi] = ia < ib ? [ia, ib] : [ib, ia];
  return items.slice(lo, hi + 1).map(i => i.id);
};

/**
 * 클릭 한 번 뒤의 상태. { selected, anchor }
 *   보통 클릭   그 하나만. anchor 도 그것
 *   Ctrl/Cmd    있으면 빼고 없으면 더한다(고른 순서 유지). anchor 는 그것
 *   Shift       anchor 부터 그것까지 범위. anchor 는 그대로
 */
export const nextSelection = (items, { selected, anchor }, id, { shift = false, ctrl = false } = {}) => {
  if (shift && anchor != null) return { selected: rangeIds(items, anchor, id), anchor };
  if (ctrl) {
    const has = selected.includes(id);
    return { selected: has ? selected.filter(x => x !== id) : [...selected, id], anchor: id };
  }
  return { selected: [id], anchor: id };
};

/** 드래그 중 어떤 항목 위를 지날 때. anchor 가 없으면 그대로. */
export const dragSelection = (items, anchor, id) =>
  (anchor == null ? null : rangeIds(items, anchor, id));

/**
 * 오른쪽에 무엇을 그리는가 — 「하나」「여럿」「없음」. 그리고 일괄 초안을 지켜야 하는가.
 * ⚠️ 여럿→여럿으로 바뀔 때 초안을 지운 것이 결함이었다. 초안은 「여럿이 아니게 될 때만」 지운다.
 */
export const rightMode = (count) => (count === 0 ? 'none' : count === 1 ? 'one' : 'many');
export const keepBulkDraft = (prevCount, nextCount) => rightMode(prevCount) === 'many' && rightMode(nextCount) === 'many';
