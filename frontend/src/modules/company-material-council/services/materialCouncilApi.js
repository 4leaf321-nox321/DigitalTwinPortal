/**
 * Company Material Council API Service
 * 전사 물성 협의체 API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class MaterialCouncilApi {
  constructor() {
    this.baseUrl = `${API_BASE_URL}/company-material-council`;
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
        throw new Error(data.message || '요청 처리 중 오류가 발생했습니다.');
      }

      return data;
    } catch (error) {
      console.error('Material Council API Error:', error);
      throw error;
    }
  }

  // ============== Settings APIs ==============

  /**
   * Get settings (tabs configuration)
   */
  async getSettings(key = 'default') {
    const response = await this.request(`/settings?key=${key}`);
    return response.data;
  }

  /**
   * Save settings (tabs configuration)
   */
  async saveSettings(tabsData, tabOrder, key = 'default') {
    const response = await this.request('/settings', {
      method: 'POST',
      body: JSON.stringify({ key, tabsData, tabOrder })
    });
    return response.data;
  }

  // ============== Material APIs ==============

  /**
   * Get all materials with their tests
   */
  async getMaterials() {
    const response = await this.request('/materials');
    return response.data || [];
  }

  /**
   * Get a single material by ID
   */
  async getMaterial(materialId) {
    const response = await this.request(`/materials/${materialId}`);
    return response.data;
  }

  /**
   * Create a new material
   */
  async createMaterial(data) {
    const response = await this.request('/materials', {
      method: 'POST',
      body: JSON.stringify({ data })
    });
    return response.data;
  }

  /**
   * Create multiple materials at once
   */
  async bulkCreateMaterials(materialsData) {
    const response = await this.request('/materials/bulk', {
      method: 'POST',
      body: JSON.stringify({ materials: materialsData })
    });
    return response.data;
  }

  /**
   * Update a material
   */
  async updateMaterial(materialId, data) {
    const response = await this.request(`/materials/${materialId}`, {
      method: 'PUT',
      body: JSON.stringify({ data })
    });
    return response.data;
  }

  /**
   * Delete a material
   */
  async deleteMaterial(materialId) {
    await this.request(`/materials/${materialId}`, {
      method: 'DELETE'
    });
    return true;
  }

  // ============== Test APIs ==============

  /**
   * Get all tests for a material
   */
  async getTests(materialId) {
    const response = await this.request(`/materials/${materialId}/tests`);
    return response.data || {};
  }

  /**
   * Create a new test
   */
  async createTest(materialId, testType, data) {
    const response = await this.request(`/materials/${materialId}/tests`, {
      method: 'POST',
      body: JSON.stringify({ testType, data })
    });
    return response.data;
  }

  /**
   * Create multiple tests at once
   */
  async bulkCreateTests(materialId, testType, testsData) {
    const response = await this.request(`/materials/${materialId}/tests/bulk`, {
      method: 'POST',
      body: JSON.stringify({ testType, tests: testsData })
    });
    return response.data;
  }

  /**
   * Replace all tests for a material (for import)
   */
  async replaceTests(materialId, testsByType) {
    const response = await this.request(`/materials/${materialId}/tests/replace`, {
      method: 'PUT',
      body: JSON.stringify({ tests: testsByType })
    });
    return response.data;
  }

  /**
   * Update a test
   */
  async updateTest(testId, data) {
    const response = await this.request(`/tests/${testId}`, {
      method: 'PUT',
      body: JSON.stringify({ data })
    });
    return response.data;
  }

  /**
   * Delete a test
   */
  async deleteTest(testId) {
    await this.request(`/tests/${testId}`, {
      method: 'DELETE'
    });
    return true;
  }

  // ============== Test Method APIs ==============

  /**
   * Get all test methods
   */
  async getTestMethods() {
    const response = await this.request('/test-methods');
    return response.data || [];
  }

  /**
   * Get a single test method by ID
   */
  async getTestMethod(methodId) {
    const response = await this.request(`/test-methods/${methodId}`);
    return response.data;
  }

  /**
   * Create a new test method
   */
  async createTestMethod(data) {
    const response = await this.request('/test-methods', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.data;
  }

  /**
   * Update a test method
   */
  async updateTestMethod(methodId, data) {
    const response = await this.request(`/test-methods/${methodId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return response.data;
  }

  /**
   * Delete a test method
   */
  async deleteTestMethod(methodId) {
    await this.request(`/test-methods/${methodId}`, {
      method: 'DELETE'
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
}

export const materialCouncilApi = new MaterialCouncilApi();
export default materialCouncilApi;
