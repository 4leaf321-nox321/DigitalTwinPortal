/**
 * 액션아이템 이력 조회기 — 「그 날짜 이전 마지막 값」.
 *
 * 왜 시험하나
 *     진척률의 **과거 값 전부**가 이 조회기를 거친다. 여기가 틀리면 카드의
 *     기준일 값도, 조직별 그래프의 지난 점도 함께 틀리는데 **화면은 멀쩡해
 *     보인다.** 숫자만 조용히 다르다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAiHistoryIndex, emptyAiHistoryIndex, ymdOf } from './aiHistory.js';

const payload = {
  series: [
    { uuid: 'A', rows: [
      // 일부러 뒤죽박죽으로 준다 — 서버 차례를 믿고 쓰면 이분 탐색이 조용히 틀린다
      { date: '2026-08-11', total: 2, done: 0 },
      { date: '2026-07-28', total: 4, done: 2 },
      { date: '2026-08-03', total: 4, done: 2 },
    ] },
    { uuid: 'B', rows: [{ date: '2026-08-20', total: 5, done: 5 }] },
    { uuid: 'C', rows: [] },
  ],
  missing: ['D', 'E'],
};
const idx = buildAiHistoryIndex(payload);

test('이력이 있는 과제만 센다', () => {
  assert.equal(idx.projectCount, 2);
  assert.equal(idx.missingCount, 2);
});

test('has', () => {
  assert.equal(idx.has('A'), true);
  assert.equal(idx.has('C'), false);     // rows 가 비었으면 없는 것으로
  assert.equal(idx.has('D'), false);
});

test('정확히 그 날짜', () => {
  assert.deepEqual(idx.at('A', '2026-08-03'), { total: 4, done: 2 });
});

test('기록 없는 날은 앞의 값을 끌고 온다', () => {
  // 값이 안 바뀌면 기록도 안 남는다. 없는 날을 빈칸으로 두면 곡선이 끊긴다.
  assert.deepEqual(idx.at('A', '2026-08-07'), { total: 4, done: 2 });
});

test('마지막 기록 뒤로도 끌고 온다', () => {
  assert.deepEqual(idx.at('A', '2026-09-01'), { total: 2, done: 0 });
});

test('지우고 다시 넣은 자취가 그대로 남는다', () => {
  // 4개(2완료) -> 2개(0완료). 되짚기로는 볼 수 없는 것이 이력에는 있다.
  assert.deepEqual(idx.at('A', '2026-08-15'), { total: 2, done: 0 });
});

test('첫 기록보다 앞선 날은 null — 「0 이었다」가 아니라 「모른다」', () => {
  // 0 으로 채우면 이력이 늦게 시작한 과제가 과거에 진척 0 으로 그려진다.
  assert.equal(idx.at('A', '2026-07-01'), null);
});

test('이력 없는 과제·빈 rows·빈 날짜는 null', () => {
  assert.equal(idx.at('D', '2026-08-15'), null);
  assert.equal(idx.at('C', '2026-08-15'), null);
  assert.equal(idx.at('A', null), null);
  assert.equal(idx.at(null, '2026-08-15'), null);
});

test('빈 응답에도 안 터진다', () => {
  for (const bad of [null, undefined, {}, { series: [] }, { series: 'x' }]) {
    const i = buildAiHistoryIndex(bad);
    assert.equal(i.has('A'), false);
    assert.equal(i.at('A', '2026-08-01'), null);
  }
});

test('emptyAiHistoryIndex — 늘 되짚기로 떨어진다', () => {
  const e = emptyAiHistoryIndex();
  assert.equal(e.has('A'), false);
  assert.equal(e.at('A', '2026-08-01'), null);
});

test('숫자가 아닌 값은 0 으로', () => {
  const i = buildAiHistoryIndex({ series: [{ uuid: 'X', rows: [{ date: '2026-01-01' }] }] });
  assert.deepEqual(i.at('X', '2026-02-01'), { total: 0, done: 0 });
});

test('ymdOf', () => {
  assert.equal(ymdOf(new Date(2026, 7, 21)), '2026-08-21');
  assert.equal(ymdOf('2026-08-21T00:00:00'), '2026-08-21');
  assert.equal(ymdOf(null), null);
  assert.equal(ymdOf('아무말'), null);
});

test('한 자리 수 달·일에 0 을 채운다', () => {
  // '2026-8-3' 으로 나가면 문자열 비교가 어긋나 이력을 못 찾는다.
  assert.equal(ymdOf(new Date(2026, 0, 3)), '2026-01-03');
});
