// 새로운 데이터 구조 정의 및 관리 유틸리티
import { initStorage, getItem, setItem, removeItem, clearItems } from './storageHelper';
import { todayLocalYmd } from '../../../shared/utils/localDate';
// 수준값의 0 과 미입력은 다른 뜻이다. `|| ''` 로 다루면 0 이 사라진다.
import { hasLevel, levelText } from './levelValue';

// UUID v4 생성 함수 (브라우저 호환성 보장)
const generateUUID = () => {
  // crypto.randomUUID() 지원 시 사용
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // 폴백: RFC4122 v4 UUID 형식 생성
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// ============== 데이터 구조 상수 ==============

export const DATA_STRUCTURE_VERSION = '2.0';

// 로컬 스토리지 키 정의
export const STORAGE_KEYS = {
  METADATA: 'digitalTwinDashboard_metadata',
  PROJECTS: 'digitalTwinDashboard_projects', 
  PERFORMANCES: 'digitalTwinDashboard_performances'
};

// ============== IndexedDB 스토리지 초기화 ==============

/**
 * IndexedDB 스토리지 초기화 (앱 시작 시 호출)
 * localStorage 데이터가 있으면 IndexedDB로 자동 마이그레이션
 */
export const initDataStorage = () => {
  return initStorage([STORAGE_KEYS.PROJECTS, STORAGE_KEYS.PERFORMANCES]);
};

// ============== 메타데이터 관리 ==============

/**
 * 기본 메타데이터 구조
 */
export const createDefaultMetadata = () => ({
  version: DATA_STRUCTURE_VERSION,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  projectCount: 0,
  performanceCount: 0,
  lastBackupDate: null,
  settings: {
    currentYear: 2025,
    viewMode: 'dashboard',
    autoSave: true
  }
});

/**
 * 메타데이터 로드
 */
export const loadMetadata = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.METADATA);
    if (saved) {
      const metadata = JSON.parse(saved);
      // 버전 체크 및 마이그레이션 필요시 처리
      if (metadata.version !== DATA_STRUCTURE_VERSION) {
        console.warn('데이터 구조 버전이 다릅니다. 마이그레이션을 수행합니다.');
        return migrateMetadata(metadata);
      }
      return metadata;
    }
  } catch (error) {
    console.error('메타데이터 로드 실패:', error);
  }
  return createDefaultMetadata();
};

/**
 * 메타데이터 저장
 */
export const saveMetadata = (metadata) => {
  try {
    const updatedMetadata = {
      ...metadata,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(updatedMetadata));
    return updatedMetadata;
  } catch (error) {
    console.error('메타데이터 저장 실패:', error);
    return metadata;
  }
};

/**
 * 메타데이터 업데이트 (부분 업데이트)
 */
export const updateMetadata = (updates) => {
  const currentMetadata = loadMetadata();
  const newMetadata = {
    ...currentMetadata,
    ...updates,
    version: DATA_STRUCTURE_VERSION, // 버전 명시적으로 유지
    updatedAt: new Date().toISOString()
  };
  return saveMetadata(newMetadata);
};

// ============== 성과 항목 관리 ==============

/**
 * 다음 성과 ID 생성 (UUID 기반 - 충돌 방지)
 * UUID 앞 8자리를 사용하여 고유하면서 읽기 쉬운 ID 생성
 */
export const generateNextPerformanceId = () => {
  const uuid = generateUUID();
  return `perf-${uuid.substring(0, 8)}`;
};

/**
 * 성과 항목 생성
 * @param {Object} performanceData - 성과 데이터
 * @param {Array} currentPerformances - 현재 성과 목록 (하위 호환용, 사용 안함)
 */
