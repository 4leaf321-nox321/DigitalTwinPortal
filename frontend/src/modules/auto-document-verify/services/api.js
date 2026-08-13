const API_BASE = '/api/auto-document-verify';

function authHeaders() {
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * 파일을 즉시 ArrayBuffer로 읽어 { name, buffer } 형태로 반환한다.
 * DRM 파일은 선택 직후에만 복호화 상태이므로 이 시점에 읽어야 한다.
 */
export function readFileToBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, buffer: reader.result });
    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 메모리에 저장된 { name, buffer } 두 개를 서버로 전송하여 비교한다.
 */
export async function compareDocuments(bufferedA, bufferedB) {
  const formData = new FormData();
  formData.append('fileA', new Blob([bufferedA.buffer]), bufferedA.name);
  formData.append('fileB', new Blob([bufferedB.buffer]), bufferedB.name);

  const res = await fetch(`${API_BASE}/compare`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || '문서 비교에 실패했습니다.');
  }

  const json = await res.json();
  return json.data;
}

/**
 * 텍스트 두 개를 서버로 전송하여 비교한다.
 * DRM 파일의 내용을 복사-붙여넣기해서 비교할 때 사용.
 */
export async function compareTexts(textA, textB, nameA, nameB) {
  const res = await fetch(`${API_BASE}/compare-text`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ textA, textB, nameA, nameB }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || '텍스트 비교에 실패했습니다.');
  }

  const json = await res.json();
  return json.data;
}
