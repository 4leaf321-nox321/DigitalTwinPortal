/**
 * Gantt Chart 데이터의 CSV 변환을 위한 유틸리티
 */

/**
 * Task 데이터를 CSV 형태로 변환
 * @param {Array} tasks - 태스크 배열
 * @returns {Array} CSV 형태의 데이터 배열
 */
export const tasksToCSV = (tasks) => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return [];
  }

  return tasks.map(task => ({
    'ID': task.id,
    'Name': task.name || '',
    'Description': task.description || '',
    'Start Date': task.startDate || '',
    'End Date': task.endDate || '',
    'Duration (Days)': task.duration || 0,
    'Progress (%)': task.progress || 0,
    'Status': task.status || '',
    'Priority': task.priority || '',
    'Assignee': task.assignee || '',
    'Parent ID': task.parentId || '',
    'Is Parent': task.isParent ? 'true' : 'false',
    'Color': task.color || '',
    'Notes': task.notes || '',
    'Created At': task.createdAt || '',
    'Updated At': task.updatedAt || ''
  }));
};

/**
 * CSV 데이터를 Task 형태로 변환
 * @param {Array} csvData - CSV 데이터 배열
 * @returns {Array} Task 배열
 */
export const csvToTasks = (csvData) => {
  if (!Array.isArray(csvData) || csvData.length === 0) {
    return [];
  }

  return csvData.map((row, index) => {
    // ID가 없으면 자동 생성
    const id = row.ID || row.id || `task_${Date.now()}_${index}`;
    
    return {
      id,
      name: row.Name || row.name || `Task ${index + 1}`,
      description: row.Description || row.description || '',
      startDate: row['Start Date'] || row.startDate || '',
      endDate: row['End Date'] || row.endDate || '',
      duration: parseInt(row['Duration (Days)'] || row.duration || 0),
      progress: parseInt(row['Progress (%)'] || row.progress || 0),
      status: row.Status || row.status || 'planned',
      priority: row.Priority || row.priority || 'medium',
      assignee: row.Assignee || row.assignee || '',
      parentId: row['Parent ID'] || row.parentId || null,
      isParent: (row['Is Parent'] || row.isParent || 'false').toString().toLowerCase() === 'true',
      color: row.Color || row.color || '#4a90e2',
      notes: row.Notes || row.notes || '',
      createdAt: row['Created At'] || row.createdAt || new Date().toISOString(),
      updatedAt: row['Updated At'] || row.updatedAt || new Date().toISOString()
    };
  });
};

/**
 * CSV 데이터 유효성 검증 (Gantt Chart용)
 * @param {Array} data - 검증할 데이터
 * @returns {Object} 검증 결과
 */
export const validateGanttCSVData = (data) => {
  const result = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!Array.isArray(data) || data.length === 0) {
    result.isValid = false;
    result.errors.push('데이터가 비어있거나 올바른 형식이 아닙니다.');
    return result;
  }

  const requiredFields = ['Name', 'name'];
  const firstRow = data[0];
  const availableFields = Object.keys(firstRow);
  
  // 필수 필드 중 하나라도 있는지 확인
  const hasNameField = requiredFields.some(field => availableFields.includes(field));
  if (!hasNameField) {
    result.errors.push('태스크 이름 필드 (Name 또는 name)가 필요합니다.');
    result.isValid = false;
  }

  // 날짜 형식 검증
  data.forEach((row, index) => {
    const rowNum = index + 1;
    
    // 시작 날짜 검증
    const startDate = row['Start Date'] || row.startDate;
    if (startDate && !isValidDate(startDate)) {
      result.warnings.push(`${rowNum}행: 시작 날짜 형식이 올바르지 않습니다 (${startDate})`);
    }
    
    // 종료 날짜 검증
    const endDate = row['End Date'] || row.endDate;
    if (endDate && !isValidDate(endDate)) {
      result.warnings.push(`${rowNum}행: 종료 날짜 형식이 올바르지 않습니다 (${endDate})`);
    }
    
    // 진행률 검증
    const progress = row['Progress (%)'] || row.progress;
    if (progress !== undefined && progress !== '') {
      const progressNum = parseInt(progress);
      if (isNaN(progressNum) || progressNum < 0 || progressNum > 100) {
        result.warnings.push(`${rowNum}행: 진행률은 0-100 사이의 숫자여야 합니다 (${progress})`);
      }
    }
  });

  return result;
};

/**
 * 날짜 유효성 검증
 * @param {string} dateString - 날짜 문자열
 * @returns {boolean} 유효한 날짜인지 여부
 */
const isValidDate = (dateString) => {
  if (!dateString) return true; // 빈 값은 허용
  
  // 다양한 날짜 형식 지원
  const date = new Date(dateString);
  return !isNaN(date.getTime());
};

/**
 * Task 데이터를 계층 구조를 고려하여 CSV로 변환
 * @param {Array} tasks - 태스크 배열
 * @returns {Array} 계층 구조가 표현된 CSV 데이터
 */
export const tasksToHierarchicalCSV = (tasks) => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return [];
  }

  // 부모-자식 관계 매핑
  const taskMap = new Map();
  const parentMap = new Map();
  
  tasks.forEach(task => {
    taskMap.set(task.id, task);
    if (task.parentId) {
      if (!parentMap.has(task.parentId)) {
        parentMap.set(task.parentId, []);
      }
      parentMap.get(task.parentId).push(task.id);
    }
  });

  // 계층 구조 표현을 위한 레벨 계산
  const calculateLevel = (taskId, visited = new Set()) => {
    if (visited.has(taskId)) return 0; // 순환 참조 방지
    visited.add(taskId);
    
    const task = taskMap.get(taskId);
    if (!task || !task.parentId) return 0;
    
    return 1 + calculateLevel(task.parentId, visited);
  };

  return tasks.map(task => {
    const level = calculateLevel(task.id);
    const indent = '  '.repeat(level); // 들여쓰기로 계층 표현
    
    return {
      'Level': level,
      'ID': task.id,
      'Name': indent + (task.name || ''),
      'Description': task.description || '',
      'Start Date': task.startDate || '',
      'End Date': task.endDate || '',
      'Duration (Days)': task.duration || 0,
      'Progress (%)': task.progress || 0,
      'Status': task.status || '',
      'Priority': task.priority || '',
      'Assignee': task.assignee || '',
      'Parent ID': task.parentId || '',
      'Is Parent': task.isParent ? 'true' : 'false',
      'Child Count': parentMap.get(task.id)?.length || 0,
      'Color': task.color || '',
      'Notes': task.notes || '',
      'Created At': task.createdAt || '',
      'Updated At': task.updatedAt || ''
    };
  });
};