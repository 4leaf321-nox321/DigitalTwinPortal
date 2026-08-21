/**
 * 관계도 AI 에이전트 API.
 *
 * **분석과 서술이 따로 온다** (`디지털트윈_관계도_AI에이전트_계획.md` §1-①).
 *
 *     fetchGaps / fetchKpiBriefing / fetchRisky / fetchHidden
 *         숫자·순위·근거 경로. **LLM 을 안 부르므로 빠르고, LLM 이 죽어도 나온다.**
 *     narrate(analysis)
 *         위 결과를 그대로 넘겨 문장 3~5개를 받는다. 여기만 LLM 을 탄다.
 *
 * 화면은 **숫자를 먼저 그리고 문장을 나중에 붙인다.** 그래야 LLM 이 느려도 화면이
 * 멈추지 않고, LLM 이 죽어도 브리핑이 반쯤은 쓸모 있다.
 *
 * ⚠️ `narrate` 는 실패해도 **200 에 `narrative: null`** 로 온다. 문장이 없다고
 *    이미 떠 있는 숫자를 오류로 덮으면 안 되기 때문이다 — 호출부도 그렇게 다룰 것.
 */

// `settingsApi.js` 와 같은 식으로 정한다(그 파일은 화면 전체가 쓰는 큰 파일이라
// 이 기능 때문에 export 를 늘리지 않는다).
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
});

const unwrap = async (response, what) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `${what} 실패`);
    error.status = response.status;
    throw error;
  }
  return data.data;
};

/** 연도·사업부 필터를 질의 문자열로. 관계도 화면의 필터를 그대로 쓴다. */
const scopeQuery = ({ years, divisions } = {}) => {
  const q = new URLSearchParams();
  if (years?.length) q.set('years', years.join(','));
  if (divisions?.length) q.set('divisions', divisions.join(','));
  return q;
};

const getAnalysis = async (path, scope, what, extra = {}) => {
  const q = scopeQuery(scope);
  Object.entries(extra).forEach(([k, v]) => {
    if (v != null) q.set(k, String(v));
  });
  const r = await fetch(`${API_BASE_URL}/dt-v2/graph/agent/${path}?${q.toString()}`,
    { headers: authHeaders() });
  return unwrap(r, what);
};

/** 0단계 — 데이터 공백 리포트. */
/**
 * 지금 급한 것 — 여섯 분석을 한 번에 돌려 겹쳐 걸리는 것부터.
 *
 * `year` 는 위험 지표를 곁들일 때만 쓴다. 없으면 그 한 줄만 빠진다.
 */
export const fetchBrief = (scope, year) =>
  getAnalysis('brief', scope, '지금 급한 것 조회', { year });

export const fetchGaps = (scope) => getAnalysis('gaps', scope, '데이터 공백 조회');

/** 1단계 — KPI 한 장 브리핑. */
export const fetchKpiBriefing = (kpiId, scope) =>
  getAnalysis(`kpi/${kpiId}`, scope, 'KPI 브리핑 조회');

/** 3단계 — 위험 지표. */
export const fetchRisky = (scope, limit = 5) =>
  getAnalysis('risky', scope, '위험 지표 조회', { limit });

/** 4단계 — 숨은 연결. */
export const fetchHidden = (scope, limit = 12) =>
  getAnalysis('hidden', scope, '숨은 연결 조회', { limit });

/** 멈춘 과제 — 진척 이력(시간 축)을 읽는 유일한 분석. */
export const fetchStalled = (scope, minDays) =>
  getAnalysis('stalled', scope, '멈춘 과제 조회', { minDays });

/** 일정 쏠림 — 미완료 액션의 목표일이 한 달에 몰린 과제. */
export const fetchSchedule = (scope) => getAnalysis('schedule', scope, '일정 쏠림 조회');

/** 이슈 적체. */
export const fetchIssues = (scope) => getAnalysis('issues', scope, '이슈 적체 조회');

/** 중점과제의 말과 실제. */
export const fetchKeyProjects = (scope) =>
  getAnalysis('key-projects', scope, '중점과제 조회');

/** 보고 준비도 — 「결과 보고서」 전 체크리스트. */
export const fetchReadiness = (scope) => getAnalysis('readiness', scope, '보고 준비도 조회');

/**
 * 사업부별 **데이터 채움**. 진행률·달성률은 **일부러 빠져 있다** —
 * 응답의 `excluded` 에 무엇을 왜 뺐는지 실려 오므로 화면이 그대로 밝힌다.
 */
export const fetchDivisions = (scope) =>
  getAnalysis('divisions', scope, '사업부별 채움 조회');

/**
 * 분석 결과 → 서술. **실패해도 던지지 않는다** — `{narrative: null, error}` 로 온다.
 * 서버가 그렇게 설계돼 있고(계획서 §1-①), 화면도 그 규약에 맞춰 다룬다.
 */
export const narrate = async (analysis) => {
  const r = await fetch(`${API_BASE_URL}/dt-v2/graph/agent/narrate`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ analysis }),
  });
  return unwrap(r, '서술 생성');
};
