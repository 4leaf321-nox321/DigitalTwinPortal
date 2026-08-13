/**
 * 관계도의 **표현 규칙** — 색·모양·크기는 전부 여기서 정한다.
 *
 * 왜 화면에 두나
 *     서버는 라벨과 최소 속성만 준다(`graph_view.py`). 색을 서버가 정하면 같은
 *     데이터로 **다른 기준으로 칠할 수가 없다** — 예전 「지식 그래프 저장」이
 *     노드에 `color`·`size` 를 박아 저장하는 바람에 데이터가 아니라 그림이 됐다.
 *
 * 그리기의 뼈대 — 노드를 **축과 개체**로 나눈다 (2026-08-09)
 *
 *     축(axis)      사업부·프로세스·성과 대/소분류·성과 속성·**DX KPI·사람·부서**.
 *                   **글자를 품은 알약**으로 그린다.
 *     개체(instance) 과제·성과·액션아이템. 모양 있는 점 + 아래 이름표.
 *
 * 처음에는 "무엇들을 담는 칸인가" 라는 **뜻**으로 갈랐다. 그 기준이면 KPI 와 사람은
 * 개체가 맞다 — 사람은 칸이 아니라 사람이고, KPI 는 목표·실적을 가진 실체다.
 * 그런데 화면에서 중요한 것은 뜻이 아니라 **구조**였다. 실측(개발 DB):
 *
 *     사람    8개 · 평균 연결 62.5 (최대 150)   ← 그래프에서 가장 큰 허브
 *     KPI    16개 · 평균 연결 19.4
 *     과제  100개 · 평균 연결 13.2
 *     사업부  6개 · 평균 연결  3.5             ← 이미 알약이던 것
 *
 * **가장 큰 허브 둘을 가장 작은 점으로 그리고 있었다.** 축이 하는 일은 "수가 적고,
 * 많은 것이 모이고, **이름을 읽어 길을 찾는** 것" 인데 셋 다 해당했다.
 *
 * 과제는 연결 13.2 로 그 사이에 있지만 **개체로 둔다** — 100개라 알약이 화면을
 * 덮고, 과제명이 길어 알약이 거대해지며, 무엇보다 **이 그래프의 주인공**이다.
 * 주인공까지 축이 되면 구분이 사라진다.
 *
 * 축은 같은 갈래 개체의 **옅은 색**을 쓴다 — 색만 보고도 "성과 쪽 축" 이라고 읽힌다.
 * 알약에는 **연결 수**를 함께 적는다. 알약은 이름 길이로 크기가 정해져서 개체처럼
 * 크기로 degree 를 보여줄 수 없는데, 하필 그 신호가 제일 필요한 것이 사람·KPI 다.
 *
 * ⚠️ 이 파일에는 **데이터 판단이 없다.** 무엇이 노드가 되는지·무엇이 이어지는지는
 *    서버가 정한다. 여기는 온 것을 어떻게 보이게 할지만 정한다.
 */

/**
 * 노드 종류. 서버가 만드는 `type` 값과 짝이다.
 *   `group`  묶음인가 (알약으로 그린다)
 *   `tint`   묶음의 채움색. 테두리는 `color` 를 쓴다
 */
export const NODE_TYPES = {
  project: { label: '과제', color: '#4f46e5', shape: 'circle' },
  perf: { label: '성과', color: '#059669', shape: 'diamond' },
  perfcat: { label: '성과 대분류', color: '#047857', tint: '#d1fae5', group: true },
  perfsub: { label: '성과 소분류', color: '#10b981', tint: '#ecfdf5', group: true },
  /*
    「모든 성과 현황」의 카드(개발 비용·품질 비용…). 사람이 **직접 고른** 묶음이라
    자동 분류(대·소분류)와 색 계열을 달리해 한눈에 구분되게 한다.

    화면 이름은 **「성과 속성」**이다 — 저장은 `kpi_dashboard_cards` 이고 서버 타입은
    `kpicard` 지만, 사람에게 'KPI 카드' 라고 하면 **DX KPI 지표**와 헷갈린다
    (관계도에 그 둘이 함께 있어서 더 그렇다). 저장 이름을 바꾸면 다른 화면이
    같이 깨지므로 **보이는 이름만** 바꾼다.
  */
  kpicard: { label: '성과 속성', color: '#0e7490', tint: '#cffafe', group: true },
  kpi: { label: 'DX KPI', color: '#6d28d9', tint: '#ede9fe', group: true },
  division: { label: '사업부', color: '#b45309', tint: '#fef3c7', group: true },
  process: { label: '프로세스', color: '#d97706', tint: '#fffbeb', group: true },
  person: { label: '사람', color: '#be123c', tint: '#ffe4e6', group: true },
  // 부서는 **"누가" 축**이다 — 사업부·프로세스(무엇을 하는가)와 달리 소속을 말한다.
  dept: { label: '부서', color: '#9f1239', tint: '#fff1f2', group: true },
  action: { label: '액션아이템', color: '#94a3b8', shape: 'triangle' },
};

