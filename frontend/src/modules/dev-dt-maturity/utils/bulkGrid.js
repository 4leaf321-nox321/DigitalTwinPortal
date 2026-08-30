// 일괄 입력 표의 셈 — 붙여넣은 것을 칸에 앉히고, 고를 수 있는 값과 맞춰 본다(2026-08-30).
//
// 화면(BulkInputModal)에서 떼어 둔다 — 「어디서부터 채우나 · 머리글 줄을 건너뛰나 ·
// 붙여넣은 글자가 목록에 있나」는 그리기가 아니라 셈이라, 여기 두어야 `npm test` 가 읽는다.

/** 이름 비교의 규칙 하나 — 앞뒤·연속 공백과 대소문자를 무시한다(서버의 norm 과 같은 결). */
export const norm = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** 붙여넣은 글 → 표. 탭이 있으면 탭으로, 없으면 쉼표로 나눈다(엑셀은 탭으로 준다). */
export const parseClipboard = (text) => {
  const rows = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  while (rows.length && !rows[rows.length - 1].trim()) rows.pop();
  if (!rows.length) return [];
  const sep = rows.some(r => r.includes('\t')) ? '\t' : ',';
  return rows.map(r => r.split(sep).map(c => c.trim()));
};

/** 첫 줄이 머리글인가 — 열 이름과 절반 넘게 겹치면 그렇다고 본다. */
export const looksLikeHeader = (row, columns) => {
  if (!row || !row.length) return false;
  const cols = new Set(columns.map(norm));
  const hit = row.filter(c => cols.has(norm(c))).length;
  return hit >= Math.max(1, Math.ceil(row.length / 2));
};

/**
 * 붙여넣기 — (r0, c0) 부터 앉힌다. 표가 모자라면 늘린다.
 * 값이 그 열의 목록에 있으면 **목록의 글자로 바꿔** 앉힌다(대소문자·공백 차이를 흡수).
 */
export const applyPaste = (grid, columns, choices, text, r0 = 0, c0 = 0) => {
  const table = parseClipboard(text);
  if (!table.length) return grid;
  const body = looksLikeHeader(table[0], columns) ? table.slice(1) : table;
  const next = grid.map(row => [...row]);
  const blank = () => columns.map(() => '');
  body.forEach((cells, i) => {
    const r = r0 + i;
    while (next.length <= r) next.push(blank());
    cells.forEach((raw, j) => {
      const c = c0 + j;
      if (c >= columns.length) return;
      next[r][c] = canon(raw, choices?.[columns[c]]);
    });
  });
  return next;
};

export const SEP = ' | ';   // 여럿을 담는 칸의 정본 구분자(서버의 SEP 과 같다)

/** 한 칸을 여럿으로 — `|` 가 있으면 그것만, 없으면 옛 표(· 또는 ,).
 *
 * ⚠️ 값 자체에 · 가 든 것이 있어(「원가·단가」) · 로 나누면 쪼개진다. 그래서 `|` 가 정본이다. */
export const splitCell = (v) => {
  const s = String(v ?? '');
  if (s.includes('|')) return s.split('|').map(p => p.trim()).filter(Boolean);
  return s.split(/[·,]/).map(p => p.trim()).filter(Boolean);
};

/** 목록이 있으면 그 글자로 맞춘다 — 없으면 적은 그대로 둔다(화면이 「못 찾음」으로 짚는다). */
export const canon = (raw, options) => {
  const v = String(raw ?? '').trim();
  if (!v || !options || !options.length) return v;
  const hit = options.find(o => norm(o) === norm(v));
  if (hit) return hit;
  // 여럿을 담는 칸(생애 단계·데이터 종류) — `|` 가 정본, 옛 표(·,)도 받는다.
  // 통째로 맞는 것은 위에서 이미 걸렀다 — 「원가·단가」를 쪼개지 않으려는 것이다.
  const parts = splitCell(v);
  if (parts.length > 1) {
    const mapped = parts.map(p => options.find(o => norm(o) === norm(p)) || p);
    return mapped.join(SEP);
  }
  return v;
};

/** 그 칸의 값이 목록 밖인가 — 빈 칸은 아니다. */
export const isUnknown = (value, options) => {
  const v = String(value ?? '').trim();
  if (!v || !options || !options.length) return false;
  if (options.some(o => norm(o) === norm(v))) return false;   // 통째로 맞으면 됐다(「원가·단가」)
  return splitCell(v).some(p => !options.some(o => norm(o) === norm(p)));
};

/** 빈 줄(전부 비었음)은 뺀다 — 표 아래 남은 줄까지 서버에 보내면 오류만 늘어난다. */
export const usedRows = (grid) => grid.filter(row => row.some(c => String(c ?? '').trim()));

/** 표 → 붙여넣기 글(서버가 받는 것). 머리글을 앞에 붙인다. */
export const toText = (grid, columns) =>
  [columns, ...usedRows(grid)].map(r => columns.map((_, i) => String(r[i] ?? '').trim()).join('\t')).join('\n');

export const emptyGrid = (columns, rows = 8) =>
  Array.from({ length: rows }, () => columns.map(() => ''));
