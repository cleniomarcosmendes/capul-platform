import axios from 'axios';

// Com Nginx, tudo na mesma origem — usar paths relativos
// Em dev local sem Nginx, usar proxy do Vite ou porta direta
const BASE_URL = import.meta.env.VITE_API_URL || '';

export const authApi = axios.create({
  baseURL: `${BASE_URL}/api/v1/auth`,
});

export const coreApi = axios.create({
  baseURL: `${BASE_URL}/api/v1/core`,
});

// Interceptor: adiciona token em todas as requests
[authApi, coreApi].forEach((api) => {
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Interceptor: refresh automatico quando token expira
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (!refreshToken) throw new Error('No refresh token');

          const { data } = await axios.post(
            `${BASE_URL}/api/v1/auth/refresh`,
            { refreshToken },
          );
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('usuario');
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    },
  );
});
