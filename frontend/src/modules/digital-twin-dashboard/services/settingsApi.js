/**
 * 시스템 설정 및 서버 데이터 동기화 API 서비스
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ============================================
// 시스템 설정 API
// ============================================

/**
 * 시스템 설정 조회
 */
export const fetchSystemSettings = async () => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/settings`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  // 디버그: 수신 데이터 확인
  console.log('[fetchSystemSettings] Received keys:', Object.keys(data.data || {}));
  console.log('[fetchSystemSettings] performanceEvaluations:', data.data?.performanceEvaluations);

  if (!response.ok) {
    throw new Error(data.message || '설정 조회 실패');
  }

  return data.data;
};

/**
 * 사용자 이름 검색 (재검토 요청 수신자 선택용)
 * @param {string} q - 이름 검색어
 * @returns {Promise<Array<{id, name, email, department}>>}
 */
export const searchUsers = async (q) => {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(`${API_BASE_URL}/auth/users/search?q=${encodeURIComponent(q)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || '사용자 검색 실패');
  return data.data || [];
};

/**
 * 시스템 설정 저장
 */
export const saveSystemSettings = async (settingsData) => {
  const token = localStorage.getItem('accessToken');

  // 디버그: 전송 데이터 확인
  console.log('[saveSystemSettings] Sending keys:', Object.keys(settingsData));
  console.log('[saveSystemSettings] performanceEvaluations:', settingsData.performanceEvaluations);

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/settings`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(settingsData)
  });

  const data = await response.json();

  console.log('[saveSystemSettings] Response:', data);

  if (!response.ok) {
    throw new Error(data.message || '설정 저장 실패');
  }

  return data;
};


// ============================================
// 서버 데이터 동기화 API
// ============================================

/**
 * 서버 데이터 조회 (버전 포함)
 */
/**
 * V2 읽기 토글 (Phase 2-4)
 *
 * 왜 토글인가
 *   V2 응답이 V1 과 같다는 것은 운영 데이터로 증명했지만(dt2_compare_api.py),
 *   **화면이 실제로 똑같이 그려지는지**는 그것만으로 알 수 없다.
 *   빌드를 다시 배포해야 되돌릴 수 있으면 확인해보기가 부담스럽다.
 *   브라우저마다 켜고 끌 수 있으면 위험 없이 확인할 수 있다.
 *
 * 쓰는 법 (개발자도구 콘솔)
 *   localStorage.setItem('dtV2Read', '1')   → V2 에서 읽기. 새로고침
 *   localStorage.removeItem('dtV2Read')     → 원래대로
 *
 * 단계
 *   1) 지금        기본값 V1. 플래그를 켠 사람만 V2 (사용자는 아무 변화 없음)
 *   2) 확인 후     DEFAULT_V2_READ 를 true 로 바꿔 재배포
 *   3) 안정되면    이 토글과 V1 경로를 제거
 */
const V2_READ_FLAG = 'dtV2Read';
// ⚠️⚠️ 2026-07-31 **컷오버 배포용 값이다. 되돌리지 말 것.**
//      (7/30 리허설 때 켰던 것을 그대로 두는 게 아니라, 컷오버 빌드에 필요해서 켜 둔 것이다)
//      `python backend\scripts\dt3_preflight.py --cutover` 가 true 인지 검사한다.
//      **소스 상수라 값을 바꾸면 개발 PC 에서 `npm run build` 를 다시 해야 반영된다.**
const DEFAULT_V2_READ = true;    // 컷오버 전에는 false. 컷오버 배포에서 true

export const isV2ReadEnabled = () => {
  try {
    const v = localStorage.getItem(V2_READ_FLAG);
    if (v === '1') return true;
    if (v === '0') return false;      // 기본값이 V2 가 된 뒤에도 끌 수 있게
  } catch {
    // localStorage 를 못 쓰는 환경이면 기본값을 따른다
  }
  return DEFAULT_V2_READ;
};

/**
 * V2 쓰기 토글 (실행계획 1단계-b)
 *
 * 읽기 토글과 같은 방식이되 **짝이 하나 더 있다** — 서버의 `DT2_WRITE_ENABLED`.
 * 그쪽이 꺼져 있으면 V2 쓰기는 전부 503 이라 이 토글만 켜도 아무 일도 안 된다.
 *
 * 개발에서 시험하는 법
 *   backend/.env 에  DT2_WRITE_ENABLED=true   (재기동)
 *   콘솔에서         localStorage.setItem('dtV2Write', '1')
 *
 * ⚠️ 서버 쓰기를 켜면 V1→V2 동기화가 멈춘다(상호배타). 그 상태에서 읽기가 V1 이면
 *    저장 직후 새로고침에 **수정이 사라져 보인다.** 쓰기를 켤 때는 dtV2Read 도 켠다.
 */
const V2_WRITE_FLAG = 'dtV2Write';
// ⚠️⚠️ 2026-07-31 **컷오버 배포용 값이다. 되돌리지 말 것.** (위 DEFAULT_V2_READ 주석 참조)
const DEFAULT_V2_WRITE = true;    // 컷오버 전에는 false. 컷오버 배포에서 true

export const isV2WriteEnabled = () => {
  try {
    const v = localStorage.getItem(V2_WRITE_FLAG);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {
    // localStorage 를 못 쓰는 환경이면 기본값을 따른다
  }
  return DEFAULT_V2_WRITE;
};

/**
 * 주소로도 토글을 켤 수 있게 한다 — 개발자도구를 열지 않아도 되도록.
 *
 *   ...?dtV2Read=1&dtV2Write=1    켜기
 *   ...?dtV2Write=0               끄기
 *
 * 한 번 열면 localStorage 에 남으므로 이후에는 주소를 붙이지 않아도 된다.
 *
 * **링크로 공유할 수 있다는 게 요점이다.** "이 링크로 들어가서 화면이 예전과 같은지
 * 봐주세요" 를 콘솔 여는 방법까지 설명하지 않고 부탁할 수 있다. 지금까지 읽기 토글을
 * 남에게 부탁하기 어려웠던 이유가 그것이었다.
 *
 * 반영한 뒤 주소에서 그 파라미터만 지운다 — 주소가 지저분해지지 않고, 나중에 이 주소를
 * 다시 열었을 때 의도치 않게 또 켜지지도 않는다. `replaceState` 라 뒤로가기에도 안 남는다.
 */
const TOGGLE_PARAMS = {
  dtV2Read: V2_READ_FLAG,
  dtV2Write: V2_WRITE_FLAG,
};

export const applyV2TogglesFromUrl = () => {
  try {
    const url = new URL(window.location.href);
    let touched = false;

    Object.entries(TOGGLE_PARAMS).forEach(([param, storageKey]) => {
      const raw = url.searchParams.get(param);
      if (raw === null) return;
      const on = raw === '1' || raw.toLowerCase() === 'true';
      localStorage.setItem(storageKey, on ? '1' : '0');
      url.searchParams.delete(param);
      touched = true;
      console.info(`[DT] ${param} ${on ? '켬' : '끔'} (주소로 설정됨). 새로고침해도 유지됩니다.`);
    });

    if (touched) window.history.replaceState({}, '', url.toString());
  } catch {
    // window 가 없는 환경(테스트 등)이면 그냥 넘어간다
  }
};

// 모듈이 처음 불릴 때 한 번 — 화면이 데이터를 읽기 전에 반영돼야 한다.
applyV2TogglesFromUrl();

/**
 * 과제 1건 부분 수정 (V2).
 *
 * 화면의 한글 키를 **그대로** 보낸다 — 서버가 컬럼명으로 바꾼다(field_maps.py).
 * 번역표를 여기에 복제하지 않는 것이 요점이다.
 *
 * `ignore_unknown` 을 켜서 보낸다. 화면이 만드는 diff 에는 다른 API 로 가는 키나
 * UI 임시값이 섞이는데, 그때마다 400 이면 저장이 막힌다. 대신 서버가 건너뛴 키를
 * `ignored` 로 돌려주므로 호출부가 확인할 수 있다 — 조용히 사라지지 않는다.
 */
/**
 * 본문 없는 V2 요청(삭제·복구) 공통부.
 *
 * 이 계열은 이미 "1건 단위" 라 V1 과 모양이 거의 같다. 다른 점은 응답이 전역 `version`
 * 이 아니라 그 행의 `rowVersion` 이라는 것 — V2 에서는 전역 버전이라는 개념이 없다.
 */
const v2NoBodyRequest = async (path, method) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/dt-v2${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || '요청에 실패했습니다.');
    error.status = response.status;
    if (response.status === 503) error.v2Disabled = true;
    throw error;
  }
  return data.data;
};

export const softDeleteProjectV2 = (projectUuid) =>
  v2NoBodyRequest(`/projects/${projectUuid}/delete`, 'POST');

export const restoreProjectV2 = (projectUuid) =>
  v2NoBodyRequest(`/projects/${projectUuid}/restore`, 'POST');

/** ⚠️ V2 는 영구삭제를 **admin·dt_office 로 제한**한다 (V1 은 누구나 가능했다). */
export const permanentDeleteProjectV2 = (projectUuid) =>
  v2NoBodyRequest(`/projects/${projectUuid}`, 'DELETE');

/** 응답에 `unlinkedProjects` — 이 성과가 빠진 과제 목록이 들어 있다. */
export const deletePerformanceV2 = (performanceUuid) =>
  v2NoBodyRequest(`/performances/${performanceUuid}`, 'DELETE');

/**
 * 삭제된 성과 복구.
 *
 * ⚠️ **과제 연결은 되살아나지 않는다** — 삭제할 때 연결 행을 지웠기 때문이다
 *    (routes_v2.delete_performance). 복구 후 과제에서 다시 연결해야 한다.
 * ⚠️ 권한이 다르다 — 삭제된 성과는 '연결된 과제로 판단' 규칙을 쓸 수 없어서
 *    **관리자 또는 만든 사람만** 복구할 수 있다(403).
 */
export const restorePerformanceV2 = (performanceUuid) =>
  v2NoBodyRequest(`/performances/${performanceUuid}/restore`, 'POST');

/**
 * 성과 영구 삭제. **휴지통에 있는 것만** 지울 수 있고 되돌릴 수 없다.
 * 과제와 같이 **관리자만** 가능하다(403).
 */
export const permanentDeletePerformanceV2 = (performanceUuid) =>
  v2NoBodyRequest(`/performances/${performanceUuid}/permanent`, 'DELETE');

/**
 * 삭제된 성과 목록 (휴지통용).
 *
 * 화면이 들고 있는 `globalPerformances` 로는 만들 수 없다 — `/data` 응답이
 * 삭제된 성과를 **아예 걸러서** 보내기 때문이다(assemble.py). 과제 휴지통과
 * 다른 점이 이것이다(과제는 소프트 삭제분이 `/data` 에 실려 온다).
 */
export const fetchDeletedPerformances = async () => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(
    `${API_BASE_URL}/dt-v2/performances?include_deleted=true&limit=1000`,
    { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || '삭제된 성과를 불러오지 못했습니다.');
    error.status = response.status;
    throw error;
  }

  const payload = data.data;
  const items = Array.isArray(payload) ? payload : (payload?.items || []);
  return items.filter(p => p?.isDeleted);
};

/**
 * 연도별 과제 건수 (V2). 연도별 삭제 모달의 목록이 이걸로 그려진다.
 *
 * 화면이 들고 있는 projects 로 세지 않는다 — 로컬에는 **내가 볼 수 있는 것만** 있고
 * 지울 대상은 서버 전체다. 로컬 기준으로 세어 보여주면 실제 삭제 건수와 어긋난다.
 *
 * ⚠️ 서버가 admin 만 통과시킨다(403). 모달을 admin 에게만 열어 주므로 정상 경로에서는
 *    나지 않지만, 나면 그대로 보여준다 — 조용히 빈 목록으로 만들면 오진한다.
 */
export const fetchProjectYearSummaryV2 = async () => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/dt-v2/projects/year-summary`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || '연도별 과제 건수를 불러오지 못했습니다.');
    error.status = response.status;
    if (response.status === 503) error.v2Disabled = true;
    throw error;
  }
  return data.data?.years || [];
};

