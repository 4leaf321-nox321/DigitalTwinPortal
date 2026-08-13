/**
 * 메인 화면(포털) 설정 API.
 *
 * 모듈 상태(운영 중 / 운영 준비 / 기획 중 / 숨김)는 예전에 `MainPage.jsx` 에
 * 박혀 있었다. 상태는 운영하며 자주 바뀌는 값이지 코드가 아니라서 서버로 옮겼다.
 *
 * ⚠️ 읽기는 **로그인하지 않아도 200** 이다 — 첫 화면이 이 값을 기다리는데 401 이면
 *    화면이 통째로 비어 보인다. 쓰기는 관리자만이고 서버가 `canEdit` 으로 알려 준다.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const authHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const unwrap = async (res, what) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `${what} 실패`);
  return data.data;
};

/** `{statuses: {모듈id: 상태}, order: [모듈id], canEdit}` */
export const fetchModuleStatuses = async () => {
  const res = await fetch(`${API_BASE_URL}/portal/module-statuses`, {
    headers: authHeaders(),
  });
  return unwrap(res, '모듈 상태 조회');
};

/** 통째로 저장한다 — 부분 갱신을 만들면 어느 쪽이 정본인지 헷갈린다. */
export const saveModuleStatuses = async (statuses, order) => {
  const res = await fetch(`${API_BASE_URL}/portal/module-statuses`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ statuses, order }),
  });
  return unwrap(res, '모듈 상태 저장');
};
