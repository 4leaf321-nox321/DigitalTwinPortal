/**
 * 피벗 우측 요약 패널이 쓰는 집계.
 *
 * 피벗 표에서 고른 칸(범위)에 맞춰 투자 건을 걸러 내고,
 *   · 연도별 계획/실적/집행률
 *   · 고른 기준열의 구성
 * 를 낸다. 화면과 떼어 둔 순수 함수라 그대로 시험할 수 있다.
 */
import { PIVOT_DIMENSIONS, UNSET, dimValueOf, yearKeyOf } from './buildPivot';

/** 아무것도 안 고른 상태(= 전체). */
export const NO_SCOPES = [];

/**
 * 표의 어느 칸을 눌렀는지를 범위로 만든다.
 * depth 1 이면 투자 유형까지, 4 면 잎 하나까지 좁힌 것이다.
 */
export const makeScope = (path, depth) => {
  if (!path || depth <= 0) return null;
  return { depth, path: path.slice(0, depth) };
};

export const scopeKey = (scope) =>
  (!scope ? '' : `${scope.depth}:${scope.path.join('>')}`);

export const hasScope = (scopes = [], scope) =>
  scopes.some(s => scopeKey(s) === scopeKey(scope));

/**
 * 칸을 눌렀을 때 고른 범위 목록이 어떻게 바뀌는가.
 *
 * 그냥 누르면 **그 칸 하나만** 고른다(이미 그것뿐이면 푼다).
 * Ctrl(맥은 ⌘)을 누른 채면 **목록에 더하거나 뺀다** — 여러 영역을 함께 보는 길이다.
 * 표 편집기에서 익은 몸짓이라 따로 배울 것이 없다.
 */
export const applyScopePick = (scopes = [], next, additive = false) => {
  if (!next) return NO_SCOPES;
  if (additive) {
    return hasScope(scopes, next)
      ? scopes.filter(s => scopeKey(s) !== scopeKey(next))
      : [...scopes, next];
  }
  const onlyThis = scopes.length === 1 && hasScope(scopes, next);
  return onlyThis ? NO_SCOPES : [next];
};

export const removeScope = (scopes = [], scope) =>
  scopes.filter(s => scopeKey(s) !== scopeKey(scope));

/** 「H/W ▸ MX」 처럼 사람이 읽는 범위 이름. */
export const scopeLabel = (scope) => (!scope ? '' : scope.path.join(' ▸ '));

/** 이 투자 건이 범위 안에 드는가. 피벗과 **같은 규칙**으로 값을 꺼내 견준다. */
export const inScope = (row, scope) => {
  if (!scope) return true;
  for (let i = 0; i < scope.depth; i += 1) {
    const dim = PIVOT_DIMENSIONS[i];
    if (!dim) return true;
    if (dimValueOf(row, dim.key) !== scope.path[i]) return false;
  }
  return true;
};

/** 고른 범위가 여럿이면 **합집합**이다 — 어느 하나에만 들어도 센다. */
export const inAnyScope = (row, scopes = []) =>
  (scopes.length === 0 || scopes.some(s => inScope(row, s)));

/**
 * 고른 범위들로 거른다.
 *
 * 범위끼리 겹쳐도(예: 「H/W」와 「H/W ▸ MX」) 한 건이 두 번 세어지지 않는다 —
 * 묶음을 더하는 게 아니라 **한 건이 드느냐 마느냐**로 거르기 때문이다.
 */
export const filterByScopes = (rows = [], scopes = []) =>
  (scopes.length === 0 ? rows : rows.filter(r => inAnyScope(r, scopes)));

/** 범위 하나로만 거를 때 (영역끼리 견주는 막대가 쓴다). */
export const filterByScope = (rows = [], scope) =>
  (!scope ? rows : rows.filter(r => inScope(r, scope)));

const num = (v) => (Number(v) || 0);

/**
 * 집행률 = 실적 ÷ 계획.
 * 계획이 0이면 비율이 뜻을 잃는다 — 0 으로 나눠 Infinity 를 그리지 않고 null 로 둔다.
 */
