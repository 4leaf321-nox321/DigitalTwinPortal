/**
 * 전체 요약의 숫자 계산.
 *
 * ⚠️ 여기가 틀리면 **화면은 멀쩡해 보이고 숫자만 조용히 달라진다.** 이 부류로
 *    0.4.3 · 0.4.4 · 0.5.0 · 0.5.2 를 연달아 고쳤다. 그때는 계산이 1만 2천 줄짜리
 *    화면 파일 안에 있어서 시험하려면 소스를 글자로 오려 붙여야 했다. 이제 그냥
 *    불러다 본다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeExecMetrics, projectRemoval, aiExistedAt } from './execMetrics.js';
import { buildAiHistoryIndex, emptyAiHistoryIndex } from './aiHistory.js';

const REF = '2026-08-14';
const OLD_C = '2026-01-20T09:00:00.000Z';   // 기준일보다 한참 앞
const NEW_C = '2026-08-19T09:00:00.000Z';   // 기준일보다 뒤 = 이번 주에 넣음

const noHist = makeExecMetrics({ aiHistory: emptyAiHistoryIndex() });

/** 액션아이템 하나. `doneOn` 이 있으면 완료. */
const item = ({ due = '2026-06-30', doneOn = '', created = OLD_C } = {}) =>
  ({ id: 'ai-' + Math.random(), createdAt: created,
     목표일: due, 완료여부: !!doneOn, 완료일: doneOn });

const many = (n, opts) => Array.from({ length: n }, () => item(opts));

const project = (items, extra = {}) => ({
  uuid: extra.uuid || 'p1', 진행상태: '진행', createdAt: '2026-01-01', 종료: 12,
  액션아이템목록: items, ...extra,
});

const run = (impl, projs, ref = REF) =>
  impl.computeExecMetrics(projs.filter(p => p.진행상태 !== '취소'), ref,
                          projs.filter(p => p.진행상태 === '취소'));

const sum5 = (m) => m.sameItemDelta + m.addedItemEffect + m.deletedItemEffect
                  + m.newEffect + m.removedEffect;
const sumAch = (m) => m.achCompletedEffect + m.achDueEffect + m.achAddedItemEffect
                    + m.achNewProjectEffect + m.achRemovedEffect;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ── 진척률 ────────────────────────────────────────────────────────────────

test('쪼개 넣어도 — 완료가 비례해 늘면 변화량이 0', () => {
  // 10개(5완료)를 20개(10완료)로. 쪼갠 것의 완료일은 **원래 그 일을 한 날짜**라
  // 기준일보다 앞선다. 이것을 분자에만 세면 기준일이 100% 로 부푼다(0.4.3 결함).
  const before = [project(many(10, { doneOn: '2026-05-15' }).slice(0, 5)
                          .concat(many(5)))];
  const after = [project([...many(5, { doneOn: '2026-05-15' }), ...many(5),
                          ...many(5, { doneOn: '2026-05-15', created: NEW_C }),
                          ...many(5, { created: NEW_C })])];
  const b = run(noHist, before), a = run(noHist, after);
  assert.equal(a.currentAvgProgress, b.currentAvgProgress, '지금 진척률은 그대로여야 한다');
  assert.ok(near(a.deltaAvgProgress, b.deltaAvgProgress), '변화량도 그대로여야 한다');
  assert.ok(a.refAvgProgress <= 100, '기준일이 100% 를 넘었다');
  assert.ok(a.refCompletedAI <= a.refTotalAI, '분자가 분모를 넘었다');
});

test('미완료를 새로 넣으면 — 지금 값은 내려가고 그 몫이 「추가」로 잡힌다', () => {
  const projs = [project([...many(5, { doneOn: '2026-05-15' }), ...many(5),
                          ...many(10, { created: NEW_C })])];
  const m = run(noHist, projs);
  assert.equal(m.currentAvgProgress, 25, '5/20 = 25% 여야 한다');
  assert.equal(m.addedItemCount, 10);
  assert.ok(m.addedItemEffect < 0, '추가 영향이 음수여야 한다');
  assert.ok(near(m.sameItemDelta, 0), '기존 항목은 물러서지 않았다');
});

test('진짜 진척과 항목 추가가 섞이지 않는다', () => {
  // 기존 10개 중 5 -> 7 완료(진짜 진척) + 새 10개(2완료)
  const old = [...many(5, { doneOn: '2026-05-15' }),
               ...many(2, { doneOn: '2026-08-18' }),   // 이번 주에 끝냈다
               ...many(3)];
  const m = run(noHist, [project([...old, ...many(2, { doneOn: '2026-05-15', created: NEW_C }),
                                  ...many(8, { created: NEW_C })])]);
  assert.equal(m.commonItemCount, 10);
  assert.equal(m.addedItemCount, 10);
  assert.equal(m.sameItemDelta, 20, '5/10 -> 7/10 = +20%p 가 진척 줄에 남아야 한다');
  assert.ok(m.addedItemEffect < 0);
});

test('다섯 몫의 합은 늘 전체 변화량과 같다', () => {
  const cases = [
    [project(many(4, { doneOn: '2026-05-15' }))],
    [project([...many(3, { doneOn: '2026-05-15' }), ...many(7, { created: NEW_C })])],
    [project(many(5), { uuid: 'a' }), project(many(5, { doneOn: '2026-05-15' }), { uuid: 'b' })],
    [project(many(3), { uuid: 'n', createdAt: '2026-08-18' })],           // 신규 과제
    [project(many(3, { doneOn: '2026-05-15' }), { uuid: 'd', _deleted: true, _deletedAt: '2026-08-18' })],
  ];
  for (const [i, projs] of cases.entries()) {
    const m = run(noHist, projs);
    assert.ok(near(sum5(m), m.deltaAvgProgress),
      `${i}번: 합 ${sum5(m)} vs 변화량 ${m.deltaAvgProgress}`);
  }
});