export const createPerformance = (performanceData, currentPerformances = []) => {
  // 월별실적여부에 따라 기본값 설정
  const isMonthly = performanceData.월별실적여부 || false;

  // UUID 기반 고유 ID 생성 (충돌 방지)
  const newUuid = performanceData.uuid || generateUUID();
  const newId = performanceData.id || `perf-${newUuid.substring(0, 8)}`;

  return {
    uuid: newUuid,
    id: newId,
    성과년도: performanceData.성과년도 || new Date().getFullYear(),
    성과항목: performanceData.성과항목 || '',
    대분류: performanceData.대분류 || '',
    소분류: performanceData.소분류 || '',
    단위: performanceData.단위 || '',
    // 0 도 값이다 — `|| ''` 로 접으면 저장된 0 이 미입력이 된다 (levelValue.js 참조).
    현재수준: levelText(performanceData.현재수준),
    목표수준: levelText(performanceData.목표수준),
    // 로직 입력 여부
    로직입력여부: performanceData.로직입력여부 || false,
    // 계산 로직 데이터
    계산로직: performanceData.계산로직 || null,
    // 월별 실적 플래그
    월별실적여부: isMonthly,
    // 단일 실적 (월별실적여부가 false일 때 사용)
    실적수준: !isMonthly ? levelText(performanceData.실적수준) : '',
    // 월별 실적 (월별실적여부가 true일 때 사용, 12개월)
    월별실적: isMonthly ? (performanceData.월별실적 || Array(12).fill('')) : Array(12).fill(''),
    // 디지털 트윈 기여도
    디지털트윈기여도여부: performanceData.디지털트윈기여도여부 || false,
    디지털트윈기여도: performanceData.디지털트윈기여도 ?? '100',
    보고현황목록: performanceData.보고현황목록 || [],
    설명: performanceData.설명 || '',
    createdAt: performanceData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: performanceData.isActive !== undefined ? performanceData.isActive : true,
    isFromSample: performanceData.isFromSample || false
  };
};

/**
 * 성과 항목 목록 로드 (비활성화됨 - 로컬 스토리지 자동 로드 방지)
 * 이제 성과는 수동으로 추가하거나 샘플 데이터 로드를 통해서만 로드됩니다.
 */
export const loadPerformances = () => {
  // 로컬 스토리지에서 자동 로드하지 않음
  // 성과는 앱 상태(globalPerformances)를 통해서만 관리됨
  console.log('[loadPerformances] 로컬 스토리지 자동 로드가 비활성화되어 있습니다.');
  return [];
};

/**
 * 성과 항목 목록 저장 (IndexedDB 사용)
 */
export const savePerformances = (performances) => {
  try {
    const validPerformances = Array.isArray(performances) ? performances : [];
    setItem(STORAGE_KEYS.PERFORMANCES, validPerformances);

    // 메타데이터 업데이트
    updateMetadata({
      performanceCount: validPerformances.length
    });

    return validPerformances;
  } catch (error) {
    console.error('성과 항목 저장 실패:', error);
    return performances;
  }
};

/**
 * 성과 항목 추가 (UUID 기반 - 중복 불가)
 * @param {Object} performanceData - 추가할 성과 데이터
 * @param {Array} currentPerformances - 현재 성과 목록 (옵션, 제공하지 않으면 빈 배열 사용)
 */
export const addPerformance = (performanceData, currentPerformances = []) => {
  const performances = currentPerformances;
  const newPerformance = createPerformance(performanceData, currentPerformances);

  // UUID 기반이므로 ID 충돌 가능성 없음 (별도 중복 체크 불필요)
  const updatedPerformances = [...performances, newPerformance];
  return savePerformances(updatedPerformances);
};

/**
 * 성과 항목 업데이트
 * @param {string} performanceId - 업데이트할 성과 ID
 * @param {Object} updates - 업데이트할 데이터
 * @param {Array} currentPerformances - 현재 성과 목록 (옵션, 제공하지 않으면 빈 배열 사용)
 */
export const updatePerformance = (performanceId, updates, currentPerformances = []) => {
  const performances = currentPerformances;
  const updatedPerformances = performances.map(perf =>
    perf.id === performanceId
      ? { ...perf, ...updates, updatedAt: new Date().toISOString() }
      : perf
  );
  return savePerformances(updatedPerformances);
};

/**
 * 성과 항목 삭제
 * @param {string} performanceId - 삭제할 성과 ID
 * @param {Array} currentPerformances - 현재 성과 목록 (옵션, 제공하지 않으면 빈 배열 사용)
 */
