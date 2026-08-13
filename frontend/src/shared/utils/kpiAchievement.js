/**
 * DX KPI 달성률 — 화면 쪽 구현.
 *
 * ★ 정본은 `backend/app/modules/dx_kpi_management/achievement.py` 다.
 *   이 파일은 그것의 **사본**이고, 사본은 갈린다. 그래서 갈리는 순간 깨지도록
 *   `backend/scripts/dt3_test_achievement.py` 가 두 구현을 같은 입력에 돌려 대조한다.
 *   규칙을 바꿀 일이 생기면 **양쪽을 같이** 고치고 그 시험을 돌린다.
 *
 * 왜 사본을 두나 (서버가 이미 계산해 주는데)
 *   매트릭스는 서버가 준 `metrics` 를 그리기만 한다 — 거기엔 사본이 필요 없다.
 *   그런데 'DX KPI 관리 종합 데이터' 표는 분기·월·주 세 축에 사업부×지표 전부를
 *   깔고, 그 위에서 Excel 3종을 만든다. 그걸 전부 서버 왕복으로 바꾸면 큰 개편이
 *   되고, 계산 자체는 나눗셈 한 줄이다. 위험한 것은 복잡도가 아니라 **갈림**이므로
 *   갈림을 시험으로 막고 계산은 화면에 둔다.
 *
 * 무엇이 틀렸었나 (2026-08-01)
 *   예전 `calcAchievement` 는 실적/목표만 했다. 망소 지표(Lead Time·라인 유실률·ASR)
 *   에서 달성률이 뒤집혀 나왔고, 100/80 경계로 색을 칠하니 **초록·빨강까지 반대**였다.
 *   실측: 라인 유실률 MX 목표1%/실적2% → 200%(초록)로 보였으나 실제는 50%(빨강).
 */

// 달성 판정 경계. 서버 achievement.py 와 같은 값이어야 한다.
export const NEAR_THRESHOLD = 80;
export const OK_THRESHOLD = 100;

/** 문자열/숫자 → number. 비었거나 숫자가 아니면 null (예외를 던지지 않는다). */
export const toNumber = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/**
 * 목표 1건 → 숫자.
 *
 * `kpi_targets` 는 값과 분자/분모를 따로 들고 있다. 분수로만 입력된 목표는 value 가
 * 비어 있으므로 분자/분모로 계산해야 한다 — 안 그러면 '목표 없음' 이 된다.
 * (기존 getTargetValue 가 value 만 봐서 생기던 구멍)
 */
export const targetNumber = (entry) => {
  if (entry === null || entry === undefined) return null;
  if (typeof entry === 'object') {
    const v = toNumber(entry.value);
    if (v !== null) return v;
    const num = toNumber(entry.numerator);
    const den = toNumber(entry.denominator);
    if (num !== null && den !== null && den !== 0) return num / den;
    return null;
  }
  return toNumber(entry);
};

/**
 * 달성률(%). 계산할 수 없으면 null.
 *
 *   higher(망대)  실적 / 목표      높을수록 좋다
 *   lower (망소)  목표 / 실적      낮을수록 좋다 → 목표보다 낮으면 100% 초과
 *
 * 목표가 0이거나 망소에서 실적이 0이면 나눌 수 없다. '무한대 달성' 으로 만들지 않고
 * 없음으로 둔다 — 그런 값이 표에 섞이면 평균·정렬이 조용히 망가진다.
 */
export const achievement = (target, actual, direction = 'higher') => {
  const t = toNumber(target);
  const a = toNumber(actual);
  if (t === null || a === null || t === 0) return null;
  if (direction === 'lower') {
    if (a === 0) return null;
    return (t / a) * 100;
  }
  return (a / t) * 100;
};

/**
 * 셀 하나의 상태.
 *   n_a / no_target / no_data / miss / near / ok
 */
export const status = (rate, { hasTarget, hasActual, applicable = true } = {}) => {
  if (!applicable) return 'n_a';
  if (!hasTarget) return 'no_target';
  if (!hasActual || rate === null || rate === undefined) return 'no_data';
  if (rate >= OK_THRESHOLD) return 'ok';
  if (rate >= NEAR_THRESHOLD) return 'near';
  return 'miss';
};

/**
 * 직전 대비 어느 쪽으로 움직였나 — 'better' | 'worse' | 'same' | null.
 *
 * 값이 오른 것과 **좋아진 것**은 다르다. 망소 지표(Lead Time·라인 유실률·ASR)는
 * 내려가야 좋아진 것이다. 화살표는 값의 방향(사실)이라 그대로 두되, **색은 이
 * 판정을 따라야 한다.** 안 그러면 좋아진 칸이 빨갛게 칠해진다.
 * (2026-08-01 실제로 그랬다 — DashboardView 의 DX KPI 표)
 *
 * boolean 이 아닌 이유: 악화와 변화없음을 한데 묶으면 급락한 칸과 아무 일 없는
 * 칸이 같아 보인다.
 */
export const changeOf = (prev, cur, direction = 'higher') => {
  const p = toNumber(prev);
  const c = toNumber(cur);
  if (p === null || c === null) return null;
  if (p === c) return 'same';
  const rose = c > p;
  const good = direction === 'lower' ? !rose : rose;
  return good ? 'better' : 'worse';
};

/** 'better'|'worse'|'same' → 색. 화살표 방향과 달리 색은 **좋고 나쁨**을 말한다. */
export const changeColor = (change) => (
  change === 'better' ? '#10b981' : change === 'worse' ? '#ef4444' : '#94a3b8'
);

/** 달성률 → 글자색. 종합표·전체 요약이 같은 경계를 쓰게 한다. */
export const achievementColor = (rate) => {
  if (rate === null || rate === undefined) return '#64748b';
  if (rate >= OK_THRESHOLD) return '#15803d';
  if (rate >= NEAR_THRESHOLD) return '#d97706';
  return '#dc2626';
};
