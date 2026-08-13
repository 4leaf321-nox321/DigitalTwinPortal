/**
 * 단위 환산 — **순수 함수**. 상태에 기대지 않는다.
 *
 * 규칙은 설정(`ModuleSettings.unitConversions`)에 있다. 예: `hrs → 억원`,
 * 사업부별·연도별 배율 override.
 *
 * ⚠️ **같은 계산이 이미 화면 세 곳에 복사돼 있다** (2026-08-09 확인)
 *      `KPIDashboard.jsx`        `applyConversion` (KPITreemap 에 prop 으로 내려감)
 *      `AllPerformancesView.jsx` `applyConversion`
 *      `DashboardView.jsx`       비슷한 계산
 *
 *    그리고 **그 셋이 이미 서로 다르다** — 값이 비었거나 숫자가 아닐 때
 *    KPIDashboard 는 **바뀐 단위**를, AllPerformancesView 는 **원래 단위**를 돌려준다.
 *    그래서 여기서 셋을 하나로 합치지 않았다 — 합치면 어느 화면인가의 동작이
 *    조용히 바뀌는데, 그 화면들을 눈으로 확인하지 않고 바꿀 수 없다.
 *
 *    이 파일은 **네 번째 복사본이 아니라** 앞으로 쓸 단일 출처다. 새 화면은 여기를
 *    쓰고, 기존 셋은 손볼 때 하나씩 이쪽으로 옮긴다.
 *    ↳ 옮길 때는 위 "빈 값일 때 어느 단위를 돌려주나" 를 먼저 정할 것.
 *
 * 여기서 고른 규약은 **KPIDashboard 쪽**이다 — 이 함수를 처음 쓰는 「과제·성과 추이」가
 * 성과 속성 카드(= KPI 대시보드 카드) 기준이라 그쪽과 같아야 한다.
 */
import { evalFactor } from './evalFactor';

/**
 * @param {*}      value       원본 값 (문자열일 수 있다)
 * @param {string} unit        원본 단위
 * @param {string} division    사업부 (배율 override 조회용)
 * @param {object} opts
 * @param {Array}  opts.conversions        설정의 `unitConversions`
 * @param {object} opts.active             {소문자단위: 규칙id} — 켜 둔 환산
 * @param {number} opts.year               연도별 override 조회용
 * @returns {{value: *, unit: string, converted: boolean}}
 */
export const applyConversion = (value, unit, division, opts = {}) => {
  const { conversions = [], active = {}, year } = opts;
  const srcKey = (unit || '').toLowerCase();
  const convId = active[srcKey];
  if (!convId) return { value, unit, converted: false };

  const conv = conversions.find(c => c.id === convId);
  if (!conv) return { value, unit, converted: false };

  // 값이 없어도 **단위는 바뀐 것으로** 답한다 — 축 이름·범례가 그 단위를 써야 하는데,
  // 값이 아직 없다고 원래 단위를 돌려주면 축이 도중에 바뀐다.
  if (value === undefined || value === null || value === '') {
    return { value, unit: conv.targetUnit, converted: true };
  }

  const num = parseFloat(value);
  if (Number.isNaN(num)) return { value, unit: conv.targetUnit, converted: true };

  // 연도별 override 가 있으면 그 안의 사업부 배율이 우선. 없으면 규칙의 기본 배율.
  let rawFactor = conv.defaultFactor;
  const yearData = conv.yearOverrides?.[String(year)];
  if (yearData) {
    rawFactor = yearData.divisionOverrides?.[division]?.factor ?? yearData.defaultFactor;
  } else {
    rawFactor = conv.divisionOverrides?.[division]?.factor ?? conv.defaultFactor;
  }

  const factor = evalFactor(rawFactor);
  if (Number.isNaN(factor)) return { value, unit: conv.targetUnit, converted: true };

  return {
    value: parseFloat((num * factor).toFixed(4)),
    unit: conv.targetUnit,
    converted: true,
  };
};

/**
 * 설정에서 **기본으로 켜 둔 환산**을 읽는다.
 *
 * 관리자가 「모든 성과 현황」에서 저장해 둔 값(`defaultActiveConversions`)이 정본이다.
 * 삭제된 규칙 id 가 남아 있을 수 있어 **지금 있는 규칙만** 남긴다 —
 * 안 거르면 없는 규칙을 찾다가 환산이 조용히 안 걸린다.
 */
