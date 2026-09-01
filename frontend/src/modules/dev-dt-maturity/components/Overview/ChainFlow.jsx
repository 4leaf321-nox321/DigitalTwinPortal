import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  BaseEdge, Background, Controls, EdgeLabelRenderer, Handle, MarkerType, Position,
  getSmoothStepPath,
} from 'reactflow';
import 'reactflow/dist/style.css';
import styled from 'styled-components';

/**
 * 「계획」의 순서도 — 개발 부문 · 디지털 트윈 부문 · 제조 부문. (2026-08-31, 2026-09-01 개정)
 *
 * 왜 reactflow 인가
 *     제조 프로세스 모듈이 이미 쓰는 라이브러리다(dev-manufacturing-process). 새 의존을
 *     들이지 않고, 확대·이동·미니맵을 공짜로 얻는다.
 *
 * 띠가 셋, 단이 다섯이다
 *     ┌ 개발 부문 ┐  기반 요소(시험 설비·인력 …)          ← 디지털 트윈 **밖**
 *     │           │  업무 단계 요구 → 설계 → 시작품 → 시험 → 이관
 *     ├ 디지털 트윈 ┤ 여섯 분야의 성숙도 지표 — 위·아래 업무에 **작용**한다(acts_on)
 *     │ 제조 부문  │  업무 단계 라인 구축 → 시생산 → 양산 → 보전 → 품질
 *     └           ┘  기반 요소(설비 투자·인력 운영 …)      ← 디지털 트윈 **밖**
 *     오른쪽으로  KPI(선후 순) ▶ 절감 성과 ▶ 갈래 ▶ 성장 성과
 *
 * ⚠️ 이 그림이 답해야 하는 것 — 「디지털 트윈이 **어느 업무를** 어떻게 바꿔서 **어느
 *    성과**에 닿나, 그리고 그 성과를 디지털 트윈 **말고** 무엇이 또 움직이나」.
 *    지표에서 KPI 로 곧장 가는 선만 있으면 앞은 보여도 뒤가 안 보인다 — 시험 설비를
 *    늘려도 리드타임은 준다. 그래서 개발·제조의 업무 요소를 따로 세우고, 그것이 KPI 를
 *    미는 선(디지털 트윈과 무관한 경로)을 같이 그린다. 기여를 부풀리지 않는 편이
 *    임원 자료로 더 믿음직하다.
 *
 * ⚠️ 지표는 서로 걸린다(deps). 그 선행 관계로 지표의 가로 자리를 정한다 — 선행이 없는
 *    축이 맨 왼쪽. 같은 단의 지표는 세로로 쌓아 부문 높이를 줄인다.
 *
 * ⚠️ 집계 지표(가상검증률·데이터 연결율)에 **칸을 따로 주지 않는다.** 원본 축에
 *    「정확도 (가상검증률)」로 적고 노란색으로 가른다.
 *
 * ⚠️ KPI 사이에도 선후가 있다(leads_to). 기준선은 성과에 직접 닿는 KPI 다 — 거쳐 가는
 *    것은 앞으로 당기고, 뒤를 잇는 것은 뒤로 민다. 거쳐 가는 KPI 는 성과에 직접 안
 *    닿는다 — 또 달면 같은 절감을 두 번 센다.
 *
 * ⚠️ 성과가 두 단이다. 제품 경쟁력·신사업은 절감보다 **뒤 단계**(stage: growth). 그 사이에
 *    개발시간의 세 갈래를 끼워 「개발 여력 → 신사업」이 앞으로 흐르게 했다.
 *
 * ⚠️ 선의 뜻
 *       옅은 실선   지표 ─▶ 지표 · 단계 ─▶ 단계   선행·차례
 *       실선        지표 ─▶ KPI ─▶ 성과            경로가 이어져 있다
 *       파란 실선   지표 ─▶ 업무                   디지털 트윈이 **작용**하는 자리
 *       진한 점선   업무 ┈▶ KPI                    디지털 트윈 **밖**의 경로
 *       점선        지표 ┄▶ 성과                   대응 KPI 미정의 — 주장이지 측정이 아니다
 *       점점선      초안 부문에서 나가는 선          제안이지 근거가 아니다
 *
 * ⚠️ 칸 안에는 이름만 둔다. 나머지는 호버 요약으로, 「어떻게 기여하나」는 칸을 눌렀을
 *    때 남은 선 위에만 뜬다 — 평소에 다 띄우면 글자밭이 된다.
 */

/** 무대 — 전체 화면이면 뷰포트를 덮는다. */
const Stage = styled.div`
  ${p => p.$full && `
    position: fixed; inset: 0; z-index: 60; background: #ffffff;
    padding: 1rem 1.1rem 0.6rem; box-sizing: border-box;
    display: flex; flex-direction: column;
  `}
`;
const Wrap = styled.div`
  position: relative;
  height: ${p => (p.$full ? 'auto' : `${p.$h}px`)};
  ${p => p.$full && 'flex: 1 1 auto; min-height: 0;'}
  border: 1px solid #e2e8f0; border-radius: 0.6rem; background: #fafbfc;
  .react-flow__attribution { display: none; }
  .react-flow__node { cursor: pointer; }
  /* ⚠️ 선 위 설명은 카드보다 **앞**에 서야 한다. reactflow 의 기본 선 라벨은 SVG
     안에 있어 카드 밑으로 깔린다 — 그래서 EdgeLabelRenderer(별도 div 층)로 옮기고
     그 층을 카드 층 위로 올린다. 이 규칙이 빠지면 설명이 조용히 가려진다. */
  .react-flow__edgelabel-renderer { z-index: 20; }
`;
/** 선 위 설명 — 알약 꼴. 길면 접는다(한 줄로 두면 그림을 가로지른다). */
const EdgeBadge = styled.div`
  position: absolute; pointer-events: none;
  max-width: 12.5rem; box-sizing: border-box;
  padding: 0.2rem 0.55rem; border-radius: 999px;
  border: 1px solid #cbd5e1; background: #ffffff; color: #334155;
  font-size: 0.72rem; font-weight: 600; line-height: 1.4; text-align: center;
  white-space: normal; overflow-wrap: break-word;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
`;
/* 오른쪽 위 도구 — 토글과 전체 화면. 확대·축소 단추(왼쪽 아래)와 안 겹친다. */
const Tools = styled.div`
  position: absolute; top: 0.6rem; right: 0.6rem; z-index: 5;
  display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; justify-content: flex-end;
`;
const Sep = styled.i`
  display: block; width: 1px; height: 1.1rem; background: #e2e8f0; margin: 0 0.25rem;
`;
/* 켜진 것은 진하게, 꺼진 것은 비운다 — 무엇이 빠져 있는지가 단추에서 바로 읽힌다 */
const Chip = styled.button`
  padding: 0.28rem 0.62rem; border-radius: 999px; cursor: pointer;
  font-size: 0.76rem; font-weight: 600; line-height: 1.2;
  border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#cbd5e1')};
  background: ${p => (p.$on ? '#1e40af' : '#ffffff')};
  color: ${p => (p.$on ? '#ffffff' : '#94a3b8')};
  text-decoration: ${p => (p.$on ? 'none' : 'line-through')};
  &:hover { filter: brightness(0.96); }
`;
const FullBtn = styled.button`
  display: inline-flex; align-items: center; gap: 0.35rem;
  padding: 0.35rem 0.7rem; border-radius: 0.4rem; cursor: pointer;
  border: 1px solid #cbd5e1; background: #ffffff; color: #334155;
  font-size: 0.8rem; font-weight: 600;
  &:hover { background: #f1f5f9; }
`;
const Legend = styled.div`
  display: flex; gap: 1.2rem; flex-wrap: wrap; margin-top: 0.7rem;
  ${p => p.$full && 'flex: 0 0 auto; margin-top: 0.55rem;'}
  font-size: 0.82rem; color: #64748b;
  span { display: inline-flex; align-items: center; gap: 0.35rem; }
  i { display: block; width: 1.6rem; height: 0; border-top: 2px solid #94a3b8; }
`;

/* 단마다 다른 생김새 — 색이 곧 계층이다. */
const Box = styled.div`
  padding: 0.4rem 0.7rem; border-radius: 0.45rem; font-size: 0.82rem; font-weight: 600;
  border: ${p => p.$bw || 1}px ${p => (p.$dashed ? 'dashed' : 'solid')} ${p => p.$bd};
  background: ${p => p.$bg}; color: ${p => p.$fg};
  width: 100%; box-sizing: border-box; text-align: center; line-height: 1.35;
  opacity: ${p => (p.$dim ? 0.62 : 1)};
  /* 누른 칸은 테두리를 한 겹 더 두른다 — 흐림만으로는 어느 것을 눌렀는지 모른다 */
  box-shadow: ${p => (p.$on ? '0 0 0 2px #1d4ed8, 0 4px 12px rgba(30, 64, 175, 0.25)' : 'none')};
  small { display: block; font-size: 0.7rem; font-weight: 500; opacity: 0.85; margin-top: 0.1rem; }
`;
/** 띠 — 부문의 바탕. 칸 뒤에 깔리고, 누르거나 올려도 아무 일이 없다. */
const BandBox = styled.div`
  width: 100%; height: 100%; box-sizing: border-box; pointer-events: none;
  border-radius: 0.8rem; border: 1px dashed ${p => p.$bd}; background: ${p => p.$bg};
  padding: 0.45rem 0.9rem;
  font-size: 0.95rem; font-weight: 800; color: ${p => p.$fg}; letter-spacing: 0.02em;
  small { margin-left: 0.6rem; font-size: 0.74rem; font-weight: 500; opacity: 0.8; }
`;

