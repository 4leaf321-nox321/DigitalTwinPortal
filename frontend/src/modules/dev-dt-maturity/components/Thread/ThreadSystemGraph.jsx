import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import maturityApi from '../../services/maturityApi';
import { buildGraph, KIND_COLORS } from './SystemMap';

// 시스템 연결도(2026-08-29) — 모판 옆의 넷째 보기. 시스템이 노드, 구간이 간선인 건 사업부 요약의
// 시스템 지도와 같지만, 여기선 **간선 색 = 스레드**다(지도는 연결 방식 색 — 역할 분담).
// 같은 두 시스템 사이를 여러 스레드가 지나면 평행 곡선으로 나란히 — 두 시스템이 여러 줄의 등뼈임이 보인다.
// 연결 방식은 색 대신 선 모양으로: 자동 전달 이상 = 실선, 사람이 옮김·미평가 = 점선.
// 노드 크기 = 지나는 구간 수. 간선을 누르면 그 구간의 평가판.

const THREAD_COLORS = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

const Wrap = styled.div`display: flex; flex-direction: column; gap: 0.4rem; flex: 1; min-height: 0;`;
const Bar = styled.div`display: flex; gap: 0.3rem; flex-wrap: wrap; font-size: 0.75rem; align-items: center;`;
const Chip = styled.button`
  display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.15rem 0.6rem; border-radius: 999px; font-family: inherit; font-size: 0.75rem; cursor: pointer;
  border: 1px solid ${p => p.$c || '#cbd5e1'}; background: ${p => (p.$on ? p.$c || '#1d4ed8' : 'white')}; color: ${p => (p.$on ? 'white' : '#475569')};
`;
const Dot = styled.span`width: 0.55rem; height: 0.55rem; border-radius: 999px; background: ${p => p.$c}; ${p => (p.$on ? 'background: white;' : '')}`;
const Svg = styled.svg`flex: 1; min-height: 0; width: 100%; border: 1px solid #e2e8f0; border-radius: 0.5rem; background: #fafcff;`;
const Muted = styled.div`padding: 1rem; color: #94a3b8; font-size: 0.8125rem;`;

const W = 960, H = 520;
const AUTO_IDX = 1;   // 연결 축 — 자동 전달부터 「이어진」 것으로 (사람이 옮김 = 0)

/** 같은 두 시스템 사이의 간선들에 평행 곡선 자리(gi/gn)를 매긴다. */
export const withOffsets = (links) => {
  const byPair = {};
  links.forEach(l => {
    const key = [l.source, l.target].sort((a, b) => a - b).join('-');
    (byPair[key] = byPair[key] || []).push(l);
  });
  Object.values(byPair).forEach(g => g.forEach((l, i) => { l.gi = i; l.gn = g.length; }));
  return links;
};

