import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import maturityApi from '../../services/maturityApi';

// 시스템 지도(2026-08-28) — 시스템이 노드, 구간이 간선. 노드 크기는 지나는 구간 수, 간선 색은 연결 방식.
// 대시보드 「관계도」와 같은 그림 문법(d3-force). 스레드 하나를 고르면 그 줄만 밝게.

const LINK_COLORS = ['#fca5a5', '#fdba74', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a'];
const KIND_COLORS = { plm: '#1d4ed8', cad: '#2563eb', cae: '#0891b2', spdm: '#0e7490', requirements: '#7c3aed', erp: '#059669', mes: '#16a34a', qms: '#d97706', cost: '#b45309', purchase: '#65a30d', cs: '#dc2626', test: '#ca8a04', hub: '#475569', informal: '#9ca3af', other: '#6b7280' };

const Wrap = styled.div`display: flex; flex-direction: column; gap: 0.4rem; min-height: 0;`;
const Bar = styled.div`display: flex; gap: 0.3rem; flex-wrap: wrap; font-size: 0.75rem; align-items: center;`;
const Chip = styled.button`padding: 0.15rem 0.55rem; border-radius: 999px; border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#cbd5e1')}; background: ${p => (p.$on ? '#1d4ed8' : 'white')}; color: ${p => (p.$on ? 'white' : '#475569')}; font-family: inherit; font-size: 0.75rem; cursor: pointer;`;
const Svg = styled.svg`width: 100%; height: 22rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; background: #fafcff;`;
const Muted = styled.div`font-size: 0.8125rem; color: #94a3b8;`;

const W = 720, H = 352;

export const buildGraph = (segments, systems) => {
  const sys = Object.fromEntries(systems.map(s => [s.id, s]));
  const nodes = {};
  const links = [];
  const touch = (id) => { if (id && sys[id] && !nodes[id]) nodes[id] = { id, name: sys[id].name, kind: sys[id].kind, count: 0 }; if (id && nodes[id]) nodes[id].count += 1; };
  segments.forEach(seg => {
    const li = seg.pair?.assessments?.link_mode?.rung_index ?? null;
    const chain = [seg.from_system_id, seg.via_system_id, seg.to_system_id].filter(Boolean);
    chain.forEach(touch);
    const uniq = chain.filter((v, i) => chain.indexOf(v) === i);
    for (let i = 0; i + 1 < uniq.length; i += 1) {
      if (nodes[uniq[i]] && nodes[uniq[i + 1]]) links.push({ source: uniq[i], target: uniq[i + 1], link: li, thread_id: seg.thread_id, name: seg.name, pair_id: seg.pair_id });
    }
    if (uniq.length === 1 && nodes[uniq[0]]) links.push({ source: uniq[0], target: uniq[0], link: li, thread_id: seg.thread_id, name: seg.name, pair_id: seg.pair_id, self: true });
  });
  return { nodes: Object.values(nodes), links };
};

const SystemMap = ({ divisionId, threads = [], onOpenPair }) => {
  const [segments, setSegments] = useState([]);
  const [systems, setSystems] = useState([]);
  const [focus, setFocus] = useState(null);
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (divisionId == null || divisionId === 'all') return;
    Promise.all([maturityApi.listSegments(divisionId), maturityApi.listSystems()])
      .then(([s, sy]) => { setSegments(s.data || []); setSystems(sy.data || []); }).catch(() => {});
  }, [divisionId]);
  const graph = useMemo(() => buildGraph(segments, systems), [segments, systems]);
  useEffect(() => {
    if (!graph.nodes.length) { setPos(null); return; }
    const nodes = graph.nodes.map(n => ({ ...n }));
    const links = graph.links.filter(l => !l.self).map(l => ({ ...l }));
    const sim = forceSimulation(nodes)
      .force('link', forceLink(links).id(d => d.id).distance(110))
      .force('charge', forceManyBody().strength(-260))
      .force('center', forceCenter(W / 2, H / 2))
      .force('collide', forceCollide(34))
      .stop();
    for (let i = 0; i < 200; i += 1) sim.tick();
    setPos(Object.fromEntries(nodes.map(n => [n.id, { x: Math.max(40, Math.min(W - 40, n.x)), y: Math.max(28, Math.min(H - 28, n.y)) }])));
  }, [graph]);
  if (!graph.nodes.length) return <Muted>시스템을 적은 구간이 없습니다.</Muted>;
  const dim = (tid) => focus != null && tid !== focus;
  return (
    <Wrap>
      <Bar>
        <Chip type="button" $on={focus == null} onClick={() => setFocus(null)}>전부</Chip>
        {threads.map(t => <Chip key={t.id} type="button" $on={focus === t.id} onClick={() => setFocus(focus === t.id ? null : t.id)}>{t.name}</Chip>)}
        <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>노드 = 시스템(크기는 지나는 구간 수) · 간선 = 구간(색은 연결 방식) · 간선을 누르면 그 구간</span>
      </Bar>
      <Svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="시스템 지도">
        {pos && graph.links.filter(l => !l.self).map((l, i) => {
          const a = pos[l.source], b = pos[l.target];
          if (!a || !b) return null;
          return (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={l.link == null ? '#cbd5e1' : LINK_COLORS[Math.min(l.link, 5)]} strokeWidth={l.link == null ? 1.5 : 2 + l.link * 0.6}
                  strokeDasharray={l.link == null ? '4 3' : undefined} opacity={dim(l.thread_id) ? 0.12 : 0.9} style={{ cursor: 'pointer' }}
                  onClick={() => l.pair_id && onOpenPair && onOpenPair(l.pair_id)}>
              <title>{l.name}</title>
            </line>
          );
        })}
        {pos && graph.nodes.map(n => {
          const p = pos[n.id];
          const r = 12 + Math.min(n.count, 8) * 2.2;
          const dimmed = focus != null && !graph.links.some(l => l.thread_id === focus && (l.source === n.id || l.target === n.id));
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`} opacity={dimmed ? 0.2 : 1}>
              <circle r={r} fill={KIND_COLORS[n.kind] || KIND_COLORS.other} stroke={n.kind === 'informal' ? '#f59e0b' : 'white'} strokeWidth={n.kind === 'informal' ? 2.5 : 2} strokeDasharray={n.kind === 'informal' ? '3 2' : undefined}>
                <title>{n.name} · {n.kind} · 구간 {n.count}</title>
              </circle>
              <text y={r + 12} textAnchor="middle" fontSize="10" fill="#334155" fontWeight="600">{n.name}</text>
            </g>
          );
        })}
      </Svg>
    </Wrap>
  );
};

export default SystemMap;
