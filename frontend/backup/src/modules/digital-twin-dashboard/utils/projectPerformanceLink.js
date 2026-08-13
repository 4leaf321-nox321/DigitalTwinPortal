// 프로젝트와 성과 연결을 위한 유틸리티 함수들

import { loadProjects, loadPerformances } from './dataStructure';

/**
 * 프로젝트의 성과 목록을 실제 성과 데이터와 연결하여 반환
 * @param {Object} project - 프로젝트 객체
 * @param {Array} globalPerformances - 글로벌 성과 목록 (선택사항)
 * @returns {Array} 연결된 성과 데이터 배열
 */
export const getProjectPerformancesWithData = (project, globalPerformances = null) => {
  const performances = globalPerformances || loadPerformances();
  
  if (!project.성과목록 || !Array.isArray(project.성과목록)) {
    return [];
  }
  
  return project.성과목록.map(perfRef => {
    // perfRef는 문자열(ID만) 또는 객체({id, 과제기여도, 실적수준})일 수 있음
    const performanceId = typeof perfRef === 'string' ? perfRef : perfRef.id;
    const contribution = typeof perfRef === 'object' ? perfRef.과제기여도 : '100';
    const actualLevel = typeof perfRef === 'object' ? perfRef.실적수준 : '';
    
    // 글로벌 성과 목록에서 해당 성과 찾기
    const performanceData = performances.find(perf => perf.id === performanceId);
    
    if (!performanceData) {
      console.warn(`성과 항목을 찾을 수 없습니다: ${performanceId}`);
      return null;
    }
    
    // 프로젝트별 성과 데이터 반환 (기존 구조와 호환)
    return {
      id: performanceData.id,
      대분류: performanceData.대분류,
      소분류: performanceData.소분류,
      성과항목: performanceData.성과항목,
      과제기여도: contribution,
      현재수준: performanceData.현재수준,
      목표수준: performanceData.목표수준,
      실적수준: actualLevel || performanceData.실적수준,
      단위: performanceData.단위,
      설명: performanceData.설명
    };
  }).filter(Boolean); // null 값 제거
};

/**
 * 모든 프로젝트의 성과 데이터를 연결하여 반환
 * @param {Array} projects - 프로젝트 배열 (선택사항)
 * @param {Array} globalPerformances - 글로벌 성과 목록 (선택사항)
 * @returns {Array} 각 프로젝트에 연결된 성과 데이터가 포함된 프로젝트 배열
 */
export const getAllProjectsWithPerformanceData = (projects = null, globalPerformances = null) => {
  const projectList = projects || loadProjects();
  const performanceList = globalPerformances || loadPerformances();
  
  return projectList.map(project => ({
    ...project,
    연결된성과목록: getProjectPerformancesWithData(project, performanceList)
  }));
};

/**
 * 특정 성과 항목을 사용하는 모든 프로젝트 찾기
 * @param {string} performanceId - 성과 항목 ID
 * @param {Array} projects - 프로젝트 배열 (선택사항)
 * @returns {Array} 해당 성과를 사용하는 프로젝트 배열
 */
export const getProjectsUsingPerformance = (performanceId, projects = null) => {
  const projectList = projects || loadProjects();
  
  return projectList.filter(project => {
    if (!project.성과목록 || !Array.isArray(project.성과목록)) {
      return false;
    }
    
    return project.성과목록.some(perfRef => {
      const id = typeof perfRef === 'string' ? perfRef : perfRef.id;
      return id === performanceId;
    });
  });
};

/**
 * 프로젝트의 성과 통계 계산
 * @param {Object} project - 프로젝트 객체
 * @param {Array} globalPerformances - 글로벌 성과 목록 (선택사항)
 * @returns {Object} 성과 통계 객체
 */