/**
 * 호버 설명 — **화면 좌표**에 띄운다(position: fixed).
 *
 * ⚠️ 칸 안에 넣으면 확대·축소를 같이 먹어 글자가 뭉개지고, reactflow 의 캔버스가
 *    잘라 먹는다. 흐름 바깥에 두어 배율과 무관하게 같은 크기로 읽히게 한다.
 */
const Tip = styled.div`
  position: fixed; z-index: 70; width: 25rem; max-width: 92vw; pointer-events: none;
  padding: 0.7rem 0.85rem; border-radius: 0.5rem;
  background: #0f172a; color: #e2e8f0; box-shadow: 0 8px 22px rgba(15, 23, 42, 0.28);
  font-size: 0.82rem; line-height: 1.6;
  h5 { margin: 0; font-size: 0.92rem; color: #f8fafc; }
  h5 span { display: block; margin-top: 0.1rem; font-size: 0.76rem; font-weight: 500; color: #94a3b8; }
  dl { margin: 0.5rem 0 0; display: grid; grid-template-columns: 6.2rem 1fr; gap: 0.25rem 0.7rem; }
  dt { color: #94a3b8; font-size: 0.78rem; white-space: nowrap; }
  dd { margin: 0; color: #e2e8f0; }
`;
/* 척도의 단계 하나 — 알약. 유효 수준은 황색으로 도드라진다. */
const Rung = styled.span`
  display: inline-block; margin: 0.1rem 0.3rem 0.1rem 0; padding: 0.05rem 0.45rem;
  border-radius: 999px; font-size: 0.74rem; font-weight: 600; line-height: 1.5;
  border: ${p => (p.$gate ? '2px' : '1px')} solid ${p => (p.$on ? '#fcd34d' : '#475569')};
  background: ${p => (p.$on ? '#fde68a' : 'transparent')};
  color: ${p => (p.$on ? '#78350f' : '#cbd5e1')};
  font-weight: ${p => (p.$gate ? 800 : 600)};
`;

const STYLE = {
  indicator: { bd: '#bfdbfe', bg: '#eff6ff', fg: '#1e40af' },
  derived: { bd: '#fcd34d', bg: '#fffbeb', fg: '#92400e' },
  kpi: { bd: '#c7d2fe', bg: '#eef2ff', fg: '#3730a3' },
  // 현행 관리 KPI — 가상검증률(집계 지표)과 같은 황색. 지금 회사가 보는 숫자라는 뜻이다.
  kpi_now: { bd: '#fcd34d', bg: '#fffbeb', fg: '#92400e' },
  current: { bd: '#1d4ed8', bg: '#1e40af', fg: '#ffffff' },
  neo: { bd: '#cbd5e1', bg: '#f1f5f9', fg: '#64748b' },
  branch: { bd: '#e2e8f0', bg: '#f8fafc', fg: '#475569' },
  // 다음 성과로 이어지는 갈래만 색을 준다 — 나머지 둘은 거기서 끝난다
  branch_on: { bd: '#bfdbfe', bg: '#eff6ff', fg: '#1e40af' },
  // 아직 안 연 분야의 초안 — 테두리를 끊어 「제안」임을 보인다
  todo: { bd: '#cbd5e1', bg: '#f8fafc', fg: '#94a3b8', dashed: true },
  // 디지털 트윈 **밖** — 업무 단계(굵은 실선)와 기반 요소(끊긴 선). 둘 다 흰 바탕.
  step: { bd: '#64748b', bg: '#ffffff', fg: '#1e293b', bw: 1.5 },
  lever: { bd: '#94a3b8', bg: '#ffffff', fg: '#475569', dashed: true },
};
const BAND_STYLE = {
  development: { bd: '#cbd5e1', bg: 'rgba(241, 245, 249, 0.55)', fg: '#475569' },
  dt: { bd: '#93c5fd', bg: 'rgba(219, 234, 254, 0.35)', fg: '#1e40af' },
  manufacturing: { bd: '#cbd5e1', bg: 'rgba(241, 245, 249, 0.55)', fg: '#475569' },
};

const hidden = { opacity: 0 };
/**
 * 칸 — 손잡이가 여섯이다. 좌우는 KPI·성과로 가는 가로 선, 위아래는 **업무 띠**로 가는
 * 세로 선이 쓴다. 손잡이를 좌우만 두면 위 띠로 가는 선이 오른쪽으로 나갔다가 꺾여
 * 올라와 다른 선과 뒤엉킨다.
 */
const NodeBox = ({ data }) => {
  const st = STYLE[data.kind];
  return (
    <>
      <Handle type="target" position={Position.Left} style={hidden} />
      <Handle type="target" position={Position.Top} id="tt" style={hidden} />
      <Handle type="target" position={Position.Bottom} id="tb" style={hidden} />
      <Box $bd={st.bd} $bg={st.bg} $fg={st.fg} $dashed={st.dashed} $bw={st.bw}
           $dim={data.kind === 'neo'} $on={data.hl === 'on'}>
        {data.label}
        {data.sub && <small>{data.sub}</small>}
      </Box>
      <Handle type="source" position={Position.Right} style={hidden} />
      <Handle type="source" position={Position.Top} id="st" style={hidden} />
      <Handle type="source" position={Position.Bottom} id="sb" style={hidden} />
    </>
  );
};
const BandNode = ({ data }) => {
  const st = BAND_STYLE[data.band];
  return (
    <BandBox $bd={st.bd} $bg={st.bg} $fg={st.fg}>
      {data.label}{data.sub && <small>{data.sub}</small>}
    </BandBox>
  );
};
const nodeTypes = { box: NodeBox, band: BandNode };

/** 꺾인 곳을 둥글린 꺾은선 — 차선 경로에 쓴다. */
const roundedPath = (pts, r = 8) => {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const [px, py] = pts[i - 1]; const [cx, cy] = pts[i]; const [nx, ny] = pts[i + 1];
    const a = Math.hypot(cx - px, cy - py); const b = Math.hypot(nx - cx, ny - cy);
    const ra = Math.min(r, a / 2, b / 2);
    const inX = cx - ((cx - px) / a) * ra; const inY = cy - ((cy - py) / a) * ra;
    const outX = cx + ((nx - cx) / b) * ra; const outY = cy + ((ny - cy) / b) * ra;
    d += ` L ${inX} ${inY} Q ${cx} ${cy} ${outX} ${outY}`;
  }
  const [ex, ey] = pts[pts.length - 1];
  return `${d} L ${ex} ${ey}`;
};

/**
 * 선 — 두 가지 길로 그린다.
 *   가로 길(data.hroute) 옆으로 들어가는 모든 선. 제 줄에 가로막는 칸이 있으면 줄 사이 틈
 *                    (차선 runY)으로 비켜 달리고, 목적지 앞 제 꺾는 자리(bx)에서 목적지 왼쪽
 *                    변의 제 자리(ey)로 들어간다 — 같은 칸으로 모이는 선끼리 bx·ey 가 다르다.
 *                    설명은 달리는 긴 구간 한가운데.
 *   세로 차선(data.vlane) 위·아래 띠로 가는 선. 같은 업무 칸으로 모이는 선들이 **같은 높이에서
 *                    꺾여 같은 자리로 들어가면** 꺾인 구간이 통째로 포개진다 — 꺾이는 높이(dy)와
 *                    들어가는 자리(dx)를 선마다 달리 준다. 먼 데서 오는 선이 목적지에 가까운
 *                    높이를 받아 서로 가로지르지 않는다.
 *   계단             나머지. reactflow 의 smoothstep.
 * 설명 자리는 data.shift 만큼 비켜 앉는다 — 칸·다른 설명과 겹치지 않게 미리 셈한 값.
 */
const BadgeEdge = ({ id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, style, markerEnd, label, data }) => {
  let path; let lx; let ly;
  if (data?.vlane) {
    // 세로 차선 — 같은 업무 칸으로 모이는 선들이 꺾이는 높이와 들어가는 자리를 달리한다.
    const { sdx = 0, tdx = 0, dy } = data.vlane;
    const laneY = (sourceY + targetY) / 2 + dy;
    const sx0 = sourceX + sdx;
    const ex = targetX + tdx;
    path = Math.abs(ex - sx0) < 1
      ? `M ${sx0} ${sourceY} L ${ex} ${targetY}`
      : roundedPath([[sx0, sourceY], [sx0, laneY], [ex, laneY], [ex, targetY]]);
    lx = (sx0 + ex) / 2; ly = laneY;
  } else if (data?.hroute) {
    // 가로 길 — 나가기(필요하면 차선으로 비킴) · 달리기 · 목적지 옆 제자리로 들어가기.
    const { runY, bx, ey } = data.hroute;
    const o = 14;
    const pts = [[sourceX, sourceY]];
    if (Math.abs(runY - sourceY) >= 1) pts.push([sourceX + o, sourceY], [sourceX + o, runY]);
    pts.push([bx, runY]);
    if (Math.abs(ey - runY) >= 1) pts.push([bx, ey]);
    pts.push([targetX, ey]);
    path = roundedPath(pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]));
    lx = ((Math.abs(runY - sourceY) >= 1 ? sourceX + o : sourceX) + bx) / 2; ly = runY;
  } else {
    [path, lx, ly] = getSmoothStepPath({
      sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
    });
  }
  // 자리를 미리 잡아 준 값(anchor)이 있으면 그것으로 — 없으면 선 한가운데
  const ax = data?.anchor ? data.anchor.x : lx;
  const ay = data?.anchor ? data.anchor.y : ly;
  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <EdgeBadge style={{ transform: `translate(-50%, -50%) translate(${ax}px, ${ay}px)` }}>
            {label}
          </EdgeBadge>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