/**
 * 연도 목록을 본문으로 보내는 V2 일괄 요청(삭제·복구) 공통부.
 *
 * 두 경로가 권한·본문·오류 모양이 같아서 한 함수로 둔다. 나눠 두면 한쪽에만
 * 409 처리를 빠뜨리는 식으로 어긋난다.
 */
const v2BulkYearRequest = async (path, body, fallbackMessage) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/dt-v2${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || fallbackMessage);
    error.status = response.status;
    if (response.status === 503) error.v2Disabled = true;
    if (response.status === 409) error.stale = true;   // 화면이 본 건수와 서버가 다름
    throw error;
  }
  return data.data;
};

/**
 * 연도별 과제 일괄 삭제 (V2). **admin 전용 · 소프트 삭제**.
 *
 * `expectedCount` 를 함께 보낸다 — 모달을 열어둔 사이 누군가 과제를 추가했으면
 * 관리자가 본 건수와 실제로 지워질 건수가 달라진다. 서버는 다르면 409 로 멈춘다.
 * **보낸 값과 지울 것이 다르면 지우지 않는 게 맞다.**
 */
export const bulkDeleteProjectsByYearV2 = ({ years, expectedCount, reason }) =>
  v2BulkYearRequest('/projects/bulk-delete', { years, expectedCount, reason },
                    '연도별 일괄 삭제에 실패했습니다.');

