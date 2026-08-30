// 가입자 현황의 셈 — 주·월·연으로 묶고, 빈 칸도 0 으로 채워 줄이 끊기지 않게.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketOf, signupSeries, viewSeries, bucketLabel } from '../utils/signupStats.js';

const u = (iso) => ({ created_at: iso });

test('주는 월요일에 시작한다', () => {
  assert.equal(bucketOf('2026-08-30T10:00:00', 'week'), '2026-08-24');   // 일요일 → 그 주 월요일
  assert.equal(bucketOf('2026-08-24T00:10:00', 'week'), '2026-08-24');   // 월요일 → 그대로
  assert.equal(bucketOf('2026-08-23T23:50:00', 'week'), '2026-08-17');   // 앞 주 일요일
});

test('월과 해로도 묶는다', () => {
  assert.equal(bucketOf('2026-08-30T10:00:00', 'month'), '2026-08');
  assert.equal(bucketOf('2026-01-01T00:00:00', 'month'), '2026-01');
  assert.equal(bucketOf('2026-08-30T10:00:00', 'year'), '2026');
});

test('가입이 없던 칸도 0 으로 채운다 — 줄이 끊기지 않게', () => {
  const { rows } = signupSeries([u('2026-01-15'), u('2026-04-02')], 'month', 24, new Date('2026-04-20'));
  assert.deepEqual(rows.map(r => r.bucket), ['2026-01', '2026-02', '2026-03', '2026-04']);
  assert.deepEqual(rows.map(r => r.신규), [1, 0, 0, 1]);
});

test('누계는 그때까지의 합', () => {
  const { rows } = signupSeries([u('2026-01-15'), u('2026-01-20'), u('2026-03-02')], 'month', 24, new Date('2026-03-10'));
  assert.deepEqual(rows.map(r => r.누계), [2, 2, 3]);
});

test('오늘이 속한 칸까지 이어 그린다 — 마지막 가입 뒤가 비어도', () => {
  const { rows } = signupSeries([u('2026-01-15')], 'month', 24, new Date('2026-03-10'));
  assert.equal(rows[rows.length - 1].bucket, '2026-03');
  assert.equal(rows[rows.length - 1].신규, 0);
  assert.equal(rows[rows.length - 1].누계, 1);
});

test('뒤에서 keep 개만 남긴다', () => {
  const { rows } = signupSeries([u('2020-01-15')], 'year', 3, new Date('2026-03-10'));
  assert.deepEqual(rows.map(r => r.bucket), ['2024', '2025', '2026']);
});

test('가입 시각이 없는 사람은 빼고 세되, 몇 명인지 알려 준다', () => {
  const { rows, unknown, total } = signupSeries([u('2026-01-15'), {}, u(null)], 'month', 24, new Date('2026-01-20'));
  assert.equal(unknown, 2);
  assert.equal(total, 3);
  assert.equal(rows[0].신규, 1);
});

test('아무도 없으면 빈 줄', () => {
  assert.deepEqual(signupSeries([], 'month').rows, []);
});


// ── 조회수 현황 ─────────────────────────────────────────────────────────────
// 서버가 **자기가 가진 칸만** 준다(빈 달은 아예 없다). 채우고 누계를 내는 것은 여기서 한다.
const v = (bucket, views, visitors = 1, logins = 0) => ({ bucket, views, visitors, logins });

test('조회수 — 빈 칸을 채우고 누계를 낸다', () => {
  const { rows, total } = viewSeries([v('2026-01', 10), v('2026-04', 5)], 'month', 24, new Date('2026-04-20'));
  assert.deepEqual(rows.map(r => r.bucket), ['2026-01', '2026-02', '2026-03', '2026-04']);
  assert.deepEqual(rows.map(r => r.조회), [10, 0, 0, 5]);
  assert.deepEqual(rows.map(r => r.누계), [10, 10, 10, 15]);
  assert.equal(total, 15);
});

test('조회수 — 방문자와 로그인도 실려 온다', () => {
  const { rows, logins } = viewSeries([v('2026-03', 40, 7, 12)], 'month', 24, new Date('2026-03-10'));
  assert.equal(rows[0].방문자, 7);
  assert.equal(rows[0].로그인, 12);
  assert.equal(logins, 12);
});

test('조회수 — 잘라 낸 앞쪽도 누계에는 들어간다', () => {
  // keep 가 2 여도 「지금까지 모두 몇」은 맞아야 한다
  const { rows } = viewSeries([v('2026-01', 10), v('2026-02', 5), v('2026-03', 1)], 'month', 2, new Date('2026-03-10'));
  assert.deepEqual(rows.map(r => r.bucket), ['2026-02', '2026-03']);
  assert.deepEqual(rows.map(r => r.누계), [15, 16]);
});

test('조회수 — 이력이 없으면 빈 줄', () => {
  assert.deepEqual(viewSeries([], 'month').rows, []);
});

test('가로 눈금의 글자는 둘이 같다', () => {
  assert.equal(bucketLabel('2026', 'year'), '2026년');
  assert.equal(bucketLabel('2026-08', 'month'), '26/08');
  assert.equal(bucketLabel('2026-08-24', 'week'), '08/24');
});
