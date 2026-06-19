import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { AUTH_BASE, LOGISTICA_BASE } from '../api/config';
import { getAccess, getRefresh, saveTokens } from '../auth/storage';

// Rastreamento em SEGUNDO PLANO (Fase B) — funciona com o app fechado/tela
// bloqueada. EXIGE build standalone (EAS): NÃO roda no Expo Go (startLocation
// UpdatesAsync/requestBackground lançam exceção lá → o caller cai pro modo
// foreground da Fase A). Roda como foreground-service no Android, com
// notificação fixa (transparência LGPD).
//
// O task roda fora do React: lê o viagemId persistido e o token do SecureStore,
// e faz POST direto (fetch). Em 401, tenta refresh uma vez. LGPD: o backend só
// grava se a viagem está EM_CURSO; ao retornar, paramos o serviço e limpamos o id.

export const BG_LOCATION_TASK = 'capul-rastreamento-bg';
const VIAGEM_KEY = 'capul_rastreamento_viagem';

async function tentarRefresh(): Promise<string | null> {
  try {
    const refresh = await getRefresh();
    if (!refresh) return null;
    const r = await fetch(`${AUTH_BASE}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { accessToken: string; refreshToken: string };
    await saveTokens(d.accessToken, d.refreshToken);
    return d.accessToken;
  } catch {
    return null;
  }
}

async function postPosicao(viagemId: string, coords: Location.LocationObjectCoords, capturadoEm: string) {
  const corpo = JSON.stringify({
    viagemId,
    latitude: coords.latitude,
    longitude: coords.longitude,
    precisao: coords.accuracy ?? undefined,
    velocidade: coords.speed != null && coords.speed >= 0 ? coords.speed : undefined,
    capturadoEm,
  });
  const enviar = (token: string | null) =>
    fetch(`${LOGISTICA_BASE}/rastreamento/posicao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: corpo,
    });

  let token = await getAccess();
  let resp = await enviar(token);
  if (resp.status === 401) {
    token = await tentarRefresh();
    if (token) resp = await enviar(token);
  }
  // best-effort: ping perdido (sem sinal / token morto) não é fatal.
}

// Registro do task em escopo de módulo — precisa acontecer no boot (App.tsx
// importa este arquivo). Idempotente: o TaskManager ignora redefinição.
TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const viagemId = await SecureStore.getItemAsync(VIAGEM_KEY);
  if (!viagemId) return;
  const locs = ((data as { locations?: Location.LocationObject[] })?.locations) ?? [];
  for (const loc of locs) {
    await postPosicao(viagemId, loc.coords, new Date(loc.timestamp).toISOString());
  }
});

/**
 * Liga o rastreamento em background pra uma viagem. Retorna true se conseguiu
 * (build standalone + permissões). Em Expo Go / sem permissão → false (o caller
 * usa o foreground da Fase A).
 */
export async function iniciarBackground(viagemId: string): Promise<boolean> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') return false;

    await SecureStore.setItemAsync(VIAGEM_KEY, viagemId);

    const jaRodando = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false);
    if (jaRodando) await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => {});

    await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 25_000,
      distanceInterval: 100,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: false,
      foregroundService: {
        notificationTitle: 'CAPUL Entregas — viagem em andamento',
        notificationBody: 'Localização ativa durante a viagem.',
        notificationColor: '#1e7d3a',
      },
    });
    return true;
  } catch {
    // Expo Go / sem suporte nativo: cai pro foreground.
    await SecureStore.deleteItemAsync(VIAGEM_KEY).catch(() => {});
    return false;
  }
}

/** Desliga o rastreamento em background (no retorno / ao sair da viagem). */
export async function pararBackground(): Promise<void> {
  await SecureStore.deleteItemAsync(VIAGEM_KEY).catch(() => {});
  try {
    if (await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
    }
  } catch {
    /* nada a parar */
  }
}