/**
 * 연도별 과제 일괄 복구 (V2). 위 일괄 삭제의 **짝**이다.
 *
 * 삭제가 "휴지통에서 복구 가능"이라고 말하는 이상 복구도 같은 단위로 돼야 한다 —
 * 200건을 지우고 1건씩 되살리게 하면 그 안내가 사실이 아니게 된다.
 */
export const bulkRestoreProjectsByYearV2 = ({ years, reason }) =>
  v2BulkYearRequest('/projects/bulk-restore', { years, reason },
                    '연도별 일괄 복구에 실패했습니다.');

/**
 * 성과 전체 삭제가 건드릴 대상 수 (V2). 확인 모달의 문구가 이걸로 그려진다.
 *
 * 화면의 성과 목록으로 세지 않는다 — 그 목록은 연도 필터가 걸려 있을 수 있고,
 * 모달을 열어둔 사이 남이 추가했을 수도 있다. **본 숫자와 지울 숫자가 달라지면
 * 관리자가 잘못된 근거로 누르게 된다.**
 *
 * ⚠️ 서버가 admin 만 통과시킨다(403). 버튼을 admin 에게만 보여주므로 정상 경로에서는
 *    나지 않지만, 나면 그대로 올려보낸다 — 조용히 0건으로 만들면 오진한다.
 */
export const fetchPerformanceDeleteSummaryV2 = async () => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/dt-v2/performances/delete-summary`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || '삭제 대상 건수를 불러오지 못했습니다.');
    error.status = response.status;
    if (response.status === 503) error.v2Disabled = true;
    throw error;
  }
  return data.data || { activeCount: 0, affectedProjectCount: 0 };
};

/**
 * 성과 전체 삭제 (V2). **admin 전용 · 소프트 삭제**.
 *
 * 연도별 과제 일괄 삭제와 본문·오류 모양이 같아 같은 공통부를 쓴다.
 * `expectedCount` 가 서버가 센 것과 다르면 409 로 멈춘다.
 *
 * ⚠️ 성과를 지우면 **그 성과를 쓰던 모든 과제의 연결도 함께 사라진다.**
 *    응답의 `unlinkedProjects` 로 어느 과제가 영향받았는지 알 수 있다.
 */
export const bulkDeletePerformancesV2 = ({ expectedCount, reason }) =>
  v2BulkYearRequest('/performances/bulk-delete', { expectedCount, reason },
                    '성과 전체 삭제에 실패했습니다.');

/**
 * 과제 신규 생성 (V2).
 *
 * `uuid` 를 함께 보낸다 — 화면이 로컬에서 만든 uuid 로 이미 첨부·연결을 걸기 때문에
 * 서버가 다른 값을 매기면 그 참조들이 어긋난다. 서버도 생성 시에만 받아준다.
 */
export const createProjectV2 = async (fields) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/dt-v2/projects`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields, ignore_unknown: true })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || '과제 생성 실패');
    error.status = response.status;
    if (response.status === 503) error.v2Disabled = true;
    throw error;
  }
  return data.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// 행 버전(row_version) 보관소 — 낙관적 락용
//
// V1 은 전역 version 하나로 충돌을 봤다. V2 는 **행마다** version 이 있어서,
// 다른 과제를 고친 사람과는 부딪히지 않고 같은 과제를 고친 사람과만 부딪힌다.
//
// 이 값을 과제 객체 안에 넣지 않는 이유는 서버 쪽 `_row_version_map` 주석 참조 —
// 요약하면 V1 으로 물러설 때 그 값이 V1 JSON 에 섞이고 PATCH 본문에도 딸려 간다.
// 그래서 읽을 때 따로 받아 여기 담아두고, 저장할 때 꺼내 쓴다.
//
// 캐시가 낡으면 서버가 409 로 알려준다 — 틀리는 방향이 **안전한 쪽**이다.
// ─────────────────────────────────────────────────────────────────────────────

const rowVersions = { projects: new Map(), performances: new Map() };

const rememberRowVersions = (payload) => {
  const incoming = payload?.rowVersions;
  if (!incoming) return;
  for (const kind of ['projects', 'performances']) {
    const map = rowVersions[kind];
    map.clear();
    Object.entries(incoming[kind] || {}).forEach(([uuid, v]) => map.set(uuid, v));
  }
};

export const projectRowVersion = (uuid) => rowVersions.projects.get(uuid);
export const performanceRowVersion = (uuid) => rowVersions.performances.get(uuid);

/** 쓰기 응답이 준 새 버전으로 갱신한다 — 연속 저장에서 다시 읽지 않아도 되게. */
export const rememberProjectRowVersion = (uuid, version) => {
  if (uuid && version != null) rowVersions.projects.set(uuid, version);
};
export const rememberPerformanceRowVersion = (uuid, version) => {
  if (uuid && version != null) rowVersions.performances.set(uuid, version);
};

/**
 * 새 버전을 **모르게 된** 경우 캐시에서 지운다.
 *
 * 성과를 지우면 서버가 그 성과를 쓰던 **과제들의 row_version 까지** 올리는데,
 * 응답은 새 버전을 주지 않는다. 낡은 값을 들고 있으면 다음 저장이 엉뚱하게 409 가 난다.
 * 지워두면 그 과제의 다음 저장만 낙관적 락을 건너뛴다 — 틀린 409 보다 낫다.
 */
export const forgetProjectRowVersion = (uuid) => {
  if (uuid) rowVersions.projects.delete(uuid);
};

/**
 * 성과 신규 생성 (V2). 과제와 같은 이유로 화면이 만든 `uuid` 를 함께 보낸다 —
 * 과제의 성과목록이 이미 그 값을 참조하고 있기 때문이다.
 */
export const createPerformanceV2 = async (fields) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/dt-v2/performances`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields, ignore_unknown: true })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || '성과 생성 실패');
    error.status = response.status;
    if (response.status === 503) error.v2Disabled = true;
    throw error;
  }
  return data.data;
};

/**
 * 성과 1건 부분 수정 (V2).
 *
 * 응답의 `affectedProjects` 는 이 성과를 쓰는 과제 수다 — 성과 수정은
 * **남의 과제 숫자까지 바꾼다.** 화면이 그 파급을 알릴 수 있게 담아 준다.
 */
export const patchPerformanceV2 = async (performanceUuid, patch, { expectedVersion } = {}) => {
  const token = localStorage.getItem('accessToken');

  const body = { patch, ignore_unknown: true };
  if (expectedVersion != null) body.expected_version = expectedVersion;

  const response = await fetch(`${API_BASE_URL}/dt-v2/performances/${performanceUuid}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 409) {
    const error = new Error(data.message || '버전 충돌');
    error.conflict = true;
    error.conflictData = data.data;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(data.message || '성과 저장 실패');
    error.status = response.status;
    if (response.status === 503) error.v2Disabled = true;
    throw error;
  }
  return data.data;
};

