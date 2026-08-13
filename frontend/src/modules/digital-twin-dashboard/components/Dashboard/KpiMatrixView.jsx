/**
 * KPI × 사업부 매트릭스
 *
 * 답하려는 질문 (2026-08-01 챔피언 지시)
 *     "각 KPI 향상에 어떤 과제가 기여하고 있는가" 를 한 장으로.
 *
 * 이 화면의 진짜 값어치는 **빈칸**이다
 *     채워진 칸은 "하고 있다" 는 확인이고, 빈칸은 **다음 분기 안건**이다.
 *       · 기여 과제가 0건인 KPI  → 목표만 있고 실행이 없다
 *       · 어느 KPI 에도 안 걸린 과제 → 왜 하는지 설명되지 않는다
 *     그래서 아래 두 요약 줄이 표만큼 중요하다.
 *
 * ⚠️ '해당 없음' 과 '빈칸' 은 다르다
 *     사업부 전용 지표(예: 디지털 인체 팬텀 개발률 = medical)는 다른 사업부 열에서
 *     **구조적으로** 비어 있다. 이걸 구멍으로 세면 120칸 중 25칸이 가짜 경고가 된다.
 *     KPI 정의의 `divisions` 로 판별해 빗금 처리한다.
 *
 * 셀 색 = **달성 상태** (2026-08-01 두 번째 결정)
 *     처음엔 연결된 과제 수 밀도로 칠했다. 그런데 밀도는 이미 칸 안에 숫자로 적혀
 *     있어서, 색이라는 가장 눈에 띄는 채널을 같은 말에 두 번 쓰는 셈이었다.
 *     실적·목표를 얹으면서 색을 달성 상태로 옮겼다. 숫자(과제 수)와 색(달성 상태)이
 *     서로 다른 것을 말하므로 **한 칸이 두 가지를 동시에 전달한다.**
 *
 *     그래서 이 표가 찾는 칸이 눈에 띈다 —
 *       🟥 미달인데 기여 과제 0건  → 방치. 다음 분기 안건
 *       🟩 달성인데 과제 0건       → 자연 달성. 자원 재배치 후보
 *     아래 4분면 요약이 그 넷을 세어 준다.
 *
 * 달성률을 화면이 계산하지 않는다
 *     망대/망소·분수 목표·0 나눗셈 규칙이 화면마다 따로 있어 실제로 갈렸었다
 *     (종합표는 망소를 뒤집어 보여주고 있었다). 서버 `dx_kpi_management/achievement.py`
 *     가 단일 출처이고, 여기는 `metrics` 를 **그대로 그리기만** 한다.
 *     '해당 없음' 판정도 서버가 준다 — 사업부 코드 표를 화면이 들면 실적이 엉뚱한
 *     열에 붙는다.
 */
import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { AlertCircle, Loader2, RefreshCw, X, Grid, ChevronRight, ChevronDown, MessageSquare, Settings, Layers } from 'lucide-react';

import { fetchKpiMatrixV2, fetchSystemSettings, saveSystemSettings } from '../../services/settingsApi';
import { useAuth } from '../../../../contexts/AuthContext';
import KpiContributionFlow from './KpiContributionFlow';
import BulkKpiLinkModal from './BulkKpiLinkModal';

/**
 * 셀 상태별 색. 서버 `achievement.status()` 가 주는 값과 **키가 1:1** 이다.
 *
 * `no_target`(목표 미설정)과 `no_data`(목표는 있는데 실적 없음)를 나눈 이유 —
 * 둘은 다른 안건이다. 전자는 "아직 관리를 시작 안 했다", 후자는 "관리한다면서
 * 측정을 안 한다". 뭉개면 화면이 **어디부터 채워야 하는지** 말해주지 못한다.
 * (실측 2026-08-01: 75칸 중 no_target 46 · n_a 23 — 지금은 이게 가장 흔한 상태다)
 */
const STATUS_STYLE = {
  ok:        { bg: '#dcfce7', fg: '#14532d', label: '달성 (100% 이상)' },
  near:      { bg: '#fef9c3', fg: '#713f12', label: '근접 (80~100%)' },
  miss:      { bg: '#fee2e2', fg: '#7f1d1d', label: '미달 (80% 미만)' },
  no_data:   { bg: '#f1f5f9', fg: '#475569', label: '실적 없음 (목표만 있음)' },
  no_target: { bg: '#fff',    fg: '#6b7280', label: '목표 미설정' },
  n_a:       { bg: undefined, fg: 'transparent', label: '해당 없음' },
  // 플랫폼 구축 — 측정하지 않는다. '목표 미설정'(흰색)과 색을 달리해야
  // "아직 목표를 안 세운 칸" 으로 오해받지 않는다.
  platform:  { bg: '#faf5ff', fg: '#5b21b6', label: '측정 대상 아님 (플랫폼 구축)' },
};
const statusStyle = (s) => STATUS_STYLE[s] || STATUS_STYLE.no_target;

/** 'better'|'worse'|'same' → 화살표와 색. 판정은 서버가 한다(망대/망소 반영). */
const CHANGE_MARK = {
  better: { arrow: '▲', color: '#059669', word: '개선' },
  worse:  { arrow: '▼', color: '#dc2626', word: '악화' },
  same:   { arrow: '=', color: '#9ca3af', word: '변화 없음' },
};

/**
 * 월별 실적 스파크라인.
 *
 * ⚠️ **표의 칸에서는 쓰지 않는다** (2026-08-01 결정)
 *     칸마다 넣어 봤더니 폭을 180px 나 먹으면서 정작 눈에 들어오지 않았다 —
 *     실적·목표·달성률·화살표가 이미 있는 자리에 선까지 겹치니 복잡하기만 했다.
 *     방향은 화살표(▲▼)가 이미 말하고, 그건 한 글자다.
 *     추이는 **칸을 눌러 상세에서** 본다. 거기선 넓게 그릴 수 있고, 추이를
 *     보려고 연 화면이라 시선이 그쪽에 있다.
 *
 * 기록이 없는 달은 **선을 잇지 않는다.** 0 으로 떨어뜨리면 측정을 안 한 달이
 * 실적 급락처럼 보인다 — 실제 데이터가 띄엄띄엄해서(2·4·6월만 있는 지표가 있다)
 * 그 오해가 바로 난다.
 */
