// 개발 디지털 트윈 성숙도 API. 전략 모듈의 request 와 같은 모양.
const API_BASE = '/api/dev-dt-maturity';

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
  try { body = await res.json(); } catch { /* 본문 없음 */ }
  if (!res.ok) {
    const err = new Error(body?.message || `요청 실패 (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body;
}

const json = (method, payload) => ({ method, body: JSON.stringify(payload) });

export const maturityApi = {
  getDefinitions: () => request('/definitions'),
  getDivisions: () => request('/divisions'),
  /** 사업부 판. 이 판에는 「전체」가 없다 — division_id 가 필수다. */
  getBoard: (divisionId, sector = 'simulation') =>
    request(`/board?division_id=${divisionId}&sector=${sector}`),
  getChanges: (divisionId, sector = 'simulation', days = 365) =>
    request(`/changes?division_id=${divisionId}&sector=${sector}&days=${days}`),

  listSubjects: (divisionId) => request(`/subjects?division_id=${divisionId}`),
  createSubject: (payload) => request('/subjects', json('POST', payload)),
  updateSubject: (id, payload) => request(`/subjects/${id}`, json('PUT', payload)),
  deleteSubject: (id) => request(`/subjects/${id}`, { method: 'DELETE' }),

  listAgents: (divisionId) => request(`/agents?division_id=${divisionId}`),
  createAgent: (payload) => request('/agents', json('POST', payload)),
  updateAgent: (id, payload) => request(`/agents/${id}`, json('PUT', payload)),
  deleteAgent: (id) => request(`/agents/${id}`, { method: 'DELETE' }),

  getPair: (id) => request(`/pairs/${id}`),
  createPair: (subjectId, agentId) =>
    request('/pairs', json('POST', { subject_id: subjectId, agent_id: agentId })),
  deletePair: (id) => request(`/pairs/${id}`, { method: 'DELETE' }),
  /** 칸의 도달 시점(연-월)을 그 자리에서 적는다. */
  setReached: (pairId, axis, rung, month) =>
    request(`/pairs/${pairId}/reached/${axis}/${rung}`, json('PUT', { month })),
  /** 축 하나를 매긴다. 근거(note)가 없으면 서버가 거절한다. */
  assess: (pairId, axis, payload) =>
    request(`/pairs/${pairId}/assessments/${axis}`, json('PUT', payload)),

  templateUrl: (divisionId) => `${API_BASE}/import/template?division_id=${divisionId}`,
  /** 틀 내려받기는 토큰을 헤더로 보내야 해서 fetch 로 받아 blob 으로 연다. */
  downloadTemplate: async (divisionId) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(maturityApi.templateUrl(divisionId), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`틀을 받지 못했습니다 (${res.status})`);
    return res.blob();
  },
  importPreview: (divisionId, text) =>
    request('/import/preview', json('POST', { division_id: divisionId, text })),
  importApply: (divisionId, text, withAccuracy, sourceLabel) =>
    request('/import', json('POST', {
      division_id: divisionId, text, with_accuracy: withAccuracy, source_label: sourceLabel,
    })),
  reconcile: (divisionId) => request(`/reconcile?division_id=${divisionId}`),

  /** 도구 이름 제안 — 인텔 도구 표의 이름만. 없어도 빈 목록. */
  getToolNames: () => request('/tool-names'),
  /** 도구 찾기 창의 재료 — 이름·분야·공급사. */
  getToolCatalog: () => request('/tool-catalog'),
  /** 사업부 도구 이름 정돈 — 인텔 표준과 대본 결과. */
  getToolAudit: (divisionId) => request(`/tool-audit?division_id=${divisionId}`),
  renameTool: (divisionId, from, to) => request('/tools/rename', json('POST', { division_id: divisionId, from, to })),
  /** 제품군 — 도구와 같은 셋. 표준은 로드맵 정보의 제품군 설정. */
  getFamilyCatalog: (divisionId) => request(`/family-catalog?division_id=${divisionId}`),
  getFamilyAudit: (divisionId) => request(`/family-audit?division_id=${divisionId}`),
  renameFamily: (divisionId, from, to) => request('/families/rename', json('POST', { division_id: divisionId, from, to })),

  /** 담당 부서 고르기의 재료 — 사업부의 활성 부서. 'all' 이면 {division_id: [...]} */
  getDepartments: (divisionId) => request(`/departments?division_id=${divisionId}`),

  getSettings: () => request('/settings'),
  putSettings: (payload) => request('/settings', json('PUT', payload)),
};

export default maturityApi;