export const deletePerformance = (performanceId, currentPerformances = []) => {
  const performances = currentPerformances;
  const updatedPerformances = performances.filter(perf => perf.id !== performanceId);
  return savePerformances(updatedPerformances);
};

/**
 * 성과 항목 ID로 검색
 */
export const getPerformanceById = (performanceId) => {
  const performances = loadPerformances();
  return performances.find(perf => perf.id === performanceId);
};

// ============== 프로젝트 관리 ==============

/**
 * 프로젝트 생성
 */
export const createProject = (projectData) => {
  return {
    uuid: projectData.uuid || generateUUID(),
    id: projectData.id || generateNextProjectId(projectData.사업부),
    과제년도: projectData.과제년도 || new Date().getFullYear(),
    사업부: projectData.사업부 || 'VD',
    프로세스: projectData.프로세스 || '개발',
    과제영역: projectData.과제영역 || '',
    과제구분: projectData.과제구분 || '신규 시뮬레이션 기법 개발',
    과제명: projectData.과제명 || '',
    시작: projectData.시작 || 1,
    종료: projectData.종료 || 12,
    진행상태: projectData.진행상태 || '미착수',
    과제PL: projectData.과제PL || '',
    작성자: projectData.작성자 || '',
    과제상세설명: projectData.과제상세설명 || '',
    PoC과제여부: projectData.PoC과제여부 || false,
    중점과제여부: projectData.중점과제여부 || false,
    성과목록: projectData.성과목록 || [], // 성과 ID 목록
    액션아이템목록: projectData.액션아이템목록 || [],
    과제참여인력목록: projectData.과제참여인력목록 || [],
    담당부서목록: projectData.담당부서목록 || [],
    // 월간 진척 현황 요약
    월간진척현황: projectData.월간진척현황 || {},
    createdAt: projectData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

/**
 * 프로젝트 목록 로드
 */
export const loadProjects = () => {
  try {
    // IndexedDB 캐시에서 동기 읽기
    const cached = getItem(STORAGE_KEYS.PROJECTS);
    if (cached) {
      return Array.isArray(cached) ? cached : [];
    }
    // 폴백: localStorage (마이그레이션 전 호환)
    const saved = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    if (saved) {
      const projects = JSON.parse(saved);
      return Array.isArray(projects) ? projects : [];
    }
  } catch (error) {
    console.error('프로젝트 로드 실패:', error);
  }
  return [];
};

/**
 * 프로젝트 목록 저장
 */
export const saveProjects = (projects) => {
  try {
    const validProjects = Array.isArray(projects) ? projects : [];

    // IndexedDB에 저장 (용량 제한 없음)
    setItem(STORAGE_KEYS.PROJECTS, validProjects);

    // 메타데이터 업데이트
    updateMetadata({
      projectCount: validProjects.length
    });

    console.log(`[saveProjects] ${validProjects.length}개 프로젝트 저장 완료 (IndexedDB)`);
    return validProjects;
  } catch (error) {
    console.error('[saveProjects] 프로젝트 저장 실패:', error);
    console.error('[saveProjects] 저장하려던 프로젝트 수:', Array.isArray(projects) ? projects.length : 'N/A');

    // 에러 발생 시에도 입력받은 projects를 그대로 반환
    // (React state는 업데이트하되 저장만 실패)
    return Array.isArray(projects) ? projects : [];
  }
};

/**
 * 프로젝트 추가
 * @param {Object} projectData - 추가할 프로젝트 데이터
 * @param {Array} currentProjects - 현재 프로젝트 목록 (옵션)
 */
export const addProject = (projectData, currentProjects = null) => {
  const projects = currentProjects || loadProjects();
  const newProject = createProject(projectData);
  const updatedProjects = [...projects, newProject];
  return saveProjects(updatedProjects);
};

/**
 * 프로젝트 업데이트
 * @param {string} projectId - 업데이트할 프로젝트 ID
 * @param {Object} updates - 업데이트할 데이터
 * @param {Array} currentProjects - 현재 프로젝트 목록 (옵션)
 */
export const updateProject = (projectId, updates, currentProjects = null) => {
  const projects = currentProjects || loadProjects();

  console.log('[updateProject] 업데이트 시작');
  console.log('[updateProject] projectId:', projectId);
  console.log('[updateProject] 현재 프로젝트 수:', projects.length);
  console.log('[updateProject] 현재 프로젝트 ID 목록:', projects.map(p => p.id));
  console.log('[updateProject] updates.id:', updates.id);

  const updatedProjects = projects.map(project =>
    project.id === projectId
      ? { ...project, ...updates, updatedAt: new Date().toISOString() }
      : project
  );

  console.log('[updateProject] 업데이트 후 프로젝트 수:', updatedProjects.length);
  console.log('[updateProject] 업데이트된 프로젝트:', updatedProjects.find(p => p.id === projectId));

  return saveProjects(updatedProjects);
};

/**
 * 프로젝트 삭제
 */
export const deleteProject = (projectId) => {
  const projects = loadProjects();
  const updatedProjects = projects.filter(project => project.id !== projectId);
  return saveProjects(updatedProjects);
};

/**
 * 프로젝트 ID로 검색
 */
export const getProjectById = (projectId) => {
  const projects = loadProjects();
  return projects.find(project => project.id === projectId);
};

/**
 * 프로젝트 ID 생성 (사업부-번호 형식)
 */
export const generateNextProjectId = (division = 'VD') => {
  const projects = loadProjects();
  const divisionProjects = projects.filter(project => project.사업부 === division);
  const divisionNumbers = divisionProjects
    .map(project => {
      if (typeof project.id === 'string' && project.id.includes('-')) {
        const parts = project.id.split('-');
        return parts.length === 2 ? parseInt(parts[1], 10) : 0;
      }
      return 0;
    })
    .filter(num => !isNaN(num));
  
  const maxNumber = divisionNumbers.length > 0 ? Math.max(...divisionNumbers) : 0;
  return `${division}-${maxNumber + 1}`;
};

// ============== 프로젝트-성과 연결 관리 ==============

/**
 * 프로젝트에 성과 추가
 */
export const addPerformanceToProject = (projectId, performanceId, projectContribution = '100') => {
  const projects = loadProjects();
  const performances = loadPerformances();
  
  // 성과 항목이 존재하는지 확인
  const performance = performances.find(perf => perf.id === performanceId);
  if (!performance) {
    throw new Error('존재하지 않는 성과 항목입니다.');
  }
  
  // 프로젝트 업데이트
  const updatedProjects = projects.map(project => {
    if (project.id === projectId) {
      // 이미 존재하는 성과인지 확인
      const existingPerformance = project.성과목록.find(item => 
        typeof item === 'string' ? item === performanceId : item.id === performanceId
      );
      
      if (existingPerformance) {
        throw new Error('이미 추가된 성과 항목입니다.');
      }
      
      // 새로운 성과 연결 정보 추가 (ID와 과제기여도만 저장)
      const newPerformanceConnection = {
        id: performanceId,
        과제기여도: projectContribution
      };
      
      return {
        ...project,
        성과목록: [...project.성과목록, newPerformanceConnection],
        updatedAt: new Date().toISOString()
      };
    }
    return project;
  });
  
  return saveProjects(updatedProjects);
};

/**
 * 프로젝트에서 성과 제거
 */
export const removePerformanceFromProject = (projectId, performanceId) => {
  const projects = loadProjects();
  const updatedProjects = projects.map(project => {
    if (project.id === projectId) {
      return {
        ...project,
        성과목록: project.성과목록.filter(item => 
          typeof item === 'string' ? item !== performanceId : item.id !== performanceId
        ),
        updatedAt: new Date().toISOString()
      };
    }
    return project;
  });
  
  return saveProjects(updatedProjects);
};

/**
 * 프로젝트의 성과 기여도 업데이트
 */
export const updateProjectPerformanceContribution = (projectId, performanceId, contribution, actualLevel) => {
  const projects = loadProjects();
  const updatedProjects = projects.map(project => {
    if (project.id === projectId) {
      return {
        ...project,
        성과목록: project.성과목록.map(item => {
          const itemId = typeof item === 'string' ? item : item.id;
          if (itemId === performanceId) {
            return typeof item === 'string' 
              // 실적 0 을 넣는 것과 비우는 것은 다르다 — `||` 는 둘 다 '없음'으로 본다.
              ? { id: performanceId, 과제기여도: contribution, 실적수준: levelText(actualLevel) }
              : { ...item, 과제기여도: contribution,
                  실적수준: hasLevel(actualLevel) ? String(actualLevel) : levelText(item.실적수준) };
          }
          return item;
        }),
        updatedAt: new Date().toISOString()
      };
    }
    return project;
  });
  
  return saveProjects(updatedProjects);
};

// ============== 데이터 마이그레이션 ==============

/**
 * 레거시 데이터 마이그레이션
 */
export const migrateLegacyData = (legacyProjects) => {
  console.log('레거시 데이터 마이그레이션 시작...');
  
  try {
    const performances = [];
    const projects = [];
    const performanceIdMap = new Map(); // 중복 제거를 위한 맵
    
    // 1. 모든 프로젝트에서 성과 항목 추출 및 글로벌 성과 목록 생성
    legacyProjects.forEach((project, projectIndex) => {
      if (project.성과목록 && Array.isArray(project.성과목록)) {
        project.성과목록.forEach((perf, perfIndex) => {
          // 성과 항목의 고유 키 생성 (이름 + 대분류 + 소분류로 중복 판단)
          const perfKey = `${perf.성과항목}_${perf.대분류}_${perf.소분류}`.toLowerCase().trim();
          
          if (!performanceIdMap.has(perfKey)) {
            const performanceId = `migrated_perf_${performances.length + 1}`;
            const performanceItem = createPerformance({
              id: performanceId,
              성과항목: perf.성과항목 || '',
              대분류: perf.대분류 || '',
              소분류: perf.소분류 || '',
              단위: perf.단위 || '',
              현재수준: levelText(perf.현재수준),
              목표수준: levelText(perf.목표수준),
              실적수준: levelText(perf.실적수준),
              설명: `프로젝트 "${project.과제명}"에서 마이그레이션됨`,
              isFromSample: false
            });
            
            performances.push(performanceItem);
            performanceIdMap.set(perfKey, performanceId);
            
            console.log(`성과 항목 생성: ${perf.성과항목} (ID: ${performanceId})`);
          }
        });
      }
    });
    
    // 2. 프로젝트 데이터 변환 (성과목록을 ID 참조로 변경)
    legacyProjects.forEach(legacyProject => {
      const projectPerformances = [];
      
      if (legacyProject.성과목록 && Array.isArray(legacyProject.성과목록)) {
        legacyProject.성과목록.forEach(perf => {
          const perfKey = `${perf.성과항목}_${perf.대분류}_${perf.소분류}`.toLowerCase().trim();
          const performanceId = performanceIdMap.get(perfKey);
          
          if (performanceId) {
            projectPerformances.push({
              id: performanceId,
              과제기여도: perf.과제기여도 || '100',
              실적수준: levelText(perf.실적수준)
            });
          }
        });
      }
      
      // 프로젝트 생성 (성과목록을 ID 목록으로 변경)
      const migratedProject = createProject({
        ...legacyProject,
        성과목록: projectPerformances
      });
      
      projects.push(migratedProject);
      console.log(`프로젝트 마이그레이션: ${legacyProject.과제명} (성과 ${projectPerformances.length}개)`);
    });
    
    // 3. 데이터 저장
    savePerformances(performances);
    saveProjects(projects);
    
    // 4. 메타데이터 업데이트
    updateMetadata({
      version: DATA_STRUCTURE_VERSION,
      projectCount: projects.length,
      performanceCount: performances.length
    });
    
    console.log(`마이그레이션 완료: 프로젝트 ${projects.length}개, 성과 항목 ${performances.length}개`);
    
    return {
      projects,
      performances,
      metadata: loadMetadata()
    };
    
  } catch (error) {
    console.error('데이터 마이그레이션 실패:', error);
    throw error;
  }
};

/**
 * 메타데이터 마이그레이션
 */
const migrateMetadata = (oldMetadata) => {
  const newMetadata = createDefaultMetadata();

  // 기존 데이터가 있다면 보존
  if (oldMetadata) {
    newMetadata.createdAt = oldMetadata.createdAt || newMetadata.createdAt;
    newMetadata.projectCount = oldMetadata.projectCount ?? newMetadata.projectCount;
    newMetadata.performanceCount = oldMetadata.performanceCount ?? newMetadata.performanceCount;
    newMetadata.lastBackupDate = oldMetadata.lastBackupDate || newMetadata.lastBackupDate;
    newMetadata.settings = { ...newMetadata.settings, ...oldMetadata.settings };
  }

  return saveMetadata(newMetadata);
};

// ============== 유틸리티 함수 ==============

/**
 * 전체 데이터 초기화
 */
export const clearAllData = () => {
  try {
    // IndexedDB에서 삭제
    clearItems([STORAGE_KEYS.PROJECTS, STORAGE_KEYS.PERFORMANCES]);
    // localStorage에서도 삭제 (메타데이터 포함)
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });

    console.log('모든 데이터가 초기화되었습니다.');
    return true;
  } catch (error) {
    console.error('데이터 초기화 실패:', error);
    return false;
  }
};

