import axios from 'axios';

// Determine API base URL based on environment
// In development (localhost), use full URL to backend
// In production (behind Nginx), use relative URL
function getApiBaseUrl() {
  // Development: If running on port 3001 (Vite default), connect to backend on port 3000
  // This works for both localhost and LAN IP access
  if (window.location.port === '3001') {
    return `${window.location.protocol}//${window.location.hostname}:3000/api`;
  }

  // Check if running locally (fallback)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000/api';
  }

  // Check if we're being served from a subdirectory (e.g., /d)
  const pathname = window.location.pathname;
  if (pathname.startsWith('/d')) {
    // If served from /d, API calls should go to /d/api
    return '/d/api';
  }

  // Production - use relative URL (Nginx will proxy)
  return '/api';
}

const API_BASE_URL = getApiBaseUrl();

// Log API URL for debugging
console.log('🌐 API Base URL:', API_BASE_URL);
console.log('📍 Current Location:', window.location.href);

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('token');
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
        const refreshToken = sessionStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken
          });

          const { token } = response.data;
          sessionStorage.setItem('token', token);

          // Retry original request
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