/**
 * 과제 1건의 **현재 상태만** 확인한다 (편집창을 열 때).
 *
 * 본문으로 화면을 다시 채우지는 않는다. 응답이 V2 모양(`process`·`domain`…)이라
 * 편집창이 쓰는 한글 키와 다르고, 그 변환기는 나중에 화면을 V2 로 옮길 때 버려진다.
 * 지금 필요한 건 둘뿐이다 — **"내가 보는 게 최신인가"** 와 **"내가 고칠 수 있는가"**.
 */
export const fetchProjectStateV2 = async (projectUuid) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/dt-v2/projects/${projectUuid}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || '과제 상태 조회 실패');
  }
  return { rowVersion: data.data?.rowVersion, canEdit: data.data?.canEdit };
};

/**
 * 과제 1건의 **필드 단위 변경 이력** (V2).
 *
 * 활동로그(`dashboard_activity_logs`)와 다른 것이다 — 그쪽은 화면이 **골라 보낸** 요약이고
 * (감시 필드 19종), 이쪽은 **서버가 쓰기마다 자동으로 남긴 전수**다. 진행률처럼 활동로그가
 * 안 보는 필드도 여기엔 있다. 둘 다 필요하다.
 *
 * ⚠️ `dt2_project_changes` 는 **API 쓰기로만** 쌓인다(배치 이관은 이 테이블을 안 쓴다).
 *    그래서 **V2 컷오버(2026-07-31) 이전 변경은 여기 없다.** 화면이 그 사실을 알려야 한다.
 *
 * 응답의 `field` 는 컬럼명(`progress`)이고, 서버가 `fieldLabel` 에 한글 키를 얹어 준다
 * (필드 맵을 프론트에 복제하지 않기 위해서 — field_maps.py 단일 출처).
 */
export const fetchProjectChangesV2 = async (projectUuid, { limit = 100 } = {}) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(
    `${API_BASE_URL}/dt-v2/projects/${projectUuid}/changes?limit=${limit}`,
    { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || '변경 이력 조회 실패');
  }
  return data.data || [];
};

/**
 * 과제 1건의 **진척 지표 이력** (V2).
 *
 * `fetchProjectChangesV2`(누가 무엇을 바꿨나)와 다르다 — 이쪽은 **지표가 어떻게 변했나**다.
 * 값이 직전 기록과 같으면 행이 안 생기므로 **행 하나 = 값이 바뀐 시점**이다.
 *
 * ⚠️ 화면의 진척률은 액션아이템 완료 비율로 **매번 다시 계산**되어 소급 변경된다
 *    (액션아이템을 추가하면 분모가 바뀌어 과거 숫자도 달라진다). 이 이력은 그 시점의
 *    분자·분모를 그대로 남긴 것이라 안 바뀐다 — 두 값이 다른 것이 정상이고, 그 차이가
 *    "진척률이 떨어진 게 일을 못 해서인지 일이 늘어서인지" 를 갈라 준다.
 *
 * ⚠️ `startMonth`/`endMonth` 는 **날짜가 아니라 월 번호(1~12)**. 연도는 `year`.
 * ⚠️ **2026-07-29 이전 기간은 없다** — 이력 수집이 그날 시작됐고 소급 생성은 불가능하다.
 */
export const fetchProjectHistoryV2 = async (projectUuid, { limit = 100 } = {}) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(
    `${API_BASE_URL}/dt-v2/projects/${projectUuid}/history?limit=${limit}`,
    { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || '진척 이력 조회 실패');
  }
  return data.data || [];
};

/**
 * 참여인력 원소들이 **각각 어느 계정과 연결되는지** 확인한다. 아무것도 쓰지 않는다.
 *
 * 왜 필요한가
 *     컷오버로 권한 검사가 실제로 걸리는데, 참여인력이 계정과 연결됐는지 **화면에 아무
 *     표시가 없었다.** 운영 실측에서 고유 knoxId 282개 중 131개가 계정과 안 맞았다.
 *
 * ⚠️ SSO 가 없어 **사용자가 직접 가입**해야 한다. 하지만 knoxId 는 사내 이메일 @앞부분이라
 *    **가입 전에도 값을 안다.** 미리 채워 두면 그 사람이 가입하는 순간 권한이 생긴다
 *    (서버가 요청할 때마다 대조하기 때문). 그래서 "가입할 때까지 기다린다" 가 아니라
 *    **"지금 채워두면 끝"** 이다. 화면은 **미입력**(손댈 것)과 **가입 대기**(둘 것)를
 *    나눠 보여줘야 한다.
 *
 * POST 지만 서버에서 읽기 전용으로 분류돼 있어 컷오버 스위치와 무관하게 동작한다.
 */
export const resolveMembersV2 = async (members) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/dt-v2/members/resolve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ members })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || '참여인력 계정 확인 실패');
  }
  return data.data || [];
};

/**
 * 전 과제의 참여인력을 **사람 단위(이름+부서)로 묶어** 계정 연결 상태를 받는다.
 * 관리자·사무국 전용. 읽기 전용.
 */
export const fetchMemberAudit = async () => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/dt-v2/members/audit`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || '참여인력 점검 조회 실패');
  }
  return data.data || [];
};

/**
 * 여러 과제의 참여인력 **knoxId 를 일괄로 고친다.**
 *
 * ⚠️ `projectUuids` 는 **화면이 사용자에게 보여준 그 목록**이어야 한다. 서버는 대상을
 *    스스로 찾지 않는다 — "이 이름을 가진 모든 과제" 를 서버가 고르면 화면에 안 보인
 *    과제까지 바뀐다. 사용자가 눈으로 확인한 것만 바뀌어야 한다.
 * ⚠️ `matchKnoxIds` 는 **지금 값이 이것인 원소만** 바꾼다. 같은 부서에 진짜 동명이인이
 *    둘 있고 knoxId 가 서로 다를 때 한쪽만 고를 수 있어야 한다.
 *
 * 서버에서 **전부 성공 아니면 전부 취소**로 처리된다.
 */
export const patchMemberKnox = async ({ name, dept, knoxId, matchKnoxIds, projectUuids }) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/dt-v2/members/knox`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, dept, knoxId, matchKnoxIds, projectUuids })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || '참여인력 일괄 수정 실패');
  }
  return data.data || {};
};

/**
 * **이름만 있고 계정이 안 붙은** 과제PL·작성자를 이름 단위로 묶어 받는다.
 * 관리자·사무국 전용. 읽기 전용.
 *
 * @param {'pl'|'author'|'all'} kind
 */
export const fetchOwnerLinkAudit = async (kind = 'all') => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(
    `${API_BASE_URL}/dt-v2/owner-links/audit?kind=${encodeURIComponent(kind)}`,
    { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || '계정 연결 점검 조회 실패');
  }
  return data.data || [];
};

