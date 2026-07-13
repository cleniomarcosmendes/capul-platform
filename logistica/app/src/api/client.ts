import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_URL, AUTH_BASE } from './config';
import { clearTokens, getRefresh, saveTokens } from '../auth/storage';
import type { LoginResponse } from '../types/api';

// Token de acesso em memória (sincronizado com o SecureStore). Evita um read de
// keystore a cada request; o refresh é a fonte da verdade ao reabrir o app.
let accessToken: string | null = null;

// Callback que o AuthContext registra pra reagir a logout forçado (refresh morto).
let onAuthFailure: (() => void) | null = null;
export function setOnAuthFailure(cb: (() => void) | null) {
  onAuthFailure = cb;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

// Token de CONDUTOR da viagem aberta (login PADRÃO): prova quem opera a viagem
// sem repetir matrícula+senha por ação. Setado no gate; limpo ao sair da viagem.
let condutorToken: string | null = null;
export function setCondutorToken(token: string | null) {
  condutorToken = token;
}
export function getCondutorToken(): string | null {
  return condutorToken;
}

export const api = axios.create({ baseURL: API_URL, timeout: 20_000 });

// Anexa o Bearer (quando houver) + o token de condutor (na viagem) em toda request.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`);
  if (condutorToken) config.headers.set('X-Condutor-Token', condutorToken);
  return config;
});

// --- Refresh silencioso, single-flight (um refresh por vez; requests
// concorrentes que tomarem 401 esperam o mesmo refresh). ---
let refreshing: Promise<string | null> | null = null;

/** Renova o access token a partir do refresh salvo. Exportado para o boot do
 *  AuthContext (garantir access+role frescos) além do uso no interceptor 401. */
export async function doRefresh(): Promise<string | null> {
  const refresh = await getRefresh();
  if (!refresh) return null;
  try {
    // Cliente "cru" (sem interceptors) pra não recursar.
    const { data } = await axios.post<LoginResponse>(`${AUTH_BASE}/refresh`, {
      refreshToken: refresh,
    });
    await saveTokens(data.accessToken, data.refreshToken);
    accessToken = data.accessToken;
    return data.accessToken;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const isAuthCall = original?.url?.includes('/api/v1/auth/');

    if (status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      refreshing = refreshing ?? doRefresh();
      const novo = await refreshing.finally(() => {
        refreshing = null;
      });
      if (novo) {
        original.headers.set('Authorization', `Bearer ${novo}`);
        return api(original);
      }
      // Refresh falhou → sessão morta. Limpa e avisa o app.
      await clearTokens();
      accessToken = null;
      onAuthFailure?.();
    }
    return Promise.reject(error);
  },
);

/**
 * Conta com MFA (verificação em duas etapas). O app não tem a segunda etapa: o
 * auth-gateway responde 200 com `{ mfaRequired, mfaToken }` e SEM tokens, então
 * sem este erro o login seguia adiante e morria gravando `undefined` no
 * SecureStore — a tela mostrava "verifique a conexão", que manda o usuário caçar
 * problema de rede que não existe.
 */
export class MfaNaoSuportadoError extends Error {
  constructor() {
    super('Conta com MFA — o app não faz a segunda etapa.');
    this.name = 'MfaNaoSuportadoError';
  }
}

/** Login mobile (device-session). Devolve os tokens; NÃO grava (quem grava é o AuthContext). */
export async function loginRequest(
  login: string,
  senha: string,
  deviceId: string,
): Promise<LoginResponse> {
  const { data } = await axios.post<LoginResponse>(`${AUTH_BASE}/login`, {
    login,
    senha,
    deviceId,
    deviceInfo: 'CAPUL Entregas (app)',
    plataforma: 'ANDROID',
  });
  if (data.mfaRequired || !data.accessToken || !data.refreshToken) {
    throw new MfaNaoSuportadoError();
  }
  return data;
}
