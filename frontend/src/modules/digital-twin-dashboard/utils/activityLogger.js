/**
 * 액티비티 로그 시스템
 * - 프로젝트/성과 데이터 변경 이력 기록
 * - 나중에 백엔드 DB로 마이그레이션 가능한 구조
 */

import { todayLocalYmd } from '../../../shared/utils/localDate';

// ============== 상수 정의 ==============

export const LOG_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  BULK_CREATE: 'BULK_CREATE',
  BULK_UPDATE: 'BULK_UPDATE',
  BULK_DELETE: 'BULK_DELETE',
  IMPORT: 'IMPORT',
  EXPORT: 'EXPORT',
  SERVER_UPLOAD: 'SERVER_UPLOAD',
  SERVER_DOWNLOAD: 'SERVER_DOWNLOAD',
  SERVER_SYNC: 'SERVER_SYNC'
};

export const TARGET_TYPES = {
  PROJECT: 'PROJECT',
  PERFORMANCE: 'PERFORMANCE',
  ACTION_ITEM: 'ACTION_ITEM',
  TEAM_MEMBER: 'TEAM_MEMBER',
  SETTINGS: 'SETTINGS'
};

export const LOG_SOURCES = {
  SINGLE_EDIT: 'single_edit',      // 개별 수정
  BULK_EDIT: 'bulk_edit',          // 벌크 수정
  IMPORT: 'import',                // 데이터 가져오기
  MODAL: 'modal',                  // 모달에서 수정
  INLINE: 'inline'                 // 인라인 수정
};

// localStorage 키
const STORAGE_KEY = 'digitalTwinDashboard_activityLogs';
const MAX_LOGS_IN_STORAGE = 1000; // 최대 저장 개수

// ============== 필드 레이블 매핑 (UI 표시용) ==============

const FIELD_LABELS = {
  // 프로젝트 필드
  과제명: '과제명',
  사업부: '사업부',
  프로세스: '프로세스',
  과제영역: '과제영역',
  과제구분: '과제구분',
  시작: '시작월',
  종료: '종료월',
  진행상태: '진행상태',
  과제PL: '과제 PL',
  작성자: '작성자',
  과제상세설명: '과제 상세설명',
  PoC과제여부: 'PoC 과제 여부',
  중점과제여부: '중점 과제 여부',
  과제년도: '과제년도',

  // 성과 필드
  성과항목: '성과항목',
  성과년도: '성과년도',
  대분류: '대분류',
  소분류: '소분류',
  단위: '단위',
  현재수준: '현재수준',
  목표수준: '목표수준',
  실적수준: '실적수준',
  월별실적여부: '월별실적여부',
  월별실적: '월별실적',
  설명: '설명',

  // 기타
  성과목록: '연결된 성과',
  액션아이템목록: '액션 아이템',
  과제참여인력목록: '참여 인력',
  담당부서목록: '담당 부서',

  // 서버 관련
  version: '버전',
  projectCount: '과제 수',
  performanceCount: '성과 수',
  uploadedProjects: '업로드된 과제',
  uploadedPerformances: '업로드된 성과',
  downloadedProjects: '다운로드된 과제',
  downloadedPerformances: '다운로드된 성과',
  uploadMode: '업로드 모드',
  includeSnapshot: '스냅샷 포함',
  snapshotName: '스냅샷 이름',
  contributionUpdates: '기여도 수정',
  updatedProjects: '수정된 과제',
  uploadedProject: '업로드된 과제',
  uploadedPerformance: '업로드된 성과'
};

// ============== UUID 생성 ==============

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// ============== 현재 사용자 정보 가져오기 ==============

/**
 * localStorage에서 현재 로그인한 사용자 정보 가져오기
 */
const getCurrentUser = () => {
  try {
    // 'authUser' 키로 저장된 사용자 정보 가져오기
    const userData = localStorage.getItem('authUser');
    if (userData) {
      const user = JSON.parse(userData);
      return {
        userId: user.id || user.username || user.email || 'unknown',
        userName: user.name || user.username || user.email || '익명'
      };
    }
  } catch (error) {
    console.warn('사용자 정보 가져오기 실패:', error);
  }

  return {
    userId: 'system',
    userName: 'System'
  };
};

