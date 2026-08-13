/**
 * KPI 기여 흐름도 — 과제(왼쪽) → KPI(오른쪽) 상헤(Sankey) 형태
 *
 * 읽는 법
 *     왼쪽 박스 = 과제. 높이 = 그 과제가 기여하는 KPI 수. 왼쪽 띠 = 진행상태.
 *     오른쪽 박스 = KPI. 높이 = 기여 과제 수 → **어디에 역량이 몰렸나**.
 *     ★ 이름은 박스 **안**에 있다. 폭은 이름 자리이지 값이 아니다 (2026-08-07).
 *     선 = 연결 하나. **선 모양이 기여 등급**이다 (주/보조/간접/미지정).
 *
 * ★ 기본은 '주기여' 만 켠다 — 이 화면의 핵심 장치다
 *     전부 그리면 못 읽는다. 실측(개발서버 2026, MX) —
 *         전부      연결 69개 · 교차 443
 *         주+보조   연결 43개 · 교차 135
 *         주기여만  연결 24개 · 교차  11
 *     같은 데이터인데 읽히고 안 읽히고가 갈린다. 등급을 넣은 이유가 정확히 이거다 —
 *     `models_v2.Dt2ProjectKpi` 주석: "KPI 하나에 과제가 10몇 개씩 붙으면서 연결이
 *     전부 동등해 아무것도 못 읽는 상태가 됐다. **등급은 그 소음을 거르는 필터로
 *     쓴다**." 그래서 등급 칩이 장식이 아니라 이 그림의 조리개다.
 *
 * ★ 선 굵기는 등급에 따라 바꾸지 않는다
 *     굵기를 등급에 매면 노드 높이가 곧 **등급의 가중합**이 된다 — `relation_type`
 *     주석이 금지한 바로 그것이다("주=3·보조=2·간접=1 처럼 점수를 매겨 합하면
 *     '간접 3건'과 '주 1건'이 같아진다"). 굵기는 연결 1건으로 고정하고, 등급은
 *     **색 + 선 패턴**으로 가른다. 패턴까지 다르므로 색각 이상에서도 갈린다.
 *
 * ★ 걸러도 KPI는 전부 남긴다
 *     필터를 켜면 그 등급의 연결이 없는 KPI가 생긴다. 그 줄을 지우면 화면이
 *     "이 KPI는 없다" 고 거짓말을 한다. 빈 박스로 남겨 **'주기여 과제가 없는
 *     KPI'** 를 오히려 눈에 띄게 둔다 — 이 화면에서 빈칸은 잡음이 아니라 안건이다.
 *     (과제 쪽은 지운다. 왼쪽 목록에 이미 전부 있고, 여기서 또 세면 자리만 먹는다)
 *
 * 배치는 **결정적**이다
 *     교차를 줄이는 무게중심 스윕을 고정 횟수만 돌리고, 동점은 원래 순서로 가른다.
 *     같은 데이터면 같은 그림이 나온다 — 보고 자료에 들어가므로 그게 중요하다.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Maximize2, Minimize2, Scan } from 'lucide-react';

/*
  좌표계 — SVG 는 viewBox 라 **폭이 곧 축척**이다.
  패널이 화면 절반(2026-08-07 요청)으로 넓어지면서 430 → 620 으로 늘렸다.
  430 그대로 두고 폭만 키우면 글자만 2배로 확대될 뿐 **읽을 수 있는 이름 길이는
  그대로**다. 늘어난 폭을 축척이 아니라 **라벨 자리**로 쓰려고 좌표를 넓힌다.
  ★ 좌측 표를 걷어내고 **전체 폭**을 쓰게 되면서 620 → 1000 으로 넓혔다 (2026-08-07).
    좌표계를 그대로 두고 폭만 키우면 **글자만 확대될 뿐 읽히는 이름 길이는 그대로**다.
    늘어난 폭을 축척이 아니라 라벨 자리로 쓰려고 좌표를 같이 넓힌다.
    (본문 폭 ~1800px 기준 축척 1.8배 → 글자 약 13px)

  ★ 과제 쪽에 폭을 몰아 준다. 과제명은 사업부 배지 + 칩 안여백까지 같이 쓰는데
    KPI 이름은 맨글자라, 같은 폭을 주면 과제 쪽만 잘린다.
      과제 414 | 흐름 299 | KPI 239
*/
const VIEW_W = 1000;

/*
  노드는 **이름을 품는 넓은 박스**다 (2026-08-07 요청).

  전에는 얇은 막대(7px) 옆에 이름을 따로 그렸다. 가로가 넓어지자 막대는 실오라기처럼
  남고 이름만 떠 있어서, 어디까지가 한 덩어리인지 흐려졌다. 박스 안에 이름을 넣으면
  **노드 하나 = 상자 하나**로 읽히고, 눌러서 여는 것(과제)도 명확해진다.

  높이는 여전히 **그 노드를 지나는 흐름 수**다 — 폭이 아니라 높이가 값이다.
      1단  과제 340 | 흐름 360 | KPI 300
*/
const P_X = 0;                /* 과제 박스 왼쪽 */
const P_W = 340;              /* 과제 박스 폭 */
const X_K = 700;              /* KPI 박스 왼쪽 */
const K_W = VIEW_W - X_K;     /* KPI 박스 폭 (300) */
const BOX_PAD = 5;            /* 박스 안여백 */
const STRIPE = 4;             /* 왼쪽 상태 띠 폭 */
const PAD_Y = 10;
const GAP = 3;                /* 노드 사이 간격 */
/* 글자를 20% 줄이면서(2026-08-07 요청) 같이 내렸다 — 최소 높이는 '이름 한 줄이
   들어갈 만큼' 이라 글자 크기를 따라가야 한다. 안 내리면 줄 사이만 벌어진다. */
/* 배지·이름이 이제 박스 **안**에 들어간다 — 배지 높이 10.4 에 위아래 숨통까지
   쳐서 13. 전에는 칩이 막대 밖에 떠 있어서 11 로도 됐다. */
const P_MIN = 13;             /* 과제 노드 최소 높이 */
const K_MIN = 14;
const FONT = 7.2;             /* 9 에서 20% */
/* 세로 목표 높이(좌표계 단위). 넘어가면 한 연결이 차지하는 칸(unit)을 줄인다. */
const H_TARGET = 400;
/* 미연결 과제 띠 — 본 그림 아래 구분선·제목이 차지하는 높이.
   모델(높이 계산)과 렌더(첫 줄 y)가 **같은 값**을 봐야 띠가 어긋나지 않는다. */
const UN_TOP = 15;

/*
  2단 모드 좌표계 — 과제 | 기여방법 | KPI (2026-08-07 요청).

  1단(과제→KPI)과 자리를 아예 달리 잡는다. 가운데 열이 끼면 이름 세 덩어리가
  같은 폭을 나눠 써야 해서, 1단 값을 조금 조정하는 정도로는 어디선가 글자가 뭉갠다.
      과제 260 | 흐름 130 | 방법 230 | 흐름 130 | KPI 197
    1단과 같이 VIEW_W 1000 기준이다.
*/
const T_PX = 0;          /* 과제 박스 */
const T_PW = 250;
const T_XM = 390;        /* 기여방법 박스 */
const T_MW = 250;
const T_XK = 760;        /* KPI 박스 */
const T_KW = VIEW_W - T_XK;   /* 240 */

/** 기여 방법은 note 에 줄바꿈으로 이어져 있다 (서버 `routes_v2.NOTE_SEP` 와 같은 규칙) */
const parseNote = (note) =>
  String(note || '').split('\n').map((x) => x.trim()).filter(Boolean);

/** 기여 방법이 비어 있는 연결을 묶는 이름 — 빼면 그 연결이 그림에서 사라진다 */
const NO_METHOD = '(기여방법 미입력)';

/**
 * 기여 등급. 값·문구는 **서버(routes_v2.KPI_RELATION_TYPES)가 정본**이다.
 * 색은 과제 편집창(KpiLinkSection.RELATION_TYPES)이 쓰는 것과 맞춘다 — 거기서
 * 고른 등급이 여기서 다른 색이면 둘을 같은 것으로 못 읽는다.
 *
 * 순서는 주 → 보조 → 간접 → 미지정. 순서척도라 **더하지는 않는다**(위 머리말).
 */
const GRADES = [
  { key: 'primary',  label: '주기여',   dash: undefined, op: 0.85,
    hint: '이 과제가 없으면 그 KPI 목표 달성이 어렵다' },
  { key: 'support',  label: '보조기여', dash: '10 4',    op: 0.75,
    hint: '기여하지만 다른 과제로도 대체 가능하다' },
  { key: 'indirect', label: '간접기여', dash: '3 4',     op: 0.62,
    hint: '기반·환경을 만든다 (플랫폼·표준화 등)' },
  { key: 'none',     label: '미지정',   dash: '1 4',     op: 0.45,
    hint: '아직 등급을 안 정한 연결입니다' },
];
const GRADE_OF = (rel) => GRADES.find((g) => g.key === (rel || 'none')) || GRADES[3];

/** 등급 칩의 선 견본 색 — 등급은 이제 색이 아니라 **모양**이라 중립색으로 그린다. */
const GRADE_INK = '#475569';

/**
 * 연결선 색 = **프로세스** (2026-08-07 요청).
 *
 * 선 하나에 두 가지를 싣는다 —
 *     색   = 프로세스 (개발·제조·품질·디자인·연계)
 *     모양 = 기여 등급 (실선 / 파선 / 점선 / 성긴 점선 + 진하기)
 * 굵기는 **연결 1건으로 고정**이다. 굵기를 등급에 매면 노드 높이가 등급의 가중합이
 * 되어 `relation_type` 주석이 금지한 것이 된다(머리말 참조).
 *
 * ★ 이 다섯 색은 **고른 게 아니라 검증해서 남은 것**이다.
 *   선이 서로 교차하므로 어떤 두 색이든 붙어 보일 수 있어 '전 쌍(all-pairs)' 기준으로
 *   재야 한다. 기준 팔레트 8색에서 5색 조합 56가지를 전부 돌려 통과한 11가지 중,
 *   같은 계열이 겹치지 않는 이 조합을 골랐다 (검증 2026-08-07) —
 *       전 쌍 최악 CVD ΔE 6.9 · 일반시야 ΔE 16.3 (바닥선 15)
 *   더 어둡게 바꾼 변형들은 채도·CVD에서 오히려 떨어져 버렸다.
 *
 * ⚠️ CVD ΔE 가 6~8 구간이라 **색만으로 구분하게 두면 안 된다.** 그래서
 *    ① 프로세스 칩을 같은 색으로 칠해 범례 노릇을 하게 하고
 *    ② 칩으로 프로세스를 걸러 한두 개만 남길 수 있게 하고
 *    ③ 말풍선이 프로세스 이름을 적는다.
 * ⚠️ 청록·노랑은 흰 배경 대비가 3:1 아래다. 선을 얇게 만들지 말 것 —
 *    지금 굵기(연결 1건 = 4.5~10px)와 왼쪽 과제명이 그 몫을 대신한다.
 */
const PROC_HUES = ['#2a78d6', '#1baf7a', '#eda100', '#4a3aa7', '#e34948'];
const PROC_FALLBACK = '#94a3b8';

/* 진행상태 색 — KpiMatrixView 의 STATUS_COLOR 와 **같은 값**이어야 한다. */
const STATUS_FILL = {
  '완료': '#1d4ed8',
  '정상진행': '#a16207',
  '지연': '#b91c1c',
  '위험': '#b91c1c',
  '미착수': '#9ca3af',
};