// ── 달성률 ────────────────────────────────────────────────────────────────

test('기한만 닥쳤을 때 — 완료 몫은 0, 기한 도래 몫이 음수', () => {
  // 목표일 6월 4건(3완료) + 목표일 8/18 4건(미완료). 기준일(8/14)엔 아직 안 왔다.
  const m = run(noHist, [project([
    ...many(3, { doneOn: '2026-05-15' }), item(),
    ...many(4, { due: '2026-08-18' }),
  ])]);
  assert.ok(near(m.achCompletedEffect, 0), '아무것도 안 끝냈는데 완료 몫이 생겼다');
  assert.ok(m.achDueEffect < 0, '기한 도래 몫이 음수여야 한다');
  assert.equal(m.newlyDueCount, 4);
  assert.ok(near(sumAch(m), m.deltaAchievementRate));
});

test('과거 목표일 항목을 무더기로 넣으면 — 「추가」로 잡힌다', () => {
  const m = run(noHist, [project([
    ...many(3, { doneOn: '2026-05-15' }), item(),
    ...many(6, { created: NEW_C }),          // 목표일 6/30, 미완료
  ])]);
  assert.ok(m.achAddedItemEffect < -1, '추가 영향이 잡혀야 한다');
  assert.ok(near(m.achCompletedEffect, 0), '완료 몫은 안 움직여야 한다');
  assert.ok(near(sumAch(m), m.deltaAchievementRate));
});

// ── 이력 ──────────────────────────────────────────────────────────────────

test('이력이 있으면 기준일을 이력에서 읽는다', () => {
  // 지금 항목은 2개뿐인데 기준일엔 4개였다(2개가 지워졌다). 되짚기로는 볼 수 없다.
  const projs = [project(many(2, { doneOn: '2026-05-15' }), { uuid: 'H' })];
  const hist = buildAiHistoryIndex({
    series: [{ uuid: 'H', rows: [{ date: '2026-07-01', total: 4, done: 2 }] }], missing: [] });
  const withHist = makeExecMetrics({ aiHistory: hist });
  assert.equal(run(withHist, projs).refTotalAI, 4, '이력의 4개를 써야 한다');
  assert.equal(run(noHist, projs).refTotalAI, 2, '되짚기는 남은 2개만 본다');
});

test('이력이 없는 과제는 조용히 빠지지 않고 되짚기로 떨어진다', () => {
  // 빠뜨리면 기준일이 「그 과제를 뺀 나머지」가 되어 낙차에 한계가 없다.
  const projs = [project(many(4, { doneOn: '2026-05-15' }), { uuid: 'NOHIST' })];
  const hist = buildAiHistoryIndex({ series: [], missing: ['NOHIST'] });
  assert.equal(makeExecMetrics({ aiHistory: hist }).computeExecMetrics(projs, REF, []).refTotalAI, 4);
});

test('시계열 — 그 주에 없던 항목은 그 주의 셈에서 빠진다', () => {
  const at = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  const projs = [project([...many(5, { doneOn: '2026-05-15' }), ...many(5),
                          ...many(10, { created: NEW_C })])];
  assert.equal(noHist.aiCountProgressAsOf(projs, at('2026-08-07')), 50, '지난주 점은 그대로');
  assert.equal(noHist.aiCountProgressAsOf(projs, at('2026-08-25')), 25, '지금은 내려간다');
});

test('액션아이템이 없으면 null — 0% 로 그리면 「진척 0」 처럼 보인다', () => {
  const at = new Date('2026-08-14T23:59:59');
  assert.equal(noHist.aiCountProgressAsOf([project([])], at), null);
  assert.equal(noHist.aiCountProgressAsOf([], at), null);
});

// ── 곁들여 나가는 것 ──────────────────────────────────────────────────────

test('aiExistedAt — 생성 시각을 모르면 있었던 것으로 본다', () => {
  const at = new Date('2026-08-14T23:59:59');
  assert.equal(aiExistedAt({}, at), true, '모르면 있었던 것으로 봐야 한다');
  assert.equal(aiExistedAt({ createdAt: OLD_C }, at), true);
  assert.equal(aiExistedAt({ createdAt: NEW_C }, at), false);
});

test('projectRemoval — 취소와 삭제 중 먼저 일어난 것', () => {
  assert.equal(projectRemoval({}).reason, '');
  assert.equal(projectRemoval({ 진행상태: '취소', _canceledAt: '2026-05-01' }).reason, '취소');
  assert.equal(projectRemoval({ _deleted: true, _deletedAt: '2026-05-01' }).reason, '삭제');
  // 둘 다면 이른 쪽
  assert.equal(projectRemoval({
    진행상태: '취소', _canceledAt: '2026-05-01',
    _deleted: true, _deletedAt: '2026-06-01' }).reason, '취소');
  assert.equal(projectRemoval({
    진행상태: '취소', _canceledAt: '2026-07-01',
    _deleted: true, _deletedAt: '2026-06-01' }).reason, '삭제');
});

test('취소된 뒤 한 번 고친 것을 「나중에 삭제」로 오판하지 않는다', () => {
  // updatedAt 은 편집할 때마다 갱신된다. 진짜 삭제 시각만 견줘야 한다.
  assert.equal(projectRemoval({
    진행상태: '취소', _canceledAt: '2026-05-01',
    _deleted: true, _deletedAt: null, updatedAt: '2026-08-01' }).reason, '취소');
});