/** 설명 알약의 크기(대략) — 자리를 잡는 셈에 쓴다. 실제 폭은 12.5rem 에서 접힌다. */
const badgeSize = (text) => {
  const w = Math.min(200, (text || '').length * 7.4 + 22);
  return { w, h: w >= 200 && (text || '').length > 24 ? 44 : 28 };
};
const hits = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);

/**
 * 고른 칸의 선마다 설명 자리를 잡는다 — 칸과 다른 설명을 피해 위·아래로 비켜 앉힌다.
 *
 * ⚠️ 선 한가운데 그냥 붙이면 선이 짧을 때 양쪽 칸을 덮고, 같은 칸으로 모이는 선들의
 *    설명이 포개진다. 후보 자리(제자리 → 위 → 아래 → 더 위 …)를 차례로 대 보고 처음
 *    비는 곳에 둔다. 설명은 칸을 눌렀을 때만 뜨므로 그때 십여 개만 셈한다.
 */
/**
 * 설명이 앉을 수 있는 자리들 — **선 위**에서 고른다. 가로로 달리는 구간의 가운데·앞·뒤와,
 * 목적지 앞에서 오르내리는 세로 구간의 여러 지점.
 *
 * ⚠️ 예전엔 가로 구간 한가운데 하나만 두고 위·아래로만 비켰다. KPI 와 성과 사이처럼 가로
 *    구간이 짧고 선이 여럿 모이는 곳에서는 전부 위·아래로 밀려 그림 밖까지 나갔다.
 *    세로 구간은 그 자리에서 가장 길고 비어 있는 곳이다 — 거기를 후보에 넣는다.
 */
const spotsOf = (e) => {
  const g = e.data.geo;
  const pts = [];
  if (e.data.hroute) {
    const { runY, bx, ey } = e.data.hroute;
    const x0 = Math.abs(runY - g.sy) >= 1 ? g.sx + 14 : g.sx;
    const run = bx - x0;
    pts.push([(x0 + bx) / 2, runY]);
    if (run > 120) pts.push([x0 + run * 0.3, runY], [x0 + run * 0.7, runY]);
    const v = ey - runY;
    if (Math.abs(v) > 60) [0.5, 0.3, 0.7, 0.15, 0.85].forEach(t => pts.push([bx, runY + v * t]));
  } else if (e.data.vlane) {
    const { sdx = 0, tdx = 0, dy } = e.data.vlane;
    const laneY = (g.sy + g.ty) / 2 + dy;
    const sx0 = g.sx + sdx;
    const ex = g.tx + tdx;
    pts.push([(sx0 + ex) / 2, laneY]);
    const hv = ex - sx0;
    if (Math.abs(hv) > 120) pts.push([sx0 + hv * 0.3, laneY], [sx0 + hv * 0.7, laneY]);
    const v1 = laneY - g.sy;
    if (Math.abs(v1) > 60) pts.push([sx0, g.sy + v1 / 2]);
    const v2 = g.ty - laneY;
    if (Math.abs(v2) > 60) pts.push([ex, laneY + v2 / 2]);
  } else {
    pts.push([e.data.mid.x, e.data.mid.y]);
  }
  return pts;
};

/**
 * 고른 칸의 선마다 설명 자리를 잡는다 — 칸과 다른 설명을 피해, 될수록 **선 위**에.
 *
 * 차례: 선 위의 후보들을 먼저 다 대 보고, 안 되면 그 후보들을 위·아래로 34px 씩 비켜 본다.
 * 그래도 없으면 제자리(첫 후보) — 겹치더라도 허공보다는 제 선 곁이 낫다.
 * 돌려주는 값은 **절대 좌표**다. BadgeEdge 가 그 자리에 그린다.
 */
export const placeLabels = (nodes, edges, focused) => {
  const rects = nodes.filter(n => n.type !== 'band')
    .map(n => ({ x: n.position.x, y: n.position.y, w: n.style.width || 0, h: H_BOX }));
  const taken = [];
  const out = {};
  [...edges].filter(e => focused.has(e.id) && e.data?.how && e.data?.mid)
    .sort((a, b) => a.data.mid.y - b.data.mid.y)
    .forEach((e) => {
      const { w, h } = badgeSize(e.data.how);
      const spots = e.data.geo ? spotsOf(e) : [[e.data.mid.x, e.data.mid.y]];
      const steps = [0, ...Array.from({ length: 6 }, (_, k) => [-(k + 1) * 34, (k + 1) * 34]).flat()];
      let at = null;
      for (const dy of steps) {
        for (const [px, py] of spots) {
          const r = { x: px - w / 2, y: py + dy - h / 2, w, h };
          if (!rects.some(o => hits(r, o)) && !taken.some(o => hits(r, o))) { at = { x: px, y: py + dy }; break; }
        }
        if (at) break;
      }
      if (!at) at = { x: spots[0][0], y: spots[0][1] };
      taken.push({ x: at.x - w / 2, y: at.y - h / 2, w, h });
      out[e.id] = at;
    });
  return out;
};
const edgeTypes = { badge: BadgeEdge };

/* ⚠️ 칸이 서로 겹쳐 보이면 선을 못 따라간다 — 특히 KPI·성과 쪽은 들어오는 선이
   많아 더 벌려야 한다(2026-09-01). 지표는 단이 많아 가로로, KPI·성과는 세로로 넓힌다. */
const COL_W = 330;                  // 지표 단 사이 가로 간격 — 차선이 돌아갈 자리
const GAP_KPI = 140;                // 지표·업무의 실제 오른쪽 끝 ─ KPI 사이
const GAP_OUT = 270;                // KPI 마지막 단 ─ 절감 성과 사이
const KPI_STEP = 260;               // KPI 단 사이 가로 간격
const GAP_BR = 250;                 // 절감 성과 ─ 갈래 사이
const GAP_GROW = 250;               // 갈래 ─ 성장 성과 사이
const ROW_H = 90;                   // 지표 세로 간격 — 줄 사이 틈에 차선과 설명이 앉는다
const H_BOX = 48;                   // 칸 높이(대략) — 손잡이 자리·차선 셈에 쓴다
const LANE = 38;                    // 차선 — 칸 아래 가장자리에서 조금 떨어진 줄 사이 틈
const ROW_KPI = 100;                // KPI 는 들어오는 선이 많다
const ROW_OUT = 110;                // 성과도 마찬가지
const ROW_BR = 80;                  // 갈래 세로 간격
const SEC_GAP = 26;                 // 부문 사이
const STEP_W = 330;                 // 업무 단계 사이 가로 간격
const BAND_GAP = 110;               // 띠 사이 — 세로 선이 지나갈 자리
const BAND_PAD = 44;                // 띠 머리글 높이
/* 누른 자리에서 이만큼 안쪽에서 손을 떼면 고르기 — 그보다 멀면 화면 옮기기다.
   ⚠️ 0 이면 손떨림에도 선택이 씹힌다. 너무 크면 짧게 끈 것이 선택으로 잡힌다. */
const SLOP = 8;
const W_IND = 215;
const W_KPI = 195;
const W_OUT = 190;
const W_BR = 180;
const W_ACT = 225;

/* 디지털 트윈 띠 안의 부문 차례 — 개발에 붙는 것이 위, 제조에 붙는 것이 아래.
   그래야 위 띠로 가는 선과 아래 띠로 가는 선이 서로를 가로지르지 않는다. */
const SECTOR_ORDER = ['design_automation', 'verification_automation', 'simulation',
  'digital_thread', 'factory_optimization', 'manufacturing_monitoring'];

/** 선행을 따라 단을 매긴다 — 선행이 없으면 0, 있으면 (선행의 최대 단)+1. */
const depthsOf = (inds) => {
  const dep = Object.fromEntries(inds.map(i => [i.axis, (i.deps || []).map(d => d.key)]));
  const d = Object.fromEntries(inds.map(i => [i.axis, 0]));
  // 축 수만큼 돌면 비순환 그래프는 반드시 안정된다. 순환이 섞여도 여기서 멈춘다.
  for (let n = 0; n < inds.length; n += 1) {
    inds.forEach((i) => {
      const ds = dep[i.axis].filter(k => k in d);
      if (ds.length) d[i.axis] = Math.max(d[i.axis], ...ds.map(k => d[k] + 1));
    });
  }
  return d;
};

const names = xs => (xs || []).map(x => x.label).join(' · ');
/** 척도 — 단계 사다리를 한 줄로. 유효 수준은 「」로 감싼다(예: 시험 병행 → … → 「신뢰성 인증 게이트」 → 완전 대체). */
const ladder = (levels, gate) => ((levels || []).length
  ? (levels || []).map((l, i) => ({ label: l.label, on: gate != null && i >= gate, gate: i === gate })) : null);
