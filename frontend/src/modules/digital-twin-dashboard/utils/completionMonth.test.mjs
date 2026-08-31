// 「완료 현황」의 셈 — 과제가 몇 월 칸에 서는가.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotOf, lastDoneDate, completionTable, cellCounts, cellProjects } from './completionMonth.js';

const NOW = new Date(2026, 7, 31);          // 2026-08-31 기준으로 본다
const Y = 2026;

/** 과제 하나. 액션아이템은 [완료여부, 완료일] 짝으로 짧게 적는다. */
const P = (o) => ({
  사업부: 'MX', 진행상태: '정상진행', 종료: 6, 과제명: 'p', ...o,
  액션아이템목록: (o.items || []).map(([done, ymd]) => ({ 완료여부: done, 완료일: ymd })),
});

test('완료는 **가장 늦은** 액션아이템 완료일의 달에 선다', () => {
  const p = P({ 진행상태: '완료', 종료: 12, items: [[true, '2026-02-15'], [true, '2026-05-03'], [false, '']] });
  assert.equal(lastDoneDate(p), '2026-05-03');
  const s = slotOf(p, Y, NOW);
  assert.equal(s.kind, 'done');
  assert.equal(s.month, 5);          // 종료 월(12)이 아니라 실제로 끝난 달
  assert.equal(s.estimated, false);
  assert.equal(s.doneDate, '2026-05-03');
});

test('세부항목의 완료일도 함께 본다 — 거기만 적는 사람이 있다', () => {
  const p = {
    사업부: 'MX', 진행상태: '완료', 종료: 3,
    액션아이템목록: [{ 완료여부: true, 완료일: '2026-03-01',
      세부항목목록: [{ 완료여부: true, 완료일: '2026-04-20' }] }],
  };
  assert.equal(lastDoneDate(p), '2026-04-20');
  assert.equal(slotOf(p, Y, NOW).month, 4);
});

test('완료인데 완료일이 없으면 종료 월로 세되 **그렇다고 말한다**', () => {
  // ⚠️ 이게 대부분이다(개발 DB 완료 22건 중 16건). 빼면 완료의 3/4 가 표에서 사라지고,
  //    조용히 종료 월로 세면 「실제 완료일 기준」이라는 말이 거짓이 된다.
  const s = slotOf(P({ 진행상태: '완료', 종료: 9, items: [[false, '']] }), Y, NOW);
  assert.equal(s.kind, 'done');
  assert.equal(s.month, 9);
  assert.equal(s.estimated, true);
  assert.equal(s.doneDate, null);
});

test('완료일이 그 해 밖이면 12월에 몰아넣지 않는다 — 따로 센다', () => {
  const s = slotOf(P({ 진행상태: '완료', 종료: 1, items: [[true, '2025-12-20']] }), Y, NOW);
  assert.equal(s.outOfRange, true);
  assert.equal(s.month, null);
  const { rows } = completionTable({ projects: [P({ 진행상태: '완료', 종료: 1, items: [[true, '2025-12-20']] })], year: Y, now: NOW });
  assert.equal(rows[0].out.done, 1);
  assert.equal(rows[0].cells.reduce((n, c) => n + c.done, 0), 0);   // 어느 달에도 안 섰다
});

test('안 끝난 것은 종료 월에 서고, 기한이 지났으면 지연이다', () => {
  assert.equal(slotOf(P({ 종료: 11 }), Y, NOW).kind, 'pending');    // 8월 기준 11월은 아직
  assert.equal(slotOf(P({ 종료: 11 }), Y, NOW).month, 11);
  assert.equal(slotOf(P({ 종료: 3 }), Y, NOW).kind, 'late');        // 3월은 이미 지났다
  assert.equal(slotOf(P({ 종료: 8 }), Y, NOW).kind, 'pending');     // 이번 달은 아직 지연이 아니다
  // 지난 해를 보고 있으면 안 끝난 것은 전부 지연이다
  assert.equal(slotOf(P({ 종료: 12 }), 2025, NOW).kind, 'late');
  // 다음 해는 아직 오지 않았다
  assert.equal(slotOf(P({ 종료: 1 }), 2027, NOW).kind, 'pending');
});

