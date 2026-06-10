import Constants from 'expo-constants';

/**
 * URL base da API (nginx da plataforma). Ordem de resolução:
 *  1. EXPO_PUBLIC_API_URL (env do build) — recomendado p/ DEV (IP da LAN).
 *  2. app.json → expo.extra.apiUrl (default PROD).
 * O celular NÃO alcança "localhost" da máquina — em DEV use o IP da LAN
 * (ex.: https://192.168.0.10) e aceite o certificado self-signed no aparelho.
 */
const extraUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ??
  extraUrl?.replace(/\/$/, '') ??
  'https://platform.capul.com.br';

export const AUTH_BASE = `${API_URL}/api/v1/auth`;
export const LOGISTICA_BASE = `${API_URL}/api/v1/logistica`;
