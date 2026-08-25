import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { AlertTriangle, Filter, Minus, Plus, Maximize2, Move } from 'lucide-react';

import { STAGES } from './RadarBoard';

/**
 * 기술 레이더 — **동심원 넷 + 분류별 부채꼴**, 확대·축소·이동 가능.
 *
 * 왜 라이브러리를 안 쓰나 (2026-08-25 검토)
 *     zalando/tech-radar(MIT)ㆍthoughtworks/build-your-own-radar(AGPL) 둘 다 있다.
 *     zalando 것이 우리보다 나은 점은 **점 겹침 회피 하나**인데, d3 v7 을 새
 *     의존성으로 들이고 부채꼴 수ㆍ색ㆍ말투를 남의 규격에 맞추는 값이다. 겹침 회피는
 *     아래에서 직접 한다. thoughtworks 것은 **AGPL** 이라 사내 웹앱에 붙이면 별도
 *     라이선스 검토가 필요하다.
 *
 * ⚠️⚠️ **레이더는 늘어나지 않는다.** ThoughtWorks 판이 한 번에 약 120개고, 그래서
 *    매 판마다 편집으로 골라낸다. 그래서 이 컴포넌트는 두 갈래로 대응한다 —
 *      · 90개가 넘으면 **스스로 「걸러서 보라」고 말한다**(`CROWDED`)
 *      · 그래도 몰린 자리는 **확대해서 본다**(휠ㆍ드래그ㆍ버튼)
 *    전부 훑는 자리는 목록 보기다.
 *
 * ⚠️ 부채꼴 수를 넷으로 강제하지 않는다. 분류는 설정에서 늘어나는 값이라
 *    (`techCategories`) 넷으로 맞추면 다섯째를 넣는 순간 그림이 깨진다.
 *
 * ⚠️ 점 자리는 **uuid 로 정한다**(난수가 아니다). 난수면 다시 그릴 때마다 움직여서
 *    「저 자리에 있던 그거」로 기억할 수 없다.
 */

/*
  ⚠️ **레이더에는 스크롤이 생기면 안 된다.** 그림이 잘려 아래가 안 보이면 「우리가
     어디까지 왔나」를 한눈에 보는 값이 사라진다. 부모가 준 높이를 그대로 채우고
     (`height: 100%` + `min-height: 0`), 넘치는 것은 **우측 목록 안에서만** 흐른다.
  ⚠️ `min-height: 0` 이 빠지면 grid 자식이 내용 크기만큼 부풀어 부모를 밀어낸다 —
     그러면 바깥에 스크롤이 도로 생긴다.
*/
const Wrap = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 17rem;
  gap: 1rem;
  height: 100%;
  min-height: 0;

  @media (max-width: 1000px) {
    grid-template-columns: 1fr;
    height: auto;
  }
`;

const Frame = styled.div`
  position: relative;
  height: 100%;
  min-height: 0;
  display: flex;
  background: radial-gradient(circle at 50% 46%, #ffffff 0%, #f8fafc 68%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow: hidden;

  svg {
    flex: 1;
    min-height: 0;
    width: 100%;
    height: 100%;
    display: block;
    cursor: ${(p) => (p.$dragging ? 'grabbing' : 'grab')};
    touch-action: none;
  }

  @media (max-width: 1000px) {
    height: auto;
    svg { height: auto; }
  }
`;

const Tools = styled.div`
  position: absolute;
  right: 0.625rem;
  top: 0.625rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.25rem;
`;

const ToolBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  background: none;
  border-radius: 0.375rem;
  color: #475569;
  cursor: pointer;

  &:hover:not(:disabled) { background: #eef2ff; color: #4338ca; }
  &:disabled { opacity: 0.35; cursor: default; }
`;

const ZoomTag = styled.div`
  position: absolute;
  right: 0.625rem;
  bottom: 0.625rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.4375rem;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.6875rem;
  color: #64748b;
  font-variant-numeric: tabular-nums;
`;

const Crowd = styled.div`
  position: absolute;
  left: 0.75rem;
  top: 0.75rem;
  display: flex;
  align-items: flex-start;
  gap: 0.3125rem;
  padding: 0.375rem 0.5625rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 0.4375rem;
  color: #92400e;
  font-size: 0.6875rem;
  line-height: 1.55;
  max-width: 18rem;

  svg { flex-shrink: 0; margin-top: 0.125rem; }
`;

/* 넘치는 것은 **여기 안에서만** 흐른다. */
const Side = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding-right: 0.125rem;

  @media (max-width: 1000px) { height: auto; max-height: 28rem; }
`;

const Group = styled.section`
  h4 {
    margin: 0 0 0.1875rem;
    font-size: 0.75rem;
    color: ${(p) => p.$color};
  }
  ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.0625rem; }
