import { api } from './client';
import { LOGISTICA_BASE } from './config';

// Rastreamento em tempo real (Fase A) — o app envia pings de GPS enquanto a
// viagem está em curso (foreground). Best-effort: ping perdido não trava nada.

export interface PosicaoPayload {
  latitude: number;
  longitude: number;
  precisao?: number;
  velocidade?: number;
  bateria?: number;
  capturadoEm?: string;
}

export async function enviarPosicao(viagemId: string, p: PosicaoPayload): Promise<void> {
  await api.post(`${LOGISTICA_BASE}/rastreamento/posicao`, { viagemId, ...p }, { timeout: 10_000 });
}
