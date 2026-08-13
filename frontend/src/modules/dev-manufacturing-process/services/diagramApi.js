/**
 * 프로세스 다이어그램 API 서비스
 */

const API_BASE_URL = '/api/dev-manufacturing-process';

/**
 * Authorization 헤더 생성
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// ============================================
// 전체 다이어그램 API (기존 호환)
// ============================================

/**
 * 저장된 다이어그램 목록 조회 (전체)
 */
export const fetchDiagrams = async () => {
  const response = await fetch(`${API_BASE_URL}/diagrams`);
  if (!response.ok) {
    throw new Error('다이어그램 목록을 불러오는데 실패했습니다.');
  }
  return response.json();
};

/**
 * 특정 다이어그램 조회
 */
export const fetchDiagram = async (diagramId) => {
  const response = await fetch(`${API_BASE_URL}/diagrams/${diagramId}`);
  if (!response.ok) {
    throw new Error('다이어그램을 불러오는데 실패했습니다.');
  }
  return response.json();
};

// ============================================
// 내 다이어그램 API
// ============================================

/**
 * 내 다이어그램 목록 조회
 */
export const fetchMyDiagrams = async () => {
  const response = await fetch(`${API_BASE_URL}/diagrams/my`, {
    method: 'GET',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '내 다이어그램 목록 조회 실패');
  }

  return data;
};

// ============================================
// 공용 다이어그램 API
// ============================================

/**
 * 공용 다이어그램 목록 조회
 */
export const fetchPublicDiagrams = async () => {
  const response = await fetch(`${API_BASE_URL}/diagrams/public`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '공용 다이어그램 목록 조회 실패');
  }

  return data;
};

// ============================================
// 다이어그램 CRUD API
// ============================================

/**
 * 새 다이어그램 저장
 */
export const createDiagram = async (diagramData) => {
  const response = await fetch(`${API_BASE_URL}/diagrams`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(diagramData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '다이어그램 저장에 실패했습니다.');
  }
  return response.json();
};

/**
 * 다이어그램 수정
 */
export const updateDiagram = async (diagramId, diagramData) => {
  const response = await fetch(`${API_BASE_URL}/diagrams/${diagramId}`, {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(diagramData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '다이어그램 수정에 실패했습니다.');
  }
  return response.json();
};

/**
 * 다이어그램 삭제
 */
export const deleteDiagram = async (diagramId) => {
  const response = await fetch(`${API_BASE_URL}/diagrams/${diagramId}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '다이어그램 삭제에 실패했습니다.');
  }
  return response.json();
};
