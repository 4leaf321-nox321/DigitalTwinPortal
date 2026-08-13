/**
 * DX Work Process - 그래프 API 서비스
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ============================================
// 내 그래프 목록 API
// ============================================

/**
 * 내 그래프 목록 조회
 */
export const fetchMyGraphs = async () => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/dx-work-process/my-graphs`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '그래프 목록 조회 실패');
  }

  return data.data;
};

/**
 * 특정 그래프 조회 (데이터 포함)
 */
export const fetchMyGraph = async (graphId, includeData = true) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(
    `${API_BASE_URL}/dx-work-process/my-graphs/${graphId}?include_data=${includeData}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '그래프 조회 실패');
  }

  return data.data;
};

// ============================================
// 그래프 생성/수정/삭제 API
// ============================================

/**
 * 새 그래프 생성
 */
export const createGraph = async (graphData) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/dx-work-process/my-graphs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(graphData)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '그래프 생성 실패');
  }

  return data.data;
};

/**
 * 그래프 정보 수정
 */
export const updateGraph = async (graphId, graphData) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/dx-work-process/my-graphs/${graphId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(graphData)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '그래프 수정 실패');
  }

  return data.data;
};

/**
 * 그래프 삭제
 */
export const deleteGraph = async (graphId) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/dx-work-process/my-graphs/${graphId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '그래프 삭제 실패');
  }

  return data;
};

// ============================================
// 그래프 데이터 저장 API
// ============================================

/**
 * 그래프 데이터 저장 (노드, 엣지, 설정)
 */
export const saveGraphData = async (graphId, graphData) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/dx-work-process/my-graphs/${graphId}/data`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(graphData)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '그래프 데이터 저장 실패');
  }

  return data.data;
};

// ============================================
// 공용 그래프 API
// ============================================

/**
 * 공용 그래프 목록 조회
 */
export const fetchPublicGraphs = async () => {
  const response = await fetch(`${API_BASE_URL}/dx-work-process/public-graphs`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '공용 그래프 목록 조회 실패');
  }

  return data.data;
};

/**
 * 특정 공용 그래프 조회 (데이터 포함)
 */
export const fetchPublicGraph = async (graphId, includeData = true) => {
  const response = await fetch(
    `${API_BASE_URL}/dx-work-process/public-graphs/${graphId}?include_data=${includeData}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '공용 그래프 조회 실패');
  }

  return data.data;
};
