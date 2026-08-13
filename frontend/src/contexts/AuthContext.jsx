import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

// API 기본 URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 토큰 관리 함수들
  const getTokens = () => ({
    accessToken: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken')
  });

  const setTokens = (accessToken, refreshToken) => {
    if (accessToken) localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  };

  const clearTokens = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  };

  // API 요청 헬퍼
  const apiRequest = async (endpoint, options = {}) => {
    const { accessToken } = getTokens();
    const headers = {
      'Content-Type': 'application/json',
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...options.headers
    };

    const response = await fetch(`${API_BASE_URL}/auth${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '요청 처리 중 오류가 발생했습니다.');
    }

    return data;
  };

  // 토큰 갱신
  const refreshAccessToken = async () => {
    try {
      const { refreshToken } = getTokens();
      if (!refreshToken) return false;

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem('accessToken', data.data.access_token);
        return true;
      }

      clearTokens();
      return false;
    } catch (err) {
      console.error('Token refresh error:', err);
      clearTokens();
      return false;
    }
  };

  // 현재 사용자 정보 가져오기
  const fetchCurrentUser = async () => {
    try {
      const data = await apiRequest('/me', { method: 'GET' });
      if (data.success && data.data) {
        setUser(data.data);
        localStorage.setItem('user', JSON.stringify(data.data));
        return data.data;
      }
      return null;
    } catch (err) {
      // 토큰 만료 시 갱신 시도
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return fetchCurrentUser();
      }
      clearTokens();
      setUser(null);
      return null;
    }
  };

  // 초기 로드 시 인증 상태 확인
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { accessToken } = getTokens();
        if (accessToken) {
          // localStorage에서 먼저 사용자 정보 로드
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            try {
              setUser(JSON.parse(storedUser));
            } catch (e) {
              console.error('Failed to parse stored user:', e);
            }
          }

          // 서버에서 최신 정보 확인
          await fetchCurrentUser();
        }
      } catch (err) {
        console.error('Auth init error:', err);
        clearTokens();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // 회원가입
  const register = useCallback(async (userData) => {
    setError(null);
    try {
      const data = await apiRequest('/register', {
        method: 'POST',
        body: JSON.stringify(userData)
      });

      if (data.success) {
        return { success: true, user: data.data };
      }
      throw new Error(data.message || '회원가입에 실패했습니다.');
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  // 로그인
  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const data = await apiRequest('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (data.success && data.data) {
        const { access_token, refresh_token, user: loggedInUser } = data.data;
        setTokens(access_token, refresh_token);
        localStorage.setItem('user', JSON.stringify(loggedInUser));
        setUser(loggedInUser);
        return { success: true, user: loggedInUser };
      }
      throw new Error(data.message || '로그인에 실패했습니다.');
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  // 로그아웃
  const logout = useCallback(async () => {
    try {
      const { refreshToken } = getTokens();
      if (refreshToken) {
        await apiRequest('/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refreshToken })
        }).catch(() => {}); // 에러 무시
      }
    } finally {
      clearTokens();
      setUser(null);
      setError(null);
    }
  }, []);

  // 프로필 업데이트
  const updateProfile = useCallback(async (profileData) => {
    setError(null);
    try {
      const data = await apiRequest('/me', {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });

      if (data.success && data.data) {
        localStorage.setItem('user', JSON.stringify(data.data));
        setUser(data.data);
        return { success: true, user: data.data };
      }
      throw new Error(data.message || '프로필 업데이트에 실패했습니다.');
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  // 비밀번호 변경
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    setError(null);
    try {
      const data = await apiRequest('/me/password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      if (data.success) {
        // 비밀번호 변경 후 로그아웃
        await logout();
        return { success: true };
      }
      throw new Error(data.message || '비밀번호 변경에 실패했습니다.');
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [logout]);

  // 인증 확인 함수
  const isAuthenticated = useCallback(() => {
    return user !== null;
  }, [user]);

  // 에러 클리어
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated,
    isAdmin: user?.is_admin || false,
    token: getTokens().accessToken,
    register,
    login,
    logout,
    updateProfile,
    changePassword,
    clearError,
    refreshAccessToken
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
