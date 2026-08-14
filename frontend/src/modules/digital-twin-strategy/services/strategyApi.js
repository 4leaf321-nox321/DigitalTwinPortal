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

  updateAssessment: (year, dimension, payload) =>
    request(`/plans/${year}/assessments/${dimension}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  /** 근거 원천이 무엇을 돌려주는지 확인용 (Phase 1 점검) */
  previewEvidence: (year) => request(`/evidence-preview/${year}`),
};

export default strategyApi;
