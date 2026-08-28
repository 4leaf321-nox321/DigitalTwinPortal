import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { forceCollide } from 'd3-force';
import { KIND_COLORS, nodesOfThread } from '../../utils/systemGraph';

/**
 * 시스템 연결도의 캔버스 — `react-force-graph-2d` 를 성숙도 쪽에서 쓰는 얇은 껍데기(2026-08-29).
 *
 * 대시보드의 관계도(`GraphView/GraphCanvas`)와 **같은 라이브러리·같은 조작**이지만 코드는
 * 따로 둔다. 저쪽 `graphPaint` 는 과제·성과·KPI 라는 대시보드 어휘에 붙어 있어서
 * (노드 종류표·관계명별 색·알약 그리기) 여기 시스템·스레드에 맞추려면 저 화면을 건드려야 한다.
 * 간판 화면을 흔들 값어치가 아직 없어 **필요한 만큼만 옮겨 적었다.** 대신 저기서 값을 치르고
 * 배운 함정 둘은 그대로 가져온다:
 *
 *   ① lazy import — 무거운 라이브러리다. 이 보기를 한 번도 안 여는 사람이 값을 치르면 안 된다.
 *   ② 데이터를 반드시 클론 — force-graph 는 넘긴 객체를 직접 고친다(노드에 x·y 를 심고
 *      링크의 source/target 을 노드 객체로 바꿔치기한다). 서버 응답을 그대로 주면 두 번째
 *      그림에서 짝이 안 맞고 캐시해 둔 응답까지 오염된다.
 */

const ForceGraph2D = lazy(() => import('react-force-graph-2d'));

const Wrap = styled.div`position: relative; width: 100%; height: 100%; min-height: 0; background: #fafcff; border: 1px solid #e2e8f0; border-radius: 0.5rem; overflow: hidden;`;
const Center = styled.div`position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 0.8125rem;`;
const Tools = styled.div`position: absolute; right: 0.5rem; top: 0.5rem; display: flex; gap: 0.3rem; z-index: 2;`;
const Tool = styled.button`padding: 0.2rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; background: white; color: #475569; font-family: inherit; font-size: 0.75rem; cursor: pointer; &:hover { border-color: #1d4ed8; color: #1d4ed8; }`;

const FALLBACK = { width: 960, height: 520 };
const nodeRadius = (n) => 4 + Math.min(n.count || 0, 8) * 1.1;

