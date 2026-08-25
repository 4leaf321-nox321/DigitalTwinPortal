/**
 * 디지털 트윈 기술정보 API.
 *
 * 두 개체를 다룬다 —
 *     소식(news)   바깥에서 들어온 사건 하나
 *     기술(tech)   레이더 한 줄
 *
 * ⚠️ 낡음 판정(`isStale`)ㆍ단계 목록ㆍ분류 목록은 **서버가 준다.** 화면이 자기
 *    표를 들면 반드시 서버와 갈리고, 갈리면 화면은 초록인데 서버는 빨간 상태가 된다.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class DtIntelApi {
  constructor() {
    this.baseUrl = `${API_BASE_URL}/digital-twin-intel`;
  }

  getHeaders() {
    const token = localStorage.getItem('accessToken');
    return {
      ...(token && { Authorization: `Bearer ${token}` }),
      'Content-Type': 'application/json',
    };
  }

  async request(url, options = {}, failMessage = '요청 실패') {
    const response = await fetch(url, { headers: this.getHeaders(), ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      const err = new Error(data.message || failMessage);
      err.status = response.status;
      throw err;
    }
    return data.data;
  }

  // ── 소식 ──────────────────────────────────────────────────────────────────
  listNews(params = {}) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    ).toString();
    return this.request(`${this.baseUrl}/news${qs ? `?${qs}` : ''}`, {},
                        '소식을 불러오지 못했습니다.');
  }

  /** 소식 하나 — **보관된 원문까지** 온다. 목록에는 본문이 안 실린다. */
  getNews(uuid) {
    return this.request(`${this.baseUrl}/news/${uuid}`, {},
                        '소식을 불러오지 못했습니다.');
  }

  createNews(body) {
    return this.request(`${this.baseUrl}/news`,
                        { method: 'POST', body: JSON.stringify(body) },
                        '소식을 저장하지 못했습니다.');
  }

  updateNews(uuid, body) {
    return this.request(`${this.baseUrl}/news/${uuid}`,
                        { method: 'PATCH', body: JSON.stringify(body) },
                        '소식을 고치지 못했습니다.');
  }

  deleteNews(uuid) {
    return this.request(`${this.baseUrl}/news/${uuid}`, { method: 'DELETE' },
                        '소식을 지우지 못했습니다.');
  }

  // ── 기술 (레이더) ─────────────────────────────────────────────────────────
  listTech(params = {}) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    ).toString();
    return this.request(`${this.baseUrl}/tech${qs ? `?${qs}` : ''}`, {},
                        '기술 목록을 불러오지 못했습니다.');
  }

  createTech(body) {
    return this.request(`${this.baseUrl}/tech`,
                        { method: 'POST', body: JSON.stringify(body) },
                        '기술을 저장하지 못했습니다.');
  }

  updateTech(uuid, body) {
    return this.request(`${this.baseUrl}/tech/${uuid}`,
                        { method: 'PATCH', body: JSON.stringify(body) },
                        '기술을 고치지 못했습니다.');
  }

  /**
   * 레이더 단계를 옮긴다.
   *
   * ⚠️ 전용 길이다 — 일반 수정(PATCH)으로는 단계가 안 바뀐다. 권한이 다르기
   *    때문이다(관리자ㆍ사무국만). 여기서 403 이 나는 것은 **정상**이다.
   */
  setStage(uuid, stage, reason) {
    return this.request(`${this.baseUrl}/tech/${uuid}/stage`,
                        { method: 'PUT', body: JSON.stringify({ stage, reason }) },
                        '단계를 바꾸지 못했습니다.');
  }

  deleteTech(uuid) {
    return this.request(`${this.baseUrl}/tech/${uuid}`, { method: 'DELETE' },
                        '기술을 지우지 못했습니다.');
  }

  techEvidence(uuid) {
    return this.request(`${this.baseUrl}/tech/${uuid}/evidence`, {},
                        '근거를 불러오지 못했습니다.');
  }

  addEvidence(newsUuid, techUuid, note) {
    return this.request(`${this.baseUrl}/evidence`,
                        { method: 'POST', body: JSON.stringify({ newsUuid, techUuid, note }) },
                        '근거를 잇지 못했습니다.');
  }

  // ── AI 정리 · 포털 연결 ───────────────────────────────────────────────────
  /**
   * 사내 LLM 이 읽고 **정리와 연결 후보**를 낸다.
   *
   * ⚠️ **제안일 뿐 저장되지 않는다.** 사람이 고른 것만 `addLink` 로 들어간다.
   * ⚠️ LLM 이 꺼져 있으면 **503** 이다 — 고장이 아니라 기능이 꺼진 것이라
   *    화면이 다르게 안내해야 한다(`err.status` 로 가른다).
   */
  suggest(kind, uuid) {
    return this.request(`${this.baseUrl}/${kind}/${uuid}/suggest`, { method: 'POST' },
                        'AI 정리에 실패했습니다.');
  }

  addLink(body) {
    return this.request(`${this.baseUrl}/links`,
                        { method: 'POST', body: JSON.stringify(body) },
                        '연결하지 못했습니다.');
  }

  listLinks(kind, uuid) {
    return this.request(`${this.baseUrl}/${kind}/${uuid}/links`, {},
                        '연결을 불러오지 못했습니다.');
  }

  // ── 설정 ──────────────────────────────────────────────────────────────────
  getSettings() {
    return this.request(`${this.baseUrl}/settings`, {}, '설정을 불러오지 못했습니다.');
  }

  updateSettings(body) {
    return this.request(`${this.baseUrl}/settings`,
                        { method: 'PUT', body: JSON.stringify(body) },
                        '설정을 저장하지 못했습니다.');
  }
}

export default new DtIntelApi();
