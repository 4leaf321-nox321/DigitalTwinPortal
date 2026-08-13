const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export const fetchTemplates = async () => {
  const response = await fetch(`${API_BASE_URL}/auto-document/templates`, {
    headers: getHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || '템플릿 목록 조회 실패');
  return data.data;
};

export const fetchPlaceholders = async (template) => {
  const response = await fetch(`${API_BASE_URL}/auto-document/templates/placeholders`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ template })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || '플레이스홀더 스캔 실패');
  return data.data;
};

export const fetchDataSources = async () => {
  const response = await fetch(`${API_BASE_URL}/auto-document/datasources`, {
    headers: getHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || '데이터 소스 조회 실패');
  return data.data;
};

export const fetchStats = async (year) => {
  const params = year ? `?year=${year}` : '';
  const response = await fetch(`${API_BASE_URL}/auto-document/stats${params}`, {
    headers: getHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || '통계 데이터 조회 실패');
  return data.data;
};

export const fetchPresets = async (mode) => {
  const params = mode ? `?mode=${mode}` : '';
  const response = await fetch(`${API_BASE_URL}/auto-document/presets${params}`, {
    headers: getHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || '프리셋 조회 실패');
  return data.data;
};

export const savePreset = async (preset) => {
  const response = await fetch(`${API_BASE_URL}/auto-document/presets`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(preset)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || '프리셋 저장 실패');
  return data.data;
};

export const deletePreset = async (presetId) => {
  const response = await fetch(`${API_BASE_URL}/auto-document/presets/${presetId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || '프리셋 삭제 실패');
  return data.data;
};

export const generateBatchDocument = async (template, batch) => {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(`${API_BASE_URL}/auto-document/generate-batch`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ template, batch })
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.message || '일괄 문서 생성 실패');
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get('Content-Disposition');
  const isDocx = template.endsWith('.docx');
  let filename = isDocx ? '일괄생성문서.docx' : '일괄생성문서.pptx';
  if (contentDisposition) {
    const match = contentDisposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
    if (match) filename = decodeURIComponent(match[1].replace(/"/g, ''));
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const generateDocument = async (template, mappings) => {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(`${API_BASE_URL}/auto-document/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ template, mappings })
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.message || '문서 생성 실패');
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get('Content-Disposition');
  const isDocx = template.endsWith('.docx');
  let filename = isDocx ? '생성문서.docx' : '생성문서.pptx';
  if (contentDisposition) {
    const match = contentDisposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
    if (match) filename = decodeURIComponent(match[1].replace(/"/g, ''));
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