`;

/* 감싸는 것은 **div** 다 — 안에 버튼이 둘 들어가므로 버튼이면 안 된다. */
const Entry = styled.div`
  border-radius: 0.3125rem;
  padding: 0.25rem 0.3125rem;
  background: ${(p) => (p.$hot ? '#eef2ff' : 'transparent')};

  &:hover { background: #eef2ff; }
`;

const MainBtn = styled.button`
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  width: 100%;
  text-align: left;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  font-size: 0.75rem;
  color: #334155;
  line-height: 1.45;

  > b {
    color: #fff;
    background: ${(p) => p.$color};
    border-radius: 999px;
    min-width: 1.125rem;
    height: 1.125rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.625rem;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
    margin-top: 0.0625rem;
  }
`;

const SubRow = styled.div`
  display: flex;
  gap: 0.25rem;
  align-items: baseline;
  padding-left: 1.5rem;
  font-size: 0.6875rem;
  color: #94a3b8;

  em { font-style: normal; }
`;

const Moved = styled.span`
  font-size: 0.625rem;
  font-weight: 700;
  color: #0f766e;
  background: #f0fdfa;
  border-radius: 0.25rem;
  padding: 0 0.1875rem;
`;

const Mark = styled.span`
  display: inline-flex;
  vertical-align: -0.1em;
  color: ${(p) => p.$color};
`;

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem 0.75rem;
  padding: 0.4375rem 0.5625rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.6875rem;
  color: #64748b;

  span { display: inline-flex; align-items: center; gap: 0.25rem; }
`;

const SectorBtn = styled.button`
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  font: inherit;
  color: inherit;

  &:hover { color: #4338ca; text-decoration: underline; }
`;

/* ⚠️ 가로를 세로보다 넓게 잡는다. 정사각형이면 좌ㆍ우 부채꼴 이름이 잘린다
   (플랫폼ㆍ데이터·연결이 실제로 잘렸다 — 2026-08-25). */
const W = 860;
const H = 620;
const CX = W / 2;
const CY = H / 2;
const R_MAX = H / 2 - 34;
const RINGS = [0.3, 0.5, 0.7, 1].map((r) => r * R_MAX);
const BLIP_R = 11;
const CROWDED = 90;
const MOVED_DAYS = 90;
const ZOOM_MIN = 1;
const ZOOM_MAX = 8;

const hash01 = (s, salt = 0) => {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
};

const UNCATEGORIZED = '분류 없음';
const polar = (a, r) => [CX + Math.cos(a) * r, CY + Math.sin(a) * r];

const wedgePath = (a0, a1, rOut) => {
  const [x0, y0] = polar(a0, rOut);
  const [x1, y1] = polar(a1, rOut);
  const big = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${CX} ${CY} L ${x0} ${y0} A ${rOut} ${rOut} 0 ${big} 1 ${x1} ${y1} Z`;
};

/**
 * 한 칸(고리 × 부채꼴) 안에 점을 **고르게 깐다.**
 *
 * ⚠️⚠️ 예전에는 무작위로 뿌린 뒤 서로 밀어내는 방식이었는데 **수렴하지 않았다.**
 *    고리는 얇은 띠(관찰 고리는 두께 27px)라, 밀어낸 점이 곧바로 경계에 부딪혀
 *    되돌려지고 그 자리에서 다른 점과 다시 겹친다. 실측(2026-08-25) —
 *      6개  → 최소간격 1.29px
 *      60개 → **4쌍이 좌표까지 완전히 같았다** (확대해도 못 가른다)
 *
 * 그래서 격자로 깐다. 칸의 **호 길이와 두께 비율**로 줄 수를 정해 한 칸이 대략
 * 정사각형이 되게 한 뒤, 칸마다 하나씩 놓는다.
 *
 *   · 좌표가 **반드시 서로 다르다** → 확대하면 언제나 갈린다
 *   · 간격이 고르다 → 몇 배로 확대해야 갈리는지가 예측된다
 *   · uuid 로 흔들어 기계적인 격자로 안 보이게 한다. 흔드는 폭은 간격의 18% 라
 *     **최소간격을 0.64배까지만** 줄인다(겹침을 새로 만들지 않는다)
 */
const JITTER = 0.18;

const layout = (items, b) => {
  const n = items.length;
  const dA = b.a1 - b.a0;
  const rMid = (b.rIn + b.rOut) / 2;
  const arc = Math.max(dA * rMid, 1);      // 칸의 가로(호) 길이
  const thick = Math.max(b.rOut - b.rIn, 1);   // 칸의 세로(반지름) 두께

  // 한 칸이 정사각형에 가깝도록 줄 수를 고른다.
  let rowsN = Math.round(Math.sqrt((n * thick) / arc));
  rowsN = Math.min(Math.max(rowsN, 1), n);
  const colsN = Math.ceil(n / rowsN);

  // 자리 순서도 uuid 로 정한다 — 다시 그려도 같은 자리에 오게.
  const ordered = [...items].sort(
    (p, q) => hash01(p.tech.uuid, 7) - hash01(q.tech.uuid, 7));

  return ordered.map((it, i) => {
    const row = Math.floor(i / colsN);
    const col = i % colsN;
    // 마지막 줄이 덜 찼으면 가운데로 모아 한쪽으로 쏠리지 않게 한다.
    const inRow = Math.min(colsN, n - row * colsN);
    const offset = (colsN - inRow) / 2;
    // 칸 안 자리(0~1). 흔드는 폭은 **한 칸 폭의 JITTER 배**다.
    const jx = (hash01(it.tech.uuid, 1) - 0.5) * JITTER / colsN;
    const jy = (hash01(it.tech.uuid, 2) - 0.5) * JITTER / rowsN;
    const fx = (col + offset + 0.5) / colsN + jx;
    const fy = (row + 0.5) / rowsN + jy;
    const a = b.a0 + fx * dA;
    const r = b.rIn + fy * thick;
    const [x, y] = polar(
      Math.min(b.a1, Math.max(b.a0, a)),
      Math.min(b.rOut, Math.max(b.rIn, r)));
    return { ...it, x, y };
  });
};

const RadarChart = ({ rows, categories, onSelect, onSectorClick, activeSector }) => {
  const [hot, setHot] = useState(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const suppressRef = useRef(false);

  const sectors = useMemo(() => {
    const used = new Set(rows.map((t) => t.category || UNCATEGORIZED));
    const ordered = (categories || []).filter((c) => used.has(c));
    used.forEach((c) => { if (!ordered.includes(c)) ordered.push(c); });
    return ordered.length ? ordered : [UNCATEGORIZED];
  }, [rows, categories]);

  const stageIndex = useMemo(
    () => Object.fromEntries(STAGES.map((s, i) => [s.key, i])), []);

  const span = (Math.PI * 2) / sectors.length;
  const PAD_A = Math.min(span * 0.08, 0.06);

  const blips = useMemo(() => {
    const cells = new Map();
    rows.forEach((t) => {
      const si = Math.max(0, sectors.indexOf(t.category || UNCATEGORIZED));
      const ri = stageIndex[t.stage] ?? 2;
      const key = `${si}|${ri}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push({ tech: t, si, ri });
    });

    const out = [];
    cells.forEach((items, key) => {
      const [si, ri] = key.split('|').map(Number);
      const a0 = si * span - Math.PI / 2 + PAD_A;
      const a1 = (si + 1) * span - Math.PI / 2 - PAD_A;
      const rIn = Math.max((ri === 0 ? 0 : RINGS[ri - 1]) + BLIP_R + 3, BLIP_R + 4);
      const rOut = Math.max(RINGS[ri] - BLIP_R - 3, rIn + 1);
      out.push(...layout(items, { a0, a1, rIn, rOut }));
    });

    out.sort((p, q) => (p.ri - q.ri) || p.tech.name.localeCompare(q.tech.name));
    out.forEach((b, i) => { b.no = i + 1; });
    return out;
  }, [rows, sectors, stageIndex, span, PAD_A]);


  // ── 확대·축소·이동 ────────────────────────────────────────────────────────
  const toSvg = useCallback((cx, cy) => {
    const r = svgRef.current.getBoundingClientRect();
    return [((cx - r.left) / r.width) * W, ((cy - r.top) / r.height) * H];
  }, []);

  /** 화면의 한 점을 고정한 채 배율만 바꾼다 — 커서 아래 것이 안 달아난다. */
  const zoomAt = useCallback((factor, px, py) => {
    setView((v) => {
      const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.k * factor));
      if (k === v.k) return v;
      const ax = px ?? W / 2;
      const ay = py ?? H / 2;
      return { k, x: ax - ((ax - v.x) * k) / v.k, y: ay - ((ay - v.y) * k) / v.k };
    });
  }, []);

  // ⚠️ React 의 onWheel 은 passive 로 붙어 `preventDefault` 가 안 먹는다. 그대로
  //    두면 레이더 위에서 휠을 굴릴 때 **페이지가 같이 스크롤된다.** 직접 붙인다.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const [px, py] = toSvg(e.clientX, e.clientY);
      zoomAt(e.deltaY < 0 ? 1.16 : 1 / 1.16, px, py);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [toSvg, zoomAt]);

  /*
    ⚠️⚠️ **`setPointerCapture` 를 쓰면 안 된다.** 캡처를 걸면 그 뒤의 포인터 이벤트가
       전부 캡처한 요소(여기서는 `<svg>`)로 되돌려지고, **click 도 거기서 난다.**
       그래서 점(`<g>`)의 onClick 이 한 번도 안 불렸다 (2026-08-25 신고).
       대신 누르고 있는 동안만 `window` 에 붙인다 — 밖으로 끌고 나가도 안 끊긴다.
  */
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    const [px, py] = toSvg(e.clientX, e.clientY);
    dragRef.current = { px, py, x: view.x, y: view.y, moved: false };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return undefined;
    const move = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const [px, py] = toSvg(e.clientX, e.clientY);
      const dx = px - d.px;
      const dy = py - d.py;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
      setView((v) => ({ ...v, x: d.x + dx, y: d.y + dy }));
    };
    const up = () => {
      // 끌어서 옮긴 직후의 click 은 삼킨다 — 끌다 놓을 때마다 창이 열리면 못 쓴다.
      suppressRef.current = Boolean(dragRef.current && dragRef.current.moved);
      dragRef.current = null;
      setDragging(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [dragging, toSvg]);

  const clickIfNotDragged = (fn) => (e) => {
    if (suppressRef.current) {           // pointerup 직후의 그 한 번만 삼킨다
      suppressRef.current = false;
      return;
    }
    if (e && e.stopPropagation) e.stopPropagation();
    fn();
  };

  const reset = () => setView({ k: 1, x: 0, y: 0 });
  const zoomed = view.k > 1.001;

  return (
    <Wrap>
      <Frame $dragging={dragging}>
        {blips.length > CROWDED && (
          <Crowd>
            <Filter size={13} />
            <span>
              지금 <b>{blips.length}개</b>입니다. 레이더는 <b>100개 안팎까지</b>가
              읽을 수 있는 한계입니다 — 걸러 보거나, <b>몰린 자리를 확대</b>해 보세요.
              확대해도 <b>점 크기는 그대로</b>라 뭉친 것이 벌어집니다 (휠ㆍ드래그).
            </span>
          </Crowd>
        )}

        <Tools>
          <ToolBtn onClick={() => zoomAt(1.35)} disabled={view.k >= ZOOM_MAX}
                   title="확대 (휠을 올려도 됩니다)"><Plus size={15} /></ToolBtn>
          <ToolBtn onClick={() => zoomAt(1 / 1.35)} disabled={view.k <= ZOOM_MIN}
                   title="축소"><Minus size={15} /></ToolBtn>
          <ToolBtn onClick={reset} disabled={!zoomed && !view.x && !view.y}
                   title="처음 크기로"><Maximize2 size={14} /></ToolBtn>
        </Tools>

        {zoomed && (
          <ZoomTag><Move size={11} /> {view.k.toFixed(1)}× · 끌어서 이동 · 점 크기 고정</ZoomTag>
        )}

        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="기술 레이더"
             onPointerDown={onPointerDown} onDoubleClick={reset}>
          <defs>
            {STAGES.map((st) => (
              <marker key={st.key} id={`arw-${st.key}`} viewBox="0 0 10 10"
                      refX="9" refY="5" markerWidth="5" markerHeight="5"
                      orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={st.color} opacity="0.55" />
              </marker>
            ))}
          </defs>
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {[3, 2, 1, 0].map((i) => (
              <circle key={STAGES[i].key} cx={CX} cy={CY} r={RINGS[i]}
                      fill={STAGES[i].bg} stroke={STAGES[i].border}
                      strokeWidth={1 / view.k} />
            ))}

            {activeSector && sectors.includes(activeSector) && (
              <path d={wedgePath(sectors.indexOf(activeSector) * span - Math.PI / 2,
                                 (sectors.indexOf(activeSector) + 1) * span - Math.PI / 2,
                                 RINGS[3])}
                    fill="#4f46e5" opacity="0.06" />
            )}

            {sectors.map((c, i) => {
              const [x, y] = polar(i * span - Math.PI / 2, RINGS[3]);
              return <line key={c} x1={CX} y1={CY} x2={x} y2={y}
                           stroke="#e2e8f0" strokeWidth={1 / view.k} />;
            })}

            {sectors.map((c, i) => {
              const a = (i + 0.5) * span - Math.PI / 2;
              const [x, y] = polar(a, RINGS[3] + 14);
              const n = blips.filter((b) => b.si === i).length;
              const on = activeSector === c;
              return (
                <text key={c} x={x} y={y} fontSize={13 / view.k}
                      fill={on ? '#4338ca' : '#475569'} fontWeight="700"
                      style={{ cursor: onSectorClick ? 'pointer' : 'default' }}
                      onClick={clickIfNotDragged(
                        () => onSectorClick && onSectorClick(on ? '' : c))}
                      textAnchor={Math.cos(a) > 0.25 ? 'start' : Math.cos(a) < -0.25 ? 'end' : 'middle'}
                      dominantBaseline={Math.sin(a) > 0.25 ? 'hanging' : Math.sin(a) < -0.25 ? 'auto' : 'middle'}>
                  {c} <tspan fill="#94a3b8" fontWeight="500">{n}</tspan>
                </text>
              );
            })}

            {STAGES.map((st, i) => {
              const rMid = i === 0 ? RINGS[0] / 2 : (RINGS[i] + RINGS[i - 1]) / 2;
              return (
                <text key={st.key} x={CX} y={CY - rMid} fontSize={11 / view.k} fill={st.color}
                      fontWeight="700" textAnchor="middle" dominantBaseline="middle"
                      opacity="0.45" style={{ pointerEvents: 'none' }}>
                  {st.key}
                </text>
              );
            })}

            {/*
              ⚠️⚠️ **확대해도 점 크기는 그대로 둔다.** 무리에서 하나를 골라내려고
                 확대하는 것인데, 점까지 같이 커지면 **간격 대비 크기가 그대로**라
                 아무것도 안 벌어진다. 그룹이 `scale(k)` 로 커지므로 여기서
                 `/ k` 로 되돌리면 화면상 크기가 고정된다 — 자리는 벌어지고 점은
                 그대로라 그제서야 분해가 된다.
            */}
            {/*
              ⚠️⚠️ **어디서 왔는지를 그린다.** 예전에는 「움직였다」만 테두리로
                 표시했는데, 레이더의 값은 **무엇이 안쪽으로 들어왔나**에 있다 —
                 ThoughtWorks 가 매 판마다 이동을 표시하는 이유가 그것이다.
              ⚠️ 화살표는 **점보다 먼저** 그린다. 나중에 그리면 점을 덮어 번호가 안 읽힌다.
            */}
            {blips.map((b) => {
              const fromIdx = stageIndex[b.tech.movedFrom];
              if (fromIdx === undefined || fromIdx === b.ri) return null;
              // 출발 고리의 한가운데. 각도는 지금 자리와 같게 둔다 — 부채꼴(분류)은
              // 안 바뀌었으므로 반지름만 움직인 것이 사실에 맞다.
              const a = Math.atan2(b.y - CY, b.x - CX);
              const rFrom = fromIdx === 0 ? RINGS[0] / 2
                : (RINGS[fromIdx] + RINGS[fromIdx - 1]) / 2;
              const rTo = Math.hypot(b.x - CX, b.y - CY);
              const gap = (BLIP_R + 4) / view.k;
              const dir = rTo > rFrom ? 1 : -1;
              const [x1, y1] = polar(a, rFrom + dir * gap * 0.4);
              const [x2, y2] = polar(a, rTo - dir * gap);
              return (
                <line key={`mv-${b.tech.uuid}`} x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={STAGES[b.ri].color} strokeWidth={1.6 / view.k}
                      opacity="0.5" strokeDasharray={`${4 / view.k} ${3 / view.k}`}
                      markerEnd={`url(#arw-${STAGES[b.ri].key})`} />
              );
            })}

            {blips.map((b) => {
              const st = STAGES[b.ri];
              const on = hot === b.tech.uuid;
              // ⚠️ 화살표와 **같은 값**을 본다. 둘이 다른 데서 오면 「테는 있는데
              //    화살표가 없는 줄」이 생기고, 그러면 둘 다 못 믿게 된다.
              const moved = Boolean(b.tech.movedFrom);
              const k = view.k;
              const rr = BLIP_R / k;
              return (
                <g key={b.tech.uuid} style={{ cursor: 'pointer' }}
                   onClick={clickIfNotDragged(() => onSelect(b.tech))}
                   onMouseEnter={() => setHot(b.tech.uuid)}
                   onMouseLeave={() => setHot(null)}>
                  <title>
                    {`${b.tech.name} · ${b.tech.stage}`
                     + `${b.tech.isStale ? ' · 근거 낡음' : ''}`
                     + `${b.tech.movedFrom ? ` · ${b.tech.movedFrom}에서 옮겨옴` : ''}`}
                  </title>
                  {on && <circle cx={b.x} cy={b.y} r={(BLIP_R + 7) / k}
                                 fill={st.color} opacity="0.16" />}
                  {/*
                    ⚠️ **모양은 전부 원으로 통일한다.** 예전엔 최근 이동을 삼각형으로
                       갈랐는데 촌스럽고, 모양이 섞이면 밀집 구간에서 더 어지럽다.
                       옮겨온 것은 **바깥에 얇은 테**를 두른다 — 화살표는 「어디서」를
                       말하고 테는 **멀리서도 찾게** 해 준다. 둘은 같은 값을 본다.
                  */}
                  {moved && (
                    <circle cx={b.x} cy={b.y} r={(BLIP_R + 3.5) / k} fill="none"
                            stroke={st.color} strokeWidth={1.5 / k} opacity="0.5" />
                  )}
                  <circle cx={b.x} cy={b.y} r={rr}
                          fill={st.color}
                          stroke={b.tech.isStale ? '#b45309' : '#fff'}
                          strokeWidth={(b.tech.isStale ? 2.5 : 1.5) / k} />
                  <text x={b.x} y={b.y} fontSize={10 / k} fill="#fff" fontWeight="700"
                        textAnchor="middle" dominantBaseline="central"
                        style={{ pointerEvents: 'none' }}>
                    {b.no}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </Frame>

      <Side>
        <Legend>
          <span><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#64748b" /></svg> 기술</span>
          <span>
            <svg width="22" height="12">
              <line x1="1" y1="6" x2="14" y2="6" stroke="#64748b" strokeWidth="1.4"
                    strokeDasharray="3 2" opacity="0.6" />
              <path d="M14 3 L20 6 L14 9 z" fill="#64748b" opacity="0.6" />
            </svg>
            최근 {MOVED_DAYS}일 내 옮겨온 자리
          </span>
          <span><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="#64748b" stroke="#b45309" strokeWidth="2" /></svg> 근거 낡음</span>
          <span>안쪽일수록 이미 쓰는 것</span>
        </Legend>

        {STAGES.map((st, si) => {
          const items = blips.filter((b) => b.ri === si);
          if (!items.length) return null;
          return (
            <Group key={st.key} $color={st.color}>
              <h4>{st.key} ({items.length})</h4>
              <ol>
                {/*
                  ⚠️ **버튼 안에 버튼을 넣지 않는다.** 분류를 누를 수 있게 하려고
                     한때 그렇게 짰는데, HTML 이 금지하는 모양이라 클릭이 어느 쪽에
                     먹을지 브라우저마다 다르고 키보드ㆍ스크린리더가 깨진다
                     (React 가 `validateDOMNesting` 으로 운다 — 2026-08-25 신고).
                     둘을 **형제**로 펴고 감싸는 것은 div 로 둔다.
                */}
                {items.map((b) => (
                  <li key={b.tech.uuid}>
                    <Entry $hot={hot === b.tech.uuid}
                           onMouseEnter={() => setHot(b.tech.uuid)}
                           onMouseLeave={() => setHot(null)}>
                      <MainBtn type="button" $color={st.color}
                               onClick={() => onSelect(b.tech)}>
                        <b>{b.no}</b>
                        <span>
                          {b.tech.name}
                          {b.tech.movedFrom && (
                            <> <Moved title={`${b.tech.movedFrom} 에서 옮겨왔습니다`}>
                              {b.tech.movedFrom}→
                            </Moved></>
                          )}
                          {b.tech.isStale && (
                            <> <Mark $color="#b45309" title="근거가 오래 없습니다">
                              <AlertTriangle size={11} />
                            </Mark></>
                          )}
                        </span>
                      </MainBtn>
                      <SubRow>
                        <SectorBtn type="button"
                                   title="이 갈래만 봅니다"
                                   onClick={() => onSectorClick
                                     && onSectorClick(b.tech.category || '')}>
                          {b.tech.category || UNCATEGORIZED}
                        </SectorBtn>
                        <em>· 근거 {b.tech.evidenceCount ?? 0}건</em>
                      </SubRow>
                    </Entry>
                  </li>
                ))}
              </ol>
            </Group>
          );
        })}
      </Side>
    </Wrap>
  );
};

export default RadarChart;
