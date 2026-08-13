/**
 * 관계도 API — 서버가 `dt2_*` 를 읽어 **그때그때 만들어 준다.**
 *
 * 저장하는 것이 없다. 예전 「지식 그래프 저장」은 브라우저에서 만든 노드·엣지를
 * 다른 모듈의 표(`dx_graphs`/`dx_nodes`/`dx_edges`)에 찍어 두는 것이었고,
 * 그래서 저장한 순간에 얼어붙었다 — 과제명을 바꿔도 옛 이름 그대로였다.
 * 여기는 매번 지금 값을 읽으므로 그 문제가 없다.
 *
 * 서버는 **색·크기를 주지 않는다.** 라벨과 최소 속성만 온다 — 칠하는 것은
 * `graphPaint.js` 가 한다. 그래야 같은 데이터로 사업부별·진행상태별 색칠을 바꿀 수 있다.
 */
// `settingsApi.js` 와 **같은 식**으로 정한다. 거기서 export 하게 고칠 수도 있지만,
// 그 파일은 화면 전체가 쓰는 큰 파일이라 이 기능 때문에 손대지 않는다.
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

/** 필터가 고를 수 있는 값. **볼 수 있는 과제에서만** 뽑혀 온다. */
export const fetchGraphOptions = async () => {
  const r = await fetch(`${API_BASE_URL}/dt-v2/graph/options`, { headers: authHeaders() });
  return unwrap(r, '관계도 옵션 조회');
};

/**
 * 관계도 한 장.
 *
 * @param {object}   opts
 * @param {number[]} opts.years      비우면 전체
 * @param {string[]} opts.divisions  비우면 전체
 * @param {string[]} opts.layers     켤 레이어. 비우면 서버 기본값
 * @param {boolean}  opts.includeDeleted 휴지통 과제까지
 */
export const fetchGraph = async ({ years, divisions, layers, includeDeleted } = {}) => {
  const q = new URLSearchParams();
  if (years?.length) q.set('years', years.join(','));
  if (divisions?.length) q.set('divisions', divisions.join(','));
  if (layers?.length) q.set('layers', layers.join(','));
  if (includeDeleted) q.set('includeDeleted', '1');

  const r = await fetch(`${API_BASE_URL}/dt-v2/graph?${q.toString()}`,
    { headers: authHeaders() });
  return unwrap(r, '관계도 조회');
};
