// 태스크 관련 유틸리티 함수들 (로컬 시간 기준으로 통일)

import { getDaysBetween, getDateRange } from './dateUtils';
import { toLocalYmd } from '../../../shared/utils/localDate';

/**
 * 태스크의 진행률에 따른 상태 반환
 */
export const getTaskStatus = (progress) => {
  if (progress === 0) return 'notStarted';
  if (progress === 100) return 'completed';
  return 'inProgress';
};

/**
 * 태스크가 지연되었는지 확인
 */
export const isTaskDelayed = (task) => {
  const today = new Date();
  const endDate = new Date(task.endDate);
  return today > endDate && task.progress < 100;
};

/**
 * 태스크의 기간 계산 (일)
 */
export const getTaskDuration = (task) => {
  return getDaysBetween(task.startDate, task.endDate) + 1;
};

/**
 * 태스크가 부모 태스크인지 동적으로 확인
 */
export const isParentTask = (taskId, allTasks) => {
  return allTasks.some(task => task.parentId === taskId);
};

/**
 * 특정 태스크의 직계 테스크 ID 목록 가져오기
 */
export const getChildrenIds = (taskId, allTasks) => {
  return allTasks.filter(task => task.parentId === taskId).map(task => task.id);
};

/**
 * 계층 구조를 고려한 태스크 정렬
 */
export const sortTasksHierarchically = (tasks) => {
  const result = [];
  
  // 최상위 태스크들 (level 0) 먼저 찾기
  const rootTasks = tasks.filter(t => t.level === 0);
  
  const addTasksRecursively = (taskId, currentLevel) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    result.push(task);
    
    // 하위 테스크들이 있고 collapsed되지 않았으면 추가
    if (isParentTask(taskId, tasks) && !task.collapsed) {
      const childrenIds = getChildrenIds(taskId, tasks);
      childrenIds.forEach(childId => {
        addTasksRecursively(childId, currentLevel + 1);
      });
    }
  };
  
  rootTasks.forEach(rootTask => {
    addTasksRecursively(rootTask.id, 0);
  });
  
  return result;
};

/**
 * 부모 태스크의 진행률을 하위 테스크들의 평균으로 계산
 */
export const calculateParentProgress = (parentTask, allTasks) => {
  const childrenIds = getChildrenIds(parentTask.id, allTasks);
  if (childrenIds.length === 0) {
    return parentTask.progress;
  }
  
  const childTasks = childrenIds
    .map(childId => allTasks.find(t => t.id === childId))
    .filter(Boolean);
  
  if (childTasks.length === 0) return parentTask.progress;
  
  const totalProgress = childTasks.reduce((sum, child) => {
    if (isParentTask(child.id, allTasks)) {
      return sum + calculateParentProgress(child, allTasks);
    }
    return sum + child.progress;
  }, 0);
  
  return Math.round(totalProgress / childTasks.length);
};

/**
 * 부모 태스크의 날짜를 하위 테스크들의 범위로 자동 계산
 */
export const calculateParentDates = (parentTask, allTasks) => {
  const childrenIds = getChildrenIds(parentTask.id, allTasks);
  if (childrenIds.length === 0) {
    return {
      startDate: parentTask.startDate,
      endDate: parentTask.endDate
    };
  }
  
  const childTasks = childrenIds
    .map(childId => allTasks.find(t => t.id === childId))
    .filter(Boolean);
  
  if (childTasks.length === 0) {
    return {
      startDate: parentTask.startDate,
      endDate: parentTask.endDate
    };
  }
  
  const childDates = childTasks.map(child => ({
    startDate: new Date(child.startDate),
    endDate: new Date(child.endDate)
  }));
  
  const earliestStart = new Date(Math.min(...childDates.map(d => d.startDate)));
  const latestEnd = new Date(Math.max(...childDates.map(d => d.endDate)));
  
  return {
    startDate: toLocalYmd(earliestStart),
    endDate: toLocalYmd(latestEnd)
  };
};

/**
 * 태스크 트리 구조에서 특정 태스크의 토글 상태 변경
 */
export const toggleTaskCollapse = (tasks, taskId) => {
  return tasks.map(task => {
    if (task.id === taskId && isParentTask(taskId, tasks)) {
      return { ...task, collapsed: !task.collapsed };
    }
    return task;
  });
};

/**
 * 의존성이 있는 태스크들의 순서 정렬 (위상 정렬)
 */