// ============== Summary 생성 헬퍼 ==============

/**
 * 로그 데이터로부터 한글 summary 문장 생성
 */
const generateLogSummary = (log) => {
  const { userName, action, targetType, targetName, changes } = log;

  // 대상 타입 한글 변환
  const targetTypeLabel = {
    [TARGET_TYPES.PROJECT]: '과제',
    [TARGET_TYPES.PERFORMANCE]: '성과',
    [TARGET_TYPES.ACTION_ITEM]: '액션 아이템',
    [TARGET_TYPES.TEAM_MEMBER]: '팀 멤버',
    [TARGET_TYPES.SETTINGS]: '설정'
  }[targetType] || '항목';

  // 대상 표시
  const targetDisplay = targetName ? `"${targetName}"` : '';

  // 액션아이템은 상위 과제 정보를 함께 표시
  const parentProjectName = log.metadata?.parentProjectName;
  const parentSuffix = (targetType === TARGET_TYPES.ACTION_ITEM && parentProjectName)
    ? ` (과제: "${parentProjectName}")`
    : '';

  // 액션별 문장 생성
  switch (action) {
    case LOG_ACTIONS.CREATE:
      return `${userName}이(가) ${targetTypeLabel} ${targetDisplay}을(를) 생성함${parentSuffix}`;

    case LOG_ACTIONS.DELETE:
      return `${userName}이(가) ${targetTypeLabel} ${targetDisplay}을(를) 삭제함${parentSuffix}`;

    case LOG_ACTIONS.UPDATE:
      // 변경된 필드 목록 추출
      if (changes && Object.keys(changes).length > 0) {
        const changedFields = Object.keys(changes)
          .filter(key => changes[key] && (changes[key].before !== undefined || changes[key].after !== undefined))
          .map(key => FIELD_LABELS[key] || key)
          .slice(0, 3);

        if (changedFields.length > 0) {
          const moreCount = Object.keys(changes).length - changedFields.length;
          const moreText = moreCount > 0 ? ` 외 ${moreCount}개` : '';
          return `${userName}이(가) ${targetTypeLabel} ${targetDisplay}의 ${changedFields.join(', ')}${moreText}을(를) 수정함`;
        }
      }
      return `${userName}이(가) ${targetTypeLabel} ${targetDisplay}을(를) 수정함`;

    case LOG_ACTIONS.BULK_UPDATE:
      return `${userName}이(가) ${targetTypeLabel} 여러 항목을 일괄 수정함`;

    case LOG_ACTIONS.SERVER_UPLOAD:
      return `${userName}이(가) ${targetTypeLabel} ${targetDisplay}을(를) 서버에 업로드함`;

    case LOG_ACTIONS.SERVER_DOWNLOAD:
      return `${userName}이(가) 서버에서 데이터를 불러옴`;

    default:
      return `${userName}이(가) ${targetTypeLabel} ${targetDisplay}에 대한 작업을 수행함`;
  }
};

// ============== 로그 저장 ==============

/**
 * 액티비티 로그 저장
 * @param {Object} logData - 로그 데이터
 * @param {string} logData.action - 작업 유형 (CREATE, UPDATE, DELETE 등)
 * @param {string} logData.targetType - 대상 타입 (PROJECT, PERFORMANCE 등)
 * @param {string} logData.targetId - 대상 ID
 * @param {string} logData.targetUuid - 대상 UUID
 * @param {string} logData.targetName - 대상 이름
 * @param {Object} logData.changes - 변경 내용 { fieldName: { before, after } }
 * @param {Object} logData.metadata - 추가 메타데이터
 */
