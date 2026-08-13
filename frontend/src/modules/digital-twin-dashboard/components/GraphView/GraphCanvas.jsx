/**
 * 관계도 캔버스 — `react-force-graph-2d` 래핑.
 *
 * 이 파일이 맡는 것은 **그리기와 조작**뿐이다. 무엇을 그릴지(필터·레이어)는
 * `GraphView` 가, 어떻게 보일지(색·모양)는 `graphPaint.js` 가 정한다.
 *
 * ⚠️ **두 가지 함정** (ReportArchive `reports/LinkGraphCanvas.jsx` 에서 가져온 것)
 *
 *   ① **lazy import.** 이 라이브러리는 무겁고 이 탭에서만 쓴다. 정적으로 import 하면
 *      관계도를 한 번도 안 여는 사람까지 값을 치른다(지금 단일 청크가 6.7MB 다).
 *
 *   ② **데이터를 반드시 클론한다.** force-graph 는 넘긴 node/link 객체를 **직접
 *      변형한다** — 노드에 x·y·vx·vy 를 주입하고, 링크의 `source`/`target` 문자열을
 *      **노드 객체 참조로 바꿔치기한다.** 서버 응답을 그대로 넘기면 두 번째 렌더에서
 *      `source` 가 이미 객체라 매칭이 깨지고, 캐시해 둔 응답도 같이 오염된다.
 */
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { forceCollide } from 'd3-force';
import { Crosshair, Loader2, Maximize2, Pin, PinOff, Sparkles } from 'lucide-react';

import {
  EDGE_COLORS, EDGE_COLORS_ACTIVE, EDGE_COLOR_DIM, collideRadius, edgeWidth,
  paintNode, paintPointerArea,
} from './graphPaint';

const ForceGraph2D = lazy(() => import('react-force-graph-2d'));

/** 같은 노드를 이 시간 안에 다시 누르면 더블클릭으로 본다. */
const DOUBLE_CLICK_MS = 320;

