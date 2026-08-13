/**
 * 대시보드 저장 어댑터 — 서버에 쓰는 유일한 관문
 *
 * 왜 있나
 *     저장 호출이 화면 코드 **10곳**에 흩어져 있었다. 각자 페이로드를 직접 조립하고
 *     localStorage 의 version 을 직접 만졌다. 이 상태로 V2(과제별 PATCH) 분기를
 *     넣으면 10곳에 각각 if 가 생기고, 그 뒤로는 되돌리기도 어려워진다.
 *
 *     그래서 **먼저 한 곳으로 모은다.** 이 단계에서 동작은 하나도 바뀌지 않는다 —
 *     전부 지금과 똑같이 V1 `/data/upsert`(일부 `/data/upload`)로 내려간다.
 *     전환은 이 파일 안에서만 일어난다 (실행계획 7.5-4 프론트 저장 전환의 0단계).
 *
 * 이름 규칙
 *     전송 방식이 아니라 **어떤 사용자 행동의 저장인가**로 지었다.
 *     V2 대응이 행동마다 다르기 때문이다 (아래 표의 마지막 열).
 *
 * ┌───────────────────────────────┬──────────┬────────┬────────────────────────────────┐
 * │ 함수                          │ version  │ 새 ver │ V2 대응 (예정)                 │
 * │                               │ 보냄     │ 저장   │                                │
 * ├───────────────────────────────┼──────────┼────────┼────────────────────────────────┤
 * │ saveAutoRepair                │    ✗     │   ✗    │ **보내지 않음** (로컬 정리만)  │
 * │ saveNewProject                │    ✓     │   ✓    │ POST /projects                 │
 * │ saveProjectEdit               │    ✓     │   ✓    │ PATCH /projects/<uuid> ★붙임   │
 * │ savePerformanceEdit           │    ✓     │   ✓    │ POST · PATCH /performances     │
 * │ saveContributions             │    ✗     │   ✗    │ PUT /projects/<uuid>/perform…  │
 * │ saveProjectPerformanceLinks   │    ✗     │   ✗    │ PUT /projects/<uuid>/perform…  │
 * │ saveBulkAdd                   │    ✗     │   ✗    │ 여러 호출로 분해               │
 * │ saveCreatedAtBackfill         │    ✓     │   ✓    │ N × PATCH /projects/<uuid>     │
 * │ saveSettingsRename            │    ✗     │   ✗    │ N × PATCH /projects/<uuid>     │
 * │ saveManualUpsert              │ 호출부   │   ✓    │ **없음 — 폐지 예정**           │
 * │ saveManualOverwrite           │ 호출부   │   ✓    │ **없음 — 폐지 예정**           │
 * │ saveBulkYearDelete            │    ✗     │   ✗    │ POST /projects/bulk-delete ★   │
 * │ saveBulkYearRestore           │    ✗     │   ✗    │ POST /projects/bulk-restore ★  │
 * └───────────────────────────────┴──────────┴────────┴────────────────────────────────┘
 *
 * 마지막 두 개만 방향이 반대다 — 나머지는 V1 이 원본이고 V2 를 붙였는데, 이건
 * **V2 에만 있다.** 옛 '전체 삭제'(로컬만 비우고 수동 업로드로 확정)를 대신하는
 * 자리라 V1 로 물러설 곳이 없다. 2026-08-02 신설.
 *
 * ★ = V2 분기가 붙은 함수. `localStorage.dtV2Write === '1'` 이고 서버
 *     `DT2_WRITE_ENABLED` 가 켜져 있을 때만 그 길로 간다. 기본값은 둘 다 꺼짐이라
 *     지금 사용자에게는 아무 변화가 없다. 나머지 함수는 아직 V1 만 탄다.
 *
 * ⚠️ version 을 안 보내는 4곳은 **낙관적 락을 건너뛴다.** 좋아서가 아니라 원래
 *    그렇게 동작하고 있었다. 0단계의 약속이 "동작 변화 0" 이라 그대로 뒀다.
 *    이 표가 그 불일치를 처음으로 한눈에 보여준다 — 정리는 2단계(전역 version →
 *    행별 row_version)에서 의도적으로 한다. 지금 고치면 0단계가 아니게 된다.
 */

import {
  upsertServerData,
  uploadServerData,
  isV2WriteEnabled,
  isV2ReadEnabled,
  fetchProjectStateV2,
  patchProjectV2,
  createProjectV2,
  putProjectLinksV2,
  putProjectKpiLinksV2,
  putProjectDependenciesV2,
  createPerformanceV2,
  patchPerformanceV2,
  postActivityLog,
  projectRowVersion,
  performanceRowVersion,
  rememberProjectRowVersion,
  rememberPerformanceRowVersion,
  forgetProjectRowVersion,
  bulkDeleteProjectsByYearV2,
  bulkRestoreProjectsByYearV2,
  bulkDeletePerformancesV2,
  fetchPerformanceDeleteSummaryV2,
  softDeleteProjectV2,
  restoreProjectV2,
  permanentDeleteProjectV2,
  deletePerformanceV2,
  softDeleteProject as softDeleteProjectRequest,
  restoreProject as restoreProjectRequest,
  permanentDeleteProject as permanentDeleteProjectRequest,
  deletePerformanceApi as deletePerformanceRequest,
} from './settingsApi';
import { getRecentLogs, extractChanges } from '../utils/activityLogger';

const VERSION_KEY = 'dashboardDataVersion';

// ─────────────────────────────────────────────────────────────────────────────
// 내부 — 전송 공통부
// ─────────────────────────────────────────────────────────────────────────────

const readClientVersion = () => {
  const stored = localStorage.getItem(VERSION_KEY);
  return stored ? parseInt(stored) : 0;
};

const rememberVersion = (result) => {
  localStorage.setItem(VERSION_KEY, result.version.toString());
  return result;
};

/** 전역 version 을 실어 보내고, 서버가 준 새 version 을 기억한다. */
const upsertTracked = async (payload) =>
  rememberVersion(await upsertServerData({ version: readClientVersion(), ...payload }));

/** version 없이 보낸다 — 서버의 충돌 감지를 건너뛴다. 위 ⚠️ 참조. */
const upsertUntracked = (payload) => upsertServerData(payload);

// ─────────────────────────────────────────────────────────────────────────────
// 공용 도우미
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 저장 실패를 화면에 보여줄 문구로 만든다.
 *
 * **충돌(409)은 고장이 아니다.** "다른 사람이 같은 항목을 먼저 고쳤다" 는 정상적인
 * 결과이고 할 일도 정해져 있다(새로고침 후 재시도). 그런데 일반 오류와 똑같이
 * "…중 오류가 발생했습니다: " 를 씌우면, 그것도 두 겹으로 씌우면,
 * 정작 무엇을 해야 하는지가 문장 끝에 묻힌다.
 *
 * 그래서 충돌일 때는 서버 문구를 **그대로** 보여준다 — 이미 할 일이 담겨 있다.
 */
export const saveErrorMessage = (error, prefix) =>
  (error?.conflict ? (error.message || '다른 사용자가 먼저 수정했습니다.')
                   : `${prefix}: ${error?.message ?? error}`);

/**
 * 편집창을 열 때 "내가 보고 있는 게 최신인가" 를 확인한다.
 *
 * 화면 데이터를 다시 채우지는 않는다. 저장은 **바뀐 필드만** 보내고 서버가 필드 단위로
 * 병합하므로 **손실은 이미 막혀 있다**(다른 항목을 고친 사람의 변경이 되돌아가지 않는다).
 * 여기서 없애려는 건 "낡은 값을 보며 판단하는" 상황이다.
 *
 * ⚠️ **알아낸 최신 버전으로 캐시를 갱신하면 안 된다.** `expected_version` 은
 *    "내가 보고 있는 데이터의 버전" 이어야 한다. 여기서 최신 값으로 바꿔치기하면
 *    화면은 낡은 채로 **충돌 감지만 풀려서**, 같은 항목을 고쳐도 조용히 덮어쓴다.
 *
 * 조회에 실패하면 조용히 넘어간다 — 오프라인에서도 편집은 돼야 한다.
 * 반환: 사용자에게 보여줄 문구. 알릴 것이 없으면 null.
 */