const Sparkline = ({ points, width = 132, height = 34, color = '#2563eb' }) => {
  const vals = (points || []).map((v) => (typeof v === 'number' ? v : null));
  const known = vals.filter((v) => v !== null);
  if (known.length === 0) return null;

  const min = Math.min(...known);
  const max = Math.max(...known);
  const span = max - min || 1;
  const pad = 4;
  const x = (i) => pad + (i * (width - pad * 2)) / Math.max(vals.length - 1, 1);
  const y = (v) => height - pad - ((v - min) / span) * (height - pad * 2);

  // 값이 있는 구간만 이어 그린다 (빈 달에서 끊는다)
  const segments = [];
  let cur = [];
  vals.forEach((v, i) => {
    if (v === null) { if (cur.length > 1) segments.push(cur); cur = []; return; }
    cur.push(`${x(i)},${y(v)}`);
  });
  if (cur.length > 1) segments.push(cur);

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {segments.map((s, i) => (
        <polyline key={i} points={s.join(' ')} fill="none"
                  stroke={color} strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {vals.map((v, i) => (v === null ? null : (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === vals.length - 1 ? 2.6 : 1.8}
                fill={color} opacity={i === vals.length - 1 ? 1 : 0.55} />
      )))}
    </svg>
  );
};

/*
  rowLabel 은 걷어냈다 (2026-08-06).

  분류를 이름에서 덜어내던 손질이었다 — 항목이 '개발 플랫폼 구축' 이고 분류가
  '개발' 이던 시절, 표에서 같은 말이 두 번 나와서 앞부분을 잘라 냈다.

  플랫폼을 하나로 합치면서(b83c0e5a4f12) 분류는 '플랫폼', 이름은 '플랫폼 구축'
  이 됐다. 그러자 이 손질이 **정확히 반대로** 작동한다 — '플랫폼 구축' 이
  '플랫폼 ' 으로 시작하니 '구축' 만 남는다. 겹침은 분류를 분류답게 지어서 푸는
  것이지, 화면에서 글자를 깎아 푸는 게 아니었다. 이제 kpi.label 을 그대로 쓴다.
*/

/**
 * 구분 열의 바탕색 — 구획을 색으로도 가른다(스크롤 중 위치 감각).
 *
 * 왼쪽 색 띠 대신 **칸 전체를 옅게** 칠한다. 띠는 3px 라 옆의 지표명 칸에 있는
 * 띠와 헷갈렸고, 여러 행을 덮는 칸에서는 어디까지가 한 구획인지도 덜 보였다.
 * 면으로 칠하면 병합 범위가 그대로 드러난다. 글씨가 묻히지 않게 아주 옅게.
 */
const SECTION_STYLE = {
  common:   { bg: '#eff6ff', fg: '#1e40af' },   // 파랑
  division: { bg: '#fffbeb', fg: '#92400e' },   // 주황
  platform: { bg: '#f5f3ff', fg: '#5b21b6' },   // 보라
};

/** 기간 선택지. 값이 없으면(=null) 연 목표 대비 최신 실적. */
const PERIODS = [
  { value: '', label: '연간' },
  { value: 'Q1', label: 'Q1' }, { value: 'Q2', label: 'Q2' },
  { value: 'Q3', label: 'Q3' }, { value: 'Q4', label: 'Q4' },
];

/* 분류 정렬. '플랫폼' 은 지표가 아니라 만드는 것이라 늘 맨 뒤. */
const CATEGORY_ORDER = ['개발', '제조', '품질', '플랫폼'];
const DELAYED = new Set(['지연', '위험']);

/*
  열 폭 — **고정 열은 px 로 못박고, 남는 폭은 사업부 열이 똑같이 나눠 갖는다.**

  세 번 만에 여기 왔다 (2026-08-01):
    ① 지표명 고정 + 사업부 열이 나머지 등분  → 화면이 넓으면 사업부 칸이 텅 빔
    ② 사업부 고정 + 지표명이 나머지 전부      → 지표명 열만 터무니없이 길어짐
    ③ 전부 고정, 표는 fit-content            → 창을 키워도 표는 그대로, 오른쪽이 놀음

  ①이 실패한 건 등분 자체가 아니라 **칸 내용이 적었기** 때문이다(그때는 숫자 하나뿐).
  지금은 칸에 실적·목표·달성률·화살표·과제 수가 들어가므로 넓어져도 헐겁지 않다.
  그래서 다시 등분으로 돌아오되, 아래 px 값을 **최소 폭**으로 깔아 둔다 —
  창이 좁아지면 그 폭에서 멈추고 가로 스크롤로 넘어간다.

  DIV_COL_W 는 그 최소 폭(칸 내용의 실측 폭)이고,
  KPI_COL_W 는 가장 긴 지표명('ASR (Annual Service Ratio)')이 들어가는 폭이다.

  ⚠️ KPI_COL_W 는 사업부 열과 달리 **실제 폭**이다(colgroup 이 px 로 잡고
     table-layout:fixed 라 내용이 못 밀어낸다). 그래서 RowHead 글자 크기를
     바꾸면 **이 값도 같이 봐야 한다** — 안 그러면 글자만 커지고 이름이 더 잘린다.
*/
/* 맨 왼쪽 '구분' 열 — 전사 공통 / 사업부 전용 / 플랫폼 구축.
   여러 행에 걸치므로 rowSpan 으로 한 칸으로 합친다. */
const SECT_COL_W = 96;
/* 260 → 300 (2026-08-06). 지표명을 0.78 → 0.92rem 로 키운 만큼 넓힌다
   (260 × 0.92/0.78 ≈ 307). 안 넓히면 긴 이름이 더 잘려 키운 뜻이 없어진다.
   되돌리려면 이 값과 RowHead 의 font-size 를 **같이** 되돌릴 것. */
const KPI_COL_W = 300;
/*
  사업부 열의 **최소** 폭. 실제 폭이 아니다 — 표는 width:100% 라 남는 폭을 열들이
  똑같이 나눠 갖고, 이 값은 "여기서 멈추고 가로 스크롤로 넘어가는" 바닥선이다.

  220 → 160 (2026-08-06)
      220 은 **5개 사업부가 1920 화면에 딱 들어가는 값**이었다.
          1870 - 320(요약 패널) - 16 - 96(구분) - 260(지표명) - 74(계) = 1104 ÷ 5 ≈ 220
      딱 맞다는 건 조금만 좁아져도(1600 창, 패널 펼침, 사업부 추가) 바로
      가로 스크롤이 났다는 뜻이다. 비교하려고 만든 표인데 나눠 보게 된다.

      칸에서 지표·달성을 걷어내(CELL_COLS 머리말) 접힌 칸은 이제
      `3+1  💬2` 뿐이라 100px 남짓이면 된다. 바닥선을 낮춰도 접힌 칸은 멀쩡하다.

      ⚠️ 실제로 이 폭까지 좁아지는 건 **창이 좁을 때뿐**이다. 넓은 화면에서는
         여전히 등분이라 220 안팎을 유지하고, 행을 펼쳤을 때의 과제명도 그대로다.
         즉 이 변경은 넓은 화면에서 아무것도 바꾸지 않고, 좁은 화면에서만 스크롤을
         없앤다. 되돌리려면 이 숫자만 220 으로 되돌리면 된다.

      160 → 190 (2026-08-06). 접힌 칸의 숫자 덩어리를 3.1/3.1/2.8rem 로 넓히면서
      필요한 폭이 늘었다. 실측 —
          고정 세 칸 3.1+3.1+2.8 = 9.0rem = 144px
          트랙 사이 여백 0.35rem × 4 =  22px   (5트랙이라 사이가 넷이다)
          칸 좌우 안여백 0.5rem × 2  =  16px
          합계                        182px
      바닥선이 이보다 좁으면 창을 줄였을 때 숫자가 칸을 넘는다. 190 은 여기에
      8px 여유를 둔 값이다. ⚠️ CELL_COLS 를 넓히면 이 계산을 다시 할 것.

      바닥선 합계: 96 + 300 + 5×190 + 74 = 1420 (+패널 336 = 1756)
*/
const DIV_COL_W = 190;
/* '계(과제)' 가 들어가는 폭. 머리글을 0.95rem 로 키우면서 74 → 86.
   nowrap 이라 좁으면 글자가 옆 칸으로 삐져나간다(잘리지 않아 더 헷갈린다). */
const TOTAL_COL_W = 86;

/*
  과제 수를 찍는 글자 크기. **본문 칸과 바닥 요약이 같이 쓴다** (2026-08-06).

  셋 다 같은 것을 센다 — 그 사업부에 붙은 과제. 본문에서만 크고 요약에서 작으면
  같은 값인데 다른 무게로 읽힌다. 숫자를 각자 적어 두면 한쪽만 고쳐져 어긋나므로
  여기 한 곳에서 정한다.
      CellProj(자체) · UnlinkedCell(과제-KPI 연결 현황) · SupportCell(기능조직 지원)
  '지원' 칸만 한 단계 작다(CellSupport) — 남이 보태 준 몫이라 위계를 둔다.
*/
const NUM_FONT = '1.45rem';

/**
 * 카테고리 색조 — 스크롤로 구분 행이 화면 밖으로 나가도 **어느 분류를 보고 있는지** 잃지 않게.
 *
 * `rgb` 는 행 전체에 얹는 옅은 색조용(inset box-shadow 로 쓴다),
 * `accent` 는 지표명 왼쪽에 세우는 색 띠, 나머지는 구분 행 자체의 색이다.
 * 지표가 늘어 새 카테고리가 생기면 여기에 없어도 중립 회색으로 떨어진다 — 깨지지 않는다.
 */
const CATEGORY_STYLE = {
  '개발': { rgb: '37, 99, 235', accent: '#3b82f6', chip: '#eff6ff', text: '#1d4ed8' },
  '제조': { rgb: '5, 150, 105', accent: '#10b981', chip: '#ecfdf5', text: '#047857' },
  '품질': { rgb: '124, 58, 237', accent: '#8b5cf6', chip: '#f5f3ff', text: '#6d28d9' },
};
const catStyle = (c) => CATEGORY_STYLE[c]
  || { rgb: '100, 116, 139', accent: '#94a3b8', chip: '#f8fafc', text: '#475569' };

/*
  머리 영역 — '전체 요약'(DashboardView 의 TrendHeader) 과 **같은 양식**을 쓴다.
  같은 대시보드 안의 화면들이라 제목 크기·여백·연도 위젯이 다르면 탭을 옮길 때마다
  화면이 갈아 끼워진 느낌이 난다. 값은 그쪽에서 그대로 가져왔다.
*/
/*
  높이 사슬 — 흐름도가 남은 화면을 정확히 채우게 하는 길. (2026-08-07 요청)

  위에서부터 이미 이어져 있다:
      Container(100vh, flex열, overflow:hidden)
        → Content(flex:1, overflow-y:auto)   ← 넘치면 여기가 스크롤한다
          → motion.div(height:100%)
  끊긴 데가 여기부터였다. 아래 세 칸(Wrap·Body·FullFlow)에 높이를 넘기면
  흐름도의 캔버스가 flex:1 로 남은 만큼을 가져간다 — **재지 않아도** 된다.

  ★ $fill 은 **사업부별 보기에서만** 켠다. 매트릭스는 표가 화면보다 길어야 정상이라
    높이를 가두면 안 된다. 한 화면에 가두는 건 흐름도의 요구다.
  ★ min-height: 0 이 빠지면 아무 소용 없다. flex 항목의 기본 min-height 는 auto 라
    내용보다 작아지지 않고, 그래서 캔버스가 안 줄고 바깥이 스크롤된다.
*/
const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  ${(p) => p.$fill && `
    height: 100%;
    min-height: 0;
  `}
`;

const TopRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  gap: 1rem;
  flex-wrap: wrap;
`;

/** 머리 아래 본문 — 표·요약이 들어간다. */
const Body = styled.div`
  padding: 1.25rem 2rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  ${(p) => p.$fill && `
    flex: 1 1 0;
    min-height: 0;
  `}
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

/* 연도 위젯 — 전체 요약의 TrendYearSelector 와 같은 모양·같은 조작 */
const YearSelector = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
`;

const YearButton = styled.button`
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  &:hover { background: #e2e8f0; }
`;

const YearDisplay = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  min-width: 60px;
  text-align: center;
`;

const Sub = styled.span`
  font-size: 0.8rem;
  font-weight: 500;
  color: #6b7280;
`;

const IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 0.45rem;
  padding: 0.35rem 0.6rem;
  font-size: 0.8rem;
  color: #374151;
  cursor: pointer;
  &:hover { border-color: #9ca3af; }
`;

/* ── 지표 선택 (관리자 전용) ─────────────────────────────────────────────────
   전체 요약의 'KPI 선택' 과 같은 모양이되, **저장 자리는 나눠 뒀다**
   (`kpiMatrixSettings` vs `executiveReportSettings.excludedKpis`).
   보고서에서 감춘 지표가 운영 화면에서도 사라지면 그 지표의 과제가 통째로 안 보인다. */
const SelWrap = styled.div`
  position: relative;
`;

const SelPanel = styled.div`
  position: absolute;
  top: calc(100% + 0.35rem);
  right: 0;
  z-index: 30;
  width: 20rem;
  max-height: 24rem;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 10px 30px rgba(0,0,0,0.12);
  padding: 0.5rem;
`;

const SelOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 20;
`;

const SelHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.25rem 0.35rem 0.5rem;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.78rem;
  font-weight: 700;
  color: #374151;
`;

const SelLink = styled.button`
  border: 0;
  background: none;
  padding: 0;
  font-size: 0.72rem;
  color: #6b7280;
  text-decoration: underline;
  cursor: pointer;
  &:hover { color: #2563eb; }
`;

const SelItem = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 0.3rem 0.35rem;
  border-radius: 0.35rem;
  font-size: 0.78rem;
  color: #374151;
  cursor: pointer;
  &:hover { background: #f8fafc; }
  input { margin-top: 0.15rem; flex-shrink: 0; }
`;

const SelCat = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  color: #9ca3af;
  padding: 0.4rem 0.35rem 0.15rem;
`;

const Legend = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 0.75rem;
  color: #6b7280;
`;

const LegendItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
`;

const Swatch = styled.span`
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid #e5e7eb;
  background: ${(p) => p.$bg || '#fff'};
  ${(p) => p.$hatch && `
    background-image: repeating-linear-gradient(45deg,
      #e5e7eb 0, #e5e7eb 2px, #f9fafb 2px, #f9fafb 5px);
  `}
`;

// 표가 넓어질 수 있으므로 가로 스크롤은 표 안에서만 일어나게 한다.
const TableScroll = styled.div`
  /*
    ★ 표가 **스스로** 세로로도 스크롤한다 (2026-08-06)

    머리글(Th)은 진작부터 position:sticky · top:0 이었는데 펼치면 위로 사라졌다.
    까닭은 이 상자다 — overflow-x:auto 를 주는 순간 이 div 가 sticky 의 기준
    상자가 된다. 그런데 높이 제한이 없어 이 상자 자체는 세로로 스크롤하지 않으니,
    머리글은 '이 상자의 맨 위' 에 얌전히 붙은 채 상자째 페이지와 함께 밀려 올라갔다.
    (기준 상자가 안 움직이면 sticky 는 할 일이 없다.)

    max-height 를 줘서 세로 스크롤을 이 상자 안으로 들여오면 머리글이 제 일을 한다.
    아래쪽 줄을 볼 때도 어느 사업부 열인지 알 수 있다 — 열이 다섯이라 그게 없으면
    셋째 열부터는 세어 봐야 한다.

    접힘 상태는 그대로다. 표가 짧으면 max-height 에 안 닿아 스크롤이 아예 안 생긴다.

    빼는 값은 이 화면에서 표 위아래가 쓰는 자리다 —
        머리줄(제목·기간·연도) + 색 범례 + Body 안팎 여백 + 앱 상단.
    20rem → 16rem (2026-08-06). 실제로 쓰는 자리보다 넉넉히 빼 두고 있어서
    표 아래에 빈 자리가 남았다. **접힘·펼침 둘 다** 이 값이 정한다 — 접어도
    지표가 열여섯 줄이라 한 화면에 다 안 들어가므로 max-height 에 닿는다.
    표가 화면을 넘어가면 페이지까지 같이 스크롤되니, 줄일 때는 조금씩.

    min-height(26rem)는 낮은 화면에서 표가 몇 줄로 뭉개지지 않게 두는 바닥선이다.
  */
  overflow: auto;
  max-height: calc(100vh - 16rem);
  min-height: 26rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.6rem;
  background: #fff;
  /*
    옆에 요약 패널이 있을 때(Split 안): 남는 폭을 **표가 가져간다.**
    창이 커지면 표가 넓어지고, 그 폭은 사업부 열들이 똑같이 나눠 갖는다(Table 참조).
    폭이 모자라면 패널을 밀어내지 말고 표가 줄어들며 가로 스크롤된다 —
    패널이 아래로 떨어지면 "결론을 근거 옆에" 두려던 배치가 화면 크기마다 달라진다.

    ★ flex-basis 를 작게(520px) 준다. (2026-08-01)
      flex-wrap 은 항목을 **줄이기 전에** 원래 크기로 줄바꿈을 먼저 판정한다.
      basis 가 auto(=표의 min-width)면 "둘이 못 들어간다" 고 보고 패널을 통째로
      아래로 내려버린다 — 줄어들 기회조차 없다. 판정에 쓰이는 크기를 작게 잡아
      두면 같은 줄에 남고, 실제 폭은 grow 로 남는 만큼 채운다.

    min-width: 0 — 이게 없으면 flex 항목은 내용보다 작아지지 않아 그냥 넘친다.
      (표 자체의 min-width 가 스크롤 하한을 지키므로 여기서 0 이어도 안 뭉갠다)
  */
  flex: 1 1 520px;
  min-width: 0;
`;

/**
 * ★ table-layout: fixed — 열 폭을 **내용이 아니라 colgroup 이** 정한다.
 *
 * 기본(auto) 이면 칸 내용이 폭을 정한다. 행을 펼쳐 과제명을 넣는 순간
 * **긴 과제명이 있는 사업부 열만 넓어져** 표가 들쭉날쭉해진다.
 * fixed 로 두면 내용이 폭을 흔들지 못한다(과제명은 말줄임 + 툴팁).
 *
 * 표는 주어진 폭을 **다 쓴다**(width:100%). 고정 열(구분·지표명·계)만 colgroup 이
 * px 로 잡고, 사업부 열은 폭을 비워 둔다 — `table-layout: fixed` 에서 폭을 지정하지
 * 않은 열들은 남는 폭을 **똑같이 나눠 갖는다.** 그래서 창을 키우면 표도 같이 커지고,
 * 다섯 열이 항상 같은 폭을 유지한다(들쭉날쭉하면 가로로 훑기 나쁘다).
 *
 * min-width 는 그 합 — 창이 좁아지면 여기서 멈추고 가로 스크롤로 넘어간다.
 */
const Table = styled.table`
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  /* 이 아래로는 안 줄어든다 — 좁아지면 가로 스크롤 (위 머리말 참조) */
  min-width: ${(p) => SECT_COL_W + KPI_COL_W + (p.$cols || 5) * (p.$colW || DIV_COL_W)
                      + (p.$hasTotal ? TOTAL_COL_W : 0)}px;
  font-size: 0.8rem;
`;

/*
  머리글 — 진한 바탕에 흰 글씨. (2026-08-01)

  옅은 회색이던 때는 본문 칸과 명도가 비슷해서, 스크롤로 머리글이 따라올 때
  **첫 줄인지 머리글인지** 한 박자 헷갈렸다. 이 표는 칸마다 색(달성 상태)이 있어
  머리글이 옅으면 오히려 본문보다 뒤로 물러나 보인다.
  머리글은 데이터가 아니라 **틀**이라, 색으로 확실히 층을 나눈다.
*/
/**
 * 접힌 칸의 **속 열 정의.** 머리글의 소제목과 칸 내용이 **이 값을 같이 쓴다** —
 * 따로 두면 반드시 어긋난다(오늘 과제 목록에서 한 번 겪었다).
 *
 *   자체      그 사업부가 **직접 수행하는** 기여 과제 수
 *   지원      **기능조직(GTR·SR·CS)** 이 그 사업부를 도우며 기여하는 과제 수
 *   내용      기여 내용(메모) 건수 — 없는 칸이 대부분이라 자리만 비워 둔다
 *
 * ★ 자체와 지원을 **열로 나눈다** (2026-08-06)
 *     예전엔 한 칸에 `3+1` 로 붙여 썼다. 두 가지가 잘못됐다 —
 *
 *     ① **세로로 못 훑었다.** `+N` 이 앞 숫자 뒤에 바로 붙어서 `3+1` 과 `12+2` 의
 *        `+N` 이 서로 다른 x 에 섰다. 이 파일이 달성률·과제 수를 두고 한 번
 *        고쳤던 그 문제("자리를 고정한다")가 이 조각에만 남아 있었다.
 *     ② **읽으려면 규칙을 알아야 했다.** `3+1` 은 4로도, '3 중 1' 로도 읽힌다.
 *        머리글이 '자체'·'지원' 이라고 말해 주면 규칙을 안 외워도 된다.
 *
 *     둘은 **다른 질문**이기도 하다. '이 사업부가 뭘 하고 있나' 와 '기능조직이
 *     어디를 받치고 있나' — 바닥 요약이 이미 두 줄로 나눠 세고 있었는데
 *     정작 본문은 붙여 쓰고 있었다.
 *
 * ★ 지표·달성 열을 걷어냈다 (2026-08-06)
 *     칸에 `▲ 45/40` `112%` 를 같이 그리다가 뺐다. 두 가지 이유다 —
 *
 *     ① **색과 겹친다.** 칸 배경(STATUS_STYLE)이 이미 달성/근접/미달/실적없음/
 *        목표미설정/플랫폼 6단계를 말하고 범례도 화면에 있다. 숫자는 같은 말을
 *        한 번 더 한다. 그리고 이 중복은 **값이 꽉 찰수록 심해진다** — 다섯 사업부
 *        × 열여덟 지표에 달성률이 전부 찍히면 색이 말하던 것을 숫자가 덮는다.
 *     ② **이 표의 일이 아니다.** 이 표가 답하는 질문은 "KPI 가 어떻게 변하고
 *        있나" 가 아니라 "그 KPI 가 과제와 얼마나 연계돼 있나" 다(2026-08-01 결정).
 *        KPI 추이는 '전체 요약' 의 DX 부문 KPI 표가 따로 한다.
 *
 *     ⚠️ **"비어 있어서 뺀 게 아니다."** (2026-08-06 사용자 지적으로 바로잡음)
 *        처음 이 주석에는 "개발서버 90칸 중 달성률 0칸" 을 첫째 근거로 적었는데,
 *        **운영에서는 지표·달성이 꽉 차 있다.** 개발서버 수치를 운영의 근거로 쓴
 *        내 잘못이다. 뺀 진짜 이유는 위 ①②, 그리고 **한 칸에 8조각이라 복잡했던 것**
 *        이다. 값이 채워진다고 이 결정이 뒤집히지 않는다 — 오히려 그때 더 복잡해진다.
 *        (개발서버 통계로 이 화면의 운영 모습을 추정하지 말 것.)
 *
 *     숫자를 없앤 게 아니라 **옮겼다.** 칸에 대면 툴팁(perfLine)에 목표·실적·
 *     달성률·기준일·직전대비가 다 뜨고, 누르면 드릴 패널에 그 값들과 월별 추이가
 *     넓게 나온다. 등급은 색으로 훑고 정확한 값은 눌러서 본다.
 *
 * ⚠️ 칸 안의 조각 수와 이 열 수가 **반드시 같아야 한다.** 하나라도 많으면 그 조각이
 *    다음 줄로 밀린다(말풍선이 실제로 그랬다 — 2026-08-06).
 */
/*
  세 칸 모두 **폭 고정**이고, 덩어리째 칸 가운데에 선다 (2026-08-06).

  전에는 자체·지원이 1fr 이라 남는 폭을 반씩 가져갔다. 그러면 사업부 열이 넓어질수록
  두 숫자가 양쪽으로 벌어져 **한 칸 안의 값인데 따로 노는 것처럼** 보였다.
  폭을 고정하고 justify-content 로 가운데 모으면, 열이 아무리 넓어져도 세 값이
  붙어 있는 한 덩어리로 읽힌다. (모으는 쪽은 CellInner·ThSub·SumSlot 세 군데 —
  같이 안 바꾸면 머리글과 요약이 본문에서 떨어진다.)

  폭 값은 1.9/1.9/2.1 → 2.7/2.7/2.6 → 3.1/3.1/2.8 (2026-08-06). 처음 고정했을
  때는 숫자에 딱 맞춰 잡았더니 세 값이 서로 붙어 **한 숫자처럼** 읽혔다. 여기서
  폭은 '숫자가 들어갈 자리' 가 아니라 **값 사이를 벌리는 여백**이다 —
  숫자 폭에 맞춰 다시 줄이지 말 것.

  ★ 가운데 모으기를 justify-content 로 하지 않는다 (2026-08-06)
      한때 세 칸만 두고 `justify-content: center` 로 모았다. 그러면 **격자 전체가
      세 칸 폭(139px)으로 쪼그라든다.** 숫자는 멀쩡했지만, 한 줄을 통째로 쓰는
      전용 지표명(CellKpiName, grid-column 1/-1)까지 그 139px 안에 갇혀
      멀쩡한 이름이 두 줄 세 줄로 접혔다 — 칸은 200px 인데 이름은 139px 만 썼다.

      그래서 **양옆에 minmax(0,1fr) 여백 트랙**을 두고 숫자를 2·3·4 열에 못박는다.
      격자는 칸을 꽉 채우므로 이름은 칸 전체 폭을 쓰고, 숫자는 여백이 밀어 준
      가운데에 그대로 선다. 조각 수(3)는 그대로다 — 여백 트랙은 빈 채로 둔다.

  ⚠️ 조각마다 grid-column 을 **직접** 준다(CellProj 2 · CellSupport 3 · 내용 4).
     자동 배치에 맡기면 1·2·3 열, 즉 왼쪽 여백부터 채워 버린다.
*/
const CELL_COLS = 'minmax(0, 1fr) 3.1rem 3.1rem 2.8rem minmax(0, 1fr)';

/**
 * 머리글 아래 소제목 줄 — 칸에서 반복되던 '과제' 글자를 여기로 올렸다.
 *
 * 정렬은 **칸 안의 값과 같아야 한다** (2026-08-06). 소제목이 한쪽인데 값이
 * 반대쪽이면 둘이 같은 열인 줄 모른다. 아래 CellProj·NoteMark 와 짝을 맞춘다.
 */
const ThSub = styled.div`
  display: grid;
  grid-template-columns: ${CELL_COLS};
  gap: 0.35rem;
  margin-top: 0.2rem;
  /* 0.62 → 0.72 (2026-08-06). 위 사업부명(0.95)의 곁다리라 늘 한 단계 작다. */
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
  /* 양옆 여백 트랙(1·5열)은 비우고 가운데 세 칸만 쓴다 — 칸 안의 숫자와 같은 자리.
     여기 세 개는 개수가 늘 3 이라 nth-child 로 짚어도 안전하다. */
  span:nth-child(1) { grid-column: 2; }
  span:nth-child(2) { grid-column: 3; }
  span:nth-child(3) { grid-column: 4; }
`;

const Th = styled.th`
  position: sticky;
  top: 0;
  z-index: 2;
  background: #334155;
  color: #fff;
  font-weight: 700;
  /* 0.78 → 0.95 (2026-08-06). 본문 숫자를 1.45 까지 키우고 나니 머리글이
     혼자 작아 층이 뒤집혀 보였다. StickyTh(구분·KPI 지표)도 이걸 물려받는다. */
  font-size: 0.95rem;
  letter-spacing: 0.02em;
  /* ⚠️ 좌우 여백은 **CellInner 와 같아야 한다**(0.5rem). 머리글의 소제목 줄과 칸의
     값은 서로 다른 그리드인데, 여백이 다르면 그리드 폭이 달라져 열이 통째로
     어긋난다 — 0.4rem 이던 시절엔 0.1rem 씩 밀려 있었다 (2026-08-06). */
  padding: 0.55rem 0.5rem;
  text-align: center;
  white-space: nowrap;
  /* 열 구분 — 어두운 바탕이라 회색 선은 안 보인다. 흰색을 옅게 얹는다. */
  border-right: 1px solid rgba(255, 255, 255, 0.14);
  border-bottom: 1px solid #1e293b;
`;

/* 가로 스크롤 중에도 붙어 있는 두 열. 구분(0) 다음에 지표명(SECT_COL_W) 이 선다.
   본문 칸이 이 아래로 지나가므로 배경이 불투명해야 하고(Th 가 이미 진한 색),
   z-index 는 다른 머리글보다 높아야 세로·가로 스크롤이 겹칠 때 위에 남는다. */
const StickyTh = styled(Th)`
  left: ${(p) => (p.$first ? 0 : SECT_COL_W)}px;
  z-index: 3;
  text-align: left;
`;

/**
 * 맨 왼쪽 '구분' 칸 — 전사 공통 / 사업부 전용 / 플랫폼 구축.
 *
 * 예전엔 구획마다 표 전체를 가로지르는 머리 행이 있었다. 그 줄이 설명까지 달고
 * 있어서 자리를 먹고, 스크롤하면 지금 어느 구획인지도 잃었다.
 * 열로 옮기고 rowSpan 으로 합치면 **끝까지 옆에 붙어 있고** 줄도 안 먹는다.
 * (설명 문구는 title 로 내렸다 — 늘 보일 필요는 없지만 사라지면 안 되는 정보다)
 */
const SectionCell = styled.td.attrs({ 'data-section': '' })`
  position: sticky;
  left: 0;
  z-index: 1;
  background: ${(p) => p.$bg || '#f8fafc'};
  border-right: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  padding: 0.5rem 0.4rem;
  /* 여러 줄을 덮는 칸이라 가로·세로 모두 가운데에 둔다 —
     위쪽에 붙여 두면 병합 범위가 어디까지인지 눈으로 안 잡힌다. */
  text-align: center;
  vertical-align: middle;
  /* 0.76 → 0.95 (2026-08-06). 여러 줄을 덮는 칸이라 그 구획이 어디서 시작해
     어디서 끝나는지를 이 글자가 알려 준다. 행이 줄어 세로로 여유가 생긴 만큼
     키운다 — 작으면 병합 범위가 눈에 안 잡힌다. */
  font-size: 0.95rem;
  font-weight: 700;
  color: ${(p) => p.$fg || '#334155'};
  line-height: 1.3;
  word-break: keep-all;

  /* 왼쪽 색 띠는 뺐다 — 바탕색이 같은 일을 하고, 띠가 둘(구분·지표명)이면
     어느 쪽이 무엇을 가리키는지 흐려진다. */

  /* 'N개' — 구획 이름의 곁다리라 한 단계 작게 둔다 */
  b {
    display: block;
    margin-top: 0.2rem;
    font-size: 0.8rem;
    font-weight: 600;
    opacity: 0.75;
  }
`;

const RowHead = styled.td.attrs({ 'data-rowhead': '' })`
  position: sticky;
  /* 구분 열 다음에 선다. tfoot 처럼 구분 칸이 없는 줄은 $first 로 0 에 붙인다. */
  left: ${(p) => (p.$first ? 0 : SECT_COL_W)}px;
  z-index: 1;
  background: #fff;
  padding: 0.4rem 0.5rem;
  border-right: 1px solid #e5e7eb;
  border-bottom: 1px solid #f3f4f6;
  /* 지표명은 **줄의 이름표**다 — 어느 줄을 보고 있는지가 여기서 정해진다.
     칸 숫자를 1.08 까지 키우고 나니 0.78 은 너무 뒤로 물러나 있었다.
     0.78 → 0.92 (2026-08-06).
     ⚠️ 접힘·펼침 모두 이 한 줄이 정한다 — RowToggle 이 font: inherit 이라
        여기 크기를 그대로 물려받는다. 상태별로 따로 두지 말 것.
     ⚠️ 이 주석에 백틱을 쓰지 말 것 — styled 템플릿이 거기서 끊긴다. */
  font-size: 0.92rem;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: top;
`;

/** 행 펼치기 — 숫자만 보던 칸에 실제 과제를 늘어놓는다. */
const RowToggle = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: ${(p) => (p.$clickable ? 'pointer' : 'default')};
  &:hover { color: ${(p) => (p.$clickable ? '#1d4ed8' : 'inherit')}; }
  svg { flex-shrink: 0; opacity: ${(p) => (p.$clickable ? 1 : 0.25)}; }

  /* 넘치는 지표명은 여기서 잘린다 — min-width:0 이 없으면 flex 가 안 줄어든다 */
  > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

/** 펼친 칸의 과제 한 줄. 클릭하면 편집창이 열린다. */
const ProjChip = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  width: 100%;
  border: 0;
  padding: 0.12rem 0.25rem;
  margin-top: 1px;
  text-align: left;
  font-size: 0.7rem;
  line-height: 1.35;
  border-radius: 0.25rem;
  color: ${(p) => (p.$support ? '#3730a3' : '#1f2937')};
  background: ${(p) => (p.$support ? 'rgba(224,231,255,0.85)' : 'rgba(255,255,255,0.75)')};
  cursor: pointer;
  &:hover { background: #fff; outline: 1px solid #93c5fd; }

  /* 제목은 남는 폭을 갖고 넘치면 말줄임 — 뱃지는 끝까지 안 잘린다 */
  > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

/**
 * 과제 앞의 소속 뱃지 — 펼쳤을 때 **어디 과제인지** 바로 보이게.
 *
 * 칸은 이미 '대상 사업부' 열에 있지만, 거기 놓인 과제가 전부 그 사업부 것은 아니다.
 * 기능조직(GTR·SR·CS)이 기여하는 과제가 같이 들어오기 때문이다. 예전엔 '↳' 하나로
 * 구분했는데 그게 **어느 조직인지까지는 말해 주지 않았다.**
 */
const ChipBadge = styled.span`
  flex-shrink: 0;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  padding: 0.02rem 0.26rem;
  border-radius: 0.25rem;
  color: ${(p) => (p.$support ? '#fff' : '#475569')};
  background: ${(p) => (p.$support ? '#6366f1' : '#e2e8f0')};
`;

const CellList = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 0.2rem 0.25rem;
`;

/* SectionRow(구획 머리 행)는 걷어냈다 — 구획 이름이 맨 왼쪽 '구분' 열로 갔다.
   행 하나를 통째로 먹지 않고, 스크롤해도 옆에 붙어 있다. (SectionCell 참조) */

const CatRow = styled.td`
  /* 구분 열(sticky) 오른쪽에서 시작하므로 왼쪽 기준도 그만큼 밀어 둔다 */
  left: ${SECT_COL_W}px;
  background: ${(p) => p.$chip || '#f3f4f6'};
  color: ${(p) => p.$text || '#4b5563'};
  font-weight: 700;
  font-size: 0.74rem;
  letter-spacing: 0.03em;
  padding: 0.3rem 0.5rem;
  /* Row 와 같은 이유로 border 가 아니라 그림자다 — 폭에 영향을 주면 안 된다 */
  box-shadow: inset 3px 0 0 ${(p) => p.$accent || '#d1d5db'};
  border-top: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  left: 0;
`;

const Cell = styled.td`
  text-align: center;
  padding: 0;
  vertical-align: ${(p) => (p.$top ? 'top' : 'middle')};
  border-bottom: 1px solid #f3f4f6;
  /* 세로 격자 — 어느 사업부 칸인지 눈으로 따라가게 한다 */
  border-right: 1px solid #eef0f3;
  background: ${(p) => p.$bg};
  cursor: ${(p) => (p.$clickable ? 'pointer' : 'default')};
  ${(p) => p.$na && `
    background-image: repeating-linear-gradient(45deg,
      #e5e7eb 0, #e5e7eb 2px, #f9fafb 2px, #f9fafb 5px);
  `}
  /*
    미달인데 기여 과제가 0건 — 이 표가 찾는 바로 그 칸.
    색만으로는 "빨간 칸이 여럿" 중에 묻힌다. 안쪽 테두리로 한 번 더 세운다.
    (outline 을 쓰지 않는다 — hover 가 outline 을 쓰므로 서로 덮어쓴다)

    ⚠️ 앰퍼샌드 두 개로 특정도를 올린다. 아래 Row 의 자식 td 선택자가 카테고리
       색조를 같은 box-shadow 로 얹는데, 선택자 특정도가 더 높아 그냥 쓰면
       이 테두리가 진다. 이 칸에서는 색조를 포기하고 경고를 살린다.

    ⚠️ 이 주석에 **백틱을 쓰지 말 것.** styled 의 템플릿 리터럴 안이라
       백틱 하나가 리터럴을 끊고 그 뒤가 JS 로 파싱된다. 문법상 유효한 식이 되어
       **빌드는 통과하고 실행할 때만 터진다** (2026-08-01 실제로 겪음:
       "td is not defined"). CSS 주석 안에서는 홑따옴표를 쓴다.
  */
  ${(p) => p.$alarm && `
    && { box-shadow: inset 0 0 0 2px #dc2626; }
  `}
  &:hover {
    outline: ${(p) => (p.$clickable ? '2px solid #2563eb' : 'none')};
    outline-offset: -2px;
  }
`;

/**
 * 행 구분 — 가로로 긴 표에서 **지금 보는 칸이 어느 지표인지** 잃지 않게 한다.
 *
 * 배경색(background)을 쓰지 않고 `inset box-shadow` 로 덮는다.
 *     칸에는 이미 밀도 색과 '해당 없음' 빗금(background-image)이 들어가 있다.
 *     background 로 줄무늬를 주면 그 둘을 지워 버린다. inset 그림자는 배경 **위에,
 *     글자 아래에** 깔리므로 밀도 색과 빗금을 살린 채 띠만 얹을 수 있다.
 *
 * 줄무늬는 nth-child 가 아니라 렌더가 넘기는 $band 로 정한다 —
 * 카테고리 구분 행(개발/제조/품질)이 tr 로 섞여 있어 nth-child 는 어긋난다.
 */
const Row = styled.tr`
  /*
    ★ 구분 칸([data-section])은 이 행의 규칙에서 **통째로 뺀다** (2026-08-01).
      구분 칸은 여러 행에 걸친 칸이라 '이 행' 의 것이 아니다. 뺐어야 하는 이유가
      실제로 셋이나 있었다 —
        · 행 색조가 구분 칸까지 덮어 **색 띠가 지워졌다**
        · 마우스를 올리면 여러 행을 덮는 구분 칸이 같이 밝아졌다
          (한 행에 반응하는 표시인데 칸은 열 전체라 어디에 반응한 건지 어긋난다)
        · 구분 칸이 있는 첫 행만 :first-child 가 그쪽으로 가서
          **지표명 칸의 색 띠가 사라졌다** — 같은 구획 안에서 첫 줄만 달라 보였다

      그래서 위치(:first-child)가 아니라 **정체(data-*)** 로 고른다. 위치로 고르면
      칸이 하나 끼어드는 순간 엉뚱한 칸이 잡힌다.

    카테고리 색조 + 홀짝 띠는 **하나의 값**으로 합친다.
    같은 크기의 inset 을 여러 개 겹치면 앞의 것이 뒤를 가려 의도대로 안 섞인다.
  */
  > td:not([data-section]) {
    box-shadow: inset 0 0 0 9999px rgba(${(p) => p.$rgb}, ${(p) => (p.$band ? 0.085 : 0.035)});
  }

  /* 지표명 왼쪽 색 띠 — 이 열은 sticky 라 가로로 스크롤해도 계속 보인다.
     ⚠️ border-left 로 하면 안 된다. table-layout:fixed 에서 테두리가 폭에 더해져
        **본문 행만 3px 씩 밀리고 머리글·바닥글과 어긋난다.** 그림자는 레이아웃에
        영향을 주지 않는다. (작은 inset 을 먼저 써야 큰 색조 위에 그려진다) */
  > td[data-rowhead] {
    box-shadow:
      inset 3px 0 0 ${(p) => p.$accent},
      inset 0 0 0 9999px rgba(${(p) => p.$rgb}, ${(p) => (p.$band ? 0.085 : 0.035)});
  }

  &:hover > td:not([data-section]) {
    box-shadow: inset 0 0 0 9999px rgba(37, 99, 235, 0.17);
  }
  &:hover > td[data-rowhead] {
    box-shadow:
      inset 3px 0 0 ${(p) => p.$accent},
      inset 0 0 0 9999px rgba(37, 99, 235, 0.17);
    color: #1d4ed8;
    font-weight: 700;
  }
`;

const CellInner = styled.div`
  /* 접힌 칸은 **한 줄**이고, 머리글 소제목(과제·내용)과 **같은 2열**이다.
     (2026-08-06) 예전에는 맥락 줄과 과제 줄이 세로로 쌓여 행이 높았고,
     칸마다 '달성'·'과제' 글자가 되풀이됐다. 그 글자는 머리글로 올리고
     칸에는 숫자만 남긴다 — 세로로 훑을 때 같은 자리에 같은 뜻이 온다.
     같은 날 지표·달성 열까지 걷어내 2열이 됐다 (CELL_COLS 머리말). */
  display: grid;
  grid-template-columns: ${CELL_COLS};
  align-items: baseline;
  gap: 0.35rem;
  padding: 0.3rem 0.5rem;
  color: ${(p) => p.$color || '#111827'};
  text-align: left;
  line-height: 1.3;
  white-space: nowrap;
  min-width: 0;
`;

/**
 * 펼친 상태의 칸. 위쪽 정렬 — 과제 수가 달라도 목록이 같은 높이에서 시작해야 읽힌다.
 * 접힌 칸과 달리 **세로로 쌓는다** — 아래에 과제 목록이 붙기 때문이다.
 */
const CellTop = styled(CellInner)`
  display: block;
  white-space: normal;
  padding: 0.3rem 0.3rem 0.15rem;
`;

/**
 * 칸 내용 — **주인공 하나뿐이다.**
 *
 *   3 +1   💬2     ← 연결 과제(자체+지원) · 기여 내용 건수
 *
 * 무엇이 주인공인가 (2026-08-01 결정, 2026-08-06 끝까지 밀어붙임)
 *     이 표가 답하는 질문은 "KPI 가 어떻게 변하고 있나" 가 아니라
 *     **"그 KPI 가 과제와 얼마나 연계돼 있나"** 다. KPI 자체의 추이를 보려면
 *     '전체 요약' 의 DX 부문 KPI 표가 따로 있다.
 *
 *     처음엔 지표값을 '맥락' 으로 작게 깔았다. 그런데 그 맥락이 칸의 절반을
 *     먹었다 — 한 칸에 화살표·실적·슬래시·목표·달성률·과제·지원·말풍선 여덟 조각.
 *     다섯 사업부에 걸쳐 되풀이되니 정작 주인공(과제 수)이 안 보였다.
 *     지금은 과제 수와 말풍선만 남기고, 지표값은 툴팁과 드릴 패널로 옮겼다
 *     (CELL_COLS 머리말 참조).
 *
 * 되돌리려면
 *     CELL_COLS 에 열을 늘리고 CtxVals/CtxArrow/CtxRate 를 되살린다.
 *     git 이력에 있다 (2026-08-06 이전). ⚠️ 조각 수와 열 수를 반드시 맞출 것.
 */

/**
 * 압축 행에서 칸 위에 붙는 지표명.
 *
 * 일반 행은 왼쪽 첫 열이 지표명을 말하지만, 압축 행은 한 줄에 여러 지표가 있어
 * 칸마다 자기 이름을 달아야 한다. 넘치면 말줄임 — 전체 이름은 title 에 있다.
 */
/*
  압축 줄(사업부 전용 지표)에서만 나온다 — 그 줄은 행 머리에 지표명을 못 쓰기 때문.

  ★ 이름 칸을 **색으로 가른다** (2026-08-06)
      이 줄은 칸마다 지표가 다르다. 그런데 이름과 숫자가 같은 바탕에 붙어 있어
      **어디까지가 이름이고 어디부터가 값인지** 한 박자 헷갈렸다. 게다가 이 줄에는
      담당 사업부가 아닌 빈 칸이 섞여 있어, 이름이 붙은 칸이 어느 것인지도
      눈에 잘 안 들어왔다.

      머리글을 진하게 깔아 틀과 데이터를 나눈 것과 **같은 수법**이다(Th 머리말).
      다만 여기서는 검정을 옅게 얹는다 — 칸 바탕이 달성 상태에 따라 초록·노랑·
      빨강·흰색·보라로 바뀌므로, 특정 색을 깔면 어떤 상태에서는 묻히고 어떤
      상태에서는 튄다. 반투명 먹은 **어느 바탕에서든 같은 만큼** 어두워진다.
*/
const CellKpiName = styled.div`
  font-size: 0.72rem;
  font-weight: 700;
  color: #0f172a;
  /* **잘리지 않는다** (2026-08-06). 전에는 nowrap + 말줄임이라 긴 이름이
     'DX 전환 과제 대상 설…' 처럼 끊겼다. 이 줄에서는 지표명이 행 머리에 없고
     칸 안이 유일한 자리라, 끊기면 그 칸이 무슨 지표인지 알 길이 없다
     (일반 줄은 왼쪽 지표명 열이 대신 말해 주지만 여기는 아니다).
     그래서 폭에 맞춰 접고 줄 수가 늘어나는 쪽을 받아들인다.
     keep-all: 한글은 어절째 넘긴다. anywhere: 한 낱말이 열보다 길면 그때만 자른다. */
  white-space: normal;
  overflow: visible;
  word-break: keep-all;
  overflow-wrap: anywhere;
  line-height: 1.25;
  /* 아래 숫자 세 칸이 가운데 모여 있으니 이름도 가운데로 — 왼쪽에 붙여 두면
     이름과 숫자가 서로 다른 축에 서서 한 칸으로 안 읽힌다. 두 줄이 되는
     긴 이름도 가운데 기준이라야 덩어리로 보인다. (2026-08-06) */
  text-align: center;
  background: rgba(15, 23, 42, 0.07);
  border-bottom: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 0.25rem 0.25rem 0 0;
  padding: 0.12rem 0.3rem;
  margin-bottom: 0.28rem;
  /* 압축 줄에서만 나온다. 열 그리드를 깨지 않도록 **한 줄을 통째로** 차지하고
     숫자 칸은 그 아래에 선다 — 이 구획만 2줄이 되는 건 감수한다
     (지표명을 어디엔가는 써야 하고, 행 머리는 이미 '전용 지표 N' 이 쓰고 있다). */
  grid-column: 1 / -1;
  min-width: 0;
`;

/** 주인공 — 이 표는 과제 연계를 보는 표다. */
const CellProj = styled.div`
  /* 가운데 세 칸 중 첫째. 자동 배치에 맡기면 왼쪽 여백 트랙에 들어간다. */
  grid-column: 2;
  text-align: center;
  justify-self: center;
  /* **이 표의 주인공.** 세로로 훑을 때 이 열이 먼저 잡혀야 한다.
     0.82 → 0.95 → 1.08 → 1.25 → 1.45 (2026-08-06). 지표·달성을 걷어내고
     플랫폼 셋을 하나로 합치면서 행이 크게 줄어 세로로 자리가 남았다.
     칸에 남은 것이 사실상 이 숫자뿐이라 키울수록 표가 읽힌다.
     지표명(0.92)보다 크다 — 이 표는 '어느 지표인가' 가 아니라
     '거기 과제가 몇 개 붙었나' 를 보는 표다.
     크기는 NUM_FONT 에서 온다 — 바닥 요약과 같은 값을 써야 한다. */
  font-size: ${NUM_FONT};
  font-weight: ${(p) => (p.$zero ? 500 : 800)};
  color: ${(p) => (p.$zero ? '#b0b7c3' : '#111827')};
  white-space: nowrap;
  flex-shrink: 0;
`;

/**
 * 지원 — 기능조직(GTR·SR·CS)이 그 사업부를 도우며 기여하는 과제 수.
 *
 * 자체와 **색을 가른다** (남색 #4f46e5 — 예전 `3+1` 표기가 쓰던 색을 그대로 이었다).
 * 남의 조직이 와서 붙은 것이라 성격이 다르고, 같은 색이면 옆자리 자체 숫자와
 * 한 덩어리로 읽혀 `3 1` 이 31 처럼 보인다.
 *
 * 굵기는 자체보다 한 단계 낮춘다 — 이 표의 주인공은 그 사업부가 하는 일이고,
 * 지원은 그걸 누가 받치고 있는지를 덧붙이는 값이다.
 */
const CellSupport = styled.div`
  grid-column: 3;
  text-align: center;
  justify-self: center;
  /* 자체(1.45)보다 한 단계 작게 — 같이 키우되 위계는 지킨다 (2026-08-06) */
  font-size: 1.25rem;
  font-weight: 700;
  color: #4f46e5;
  white-space: nowrap;
  flex-shrink: 0;
`;

/**
 * 말풍선이 없는 칸의 **빈 자리.** 그냥 <span /> 을 두면 자동 배치를 타고
 * 왼쪽 여백 트랙(1열)으로 가 버린다 — 자리를 지키라고 그린 조각이
 * 엉뚱한 열을 차지하면 격자가 어긋난다.
 */
const NoteSlot = styled.span`
  grid-column: 4;
`;

/** 연결/미연결/전체 사이의 빗금. 숫자보다 옅게 둬야 셋이 각각 읽힌다. */
const Sep = styled.span`
  color: #d1d5db;
  font-weight: 400;
  /* 숫자에 딸린 기호라 **상대 크기**로 둔다 — NUM_FONT 가 바뀌어도 같이 따라오되
     늘 한 단계 뒤로 물러나 있다. 고정값이면 숫자만 커질 때 빗금이 도드라진다. */
  font-size: 0.7em;
  margin: 0 2px;
`;

/** 0 건인 자리. '—' 는 '이 표가 찾는 빈칸' 에만 쓰고, 예사로운 0 은 이걸로 조용히 둔다. */
const Dim = styled.span`
  color: #d1d5db;
  font-weight: 500;
`;

/* SparkSlot 은 걷어냈다 — 칸에서 스파크라인을 뺐으므로 자리를 잡아 둘 것이 없다.
   (추이는 칸을 눌러 상세에서 본다. Sparkline 머리말 참조) */

const TotalCell = styled.td`
  text-align: center;
  padding: 0.45rem 0.5rem;
  border-bottom: 1px solid #f3f4f6;
  border-left: 1px solid #e5e7eb;
  background: #fafafa;
  font-weight: 700;
  color: ${(p) => (p.$zero ? '#b45309' : '#111827')};
  white-space: nowrap;
`;

/*
  바닥 요약 칸들은 **본문 칸과 같은 왼쪽 기준선**에 맞춘다 (2026-08-01).
  가운데 정렬이면 열마다 숫자가 제각기 다른 자리에 떠서, 위 본문(왼쪽 정렬)과
  세로로 안 맞고 요약 줄만 붕 뜬다. 들여쓰기 값(0.55rem)은 CellInner 와 같다.
*/
/**
 * 바닥 요약의 숫자를 **본문에서 그 값이 사는 열에 세로로 맞춘다** (2026-08-06).
 *
 * 요약도 결국 과제 수라서, 본문 숫자와 다른 자리에 뜨면 세로로 못 훑는다.
 * 본문 칸과 **같은 열 정의(CELL_COLS)** 를 쓰고 해당 칸에만 값을 넣는다.
 *
 *   $col=2 (자체)  과제-KPI 연결 현황 — 그 사업부가 직접 하는 것
 *   $col=3 (지원)  기능조직 지원   — 남이 와서 돕는 것
 *
 * 1·5 열은 숫자를 가운데로 미는 여백 트랙이라 비워 둔다 (CELL_COLS 머리말).
 *
 * 줄마다 열을 고르는 이유 — 세 줄을 다 1열에 몰아 두면 '기능조직 지원' 만
 * 본문의 지원 숫자와 어긋난다. 요약은 본문을 세로로 이어받는 줄이라야 뜻이 산다.
 */
const SumSlot = styled.div`
  display: grid;
  grid-template-columns: ${CELL_COLS};
  gap: 0.35rem;
  align-items: baseline;
  > * {
    /* 숫자 하나면 한 칸(2 또는 3), 연결/미연결/전체처럼 길면 '2 / 5' 로 걸친다. */
    grid-column: ${(p) => p.$col || 2};
    justify-self: center;
    text-align: center;
    white-space: nowrap;
  }
`;

const SummaryRow = styled.tr`
  td {
    border-top: 2px solid #d1d5db;
    background: #fafafa;
    padding: 0.5rem 0.55rem;
    text-align: left;
    font-weight: 600;
  }
`;

/**
 * '과제-KPI 연결 현황' 요약 칸 — **연결 / 미연결 / 전체**를 한 줄에 담는다 (2026-08-06).
 *
 * 전에는 '사업부 수행과제(연결/전체)' 와 '미연결 과제(미연결/전체)' 두 줄이었고,
 * 이름도 '사업부 수행과제' 였다 — 무엇을 세는지(연결 여부)가 안 드러나 바꿨다.
 * 분모(전체)를 두 번 쓰면서 정작 연결과 미연결을 **눈으로 빼서** 맞춰 봐야 했다.
 * 셋을 나란히 두면 그 뺄셈이 필요 없다 — 연결 + 미연결 = 전체가 그 자리에 보인다.
 *
 * 칸 전체에 색을 물려주지 않는다. 셋 중 **미연결만** 주황이어야 하기 때문이다
 * (색은 '봐야 할 것' 을 가리키는 신호지 줄의 장식이 아니다).
 * 바탕의 옅은 주황과 누름은 그대로 — 미연결이 있는 사업부를 줄 단위로도 짚어 준다.
 */
const UnlinkedCell = styled.td`
  text-align: left;
  padding: 0.5rem 0.55rem;
  /* 본문 '자체' 칸과 같은 크기 (NUM_FONT) — 같은 것을 세는 숫자다 */
  font-size: ${NUM_FONT};
  background: ${(p) => (p.$n > 0 ? '#fff7ed' : '#fafafa')};
  font-weight: 700;
  cursor: ${(p) => (p.$n > 0 ? 'pointer' : 'default')};
  /* 요약의 **첫 줄**이라 본문과의 경계를 굵게 (전에는 SummaryRow 가 하던 일) */
  border-top: 2px solid #d1d5db;
  &:hover { outline: ${(p) => (p.$n > 0 ? '2px solid #ea580c' : 'none')}; outline-offset: -2px; }
`;

/**
 * 펼친 상태의 바닥 칸 — **미연결 과제를 이름째** 늘어놓는다 (2026-08-06).
 *
 * 접힘/펼침의 규칙이 표 전체에서 하나다: **접으면 숫자, 펼치면 이름.**
 * 본문 칸이 그렇게 움직이는데 바닥만 숫자로 남아 있으면 같은 화면에서 두 가지
 * 문법을 읽어야 한다. 펼쳤을 때 사람이 찾는 것도 '몇 건' 이 아니라 '어느 과제' 다.
 *
 * 누름을 걸지 않는다 — 목록이 이미 펼쳐져 있어 열어 볼 것이 없고,
 * 안의 과제 알약이 각자 과제 편집창을 연다.
 */
const UnlinkedListCell = styled.td`
  padding: 0.35rem 0.4rem;
  background: ${(p) => (p.$n > 0 ? '#fff7ed' : '#fafafa')};
  border-top: 2px solid #d1d5db;
  /* 사업부마다 미연결 수가 달라 칸 높이가 제각각이다 — 위로 맞춰야 첫 줄이
     같은 높이에서 시작한다(본문 펼친 칸과 같은 규칙). */
  vertical-align: top;
  /* ⚠️ UnlinkedCell 의 NUM_FONT(1.45rem)를 물려받지 않도록 여기서 다시 정한다.
     과제 알약은 이름을 읽는 것이라 본문 목록과 같은 크기여야 한다. */
  font-size: 0.78rem;
`;

const StateRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: ${(p) => (p.$error ? '#b91c1c' : '#6b7280')};
  padding: 2rem 0;
  justify-content: center;
`;

const Spin = styled(Loader2)`
  animation: kpimSpin 1s linear infinite;
  @keyframes kpimSpin { to { transform: rotate(360deg); } }
`;

// ── 드릴다운 ──────────────────────────────────────────────────────────────
const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 2rem;
`;

/**
 * 과제 목록의 **최대 폭.** 셀 상세 패널과 사업부별 보기가 같이 쓴다.
 *
 * 더 넓게 둘 수는 있지만 그러면 안 된다 — 과제명에서 기여 방법, 다시 상태까지
 * 눈이 가로로 너무 멀리 이동해 한 줄을 읽기 어려워진다. 920px 이면
 * 과제명이 대부분 한 줄에 들어가면서(약 30자) 줄 길이도 감당된다.
 */
const READ_W = '920px';

const Panel = styled.div`
  background: #fff;
  border-radius: 0.7rem;
  /* 760 → 920 (2026-08-06). 기여 방법 열이 붙으면서 760px 로는 과제명이 두 줄로
     접혔다. 다만 1080px 은 반대로 **한 줄이 너무 길어** 읽기 어려웠다.
     목록의 최대 폭(READ_W)과 같은 값을 써서 두 화면의 줄 길이를 맞춘다. */
  width: min(${READ_W}, 100%);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

/*
  모달 안쪽 좌우 여백 — **한 곳에서 정한다.**
  PanelBody 에 좌우 패딩을 주지 않는 이유는 과제 행(ProjRow)의 hover 배경이
  패널 폭을 꽉 채워야 하기 때문이다. 그래서 여백은 각 자식이 이 값으로 맞춘다.
  값이 흩어져 있으면 새 블록을 넣을 때마다 벽에 붙는다 — 실제로 그랬다.
*/
const PANEL_X = '1.15rem';

const PanelHead = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem ${PANEL_X};
  border-bottom: 1px solid #e5e7eb;
`;

const PanelHeadRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
`;

/** 드릴 패널의 일괄 편집 단추 — 이 패널이 곧 '고른 과제 묶음'이다. */
const BulkBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.28rem 0.65rem;
  border: 1px solid #c7d2fe;
  border-radius: 0.45rem;
  background: #eef2ff;
  color: #3730a3;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  &:hover { background: #e0e7ff; border-color: #a5b4fc; }
`;

const PanelBody = styled.div`
  overflow-y: auto;
  padding: 0.85rem 0 1rem;
`;

/**
 * 과제 목록의 열 정의. **머리행과 줄이 같은 값을 쓴다.**
 *
 * flex 로 두면 줄마다 앞쪽 알약(과제코드·지원배지) 폭이 달라서 열 시작점이 제각각이 되고,
 * 머리행의 구분선과 줄의 구분선이 어긋난다(2026-08-06 실제로 어긋났다).
 * 그리드는 열 폭을 **표 전체에서 한 번** 정하므로 그런 일이 없다.
 *
 * · 상태·진행률  **고정 폭.** 내용만큼(max-content)으로 두면 안 된다 —
 *                머리행과 줄은 **서로 다른 그리드 컨테이너**라 열 폭을 각자 계산하는데,
 *                머리행의 '상태'(글자 2자)와 줄의 알약('정상진행' + 패딩)은 폭이 달라서
 *                남는 폭이 달라지고, 그걸 fr 로 나눈 과제 열이 어긋난다.
 *                (2026-08-06 — 실제로 머리행 쪽이 더 넓어 보였다)
 *                값 근거: 상태는 가장 긴 '정상진행'(4자)+알약 패딩, 진행률은 '100%'.
 * · 과제·기여방법 남는 폭을 1.6 : 1.3 으로. 과제명이 길어 조금 더 준다
 */
const COL_STATUS = '4.6rem';
const COL_PROGRESS = '3.2rem';

const PROJ_COLS = `minmax(0, 1.5fr) minmax(0, 1.15fr) ${COL_STATUS} ${COL_PROGRESS}`;
/** 기여 방법 열이 없는 목록(4분면·미매칭 등)은 3열로 */
const PROJ_COLS_NO_NOTE = `minmax(0, 1fr) ${COL_STATUS} ${COL_PROGRESS}`;

const ProjRow = styled.button`
  display: grid;
  grid-template-columns: ${(p) => (p.$noNote ? PROJ_COLS_NO_NOTE : PROJ_COLS)};
  /* 과제명이 길면 줄바꿈되어 줄 높이가 달라진다 — 가운데 정렬이면 알약들이
     들쭉날쭉해 보이므로 위로 맞춘다. */
  align-items: start;
  gap: 0.6rem;
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 0.5rem ${PANEL_X};
  cursor: pointer;
  font-size: 0.83rem;
  color: #1f2937;
  &:hover { background: #f3f4f6; }
`;

/** 1열 안쪽 — 과제코드 알약 + (지원 배지) + 과제명. 배지 유무가 열을 흔들지 않게 묶는다. */
const RowProj = styled.span`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.4rem;
  min-width: 0;
`;

/* 과제명. **자르지 않는다** — 이 패널은 훑는 곳이 아니라 읽는 곳이라,
   말줄임으로 잘리면 어느 과제인지 알 수 없다(2026-08-06). 대신 줄바꿈한다. */
const ProjTitle = styled.span`
  /* RowProj(flex) 안에서 알약 뒤의 남는 폭을 가져간다.
     basis 를 0 으로 둬서 알약과 같은 줄에 붙되, 좁아지면 줄바꿈된다.
     (주석에 백틱 금지 — 템플릿 리터럴이 거기서 끊긴다) */
  flex: 1 1 0;
  min-width: 0;
  word-break: break-word;
  line-height: 1.4;
`;

/**
 * 과제 목록의 머리행.
 *
 * 왜 필요한가 — 기여 방법이 과제명 옆에 **라벨 없이** 붙어 있으면 그게 뭔지 알 수 없다.
 * 줄마다 라벨을 달면 15줄에 15번 반복되므로, 위에 **한 번만** 적는다.
 * 줄(ProjRow)과 같은 padding·gap 을 써야 열이 눈으로 맞는다 — 값이 갈리면 어긋난다.
 */
const ProjListHead = styled.div`
  display: grid;
  grid-template-columns: ${PROJ_COLS};   /* 줄과 **같은 정의** — 이래야 구분선이 맞는다 */
  align-items: center;
  gap: 0.6rem;
  padding: 0.35rem ${PANEL_X};
  font-size: 0.72rem;
  font-weight: 700;
  color: #94a3b8;
  border-bottom: 1px solid #e5e7eb;
  background: #fafafa;
`;

/** 머리행의 '기여 방법' 칸 — 줄의 NoteCell 과 같은 구분선·여백을 써야 선이 이어진다 */
const HeadNote = styled.span`
  min-width: 0;
  border-left: 1px solid #e5e7eb;
  padding-left: 0.6rem;
  align-self: stretch;
  display: flex;
  align-items: center;
`;

const StatusPill = styled.span`
  font-size: 0.68rem;
  font-weight: 700;
  border-radius: 0.3rem;
  padding: 0.1rem 0.4rem;
  background: ${(p) => p.$bg || '#f3f4f6'};
  color: ${(p) => p.$fg || '#4b5563'};
  white-space: nowrap;
`;

/**
 * 칸에 찍는 '읽을 기여 내용이 있다' 표시. **눌러서 상세를 연다.**
 *
 * 버튼인 이유 — 행을 펼치면(`open`) 칸 자체의 클릭이 막히고 안의 과제 칩이
 * 과제 편집창을 연다. 그 상태에서는 기여 내용을 볼 경로가 아예 없었다.
 * 이 배지는 메모가 있는 칸에만 나오므로, 읽을 게 있을 때만 그 경로가 생긴다.
 */
const NoteMark = styled.button`
  display: inline-flex;
  align-items: center;
  /* 머리글 '내용' 과 같은 자리 — 가운데 세 칸의 마지막 (2026-08-06) */
  grid-column: 4;
  justify-self: center;
  gap: 1px;
  padding: 0 3px;
  border: 0;
  border-radius: 3px;
  background: #e0e7ff;
  color: #4338ca;
  font-size: 0.58rem;
  font-weight: 700;
  vertical-align: middle;
  cursor: pointer;
  &:hover { background: #c7d2fe; }
`;

/* 드릴 패널의 기여 방법 열. 과제명 **오른쪽에 나란히** 둔다 —
   아래에 쌓으면 과제가 10몇 개인 칸에서 줄 수가 두 배가 된다.
   가로로 두면 줄 수가 과제 수 그대로다. 길면 2줄까지만(전문은 title 툴팁). */
const NoteCell = styled.span`
  flex: 1.2;
  min-width: 0;
  /* 왼쪽 구분선 — 머리행과 함께 '여기부터 다른 열' 임을 말한다.
     라벨을 줄마다 반복하지 않고도 영역이 갈린다. */
  border-left: 1px solid #e5e7eb;
  padding-left: 0.6rem;
  align-self: stretch;
  font-size: 0.74rem;
  line-height: 1.35;
  color: ${(p) => (p.$empty ? '#cbd5e1' : '#475569')};
  font-style: ${(p) => (p.$empty ? 'italic' : 'normal')};
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
`;

const Pill = styled.span`
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 0.3rem;
  background: ${(p) => p.$bg || '#f3f4f6'};
  color: ${(p) => p.$fg || '#4b5563'};
  white-space: nowrap;
`;

/** 같은 데이터를 사업부 축 / 기능조직 축으로 돌려 본다. */
/* PivotToggle·PivotBtn 은 걷어냈다 — 기능조직 관점 뷰를 없애면서
   전환할 대상이 사라졌다. 기능조직은 요약 패널과 지원 행으로만 본다. */


/* SupportMark 는 걷어냈다 (2026-08-06) — 자체 수 뒤에 `+N` 을 덧붙이던 조각인데,
   지원이 독립된 열(CellSupport)이 되면서 덧붙일 곳이 없어졌다. */

/* 기능조직 지원 — **미연결 과제(주황)와 색을 갈라 놓는다.**
   바닥 요약에서 위아래로 붙어 있어 같은 색이면 두 줄이 한 덩어리로 보인다.
   성격도 반대다: 미연결은 채워야 할 구멍, 지원은 이미 들어온 도움. */
const SupportCell = styled.td`
  text-align: left;
  padding: 0.5rem 0.55rem;
  font-size: ${NUM_FONT};
  background: #f8fafc;
  color: ${(p) => (p.$n > 0 ? '#4f46e5' : '#9ca3af')};
  font-weight: 700;
  cursor: ${(p) => (p.$n > 0 ? 'pointer' : 'default')};
  border-bottom: 1px solid #f3f4f6;
  &:hover { outline: ${(p) => (p.$n > 0 ? '2px solid #4338ca' : 'none')}; outline-offset: -2px; }
`;

// ── 기능조직 요약 블록 ────────────────────────────────────────────────────
const FuncBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.9rem 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.6rem;
  background: #fafafa;
`;

const FuncTitle = styled.div`
  font-size: 0.88rem;
  font-weight: 700;
  color: #374151;
  span { font-weight: 400; font-size: 0.78rem; color: #6b7280; }
`;

/* 사이드 패널에 들어가 폭이 좁으므로 최소 폭을 낮춘다 — 200px 이면 한 줄에 하나만
   들어가 세로로 길어진다. 카드 내용(이름·n/m·미연결)은 140px 로 충분하다. */
const FuncGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.5rem;
`;

const FuncCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.6rem 0.75rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
`;

const FuncName = styled.div`
  font-size: 0.85rem;
  font-weight: 700;
  color: #111827;
`;

const FuncStat = styled.div`
  font-size: 0.78rem;
  color: #4b5563;
  b { color: #1d4ed8; font-size: 0.95rem; }
`;

const FuncUnlinked = styled.button`
  align-self: flex-start;
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 0.76rem;
  font-weight: 600;
  color: ${(p) => (p.$n > 0 ? '#c2410c' : '#9ca3af')};
  cursor: ${(p) => (p.$n > 0 ? 'pointer' : 'default')};
  &:hover { text-decoration: ${(p) => (p.$n > 0 ? 'underline' : 'none')}; }
`;

const STATUS_COLOR = {
  '완료': { bg: '#dbeafe', fg: '#1d4ed8' },
  '정상진행': { bg: '#fef9c3', fg: '#a16207' },
  '지연': { bg: '#fee2e2', fg: '#b91c1c' },
  '위험': { bg: '#fee2e2', fg: '#b91c1c' },
  '미착수': { bg: '#f3f4f6', fg: '#6b7280' },
};

/**
 * 과제 수 → 배경색. 최대값 기준 5단계. 0은 흰색(구멍이 눈에 띄어야 한다).
 *
 * ⚠️ 눈금의 바닥을 SCALE_FLOOR 로 고정한다.
 *    관측 최대값만으로 정규화하면, 태깅 초기처럼 최대가 1건일 때 **1건짜리 칸이
 *    가장 진한 색**으로 칠해진다. 화면은 "여기 힘이 몰려 있다" 고 말하지만
 *    실제로는 과제 하나다. 데이터가 쌓이기 전에 가장 크게 오해를 부르는 지점이라
 *    최소 눈금을 둔다. (실측 2026-08-01: 연결 6쌍 · 최대 1건)
 */
const PeriodSelect = styled.select`
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 0.45rem;
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
  color: #374151;
  cursor: pointer;
  &:hover { border-color: #9ca3af; }
`;

/**
 * 표 + 요약 패널을 나란히 (2026-08-01).
 *
 * 왜 옆으로 옮겼나
 *     표 폭이 1154px 로 못박혀 있어(열 폭 주석 참조) 넓은 화면에서 오른쪽에
 *     700px 가 놀았다. 요약은 원래 표 **위**에 전체 폭으로 깔려 있었는데,
 *     세로로는 짧아 그 자리도 어중간했고 표를 아래로 밀어내기만 했다.
 *     옆에 두면 노는 폭이 채워지고 **결론이 근거 바로 옆에** 붙는다.
 *
 * 폭이 모자라면 **표가 줄며 가로 스크롤**된다(TableScroll 참조). 아주 좁아지면
 * 그때 패널이 아래로 떨어진다 — wrap 이라 미디어쿼리가 필요 없다.
 */
/* ── 보기 전환 · 사업부 탭 (2026-08-07) ───────────────────────────────────────
   드롭다운 하나에 '매트릭스'와 사업부 8개를 섞어 넣었더니, **성격이 다른 두 선택**
   (어떤 보기냐 / 어느 사업부냐)이 한 줄에 눌려 있어 지금 무엇을 보고 있는지가
   안 읽혔다. 보기는 토글로, 사업부는 탭으로 가른다.
   탭 모양은 '전체 요약'의 사업부 필터(TrendFilterBar)와 **같은 것**을 쓴다 —
   같은 일을 하는 UI가 화면마다 다르면 그때마다 다시 배워야 한다. */
const ViewToggle = styled.div`
  display: inline-flex;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  overflow: hidden;
  background: #fff;
`;

const ToggleBtn = styled.button`
  padding: 0.35rem 0.8rem;
  border: 0;
  background: ${(p) => (p.$on ? '#6366f1' : '#fff')};
  color: ${(p) => (p.$on ? '#fff' : '#64748b')};
  font-size: 0.78rem;
  font-weight: ${(p) => (p.$on ? 700 : 500)};
  cursor: pointer;
  white-space: nowrap;
  & + & { border-left: 1px solid #e2e8f0; }
  &:hover { background: ${(p) => (p.$on ? '#4f46e5' : '#f8fafc')}; }
`;

const DivTabBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 0.25rem;
`;

const DivTab = styled.button`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.9rem;
  border-radius: 0.5rem;
  border: 1px solid ${(p) => (p.$on ? '#6366f1' : '#e2e8f0')};
  background: ${(p) => (p.$on ? '#6366f1' : '#fff')};
  color: ${(p) => (p.$on ? '#fff' : '#64748b')};
  font-size: 0.8rem;
  font-weight: ${(p) => (p.$on ? 700 : 500)};
  cursor: pointer;
  transition: all 0.15s ease;
  &:hover {
    background: ${(p) => (p.$on ? '#4f46e5' : '#f8fafc')};
    border-color: ${(p) => (p.$on ? '#4f46e5' : '#cbd5e1')};
  }
`;

const DivTabBadge = styled.span`
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: ${(p) => (p.$on ? 'rgba(255,255,255,0.25)' : '#f1f5f9')};
  color: ${(p) => (p.$on ? '#fff' : '#475569')};
`;

const Split = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 1rem;
`;

const PanelTitle = styled.div`
  font-size: 0.82rem;
  font-weight: 700;
  color: #374151;
  letter-spacing: 0.01em;
`;

const SidePanel = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  /*
    폭 320px 고정 — 늘지도 줄지도 않는다. 남는 폭을 먹으면 초광폭에서 패널만
    헐거워지고, 줄어들면 4분면 문구가 접혀 읽기 나빠진다.
    화면이 아주 좁아지면(표가 520px 아래로 밀릴 때) wrap 으로 아래에 떨어진다.
  */
  flex: 0 0 320px;
`;

/**
 * 사업부별 보기 본문 — **흐름도 하나가 전체 폭**을 쓴다 (2026-08-07).
 *
 * 원래는 좌측 KPI별 과제표와 절반씩 나눠 갖는 우측 패널(sticky 320→440px)이었다.
 * 표를 걷어내면서 sticky 도 고정폭도 뜻을 잃었다 — 옆에 같이 스크롤할 것이 없고,
 * 폭을 줄일 이유도 없다. 흐름도의 좌표계(VIEW_W)도 그만큼 넓혀 뒀다.
 */
const FullFlow = styled.div`
  width: 100%;
  min-width: 0;
  /* 사슬의 마지막 칸 — 남은 높이를 받아 그대로 흐름도에 넘긴다 */
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;


/**
 * 4분면 요약 — (달성 여부) × (기여 과제 유무).
 *
 * 표는 칸이 75개라 한눈에 안 들어온다. 이 넉 줄이 표에서 뽑아낸 **결론**이고,
 * 보고 자리에서 실제로 쓰이는 것도 이쪽이다. 각 칸을 눌러 해당 목록으로 들어간다.
 *
 * 2열 격자다 — 세로 한 줄로 세우면 표 높이를 못 따라가고, 4분면은 원래
 * (달성 여부) × (과제 유무) 의 2×2 라 격자가 뜻과도 맞는다.
 */
const QuadGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
`;

const QuadCard = styled.button`
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid ${(p) => p.$border};
  background: ${(p) => p.$bg};
  border-radius: 0.5rem;
  cursor: ${(p) => (p.$n ? 'pointer' : 'default')};
  opacity: ${(p) => (p.$n ? 1 : 0.6)};
  &:hover { border-color: ${(p) => (p.$n ? '#111827' : p.$border)}; }
`;

const QuadCount = styled.div`
  font-size: 1.35rem;
  font-weight: 800;
  color: ${(p) => p.$color};
  line-height: 1.1;
`;

const QuadLabel = styled.div`
  font-size: 0.82rem;
  font-weight: 700;
  color: #111827;
`;

const QuadHint = styled.div`
  font-size: 0.72rem;
  color: #6b7280;
  line-height: 1.4;
`;

const CellDetail = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 0 ${PANEL_X} 0.9rem;
  margin-bottom: 0.6rem;
  border-bottom: 1px solid #e5e7eb;
`;

const DetailStats = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
`;

const DetailStat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  b { font-size: 1.05rem; font-weight: 800; color: #111827; }
  span { font-size: 0.7rem; color: #6b7280; }
`;

const DetailCaption = styled.div`
  font-size: 0.72rem;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 0.25rem;
  span { font-weight: 400; color: #9ca3af; }
`;

const Notice = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  font-size: 0.76rem;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 0.45rem;
  padding: 0.45rem 0.6rem;
`;

/* 밀도 색(densityBg/densityFg)·SCALE_FLOOR 는 걷어냈다 —
   기능조직 관점 표에서만 쓰던 것이고, 그 표가 없어졌다.
   사업부 관점 칸의 색은 달성 상태가 정한다(STATUS_STYLE). */


/**
 * @param reloadSignal 값이 바뀌면 서버에서 다시 받는다.
 *
 *   이 화면은 자기 데이터를 서버에서 직접 받는다(로컬 과제 상태와 섞지 않는다 —
 *   셀 숫자가 보고에 쓰이므로 어긋나면 안 된다). 그 대가로, 여기서 과제를 열어
 *   KPI 연결을 고치고 저장해도 **표는 그대로였다.** 저장을 알려줄 경로가 없었다.
 *   부모가 저장 때마다 이 값을 올려 주면 그 구멍이 막힌다.
 *
 *   그래도 새로고침 버튼은 남긴다 — **남이 바꾼 것**은 이 신호로 안 온다.
 */
const KpiMatrixView = ({ currentYear, onYearChange, onOpenProject, reloadSignal, settingsData }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [drill, setDrill] = useState(null);        // {title, subtitle, projects[]}
  // 펼친 KPI 행 — 숫자 대신 실제 과제를 칸 안에 늘어놓는다.
  const [expanded, setExpanded] = useState(() => new Set());
  const [allOpen, setAllOpen] = useState(false);
  /**
   * 사업부 하나만 세로로 보는 모드 (2026-08-06). '' 이면 매트릭스.
   *
   * 왜 필요한가
   *   매트릭스는 **비교**하는 도구다(가로축이 사업부). 그런데 기여 내용을 읽는 일은
   *   비교가 아니라 한 칸을 정독하는 일이고, 사업부가 늘수록 가로 스크롤과 부딪힌다.
   *   열을 하나로 고정하면 가로 스크롤이 사라지고 2열(과제 · 기여 방법)이 온전히 펴진다.
   *   매트릭스를 대체하지 않는다 — 나란히 두는 보기 모드다.
   */
  const [divView, setDivView] = useState('');
  /**
   * 사업부별 보기에서 **마지막으로 보던 사업부**. (2026-08-07)
   * 매트릭스로 갔다가 돌아올 때 처음(MX)으로 되돌아가면, 한 사업부를 들여다보다
   * 잠깐 전체를 확인하는 흐름에서 매번 다시 찾아 눌러야 한다.
   */
  const [lastDiv, setLastDiv] = useState('');

  // ── 지표 선택 (관리자 전용) ────────────────────────────────────────────────
  // 감출 지표를 **id 로** 들고 있는다. 전체 요약은 label 로 하는데(kpi_records 가
  // 이름으로 물려 있어서), 여기는 id 가 있으므로 이름이 바뀌어도 안 끊긴다.
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.is_admin;
  /* 일괄 편집은 **사무국도** 할 수 있다 — 서버(`/kpi-links/bulk`)와 같은 조건이다.
     화면이 더 좁게 잡으면 "권한은 있는데 단추가 없는" 사람이 생긴다. */
  const canBulk = isAdmin || user?.role === 'dt_office';
  /*
    일괄 편집 진입 — {projects, contextLabel, preselectKpiIds}.

    ★ 드릴 패널에 단다. 매트릭스 칸·4분면·미연결 행·사업부 요약이 **전부**
      `setDrill({... projects})` 하나로 모이므로, 여기 단추 하나면 네 진입점이
      한꺼번에 생긴다. 게다가 고를 과제 목록이 이미 그 패널에 떠 있다.
  */
  const [bulk, setBulk] = useState(null);
  const [excludedKpiIds, setExcludedKpiIds] = useState(() => new Set());
  const [selOpen, setSelOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchSystemSettings()
      .then((st) => {
        if (!alive) return;
        const ids = st?.kpiMatrixSettings?.excludedKpiIds;
        if (Array.isArray(ids)) setExcludedKpiIds(new Set(ids.map(Number)));
      })
      .catch(() => { /* 설정을 못 읽어도 표는 그려야 한다 — 전체 표시로 둔다 */ });
    return () => { alive = false; };
  }, []);

  const toggleKpiVisible = (kid) => {
    if (!isAdmin) return;
    setExcludedKpiIds((prev) => {
      const next = new Set(prev);
      if (next.has(kid)) next.delete(kid); else next.add(kid);
      saveSystemSettings({ kpiMatrixSettings: { excludedKpiIds: [...next] } })
        .catch((e) => console.warn('지표 표시 설정 저장 실패:', e.message));
      return next;
    });
  };

  const setAllKpiVisible = (ids) => {
    if (!isAdmin) return;
    const next = new Set(ids);
    setExcludedKpiIds(next);
    saveSystemSettings({ kpiMatrixSettings: { excludedKpiIds: [...next] } })
      .catch((e) => console.warn('지표 표시 설정 저장 실패:', e.message));
  };
  // '' = 연간(연 목표 대비 최신 실적). 그 외는 분기.
  const [period, setPeriod] = useState('');

  const load = () => {
    setLoading(true);
    setError(null);
    fetchKpiMatrixV2(currentYear, period || null)
      .then(setData)
      .catch((e) => setError(e.message || '불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [currentYear, period, reloadSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  const model = useMemo(() => {
    if (!data) return null;
    const { divisions, kpis, links } = data;

    /*
      취소 과제는 이 화면에 **아예 없다** (2026-08-07 요청).

      서버는 삭제만 걸러서 준다(`kpi_matrix`) — 평평하게 주고 화면이 축을 정하는
      구조라 그게 맞다. 그런데 취소는 '보기 필터' 가 아니라 **셈에서 빠져야 하는
      것**이다. 다른 화면들도 전부 기본에서 뺀다(AllProjectsView·DepartmentStatus·
      DashboardView 의 상태 필터 기본값, ProjectSummary 의 집계).

      ⚠️ `projects` 를 여기서 한 번 거르면 세 가지가 같이 맞는다 —
         ① 칸의 과제 목록: `projById` 에 없으면 아래 links 순회에서 걸러진다
         ② 사업부 요약의 연결률 분모
         ③ 머리말의 '과제 N건 · 미연결 M건'
         한 곳만 고치면 화면 안에서 숫자가 갈린다.
    */
    const projects = (data.projects || []).filter((p) => p.status !== '취소');
    // 서버가 (지표 × KPI보유 사업부) 전 조합을 준다. 없으면 옛 응답이므로
    // 빈 맵으로 두고 상태 없이 그린다 — 화면이 깨지지는 않게.
    const metricOf = new Map(
      (data.metrics || []).map((m) => [`${m.kpiDefinitionId}|${m.division}`, m]));

    const projById = new Map(projects.map((p) => [p.uuid, p]));
    const owners = divisions.filter((d) => d.isKpiOwner);
    const funcs = divisions.filter((d) => !d.isKpiOwner);
    const funcNames = new Set(funcs.map((d) => d.name));

    // 셀 = (지표, **대상 사업부**) → 과제. 과제의 소속이 아니다 —
    // 기능조직 과제는 소속과 대상이 다르고, 기여는 대상 칸에 잡혀야 한다.
    const cells = new Map();
    const taggedProjects = new Set();
    const targetsOf = new Map();   // 과제 → 지원 대상 목록 (드릴다운 표시용)

    // note 는 **(과제, 지표, 대상) 줄마다** 다를 수 있다 — 같은 과제가 MX 와 VD 를
    // 지원해도 기여 방식이 다를 수 있어서다. 그래서 과제 객체를 그대로 쓰지 않고
    // **칸마다 사본**을 만들어 그 칸의 note 를 얹는다.
    links.forEach(([puid, kid, target, note, rel]) => {
      const p = projById.get(puid);
      if (!p || !target) return;
      taggedProjects.add(puid);
      if (!targetsOf.has(puid)) targetsOf.set(puid, new Set());
      targetsOf.get(puid).add(target);

      const key = `${kid}|${target}`;
      if (!cells.has(key)) cells.set(key, new Map());
      // ⚠️ `rel`(기여 등급)은 note 와 마찬가지로 **줄마다** 다르다. 그래서 과제가
      //    아니라 **칸 사본**에 얹는다 — 같은 과제라도 KPI 마다 등급이 다를 수 있다.
      //    (기여 지도가 등급을 점 색으로 못 쓰는 이유가 이것이다. 점은 하나인데
      //     등급은 걸린 KPI 수만큼 있다.)
      cells.get(key).set(puid, { ...p, note: note || '', rel: rel || null });   // Map 이라 같은 과제가 두 번 안 들어간다

    });

    // 4분면 — 이 화면의 결론. (달성 여부) × (기여 과제 유무)
    // 판정이 되는 칸(ok·near·miss)만 넣는다. 목표나 실적이 없으면 잘 가는지 자체를
    // 말할 수 없으므로 억지로 분류하지 않고 따로 센다.
    const quad = { missNone: [], missSome: [], okNone: [], okSome: [], unknown: 0 };

    // 관리자가 감춘 지표는 표에서 뺀다. **연결 데이터는 그대로 둔다** —
    // 감추는 것은 보기의 문제이지 연결을 지우는 것이 아니다.
    const rows = kpis.filter((k) => !excludedKpiIds.has(k.kpiDefinitionId)).map((k) => {
      const perDiv = owners.map((d) => {
        const list = [...(cells.get(`${k.kpiDefinitionId}|${d.name}`) || new Map()).values()];
        const metric = metricOf.get(`${k.kpiDefinitionId}|${d.name}`) || null;
        // '해당 없음' 판정은 **서버가 준다.** 화면이 사업부 코드 표를 들면 갈리고,
        // 그러면 실적이 엉뚱한 열에 붙는다 (파일 머리말 참조).
        const na = metric ? metric.applicable === false : false;
        const cell = {
          division: d.name,
          na,
          metric,
          own: list.filter((p) => !funcNames.has(p.division)),
          support: list.filter((p) => funcNames.has(p.division)),
          projects: list,
          // 이 칸에 읽을 기여 내용이 몇 건 있나 — 칸에 표시를 찍는 근거다.
          // 표시가 없으면 어느 칸을 눌러야 할지 알 수 없다(대부분 비어 있다).
          noteCount: list.filter((p) => (p.note || '').trim()).length,
        };
        // 플랫폼 구축은 달성 여부라는 게 없다 — 4분면에도, '판정 불가' 집계에도
        // 넣지 않는다. 넣으면 "목표를 세우라" 는 안건에 섞인다.
        if (!na && metric && metric.status !== 'platform') {
          const st = metric.status;
          if (st === 'ok' || st === 'near' || st === 'miss') {
            const bucket = st === 'ok'
              ? (list.length ? 'okSome' : 'okNone')
              : (list.length ? 'missSome' : 'missNone');
            quad[bucket].push({ kpi: k, division: d.name, metric, projects: list });
          } else {
            quad.unknown += 1;
          }
        }
        return cell;
      });
      // ⚠️ '계' 는 가로합이 아니라 **서로 다른 과제 수**다.
      //    한 과제가 MX·VD 를 동시에 지원하면 두 칸에 나타나 가로합은 겹친다.
      const distinct = new Set();
      perDiv.forEach((c) => c.projects.forEach((p) => distinct.add(p.uuid)));
      return { kpi: k, perDiv, total: distinct.size };
    });


    const group = (list) => {
      const byCat = new Map();
      list.forEach((r) => {
        const c = r.kpi.category || '기타';
        if (!byCat.has(c)) byCat.set(c, []);
        byCat.get(c).push(r);
      });
      return [...byCat.entries()].sort((a, b) => {
        const ia = CATEGORY_ORDER.indexOf(a[0]);
        const ib = CATEGORY_ORDER.indexOf(b[0]);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    };

    /**
     * 전사 공통 / 사업부 전용으로 먼저 가른다 (2026-08-01 요청).
     *
     * 왜 이 구분이 카테고리보다 위인가
     *     둘은 **읽는 법이 다르다.** 공통 지표는 사업부끼리 가로로 비교하는 것이
     *     뜻이 있지만, 전용 지표는 나머지 열이 구조적으로 비어 있어(빗금) 가로
     *     비교 자체가 성립하지 않는다. 섞어 놓으면 빗금 행이 중간중간 끼어들어
     *     "왜 여긴 비었지" 를 매번 다시 판단하게 된다.
     *
     * 카테고리(개발/제조/품질) 구분은 각 구획 **안에서** 그대로 유지한다.
     */
    const isMetric = (k) => (k.kind || 'metric') === 'metric';

    /**
     * 사업부 전용 지표를 **한 줄에 여러 개** 눕힌다.
     *
     * 왜
     *     전용 지표는 담당 사업부가 서로 겹치지 않아 표가 블록 대각선이 된다.
     *     지표마다 한 줄을 주면 6줄 × 5열 중 22칸이 빗금이다 — 높이만 먹고
     *     읽을 것은 없다. 겹치지 않으니 **같은 줄에 놓아도 충돌하지 않는다.**
     *     (실측 2026-08-01: 6줄 → 2줄, 빗금 22 → 4)
     *
     * 어떻게
     *     지표를 순서대로 보며 **자기 사업부들이 모두 비어 있는 첫 줄**에 넣는다.
     *     한 지표가 두 사업부를 걸치면(SPDM 구축률 = NW·의료기기) 그 둘이 같은
     *     줄에 나란히 서야 한 지표로 읽히므로, 둘 다 빈 줄을 찾는다.
     *
     * 결과 한 줄은 더 이상 '한 지표' 가 아니다 — 그래서 행 머리에 지표명을 쓸 수
     * 없고, 지표명은 칸 안으로 들어간다(렌더 쪽 참조).
     */
    const packRows = (rowsIn) => {
      const packed = [];      // [{ byDivision: Map(사업부 -> row) }]
      rowsIn.forEach((r) => {
        // 이 지표가 실제로 서는 열 = '해당 없음' 이 아닌 칸.
        // perDiv 가 없는 행(기능조직 관점)은 압축 대상이 아니다 — 조용히 건너뛴다.
        const mine = (r.perDiv || []).filter((c) => !c.na).map((c) => c.division);
        if (!mine.length) return;
        let slot = packed.find((p) => mine.every((d) => !p.byDivision.has(d)));
        if (!slot) {
          slot = { byDivision: new Map() };
          packed.push(slot);
        }
        mine.forEach((d) => slot.byDivision.set(d, r));
      });

      return packed.map((p, i) => {
        // 이 줄에 걸린 서로 다른 과제 수 (일반 행의 '계' 와 같은 규칙 — 가로합 아님)
        const distinct = new Set();
        const cells = owners.map((d) => {
          const src = p.byDivision.get(d.name);
          if (!src) return { division: d.name, empty: true };
          const cell = src.perDiv.find((c) => c.division === d.name);
          cell.projects.forEach((x) => distinct.add(x.uuid));
          return { ...cell, kpi: src.kpi };
        });
        return { index: i + 1, cells, total: distinct.size };
      });
    };
    /**
     * `canPack` — 압축은 **사업부 관점 표에서만** 뜻이 있다.
     *
     * 압축의 전제는 "지표마다 담당 열이 달라 서로 겹치지 않는다" 인데, 그건 열이
     * 사업부일 때 얘기다. 기능조직 관점은 열이 GTR·SR·CS 이고 모든 지표가 모든
     * 열에 해당하므로 겹치지 않는 조합이 없다 — 압축해도 줄지 않는다.
     * 게다가 그쪽 행은 `perDiv` 가 아니라 `perOrg` 를 들고 있어 그냥 터진다.
     * (2026-08-01 실제로 터뜨렸다: perDiv 가 undefined)
     */
    const sectioned = (list, canPack = false) => ([
      {
        key: 'common',
        title: '전사 공통 KPI',
        hint: '모든 사업부가 같은 지표로 측정 — 가로로 비교할 수 있습니다',
        rows: list.filter((r) => isMetric(r.kpi) && !(r.kpi.divisions || []).length),
      },
      {
        key: 'division',
        title: '사업부 전용 KPI',
        hint: '지표마다 담당 사업부가 달라 한 줄에 나란히 놓습니다',
        rows: list.filter((r) => isMetric(r.kpi) && (r.kpi.divisions || []).length > 0),
        packed: true,
      },
      {
        // 지표가 아니라 **만드는 것**. 목표·실적이 없으니 달성률 칸도 없다 —
        // 여기서 볼 것은 과제 수뿐이고, 그게 이 구획의 존재 이유다.
        key: 'platform',
        // 분류(kpi_definitions.category)와 **같은 글자**여야 아래 skipCat 이
        // 중복 소제목 줄을 건너뛴다. 항목 이름은 '플랫폼 구축' 으로 따로 있다.
        title: '플랫폼',
        hint: '지표를 올리는 대신 시스템을 만드는 과제 — 측정하지 않습니다',
        rows: list.filter((r) => !isMetric(r.kpi)),
      },
    ].filter((s) => s.rows.length)
      .map((s) => {
        const blocks = group(s.rows);
        return {
          ...s,
          count: s.rows.length,
          blocks,
          /**
           * 분류 소제목 줄을 **건너뛸지** (2026-08-06).
           *
           * 구획 이름과 분류가 같은 한 덩어리뿐이면, 소제목은 바로 왼쪽 구분 칸이
           * 방금 한 말을 한 번 더 한다 — '플랫폼 구축' 이 그렇다.
           *
           * 이 겹침 때문에 2026-08-01 에는 **데이터를** 바꿨다(플랫폼 구축을
           * 개발·제조·품질로 쪼개 분류를 채웠다). 쪼갤 실익이 없다는 게 드러나
           * 다시 합치면서(b83c0e5a4f12), 이번엔 화면에서 푼다.
           * 보이는 문제를 데이터 모양으로 우회하면 그 데이터를 쓰는 다른 화면이
           * 같이 휘어진다.
           */
          skipCat: blocks.length === 1 && blocks[0][0] === s.title,
          packedRows: (s.packed && canPack) ? packRows(s.rows) : null,
        };
      }));

    // 사업부 요약 — 수행 과제 연결률 + 그 사업부를 지원하는 기능조직 과제
    const ownerSummary = owners.map((d) => {
      const all = projects.filter((p) => p.division === d.name);
      const linked = all.filter((p) => taggedProjects.has(p.uuid));
      const support = projects.filter((p) => funcNames.has(p.division)
        && (targetsOf.get(p.uuid) || new Set()).has(d.name));
      // ★ 기능조직별로 쪼갠다 — 합계만 보면 "어느 조직이 기여하고 있나" 를 알 수 없다.
      //   GTR·SR·CS 는 하는 일이 달라서 합쳐 세면 정작 필요한 정보가 사라진다.
      const byOrg = new Map(funcs.map((f) => [f.name, []]));
      support.forEach((p) => byOrg.get(p.division)?.push(p));
      return {
        division: d.name,
        total: all.length,
        linked: linked.length,
        unlinked: all.filter((p) => !taggedProjects.has(p.uuid)),
        support,
        byOrg,
      };
    });

    const funcSummary = funcs.map((d) => {
      const all = projects.filter((p) => p.division === d.name);
      const linked = all.filter((p) => taggedProjects.has(p.uuid));
      return {
        division: d.name,
        total: all.length,
        linked: linked.length,
        unlinked: all.filter((p) => !taggedProjects.has(p.uuid)),
      };
    });

    return {
      owners, funcs, quad,
      unmatched: data.unmatched || [],
      // 압축은 사업부 관점에만 (위 sectioned 주석 참조)
      catSections: sectioned(rows, true),
      // 전체 펼치기가 참조한다 — 구획을 도는 대신 평평한 목록 하나면 된다.
      allRows: rows,
      ownerSummary, funcSummary, targetsOf,
      projectCount: projects.length,
      emptyKpis: rows.filter((r) => r.total === 0).length,
      untaggedCount: projects.length - taggedProjects.size,
    };
  }, [data, excludedKpiIds]);

  const openList = (title, subtitle, projects) => {
    if (!projects.length) return;
    setDrill({ title, subtitle, projects });
  };

  /**
   * 칸 하나의 상세. 과제가 0건이어도 연다 —
   * 실적·목표·추이는 여전히 있고, 오히려 **0건인 칸이 이 표의 안건**이다.
   */
  const openCell = (kpi, c) => {
    if (c.na) return;
    setDrill({
      title: `${c.division} 의 ${kpi.label}`,
      subtitle: statusStyle(c.metric?.status).label,
      projects: c.projects,
      detail: { kpi, division: c.division, metric: c.metric, own: c.own, support: c.support },
    });
  };

  const isOpen = (kid) => allOpen || expanded.has(kid);

  /**
   * **아무 줄도 안 펼쳐진 상태인가** (2026-08-06).
   *
   * 표 전체가 걸리는 두 가지를 이 하나로 잠근다 —
   *   · '계(과제)' 열 (colgroup·머리글·본문·요약 전부)
   *   · 머리글 소제목 '자체 / 지원 / 내용'
   *
   * 둘 다 **접힌 칸의 숫자를 설명하는 틀**이다. 펼치면 그 숫자가 사라지고 과제가
   * 이름째 나열되므로, 설명할 대상이 없는 라벨과 되풀이되는 합계만 남는다.
   * 처음엔 펼친 줄의 숫자만 비웠는데, 그러면 빈 열이 74px 을 그대로 붙들고 있어
   * 정작 과제 이름 쓸 자리가 모자랐다. 그래서 자리째 뺀다.
   *
   * ⚠️ **표 전체가 걸린다.** 머리글도 열도 줄마다 따로 가질 수 없어서, 한 줄만
   *    펼쳐도 아직 접혀 있는 줄들의 소제목·합계까지 같이 사라진다. 그리고 열이
   *    드나들 때마다 표가 좌우로 한 번 움직인다. 자리 흔들림보다 폭을 택했다.
   *    한 줄 펼치기에서는 유지하고 싶으면 조건을 `!allOpen` 으로 좁히면 된다.
   *
   * `expanded` 에는 과제가 있는 줄만 들어온다(toggleRow 가 걸러낸다).
   */
  const allCollapsed = !(allOpen || expanded.size > 0);

  const toggleRow = (kid, hasAny) => {
    if (!hasAny) return;           // 빈 행은 펼쳐도 보여줄 게 없다
    setAllOpen(false);             // 개별 조작을 시작하면 전체 펼치기는 해제한다
    setExpanded((prev) => {
      const next = new Set(allOpen ? [] : prev);
      if (allOpen) {
        // 전체 펼침 상태에서 하나를 접으면, 나머지는 펼친 채로 남아야 한다
        model.allRows.forEach((r) => next.add(r.kpi.kpiDefinitionId));
      }
      if (next.has(kid)) next.delete(kid); else next.add(kid);
      return next;
    });
  };

  /**
   * 사업부 관점 칸 하나. 일반 행과 **압축 행이 같은 함수를 쓴다** —
   * 둘이 따로 있으면 칸 모양이 조용히 갈린다.
   *
   * `showLabel` 이 켜지면 칸 위에 지표명을 얹는다. 압축 행에서는 한 줄이 더 이상
   * 한 지표가 아니라 행 머리에 이름을 쓸 수 없기 때문이다.
   */
  const renderCell = (kpi, c, { open = false, showLabel = false, funcNameSet }) => {
    const n = c.projects.length;
    const delayed = c.projects.filter((p) => DELAYED.has(p.status)).length;
    const byOrg = {};
    c.support.forEach((p) => { byOrg[p.division] = (byOrg[p.division] || 0) + 1; });
    const orgTxt = Object.entries(byOrg).map(([o, v]) => `${o} ${v}`).join(' · ');
    const m = c.metric;
    const ss = statusStyle(c.na ? 'n_a' : (m ? m.status : 'no_target'));
    // 이 표가 찾는 칸 — 미달인데 기여 과제가 없다. 색만으로는 약해서
    // 테두리로 한 번 더 세운다. (근접도 아직 못 미친 것이라 포함)
    const alarm = !c.na && n === 0 && (m?.status === 'miss' || m?.status === 'near');
    const Inner = open ? CellTop : CellInner;
    // num: 맨숫자 (칸에는 안 쓰고 아래 fmt 가 툴팁에서 쓴다)
    // fmt: 툴팁·상세용 — 거기선 단위가 있어야 뜻이 선다
    const num = (v) => (v == null ? '—' : `${(+v).toFixed(1).replace(/\.0$/, '')}`);
    const fmt = (v) => (v == null ? '—' : `${num(v)}${kpi.unit || ''}`);
    const perfLine = c.na
      ? `${c.division} 에서는 관리하지 않는 지표입니다`
      : `${kpi.label}\n${c.division} · ${statusStyle(m?.status).label}`
        + (m?.target != null || m?.actual != null
            ? `\n목표 ${fmt(m?.target)} / 실적 ${fmt(m?.actual)}`
              + (m?.achievement != null ? ` → ${m.achievement}%` : '')
              + (m?.baseDate ? ` (${m.baseDate} 기준)` : '')
            : '');
    return (
      <Cell
        key={c.division}
        $na={c.na}
        $bg={ss.bg}
        $alarm={alarm}
        $clickable={!c.na && !open}
        $top={open}
        onClick={(open || c.na) ? undefined : () => openCell(kpi, c)}
        title={perfLine
          + (!c.na && m?.change && CHANGE_MARK[m.change]
              ? `\n직전 ${m.prevActual ?? '-'} → ${m.actual ?? '-'} `
                + `(${CHANGE_MARK[m.change].word})`
              : '')
          + (c.na ? '' : (n === 0
              ? '\n\n기여 과제 없음'
              : `\n\n과제 ${n}건 — 자체 ${c.own.length}`
                + (c.support.length ? ` · 지원 ${c.support.length} (${orgTxt})` : '')
                + (c.noteCount ? `\n기여 내용 ${c.noteCount}건` : '')
                + (delayed ? `\n지연 ${delayed}건` : '\n지연 없음')))}
      >
        <Inner $color={c.na ? 'transparent' : ss.fg}>
          {!c.na && (
            <>
              {/* 행 머리와 같은 이유로 단위는 빼 둔다 (2026-08-07) */}
              {showLabel && (
                <CellKpiName title={kpi.label}>
                  {kpi.label}
                </CellKpiName>
              )}
              {/* 실적·목표·달성률·직전대비는 여기서 그리지 않는다 (2026-08-06).
                  칸 배경색이 이미 달성 상태를 말하고, 정확한 값은 이 칸의 툴팁
                  (perfLine — 목표/실적/달성률/기준일/직전대비)과 눌러서 여는
                  드릴 패널(월별 추이까지)에 있다. 이유는 CELL_COLS 머리말 참조. */}

              {/*
                자체·지원·내용은 **접힌 칸에서만** 그린다 (2026-08-06).

                펼치면 그 아래에 과제가 이름째 나열된다. 그 위에 '자체 3 · 지원 1' 을
                또 얹으면 같은 것을 두 번 세는 셈이고, 세 칸 자리 때문에 과제 목록이
                시작하는 높이도 칸마다 들쭉날쭉해진다. 펼친 칸은 목록만 보여 준다.

                ⚠️ 셋은 **한 덩어리로** 나오거나 **통째로 빠지거나** 둘 중 하나다.
                   하나만 빼면 조각 수가 열 수와 어긋나 나머지가 앞으로 당겨진다
                   (말풍선이 실제로 그랬다). 그래서 분기를 셋으로 쪼개지 않는다.

                ⚠️ 잃는 것 — 펼친 상태에서는 말풍선(기여 내용으로 가는 길)도 같이
                   사라진다. 펼치면 칸 클릭이 막히므로, 기여 내용을 읽으려면 행을
                   **접고** 칸을 눌러야 한다. 목록이 이미 보이는 상태를 우선한
                   맞바꿈이다.
              */}
              {!open && (
                <>
                  <CellProj $zero={n === 0}
                            title={n === 0 ? '기여 과제 없음'
                              : `${c.division} 자체 수행 ${c.own.length}건`}>
                    {/* '자체' 글자는 머리글이 말한다. 하나도 없는 칸은 '—' —
                        흐리게 두면 빈칸이 눈에 띈다(이 표가 찾는 것이 빈칸이다). */}
                    {n === 0 ? '—' : (c.own.length || <Dim>·</Dim>)}
                  </CellProj>

                  {/* 지원 — 기능조직(GTR·SR·CS)이 이 사업부를 도우며 기여하는 과제.
                      자체와 색을 갈라 둔다: 남의 조직이 와서 붙은 것이라 성격이 다르고,
                      같은 색이면 두 열이 한 숫자처럼 읽힌다. */}
                  <CellSupport
                    title={c.support.length
                      ? `기능조직 지원 ${c.support.length}건 (${orgTxt})`
                      : '기능조직 지원 없음'}
                  >
                    {c.support.length || <Dim>·</Dim>}
                  </CellSupport>

                  {/* 읽을 기여 내용이 있는 칸에만 말풍선 — 대부분의 칸은 메모가 비어 있다. */}
                  {c.noteCount > 0 ? (
                    <NoteMark
                      type="button"
                      title={`기여 내용 ${c.noteCount}건 — 눌러서 보기`}
                      onClick={(e) => { e.stopPropagation(); openCell(kpi, c); }}
                    >
                      <MessageSquare size={9} />{c.noteCount}
                    </NoteMark>
                  ) : (
                    /* 없어도 **자리는 비워 둔다.** 안 그리면 조각 수가 줄어 앞칸이
                       오른쪽으로 밀리고, 같은 값이 칸마다 다른 자리에 뜬다. */
                    <NoteSlot />
                  )}
                </>
              )}
            </>
          )}
        </Inner>
        {open && n > 0 && renderCellProjects(c.projects, funcNameSet)}
      </Cell>
    );
  };

  /** 펼친 칸에 들어가는 과제 목록. 기능조직 과제는 색으로 구분한다. */
  const renderCellProjects = (projects, funcNames) => (
    <CellList>
      {projects.map((p) => {
        const support = funcNames.has(p.division);
        return (
          <ProjChip
            key={p.uuid}
            type="button"
            $support={support}
            title={`${p.code || ''} ${p.title || ''}\n${p.division}`
                   + (support ? ' (기능조직 지원)' : ' 수행')
                   + ` · ${p.status || '-'} · ${p.progress ?? 0}%`}
            onClick={(e) => { e.stopPropagation(); onOpenProject && onOpenProject(p); }}
          >
            <ChipBadge $support={support}>{p.division || '미지정'}</ChipBadge>
            <span>{p.title || p.code || '(제목 없음)'}</span>
          </ProjChip>
        );
      })}
    </CellList>
  );

  if (loading && !data) {
    return <Wrap><StateRow><Spin size={16} /> 불러오는 중…</StateRow></Wrap>;
  }
  if (error) {
    return (
      <Wrap>
        <StateRow $error><AlertCircle size={16} /> {error}</StateRow>
        <StateRow><IconButton onClick={load}><RefreshCw size={13} /> 다시 시도</IconButton></StateRow>
      </Wrap>
    );
  }
  if (!model) return null;

  const { owners, funcs, catSections, ownerSummary, funcSummary,
          targetsOf, projectCount, emptyKpis, untaggedCount, quad, unmatched } = model;
  const funcNameSet = new Set(funcs.map((d) => d.name));

  /**
   * 사업부 하나만 보는 모드가 쓰는 줄 — 그 사업부가 **관리하는** 지표만.
   *
   * 목록과 기여 지도가 **이 배열 하나를 같이 쓴다.** 각자 걸러내면 지도의 번호와
   * 목록의 순서가 언젠가 어긋나고, 그러면 번호가 정체성 노릇을 못 한다
   * (지도가 색 대신 번호를 쓰는 이유는 KpiContributionMap 머리말 참조).
   */
  const divRows = divView
    ? model.allRows
        .map(({ kpi, perDiv }) => ({ kpi, cell: perDiv.find((x) => x.division === divView) }))
        .filter(({ cell }) => cell && !cell.na)
    : [];

  /** 4분면 칸을 눌렀을 때 — 그 칸들에 걸린 과제를 합쳐 보여준다. */
  const openQuad = (title, hint, entries) => {
    const seen = new Map();
    entries.forEach((e) => e.projects.forEach((p) => seen.set(p.uuid, p)));
    if (!seen.size) {
      // 과제가 0건인 분면(방치·자연 달성)은 보여줄 과제가 없다 —
      // 정작 중요한 건 '어느 칸이 비었나' 이므로 칸 목록을 문장으로 알린다.
      setDrill({
        title,
        subtitle: entries.length
          ? entries.map((e) => `${e.division} · ${e.kpi.label}`).join('   |   ')
          : '해당하는 칸이 없습니다',
        projects: [],
      });
      return;
    }
    setDrill({ title, subtitle: hint, projects: [...seen.values()] });
  };

  /*
    4분면 설명은 **명사형으로, 같은 골격**을 쓴다 —
      (달성 여부) · (기여 과제 유무) — 후속 조치
    넷이 같은 구조라야 서로 대조하며 읽힌다. 서술형이면 문장 길이가 제각각이라
    카드 넷이 나란히 있는데도 하나씩 따로 읽어야 한다.
  */
  const QUADS = [
    { key: 'missNone', label: '방치', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca',
      hint: '미달 · 기여 과제 없음 — 다음 분기 안건' },
    { key: 'missSome', label: '집중 중', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa',
      hint: '미달 · 기여 과제 있음 — 진척 확인 필요' },
    { key: 'okNone', label: '자연 달성', color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd',
      hint: '달성 · 기여 과제 없음 — 자원 재배치 후보' },
    { key: 'okSome', label: '정상', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0',
      hint: '달성 · 기여 과제 있음' },
  ];

  return (
    <Wrap $fill={!!divView}>
      <TopRow>
        {/* 제목은 탭 이름(`Header` 의 kpiMatrix 버튼)과 **같아야 한다** —
            다르면 같은 화면인지 알 수가 없다. */}
        <Title>
          <Grid size={22} /> 과제-KPI 연결
          <Sub>
            과제 {projectCount}건 · 미연결 {untaggedCount}건
            {emptyKpis > 0 && ` · 기여 과제 없는 KPI ${emptyKpis}개`}
          </Sub>
        </Title>
        <HeaderRight>
          <PeriodSelect
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            title="연간 = 연 목표(Q4→Q1 중 첫 유효값) 대비 오늘까지의 최신 실적. 분기를 고르면 그 분기 기준."
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </PeriodSelect>
          {/* 보기 전환 — 어느 사업부냐는 아래 탭에서 고른다 (ViewToggle 머리말 참조) */}
          <ViewToggle>
            <ToggleBtn
              type="button"
              $on={!divView}
              onClick={() => setDivView('')}
              title="사업부를 가로로 늘어놓고 비교합니다."
            >
              매트릭스
            </ToggleBtn>
            <ToggleBtn
              type="button"
              $on={!!divView}
              onClick={() => setDivView(lastDiv || owners[0]?.name || '')}
              title="사업부 하나만 세로로 봅니다 — 가로 스크롤 없이 기여 내용까지 한눈에 읽힙니다"
            >
              사업부별 보기
            </ToggleBtn>
          </ViewToggle>
          <IconButton
            onClick={() => { setAllOpen((v) => !v); setExpanded(new Set()); }}
            title="모든 행의 과제를 칸 안에 펼칩니다 (행 이름을 눌러 하나씩 펼칠 수도 있습니다)"
          >
            {allOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {allOpen ? '모두 접기' : '모두 펼치기'}
          </IconButton>
          {isAdmin && (
            <SelWrap>
              <IconButton
                onClick={() => setSelOpen((v) => !v)}
                title="표에 표시할 지표를 고릅니다 (관리자 전용). 연결 데이터는 지워지지 않습니다."
                style={excludedKpiIds.size > 0
                  ? { borderColor: '#f59e0b', color: '#b45309', background: '#fffbeb' }
                  : undefined}
              >
                <Settings size={13} /> KPI 선택
                {excludedKpiIds.size > 0 && <b>−{excludedKpiIds.size}</b>}
              </IconButton>
              {selOpen && (
                <>
                  <SelOverlay onClick={() => setSelOpen(false)} />
                  <SelPanel onClick={(e) => e.stopPropagation()}>
                    <SelHead>
                      <span>표에 표시할 지표</span>
                      <span style={{ display: 'flex', gap: '0.5rem' }}>
                        <SelLink type="button" onClick={() => setAllKpiVisible([])}>모두 표시</SelLink>
                        <SelLink
                          type="button"
                          onClick={() => setAllKpiVisible((data?.kpis || []).map((k) => k.kpiDefinitionId))}
                        >모두 숨김</SelLink>
                      </span>
                    </SelHead>
                    {/* 분류별로 묶어 보여준다 — 표의 구획과 같은 순서라 찾기 쉽다 */}
                    {[...new Set((data?.kpis || []).map((k) => k.category || '기타'))]
                      .sort((a2, b2) => {
                        const ia = CATEGORY_ORDER.indexOf(a2), ib = CATEGORY_ORDER.indexOf(b2);
                        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
                      })
                      .map((cat) => (
                        <React.Fragment key={cat}>
                          <SelCat>{cat}</SelCat>
                          {(data?.kpis || [])
                            .filter((k) => (k.category || '기타') === cat)
                            .map((k) => (
                              <SelItem key={k.kpiDefinitionId}>
                                <input
                                  type="checkbox"
                                  checked={!excludedKpiIds.has(k.kpiDefinitionId)}
                                  onChange={() => toggleKpiVisible(k.kpiDefinitionId)}
                                />
                                <span>
                                  {k.label}
                                  {k.unit ? <Pill style={{ marginLeft: 4 }}>{k.unit}</Pill> : null}
                                </span>
                              </SelItem>
                            ))}
                        </React.Fragment>
                      ))}
                  </SelPanel>
                </>
              )}
            </SelWrap>
          )}
          <IconButton onClick={load}
                      title="다른 사람이 바꾼 연결까지 다시 불러옵니다 (내 저장은 자동 반영됩니다)">
            <RefreshCw size={13} /> 새로고침
          </IconButton>
          {/* 연도 위젯 — 전체 요약과 같은 자리(우측 끝)·같은 모양 */}
          <YearSelector>
            <YearButton onClick={() => onYearChange && onYearChange(currentYear - 1)}
                        title="이전 연도">‹</YearButton>
            <YearDisplay>{currentYear}년</YearDisplay>
            <YearButton onClick={() => onYearChange && onYearChange(currentYear + 1)}
                        title="다음 연도">›</YearButton>
          </YearSelector>
        </HeaderRight>
      </TopRow>

      <Body $fill={!!divView}>
          {/* 사업부 탭 — 사업부별 보기일 때만. 뱃지는 **그 사업부 자체 과제 중
              KPI에 연결된 수**다(요약 패널의 '연결' 과 같은 값). */}
          {divView && (
            <DivTabBar>
              {owners.map((d) => {
                const s = ownerSummary.find((x) => x.division === d.name);
                const on = divView === d.name;
                return (
                  <DivTab
                    key={d.name}
                    type="button"
                    $on={on}
                    onClick={() => { setDivView(d.name); setLastDiv(d.name); }}
                    title={`${d.name} — 연결된 자체 과제 ${s?.linked ?? 0} / ${s?.total ?? 0}건`}
                  >
                    {d.name}
                    <DivTabBadge $on={on}>{s?.linked ?? 0}</DivTabBadge>
                  </DivTab>
                );
              })}
            </DivTabBar>
          )}

          {/*
            범례는 **매트릭스 전용**이다 (2026-08-07).

            여덟 줄 모두 매트릭스 칸의 배경색(STATUS_STYLE)을 읽는 법이다. 사업부별
            보기에서 이 색을 쓰던 것은 좌측 표였는데, 그 표를 걷어내면서 색이 쓰이는
            자리가 한 군데도 안 남았다. 흐름도는 아예 다른 어법을 쓴다 —
            선 색 = 프로세스, 선 모양 = 기여 등급, 왼쪽 띠 = 진행상태.

            화면에 없는 색의 뜻을 적어 두면 "어딘가 이 색이 있나 보다" 하고 찾게 된다.
            흐름도의 범례는 그 안에 있다(프로세스 칩이 곧 색 범례, 아래 한 줄이 모양).
          */}
          {!divView && (
          <Legend>
            <LegendItem><Swatch $bg={STATUS_STYLE.ok.bg} /> {STATUS_STYLE.ok.label}</LegendItem>
            <LegendItem><Swatch $bg={STATUS_STYLE.near.bg} /> {STATUS_STYLE.near.label}</LegendItem>
            <LegendItem><Swatch $bg={STATUS_STYLE.miss.bg} /> {STATUS_STYLE.miss.label}</LegendItem>
            <LegendItem><Swatch $bg={STATUS_STYLE.no_data.bg} /> {STATUS_STYLE.no_data.label}</LegendItem>
            <LegendItem><Swatch $bg="#fff" /> {STATUS_STYLE.no_target.label}</LegendItem>
            <LegendItem><Swatch $bg={STATUS_STYLE.platform.bg} /> {STATUS_STYLE.platform.label}</LegendItem>
            <LegendItem><Swatch $hatch /> 해당 없음 (그 사업부가 관리하지 않는 지표)</LegendItem>
            <LegendItem>
              <Swatch $bg="#fff" style={{ boxShadow: 'inset 0 0 0 2px #dc2626' }} />
              미달인데 기여 과제 없음
            </LegendItem>
          </Legend>
          )}

          {/*
            '칸 읽는 법' 줄은 걷어냈다 (2026-08-06).

            `▲ 45 / 40  달성 112%` 와 `과제 3 +1` 을 예시로 보여 주던 줄이다.
            둘 다 이제 없는 모양이다 — 지표·달성은 칸에서 빠졌고(CELL_COLS 머리말),
            `3+1` 은 자체·지원 두 열로 갈라졌다.

            다시 만들지 않는다. 칸이 무슨 뜻인지는 **머리글 소제목(자체·지원·내용)**
            이 열마다 말하고, 색은 위 범례가 말한다. 읽는 법을 따로 적어야 한다면
            그건 칸이 아직 안 읽힌다는 뜻이니, 설명을 늘릴 게 아니라 칸을 고쳐야 한다.
          */}

          {/* 사업부 하나만 보는 모드 — 열이 하나라 가로 스크롤이 없다.
              지표를 세로로 쭉 나열하고 그 아래 (과제 · 기여 방법) 2열을 편다.
              보고 자료를 만들 때 이 형태가 그대로 쓰인다. */}
          {divView ? (
            /* 사업부별 보기 = **흐름도 하나**다 (2026-08-07).
               좌측에 KPI별 과제표를 같이 뒀었는데, 흐름도가 같은 것을 이미 더 잘
               보여준다 — 어느 과제가 어느 KPI에 걸렸는지, 어떤 등급·프로세스인지.
               표는 그 정보를 세로로 늘어놓기만 해서 자리만 먹고 흐름도를 좁혔다.
               과제 상세는 흐름도의 과제 칩을 눌러 편집창에서 본다. */
            <FullFlow>
              <KpiContributionFlow
                rows={divRows}
                division={divView}
                onOpenProject={onOpenProject}
                settingsData={settingsData}
                /* 이 사업부 과제 중 **어느 KPI에도 안 걸린 것**. 흐름도가 아래쪽에
                   따로 세운다 — 이 화면에서 빈칸은 잡음이 아니라 안건이다. */
                unlinked={ownerSummary.find((s) => s.division === divView)?.unlinked || []}
                /* 사업부 고르기를 흐름도 조작줄에도 둔다 (2026-08-07).
                   전체화면에 들어가면 위 탭이 화면 밖으로 나가 사업부를 못 바꾼다. */
                divisions={owners.map((d) => {
                  const s = ownerSummary.find((x) => x.division === d.name);
                  return { name: d.name, linked: s?.linked ?? 0, total: s?.total ?? 0 };
                })}
                onDivisionChange={(name) => { setDivView(name); setLastDiv(name); }}
                /* 2순위 진입점 — 흐름도의 미연결 띠가 곧 할 일 목록이다.
                   드릴 패널과 **같은 모달**을 연다. */
                onBulkLink={canBulk
                  ? (list, label, kpiIds) => setBulk({
                    projects: list, contextLabel: label, preselectKpiIds: kpiIds || [] })
                  : undefined}
              />
            </FullFlow>
          ) : (
          <Split>
          <TableScroll>
            <Table $cols={owners.length} $colW={DIV_COL_W} $hasTotal>
              {/* 고정 열만 못박는다. 사업부 열은 폭을 비워 둬야 남는 폭을
                  **똑같이 나눠 갖는다** (table-layout:fixed 의 성질 — Table 주석 참조) */}
              <colgroup>
                <col style={{ width: `${SECT_COL_W}px` }} />
                <col style={{ width: `${KPI_COL_W}px` }} />
                {owners.map((d) => <col key={d.name} />)}
                {/* 펼치면 '계' 열을 통째로 뺀다 — colgroup·머리글·본문·요약이
                    **다 같이** 빠져야 한다. 하나라도 남으면 열이 어긋난다. */}
                {allCollapsed && <col style={{ width: `${TOTAL_COL_W}px` }} />}
              </colgroup>
              <thead>
                <tr>
                  <StickyTh $first>구분</StickyTh>
                  <StickyTh>KPI 지표</StickyTh>
                  {owners.map((d) => (
                    <Th key={d.name}>
                      {d.name}
                      {/* 칸마다 '자체'·'지원' 을 되풀이하지 않도록 여기서 한 번만 말한다.
                          칸과 **같은 열 정의(CELL_COLS)** 를 써야 세로로 맞는다.
                          펼치면 칸에서 그 세 숫자가 빠지므로 이 라벨도 같이 뺀다 —
                          가리킬 것이 없는 머리글은 틀이 아니라 잡음이다. */}
                      {allCollapsed && (
                        <ThSub>
                          <span>자체</span><span>지원</span><span>내용</span>
                        </ThSub>
                      )}
                    </Th>
                  ))}
                  {allCollapsed && (
                    <Th
                      /* 사업부 열과 성격이 다른 칸이라 경계를 굵게 — 어두운 바탕이라
                         회색 대신 흰색을 옅게 쓴다 */
                      style={{ borderLeft: '2px solid rgba(255,255,255,0.28)' }}
                      title="가로합이 아니라 서로 다른 과제 수입니다. 한 과제가 두 사업부를 지원하면 두 칸에 나타나므로 가로로 더하면 겹칩니다."
                    >
                      계(과제)
                    </Th>
                  )}
                </tr>
              </thead>
              <tbody>
                {catSections.map((sec) => {
                // 구분 칸이 몇 줄을 덮어야 하는가 = 이 구획이 만드는 tr 수
                //   압축 구획   행 하나가 곧 tr 하나
                //   그 외       분류 소제목 tr + 지표 tr 들
                // ⚠️ skipCat 이면 소제목 tr 이 없다. 안 빼면 rowSpan 이 한 줄 넘쳐
                //    구분 칸이 다음 구획을 침범한다.
                const rowCount = sec.packedRows
                  ? sec.packedRows.length
                  : sec.blocks.reduce(
                      (a, [, rs]) => a + (sec.skipCat ? 0 : 1) + rs.length, 0);
                const secStyle = SECTION_STYLE[sec.key] || {};
                const sectionCell = (
                  <SectionCell rowSpan={rowCount} $bg={secStyle.bg} $fg={secStyle.fg}
                               title={sec.hint}>
                    {sec.title}
                    <b>{sec.count}개</b>
                  </SectionCell>
                );
                return (
                <React.Fragment key={sec.key}>
                  {/*
                    사업부 전용 구획은 **압축 행**으로 그린다.
                    지표마다 담당 사업부가 겹치지 않아, 한 줄에 여러 지표를 나란히
                    놓아도 충돌하지 않는다. 지표명은 칸 안으로 들어간다 —
                    한 줄이 더 이상 한 지표가 아니라 행 머리에 쓸 이름이 없다.
                    (분류 소제목도 생략한다: 한 줄에 여러 분류가 섞이기 때문)
                  */}
                  {sec.packedRows ? sec.packedRows.map((pr, ri) => {
                    /*
                      압축 줄은 **한 지표가 아니다** — 칸마다 다른 지표가 들어 있다.
                      그래서 펼침 상태도 줄 단위가 아니라 **칸(지표) 단위**로 봐야 한다.
                      🐞 예전에는 여기서 `open` 을 아예 안 넘겨서, 사업부 전용 지표는
                         '모두 펼치기' 로도 개별 클릭으로도 **영영 안 펼쳐졌다**
                         (2026-08-06 발견).
                      줄 머리 토글은 그 줄에 담긴 지표를 **한꺼번에** 여닫는다.
                    */
                    const kids = pr.cells.filter((c) => !c.empty)
                      .map((c) => c.kpi.kpiDefinitionId);
                    const anyOpen = kids.some((kid) => isOpen(kid));
                    const canOpen = pr.total > 0;
                    return (
                    <Row key={`packed-${pr.index}`} $band={ri % 2 === 1}
                         $rgb="100, 116, 139" $accent="#94a3b8">
                      {ri === 0 && sectionCell}
                      <RowHead title={'담당 사업부가 겹치지 않는 전용 지표를 한 줄에 모았습니다'
                        + (canOpen ? '\n(클릭하면 이 줄의 지표를 모두 펼칩니다)' : '')}>
                        <RowToggle
                          type="button"
                          $clickable={canOpen}
                          onClick={() => { if (canOpen) kids.forEach((kid) => toggleRow(kid, true)); }}
                        >
                          {anyOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <span style={{ color: '#6b7280', fontWeight: 600 }}>
                            전용 지표 {pr.index}
                          </span>
                        </RowToggle>
                      </RowHead>
                      {pr.cells.map((c) => (c.empty
                        ? <Cell key={c.division} $na $clickable={false} />
                        : renderCell(c.kpi, c, {
                            showLabel: true,
                            funcNameSet,
                            open: isOpen(c.kpi.kpiDefinitionId) && (c.projects || []).length > 0,
                          })))}
                      {allCollapsed && (
                        <TotalCell $zero={pr.total === 0}>{pr.total || '0'}</TotalCell>
                      )}
                    </Row>
                    );
                  }) : sec.blocks.map(([category, rows], bi) => {
                  const cs = catStyle(category);
                  return (
                  <React.Fragment key={category}>
                    {/* 구획 이름과 같은 말이면 소제목 줄을 아예 안 그린다(skipCat).
                        그 경우 구분 칸은 아래 첫 지표 줄이 대신 들고 간다. */}
                    {!sec.skipCat && (
                      <tr>
                        {bi === 0 && sectionCell}
                        {/* 지표명 + 사업부 열들 (+ 계). 계가 빠지면 하나 줄인다 —
                            안 줄이면 마지막 열을 넘어 표가 밀린다. */}
                        <CatRow colSpan={owners.length + (allCollapsed ? 2 : 1)}
                                $chip={cs.chip} $text={cs.text} $accent={cs.accent}>
                          {category}
                        </CatRow>
                      </tr>
                    )}
                    {rows.map(({ kpi, perDiv, total }, ri) => {
                      const open = isOpen(kpi.kpiDefinitionId) && total > 0;
                      return (
                      <Row key={kpi.kpiDefinitionId} $band={ri % 2 === 1}
                           $rgb={cs.rgb} $accent={cs.accent}>
                        {sec.skipCat && bi === 0 && ri === 0 && sectionCell}
                        <RowHead title={`${kpi.label}${total > 0 ? '\n(클릭하면 과제를 펼칩니다)' : ''}`}>
                          <RowToggle
                            type="button"
                            $clickable={total > 0}
                            onClick={() => toggleRow(kpi.kpiDefinitionId, total > 0)}
                          >
                            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            {/* 단위 알약은 붙이지 않는다 (2026-08-07).
                                칸에 숫자가 없으니(CELL_COLS 머리말) 행 이름 옆 단위는
                                받을 값이 없다. 단위가 필요한 곳 — 툴팁·드릴 패널 — 은
                                거기서 값에 직접 붙여 쓴다. */}
                            <span>
                              {total === 0 && <span title="이 지표에 기여하는 과제가 없습니다">⚠ </span>}
                              {kpi.label}
                            </span>
                          </RowToggle>
                        </RowHead>
                        {perDiv.map((c) => renderCell(kpi, c, { open, funcNameSet }))}
                        {allCollapsed && (
                          <TotalCell $zero={total === 0}>{total || '0'}</TotalCell>
                        )}
                      </Row>
                      );
                    })}
                  </React.Fragment>
                  );
                  })}
                </React.Fragment>
                );
                })}
              </tbody>
              {/*
                바닥 요약의 순서 = 읽는 순서 (2026-08-01, 2026-08-06 두 줄을 하나로)
                  ① 과제-KPI 연결 현황  연결 / 미연결 / 전체 — 그 사업부가 직접 하는 일
                  ② 기능조직 지원    **남이** 보태 준 몫. 성격이 달라 아래에 둔다
                ①의 '미연결' 은 원래 따로 한 줄이었다. 분모를 두 번 쓰면서 대비는
                오히려 흐렸다 — 연결과 미연결은 같은 전체를 나눠 갖는 값이라 붙여 쓴다.
                기능조직은 GTR·SR·CS 를 한 줄로 합치지 않는다 — 하는 일이 달라서
                합계만 보면 "어느 조직이 기여하고 있나" 라는 정작 필요한 정보가 사라진다.
              */}
              <tfoot>
                {/*
                  바닥도 본문과 **같은 문법**을 따른다 (2026-08-06).
                      접으면  숫자  — 과제-KPI 연결 현황(연결/미연결/전체) + 기능조직 지원
                      펼치면  이름  — 미연결 과제를 알약으로 늘어놓는다

                  펼친 화면에서 찾는 것은 '몇 건' 이 아니라 '어느 과제가 빠졌나' 다.
                  그리고 기능조직 지원은 **이미 본문 칸 안에 이름으로 다 나와 있다**
                  (펼친 칸의 목록에 지원 과제가 사업부 꼬리표를 달고 섞여 있다).
                  같은 것을 바닥에서 숫자로 또 세면 줄만 먹는다 — 그래서 뺀다.
                */}
                {!allCollapsed ? (
                  <tr>
                    <RowHead colSpan={2} $first style={{
                      background: '#fff7ed', fontWeight: 700, color: '#c2410c',
                      borderTop: '2px solid #d1d5db', verticalAlign: 'top',
                    }}>
                      미연결 과제{' '}
                      <span style={{ fontWeight: 400, fontSize: '0.72rem', color: '#9a6b4f' }}>
                        (어느 KPI 에도 연결되지 않음)
                      </span>
                    </RowHead>
                    {ownerSummary.map((s) => (
                      <UnlinkedListCell key={s.division} $n={s.unlinked.length}
                        title={s.unlinked.length
                          ? `${s.division}: 수행 과제 ${s.total}건 중 ${s.unlinked.length}건이 미연결`
                          : `${s.division}: 모든 과제가 연결됨`}>
                        {s.unlinked.length === 0
                          ? <Dim style={{ fontSize: '0.72rem' }}>없음</Dim>
                          /* 본문 펼친 칸과 **같은 렌더러**를 쓴다 — 같은 것(과제)이
                             같은 모양으로 보여야 한 화면으로 읽힌다. */
                          : renderCellProjects(s.unlinked, funcNameSet)}
                      </UnlinkedListCell>
                    ))}
                  </tr>
                ) : (<>
                {/* ① 과제-KPI 연결 현황 — 연결 / 미연결 / 전체를 **한 줄**로 (2026-08-06).
                    두 줄이던 때는 분모(전체)를 두 번 쓰면서도 정작 '연결과 미연결이
                    합쳐서 전체가 맞나' 를 눈으로 빼서 맞춰 봐야 했다. 나란히 두면
                    그 뺄셈이 사라진다. 클릭(미연결 목록)은 그대로 이 칸에 있다. */}
                <tr>
                  <RowHead colSpan={2} $first style={{
                    background: '#fafafa', fontWeight: 700,
                    borderTop: '2px solid #d1d5db',
                  }}>
                    과제-KPI 연결 현황{' '}
                    {/* '클릭' 은 빼 뒀다 (2026-08-06). 손잡이는 커서(pointer)와
                        hover 테두리, 그리고 툴팁의 '(클릭하면 미연결 과제를 봅니다)'
                        가 이미 말한다. 줄 이름에 조작 안내까지 넣으면 정작 무엇을
                        세는 줄인지가 뒤로 밀린다. */}
                    <span style={{ fontWeight: 400, fontSize: '0.72rem', color: '#6b7280' }}>
                      (연결/<span style={{ color: '#c2410c', fontWeight: 700 }}>미연결</span>/전체)
                    </span>
                  </RowHead>
                  {ownerSummary.map((s) => (
                    <UnlinkedCell
                      key={s.division}
                      $n={s.unlinked.length}
                      /* 미연결이 없으면 열어 봐야 빈 목록이다 — 커서도 이미 '못 누름' 이라
                         말하고 있으니 손잡이도 떼어 둔다. */
                      onClick={s.unlinked.length
                        ? () => openList(
                            `${s.division} — 어느 KPI 에도 연결되지 않은 과제`,
                            `${s.unlinked.length}건 · 과제 편집창의 'DX KPI 연결' 에서 연결할 수 있습니다`,
                            s.unlinked)
                        : undefined}
                      title={s.total === 0
                        ? `${s.division}: 수행 과제가 없습니다`
                        : `${s.division}: 수행 과제 ${s.total}건`
                          + `\n· KPI 에 연결됨 ${s.linked}건`
                          + `\n· 어느 KPI 에도 연결 안 됨 ${s.unlinked.length}건`
                          + (s.unlinked.length ? '\n(클릭하면 미연결 과제를 봅니다)' : '')}
                    >
                      {/* 숫자 셋이라 한 칸에 안 들어간다 — 가운데 세 칸(2~4)에 걸쳐
                          칸 한가운데에 세운다. 위 지표명 띠와 같은 축이다. */}
                      <SumSlot $col="2 / 5"><span>
                        {s.total === 0 ? '—' : (
                          <>
                            <span style={{ color: '#111827' }}>{s.linked}</span>
                            <Sep>/</Sep>
                            {/* 셋 중 **이것만** 주황 — 색은 봐야 할 것을 가리키는 신호다 */}
                            <span style={{ color: s.unlinked.length ? '#c2410c' : '#9ca3af' }}>
                              {s.unlinked.length}
                            </span>
                            <Sep>/</Sep>
                            {/* 분모 — 숫자에 딸린 맥락이라 상대 크기로 한 단계 작게 */}
                            <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '0.8em' }}>
                              {s.total}
                            </span>
                          </>
                        )}
                      </span></SumSlot>
                    </UnlinkedCell>
                  ))}
                  {allCollapsed && (
                    <td style={{
                      borderLeft: '1px solid #e5e7eb', background: '#fafafa',
                      borderTop: '2px solid #d1d5db',
                    }} />
                  )}
                </tr>

                {/* ③ 기능조직 지원 — 조직마다 한 줄. 위 두 줄과 성격이 달라 구분선을 둔다 */}
                {funcs.map((f, fi) => (
                  <tr key={f.name}>
                    <RowHead colSpan={2} $first style={{
                      background: '#eef2ff', fontWeight: 700, color: '#4338ca',
                      borderTop: fi === 0 ? '2px solid #d1d5db' : undefined,
                    }}>
                      {fi === 0 && (
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4338ca',
                                      letterSpacing: '0.02em', marginBottom: 2 }}>
                          기능조직 지원
                        </div>
                      )}
                      ↳ {f.name}
                    </RowHead>
                    {ownerSummary.map((s) => {
                      const list = s.byOrg.get(f.name) || [];
                      return (
                        <SupportCell
                          key={s.division}
                          $n={list.length}
                          style={fi === 0 ? { borderTop: '2px solid #d1d5db' } : undefined}
                          onClick={() => openList(
                            `${f.name} → ${s.division} 지원 과제`,
                            `${list.length}건`, list)}
                          title={list.length
                            ? `${f.name} 이 ${s.division} 의 KPI 에 기여하는 과제 ${list.length}건`
                            : `${f.name} → ${s.division} 지원 과제가 없습니다`}
                        >
                          {/* 본문의 **지원 열**(2열)에 맞춘다 — 이 줄이 세는 것이
                              바로 그 숫자다. 자체 열에 두면 세로로 어긋난다. */}
                          <SumSlot $col={3}>
                            <span>{list.length || '—'}</span>
                          </SumSlot>
                        </SupportCell>
                      );
                    })}
                    {allCollapsed && (
                      <td style={{
                        borderLeft: '1px solid #e5e7eb', background: '#fafafa',
                        borderTop: fi === 0 ? '2px solid #d1d5db' : undefined,
                      }} />
                    )}
                  </tr>
                ))}
                </>)}
              </tfoot>
            </Table>
          </TableScroll>

          {/*
            요약 패널 — 표 오른쪽. 표에서 뽑아낸 **결론**이라 근거 옆에 붙여 둔다.
            (예전엔 표 위 전체 폭에 있었다 — 표를 아래로 밀기만 하고 정작 세로로는 짧았다)
          */}
          <SidePanel>
            <PanelTitle>이번 {period || '연간'} 안건</PanelTitle>
            <QuadGrid>
              {QUADS.map((q) => (
                <QuadCard
                  key={q.key}
                  type="button"
                  $bg={q.bg} $border={q.border} $n={quad[q.key].length}
                  onClick={() => openQuad(`${q.label} — ${q.hint}`,
                                          `${quad[q.key].length}칸`, quad[q.key])}
                  title={quad[q.key].length
                    ? quad[q.key].map((e) => `${e.division} · ${e.kpi.label}`).join('\n')
                    : '해당하는 칸이 없습니다'}
                >
                  <QuadCount $color={q.color}>{quad[q.key].length}</QuadCount>
                  <QuadLabel>{q.label}</QuadLabel>
                  <QuadHint>{q.hint}</QuadHint>
                </QuadCard>
              ))}
            </QuadGrid>

            {quad.unknown > 0 && (
              <Notice>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  <b>{quad.unknown}칸</b>은 목표나 실적이 없어 달성 여부를 판정할 수
                  없습니다 (위 4분면에서 제외). 목표를 먼저 세워야 이 표가 "잘 가고
                  있는가" 에 답할 수 있습니다.
                  {unmatched.length > 0 && (
                    <> 그중 <b>{unmatched.length}개 지표</b>는 어느 사업부에서도
                    목표·실적이 없습니다: {unmatched.map((u) => u.label).join(' · ')}</>
                  )}
                </span>
              </Notice>
            )}

            {/* 기능조직은 지표를 갖지 않으므로 열이 될 수 없다. 요약으로 여기 둔다. */}
            <FuncBlock>
            <FuncTitle>
              기능조직 <span>— 자체 KPI 를 갖지 않고 위 사업부들을 지원합니다</span>
            </FuncTitle>
            <FuncGrid>
              {funcSummary.map((s) => (
                <FuncCard key={s.division}>
                  <FuncName>{s.division}</FuncName>
                  <FuncStat><b>{s.linked}</b> / {s.total} 과제가 KPI 지원 중</FuncStat>
                  <FuncUnlinked
                    $n={s.unlinked.length}
                    onClick={() => openList(
                      `${s.division} — 어느 KPI 에도 연결되지 않은 과제`,
                      `${s.unlinked.length}건 · 지원 대상 사업부를 고르면 연결할 수 있습니다`,
                      s.unlinked)}
                  >
                    미연결 {s.unlinked.length}건{s.unlinked.length ? ' →' : ''}
                  </FuncUnlinked>
                </FuncCard>
              ))}
            </FuncGrid>
            </FuncBlock>
          </SidePanel>
          </Split>
          )}
      </Body>

      <BulkKpiLinkModal
        open={!!bulk}
        onClose={() => setBulk(null)}
        projects={bulk?.projects || []}
        contextLabel={bulk?.contextLabel}
        preselectKpiIds={bulk?.preselectKpiIds || []}
        kpis={data?.kpis || []}
        divisions={data?.divisions || []}
        links={data?.links || []}
        settingsData={settingsData}
        /* 적용 뒤에는 **서버에서 다시 읽는다.** 화면에서 계산해 맞추면 셀 숫자가
           서버와 갈리는데, 이 표는 보고에 쓰이는 숫자다. */
        onDone={load}
      />

      {drill && (
        <Backdrop onClick={() => setDrill(null)}>
          <Panel onClick={(e) => e.stopPropagation()}>
            <PanelHead>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{drill.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>{drill.subtitle}</div>
              </div>
              <PanelHeadRight>
                {canBulk && drill.projects.length > 0 && (
                  <BulkBtn
                    onClick={() => setBulk({
                      projects: drill.projects,
                      contextLabel: `${drill.title} — 과제 ${drill.projects.length}건`,
                      // 칸에서 들어왔으면 그 지표를 미리 골라 둔다. 빈 화면으로 열면
                      // 진입점을 여러 개 둔 뜻이 없어진다.
                      preselectKpiIds: drill.detail?.kpi
                        ? [drill.detail.kpi.kpiDefinitionId] : [],
                    })}
                    title="이 과제들의 KPI 연결을 한 번에 세웁니다"
                  >
                    <Layers size={13} /> KPI 연결 일괄 편집
                  </BulkBtn>
                )}
                <IconButton onClick={() => setDrill(null)}><X size={14} /></IconButton>
              </PanelHeadRight>
            </PanelHead>
            <PanelBody>
              {/* 칸 상세 — 목표·실적·달성률·직전 대비·월별 추이.
                  과제 목록보다 위에 둔다. "이 칸이 잘 가고 있나" 가 먼저 오는 질문이다. */}
              {drill.detail && (() => {
                const { kpi, metric: m, own, support } = drill.detail;
                const unit = kpi.unit || '';
                const fmt = (v) => (v == null ? '—' : `${(+v).toFixed(1).replace(/\.0$/, '')}${unit}`);
                const cm = m?.change ? CHANGE_MARK[m.change] : null;
                const withProgress = drill.projects.filter((p) => p.progress != null);
                const avg = withProgress.length
                  ? Math.round(withProgress.reduce((s, p) => s + (+p.progress || 0), 0)
                               / withProgress.length)
                  : null;
                const isPlatform = m?.status === 'platform';
                return (
                  <CellDetail>
                    <DetailStats>
                      {/* 플랫폼 구축은 측정값이 없다 — 목표·실적·달성률 칸을 아예 뺀다.
                          '—' 로 채우면 있어야 할 값이 빠진 것처럼 보인다. */}
                      {!isPlatform && (
                        <>
                          <DetailStat><b>{fmt(m?.target)}</b><span>목표</span></DetailStat>
                          <DetailStat><b>{fmt(m?.actual)}</b><span>실적</span></DetailStat>
                          <DetailStat>
                            <b style={{ color: statusStyle(m?.status).fg }}>
                              {m?.achievement != null ? `${m.achievement}%` : '—'}
                            </b>
                            <span>목표 대비 달성률</span>
                          </DetailStat>
                        </>
                      )}
                      {cm && (
                        <DetailStat>
                          <b style={{ color: cm.color }}>{cm.arrow} {cm.word}</b>
                          <span>
                            직전 {fmt(m.prevActual)}
                            {m.prevBaseDate ? ` (${m.prevBaseDate})` : ''}
                          </span>
                        </DetailStat>
                      )}
                      {avg != null && (
                        <DetailStat>
                          <b>{avg}%</b>
                          {/*
                            "미달인데 걸린 과제는 전부 완료" 같은 어긋남을 잡는 자리다.
                            진척이 없는 과제는 평균에서 빼야 분모가 거짓말을 하지 않는다.
                          */}
                          <span>연결 과제 평균 진척 ({withProgress.length}건)</span>
                        </DetailStat>
                      )}
                    </DetailStats>

                    {m?.trend && m.trend.some((v) => v != null) && (
                      <div>
                        <DetailCaption>
                          월별 실적 추이
                          {m.baseDate ? ` · 최근 ${m.baseDate}` : ''}
                          <span> (기록 없는 달은 잇지 않습니다)</span>
                        </DetailCaption>
                        {/* 표에서 뺀 대신 여기서는 넓게 — 추이를 보려고 연 화면이다 */}
                        <Sparkline points={m.trend} width={420} height={54}
                                   color={cm ? cm.color : '#2563eb'} />
                      </div>
                    )}

                    <DetailCaption>
                      과제 {drill.projects.length}건 — 자체 {own.length} · 기능조직 지원 {support.length}
                      {' · '}기여 내용 {drill.projects.filter((x) => (x.note || '').trim()).length}건
                    </DetailCaption>
                  </CellDetail>
                );
              })()}

              {/* 4분면의 '방치'·'자연 달성' 은 과제가 0건인 칸들이라 보여줄 과제가 없다.
                  그때 정작 필요한 정보는 **어느 칸이 비었나** 이고, 그건 위 부제에 있다. */}
              {drill.projects.length === 0 && (
                <StateRow style={{ padding: `0.5rem ${PANEL_X}` }}>
                  <AlertCircle size={14} />
                  {drill.detail
                    ? '이 지표에 기여하는 과제가 없습니다.'
                    : '연결된 과제가 없는 칸입니다 — 위에 나열된 (사업부 · 지표) 가 그 대상입니다.'}
                </StateRow>
              )}
              {/* 머리행 — 기여 방법 열이 뭔지 여기서 한 번만 말한다.
                  칸 상세(drill.detail)일 때만 그 열이 있으므로 조건도 같이 건다. */}
              {drill.detail && drill.projects.length > 0 && (
                <ProjListHead>
                  <span>과제</span>
                  <HeadNote>기여 방법</HeadNote>
                  <span>상태</span>
                  <span>진행률</span>
                </ProjListHead>
              )}
              {drill.projects.map((p) => {
                const sc = STATUS_COLOR[p.status] || {};
                const isFunc = funcNameSet.has(p.division);
                const ts = [...(targetsOf.get(p.uuid) || [])];
                return (
                  <ProjRow
                    key={p.uuid}
                    $noNote={!drill.detail}
                    onClick={() => { setDrill(null); onOpenProject && onOpenProject(p); }}
                    title={[p.code, onOpenProject ? '눌러서 과제 편집창 열기' : '']
                      .filter(Boolean).join(' · ')}
                  >
                    <RowProj>
                      {/* 과제코드 대신 **사업부**. 자체 / 기능조직 지원을 색과 글자로 가른다.
                          (코드는 줄 툴팁에 있다 — 여기서는 어느 조직 과제인지가 알고 싶은 것이다) */}
                      <Pill
                        $bg={isFunc ? '#e0e7ff' : '#f3f4f6'}
                        $fg={isFunc ? '#3730a3' : '#4b5563'}
                        title={isFunc
                          ? `${p.division} 이(가) 지원하는 과제`
                            + (ts.length ? ` · 지원 대상: ${ts.join(', ')}` : '')
                          : `${p.division} 자체 과제`}
                      >
                        {p.division || '미지정'}{isFunc ? ' 지원' : ''}
                      </Pill>
                      {/* ⚠️ 알약은 **전부 RowProj 안에** 둔다. 그리드 자식이 하나라도
                          늘면 열 정의(4열)를 넘겨 진행률이 다음 줄로 밀린다. */}
                      {p.isKey && <Pill $bg="#ede9fe" $fg="#6d28d9">중점</Pill>}
                      <ProjTitle>{p.title || '(제목 없음)'}</ProjTitle>
                    </RowProj>
                    {/*
                      기여 방법을 **같은 줄 오른쪽**에 놓는다 (2026-08-06).
                      아래에 쌓으면 과제가 10몇 개인 칸에서 줄 수가 두 배가 된다 —
                      가로로 두면 줄 수가 과제 수 그대로다.
                      길면 2줄까지만 보이고 나머지는 잘린다(전문은 title 툴팁).
                    */}
                    {drill.detail && (
                      <NoteCell $empty={!(p.note || '').trim()} title={p.note || ''}>
                        {(p.note || '').trim() || '기여 내용 없음'}
                      </NoteCell>
                    )}
                    <Pill $bg={sc.bg} $fg={sc.fg}>{p.status || '—'}</Pill>
                    <Pill>{p.progress ?? 0}%</Pill>
                  </ProjRow>
                );
              })}
            </PanelBody>
          </Panel>
        </Backdrop>
      )}
    </Wrap>
  );
};

export default KpiMatrixView;
