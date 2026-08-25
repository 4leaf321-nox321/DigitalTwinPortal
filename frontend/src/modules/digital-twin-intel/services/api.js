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

  /** 이 기술을 **사업부별로 죽 편 것.** 예외가 걸린 사업부만 온다. */
  divisionStages(uuid) {
    return this.request(`${this.baseUrl}/tech/${uuid}/division-stages`, {},
                        '사업부별 단계를 불러오지 못했습니다.');
  }

  /**
   * 한 사업부만 기본 설정과 다르게 본다고 적는다.
   *
   * ⚠️ **단계 변경과 같은 권한이다**(관리자ㆍ사무국). 여기서 403 이 나는 것은 정상.
   * ⚠️ 기본 설정과 **같은 값**을 보내면 예외가 지워진다 — 「기본 설정과 같다」와 「아직 안
   *    정했다」는 같은 뜻이고, 굳이 남겨 두면 기본 설정이 움직였을 때 이 사업부만
   *    옛 값에 붙박인다.
   */
  setDivisionStage(uuid, division, stage, reason, tools) {
    return this.request(
      `${this.baseUrl}/tech/${uuid}/division-stage`,
      { method: 'PUT',
        body: JSON.stringify({ division, stage, reason, tools: tools || [] }) },
      '사업부 단계를 바꾸지 못했습니다.');
  }

  /**
   * **한 사업부가 한 판에 다 적는 표.** 역량 전부가 한 번에 온다.
   *
   * ⚠️ 사업부 이름은 물음표 뒤로 보낸다 — 한글이라 경로에 박으면 중간의
   *    프록시마다 인코딩이 갈린다.
   */
  divisionSheet(division) {
    return this.request(
      `${this.baseUrl}/division-sheet?division=${encodeURIComponent(division || '')}`,
      {}, '사업부 표를 불러오지 못했습니다.');
  }

  /**
   * 표에서 **바뀐 줄만** 한 번에 담는다. `{saved, failed:[{name, error}]}`.
   *
   * ⚠️ 틀린 줄이 있어도 **나머지는 담긴다.** 그래서 200 이 왔다고 다 담긴 것이
   *    아니다 — 화면은 반드시 `failed` 를 봐야 한다.
   */
  saveDivisionSheet(division, items) {
    return this.request(`${this.baseUrl}/division-sheet`,
                        { method: 'PUT',
                          body: JSON.stringify({ division, items }) },
                        '사업부 표를 저장하지 못했습니다.');
  }

  /**
   * **이 도구를 쓰는 사업부.** 사업부 줄을 거꾸로 읽는다.
   *
   * ⚠️ 적어 넣는 쪽만 있고 되짚는 쪽이 없으면 적을 이유가 절반으로 준다.
   */
  usedBy(uuid) {
    return this.request(`${this.baseUrl}/tech/${uuid}/used-by`, {},
                        '쓰는 사업부를 불러오지 못했습니다.');
  }

  /** 사업부 예외를 지우고 **기본 설정 값을 따라가게** 되돌린다. */
  clearDivisionStage(uuid, division) {
    const qs = new URLSearchParams({ division }).toString();
    return this.request(
      `${this.baseUrl}/tech/${uuid}/division-stage?${qs}`, { method: 'DELETE' },
      '사업부 예외를 지우지 못했습니다.');
  }

  /**
   * 도구가 **어느 역량들에** 속하는지 정한다. 빈 목록이면 전부 떼어 낸다.
   *
   * ⚠️⚠️ **여럿이다.** 예전에는 부모 하나였는데, 자료로 세어 보니 도구 546개 중
   *    58개(11%)가 두 역량 이상에 걸쳤다 — 칸 하나로는 그 중 하나만 적을 수 있었다.
   * ⚠️ 일반 수정(PATCH)에 안 실었다 — 고리ㆍ층 검사가 붙는 자리라 전용 길로 둔다.
   *    PATCH 로 함께 받으면 그 검사를 우회하는 길이 하나 더 생긴다.
   */
  setTechCapabilities(uuid, capabilityUuids) {
    return this.request(
      `${this.baseUrl}/tech/${uuid}/capabilities`,
      { method: 'PUT',
        body: JSON.stringify({ capabilityUuids: capabilityUuids || [] }) },
      '속한 역량을 바꾸지 못했습니다.');
  }

  /** 같은 소식에 함께 걸린 기술과 그 횟수. */
  relatedTech(uuid) {
    return this.request(`${this.baseUrl}/tech/${uuid}/related`, {},
                        '함께 나온 기술을 불러오지 못했습니다.');
  }

  /**
    * 화면 맨 위의 「오늘 뭘 봐야 하나」.
    *
    * ⚠️ **레이더와 같은 기간을 넘긴다.** 안 넘기면 막대는 90일로 세고 레이더는
    *    고른 기간을 그려서, 눌러 뜨는 수와 적힌 수가 달라진다.
    */
  overview(movedDays) {
    const qs = movedDays ? `?movedDays=${movedDays}` : '';
    return this.request(`${this.baseUrl}/overview${qs}`, {},
                        '요약을 불러오지 못했습니다.');
  }

  techEvidence(uuid) {
    return this.request(`${this.baseUrl}/tech/${uuid}/evidence`, {},
                        '근거를 불러오지 못했습니다.');
  }

  /**
   * 근거를 끊는다.
   *
   * ⚠️ **못 무르는 기능은 안 쓰는 기능이다.** AI 제안을 눌러 잘못 걸었는데 무를
   *    방법이 없으면 한 번 데인 사람은 그다음부터 안 누른다.
   */
  removeEvidence(newsUuid, techUuid) {
    const qs = new URLSearchParams({ newsUuid, techUuid }).toString();
    return this.request(`${this.baseUrl}/evidence?${qs}`, { method: 'DELETE' },
                        '근거를 끊지 못했습니다.');
  }

  removeLink(id) {
    return this.request(`${this.baseUrl}/links/${id}`, { method: 'DELETE' },
                        '연결을 끊지 못했습니다.');
  }

  /** 무엇이 언제 왜 바뀌었나 — 레이더 단계·소식 상태. */
  listChanges(kind, uuid) {
    return this.request(`${this.baseUrl}/${kind}/${uuid}/changes`, {},
                        '이력을 불러오지 못했습니다.');
  }

  /**
   * 두 줄이 된 기술을 합친다.
   *
   * ⚠️ 되돌릴 수 없다 — `uuid` 쪽이 지워지고 `intoUuid` 로 근거·연결이 옮겨간다.
   *    지는 이름은 이기는 쪽 별칭이 되어, 다음 소식이 같은 줄에 붙는다.
   */
  mergeTech(uuid, intoUuid) {
    return this.request(`${this.baseUrl}/tech/${uuid}/merge`,
                        { method: 'POST', body: JSON.stringify({ intoUuid }) },
                        '합치지 못했습니다.');
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
