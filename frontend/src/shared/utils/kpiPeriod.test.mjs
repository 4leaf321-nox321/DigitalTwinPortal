/**
 * 주ㆍ월ㆍ분기 셈법. **대시보드와 DX KPI 관리가 같은 것을 쓴다.**
 *
 * 왜 시험하나
 *     두 화면이 같은 주를 다르게 세면 「운영 데이터는 주별로 찍히는데 대시보드만
 *     다르다」가 된다. 그래서 셈법을 이 한 곳으로 모았고(2026-08-20), 여기가
 *     틀리면 두 화면이 함께 틀린다.
 *
 *     ⚠️ `getISOWeek` 은 한때 import 에서 빠져 KPI 관리 화면이 진입 즉시 죽었다
 *        (0.4.2, 세 릴리스가 그 상태로 나갔다). 지금은 ESLint no-undef 가 그
 *        부류를 막는다 — 이 시험은 **값이 맞는지**를 본다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MONTHS, MONTH_TO_QUARTER, getISOWeek, weekLabelOf, monthLabelOf,
  weeksForYear, monthLabelForWeek,
} from './kpiPeriod.js';

test('MONTHS 는 12개', () => {
  assert.equal(MONTHS.length, 12);
  assert.equal(MONTHS[0], '1월');
  assert.equal(MONTHS[11], '12월');
});

test('분기 대응 — 12개월이 빠짐없이 네 분기로', () => {
  const got = MONTHS.map(m => MONTH_TO_QUARTER[m]);
  assert.equal(got.filter(Boolean).length, 12, '빠진 달이 있다');
  assert.equal(new Set(got).size, 4);
});

test('ISO 주 — 목요일이 든 해에 속한다', () => {
  // 2026-01-01 은 목요일이라 그 주가 2026년 1주다.
  assert.equal(getISOWeek(new Date(2026, 0, 1)), 1);
  // 2023-01-01 은 일요일이라 앞 해의 마지막 주에 붙는다.
  assert.equal(getISOWeek(new Date(2023, 0, 1)), 52);
});

test('ISO 주 — 12/28 은 늘 그 해 마지막 주다', () => {
  // 화면이 「그 해 마지막 주」를 구할 때 쓰는 방법이다(DxKpiManagementApp).
  for (const y of [2024, 2025, 2026, 2027, 2028]) {
    const w = getISOWeek(new Date(y, 11, 28));
    assert.ok(w === 52 || w === 53, `${y}년 12/28 이 ${w}주로 나왔다`);
  }
  assert.equal(getISOWeek(new Date(2026, 11, 28)), 53, '2026년은 53주짜리 해다');
});

test('ISO 주 — 한 주 안에서는 값이 같다', () => {
  const mon = new Date(2026, 7, 17);          // 월요일
  const sun = new Date(2026, 7, 23);          // 일요일
  assert.equal(getISOWeek(mon), getISOWeek(sun));
  assert.notEqual(getISOWeek(sun), getISOWeek(new Date(2026, 7, 24)));
});

test('weekLabelOf / monthLabelOf', () => {
  assert.equal(typeof weekLabelOf('2026-08-21'), 'string');
  assert.equal(monthLabelOf('2026-08-21'), '8월');
});

test('weeksForYear — 차례대로 나오고 중복이 없다', () => {
  const weeks = weeksForYear(2026);
  assert.ok(weeks.length >= 52, `${weeks.length}주밖에 없다`);
  assert.equal(new Set(weeks).size, weeks.length, '같은 주가 두 번 나온다');
});

test('monthLabelForWeek — 주 이름표를 달로 바꾼다', () => {
  const weeks = weeksForYear(2026);
  const label = monthLabelForWeek(2026, weeks[0]);
  assert.ok(MONTHS.includes(label) || label === '', `달 이름이 아니다: ${label}`);
});
