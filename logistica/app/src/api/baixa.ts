import { api } from './client';
import { LOGISTICA_BASE } from './config';

/** Payload da baixa — espelha o BaixarEntregaDto do backend. */
export interface BaixaPayload {
  resultado: 'ENTREGUE' | 'NAO_ENTREGUE';
  motivo?: string;
  recebedorNome?: string;
  geoLat?: number;
  geoLng?: number;
  /** Gerada no 1º clique e fixa no item da fila — reenvio offline não duplica. */
  idempotencyKey: string;
}

/** Provas binárias — as DUAS são permitidas; ≥1 obrigatória p/ ENTREGUE. file:// local. */
export interface ProvasBaixa {
  fotoUri?: string;        // JPG (câmera)
  assinaturaUri?: string;  // PNG (assinatura na tela)
}

/**
 * POST /entregas/:id/baixar (multipart). Manda FOTO e/ou ASSINATURA em campos
 * separados (`foto`/`assinatura`) — as duas juntas são permitidas. O backend é
 * idempotente: entrega já terminal devolve o estado atual (no-op) — seguro reenviar.
 */
export async function baixarEntrega(
  entregaId: string,
  payload: BaixaPayload,
  provas?: ProvasBaixa,
): Promise<void> {
  const form = new FormData();
  form.append('resultado', payload.resultado);
  form.append('idempotencyKey', payload.idempotencyKey);
  if (payload.motivo) form.append('motivo', payload.motivo);
  if (payload.recebedorNome) form.append('recebedorNome', payload.recebedorNome);
  if (payload.geoLat !== undefined) form.append('geoLat', String(payload.geoLat));
  if (payload.geoLng !== undefined) form.append('geoLng', String(payload.geoLng));
  // RN/Expo: arquivo em FormData = { uri, name, type } (não Blob).
  if (provas?.fotoUri) {
    form.append('foto', { uri: provas.fotoUri, name: 'foto.jpg', type: 'image/jpeg' } as unknown as Blob);
  }
  if (provas?.assinaturaUri) {
    form.append('assinatura', { uri: provas.assinaturaUri, name: 'assinatura.png', type: 'image/png' } as unknown as Blob);
  }

  await api.post(`${LOGISTICA_BASE}/entregas/${entregaId}/baixar`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000, // prova em rede móvel fraca demora — não abortar cedo
  });
}
