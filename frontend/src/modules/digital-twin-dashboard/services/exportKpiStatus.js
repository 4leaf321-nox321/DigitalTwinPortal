import * as XLSX from 'xlsx-js-style';
import { statusSheet, todoSheets, statusFileName } from '../utils/methodStatus';

/**
 * 「KPI 연계 현황」을 엑셀 한 권으로 내려받는다(2026-08-30 요청).
 *
 * 판 셋
 *     현황            모달의 표 그대로 — 조직마다 (과제→연계 · 연계→기여방법)
 *     미연계 과제      아무 KPI에도 안 걸린 과제
 *     기여방법 미입력   연결은 섰는데 「어떻게 기여하는가」가 빈 줄
 *
 * ⚠️ 숫자 판만 뽑으면 「몇 건 남았다」까지만 말한다. **무엇이** 남았는지가 있어야
 *    엑셀을 열어 놓고 채우러 갈 수 있다 — 그래서 할 일 둘을 함께 넣는다.
 *
 * ⚠️ 화면에 이미 있는 것으로 만든다. 서버를 따로 찌르지 않는다 — 표의 숫자와
 *    파일의 숫자가 갈릴 길을 아예 두지 않으려는 것이다.
 *
 * 판을 짜는 셈은 utils/methodStatus 에 있고(시험이 본다) 여기는 **꾸며서 저장**만 한다.
 */

const HEAD = { font: { bold: true }, fill: { fgColor: { rgb: 'EFF6FF' } } };
const SUM = { font: { bold: true }, fill: { fgColor: { rgb: 'F1F5F9' } } };

/** 열 폭 — 글자 수에 맞춰 어림잡는다. 엑셀에서 열마다 끌어 늘리지 않게. */
const widths = (rows) => {
  const n = Math.max(...rows.map((r) => r.length), 0);
  return Array.from({ length: n }, (_, c) => {
    const len = rows.reduce((m, r) => Math.max(m, String(r[c] ?? '').length), 0);
    return { wch: Math.min(Math.max(len + 2, 8), 42) };
  });
};

const addSheet = (wb, name, rows, { sumLastRow = false } = {}) => {
  // 머리글만 있으면 넣지 않는다 — 빈 판이 있으면 「뽑다 만 것」처럼 보인다.
  if (!rows || rows.length <= 1) return;
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = widths(rows);
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({
    s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: rows[0].length - 1 } }) };
  rows[0].forEach((_, c) => {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = HEAD;
  });
  if (sumLastRow) {
    const r = rows.length - 1;
    rows[r].forEach((_, c) => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) cell.s = SUM;
    });
  }
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));   // 엑셀 판 이름은 31자까지
};

export const exportKpiStatus = ({ year, orgStatus, source }) => {
  const wb = XLSX.utils.book_new();
  addSheet(wb, '현황', statusSheet(orgStatus), { sumLastRow: true });

  const { unlinked, noMethod } = todoSheets(source);
  addSheet(wb, '미연계 과제', unlinked);
  addSheet(wb, '기여방법 미입력', noMethod);

  if (!wb.SheetNames.length) throw new Error('내려받을 자료가 없습니다.');
  XLSX.writeFile(wb, statusFileName(year));
};

export default { exportKpiStatus };
