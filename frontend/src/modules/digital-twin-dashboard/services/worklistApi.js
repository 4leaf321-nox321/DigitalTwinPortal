/**
 * 「내 일」 API (2026-08-11).
 *
 * 서버가 판정과 정렬을 전부 끝내서 준다 — 화면은 그리기만 한다.
 * **여기서 다시 거르거나 정렬하지 말 것.** 그러면 관계도 화면·배지와 숫자가 갈린다.
 */
// 이 모듈의 다른 서비스(settingsApi·trendApi)와 **같은 방식**으로 주소를 잡는다.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const authHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
  'Content-Type': 'application/json',
});

const unwrap = async (response, what) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `${what} 실패`);
  return data.data;
};

/**
 * 한 판 가져오기.
 *
 * `summary: true` 는 **급한 카드 셋만** 센다(기한 지난 항목·확인 대기·재검토 요청).
 * 배지 숫자는 로그인 직후 자동으로 부르므로 이쪽을 쓴다 — 전체를 만들면 서버가
 * 진척 이력을 통째로 읽어 첫 화면 로딩에 얹힌다.
 */
export const fetchWorklist = async ({ lens, year, summary = false } = {}) => {
  const q = new URLSearchParams();
  if (lens) q.set('lens', lens);
  if (year) q.set('year', String(year));
  if (summary) q.set('summary', '1');
  const r = await fetch(`${API_BASE_URL}/dt-v2/me/worklist?${q.toString()}`,
    { method: 'GET', headers: authHeaders() });
  return unwrap(r, '내 일 목록 조회');
};

/** 항목 하나를 30일 미룬다. 기간은 서버가 정한다(화면이 고르지 않는다). */
/**
 * 재검토 요청에 **「보완했습니다」**를 누른다.
 *
 * ⚠️ 끝내는 것이 아니라 **넘기는 것**이다 — 내 카드에서는 빠지고 사무국의
 *    「재확인 대기」로 뜬다. 최종 확인은 여전히 사무국이 한다.
 */
export const markReportResubmitted = async (projectUuid) => {
  const r = await fetch(`${API_BASE_URL}/dt-v2/me/worklist/report-resubmitted`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ projectUuid }),
  });
  return unwrap(r, '보완 알림');
};

export const snoozeWorklistItem = async (itemKey, card) => {
  const r = await fetch(`${API_BASE_URL}/dt-v2/me/worklist/snooze`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ itemKey, card }),
  });
  return unwrap(r, '미루기');
};

/** 미뤄둔 것을 도로 꺼낸다. */
export const unsnoozeWorklistItem = async (itemKey) => {
  const r = await fetch(
    `${API_BASE_URL}/dt-v2/me/worklist/snooze?itemKey=${encodeURIComponent(itemKey)}`,
    { method: 'DELETE', headers: authHeaders() });
  return unwrap(r, '미룸 해제');
};

/**
 * 확인 대기 승인 / 거부.
 *
 * 이 화면에서 바로 처리하기 위한 것이다. 원래 설계는 "AI 대화 안에서 confirm_change"
 * 였는데, 폼 도우미·그래프 에이전트가 늘면서 **대화 밖에서 만들어진 제안**이 아무
 * 데도 안 보이게 됐다(worklist.py 의 `_card_proposals` 주석 참조).
 */
export const approveProposal = async (proposalId, note) => {
  const r = await fetch(`${API_BASE_URL}/dt-v2/proposals/${proposalId}/approve`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ note }),
  });
  return unwrap(r, '승인');
};

export const rejectProposal = async (proposalId, note) => {
  const r = await fetch(`${API_BASE_URL}/dt-v2/proposals/${proposalId}/reject`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ note }),
  });
  return unwrap(r, '거부');
};