/** 프로세스가 비어 있는 과제를 묶는 이름 */
const UNSET_PROC = '(미지정)';

/**
 * 남의 사업부 과제에 붙는 배지 색 (2026-08-07).
 *
 * ⚠️ 진행상태 색(STATUS_FILL: 파랑·황토·빨강·회색)과 **겹치지 않는 것**만 골랐다.
 *    같은 그림에서 왼쪽 띠는 진행상태, 배지는 소속이라 두 가지가 같은 색이면 섞인다.
 *    중점과제 표시(#6d28d9)와도 다르다.
 *
 * 배지 안에 **조직 이름이 그대로 들어가므로** 색이 혼자 뜻을 지지 않는다 —
 * 색만으로 구분하게 만들면 색각 이상에서 못 읽는다. 색은 눈에 먼저 띄게 하는 몫이다.
 * 지원 조직은 보통 GTR·SR·CS 셋이라 네 칸이면 충분하고, 넘치면 앞에서부터 돌려 쓴다.
 */
const DIV_BADGE = [
  { bg: '#e0e7ff', fg: '#3730a3', bd: '#a5b4fc' },   // 인디고
  { bg: '#ccfbf1', fg: '#115e59', bd: '#5eead4' },   // 청록
  { bg: '#fae8ff', fg: '#86198f', bd: '#f0abfc' },   // 자홍
  { bg: '#e2e8f0', fg: '#334155', bd: '#94a3b8' },   // 슬레이트
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const cut = (s, n) => (!s ? '' : (s.length > n ? `${s.slice(0, n - 1)}…` : s));

/** 전각(한글·한자·가나)인가 — 폭 추정에 쓴다. */
const WIDE = /[ᄀ-ᇿ㄰-㆏가-힯一-鿿぀-ヿ＀-｠]/;

/**
 * SVG 글자 폭 **추정**. 전각은 글자크기만큼, 반각은 그 55%.
 *
 * 왜 추정인가 — 배지를 이름 **바로 왼쪽**에 붙이려면 이름의 실제 폭을 알아야 하는데,
 * SVG 에서 그걸 재려면 그려 놓고 `getComputedTextLength()` 를 불러야 한다(그리기 →
 * 재기 → 다시 그리기). 배지 위치가 몇 px 어긋나는 건 티가 안 나므로 추정으로 족하다.
 * 다만 **넘치지는 않게** 아래 `fitText` 가 이 추정치로 미리 잘라 둔다.
 */
const textW = (s, size) => {
  let w = 0;
  for (const ch of String(s ?? '')) w += WIDE.test(ch) ? size : size * 0.55;
  return w;
};

/** 주어진 폭에 들어가도록 자른다. 글자 수가 아니라 **폭**으로 재므로 영문 이름이 손해 안 본다. */
const fitText = (s, maxW, size) => {
  const str = String(s ?? '');
  if (textW(str, size) <= maxW) return str;
  const ell = textW('…', size);
  let w = 0;
  let out = '';
  for (const ch of str) {
    const cw = WIDE.test(ch) ? size : size * 0.55;
    if (w + cw + ell > maxW) break;
    out += ch; w += cw;
  }
  return `${out}…`;
};

/**
 * 이름을 품은 노드 박스. (2026-08-07 요청)
 *
 * 얇은 막대와 그 옆 라벨 칩을 **하나로 합친 것**이다. 가로가 넓어지자 막대는
 * 실오라기만 남고 이름만 떠 있어서, 어디까지가 한 덩어리인지 흐려졌다.
 *
 * ★ 값은 여전히 **높이**다. 폭은 이름을 담는 자리일 뿐이니 폭을 값으로 읽으면 안 된다.
 *   (그래서 한 단 안의 박스는 폭이 모두 같다 — 다르면 폭이 뜻을 갖는 것처럼 보인다)
 *
 * stripe 는 박스와 **다른 축**을 겹쳐 실을 때 쓴다(과제의 진행상태). 채움색으로 쓰면
 * 그 위의 글씨가 죽어서, 띠로 뺐다.
 */
const NodeBox = ({
  x, y, w, h, fill, stroke, strokeWidth = 0.7, dash,
  stripe, badge, label, tail, textFill, bold,
  onClick, onDoubleClick, title,
}) => {
  const mid = y + h / 2;
  const tailW = tail != null ? textW(String(tail), FONT) + 5 : 0;
  const badgeW = badge ? textW(badge.text, FONT * 0.92) + 7 : 0;
  const bx = x + BOX_PAD + (stripe ? STRIPE + 2 : 0);
  const tx = bx + (badge ? badgeW + 3 : 0);
  const shown = fitText(label, Math.max(x + w - BOX_PAD - tailW - tx, 8), FONT);
  return (
    <g onClick={onClick ? (e) => { e.stopPropagation(); onClick(e); } : undefined}
       onDoubleClick={onDoubleClick ? (e) => { e.stopPropagation(); onDoubleClick(e); } : undefined}
       style={(onClick || onDoubleClick) ? { cursor: 'pointer' } : undefined}>
      <rect x={x} y={y} width={w} height={h} rx={3}
            fill={fill} stroke={stroke} strokeWidth={strokeWidth}
            strokeDasharray={dash} />
      {stripe && (
        <rect x={x + 1.2} y={y + 1.2} width={STRIPE}
              height={Math.max(h - 2.4, 0.8)} rx={1.4} fill={stripe} />
      )}
      {badge && (
        <>
          <rect x={bx} y={mid - 5.2} width={badgeW} height={10.4} rx={3}
                fill={badge.bg} stroke={badge.bd} strokeWidth={0.6} />
          <text x={bx + badgeW / 2} y={mid + 2.9} textAnchor="middle"
                fontSize={FONT * 0.92} fontWeight="700" fill={badge.fg}>{badge.text}</text>
        </>
      )}
      <text x={tx} y={mid + 2.9} fontSize={FONT}
            fontWeight={bold ? 700 : 400} fill={textFill}>{shown}</text>
      {tail != null && (
        <text x={x + w - BOX_PAD} y={mid + 2.9} textAnchor="end" fontSize={FONT}
              fontWeight="700" fill={textFill} opacity={0.7}>{tail}</text>
      )}
      {title && <title>{title}</title>}
    </g>
  );
};

/* ── 화면 ──────────────────────────────────────────────────────────────────── */

/* 사슬의 끝 — 부모(FullFlow)가 준 높이를 받아 캔버스에 넘긴다.
   min-height:0 이 있어야 캔버스가 내용보다 작아질 수 있다. */
const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1 1 0;
  min-height: 0;

  /*
    전체화면 (2026-08-07 요청). 브라우저가 이 요소를 화면 크기로 만들어 주므로
    (UA 기본값이 width/height 100% !important) 높이는 손댈 게 없다. 손댈 것은 둘:

      ① 배경. 전체화면 요소는 기본이 투명이고 그 뒤(::backdrop)는 검정이라,
         칠하지 않으면 글자만 뜬 검은 화면이 된다.
      ② 여백. 평소엔 본문(Body)의 패딩 안에 있었는데 전체화면에선 그게 없어져
         조작줄이 화면 모서리에 딱 붙는다.

    자식들의 flex 규칙은 그대로 살아 있어서 캔버스가 늘어난 만큼을 다 가져간다.
  */
  &:fullscreen {
    background: #f8fafc;
    padding: 0.75rem 1rem;
    gap: 0.6rem;
  }
`;

/* 제목·건수도 조작줄 **안**에 산다 (2026-08-07 요청) — 아래 Chips 머리말 참고.
   따로 서던 Head 줄은 없앴다. */
const Title = styled.div`
  font-size: 0.82rem;
  font-weight: 700;
  color: #374151;
  white-space: nowrap;
`;

const HeadNum = styled.div`
  font-size: 0.72rem;
  color: #6b7280;
  white-space: nowrap;
`;

/** 미연결 건수는 **경고색**으로 — 이 화면이 찾는 것이라 숫자에 묻히면 안 된다. */
const UnMark = styled.span`
  color: #b45309;
  font-weight: 700;
`;

/*
  조작줄은 **한 줄**이다 (2026-08-07 요청).

  제목("기여 흐름")·건수·등급 칩·프로세스 칩이 세 줄로 나뉘어 있었는데, 전체 폭이
  되면서 세 줄 다 오른쪽이 텅 비어 그림만 아래로 밀렸다. 한 줄에 다 들어간다
  (대략 1200px, 자리는 1800px 남짓). 좁아지면 flex-wrap 이 알아서 접고,
  접히는 자리는 아래 Sep 이 정해 준다.
*/
const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
`;

/*
  사업부 고르기 (2026-08-07 요청).

  **전체화면에서만** 낸다. 전체화면에 들어가면 위쪽 사업부 탭이 화면 밖으로 나가
  사업부를 바꿀 길이 없어지는데, 그 자리를 메우는 것이다.
  평소에는 탭이 바로 위에 있으니 내지 않는다 — 같은 일을 하는 것이 둘이면
  어느 쪽이 정본인지 헷갈리고, 조작줄만 길어진다.

  네이티브 <select> 를 쓴다. 직접 만든 펼침 목록은 전체화면 안에서 쌓임 맥락을
  따로 챙겨야 하는데, 네이티브는 브라우저가 화면 위에 띄워 주므로 그럴 일이 없다.
  키보드·화면낭독기도 공짜로 따라온다.
*/
const DivPick = styled.select`
  padding: 0.15rem 0.4rem;
  border-radius: 0.35rem;
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #1f2937;
  font-size: 0.72rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  max-width: 11rem;
  &:hover { border-color: #94a3b8; }
  &:focus-visible { outline: 2px solid #6366f1; outline-offset: 1px; }
`;

/** 미연결 과제 일괄 연결 — 경고색을 그대로 쓴다. 이 단추가 가리키는 것이
    바로 그 경고(미연결)라, 색이 다르면 둘이 남남으로 보인다. */
const LinkAllBtn = styled.button`
  padding: 0.15rem 0.5rem;
  border-radius: 0.35rem;
  border: 1px solid #fcd34d;
  background: #fffbeb;
  color: #92400e;
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  &:hover { background: #fef3c7; border-color: #f59e0b; }
`;

/** 기여방법이 빈 연결로 바로 가는 단추. 미연결(주황)과 **다른 일**이라 색을 달리한다 —
    미연결은 '연결이 없다', 이건 '연결은 있는데 내용이 없다'. */
const NoMethodBtn = styled.button`
  padding: 0.15rem 0.5rem;
  border-radius: 0.35rem;
  border: 1px solid #99f6e4;
  background: #f0fdfa;
  color: #115e59;
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  &:hover { background: #ccfbf1; border-color: #0f766e; }
`;

/** 두 필터 가족을 가르는 세로 줄. 한 줄로 붙이면 등급 칩과 프로세스 칩이
    한 덩어리로 보이는데, 등급은 '연결'을 프로세스는 '과제'를 거른다 — 다른 것이다. */
const Sep = styled.span`
  width: 1px;
  align-self: stretch;
  min-height: 1rem;
  margin: 0 0.25rem;
  background: #e5e7eb;
`;

/** 등급 칩 = 이 그림의 조리개. 꺼진 칩도 건수를 보여 준다 — 뭘 감췄는지 알아야 한다. */
const Chip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$on ? p.$c : '#e5e7eb')};
  background: ${(p) => (p.$on ? '#fff' : '#f9fafb')};
  color: ${(p) => (p.$on ? '#1f2937' : '#9ca3af')};
  font-size: 0.68rem;
  font-weight: ${(p) => (p.$on ? 700 : 400)};
  cursor: pointer;
  &:hover { border-color: ${(p) => p.$c}; }