/**
 * 데이터 백업 생성
 */
export const createBackup = () => {
  try {
    const backup = {
      timestamp: new Date().toISOString(),
      version: DATA_STRUCTURE_VERSION,
      metadata: loadMetadata(),
      projects: loadProjects(),
      performances: loadPerformances()
    };
    
    const backupString = JSON.stringify(backup, null, 2);
    const blob = new Blob([backupString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `digital-twin-backup-${todayLocalYmd()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // 메타데이터에 백업 날짜 기록
    updateMetadata({ lastBackupDate: new Date().toISOString() });
    
    return true;
  } catch (error) {
    console.error('백업 생성 실패:', error);
    return false;
  }
};

/**
 * 데이터 검증
 */
export const validateData = () => {
  const errors = [];
  const warnings = [];
  
  try {
    const metadata = loadMetadata();
    const projects = loadProjects();
    const performances = loadPerformances();
    
    // 메타데이터 검증
    if (!metadata.version) {
      errors.push('메타데이터 버전 정보가 없습니다.');
    }
    
    // 프로젝트 검증
    projects.forEach((project, index) => {
      if (!project.id) {
        errors.push(`프로젝트 ${index}: ID가 없습니다.`);
      }
      
      if (!project.과제명) {
        warnings.push(`프로젝트 ${project.id || index}: 과제명이 없습니다.`);
      }
      
      // 성과 연결 검증
      if (project.성과목록 && Array.isArray(project.성과목록)) {
        project.성과목록.forEach(perfRef => {
          const perfId = typeof perfRef === 'string' ? perfRef : perfRef.id;
          const performance = performances.find(p => p.id === perfId);
          if (!performance) {
            errors.push(`프로젝트 ${project.id}: 존재하지 않는 성과 항목 참조 (${perfId})`);
          }
        });
      }
    });
    
    // 성과 항목 검증
    performances.forEach((perf, index) => {
      if (!perf.id) {
        errors.push(`성과 항목 ${index}: ID가 없습니다.`);
      }
      
      if (!perf.성과항목) {
        warnings.push(`성과 항목 ${perf.id || index}: 성과명이 없습니다.`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        projectCount: projects.length,
        performanceCount: performances.length,
        errorCount: errors.length,
        warningCount: warnings.length
      }
    };
    
  } catch (error) {
    errors.push(`데이터 검증 중 오류 발생: ${error.message}`);
    return {
      isValid: false,
      errors,
      warnings,
      summary: { errorCount: errors.length, warningCount: warnings.length }
    };
  }
};