export const isGroup = (type) => !!NODE_TYPES[type]?.group;

/** 레이어 토글 — 서버 `LAYERS` 와 **같은 이름**이라야 한다. */
export const LAYERS = [
  { key: 'perf', label: '성과', hint: '과제 → 성과, 그리고 성과의 대분류·소분류' },
  { key: 'card', label: '성과 속성', hint: '「모든 성과 현황」의 카드(개발 비용·품질 비용…) → 성과' },
  { key: 'kpi', label: 'DX KPI', hint: '과제 → KPI (기여등급)' },
  { key: 'dep', label: '선행 과제', hint: '과제 → 과제' },
  /*
    「조직」과 「사람」을 갈랐다 (2026-08-09). 부서는 둘 다에 나오지만 뜻이 다르다 —
    조직에서는 **과제를 맡은 부서**(담당), 사람에서는 **그 사람이 속한 부서**(소속).
    한 토글에 묶어 뒀더니 "부서만 보고 싶은데 사람이 전부 따라오는" 문제가 있었다
    (사람은 이 그래프에서 연결이 가장 많은 노드라 화면을 지배한다).
  */
  { key: 'org', label: '조직', hint: '사업부 → 프로세스(개발·제조…) → 과제, 그리고 과제를 맡은 담당 부서' },
  { key: 'people', label: '사람', hint: 'PL·작성자·참여자(계정 연결된 사람만)와 그 소속 부서' },
  { key: 'action', label: '액션아이템', hint: '과제 → 액션아이템 (수가 많다)' },
];

/**
 * 엣지 색. 관계마다 다르게 — 한 색이면 무엇이 무엇에 걸렸는지 못 읽는다.
 * 묶음선(`contains`)은 **가장 옅다.** 뼈대일 뿐 읽을 거리가 아니다.
 */
export const EDGE_COLORS = {
  measures: '#34d399',
  // 사람이 고른 묶음 — 자동 분류선(`contains`)보다 진하게 둔다. 판단이 담긴 선이다.
  in_card: '#22d3ee',
  contributes: '#a78bfa',
  precedes: '#fb923c',
  contains: '#cbd5e1',
  led_by: '#fb7185',
  authored_by: '#fda4af',
  member_of: '#fecdd3',
  belongs_to: '#fda4af',
  handled_by: '#fcd9c8',
  has_item: '#dbe2ea',
};

/**
 * **노드를 골랐을 때** 그 이웃으로 이어지는 선의 색.
 *
 * 평소 색을 그대로 쓰면 안 된다 (2026-08-09). 분류선(`contains`)처럼 평소에 옅게
 * 두는 선은 골라도 여전히 옅어서, 정작 **"무엇에 걸렸나" 를 보려고 고른 순간에
 * 안 보인다.** 평소의 옅음은 "배경이니 눈길을 끌지 말라" 는 뜻이지
 * "골라도 숨어라" 가 아니다.
 *
 * 사람 관계처럼 원래 진한 선은 조금만 더 진하게 — 대비가 흐트러지지 않게.
 */
export const EDGE_COLORS_ACTIVE = {
  measures: '#059669',
  in_card: '#0891b2',
  contributes: '#7c3aed',
  precedes: '#ea580c',
  contains: '#64748b',
  led_by: '#e11d48',
  authored_by: '#f43f5e',
  member_of: '#fb7185',
  belongs_to: '#be123c',
  handled_by: '#c2410c',
  has_item: '#94a3b8',
};

/** 고른 이웃 밖의 선. 있다는 것만 알 정도로 남긴다. */
export const EDGE_COLOR_DIM = 'rgba(203, 213, 225, 0.22)';

