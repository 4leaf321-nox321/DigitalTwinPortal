/**
 * Authentication Context and Hook
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authApi from '../services/authApi';

// Create context
const AuthContext = createContext(null);

/**
 * Auth Provider Component
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (authApi.isAuthenticated()) {
          // Try to get user from localStorage first
          const storedUser = authApi.getStoredUser();
          if (storedUser) {
            setUser(storedUser);
          }

          // Verify with server
          try {
            const currentUser = await authApi.getCurrentUser();
            setUser(currentUser);
          } catch (err) {
            // Token might be expired, try refresh
            const refreshed = await authApi.refreshToken();
            if (refreshed) {
              const currentUser = await authApi.getCurrentUser();
              setUser(currentUser);
            } else {
              authApi.clearTokens();
              setUser(null);
            }
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
        authApi.clearTokens();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * Register new user
   */
  const register = useCallback(async (userData) => {
    setError(null);
    try {
      const newUser = await authApi.register(userData);
      return { success: true, user: newUser };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Login user
   */
  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const { user: loggedInUser } = await authApi.login(email, password);
      setUser(loggedInUser);
      return { success: true, user: loggedInUser };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setError(null);
    }
  }, []);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (profileData) => {
    setError(null);
    try {
      const updatedUser = await authApi.updateProfile(profileData);
      setUser(updatedUser);
      return { success: true, user: updatedUser };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Change password
   */
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    setError(null);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      // Logout after password change
      await logout();
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [logout]);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin: user?.is_admin || false,
    register,
    login,
    logout,
    updateProfile,
    changePassword,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * useAuth Hook
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default useAuth;