export const logActivity = (logData) => {
  try {
    const user = getCurrentUser();

    const logEntry = {
      logId: generateUUID(),
      timestamp: new Date().toISOString(),
      userId: user.userId,
      userName: user.userName,
      action: logData.action,
      targetType: logData.targetType,
      targetId: logData.targetId || '',
      targetUuid: logData.targetUuid || '',
      targetName: logData.targetName || '',
      changes: logData.changes || {},
      metadata: {
        source: logData.source || LOG_SOURCES.SINGLE_EDIT,
        userAgent: navigator.userAgent,
        ...logData.metadata
      }
    };

    // summary 자동 생성 (logToSentence 사용)
    logEntry.summary = generateLogSummary(logEntry);

    // localStorage에서 기존 로그 가져오기
    const logs = getLogs();

    // 새 로그 추가
    logs.unshift(logEntry); // 최신 로그가 앞에 오도록

    // 최대 개수 제한
    const trimmedLogs = logs.slice(0, MAX_LOGS_IN_STORAGE);

    // 저장
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedLogs));

    console.log('📝 액티비티 로그 저장:', logEntry);

    return logEntry;
  } catch (error) {
    console.error('❌ 액티비티 로그 저장 실패:', error);
    return null;
  }
};

// ============== 로그 조회 ==============

/**
 * 모든 로그 가져오기
 */
export const getLogs = () => {
  try {
    const logsStr = localStorage.getItem(STORAGE_KEY);
    return logsStr ? JSON.parse(logsStr) : [];
  } catch (error) {
    console.error('로그 조회 실패:', error);
    return [];
  }
};

/**
 * 필터링된 로그 가져오기
 * @param {Object} filters - 필터 조건
 * @param {string} filters.userId - 사용자 ID
 * @param {string} filters.targetType - 대상 타입
 * @param {string} filters.targetId - 대상 ID
 * @param {string} filters.action - 작업 유형
 * @param {Date} filters.startDate - 시작 날짜
 * @param {Date} filters.endDate - 종료 날짜
 * @param {number} filters.limit - 최대 개수
 */
export const getFilteredLogs = (filters = {}) => {
  let logs = getLogs();

  // 사용자 필터
  if (filters.userId) {
    logs = logs.filter(log => log.userId === filters.userId);
  }

  // 대상 타입 필터
  if (filters.targetType) {
    logs = logs.filter(log => log.targetType === filters.targetType);
  }

  // 대상 ID 필터
  if (filters.targetId) {
    logs = logs.filter(log => log.targetId === filters.targetId);
  }

  // 대상 UUID 필터
  if (filters.targetUuid) {
    logs = logs.filter(log => log.targetUuid === filters.targetUuid);
  }

  // 작업 유형 필터
  if (filters.action) {
    logs = logs.filter(log => log.action === filters.action);
  }

  // 날짜 범위 필터
  if (filters.startDate) {
    logs = logs.filter(log => new Date(log.timestamp) >= filters.startDate);
  }
  if (filters.endDate) {
    logs = logs.filter(log => new Date(log.timestamp) <= filters.endDate);
  }

  // 최대 개수 제한
  if (filters.limit) {
    logs = logs.slice(0, filters.limit);
  }

  return logs;
};

/**
 * 최근 로그 가져오기
 * @param {number} count - 가져올 개수 (기본: 50)
 */
export const getRecentLogs = (count = 50) => {
  return getLogs().slice(0, count);
};

/**
 * 특정 대상의 로그 가져오기 (히스토리)
 * @param {string} targetUuid - 대상 UUID
 * @param {string} targetType - 대상 타입 (선택사항)
 */
export const getTargetHistory = (targetUuid, targetType = null) => {
  let logs = getLogs().filter(log => log.targetUuid === targetUuid);

  if (targetType) {
    logs = logs.filter(log => log.targetType === targetType);
  }

  return logs;
};

// ============== 로그 통계 ==============

/**
 * 로그 통계 정보
 */