const ThreadGraphCanvas = ({ nodes, links, focusThread = null, showLabels = false, onOpenPair }) => {
  const wrapRef = useRef(null);
  const fgRef = useRef(null);
  const fittedFor = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(0);
  const [hoverId, setHoverId] = useState(null);
  const attach = useCallback((inst) => {   // 같은 것이 다시 붙으면 세지 않는다 — 세면 렌더가 돌고 돈다
    if (fgRef.current === inst) return;
    fgRef.current = inst;
    if (inst) setReady(n => n + 1);
  }, []);

  // 라이브러리가 스스로 100% 를 못 읽어서 상자 크기를 재서 넘긴다.
  // 잴 수 없는 자리(시험용 jsdom 처럼 ResizeObserver 도 배치도 없는 곳)에서는 기본 크기로 —
  // 안 그러면 폭 0 이라 그림이 아예 안 그려진다.
  useEffect(() => {
    const el = wrapRef.current;
    const fit = (w, h) => setSize({ width: Math.floor(w) || FALLBACK.width, height: Math.floor(h) || FALLBACK.height });
    if (!el || typeof ResizeObserver === 'undefined') { fit(0, 0); return undefined; }
    fit(el.clientWidth, el.clientHeight);
    const ro = new ResizeObserver(([e]) => fit(e.contentRect.width, e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ② 클론 — 라이브러리가 이 객체들을 직접 고친다.
  const graphData = useMemo(() => ({
    nodes: nodes.map(n => ({ ...n })),
    links: links.map(l => ({ ...l })),
  }), [nodes, links]);

  const lit = useMemo(() => (focusThread == null ? null : nodesOfThread(links, focusThread)), [links, focusThread]);
  const dimNode = useCallback((n) => lit != null && !lit.has(n.id), [lit]);

  const paint = useCallback((node, ctx, scale) => {
    const r = nodeRadius(node);
    const dim = dimNode(node);
    ctx.globalAlpha = dim ? 0.15 : 1;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = KIND_COLORS[node.kind] || KIND_COLORS.other;
    ctx.fill();
    // 비시스템 매개는 호박색 점선 테두리 — 목록·지도와 같은 표시
    ctx.lineWidth = node.kind === 'informal' ? 1.4 : 1;
    ctx.setLineDash(node.kind === 'informal' ? [2, 1.5] : []);
    ctx.strokeStyle = node.kind === 'informal' ? '#f59e0b' : 'white';
    ctx.stroke();
    ctx.setLineDash([]);
    if (scale > 0.5) {                                  // 너무 줄이면 글씨를 뺀다 — 겹쳐서 못 읽는다
      ctx.font = `${node.id === hoverId ? 700 : 600} ${Math.max(3.5, 10 / scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#334155';
      ctx.fillText(node.label, node.x, node.y + r + 1.5);
    }
    ctx.globalAlpha = 1;
  }, [dimNode, hoverId]);

  const pointerArea = useCallback((node, color, ctx) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius(node) + 2, 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  // 고른 스레드가 아닌 선은 **숨기지 않고 흐린 회색으로** 둔다 — 숨기면 그 자리에 무엇이
  // 있었는지가 사라져서 "이 줄만 이렇게 지난다" 가 아니라 "여기엔 아무것도 없다" 로 읽힌다.
  const dimmedLink = useCallback((l) => focusThread != null && l.thread_id !== focusThread, [focusThread]);
  const linkColor = useCallback((l) => (dimmedLink(l) ? '#e2e8f0' : l.color), [dimmedLink]);

  /*
    간선의 스레드 이름 — 켜고 끈다(2026-08-29 요청).

    선 위에 **선을 따라 눕혀** 그린다. 가로로 눕히면 비스듬한 선에서 어느 선의 이름인지
    가려지지 않는다. 글자가 거꾸로 서지 않게 왼쪽으로 가는 선은 뒤집어 준다.
    자리는 휜 선의 한가운데다 — force-graph 가 그리며 남기는 제어점(`__controlPoints`)으로
    2차 베지에의 t=0.5 를 셈한다. 곧은 선이면 두 끝의 가운데.
  */
  const paintLinkLabel = useCallback((link, ctx, scale) => {
    if (!showLabels || scale < 0.35) return;                 // 많이 줄이면 글씨가 서로 겹쳐 못 읽는다
    const text = link.thread_name || '스레드 없음';
    const s = link.source, t = link.target;
    if (!s || !t || typeof s !== 'object' || typeof t !== 'object') return;
    const cp = link.__controlPoints;
    const mid = cp
      ? { x: 0.25 * s.x + 0.5 * cp[0] + 0.25 * t.x, y: 0.25 * s.y + 0.5 * cp[1] + 0.25 * t.y }
      : { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 };
    let angle = Math.atan2(t.y - s.y, t.x - s.x);
    if (angle > Math.PI / 2) angle -= Math.PI;               // 거꾸로 선 글자를 바로 세운다
    if (angle < -Math.PI / 2) angle += Math.PI;
    const size = Math.max(3, 9 / scale);
    ctx.save();
    ctx.translate(mid.x, mid.y);
    ctx.rotate(angle);
    ctx.font = `600 ${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';               // 선 위에 얹히므로 바탕을 깐다
    ctx.fillRect(-w / 2 - size * 0.2, -size * 0.62, w + size * 0.4, size * 1.24);
    ctx.fillStyle = dimmedLink(link) ? '#cbd5e1' : link.color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }, [showLabels, dimmedLink]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !graphData.nodes.length) return;
    try {
      fg.d3Force('charge')?.strength(-180).distanceMax(420);
      fg.d3Force('link')?.distance(46).strength(0.6);
      fg.d3Force('collide', forceCollide(n => nodeRadius(n) + 14).iterations(2));
      fg.d3ReheatSimulation?.();
    } catch { /* 아직 준비 전 — ready 가 바뀌면 다시 돈다 */ }
    fittedFor.current = null;
  }, [graphData, ready]);

  // 자리를 다 잡은 뒤에 화면에 맞춘다 — 고정 시간으로 맞추면 아직 흩어지는 중에 맞춰진다.
  const handleEngineStop = useCallback(() => {
    if (fittedFor.current === graphData) return;
    fittedFor.current = graphData;
    try { fgRef.current?.zoomToFit(500, 40); } catch { /* 준비 전 */ }
  }, [graphData]);

  // 끌어다 놓으면 그 자리에 둔다 — 놓아주면 방금 옮긴 것이 제자리로 돌아가며 주변이 출렁인다.
  const handleDragEnd = useCallback((node) => {
    if (!node) return;
    node.fx = node.x; node.fy = node.y; node.__pinned = true;
  }, []);

  const doRelayout = useCallback(() => {
    graphData.nodes.forEach(n => { n.fx = undefined; n.fy = undefined; n.__pinned = false; });
    fittedFor.current = null;
    try { fgRef.current?.d3ReheatSimulation?.(); } catch { /* 준비 전 */ }
  }, [graphData]);

  return (
    <Wrap ref={wrapRef} data-graph-canvas data-labels={showLabels ? 'on' : 'off'} aria-label="시스템 연결도">
      <Tools>
        <Tool type="button" onClick={doRelayout} title="고정을 전부 풀고 자리를 다시 잡습니다">배치 다시 계산</Tool>
        <Tool type="button" onClick={() => { try { fgRef.current?.zoomToFit(400, 40); } catch { /* 준비 전 */ } }}>화면에 맞추기</Tool>
      </Tools>
      <Suspense fallback={<Center>연결도를 준비합니다…</Center>}>
        {size.width > 0 && (
          <ForceGraph2D
            ref={attach}
            width={size.width}
            height={size.height}
            graphData={graphData}
            backgroundColor="#fafcff"
            nodeCanvasObject={paint}
            nodePointerAreaPaint={pointerArea}
            nodeLabel={(n) => `${n.label} · 지나는 구간 ${n.count}`}
            linkColor={linkColor}
            linkWidth={(l) => l.width}
            linkCurvature={(l) => l.curvature}
            linkLineDash={(l) => (l.dashed ? [4, 3] : null)}
            linkLabel={(l) => `${l.thread_name || '스레드 없음'} — ${l.name}`}
            linkCanvasObject={paintLinkLabel}
            linkCanvasObjectMode={() => 'after'}
            onLinkClick={(l) => l?.pair_id && onOpenPair && onOpenPair(l.pair_id)}
            onNodeHover={(n) => setHoverId(n?.id ?? null)}
            onNodeDragEnd={handleDragEnd}
            onEngineStop={handleEngineStop}
            d3AlphaDecay={0.05}
            d3VelocityDecay={0.4}
            cooldownTicks={130}
          />
        )}
      </Suspense>
    </Wrap>
  );
};

export default ThreadGraphCanvas;