export const sortTasksByDependencies = (tasks) => {
  const sorted = [];
  const visited = new Set();
  const visiting = new Set();
  
  const visit = (taskId) => {
    if (visited.has(taskId)) return;
    if (visiting.has(taskId)) {
      console.warn('Circular dependency detected:', taskId);
      return;
    }
    
    visiting.add(taskId);
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // 의존하는 태스크들을 먼저 방문
    if (task.dependencies) {
      task.dependencies.forEach(depId => {
        visit(depId);
      });
    }
    
    visiting.delete(taskId);
    visited.add(taskId);
    
    if (!sorted.find(t => t.id === taskId)) {
      sorted.push(task);
    }
  };
  
  tasks.forEach(task => {
    visit(task.id);
  });
  
  return sorted;
};

/**
 * 정확한 날짜 기반 태스크 위치 계산 (로컬 시간 기준으로 통일)
 * @param {Object} task - 태스크 객체
 * @param {Date} displayRangeStart - 표시 범위 시작날짜 (projectStart 또는 customDateRange.start)
 * @param {number} dayWidth - 하루의 픽셀 너비
 * @param {string} viewMode - 뷰 모드 ('days', 'weeks', 'months', 'years')
 * @param {number} scale - 현재 스케일 값
 */
export const calculateTaskPosition = (task, displayRangeStart, dayWidth, viewMode = 'weeks', scale = 1) => {
  // 로컬 시간 기준으로 정확한 날짜 계산을 위해 시간 부분을 정규화
  const normalizeDate = (date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };
  
  const taskStart = normalizeDate(new Date(task.startDate));
  const taskEnd = normalizeDate(new Date(task.endDate));
  
  // displayRangeStart는 이미 그룹화 함수에서 확장된 상태 (예: getWeekStart된 날짜)
  const displayStart = normalizeDate(displayRangeStart);
  
  // 정확한 일수 계산 (밀리초 단위로 계산)
  const msPerDay = 1000 * 60 * 60 * 24;
  const startOffsetDays = Math.round((taskStart.getTime() - displayStart.getTime()) / msPerDay);
  const durationDays = Math.round((taskEnd.getTime() - taskStart.getTime()) / msPerDay) + 1;
  
  // 모든 뷰 모드에서 일별 계산 사용 (단순화)
  const left = startOffsetDays * dayWidth;
  const width = durationDays * dayWidth;
  
  // 최소 너비 보장 및 위치 정규화
  const minWidth = Math.max(2, scale * 8);
  
  return {
    left: Math.max(0, left),
    width: Math.max(minWidth, width),
    duration: durationDays
  };
};


/**
 * 크리티컬 패스 계산
 */
export const calculateCriticalPath = (tasks) => {
  // 간단한 크리티컬 패스 계산 (실제로는 더 복잡한 알고리즘 필요)
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const criticalTasks = [];
  
  // 종료일이 늦은 순으로 정렬
  const sortedTasks = [...tasks].sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
  
  for (const task of sortedTasks) {
    // 의존성이 많거나 기간이 긴 태스크를 크리티컬로 판단
    const hasDependents = tasks.some(t => t.dependencies?.includes(task.id));
    const isLongDuration = getTaskDuration(task) > 7; // 7일 이상
    
    if (hasDependents || isLongDuration) {
      criticalTasks.push(task.id);
    }
  }
  
  return criticalTasks;
};

/**
 * 태스크 검증 (개선된 버전)
 */
export const validateTask = (task) => {
  const errors = [];
  
  if (!task.name || task.name.trim() === '') {
    errors.push('태스크 이름을 입력해주세요.');
  }
  
  if (!task.startDate) {
    errors.push('시작 날짜를 선택해주세요.');
  }
  
  if (!task.endDate) {
    errors.push('종료 날짜를 선택해주세요.');
  }
  
  if (task.startDate && task.endDate && new Date(task.startDate) > new Date(task.endDate)) {
    errors.push('시작 날짜는 종료 날짜보다 이전이어야 합니다.');
  }
  
  if (task.progress < 0 || task.progress > 100) {
    errors.push('진행률은 0-100% 사이여야 합니다.');
  }
  
  // 레벨 검증
  if (task.level < 0 || task.level > 5) {
    errors.push('태스크 레벨은 0-5 사이여야 합니다.');
  }
  
  return errors;
};

/**
 * 태스크 위치 계산 디버깅 도구
 */
