/**
 * Digital Twin Reference API Service
 * 과제 CRUD 및 설정 관리
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class DtReferenceApi {
  constructor() {
    this.baseUrl = `${API_BASE_URL}/digital-twin-reference`;
  }

  getAccessToken() {
    return localStorage.getItem('accessToken');
  }

  getHeaders() {
    const token = this.getAccessToken();
    return {
      ...(token && { Authorization: `Bearer ${token}` }),
      'Content-Type': 'application/json'
    };
  }

  // ============== Task APIs ==============

  async getTasks(divisionId = null) {
    let url = `${this.baseUrl}/tasks`;
    if (divisionId) {
      url += `?divisionId=${divisionId}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '과제 조회 실패');
    }
    return data.data || [];
  }

  async createTask(taskData) {
    const response = await fetch(`${this.baseUrl}/tasks`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(taskData)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '과제 생성 실패');
    }
    return data.data;
  }

  async updateTask(taskId, taskData) {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(taskData)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '과제 수정 실패');
    }
    return data.data;
  }

  async deleteTask(taskId) {
    const response = await fetch(`${this.baseUrl}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || '과제 삭제 실패');
    }
    return true;
  }

  async deleteAllTasks() {
    const response = await fetch(`${this.baseUrl}/tasks/delete-all`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '전체 삭제 실패');
    }
    return data;
  }

  async createBulkTasks(taskList) {
    const response = await fetch(`${this.baseUrl}/tasks/bulk`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ tasks: taskList })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '일괄 생성 실패');
    }
    return data.data;
  }

  async reorderTasks(orders) {
    const response = await fetch(`${this.baseUrl}/tasks/reorder`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ orders })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '순서 변경 실패');
    }
    return data;
  }

  // ============== Settings APIs ==============

  async getSettings() {
    const response = await fetch(`${this.baseUrl}/settings`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '설정 조회 실패');
    }
    return data.data;
  }

  async updateSettings(settingsData) {
    const response = await fetch(`${this.baseUrl}/settings`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(settingsData)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '설정 저장 실패');
    }
    return data.data;
  }

  // ============== Roadmap Config APIs ==============

  async getRoadmapConfig() {
    const settings = await this.getSettings();
    return settings.roadmap_config || { itemOrder: {}, cellMerge: [] };
  }

  async updateRoadmapConfig(config) {
    return this.updateSettings({ roadmap_config: config });
  }

  // ============== Dashboard Projects (for linking) ==============

  async getDashboardProjects() {
    const token = this.getAccessToken();
    const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/data`, {
      method: 'GET',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('대시보드 과제 조회 실패');
    }

    const data = await response.json();
    const projects = data.data?.projects || [];
    return projects.map(p => ({
      projectId: p.id || p.uuid,
      projectName: p['과제명'] || p.name || '',
      division: p['사업부'] || '',
      year: p['과제년도'] || '',
    }));
  }

  // ============== Divisions (from dashboard settings) ==============

  async getDivisions() {
    const token = this.getAccessToken();
    const response = await fetch(`${API_BASE_URL}/digital-twin-dashboard/settings`, {
      method: 'GET',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('사업부 목록 조회 실패');
    }

    const data = await response.json();
    if (data.data?.divisions) {
      return data.data.divisions.map(div => ({
        id: div.id,
        name: div.name,
        color: div.color || '#64748b'
      }));
    }
    return [];
  }
}

export const dtReferenceApi = new DtReferenceApi();
export default dtReferenceApi;
