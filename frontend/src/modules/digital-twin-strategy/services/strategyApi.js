const API_BASE = '/api/digital-twin-strategy';

async function request(path, options = {}) {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    // 본문이 없거나 JSON 이 아닌 응답
  }

  if (!res.ok) {
    throw new Error(body?.message || `요청 실패 (${res.status})`);
  }
  return body;
}

export const strategyApi = {
  /** 성숙도 차원 목록과 근거 원천 모드 */
  getMeta: () => request('/meta'),

  /** 해당 연도 전략. 없으면 data 가 null 이다 (오류가 아니다) */
  getPlan: (year) => request(`/plans/${year}`),

  createPlan: (year, title) =>
    request('/plans', {
      method: 'POST',
      body: JSON.stringify({ year, title }),
    }),

  updateAssessment: (year, divisionId, category, dimension, payload) =>
    request(`/plans/${year}/assessments/${divisionId}/${category}/${dimension}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  /** 활용·성과 지표의 목표값. 관측값은 계산되므로 저장하지 않는다. */
  updateMetricTarget: (year, divisionId, metricKey, payload) =>
    request(`/plans/${year}/metric-targets/${divisionId}/${metricKey}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  /** 진단 임계값. 기본값과 다른 항목만 저장된다. */
  updateThresholds: (thresholds) =>
    request('/settings/thresholds', {
      method: 'PUT',
      body: JSON.stringify({ thresholds }),
    }),

  /** 핵심 난제(crux) — 진단의 산출물. 다음 단계의 입력이 된다. */
  createCrux: (year, payload) =>
    request(`/plans/${year}/cruxes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateCrux: (year, cruxId, payload) =>
    request(`/plans/${year}/cruxes/${cruxId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteCrux: (year, cruxId) =>
    request(`/plans/${year}/cruxes/${cruxId}`, { method: 'DELETE' }),

  /** ② 이슈 — 핵심 난제를 풀 수 있는 크기로 쪼갠 것 */
  createIssue: (year, payload) =>
    request(`/plans/${year}/issues`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateIssue: (year, issueId, payload) =>
    request(`/plans/${year}/issues/${issueId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  /** 지우면 왜 안 하기로 했는지가 안 남는다. 보통은 status='dropped' 를 쓴다. */
  deleteIssue: (year, issueId) =>
    request(`/plans/${year}/issues/${issueId}`, { method: 'DELETE' }),

  /** 근거 원천이 무엇을 돌려주는지 확인용 (Phase 1 점검) */
  previewEvidence: (year) => request(`/evidence-preview/${year}`),

  // ── 설문 (관리자) ────────────────────────────────────────────────────
  // 응답자용 API 는 /api/surveys 라 이 파일이 아니라 설문 모듈에 둔다.

  listSurveys: (year) => request(`/plans/${year}/surveys`),

  getSurvey: (surveyId) => request(`/surveys/${surveyId}`),

  createSurvey: (year, payload) =>
    request(`/plans/${year}/surveys`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateSurvey: (surveyId, payload) =>
    request(`/surveys/${surveyId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteSurvey: (surveyId) =>
    request(`/surveys/${surveyId}`, { method: 'DELETE' }),

  /** 배포(open)·마감(closed)·회수(draft) */
  setSurveyStatus: (surveyId, status, closesAt) =>
    request(`/surveys/${surveyId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, closes_at: closesAt ?? null }),
    }),

  /** 집계. 응답자 신원은 실리지 않는다. */
  getSurveyResults: (surveyId) => request(`/surveys/${surveyId}/results`),

  /** ⚠️ 응답자 확인. 부르는 순간 감사 로그가 남는다. */
  getSurveyIdentities: (surveyId) => request(`/surveys/${surveyId}/identities`),
};

export default strategyApi;