/**
 * 과제PL·작성자의 knoxId 를 **여러 과제에 일괄로 넣는다.**
 *
 * ⚠️ `projectUuids` 는 **화면이 사용자에게 보여준 그 목록**이어야 한다
 *    (`patchMemberKnox` 와 같은 규칙 — 서버는 대상을 스스로 찾지 않는다).
 * ⚠️ 이미 knoxId 가 있는 과제는 서버가 건너뛴다. 이 기능은 **빈 것을 채우는** 일이지
 *    남이 지정한 계정을 갈아치우는 일이 아니다.
 *
 * 서버에서 **전부 성공 아니면 전부 취소**로 처리된다.
 */
export const patchOwnerLinks = async ({ kind, name, knoxId, projectUuids }) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/dt-v2/owner-links`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ kind, name, knoxId, projectUuids })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || '계정 연결 실패');
  }
  return data.data || {};
};

/**
 * 활동 로그 1건을 서버에 남긴다.
 *
 * V1 은 저장 페이로드에 로그를 실어 보냈지만 V2 에는 그 자리가 없다. 그래서 V2 경로는
 * 이 엔드포인트로 따로 보낸다. **활동로그 테이블은 정본이 바뀌어도 그대로 쓴다**
 * (실행계획 7.5-2 '영향 없는 것').
 */
export const postActivityLog = async (log) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/activity-logs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(log)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || '활동 로그 기록 실패');
  }
  return data.data;
};

/**
 * KPI × 사업부 매트릭스의 원재료 (V2).
 *
 * 셀을 서버가 만들지 않고 **평평한 링크 쌍**을 받아 화면이 피벗한다 —
 * 축을 바꿔 보고 싶어질 때마다 API 를 고치지 않기 위해서다.
 * 과제 정보가 응답에 같이 오므로 화면의 `projects` 상태와 어긋나지 않는다.
 */
export const fetchKpiMatrixV2 = async (year, period = null) => {
  const token = localStorage.getItem('accessToken');
  const qs = new URLSearchParams();
  if (year != null) qs.set('year', year);
  // 기간을 안 주면 서버가 **연 목표 대비 오늘까지의 최신 실적**으로 계산한다.
  // 'Q3' · '7월' 을 주면 그 기간 기준. (달성률 규칙은 서버 achievement.py 단일 출처)
  if (period) qs.set('period', period);
  const response = await fetch(`${API_BASE_URL}/dt-v2/kpi-matrix?${qs.toString()}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'KPI 매트릭스 조회 실패');
    error.status = response.status;
    throw error;
  }
  return data.data;
};

/**
 * 여러 과제의 KPI 연결을 **한 번에** 세운다 (V2 · 관리자·사무국).
 *
 * `dryRun: true` 면 한 글자도 쓰지 않고 **무슨 일이 일어날지**만 돌려준다.
 * 화면은 그 결과를 보여 주고, 사람이 누르면 같은 몸통을 dryRun 없이 다시 보낸다 —
 * 미리보기와 실제가 **같은 입력**이어야 "본 것과 다른 것이 적용되는" 일이 없다.
 *
 * 응답 data
 *   summary {created, relation, methods, unchanged, skipped}
 *   rows    칸마다 {kind, detail, code, title, kpiLabel, targetDivision}
 */
export const bulkKpiLinks = async (payload) => {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(`${API_BASE_URL}/dt-v2/kpi-links/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'KPI 연결 일괄 편집 실패');
    error.status = response.status;
    throw error;
  }
  return data.data;
};

/**
 * 과제의 **선행 과제**(items)와 **후속 과제**(successors) (V2).
 *
 * 후속은 읽기 전용이다 — 같은 행을 반대에서 본 것이라 여기서 고칠 것이 없다.
 * 한 관계를 양쪽에서 편집하게 하면 두 화면이 서로를 덮어쓴다.
 *
 * 응답: { projectUuid, rowVersion, canEdit, items[], successors[] }
 */
export const fetchProjectDependenciesV2 = async (projectUuid) => {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(
    `${API_BASE_URL}/dt-v2/projects/${projectUuid}/dependencies`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || '선행 과제 조회 실패');
    error.status = response.status;
    throw error;
  }
  return data.data;
};

/**
 * 과제의 선행 과제 연결을 **통째로 교체**한다 (V2).
 *
 * `items` 는 `[{ dependsOnUuid }]`. 가중치도 순서 컬럼도 없다 —
 * 선행 관계는 있는가 없는가뿐이고, 표시 순서는 넣은 순서를 따른다.
 *
 * 서버가 거절하는 경우가 성과·KPI 연결보다 많다. 400 문구를 그대로 올려보낸다:
 * 자기 자신 · 없는 과제 · 영구 삭제된 과제 · 중복 · **순환**(A→B→A).
 */
export const putProjectDependenciesV2 = async (projectUuid, items, { expectedVersion } = {}) => {
  const token = localStorage.getItem('accessToken');

  const body = { items };
  if (expectedVersion != null) body.expected_version = expectedVersion;

  const response = await fetch(
    `${API_BASE_URL}/dt-v2/projects/${projectUuid}/dependencies`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  );

  const data = await response.json().catch(() => ({}));

  if (response.status === 409) {
    const error = new Error(data.message || '버전 충돌');
    error.conflict = true;
    error.conflictData = data.data;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(data.message || '선행 과제 저장 실패');
    error.status = response.status;
    if (response.status === 503) error.v2Disabled = true;
    throw error;
  }
  return data.data;
};

/**
 * 과제가 연결된 **DX KPI** 목록 + 후보 전체를 함께 받는다 (V2).
 *
 * 후보(`available`)를 이 응답에 같이 담는 이유
 *     dx-kpi-management 의 `/kpi-definitions` 를 화면이 직접 부를 수도 있지만,
 *     그러면 **정렬 규칙과 사업부 판정이 화면에도 생긴다.** 지표 목록의 정렬은
 *     `kpi_definitions.sort_order` 하나여야 하고, 그 판단은 서버에 둔다.
 *
 * 응답: { projectUuid, rowVersion, canEdit, items[], available[], projectDivision }
 */
export const fetchProjectKpiLinksV2 = async (projectUuid) => {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(
    `${API_BASE_URL}/dt-v2/projects/${projectUuid}/kpi-links`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'KPI 연결 조회 실패');
    error.status = response.status;
    throw error;
  }
  return data.data;
};

/**
 * 과제의 DX KPI 연결을 **통째로 교체**한다 (V2).
 *
 * `items` 는 `[{ kpiDefinitionId, note? }]`. **가중치도 순서도 없다** —
 * 표시 순서는 서버가 `kpi_definitions.sort_order` 로 정한다.
 * (경영성과 연결과 다른 점이다. 그쪽은 금액을 쪼개야 해서 기여도와 순서가 있다)
 */
export const putProjectKpiLinksV2 = async (projectUuid, items, { expectedVersion } = {}) => {
  const token = localStorage.getItem('accessToken');

  const body = { items };
  if (expectedVersion != null) body.expected_version = expectedVersion;

  const response = await fetch(
    `${API_BASE_URL}/dt-v2/projects/${projectUuid}/kpi-links`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  );

  const data = await response.json().catch(() => ({}));

  if (response.status === 409) {
    const error = new Error(data.message || '버전 충돌');
    error.conflict = true;
    error.conflictData = data.data;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(data.message || 'KPI 연결 저장 실패');
    error.status = response.status;
    if (response.status === 503) error.v2Disabled = true;
    throw error;
  }
  return data.data;
};

/**
 * 과제의 성과 연결을 **통째로 교체**한다 (V2).
 *
 * `items` 의 **순서가 곧 표시 순서**다. 참조는 성과 uuid 만 받는다 —
 * 화면 원소의 참조 키가 여러 종류라 어댑터가 uuid 로 풀어서 넘긴다.
 *
 * 서버가 이전 원소의 `extra_fields` 를 이어받아 원본 모양을 복원할 수 있게 해준다.
 * (참조 키만 넣으면 재조립에서 기여도·실적이 사라졌던 적이 있다 — 2026-07-29)
 */
export const putProjectLinksV2 = async (projectUuid, items, { expectedVersion } = {}) => {
  const token = localStorage.getItem('accessToken');

  const body = { items };
  if (expectedVersion != null) body.expected_version = expectedVersion;

  const response = await fetch(`${API_BASE_URL}/dt-v2/projects/${projectUuid}/performances`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 409) {
    const error = new Error(data.message || '버전 충돌');
    error.conflict = true;
    error.conflictData = data.data;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(data.message || '성과 연결 저장 실패');
    error.status = response.status;
    if (response.status === 503) error.v2Disabled = true;
    throw error;
  }
  return data.data;
};

export const patchProjectV2 = async (projectUuid, patch, { expectedVersion, aiAssisted } = {}) => {
  const token = localStorage.getItem('accessToken');

  const body = { patch, ignore_unknown: true };
  if (expectedVersion != null) body.expected_version = expectedVersion;
  // AI 폼 도우미가 채운 칸. 그 칸의 변경 이력만 `source='ai_fill'` 로 남는다 —
  // 저장을 누른 것은 사람이지만, 값을 만든 것이 AI 라는 사실은 남겨야 한다.
  if (Array.isArray(aiAssisted) && aiAssisted.length) body.ai_assisted = aiAssisted;

  const response = await fetch(`${API_BASE_URL}/dt-v2/projects/${projectUuid}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 409) {
    const error = new Error(data.message || '버전 충돌');
    error.conflict = true;
    error.conflictData = data.data;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(data.message || '과제 저장 실패');
    error.status = response.status;
    // 503 = 서버에서 V2 쓰기가 아직 안 켜졌다(DT2_WRITE_ENABLED). 이 경우엔
    // **아무것도 쓰이지 않았다** — before_request 에서 막히기 때문이다.
    // 그래서 호출부가 V1 으로 물러서도 안전하다.
    if (response.status === 503) error.v2Disabled = true;
    throw error;
  }
  return data.data;
};