/** 빈 줄은 아예 안 만든다 — 「—」로 채우면 설명이 길어지기만 한다. */
const row = (k, v) => (v ? [{ k, v }] : []);

/* 디지털 트윈 부문이 어느 쪽에 붙나 — 스레드는 둘을 **잇는다**(연계). */
const PART_OF = {
  design_automation: 'dev', verification_automation: 'dev', simulation: 'dev',
  digital_thread: 'link',
  factory_optimization: 'mfg', manufacturing_monitoring: 'mfg',
};
export const TOGGLES = [
  { key: 'dev', label: '개발' }, { key: 'mfg', label: '제조' }, { key: 'link', label: '연계' },
  null,                                      // 구분선
  { key: 'dt', label: '디지털 트윈' }, { key: 'outside', label: '디지털 트윈 외' },
];
const ALL_ON = { dev: true, mfg: true, link: true, dt: true, outside: true };

/**
 * 토글대로 **입력을 자른다.** 칸을 숨기는 대신 입력에서 빼서 배치가 다시 촘촘해지게 한다.
 * KPI·성과는 여기서 안 건드린다 — 들어오는 선이 없어지면 buildChain 이 뺀다.
 */
export const sliceChain = ({ sectors = [], drafts = [], chain = {}, kpis = [] }, tg = ALL_ON) => {
  // 부문의 쪽은 백엔드가 준다(part). 없으면 이름으로 가르고, 그도 없으면 연계로 본다.
  const keep = sec => tg.dt && tg[sec.part || PART_OF[sec.key] || 'link'];
  const c = {};
  if (tg.outside && tg.dev && chain.development) c.development = chain.development;
  if (tg.outside && tg.mfg && chain.manufacturing) c.manufacturing = chain.manufacturing;
  // ⚠️ KPI 도 소속(part)으로 거른다. 개발만 켰는데 양산 이관 → 공정 직행률 → 인당 생산대수로
  //    제조 KPI 가 딸려 들어오던 것을 막는다. any(ASR)는 개발·제조·연계 어느 하나면 남는다.
  const kOn = k => (k.part === 'dev' ? tg.dev : k.part === 'mfg' ? tg.mfg : (tg.dev || tg.mfg || tg.link));
  return { sectors: sectors.filter(keep), drafts: drafts.filter(keep), chain: c, kpis: kpis.filter(kOn) };
};

/** 누른 칸에 **직접** 걸린 것 — 한 다리 건너까지 물면 결국 다 켜져 흐림이 무의미해진다. */
export const focusOf = (edges, id) => {
  const near = new Set([id]);
  const on = new Set();
  edges.forEach((e) => {
    if (e.source !== id && e.target !== id) return;
    on.add(e.id);
    near.add(e.source);
    near.add(e.target);
  });
  return { nodes: near, edges: on };
};

/**
 * @param sectors  [{key,label,indicators:[{axis,axis_label,deps,kpi,acts_on,new_outcomes,derived_label}]}]
 * @param kpis     [{key,label,tier,domain,outcomes,leads_to}] — 집계 지표는 여기서 걸러진다
 * @param outcomes [{key,label,status,stage,branches}]
 * @param drafts   [{key,label,indicators}] — 아직 안 연 분야의 **초안** 지표
 * @param chain    {development:{label,elements}, manufacturing:{...}} — 디지털 트윈 **밖**의 업무
 */
