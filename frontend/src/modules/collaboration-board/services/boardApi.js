/**
 * Collaboration Board API Service
 * 협업 게시판 API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class BoardApi {
  constructor() {
    this.baseUrl = `${API_BASE_URL}/collaboration-board`;
  }

  getAccessToken() {
    return localStorage.getItem('accessToken');
  }

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
        // 토큰 만료 시 로그인 페이지로 리다이렉트
        if (response.status === 401) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
        }
        throw new Error(data.message || '요청 처리 중 오류가 발생했습니다.');
      }

      return data;
    } catch (error) {
      console.error('Board API Error:', error);
      throw error;
    }
  }

  // ============== Category APIs ==============

  async getCategories(includeInactive = false) {
    const response = await this.request(`/categories?include_inactive=${includeInactive}`);
    return response.data || [];
  }

  async getCategory(categoryId) {
    const response = await this.request(`/categories/${categoryId}`);
    return response.data;
  }

  async createCategory(data) {
    const response = await this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.data;
  }

  async updateCategory(categoryId, data) {
    const response = await this.request(`/categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return response.data;
  }

  async deleteCategory(categoryId) {
    await this.request(`/categories/${categoryId}`, {
      method: 'DELETE'
    });
    return true;
  }

  // ============== Post APIs ==============

  async getPosts(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.categoryId) queryParams.append('category_id', params.categoryId);
    if (params.page) queryParams.append('page', params.page);
    if (params.perPage) queryParams.append('per_page', params.perPage);
    if (params.search) queryParams.append('search', params.search);

    const response = await this.request(`/posts?${queryParams.toString()}`);
    return response.data;
  }

  async getPost(postId) {
    const response = await this.request(`/posts/${postId}`);
    return response.data;
  }

  async createPost(data) {
    const response = await this.request('/posts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.data;
  }

  async updatePost(postId, data) {
    const response = await this.request(`/posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return response.data;
  }

  async deletePost(postId) {
    await this.request(`/posts/${postId}`, {
      method: 'DELETE'
    });
    return true;
  }

  // ============== Comment APIs ==============

  async getComments(postId) {
    const response = await this.request(`/posts/${postId}/comments`);
    return response.data || [];
  }

  async createComment(data) {
    const response = await this.request('/comments', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.data;
  }

  async updateComment(commentId, data) {
    const response = await this.request(`/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return response.data;
  }

  async deleteComment(commentId) {
    await this.request(`/comments/${commentId}`, {
      method: 'DELETE'
    });
    return true;
  }

  // ============== Attachment APIs ==============

  async uploadAttachment(postId, file) {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.baseUrl}/posts/${postId}/attachments`;
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

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'download';
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

  async deleteAttachment(attachmentId) {
    await this.request(`/attachments/${attachmentId}`, {
      method: 'DELETE'
    });
    return true;
  }

  // ============== Survey APIs ==============

  async getSurveys(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.includeInactive) queryParams.append('include_inactive', 'true');

    const response = await this.request(`/surveys?${queryParams.toString()}`);
    return response.data || [];
  }

  async getSurvey(surveyId) {
    const response = await this.request(`/surveys/${surveyId}`);
    return response.data;
  }

  async getSurveyStats(surveyId) {
    const response = await this.request(`/surveys/${surveyId}/stats`);
    return response.data;
  }

  async createSurvey(data) {
    const response = await this.request('/surveys', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.data;
  }

  async updateSurvey(surveyId, data) {
    const response = await this.request(`/surveys/${surveyId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return response.data;
  }

  async deleteSurvey(surveyId) {
    await this.request(`/surveys/${surveyId}`, {
      method: 'DELETE'
    });
    return true;
  }

  async closeSurvey(surveyId) {
    const response = await this.request(`/surveys/${surveyId}/close`, {
      method: 'POST'
    });
    return response.data;
  }

  async submitSurveyResponse(surveyId, answers) {
    const response = await this.request(`/surveys/${surveyId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ answers })
    });
    return response.data;
  }

  async getMyResponse(surveyId) {
    const response = await this.request(`/surveys/${surveyId}/my-response`);
    return response.data;
  }

  async updateMyResponse(surveyId, answers) {
    const response = await this.request(`/surveys/${surveyId}/my-response`, {
      method: 'PUT',
      body: JSON.stringify({ answers })
    });
    return response.data;
  }

  async getSurveyResponses(surveyId) {
    const response = await this.request(`/surveys/${surveyId}/responses`);
    return response.data || [];
  }

  async exportSurveyCsv(surveyId, surveyTitle) {
    const url = `${this.baseUrl}/surveys/${surveyId}/export-csv`;
    const token = this.getAccessToken();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` })
        }
      });

      if (!response.ok) {
        throw new Error('CSV 내보내기에 실패했습니다.');
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      // 파일명에서 특수문자 제거
      const safeTitle = (surveyTitle || 'survey').replace(/[\\/:*?"<>|]/g, '_');
      const filename = `${safeTitle}_결과.csv`;

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(blobUrl);
      return true;
    } catch (error) {
      console.error('CSV export error:', error);
      throw error;
    }
  }

  // ============== Health Check ==============

  async healthCheck() {
    const response = await this.request('/health');
    return response.data;
  }
}

export const boardApi = new BoardApi();
export default boardApi;
