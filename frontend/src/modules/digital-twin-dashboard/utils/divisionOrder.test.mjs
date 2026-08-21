/**
 * 사업부 차례. **설정이 정본**이고, 설정이 없으면 정식 순서로 떨어진다.
 *
 * 왜 시험하나
 *     같은 대시보드 안에서 화면마다 차례가 달랐다(2026-08-21 정리). 배열을 손으로
 *     박아 둔 자리가 다섯 곳이었고 서로 어긋나 있었다. 그것을 걷어내고 이 한
 *     곳으로 모았으므로, 여기가 틀리면 **모든 화면이 함께 틀린다.**
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIVISION_ORDER_FALLBACK, divisionRank, compareDivisionNames,
  compareProjects, sortDivisionNames, sortDivisionEntries,
} from './divisionOrder.js';

const CANON = ['MX', 'VD', 'DA', 'NW', '의료기기', 'SR', 'GTR', 'CS'];
const settings = { divisions: CANON.map(name => ({ name })) };
const messy = ['CS', 'GTR', '의료기기', 'MX', 'SR', 'NW', 'VD', 'DA'];

test('정식 순서가 상수와 같다', () => {
  assert.deepEqual(DIVISION_ORDER_FALLBACK, CANON);
});

test('설정이 있으면 설정 차례', () => {
  assert.deepEqual(sortDivisionNames(messy, settings), CANON);
});

test('설정이 없으면 정식 순서 — 이름순으로 흐르지 않는다', () => {
  // 이름순이면 CS·DA·GTR·MX… 가 된다. 그 꼴을 막으려고 폴백을 둔 것이다.
  assert.deepEqual(sortDivisionNames(messy, {}), CANON);
  assert.deepEqual(sortDivisionNames(messy, null), CANON);
  assert.deepEqual(sortDivisionNames(messy, undefined), CANON);
});

test('SR 이 GTR 보다 앞', () => {
  assert.deepEqual(sortDivisionNames(['GTR', 'SR'], {}), ['SR', 'GTR']);
});

test('일부만 있어도 그 안에서 정식 순서', () => {
  assert.deepEqual(sortDivisionNames(['CS', 'DA', 'SR'], {}), ['DA', 'SR', 'CS']);
});

test('설정이 폴백을 이긴다 — 폴백은 대신할 뿐이다', () => {
  const weird = { divisions: [{ name: 'CS' }, { name: 'MX' }] };
  assert.deepEqual(sortDivisionNames(['MX', 'CS'], weird), ['CS', 'MX']);
});

test('모르는 사업부는 뒤로, 자기들끼리는 이름순', () => {
  // 뒤에 몰아넣되 그 안에서도 차례가 있어야 한다. 안 그러면 목록이 흔들린다.
  assert.deepEqual(sortDivisionNames(['미지정', 'MX', 'ZZ'], {}), ['MX', '미지정', 'ZZ']);
});

test('원본 배열을 뒤집지 않는다', () => {
  // 남의 배열을 조용히 정렬하는 함수는 다음 사람이 반드시 밟는다.
  const src = ['CS', 'MX'];
  sortDivisionNames(src, settings);
  assert.deepEqual(src, ['CS', 'MX']);
});

test('빈 입력·이상한 입력', () => {
  assert.deepEqual(sortDivisionNames([], settings), []);
  assert.deepEqual(sortDivisionNames(null, settings), []);
  assert.deepEqual(sortDivisionNames(undefined, settings), []);
});

test('이름이 빈 설정 항목은 무시한다', () => {
  const holey = { divisions: [{ name: 'CS' }, { name: '' }, null, { name: 'MX' }] };
  assert.deepEqual(sortDivisionNames(['MX', 'CS'], holey), ['CS', 'MX']);
});

test('divisionRank — 설정에 없으면 큰 값', () => {
  const rank = divisionRank(settings);
  assert.equal(rank('MX'), 0);
  assert.equal(rank('CS'), 7);
  assert.ok(rank('없는사업부') > 100);
});

test('compareProjects — 사업부 차례 다음에 과제명 가나다', () => {
  const rows = [
    { 사업부: 'GTR', 과제명: '나 과제' },
    { 사업부: 'MX', 과제명: '하 과제' },
    { 사업부: 'SR', 과제명: '가 과제' },
    { 사업부: 'MX', 과제명: '가 과제' },
  ];
  assert.deepEqual(
    [...rows].sort(compareProjects(settings)).map(r => `${r.사업부}/${r.과제명}`),
    ['MX/가 과제', 'MX/하 과제', 'SR/가 과제', 'GTR/나 과제']);
});

test('compareProjects — 값이 비어도 안 터진다', () => {
  const rows = [{}, { 사업부: 'MX' }, { 과제명: '가' }, null];
  assert.doesNotThrow(() => [...rows].sort(compareProjects(settings)));
});

test('compareDivisionNames 를 직접 써도 같은 차례', () => {
  assert.deepEqual([...messy].sort(compareDivisionNames(settings)), CANON);
});

test('sortDivisionEntries — [이름, 값] 짝도 같은 차례', () => {
  const entries = [['CS', 3], ['MX', 1], ['SR', 2]];
  assert.deepEqual(sortDivisionEntries(entries, settings).map(e => e[0]), ['MX', 'SR', 'CS']);
});
