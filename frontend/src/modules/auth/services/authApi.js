/**
 * Authentication API Service
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class AuthApi {
  constructor() {
    this.baseUrl = `${API_BASE_URL}/auth`;
  }

  /**
   * Get stored tokens
   */
  getTokens() {
    return {
      accessToken: localStorage.getItem('accessToken'),
      refreshToken: localStorage.getItem('refreshToken')
    };
  }

  /**
   * Store tokens
   */
  setTokens(accessToken, refreshToken) {
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
  }

  /**
   * Clear tokens
   */
  clearTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  /**
   * Get authorization header
   */
  getAuthHeader() {
    const { accessToken } = this.getTokens();
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  }

  /**
   * Make API request with error handling
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        // Try to refresh token on 401
        if (response.status === 401 && !options._retry) {
          const refreshed = await this.refreshToken();
          if (refreshed) {
            return this.request(endpoint, { ...options, _retry: true });
          }
        }
        throw new Error(data.message || '요청 처리 중 오류가 발생했습니다.');
      }

      return data;
    } catch (error) {
      console.error('Auth API Error:', error);
      throw error;
    }
  }

  /**
   * Register new user
   */
  async register(userData) {
    const response = await this.request('/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });

    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.message || '회원가입에 실패했습니다.');
  }

  /**
   * Login user
   */
  async login(email, password) {
    const response = await this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (response.success && response.data) {
      const { access_token, refresh_token, user } = response.data;
      this.setTokens(access_token, refresh_token);
      localStorage.setItem('user', JSON.stringify(user));
      return { user, accessToken: access_token };
    }
    throw new Error(response.message || '로그인에 실패했습니다.');
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      const { refreshToken } = this.getTokens();
      if (refreshToken) {
        await this.request('/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refreshToken })
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken() {
    try {
      const { refreshToken } = this.getTokens();
      if (!refreshToken) return false;

      const response = await fetch(`${this.baseUrl}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.setTokens(data.data.access_token);
        return true;
      }

      this.clearTokens();
      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearTokens();
      return false;
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    const response = await this.request('/me', {
      method: 'GET'
    });

    if (response.success && response.data) {
      localStorage.setItem('user', JSON.stringify(response.data));
      return response.data;
    }
    throw new Error(response.message || '사용자 정보를 가져올 수 없습니다.');
  }

  /**
   * Update user profile
   */
  async updateProfile(profileData) {
    const response = await this.request('/me', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });

    if (response.success && response.data) {
      localStorage.setItem('user', JSON.stringify(response.data));
      return response.data;
    }
    throw new Error(response.message || '프로필 업데이트에 실패했습니다.');
  }

  /**
   * Change password
   */
  async changePassword(currentPassword, newPassword) {
    const response = await this.request('/me/password', {
      method: 'PUT',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword
      })
    });

    if (response.success) {
      return true;
    }
    throw new Error(response.message || '비밀번호 변경에 실패했습니다.');
  }

  /**
   * Search users by name (for autocomplete)
   */
  async searchUsers(query) {
    const response = await this.request(`/users/search?q=${encodeURIComponent(query)}`);
    return response.success ? response.data : [];
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    const { accessToken } = this.getTokens();
    return !!accessToken;
  }

  /**
   * Get stored user data
   */
  getStoredUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
}

export const authApi = new AuthApi();
export default authApi;