export const executionRate = (plan, actual) =>
  (!plan ? null : Math.round((actual / plan) * 1000) / 10);

/**
 * 연도별 계획/실적/집행률. 가로축은 피벗의 연도 열과 같은 차례다
 * (오름차순, 년도가 빈 건은 맨 뒤).
 */
export const buildYearSeries = (rows = []) => {
  const byYear = new Map();
  rows.forEach(row => {
    const key = yearKeyOf(row);
    if (!byYear.has(key)) byYear.set(key, { year: key, plan: 0, actual: 0, count: 0 });
    const bucket = byYear.get(key);
    bucket.plan += num(row.planAmount);
    bucket.actual += num(row.actualAmount);
    bucket.count += 1;
  });

  const round = (n) => Math.round(n * 100) / 100;
  const series = [...byYear.values()].map(b => ({
    ...b,
    plan: round(b.plan),
    actual: round(b.actual),
    rate: executionRate(b.plan, b.actual),
  }));

  // 숫자 연도 먼저 오름차순, '미지정' 은 맨 뒤
  return series.sort((a, b) => {
    if (a.year === b.year) return 0;
    if (a.year === '미지정') return 1;
    if (b.year === '미지정') return -1;
    return Number(a.year) - Number(b.year);
  });
};

/**
 * 고른 기준열의 구성. 큰 것부터 세운다(가로 막대라 위에서 아래로 읽힌다).
 *
 * @param metric 'actual' | 'plan' — 무엇을 기준으로 비중을 낼지
 */
export const buildBreakdown = (rows = [], dimKey, metric = 'actual') => {
  const byName = new Map();
  rows.forEach(row => {
    const name = dimValueOf(row, dimKey);
    if (!byName.has(name)) byName.set(name, { name, plan: 0, actual: 0, count: 0 });
    const bucket = byName.get(name);
    bucket.plan += num(row.planAmount);
    bucket.actual += num(row.actualAmount);
    bucket.count += 1;
  });

  const items = [...byName.values()];
  const total = items.reduce((s, it) => s + it[metric], 0);
  const round = (n) => Math.round(n * 100) / 100;

  return items
    .map(it => ({
      ...it,
      plan: round(it.plan),
      actual: round(it.actual),
      value: round(it[metric]),
      share: total ? Math.round((it[metric] / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;   // 큰 것부터
      if (a.name === UNSET) return 1;                      // 값이 같으면 미지정을 뒤로
      if (b.name === UNSET) return -1;
      return a.name.localeCompare(b.name, 'ko');
    });
};

/**
 * 구성 막대를 무엇으로 그릴지 정한다.
 * 실적이 한 푼도 없으면(아직 집행 전) 실적 기준 막대는 전부 0이라 볼 것이 없다 —
 * 그럴 때는 계획 기준으로 돌리고, 화면에 그 사실을 적는다.
 */
export const pickBreakdownMetric = (rows = []) =>
  (rows.some(r => num(r.actualAmount) > 0) ? 'actual' : 'plan');

/** 범위 안의 합계 한 줄. 패널 머리에 적는다. */
export const scopeTotals = (rows = []) => {
  const plan = rows.reduce((s, r) => s + num(r.planAmount), 0);
  const actual = rows.reduce((s, r) => s + num(r.actualAmount), 0);
  return {
    plan: Math.round(plan * 100) / 100,
    actual: Math.round(actual * 100) / 100,
    rate: executionRate(plan, actual),
    count: rows.length,
  };
};

/**
 * 고른 영역들을 나란히 견준다. 영역을 여럿 고른 이유가 대개 이것이다.
 *
 * 겹치는 영역을 골랐다면 같은 건이 두 줄에 모두 들어간다 — 이건 나눠 담은 표가
 * 아니라 **골라 놓고 견주는** 자리라 그게 맞다. 합계 카드는 합집합이라 다르다.
 */
export const buildScopeComparison = (rows = [], scopes = []) =>
  scopes.map(scope => {
    const totals = scopeTotals(filterByScope(rows, scope));
    return { key: scopeKey(scope), label: scopeLabel(scope), scope, ...totals };
  });