test('취소는 표에 아예 안 선다 — 「안 한 일」이지 「못 끝낸 일」이 아니다', () => {
  assert.equal(slotOf(P({ 진행상태: '취소', 종료: 4 }), Y, NOW), null);
  const { totals } = completionTable({ projects: [P({ 진행상태: '취소' })], year: Y, now: NOW });
  assert.equal(totals.total.done + totals.total.pending + totals.total.late, 0);
});

test('종료 월이 없으면 달을 모르는 칸으로 — 없는 달에 세우지 않는다', () => {
  const { rows } = completionTable({ projects: [P({ 종료: null })], year: Y, now: NOW });
  assert.equal(rows[0].none.pending, 1);
  assert.equal(rows[0].cells.reduce((n, c) => n + c.pending, 0), 0);
});

test('사업부마다 줄, 달마다 칸, 합계는 줄의 합', () => {
  const projects = [
    P({ 사업부: 'MX', 진행상태: '완료', 종료: 12, items: [[true, '2026-03-14']] }),
    P({ 사업부: 'MX', 종료: 3 }),                                    // 지연
    P({ 사업부: 'VD', 진행상태: '완료', 종료: 5, items: [] }),        // 완료일 없음 → 5월, 추정
    P({ 사업부: 'VD', 종료: 11 }),                                   // 아직
  ];
  const { rows, totals } = completionTable({ projects, year: Y, divisions: ['MX', 'VD'], now: NOW });
  const mx = rows.find((r) => r.division === 'MX');
  assert.equal(mx.cells[2].done, 1);            // 3월 완료 1
  assert.equal(mx.cells[2].late, 1);            // 3월 지연 1 — 같은 칸에 둘이 선다
  const vd = rows.find((r) => r.division === 'VD');
  assert.equal(vd.cells[4].done, 1);
  assert.equal(vd.cells[4].estimated, 1);       // 별표가 붙어야 한다
  assert.equal(vd.cells[10].pending, 1);
  assert.equal(totals.cells[2].done + totals.cells[4].done, 2);
  assert.equal(totals.total.done, 2);
  assert.equal(totals.total.late, 1);
  assert.equal(totals.total.pending, 1);
});

test('과제에만 있는 사업부도 줄이 선다 — 조용히 사라지면 합계가 안 맞는다', () => {
  const { rows, totals } = completionTable({
    projects: [P({ 사업부: '새조직', 종료: 2 })], year: Y, divisions: ['MX'], now: NOW,
  });
  assert.deepEqual(rows.map((r) => r.division), ['MX', '새조직']);
  assert.equal(totals.total.late, 1);
});

test('사업부가 비어 있어도 버리지 않는다', () => {
  const { rows } = completionTable({ projects: [P({ 사업부: '', 종료: 2 })], year: Y, now: NOW });
  assert.equal(rows[0].division, '(사업부 없음)');
});

test('보기(완료만·아직만·둘 다)에 따라 세는 것이 달라진다', () => {
  const cell = { done: 3, pending: 2, late: 1, estimated: 1, projects: [] };
  assert.deepEqual(cellCounts(cell, 'both'), { done: 3, open: 3, late: 1, estimated: 1 });
  assert.deepEqual(cellCounts(cell, 'done'), { done: 3, open: 0, late: 0, estimated: 1 });
  assert.deepEqual(cellCounts(cell, 'pending'), { done: 0, open: 3, late: 1, estimated: 0 });
});

test('칸을 누르면 그 갈래의 과제만 나온다', () => {
  const projects = [
    P({ 과제명: '끝난 것', 진행상태: '완료', 종료: 4, items: [[true, '2026-04-02']] }),
    P({ 과제명: '아직', 종료: 4 }),
  ];
  const { rows } = completionTable({ projects, year: Y, now: NOW });
  const april = rows[0].cells[3];
  assert.deepEqual(cellProjects(april, 'both').map((p) => p.과제명), ['끝난 것', '아직']);
  assert.deepEqual(cellProjects(april, 'done').map((p) => p.과제명), ['끝난 것']);
  assert.deepEqual(cellProjects(april, 'pending').map((p) => p.과제명), ['아직']);
});

test('빈 자료에도 안 터진다', () => {
  const { rows, totals } = completionTable({ projects: [], year: Y, now: NOW });
  assert.deepEqual(rows, []);
  assert.equal(totals.total.done, 0);
  assert.equal(completionTable().rows.length, 0);
});
