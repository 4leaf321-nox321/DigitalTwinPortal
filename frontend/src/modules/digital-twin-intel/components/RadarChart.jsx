import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  AlertTriangle, Minus, Plus, Maximize2, Move, Tag, History, Filter,
} from 'lucide-react';

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
 *    매 판마다 편집으로 골라낸다. 여기서는 **확대**로 대응한다 — 점 크기가 고정이라
 *    몰린 자리를 키우면 벌어진다. 전부 훑는 자리는 목록 보기다.
 *    (한때 90개가 넘으면 「걸러서 보라」는 안내를 띄웠는데, **늘 떠 있어서 아무도
 *     안 읽는 잔소리**가 됐다. 확대가 실제 해법이므로 안내는 걷어냈다.)
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

  /*
    ⚠️⚠️ **바로 아래 자식(>)에만 건다.** 그냥 svg 로 두면 이 틀 안의 **모든** svg 에
       걸리는데, 여기엔 오른쪽 위 도구 단추의 아이콘도 들어 있다. 그러면 아이콘이
       width:100% · height:100% · flex:1 로 늘어나 단추를 꽉 채운다 — 전역
       규칙(button svg { width: 1em })이 있는데도 **이쪽이 명시도에서 이겨서**
       (0,1,1 대 0,0,2) 조용히 덮어쓴다. 2026-08-25 신고.

    이 규칙이 겨냥하는 것은 **레이더 그림 하나뿐**이고, 그것은 이 틀의 바로 아래
    자식이다.

    ⚠️ 이 주석에 백틱을 쓰면 안 된다 — 스타일 템플릿이 거기서 끊긴다(방금 겪었다).
  */
  > svg {
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
    > svg { height: auto; }
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

  /* 켜진 상태. ⚠️ 눌린 것이 보여야 한다 — 안 보이면 이름표가 안 뜨는 것이
     고장인지 꺼 둔 것인지 알 수 없다. */
  ${(p) => p.$on && `
    background: #4f46e5;
    color: #fff;
    &:hover:not(:disabled) { background: #4338ca; color: #fff; }
  `}
`;

/* 기간 고르개. ⚠️ 도구 상자 안에 두어 **스위치 바로 밑**에 오게 한다 — 멀리 두면
   그 둘이 한 가지 일이라는 것이 안 보인다. */
const DaySel = styled.select`
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  background: #fff;
  color: #4338ca;
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.125rem 0.0625rem;
  text-align: center;
  cursor: pointer;
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

/*
  안 그린 것의 수. ⚠️ **범례 바로 밑, 목록보다 위**에 둔다 — 목록 끝에 두면
  63줄 밑이라 아무도 못 본다.
*/
const Quiet = styled.p`
  margin: 0 0 0.625rem;
  padding: 0.4375rem 0.5625rem;
  border: 1px dashed #c7d2fe;
  border-radius: 0.375rem;
  background: #f8faff;
  font-size: 0.6875rem;
  line-height: 1.5;
  color: #64748b;

  b { color: #4338ca; }
`;

/** 그 점에 있는 사업부들. ⚠️ 이 화면이 답하는 물음이 이것이라 이름 바로 뒤다. */
const Who = styled.em`
  font-style: normal;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #4338ca;
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
/*
  고리 다섯. ⚠️⚠️ **자리 수를 재서 정한 값이다.** 「감지」에 아무도 안 본 50개가
  몰리므로 그 고리를 넓게 잡고, 「보류」는 적으니 얇게 뒀다(2026-08-26 요청).

      도입 8 · 시험 5 · 관찰 0 · 감지 50 · 보류 0  ← 자료의 실제 분포
      이 비율로 재면 다섯 고리가 각각 필요한 만큼 담긴다.
*/
const RINGS = [0.28, 0.44, 0.58, 0.90, 1].map((r) => r * R_MAX);
const BLIP_R = 11;
/*
  고리 안쪽 여백. ⚠️ 고리가 넷에서 다섯으로 늘면서 가운데가 얇아졌다 — 예전
  여백(점 반지름+3=14px)을 그대로 두면 「관찰」이 11px 밖에 안 남아 점이 고리선을
  넘는다. 6px 로 줄이면 가장 얇은 「보류」도 16px 이 남는다(재서 확인).
*/
const RING_PAD = 6;
// 가장 바깥 고리. ⚠️ 번호를 박지 않는다 — 고리가 늘면 그때마다 어긋난다.
const R_OUT = RINGS[RINGS.length - 1];
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

/** ISO 시각에서 `YYYY-MM-DD` 만. 없으면 빈 문자열. */
const ymd = (v) => (v ? String(v).slice(0, 10) : '');
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

/*
  이름표를 켜 뒀는지 **기억한다.** ⚠️ 한 번 켜고 다른 화면 갔다 오면 다시 꺼져
  있으면, 매번 찾아 누르느니 안 쓰게 된다. 브라우저별ㆍ사람별 취향이라 서버에
  둘 것은 아니다.

  ⚠️ 시크릿 창ㆍ저장 막아 둔 브라우저에서는 읽기ㆍ쓰기 자체가 튄다. 실패하면
     조용히 기본값(꺼짐)으로 간다 — 이 하나 때문에 레이더가 안 뜨면 안 된다.
*/
const LABEL_KEY = 'dtIntel.radarLabels';
const MOVE_KEY = 'dtIntel.radarMoves';

const readPref = (key, fallback) => {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
};

const writePref = (key, on) => {
  try { window.localStorage.setItem(key, on ? '1' : '0'); } catch { /* 못 써도 그만 */ }
};

// ⚠️ 서버가 물리는 범위(7~1095일) 안에서 고른다. 사람이 실제로 쓰는 눈금만 둔다.
const DAY_CHOICES = [30, 90, 180, 365, 730];

const RadarChart = ({ rows, categories, onSelect, onSectorClick, activeSector,
                     movedWindowDays = 90, onMovedWindowChange,
                     movedOnly = false, onMovedOnlyChange }) => {
  // 범례에 「◆ 기본 설정과 다르게 봄」을 띄울지. ⚠️ 기본 설정 기준으로 볼 때 이 줄을 띄우면
  //    있지도 않은 표시를 설명하는 꼴이 된다.
  const divisionLens = rows.some((t) => t.division);
  // 이 기간 안에 옮겨온 것이 몇 개인가. ⚠️ 요약 막대가 말해 주던 수를 여기서 잇는다.
  const movedCount = rows.filter((t) => t.movedFrom).length;
  const [hot, setHot] = useState(null);
  const [labels, setLabels] = useState(() => readPref(LABEL_KEY, false));
  /*
    시간에 따른 변화(단계 이동)를 그릴지.

    ⚠️ **기본은 꺼짐이다**(2026-08-25 요청). 레이더를 여는 대부분의 까닭은 「지금
       어디까지 왔나」이고, 화살표와 테는 그 위에 덧그리는 것이다 — 늘 켜 두면
       처음 여는 사람에게는 그림이 어지럽기만 하다. 볼 사람이 켜서 본다.

    ⚠️⚠️ 화살표ㆍ테ㆍ옆 목록의 「관찰→」ㆍ범례ㆍ기간 고르개가 **한 스위치로 같이**
       움직인다. 하나라도 남으면 「테는 있는데 화살표가 없는 줄」이 생기고, 그러면
       둘 다 못 믿게 된다 — 그 셋이 같은 값을 보게 맞춰 둔 이유가 그것이다.
  */
  const [movesOn, setMoves] = useState(() => readPref(MOVE_KEY, false));
  /*
    ⚠️ 스위치가 켜진 채로 사업부를 풀 수 있다(기억해 두는 값이라 다음에 열 때도).
       **그리는 쪽에서 한 번 더 막는다** — 단추만 막으면 그 틈으로 거짓말하는
       화살표가 되살아난다.
  */
  const moves = movesOn && divisionLens;
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

  /*
    ⚠️⚠️ **점 하나는 「역량 × 단계 × 거기 있는 사업부들」이다.** 예전에는 기본 설정
       고리에 주점을 하나 놓고 갈리는 사업부만 위성으로 찍었는데, 아무도 안 적은
       역량 48개가 전부 「감지」 고리에 뭉쳐 그림이 안 읽혔다(2026-08-26 신고).

       이제 **기본 설정 점은 아예 안 그린다.** 점은 사업부가 적은 자리에만 서고,
       **같은 단계에 있는 사업부는 한 점으로 뭉친다** — 그래서 사업부 수만큼
       쪼개져 63개가 504개가 되는 일도 없다. 지금 자료로 85점 → 23점이다.

    ⚠️ 아무도 안 적은 역량은 **셈만 하고 안 그린다.** 그 수를 화면에 적어야
       「비었다」가 아니라 「아직 안 적었다」로 읽힌다.
  */
  const { blips, quietCaps, quietTools } = useMemo(() => {
    const cells = new Map();
    let qc = 0;
    let qt = 0;
    const put = (si, ri, tech, divisions) => {
      if (ri === undefined || ri < 0) return;
      const key = `${si}|${ri}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push({ tech, si, ri, divisions,
                            key: `${tech.uuid}|${ri}` });
    };

    rows.forEach((t) => {
      const si = Math.max(0, sectors.indexOf(t.category || UNCATEGORIZED));
      /*
        사업부 눈일 때는 서버가 이미 그 사업부 값으로 풀어 보낸다 — 점 하나면
        된다. ⚠️ 적었는지는 `hasDivisionRow` 로 **서버에 묻는다.** 화면이
        `isDivisionOverride` 나 `divisionTools` 로 짐작하면 「단계만 적고 도구는
        안 적은 줄」에서 조용히 어긋난다.
      */
      if (divisionLens) {
        if (!t.hasDivisionRow) { qc += 1; return; }
        put(si, stageIndex[t.stage], t, [t.division]);
        return;
      }

      const marks = t.divisionMarks || [];
      if (!marks.length) {
        if (t.kind === 'capability') qc += 1; else qt += 1;
        return;
      }
      // 같은 단계에 있는 사업부는 **뭉친다** — 그게 이 그림의 뜻이다.
      const g = new Map();
      marks.forEach((m) => {
        const ri = stageIndex[m.stage];
        if (ri === undefined) return;
        if (!g.has(ri)) g.set(ri, []);
        g.get(ri).push(m.division);
      });
      g.forEach((divisions, ri) => put(si, ri, t, divisions));
    });

    const out = [];
    cells.forEach((items, key) => {
      const [si, ri] = key.split('|').map(Number);
      const a0 = si * span - Math.PI / 2 + PAD_A;
      const a1 = (si + 1) * span - Math.PI / 2 - PAD_A;
      const rIn = Math.max((ri === 0 ? 0 : RINGS[ri - 1]) + RING_PAD, BLIP_R + 4);
      const rOut = Math.max(RINGS[ri] - RING_PAD, rIn + 1);
      out.push(...layout(items, { a0, a1, rIn, rOut }));
    });

    out.sort((p, q) => (p.ri - q.ri) || p.tech.name.localeCompare(q.tech.name));
    out.forEach((b, i) => { b.no = i + 1; });
    return { blips: out, quietCaps: qc, quietTools: qt };
  }, [rows, sectors, stageIndex, span, PAD_A, divisionLens]);


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

  const toggleLabels = () => setLabels((v) => { writePref(LABEL_KEY, !v); return !v; });
  const toggleMoves = () => setMoves((v) => {
    writePref(MOVE_KEY, !v);
    /*
      ⚠️⚠️ **끄면 거르기도 함께 푼다.** 안 풀면 「움직인 것만」이 걸린 채로 그 단추가
         사라져, 레이더에 일부만 뜨는데 **왜 그런지 화면 어디에도 안 보인다.**
    */
    if (v && movedOnly && onMovedOnlyChange) onMovedOnlyChange(false);
    return !v;
  });

  const reset = () => setView({ k: 1, x: 0, y: 0 });
  const zoomed = view.k > 1.001;

  return (
    <Wrap>
      <Frame $dragging={dragging}>
        <Tools>
          <ToolBtn onClick={() => zoomAt(1.35)} disabled={view.k >= ZOOM_MAX}
                   title="확대 (휠을 올려도 됩니다)"><Plus size={15} /></ToolBtn>
          <ToolBtn onClick={() => zoomAt(1 / 1.35)} disabled={view.k <= ZOOM_MIN}
                   title="축소"><Minus size={15} /></ToolBtn>
          <ToolBtn onClick={reset} disabled={!zoomed && !view.x && !view.y}
                   title="처음 크기로"><Maximize2 size={14} /></ToolBtn>
          {/*
            ⚠️⚠️ **사업부를 골라야 켤 수 있다.** 점 하나에 사업부가 여럿 뭉쳐 있어,
               「이 점이 어디서 왔나」에 답이 하나가 아니다 — DA 는 그대로인데 MX 만
               옮겨 왔을 수 있다. 사업부를 고르면 점 하나에 사업부도 하나라 그때는
               맞다. **거짓말하는 화살표는 없느니만 못하다.**
          */}
          <ToolBtn $on={moves} onClick={toggleMoves} disabled={!divisionLens}
                   title={!divisionLens
                     ? '사업부를 고르면 볼 수 있습니다 — 점이 사업부 자리라, 기본 설정의 이동은 그릴 자리가 없습니다'
                     : (moves
                       ? `시간에 따른 변화 끄기 (최근 ${movedWindowDays}일 이동)`
                       : '최근 얼마 안에 단계가 옮겨온 자리를 화살표로 그립니다')}>
            <History size={14} />
          </ToolBtn>
          {/*
            ⚠️ **켰을 때만 보인다.** 꺼 놓고 기간만 고르게 두면 골라도 아무 일이
               안 일어나고, 그러면 고장으로 읽힌다.
            ⚠️ 고르면 **서버에 다시 묻는다** — 무엇이 움직였는지는 서버가 센다.
               화면이 따로 재면 화살표ㆍ테ㆍ범례가 서로 다른 기간을 말하게 된다.
          */}
          {/*
            ⚠️ 거르기를 **시간 단추 밑에** 둔다. 위쪽 요약 막대에 따로 있으면 시간에
               관한 것이 두 군데로 갈리고, 어느 쪽이 무엇을 하는지 흐려진다.
          */}
          {moves && onMovedOnlyChange && (
            <ToolBtn $on={movedOnly} onClick={() => onMovedOnlyChange(!movedOnly)}
                     title={movedOnly
                       ? '전부 다시 보기'
                       : `옮겨온 것만 남깁니다 (${movedCount}개)`}>
              <Filter size={13} />
            </ToolBtn>
          )}
          {moves && onMovedWindowChange && (
            <DaySel value={movedWindowDays}
                    title="최근 며칠 안의 이동을 볼지"
                    onChange={(e) => onMovedWindowChange(Number(e.target.value))}>
              {DAY_CHOICES.map((d) => (
                <option key={d} value={d}>{d >= 365 ? `${d / 365}년` : `${d}일`}</option>
              ))}
            </DaySel>
          )}
          <ToolBtn $on={labels} onClick={toggleLabels}
                   title={labels
                     ? '이름표 끄기'
                     : '점 옆에 이름을 붙입니다 (몰린 자리는 확대해서 보세요)'}>
            <Tag size={14} />
          </ToolBtn>
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
            {/*
              ⚠️ **바깥부터 그린다** — 안쪽 고리가 나중에 그려져 위에 얹혀야 한다.
              ⚠️⚠️ 개수를 손으로 적지 않는다. 한때 `[3,2,1,0]` 이라 박혀 있었는데,
                 단계가 다섯이 되자 **바깥 고리가 말없이 안 그려졌다**(2026-08-26).
            */}
            {STAGES.map((_, i) => STAGES.length - 1 - i).map((i) => (
              <circle key={STAGES[i].key} cx={CX} cy={CY} r={RINGS[i]}
                      fill={STAGES[i].bg} stroke={STAGES[i].border}
                      strokeWidth={1 / view.k} />
            ))}

            {activeSector && sectors.includes(activeSector) && (
              <path d={wedgePath(sectors.indexOf(activeSector) * span - Math.PI / 2,
                                 (sectors.indexOf(activeSector) + 1) * span - Math.PI / 2,
                                 R_OUT)}
                    fill="#4f46e5" opacity="0.06" />
            )}

            {sectors.map((c, i) => {
              const [x, y] = polar(i * span - Math.PI / 2, R_OUT);
              return <line key={c} x1={CX} y1={CY} x2={x} y2={y}
                           stroke="#e2e8f0" strokeWidth={1 / view.k} />;
            })}

            {sectors.map((c, i) => {
              const a = (i + 0.5) * span - Math.PI / 2;
              const [x, y] = polar(a, R_OUT + 14);
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
            {moves && blips.map((b) => {
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
              const moved = moves && Boolean(b.tech.movedFrom);
              const k = view.k;
              /* ⚠️ 뭉친 사업부가 많을수록 점이 커진다 — 「여기 셋이 있다」가
                 이름을 안 읽어도 보여야 한다. 무한정 키우지는 않는다. */
              const rr = (BLIP_R + Math.min(4, (b.divisions.length - 1) * 2)) / k;
              return (
                <g key={b.key} style={{ cursor: 'pointer' }}
                   onClick={clickIfNotDragged(() => onSelect(b.tech))}
                   onMouseEnter={() => setHot(b.tech.uuid)}
                   onMouseLeave={() => setHot(null)}>
                  <title>
                    {`${b.tech.name} · ${STAGES[b.ri].key} — ${b.divisions.join(' · ')}`
                     + `${b.tech.isStale ? ' · 근거 낡음' : ''}`
                     + `${(b.tech.divisionTools || []).length
                          ? ` · ${b.tech.division}: ${b.tech.divisionTools.join(' · ')}`
                          : ''}`
                     + `${(b.tech.divisionMarks || []).length
                          ? ` · ${b.tech.divisionMarks.map((m) => `${m.division} ${m.stage}`).join(' · ')}`
                          : ''}`
                     + `${(b.tech.children || []).length
                          ? ` · 도구 ${b.tech.children.length}개`
                          : ''}`
                     /*
                       ⚠️ 풍선말은 **스위치를 꺼도 말해 준다.** 끄는 것은 「그림을
                          어지럽히지 말라」는 뜻이지 「그 사실을 감추라」는 뜻이
                          아니다 — 한 점을 짚어 물었을 때는 알려 주는 게 맞다.
                     */
                     + `${b.tech.movedFrom
                          ? ` · ${b.tech.movedFrom}에서 옮겨옴 (${ymd(b.tech.movedAt)})`
                          : ''}`}
                  </title>
                  {on && <circle cx={b.x} cy={b.y} r={rr + 7 / k}
                                 fill={st.color} opacity="0.16" />}
                  {/*
                    ⚠️ **모양은 전부 원으로 통일한다.** 예전엔 최근 이동을 삼각형으로
                       갈랐는데 촌스럽고, 모양이 섞이면 밀집 구간에서 더 어지럽다.
                       옮겨온 것은 **바깥에 얇은 테**를 두른다 — 화살표는 「어디서」를
                       말하고 테는 **멀리서도 찾게** 해 준다. 둘은 같은 값을 본다.
                  */}
                  {moved && (
                    <circle cx={b.x} cy={b.y} r={rr + 3.5 / k} fill="none"
                            stroke={st.color} strokeWidth={1.5 / k} opacity="0.5" />
                  )}
                  <circle cx={b.x} cy={b.y} r={rr}
                          fill={st.color}
                          stroke={b.tech.isStale ? '#b45309' : '#fff'}
                          strokeWidth={(b.tech.isStale ? 2.5 : 1.5) / k} />
                  <text x={b.x} y={b.y} fontSize={10 / k}
                        fill="#fff" fontWeight="700"
                        textAnchor="middle" dominantBaseline="central"
                        style={{ pointerEvents: 'none' }}>
                    {b.no}
                  </text>
                  {/*
                    ⚠️⚠️ **사업부 이름은 이름표 스위치와 상관없이 늘 보인다.** 이
                       그림이 답하는 물음이 「누가 어디에 있나」라서, 사업부가 안
                       보이면 점이 아무 말도 안 한다. 역량 이름 쪽이 스위치다.
                  */}
                  <text x={b.x} y={b.y + rr + 8 / k} fontSize={8.5 / k}
                        fill={st.color} fontWeight="700" textAnchor="middle"
                        stroke="#fff" strokeWidth={2.5 / k} paintOrder="stroke"
                        style={{ pointerEvents: 'none' }}>
                    {b.divisions.join('·')}
                  </text>
                </g>
              );
            })}

            {/*
              이름표. ⚠️⚠️ **점을 다 그린 뒤 따로 한 번 더 돈다.** 점마다 같은
                 묶음(<g>) 안에서 그리면 **나중에 그려진 점이 앞 점의 이름표를
                 덮는다** — 몰린 자리일수록 심해지는데, 이름표가 필요한 곳이
                 바로 그 자리다.

              ⚠️ 글자 크기도 `/ k` 로 고정한다. 점과 같은 규칙이라야 확대했을 때
                 이름표만 같이 커져서 도로 겹치는 일이 없다.

              ⚠️ `pointerEvents: none` — 이름표가 클릭을 가로채면 점을 눌러도
                 창이 안 열린다. 예전에 setPointerCapture 로 같은 일을 겪었다.

              ⚠️⚠️ **자르지 않는다.** 한때 10자에서 잘랐는데, 「반도체ㆍ전자 패키징
                 해석」과 「반도체ㆍ전자 패키징 검사」가 화면에서 **똑같은 글자**가
                 되어 버렸다 — 이름표를 켜는 이유가 「어느 점이 무엇인지」인데 자르면
                 그 답이 안 나온다(2026-08-25 신고: 「…으로 생략 안 되게」).
                 길어서 겹치는 것은 **확대해서 푼다** — 글자 크기가 `/ k` 로 고정돼
                 있어 확대하면 이름표끼리 벌어진다.
            */}
            {labels && blips.map((b) => {
              const k = view.k;
              const right = b.x >= CX;      // 바깥쪽으로 눕혀야 테두리를 안 넘는다
              const on = hot === b.tech.uuid;
              return (
                <text key={`lb-${b.key}`}
                      x={b.x + (right ? 1 : -1) * (BLIP_R + 3.5) / k}
                      y={b.y}
                      fontSize={10.5 / k}
                      textAnchor={right ? 'start' : 'end'}
                      dominantBaseline="central"
                      fill={on ? '#0f172a' : '#334155'}
                      fontWeight={on ? 700 : 500}
                      opacity={on ? 1 : 0.88}
                      /* ⚠️ 흰 테를 글자 **뒤로** 깔아야 고리ㆍ부채꼴 위에서 읽힌다.
                         paintOrder 없이 stroke 만 주면 글자가 뭉개진다. */
                      stroke="#fff"
                      strokeWidth={3 / k}
                      paintOrder="stroke"
                      style={{ pointerEvents: 'none' }}>
                  {b.tech.name}
                </text>
              );
            })}
          </g>
        </svg>
      </Frame>

      <Side>
        <Legend>
          <span><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#64748b" /></svg> 여기라고 적은 사업부</span>
          {/* ⚠️ 꺼 놓고 범례만 남기면 **있지도 않은 표시를 설명하는 꼴**이 된다. */}
          {moves && (
            <span>
              <svg width="22" height="12">
                <line x1="1" y1="6" x2="14" y2="6" stroke="#64748b" strokeWidth="1.4"
                      strokeDasharray="3 2" opacity="0.6" />
                <path d="M14 3 L20 6 L14 9 z" fill="#64748b" opacity="0.6" />
              </svg>
              최근 {movedWindowDays}일 내 옮겨온 자리 ({movedCount})
            </span>
          )}
          <span><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="#64748b" stroke="#b45309" strokeWidth="2" /></svg> 근거 낡음</span>
          {/* 같은 단계의 사업부는 한 점으로 뭉치고, 점은 그만큼 커진다. */}
          {blips.some((b) => b.divisions.length > 1) && (
            <span>
              <svg width="14" height="12"><circle cx="7" cy="6" r="6" fill="#64748b" /></svg>
              큰 점 = 그 자리에 여럿
            </span>
          )}
          <span>안쪽일수록 이미 쓰는 것</span>
        </Legend>

        {/*
          ⚠️⚠️ **안 그린 것의 수를 말해 준다.** 점은 사업부가 적은 자리에만 서므로,
             안 적힌 역량은 화면에서 사라진다. 그 수를 안 적으면 「자료가 없는
             시스템」으로 읽히지 「아직 안 적었다」로는 안 읽힌다 — 그리고 그게
             지금 이 화면에서 사람이 해야 할 단 하나의 일이다.
        */}
        {(quietCaps > 0 || quietTools > 0) && (
          <Quiet>
            {quietCaps > 0 && (
              <>
                아직 아무 사업부도 안 적은 역량 <b>{quietCaps}</b>개는 점이
                없습니다 — 위 <b>「사업부 적기」</b>에서 적으면 나타납니다.
              </>
            )}
            {quietTools > 0 && (
              <> 어느 역량에도 안 매단 도구 <b>{quietTools}</b>개도 점이 없습니다.</>
            )}
          </Quiet>
        )}

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
                  <li key={b.key}>
                    <Entry $hot={hot === b.tech.uuid}
                           onMouseEnter={() => setHot(b.tech.uuid)}
                           onMouseLeave={() => setHot(null)}>
                      <MainBtn type="button" $color={st.color}
                               onClick={() => onSelect(b.tech)}>
                        <b>{b.no}</b>
                        <span>
                          {b.tech.name}
                          {/* ⚠️ **누가 여기 있나**가 이 줄의 알맹이다 — 이름
                              바로 뒤에 붙인다. */}
                          <> <Who>{b.divisions.join(' · ')}</Who></>
                          {/* ⚠️ **언제** 옮겼는지가 없으면 화살표를 못 믿는다. */}
                          {moves && b.tech.movedFrom && (
                            <> <Moved title={`${ymd(b.tech.movedAt)} 에 ${b.tech.movedFrom} 에서 옮겨왔습니다`}>
                              {b.tech.movedFrom}→ {ymd(b.tech.movedAt)}
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
                        {/*
                          ⚠️ **역량에 몇 개가 접혀 있는지를 보여준다.** 안 보이면
                             레이더가 갑자기 짧아진 것으로만 읽히고, 접힌 도구들이
                             어디 갔는지 알 수 없다.
                        */}
                        {(b.tech.divisionTools || []).length > 0 && (
                          <em title={`${b.tech.division} 가 이 역량을 하는 도구`}>
                            · {b.tech.divisionTools.join(' · ')}
                          </em>
                        )}
                        {(b.tech.children || []).length > 0 && (
                          <em title={b.tech.children.map((c) => c.name).join(' · ')}>
                            · 도구 {b.tech.children.length}
                          </em>
                        )}
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