export const fetchServerData = async () => {
  const token = localStorage.getItem('accessToken');
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const useV2 = isV2ReadEnabled();
  // rowVersions=1 은 V2 에만 있다. 낙관적 락에 쓸 행 버전을 함께 받는다.
  const path = useV2 ? '/dt-v2/data?rowVersions=1' : '/digital-twin-dashboard/data';

  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'GET', headers });
  const data = await response.json().catch(() => ({}));

  if (response.ok) {
    if (useV2) {
      console.info('[DT] 데이터 출처: V2 (dt2_*). 끄려면 localStorage.setItem("dtV2Read","0")');
      rememberRowVersions(data.data);
    }
    return data.data;
  }

  // V2 가 실패하면 V1 으로 물러선다. **조용히 넘어가지 않는다** —
  // 사용자에게 빈 화면을 보이지 않으면서도 문제를 알 수 있어야 한다.
  if (useV2) {
    console.error(
      `[DT] V2 읽기 실패 (${response.status}: ${data.message || '알 수 없음'}). ` +
      'V1 으로 대체합니다. 이 메시지가 보이면 담당자에게 알려주세요.'
    );
    const fallback = await fetch(`${API_BASE_URL}/digital-twin-dashboard/data`, {
      method: 'GET', headers
    });
    const fbData = await fallback.json().catch(() => ({}));
    if (!fallback.ok) {
      throw new Error(fbData.message || '서버 데이터 조회 실패');
    }
    return fbData.data;
  }

  throw new Error(data.message || '서버 데이터 조회 실패');
};

/**
 * 서버에 데이터 업로드
 * @param {Object} uploadData - 업로드할 데이터
 * @param {number} uploadData.version - 클라이언트 버전 (충돌 감지용)
 * @param {Array} uploadData.projects - 프로젝트 목록
 * @param {Array} uploadData.performances - 성과 목록
 * @param {Object} uploadData.metadata - 메타데이터
 * @param {Array} uploadData.activityLogs - 활동 로그 (선택)
 * @param {Object} uploadData.snapshot - 스냅샷 정보 (선택)
 * @param {boolean} uploadData.forceUpload - 강제 업로드 (충돌 무시)
 */
export const uploadServerData = async (uploadData) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/data/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(uploadData)
  });

  const data = await response.json();

  // 409 Conflict - 버전 충돌
  if (response.status === 409) {
    const error = new Error(data.message || '버전 충돌');
    error.conflict = true;
    error.conflictData = data.data;
    throw error;
  }

  if (!response.ok) {
    throw new Error(data.message || '서버 업로드 실패');
  }

  return data.data;
};

/**
 * 서버에 데이터 업서트 (업데이트 또는 추가)
 * UUID 기준으로 기존 데이터 업데이트 또는 신규 추가
 * @param {Object} uploadData - 업로드할 데이터
 * @param {number} uploadData.version - 클라이언트 버전 (충돌 감지용)
 * @param {Array} uploadData.projects - 프로젝트 목록
 * @param {Array} uploadData.performances - 성과 목록
 * @param {Object} uploadData.metadata - 메타데이터
 * @param {Array} uploadData.activityLogs - 활동 로그 (선택)
 * @param {Object} uploadData.snapshot - 스냅샷 정보 (선택)
 */