`;

/* 프로세스 필터 — 대시보드(`DashboardView` 진행률 현황)의 프로세스 칩과 같은 모양.
   등급 칩과 색을 달리한다: 등급은 '연결'을, 이건 '과제'를 거르므로 성격이 다르다. */
const ProcLabel = styled.span`
  font-size: 0.68rem;
  font-weight: 700;
  color: #475569;
  align-self: center;
  white-space: nowrap;
`;

/* 칩 색 = **그 프로세스의 선 색**. 필터이면서 동시에 색 범례 노릇을 한다 —
   선 색이 뭘 뜻하는지 알려면 어딘가에 적혀 있어야 하는데, 필터가 이미 이름을
   들고 있으니 여기가 그 자리다. */
const ProcChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$on ? p.$c : '#d1d5db')};
  background: ${(p) => (p.$on ? p.$c : '#fff')};
  color: ${(p) => (p.$on ? '#fff' : '#6b7280')};
  font-size: 0.68rem;
  font-weight: ${(p) => (p.$on ? 700 : 500)};
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
  &:hover { border-color: ${(p) => p.$c}; }
`;

/** 칩이 꺼져 있어도 색을 보여 주는 점 — 범례는 필터 상태와 무관해야 한다. */
const ProcDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
  display: inline-block;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.7) inset;
