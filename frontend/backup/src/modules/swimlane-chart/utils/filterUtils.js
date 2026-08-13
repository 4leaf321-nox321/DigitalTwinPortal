/**
 * 필터링 관련 유틸리티 함수들
 */

/**
 * 필터 조건에 따라 프로세스가 표시되어야 하는지 확인
 * @param {Object} process - 프로세스 객체
 * @param {Object} filters - 활성 필터 객체
 * @returns {boolean} - 표시 여부
 */
export const shouldShowProcess = (process, filters) => {
  if (!process || !filters) return true;

  // 날짜 범위 필터 (현재는 프로세스에 날짜 정보가 없어서 스킵)
  // TODO: 프로세스에 startDate, endDate 추가 시 구현
  if (filters.dateRange?.start || filters.dateRange?.end) {
    // 날짜 필터가 설정되어 있지만 프로세스에 날짜 정보가 없으면 표시
    if (!process.startDate && !process.endDate) {
      // 날짜 정보가 없는 프로세스는 필터링하지 않음
    }
  }

  // 카테고리 필터
  if (filters.categories?.length > 0) {
    if (!process.category || !filters.categories.includes(process.category)) {
      return false;
    }
  }

  // 상태 필터
  if (filters.statuses?.length > 0) {
    if (!process.status || !filters.statuses.includes(process.status)) {
      return false;
    }
  }

  // 태그 필터
  if (filters.tags?.length > 0) {
    const processTags = process.tags ? 
      process.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];
    
    // 선택된 태그 중 하나라도 프로세스에 있으면 표시
    const hasMatchingTag = filters.tags.some(filterTag => 
      processTags.includes(filterTag)
    );
    
    if (!hasMatchingTag) {
      return false;
    }
  }

  // 담당자 필터
  if (filters.owners?.length > 0) {
    const processOwners = [];
    if (process.primaryOwner) processOwners.push(process.primaryOwner);
    if (process.collaborators) {
      processOwners.push(...process.collaborators.split(',').map(c => c.trim()).filter(Boolean));
    }

    // 선택된 담당자 중 하나라도 프로세스에 있으면 표시
    const hasMatchingOwner = filters.owners.some(filterOwner =>
      processOwners.includes(filterOwner)
    );

    if (!hasMatchingOwner) {
      return false;
    }
  }

  // 진행률 필터
  if (filters.progressRange) {
    const progress = process.progress || 0;
    const { min = 0, max = 100 } = filters.progressRange;
    
    if (progress < min || progress > max) {
      return false;
    }
  }

  return true;
};

/**
 * 셀 데이터에 필터를 적용
 * @param {Object} cellData - 원본 셀 데이터
 * @param {Object} filters - 활성 필터 객체
 * @returns {Object} - 필터링된 셀 데이터
 */
export const applyFiltersToChartData = (cellData, filters) => {
  if (!cellData || !filters) return cellData;

  const filteredCellData = {};

  Object.entries(cellData).forEach(([cellId, cell]) => {
    if (!cell || !cell.processes) {
      filteredCellData[cellId] = cell;
      return;
    }

    // 프로세스 필터링
    const filteredProcesses = cell.processes.filter(process => 
      shouldShowProcess(process, filters)
    );

    // 필터링된 프로세스가 있는 경우에만 셀을 포함
    if (filteredProcesses.length > 0) {
      // 연결선도 필터링 (양쪽 프로세스가 모두 표시되는 경우에만 유지)
      const filteredProcessIds = new Set(filteredProcesses.map(p => p.id));
      const filteredConnections = (cell.connections || []).filter(connection =>
        filteredProcessIds.has(connection.from) && filteredProcessIds.has(connection.to)
      );

      filteredCellData[cellId] = {
        ...cell,
        processes: filteredProcesses,
        connections: filteredConnections
      };
    }
  });

  return filteredCellData;
};

/**
 * 필터 조건이 활성화되어 있는지 확인
 * @param {Object} filters - 필터 객체
 * @returns {boolean} - 활성 필터 존재 여부
 */
export const hasActiveFilters = (filters) => {
  if (!filters) return false;

  // 날짜 범위 필터
  if (filters.dateRange?.start || filters.dateRange?.end) {
    return true;
  }

  // 진행률 범위 필터
  if (filters.progressRange?.min > 0 || filters.progressRange?.max < 100) {
    return true;
  }

  // 배열 필터들
  const arrayFilters = ['categories', 'statuses', 'tags', 'owners'];
  return arrayFilters.some(filterType => 
    filters[filterType] && filters[filterType].length > 0
  );
};

/**
 * 필터에 매칭되는 프로세스 개수 반환
 * @param {Object} cellData - 셀 데이터
 * @param {Object} filters - 필터 객체
 * @returns {Object} - { total: 전체 개수, filtered: 필터링된 개수 }
 */
export const getFilterStats = (cellData, filters) => {
  let total = 0;
  let filtered = 0;

  if (cellData) {
    Object.values(cellData).forEach(cell => {
      if (cell?.processes) {
        total += cell.processes.length;
        filtered += cell.processes.filter(process => 
          shouldShowProcess(process, filters)
        ).length;
      }
    });
  }

  return { total, filtered };
};

/**
 * 필터 초기값 생성
 * @returns {Object} - 기본 필터 객체
 */
export const createDefaultFilters = () => ({
  dateRange: { start: '', end: '' },
  categories: [],
  statuses: [],
  tags: [],
  owners: [],
  progressRange: { min: 0, max: 100 }
});

/**
 * 필터 상태를 로컬 스토리지에 저장 (선택적)
 * @param {Object} filters - 필터 객체
 * @param {string} key - 저장할 키 이름
 */
export const saveFiltersToStorage = (filters, key = 'swimlane-filters') => {
  try {
    localStorage.setItem(key, JSON.stringify(filters));
  } catch (error) {
    console.warn('Failed to save filters to localStorage:', error);
  }
};

/**
 * 로컬 스토리지에서 필터 상태 로드 (선택적)
 * @param {string} key - 로드할 키 이름
 * @returns {Object|null} - 저장된 필터 객체 또는 null
 */
export const loadFiltersFromStorage = (key = 'swimlane-filters') => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to load filters from localStorage:', error);
    return null;
  }
};