export const checkProjectFreshness = async (project) => {
  if (!isV2ReadEnabled()) return null;

  const uuid = project?.uuid;
  if (!uuid) return null;

  try {
    const { rowVersion, canEdit } = await fetchProjectStateV2(uuid);
    const seen = projectRowVersion(uuid);

    if (canEdit === false) {
      return '이 과제를 수정할 권한이 없습니다. 편집해도 저장되지 않습니다.';
    }
    if (seen != null && rowVersion != null && seen !== rowVersion) {
      return '이 과제는 다른 사용자가 수정했습니다. 새로고침하면 최신 내용을 볼 수 있습니다.';
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * 중간 단계에서 다시 던질 때 쓴다.
 *
 * `new Error(...)` 로 감싸면 `conflict` 표시가 사라져서 바깥에서 충돌인지 알 수 없다.
 * 충돌은 그대로 올려보내고, 나머지에만 맥락을 붙인다.
 */
export const rethrowSaveError = (error, prefix) => {
  if (error?.conflict) throw error;
  throw new Error(`${prefix}: ${error?.message ?? error}`);
};

/**
 * 방금 기록한 활동 로그 n건을 서버 전송 형태로 추린다.
 *
 * 호출부 5곳에 같은 매핑이 복사돼 있던 것을 모았다.
 * `count` 가 0 이면 빈 배열이다(`getRecentLogs` 가 slice 를 쓴다).
 */
export const recentActivityLogs = (count) =>
  getRecentLogs(count).map(log => ({
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    targetName: log.targetName,
    changes: log.changes,
    summary: log.summary,
  }));

// ─────────────────────────────────────────────────────────────────────────────
// 저장 — 과제
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 진입 시 자동 보정(고아 성과 참조 제거·진행률 정합성)을 서버에도 반영한다.
 *
 * 사용자가 시킨 저장이 아니므로 실패해도 조용히 넘어간다 — 호출부가 catch 한다.
 * version 을 안 보내는 것도 원래 그대로다.
 *
 * **V2 에서는 서버로 보내지 않는다.** 연결이 테이블로 관리돼 고아가 생길 수 없고,
 * 화면이 고아로 보는 것은 이관이 **일부러 보존한 V1 원본 고아**뿐이다
 * (`dt3_check_frontend_shape.py` 가 그 구분을 확인한다).
 * 그걸 되돌려 쓰면 보존하기로 한 원본을 지우는 셈이라, 로컬 정리까지만 한다.
 */
export const saveAutoRepair = ({ projects, performances, metadata }) => {
  if (isV2WriteEnabled()) {
    console.info('[DT] 자동 보정은 V2 에서 서버로 보내지 않습니다 (로컬 정리까지만).');
    return Promise.resolve({ skipped: true });
  }
  return upsertUntracked({ projects, performances, metadata });
};

/**
 * 서버가 정하는 값. 보내봐야 무시되므로 **아예 보내지 않는다** —
 * 그래야 응답의 `ignored` 가 "진짜 빠진 것" 만 가리키는 신호로 남는다.
 * (2026-07-30 실측: 생성 때 이 둘만 매번 ignored 로 돌아왔다)
 */
const SERVER_OWNED = ['createdAt', 'updatedAt'];

const createProjectFlowV2 = async ({ project, performances, activityLogs }) => {
  // 관계 키는 별도 API 소관이라 애초에 담지 않는다 (위에서 이미 걸렀지만 이중 방어).
  const fields = {};
  Object.keys(project || {}).forEach(key => {
    if (RELATION_FIELDS.includes(key) || SERVER_OWNED.includes(key)) return;
    fields[key] = project[key];
  });

  // 이미지가 딸린 채로 만들어지는 경우 — 슬롯을 컬럼 모양으로 합쳐 함께 보낸다.
  const imageRefs = imageRefsFrom(project);
  if (Object.keys(imageRefs).length) {
    fields.image_refs_json = imageRefs;
  }

  const result = await createProjectV2(fields);
  rememberProjectRowVersion(result?.uuid, result?.rowVersion);
  console.info(`[DT] V2 과제 생성 완료 — uuid=${result?.uuid} code=${result?.code ?? '-'}`);
  if (result?.ignored?.length) {
    console.warn(`[DT] 생성에서 서버가 건너뛴 키 ${result.ignored.length}개 — 저장되지 않았습니다: `
                 + result.ignored.join(', '));
  }

  // 연결은 **과제가 있어야** 걸 수 있으므로 순서를 뒤집을 수 없다.
  // 수정과 달리 "먼저 연결" 이 불가능하다는 뜻이고, 그래서 여기서 실패하면
  // **과제는 만들어졌는데 연결만 빠진** 상태가 남는다.
  // 조용히 넘어가지 않고 무엇을 해야 하는지까지 담아 올려보낸다.
  const extra = {};

  const items = toLinkItems(project?.[LINK_FIELD], performances);
  if (items.length) {
    try {
      const linked = await putProjectLinksV2(result.uuid, items,
                                             { expectedVersion: projectRowVersion(result.uuid) });
      rememberProjectRowVersion(result.uuid, linked?.rowVersion);
      console.info(`[DT] V2 신규 과제 성과 연결 — ${(linked?.items || []).length}건`);
      extra.links = linked;
    } catch (err) {
      console.error('[DT] 과제는 생성됐지만 성과 연결에 실패했습니다.', err);
      throw new Error(
        `과제는 만들어졌지만 성과 연결에 실패했습니다 (${err.message}). `
        + '편집창에서 성과를 다시 연결해 주세요.');
    }
  }

  // 선행 과제도 같은 사정이다. 성과 연결 **뒤**에 보낸다 — 앞에 두면 성과 연결이
  // 실패했을 때 선행만 걸린 과제가 남는다. 순서를 정해 둘 뿐 어느 쪽도 되돌리지 않는다.
  const depItems = toDepItems(project?.[DEP_FIELD]);
  if (depItems.length) {
    try {
      const deps = await putProjectDependenciesV2(
        result.uuid, depItems, { expectedVersion: projectRowVersion(result.uuid) });
      rememberProjectRowVersion(result.uuid, deps?.rowVersion);
      console.info(`[DT] V2 신규 과제 선행 연결 — ${(deps?.items || []).length}건`);
      extra.dependencies = deps;
    } catch (err) {
      console.error('[DT] 과제는 생성됐지만 선행 과제 연결에 실패했습니다.', err);
      throw new Error(
        `과제는 만들어졌지만 선행 과제 연결에 실패했습니다 (${err.message}). `
        + '편집창 ▸ 기타 탭에서 다시 연결해 주세요.');
    }
  }

  await sendActivityLogs(activityLogs);
  return { ...result, ...extra };
};

/**
 * 과제 1건 신규 등록.
 *
 * V1 — 전체 배열 upsert
 * V2 — `POST /projects` (토글이 켜졌을 때)
 *
 * 수정과 달리 **전체 필드를 보낸다.** 그래서 권한 분류표에 없는 필드가 있으면
 * 그 값이 통째로 빠진다 — 2026-07-30 에 분류 안 된 컬럼 17개를 채운 이유다.
 *
 * 성과 연결·선행 과제가 딸려 있으면 생성 **뒤에** 연결 API 를 부른다 — 수정과 달리
 * 순서를 뒤집을 수 없다(과제가 있어야 연결을 건다). 이미지는 생성 본문에 함께 간다.
 */
export const saveNewProject = ({ projects, performances, metadata, activityLogs, project }) => {
  const toV1 = () => upsertTracked({ projects, performances, metadata, activityLogs });

  if (!isV2WriteEnabled()) return toV1();

  if (!project) {
    console.warn('[DT] 새 과제 객체를 못 받아 V1 로 저장합니다.');
    return toV1();
  }

  const withRelations = RELATION_FIELDS_WITHOUT_API.filter(field => !isEmptyish(project[field]));
  if (withRelations.length) {
    console.info(`[DT] ${withRelations.join(', ')} 이(가) 딸린 신규 과제라 V1 로 보냅니다 (해당 API 미연결).`);
    return toV1();
  }

  return createProjectFlowV2({ project, performances, activityLogs }).catch(err => {
    if (err?.v2Disabled) {
      console.warn('[DT] 서버의 V2 쓰기가 꺼져 있어(503) V1 로 저장합니다.');
      return toV1();
    }
    throw err;
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// 과제 1건 수정 — V1 / V2 분기가 있는 첫 함수
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 과제 PATCH 로는 보내지 않는 키. 값이 사라지는 게 아니라 **가는 길이 다르다.**
 * 지금은 연결 API 를 아직 안 붙였으므로, 이게 바뀌면 V1 로 물러선다(아래 참조).
 */
const LINK_FIELD = '성과목록';

/** 선행과제. `PUT /projects/<uuid>/dependencies` 로 간다 (2026-08-08 부터). */
const DEP_FIELD = '선행과제목록';

/**
 * 과제 컬럼이 아니라 **다른 테이블/다른 API 로 가는 키들** (서버의 PROJECT_RELATION_KEYS).
 *
 * 이 목록이 서버와 갈려도 조용히 틀어지지는 않는다 — 빠뜨린 키는 서버 응답의
 * `ignored` 에 나타나므로 콘솔에서 바로 보인다. 그게 이 목록의 안전장치다.
 */
/**
 * 보고서 이미지 슬롯. 화면은 슬롯마다 배열로 들고 있지만 dt2 에서는
 * **`image_refs_json` 컬럼 하나**에 `{슬롯명: [...]}` 로 담긴다.
 */
const IMAGE_SLOTS = [
  '이미지_좌측', '이미지_우측', '이미지_개요그림',
  '이미지_상세내용그림', '이미지_향후계획그림',
];

const RELATION_FIELDS = [
  LINK_FIELD,          // → PUT /projects/<uuid>/performances
  DEP_FIELD,           // → PUT /projects/<uuid>/dependencies
  ...IMAGE_SLOTS,      // → image_refs_json (아래에서 하나로 합쳐 보낸다)
];

/**
 * 비어 있음의 여러 표현을 하나로 본다.
 *
 * 편집창은 `선행과제목록: project.선행과제목록 || []` 처럼 **없는 값에 기본값을 채운다.**
 * 그래서 원본에 없던 키가 `[]` 로 생기고, 통째 비교하면 "바뀐 것" 이 된다.
 * 2026-07-30 시험에서 관계 키 6개가 매 저장마다 이 이유로 걸러지고 있었다.
 */
const isEmptyish = (v) => v === undefined || v === null || v === ''
  || (Array.isArray(v) && v.length === 0);

const sameRelation = (a, b) =>
  (isEmptyish(a) && isEmptyish(b)) || JSON.stringify(a) === JSON.stringify(b);

/**
 * 성과 연결 원소에서 **관계 속성만** 남긴다.
 *
 * 왜 그냥 비교하면 안 되나
 *   원소에 성과 본체가 복제돼 들어온 경우가 있고(운영 실측 31건), 참조 키 이름도
 *   `성과항목UUID`/`성과UUID`/`uuid`/`성과항목ID`/`id` 로 섞여 있다. 편집창을 열었다
 *   닫기만 해도 모양이 미묘하게 달라져서, JSON 을 통째로 비교하면 **안 바뀐 연결이
 *   바뀐 것으로 보인다.** 실제로 2026-07-30 시험에서 매번 그렇게 걸렸다.
 *
 *   연결의 정본은 참조 + 과제기여도 + 실적수준뿐이다 — V2 연결 API 가 받는 것
 *   (`performanceUuid`, `contribution`, `actualLevel`)과 같은 기준이다.
 *   순서는 표시 순서라 의미가 있으므로 배열 순서는 유지해서 비교한다.
 */
const linkRef = (el) => (typeof el === 'string' ? el
  : (el?.성과항목UUID || el?.성과UUID || el?.uuid || el?.성과항목ID || el?.id || ''));

const normalizeLinks = (list) => (Array.isArray(list) ? list : []).map(el => ({
  ref: String(linkRef(el) ?? ''),
  기여도: String(el?.과제기여도 ?? ''),
  실적: String(el?.실적수준 ?? ''),
}));

const linksReallyChanged = (before, after) =>
  JSON.stringify(normalizeLinks(before?.[LINK_FIELD]))
  !== JSON.stringify(normalizeLinks(after?.[LINK_FIELD]));

/**
 * 선행과제 — 정본은 **참조 uuid 하나**뿐이다.
 *
 * 원소에는 과제명·사업부·과제년도·과제PL 이 함께 실려 오지만 그건 사본이다.
 * 서버가 읽을 때 살아 있는 과제 행에서 다시 채우므로(`assemble.py`), 대상 과제의
 * **이름이 바뀌기만 해도** 통째로 비교하면 "바뀐 것" 이 된다 — 성과 연결에서 겪은
 * 것과 같은 함정이다(`normalizeLinks` 머리말).
 *
 * 순서는 넣은 순서라 의미가 있으므로 배열 순서는 유지해 비교한다.
 */
const normalizeDeps = (list) => (Array.isArray(list) ? list : [])
  .map(el => String((typeof el === 'string' ? el : (el?.uuid || el?.dependsOnUuid)) ?? ''))
  .filter(Boolean);

const depsReallyChanged = (before, after) =>
  JSON.stringify(normalizeDeps(before?.[DEP_FIELD]))
  !== JSON.stringify(normalizeDeps(after?.[DEP_FIELD]));

/** 화면의 `선행과제목록` → 서버가 받는 항목. 참조만 보낸다. */
const toDepItems = (list) => normalizeDeps(list).map(uuid => ({ dependsOnUuid: uuid }));

/**
 * 무엇이 바뀌었는지를 PATCH 본문으로 만든다.
 *
 * `extractChanges` 에 **필드 목록을 주지 않으면 전체 키를 비교한다**
 * (activityLogger.js). 그래서 "보낼 수 있는 필드 목록" 을 화면에 둘 필요가 없다 —
 * 서버가 못 받는 키는 `ignore_unknown` 으로 걸러지고 `ignored` 로 되돌아온다.
 */
const projectPatchFromDiff = (before, after) => {
  const diff = extractChanges(before, after);
  const patch = {};
  Object.keys(diff).forEach(key => {
    if (RELATION_FIELDS.includes(key)) return;   // 다른 API 소관 — 여기 담지 않는다
    patch[key] = diff[key].after;
  });

  // 이미지는 슬롯 5개가 dt2 에서 컬럼 하나다. 하나라도 바뀌었으면 **다섯 슬롯 전체**를
  // 다시 만들어 보낸다 — 컬럼을 통째로 교체하는 것이라 일부만 보내면 나머지가 사라진다.
  if (imagesReallyChanged(before, after)) {
    patch.image_refs_json = imageRefsFrom(after);
  }
  return patch;
};

/**
 * 아직 V2 로 보낼 길이 없는 관계 키 — 이게 바뀐 저장만 통째로 V1 으로 물러선다.
 *
 * **지금은 비어 있다** (2026-08-08). 성과 연결은 연결 API 로, 이미지는
 * `image_refs_json` 으로, 마지막까지 남아 있던 선행과제는
 * `PUT /projects/<uuid>/dependencies` 로 보낼 수 있게 됐다.
 *
 * 빈 배열이어도 **지우지 않는다.** 이 자리가 있어야 다음에 API 없는 관계 키가 생겼을 때
 * 여기 한 줄 넣는 것으로 끝난다. 비었으니 폴백 분기는 그냥 지나간다.
 */
const RELATION_FIELDS_WITHOUT_API = [];

/**
 * 이미지 슬롯 다섯 개를 dt2 컬럼 모양 `{슬롯명: [...]}` 으로 모은다. 빈 슬롯은 뺀다.
 *
 * ⚠️ **여기 없는 `이미지_*` 키는 조용히 버려진다.** 2026-08-08 에 그것 때문에
 *    "편집창에서 이미지를 넣었는데 저장이 안 된다" 가 났다 — 과제에 `방사 패턴` 같은
 *    자유 텍스트 카테고리가 저장돼 있어 업로드가 `이미지_방사 패턴` 으로 들어갔다.
 *    입구(DetailInfoModal)를 막았지만, **버려질 때 눈에 보이게** 여기서도 알린다.
 */
const imageRefsFrom = (project) => {
  const refs = {};
  IMAGE_SLOTS.forEach(slot => {
    const value = project?.[slot];
    if (Array.isArray(value) && value.length) refs[slot] = value;
  });

  const dropped = Object.keys(project || {}).filter(
    k => k.startsWith('이미지_') && !k.endsWith('_카테고리')
      && !IMAGE_SLOTS.includes(k)
      && Array.isArray(project[k]) && project[k].length);
  if (dropped.length) {
    console.warn('[DT] 알 수 없는 이미지 슬롯이라 저장하지 않습니다: '
      + `${dropped.join(', ')} — 쓸 수 있는 슬롯: ${IMAGE_SLOTS.join(', ')}`);
  }
  return refs;
};

const imagesReallyChanged = (before, after) =>
  IMAGE_SLOTS.some(slot => !sameRelation(before?.[slot], after?.[slot]));

/** 보낼 길이 없는 관계 키 중 **실제로** 달라진 것들. 겉모습·기본값 차이는 걸러낸다. */
const changedRelations = (before, after) => RELATION_FIELDS_WITHOUT_API.filter(
  field => !sameRelation(before?.[field], after?.[field]));

/**
 * 연결 원소의 참조를 성과 uuid 로 푼다.
 *
 * 원소의 참조 키가 여러 종류라(`성과항목UUID`/`성과UUID`/`uuid`/`성과항목ID`/`id`)
 * 어떤 것은 uuid 가 아니라 코드('4')다. 서버는 **uuid 만** 받고 아니면 400 이다.
 * 못 찾으면 원래 값을 그대로 보낸다 — 여기서 지어내는 것보다 서버가 400 으로
 * 알려주는 편이 낫다.
 */
const findPerformanceByRef = (ref, performances) => {
  if (!ref) return null;
  const list = Array.isArray(performances) ? performances : [];
  return list.find(p => p?.uuid === ref
    || String(p?.id) === String(ref)
    || p?.성과항목UUID === ref) || null;
};

const resolvePerformanceUuid = (ref, performances) =>
  (ref ? (findPerformanceByRef(ref, performances)?.uuid || ref) : ref);

/**
 * 화면의 `성과목록` → 서버가 받는 연결 항목. **배열 순서가 곧 표시 순서**다.
 *
 * ★ `actualLevel` 은 **화면의 사본이 아니라 지금의 성과 정의**에서 가져온다 (2026-08-07).
 *
 *   왜
 *     실적수준은 성과 정의가 정본이다 — 화면에 과제별 실적을 입력하는 칸이 아예 없고,
 *     연결 원소의 값은 연결할 때 베껴 둔 사본일 뿐이다
 *     (PerformanceSection.withLiveDefinition 머리말 참조).
 *     그런데 편집창의 `formData` 는 **열었을 때의 값**이다. 편집창을 띄워 둔 채 다른
 *     창에서 그 성과의 실적을 고치면, 이 편집창에서 과제를 저장하는 순간 사본이
 *     서버로 올라가 **방금 고친 실적이 조용히 되돌아간다.**
 *     저장 직전에 정의에서 다시 읽으면 그 창이 얼마나 오래 열려 있었든 상관없어진다.
 *
 *   ⚠️ 정의를 못 찾거나(`null`) 정의에 그 키가 없으면(`undefined`) **사본을 그대로
 *      쓴다.** 못 찾았다고 비워 보내면 멀쩡한 실적이 지워진다.
 *      빈 문자열은 '지웠다' 는 뜻이라 그대로 반영한다(→ null).
 *
 *   `contribution`(과제기여도)은 **여기서 손대지 않는다.** 그것만이 과제별 값이다.
 */
const toLinkItems = (list, performances) => normalizeLinks(list).map(link => {
  const def = findPerformanceByRef(link.ref, performances);
  const actual = (def && def.실적수준 != null) ? String(def.실적수준) : link.실적;
  return {
    performanceUuid: def?.uuid || link.ref,
    contribution: link.기여도 === '' ? null : link.기여도,
    actualLevel: actual === '' ? null : actual,
  };
});

/**
 * 활동 로그를 따로 보낸다 (V2 경로 전용).
 *
 * V1 은 저장 페이로드에 로그를 실어 보냈다. V2 에는 그 자리가 없어서 안 보내면
 * **활동로그 화면에서 V2 저장분이 통째로 빠진다.** (`dt2_project_changes` 는 필드 단위
 * 이력이라 성격이 다르다 — 둘 다 필요하다)
 *
 * **실패해도 저장을 실패시키지 않는다.** 데이터는 이미 저장됐고, 로그 한 줄 때문에
 * 사용자에게 실패를 알리는 건 과하다. 대신 콘솔에 남긴다.
 */
const sendActivityLogs = async (logs) => {
  for (const log of (Array.isArray(logs) ? logs : [])) {
    try {
      await postActivityLog(log);
    } catch (err) {
      console.warn('[DT] 활동 로그 전송 실패 (저장 자체는 성공했습니다): ' + err.message);
    }
  }
};

/**
 * 여러 과제의 성과 연결을 **순차로** 보낸다.
 *
 * 저장 하나가 호출 N번이 되면서 "일부만 반영" 이 가능해진다. 정책(2026-07-30 결정):
 *
 *   · **순차** — 동시에 보내면 같은 성과를 쓰는 과제끼리 서버 행 락에서 경합한다
 *   · **첫 실패에서 중단** — 계속 밀어붙이면 어디까지 됐는지가 더 흐려진다
 *   · 이미 반영된 것은 **되돌리지 않는다** — 되돌리는 중에 또 실패하면 더 나쁘다
 *   · 대신 **몇 개 중 몇 개가 반영됐고 어디서 멈췄는지**를 에러에 담는다
 */
const putLinksForEach = async (projects, performances) => {
  const list = Array.isArray(projects) ? projects : [];
  const done = [];

  for (const project of list) {
    const uuid = project?.uuid || project?.id;
    const label = project?.과제명 || uuid || '(이름 없음)';
    if (!uuid) {
      throw new Error(`'${label}' 의 uuid 를 찾을 수 없어 저장을 멈췄습니다.`
                      + ` ${list.length}개 중 ${done.length}개까지 반영됐습니다.`);
    }
    try {
      const res = await putProjectLinksV2(
        uuid, toLinkItems(project[LINK_FIELD], performances),
        { expectedVersion: projectRowVersion(uuid) });
      rememberProjectRowVersion(uuid, res?.rowVersion);
      done.push(label);
    } catch (err) {
      // 아직 하나도 안 보냈고 서버가 꺼져 있을 뿐이면 호출부가 V1 으로 물러설 수 있다.
      // 이미 일부가 반영된 뒤라면 그 길은 막는다 — 절반은 V2, 절반은 V1 이 최악이다.
      if (err?.v2Disabled && done.length === 0) throw err;
      throw new Error(
        `${list.length}개 과제 중 ${done.length}개까지 반영됐고 '${label}' 에서 멈췄습니다`
        + ` (${err.message}). 나머지는 저장되지 않았습니다.`);
    }
  }

  console.info(`[DT] V2 성과 연결 저장 — 과제 ${done.length}건`);
  return { savedProjects: done.length };
};

const patchProjectEditV2 = async ({ project, before, performances, activityLogs,
                                    aiFilled }) => {
  // ⚠️ formData 에는 uuid 가 없다(화이트리스트로 만들어진다). 원본 쪽이 확실하다.
  const uuid = before?.uuid || project?.uuid || project?.id;
  if (!uuid) {
    throw new Error('과제 uuid 를 찾을 수 없어 V2 로 저장할 수 없습니다.');
  }

  // ── ① 성과 연결을 **먼저** 보낸다 ──────────────────────────────────────
  // 저장 한 번이 호출 두 번이 되면서 "절반만 저장된" 상태가 생길 수 있다.
  // 연결을 먼저 보내면 그게 실패했을 때 **아무것도 안 바뀐 채로** 끝난다.
  // 반대 순서였다면 "필드는 저장됐는데 연결은 실패한" 어중간한 상태가 남는다.
  let linkResult = null;
  if (linksReallyChanged(before, project)) {
    linkResult = await putProjectLinksV2(
      uuid, toLinkItems(project?.[LINK_FIELD], performances),
      { expectedVersion: projectRowVersion(uuid) });

    // ⚠️ 연결 저장은 과제의 row_version 을 올린다(`_log_link_change`).
    //    여기서 갱신하지 않으면 **바로 뒤의 필드 PATCH 가 자기 자신 때문에 409** 가 난다.
    rememberProjectRowVersion(uuid, linkResult?.rowVersion);
    console.info(`[DT] V2 성과 연결 저장 — ${(linkResult?.items || []).length}건`);
  }

  // ── ①-b 선행 과제 연결 ─────────────────────────────────────────────────
  // 성과 연결과 같은 이유로 **필드 PATCH 보다 먼저** 보낸다. 서버가 거절할 거리가
  // 많은 쪽이라(순환·자기참조·볼 수 없는 과제) 더더욱 앞에 있어야 한다 —
  // 뒤에 두면 "필드는 저장됐는데 연결만 400" 인 어중간한 상태가 남는다.
  let depResult = null;
  if (depsReallyChanged(before, project)) {
    depResult = await putProjectDependenciesV2(
      uuid, toDepItems(project?.[DEP_FIELD]),
      { expectedVersion: projectRowVersion(uuid) });

    // 연결 저장이 row_version 을 올린다 — 갱신 안 하면 바로 뒤 PATCH 가 409 다.
    rememberProjectRowVersion(uuid, depResult?.rowVersion);
    console.info(`[DT] V2 선행 과제 연결 저장 — ${(depResult?.items || []).length}건`);
  }

  // ── ② 과제 필드 ────────────────────────────────────────────────────────
  const patch = projectPatchFromDiff(before, project);
  if (Object.keys(patch).length === 0) {
    await sendActivityLogs(activityLogs);
    return { applied: [], ignored: [], links: linkResult, dependencies: depResult };
  }

  // AI 도우미가 채운 칸만 골라 함께 보낸다 — **이번 저장에 실제로 실린 것만.**
  // 채워 놓고 사람이 되돌린 칸까지 보내면 이력이 거짓이 된다.
  const aiInPatch = (aiFilled || []).filter(k => Object.prototype.hasOwnProperty.call(patch, k));

  const result = await patchProjectV2(uuid, patch, {
    expectedVersion: projectRowVersion(uuid),
    aiAssisted: aiInPatch,
  });
  rememberProjectRowVersion(uuid, result?.rowVersion);

  // 무엇이 들어갔고 무엇이 안 들어갔는지 항상 눈에 보이게 한다.
  //
  // `반영 0개` 는 **정상일 때가 많다.** 화면이 저장 직전에 타입을 정규화하기 때문에
  // (processFormData: '3' → 3, 배열 → 문자열 등) 실제로는 안 바뀐 필드까지 diff 에
  // 들어온다. 서버는 값이 같으면 건너뛰므로 applied 가 비는 것이다 — 손실이 아니다.
  // 진짜 신호는 `ignored` 다.
  const applied = result?.applied || [];
  const ignored = result?.ignored || [];

  console.info(`[DT] V2 저장 — 반영 ${applied.length}개`
    + (applied.length ? `: ${applied.join(', ')}`
                      : ' (보낸 값이 서버와 같아 바꿀 것이 없었습니다)')
    + ` (row_version=${result?.rowVersion})`);

  // 여기에 뭔가 남아 있으면 우리가 모르는 키다. 관계 키·서버 소유 키는 애초에
  // 안 보내므로 정상이라면 비어 있어야 한다.
  if (ignored.length) {
    console.warn(`[DT] 서버가 건너뛴 키 ${ignored.length}개 — 저장되지 않았습니다: `
                 + ignored.join(', '));
  }

  // 내가 편집하는 동안 남이 **다른 항목**을 바꿔 놓은 경우. 저장은 성공했고 둘 다 살아
  // 있지만, 내 화면은 그 사실을 모른 채였다. 조용히 넘어가면 낡은 값을 보고 판단하게 된다.
  if (result?.mergedWith?.length) {
    console.info(`[DT] 저장하는 동안 다른 사용자가 바꾼 항목: ${result.mergedWith.join(', ')}`
                 + ' (내 변경과 함께 반영됨)');
  }

  await sendActivityLogs(activityLogs);
  return { ...result, links: linkResult, dependencies: depResult };
};

/**
 * 과제 1건 수정.
 *
 * V1 — 전체 배열을 통째로 upsert (지금 사용자들이 쓰는 길)
 * V2 — 바뀐 필드만 `PATCH /projects/<uuid>` (`localStorage.dtV2Write === '1'` 일 때)
 *
 * 성과 연결·선행 과제가 바뀌면 **연결 API 를 먼저** 부르고 그다음 필드를 PATCH 한다
 * (2026-07-30 · 선행 과제는 2026-08-08 합류). 이제 V1 로 물러설 관계 키는 없다
 * (`RELATION_FIELDS_WITHOUT_API` 가 비었다).
 */
const saveProjectEditCore = ({ projects, performances, metadata, activityLogs,
                               project, before, aiFilled }) => {
  const toV1 = () => upsertTracked({ projects, performances, metadata, activityLogs });

  if (!isV2WriteEnabled()) return toV1();

  if (!project || !before) {
    console.warn('[DT] 변경 전/후 과제를 못 받아 V1 로 저장합니다.');
    return toV1();
  }

  // 보낼 길이 없는 관계 키가 바뀌면 그 변경만 조용히 사라지므로 저장 전체를 V1 로
  // 보낸다. **지금은 해당하는 키가 없다** — 성과·선행과제·이미지 모두 길이 생겼다.
  // 분기는 남겨 둔다(다음에 그런 키가 생기면 목록에 한 줄 넣는 것으로 끝난다).
  const relChanged = changedRelations(before, project);
  if (relChanged.length) {
    // 무엇이 달라서 물러섰는지 항상 보이게 한다 — 겉모습 차이를 걸러낸 뒤에도
    // 계속 걸린다면 이 로그가 원인을 가리킨다.
    console.info(`[DT] ${relChanged.join(', ')} 이(가) 바뀐 저장이라 V1 로 보냅니다 (해당 API 미연결).`,
      Object.fromEntries(relChanged.map(f => [f, {
        before: before?.[f], after: project?.[f],
      }])));
    return toV1();
  }

  return patchProjectEditV2({ project, before, performances, activityLogs, aiFilled })
    .catch(err => {
    // 서버에서 V2 쓰기가 아직 안 켜진 경우(503)만 물러선다.
    // 이때는 서버가 요청을 받기도 전에 막았으므로 **아무것도 쓰이지 않았다.**
    // 403·409·400 은 진짜 문제이므로 그대로 올려보낸다 — 조용히 V1 으로 우회하면
    // 권한이나 충돌 문제를 못 보고 넘어간다.
    if (err?.v2Disabled) {
      console.warn('[DT] 서버의 V2 쓰기가 꺼져 있어(503) V1 로 저장합니다. '
                   + 'backend/.env 의 DT2_WRITE_ENABLED 를 확인하세요.');
      return toV1();
    }
    throw err;
  });
};

/**
 * 과제 1건 수정 (바깥 관문). `kpiLinks` 가 있으면 **먼저** 보내고 본 저장으로 넘긴다.
 *
 * 왜 별도 단계인가
 *     DX KPI 연결은 `dt2_project_kpi` 전용 테이블이고 **V1 경로가 전혀 건드리지
 *     않는다.** 그래서 본 저장이 V1 으로 물러서든 V2 로 가든 이 호출은 그대로 유효하다.
 *     반대로 본 저장 안에 넣으면 V1 로 물러서는 순간 KPI 연결만 조용히 사라진다.
 *
 * 왜 먼저인가
 *     성과 연결과 같은 이유다 — 실패하면 **아무것도 안 바뀐 채로** 끝나야 한다.
 *     뒤에 두면 "필드는 저장됐는데 연결은 실패한" 어중간한 상태가 남는다.
 *
 * ⚠️ 화면은 **바뀌었을 때만** `kpiLinks` 를 싣는다. 매번 보내면 내용이 같아도
 *    행 락을 잡고 지나가고, 무엇보다 저장할 때마다 불필요한 왕복이 하나 늘어난다.
 */
export const saveProjectEdit = async ({ kpiLinks, ...args }) => {
  if (Array.isArray(kpiLinks)) {
    const uuid = args.before?.uuid || args.project?.uuid || args.project?.id;
    if (!uuid) {
      console.warn('[DT] 과제 uuid 를 찾을 수 없어 DX KPI 연결을 저장하지 못했습니다.');
    } else {
      let result;
      try {
        result = await putProjectKpiLinksV2(
          uuid, kpiLinks, { expectedVersion: projectRowVersion(uuid) });
      } catch (err) {
        // 503(서버 V2 쓰기 꺼짐)이어도 **V1 로 물러서지 않는다.** 물러설 곳이 없다 —
        // KPI 연결은 dt2 전용 테이블이라 V1 upsert 가 이 값을 담지 못한다.
        // 여기서 조용히 넘어가면 화면엔 '저장됨' 이 뜨는데 연결만 사라진다.
        if (err?.v2Disabled) {
          err.message = 'DX KPI 연결을 저장하려면 서버의 V2 쓰기가 켜져 있어야 합니다 '
                      + '(backend/.env 의 DT2_WRITE_ENABLED). 저장을 중단했습니다.';
        }
        throw err;
      }
      // ⚠️ 연결 저장이 과제의 row_version 을 올린다(`_log_link_change`).
      //    갱신하지 않으면 **바로 뒤의 필드 PATCH 가 자기 자신 때문에 409** 가 난다.
      rememberProjectRowVersion(uuid, result?.rowVersion);
      console.info(`[DT] DX KPI 연결 저장 — ${(result?.items || []).length}건`);
    }
  }
  return saveProjectEditCore(args);
};

/**
 * 액션아이템·액티비티의 생성 날짜 일괄 채우기(관리자 도구).
 *
 * V1 — 전체 배열 upsert
 * V2 — **바뀐 과제만** 골라 PATCH 반복 (일괄추가와 같은 순차 정책)
 *
 * 이걸 V1 에 두면 컷오버 후 **조용한 거짓말**이 된다 — 화면엔 성공이라 뜨는데
 * 낡은 V1 에만 쓰이고 dt2 에는 아무것도 안 들어간다. 관리자는 채웠다고 믿는다.
 */
export const saveCreatedAtBackfill = ({ projects, performances, metadata, activityLogs,
                                        beforeProjects }) => {
  const toV1 = () => upsertTracked({ projects, performances, metadata, activityLogs });

  if (!isV2WriteEnabled()) return toV1();

  if (!beforeProjects) {
    console.warn('[DT] 변경 전 과제 목록을 못 받아 V1 로 저장합니다.');
    return toV1();
  }

  const blockers = bulkBlockers(projects, beforeProjects);
  if (blockers.length) {
    console.info(`[DT] ${blockers.join(', ')} 이(가) 섞여 있어 V1 로 보냅니다 (해당 API 미연결).`);
    return toV1();
  }

  // 성과는 바뀌지 않는다 — before/after 를 같은 배열로 줘서 성과 단계가 안 생기게 한다.
  // (그래도 넘기는 이유는 연결 참조를 uuid 로 푸는 데 쓰이기 때문이다)
  return bulkSaveV2({ projects, performances,
                      beforeProjects, beforePerformances: performances })
    .then(async result => {
      await sendActivityLogs(activityLogs);
      return result;
    })
    .catch(err => {
      if (err?.v2Disabled) {
        console.warn('[DT] 서버의 V2 쓰기가 꺼져 있어(503) V1 로 저장합니다.');
        return toV1();
      }
      throw err;
    });
};

/**
 * 설정에서 분류 이름을 바꿨을 때의 뒤처리(캐스케이드)를 서버까지 보낸다.
 *
 * 왜 필요한가
 *     과제는 사업부·프로세스·과제구분·부서를 **id 가 아니라 이름 문자열로 복사해서**
 *     들고 있다(V1 계약을 그대로 이어받았다 — `permissions.py:resolve_division_id` 주석).
 *     그래서 설정에서 이름을 바꾸면 화면이 모든 과제의 그 문자열을 새 이름으로 바꿔주는데,
 *     그 결과가 **로컬(IndexedDB)에서 멈춰 있었다.**
 *
 *     V1 에서는 그 뒤 아무 과제나 저장하면 전체 배열 upsert 에 **편승해서** 우연히
 *     반영됐다. V2 는 그 과제의 diff 만 보내므로 편승할 자리가 없다 — 새로고침하면
 *     옛 이름이 돌아온다 (2026-07-31 재현 확정).
 *
 * V1 — **아무것도 보내지 않는다.** 지금 동작 그대로다. 컷오버 직전에 운영 경로의 동작을
 *      바꾸지 않으려는 것이고, V1 은 예전처럼 다음 저장에 편승한다. 이 함수가 V1 에서
 *      조용히 no-op 인 것은 의도다.
 * V2 — `bulkSaveV2` 로 **이름이 바뀐 과제만** 골라 순차 PATCH (일괄추가와 같은 정책).
 *
 * 사업부에는 덤이 하나 더 있다. 서버가 `division` 을 받을 때마다 `division_id` 를 다시
 * 풀어주므로(routes_v2 의 단일 관문), 이 전송이 **manager 편집 권한까지 복구한다.**
 * 안 보내면 컷오버 후 그 사업부 manager 가 자기 과제를 못 고친다.
 *
 * ⚠️ 이력은 늘지 않는다 — `record_project_history` 는 진척 지표(status·progress·기간·
 *    건수)만 해싱하고 값이 같으면 행을 안 쓴다. 이름 변경은 그 필드를 안 건드린다.
 */
export const saveSettingsRename = ({ projects, performances, beforeProjects }) => {
  const nothingSent = { skipped: true, saved: 0, total: 0 };

  if (!isV2WriteEnabled()) {
    console.info('[DT] 설정 이름 변경은 V1 에서 서버로 보내지 않습니다 (기존 동작 유지).');
    return Promise.resolve(nothingSent);
  }

  if (!beforeProjects) {
    console.warn('[DT] 변경 전 과제 목록을 못 받아 이름 변경을 서버에 반영하지 못했습니다.');
    return Promise.resolve(nothingSent);
  }

  // 성과는 바뀌지 않는다 — before/after 를 같은 배열로 줘서 성과 단계가 안 생기게 한다.
  // (그래도 넘기는 이유는 연결 참조를 uuid 로 푸는 데 쓰이기 때문이다)
  return bulkSaveV2({ projects, performances,
                      beforeProjects, beforePerformances: performances })
    .catch(err => {
      // 서버 쓰기가 꺼져 있을 뿐이면(503) 아무것도 안 쓰였다. V1 과 같은 상태이므로
      // 실패로 올리지 않는다 — 올려봐야 사용자가 할 수 있는 일이 없다.
      if (err?.v2Disabled) {
        console.warn('[DT] 서버의 V2 쓰기가 꺼져 있어(503) 이름 변경을 서버에 반영하지 못했습니다.');
        return nothingSent;
      }
      throw err;
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// 저장 — 성과 · 연결
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 성과에서 서버로 보내지 않는 키.
 *   linkedProjects  파생 캐시. 정본은 과제의 성과목록이다
 *   isEditing 등    UI 임시값. 이관이 extra_fields 에 보존해 뒀고 PATCH 로는 못 고친다
 *   isFromSample    샘플 데이터 표식. 서버에서 **의도적으로 불변**이고(사용자가 바꿀 값이
 *                   아니다) 모델 기본값이 false 라, 보내봐야 같은 값이면서 경고만 남는다
 */
const PERF_SKIP_ON_SEND = [
  'linkedProjects', 'isEditing', '_idChanged', 'isFromSample', ...SERVER_OWNED,
];

const savePerformanceEditV2 = async ({ performance, before, activityLogs }) => {
  // ── 수정 ────────────────────────────────────────────────────────────────
  if (before) {
    const uuid = before?.uuid || performance?.uuid;
    if (!uuid) throw new Error('성과 uuid 를 찾을 수 없어 V2 로 저장할 수 없습니다.');

    const diff = extractChanges(before, performance);
    const patch = {};
    Object.keys(diff).forEach(key => {
      if (PERF_SKIP_ON_SEND.includes(key)) return;
      patch[key] = diff[key].after;
    });

    if (Object.keys(patch).length === 0) {
      await sendActivityLogs(activityLogs);
      return { applied: [], ignored: [] };
    }

    const result = await patchPerformanceV2(uuid, patch,
                                            { expectedVersion: performanceRowVersion(uuid) });
    rememberPerformanceRowVersion(uuid, result?.rowVersion);
    const applied = result?.applied || [];
    const ignored = result?.ignored || [];

    console.info(`[DT] V2 성과 수정 — 반영 ${applied.length}개`
      + (applied.length ? `: ${applied.join(', ')}` : ' (보낸 값이 서버와 같았습니다)')
      // 성과 수정은 **남의 과제 숫자까지 바꾼다.** 파급을 항상 같이 보여준다.
      + (result?.affectedProjects ? ` · 이 성과를 쓰는 과제 ${result.affectedProjects}건` : ''));
    if (ignored.length) {
      console.warn(`[DT] 서버가 건너뛴 키 ${ignored.length}개 — 저장되지 않았습니다: `
                   + ignored.join(', '));
    }
    await sendActivityLogs(activityLogs);
    return result;
  }

  // ── 생성 ────────────────────────────────────────────────────────────────
  const fields = {};
  Object.keys(performance || {}).forEach(key => {
    if (PERF_SKIP_ON_SEND.includes(key)) return;
    fields[key] = performance[key];
  });

  const result = await createPerformanceV2(fields);
  rememberPerformanceRowVersion(result?.uuid, result?.rowVersion);
  console.info(`[DT] V2 성과 생성 완료 — uuid=${result?.uuid} code=${result?.code ?? '-'}`);
  if (result?.ignored?.length) {
    console.warn(`[DT] 생성에서 서버가 건너뛴 키 ${result.ignored.length}개: `
                 + result.ignored.join(', '));
  }
  await sendActivityLogs(activityLogs);
  return result;
};

/**
 * 성과 항목 신규/수정.
 *
 * V1 — 전체 배열 upsert (성과 id 가 바뀌면 과제 배열도 함께 간다)
 * V2 — `POST`/`PATCH /performances`
 *
 * **성과 id 변경은 V2 로 보낼 수 없다.** `code` 는 불변이다 — 식별자가 바뀌면
 * 그 성과를 가리키는 과제들의 참조가 한꺼번에 깨지기 때문이다. 그런 수정만 V1 로
 * 물러선다. (컷오버 후에는 id 변경 자체가 불가능해진다 — 공지 대상)
 */
export const savePerformanceEdit = ({ projects, performances, metadata, activityLogs,
                                      performance, before, idChanged }) => {
  const toV1 = () => upsertTracked({ projects, performances, metadata, activityLogs });

  if (!isV2WriteEnabled()) return toV1();

  if (!performance) {
    console.warn('[DT] 성과 객체를 못 받아 V1 로 저장합니다.');
    return toV1();
  }

  if (idChanged) {
    console.info('[DT] 성과 ID 를 바꾸는 수정이라 V1 로 보냅니다 (V2 에서 code 는 불변).');
    return toV1();
  }

  return savePerformanceEditV2({ performance, before, activityLogs }).catch(err => {
    if (err?.v2Disabled) {
      console.warn('[DT] 서버의 V2 쓰기가 꺼져 있어(503) V1 로 저장합니다.');
      return toV1();
    }
    throw err;
  });
};

/**
 * 기여도 일괄 수정. **바뀐 과제만** 보낸다.
 *
 * V1 — 부분 배열 upsert (머지 성질을 이용)
 * V2 — 과제마다 `PUT /projects/<uuid>/performances` 를 **순차로** (putLinksForEach 참조)
 */
export const saveContributions = ({ projects, performances, activityLogs }) => {
  const toV1 = () => upsertUntracked({ projects, activityLogs });

  if (!isV2WriteEnabled()) return toV1();

  return putLinksForEach(projects, performances)
    .then(async result => {
      await sendActivityLogs(activityLogs);
      return result;
    })
    .catch(err => {
      if (err?.v2Disabled) {
        console.warn('[DT] 서버의 V2 쓰기가 꺼져 있어(503) V1 로 저장합니다.');
        return toV1();
      }
      throw err;
    });
};

/** 성과 화면에서 과제 연결을 바꿨을 때. 여기도 바뀐 과제만, 방식은 위와 같다. */
export const saveProjectPerformanceLinks = ({ projects, performances }) => {
  const toV1 = () => upsertUntracked({ projects });

  if (!isV2WriteEnabled()) return toV1();

  return putLinksForEach(projects, performances).catch(err => {
    if (err?.v2Disabled) {
      console.warn('[DT] 서버의 V2 쓰기가 꺼져 있어(503) V1 로 저장합니다.');
      return toV1();
    }
    throw err;
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// 저장 — 일괄 · 수동
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 일괄 추가 — 한 번의 저장이 여러 종류의 호출이 된다
// ─────────────────────────────────────────────────────────────────────────────

const indexByKey = (list) => {
  const map = new Map();
  for (const item of (Array.isArray(list) ? list : [])) {
    if (item?.uuid) map.set(item.uuid, item);
    if (item?.id) map.set(String(item.id), item);
  }
  return map;
};

const lookupBefore = (map, item) =>
  (item?.uuid && map.get(item.uuid)) || (item?.id && map.get(String(item.id))) || null;

/** 성과에서 서버로 보낼 만한 변화가 있는가. */
const performanceChanged = (before, after) => {
  const diff = extractChanges(before, after);
  return Object.keys(diff).some(key => !PERF_SKIP_ON_SEND.includes(key));
};

/**
 * 일괄 저장을 **보내기 전에** 전부 훑어 "V2 로 보낼 수 있는 일인가" 를 본다.
 *
 * 절반 보내고 나서 못 보내는 항목을 발견하면 되돌릴 방법이 없다. 그래서 검사가 먼저다.
 * 보낼 수 없는 게 하나라도 있으면 **아무것도 보내지 않고** 전체를 V1 로 넘긴다.
 */
const bulkBlockers = (projects, beforeProjects) => {
  const beforeMap = indexByKey(beforeProjects);
  const blockers = new Set();
  for (const project of (Array.isArray(projects) ? projects : [])) {
    const before = lookupBefore(beforeMap, project);
    const fields = before
      ? changedRelations(before, project)
      : RELATION_FIELDS_WITHOUT_API.filter(f => !isEmptyish(project[f]));
    fields.forEach(f => blockers.add(f));
  }
  return [...blockers];
};

const bulkSaveV2 = async ({ projects, performances, beforeProjects, beforePerformances }) => {
  const beforePerfMap = indexByKey(beforePerformances);
  const beforeProjMap = indexByKey(beforeProjects);
  const steps = [];

  // ① 성과를 **먼저** — 새 과제가 새 성과를 참조할 수 있고, 연결은 성과가 있어야 걸린다.
  for (const performance of (Array.isArray(performances) ? performances : [])) {
    const before = lookupBefore(beforePerfMap, performance);
    const label = `성과 '${performance?.성과항목 || performance?.uuid || performance?.id}'`;
    if (!before) {
      steps.push({ label: `${label} 생성`,
                   run: () => savePerformanceEditV2({ performance }) });
    } else if (performanceChanged(before, performance)) {
      steps.push({ label: `${label} 수정`,
                   run: () => savePerformanceEditV2({ performance, before }) });
    }
  }

  // ② 과제 — 생성은 만든 뒤 연결, 수정은 연결 먼저 (각 함수가 그 순서를 지킨다)
  for (const project of (Array.isArray(projects) ? projects : [])) {
    const before = lookupBefore(beforeProjMap, project);
    const label = `과제 '${project?.과제명 || project?.uuid || project?.id}'`;
    if (!before) {
      steps.push({ label: `${label} 생성`,
                   run: () => createProjectFlowV2({ project, performances }) });
    } else if (Object.keys(projectPatchFromDiff(before, project)).length
               || linksReallyChanged(before, project)
               // ⚠️ 관계 키는 `projectPatchFromDiff` 에서 빠지므로 **여기 없으면
               //    그것만 바뀐 과제는 단계 자체가 안 만들어져 조용히 사라진다.**
               //    관계 API 를 하나 붙일 때마다 이 줄도 같이 늘려야 한다.
               || depsReallyChanged(before, project)) {
      steps.push({ label: `${label} 수정`,
                   run: () => patchProjectEditV2({ project, before, performances }) });
    }
  }

  if (!steps.length) {
    console.info('[DT] V2 일괄 저장 — 바뀐 항목이 없습니다.');
    return { saved: 0, total: 0 };
  }

  // 순차 · 첫 실패에서 중단 · 되돌리지 않음 (putLinksForEach 와 같은 정책)
  const done = [];
  for (const step of steps) {
    try {
      await step.run();
      done.push(step.label);
    } catch (err) {
      if (err?.v2Disabled && done.length === 0) throw err;
      throw new Error(
        `${steps.length}개 항목 중 ${done.length}개까지 반영됐고 ${step.label} 에서 멈췄습니다`
        + ` (${err.message}). 나머지는 저장되지 않았습니다.`);
    }
  }

  console.info(`[DT] V2 일괄 저장 — ${done.length}건 반영`);
  return { saved: done.length, total: steps.length };
};

/**
 * 일괄 추가 모달. 과제·성과가 한 번에 간다.
 *
 * V1 — 전체 배열 upsert 한 번
 * V2 — **바뀐 것만 골라** 성과 → 과제 순으로 순차 호출
 *
 * `settings` 는 V1 서버도 이 페이로드에서 읽지 않는다(설정은 별도 API). `metadata` 는
 * V2 가 **의도적으로 받지 않는다** — 개수는 파생이고 화면 취향은 사용자별이라,
 * 저장할 때마다 전역 metadata 를 덮던 버그를 그렇게 고쳤다.
 */
export const saveBulkAdd = ({ projects, performances, settings, metadata, activityLogs,
                              beforeProjects, beforePerformances }) => {
  const toV1 = () =>
    upsertUntracked({ projects, performances, settings, metadata, activityLogs });

  if (!isV2WriteEnabled()) return toV1();

  if (!beforeProjects || !beforePerformances) {
    console.warn('[DT] 변경 전 목록을 못 받아 V1 로 저장합니다.');
    return toV1();
  }

  const blockers = bulkBlockers(projects, beforeProjects);
  if (blockers.length) {
    console.info(`[DT] ${blockers.join(', ')} 이(가) 섞여 있어 일괄 저장을 V1 로 보냅니다 (해당 API 미연결).`);
    return toV1();
  }

  return bulkSaveV2({ projects, performances, beforeProjects, beforePerformances })
    .then(async result => {
      await sendActivityLogs(activityLogs);
      return result;
    })
    .catch(err => {
      if (err?.v2Disabled) {
        console.warn('[DT] 서버의 V2 쓰기가 꺼져 있어(503) V1 로 저장합니다.');
        return toV1();
      }
      throw err;
    });
};

/**
 * 수동 "서버 업로드" 모달 — 업데이트 모드.
 *
 * 호출부가 version·스냅샷·forceUpload 까지 직접 조립해 넘긴다(모달이 서버 버전을
 * 따로 조회해 쓰기 때문에 여기서 localStorage 를 읽으면 안 된다).
 *
 * V2 에는 대응이 없다 — 전체 스냅샷 업로드라는 개념 자체가 사라진다.
 */
export const saveManualUpsert = async (payload) =>
  rememberVersion(await upsertServerData(payload));

/**
 * 수동 "서버 업로드" 모달 — 덮어쓰기 모드(`/data/upload`).
 *
 * ⚠️ `forceUpload` 가 켜져 있으면 남의 최신 과제까지 통째로 날릴 수 있다
 *    (실행계획 1-5, 고아 첨부의 유력 원인). 방어는 별건으로 잡혀 있고,
 *    여기서는 경로를 한곳에 모아 두는 것까지만 한다.
 */
export const saveManualOverwrite = async (payload) =>
  rememberVersion(await uploadServerData(payload));

// ─────────────────────────────────────────────────────────────────────────────
// 삭제 · 복구 — 이미 "1건" 단위라 V2 대응이 1:1 이다
//
//   softDeleteProject       → POST   /api/dt-v2/projects/<uuid>/delete
//   restoreProject          → POST   /api/dt-v2/projects/<uuid>/restore
//   permanentDeleteProject  → DELETE /api/dt-v2/projects/<uuid>
//   deletePerformanceApi    → DELETE /api/dt-v2/performances/<uuid>
//
// ⚠️ **영구삭제는 V2 에서 admin·dt_office 만 가능하다.** V1 은 로그인만 하면 남의 과제도
//    영구삭제할 수 있었다(권한 검사가 없었다). 되돌릴 방법이 없는 조작이라 Phase 3 가
//    의도적으로 좁힌 것이다. 그래서 일반 사용자는 V2 에서 403 을 받는다 — 버그가 아니다.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 로컬 전역 version 을 +1 로 **추정**한다.
 *
 * V1 삭제·복구 엔드포인트는 새 version 을 돌려주지 않아 호출부가 이렇게 해왔다.
 * 그 추정을 어댑터로 가져온 이유는 **V2 경로에서는 하면 안 되기 때문**이다 —
 * 전역 version 이라는 개념 자체가 없고, 괜히 올리면 나중에 V1 로 물러설 때 어긋난다.
 */
const bumpLocalVersion = () => {
  const stored = localStorage.getItem(VERSION_KEY);
  localStorage.setItem(VERSION_KEY, String(stored ? parseInt(stored) + 1 : 1));
};

/**
 * V2 를 먼저 시도하고, **서버가 아직 안 켜진 경우(503)만** V1 로 물러선다.
 * 403·404·400 은 그대로 올려보낸다 — 권한이나 상태 문제를 우회하면 안 된다.
 */
const tryV2ThenV1 = async (v2Call, v1Call, what) => {
  if (isV2WriteEnabled()) {
    try {
      return await v2Call();
    } catch (err) {
      if (!err?.v2Disabled) throw err;
      console.warn(`[DT] 서버의 V2 쓰기가 꺼져 있어(503) V1 로 ${what}합니다.`);
    }
  }
  return v1Call();
};

export const softDeleteProject = (projectUuid) => tryV2ThenV1(
  async () => {
    const result = await softDeleteProjectV2(projectUuid);
    rememberProjectRowVersion(projectUuid, result?.rowVersion);
    console.info(`[DT] V2 과제 삭제 — row_version=${result?.rowVersion}`);
    return result;
  },
  async () => {
    const result = await softDeleteProjectRequest(projectUuid);
    bumpLocalVersion();
    return result;
  },
  '삭제',
);

export const restoreProject = (projectUuid) => tryV2ThenV1(
  async () => {
    const result = await restoreProjectV2(projectUuid);
    rememberProjectRowVersion(projectUuid, result?.rowVersion);
    console.info(`[DT] V2 과제 복구 — row_version=${result?.rowVersion}`);
    return result;
  },
  async () => {
    const result = await restoreProjectRequest(projectUuid);
    bumpLocalVersion();
    return result;
  },
  '복구',
);

export const permanentDeleteProject = (projectUuid) => tryV2ThenV1(
  async () => {
    const result = await permanentDeleteProjectV2(projectUuid);
    console.info('[DT] V2 과제 영구삭제 완료');
    return result;
  },
  async () => {
    const result = await permanentDeleteProjectRequest(projectUuid);
    bumpLocalVersion();
    return result;
  },
  '영구삭제',
);

/**
 * 연도별 과제 일괄 삭제. **V1 대응이 없다 — 물러설 곳이 없는 유일한 저장 경로다.**
 *
 * 다른 삭제들은 `tryV2ThenV1` 로 503 일 때 V1 로 물러서지만 이건 그럴 수 없다.
 * V1 에서 같은 일을 하려면 화면의 전체 배열을 통째로 덮어써야 하는데(옛 '서버에 저장'),
 * 그 경로가 남의 최신 과제까지 날릴 수 있어서 컷오버 때 내린 것이다.
 * **되살릴 바에는 명확히 실패하는 편이 낫다.** 그래서 503 을 그대로 올려보낸다.
 */
export const saveBulkYearDelete = async ({ years, expectedCount, reason }) => {
  if (!isV2WriteEnabled()) {
    const error = new Error(
      '연도별 일괄 삭제는 V2 저장이 켜져 있어야 씁니다. 관리자에게 문의하세요.');
    error.v2Disabled = true;
    throw error;
  }
  const result = await bulkDeleteProjectsByYearV2({ years, expectedCount, reason });

  // 지워진 과제들의 row_version 을 서버가 올렸다. 낡은 값을 들고 있으면 복구 직후의
  // 저장이 엉뚱하게 409 가 나므로 기억에서 지운다(성과 삭제의 unlinkedProjects 와 같은 이유).
  (result?.projects || []).forEach(p => forgetProjectRowVersion(p?.uuid));
  console.info(`[DT] V2 연도별 일괄 삭제 — ${result?.count || 0}건`
               + ` (${(result?.years || []).join(', ')})`);
  return result;
};

/** 위 일괄 삭제의 짝. 같은 이유로 V1 로 물러서지 않는다. */
export const saveBulkYearRestore = async ({ years, reason }) => {
  if (!isV2WriteEnabled()) {
    const error = new Error(
      '연도별 일괄 복구는 V2 저장이 켜져 있어야 씁니다. 관리자에게 문의하세요.');
    error.v2Disabled = true;
    throw error;
  }
  const result = await bulkRestoreProjectsByYearV2({ years, reason });
  (result?.projects || []).forEach(p => forgetProjectRowVersion(p?.uuid));
  console.info(`[DT] V2 연도별 일괄 복구 — ${result?.count || 0}건`
               + ` (${(result?.years || []).join(', ')})`);
  return result;
};

/** 성과 전체 삭제가 건드릴 대상 수. 확인 모달이 열릴 때 부른다. */
export const fetchPerformanceDeleteSummary = () => fetchPerformanceDeleteSummaryV2();

/**
 * 성과 전체 삭제. **admin 전용 · V1 대응 없음.**
 *
 * 옛 '전체 삭제'는 로컬 사본만 비우고 "삭제되었습니다" 라고 말했다 — 새로고침하면
 * 서버에서 다시 내려와 되살아났다. 이제 서버를 지운다.
 *
 * V1 로 물러서지 않는 이유는 연도별 일괄 삭제와 같다 — V1 에서 같은 일을 하려면
 * 전체 배열을 통째로 덮어써야 하는데 그 경로가 남의 최신 데이터까지 날린다.
 * **되살릴 바에는 명확히 실패하는 편이 낫다.**
 */
export const saveBulkPerformanceDelete = async ({ expectedCount, reason }) => {
  if (!isV2WriteEnabled()) {
    const error = new Error(
      '성과 전체 삭제는 V2 저장이 켜져 있어야 씁니다. 관리자에게 문의하세요.');
    error.v2Disabled = true;
    throw error;
  }
  const result = await bulkDeletePerformancesV2({ expectedCount, reason });

  // 연결이 끊긴 과제들의 row_version 을 서버가 올렸다. 낡은 값을 들고 있으면
  // 다음 저장이 엉뚱하게 409 가 난다(단건 성과 삭제와 같은 이유).
  (result?.unlinkedProjects || []).forEach(p => forgetProjectRowVersion(p?.uuid));
  console.info(`[DT] V2 성과 전체 삭제 — ${result?.count || 0}건`
               + `, 연결이 해제된 과제 ${result?.affectedProjectCount || 0}건`);
  return result;
};

export const deletePerformanceApi = (performanceUuid) => tryV2ThenV1(
  async () => {
    const result = await deletePerformanceV2(performanceUuid);
    // 성과 삭제는 **남의 과제에서도** 그 성과를 뺀다. 어디가 영향받았는지 알려준다.
    const unlinked = result?.unlinkedProjects || [];

    // 그 과제들의 row_version 도 서버가 올렸는데 응답은 새 값을 주지 않는다.
    // 낡은 값을 들고 있으면 다음 저장이 엉뚱하게 409 가 나므로 지워둔다.
    unlinked.forEach(p => forgetProjectRowVersion(p?.uuid));
    console.info(`[DT] V2 성과 삭제 — 연결이 해제된 과제 ${unlinked.length}건`
                 + (unlinked.length ? `: ${unlinked.map(p => p.code || p.uuid).join(', ')}` : ''));
    return result;
  },
  () => deletePerformanceRequest(performanceUuid),
  '성과 삭제',
);
