/**
 * 사업부 표시 순서 — **설정이 정본이다.** (2026-08-07)
 *
 * 왜 만들었나
 *     화면마다 `const divisionOrder = ['MX','VD','DA',...]` 를 각자 박아 두고 있었고,
 *     **그 배열들이 서로 달랐다.** 실측 —
 *         MX,VD,DA,NW,의료기기,**SR,GTR**,CS   DepartmentStatus · AllPerformancesView · AllProjectsView
 *         MX,VD,DA,NW,의료기기,**CS,GTR,SR**   ProjectReportView · DashboardView(EXEC_DIV_ORDER)
 *         MX,VD,DA,NW,의료기기,**GTR,SR**      DashboardView:2734
 *         MX,VD,DA,NW,의료기기,**GTR,SR,CS**   설정 DB (Division.order)
 *     꼬리 세 개가 화면마다 다르니, 같은 데이터를 봐도 순서가 달라 "내가 어디쯤
 *     있나" 를 잃는다. 조직이 바뀌면 여덟 군데를 다 고쳐야 하는데 그럴 리도 없다.
 *
 * 그래서 **설정(`settingsData.divisions`) 배열 순서**를 유일한 근거로 쓴다.
 * 서버도 같은 태도다 — `routes_v2._kpi_owner_divisions`:
 * "코드에 이름을 박지 않는다 — 조직이 바뀌면 화면이 조용히 틀어진다."
 *
 * ⚠️ 이건 **순서**를 정하는 것이지 **어느 사업부를 보여줄지**가 아니다.
 *    `KPI_DIVISIONS` · `PERF_TARGET_DIVS` 처럼 대상을 고르는 배열은 성격이 다르므로
 *    여기로 옮기면 안 된다.
 */

/** 설정에 없는 사업부(비활성·오타)는 뒤로. 자기들끼리는 이름순이라 순서가 안 흔들린다. */
const UNKNOWN = 9999;

/** 사업부 이름 → 정렬 순위. `settingsData` 가 없으면 전부 UNKNOWN(=이름순) 이 된다. */
export const divisionRank = (settingsData) => {
  const order = new Map(
    ((settingsData || {}).divisions || []).map((d, i) => [d?.name, i]));
  return (name) => (order.has(name) ? order.get(name) : UNKNOWN);
};

/** 사업부 이름끼리 비교. 설정 순서 → (설정에 없으면) 이름순 */
export const compareDivisionNames = (settingsData) => {
  const rank = divisionRank(settingsData);
  return (a, b) => (rank(a) - rank(b))
    || String(a ?? '').localeCompare(String(b ?? ''), 'ko');
};

/**
 * 과제 정렬 비교자 — **사업부(설정 순서) → 과제명 가나다순**. (2026-08-07 결정)
 *
 * 과제코드가 아니라 과제명으로 세운다. 목록 화면이 원래 과제명으로 세우고 있었고,
 * 사람이 찾을 때 쓰는 것도 이름이다. 코드는 사업부 안에서 이미 순서가 얼추 맞는다.
 */
export const compareProjects = (settingsData) => {
  const byDiv = compareDivisionNames(settingsData);
  return (a, b) => byDiv(a?.사업부, b?.사업부)
    || String(a?.과제명 ?? '').localeCompare(String(b?.과제명 ?? ''), 'ko');
};

/*
  아래 둘은 `utils/divisionSorting.js` 의 같은 이름 함수를 대신한다.
  그쪽은 `DIVISION_ORDER` 가 **5개뿐**이라(MX·VD·DA·NW·의료기기) GTR·SR·CS 가
  전부 뒤에 뭉쳐 순서가 없었다.

  ⚠️ 옛 함수는 인자로 받은 배열을 **제자리에서 정렬**했다(`divisions.sort(...)`).
     여기서는 사본을 만든다 — `Object.keys()` 결과라 지금 호출부는 영향이 없지만,
     남의 배열을 조용히 뒤집는 함수는 다음 사람이 반드시 밟는다.
*/

/** 사업부 이름 배열을 설정 순서로. */
export const sortDivisionNames = (names, settingsData) =>
  [...(names || [])].sort(compareDivisionNames(settingsData));

/** `[사업부, 값]` 엔트리 배열을 설정 순서로. */
export const sortDivisionEntries = (entries, settingsData) => {
  const byDiv = compareDivisionNames(settingsData);
  return [...(entries || [])].sort((a, b) => byDiv(a?.[0], b?.[0]));
};