/** 선 굵기 — 뜻의 무게. 고른 이웃은 눈에 들어와야 하므로 굵기도 함께 올린다. */
export const edgeWidth = (relation, active = false) => {
  const base = { precedes: 1.8, contains: 0.6, has_item: 0.5 }[relation] ?? 0.9;
  return active ? Math.max(base * 2, 1.8) : base;
};

export const EDGE_LABELS = {
  measures: '측정', in_card: '성과 속성', contributes: '기여', precedes: '선행',
  contains: '분류·소속',
  led_by: 'PL', authored_by: '작성', member_of: '참여',
  belongs_to: '소속 부서', handled_by: '담당 부서', has_item: '액션',
};

/** 진행상태 색 — 다른 화면과 같은 어휘를 쓴다. */
const STATUS_COLORS = {
  완료: '#3b82f6', 정상진행: '#22c55e', 지연: '#ef4444',
  미착수: '#9ca3af', 계획: '#8b5cf6', 미배정: '#9ca3af', 취소: '#374151',
};

export const COLOR_MODES = [
  { key: 'type', label: '종류별' },
  { key: 'division', label: '사업부별' },
  { key: 'status', label: '진행상태별' },
];

/**
 * 노드 색. `mode` 는 사람이 고른다.
 *
 * 사업부/진행상태 모드는 **과제에만** 적용한다 — 성과·KPI 에는 사업부가 없고,
 * 억지로 칠하면 "이 성과는 MX 것" 이라는 없는 뜻이 생긴다. 나머지는 종류색으로 둔다.
 */
export const nodeColor = (node, mode, divisionColors = {}) => {
  if (mode === 'division' && node.type === 'project') {
    return divisionColors[node.division] || NODE_TYPES.project.color;
  }
  if (mode === 'status' && node.type === 'project') {
    return STATUS_COLORS[node.status] || '#9ca3af';
  }
  return NODE_TYPES[node.type]?.color || '#94a3b8';
};

/**
 * 잎 노드의 반지름 — **연결 수(degree)** 다. 많이 엮인 것이 커진다.
 * 제곱근을 쓴다. 선형이면 허브 하나가 화면을 다 덮고, 로그면 차이가 안 보인다.
 */
export const nodeRadius = (node) => {
  if (isGroup(node.type)) return 5;      // 묶음은 알약이라 이 값을 안 쓴다
  const deg = node.__degree || 0;
  const base = node.type === 'project' ? 4 : 3;
  return base + Math.sqrt(deg) * 1.6;
};

/** 라벨 글자 크기 — **그래프 좌표 단위**다(화면 픽셀이 아니다).
 *
 * 예전에는 `11 / scale` 을 썼다. 화면에서 항상 11px 로 보이게 하려던 것인데,
 * 그러면 **줌아웃할수록 글자가 그래프 공간에서 커진다.** 전체보기에서 라벨이
 * 서로 겹쳐 뭉개지던 원인이 그것이다. 고정 단위로 두면 글자가 그래프와 함께
 * 줄었다 늘었다 하므로, `collideRadius` 로 자리를 잡아 두면 어떤 배율에서도 읽힌다.
 */
export const LABEL_FONT_SIZE = 4;
const GROUP_FONT_SIZE = 4.6;
const FAMILY = '-apple-system, "Malgun Gothic", sans-serif';

export const LABEL_FONT = `${LABEL_FONT_SIZE}px ${FAMILY}`;
const GROUP_FONT = `600 ${GROUP_FONT_SIZE}px ${FAMILY}`;

// 글자 폭을 재는 데만 쓰는 캔버스. 매 프레임 재면 느리므로 노드에 캐시한다.
let _ctx = null;
const measureCtx = () => {
  if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
  return _ctx;
};

/**
 * 라벨 폭(그래프 단위). 노드에 캐시한다.
 * **이름을 줄이지 않는다.** 아무리 길어도 통째로 보여준다.
 */
export const labelWidth = (node) => {
  if (node.__labelW == null) {
    const ctx = measureCtx();
    ctx.font = isGroup(node.type) ? GROUP_FONT : LABEL_FONT;
    node.__labelW = ctx.measureText(node.label || '').width;
  }
  return node.__labelW;
};

/**
 * 축 알약에 붙는 **연결 수**. 개체는 반지름이 곧 연결 수인데, 알약은 이름 길이로
 * 크기가 정해져서 그 신호를 못 준다 — 하필 제일 필요한 것이 사람·KPI(최대 150, 35)다.
 * 숫자로 대신한다.
 */