const GraphCanvas = ({
  data,                 // { nodes, edges } — 서버 응답 그대로 준다. 클론은 여기서 한다
  colorMode = 'type',
  divisionColors = {},
  focusRef = null,      // 고른 노드의 ref
  // AI 분석이 짚은 집합. 주면 **이것만** 진하게 남긴다(이웃 계산을 대신한다) —
  // "말이 아니라 그림으로 근거를 대는" 자리다.
  highlightRefs = null,
  relayoutSignal = 0,   // 이 값이 바뀌면 고정을 전부 풀고 다시 계산한다
  onNodeClick,          // 한 번 누름 — 다른 노드와 **똑같이** 초점만 옮긴다
  onNodeActivate,       // 두 번 누름 — 상세를 연다
  onAnalyze,            // 우클릭 → AI 분석 (KPI 노드)
  onNodeHover,
}) => {
  const wrapRef = useRef(null);
  const fgRef = useRef(null);
  const lastClick = useRef({ ref: null, at: 0 });
  const fittedFor = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // 🐞 그래프 컴포넌트는 **lazy** 라 첫 렌더에 `fgRef.current` 가 null 이다.
  //    ref 만 보고 힘을 걸면 "한 번도 안 걸린" 채로 끝난다(기본 힘으로만 그려진다).
  //    붙는 순간을 상태로 알려 effect 를 다시 돌린다.
  const [ready, setReady] = useState(0);
  const attach = useCallback((inst) => {
    fgRef.current = inst;
    if (inst) setReady(n => n + 1);
  }, []);

  // 컨테이너 크기를 재서 넘긴다 — 라이브러리가 스스로 100% 를 못 읽는다.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /*
    ② 클론 + degree 계산.

    `data` 가 바뀔 때마다 **새 객체**를 만든다. 얕은 복사면 안 된다 — 라이브러리가
    노드 객체 자체에 좌표를 쓰기 때문이다. 여기서 degree(연결 수)도 같이 센다:
    노드 크기의 근거이고, 매 프레임 세면 느리다.
  */
  const graphData = useMemo(() => {
    const nodes = (data?.nodes || []).map(n => ({ ...n, id: n.ref, __degree: 0 }));
    const byId = new Map(nodes.map(n => [n.id, n]));
    const links = [];
    for (const e of (data?.edges || [])) {
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      if (!s || !t) continue;          // 유령 노드 방지 (서버도 거르지만 여기서도 본다)
      s.__degree += 1;
      t.__degree += 1;
      links.push({ ...e, source: e.source, target: e.target });
    }
    return { nodes, links };
  }, [data]);

  // 고른 노드와 그 이웃만 진하게. 나머지는 흐리게 — 이게 없으면 큰 그래프에서
  // "무엇에 걸렸나" 를 눈으로 못 쫓는다.
  const neighborRefs = useMemo(() => {
    // AI 분석이 준 집합이 있으면 **그것이 이긴다.** 그 집합이 곧 근거이므로
    // 이웃으로 넓히면 근거가 흐려진다.
    if (highlightRefs?.size) return highlightRefs;
    if (!focusRef) return null;
    const set = new Set([focusRef]);
    for (const e of (data?.edges || [])) {
      if (e.source === focusRef) set.add(e.target);
      else if (e.target === focusRef) set.add(e.source);
    }
    return set;
  }, [focusRef, highlightRefs, data]);

  // 가리킨 노드는 조금 크게·이름표를 진하게. 상태로 두는 이유는 다시 그려야
  // 하기 때문이고, 값이 바뀔 때만 렌더되므로 마우스를 움직여도 부담이 없다.
  const [hoverRef, setHoverRef] = useState(null);
  const handleHover = useCallback((node) => {
    setHoverRef(node?.id || null);
    if (wrapRef.current) wrapRef.current.style.cursor = node ? 'pointer' : '';
    onNodeHover && onNodeHover(node);
  }, [onNodeHover]);

  const paint = useCallback((node, ctx, scale) => {
    paintNode(node, ctx, scale, {
      colorMode,
      divisionColors,
      dimmed: !!neighborRefs && !neighborRefs.has(node.id),
      hovered: node.id === hoverRef,
    });
  }, [colorMode, divisionColors, neighborRefs, hoverRef]);

  /**
   * 이 선이 **고른 노드의 이웃**인가.
   * 링크의 끝은 이 시점에 **노드 객체**다(라이브러리가 문자열을 바꿔치기했다).
   */
  const isActive = useCallback((link) => {
    if (!neighborRefs) return false;
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    return neighborRefs.has(s) && neighborRefs.has(t);
  }, [neighborRefs]);

  /*
    고른 이웃의 선은 **평소 색이 아니라 강조 색**으로 그린다 (2026-08-09).
    분류선(`contains`)처럼 평소에 옅게 두는 선은 평소 색 그대로면 골라도 안 보인다 —
    정작 "무엇에 걸렸나" 를 보려고 고른 순간에 숨어 버린다.
  */
  const linkColor = useCallback((link) => {
    if (!neighborRefs) return EDGE_COLORS[link.relation] || '#cbd5e1';
    if (!isActive(link)) return EDGE_COLOR_DIM;
    return EDGE_COLORS_ACTIVE[link.relation]
      || EDGE_COLORS[link.relation] || '#64748b';
  }, [neighborRefs, isActive]);

  const linkWidth = useCallback(
    (link) => edgeWidth(link.relation, isActive(link)), [isActive]);

  /*
    힘 조정 — **전체보기에서 겹치지 않게** 하는 것이 목적이다 (2026-08-09 요청).

      charge    서로 밀어내는 힘. 기본(-30)은 이 정도 노드 수에서 너무 약해
                덩어리가 진다. distanceMax 를 두어 먼 노드끼리는 계산에서 뺀다
                (안 두면 노드가 늘수록 급격히 느려진다).
      link      선 길이. 라벨이 통째로 들어갈 만큼 벌린다.
      collide   **노드 + 라벨**이 차지하는 자리(`collideRadius`). 이게 핵심이다 —
                점끼리만 안 겹치게 하면 글씨는 여전히 겹친다.

    `d3Force` 는 ref 로만 닿는다. 데이터가 바뀔 때마다 다시 건다 — 라이브러리가
    새 시뮬레이션을 만들면서 우리가 건 힘을 잃기 때문이다.
  */
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !graphData.nodes.length) return;

    try {
      // 밀어내는 힘. 프로세스 노드가 무리를 갈라 준 뒤로는 이만큼 셀 필요가 없다 —
      // 세면 셀수록 "끌었을 때 관계된 것이 따라오는" 느낌이 사라진다.
      fg.d3Force('charge')?.strength(-140).distanceMax(500);

      // 잇는 힘. **세게 준다** — 노드를 끌면 관계된 것이 같이 와야 한다(2026-08-09).
      // 조직 갈래(사업부·프로세스)는 더 짧고 세게 묶어 무리가 뭉쳐 보이게 한다.
      fg.d3Force('link')
        ?.distance(l => ({ has_item: 20, contains: 26 }[l.relation] ?? 38))
        .strength(l => ({ contains: 0.9, has_item: 0.5 }[l.relation] ?? 0.7));

      fg.d3Force('collide', forceCollide(collideRadius).iterations(2));
      fg.d3ReheatSimulation?.();
    } catch { /* 아직 준비 전 — ready 가 바뀌면 다시 돈다 */ }
    fittedFor.current = null;   // 새 데이터다 — 자리를 잡으면 다시 맞춘다
  }, [graphData, ready]);

  /**
   * 화면에 맞추기 — **시뮬레이션이 멈춘 뒤에** 한다.
   *
   * 고정 시간으로 맞추면 노드 수에 따라 아직 흩어지는 중일 때 맞춰지고,
   * 그러면 곧바로 화면 밖으로 벗어난다. 밀어내는 힘을 키운 뒤로 그게 더 잘 보인다.
   */
  const handleEngineStop = useCallback(() => {
    if (fittedFor.current === graphData) return;
    fittedFor.current = graphData;
    try { fgRef.current?.zoomToFit(600, 40); } catch { /* 준비 전 */ }
  }, [graphData]);

  /**
   * 한 번 누름 / 두 번 누름을 가른다.
   *
   * `react-force-graph` 에는 더블클릭 콜백이 없다. 같은 노드를 짧은 간격 안에
   * 다시 누르면 두 번으로 본다. **첫 번째 누름은 그대로 살린다** — 초점이 먼저
   * 옮겨지고 그다음 상세가 열리는 편이, 두 번째를 기다리느라 아무 반응이 없는
   * 것보다 낫다(모든 클릭이 300ms 씩 늦어지는 것을 피한다).
   */
  /**
   * 끌어다 놓으면 **그 자리에 둔다** (2026-08-09).
   *
   * 기본 동작은 손을 떼는 순간 노드를 놓아주는 것이라, 힘이 다시 계산되면서
   * 방금 옮긴 노드가 제자리로 돌아가고 **주변이 한참 출렁인다.** 사람이 굳이
   * 끌어다 놓았다는 것은 "여기 두고 보겠다" 는 뜻이므로 고정하는 편이 맞다.
   * 고정된 노드는 계산에서 빠지므로 안정되는 시간도 짧아진다.
   *
   * 다시 풀고 싶으면 「배치 다시 계산」을 누른다(고정을 전부 없앤다).
   */
  const handleDragEnd = useCallback((node) => {
    if (!node) return;
    node.fx = node.x;
    node.fy = node.y;
    node.__pinned = true;
  }, []);

  // 「배치 다시 계산」 — 고정을 전부 풀고 처음부터 자리를 잡는다.
  // 첫 렌더(신호 0)에서는 돌지 않게 한다 — 그때는 위 effect 가 이미 열을 넣는다.
  const firstRelayout = useRef(true);
  useEffect(() => {
    if (firstRelayout.current) { firstRelayout.current = false; return; }
    graphData.nodes.forEach(n => { n.fx = undefined; n.fy = undefined; n.__pinned = false; });
    fittedFor.current = null;
    try { fgRef.current?.d3ReheatSimulation?.(); } catch { /* 준비 전 */ }
  }, [relayoutSignal, graphData]);

  /* ── 우클릭 메뉴 ─────────────────────────────────────────────────────
     고정을 푸는 길이 「배치 다시 계산」(전부 풀기)뿐이면, 하나만 풀고 싶을 때
     방법이 없다. 노드에서 바로 풀 수 있게 한다 (2026-08-09 요청).
     좌표는 캔버스를 감싼 상자 기준이라 이 컴포넌트가 메뉴를 들고 있다. */
  const [menu, setMenu] = useState(null);   // {x, y, node}
  const closeMenu = useCallback(() => setMenu(null), []);

  const handleRightClick = useCallback((node, event) => {
    if (event?.preventDefault) event.preventDefault();
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    if (!node) { setMenu(null); return; }
    // 상자 밖으로 나가지 않게 잡아 둔다 — 오른쪽·아래 끝에서 메뉴가 잘린다.
    const MENU_W = 168;
    const MENU_H = 132;
    setMenu({
      node,
      x: Math.min(Math.max(0, event.clientX - box.left), Math.max(0, box.width - MENU_W)),
      y: Math.min(Math.max(0, event.clientY - box.top), Math.max(0, box.height - MENU_H)),
    });
  }, []);

  // 바깥을 누르거나 Esc 를 누르면 닫는다. 열려 있을 때만 듣는다.
  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenu(null); };
    const onDown = (e) => {
      if (!e.target.closest?.('[data-graph-menu]')) setMenu(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown, true);
    };
  }, [menu]);

  const setPinned = useCallback((node, pinned) => {
    if (!node) return;
    if (pinned) {
      node.fx = node.x;
      node.fy = node.y;
      node.__pinned = true;
    } else {
      node.fx = undefined;
      node.fy = undefined;
      node.__pinned = false;
      // 풀기만 하면 힘이 이미 식어 있어 노드가 그 자리에 그대로 있다.
      // 다시 데워야 실제로 움직인다.
      try { fgRef.current?.d3ReheatSimulation?.(); } catch { /* 준비 전 */ }
    }
    setMenu(null);
  }, []);

  const unpinAll = useCallback(() => {
    graphData.nodes.forEach(n => { n.fx = undefined; n.fy = undefined; n.__pinned = false; });
    try { fgRef.current?.d3ReheatSimulation?.(); } catch { /* 준비 전 */ }
    setMenu(null);
  }, [graphData]);

  const pinnedCount = graphData.nodes.filter(n => n.__pinned).length;

  const handleClick = useCallback((node, event) => {
    setMenu(null);
    if (!node) {
      lastClick.current = { ref: null, at: 0 };
      onNodeClick && onNodeClick(null, event);
      return;
    }
    const now = (event && event.timeStamp) || performance.now();
    const prev = lastClick.current;
    const isDouble = prev.ref === node.id && (now - prev.at) < DOUBLE_CLICK_MS;
    lastClick.current = { ref: isDouble ? null : node.id, at: now };

    if (isDouble) {
      onNodeActivate && onNodeActivate(node, event);
      return;
    }
    onNodeClick && onNodeClick(node, event);
  }, [onNodeClick, onNodeActivate]);

  return (
    // 캔버스 위에서는 브라우저 기본 메뉴를 막는다 — 안 막으면 우리 메뉴와 겹쳐 뜬다.
    <Wrap ref={wrapRef} onContextMenu={(e) => e.preventDefault()}>
      <Suspense fallback={<Center><Loader2 size={22} className="spin" />관계도를 준비합니다…</Center>}>
        {size.width > 0 && (
          <ForceGraph2D
            ref={attach}
            width={size.width}
            height={size.height}
            graphData={graphData}
            backgroundColor="#f8fafc"
            nodeCanvasObject={paint}
            nodePointerAreaPaint={paintPointerArea}
            nodeLabel={(n) => `${n.label}${n.code ? ` (${n.code})` : ''}`}
            linkColor={linkColor}
            /*
              선의 굵기는 **뜻의 무게**다. 분류·소속선(`contains`)은 뼈대일 뿐이라
              가장 가늘고 옅게, 선행 과제는 방향이 있는 주장이라 굵고 화살표를 단다.
              단 **고른 노드의 이웃은 굵어진다** — 색만 바꾸면 가는 선은 여전히 안 보인다.
            */
            linkWidth={linkWidth}
            /*
              살짝 휘게 그린다. 곧은 선은 노드 여럿을 관통해 지나가 보여서
              "이 선이 어디서 어디로" 가 안 읽힌다. 분류선은 뼈대라 곧게 둔다.
            */
            linkCurvature={(l) => (l.relation === 'contains' ? 0 : 0.14)}
            linkDirectionalArrowLength={(l) => (l.relation === 'precedes' ? 3.5 : 0)}
            linkDirectionalArrowRelPos={0.98}
            /*
              안정되는 속도 (2026-08-09 — "너무 오래 걸린다").
                alphaDecay    기본 0.0228 은 이 규모에서 500틱 넘게 돈다.
                              키우면 빨리 식는다. 배치 품질은 프로세스 노드가
                              무리를 갈라 준 덕에 크게 안 나빠진다.
                velocityDecay 감쇠(마찰). 키우면 출렁임이 빨리 잦아든다.
                cooldownTicks 이만큼만 돌고 멈춘다.
            */
            d3AlphaDecay={0.045}
            d3VelocityDecay={0.42}
            cooldownTicks={140}
            onEngineStop={handleEngineStop}
            onNodeDragEnd={handleDragEnd}
            onNodeClick={handleClick}
            onNodeHover={handleHover}
            onBackgroundClick={() => handleClick(null)}
            onNodeRightClick={handleRightClick}
            onBackgroundRightClick={closeMenu}
          />
        )}
      </Suspense>

      {menu && (
        <Menu data-graph-menu style={{ left: menu.x, top: menu.y }}>
          <MenuHead title={menu.node.label}>{menu.node.label}</MenuHead>

          {menu.node.__pinned ? (
            <MenuItem onClick={() => setPinned(menu.node, false)}>
              <PinOff size={13} />고정 해제
            </MenuItem>
          ) : (
            <MenuItem onClick={() => setPinned(menu.node, true)}>
              <Pin size={13} />여기에 고정
            </MenuItem>
          )}

          <MenuItem onClick={() => { onNodeClick && onNodeClick(menu.node); closeMenu(); }}>
            <Crosshair size={13} />이 노드만 보기
          </MenuItem>

          {/* KPI 는 여기서 바로 브리핑으로 들어간다 — 관계도에서 가장 자주 묻는 것이
              "이 지표가 왜 더딘가" 라서, 상단 메뉴까지 가지 않게 한다. */}
          {menu.node.type === 'kpi' && onAnalyze && (
            <MenuItem onClick={() => { onAnalyze(menu.node); closeMenu(); }}>
              <Sparkles size={13} />AI 분석
            </MenuItem>
          )}

          {menu.node.type === 'project' && (
            <MenuItem onClick={() => {
              onNodeActivate && onNodeActivate(menu.node);
              closeMenu();
            }}>
              <Maximize2 size={13} />과제 상세 열기
            </MenuItem>
          )}

          {pinnedCount > 0 && (
            <>
              <MenuSep />
              <MenuItem onClick={unpinAll}>
                <PinOff size={13} />고정 전부 해제 ({pinnedCount})
              </MenuItem>
            </>
          )}
        </Menu>
      )}
    </Wrap>
  );
};

const Wrap = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #f8fafc;
  border-radius: 0.75rem;
  overflow: hidden;
`;

const Menu = styled.div`
  position: absolute;
  z-index: 5;
  min-width: 168px;
  padding: 0.25rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
  user-select: none;
`;

const MenuHead = styled.div`
  padding: 0.35rem 0.5rem 0.4rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748b;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 0.2rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MenuItem = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.35rem 0.5rem;
  font-size: 0.78rem;
  color: #1e293b;
  background: none;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  text-align: left;

  &:hover { background: #f1f5f9; }
`;

const MenuSep = styled.div`
  height: 1px;
  margin: 0.2rem 0.25rem;
  background: #f1f5f9;
`;

const Center = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: #64748b;
  font-size: 0.875rem;

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

export default GraphCanvas;