export const defaultActiveConversions = (settingsData) => {
  const conversions = settingsData?.unitConversions || [];
  const saved = settingsData?.defaultActiveConversions;
  if (!saved || typeof saved !== 'object') return {};
  const valid = new Set(conversions.map(c => c.id));
  const out = {};
  Object.entries(saved).forEach(([srcKey, convId]) => {
    if (valid.has(convId)) out[srcKey] = convId;
  });
  return out;
};

/**
 * 카드 하나의 **한 시점 변화량** — 현재값을 0 으로 놓고 얼마나 움직였나.
 *
 *     목표 변화량 = |목표 − 현재|      목표대로면 이만큼 움직여야 한다
 *     실적 변화량 = |실적 − 현재|      실제로 이만큼 움직였다
 *     달성률      = 실적 변화량 / 목표 변화량
 *
 * **절대값을 쓰는 이유**: 성과의 절반쯤이 「비용 절감」·「시간 단축」처럼 **줄이는**
 * 목표라 delta 가 음수다. 부호를 그대로 두면 늘리는 목표와 줄이는 목표가 축의
 * 반대편에 그려져 한 그림에서 견줄 수가 없다. 크기만 보면 둘 다 "얼마나 갔나" 다.
 *
 * ⚠️ **기준 현재값은 부분집합마다 따로 잡는다.** `KPIDashboard.computeUnitGroup` 의
 *    `targetBaselineCurrent` / `valueBaselineCurrent` 와 **같은 규칙**이다 —
 *    목표 delta 의 기준은 *목표가 입력된 성과들*의 현재값 합이고, 실적 delta 의
 *    기준은 *실적이 입력된 성과들*의 현재값 합이다. 카드 전체 현재값 하나로
 *    두 delta 를 다 빼면, 값이 안 들어온 성과의 현재값이 섞여 delta 가 부풀어 오른다.
 *
 *    빈 값을 `0` 으로 치는 것(`toNum`)과 평균의 분모가 **부분집합 크기**인 것도
 *    저쪽과 맞춰 뒀다. 다르게 고치려면 두 곳을 같이 고칠 것.
 *
 * @returns {{target: number|null, actual: number|null, unit: string,
 *            rate: number|null, targetCount: number, actualCount: number}}
 */
export const cardDeltaAt = (card, index, opts = {}) => {
  const perfs = card.perfs || [];
  const has = v => v !== undefined && v !== null && v !== ''
    && !Number.isNaN(parseFloat(v));
  // 환산까지 마친 숫자. 값이 없으면 0 — `KPIDashboard.toNum` 과 같다.
  const num = (raw, perf) => {
    const n = parseFloat(applyConversion(raw, perf.unit, card.division, opts).value);
    return Number.isNaN(n) ? 0 : n;
  };
  const agg = (vals, total) => {
    if (!total) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return card.logic === '합계' ? sum : sum / total;
  };

  const delta = (kind) => {
    const subset = perfs.filter(p => has(p[kind]?.[index]));
    if (!subset.length) return [null, 0];
    const value = agg(subset.map(p => num(p[kind][index], p)), subset.length);
    const base = agg(subset.map(p => num(p.currents?.[index], p)), subset.length);
    if (value === null || base === null) return [null, 0];
    return [parseFloat(Math.abs(value - base).toFixed(4)), subset.length];
  };

  const [target, targetCount] = delta('targets');
  const [actual, actualCount] = delta('actuals');

  // 단위는 환산 뒤 이름이어야 한다 — 축·툴팁이 "hrs" 라고 쓰는데 값은 억원이면 틀린 말이다.
  let unit = '';
  for (const p of perfs) {
    unit = applyConversion(null, p.unit, card.division, opts).unit || p.unit || '';
    if (unit) break;
  }

  return {
    target,
    actual,
    unit,
    // 목표 변화량이 0 이면 나눌 수 없다 — 목표가 현재와 같다는 뜻이라 달성률이 없다.
    rate: (target && actual !== null) ? (actual / target) * 100 : null,
    targetCount,
    actualCount,
  };
};
