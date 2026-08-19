/**
 * 피벗 표 만들기.
 *
 * 가로는 투자년도, 세로는 투자 유형 → 사업부 → 프로세스 → 디지털 트윈 영역 차례로 파고든다.
 * 화면과 떼어 둔 순수 함수라 그대로 시험해 볼 수 있다.
 */
import { COLUMNS } from '../constants';

// 기준열 차례. 이 배열이 곧 왼쪽 열의 차례이자 묶는 깊이다.
// 이름표는 표의 열 정의(COLUMNS)에서 가져온다 — 이름을 바꿀 때 두 군데를
// 고치다 한쪽만 바뀌는 일이 없도록 정본을 하나로 둔다.
const labelOf = (key) => COLUMNS.find(c => c.key === key)?.label || key;

export const PIVOT_DIMENSIONS = ['category1', 'division', 'process', 'category2']
  .map(key => ({ key, label: labelOf(key) }));

export const UNSET = '(미지정)';    // 기준열 값이 비었을 때
export const NO_YEAR = '미지정';    // 투자년도가 비었을 때

const SEP = '\u0000';               // 경로를 잇는 구분자 (사람이 쓸 일 없는 글자)

const isBlank = (v) => v === null || v === undefined || v === '';

const emptyCell = () => ({ plan: 0, actual: 0, count: 0 });

const addRow = (cell, row) => {
  cell.plan += Number(row.planAmount) || 0;
  cell.actual += Number(row.actualAmount) || 0;
  cell.count += 1;
};

const addCell = (target, source) => {
  target.plan += source.plan;
  target.actual += source.actual;
  target.count += source.count;
};

/** 같은 해 칸에 값을 얹는다. 없으면 만들어 둔다. */
const bumpYear = (cells, yearKey, apply) => {
  if (!cells[yearKey]) cells[yearKey] = emptyCell();
  apply(cells[yearKey]);
};

/**
 * 기준열 값의 차례.
 *
 * 투자 유형·사업부·프로세스·디지털 트윈 영역은 모두 **정해 둔 차례**가 있다(투자 유형 고정 목록,
 * 사업부/프로세스는 대시보드의 order, 디지털 트윈 영역은 설정에 담긴 차례). 가나다로
 * 늘어놓으면 한글이 로마자보다 앞서서 「플랫폼, H/W, S/W」 같은 뜻 없는 차례가
 * 된다. 그래서 정해 둔 목록을 먼저 따르고, 거기 없는 값만 가나다로 뒤에 붙인다.
 * 미지정은 어느 자리에서든 맨 뒤다.
 */
const compareLabel = (a, b, order = []) => {
  if (a === b) return 0;
  if (a === UNSET) return 1;
  if (b === UNSET) return -1;

  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;    // 목록에 있는 값이 앞
  if (ib !== -1) return 1;
  return a.localeCompare(b, 'ko');
};

const dimValue = (row, key) => (isBlank(row[key]) ? UNSET : String(row[key]));
const yearOf = (row) => (isBlank(row.year) ? NO_YEAR : String(row.year));

/**
 * @param {Array} rows 투자 건 목록 (이미 걸러진 것)
 * @param {{category1?: string[], division?: string[], process?: string[], category2?: string[]}} orders
 *        기준열별로 정해 둔 차례. 없으면 가나다로 늘어놓는다.
 * @returns {{years: string[], groups: Array, grandTotal: object, rowCount: number}}
 */
export const buildPivot = (rows = [], orders = {}) => {
  // ── 가로: 연도 열. 오름차순이고, 년도가 빈 건은 맨 오른쪽 한 칸으로 몬다.
  const yearKeys = new Set(rows.map(yearOf));
  const years = [...yearKeys].filter(y => y !== NO_YEAR).sort((a, b) => Number(a) - Number(b));
  if (yearKeys.has(NO_YEAR)) years.push(NO_YEAR);

  // ── 세로: 기준열 네 개를 모두 합친 것이 잎 하나다.
  const leafMap = new Map();
  rows.forEach(row => {
    const path = PIVOT_DIMENSIONS.map(d => dimValue(row, d.key));
    const key = path.join(SEP);
    if (!leafMap.has(key)) leafMap.set(key, { path, cells: {}, total: emptyCell() });
    const leaf = leafMap.get(key);
    bumpYear(leaf.cells, yearOf(row), cell => addRow(cell, row));
    addRow(leaf.total, row);
  });

  const leaves = [...leafMap.values()].sort((x, y) => {
    for (let i = 0; i < PIVOT_DIMENSIONS.length; i += 1) {
      const c = compareLabel(x.path[i], y.path[i], orders[PIVOT_DIMENSIONS[i].key]);
      if (c !== 0) return c;
    }
    return 0;
  });

  // ── 투자 유형 단위로 묶고 소계를 낸다.
  const groups = [];
  leaves.forEach(leaf => {
    let group = groups[groups.length - 1];
    if (!group || group.label !== leaf.path[0]) {
      group = { label: leaf.path[0], leaves: [], subtotal: { cells: {}, total: emptyCell() } };
      groups.push(group);
    }
    group.leaves.push(leaf);

    Object.entries(leaf.cells).forEach(([yearKey, cell]) => {
      bumpYear(group.subtotal.cells, yearKey, target => addCell(target, cell));
    });
    addCell(group.subtotal.total, leaf.total);
  });

  // ── 같은 값이 세로로 이어지면 한 칸으로 합친다(rowSpan).
  //    묶음 안에서만 따지면 되는 게, 투자 유형은 이미 묶음의 이름이라서다.
  groups.forEach(group => {
    group.leaves.forEach((leaf, i) => {
      leaf.spans = PIVOT_DIMENSIONS.map((_, depth) => {
        const prefix = (p) => p.slice(0, depth + 1).join(SEP);
        const mine = prefix(leaf.path);
        if (i > 0 && prefix(group.leaves[i - 1].path) === mine) {
          return { render: false, rowSpan: 0 };   // 위 칸에 합쳐졌다
        }
        let rowSpan = 1;
        while (i + rowSpan < group.leaves.length && prefix(group.leaves[i + rowSpan].path) === mine) {
          rowSpan += 1;
        }
        return { render: true, rowSpan };
      });
    });
  });

  // ── 총계
  const grandTotal = { cells: {}, total: emptyCell() };
  groups.forEach(group => {
    Object.entries(group.subtotal.cells).forEach(([yearKey, cell]) => {
      bumpYear(grandTotal.cells, yearKey, target => addCell(target, cell));
    });
    addCell(grandTotal.total, group.subtotal.total);
  });

  return { years, groups, grandTotal, rowCount: rows.length };
};
