import axios from 'axios';

// Mesmo padrão dos demais módulos: token JWT em localStorage('accessToken'),
// compartilhado na mesma origem (https://localhost) pelo Hub no login.
export const authApi = axios.create({ baseURL: '/api/v1/auth', timeout: 30_000 });
export const coreApi = axios.create({ baseURL: '/api/v1/core', timeout: 30_000 });
export const logisticaApi = axios.create({ baseURL: '/api/v1/logistica', timeout: 30_000 });

[authApi, coreApi, logisticaApi].forEach((api) => {
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  api.interceptors.response.use(
    (res) => res,
    (error) => {
      // 401 sem sessão válida → volta pro Hub (login centralizado).
      if (error.response?.status === 401) {
        localStorage.removeItem('accessToken');
        window.location.href = '/';
      }
      return Promise.reject(error);
    },
  );
});
