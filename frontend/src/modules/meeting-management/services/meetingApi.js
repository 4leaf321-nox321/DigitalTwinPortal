/**
 * Meeting Management API Service
 * 협의체/회의체/보고 관리 API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class MeetingApi {
  constructor() {
    this.baseUrl = `${API_BASE_URL}/meeting-management`;
  }

  /**
   * Get access token from localStorage
   */
  getAccessToken() {
    return localStorage.getItem('accessToken');
  }

  /**
   * Make API request with error handling
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        // 409 Conflict (낙관적 잠금 충돌)
        if (response.status === 409) {
          const error = new Error(data.message || '다른 사용자가 데이터를 수정했습니다.');
          error.isConflict = true;
          error.conflictData = data.data;
          throw error;
        }
        throw new Error(data.message || '요청 처리 중 오류가 발생했습니다.');
      }

      return data;
    } catch (error) {
      console.error('Meeting API Error:', error);
      throw error;
    }
  }

  // ============== Meeting Group APIs ==============

  /**
   * Get all meeting groups
   */
  async getGroups(includeInactive = false) {
    const response = await this.request(`/groups?include_inactive=${includeInactive}`);
    return response.data || [];
  }

  /**
   * Get a single meeting group with sessions
   */
  async getGroup(groupId) {
    const response = await this.request(`/groups/${groupId}`);
    return response.data;
  }

  /**
   * Create a new meeting group
   */
  async createGroup(data) {
    const response = await this.request('/groups', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.data;
  }

  /**
   * Update a meeting group
   */
  async updateGroup(groupId, data) {
    const response = await this.request(`/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return response.data;
  }

  /**
   * Delete a meeting group
   */
  async deleteGroup(groupId) {
    await this.request(`/groups/${groupId}`, {
      method: 'DELETE'
    });
    return true;
  }

  // ============== Session APIs ==============

  /**
   * Get all sessions for a group
   */
  async getSessions(groupId) {
    const response = await this.request(`/groups/${groupId}/sessions`);
    return response.data || [];
  }

  /**
   * Get a single session
   */
  async getSession(sessionId) {
    const response = await this.request(`/sessions/${sessionId}`);
    return response.data;
  }

  /**
   * Create a new session
   */
  async createSession(groupId, data) {
    const response = await this.request(`/groups/${groupId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.data;
  }

  /**
   * Update a session (with optimistic locking support)
   * @param {number} sessionId - Session ID
   * @param {object} data - Session data to update
   * @param {string} updatedAt - Original updatedAt timestamp for conflict detection
   */
  async updateSession(sessionId, data, updatedAt = null) {
    const payload = { ...data };
    if (updatedAt) {
      payload.updatedAt = updatedAt;
    }
    const response = await this.request(`/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return response.data;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId) {
    await this.request(`/sessions/${sessionId}`, {
      method: 'DELETE'
    });
    return true;
  }

  // ============== Agenda Item APIs ==============

  /**
   * Get agenda items for a session
   */
  async getAgendaItems(sessionId) {
    const response = await this.request(`/sessions/${sessionId}/items`);
    return response.data || [];
  }

  /**
   * Create an agenda item
   */
  async createAgendaItem(sessionId, data) {
    const response = await this.request(`/sessions/${sessionId}/items`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.data;
  }

  /**
   * Update an agenda item
   */
  async updateAgendaItem(itemId, data) {
    const response = await this.request(`/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return response.data;
  }

  /**
   * Delete an agenda item
   */
  async deleteAgendaItem(itemId) {
    await this.request(`/items/${itemId}`, {
      method: 'DELETE'
    });
    return true;
  }

  // ============== Attachment APIs ==============

  /**
   * Upload a file attachment to a session
   */
  async uploadAttachment(sessionId, file, fileType = 'etc') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', fileType);

    const url = `${this.baseUrl}/sessions/${sessionId}/attachments`;
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
   * Get all attachments for a session
   */
  async getAttachments(sessionId) {
    const response = await this.request(`/sessions/${sessionId}/attachments`);
    return response.data || [];
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(attachmentId) {
    await this.request(`/attachments/${attachmentId}`, {
      method: 'DELETE'
    });
    return true;
  }

  /**
   * Get download URL for an attachment
   */
  getAttachmentDownloadUrl(attachmentId) {
    return `${this.baseUrl}/attachments/${attachmentId}/download`;
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

  // ============== Report Plan Comment APIs ==============

  async getReportPlanComments(tabKey, statusFilter = '') {
    const params = statusFilter ? `?status=${statusFilter}` : '';
    const response = await this.request(
      `/report-plan/${tabKey}/comments${params}`
    );
    return response.data || [];
  }

  async createReportPlanComment(tabKey, { author, content, parentId }) {
    const response = await this.request(`/report-plan/${tabKey}/comments`, {
      method: 'POST',
      body: JSON.stringify({ author, content, parentId }),
    });
    return response.data;
  }

  async updateReportPlanComment(commentId, data) {
    const response = await this.request(`/report-plan/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async deleteReportPlanComment(commentId) {
    await this.request(`/report-plan/comments/${commentId}`, {
      method: 'DELETE',
    });
    return true;
  }

  // ============== Health Check ==============

  /**
   * Check API health
   */
  async healthCheck() {
    const response = await this.request('/health');
    return response.data;
  }

  // ============== Report Plan APIs ==============

  /**
   * Get report plan rounds for a tab
   */
  async getReportPlan(tabKey) {
    const response = await this.request(`/report-plan/${tabKey}`);
    return response.data || { rounds: [], updatedAt: null };
  }

  /**
   * Save report plan rounds for a tab (full replace, with optimistic locking)
   */
  async saveReportPlan(tabKey, rounds, updatedAt = null) {
    const response = await this.request(`/report-plan/${tabKey}`, {
      method: 'PUT',
      body: JSON.stringify({ rounds, updatedAt }),
    });
    return response.data || { rounds: [], updatedAt: null };
  }

  /**
   * Check if current user can edit report plans
   */
  async checkReportPlanEditPermission() {
    try {
      const response = await this.request('/report-plan/can-edit');
      return response.data?.canEdit ?? false;
    } catch {
      return false;
    }
  }

  // ============== Report Plan Notice APIs ==============

  async getNotices(scope = null) {
    const params = scope ? `?scope=${scope}` : '';
    const response = await this.request(`/report-plan/notices${params}`);
    return response.data || [];
  }

  async createNotice(data) {
    const response = await this.request('/report-plan/notices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async updateNotice(noticeId, data) {
    const response = await this.request(`/report-plan/notices/${noticeId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async deleteNotice(noticeId) {
    await this.request(`/report-plan/notices/${noticeId}`, { method: 'DELETE' });
  }
}

export const meetingApi = new MeetingApi();
export default meetingApi;