const ThreadSystemGraph = ({ divisionId, onOpenPair }) => {
  const [segments, setSegments] = useState(null);
  const [systems, setSystems] = useState([]);
  const [threads, setThreads] = useState([]);
  const [focus, setFocus] = useState(null);
  const [pos, setPos] = useState(null);
  useEffect(() => {
    Promise.all([maturityApi.listSegments(divisionId ?? 'all'), maturityApi.listSystems(), maturityApi.listThreads()])
      .then(([s, sy, t]) => { setSegments(s.data || []); setSystems(sy.data || []); setThreads(t.data || []); })
      .catch(() => setSegments([]));
  }, [divisionId]);
  const colorOf = useMemo(() => {
    const m = Object.fromEntries(threads.map((t, i) => [t.id, THREAD_COLORS[i % THREAD_COLORS.length]]));
    return (tid) => m[tid] || '#94a3b8';
  }, [threads]);
  const graph = useMemo(() => {
    const g = buildGraph(segments || [], systems);
    withOffsets(g.links.filter(l => !l.self));
    return g;
  }, [segments, systems]);
  useEffect(() => {
    if (!graph.nodes.length) { setPos(null); return; }
    const nodes = graph.nodes.map(n => ({ ...n }));
    const links = graph.links.filter(l => !l.self).map(l => ({ ...l }));
    const sim = forceSimulation(nodes)
      .force('link', forceLink(links).id(d => d.id).distance(140))
      .force('charge', forceManyBody().strength(-340))
      .force('center', forceCenter(W / 2, H / 2))
      .force('collide', forceCollide(42))
      .stop();
    for (let i = 0; i < 250; i += 1) sim.tick();
    setPos(Object.fromEntries(nodes.map(n => [n.id, { x: Math.max(48, Math.min(W - 48, n.x)), y: Math.max(34, Math.min(H - 34, n.y)) }])));
  }, [graph]);
  if (segments == null) return <Muted>불러오는 중…</Muted>;
  if (!graph.nodes.length) return <Muted>시스템을 적은 구간이 없습니다 — 목록에서 구간에 출발·매개·도착 시스템을 채우면 여기 그려집니다.</Muted>;
  const usedThreads = threads.filter(t => graph.links.some(l => l.thread_id === t.id));
  const dim = (tid) => focus != null && tid !== focus;
  const nameOf = (tid) => threads.find(t => t.id === tid)?.name || '스레드 없음';
  return (
    <Wrap>
      <Bar>
        <Chip type="button" $on={focus == null} onClick={() => setFocus(null)}>전부</Chip>
        {usedThreads.map(t => (
          <Chip key={t.id} type="button" $on={focus === t.id} $c={colorOf(t.id)} onClick={() => setFocus(focus === t.id ? null : t.id)}>
            <Dot $c={colorOf(t.id)} $on={focus === t.id} />{t.name}
          </Chip>
        ))}
        <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>간선 색 = 스레드 · 실선 = 자동 전달 이상 · 점선 = 사람이 옮김·미평가 · 간선을 누르면 그 구간</span>
      </Bar>
      <Svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="시스템 연결도">
        {pos && graph.links.filter(l => !l.self).map((l, i) => {
          const a = pos[l.source], b = pos[l.target];
          if (!a || !b) return null;
          const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
          const off = ((l.gi ?? 0) - ((l.gn ?? 1) - 1) / 2) * 14;
          const mx = (a.x + b.x) / 2 + (-dy / len) * off, my = (a.y + b.y) / 2 + (dx / len) * off;
          const solid = l.link != null && l.link >= AUTO_IDX;
          return (
            <path key={i} d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`} fill="none"
                  stroke={colorOf(l.thread_id)} strokeWidth={l.link == null ? 1.6 : 2.2 + l.link * 0.7}
                  strokeDasharray={solid ? undefined : '5 4'} strokeLinecap="round"
                  opacity={dim(l.thread_id) ? 0.1 : 0.85} style={{ cursor: l.pair_id ? 'pointer' : 'default' }}
                  onClick={() => l.pair_id && onOpenPair && onOpenPair(l.pair_id)}>
              <title>{nameOf(l.thread_id)} — {l.name}</title>
            </path>
          );
        })}
        {pos && graph.nodes.map(n => {
          const p = pos[n.id];
          const r = 13 + Math.min(n.count, 8) * 2.4;
          const dimmed = focus != null && !graph.links.some(l => l.thread_id === focus && (l.source === n.id || l.target === n.id));
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`} opacity={dimmed ? 0.18 : 1}>
              <circle r={r} fill={KIND_COLORS[n.kind] || KIND_COLORS.other} stroke={n.kind === 'informal' ? '#f59e0b' : 'white'} strokeWidth={n.kind === 'informal' ? 2.5 : 2} strokeDasharray={n.kind === 'informal' ? '3 2' : undefined}>
                <title>{n.name} · 지나는 구간 {n.count}</title>
              </circle>
              <text y={r + 13} textAnchor="middle" fontSize="11" fill="#334155" fontWeight="600">{n.name}</text>
            </g>
          );
        })}
      </Svg>
    </Wrap>
  );
};

export default ThreadSystemGraph;