export const getLogStats = () => {
  const logs = getLogs();

  return {
    totalCount: logs.length,
    byAction: {
      create: logs.filter(l => l.action === LOG_ACTIONS.CREATE).length,
      update: logs.filter(l => l.action === LOG_ACTIONS.UPDATE).length,
      delete: logs.filter(l => l.action === LOG_ACTIONS.DELETE).length
    },
    byTargetType: {
      project: logs.filter(l => l.targetType === TARGET_TYPES.PROJECT).length,
      performance: logs.filter(l => l.targetType === TARGET_TYPES.PERFORMANCE).length
    },
    byUser: logs.reduce((acc, log) => {
      acc[log.userName] = (acc[log.userName] || 0) + 1;
      return acc;
    }, {}),
    lastActivity: logs.length > 0 ? logs[0].timestamp : null
  };
};

// ============== 로그를 자연어 문장으로 변환 ==============

/**
 * 로그를 자연어 문장으로 변환
 * @param {Object} log - 로그 객체
 * @returns {string} 자연어 문장
 */
export const logToSentence = (log) => {
  const { userName, action, targetType, targetName, targetId, changes } = log;

  // 대상 타입 한글 변환
  const targetTypeLabel = {
    [TARGET_TYPES.PROJECT]: '과제',
    [TARGET_TYPES.PERFORMANCE]: '성과',
    [TARGET_TYPES.ACTION_ITEM]: '액션 아이템',
    [TARGET_TYPES.TEAM_MEMBER]: '팀 멤버',
    [TARGET_TYPES.SETTINGS]: '설정'
  }[targetType] || '항목';

  // 대상 표시 (이름이 있으면 이름, 없으면 ID)
  const targetDisplay = targetName
    ? `"${targetName}"`
    : targetId
      ? `(${targetId})`
      : '';

  // 액션아이템은 상위 과제 정보를 함께 표시
  const parentProjectName = log.metadata?.parentProjectName;
  const parentSuffix = (targetType === TARGET_TYPES.ACTION_ITEM && parentProjectName)
    ? ` (과제: "${parentProjectName}")`
    : '';

  // 작업별 문장 생성
  switch (action) {
    case LOG_ACTIONS.CREATE:
    case LOG_ACTIONS.BULK_CREATE:
      return `${userName}님이 ${targetTypeLabel} ${targetDisplay}을(를) 생성했습니다.${parentSuffix}`;

    case LOG_ACTIONS.DELETE:
    case LOG_ACTIONS.BULK_DELETE:
      return `${userName}님이 ${targetTypeLabel} ${targetDisplay}을(를) 삭제했습니다.${parentSuffix}`;

    case LOG_ACTIONS.UPDATE:
    case LOG_ACTIONS.BULK_UPDATE:
      // 변경 내용 문장으로 변환
      if (changes && Object.keys(changes).length > 0) {
        const changeDescriptions = Object.entries(changes)
          .map(([field, change]) => {
            const fieldLabel = FIELD_LABELS[field] || field;

            // 값 포맷팅
            const formatValue = (value) => {
              if (value === null || value === undefined || value === '') return '(빈 값)';
              if (typeof value === 'boolean') return value ? '예' : '아니오';
              if (Array.isArray(value)) return `${value.length}개 항목`;
              return `"${value}"`;
            };

            const beforeValue = formatValue(change.before);
            const afterValue = formatValue(change.after);

            return `${fieldLabel}을(를) ${beforeValue}에서 ${afterValue}(으)로 변경`;
          })
          .slice(0, 3) // 최대 3개만 표시
          .join(', ');

        const moreChanges = Object.keys(changes).length > 3
          ? ` 외 ${Object.keys(changes).length - 3}개 항목`
          : '';

        return `${userName}님이 ${targetTypeLabel} ${targetDisplay}의 ${changeDescriptions}${moreChanges}했습니다.`;
      }
      return `${userName}님이 ${targetTypeLabel} ${targetDisplay}을(를) 수정했습니다.`;

    case LOG_ACTIONS.IMPORT:
      return `${userName}님이 데이터를 가져왔습니다.`;

    case LOG_ACTIONS.EXPORT:
      return `${userName}님이 데이터를 내보냈습니다.`;

    case LOG_ACTIONS.SERVER_UPLOAD:
      // 서버 업로드 시 상세 정보 표시
      if (changes) {
        const details = [];
        if (changes.projectCount !== undefined) details.push(`과제 ${changes.projectCount}개`);
        if (changes.performanceCount !== undefined) details.push(`성과 ${changes.performanceCount}개`);
        if (changes.version !== undefined) details.push(`v${changes.version}`);
        if (changes.uploadedProjects && changes.uploadedProjects.length > 0) {
          const projectNames = changes.uploadedProjects.slice(0, 3).map(p => `"${p}"`).join(', ');
          const more = changes.uploadedProjects.length > 3 ? ` 외 ${changes.uploadedProjects.length - 3}개` : '';
          details.push(`업로드된 과제: ${projectNames}${more}`);
        }
        if (changes.uploadedPerformances && changes.uploadedPerformances.length > 0) {
          const perfNames = changes.uploadedPerformances.slice(0, 3).map(p => `"${p}"`).join(', ');
          const more = changes.uploadedPerformances.length > 3 ? ` 외 ${changes.uploadedPerformances.length - 3}개` : '';
          details.push(`업로드된 성과: ${perfNames}${more}`);
        }
        if (details.length > 0) {
          return `${userName}님이 서버에 데이터를 업로드했습니다. (${details.join(', ')})`;
        }
      }
      return `${userName}님이 서버에 데이터를 업로드했습니다.`;

    case LOG_ACTIONS.SERVER_DOWNLOAD:
      // 서버 다운로드 시 상세 정보 표시
      if (changes) {
        const details = [];
        if (changes.projectCount !== undefined) details.push(`과제 ${changes.projectCount}개`);
        if (changes.performanceCount !== undefined) details.push(`성과 ${changes.performanceCount}개`);
        if (changes.version !== undefined) details.push(`v${changes.version}`);
        if (details.length > 0) {
          return `${userName}님이 서버에서 데이터를 불러왔습니다. (${details.join(', ')})`;
        }
      }
      return `${userName}님이 서버에서 데이터를 불러왔습니다.`;

    case LOG_ACTIONS.SERVER_SYNC:
      return `${userName}님이 서버와 데이터를 동기화했습니다.`;

    default:
      return `${userName}님이 ${targetTypeLabel} ${targetDisplay}에 대한 작업을 수행했습니다.`;
  }
};

