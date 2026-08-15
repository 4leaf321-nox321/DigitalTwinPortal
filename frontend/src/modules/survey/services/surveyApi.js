// 설문 모듈의 유일한 서버 접점.
//
// 관리(`/manage/*`)와 응답(`/mine`, `/<id>/form`, …)이 **한 파일에 같이 있다.**
// 백엔드는 권한 기준이 달라 블루프린트를 둘로 갈랐지만(`survey/routes.py:28-29`),
// 프론트에서 파일까지 가르면 base 경로가 두 군데에 적혀 한쪽만 고치는 사고가 난다.
// 대신 아래 주석으로 두 층을 갈라 둔다 — 가르는 것은 백엔드다.

const API_BASE = '/api/surveys';

// 포탈 공통 인증 방식. localStorage 의 accessToken 을 Bearer 로 싣는다
// (다른 모듈의 api 헬퍼와 같은 모양이다).
async function authFetch(url, options = {}) {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(url, {
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
    // 서버가 준 문구를 그대로 올린다. '이미 응답하셨습니다', '지금은 응답을
    // 받지 않는 설문입니다' 같은 말은 프론트가 다시 지어낼 수 없다.
    throw new Error(body?.message || `요청 실패 (${res.status})`);
  }
  return body;
}

const request = (path, options) => authFetch(`${API_BASE}${path}`, options);

/** context 로 목록을 좁힐 때 쓰는 쿼리. 둘 다 없으면 빈 문자열이다. */
function contextQuery(context) {
  const params = new URLSearchParams();
  if (context?.context_type) params.set('context_type', context.context_type);
  if (context?.context_id !== undefined && context?.context_id !== null
      && context.context_id !== '' && !Number.isNaN(Number(context.context_id))) {
    params.set('context_id', String(context.context_id));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const surveyApi = {
  // ── 응답자용 (로그인만 필요, 역할 무관) ──────────────────────────────

  /** 내가 받은, 지금 답할 수 있는 설문. 서버가 미응답을 먼저 보낸다. */
  listMine: () => request('/mine'),

  /** 미응답 건수만. 헤더 배지처럼 가벼운 표시에 쓴다. */
  pendingCount: () => request('/mine/count'),

  /** 문항 + division_id/division_name(읽기 전용) + already_answered.
   *  대상자가 아니면 404 다. */
  getForm: (surveyId) => request(`/${surveyId}/form`),

  /** 제출. 1인 1회이고, 두 번째부터는 서버가 409 를 준다. */
  submitResponse: (surveyId, payload) =>
    request(`/${surveyId}/responses`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // ── 관리자용 (admin · dt_office) ─────────────────────────────────────
  //
  // 화면에서 이 함수들을 감추는 것은 방어가 아니다. 막는 곳은 백엔드의
  // manager_required 한 곳이고, 여기서는 403 을 그냥 메시지로 보여준다.

  /** context 를 주면 그 전략(등)에 매달린 설문만, 안 주면 전부. */
  /** 고를 수 있는 역할·프로세스와 사무국장 설정.
   *
   * ⚠️ 화면이 목록을 하드코딩하면 서버가 받는 값과 갈린다 — 화면엔 있는데
   *    저장하면 400 이 나거나, 화면엔 없는 값이 표로는 들어간다. 정본은 서버다. */
  getOptions: () => request('/manage/options'),

  setOfficeHeads: (userIds) =>
    request('/manage/options/office-heads', {
      method: 'PUT',
      body: JSON.stringify({ user_ids: userIds }),
    }),

  listSurveys: (context) => request(`/manage${contextQuery(context)}`),

  /** 목록에는 문항이 없다. 편집하려면 이걸로 문항까지 받아야 한다. */
  getSurvey: (surveyId) => request(`/manage/${surveyId}`),

  /** 연도가 아니라 context 를 **본문**에 실어 보낸다 — 경로에 넣지 않는다. */
  createSurvey: (payload) =>
    request('/manage', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateSurvey: (surveyId, payload) =>
    request(`/manage/${surveyId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // ── 표 일괄 입력 ─────────────────────────────────────────────────────
  //
  // **운영 서버에서는 코드를 못 고친다.** 그래서 문항 정의를 표로 받는다.
  // ⚠️ 파싱은 **서버가** 한다. 미리보기와 생성이 백엔드의 같은 파서를 부르므로
  //    "미리보기는 통과했는데 생성은 실패"가 생기지 않는다. 프론트에서 따로
  //    파싱하면 그 순간 규칙이 두 벌이 된다.

  /** 붙여넣은 표를 읽어만 본다. **아무것도 저장하지 않는다.** */
  previewImport: (text) =>
    request('/manage/import/preview', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  /**
   * 표에서 설문을 통째로 만든다.
   * 오류가 한 줄이라도 있으면 서버가 400 을 주고 **아무것도 만들지 않는다** —
   * 반쯤 만들어진 설문이 남는 것이 가장 나쁘다.
   */
  importSurvey: (payload) =>
    request('/manage/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /**
   * 이미 있는 설문에 표의 문항을 **덧붙인다.**
   *
   * 만들기와 **같은 엔드포인트**다 — body 에 survey_id 가 있으면 서버가
   * 덧붙이기로 읽는다. 파서가 한 벌이어야 "미리보기는 통과했는데 생성은 실패"가
   * 안 생기듯, 이쪽도 규칙을 두 벌로 만들지 않는다.
   *
   * 그런데도 함수를 따로 두는 이유: 덧붙이기에서 title·description·target 은
   * 서버가 **무시한다.** 인자를 나눠 두면 그것들을 실을 방법이 아예 없어서,
   * "제목을 고쳐 보냈는데 안 바뀌었다"가 생기지 않는다.
   *
   * ⚠️ 응답이 한 건이라도 있는 설문이면 **409** 다(받은 답이 무엇에 대한
   *    답이었는지 알 수 없게 되므로). 없는 id 면 404. 화면에서 미리 못 고르게
   *    막지만, 고르고 누르는 사이 누가 답할 수 있어 서버가 마지막으로 막는다.
   * ⚠️ roles/processes 는 기존 값과 **합집합**이다. 덮어쓰지 않으므로 기존
   *    역할이 사라지지 않는다.
   *
   * @param {number} surveyId 덧붙일 설문 id
   * @param {{text: string, roles?: string[], processes?: string[], link_type?: string}} payload
   */
  appendImport: (surveyId, payload) =>
    request('/manage/import', {
      method: 'POST',
      body: JSON.stringify({ ...payload, survey_id: surveyId }),
    }),

  deleteSurvey: (surveyId) =>
    request(`/manage/${surveyId}`, { method: 'DELETE' }),

  /** 배포(open) · 마감(closed) · 회수(draft) */
  setSurveyStatus: (surveyId, status, closesAt) =>
    request(`/manage/${surveyId}/status`, {
      method: 'PUT',
      // closes_at 은 **줄 때만** 싣는다. 항상 실으면 배포/마감 토글을 누를
      // 때마다 설정된 마감일이 지워진다 — 백엔드는 키가 있으면 덮어쓴다.
      body: JSON.stringify(
        closesAt === undefined ? { status } : { status, closes_at: closesAt }
      ),
    }),

  /** 집계. 응답자 신원은 실리지 않는다. */
  getSurveyResults: (surveyId) => request(`/manage/${surveyId}/results`),

  /** 응답 원자료 CSV 를 내려받는다.
   *
   * ⚠️ 다른 함수와 달리 JSON 이 아니다. 브라우저가 파일로 받게 하려면 blob 을
   *    직접 다뤄야 한다. 응답자 이름은 실리지 않는다(서버가 안 넣는다). */
  exportResponses: async (surveyId) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_BASE}/manage/${surveyId}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`내보내기 실패 (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey_${surveyId}_responses.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // 안 풀어 주면 파일 하나가 탭이 닫힐 때까지 메모리에 남는다.
    URL.revokeObjectURL(url);
  },

  /** ⚠️ 응답자 확인. 부르는 순간 감사 로그가 남는다. */
  getSurveyIdentities: (surveyId) => request(`/manage/${surveyId}/identities`),

  // ── 부수 ─────────────────────────────────────────────────────────────

  /**
   * 사업부 목록. **설문 API 가 아니다** — 포탈 공통 설정에서 빌려 온다
   * (`@jwt_required()` 만 걸려 있어 전 직원이 부를 수 있다. 선례:
   * modules/spdm-status/SPDMStatusApp.jsx).
   *
   * ⚠️ 실패해도 던지지 않고 빈 배열을 돌려준다. 사업부는 응답에 **곁들이는**
   * 정보라, 이것 때문에 응답 자체가 막히면 안 된다. 목록이 비면 화면이
   * 「모름」만 남는 모드로 내려간다.
   */
  listDivisions: async () => {
    try {
      const body = await authFetch('/api/digital-twin-dashboard/settings');
      const rows = body?.data?.divisions || [];
      // to_dict() 가 id 를 문자열로 준다. 비교는 화면에서 String() 으로 맞춘다.
      return rows.map(d => ({ id: d.id, name: d.name }));
    } catch {
      return [];
    }
  },
};

export default surveyApi;
