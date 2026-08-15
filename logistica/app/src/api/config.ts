import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { urlPorCanal } from './urlPorCanal';

/**
 * URL base da API (nginx da plataforma). Ordem de resolução:
 *  1. EXPO_PUBLIC_API_URL (env do build) — override explícito.
 *  2. DEV: mesmo host do Metro, via HTTP (auto-sincronia com o backend local).
 *  3. RUNTIME por canal: Updates.channel → production/homolog (o binário nativo
 *     grava o canal por flavor; é isso que torna a promoção do bundle exato segura).
 *  4. Fallback: homologação (mais seguro que produção p/ um build não-identificado).
 *
 * ⚠️ ARMADILHA — `expo start --no-dev --minify` NÃO fala com o backend local.
 * O passo 2 é `__DEV__ ? devApiUrl() : undefined`, e em `--no-dev` o `__DEV__` é
 * false; o Expo Go também não tem canal de update, então a resolução cai direto
 * no passo 4 e o app vai parar em HOMOLOGAÇÃO — logando noutro ambiente, sem
 * dizer nada (aconteceu em 15/08: a rota criada aqui simplesmente não aparecia).
 * Para testar com bundle de produção contra o backend local, defina
 * `EXPO_PUBLIC_API_URL` (há um `.env.local` de exemplo no app, fora do git) e
 * suba o Metro com `-c` — a variável é embutida no bundle.
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
  urlPorCanal(Updates.channel) ??
  'https://platformhlg.capul.com.br'
).replace(/\/$/, '');

export const AUTH_BASE = `${API_URL}/api/v1/auth`;
export const LOGISTICA_BASE = `${API_URL}/api/v1/logistica`;
// O Inventário serve direto sob /api/v1 (não tem prefixo de módulo como a
// Logística) — é o mesmo caminho que o frontend web usa em `inventarioApi`.
export const INVENTARIO_BASE = `${API_URL}/api/v1`;