const COUNT_FONT_SIZE = 3.4;
const COUNT_FONT = `${COUNT_FONT_SIZE}px ${FAMILY}`;
const COUNT_GAP = 2.2;

const countText = (node) => String(node.__degree || 0);

const countWidth = (node) => {
  const key = countText(node);
  if (node.__countKey !== key) {
    const ctx = measureCtx();
    ctx.font = COUNT_FONT;
    node.__countW = ctx.measureText(key).width;
    node.__countKey = key;
  }
  return node.__countW;
};

/** 축 알약의 크기(그래프 단위). 이름 + 연결 수가 나란히 들어간다. */
const PILL_PAD_X = 3.2;
const pillWidth = (node) =>
  labelWidth(node) + COUNT_GAP + countWidth(node) + PILL_PAD_X * 2;
const pillHeight = GROUP_FONT_SIZE + 4;

/**
 * 충돌 반지름 — **노드가 아니라 "노드 + 이름표" 가 차지하는 자리**다.
 *
 * ⚠️ **상한을 둔다.** 라벨 폭을 그대로 쓰면 이름이 긴 과제 하나가 반지름 40이
 *    넘는 금지 구역을 만든다. 그러면 노드를 끌어도 **관계된 것이 가까이 못 온다** —
 *    밀어내는 힘이 잇는 힘을 이겨 버린다. 상한을 넘는 긴 이름은 옆과 글씨가 조금
 *    겹칠 수 있다. 그 대신 "끌면 따라온다" 를 얻는다.
 *
 * 0.42 는 폭의 절반(0.5)보다 조금 작다 — 이웃한 두 라벨은 보통 세로로도 어긋나
 * 있어서 절반을 다 잡으면 필요 이상으로 벌어진다.
 */
const COLLIDE_MAX = 24;

export const collideRadius = (node) => {
  if (isGroup(node.type)) {
    // 알약은 글자가 **안에** 있으므로 폭의 절반을 그대로 쓴다(겹치면 못 읽는다).
    return Math.min(pillWidth(node) / 2, COLLIDE_MAX + 6) + 2;
  }
  return Math.min(Math.max(nodeRadius(node), labelWidth(node) * 0.42), COLLIDE_MAX) + 2;
};

