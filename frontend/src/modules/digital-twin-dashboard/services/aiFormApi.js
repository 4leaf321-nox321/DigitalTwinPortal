/**
 * 폼 도우미 API — LLM 이 **편집 화면의 칸에 넣을 값**을 만들어 준다.
 *
 * 🚦 전체 지도: 루트 `디지털트윈_AI기능_지도.md`
 *
 * ⚠️ **아무것도 저장하지 않는다.** 여기서 받은 값은 폼에 들어갈 뿐이고, 저장은
 *    평소의 저장 버튼(`dashboardWriteApi`)이 한다 — 그래서 권한·낙관적 락·변경 이력이
 *    평소와 똑같이 걸린다. AI 에이전트(`AiAgentPanel`)와 여기가 갈리는 지점이다.
 *
 * 서버는 값을 **검증해서** 준다(선택지에 없는 사업부, 13월, 남의 해 목표일은 버린다).
 * 그러니 화면은 검증을 다시 하지 말 것 — 두 곳이 되면 갈린다. 화면이 할 일은
 * **바뀔 값을 사람에게 보여주고 고르게 하는 것** 하나다.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function post(path, body) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }

  if (!res.ok || !data?.success) {
    // 401 은 flask-jwt-extended 의 `{msg}` 라 우리 `{success, message}` 모양이 아니다 —
    // 그대로 두면 "실패했습니다" 만 뜨고 **원인을 알 수가 없다**(AiAgentPanel 과 같은 함정).
    throw new Error(
      res.status === 401
        ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
        : (data?.message || `요청이 실패했습니다 (HTTP ${res.status}).`)
    );
  }
  return data.data || {};
}

/**
 * 붙여넣은 글 → 폼에 넣을 값.
 *
 * @param {string} uuid        과제 uuid (권한을 이 과제로 판정한다)
 * @param {string} text        붙여넣은 원문
 * @param {string} instruction 추가 지시 (선택)
 * @param {object} current     화면이 **지금 들고 있는** 값 {한글키: 값}
 *                             ⚠️ `과제상세설명` 은 **일반 텍스트**로 보낸다(HTML 아님).
 * @returns {Promise<{patch: object, notes: string[], skipped: object[], model: string}>}
 */
export const fillProjectForm = ({ uuid, text, instruction, current }) =>
  post('/dt-v2/ai/form/project-fill', { uuid, text, instruction, current });

/**
 * 붙여넣은 글 → 액션아이템 후보.
 *
 * 결과에 **완료 여부가 없다** — 진행률·진행상태가 액션아이템에서 파생되므로,
 * 완료 표시는 추가한 뒤 사람이 화면에서 한다.
 *
 * @param {string[]} existing 이미 있는 액션아이템 제목 (같은 일을 다시 만들지 않게)
 * @returns {Promise<{items: object[], notes: string[], model: string}>}
 */
export const extractActionItems = ({ uuid, text, existing }) =>
  post('/dt-v2/ai/form/action-items', { uuid, text, existing });

/**
 * 붙여넣은 글 → 참여인력 **후보**.
 *
 * 🚨 다른 둘과 성격이 다르다 — **AI 는 이름만 뽑고 계정은 서버가 찾는다.**
 *    여기 들어간 사람은 그 과제를 고칠 수 있게 되는데, 원문에는 동명이인을 가릴
 *    정보가 없다. 그래서 서버가 붙여 준 `candidates` 중에서 **사람이 고른다.**
 *    화면은 고르지 않은 줄을 절대 넣으면 안 된다.
 *
 * @returns {Promise<{people: {이름, 근거, candidates: object[], 동명이인: boolean}[], notes: string[]}>}
 */
export const extractPeople = ({ uuid, text, existing }) =>
  post('/dt-v2/ai/form/people', { uuid, text, existing });

/**
 * 과제 내용 → 연결할 만한 DX KPI **후보**.
 *
 * ⚠️ 서버는 AI 의 KPI 쓰기를 **403 으로 막아 둔 상태 그대로**다. 여기는 연결을 만들지
 *    않고 **후보와 근거만** 준다 — 화면이 자동으로 체크하면 안 되고, 사람이 하나씩
 *    고른 것만 연결한다. 붙여넣을 글이 필요 없다(과제 내용을 서버가 읽는다).
 *
 * 대상 사업부·기여 방법은 응답에 없다. 그 규칙은 `KpiLinkSection.toggleKpi` 가 지킨다.
 *
 * @returns {Promise<{items: {kpiDefinitionId, label, category, unit, kind, 근거}[], notes: string[]}>}
 */
export const suggestKpiLinks = ({ uuid, instruction }) =>
  post('/dt-v2/ai/form/kpi-links', { uuid, instruction });