export const buildChain = ({ sectors = [], kpis = [], outcomes = [], drafts = [], chain = {} }) => {
  const ns = [];
  const es = [];
  const shown = kpis.filter(k => k.tier !== 'derived');
  const shownSet = new Set(shown.map(k => k.key));
  const outLabel = Object.fromEntries(outcomes.map(o => [o.key, o.label]));
  const measured = new Set(shown.flatMap(k => k.outcomes || []));
  const kpiLabel = Object.fromEntries(shown.map(k => [k.key, k.label]));
  // 역방향 — KPI 를 미는 지표·업무, 성과에 닿는 KPI·지표. 호버만으로 읽히게 요약에 싣는다.
  const pushI = {}; const pushE = {}; const reachK = {}; const reachI = {};
  const add = (m, k, v) => { (m[k] = m[k] || []).includes(v) || (m[k] = [...(m[k] || []), v]); };

  const all = [...sectors, ...drafts.map(d => ({ ...d, draft: true }))]
    .sort((a, b) => {
      const ia = SECTOR_ORDER.indexOf(a.key); const ib = SECTOR_ORDER.indexOf(b.key);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

  // 어느 업무에 어느 지표가 작용하나 — 업무 칸의 요약이 쓴다
  const actedBy = {};
  const feeds = {};                       // 업무 요소 → 그것이 입력이 되는 지표
  all.forEach(sec => sec.indicators.forEach((ind) => {
    (ind.acts_on || []).forEach((a) => { (actedBy[a.key] = actedBy[a.key] || []).push(ind.axis_label); });
    (ind.fed_by || []).forEach((f) => { (feeds[f.key] = feeds[f.key] || []).push(ind.axis_label); });
  }));

  const dev = chain.development || { label: '개발 부문', elements: [] };
  const mfg = chain.manufacturing || { label: '제조 부문', elements: [] };
  all.forEach(sec => sec.indicators.forEach((ind) => {
    ind.kpi.forEach(k => add(pushI, k.key, ind.axis_label));
    (ind.new_outcomes || []).forEach(o => add(reachI, o.key, ind.axis_label));
  }));
  [...dev.elements, ...mfg.elements].forEach(e => (e.kpi || []).forEach(k => add(pushE, k.key, e.label)));
  shown.forEach(k => (k.outcomes || []).forEach(o => add(reachK, o, k.label)));
  const elemBand = {};
  const bands = {};                       // band → {top, bottom}

  /** 업무 띠 한 줄 — 단계와 기반 요소. 단계는 디지털 트윈 띠 **쪽**에 붙인다. */
  const putElements = (band, list, y0, stepsFirst) => {
    const steps = list.filter(e => e.kind === 'step');
    const levers = list.filter(e => e.kind !== 'step');
    const rows = (stepsFirst ? [steps, levers] : [levers, steps]).filter(r => r.length);
    rows.forEach((items, r) => items.forEach((e, i) => {
      elemBand[e.key] = band;
      ns.push({
        id: `b:${e.key}`, type: 'box',
        position: { x: i * STEP_W, y: y0 + r * ROW_H },
        data: { kind: e.kind === 'step' ? 'step' : 'lever', label: e.label,
          sub: e.kind === 'step' ? '디지털 트윈 밖 · 업무 단계' : '디지털 트윈 밖 · 기반 요소',
          tip: { title: e.label,
            sub: [band === 'development' ? dev.label : mfg.label,
              e.kind === 'step' ? '업무 단계' : '기반 요소(자원·조직)', '디지털 트윈 밖'].join(' · '),
            rows: [...row('내용', e.note),
              ...row('작용하는 DT 지표', (actedBy[e.key] || []).join(' · ')
                || (e.kind === 'step' ? undefined : '없음 — 디지털 트윈 대체 불가 영역')),
              ...row('입력을 주는 지표', (feeds[e.key] || []).join(' · ')),
              ...row('움직이는 KPI', (e.kpi || []).map(k => k.label).join(' · ')),
              ...row('다음 단계', e.next && (list.find(x => x.key === e.next) || {}).label)] } },
        style: { width: W_ACT }, draggable: false, selectable: false,
      });
    }));
    return y0 + rows.length * ROW_H;
  };

  // ⚠️ 띠는 담을 것이 있을 때만 선다 — 토글로 비운 띠가 빈 상자로 남으면 안 된다.
  // ── 개발 부문 (위) — 기반 요소 줄, 그 아래 단계 줄 ─────────────────────────
  let y = 0;
  if (dev.elements.length) {
    bands.development = { top: 0 };
    y = putElements('development', dev.elements, BAND_PAD, false);
    bands.development.bottom = y + 6;
    y += BAND_GAP;
  }

  // ── 디지털 트윈 부문 (가운데) — 세로는 부문 순, 가로는 선행 단 ───────────
  if (all.length) bands.dt = { top: y - 8 };
  if (all.length) y += BAND_PAD - 8;
  let maxD = 0;
  all.forEach((sec) => {
    const d = depthsOf(sec.indicators);
    const slot = {};                     // 같은 단의 지표는 세로로 쌓는다
    let rowsUsed = 0;
    sec.indicators.forEach((ind) => {
      const dep = d[ind.axis];
      maxD = Math.max(maxD, dep);
      const r = slot[dep] || 0;
      slot[dep] = r + 1;
      rowsUsed = Math.max(rowsUsed, r + 1);
      const news = (ind.new_outcomes || []).map(o => `${o.label}(KPI 미정의)`).join(' · ');
      const title = ind.derived_label ? `${ind.axis_label} (${ind.derived_label})` : ind.axis_label;
      ns.push({
        id: `i:${sec.key}:${ind.axis}`, type: 'box',
        position: { x: dep * COL_W, y: y + r * ROW_H },
        // 집계 지표의 **원본** 축이면 그 이름을 병기하고 노랑으로 가른다.
        data: { kind: sec.draft ? 'todo' : (ind.derived_label ? 'derived' : 'indicator'),
          sub: sec.draft ? `${sec.label} · 초안` : sec.label,
          label: title,
          tip: {
            title,
            sub: [sec.label, ind.role_label && `${ind.role_label} 지표`,
              ind.level_label && `유효 수준 「${ind.level_label}」`,
              sec.draft && '초안 — 축·수준 미정의'].filter(Boolean).join(' · '),
            rows: [
              ...row('업무 변화', ind.change),
              ...row('척도', ladder(ind.levels, ind.level_index)),
              ...row('작용 업무', names(ind.acts_on)),
              ...row('측정 지표', (ind.metric || []).join(' · ')),
              ...row('선행 요건', names(ind.deps)),
              ...row('타 부문 선행', (ind.needs || []).map(n => `${n.sector_label} · ${n.label}`).join(' · ')),
              ...row('입력 업무', names(ind.fed_by)),
              ...row('연계 KPI', names(ind.kpi)),
              ...row('기여 성과', [names(ind.outcomes), news].filter(Boolean).join(' · ')),
              ...row('조사 목적', ind.why),
            ],
          } },
        style: { width: W_IND }, draggable: false, selectable: false,
      });
    });
    y += rowsUsed * ROW_H + SEC_GAP;
  });
  if (all.length) {
    y -= SEC_GAP;
    bands.dt.bottom = y + 6;
    y += BAND_GAP;
  }

  // ── 제조 부문 (아래) — 단계 줄, 그 아래 기반 요소 줄 ───────────────────────
  if (mfg.elements.length) {
    bands.manufacturing = { top: y - 8 };
    y = putElements('manufacturing', mfg.elements, y + BAND_PAD - 8, true);
    bands.manufacturing.bottom = y + 6;
  }
  const bandH = y;

  // ── 무엇이 살아남나 — 배치하기 **전에** 센다 ──────────────────────────
  // ⚠️ 배치한 뒤에 지우면 남은 칸 사이에 구멍이 남는다. 들어오는 선이 있을 KPI 만,
  //    그 KPI 가 닿을 성과만 자리를 받는다. 사슬(leads_to)·갈래(to)도 따라간다.
  const liveK = new Set();
  const mark = k => { if (shownSet.has(k)) liveK.add(k); };
  all.forEach(sec => sec.indicators.forEach(ind => ind.kpi.forEach(k => mark(k.key))));
  [...dev.elements, ...mfg.elements].forEach(e => (e.kpi || []).forEach(k => mark(k.key)));
  for (let n = 0; n < shown.length; n += 1) {
    shown.forEach(k => { if (liveK.has(k.key)) Object.keys(k.leads_to || {}).forEach(mark); });
  }
  const liveO = new Set();
  shown.forEach(k => { if (liveK.has(k.key)) (k.outcomes || []).forEach(o => liveO.add(o)); });
  all.forEach(sec => sec.indicators.forEach(ind => (ind.new_outcomes || []).forEach(o => liveO.add(o.key))));
  for (let n = 0; n < outcomes.length; n += 1) {
    outcomes.forEach(o => { if (liveO.has(o.key)) (o.branches || []).forEach(b => { if (b.to) liveO.add(b.to); }); });
  }
  const live = shown.filter(k => liveK.has(k.key));
  const liveOut = outcomes.filter(o => liveO.has(o.key));

  // ── KPI 열의 가로 자리 — 지표와 업무 중 더 오른쪽까지 뻗은 쪽 뒤에 ─────────
  // ⚠️ 지표 단 수로만 잡으면, 지표를 끄거나 얕은 부문만 남을 때 KPI 열이 업무 띠의
  //    가로 줄과 겹친다.
  const rowW = list => (list.length ? (list.length - 1) * STEP_W + W_ACT : 0);
  const elemRight = Math.max(...[dev, mfg].flatMap(b => [
    rowW(b.elements.filter(e => e.kind === 'step')), rowW(b.elements.filter(e => e.kind !== 'step'))]), 0);
  // ⚠️ 지표의 오른쪽 끝은 「단 수 × 단 간격」이 아니라 **마지막 칸의 실제 오른쪽 변**이다 —
  //    전자로 재면 단 간격과 칸 폭의 차이(115px)만큼 빈자리가 남았다.
  const indRight = all.length ? maxD * COL_W + W_IND : 0;
  const xKpi = Math.max(indRight, elemRight) + GAP_KPI;

  // ── 세로 가운데 맞춤 — 띠·KPI·성과 중 가장 긴 것이 전체 높이다 ────────────
  const kpiH0 = live.length * ROW_KPI;
  const outH0 = Math.max(liveOut.filter(o => (o.stage || 'saving') !== 'growth').length,
    liveOut.filter(o => o.stage === 'growth').length) * ROW_OUT;
  const tall = Math.max(bandH, kpiH0, outH0, 3 * ROW_KPI);
  const dy = (tall - bandH) / 2;
  if (dy > 0) {
    ns.forEach((n) => { n.position.y += dy; });
    Object.values(bands).forEach((b) => { b.top += dy; b.bottom += dy; });
  }

  /**
   * KPI 의 단 — **기준선은 성과에 직접 닿는 KPI** 다.
   * 거쳐 가는 것(평균 복구 시간)은 그 앞으로 당기고, 그 뒤를 잇는 것(인당 생산대수)은
   * 뒤로 민다. 세로는 개발 → 품질 → 제조 차례 — 띠의 차례와 맞춘다.
   */
  const rank = Object.fromEntries(live.map(k => [k.key, (k.outcomes || []).length ? 0 : null]));
  const nexts = k => Object.keys(k.leads_to || {}).filter(t => t in rank);
  for (let n = 0; n < live.length; n += 1) {
    live.forEach((k) => {
      if (rank[k.key] !== null) return;
      const rs = nexts(k).map(t => rank[t]).filter(v => v !== null);
      if (rs.length) rank[k.key] = Math.min(...rs) - 1;
    });
  }
  live.forEach((k) => { if (rank[k.key] === null) rank[k.key] = 0; });
  for (let n = 0; n < live.length; n += 1) {
    live.forEach(k => nexts(k).forEach((t) => { rank[t] = Math.max(rank[t], rank[k.key] + 1); }));
  }
  const minR = Math.min(...Object.values(rank), 0);
  const spanR = Math.max(...Object.values(rank), 0) - minR;
  const ordered = live;                 // KPI_SET 의 차례가 곧 세로 차례 — 여기서 다시 정렬하지 않는다
  const kpiH = ordered.length * ROW_KPI;
  const top = h => Math.max(0, (tall - h) / 2);
  ordered.forEach((k, i) => {
    ns.push({
      id: `k:${k.key}`, type: 'box',
      position: { x: xKpi + (rank[k.key] - minR) * KPI_STEP, y: top(kpiH) + i * ROW_KPI },
      data: { kind: k.managed ? 'kpi_now' : 'kpi', label: k.label, sub: k.domain,
        tip: { title: k.label,
          sub: [`${k.domain} · ${k.managed ? '현행 관리 KPI' : '신규 제안 KPI'}`,
            (k.outcomes || []).length ? null : '경유 KPI — 성과 직결 없음'].filter(Boolean).join(' · '),
          rows: [...row('정의', k.note),
            ...row('기여 지표', (pushI[k.key] || []).join(' · ')),
            ...row('기여 업무', (pushE[k.key] || []).join(' · ')),
            ...row('이어지는 KPI', Object.keys(k.leads_to || {}).map(t => kpiLabel[t]).filter(Boolean).join(' · ')),
            ...row('기여 성과', (k.outcomes || []).map(o => outLabel[o]).filter(Boolean).join(' · '))] } },
      style: { width: W_KPI }, draggable: false, selectable: false,
    });
  });
  const xOut = xKpi + spanR * KPI_STEP + GAP_OUT;
  const xBr = xOut + GAP_BR;
  const xGrow = xBr + GAP_GROW;

  // ── 성과 — 절감 단과 성장 단. 새로 짚는 것은 회색. ─────────────────────
  const saving = liveOut.filter(o => (o.stage || 'saving') !== 'growth');
  const growth = liveOut.filter(o => o.stage === 'growth');
  const outAt = {};
  const putOut = (list, x) => list.forEach((o, i) => {
    const neo = o.status === 'new';
    const blank = !measured.has(o.key);
    outAt[o.key] = top(list.length * ROW_OUT) + i * ROW_OUT;
    ns.push({
      id: `o:${o.key}`, type: 'box', position: { x, y: outAt[o.key] },
      data: { kind: neo ? 'neo' : 'current', label: o.label,
        sub: blank ? '대응 KPI 미정의' : undefined,
        tip: { title: o.label,
          sub: [o.stage === 'growth' ? '성장 단계' : '비용 절감 단계',
            neo ? '신규 제안 성과 — 본 조사의 후보' : '현행 관리 성과',
            blank && '대응 KPI 미정의'].filter(Boolean).join(' · '),
          rows: [...row('창출 경로', o.lever),
            ...row('연계 KPI', (reachK[o.key] || []).join(' · ')),
            ...row('직결 지표', (reachI[o.key] || []).join(' · ')),
            ...(o.branches || []).map(b => ({ k: b.label, v: b.note }))] } },
      style: { width: W_OUT }, draggable: false, selectable: false,
    });
  });
  putOut(saving, xOut);
  putOut(growth, xGrow);

  // ── 갈래 — 절감 단과 성장 단 **사이** ─────────────────────────────────
  liveOut.forEach((o) => {
    const bs = o.branches || [];
    bs.forEach((b, i) => {
      ns.push({
        id: `br:${o.key}:${i}`, type: 'box',
        position: { x: xBr, y: outAt[o.key] + (i - (bs.length - 1) / 2) * ROW_BR },
        data: { kind: b.to ? 'branch_on' : 'branch', label: b.label,
          sub: b.to ? `${outLabel[b.to] || ''} 투자 재원` : undefined,
          tip: { title: b.label, sub: `${o.label} 단축의 가치 실현 경로`,
            rows: [...row('내용', b.note),
              ...row('전이 대상', b.to && `${outLabel[b.to]} 투자 재원`)] } },
        style: { width: W_BR }, draggable: false, selectable: false,
      });
    });
  });

  // ── 띠 바탕 — 맨 뒤에 깔린다 ──────────────────────────────────────────
  const fullW = xGrow + W_OUT + 60;
  const BAND_LABEL = {
    development: [dev.label, '요구 → 설계 → 시작품 → 시험 → 이관 · 디지털 트윈 밖의 기반 요소'],
    dt: ['디지털 트윈 부문', ''],
    manufacturing: [mfg.label, '라인 구축 → 시생산 → 양산 → 보전 → 품질 · 디지털 트윈 밖의 기반 요소'],
  };
  Object.entries(bands).forEach(([band, b]) => {
    ns.push({
      id: `band:${band}`, type: 'band', position: { x: -30, y: b.top - 6 },
      data: { band, label: BAND_LABEL[band][0], sub: BAND_LABEL[band][1] },
      style: { width: fullW, height: b.bottom - b.top + 12 },
      zIndex: -1, draggable: false, selectable: false, focusable: false,
    });
  });

  // ── 선 ────────────────────────────────────────────────────────────────
  const ids = new Set(ns.map(n => n.id));
  const at0 = Object.fromEntries(ns.map(n => [n.id, n]));
  const KIND = {
    dep: { stroke: '#cbd5e1', strokeWidth: 1.2 },               // 선행 · 차례
    feed: { stroke: '#94a3b8', strokeWidth: 1.3 },              // 업무 ─▶ 지표 — 밖에서 받는 입력
    flow: { stroke: '#94a3b8', strokeWidth: 1.4 },              // 지표 ▶ KPI ▶ 성과
    apply: { stroke: '#60a5fa', strokeWidth: 1.3 },             // 지표 ▶ 업무 — 디지털 트윈의 자리
    outside: { stroke: '#94a3b8', strokeWidth: 1.2, strokeDasharray: '1 4' },  // 업무 ┈▶ KPI
    none: { stroke: '#cbd5e1', strokeWidth: 1.2, strokeDasharray: '5 4' },     // 대응 KPI 없음
    todo: { stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '2 4' },       // 초안
    apply_todo: { stroke: '#93c5fd', strokeWidth: 1.1, strokeDasharray: '2 4' },
  };
  // how — 「어떻게 기여하나」. 칸을 눌렀을 때만 선 위에 뜬다(ChainFlow 가 붙인다).
  const line = (id, from, to, kind, how, handles = {}) => {
    if (!ids.has(from) || !ids.has(to)) return;   // 부문에서 뺀 축은 걸러진다
    es.push({
      id, source: from, target: to, type: 'badge', style: KIND[kind], data: { how, kind },
      ...handles,
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: KIND[kind].stroke },
    });
  };

  all.forEach(sec => sec.indicators.forEach((ind) => {
    const me = `i:${sec.key}:${ind.axis}`;
    // 초안에서 나가는 선은 전부 점점선이다 — 아직 근거가 아니라 제안이다.
    const kd = sec.draft ? 'todo' : 'dep';
    const kf = sec.draft ? 'todo' : 'flow';
    (ind.deps || []).forEach(d => line(`d:${sec.key}:${d.key}:${ind.axis}`,
      `i:${sec.key}:${d.key}`, me, kd, d.how));
    ind.kpi.filter(k => shownSet.has(k.key))
      .forEach(k => line(`e:${sec.key}:${ind.axis}:${k.key}`, me, `k:${k.key}`, kf, k.how));
    (ind.new_outcomes || []).forEach(o => line(`n:${sec.key}:${ind.axis}:${o.key}`,
      me, `o:${o.key}`, sec.draft ? 'todo' : 'none', o.how));
    // 다른 부문의 선행 ─▶ 이 지표 — 부문 줄 사이를 세로로 잇는다(위에 있으면 아래 손잡이에서).
    (ind.needs || []).forEach((n) => {
      const from = `i:${n.sector}:${n.axis}`;
      if (!at0[from]) return;
      const downward = at0[from].position.y < at0[me]?.position.y;
      line(`w:${n.sector}:${n.axis}:${sec.key}:${ind.axis}`, from, me, sec.draft ? 'todo' : 'dep', n.how,
        downward ? { sourceHandle: 'sb', targetHandle: 'tt' } : { sourceHandle: 'st', targetHandle: 'tb' });
    });
    // 업무 ─▶ 지표 — 밖에서 받는 **입력**. 작용의 역방향이라 색을 달리한다.
    (ind.fed_by || []).forEach((f) => {
      const up = elemBand[f.key] === 'development';
      line(`f:${f.key}:${sec.key}:${ind.axis}`, `b:${f.key}`, me, 'feed', f.how,
        up ? { sourceHandle: 'sb', targetHandle: 'tt' } : { sourceHandle: 'st', targetHandle: 'tb' });
    });
    // 지표 ─▶ 업무 — 디지털 트윈이 **작용**하는 자리. 위 띠로는 위 손잡이, 아래는 아래.
    (ind.acts_on || []).forEach((a) => {
      const up = elemBand[a.key] === 'development';
      line(`a:${sec.key}:${ind.axis}:${a.key}`, me, `b:${a.key}`,
        sec.draft ? 'apply_todo' : 'apply', a.how,
        up ? { sourceHandle: 'st', targetHandle: 'tb' } : { sourceHandle: 'sb', targetHandle: 'tt' });
    });
  }));
  // 업무 ─▶ 업무(차례) · 업무 ┈▶ KPI(디지털 트윈 **밖**의 경로)
  [...dev.elements, ...mfg.elements].forEach((e) => {
    if (e.next) line(`q:${e.key}:${e.next}`, `b:${e.key}`, `b:${e.next}`, 'dep', '다음 단계');
    (e.kpi || []).filter(k => shownSet.has(k.key))
      .forEach(k => line(`x:${e.key}:${k.key}`, `b:${e.key}`, `k:${k.key}`, 'outside', k.how));
  });
  // KPI ─▶ KPI (선후) · KPI ─▶ 성과
  shown.forEach((k) => {
    Object.entries(k.leads_to || {}).forEach(([to, how]) => line(`c:${k.key}:${to}`,
      `k:${k.key}`, `k:${to}`, 'flow', how));
    (k.outcomes || []).forEach(o => line(`e:k:${k.key}:${o}`,
      `k:${k.key}`, `o:${o}`, 'flow', (k.how || {})[o]));
  });
  // 성과 ─▶ 갈래, 그리고 「개발 여력」 갈래 ┄▶ 신사업.
  // ⚠️ 시간 단축은 원가가 아니라 **재원**이다 — 그 이어지는 선이 이 그림의 요점이다.
  outcomes.forEach(o => (o.branches || []).forEach((b, i) => {
    line(`s:${o.key}:${i}`, `o:${o.key}`, `br:${o.key}:${i}`, 'dep', b.note);
    if (b.to) line(`b:${o.key}:${b.to}`, `br:${o.key}:${i}`, `o:${b.to}`, 'none',
      `${outLabel[b.to]} 투자 재원 전환`);
  }));

  // ⚠️ 안전망 — 들어오는 선이 하나도 없는 KPI·성과·갈래는 뺀다. 살아남을 것을 미리
  //    셌으므로 평소엔 아무것도 안 빠진다. 셈이 어긋나도 허공에 뜬 칸은 안 남는다.
  let nodes = ns;
  let edges = es;
  for (;;) {
    const incoming = new Set(edges.map(e => e.target));
    const drop = new Set(nodes.filter(n => /^(k|o|br):/.test(n.id) && !incoming.has(n.id)).map(n => n.id));
    if (!drop.size) break;
    nodes = nodes.filter(n => !drop.has(n.id));
    edges = edges.filter(e => !drop.has(e.source) && !drop.has(e.target));
  }
  // ── 선의 기하 — 어디서 나와 어디로 들어가나. 차선·설명 자리 셈의 재료다 ───
  const at = Object.fromEntries(nodes.map(n => [n.id, n]));
  const pt = (n, handle, isSource) => {
    const w = n.style.width || 0;
    if (handle === 'st' || handle === 'tt') return [n.position.x + w / 2, n.position.y];
    if (handle === 'sb' || handle === 'tb') return [n.position.x + w / 2, n.position.y + H_BOX];
    return [n.position.x + (isSource ? w : 0), n.position.y + H_BOX / 2];
  };
  edges.forEach((e) => {
    const [sx, sy] = pt(at[e.source], e.sourceHandle, true);
    const [tx, ty] = pt(at[e.target], e.targetHandle, false);
    e.data = { ...e.data, mid: { x: (sx + tx) / 2, y: (sy + ty) / 2 }, geo: { sx, sy, tx, ty } };
  });
  // ── 가로 선 — 나가기 · 달리기 · 옆으로 들어가기 ───────────────────────────
  // y 높이의 가로 구간 [x1,x2] 가 어떤 칸을 뚫는가
  const blocked = (yy, x1, x2, skip) => nodes.some(n => n.type !== 'band' && !skip.has(n.id)
    && n.position.y < yy && yy < n.position.y + H_BOX
    && n.position.x < x2 && x1 < n.position.x + (n.style.width || 0));
  const laneCount = {};                    // 차선을 나누는 수 — 같은 칸을 나누는 선끼리 번갈아 위·아래
  const horiz = edges.filter(e => !e.sourceHandle && !e.targetHandle && e.data.geo.tx > e.data.geo.sx);
  horiz.forEach((e) => {
    const { sx, sy, tx } = e.data.geo;
    let runY = sy;
    // 제 줄에 가로막는 칸이 있으면 줄 사이 틈으로 비킨다 — 먼 열에서 오는 선이 중간 칸을 안 뚫는다
    const skip = new Set([e.source, e.target]);
    if (blocked(sy, sx + 1, tx - 14, skip)) {
      const i = Math.max(laneCount[e.source] || 0, laneCount[e.target] || 0);
      laneCount[e.source] = i + 1; laneCount[e.target] = i + 1;
      // 차선도 막힐 수 있다 — KPI 열은 지표 줄과 안 맞춰져 있다. 빈 쪽을 고른다.
      // 줄 사이 틈(축 아래 24 ~ 다음 줄 위 66) 안에서 빈 높이를 찾는다. 먼 열(KPI·성과)의
      // 칸은 지표 줄과 안 맞춰져 있어 한 자리만 재면 몰리기 쉽다.
      // ⚠️ 차선은 **목적지 쪽**으로 낸다. 번갈아 위·아래로 주면 위 줄에서 온 선이 아래 차선을,
      //    아래 줄에서 온 선이 위 차선을 타서 목적지 앞에서 서로 엇갈렸다(위아래 순서 뒤집힘).
      //    같은 줄(ty == sy)일 때만 번갈아 준다 — 그때는 어느 쪽이든 순서가 없다.
      const { ty } = e.data.geo;
      const sign = ty > sy + 1 ? 1 : ty < sy - 1 ? -1 : (i % 2 === 0 ? 1 : -1);
      // 목적지 쪽 후보를 **전부** 먼저 대 보고, 다 막혔을 때만 반대쪽으로 — 순서가 뒤집히는 것보다
      // 칸을 뚫는 것이 더 나쁘다. 반대쪽으로 간 선은 표시(laneForced)를 남긴다.
      const free = yy => !blocked(yy, sx + 15, tx - 14, skip);
      const ds = [38, 32, 44, 28, 50, 56, 62];
      const near = ds.map(d => sy + sign * d).find(free);
      if (near != null) runY = near;
      else { runY = ds.map(d => sy - sign * d).find(free) ?? sy + sign * ds[0]; e.data.laneForced = true; }
    }
    e.data.hroute = { runY, bx: tx - 14, ey: e.data.geo.ty };
    if (runY !== sy) e.data.lane = runY - sy;
  });
  // 같은 칸으로 모이는 선끼리 — 들어가는 자리(ey)는 오는 높이 순, 꺾는 자리(bx)는 먼 것이 목적지 쪽
  const into = {};
  horiz.forEach((e) => { (into[e.target] = into[e.target] || []).push(e); });
  Object.values(into).forEach((g) => {
    const n = g.length;
    const ty = g[0].data.geo.ty;
    const stepE = n > 1 ? Math.min(12, (H_BOX - 12) / (n - 1)) : 0;
    // ⚠️ 출발 **줄**(sy)로 줄 세운다. 차선 높이(runY)로 세우면 차선 폭(28~62)의 차이 때문에
    //    한 줄 위에서 온 선이 아래 선보다 낮게 잡혀 들어가는 순서가 뒤집혔다.
    const byY = [...g].sort((a, b) => a.data.geo.sy - b.data.geo.sy || a.data.hroute.runY - b.data.hroute.runY);
    const byFar = [...g].sort((a, b) => Math.abs(b.data.geo.sy - ty) - Math.abs(a.data.geo.sy - ty));
    g.forEach((e) => {
      const { sx, tx } = e.data.geo;
      const ey = ty + (byY.indexOf(e) - (n - 1) / 2) * stepE;
      const bx = Math.max(tx - 14 - byFar.indexOf(e) * 10, sx + 22);
      e.data.hroute = { ...e.data.hroute, bx, ey };
      const x0 = e.data.hroute.runY !== e.data.geo.sy ? sx + 14 : sx;
      e.data.mid = { x: (x0 + bx) / 2, y: e.data.hroute.runY };
    });
  });
  // 세로 선(디지털 트윈의 작용) — 같은 업무 칸으로 모이는 것끼리 꺾이는 높이·들어가는 자리를
  // 나눈다. 안 나누면 마지막 세로 구간과 가로 구간이 통째로 포개진다(자동화·시험 대체 → 시험·검증).
  const groups = {};
  edges.filter(e => e.sourceHandle).forEach((e) => {
    (groups[`${e.target}|${e.targetHandle}`] = groups[`${e.target}|${e.targetHandle}`] || []).push(e);
  });
  // ⚠️ 자리는 **칸의 한 변**마다 나눈다 — 그 변으로 나가는 선과 들어오는 선을 함께.
  //    목적지별로만 나누면, 한 칸의 위 변에서 나가는 선(작용)과 들어오는 선(입력·선행)이
  //    같은 한가운데를 써서 세로 구간이 포개졌다. 양쪽 끝(sdx·tdx)을 따로 매긴다.
  const sideOf = h => (h === 'st' || h === 'tt' ? 'top' : 'bottom');
  const ends = {};
  edges.filter(e => e.sourceHandle).forEach((e) => {
    const cx = n => n.position.x + (n.style.width || 0) / 2;
    (ends[`${e.source}|${sideOf(e.sourceHandle)}`] = ends[`${e.source}|${sideOf(e.sourceHandle)}`] || [])
      .push({ e, end: 's', other: cx(at[e.target]) });
    (ends[`${e.target}|${sideOf(e.targetHandle)}`] = ends[`${e.target}|${sideOf(e.targetHandle)}`] || [])
      .push({ e, end: 't', other: cx(at[e.source]) });
  });
  Object.entries(ends).forEach(([key, list]) => {
    const node = at[key.split('|')[0]];
    const w = node.style.width || 0;
    const n = list.length;
    const stepX = n > 1 ? Math.min(18, (w - 40) / (n - 1)) : 0;
    [...list].sort((a, b) => a.other - b.other).forEach((it, i) => {       // 상대가 왼쪽이면 왼쪽 자리
      it.e.data.vlane = it.e.data.vlane || {};
      it.e.data.vlane[it.end === 's' ? 'sdx' : 'tdx'] = (i - (n - 1) / 2) * stepX;
    });
  });
  Object.values(groups).forEach((g) => {
    const n = g.length;
    const t = at[g[0].target];
    const tcx = t.position.x + (t.style.width || 0) / 2;
    const stepY = n > 1 ? Math.min(12, (BAND_GAP - 24) / (n - 1)) : 0;
    const byFar = [...g].sort((a, b) => Math.abs(b.data.mid.x - tcx) - Math.abs(a.data.mid.x - tcx));
    g.forEach((e) => {
      const [sx, sy] = pt(at[e.source], e.sourceHandle, true);
      const [tx, ty] = pt(t, e.targetHandle, false);
      const dir = Math.sign(ty - sy) || 1;                                       // 목적지 쪽이 +
      // 같은 띠 사이를 **반대 방향**으로 건너는 선끼리 가로 구간이 같은 높이에 포개지지 않게 —
      // 가로 구간을 제 **출발** 쪽으로 8px 당긴다. 올라가는 선은 아래에, 내려오는 선은 위에 놓여 갈린다.
      const bias = -8 * dir;
      const dy = dir * ((n - 1) / 2 - byFar.indexOf(e)) * stepY + bias;      // 먼 것이 목적지에 가깝게
      e.data.vlane = { ...e.data.vlane, dy };
      const sdx = e.data.vlane.sdx || 0; const tdx = e.data.vlane.tdx || 0;
      e.data.mid = { x: (sx + sdx + tx + tdx) / 2, y: (sy + ty) / 2 + dy };
    });
  });
  return { nodes, edges, height: tall + 80 };
};

const ChainFlow = ({ sectors = [], kpis = [], outcomes = [], drafts = [], chain = {} }) => {
  const [tg, setTg] = useState(ALL_ON);
  const { nodes, edges, height } = useMemo(
    () => buildChain({ outcomes, ...sliceChain({ sectors, drafts, chain, kpis }, tg) }),
    [sectors, kpis, outcomes, drafts, chain, tg]);
  const [tip, setTip] = useState(null);
  const [sel, setSel] = useState([]);           // 고른 칸들 — Ctrl 로 여럿
  // 토글을 바꾸면 고른 칸이 사라질 수 있다 — 고름을 푼다
  const flip = useCallback((k) => { setSel([]); setTg(t => ({ ...t, [k]: !t[k] })); }, []);
  const [full, setFull] = useState(false);
  const stage = useRef(null);

  // 누른 칸에 걸린 것만 남기고 나머지는 흐린다. 지우는 것보다 자리를 남기는 편이
  // 전체 그림을 잃지 않는다 — 어디가 비어 있는지도 이 자료의 내용이다.
  const view = useMemo(() => {
    if (!sel.length) return { nodes, edges };
    // 여럿을 골랐으면 각각에 걸린 것의 합집합 — 어느 하나에라도 걸리면 남는다
    const f = { nodes: new Set(), edges: new Set() };
    sel.forEach((id) => {
      const one = focusOf(edges, id);
      one.nodes.forEach(x => f.nodes.add(x));
      one.edges.forEach(x => f.edges.add(x));
    });
    return {
      nodes: nodes.map((n) => {
        if (n.type === 'band') return n;                 // 띠는 흐리지 않는다
        const hl = sel.includes(n.id) ? 'on' : (f.nodes.has(n.id) ? 'near' : 'off');
        return { ...n, data: { ...n.data, hl },
          style: { ...n.style, opacity: hl === 'off' ? 0.16 : 1 } };
      }),
      edges: (() => {
        const shift = placeLabels(nodes, edges, f.edges);
        return edges.map((e) => {
          if (!f.edges.has(e.id)) return { ...e, style: { ...e.style, opacity: 0.08 } };
          // 남은 선에만 「어떻게 기여하나」를 얹는다 — 자리는 칸·다른 설명을 피해 잡은 값
          return { ...e, label: e.data?.how, data: { ...e.data, anchor: shift[e.id] },
            style: { ...e.style, stroke: '#334155', strokeWidth: (e.style.strokeWidth || 1) + 0.8 },
            markerEnd: { ...e.markerEnd, color: '#334155' } };
        });
      })(),
    };
  }, [nodes, edges, sel]);

  // 커서를 따라간다. 오른쪽·아래 끝에서는 반대편으로 넘겨 화면 밖으로 안 나가게 한다.
  const at = useCallback((e, node) => {
    if (!node.data.tip) { setTip(null); return; }      // 띠에는 요약이 없다
    const w = 25 * 16 + 24;      // Tip 의 폭 + 여백. 어긋나면 오른쪽에서 잘린다
    const x = e.clientX + 18 + w > window.innerWidth ? e.clientX - 18 - w : e.clientX + 18;
    const y = Math.min(e.clientY + 14, Math.max(8, window.innerHeight - 240));
    setTip({ ...node.data.tip, x, y });
  }, []);
  const off = useCallback(() => setTip(null), []);

  /**
   * 전체 화면 — 브라우저의 진짜 전체 화면을 먼저 청하고, 안 되면 덮개만으로 간다.
   *
   * ⚠️ 나가는 길이 두 갈래다(단추 · ESC). ESC 는 브라우저가 fullscreenchange 로만
   *    알려 주므로, 그 신호를 받아 상태를 되돌린다 — 안 그러면 덮개만 남는다.
   */
  const toggleFull = useCallback(() => {
    setFull((was) => {
      if (was) { document.exitFullscreen?.().catch(() => {}); return false; }
      stage.current?.requestFullscreen?.().catch(() => {});   // 막혀도 덮개는 선다
      return true;
    });
  }, []);
  useEffect(() => {
    const sync = () => { if (!document.fullscreenElement) setFull(false); };
    const esc = (e) => { if (e.key === 'Escape') setFull(false); };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  /**
   * 고르기 — reactflow 의 onNodeClick 대신 **누른 자리와 뗀 자리의 거리**로 가른다.
   *
   * ⚠️ 빈 곳뿐 아니라 칸 위에서 끌어도 화면이 움직인다(panOnDrag). d3-zoom 은 1px
   *    만 움직여도 그 몸짓을 「끌기」로 보고 뒤따르는 click 을 막아 버린다 — 그래서
   *    칸이 안 골라지는 일이 생겼다. 손을 뗀 자리가 SLOP 안쪽이면 고르기로 본다.
   * ⚠️ **포인터** 이벤트로 받는다. d3-zoom 은 끌기가 끝날 때 window 에서 mouseup 을
   *    stopImmediatePropagation 으로 삼켜 버려서, mouseup 으로는 아예 안 들어온다.
   *    pointerup 은 건드리지 않으므로 그쪽으로 받는다(mouse 는 뒤따라오는 보조).
   * ⚠️ 시간이 아니라 **거리**로 재는 이유 — 천천히 눌렀다 떼는 것도 고르기다.
   */
  const down = useRef(null);
  const onDown = useCallback((e) => { down.current = { x: e.clientX, y: e.clientY }; }, []);
  const onUp = useCallback((e) => {
    const d = down.current;
    down.current = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > SLOP) return;   // 끌었다
    if (e.target.closest?.('.react-flow__controls')) return;                 // 확대·축소 단추
    const id = e.target.closest?.('.react-flow__node')?.getAttribute('data-id');
    // 띠를 누른 것은 빈 곳을 누른 것과 같다
    const pick = id && !id.startsWith('band:') ? id : null;
    // Ctrl(Mac 은 ⌘)+클릭 — 더하거나 뺀다. 그냥 클릭 — 그것 하나만, 같은 것을 다시 누르면 해제.
    const multi = e.ctrlKey || e.metaKey;
    setSel((s) => {
      if (!pick) return multi ? s : [];
      if (multi) return s.includes(pick) ? s.filter(x => x !== pick) : [...s, pick];
      return s.length === 1 && s[0] === pick ? [] : [pick];
    });
  }, []);

  return (
    <Stage ref={stage} $full={full}>
      <Wrap $h={height} $full={full} onPointerDown={onDown} onPointerUp={onUp}
            onMouseDown={onDown} onMouseUp={onUp}>
        <Tools>
          {TOGGLES.map((t, i) => (t
            ? <Chip key={t.key} type="button" $on={tg[t.key]} aria-pressed={tg[t.key]}
                    onClick={() => flip(t.key)} title={tg[t.key] ? '해제 시 숨김' : '선택 시 표시'}>
                {t.label}
              </Chip>
            : <Sep key={`sep${i}`} />))}
          <Sep />
          <FullBtn type="button" onClick={toggleFull} aria-pressed={full}>
            {full ? '전체 화면 해제 (ESC)' : '전체 화면'}
          </FullBtn>
        </Tools>
        {/* ⚠️ key 를 바꿔 다시 그린다 — 크기·내용이 달라졌으니 fitView 를 새로 태워야 한다 */}
        <ReactFlow key={`${full ? 'full' : 'inline'}:${Object.values(tg).map(Number).join('')}`}
                   nodes={view.nodes} edges={view.edges}
                   nodeTypes={nodeTypes} edgeTypes={edgeTypes}
                   fitView fitViewOptions={{ padding: 0.04 }} minZoom={0.15}
                   nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
                   onNodeMouseEnter={at} onNodeMouseMove={at} onNodeMouseLeave={off}
                   proOptions={{ hideAttribution: true }}>
          <Background color="#e2e8f0" gap={18} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </Wrap>
      {tip && (
        <Tip style={{ left: tip.x, top: tip.y }} role="tooltip">
          <h5>{tip.title}<span>{tip.sub}</span></h5>
          {tip.rows.length > 0 && (
            <dl>
              {tip.rows.map(r => (
                <React.Fragment key={r.k}>
                  <dt>{r.k}</dt>
                  <dd>{Array.isArray(r.v)
                    ? r.v.map(b => <Rung key={b.label} $on={b.on} $gate={b.gate}>{b.label}</Rung>)
                    : r.v}</dd>
                </React.Fragment>
              ))}
            </dl>
          )}
        </Tip>
      )}
      <Legend $full={full}>
        <span><i style={{ borderColor: '#60a5fa' }} /> <b>디지털 트윈의 작용</b> — 지표의 대상 업무</span>
        <span><i style={{ borderTopStyle: 'dotted' }} /> <b>디지털 트윈 밖</b> — 업무 자체의 KPI 기여 경로</span>
        <span><i style={{ borderColor: '#94a3b8' }} /> <b>업무 → 지표 입력</b> — 밖에서 받는 것(실측·불량 정보·규정)</span>
        <span><i /> 연계 경로 확보</span>
        <span><i style={{ borderColor: '#cbd5e1' }} /> 선행 요건 · 다음 단계</span>
        <span><i style={{ borderTopStyle: 'dashed' }} /> 대응 KPI 미정의 — 측정 불가</span>
        <span style={{ color: '#92400e' }}>황색 = 현행 관리 KPI · 그 집계 대상 지표</span>
        <span style={{ color: '#3730a3' }}>남색 = 신규 제안 KPI</span>
        <span style={{ color: '#94a3b8' }}>끊긴 테두리 = 초안 부문 · 기반 요소</span>
        <span style={{ color: '#94a3b8' }}>회색 = 신규 제안 성과(후보) · 우측 = 성장 성과</span>
        <span style={{ color: '#334155' }}>
          항목 호버 시 <b>요약 표시</b>, 클릭 시 <b>연계 경로·기여 내용 표시</b>, Ctrl+클릭 시 <b>복수 선택</b>
          {sel.length > 0 && ' — 빈 영역 클릭 시 해제'}
        </span>
      </Legend>
    </Stage>
  );
};

export default ChainFlow;
