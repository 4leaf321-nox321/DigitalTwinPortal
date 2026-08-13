// 새로운 데이터 구조 정의 및 관리 유틸리티

// 간단한 UUID 생성 함수 (uuid 라이브러리 대신)
const generateUUID = () => {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
};

// ============== 데이터 구조 상수 ==============

export const DATA_STRUCTURE_VERSION = '2.0';

// 로컬 스토리지 키 정의
export const STORAGE_KEYS = {
  METADATA: 'digitalTwinDashboard_metadata',
  PROJECTS: 'digitalTwinDashboard_projects', 
  PERFORMANCES: 'digitalTwinDashboard_performances'
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
    updatedAt: new Date().toISOString()
  };
  return saveMetadata(newMetadata);
};

// ============== 성과 항목 관리 ==============

/**
 * 다음 성과 ID 생성 (순차 번호) - 최대 번호 + 1
 */
export const generateNextPerformanceId = () => {
  const performances = loadPerformances();
  const performanceNumbers = performances
    .map(perf => {
      if (typeof perf.id === 'string' && perf.id.startsWith('performance-')) {
        const num = parseInt(perf.id.replace('performance-', ''), 10);
        return isNaN(num) ? 0 : num;
      }
      return 0;
    })
    .filter(num => num > 0);
  
  const maxNumber = performanceNumbers.length > 0 ? Math.max(...performanceNumbers) : 0;
  return `performance-${maxNumber + 1}`;
};

/**
 * 성과 항목 생성
 */
export const createPerformance = (performanceData) => {
  return {
    id: performanceData.id || generateNextPerformanceId(),
    성과항목: performanceData.성과항목 || '',
    대분류: performanceData.대분류 || '',
    소분류: performanceData.소분류 || '',
    단위: performanceData.단위 || '',
    현재수준: performanceData.현재수준 || '',
    목표수준: performanceData.목표수준 || '',
    실적수준: performanceData.실적수준 || '',
    설명: performanceData.설명 || '',
    createdAt: performanceData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: performanceData.isActive !== undefined ? performanceData.isActive : true,
    isFromSample: performanceData.isFromSample || false
  };
};

/**
 * 성과 항목 목록 로드
 */
export const loadPerformances = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.PERFORMANCES);
    if (saved) {
      const performances = JSON.parse(saved);
      return Array.isArray(performances) ? performances : [];
    }
  } catch (error) {
    console.error('성과 항목 로드 실패:', error);
  }
  return [];
};

/**
 * 성과 항목 목록 저장
 */
export const savePerformances = (performances) => {
  try {
    const validPerformances = Array.isArray(performances) ? performances : [];
    localStorage.setItem(STORAGE_KEYS.PERFORMANCES, JSON.stringify(validPerformances));
    
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
 * 성과 항목 추가 - 중복 체크 포함
 */
export const addPerformance = (performanceData) => {
  const performances = loadPerformances();
  const newPerformance = createPerformance(performanceData);
  
  // ID 중복 체크 (동시 추가 대응)
  let finalId = newPerformance.id;
  let attempts = 0;
  const maxAttempts = 100;
  
  while (performances.some(perf => perf.id === finalId) && attempts < maxAttempts) {
    // 중복되면 번호 증가
    const match = finalId.match(/performance-(\d+)/);
    if (match) {
      const currentNum = parseInt(match[1], 10);
      finalId = `performance-${currentNum + 1}`;
    } else {
      // performance- 형식이 아닌 경우 새로 생성
      finalId = generateNextPerformanceId();
    }
    attempts++;
  }
  
  if (attempts >= maxAttempts) {
    throw new Error('성과 항목 ID 생성 실패: 최대 시도 횟수 초과');
  }
  
  newPerformance.id = finalId;
  const updatedPerformances = [...performances, newPerformance];
  return savePerformances(updatedPerformances);
};

/**
 * 성과 항목 업데이트
 */
export const updatePerformance = (performanceId, updates) => {
  const performances = loadPerformances();
  const updatedPerformances = performances.map(perf => 
    perf.id === performanceId 
      ? { ...perf, ...updates, updatedAt: new Date().toISOString() }
      : perf
  );
  return savePerformances(updatedPerformances);
};

/**
 * 성과 항목 삭제
 */
export const deletePerformance = (performanceId) => {
  const performances = loadPerformances();
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
    id: projectData.id || generateNextProjectId(projectData.사업부),
    과제년도: projectData.과제년도 || new Date().getFullYear(),
    사업부: projectData.사업부 || 'VD',
    프로세스: projectData.프로세스 || '개발',
    과제구분: projectData.과제구분 || '신규 시뮬레이션 기법 개발',
    과제명: projectData.과제명 || '',
    과제목표: projectData.과제목표 || '업무 시간 효율화',
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
    createdAt: projectData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

/**
 * 프로젝트 목록 로드
 */
export const loadProjects = () => {
  try {
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
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(validProjects));
    
    // 메타데이터 업데이트
    updateMetadata({ 
      projectCount: validProjects.length 
    });
    
    return validProjects;
  } catch (error) {
    console.error('프로젝트 저장 실패:', error);
    return projects;
  }
};

/**
 * 프로젝트 추가
 */
export const addProject = (projectData) => {
  const projects = loadProjects();
  const newProject = createProject(projectData);
  const updatedProjects = [...projects, newProject];
  return saveProjects(updatedProjects);
};

/**
 * 프로젝트 업데이트
 */
export const updateProject = (projectId, updates) => {
  const projects = loadProjects();
  const updatedProjects = projects.map(project => 
    project.id === projectId 
      ? { ...project, ...updates, updatedAt: new Date().toISOString() }
      : project
  );
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
      
      // 새로운 성과 연결 정보 추가
      const newPerformanceConnection = {
        id: performanceId,
        과제기여도: projectContribution,
        실적수준: performance.실적수준 || ''
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
              ? { id: performanceId, 과제기여도: contribution, 실적수준: actualLevel || '' }
              : { ...item, 과제기여도: contribution, 실적수준: actualLevel || item.실적수준 };
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
              현재수준: perf.현재수준 || '',
              목표수준: perf.목표수준 || '',
              실적수준: perf.실적수준 || '',
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
              실적수준: perf.실적수준 || ''
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
    link.download = `digital-twin-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
