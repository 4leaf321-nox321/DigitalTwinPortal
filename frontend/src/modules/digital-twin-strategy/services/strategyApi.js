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

  /** 설문 제안값을 진단에 반영한다.
   *
   *  ⚠️ 읽기(getPlan)와 **쓰기를 가른 자리**다. 한 엔드포인트가 보여주면서
   *     저장하면 화면을 열어 본 것만으로 진단이 바뀐다.
   *  cells: [{survey_id, division_id, dimension}] — 어느 설문인지 반드시 명시한다. */
  applySurveyEvidence: (year, cells, overwriteManual = false) =>
    request(`/plans/${year}/assessments/apply-survey`, {
      method: 'POST',
      body: JSON.stringify({ cells, overwrite_manual: overwriteManual }),
    }),

  /** ③ 분석의 전략 요소(SWOT 한 칸). 후보에서 올렸거나 손으로 적은 것이다. */
  createElement: (year, payload) =>
    request(`/plans/${year}/elements`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateElement: (year, elementId, payload) =>
    request(`/plans/${year}/elements/${elementId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteElement: (year, elementId) =>
    request(`/plans/${year}/elements/${elementId}`, { method: 'DELETE' }),

  /** ④ 솔루션. TOWS 네 갈래 중 하나에 적은 솔루션 하나다.
   *
   *  element_ids 는 **근거**이지 필수가 아니다. 대라고 막으면 아무거나 붙는다. */
  createSolution: (year, payload) =>
    request(`/plans/${year}/solutions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateSolution: (year, solutionId, payload) =>
    request(`/plans/${year}/solutions/${solutionId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteSolution: (year, solutionId) =>
    request(`/plans/${year}/solutions/${solutionId}`, { method: 'DELETE' }),

  /** AX-5R 게이트 한 칸. **막는 관문이 아니라 표시다.**
   *
   *  status 는 answered | na 이고 둘 다 내용이 있어야 한다 — 이유 없는
   *  '해당 없음'은 안 답한 것과 구별이 안 되면서 다 채운 것처럼 보인다. */
  saveGate: (year, solutionId, gate, payload) =>
    request(`/plans/${year}/solutions/${solutionId}/gates/${gate}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  /** 답을 지운다 = 안 답한 상태로 되돌린다. */
  clearGate: (year, solutionId, gate) =>
    request(`/plans/${year}/solutions/${solutionId}/gates/${gate}`,
      { method: 'DELETE' }),

  /** 난제를 **이슈로 내린다.** (위에서 아래로 — 올린 것을 되돌리는 길)
   *
   *  ⚠️ 이 길이 없으면 잘못 올린 난제를 지우는 수밖에 없다. 딸린 이슈도 같이
   *     옮기므로 서버가 한 트랜잭션으로 한다. */
  demoteCrux: (year, cruxId, targetCruxId) =>
    request(`/plans/${year}/cruxes/${cruxId}/demote`, {
      method: 'POST',
      body: JSON.stringify({ crux_id: targetCruxId ?? null }),
    }),

  /** 이슈 여러 개를 **묶어서** 핵심 난제를 만든다. (아래에서 위로)
   *
   *  난제를 따로 만들고 이슈를 하나씩 옮기는 것과 결과는 같지만, 그 길은
   *  다섯 건이면 여섯 번을 눌러야 하고 하나를 빠뜨리면 그 이슈가 고아로 남는다.
   *  서버가 **한 트랜잭션**으로 처리한다. */
  createCruxFromIssues: (year, payload) =>
    request(`/plans/${year}/cruxes/from-issues`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** 설문 서술형을 AI 로 묶어 읽는다.
   *
   *  값을 바꾸지 않는데도 POST 다. **부르는 것 자체가 비용**이라, 새로고침에
   *  딸려 나가면 안 되기 때문이다. 결과도 저장하지 않는다. */
  loadSurveyVoices: (year) =>
    request(`/plans/${year}/survey-voices`, { method: 'POST', body: '{}' }),

  /** 솔루션에 걸 과제를 찾는다.
   *
   *  검색어가 없으면 그 전략 연도(+사업부)만, 있으면 그 범위를 넘어 찾는다.
   *  (한 해 200여 건이라 다 받아도 되지만, 좁혀 주는 편이 고르기 쉽다) */
  searchProjects: (year, { q, divisionId } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (divisionId) params.set('division_id', divisionId);
    const query = params.toString();
    return request(`/plans/${year}/projects${query ? `?${query}` : ''}`);
  },

  /** ⑤ 기획서. **본문은 서버가 매번 조립한다** — 앞 단계를 고치면 따라 바뀐다.
   *  확정한 뒤에는 그 시점이 굳는다. */
  getDocument: (year) => request(`/plans/${year}/document`),

  /** 사람이 정하는 것만 보낸다 — 구간 포함 여부와 손으로 쓴 글. */
  updateDocument: (year, sections) =>
    request(`/plans/${year}/document`, {
      method: 'PUT',
      body: JSON.stringify({ sections }),
    }),

  setDocumentStatus: (year, status) =>
    request(`/plans/${year}/document/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  /** ⚠️ 파일이라 request() 를 안 쓴다 — 그쪽은 JSON 을 기대한다.
   *  브라우저가 내려받게 하려면 Blob 을 만들어 링크를 눌러 줘야 한다. */
  downloadDocument: async (year) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_BASE}/plans/${year}/document/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let message = `내보내기 실패 (${res.status})`;
      try { message = (await res.json())?.message || message; } catch { /* 본문 없음 */ }
      throw new Error(message);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${year}년_디지털트윈_전략기획서.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

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
};

export default strategyApi;
