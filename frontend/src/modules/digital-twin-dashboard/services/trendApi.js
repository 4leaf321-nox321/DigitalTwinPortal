/**
 * 과제·성과 추이 API.
 *
 * 서버는 **원시 시계열만** 준다.
 *
 *     fetchProjectTrend     날짜별 사업부별 총 과제 수 (완료 포함, 취소 제외)
 *     fetchPerformanceTrend 성과 속성 카드별 값 — **환산 전 원본**
 *     fetchTrendNotes       날짜별 변동 사유 메모
 *     fetchDayChanges       그날 들어오고 나간 과제 (메모 쓰기 전 재료)
 *     saveTrendNote / deleteTrendNote   메모 쓰기 — 사무국·관리자만
 *
 * ⚠️ 단위 환산(`hrs → 억원`)과 합계·평균은 **화면이 한다.** 그 계산이 이미
 *    `KPIDashboard.jsx` 의 `applyConversion` 에 있고 트리맵이 그걸 쓰기 때문이다 —
 *    서버에서 다시 구현하면 트리맵과 이 차트가 다른 숫자를 말하는 날이 온다.
 */
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

const query = ({ years, divisions } = {}) => {
  const q = new URLSearchParams();
  if (years?.length) q.set('years', years.join(','));
  if (divisions?.length) q.set('divisions', divisions.join(','));
  return q.toString();
};

export const fetchProjectTrend = async (scope) => {
  const r = await fetch(`${API_BASE_URL}/dt-v2/trend/projects?${query(scope)}`,
    { headers: authHeaders() });
  return unwrap(r, '과제 추이 조회');
};

export const fetchPerformanceTrend = async (scope) => {
  const r = await fetch(`${API_BASE_URL}/dt-v2/trend/performances?${query(scope)}`,
    { headers: authHeaders() });
  return unwrap(r, '성과 추이 조회');
};

/** `{ notes: [...], canEdit }` — `canEdit` 로 편집 버튼을 보일지 정한다. */
export const fetchTrendNotes = async (scope) => {
  const r = await fetch(`${API_BASE_URL}/dt-v2/trend/notes?${query(scope)}`,
    { headers: authHeaders() });
  return unwrap(r, '메모 조회');
};

/** 그날 들어오고 나간 과제. 곡선과 **같은 기준**으로 서버가 뽑는다. */
export const fetchDayChanges = async (date, scope) => {
  const q = new URLSearchParams(query(scope));
  q.set('date', date);
  const r = await fetch(`${API_BASE_URL}/dt-v2/trend/changes?${q.toString()}`,
    { headers: authHeaders() });
  return unwrap(r, '변동 조회');
};

/** `id` 를 함께 주면 수정, 없으면 새 메모. */
export const saveTrendNote = async (note) => {
  const r = await fetch(`${API_BASE_URL}/dt-v2/trend/notes`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(note),
  });
  return unwrap(r, '메모 저장');
};

export const deleteTrendNote = async (id) => {
  const r = await fetch(`${API_BASE_URL}/dt-v2/trend/notes/${id}`,
    { method: 'DELETE', headers: authHeaders() });
  return unwrap(r, '메모 삭제');
};