export const debugTaskPosition = (task, displayRangeStart, dayWidth, viewMode, scale) => {
  const normalizeDate = (date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };
  
  const taskStart = normalizeDate(new Date(task.startDate));
  const taskEnd = normalizeDate(new Date(task.endDate));
  const displayStart = normalizeDate(displayRangeStart);
  
  const position = calculateTaskPosition(task, displayRangeStart, dayWidth, viewMode, scale);
  const msPerDay = 1000 * 60 * 60 * 24;
  const startOffset = (taskStart.getTime() - displayStart.getTime()) / msPerDay;
  const duration = (taskEnd.getTime() - taskStart.getTime()) / msPerDay + 1;
  
  console.log(`[DEBUG] Task: ${task.name}`);
  console.log(`[DEBUG] Start Date: ${task.startDate}, End Date: ${task.endDate}`);
  console.log(`[DEBUG] Normalized Task Start: ${taskStart.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
  console.log(`[DEBUG] Display Range Start: ${displayStart.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
  console.log(`[DEBUG] Start Offset (days): ${startOffset}`);
  console.log(`[DEBUG] Duration (days): ${duration}`);
  console.log(`[DEBUG] Day Width: ${dayWidth}px`);
  console.log(`[DEBUG] View Mode: ${viewMode}, Scale: ${scale}`);
  console.log(`[DEBUG] Position - Left: ${position.left}px, Width: ${position.width}px`);
  console.log(`[DEBUG] Expected Left: ${startOffset * dayWidth}px, Expected Width: ${duration * dayWidth}px`);
  console.log('[DEBUG] ---');
  
  return position;
};

/**
 * 태스크 필터링 (개선된 버전)
 */
export const filterTasks = (tasks, filters) => {
  return tasks.filter(task => {
    // 카테고리 필터
    if (filters.categories && filters.categories.length > 0) {
      if (!filters.categories.includes(task.category)) return false;
    }
    
    // 담당자 필터
    if (filters.assignees && filters.assignees.length > 0) {
      if (!filters.assignees.includes(task.assignee)) return false;
    }
    
    // 진행 상태 필터
    if (filters.statuses && filters.statuses.length > 0) {
      const status = getTaskStatus(task.progress);
      if (!filters.statuses.includes(status)) return false;
    }
    
    // 우선순위 필터
    if (filters.priorities && filters.priorities.length > 0) {
      if (!filters.priorities.includes(task.priority)) return false;
    }
    
    // 날짜 범위 필터
    if (filters.dateRange) {
      const taskStart = new Date(task.startDate);
      const taskEnd = new Date(task.endDate);
      const filterStart = new Date(filters.dateRange.start);
      const filterEnd = new Date(filters.dateRange.end);
      
      if (taskEnd < filterStart || taskStart > filterEnd) return false;
    }
    
    // 레벨 필터 (부모/하위 태스크만 보기)
    if (filters.showParentsOnly && !isParentTask(task.id, tasks)) return false;
    if (filters.showTasksOnly && isParentTask(task.id, tasks)) return false;
    
    return true;
  });
};

/**
 * 모든 담당자 목록 추출
 */
export const getAllAssignees = (tasks) => {
  const assignees = new Set();
  tasks.forEach(task => {
    if (task.assignee && task.assignee.trim() !== '') {
      assignees.add(task.assignee);
    }
  });
  return Array.from(assignees).sort();
};

/**
 * 모든 카테고리 목록 추출
 */
export const getAllCategories = (tasks) => {
  const categories = new Set();
  tasks.forEach(task => {
    if (task.category) {
      categories.add(task.category);
    }
  });
  return Array.from(categories).sort();
};

/**
 * 태스크 트리 구조에서 특정 태스크의 모든 하위 테스크 ID 가져오기 (재귀적)
 */
export const getAllChildrenIds = (task, allTasks) => {
  const childrenIds = [];
  const directChildrenIds = getChildrenIds(task.id, allTasks);
  
  directChildrenIds.forEach(childId => {
    childrenIds.push(childId);
    const childTask = allTasks.find(t => t.id === childId);
    if (childTask && isParentTask(childId, allTasks)) {
      childrenIds.push(...getAllChildrenIds(childTask, allTasks));
    }
  });
  
  return childrenIds;
};

/**
 * 태스크 계층 구조 유효성 검사 (개선된 버전)
 */
export const validateTaskHierarchy = (tasks) => {
  const errors = [];
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  
  tasks.forEach(task => {
    // 부모 태스크 검증
    if (task.parentId) {
      const parent = taskMap.get(task.parentId);
      if (!parent) {
        errors.push(`태스크 "${task.name}"의 부모 태스크를 찾을 수 없습니다.`);
      }
    }
    
    // 순환 참조 검증
    if (task.parentId === task.id) {
      errors.push(`태스크 "${task.name}"이 자기 자신을 부모로 참조하고 있습니다.`);
    }
    
    // 깊은 계층 구조 경고
    if (task.level > 3) {
      errors.push(`태스크 "${task.name}"의 계층이 너무 깊습니다 (레벨 ${task.level}). 최대 3레벨까지 권장합니다.`);
    }
  });
  
  return errors;
};