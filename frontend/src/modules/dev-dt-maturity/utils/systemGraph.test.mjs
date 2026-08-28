// 시스템 연결도의 데이터 판단 — 노드는 시스템, 간선은 구간, 색은 스레드.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemGraph, splay, threadColors, nodesOfThread, THREAD_COLORS, NO_THREAD_COLOR } from './systemGraph.js';

const SYSTEMS = [
  { id: 5, name: 'Teamcenter', kind: 'plm' },
  { id: 6, name: '원가 산정 시스템', kind: 'cost' },
  { id: 9, name: '메일', kind: 'informal' },
];
const THREADS = [{ id: 1, name: '재료비' }, { id: 2, name: '품질' }];
const seg = (id, thread_id, chain, rung_index, pair_id = null) => ({
  id, name: `구간${id}`, thread_id, pair_id,
  from_system_id: chain[0], via_system_id: chain[1], to_system_id: chain[2],
  pair: rung_index == null ? null : { assessments: { link_mode: { rung_index } } },
});

test('구간 하나가 출발 → 매개 → 도착이면 간선 둘', () => {
  const g = buildSystemGraph([seg(1, 1, [5, 9, 6], 0, 901)], SYSTEMS, THREADS);
  assert.equal(g.nodes.length, 3);
  assert.equal(g.links.length, 2);
  assert.deepEqual(g.links.map(l => [l.source, l.target]), [[5, 9], [9, 6]]);
  assert.ok(g.links.every(l => l.pair_id === 901));
});

test('매개가 없으면 출발 → 도착 한 간선, 같은 시스템은 겹치지 않는다', () => {
  const g = buildSystemGraph([seg(1, 1, [5, null, 6], 2)], SYSTEMS, THREADS);
  assert.equal(g.links.length, 1);
  const same = buildSystemGraph([seg(2, 1, [5, 5, 5], 2)], SYSTEMS, THREADS);
  assert.equal(same.links.length, 0);          // 한 시스템 안에서 끝나는 구간은 선이 없다
  assert.equal(same.nodes[0].count, 3);
});

test('사전에 없는 시스템은 노드도 간선도 만들지 않는다', () => {
  const g = buildSystemGraph([seg(1, 1, [5, 99, 6], 2)], SYSTEMS, THREADS);
  assert.deepEqual(g.nodes.map(n => n.id), [5, 6]);
  assert.deepEqual(g.links.map(l => [l.source, l.target]), [[5, 6]]);
});

test('색은 스레드, 선 모양은 연결 방식', () => {
  const g = buildSystemGraph([
    seg(1, 1, [5, null, 6], 0),        // 사람이 옮김 — 점선
    seg(2, 2, [5, null, 6], 1),        // 자동 전달 — 실선
    seg(3, 2, [5, null, 6], null),     // 미평가 — 점선
  ], SYSTEMS, THREADS);
  assert.deepEqual(g.links.map(l => l.color), [THREAD_COLORS[0], THREAD_COLORS[1], THREAD_COLORS[1]]);
  assert.deepEqual(g.links.map(l => l.dashed), [true, false, true]);
  assert.ok(g.links[1].width > g.links[0].width);        // 단계가 높을수록 굵다
});

test('스레드 없는 구간은 회색', () => {
  const g = buildSystemGraph([seg(1, null, [5, null, 6], 1)], SYSTEMS, THREADS);
  assert.equal(g.links[0].color, NO_THREAD_COLOR);
  assert.equal(threadColors(THREADS)(99), NO_THREAD_COLOR);
});

test('같은 두 시스템 사이는 부채처럼 갈라진다 — 방향이 반대라도 같은 쌍', () => {
  const one = splay([{ source: 5, target: 6 }]);
  assert.equal(one[0].curvature, 0.1);
  const three = splay([{ source: 5, target: 6 }, { source: 6, target: 5 }, { source: 5, target: 6 }]);
  assert.deepEqual(three.map(l => Math.round(l.curvature * 100) / 100), [-0.22, 0, 0.22]);
  assert.equal(new Set(three.map(l => l.curvature)).size, 3);
});

test('노드 크기의 근거 — 지나는 구간 수', () => {
  const g = buildSystemGraph([seg(1, 1, [5, 9, 6], 0), seg(2, 2, [5, null, 6], 1)], SYSTEMS, THREADS);
  assert.deepEqual(Object.fromEntries(g.nodes.map(n => [n.label, n.count])),
    { Teamcenter: 2, 메일: 1, '원가 산정 시스템': 2 });
});

test('고른 스레드가 지나는 시스템만 추린다 — 간선 끝이 객체로 바뀌어도', () => {
  const g = buildSystemGraph([seg(1, 1, [5, 9, 6], 0), seg(2, 2, [5, null, 6], 1)], SYSTEMS, THREADS);
  assert.deepEqual([...nodesOfThread(g.links, 1)].sort(), [5, 6, 9]);
  assert.deepEqual([...nodesOfThread(g.links, 2)].sort(), [5, 6]);
  const painted = g.links.map(l => ({ ...l, source: { id: l.source }, target: { id: l.target } }));
  assert.deepEqual([...nodesOfThread(painted, 2)].sort(), [5, 6]);
});