/**
 * 로그 배열을 자연어 문장 배열로 변환
 */
export const logsToSentences = (logs) => {
  return logs.map(log => ({
    ...log,
    sentence: logToSentence(log)
  }));
};

// ============== 변경 사항 추출 헬퍼 ==============

/**
 * 두 객체를 비교하여 변경된 필드 추출
 * @param {Object} before - 이전 데이터
 * @param {Object} after - 이후 데이터
 * @param {Array} fieldsToCompare - 비교할 필드 목록 (생략 시 모든 필드)
 * @returns {Object} 변경된 필드 { fieldName: { before, after } }
 */
export const extractChanges = (before, after, fieldsToCompare = null) => {
  const changes = {};

  // 비교할 필드 결정
  const fields = fieldsToCompare || [
    ...Object.keys(before || {}),
    ...Object.keys(after || {})
  ];

  fields.forEach(field => {
    const beforeValue = before?.[field];
    const afterValue = after?.[field];

    // 배열이나 객체는 JSON 문자열로 비교
    const beforeStr = typeof beforeValue === 'object'
      ? JSON.stringify(beforeValue)
      : beforeValue;
    const afterStr = typeof afterValue === 'object'
      ? JSON.stringify(afterValue)
      : afterValue;

    if (beforeStr !== afterStr) {
      changes[field] = {
        before: beforeValue,
        after: afterValue
      };
    }
  });

  return changes;
};

// ============== 로그 관리 ==============

/**
 * 모든 로그 삭제
 */
export const clearAllLogs = () => {
  localStorage.removeItem(STORAGE_KEY);
  console.log('🗑️ 모든 액티비티 로그 삭제됨');
};

