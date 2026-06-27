import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const storedToken = sessionStorage.getItem('token') || localStorage.getItem('token');
  const storedUser = sessionStorage.getItem('user') || localStorage.getItem('user');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(storedToken);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          // Try to get user data from storage first (from login)
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          } else {
            // Fallback to JWT decoding if no stored user
            const userData = await authService.getCurrentUser();
            setUser(userData);
          }
        } catch (error) {
          console.error('Auth initialization failed:', error);
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [token]);

  const login = async (credentials) => {
    try {
      const response = await authService.login(credentials);
      const { token: newToken, refreshToken: newRefreshToken, user: userData } = response;

      sessionStorage.setItem('token', newToken);
      localStorage.setItem('token', newToken);
      sessionStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('user', JSON.stringify(userData));
      if (newRefreshToken) {
        sessionStorage.setItem('refreshToken', newRefreshToken);
        localStorage.setItem('refreshToken', newRefreshToken);
      }
      setToken(newToken);
      setUser(userData);

      return { success: true };
    } catch (error) {
      // Provide user-friendly error messages
      let errorMessage = 'Login failed. Please try again.';

      if (error.response?.status === 401 || error.response?.status === 404) {
        errorMessage = 'Incorrect username or password. Please check your credentials and try again.';
      } else if (error.response?.status === 403) {
        errorMessage = 'Your account has been deactivated. Please contact an administrator.';
      } else if (error.response?.data?.error) {
        // Use server error message if available, but make it more user-friendly
        const serverError = error.response.data.error.toLowerCase();
        if (serverError.includes('username') || serverError.includes('password') || serverError.includes('invalid')) {
          errorMessage = 'Incorrect username or password. Please check your credentials and try again.';
        } else if (serverError.includes('disabled') || serverError.includes('inactive') || serverError.includes('deactivated')) {
          errorMessage = 'Your account has been deactivated. Please contact an administrator.';
        } else {
          errorMessage = error.response.data.error;
        }
      } else if (!error.response) {
        errorMessage = 'Unable to connect to server. Please check your internet connection.';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('refreshToken');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
  };

  const refreshToken = async () => {
    try {
      const response = await authService.refreshToken();
      const { token: newToken } = response;

      sessionStorage.setItem('token', newToken);
      localStorage.setItem('token', newToken);
      setToken(newToken);

      return { success: true };
    } catch (error) {
      logout();
      return { success: false };
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    refreshToken,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    isDoctor: user?.role === 'DOCTOR',
    isNurse: user?.role === 'NURSE',
    isBillingOfficer: user?.role === 'BILLING_OFFICER',
    isPharmacyBillingOfficer: user?.role === 'PHARMACY_BILLING_OFFICER',
    isPharmacist: user?.role === 'PHARMACIST',
    isLabTechnician: user?.role === 'LAB_TECHNICIAN',
    isRadiologist: user?.role === 'RADIOLOGIST',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