export const calculateProjectPerformanceStats = (project, globalPerformances = null) => {
  const performances = getProjectPerformancesWithData(project, globalPerformances);
  
  const stats = {
    총성과수: performances.length,
    실적입력완료수: 0,
    실적입력률: 0,
    목표달성수: 0,
    목표달성률: 0,
    평균기여도: 0,
    대분류별통계: {},
    소분류별통계: {}
  };
  
  if (performances.length === 0) {
    return stats;
  }
  
  let totalContribution = 0;
  
  performances.forEach(perf => {
    // 실적 입력 완료 여부
    if (perf.실적수준 && perf.실적수준.trim() !== '') {
      stats.실적입력완료수++;
      
      // 목표 달성 여부 계산 (수치 값이 있는 경우만)
      const current = parseFloat(perf.현재수준);
      const target = parseFloat(perf.목표수준);
      const actual = parseFloat(perf.실적수준);
      
      if (!isNaN(current) && !isNaN(target) && !isNaN(actual)) {
        // 개선 방향에 따라 목표 달성 판단
        // 일반적으로 비용, 시간, 불량률은 감소가 목표, 정확도, 가동률은 증가가 목표
        const isDecreaseTarget = perf.단위.includes('원') || 
                                perf.단위.includes('hour') || 
                                perf.단위.includes('ppm') ||
                                perf.소분류.includes('비용') ||
                                perf.소분류.includes('시간') ||
                                perf.소분류.includes('불량');
        
        const isTargetAchieved = isDecreaseTarget ? 
          (actual <= target) : (actual >= target);
        
        if (isTargetAchieved) {
          stats.목표달성수++;
        }
      }
    }
    
    // 기여도 누적
    const contribution = parseFloat(perf.과제기여도) || 0;
    totalContribution += contribution;
    
    // 대분류별 통계
    if (!stats.대분류별통계[perf.대분류]) {
      stats.대분류별통계[perf.대분류] = { 개수: 0, 기여도합계: 0 };
    }
    stats.대분류별통계[perf.대분류].개수++;
    stats.대분류별통계[perf.대분류].기여도합계 += contribution;
    
    // 소분류별 통계
    if (!stats.소분류별통계[perf.소분류]) {
      stats.소분류별통계[perf.소분류] = { 개수: 0, 기여도합계: 0 };
    }
    stats.소분류별통계[perf.소분류].개수++;
    stats.소분류별통계[perf.소분류].기여도합계 += contribution;
  });
  
  // 비율 계산
  stats.실적입력률 = Math.round((stats.실적입력완료수 / stats.총성과수) * 100);
  stats.목표달성률 = stats.실적입력완료수 > 0 ? 
    Math.round((stats.목표달성수 / stats.실적입력완료수) * 100) : 0;
  stats.평균기여도 = Math.round(totalContribution / stats.총성과수);
  
  return stats;
};

/**
 * 전체 프로젝트의 성과 요약 통계
 * @param {Array} projects - 프로젝트 배열 (선택사항)
 * @param {Array} globalPerformances - 글로벌 성과 목록 (선택사항)
 * @returns {Object} 전체 성과 요약 통계
 */
export const calculateOverallPerformanceStats = (projects = null, globalPerformances = null) => {
  const projectList = projects || loadProjects();
  const performanceList = globalPerformances || loadPerformances();
  
  const overallStats = {
    총프로젝트수: projectList.length,
    총성과항목수: performanceList.length,
    사용중성과수: 0,
    미사용성과수: 0,
    프로젝트별평균성과수: 0,
    전체실적입력률: 0,
    전체목표달성률: 0,
    사업부별통계: {},
    대분류별집계: {},
    상태별통계: {}
  };
  
  if (projectList.length === 0) {
    overallStats.미사용성과수 = performanceList.length;
    return overallStats;
  }
  
  // 사용중인 성과 항목 ID 수집
  const usedPerformanceIds = new Set();
  let totalPerformanceCount = 0;
  let totalActualInputCount = 0;
  let totalTargetAchievedCount = 0;
  let totalActualInputProjects = 0;
  
  projectList.forEach(project => {
    // 사업부별 통계 초기화
    if (!overallStats.사업부별통계[project.사업부]) {
      overallStats.사업부별통계[project.사업부] = {
        프로젝트수: 0,
        성과수: 0,
        실적입력완료수: 0,
        목표달성수: 0
      };
    }
    overallStats.사업부별통계[project.사업부].프로젝트수++;
    
    // 상태별 통계 초기화
    if (!overallStats.상태별통계[project.진행상태]) {
      overallStats.상태별통계[project.진행상태] = {
        프로젝트수: 0,
        성과수: 0
      };
    }
    overallStats.상태별통계[project.진행상태].프로젝트수++;
    
    // 프로젝트의 성과 데이터 분석
    const projectPerformances = getProjectPerformancesWithData(project, performanceList);
    const projectStats = calculateProjectPerformanceStats(project, performanceList);
    
    totalPerformanceCount += projectPerformances.length;
    overallStats.사업부별통계[project.사업부].성과수 += projectPerformances.length;
    overallStats.상태별통계[project.진행상태].성과수 += projectPerformances.length;
    
    // 실적 입력 통계
    totalActualInputCount += projectStats.실적입력완료수;
    totalTargetAchievedCount += projectStats.목표달성수;
    overallStats.사업부별통계[project.사업부].실적입력완료수 += projectStats.실적입력완료수;
    overallStats.사업부별통계[project.사업부].목표달성수 += projectStats.목표달성수;
    
    if (projectStats.실적입력완료수 > 0) {
      totalActualInputProjects++;
    }
    
    // 사용중인 성과 ID 수집
    projectPerformances.forEach(perf => {
      usedPerformanceIds.add(perf.id);
    });
    
    // 대분류별 집계
    Object.entries(projectStats.대분류별통계).forEach(([category, stats]) => {
      if (!overallStats.대분류별집계[category]) {
        overallStats.대분류별집계[category] = {
          프로젝트수: 0,
          성과수: 0,
          총기여도: 0
        };
      }
      overallStats.대분류별집계[category].프로젝트수++;
      overallStats.대분류별집계[category].성과수 += stats.개수;
      overallStats.대분류별집계[category].총기여도 += stats.기여도합계;
    });
  });
  
  // 최종 통계 계산
  overallStats.사용중성과수 = usedPerformanceIds.size;
  overallStats.미사용성과수 = performanceList.length - usedPerformanceIds.size;
  overallStats.프로젝트별평균성과수 = totalPerformanceCount > 0 ? 
    Math.round(totalPerformanceCount / projectList.length * 10) / 10 : 0;
  overallStats.전체실적입력률 = totalPerformanceCount > 0 ? 
    Math.round((totalActualInputCount / totalPerformanceCount) * 100) : 0;
  overallStats.전체목표달성률 = totalActualInputCount > 0 ? 
    Math.round((totalTargetAchievedCount / totalActualInputCount) * 100) : 0;
  
  return overallStats;
};

