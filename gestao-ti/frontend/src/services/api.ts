import axios from 'axios';
import { getWorkspaceAtivoFromStorage } from '../contexts/WorkspaceContext';

const AUTH_BASE = '/api/v1/auth';
const CORE_BASE = '/api/v1/core';
const GESTAO_BASE = '/api/v1/gestao-ti';

// timeout 30s — auditoria 10/05/2026 #A2 (Robustez UX)
// Para uploads grandes (anexos chamados/projetos), passar override:
//   gestaoApi.post(url, formData, { timeout: 600_000 })
export const authApi = axios.create({ baseURL: AUTH_BASE, timeout: 30_000 });
export const coreApi = axios.create({ baseURL: CORE_BASE, timeout: 30_000 });
export const gestaoApi = axios.create({ baseURL: GESTAO_BASE, timeout: 30_000 });

let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error);
    } else {
      p.resolve(token!);
    }
  });
  failedQueue = [];
}

[authApi, coreApi, gestaoApi].forEach((api) => {
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    // S15.3 (25/05) — header X-Workspace-Id quando user multi-perfil
    // escolheu workspace. Backend (S15.1) valida e ignora se inválido.
    const wsId = getWorkspaceAtivoFromStorage();
    if (wsId) config.headers['X-Workspace-Id'] = wsId;
    return config;
  });

  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({
              resolve: (token: string) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                resolve(api(originalRequest));
              },
              reject,
            });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshToken = localStorage.getItem('refreshToken');
          const { data } = await axios.post(`${AUTH_BASE}/refresh`, { refreshToken });
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          processQueue(null, data.accessToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          localStorage.clear();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    },
  );
});
