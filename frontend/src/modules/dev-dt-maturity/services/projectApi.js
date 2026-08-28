// 디지털 트윈 대시보드의 과제 하나를 읽어 온다(2026-08-29).
//
// 목록의 「디지털 트윈 연결 과제」 배지를 누르면 대시보드의 **결과 보고 화면**(ProjectDetailModal)을
// 그대로 띄운다 — 같은 과제가 어디서 보든 같아 보이게. 읽기만 한다.
//
// ⚠️ maturityApi 를 타지 않는다. 저쪽은 성숙도 API 전용이고 샘플 뷰가 가로채는데, 이건 대시보드 API 다.
//    그래서 **샘플 뷰에서는 부르지 않는다**(부르면 개발 DB 의 uuid 로 운영 서버를 두드리게 된다).

const BASE = '/api/dt-v2';

export const fetchProjectDetail = async (uuid) => {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`${BASE}/projects/${encodeURIComponent(uuid)}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  let body = null;
  try { body = await res.json(); } catch { /* 본문 없음 */ }
  if (!res.ok) {
    if (res.status === 403) throw new Error('이 과제를 볼 권한이 없습니다.');
    if (res.status === 404) throw new Error('대시보드에 그 과제가 없습니다 — 지워졌을 수 있습니다.');
    throw new Error(body?.message || '과제를 불러오지 못했습니다.');
  }
  return body?.data ?? body;
};

export default { fetchProjectDetail };
