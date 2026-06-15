import Constants from 'expo-constants';

/**
 * URL base da API (nginx da plataforma). Ordem de resolução:
 *  1. EXPO_PUBLIC_API_URL (env do build) — override explícito.
 *  2. DEV: mesmo host do Metro, via HTTP (auto-sincronia com o backend local).
 *  3. app.json → expo.extra.apiUrl (fallback).
 */
const extraUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;

/**
 * Em DEV o celular já conversa com o Metro no IP da máquina de desenvolvimento.
 * Reaproveitamos esse MESMO host para a API, na porta 8085 (HTTP) — assim o
 * aparelho fica sempre em sincronia com o backend local, sem IP chumbado e sem
 * cair no fallback. HTTP (não HTTPS) porque o Expo Go recusa o certificado
 * self-signed do nginx; a 8085 é um listener HTTP exclusivo de DEV (auth +
 * logistica), montado só na máquina de dev via docker-compose.override.yml.
 */
const DEV_API_PORT = 8085;
function devApiUrl(): string | undefined {
  const hostUri = Constants.expoConfig?.hostUri; // ex.: "172.16.0.159:8081"
  const host = hostUri?.split(':')[0];
  return host ? `http://${host}:${DEV_API_PORT}` : undefined;
}

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? devApiUrl() : undefined) ??
  extraUrl ??
  'https://platform.capul.com.br'
).replace(/\/$/, '');

export const AUTH_BASE = `${API_URL}/api/v1/auth`;
export const LOGISTICA_BASE = `${API_URL}/api/v1/logistica`;
