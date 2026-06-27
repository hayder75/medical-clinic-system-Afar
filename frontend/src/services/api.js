import axios from 'axios';

// Determine API base URL based on environment
// In development (localhost), use full URL to backend
// Always connect to backend on port 3001 when running locally
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `${window.location.protocol}//${window.location.hostname}:3001/api`
  : `${window.location.protocol}//${window.location.hostname}/api`;

const pathname = window.location.pathname;
const isDev = process.env.NODE_ENV === 'development' || window.location.port === '3000';

// Log API URL for debugging
console.log('🌐 API Base URL:', API_BASE_URL);
console.log('📍 Current Location:', window.location.href);

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  withCredentials: true,
});

const getStoredToken = () => sessionStorage.getItem('token') || localStorage.getItem('token');
const getStoredRefreshToken = () => sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken');

const persistToken = (token) => {
  if (!token) return;
  sessionStorage.setItem('token', token);
  localStorage.setItem('token', token);
};

const clearStoredAuth = () => {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('user');
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = getStoredRefreshToken();
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken
          });

          const { token } = response.data;
          persistToken(token);

          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }

        clearStoredAuth();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        clearStoredAuth();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