export const upsertServerData = async (uploadData) => {
  const token = localStorage.getItem('accessToken');

  // 디버그: 업로드 데이터 확인
  console.log('[upsertServerData] 업로드 요청:', {
    projects: uploadData.projects?.length || 0,
    performances: uploadData.performances?.length || 0,
    hasMetadata: !!uploadData.metadata,
    hasSettings: !!uploadData.settings
  });

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/data/upsert`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(uploadData)
  });

  const data = await response.json();

  // 디버그: 응답 확인
  console.log('[upsertServerData] 응답:', response.status, data);

  // 409 Conflict - 버전 충돌
  if (response.status === 409) {
    const error = new Error(data.message || '버전 충돌');
    error.conflict = true;
    error.conflictData = data.data;
    throw error;
  }

  if (!response.ok) {
    throw new Error(data.message || '서버 업데이트 실패');
  }

  return data.data;
};

/**
 * 서버에서 데이터 다운로드 (로그 기록됨)
 */
export const downloadServerData = async () => {
  const token = localStorage.getItem('accessToken');
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 화면 본체가 데이터를 받는 경로. fetchServerData 와 같은 토글을 쓴다.
  const useV2 = isV2ReadEnabled();
  const v1Path = '/digital-twin-dashboard/data/download';
  const path = useV2 ? '/dt-v2/data/download?rowVersions=1' : v1Path;

  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'GET', headers });
  const data = await response.json().catch(() => ({}));

  console.log('[downloadServerData] 응답:', {
    source: useV2 ? 'V2' : 'V1',
    status: response.status,
    projects: data.data?.projects?.length || 0,
    performances: data.data?.performances?.length || 0,
    version: data.data?.version
  });

  if (response.ok) {
    if (useV2) rememberRowVersions(data.data);
    return data.data;
  }

  // V2 가 실패하면 V1 으로 물러선다. 사용자에게 빈 화면을 보이지 않으면서도
  // 문제가 있었다는 것은 반드시 드러나야 한다.
  if (useV2) {
    console.error(
      `[DT] V2 다운로드 실패 (${response.status}: ${data.message || '알 수 없음'}). ` +
      'V1 으로 대체합니다. 이 메시지가 보이면 담당자에게 알려주세요.'
    );
    const fb = await fetch(`${API_BASE_URL}${v1Path}`, { method: 'GET', headers });
    const fbData = await fb.json().catch(() => ({}));
    if (!fb.ok) {
      throw new Error(fbData.message || '서버 다운로드 실패');
    }
    return fbData.data;
  }

  throw new Error(data.message || '서버 다운로드 실패');
};


// ============================================
// 스냅샷 API
// ============================================

/**
 * 스냅샷 목록 조회
 */
export const fetchSnapshots = async () => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/snapshots`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '스냅샷 조회 실패');
  }

  return data.data;
};

/**
 * 스냅샷 생성
 */
export const createSnapshot = async (snapshotData) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/snapshots`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(snapshotData)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '스냅샷 생성 실패');
  }

  return data.data;
};

/**
 * 스냅샷 삭제
 */
export const deleteSnapshot = async (snapshotId) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/snapshots/${snapshotId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '스냅샷 삭제 실패');
  }

  return data;
};


// ============================================
// 활동 로그 API
// ============================================

/**
 * 활동 로그 조회
 */
export const fetchActivityLogs = async (options = {}) => {
  const token = localStorage.getItem('accessToken');
  const { limit = 100, offset = 0, action, targetType } = options;

  const params = new URLSearchParams();
  params.append('limit', limit);
  params.append('offset', offset);
  if (action) params.append('action', action);
  if (targetType) params.append('targetType', targetType);

  const response = await fetch(
    `${API_BASE_URL}/digital-twin-dashboard/activity-logs?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '활동 로그 조회 실패');
  }

  return data.data;
};

/**
 * 활동 로그 생성
 */
export const createActivityLog = async (logData) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/activity-logs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(logData)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '활동 로그 생성 실패');
  }

  return data.data;
};


// ============================================
// 보고서 이미지 API (Phase 1-2)
// ============================================
// 기존에는 이미지를 base64 로 과제 JSON 에 인라인 저장해, 과제 하나만 수정해도
// 전체 이미지가 통째로 왕복했다. 이제 파일로 분리하고 JSON 에는 imageId 만 남긴다.

/**
 * 보고서 이미지 업로드
 * @param {string} projectId - 과제 uuid
 * @param {File|Blob} file - 이미지 파일
 * @param {string} slot - 이미지 슬롯 키 (예: '이미지_좌측')
 * @param {Object} [opts] - { position, caption, fileName }
 * @returns {Promise<Object>} 업로드된 이미지 메타 (id 를 imageId 로 저장한다)
 */
export const uploadReportImage = async (projectId, file, slot, opts = {}) => {
  const token = localStorage.getItem('accessToken');

  const formData = new FormData();
  formData.append('file', file, opts.fileName || file.name || 'image.jpg');
  formData.append('slot', slot);
  if (opts.position !== undefined) formData.append('position', String(opts.position));
  if (opts.caption) formData.append('caption', opts.caption);

  const response = await fetch(
    `${API_BASE_URL}/digital-twin-dashboard/report-images/project/${projectId}`,
    { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || '이미지 업로드 실패');
  }
  return data.data.image;
};

/**
 * 보고서 이미지 원본 Blob 조회
 * @param {number} imageId
 */
export const fetchReportImageBlob = async (imageId) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(
    `${API_BASE_URL}/digital-twin-dashboard/report-images/${imageId}`,
    { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }
  );

  if (!response.ok) {
    throw new Error('이미지 조회 실패');
  }
  return response.blob();
};

/**
 * 과제의 보고서 이미지 메타 목록 (이미지 데이터는 포함하지 않음)
 */
export const fetchProjectReportImages = async (projectId) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(
    `${API_BASE_URL}/digital-twin-dashboard/report-images/project/${projectId}`,
    { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || '이미지 목록 조회 실패');
  }
  return data.data;
};

/**
 * 보고서 이미지 삭제
 */
export const deleteReportImage = async (imageId) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(
    `${API_BASE_URL}/digital-twin-dashboard/report-images/${imageId}`,
    { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || '이미지 삭제 실패');
  }
  return data;
};


// ============================================
// 첨부파일 API
// ============================================

/**
 * 과제 첨부파일 목록 조회
 * @param {string} projectId - 과제 ID (UUID)
 */
export const fetchProjectAttachments = async (projectId) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/attachments/project/${projectId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '첨부파일 조회 실패');
  }

  return data.data;
};

/**
 * 과제에 첨부파일 업로드
 * @param {string} projectId - 과제 ID (UUID)
 * @param {File} file - 업로드할 파일
 */
export const uploadProjectAttachment = async (projectId, file) => {
  const token = localStorage.getItem('accessToken');
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/attachments/project/${projectId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
      // Content-Type은 FormData가 자동으로 설정
    },
    body: formData
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '파일 업로드 실패');
  }

  return data.data;
};

/**
 * 첨부파일 다운로드 URL 생성
 * @param {number} attachmentId - 첨부파일 ID
 */
export const getAttachmentDownloadUrl = (attachmentId) => {
  return `${API_BASE_URL}/digital-twin-dashboard/attachments/${attachmentId}`;
};

/**
 * 첨부파일 Blob 데이터 가져오기 (다운로드 트리거 없이)
 * @param {number} attachmentId - 첨부파일 ID
 * @returns {Promise<Blob>} 파일 Blob 데이터
 */
export const getAttachmentBlob = async (attachmentId) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/attachments/${attachmentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('파일 다운로드 실패');
  }

  return await response.blob();
};

