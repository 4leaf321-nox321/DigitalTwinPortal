/**
 * Office Management API Service
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class OfficeApi {
  constructor() {
    this.baseUrl = `${API_BASE_URL}/office-management`;
  }

  /**
   * Make API request with error handling
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
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
          const error = new Error(data.message || '다른 사용자가 수정했습니다.');
          error.isConflict = true;
          error.conflictData = data.data;
          throw error;
        }
        throw new Error(data.message || '요청 처리 중 오류가 발생했습니다.');
      }

      return data;
    } catch (error) {
      console.error('Office API Error:', error);
      throw error;
    }
  }

  // ============== Week APIs ==============

  /**
   * Get all weeks with agendas
   */
  async getWeeks() {
    const response = await this.request('/weeks');
    return response.data || [];
  }

  /**
   * Get a single week
   */
  async getWeek(weekId) {
    const response = await this.request(`/weeks/${weekId}`);
    return response.data;
  }

  /**
   * Create a new week
   */
  async createWeek(year, week) {
    const response = await this.request('/weeks', {
      method: 'POST',
      body: JSON.stringify({ year, week })
    });
    return response.data;
  }

  /**
   * Delete a week
   */
  async deleteWeek(weekId) {
    await this.request(`/weeks/${weekId}`, {
      method: 'DELETE'
    });
    return true;
  }

  // ============== Agenda APIs ==============

  /**
   * Create a new agenda
   */
  async createAgenda(weekId, title, content, linkedAgendaTitle = null) {
    const response = await this.request(`/weeks/${weekId}/agendas`, {
      method: 'POST',
      body: JSON.stringify({ title, content, linkedAgendaTitle })
    });
    return response.data;
  }

  /**
   * Update an agenda (with optimistic locking support)
   * @param {number} agendaId - Agenda ID
   * @param {object} data - Update data
   * @param {string} updated_at - Original updated_at timestamp for conflict detection
   */
  async updateAgenda(agendaId, data, updated_at = null) {
    const payload = { ...data };
    if (updated_at) {
      payload.updated_at = updated_at;
    }

    const response = await this.request(`/agendas/${agendaId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return response.data;
  }

  /**
   * Delete an agenda
   */
  async deleteAgenda(agendaId) {
    await this.request(`/agendas/${agendaId}`, {
      method: 'DELETE'
    });
    return true;
  }

  /**
   * Get all agenda titles
   */
  async getAgendaTitles() {
    const response = await this.request('/agenda-titles');
    return response.data || [];
  }

  // ============== Bulk APIs ==============

  /**
   * Bulk add agendas
   * items: [{year, week, title, content}]
   */
  async bulkAddAgendas(items) {
    const response = await this.request('/bulk/add', {
      method: 'POST',
      body: JSON.stringify({ items })
    });
    return response.data;
  }

  /**
   * Get all data (weeks with agendas)
   */
  async getAllData() {
    const response = await this.request('/data');
    return response.data || [];
  }

  /**
   * Save all data (replace existing)
   */
  async saveAllData(weeks) {
    const response = await this.request('/data', {
      method: 'POST',
      body: JSON.stringify({ weeks })
    });
    return response.data;
  }

  // ============== Attachment APIs ==============

  /**
   * Upload a file attachment to an agenda
   */
  async uploadAttachment(agendaId, file) {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.baseUrl}/agendas/${agendaId}/attachments`;

    try {
      const response = await fetch(url, {
        method: 'POST',
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
   * Get all attachments for an agenda
   */
  async getAttachments(agendaId) {
    const response = await this.request(`/agendas/${agendaId}/attachments`);
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

  // ============== Business Contacts APIs ==============

  /**
   * Get business contacts data
   */
  async getBusinessContacts() {
    const response = await this.request('/business-contacts');
    return response.data || {};
  }

  /**
   * Save business contacts data
   */
  async saveBusinessContacts(data) {
    const response = await this.request('/business-contacts', {
      method: 'PUT',
      body: JSON.stringify({ data })
    });
    return response.data;
  }

  // ============== Health Check ==============

  /**
   * Check API health
   */
  async healthCheck() {
    const response = await this.request('/health');
    return response.data;
  }
}

export const officeApi = new OfficeApi();
export default officeApi;
