/**
 * 표 정렬 규칙. 화면과 떼어 둔 순수 함수라 그대로 시험해 볼 수 있다.
 */
import { COLUMNS } from '../constants';

const isBlank = (v) => v === null || v === undefined || v === '';

// 금액과 년도는 숫자로 견준다. 나머지는 글자로 견준다.
export const isNumericSort = (col) => col?.type === 'amount' || col?.type === 'year';

/**
 * @param {Array} rows   투자 건 목록
 * @param {{key: string|null, dir: 'asc'|'desc'|null}} sort
 * @returns 정렬된 새 배열. key 가 없으면 받은 배열을 그대로 돌려준다(서버 차례 유지).
 */
export const sortInvestments = (rows, sort) => {
  if (!sort?.key || !sort?.dir) return rows;

  const col = COLUMNS.find(c => c.key === sort.key);
  const numeric = isNumericSort(col);
  const sign = sort.dir === 'desc' ? -1 : 1;

  // Array.prototype.sort 는 안정 정렬이라, 값이 같은 행끼리는 원래 차례를 지킨다.
  return [...rows].sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];

    // 빈 값은 오름/내림과 상관없이 늘 뒤로 보낸다 —
    // 내림차순이라고 빈 칸이 표 맨 위에 몰리면 읽을 게 없다.
    if (isBlank(av) || isBlank(bv)) {
      if (isBlank(av) && isBlank(bv)) return 0;
      return isBlank(av) ? 1 : -1;
    }

    if (numeric) return (Number(av) - Number(bv)) * sign;
    return String(av).localeCompare(String(bv), 'ko') * sign;
  });
};

/** 머리글을 누를 때마다 오름차순 → 내림차순 → 해제 로 한 바퀴 돈다. */
export const nextSort = (prev, key) => {
  if (prev.key !== key) return { key, dir: 'asc' };
  if (prev.dir === 'asc') return { key, dir: 'desc' };
  return { key: null, dir: null };
};
