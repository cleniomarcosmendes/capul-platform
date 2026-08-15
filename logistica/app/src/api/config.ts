import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { urlPorCanal } from './urlPorCanal';

/**
 * URL base da API (nginx da plataforma). Ordem de resolução:
 *  1. EXPO_PUBLIC_API_URL (env do build) — override explícito.
 *  2. HOST DO METRO, via HTTP (auto-sincronia com o backend local) — vale sempre
 *     que há um Metro servindo o bundle, inclusive com `--no-dev`.
 *  3. RUNTIME por canal: Updates.channel → production/homolog (o binário nativo
 *     grava o canal por flavor; é isso que torna a promoção do bundle exato segura).
 *  4. Fallback: homologação (mais seguro que produção p/ um build não-identificado).
 *
 * ⚠️ O passo 2 já foi `__DEV__ ? devApiUrl() : undefined`, e isso mandava
 * `expo start --no-dev --minify` para HOMOLOGAÇÃO **sem avisar** — mesmo Expo
 * Go, mesmo aparelho, mesmo Metro, mas `__DEV__` false: caía no passo 4. Em
 * 15/08 isso custou duas rodadas de teste: a rota criada no ambiente local não
 * aparecia no app, e depois o login parou de funcionar. Hoje a condição é
 * `hostUri` (existe só com Metro servindo), então o modo do bundle não muda mais
 * de servidor. O rodapé do login mostra o host, para o erro nunca mais ser mudo.
 */
const DEV_API_PORT = 8085;
/**
 * Backend da MÁQUINA QUE ESTÁ SERVINDO ESTE BUNDLE.
 *
 * A condição é `hostUri`, não `__DEV__`: `hostUri` só existe quando um Metro
 * está servindo o app (Expo Go), e é undefined no APK nativo — que é
 * exatamente quando NÃO se deve apontar para máquina de ninguém. Amarrar isso a
 * `__DEV__` fazia `--no-dev` (bundle de produção no MESMO Expo Go, no MESMO
 * aparelho, servido pelo MESMO Metro) cair no fallback de homologação.
 */
function urlDoHostDoMetro(): string | undefined {
  const hostUri = Constants.expoConfig?.hostUri; // ex.: "172.16.0.159:8081"
  const host = hostUri?.split(':')[0];
  return host ? `http://${host}:${DEV_API_PORT}` : undefined;
}

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ??
  urlDoHostDoMetro() ??
  urlPorCanal(Updates.channel) ??
  'https://platformhlg.capul.com.br'
).replace(/\/$/, '');

export const AUTH_BASE = `${API_URL}/api/v1/auth`;
export const LOGISTICA_BASE = `${API_URL}/api/v1/logistica`;
// O Inventário serve direto sob /api/v1 (não tem prefixo de módulo como a
// Logística) — é o mesmo caminho que o frontend web usa em `inventarioApi`.
export const INVENTARIO_BASE = `${API_URL}/api/v1`;
