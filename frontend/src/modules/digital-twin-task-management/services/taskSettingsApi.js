const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ============================================
// 설정 API
// ============================================

export const fetchTaskSettings = async () => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-task-management/settings`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '설정 조회 실패');
  }

  return data.data;
};

export const saveTaskSettingsApi = async (settingsData) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-task-management/settings`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(settingsData)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '설정 저장 실패');
  }

  return data.data;
};

// ============================================
// 과제 데이터 API (서버 동기화)
// ============================================

/**
 * 서버에서 과제 데이터 조회
 * @returns {{ version: number, tasks: Array, metadata: object }}
 */
export const fetchTaskData = async () => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-task-management/data`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '데이터 조회 실패');
  }

  return data.data;
};

/**
 * 서버에 과제 데이터 업서트 (uuid 기반 병합, updatedAt 기준 최신 데이터만 반영)
 * @param {{ tasks: Array, metadata?: object }} uploadData
 * @returns {{ version: number, tasks: Array, stats: object }}
 */
export const upsertTaskData = async (uploadData) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-task-management/data/upsert`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(uploadData)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '데이터 업서트 실패');
  }

  return data.data;
};

/**
 * 서버에서 과제 소프트 삭제
 * @param {string} taskUuid
 * @returns {{ version: number }}
 */
export const softDeleteTask = async (taskUuid) => {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/digital-twin-task-management/task/${taskUuid}/delete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || '과제 삭제 실패');
  }

  return data.data;
};

// ============================================
// UUID 생성 유틸
// ============================================

/**
 * RFC4122 v4 UUID 생성
 */
export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