/**
 * 오래된 로그 삭제 (특정 날짜 이전)
 * @param {Date} beforeDate - 이 날짜 이전의 로그 삭제
 */
export const clearLogsBeforeDate = (beforeDate) => {
  const logs = getLogs();
  const filteredLogs = logs.filter(log => new Date(log.timestamp) >= beforeDate);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredLogs));
  console.log(`🗑️ ${logs.length - filteredLogs.length}개 로그 삭제됨`);
};

/**
 * 로그를 JSON 파일로 내보내기
 */
export const exportLogsToJSON = () => {
  const logs = getLogs();
  const dataStr = JSON.stringify(logs, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `activity-logs-${todayLocalYmd()}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

// ============== 액션아이템 단위 로그 발행 ==============

/**
 * 액션아이템목록 before/after를 id 기준으로 비교하여
 * 추가/삭제된 항목을 ACTION_ITEM 타입의 개별 로그로 발행합니다.
 * @param {Array} beforeList - 이전 액션아이템 배열
 * @param {Array} afterList - 이후 액션아이템 배열
 * @param {Object} parentProject - 상위 과제 정보 { id, uuid, 과제명 }
 * @param {Object} options - { source }
 * @returns {number} 발행된 로그 개수
 */
export const logActionItemChanges = (beforeList, afterList, parentProject, options = {}) => {
  const beforeArr = Array.isArray(beforeList) ? beforeList : [];
  const afterArr = Array.isArray(afterList) ? afterList : [];

  /*
    🐞 **`id` 로 비교하면 엉뚱한 항목이 삭제됐다고 기록된다.**

    `id` 는 저장할 때마다 위치 순서로 다시 매겨진다(`processFormData`). 3개 중
    첫 번째를 지우면 남은 둘의 id 가 1,2 로 당겨져서, 여기서는 "3번이 사라졌다" 로
    보인다 — 실제로 지운 것은 1번인데 3번의 제목으로 로그가 남는다.
    마지막 것을 지울 때만 우연히 맞았다.

    `uuid` 는 만들 때 붙고 서버가 지켜 준다(`routes_v2._assign_action_uuids`).
    아직 uuid 가 없는 옛 데이터는 `id` 로 물러선다 — 그때는 예전과 같이 동작한다.
  */
  const keyOf = (item) => String(item?.uuid || item?.id || '');
  const beforeMap = new Map(beforeArr.filter(i => keyOf(i)).map(i => [keyOf(i), i]));
  const afterMap = new Map(afterArr.filter(i => keyOf(i)).map(i => [keyOf(i), i]));

  const source = options.source || LOG_SOURCES.MODAL;
  const parentMeta = {
    parentProjectId: parentProject?.id ?? '',
    parentProjectUuid: parentProject?.uuid ?? '',
    parentProjectName: parentProject?.과제명 ?? ''
  };

  let emitted = 0;

  // 추가된 액션아이템
  afterMap.forEach((item, id) => {
    if (!beforeMap.has(id)) {
      logActivity({
        action: LOG_ACTIONS.CREATE,
        targetType: TARGET_TYPES.ACTION_ITEM,
        targetId: id,
        targetName: item.제목 || '',
        changes: {
          제목: { before: null, after: item.제목 || '' }
        },
        metadata: { source, ...parentMeta }
      });
      emitted++;
    }
  });

  // 삭제된 액션아이템
  beforeMap.forEach((item, id) => {
    if (!afterMap.has(id)) {
      logActivity({
        action: LOG_ACTIONS.DELETE,
        targetType: TARGET_TYPES.ACTION_ITEM,
        targetId: id,
        targetName: item.제목 || '',
        changes: {
          제목: { before: item.제목 || '', after: null }
        },
        metadata: { source, ...parentMeta }
      });
      emitted++;
    }
  });

  return emitted;
};

// ============== 로그 검증 ==============

/**
 * 로그 데이터 유효성 검사
 */
export const isValidLog = (log) => {
  return log
    && log.logId
    && log.timestamp
    && log.action
    && log.targetType;
};