/**
 * 첨부파일 원본 Blob 데이터 가져오기 (ZIP 변환 없이 - 다중 파일 ZIP 생성용)
 * @param {number} attachmentId - 첨부파일 ID
 * @returns {Promise<Blob>} 파일 Blob 데이터
 */
export const getAttachmentBlobRaw = async (attachmentId) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/attachments/${attachmentId}/raw`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('파일 다운로드 실패');
  }

  return await response.blob();
};

/**
 * 첨부파일 다운로드
 * @param {number} attachmentId - 첨부파일 ID
 * @param {string} filename - 다운로드할 파일명
 */
export const downloadAttachment = async (attachmentId, filename) => {
  const blob = await getAttachmentBlob(attachmentId);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

/**
 * 첨부파일 삭제
 * @param {number} attachmentId - 첨부파일 ID
 */
export const deleteAttachment = async (attachmentId) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '첨부파일 삭제 실패');
  }

  return data;
};


// ============================================
// KPI 대시보드 API
// ============================================

/**
 * KPI 카테고리 목록 조회
 * @param {number} year - 연도
 */
export const fetchKPICategories = async (year) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/kpi/categories?year=${year}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'KPI 카테고리 조회 실패');
  }

  return data.data;
};

/**
 * KPI 카테고리 생성
 * @param {Object} categoryData - 카테고리 데이터
 */
export const createKPICategory = async (categoryData) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/kpi/categories`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(categoryData)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'KPI 카테고리 생성 실패');
  }

  return data.data;
};

/**
 * KPI 카테고리 수정
 * @param {number} categoryId - 카테고리 ID
 * @param {Object} categoryData - 수정할 데이터
 */
export const updateKPICategory = async (categoryId, categoryData) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/kpi/categories/${categoryId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(categoryData)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'KPI 카테고리 수정 실패');
  }

  return data.data;
};

/**
 * KPI 카테고리 삭제
 * @param {number} categoryId - 카테고리 ID
 */
export const deleteKPICategory = async (categoryId) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/kpi/categories/${categoryId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'KPI 카테고리 삭제 실패');
  }

  return data;
};

/**
 * KPI 목록 조회
 * @param {number} year - 연도
 */
export const fetchKPIs = async (year) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/kpi?year=${year}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'KPI 조회 실패');
  }

  return data.data;
};

/**
 * KPI 생성
 * @param {Object} kpiData - KPI 데이터
 */
export const createKPI = async (kpiData) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/kpi`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(kpiData)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'KPI 생성 실패');
  }

  return data.data;
};

/**
 * KPI 수정
 * @param {number} kpiId - KPI ID
 * @param {Object} kpiData - 수정할 데이터
 */
export const updateKPI = async (kpiId, kpiData) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/kpi/${kpiId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(kpiData)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'KPI 수정 실패');
  }

  return data.data;
};

/**
 * KPI 삭제
 * @param {number} kpiId - KPI ID
 */
export const deleteKPI = async (kpiId) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/kpi/${kpiId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'KPI 삭제 실패');
  }

  return data;
};


// ============================================
// KPI 대시보드 카드 API
// ============================================

/**
 * KPI 대시보드 카드 목록 조회
 * @param {number} year - 연도
 */
export const fetchKPIDashboardCards = async (year) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/kpi/cards?year=${year}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'KPI 카드 조회 실패');
  }

  return data.data;
};

/**
 * KPI 대시보드 카드 생성
 * @param {Object} cardData - 카드 데이터
 */
export const createKPIDashboardCard = async (cardData) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/kpi/cards`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(cardData)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'KPI 카드 생성 실패');
  }

  return data.data;
};

/**
 * KPI 대시보드 카드 수정
 * @param {number} cardId - 카드 ID
 * @param {Object} cardData - 수정할 데이터
 */
export const updateKPIDashboardCard = async (cardId, cardData) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/kpi/cards/${cardId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(cardData)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'KPI 카드 수정 실패');
  }

  return data.data;
};

/**
 * KPI 대시보드 카드 삭제
 * @param {number} cardId - 카드 ID
 */
export const deleteKPIDashboardCard = async (cardId) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/kpi/cards/${cardId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'KPI 카드 삭제 실패');
  }

  return data;
};

export const reorderKPIDashboardCards = async (orderedIds) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/kpi/cards/reorder`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ orderedIds })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'KPI 카드 순서 변경 실패');
  }

  return data;
};

// ============================================
// 전체 첨부파일 다운로드 API (관리자 전용)
// ============================================

/**
 * 모든 프로젝트 첨부파일 다운로드 (관리자 전용)
 * 서버에서 ZIP 파일로 반환
 */
export const downloadAllAttachments = async () => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/attachments/download-all`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('관리자 권한이 필요합니다.');
    }
    if (response.status === 404) {
      throw new Error('다운로드할 첨부파일이 없습니다.');
    }
    const data = await response.json();
    throw new Error(data.message || '첨부파일 다운로드 실패');
  }

  const blob = await response.blob();

  // 다운로드 트리거
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'all_project_attachments.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);

  return { success: true };
};


// ============================================
// 과제 소프트 삭제/복구 API
// ============================================

/**
 * 과제 소프트 삭제 (서버에서 _deleted 플래그 설정)
 * @param {string} projectUuid - 과제 UUID 또는 ID
 */
export const softDeleteProject = async (projectUuid) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/project/${projectUuid}/delete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '과제 삭제 실패');
  }

  return data.data;
};

/**
 * 삭제된 과제 복구
 * @param {string} projectUuid - 과제 UUID 또는 ID
 */
export const restoreProject = async (projectUuid) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/project/${projectUuid}/restore`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '과제 복구 실패');
  }

  return data.data;
};

/**
 * 과제 완전 삭제 (복구 불가)
 * @param {string} projectUuid - 과제 UUID 또는 ID
 */
export const permanentDeleteProject = async (projectUuid) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/project/${projectUuid}/permanent-delete`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '과제 완전 삭제 실패');
  }

  return data.data;
};

/**
 * 성과 항목 삭제
 * @param {string} performanceId - 성과 UUID 또는 ID
 */
export const deletePerformanceApi = async (performanceId) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/performance/${performanceId}/delete`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '성과 삭제 실패');
  }

  return data.data;
};

/**
 * KPI 기여방법 문구를 **그 지표의 모든 연결에서 한꺼번에** 바꾼다. (2026-08-07)
 *
 * `to` 가 빈 문자열이면 그 방법을 연결에서 **뺀다**(설정 탭의 '연결에서도 지우기').
 * `dryRun` 이면 몇 건이 걸리는지만 세고 아무것도 안 쓴다 — 삭제 전에 물어보려고 쓴다.
 */
export const renameKpiContributionMethod = async ({ kpiDefinitionId, from, to, dryRun = false }) => {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`${API_BASE_URL}/dt-v2/kpi-contribution-methods/rename`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kpiDefinitionId, from, to, dryRun }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || body?.error || `요청 실패 (${res.status})`);
  return body?.data || {};
};
