import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle expired token — but ONLY redirect if we're not on an auth endpoint
// This prevents the admin-login 401 (wrong secret key) from wiping the page
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthEndpoint = url.includes('/auth/login') ||
                           url.includes('/auth/admin-login') ||
                           url.includes('/auth/register');

    if (error.response?.status === 401 && !isAuthEndpoint) {
      // Expired session — clear everything and redirect
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('username');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_email');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export const getHeatmapUrl = (recordId) =>
  `${BASE_URL}/uploads/${recordId}_heatmap.png`;

export default api;
