/**
 * 디지털 트윈 메가 과제 현황 API 서비스
 */

const API_BASE_URL = '/api/digital-twin-tech-level';

/**
 * Authorization 헤더 생성
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// ============================================
// 전체 데이터 API
// ============================================

/**
 * 저장된 데이터 목록 조회 (전체)
 */
export const fetchAllData = async () => {
  const response = await fetch(`${API_BASE_URL}/data`);
  if (!response.ok) {
    throw new Error('데이터 목록을 불러오는데 실패했습니다.');
  }
  return response.json();
};

/**
 * 특정 데이터 조회
 */
export const fetchData = async (dataId) => {
  const response = await fetch(`${API_BASE_URL}/data/${dataId}`);
  if (!response.ok) {
    throw new Error('데이터를 불러오는데 실패했습니다.');
  }
  return response.json();
};

// ============================================
// 내 데이터 API
// ============================================

/**
 * 내 데이터 목록 조회
 */
export const fetchMyData = async () => {
  const response = await fetch(`${API_BASE_URL}/data/my`, {
    method: 'GET',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '내 데이터 목록 조회 실패');
  }

  return data;
};

// ============================================
// 공용 데이터 API
// ============================================

/**
 * 공용 데이터 목록 조회
 */
export const fetchPublicData = async () => {
  const response = await fetch(`${API_BASE_URL}/data/public`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '공용 데이터 목록 조회 실패');
  }

  return data;
};

// ============================================
// 데이터 CRUD API
// ============================================

/**
 * 새 데이터 저장
 */
export const createData = async (techLevelData) => {
  const response = await fetch(`${API_BASE_URL}/data`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(techLevelData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '데이터 저장에 실패했습니다.');
  }
  return response.json();
};

/**
 * 데이터 수정
 */
export const updateData = async (dataId, techLevelData) => {
  const response = await fetch(`${API_BASE_URL}/data/${dataId}`, {
    method: 'PUT',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(techLevelData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '데이터 수정에 실패했습니다.');
  }
  return response.json();
};

/**
 * 데이터 삭제
 */
export const deleteData = async (dataId) => {
  const response = await fetch(`${API_BASE_URL}/data/${dataId}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '데이터 삭제에 실패했습니다.');
  }
  return response.json();
};
