const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

// ============== KPI Definitions ==============

export const fetchKpiDefinitions = async () => {
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/kpi-definitions`, {
    headers: getHeaders(),
  });
  const data = await res.json();
  return data.data || [];
};

export const createKpiDefinition = async (definition) => {
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/kpi-definitions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(definition),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'KPI 추가 실패');
  return data.data;
};

export const updateKpiDefinition = async (id, definition) => {
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/kpi-definitions/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(definition),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'KPI 수정 실패');
  return data.data;
};

export const deleteKpiDefinition = async (id) => {
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/kpi-definitions/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || 'KPI 삭제 실패');
  }
};

export const reorderKpiDefinitions = async (orderList) => {
  await fetch(`${API_BASE_URL}/dx-kpi-management/kpi-definitions/reorder`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(orderList),
  });
};

// ============== KPI Records ==============

export const fetchRecords = async (year) => {
  const params = year ? `?year=${year}` : '';
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/records${params}`, {
    headers: getHeaders(),
  });
  const data = await res.json();
  return data.data || [];
};

export const createRecord = async (record) => {
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/records`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(record),
  });
  const data = await res.json();
  return data.data;
};

export const createRecordsBulk = async (records) => {
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/records/bulk`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(records),
  });
  const data = await res.json();
  return data.data || [];
};

export const updateRecord = async (id, record) => {
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/records/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(record),
  });
  const data = await res.json();
  return data.data;
};

export const deleteRecord = async (id) => {
  await fetch(`${API_BASE_URL}/dx-kpi-management/records/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
};

// ============== KPI Targets ==============

export const fetchTargets = async () => {
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/targets`, {
    headers: getHeaders(),
  });
  const data = await res.json();
  return data.data || {};
};

export const saveTargets = async (targets) => {
  await fetch(`${API_BASE_URL}/dx-kpi-management/targets`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(targets),
  });
};

// ============== KPI Criteria ==============

export const fetchCriteria = async () => {
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/criteria`, {
    headers: getHeaders(),
  });
  const data = await res.json();
  return data.data || {};
};

export const saveCriteria = async (criteria) => {
  await fetch(`${API_BASE_URL}/dx-kpi-management/criteria`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(criteria),
  });
};

// ============== KPI Attachments ==============

export const fetchAttachments = async (year) => {
  const params = year ? `?year=${year}` : '';
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/attachments${params}`, {
    headers: getHeaders(),
  });
  const data = await res.json();
  return data.data || [];
};

export const uploadAttachment = async (file, { division, kpi, year, month }) => {
  const token = localStorage.getItem('accessToken');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('division', division);
  formData.append('kpi', kpi);
  formData.append('year', year);
  formData.append('month', month);
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/attachments`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json();
  return data.data;
};

export const downloadAttachment = async (id, filename) => {
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/attachments/${id}`, {
    headers: getHeaders(),
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const baseName = filename.replace(/\.[^.]+$/, '');
  a.download = `${baseName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadAllAttachments = async (year) => {
  const params = year ? `?year=${year}` : '';
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/attachments/download-all${params}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('다운로드 실패');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = year ? `KPI_근거자료_${year}년.zip` : 'KPI_근거자료_전체.zip';
  a.click();
  URL.revokeObjectURL(url);
};

export const deleteAttachment = async (id) => {
  await fetch(`${API_BASE_URL}/dx-kpi-management/attachments/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
};

// ============== Weekly Trends (주간 주요 동향) ==============

export const fetchWeeklyTrends = async (year) => {
  const params = year ? `?year=${year}` : '';
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/weekly-trends${params}`, {
    headers: getHeaders(),
  });
  const data = await res.json();
  return data.data || [];
};

export const upsertWeeklyTrend = async (trend) => {
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/weekly-trends`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(trend),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || '주간 주요 동향 저장 실패');
  return data.data;
};

export const updateWeeklyTrend = async (id, trend) => {
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/weekly-trends/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(trend),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || '주간 주요 동향 수정 실패');
  return data.data;
};

export const deleteWeeklyTrend = async (id) => {
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/weekly-trends/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || '주간 주요 동향 삭제 실패');
  }
};

// ============== 주간보고 붙여넣기 반입 ==============
//
// 원본 워드에 DRM 이 걸려 있어 파일을 올려도 서버는 암호화된 덩어리만 받는다.
// 그래서 입구가 **텍스트 한 덩이**다 — 사람이 워드에서 표를 긁어 붙인다.
//
// ⚠️ 미리보기와 저장이 갈라져 있다. preview 는 아무것도 쓰지 않는다.

/** 붙여넣은 글을 읽어 무엇이 들어갈지 돌려준다. DB 를 건드리지 않는다. */
export const previewImport = async ({ text, kind = 'kpi', baseDate, year, week }) => {
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/import/preview`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ text, kind, baseDate, year, week }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '읽기 실패');
  return (await res.json()).data;
};

/**
 * 못 맞춘 이름을 AI 에게 물어본다. **제안만** 받는다 — 저장도, 자동 적용도 없다.
 *
 * ⚠️ 실패해도 서버가 200 에 `{ok:false, reason}` 을 준다. AI 가 막혀 있어도
 *    반입은 평소대로 되어야 하므로, 여기서 예외를 던지지 않는다.
 */
export const suggestImportNames = async (names) => {
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/import/suggest-names`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ names }),
  });
  if (!res.ok) {
    const msg = (await res.json().catch(() => ({}))).message || 'AI 제안 실패';
    return { ok: false, suggestions: [], skipped: 0, reason: msg };
  }
  return (await res.json()).data;
};

/** 사람이 고른 것만 저장한다. `aliases` 는 이름 연결 학습분이다. */
export const commitImport = async (payload) => {
  const res = await fetch(`${API_BASE_URL}/dx-kpi-management/import/commit`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '저장 실패');
  return (await res.json()).data;
};
