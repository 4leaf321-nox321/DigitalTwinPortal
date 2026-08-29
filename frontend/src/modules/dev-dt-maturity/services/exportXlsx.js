import * as XLSX from 'xlsx-js-style';
import maturityApi from './maturityApi';
import { isSampleMode } from '../sample/sampleStore';
import {
  assessmentSheet, changeSheet, subjectSheet, agentSheet, reviewSheet, systemSheet, caseSheet, fileName,
} from '../utils/exportSheets';

/**
 * 「추출」 — 지금 보고 있는 부문의 입력 자료를 엑셀 한 권으로 내려받는다(2026-08-30).
 *
 * ⚠️ 자료는 **maturityApi 로만** 받는다. 그래야 샘플 뷰에서 목업이 그대로 나온다 —
 *    서버를 따로 찌르면 샘플 뷰에서 빈 파일이 나오고, 그걸 아무도 눈치채지 못한다.
 *
 * 판은 넷~여섯: 평가 · 대상 · 수단 · 이력 (+ 부문별로 해석 활용 기록 / 시스템 사전 · 연계 개발 기록).
 * 판을 짜는 셈은 utils/exportSheets 에 있고(시험이 본다) 여기는 **받아서 붙이고 저장**만 한다.
 */

const HEAD = { font: { bold: true }, fill: { fgColor: { rgb: 'EFF6FF' } } };

/** 열 폭 — 글자 수에 맞춰 어림잡는다. 엑셀에서 열마다 끌어 늘리지 않게. */
const widths = (rows) => {
  const n = Math.max(...rows.map(r => r.length), 0);
  return Array.from({ length: n }, (_, c) => {
    const len = rows.reduce((m, r) => Math.max(m, String(r[c] ?? '').length), 0);
    return { wch: Math.min(Math.max(len + 2, 8), 42) };
  });
};

const addSheet = (wb, name, rows) => {
  if (!rows || rows.length <= 1) return;              // 머리글만 있으면 안 넣는다
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = widths(rows);
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  rows[0].forEach((_, c) => {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = HEAD;
  });
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));   // 엑셀 판 이름은 31자까지
};

export const exportMaturity = async ({ divisionId, divisionName, sector, sectorDef, axes, defs }) => {
  const all = divisionId === 'all';
  const board = (await maturityApi.getBoard(divisionId, sector)).data;
  const boards = all ? (board.boards || []) : [{ division_name: divisionName || '', subjects: board.subjects || [] }];

  // 이력 — 전체면 사업부마다 받아 잇는다(판과 같은 차례로).
  const changeLists = await Promise.all(
    (all ? boards.map(b => b.division_id) : [divisionId])
      .map(id => maturityApi.getChanges(id, sector, 1825).then(r => r.data || []).catch(() => [])),
  );
  const changes = changeLists.flat();

  // 대상은 **판에서** 짠다 — 판에는 평가가 없는 대상도 들어 있고, 부문 꾸밈(구간의 스레드·조직·
  // 시스템)이 이미 붙어 있다. 목록 API 를 또 부르면 꾸밈이 없는 맨 줄이 와서 열이 빈다.
  const subs = boards.flatMap(b => (b.subjects || []).map(s => ({ ...s, division_name: b.division_name })));
  // 수단이 없는 부문(디지털 스레드)은 부르지 않는다 — 부르면 그 부문에 없는 것을 묻는 셈이다.
  const ags = sectorDef?.has_agent === false ? []
    : await maturityApi.listAgents(divisionId, sector).then(r => (Array.isArray(r.data) ? r.data : [])).catch(() => []);

  const subjectLabel = sectorDef?.subject_label || '대상';
  const agentLabel = sectorDef?.agent_label || '수단';
  const wb = XLSX.utils.book_new();
  addSheet(wb, '평가', assessmentSheet(boards, axes, sector, agentLabel, subjectLabel));
  addSheet(wb, subjectLabel, subjectSheet(subs, sector, subjectLabel));
  if (sectorDef?.has_agent !== false) addSheet(wb, agentLabel, agentSheet(ags, sector, agentLabel));
  addSheet(wb, '이력', changeSheet(changes, axes));

  if (sector === 'simulation') {
    // 해석 활용 기록 — 해가 여럿이면 다 받는다(대개 한둘이다).
    const years = await maturityApi.reviewYears(all ? '' : divisionId).then(r => r.data || []).catch(() => []);
    const lists = await Promise.all(years.slice(0, 6).map(y => maturityApi.listReviews(all ? 'all' : divisionId, y, '')
      .then(r => (Array.isArray(r.data) ? r.data : [])).catch(() => [])));
    addSheet(wb, '해석 활용 기록', reviewSheet(lists.flat(), defs?.review));
  }
  if (sector === 'digital_thread') {
    const [systems, cases] = await Promise.all([
      maturityApi.listSystems().then(r => (Array.isArray(r.data) ? r.data : [])).catch(() => []),
      maturityApi.listThreadCases(all ? 'all' : divisionId).then(r => (Array.isArray(r.data) ? r.data : [])).catch(() => []),
    ]);
    addSheet(wb, '시스템 사전', systemSheet(systems, defs?.thread));
    addSheet(wb, '연계 개발 기록', caseSheet(cases, defs?.thread));
  }

  if (!wb.SheetNames.length) throw new Error('내려받을 자료가 없습니다.');
  XLSX.writeFile(wb, fileName({
    sectorLabel: sectorDef?.label || sector, divisionName: all ? '전체' : divisionName, sample: isSampleMode(),
  }));
};

export default { exportMaturity };
