/**
 * 화면에 보이는 그대로를 CSV 글자열로 만든다 (로컬 저장).
 * 내려받기는 화면 쪽에서 하고, 여기서는 글자열만 만든다 — 그래야 시험할 수 있다.
 */
import { COLUMNS } from '../constants';
import { PIVOT_DIMENSIONS, buildPivot } from './buildPivot';

/** 쉼표·따옴표·줄바꿈이 섞여도 칸이 밀리지 않게 감싼다. */
export const escapeCsv = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value)
    .replace(/\r\n/g, ' ')
    .replace(/[\r\n]/g, ' ');
  if (str.includes(',') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const toCsv = (rows) => rows.map(cells => cells.map(escapeCsv).join(',')).join('\r\n');

/**
 * 목록 화면 → CSV.
 * 걸러지고 정렬된 차례 그대로 받는다(화면과 같은 차례로 저장하려고).
 */
export const investmentsToCsv = (rows = []) => {
  const header = COLUMNS.map(c => c.label);
  const body = rows.map(row => COLUMNS.map(col => {
    const v = row[col.key];
    // 금액·년도는 숫자로 그대로 내보낸다. 자릿점을 찍으면 엑셀이 글자로 읽는다.
    if (v === null || v === undefined) return '';
    return v;
  }));
  return toCsv([header, ...body]);
};

/**
 * 피벗 화면 → CSV.
 *
 * 화면은 같은 값을 세로로 합쳐 두지만, 파일에서는 **줄마다 다시 적는다** —
 * 빈 칸으로 두면 엑셀에서 걸러 보거나 다시 피벗할 때 쓸 수 없다.
 * 값이 없는 칸은 화면의 '-' 대신 빈 칸으로 둔다(그래야 숫자 열로 읽힌다).
 */
export const pivotToCsv = (rows = [], orders = {}) => {
  const pivot = buildPivot(rows, orders);
  const { years, groups, grandTotal } = pivot;

  const header = [
    ...PIVOT_DIMENSIONS.map(d => d.label),
    ...years.flatMap(year => {
      const label = year === '미지정' ? '년도 미지정' : `${year}년`;
      return [`${label} 계획`, `${label} 실적`];
    }),
    '합계 계획', '합계 실적',
  ];

  const amounts = (source) => [
    ...years.flatMap(year => {
      const cell = source.cells[year];
      return cell && cell.count > 0 ? [cell.plan, cell.actual] : ['', ''];
    }),
    source.total.plan,
    source.total.actual,
  ];

  const body = [];
  groups.forEach(group => {
    group.leaves.forEach(leaf => {
      body.push([...leaf.path, ...amounts(leaf)]);
    });
    body.push([
      `「${group.label}」 소계`,
      ...Array(PIVOT_DIMENSIONS.length - 1).fill(''),
      ...amounts(group.subtotal),
    ]);
  });

  body.push([
    `총계 (${pivot.rowCount}건)`,
    ...Array(PIVOT_DIMENSIONS.length - 1).fill(''),
    ...amounts(grandTotal),
  ]);

  return toCsv([header, ...body]);
};