`;

const ProcReset = styled.button`
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px solid #e2e8f0;
  background: #f1f5f9;
  color: #64748b;
  font-size: 0.65rem;
  cursor: pointer;
  white-space: nowrap;
  &:hover { border-color: #cbd5e1; }
`;

/** 기여방법 단 on/off — 그림의 구조 자체를 바꾸므로 필터 칩과 모양을 달리한다.
    조작줄 **맨 왼쪽**이다 (2026-08-07 요청). 그림이 1단이냐 2단이냐를 정하는 것이라
    나머지(무엇을 거를까)보다 앞선다 — 이걸 켜면 가운데 단이 통째로 생긴다. */
const StageToggle = styled.button`
  padding: 0.15rem 0.55rem;
  border-radius: 0.35rem;
  border: 1px solid ${(p) => (p.$on ? '#0f766e' : '#d1d5db')};
  background: ${(p) => (p.$on ? '#0f766e' : '#fff')};
  color: ${(p) => (p.$on ? '#fff' : '#6b7280')};
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  &:hover { border-color: #0f766e; }
`;

/* ── KPI 고르기 (2026-08-07) ──────────────────────────────────────────────────
   등급 칩처럼 늘어놓지 않는다 — KPI는 12개가 넘고 이름이 길어 칩으로 깔면 그림보다
   필터가 커진다. 매트릭스의 '표시할 지표' 와 **같은 모양**의 접이식 목록을 쓴다. */
const PickWrap = styled.div`
  position: relative;
  margin-left: auto;   /* 조작줄 오른쪽 끝 — 기여방법 토글이 왼쪽으로 가며 되돌아왔다 */
`;

const PickBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$filtered ? '#f59e0b' : '#e5e7eb')};
  background: ${(p) => (p.$filtered ? '#fffbeb' : '#fff')};
  color: ${(p) => (p.$filtered ? '#b45309' : '#4b5563')};
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  &:hover { border-color: #6366f1; }
`;

const PickOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 20;
`;

const PickPanel = styled.div`
  position: absolute;
  top: calc(100% + 0.3rem);
  right: 0;
  z-index: 30;
  width: 19rem;
  max-height: 21rem;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
  padding: 0.45rem;
`;

const PickHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.1rem 0.35rem 0.4rem;
  font-size: 0.72rem;
  font-weight: 700;
  color: #374151;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 0.25rem;
`;

const PickLink = styled.button`
  border: 0;
  background: none;
  padding: 0;
  font-size: 0.7rem;
  font-weight: 400;
  color: #6b7280;
  text-decoration: underline;
  cursor: pointer;
  &:hover { color: #2563eb; }
`;

const PickItem = styled.label`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.35rem;
  border-radius: 0.35rem;
  font-size: 0.74rem;
  color: #374151;
  cursor: pointer;
  &:hover { background: #f8fafc; }
  input { flex-shrink: 0; }
`;

const PickNo = styled.span`
  flex-shrink: 0;
  width: 15px;
  font-variant-numeric: tabular-nums;
  color: #6b7280;
  font-size: 0.68rem;
  text-align: right;
`;

const PickName = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PickCount = styled.span`
  flex-shrink: 0;
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
  color: ${(p) => (p.$zero ? '#dc2626' : '#9ca3af')};
`;

/*
  캔버스는 **남은 화면을 채우고, 넘치면 자기 안에서 스크롤한다** (2026-08-07 요청).

  그림이 길어지면 바깥(본문)이 스크롤됐다. 그러면 조작줄(등급·프로세스 칩)까지 같이
  위로 밀려 올라가, 필터를 만지려면 매번 맨 위로 되돌아가야 했다. 안쪽에서 스크롤하면
  조작줄과 범례는 제자리에 남는다.

  높이는 **CSS 높이 사슬**이 정한다. 위에 뭐가 얼마나 쌓여 있는지(헤더·보기 토글·
  사업부 탭·조작줄, 게다가 조작줄은 좁아지면 접힌다)를 이 컴포넌트가 알 필요가 없다 —
  Container(100vh) 부터 이어진 높이를 받아 flex 가 남은 만큼을 준다.
  사슬을 어디서 이었는지는 KpiMatrixView 의 Wrap 머리말 참고.
*/
const Canvas = styled.div`
  position: relative;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.55rem;
  padding: 0.3rem;
  overflow: hidden;              /* 스크롤은 안쪽 Scroller 가 진다 */
  /* 조작줄·설명줄이 제 높이를 가져가고 **남은 전부**를 캔버스가 갖는다.
     화면 크기·해상도·조작줄이 몇 줄로 접혔는지와 무관하게 늘 딱 맞는다. */
  flex: 1 1 0;
  min-height: 200px;             /* 세로가 아주 짧은 화면에서의 바닥 */
`;

/** 실제로 스크롤되는 상자. 가로는 늘 화면 폭에 맞으므로 **세로만** 넘친다. */
const Scroller = styled.div`
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;  /* 끝까지 굴려도 바깥 페이지로 안 넘어간다 */
`;

/** 그림이 놓이는 상자. 폭은 **늘 100%** — 밀도는 viewBox 가 지므로 여기서 안 건드린다.
    Tip 의 % 좌표가 그림 좌표와 맞아떨어지려면 **이 상자**가 기준이어야 한다. */
const ZoomBox = styled.div`
  position: relative;
  width: 100%;
  > svg { display: block; width: 100%; height: auto; }
`;

/** 줌 단추 — 스크롤해도 따라다녀야 하므로 Scroller **밖**(Canvas 위)에 띄운다. */
const ZoomBar = styled.div`
  position: absolute;
  top: 0.4rem;
  right: 0.55rem;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.1rem;
  border-radius: 0.4rem;
  border: 1px solid #e5e7eb;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(2px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
`;

const ZoomBtn = styled.button`
  min-width: 1.35rem;
  padding: 0.1rem 0.3rem;
  /* −/＋ 는 글자, 전체화면은 아이콘이다 — 둘을 같은 높이에 세우려면 flex 가 필요하다 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 0.3rem;
  background: transparent;
  color: #475569;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.2;
  cursor: pointer;
  &:hover:not(:disabled) { background: #f1f5f9; }
  &:disabled { color: #cbd5e1; cursor: default; }
`;

/** 줌 단추들과 전체화면 단추를 가르는 세로 줄 — 하는 일이 다르다. */
const ZoomSep = styled.span`
  width: 1px;
  align-self: stretch;
  margin: 0.1rem 0.15rem;
  background: #e5e7eb;
`;

/** 배율 표시 겸 '맞춤' 단추 — 누르면 폭 맞춤(100%)으로 돌아온다. */
const ZoomNow = styled.button`
  min-width: 2.6rem;
  padding: 0.1rem 0.25rem;
  border: 0;
  border-radius: 0.3rem;
  background: transparent;
  color: ${(p) => (p.$fit ? '#94a3b8' : '#0f766e')};
  font-size: 0.68rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  &:hover { background: #f1f5f9; }
`;

/*
  줌 = **세로 밀도**다. 가로 배치는 안 건드린다 (2026-08-07, A안).

  왜 이 방향인가 — 이 그림은 **세로로만 넘친다.**
    · 가로는 데이터와 무관하게 1000단위 고정이고(과제 340│흐름 360│KPI 300),
      실제 이름을 다 재 보니 과제는 1.82배, KPI는 2.69배까지 키워도 안 잘린다.
    · 세로는 사업부에 따라 609~914px 인데 캔버스는 1080p 750px · 노트북 438px 다.
      즉 필요한 건 0.48~1배 **축소**이고, 그 범위가 가로 여유 안에 통째로 들어간다.

  기하학적 줌(전체를 같은 비율로)으로 같은 세로 압축을 하면 글자 크기는 똑같은데
  그림만 화면 구석의 작은 사각형이 된다 — 선이 짧아져 어느 과제가 어느 KPI로 가는지
  오히려 따라가기 어렵다. 남는 가로를 버릴 이유가 없다.

  구현은 **가로 좌표계를 넓히는 것**으로 한다. 글자·상자·행높이 상수를 전부 건드리는
  대신(수십 군데에 흩어져 있다), x 좌표 11개만 1/d 로 늘린다. viewBox 가 넓어지니
  같은 화면 폭에 d배로 작게 그려지고, 열은 여전히 폭을 꽉 채운다. 세로 계산(model)은
  x 를 아예 안 쓰므로 **한 줄도 안 바뀐다.**

  ⚠️ SVG transform: scale(sx,1) 로는 못 한다 — 글자가 가로로 늘어난다.

  1.8 에서 자른 이유: 그 위로는 과제 이름이 잘리기 시작한다(위 1.82배).
*/
const ZOOMS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.2, 1.4, 1.6, 1.8];

/** 설명문에서 '남의 사업부' 표기를 그림과 **같은 색**으로 보여 준다 */
const OtherMark = styled.b`
  display: inline-block;
  padding: 0 0.3rem;
  border-radius: 0.25rem;
  background: #e0e7ff;
  border: 1px solid #a5b4fc;
  color: #3730a3;
  font-weight: 700;
`;

const Caption = styled.div`
  font-size: 0.7rem;
  line-height: 1.5;
  color: #6b7280;
  b { color: #374151; font-weight: 700; }
`;

const Tip = styled.div`
  position: absolute;
  z-index: 5;
  width: 220px;
  padding: 0.45rem 0.55rem;
  background: #111827;
  color: #f9fafb;
  border-radius: 0.35rem;
  font-size: 0.7rem;
  line-height: 1.45;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
`;

const TipTitle = styled.div`
  font-weight: 700;
  margin-bottom: 0.15rem;
`;

const TipLine = styled.div`
  color: #d1d5db;
  em { font-style: normal; color: #fff; font-weight: 600; }
`;

const Empty = styled.div`
  padding: 1.5rem 0.75rem;
  text-align: center;
  font-size: 0.75rem;
  color: #9ca3af;
`;

/**
 * @param rows [{ kpi, cell }] — 그 사업부가 관리하는 KPI 줄. **좌측 목록과 같은 순서**
 *             (오른쪽 번호가 목록 순번과 맞아야 둘을 이을 수 있다)
 */
const KpiContributionFlow = ({
  rows, division, onOpenProject, settingsData, unlinked = [],
  divisions = [], onDivisionChange, onBulkLink,
}) => {
  const [on, setOn] = useState(() => new Set(['primary']));
  /**
   * 감출 KPI (2026-08-07 요청). **감출 쪽을** 들고 있는다 — 보일 쪽을 들면 지표가
   * 새로 생겼을 때 기본이 '안 보임' 이 되어 조용히 빠진다.
   *
   * 등급 필터와 달리 감춘 KPI 줄은 **아예 지운다.** 등급 필터로 빈 줄은 "주기여가
   * 없다" 는 사실이라 남겨야 하지만, 이건 사용자가 직접 뺀 것이라 남길 이유가 없다.
   */
  const [offKpis, setOffKpis] = useState(() => new Set());
  /**
   * 프로세스 필터 (개발·제조·품질·디자인 …). **빈 Set = 전부 보기** (2026-08-07 요청).
   *
   * 등급 칩과 규칙이 반대다. 등급은 '켠 것만' 이라 마지막 하나를 못 끄지만, 여기는
   * '고른 것만' 이고 아무것도 안 고르면 제한이 없다 — 대시보드의 프로세스 필터
   * (`DashboardView.trendSelectedProcesses`)와 **같은 규칙**이라 익숙한 대로 동작한다.
   */
  const [onProcs, setOnProcs] = useState(() => new Set());
  /**
   * 기여방법을 **가운데 단으로 세울지** (2026-08-07 요청).
   *
   * 켜면 과제 → 기여방법 → KPI 의 2단이 된다. 연결 1건에 방법이 n개면 **n개의 흐름**이
   * 되므로 선이 늘어난다 — 그래서 기본은 꺼 둔다. 등급·프로세스 필터가 그대로 먹으니
   * 좁혀 놓고 켜는 것이 이 모드를 읽는 방법이다.
   */
  const [twoStage, setTwoStage] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pickOpen, setPickOpen] = useState(false);
  /*
    강조 대상 — **클릭으로 고른다.** (2026-08-10 요청)

    🐞 예전에는 **마우스를 올리기만 해도** 강조가 바뀌었다. 그림 위를 지나가는
       내내 강조가 따라다녀서, 무엇을 보려던 것인지도 모르게 화면이 계속 흔들렸다.
       이제 **누른 것만** 강조하고, 다시 누르면 풀린다. 빈 곳을 눌러도 풀린다.

    ⚠️ 그래서 예전에 클릭이 하던 일(과제 상세 열기)은 **더블클릭**으로 옮겼다.
       한 손짓에 두 가지를 시킬 수 없다.
  */
  const [pickP, setPickP] = useState(null);
  const [pickK, setPickK] = useState(null);
  const [pickL, setPickL] = useState(null);
  /* 2단에만 있는 가운데 단(기여방법). 1단에는 이 단이 없어 쓰이지 않는다. */
  const [pickM, setPickM] = useState(null);

  /** 하나만 고른다 — 과제를 고르면 KPI 선택은 풀린다. 같은 것을 다시 누르면 해제. */
  const pickOne = (kind, id) => {
    setPickP(kind === 'p' && pickP !== id ? id : null);
    setPickK(kind === 'k' && pickK !== id ? id : null);
    setPickM(kind === 'm' && pickM !== id ? id : null);
    setPickL(kind === 'l' && pickL !== id ? id : null);
  };
  const clearPick = () => { setPickP(null); setPickK(null); setPickM(null); setPickL(null); };

  /* 등급별 전체 건수 — 칩에 적는다. 필터와 무관하게 늘 전체를 센다. */
  const totals = useMemo(() => {
    const t = { primary: 0, support: 0, indirect: 0, none: 0 };
    rows.forEach(({ cell }) => cell.projects.forEach((p) => { t[p.rel || 'none'] += 1; }));
    return t;
  }, [rows]);

  /**
   * 이 화면에 **실제로 있는** 프로세스만 칩으로 낸다.
   * 설정의 전체 목록을 쓰면 이 사업부에 하나도 없는 프로세스가 눌러도 아무 일 없는
   * 칩으로 남는다. 건수를 같이 보여 주면 누르기 전에 결과를 짐작할 수 있다.
   */
  const procCounts = useMemo(() => {
    const seen = new Map();          // 프로세스 → 과제 uuid 집합 (중복 제거)
    rows.forEach(({ cell }) => cell.projects.forEach((p) => {
      const k = p.process || UNSET_PROC;
      if (!seen.has(k)) seen.set(k, new Set());
      seen.get(k).add(p.uuid);
    }));
    /* 순서는 **설정(`settingsData.processes`) 배열 순서**다 — 개발·제조·품질·디자인·연계.
       '진행률 현황'(DashboardView.availableProcesses)이 쓰는 것과 같은 근거를 써야
       화면을 옮길 때마다 순서를 다시 익히지 않는다. 건수 순으로 세우면 데이터가
       조금만 바뀌어도 칩이 자리를 바꿔 손이 기억한 위치가 어긋난다.
       설정에 없는 값과 `(미지정)` 은 뒤로 보낸다. */
    const order = new Map(
      ((settingsData || {}).processes || []).map((x, i) => [x?.name, i]));
    const rank = (name) => (name === UNSET_PROC ? 1e6
      : (order.has(name) ? order.get(name) : 1e5));
    return [...seen.entries()]
      .map(([name, s]) => ({ name, n: s.size }))
      .sort((a, b) => (rank(a.name) - rank(b.name))
        || a.name.localeCompare(b.name, 'ko'));
  }, [rows, settingsData]);

  const procOf = (p) => (p.process || UNSET_PROC);

  /* 번호는 **원래 목록 순번**을 그대로 쓴다. KPI를 감춰도 남은 것의 번호가 밀리면
     안 된다 — 좌측 목록과 안 맞게 된다. */
  const shown = useMemo(
    () => rows.map((r, i) => ({ ...r, no: i + 1 })).filter((r) => !offKpis.has(r.kpi.kpiDefinitionId)),
    [rows, offKpis],
  );

  const model = useMemo(() => {
    // 1) 켜진 등급의 연결만 추린다 (감춘 KPI 는 shown 에서 이미 빠졌다)
    const links = [];
    const projMap = new Map();
    shown.forEach(({ kpi, cell, no }) => {
      cell.projects.forEach((p) => {
        const g = p.rel || 'none';
        if (!on.has(g)) return;
        // 프로세스 필터 — 아무것도 안 고르면 제한 없음 (onProcs 머리말)
        if (onProcs.size && !onProcs.has(procOf(p))) return;
        if (!projMap.has(p.uuid)) {
          projMap.set(p.uuid, {
            uuid: p.uuid, title: p.title, code: p.code, division: p.division,
            status: p.status, progress: p.progress, isKey: p.isKey, n: 0,
            // 지금 보고 있는 사업부가 아닌 곳의 과제 = 기능조직(GTR·SR·CS) 지원.
            // 소속이 비어 있으면 '남의 것' 이라고 단정하지 않는다.
            isOther: !!p.division && p.division !== division,
          });
        }
        projMap.get(p.uuid).n += 1;
        links.push({
          key: `${kpi.kpiDefinitionId}|${p.uuid}`,
          p: p.uuid, k: kpi.kpiDefinitionId, grade: g,
          note: p.note, kpiNo: no, kpiLabel: kpi.label, title: p.title,
          proc: procOf(p),
        });
      });
    });

    /*
      미연결 과제 — **어느 KPI에도 안 걸린** 과제. (2026-08-07 요청)
      흐름에 낄 선이 없으므로 본 그림 아래 별도 띠에 세운다. 억지로 오른쪽에
      '미연결' 가짜 노드를 만들어 잇는 방법도 있지만, 그러면 없는 연결을 그리는 것이다.
      선이 하나도 안 나가는 모습 자체가 "이 과제는 아무 KPI에도 기여하지 않는다" 라는
      뜻이고, 이 화면에서 그건 잡음이 아니라 안건이다(파일 머리말).

      등급 필터는 안 받는다 — 연결이 없으니 등급도 없다. 프로세스 필터만 받는다.
    */
    const un = (unlinked || [])
      .filter((p) => !onProcs.size || onProcs.has(procOf(p)))
      .map((p) => ({
        uuid: p.uuid, title: p.title, code: p.code, division: p.division,
        status: p.status, progress: p.progress, isKey: p.isKey, n: 0,
        isOther: !!p.division && p.division !== division,
      }));
    const unH = un.length
      ? UN_TOP + un.length * P_MIN + (un.length - 1) * GAP + 4
      : 0;

    // 남긴 KPI 는 **전부** 그린다 — 등급 필터로 비워진 줄도 (머리말 참조).
    // 과제는 연결이 남은 것만.
    const kpiNodes = shown.map(({ kpi, cell, no }) => ({
      id: kpi.kpiDefinitionId, no, label: kpi.label,
      n: links.filter((l) => l.k === kpi.kpiDefinitionId).length,
      all: cell.projects.length,
    }));
    const projNodes = [...projMap.values()];

    /*
      2) 한 연결 = 한 칸. 세로가 길어지면 칸을 줄인다.

      ⚠️ 연결이 0개인 경우를 **여기서 끊지 않는다** (2026-08-08 수정).
         전에는 바로 위에서 `if (!links.length) return {...}` 로 빠져나갔는데, 그 반환값에는
         자리표(yp·yk)가 없었다. 그런데 렌더는 **연결 0 이고 미연결도 0** 일 때만 Empty 로
         빠진다 — 즉 *연결은 0인데 미연결 과제가 있는* 사업부에서는 그림을 그리러 들어가
         `yk.get(...)` 에서 터졌다. 켜 둔 등급의 연결이 하나도 안 남는 조합에서 실제로 난다.

         아래 계산은 links 가 비어도 그대로 성립한다 — 과제 쪽은 빈 배열이고 KPI 쪽은 전부
         n=0(최소 높이)이라 **KPI가 모두 빈 박스로 선 그림**이 나온다. 그게 오히려 이 화면이
         원하는 모습이다(머리말: 걸러도 KPI는 전부 남긴다, 빈칸은 잡음이 아니라 안건이다).
         0으로 나누는 곳만 짚어 준다.
    */
    const unit = links.length ? clamp(H_TARGET / links.length, 4.5, 10) : 10;
    const pH = (d) => Math.max(d.n * unit, P_MIN);
    const kH = (d) => Math.max(d.n * unit, K_MIN);
    const stack = (arr, h) => arr.reduce((s, d) => s + h(d), 0) + GAP * Math.max(arr.length - 1, 0);
    const H = Math.max(stack(projNodes, pH), stack(kpiNodes, kH)) + PAD_Y * 2;

    const place = (arr, h) => {
      const tot = stack(arr, h);
      let y = PAD_Y + (H - PAD_Y * 2 - tot) / 2;
      const m = new Map();
      arr.forEach((d) => { m.set(d.id ?? d.uuid, [y, y + h(d)]); y += h(d) + GAP; });
      return m;
    };

    // 3) 과제 줄 세우기 — 자기가 걸린 KPI들의 무게중심 순. 동점은 원래 순서(결정적).
    const pIdx = new Map(projNodes.map((d, i) => [d.uuid, i]));
    const adjP = new Map(); const adjK = new Map();
    links.forEach((l) => {
      if (!adjP.has(l.p)) adjP.set(l.p, []);
      if (!adjK.has(l.k)) adjK.set(l.k, []);
      adjP.get(l.p).push(l.k);
      adjK.get(l.k).push(l.p);
    });
    /*
      ⚠️ KPI 순서는 **좌측 목록 그대로 고정**이다 (2026-08-07 요청).
         한때는 이쪽도 무게중심으로 재배열해 교차를 줄였다(MX 주기여 65 → 11).
         그런데 그러면 오른쪽이 1,2,3… 순서가 아니게 되어 **번호가 목록과 안 맞는다.**
         번호는 이 그림과 좌측 목록을 잇는 유일한 끈이라, 교차보다 그게 먼저다.
         (교차 65는 필터를 켠 상태 기준이다. 전부 켜면 443이라 못 읽는다 — 등급
          필터가 이 그림의 조리개인 이유가 여기 있다. 머리말 참조)

      그래서 스윕이 필요 없다. KPI 자리가 고정이면 과제의 무게중심도 한 번에
      정해진다 — 반복은 결과를 못 바꾼다.
    */
    const ko = kpiNodes.slice();
    const yk = place(ko, kH);
    const ck = (id) => { const s = yk.get(id); return (s[0] + s[1]) / 2; };
    const po = projNodes.slice().sort((a, b) => {
      const la = adjP.get(a.uuid) || []; const lb = adjP.get(b.uuid) || [];
      const ma = la.reduce((s, k) => s + ck(k), 0) / Math.max(la.length, 1);
      const mb = lb.reduce((s, k) => s + ck(k), 0) / Math.max(lb.length, 1);
      return (ma - mb) || (pIdx.get(a.uuid) - pIdx.get(b.uuid));
    });
    const yp = place(po, pH);

    // 4) 노드 안에서 선이 붙는 자리 — 반대편 중심 순서대로 쌓아야 덜 꼬인다
    const midK = new Map(ko.map((d) => [d.id, (yk.get(d.id)[0] + yk.get(d.id)[1]) / 2]));
    const midP = new Map(po.map((d) => [d.uuid, (yp.get(d.uuid)[0] + yp.get(d.uuid)[1]) / 2]));
    const anchorP = new Map(); const anchorK = new Map();
    po.forEach((d) => {
      const ks = (adjP.get(d.uuid) || []).slice().sort((a, b) => midK.get(a) - midK.get(b));
      const [a, b] = yp.get(d.uuid); const step = (b - a) / Math.max(ks.length, 1);
      ks.forEach((k, i) => anchorP.set(`${k}|${d.uuid}`, a + step * (i + 0.5)));
    });
    ko.forEach((d) => {
      const us = (adjK.get(d.id) || []).slice().sort((a, b) => midP.get(a) - midP.get(b));
      const [a, b] = yk.get(d.id); const step = (b - a) / Math.max(us.length, 1);
      us.forEach((u, i) => anchorK.set(`${d.id}|${u}`, a + step * (i + 0.5)));
    });

    // 주기여가 위에 오도록 그리는 순서를 정한다 (겹칠 때 중요한 것이 보여야 한다)
    const rank = { none: 0, indirect: 1, support: 2, primary: 3 };
    const drawn = links
      .map((l) => ({
        ...l,
        y1: anchorP.get(l.key), y2: anchorK.get(l.key),
        w: Math.max(unit - 1.5, 2.5),
      }))
      .sort((a, b) => rank[a.grade] - rank[b.grade]);

    return {
      links: drawn, kpiNodes: ko, projNodes: po, yp, yk, H,
      un, unH, totalH: H + unH,
      // 남긴 KPI 안에서 **등급 필터 때문에** 사라진 과제 수. 감춘 KPI 몫은 안 센다 —
      // 그건 사용자가 직접 뺀 것이라 "감췄습니다" 라고 알릴 일이 아니다.
      hiddenProj: new Set(shown.flatMap(({ cell }) => cell.projects.map((p) => p.uuid))).size
                  - projNodes.length,
    };
  }, [shown, on, onProcs, division, unlinked]);


  /**
   * 2단 모델 — 과제 → 기여방법 → KPI. (2026-08-07)
   *
   * ★ 연결 1건에 방법이 n개면 **n개의 흐름**이 된다.
   *   방법마다 따로 세지 않으면 "이 KPI에 A 방법으로도, B 방법으로도 기여" 라는
   *   사실이 한 줄로 뭉개져 가운데 단을 세운 뜻이 없어진다.
   *   흐름 하나는 여전히 **자기 색(프로세스)과 모양(등급)** 을 그대로 지닌다 —
   *   합치면 그 두 가지를 잃는다.
   *
   * ★ 방법이 비어 있는 연결도 **버리지 않는다**. `(기여방법 미입력)` 으로 묶어 세운다.
   *   빼 버리면 그 연결이 그림에서 사라져, 켜고 끄는 것만으로 숫자가 달라진다.
   *
   * 노드 높이 = 그 노드를 지나는 흐름 수. KPI 순서는 1단과 같이 **목록 순서 고정**이고,
   * 방법·과제는 무게중심으로 세워 교차를 줄인다(결정적 — 동점은 원래 순서).
   */
  const model2 = useMemo(() => {
    if (!twoStage) return null;

    const items = [];
    shown.forEach(({ kpi, cell, no }) => {
      cell.projects.forEach((p) => {
        const g = p.rel || 'none';
        if (!on.has(g)) return;
        if (onProcs.size && !onProcs.has(procOf(p))) return;
        const ms = parseNote(p.note);
        (ms.length ? ms : [NO_METHOD]).forEach((m) => {
          items.push({
            key: `${kpi.kpiDefinitionId}|${p.uuid}|${m}`,
            p: p.uuid, k: kpi.kpiDefinitionId, m,
            grade: g, proc: procOf(p),
            title: p.title, kpiLabel: kpi.label, kpiNo: no,
            division: p.division,
            isOther: !!p.division && p.division !== division,
            status: p.status, progress: p.progress, isKey: p.isKey,
          });
        });
      });
    });

    const projMap = new Map();
    const methMap = new Map();
    items.forEach((it) => {
      if (!projMap.has(it.p)) {
        projMap.set(it.p, {
          uuid: it.p, title: it.title, division: it.division, isOther: it.isOther,
          status: it.status, progress: it.progress, isKey: it.isKey, n: 0,
        });
      }
      projMap.get(it.p).n += 1;
      if (!methMap.has(it.m)) methMap.set(it.m, { id: it.m, label: it.m, n: 0 });
      methMap.get(it.m).n += 1;
    });

    const kpiNodes = shown.map(({ kpi, cell, no }) => ({
      id: kpi.kpiDefinitionId, no, label: kpi.label,
      n: items.filter((x) => x.k === kpi.kpiDefinitionId).length,
      all: cell.projects.length,
    }));
    const projNodes = [...projMap.values()];
    const methNodes = [...methMap.values()];
    if (!items.length) return { items: [], kpiNodes, projNodes: [], methNodes: [], H: 0 };

    const unit = clamp(H_TARGET / items.length, 4.5, 10);
    const hOf = (d) => Math.max(d.n * unit, P_MIN);
    const kH = (d) => Math.max(d.n * unit, K_MIN);
    const stack = (arr, h) => arr.reduce((a, d) => a + h(d), 0) + GAP * Math.max(arr.length - 1, 0);
    const H = Math.max(stack(projNodes, hOf), stack(methNodes, hOf), stack(kpiNodes, kH)) + PAD_Y * 2;

    const place = (arr, h) => {
      const tot = stack(arr, h);
      let y = PAD_Y + (H - PAD_Y * 2 - tot) / 2;
      const map = new Map();
      arr.forEach((d) => { map.set(d.id ?? d.uuid, [y, y + h(d)]); y += h(d) + GAP; });
      return map;
    };

    // KPI 는 목록 순서 고정 → 방법 → 과제 순으로 무게중심을 따라 세운다
    const ko = kpiNodes.slice();
    const yk = place(ko, kH);
    const ckpi = (id) => { const v = yk.get(id); return (v[0] + v[1]) / 2; };

    const mIdx = new Map(methNodes.map((d, i) => [d.id, i]));
    const mo = methNodes.slice().sort((a, b) => {
      const ka = items.filter((x) => x.m === a.id).map((x) => ckpi(x.k));
      const kb = items.filter((x) => x.m === b.id).map((x) => ckpi(x.k));
      const ma = ka.reduce((t, v) => t + v, 0) / Math.max(ka.length, 1);
      const mb = kb.reduce((t, v) => t + v, 0) / Math.max(kb.length, 1);
      return (ma - mb) || (mIdx.get(a.id) - mIdx.get(b.id));
    });
    const ym = place(mo, hOf);
    const cmeth = (id) => { const v = ym.get(id); return (v[0] + v[1]) / 2; };

    const pIdx = new Map(projNodes.map((d, i) => [d.uuid, i]));
    const po = projNodes.slice().sort((a, b) => {
      const ka = items.filter((x) => x.p === a.uuid).map((x) => cmeth(x.m));
      const kb = items.filter((x) => x.p === b.uuid).map((x) => cmeth(x.m));
      const ma = ka.reduce((t, v) => t + v, 0) / Math.max(ka.length, 1);
      const mb = kb.reduce((t, v) => t + v, 0) / Math.max(kb.length, 1);
      return (ma - mb) || (pIdx.get(a.uuid) - pIdx.get(b.uuid));
    });
    const yp = place(po, hOf);

    /* 노드 안에서 흐름이 붙는 자리. 방법 노드는 **양쪽**을 따로 쌓는다 —
       들어오는 쪽은 과제 순서로, 나가는 쪽은 KPI 순서로 정렬해야 덜 꼬인다. */
    const anchor = (nodes, yMap, groupOf, sortKey) => {
      const out = new Map();
      nodes.forEach((d) => {
        const id = d.id ?? d.uuid;
        const mine = items.filter((x) => groupOf(x) === id)
          .sort((a, b) => sortKey(a) - sortKey(b));
        const [a0, b0] = yMap.get(id);
        const step = (b0 - a0) / Math.max(mine.length, 1);
        mine.forEach((x, i) => out.set(x.key, a0 + step * (i + 0.5)));
      });
      return out;
    };
    const cproj = (id) => { const v = yp.get(id); return (v[0] + v[1]) / 2; };

    const aP = anchor(po, yp, (x) => x.p, (x) => cmeth(x.m));
    const aMin = anchor(mo, ym, (x) => x.m, (x) => cproj(x.p));
    const aMout = anchor(mo, ym, (x) => x.m, (x) => ckpi(x.k));
    const aK = anchor(ko, yk, (x) => x.k, (x) => cmeth(x.m));

    const rank = { none: 0, indirect: 1, support: 2, primary: 3 };
    const drawn = items
      .map((x) => ({
        ...x,
        y1: aP.get(x.key), y2: aMin.get(x.key),
        y3: aMout.get(x.key), y4: aK.get(x.key),
        w: Math.max(unit - 1.5, 2.5),
      }))
      .sort((a, b) => rank[a.grade] - rank[b.grade]);

    return { items: drawn, kpiNodes: ko, projNodes: po, methNodes: mo, yp, ym, yk, H };
  }, [shown, on, onProcs, division, twoStage]);

  const { links, kpiNodes, projNodes, yp, yk, H, hiddenProj, un, unH, totalH } = model;

  /*
    기여방법이 안 적힌 연결 (2026-08-08 요청).

    연결은 섰는데 "어떻게 기여하는가" 가 비어 있는 것 — 운영 데이터의 32%(103건)다.
    미연결과 달리 그림에서는 **안 보인다.** 선이 멀쩡히 그려져 있어서다.
    그래서 조작줄에 숫자로 낸다. 여기가 없으면 찾을 길이 아예 없다.
  */
  const noMethod = useMemo(() => {
    const bad = links.filter((l) => !parseNote(l.note).length);
    const puids = new Set(bad.map((l) => l.p));
    return {
      n: bad.length,
      projects: projNodes.filter((d) => puids.has(d.uuid)),
      kpiIds: [...new Set(bad.map((l) => l.k))],
    };
  }, [links, projNodes]);

  /**
   * 남의 사업부 배지 색 — **설정 순서**로 고정한다.
   * 화면에 나온 순서로 주면 필터를 켤 때마다 같은 조직의 색이 바뀐다.
   */
  const badgeColorOf = useMemo(() => {
    const order = new Map(
      ((settingsData || {}).divisions || []).map((d, i) => [d?.name, i]));
    return (name) => DIV_BADGE[(order.get(name) ?? 0) % DIV_BADGE.length];
  }, [settingsData]);

  /**
   * 프로세스 → 선 색. **설정 순서**로 고정한다 (사업부 배지와 같은 이유).
   * 설정에 없는 값과 `(미지정)` 은 회색으로 — 색을 지어내면 없는 분류를 만드는 셈이다.
   */
  const hueOf = useMemo(() => {
    const order = new Map(
      ((settingsData || {}).processes || []).map((p, i) => [p?.name, i]));
    return (name) => (order.has(name)
      ? PROC_HUES[order.get(name) % PROC_HUES.length]
      : PROC_FALLBACK);
  }, [settingsData]);

  const toggle = (k) => setOn((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next.size ? next : prev;          // 전부 끄면 빈 화면이 된다 — 마지막 하나는 못 끈다
  });

  const lit = (l) => (!pickP && !pickK && !pickL)
    || l.p === pickP || l.k === pickK || l.key === pickL;

  /*
    2단의 강조 판정 (2026-08-08 수정).

    1단은 `lit` 하나로 끝난다 — 호버 대상이 셋(과제·KPI·흐름)이고, 노드는 각자
    `<g opacity>` 로 흐려진다. 2단은 그게 통째로 빠져 있었다:
      · 가운데 **기여방법 노드에 호버 자체가 없었다** — 이 모드를 세운 이유가 그 단인데
        정작 그 단만 눌러도 아무 일이 안 났다.
      · 흐름 굵기만 흐려지고 **노드는 하나도 안 흐려졌다.** 1단에 있는 `<g opacity>` 가
        2단 쪽에는 안 붙어 있었다.
      · 말풍선이 안 떴다 — 아래 pickedLink 주석 참고.

    호버 대상이 넷(과제·방법·KPI·흐름)으로 늘었으므로 판정을 흐름 기준 하나로 모은다.
    `hot2` = 이 흐름이 지금 강조 대상인가. 노드는 "나를 지나는 강조된 흐름이 있는가"
    로 정한다 — 1단의 `links.some(...)` 과 같은 규칙이고, 방법 단만 한 갈래 더 붙는다.
  */
  const hot2 = (x) => (!pickP && !pickK && !pickM && !pickL)
    || x.p === pickP || x.k === pickK || x.m === pickM || x.key === pickL;
  const anyHover = !!(pickP || pickK || pickM || pickL);
  /** 나를 지나는 강조된 흐름이 하나도 없으면 흐린다. 아무것도 안 짚었으면 늘 선명하다. */
  const dim2 = (mine) => anyHover
    && !(model2 ? model2.items : []).some((x) => hot2(x) && mine(x));

  /*
    말풍선은 **지금 그리는 그림**에서 찾아야 한다 (2026-08-08 수정).
    전에는 늘 1단 `links` 에서 찾았는데, 2단의 흐름 키는 `KPI|과제|방법` 이고 1단은
    `KPI|과제` 라 **영영 안 맞는다** — 2단에서는 말풍선이 한 번도 안 떴다.
    (1단 model 은 twoStage 와 무관하게 늘 계산되므로 links 가 비어서 못 찾은 게 아니다)
  */
  const pickedLink = pickL
    ? ((twoStage && model2 ? model2.items : links).find((l) => l.key === pickL) || null)
    : null;

  /*
    캔버스 높이는 **CSS 가 정한다** (2026-08-07 요청).

    처음엔 JS 로 top 을 재서 픽셀로 박았다. 두 번 틀렸다 —
      ① "넉넉히 잡고 깎기" 가 다시 잴 때마다 도로 부풀어 화면이 떨렸고,
      ② 픽셀은 그 순간의 화면에만 맞아서, 해상도·확대율이 다르면 또 어긋났다.

    지금은 `Container(100vh)` 부터 캔버스까지 **높이 사슬**을 잇고 캔버스에 flex:1 을
    준다. 위에 헤더가 몇 줄이든, 조작줄이 몇 줄로 접히든, 화면이 얼마나 크든
    남은 만큼을 정확히 가져간다. 재는 코드도, 되먹임도 없다.
    (사슬을 어디서 이었는지는 KpiMatrixView 의 Wrap 머리말 참고)
  */

  /* 밀도 d 의 가로 좌표. d 가 작을수록 좌표계가 넓어지고 → 같은 폭에 더 작게 그려진다.
     열이 차지하는 **비율**은 그대로라 배치는 안 바뀐다. */
  const G = useMemo(() => ({
    W: VIEW_W / zoom,
    PX: P_X / zoom, PW: P_W / zoom, XK: X_K / zoom, KW: K_W / zoom,
    TPX: T_PX / zoom, TPW: T_PW / zoom, TXM: T_XM / zoom,
    TMW: T_MW / zoom, TXK: T_XK / zoom, TKW: T_KW / zoom,
  }), [zoom]);

  const stepZoom = useCallback((dir) => setZoom((z) => {
    const i = ZOOMS.indexOf(z);
    const at = i >= 0 ? i : ZOOMS.findIndex((v) => v >= z);
    return ZOOMS[clamp((at < 0 ? ZOOMS.length - 1 : at) + dir, 0, ZOOMS.length - 1)];
  }), []);

  /* Ctrl(⌘)+휠 = 줌. 기본 동작(브라우저 전체 확대)을 막아야 하는데, React 의 onWheel 은
     passive 라 preventDefault 가 안 먹는다 — 그래서 직접 붙인다. Ctrl 없이 굴리면
     평범한 스크롤 그대로다. */
  /*
    전체화면 — **이 컴포넌트만** 화면을 다 쓴다 (2026-08-07 요청).
    "사업부 선택 아래" 가 곧 이 컴포넌트라, 흐름도의 뿌리(Wrap)를 통째로 올린다.

    브라우저의 진짜 전체화면(Fullscreen API)을 쓴다. position:fixed 로 흉내 내면
    주소창·탭이 그대로 남아 세로를 100px 넘게 잃는다 — 세로가 모자라서 넣는 기능인데
    그러면 뜻이 없다. Esc 로 나가는 것도 공짜로 따라온다.

    상태는 우리가 켰다고 믿는 게 아니라 **fullscreenchange 를 듣고** 정한다.
    Esc·F11·다른 요소의 전체화면 등 우리를 거치지 않는 길이 여럿이라, 믿으면 어긋난다.
  */
  const wrapRef = useRef(null);
  const [full, setFull] = useState(false);

  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;

  useEffect(() => {
    const sync = () => setFull(fsEl() === wrapRef.current);
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const toggleFull = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    // 사용자가 거절하거나(권한) 브라우저가 못 하면 조용히 넘어간다 — 화면은 그대로다
    try {
      if (fsEl()) {
        const out = document.exitFullscreen || document.webkitExitFullscreen;
        if (out) Promise.resolve(out.call(document)).catch(() => {});
      } else {
        const go = el.requestFullscreen || el.webkitRequestFullscreen;
        if (go) Promise.resolve(go.call(el)).catch(() => {});
      }
    } catch { /* 전체화면을 막아 둔 환경 — 무시한다 */ }
  }, []);

  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      stepZoom(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [stepZoom, rows.length]);

  /* 지금 그리고 있는 그림의 좌표계 높이 — 1단이면 미연결 띠까지 포함한 totalH,
     2단이면 model2.H. 화면 맞춤이 재야 하는 값이 이것이다. */
  const viewH = twoStage ? (model2 ? model2.H : 0) : totalH;

  /*
    화면 맞춤 — **세로 스크롤이 안 생기는 가장 큰 배율**로 맞춘다 (2026-08-08 요청).

    줌이 곧 세로 밀도라(위 ZOOMS 머리말) 계산이 한 줄로 떨어진다. SVG 는 폭 100% ·
    height:auto 라 그려지는 높이가
        h = 캔버스폭 × viewH / (VIEW_W / zoom)
    즉 **zoom 에 정비례**한다. h ≤ 캔버스높이 를 zoom 에 대해 풀면 그게 답이다.
    지금 배율이 얼마든 상관없다 — 좌표계 높이(viewH)는 줌과 무관하게 정해지므로
    100% 에서 누르든 50% 에서 누르든 같은 값이 나온다.

    ⚠️ 폭은 clientWidth 가 아니라 **offsetWidth** 로 잰다. 세로 스크롤바가 떠 있으면
       clientWidth 는 그만큼(≈15px) 좁은데, 맞추고 나면 스크롤바가 사라져 폭이 도로
       넓어진다. 좁은 폭으로 계산하면 넓어진 만큼 높이도 늘어 **스크롤이 되살아난다.**
       스크롤바가 없는 상태의 폭으로 재야 한 번에 맞는다.

    ⚠️ 사다리(ZOOMS) 값으로 내림하지 않는다. 68% 가 답인데 60% 로 내리면 쓸 수 있는
       세로를 12% 버린다 — '딱 맞춤' 이 이 단추의 전부라 중간값을 그대로 쓴다.
       ± 단추는 사다리 밖 값에서도 다음 칸을 찾아가므로(stepZoom) 이후 조작은 그대로다.

    ⚠️ 바닥(0.5)으로도 안 들어가는 양이면 0.5 에서 멈추고 스크롤이 남는다. 더 줄이면
       글자가 못 읽을 크기가 되어, 스크롤 없애자고 그림을 못 읽게 만드는 셈이 된다.
  */
  const fitToView = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !viewH) return;
    const avail = el.clientHeight - 1;   // 1px 은 소수점 반올림 몫
    const w = el.offsetWidth;            // 스크롤바가 사라진 뒤의 폭
    if (avail <= 0 || w <= 0) return;
    const raw = (avail * VIEW_W) / (w * viewH);
    setZoom(clamp(Math.floor(raw * 100) / 100, ZOOMS[0], ZOOMS[ZOOMS.length - 1]));
  }, [viewH]);

  if (!rows.length) return <Empty>{division} 이(가) 관리하는 KPI가 없습니다.</Empty>;

  return (
    <Wrap ref={wrapRef}>
      <Chips>
        {/* 전체화면에서만 — 평소엔 바로 위에 사업부 탭이 있어 같은 것이 둘이 된다 */}
        {full && divisions.length > 1 && onDivisionChange && (
          <DivPick
            value={division}
            onChange={(e) => onDivisionChange(e.target.value)}
            title="사업부를 바꿉니다"
            aria-label="사업부 고르기"
          >
            {divisions.map((d) => (
              <option key={d.name} value={d.name}>
                {`${d.name} · 연결 ${d.linked}/${d.total}`}
              </option>
            ))}
          </DivPick>
        )}

        <StageToggle
          type="button"
          $on={twoStage}
          /* 단을 바꾸면 짚어 둔 것도 놓는다 — 없어진 단(방법)을 짚은 채로 남으면
             돌아왔을 때 엉뚱한 줄이 강조된 상태로 시작한다 */
          onClick={() => {
            setTwoStage((v) => !v);
            clearPick();
          }}
          title={twoStage
            ? '기여방법 단을 빼고 과제 → KPI 로만 봅니다'
            : '과제와 KPI 사이에 기여방법을 세워 2단으로 봅니다 (연결 1건에 방법이 여러 개면 그만큼 선이 늘어납니다)'}
        >
          기여방법 {twoStage ? 'ON' : 'OFF'}
        </StageToggle>

        <Title>기여 흐름</Title>
        <HeadNum>
          {twoStage && model2
            ? `흐름 ${model2.items.length}개 · 과제 ${model2.projNodes.length}건 · 방법 ${model2.methNodes.length}종`
            : `연결 ${links.length}개 · 과제 ${projNodes.length}건`}
          {!twoStage && un.length > 0 && <UnMark> · 미연결 {un.length}건</UnMark>}
        </HeadNum>

        {/*
          미연결 과제를 한 번에 연결 (2026-08-08).

          이 띠가 이 화면의 **할 일 목록**이다 — 아무 KPI에도 안 걸린 과제가 이미
          추려져 그려져 있으니, 다시 고르게 할 이유가 없다.
          2단 모드에서는 미연결을 안 그리므로(연결이 없어 흐를 것이 없다) 숨긴다.
        */}
        {!twoStage && un.length > 0 && onBulkLink && (
          <LinkAllBtn
            type="button"
            onClick={() => onBulkLink(un, `${division} 미연결 과제 ${un.length}건`)}
            title="어느 KPI에도 걸리지 않은 과제들의 연결을 한 번에 세웁니다"
          >
            미연결 {un.length}건 연결
          </LinkAllBtn>
        )}

        {/* 연결은 있는데 기여방법이 빈 것 — 그림에서는 안 보이므로 숫자로 낸다 */}
        {!twoStage && noMethod.n > 0 && onBulkLink && (
          <NoMethodBtn
            type="button"
            onClick={() => onBulkLink(
              noMethod.projects,
              `${division} — 기여방법이 비어 있는 연결 ${noMethod.n}건`,
              noMethod.kpiIds,
            )}
            title="연결은 되어 있으나 '어떻게 기여하는가' 가 비어 있는 것들입니다"
          >
            기여방법 없음 {noMethod.n}건
          </NoMethodBtn>
        )}

        <Sep />

        {GRADES.map((g) => (
          <Chip key={g.key} type="button" $on={on.has(g.key)} $c={GRADE_INK}
                onClick={() => toggle(g.key)}
                title={`${g.hint} — 눌러서 ${on.has(g.key) ? '감추기' : '보기'}`}>
            <svg width="16" height="6" aria-hidden>
              <line x1="0" y1="3" x2="16" y2="3" stroke={GRADE_INK} strokeWidth="3"
                    strokeDasharray={g.dash} opacity={on.has(g.key) ? 1 : 0.35} />
            </svg>
            {g.label} {totals[g.key]}
          </Chip>
        ))}

        {/* 프로세스 필터 — 과제를 거른다 (등급 칩은 '연결'을 거른다).
            아무것도 안 고르면 제한 없음. 대시보드의 프로세스 필터와 같은 규칙이다.
            프로세스가 한 종류뿐이면 거를 게 없으니 아예 안 낸다. */}
        {procCounts.length > 1 && (
          <>
            <Sep />
            <ProcLabel>프로세스</ProcLabel>
            {procCounts.map((p) => {
              const on2 = onProcs.has(p.name);
              return (
                <ProcChip
                  key={p.name}
                  type="button"
                  $on={on2}
                  $c={hueOf(p.name)}
                  onClick={() => setOnProcs((prev) => {
                    const next = new Set(prev);
                    if (next.has(p.name)) next.delete(p.name); else next.add(p.name);
                    return next;
                  })}
                  title={`${p.name} 과제 ${p.n}건${on2 ? ' — 눌러서 해제' : ''}`}
                >
                  {!on2 && <ProcDot style={{ background: hueOf(p.name) }} />}
                  {p.name} {p.n}
                </ProcChip>
              );
            })}
            {onProcs.size > 0 && (
              <ProcReset type="button" onClick={() => setOnProcs(new Set())}>
                초기화
              </ProcReset>
            )}
          </>
        )}

        <PickWrap>
          <PickBtn type="button" $filtered={offKpis.size > 0}
                   onClick={() => setPickOpen((v) => !v)}
                   title="그림에 넣을 KPI를 고릅니다. 좌측 목록과 연결 데이터는 그대로입니다.">
            KPI {shown.length}/{rows.length}
            {offKpis.size > 0 && <> −{offKpis.size}</>}
          </PickBtn>
          {pickOpen && (
            <>
              <PickOverlay onClick={() => setPickOpen(false)} />
              <PickPanel onClick={(e) => e.stopPropagation()}>
                <PickHead>
                  <span>그림에 넣을 KPI</span>
                  <span style={{ display: 'flex', gap: '0.5rem' }}>
                    <PickLink type="button" onClick={() => setOffKpis(new Set())}>모두</PickLink>
                    <PickLink type="button" onClick={() => setOffKpis(
                      // 전부 끄면 빈 그림이 된다 — 첫 줄 하나는 남긴다
                      new Set(rows.slice(1).map((r) => r.kpi.kpiDefinitionId)),
                    )}>해제</PickLink>
                  </span>
                </PickHead>
                {rows.map(({ kpi, cell }, i) => (
                  <PickItem key={kpi.kpiDefinitionId} title={kpi.label}>
                    <input
                      type="checkbox"
                      checked={!offKpis.has(kpi.kpiDefinitionId)}
                      onChange={() => setOffKpis((prev) => {
                        const next = new Set(prev);
                        if (next.has(kpi.kpiDefinitionId)) next.delete(kpi.kpiDefinitionId);
                        else next.add(kpi.kpiDefinitionId);
                        // 마지막 하나는 못 끈다 (등급 칩과 같은 규칙)
                        return next.size >= rows.length ? prev : next;
                      })}
                    />
                    <PickNo>{i + 1}.</PickNo>
                    <PickName>{kpi.label}</PickName>
                    <PickCount $zero={!cell.projects.length}>{cell.projects.length}건</PickCount>
                  </PickItem>
                ))}
              </PickPanel>
            </>
          )}
        </PickWrap>
      </Chips>

      <Canvas>
        <ZoomBar>
          {/* 화면 맞춤 — 확대/축소 **왼쪽**이다 (2026-08-08 요청). ±는 한 칸씩 더듬는
              것이고 이건 답을 한 번에 내는 것이라, 먼저 누를 것이 앞에 선다. */}
          <ZoomBtn type="button" onClick={fitToView}
                   disabled={!viewH}
                   title="화면 맞춤 — 세로 스크롤이 안 생기는 가장 큰 배율로 맞춥니다">
            <Scan size={12} />
          </ZoomBtn>
          <ZoomSep />
          <ZoomBtn type="button" onClick={() => stepZoom(-1)}
                   disabled={zoom <= ZOOMS[0]} title="촘촘하게 — 글자와 줄 높이를 줄여 한 화면에 더 많이 (Ctrl+휠 아래)">−</ZoomBtn>
          <ZoomNow type="button" $fit={zoom === 1} onClick={() => setZoom(1)}
                   title="기본 크기로 되돌리기 (가로는 늘 화면 폭에 맞습니다)">
            {Math.round(zoom * 100)}%
          </ZoomNow>
          <ZoomBtn type="button" onClick={() => stepZoom(1)}
                   disabled={zoom >= ZOOMS[ZOOMS.length - 1]} title="크게 — 글자와 줄 높이를 키웁니다 (Ctrl+휠 위)">＋</ZoomBtn>
          <ZoomSep />
          <ZoomBtn type="button" onClick={toggleFull}
                   title={full ? '전체화면 나가기 (Esc)' : '전체화면 — 흐름도만 화면을 다 씁니다'}>
            {full ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </ZoomBtn>
        </ZoomBar>

        <Scroller ref={scrollRef}>
        <ZoomBox>
        {twoStage ? (
          !model2 || !model2.items.length ? (
            <Empty>켜 둔 조건에 맞는 연결이 없습니다.</Empty>
          ) : (
            <svg width="100%" viewBox={`0 0 ${G.W} ${model2.H}`} role="img"
                 /* 빈 곳을 누르면 놓는다. 노드·흐름은 stopPropagation 으로 막는다 —
                    안 막으면 고르는 순간 여기까지 올라와 바로 풀린다. */
                 onClick={clearPick}
                 aria-label={`${division} 과제 → 기여방법 → KPI 흐름도`}>
              {/* 흐름 — 과제 → 방법 → KPI 를 **한 선**으로 잇는다.
                  두 토막으로 그리면 가운데서 어느 선이 어느 선으로 이어지는지 잃는다. */}
              {model2.items.map((x) => {
                const g = GRADE_OF(x.grade === 'none' ? null : x.grade);
                const m1 = (G.TPX + G.TPW + G.TXM) / 2;
                const m2 = (G.TXM + G.TMW + G.TXK) / 2;
                return (
                  <path
                    key={x.key}
                    d={`M ${G.TPX + G.TPW} ${x.y1} C ${m1} ${x.y1}, ${m1} ${x.y2}, ${G.TXM} ${x.y2}`
                       + ` M ${G.TXM + G.TMW} ${x.y3} C ${m2} ${x.y3}, ${m2} ${x.y4}, ${G.TXK} ${x.y4}`}
                    fill="none"
                    stroke={hueOf(x.proc)}
                    strokeWidth={x.w}
                    strokeDasharray={g.dash}
                    strokeOpacity={hot2(x) ? g.op : 0.07}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); pickOne('l', x.key); }}
                  />
                );
              })}

              {/* 과제. 1단과 같이 **관계없는 노드는 흐린다** — 흐름만 흐려서는
                  "어느 과제가 어느 방법을 거쳐 어디로 가는가" 가 눈에 안 잡힌다. */}
              {model2.projNodes.map((d) => {
                const [a, b] = model2.yp.get(d.uuid);
                const hot = pickP === d.uuid;
                const c = d.isOther ? badgeColorOf(d.division) : null;
                return (
                  <g key={d.uuid} opacity={dim2((x) => x.p === d.uuid) ? 0.25 : 1}>
                    <NodeBox
                      x={G.TPX} y={a} w={G.TPW} h={b - a}
                      fill={hot ? '#eef2ff' : '#fff'}
                      stroke={d.isKey ? '#6d28d9' : (hot ? '#6366f1' : '#cbd5e1')}
                      strokeWidth={d.isKey || hot ? 1.1 : 0.7}
                      stripe={STATUS_FILL[d.status] || '#9ca3af'}
                      badge={c ? { text: d.division, ...c } : null}
                      label={d.title || '(제목 없음)'}
                      textFill="#374151"
                      onClick={() => pickOne('p', d.uuid)}
                      onDoubleClick={() => onOpenProject && onOpenProject(d)}
                      title={`${d.title}\n${d.division} · ${d.status || '상태 없음'} · ${d.progress ?? 0}%`}
                    />
                  </g>
                );
              })}

              {/* 기여방법 (가운데). 이 단을 짚으면 **그 방법으로 흐르는 과제와 KPI만**
                  남는다 — "이 방법을 쓰는 곳이 어디인가" 가 이 모드를 켜는 이유다. */}
              {model2.methNodes.map((d) => {
                const [a, b] = model2.ym.get(d.id);
                const none = d.id === NO_METHOD;
                const hot = pickM === d.id;
                return (
                  <g key={d.id} opacity={dim2((x) => x.m === d.id) ? 0.25 : 1}>
                    <NodeBox
                      x={G.TXM} y={a} w={G.TMW} h={b - a}
                      fill={none ? '#fff' : (hot ? '#99f6e4' : '#ccfbf1')}
                      stroke={none ? '#b45309' : (hot ? '#0f766e' : '#5eead4')}
                      strokeWidth={none || hot ? 1.1 : 0.7}
                      dash={none ? '2.5 2' : undefined}
                      label={d.label}
                      tail={d.n}
                      textFill={none ? '#b45309' : '#115e59'}
                      bold={!none}
                      onClick={() => pickOne('m', d.id)}
                      /* 미입력 덩어리는 **두 번 누르면 채우러 간다.** 한 번 누르는 것은
                         이제 「이 방법으로 흐르는 것만 보기」라 겹칠 수 없다. */
                      onDoubleClick={none && onBulkLink ? () => {
                        const mine = model2.items.filter((x) => x.m === NO_METHOD);
                        const puids = new Set(mine.map((x) => x.p));
                        onBulkLink(
                          model2.projNodes.filter((x) => puids.has(x.uuid)),
                          `${division} — 기여방법이 비어 있는 연결 ${mine.length}건`,
                          [...new Set(mine.map((x) => x.k))],
                        );
                      } : undefined}
                      title={none
                        ? `${d.label}\n연결 ${d.n}건 — 눌러서 한 번에 채웁니다`
                        : `${d.label}\n이 방법으로 흐르는 연결 ${d.n}건`}
                    />
                  </g>
                );
              })}

              {/* KPI */}
              {model2.kpiNodes.map((d) => {
                const [a, b] = model2.yk.get(d.id);
                const zero = d.n === 0;
                return (
                  <g key={d.id} opacity={dim2((x) => x.k === d.id) ? 0.25 : 1}>
                    <NodeBox
                      x={G.TXK} y={a} w={G.TKW} h={b - a}
                      fill={zero ? '#fff' : '#eef2ff'}
                      stroke={zero ? '#dc2626' : '#a5b4fc'}
                      strokeWidth={zero ? 0.9 : 0.7}
                      dash={zero ? '2.5 2' : undefined}
                      label={d.label}
                      tail={zero ? '0' : d.n}
                      textFill={zero ? '#b91c1c' : '#312e81'}
                      bold={!zero}
                      onClick={() => pickOne('k', d.id)}
                      title={`${d.label}\n흐르는 연결 ${d.n}건`}
                    />
                  </g>
                );
              })}
            </svg>
          )
        ) : !links.length && !un.length ? (
          <Empty>켜 둔 등급의 연결이 없습니다. 위 칩으로 다른 등급을 켜 보세요.</Empty>
        ) : (
          <svg width="100%" viewBox={`0 0 ${G.W} ${totalH}`} role="img"
               onClick={clearPick}
               aria-label={`${division} 과제-KPI 기여 흐름도 — 연결 ${links.length}개`}>
            {/* 흐름 */}
            {links.map((l) => {
              const g = GRADE_OF(l.grade === 'none' ? null : l.grade);
              const x1 = G.PX + G.PW; const x2 = G.XK;
              const mx = (x1 + x2) / 2;
              return (
                <path
                  key={l.key}
                  d={`M ${x1} ${l.y1} C ${mx} ${l.y1}, ${mx} ${l.y2}, ${x2} ${l.y2}`}
                  fill="none"
                  stroke={hueOf(l.proc)}
                  strokeWidth={l.w}
                  strokeDasharray={g.dash}
                  strokeOpacity={lit(l) ? g.op : 0.07}
                  strokeLinecap="butt"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); pickOne('l', l.key); }}
                />
              );
            })}

            {/* 과제 (왼쪽) */}
            {projNodes.map((d) => {
              const [a, b] = yp.get(d.uuid);
              const dim = (pickP && pickP !== d.uuid)
                       || (pickK && !links.some((l) => l.p === d.uuid && l.k === pickK))
                       || (pickL && !links.some((l) => l.key === pickL && l.p === d.uuid));
              const hot = pickP === d.uuid;
              const c = d.isOther ? badgeColorOf(d.division) : null;
              return (
                <g key={d.uuid} opacity={dim ? 0.25 : 1}>
                  {/*
                    남의 사업부 과제는 **배지**로 가른다 (2026-08-07 요청).
                    글자만 앞에 붙였더니 티가 안 났다 — 같은 크기·같은 색 글자라
                    이름의 일부처럼 읽혔다. 칠한 알약이라야 눈에 먼저 걸린다.

                    진행상태는 **왼쪽 띠**로 뺀다. 박스를 상태색으로 칠하면 그 위 이름이
                    죽고, 색이 다섯 갈래라 흐름선의 프로세스 색과 서로 잡아먹는다.
                    중점과제는 **테두리 색**으로 — 요소를 더 얹지 않고 갈린다.
                  */}
                  <NodeBox
                    x={G.PX} y={a} w={G.PW} h={b - a}
                    fill={hot ? '#eef2ff' : '#fff'}
                    stroke={d.isKey ? '#6d28d9' : (hot ? '#6366f1' : '#cbd5e1')}
                    strokeWidth={d.isKey || hot ? 1.1 : 0.7}
                    stripe={STATUS_FILL[d.status] || '#9ca3af'}
                    badge={c ? { text: d.division, ...c } : null}
                    label={d.title || '(제목 없음)'}
                    textFill={hot ? '#1f2937' : '#374151'}
                    onClick={() => pickOne('p', d.uuid)}
                    onDoubleClick={() => onOpenProject && onOpenProject(d)}
                    title={`${d.title || '(제목 없음)'}\n${d.division} · ${d.status || '상태 없음'} · ${d.progress ?? 0}%\nKPI ${d.n}개에 기여${d.isKey ? '\n중점과제' : ''}`}
                  />
                </g>
              );
            })}

            {/* KPI (오른쪽). 필터로 비워진 줄도 남는다 — '주기여 과제가 없는 KPI' 가
                이 화면이 찾는 것이라서 지우면 안 된다. */}
            {kpiNodes.map((d) => {
              const [a, b] = yk.get(d.id);
              const dim = (pickK && pickK !== d.id)
                       || (pickP && !links.some((l) => l.k === d.id && l.p === pickP))
                       || (pickL && !links.some((l) => l.key === pickL && l.k === d.id));
              const zero = d.n === 0;
              return (
                <g key={d.id} opacity={dim ? 0.25 : 1}>
                  {/* 기여가 없는 KPI 는 **빈 박스 + 붉은 점선**. 칠하면 '적게 있다' 로
                      읽히는데, 실제로는 0 이라 아예 다른 상태다. */}
                  <NodeBox
                    x={G.XK} y={a} w={G.KW} h={b - a}
                    fill={zero ? '#fff' : '#eef2ff'}
                    stroke={zero ? '#dc2626' : '#a5b4fc'}
                    strokeWidth={zero ? 0.9 : 0.7}
                    dash={zero ? '2.5 2' : undefined}
                    label={d.label}
                    tail={zero ? '0' : d.n}
                    textFill={zero ? '#b91c1c' : '#312e81'}
                    bold={!zero}
                    onClick={() => pickOne('k', d.id)}
                    title={`${d.label}\n켜 둔 등급의 기여 과제 ${d.n}건 (전체 ${d.all}건)`}
                  />
                </g>
              );
            })}
            {/*
              미연결 과제 띠 — 본 그림 **아래**에 따로 세운다.
              선이 하나도 안 나가는 모습 자체가 "아무 KPI에도 기여하지 않는다" 는 뜻이다.
              오른쪽에 '미연결' 가짜 노드를 만들어 이으면 없는 연결을 그리는 셈이 된다.
            */}
            {un.length > 0 && (
              <g>
                <line x1={0} y1={H + 5} x2={G.W} y2={H + 5}
                      stroke="#e5e7eb" strokeWidth={0.8} strokeDasharray="3 3" />
                <text x={0} y={H + 11.5} fontSize={FONT * 0.95} fontWeight="700" fill="#b45309">
                  {`미연결 과제 ${un.length}건 — 어느 KPI에도 걸려 있지 않습니다`}
                </text>
                {un.map((d, i2) => {
                  const y0 = H + UN_TOP + i2 * (P_MIN + GAP);
                  const c = d.isOther ? badgeColorOf(d.division) : null;
                  const hot = pickP === d.uuid;
                  return (
                    /* 테두리를 **점선**으로 — 연결된 과제(실선 박스)와 한눈에 갈린다 */
                    <NodeBox
                      key={d.uuid}
                      x={G.PX} y={y0} w={G.PW} h={P_MIN}
                      fill={hot ? '#fffbeb' : '#fff'}
                      stroke={hot ? '#d97706' : '#fcd34d'}
                      strokeWidth={hot ? 1 : 0.8}
                      dash="2.5 2"
                      stripe={STATUS_FILL[d.status] || '#9ca3af'}
                      badge={c ? { text: d.division, ...c } : null}
                      label={d.title || '(제목 없음)'}
                      textFill="#92400e"
                      onClick={() => pickOne('p', d.uuid)}
                      onDoubleClick={() => onOpenProject && onOpenProject(d)}
                      title={`${d.title || '(제목 없음)'}\n${d.division} · ${d.status || '상태 없음'} · ${d.progress ?? 0}%\n어느 KPI에도 연결되지 않았습니다`}
                    />
                  );
                })}
              </g>
            )}
          </svg>
        )}

        {pickedLink && (
          /* 세로 자리는 **그 흐름이 지나는 높이**다. 2단은 끝점이 y4 라 그걸 쓰고,
             기준 높이도 지금 그리는 그림(viewH)이어야 한다 — 2단에서 1단 H 로 나누면
             말풍선이 엉뚱한 데로 간다. */
          <Tip style={{
            left: '18%',
            top: `${clamp(((pickedLink.y1 + (pickedLink.y4 ?? pickedLink.y2)) / 2 + 12)
                          / Math.max(viewH, 1) * 100, 2, 70)}%`,
          }}>
            <TipTitle>{cut(pickedLink.title, 26) || '(제목 없음)'}</TipTitle>
            <TipLine>→ {pickedLink.kpiLabel}</TipLine>
            {/* 2단에서는 거쳐 가는 **기여방법**이 이 흐름의 정체다 (1단에는 이 값이 없다) */}
            {pickedLink.m && <TipLine>· {cut(pickedLink.m, 30)}</TipLine>}
            <TipLine>
              <ProcDot style={{ background: hueOf(pickedLink.proc) }} />
              {pickedLink.proc}
            </TipLine>
            <TipLine><em>{GRADE_OF(pickedLink.grade === 'none' ? null : pickedLink.grade).label}</em></TipLine>
            {(pickedLink.note || '').trim() && (
              <TipLine style={{ marginTop: 3 }}>{cut(pickedLink.note.trim(), 70)}</TipLine>
            )}
          </Tip>
        )}
        </ZoomBox>
        </Scroller>
      </Canvas>

      <Caption>
        {twoStage
          ? <>선 하나가 <b>과제 → 기여방법 → KPI</b> 한 갈래입니다. 연결 1건에 방법이 여러 개면 그만큼 갈라집니다.</>
          : <>선 하나가 <b>과제 → KPI 연결 하나</b>입니다.</>}
        <b>선 색 = 프로세스</b>(위 칩이 범례), <b>선 모양 = 기여 등급</b>입니다.
        박스가 <b>세로로 길수록</b> 그 KPI(또는 과제)에 연결이 몰려 있습니다 — 가로 폭은 이름 자리입니다.
        과제명 왼쪽에 <OtherMark>사업부 배지</OtherMark>가 붙은 줄은 <b>다른 조직이 지원하는 과제</b>이고,
        배지가 없으면 {division} 자체 과제입니다.
        {hiddenProj > 0 && <> 켜 둔 등급의 연결이 없는 과제 {hiddenProj}건은 감췄습니다.</>}
      </Caption>
    </Wrap>
  );
};

export default KpiContributionFlow;
