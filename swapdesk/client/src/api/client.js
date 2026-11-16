import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('swapdesk_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = false;
let waiting = [];

const settleWaiting = (error, token = null) => {
  waiting.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  waiting = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status !== 401 ||
      original?._retry ||
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    if (refreshing) {
      return new Promise((resolve, reject) => {
        waiting.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    refreshing = true;

    try {
      const response = await api.post('/auth/refresh');
      const token = response.data.accessToken;
      if (!token) throw new Error('Refresh token response did not include an access token');

      localStorage.setItem('swapdesk_access_token', token);
      settleWaiting(null, token);
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    } catch (refreshError) {
      localStorage.removeItem('swapdesk_access_token');
      settleWaiting(refreshError);
      window.dispatchEvent(new Event('swapdesk:logout'));
      return Promise.reject(refreshError);
    } finally {
      refreshing = false;
    }
  }
);

export default api;