/** 둥근 사각형 — `ctx.roundRect` 가 없는 환경도 있어 직접 그린다. */
const roundRect = (ctx, x, y, w, h, r) => {
  const rr = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

const leafPath = (ctx, node, r, shape) => {
  ctx.beginPath();
  if (shape === 'diamond') {
    ctx.moveTo(node.x, node.y - r);
    ctx.lineTo(node.x + r, node.y);
    ctx.lineTo(node.x, node.y + r);
    ctx.lineTo(node.x - r, node.y);
    ctx.closePath();
  } else if (shape === 'square') {
    const s = r * 0.9;
    roundRect(ctx, node.x - s, node.y - s, s * 2, s * 2, s * 0.35);
  } else if (shape === 'triangle') {
    ctx.moveTo(node.x, node.y - r);
    ctx.lineTo(node.x + r * 0.92, node.y + r * 0.72);
    ctx.lineTo(node.x - r * 0.92, node.y + r * 0.72);
    ctx.closePath();
  } else {
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
  }
};

/**
 * 노드 하나를 canvas 에 그린다. force-graph 의 `nodeCanvasObject` 규약.
 *
 * 종류마다 **모양이 다르다.** 색만 다르면 색각 이상이 있는 사람은 구분을 못 하고,
 * 흑백으로 뽑으면 아무도 못 한다.
 */
export const paintNode = (node, ctx, scale, opts = {}) => {
  const {
    colorMode = 'type', divisionColors = {}, dimmed = false, hovered = false,
  } = opts;
  const color = nodeColor(node, colorMode, divisionColors);
  const type = NODE_TYPES[node.type] || {};

  ctx.globalAlpha = dimmed ? 0.1 : 1;

  if (type.group) {
    // ── 축 : 이름 + 연결 수를 품은 알약 ──────────────────────────────
    const w = pillWidth(node);
    const h = pillHeight;
    roundRect(ctx, node.x - w / 2, node.y - h / 2, w, h, h / 2);
    ctx.fillStyle = type.tint || '#f1f5f9';
    ctx.fill();
    ctx.lineWidth = (hovered || node.__focused ? 1.1 : 0.7) / scale;
    ctx.strokeStyle = color;
    ctx.stroke();

    if (!dimmed) {
      // 이름은 왼쪽, 연결 수는 오른쪽. 가운데 정렬로 둘을 함께 그리면 이름 길이가
      // 바뀔 때마다 숫자 위치가 흔들려 읽기 나쁘다.
      const left = node.x - w / 2 + PILL_PAD_X;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = GROUP_FONT;
      ctx.fillStyle = color;
      ctx.fillText(node.label || '', left, node.y + 0.3);

      ctx.font = COUNT_FONT;
      ctx.fillStyle = color;
      ctx.globalAlpha = (dimmed ? 0.1 : 1) * 0.55;   // 이름보다 물러나야 한다
      ctx.fillText(countText(node), left + labelWidth(node) + COUNT_GAP, node.y + 0.4);
      ctx.globalAlpha = dimmed ? 0.1 : 1;
    }
  } else {
    // ── 잎 : 모양 있는 점 + 아래 이름표 ──────────────────────────────
    const r = nodeRadius(node) * (hovered ? 1.25 : 1);

    // 흰 테두리(헤일로) — 뒤로 지나가는 선과 노드를 떼어 놓는다.
    // 그림자보다 싸고, 노드가 수백 개여도 느려지지 않는다.
    leafPath(ctx, node, r + 0.9 / scale + 0.5, type.shape);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();

    leafPath(ctx, node, r, type.shape);
    ctx.fillStyle = color;
    ctx.fill();

    // 중점과제는 테두리로 표시한다. 색을 바꾸면 사업부별 색칠과 충돌한다.
    if (node.isKey) {
      ctx.lineWidth = 1.4 / scale;
      ctx.strokeStyle = '#dc2626';
      ctx.stroke();
    }

    if (!dimmed) {
      const text = node.label || '';
      const w = labelWidth(node);
      const y = node.y + r + 1.2;
      // 이름표를 **둥근 판** 위에 올린다 — 각진 흰 사각형보다 선 위에서 덜 거슬린다.
      roundRect(ctx, node.x - w / 2 - 1.4, y - 0.4, w + 2.8, LABEL_FONT_SIZE + 1.4, 1.2);
      ctx.fillStyle = hovered ? 'rgba(255,255,255,0.97)' : 'rgba(248,250,252,0.82)';
      ctx.fill();

      ctx.font = LABEL_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = hovered ? '#0f172a' : '#334155';
      ctx.fillText(text, node.x, y);
    }
  }

  // 고른 노드는 바깥 링으로. 크기를 키우면 degree 와 뜻이 겹친다.
  if (node.__focused) {
    const rr = (type.group ? pillWidth(node) / 2 : nodeRadius(node)) + 3;
    ctx.beginPath();
    ctx.arc(node.x, node.y, rr, 0, 2 * Math.PI);
    ctx.lineWidth = 1.6 / scale;
    ctx.strokeStyle = color;
    ctx.globalAlpha = dimmed ? 0.1 : 0.75;
    ctx.stroke();
  }
  // 끌어다 **고정해 둔** 노드. 표시가 없으면 "왜 안 움직이지" 가 된다.
  // 점선이라 중점과제(빨간 실선)·선택(바깥 링)과 헷갈리지 않는다.
  if (node.__pinned) {
    ctx.save();
    ctx.setLineDash([1.6 / scale, 1.6 / scale]);
    ctx.lineWidth = 1 / scale;
    ctx.strokeStyle = '#475569';
    if (type.group) {
      const w = pillWidth(node);
      roundRect(ctx, node.x - w / 2 - 1.2, node.y - pillHeight / 2 - 1.2,
        w + 2.4, pillHeight + 2.4, (pillHeight + 2.4) / 2);
    } else {
      leafPath(ctx, node, nodeRadius(node) + 1.8, type.shape);
    }
    ctx.stroke();
    ctx.restore();
  }

  ctx.globalAlpha = 1;
};

/** 클릭 판정 영역 — 그린 것과 **같은 크기**라야 손이 안 어긋난다. */
export const paintPointerArea = (node, color, ctx) => {
  ctx.fillStyle = color;
  if (isGroup(node.type)) {
    const w = pillWidth(node);
    roundRect(ctx, node.x - w / 2, node.y - pillHeight / 2, w, pillHeight,
      pillHeight / 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.arc(node.x, node.y, nodeRadius(node) + 2, 0, 2 * Math.PI);
  ctx.fill();
};
