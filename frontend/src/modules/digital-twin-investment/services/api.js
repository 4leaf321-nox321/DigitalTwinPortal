/**
 * Digital Twin Investment API Service
 * 투자 건 CRUD + 디지털 트윈 영역 설정
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class DtInvestmentApi {
  constructor() {
    this.baseUrl = `${API_BASE_URL}/digital-twin-investment`;
    // 사업부·프로세스·투자부서는 대시보드 모듈의 설정을 그대로 쓴다.
    this.dashboardUrl = `${API_BASE_URL}/digital-twin-dashboard`;
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
      throw new Error(data.message || failMessage);
    }
    return data.data;
  }

  // ============== 투자 건 ==============

  async getInvestments() {
    return (await this.request(`${this.baseUrl}/investments`, {}, '투자 현황 조회 실패')) || [];
  }

  async createInvestment(investment) {
    return this.request(
      `${this.baseUrl}/investments`,
      { method: 'POST', body: JSON.stringify(investment) },
      '투자 등록 실패'
    );
  }

  async createInvestments(investments) {
    return this.request(
      `${this.baseUrl}/investments/bulk`,
      { method: 'POST', body: JSON.stringify({ investments }) },
      '투자 일괄 등록 실패'
    );
  }

  async updateInvestment(id, investment) {
    return this.request(
      `${this.baseUrl}/investments/${id}`,
      { method: 'PUT', body: JSON.stringify(investment) },
      '투자 수정 실패'
    );
  }

  async deleteInvestment(id) {
    return this.request(
      `${this.baseUrl}/investments/${id}`,
      { method: 'DELETE' },
      '투자 삭제 실패'
    );
  }

  // ============== 설정 ==============

  async getSettings() {
    return (await this.request(`${this.baseUrl}/settings`, {}, '설정 조회 실패')) || {};
  }

  async saveCategory2Options(options) {
    return this.request(
      `${this.baseUrl}/settings`,
      { method: 'PUT', body: JSON.stringify({ category2Options: options }) },
      '설정 저장 실패'
    );
  }

  /**
   * 사업부 / 프로세스 / 투자부서 선택지.
   * 대시보드가 정본이므로 여기서 만들지 않고 읽어만 온다.
   *
   * 부서는 사업부에 딸려 있다(department.divisionId). 사업부를 고르면 그 아래
   * 부서만 보여야 하므로 이름 목록과 함께 **사업부별 부서 묶음**도 만들어 준다.
   */
  async getDashboardOptions() {
    const data = await this.request(`${this.dashboardUrl}/settings`, {}, '사업부 정보 조회 실패');
    const active = (list) => (list || []).filter(x => x.is_active !== false);

    const divisions = active(data?.divisions);
    const departments = active(data?.departments);
    const divisionNameById = new Map(divisions.map(d => [String(d.id), d.name]));

    const departmentsByDivision = {};
    divisions.forEach(d => { departmentsByDivision[d.name] = []; });
    departments.forEach(dep => {
      const divisionName = divisionNameById.get(String(dep.divisionId));
      if (!divisionName) return;   // 어느 사업부에도 안 붙은 부서는 묶음에서 빠진다
      departmentsByDivision[divisionName].push(dep.name);
    });

    return {
      divisions: divisions.map(d => d.name),
      processes: active(data?.processes).map(p => p.name),
      departments: departments.map(d => d.name),
      departmentsByDivision,
    };
  }
}

export default new DtInvestmentApi();
