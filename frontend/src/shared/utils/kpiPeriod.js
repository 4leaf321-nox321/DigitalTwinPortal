/**
 * KPI 기간 라벨 — **주·월·분기의 정의를 한곳에 둔다.**
 *
 * 왜 공용으로 뺐나
 *   같은 날짜가 화면마다 다른 주로 잡히고 있었다. DX KPI 관리는 ISO 주(월요일 시작,
 *   목요일 기준)를 쓰고, 대시보드의 다른 그래프는 일요일 시작에 1~52 로 자르는
 *   자기 셈법을 썼다. 두 화면이 같은 KPI 자료를 그리면서 「N주차」가 서로 다른 주를
 *   가리키면 값을 견줄 수 없다.
 *
 *   KPI 자료를 그리는 자리는 **ISO 주**로 통일한다(DX KPI 관리 쪽 정의).
 */

export const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

export const MONTH_TO_QUARTER = {
  '1월': 'Q1', '2월': 'Q1', '3월': 'Q1',
  '4월': 'Q2', '5월': 'Q2', '6월': 'Q2',
  '7월': 'Q3', '8월': 'Q3', '9월': 'Q3',
  '10월': 'Q4', '11월': 'Q4', '12월': 'Q4',
};

/** ISO 8601 주 번호. 그 주의 **목요일**이 속한 해가 그 주의 해다. */
export const getISOWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;          // 일요일(0) → 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);  // 그 주의 목요일로 옮긴다
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

/** 'YYYY-MM-DD' → '30주'. 날짜가 아니면 null. */
export const weekLabelOf = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return `${getISOWeek(date)}주`;
};

/** 'YYYY-MM-DD' → '7월'. 날짜가 아니면 null. */
export const monthLabelOf = (dateStr) => {
  if (!dateStr) return null;
  const m = parseInt(String(dateStr).split('-')[1], 10);
  return m >= 1 && m <= 12 ? `${m}월` : null;
};

/** 그 해의 주 라벨 전부. 자료가 없는 주도 가로축에 자리를 잡아야 해서 필요하다. */
export const weeksForYear = (year) => {
  const lastWeek = getISOWeek(new Date(year, 11, 28));   // 12/28 은 늘 그 해 마지막 ISO 주
  return Array.from({ length: lastWeek }, (_, i) => `${i + 1}주`);
};

/**
 * '30주' → '7월'. 목표가 주 단위로 없을 때 월·분기 목표를 찾아 올라가는 데 쓴다.
 *
 * 기준은 그 주의 **목요일**이다. 월요일로 잡으면 1주차 월요일이 전년 12월일 수 있어
 * 엉뚱한 분기로 매핑된다.
 */
export const monthLabelForWeek = (year, weekLabel) => {
  const weekNum = parseInt(weekLabel, 10);
  if (Number.isNaN(weekNum)) return null;
  const jan4 = new Date(year, 0, 4);                     // 1/4 는 늘 ISO 1주차
  const jan4Day = jan4.getDay() || 7;
  const thursday = new Date(year, 0, 4 - jan4Day + 4 + (weekNum - 1) * 7);
  return `${thursday.getMonth() + 1}월`;
};
