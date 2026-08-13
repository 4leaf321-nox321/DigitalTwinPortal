/**
 * [MODULE_NAME] 유틸리티 함수들
 * 
 * 모듈별로 자주 사용되는 유틸리티 함수들을 여기에 정의하세요.
 */

// 데이터 포맷팅 함수
export const formatData = (rawData) => {
  if (!rawData) return null;
  
  return {
    id: rawData.id || Date.now(),
    label: rawData.name || rawData.label || 'Untitled',
    value: rawData.value || 0,
    formattedDate: rawData.createdAt 
      ? new Date(rawData.createdAt).toLocaleDateString('ko-KR')
      : new Date().toLocaleDateString('ko-KR')
  };
};

// 입력값 검증 함수
export const validateInput = (input, rules = {}) => {
  const errors = [];
  
  // 필수 입력 체크
  if (rules.required && (!input || input.toString().trim() === '')) {
    errors.push('이 필드는 필수입니다.');
  }
  
  // 최소 길이 체크
  if (rules.minLength && input && input.length < rules.minLength) {
    errors.push(`최소 ${rules.minLength}자 이상 입력해주세요.`);
  }
  
  // 최대 길이 체크
  if (rules.maxLength && input && input.length > rules.maxLength) {
    errors.push(`최대 ${rules.maxLength}자까지 입력 가능합니다.`);
  }
  
  // 숫자 검증
  if (rules.isNumber && input && isNaN(Number(input))) {
    errors.push('숫자만 입력 가능합니다.');
  }
  
  // 이메일 검증
  if (rules.isEmail && input) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input)) {
      errors.push('올바른 이메일 형식을 입력해주세요.');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// 배열 필터링 함수
export const filterArray = (array, filters = {}) => {
  if (!Array.isArray(array)) return [];
  
  return array.filter(item => {
    // 텍스트 검색
    if (filters.search) {
      const searchText = filters.search.toLowerCase();
      const itemText = (item.name || item.label || '').toLowerCase();
      if (!itemText.includes(searchText)) return false;
    }
    
    // 타입 필터
    if (filters.type && item.type !== filters.type) {
      return false;
    }
    
    // 상태 필터
    if (filters.status && item.status !== filters.status) {
      return false;
    }
    
    // 날짜 범위 필터
    if (filters.dateFrom || filters.dateTo) {
      const itemDate = new Date(item.createdAt || item.date);
      if (filters.dateFrom && itemDate < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && itemDate > new Date(filters.dateTo)) return false;
    }
    
    return true;
  });
};

// 데이터 정렬 함수
export const sortArray = (array, sortBy = 'name', sortOrder = 'asc') => {
  if (!Array.isArray(array)) return [];
  
  return [...array].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];
    
    // 문자열의 경우 대소문자 무시
    if (typeof aValue === 'string') aValue = aValue.toLowerCase();
    if (typeof bValue === 'string') bValue = bValue.toLowerCase();
    
    // 날짜의 경우
    if (sortBy.includes('date') || sortBy.includes('Date')) {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    }
    
    if (aValue < bValue) {
      return sortOrder === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortOrder === 'asc' ? 1 : -1;
    }
    return 0;
  });
};

// 파일 다운로드 함수
export const downloadFile = (data, filename, type = 'application/json') => {
  try {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('파일 다운로드 실패:', error);
    return false;
  }
};

// 파일 업로드 함수
export const uploadFile = (acceptTypes = '.json') => {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = acceptTypes;
    
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (!file) {
        reject(new Error('파일이 선택되지 않았습니다.'));
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const result = JSON.parse(e.target.result);
          resolve({ file, data: result });
        } catch (error) {
          reject(new Error('JSON 파일을 파싱할 수 없습니다.'));
        }
      };
      reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
      reader.readAsText(file);
    };
    
    input.click();
  });
};

// 색상 유틸리티
export const getContrastColor = (hexColor) => {
  // HEX 색상에서 RGB 추출
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // 밝기 계산 (0-255)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  return brightness > 128 ? '#000000' : '#FFFFFF';
};

// 랜덤 색상 생성
export const getRandomColor = () => {
  const colors = [
    '#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
    '#1abc9c', '#34495e', '#95a5a6', '#e67e22', '#d35400'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// 지연 함수 (async/await용)
export const delay = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// 디바운스 함수
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// 로컬 스토리지 헬퍼
export const storage = {
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('로컬 스토리지 저장 실패:', error);
      return false;
    }
  },
  
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('로컬 스토리지 로드 실패:', error);
      return defaultValue;
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('로컬 스토리지 삭제 실패:', error);
      return false;
    }
  },
  
  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('로컬 스토리지 초기화 실패:', error);
      return false;
    }
  }
};