/**
 * 레거시 형식으로 프로젝트 변환 (기존 컴포넌트 호환성을 위해)
 * @param {Array} projects - 새 구조의 프로젝트 배열
 * @param {Array} globalPerformances - 글로벌 성과 목록
 * @returns {Array} 레거시 형식의 프로젝트 배열
 */
export const convertProjectsToLegacyFormat = (projects = null, globalPerformances = null) => {
  const projectList = projects || loadProjects();
  const performanceList = globalPerformances || loadPerformances();
  
  return projectList.map(project => {
    const legacyPerformances = getProjectPerformancesWithData(project, performanceList);
    
    return {
      ...project,
      성과목록: legacyPerformances // 기존 형식의 성과 목록으로 덮어쓰기
    };
  });
};

/**
 * 성과 항목 검색 및 필터링
 * @param {Object} filters - 검색 필터 객체
 * @param {Array} globalPerformances - 글로벌 성과 목록 (선택사항)
 * @returns {Array} 필터링된 성과 목록
 */
export const searchPerformances = (filters, globalPerformances = null) => {
  const performances = globalPerformances || loadPerformances();
  
  return performances.filter(perf => {
    // 텍스트 검색
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      const matchesText = 
        perf.성과항목.toLowerCase().includes(searchLower) ||
        perf.대분류.toLowerCase().includes(searchLower) ||
        perf.소분류.toLowerCase().includes(searchLower) ||
        (perf.설명 && perf.설명.toLowerCase().includes(searchLower));
      
      if (!matchesText) return false;
    }
    
    // 대분류 필터
    if (filters.대분류 && filters.대분류.length > 0) {
      if (!filters.대분류.includes(perf.대분류)) return false;
    }
    
    // 소분류 필터
    if (filters.소분류 && filters.소분류.length > 0) {
      if (!filters.소분류.includes(perf.소분류)) return false;
    }
    
    // 활성 상태 필터
    if (filters.isActive !== undefined) {
      if (perf.isActive !== filters.isActive) return false;
    }
    
    // 사용 여부 필터
    if (filters.isUsed !== undefined) {
      const projects = loadProjects();
      const isUsed = getProjectsUsingPerformance(perf.id, projects).length > 0;
      if (isUsed !== filters.isUsed) return false;
    }
    
    return true;
  });
};

/**
 * 프로젝트 검색 및 필터링 (성과 연결 데이터 포함)
 * @param {Object} filters - 검색 필터 객체
 * @param {Array} projects - 프로젝트 배열 (선택사항)
 * @param {Array} globalPerformances - 글로벌 성과 목록 (선택사항)
 * @returns {Array} 필터링된 프로젝트 목록 (성과 데이터 연결 포함)
 */
export const searchProjects = (filters, projects = null, globalPerformances = null) => {
  const projectList = projects || loadProjects();
  const performanceList = globalPerformances || loadPerformances();
  
  const filteredProjects = projectList.filter(project => {
    // 기본 프로젝트 필터링
    if (filters.사업부 && !filters.사업부.includes(project.사업부)) return false;
    if (filters.진행상태 && !filters.진행상태.includes(project.진행상태)) return false;
    if (filters.프로세스 && !filters.프로세스.includes(project.프로세스)) return false;
    
    // 텍스트 검색
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      const matchesText = 
        project.과제명.toLowerCase().includes(searchLower) ||
        (project.과제PL && project.과제PL.toLowerCase().includes(searchLower)) ||
        (project.작성자 && project.작성자.toLowerCase().includes(searchLower)) ||
        (project.과제상세설명 && project.과제상세설명.toLowerCase().includes(searchLower));
      
      if (!matchesText) return false;
    }
    
    // 성과 관련 필터
    if (filters.hasPerformance !== undefined) {
      const hasPerf = project.성과목록 && project.성과목록.length > 0;
      if (hasPerf !== filters.hasPerformance) return false;
    }
    
    return true;
  });
  
  // 성과 데이터 연결
  return getAllProjectsWithPerformanceData(filteredProjects, performanceList);
};
