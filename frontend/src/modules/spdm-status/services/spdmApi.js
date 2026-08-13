/**
 * SPDM Status API Service
 * 그룹, 이슈, 첨부파일 관리 API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class SpdmApi {
  constructor() {
    this.baseUrl = `${API_BASE_URL}/spdm-status`;
  }

  getAccessToken() {
    return localStorage.getItem('accessToken');
  }

  getHeaders(includeContentType = true) {
    const token = this.getAccessToken();
    return {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(includeContentType && { 'Content-Type': 'application/json' })
    };
  }

  // ============== Group APIs ==============

  /**
   * Get all groups
   */
  async getGroups() {
    const response = await fetch(`${this.baseUrl}/groups`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '그룹 조회 실패');
    }
    return data.data || [];
  }

  /**
   * Create a new group
   */
  async createGroup(groupData) {
    const response = await fetch(`${this.baseUrl}/groups`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(groupData)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '그룹 생성 실패');
    }
    return data.data;
  }

  /**
   * Update a group
   */
  async updateGroup(groupId, groupData) {
    const response = await fetch(`${this.baseUrl}/groups/${groupId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(groupData)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '그룹 수정 실패');
    }
    return data.data;
  }

  /**
   * Delete a group
   */
  async deleteGroup(groupId) {
    const response = await fetch(`${this.baseUrl}/groups/${groupId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || '그룹 삭제 실패');
    }
    return true;
  }

  // ============== Issue APIs ==============

  /**
   * Get all issues
   */
  async getIssues(groupId = null) {
    let url = `${this.baseUrl}/issues`;
    if (groupId) {
      url += `?groupId=${groupId}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '이슈 조회 실패');
    }
    return data.data || [];
  }

  /**
   * Get a single issue with history
   */
  async getIssue(issueId) {
    const response = await fetch(`${this.baseUrl}/issues/${issueId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '이슈 조회 실패');
    }
    return data.data;
  }

  /**
   * Create a new issue
   */
  async createIssue(issueData) {
    const response = await fetch(`${this.baseUrl}/issues`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(issueData)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '이슈 생성 실패');
    }
    return data.data;
  }

  /**
   * Update an issue
   */
  async updateIssue(issueId, issueData) {
    const response = await fetch(`${this.baseUrl}/issues/${issueId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(issueData)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '이슈 수정 실패');
    }
    return data.data;
  }

  /**
   * Change issue status
   */
  async changeIssueStatus(issueId, status, author = '시스템') {
    const response = await fetch(`${this.baseUrl}/issues/${issueId}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status, author })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '상태 변경 실패');
    }
    return data.data;
  }

  /**
   * Delete an issue
   */
  async deleteIssue(issueId) {
    const response = await fetch(`${this.baseUrl}/issues/${issueId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || '이슈 삭제 실패');
    }
    return true;
  }

  // ============== History APIs ==============

  /**
   * Get issue history
   */
  async getIssueHistory(issueId) {
    const response = await fetch(`${this.baseUrl}/issues/${issueId}/history`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '이력 조회 실패');
    }
    return data.data || [];
  }

  /**
   * Add a comment to an issue
   */
  async addComment(issueId, commentData) {
    const response = await fetch(`${this.baseUrl}/issues/${issueId}/history`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        type: 'comment',
        content: commentData.content,
        author: commentData.author,
        departmentId: commentData.departmentId,
        attachment: commentData.attachment
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '의견 등록 실패');
    }
    return data.data;
  }

  /**
   * Delete a history entry
   */
  async deleteHistory(historyId) {
    const response = await fetch(`${this.baseUrl}/history/${historyId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || '이력 삭제 실패');
    }
    return true;
  }

  // ============== Attachment APIs ==============

  /**
   * Upload a file attachment to an issue
   */
  async uploadAttachment(issueId, file) {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.baseUrl}/issues/${issueId}/attachments`;
    const token = this.getAccessToken();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '파일 업로드 중 오류가 발생했습니다.');
      }

      return data.data;
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }

  /**
   * Get attachments for an issue
   */
  async getAttachments(issueId) {
    const url = `${this.baseUrl}/issues/${issueId}/attachments`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '첨부파일 조회 중 오류가 발생했습니다.');
    }

    return data.data || [];
  }

  /**
   * Download attachment as blob (bypasses browser security warnings)
   * Server returns ZIP file to bypass DRM blocking
   */
  async downloadAttachment(attachmentId, filename) {
    const url = `${this.baseUrl}/attachments/${attachmentId}/download`;
    const token = this.getAccessToken();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` })
        }
      });

      if (!response.ok) {
        throw new Error('파일 다운로드에 실패했습니다.');
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      // Convert filename to .zip (server returns ZIP to bypass DRM)
      const originalName = filename || 'download';
      const baseName = originalName.replace(/\.[^/.]+$/, ''); // Remove extension
      const zipFilename = `${baseName}.zip`;

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = zipFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(blobUrl);
      return true;
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(attachmentId) {
    const url = `${this.baseUrl}/attachments/${attachmentId}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || '첨부파일 삭제 중 오류가 발생했습니다.');
    }

    return true;
  }

  // ============== Schedule Department APIs ==============

  /**
   * Get all schedule departments with their schedules
   */
  async getScheduleDepartments() {
    const response = await fetch(`${this.baseUrl}/schedule/departments`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '일정 사업부 조회 실패');
    }
    return data.data || [];
  }

  /**
   * Create a new schedule department
   */
  async createScheduleDepartment(deptData) {
    const response = await fetch(`${this.baseUrl}/schedule/departments`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(deptData)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '일정 사업부 생성 실패');
    }
    return data.data;
  }

  /**
   * Update a schedule department
   */
  async updateScheduleDepartment(deptId, deptData) {
    // Convert string ID to integer if needed
    const id = typeof deptId === 'string' ? parseInt(deptId, 10) : deptId;
    const response = await fetch(`${this.baseUrl}/schedule/departments/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(deptData)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '일정 사업부 수정 실패');
    }
    return data.data;
  }

  /**
   * Delete a schedule department
   */
  async deleteScheduleDepartment(deptId) {
    // Convert string ID to integer if needed
    const id = typeof deptId === 'string' ? parseInt(deptId, 10) : deptId;
    const response = await fetch(`${this.baseUrl}/schedule/departments/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || '일정 사업부 삭제 실패');
    }
    return true;
  }

  /**
   * Reorder schedule departments
   */
  async reorderScheduleDepartments(departmentIds) {
    // Convert string IDs to integers if needed
    const ids = departmentIds.map(id => typeof id === 'string' ? parseInt(id, 10) : id);
    const response = await fetch(`${this.baseUrl}/schedule/departments/reorder`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ departmentIds: ids })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || '일정 사업부 순서 변경 실패');
    }
    return true;
  }

  // ============== Schedule Item APIs ==============

  /**
   * Get all schedule items (optionally by department)
   */
  async getScheduleItems(departmentId = null) {
    let url = `${this.baseUrl}/schedule/items`;
    if (departmentId) {
      url += `?departmentId=${departmentId}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '일정 조회 실패');
    }
    return data.data || [];
  }

  /**
   * Create a new schedule item
   */
  async createScheduleItem(itemData) {
    // Convert departmentId to integer if it's a string
    const payload = {
      ...itemData,
      departmentId: typeof itemData.departmentId === 'string'
        ? parseInt(itemData.departmentId, 10)
        : itemData.departmentId
    };
    const response = await fetch(`${this.baseUrl}/schedule/items`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '일정 생성 실패');
    }
    return data.data;
  }

  /**
   * Update a schedule item
   */
  async updateScheduleItem(itemId, itemData) {
    const response = await fetch(`${this.baseUrl}/schedule/items/${itemId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(itemData)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '일정 수정 실패');
    }
    return data.data;
  }

  /**
   * Delete a schedule item
   */
  async deleteScheduleItem(itemId) {
    const response = await fetch(`${this.baseUrl}/schedule/items/${itemId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || '일정 삭제 실패');
    }
    return true;
  }

  /**
   * Reorder schedule items within a department
   */
  async reorderScheduleItems(departmentId, itemIds) {
    // Convert string ID to integer if needed
    const deptId = typeof departmentId === 'string' ? parseInt(departmentId, 10) : departmentId;
    const response = await fetch(`${this.baseUrl}/schedule/items/reorder`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ departmentId: deptId, itemIds })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || '일정 순서 변경 실패');
    }
    return true;
  }
  // ============== Module Settings APIs ==============

  /**
   * Get module settings (categories, systems, linkMethods)
   */
  async getModuleSettings() {
    const response = await fetch(`${this.baseUrl}/module-settings`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '모듈 설정 조회 실패');
    }
    return data.data;
  }

  /**
   * Update module settings (categories, systems, linkMethods)
   */
  async updateModuleSettings(settingsData) {
    const response = await fetch(`${this.baseUrl}/module-settings`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(settingsData)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '모듈 설정 저장 실패');
    }
    return data.data;
  }

  // ============== Module APIs ==============

  /**
   * Get all modules (optionally filtered by division)
   */
  async getModules(divisionId = null) {
    let url = `${this.baseUrl}/modules`;
    if (divisionId) {
      url += `?divisionId=${divisionId}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '모듈 조회 실패');
    }
    return data.data || [];
  }

  /**
   * Get a single module
   */
  async getModule(moduleId) {
    const response = await fetch(`${this.baseUrl}/modules/${moduleId}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '모듈 조회 실패');
    }
    return data.data;
  }

  /**
   * Create a new module
   */
  async createModule(moduleData) {
    const response = await fetch(`${this.baseUrl}/modules`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(moduleData)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '모듈 생성 실패');
    }
    return data.data;
  }

  /**
   * Update a module
   */
  async updateModule(moduleId, moduleData) {
    const response = await fetch(`${this.baseUrl}/modules/${moduleId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(moduleData)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '모듈 수정 실패');
    }
    return data.data;
  }

  /**
   * Delete a module
   */
  async deleteModule(moduleId) {
    const response = await fetch(`${this.baseUrl}/modules/${moduleId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || '모듈 삭제 실패');
    }
    return true;
  }

  /**
   * Reorder modules
   */
  async reorderModules(moduleIds) {
    const response = await fetch(`${this.baseUrl}/modules/reorder`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ moduleIds })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || '모듈 순서 변경 실패');
    }
    return true;
  }

  /**
   * Get spec key suggestions for autocomplete
   */
  async getSpecKeySuggestions(search = '') {
    let url = `${this.baseUrl}/spec-keys`;
    if (search) {
      url += `?search=${encodeURIComponent(search)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '스펙 키 조회 실패');
    }
    return data.data || [];
  }
}

export const spdmApi = new SpdmApi();
export default spdmApi;
