import { api } from './client';
import { LOGISTICA_BASE } from './config';

/** Payload da baixa — espelha o BaixarEntregaDto do backend. */
export interface BaixaPayload {
  resultado: 'ENTREGUE' | 'NAO_ENTREGUE';
  motivo?: string;
  tipoProva?: 'FOTO' | 'ASSINATURA';
  recebedorNome?: string;
  geoLat?: number;
  geoLng?: number;
  /** Gerada no 1º clique e fixa no item da fila — reenvio offline não duplica. */
  idempotencyKey: string;
}

/**
 * POST /entregas/:id/baixar (multipart). `fotoUri` é um file:// local
 * (expo-image-picker / cópia da fila). O backend é idempotente: entrega já
 * terminal devolve o estado atual (no-op) — seguro reenviar.
 */
export async function baixarEntrega(
  entregaId: string,
  payload: BaixaPayload,
  fotoUri?: string,
): Promise<void> {
  const form = new FormData();
  form.append('resultado', payload.resultado);
  form.append('idempotencyKey', payload.idempotencyKey);
  if (payload.motivo) form.append('motivo', payload.motivo);
  if (payload.tipoProva) form.append('tipoProva', payload.tipoProva);
  if (payload.recebedorNome) form.append('recebedorNome', payload.recebedorNome);
  if (payload.geoLat !== undefined) form.append('geoLat', String(payload.geoLat));
  if (payload.geoLng !== undefined) form.append('geoLng', String(payload.geoLng));
  if (fotoUri) {
    // RN/Expo: arquivo em FormData = { uri, name, type } (não Blob).
    // Assinatura é PNG; foto é JPG — o mimetype certo é gravado no cofre.
    const isPng = fotoUri.toLowerCase().endsWith('.png');
    form.append('prova', {
      uri: fotoUri,
      name: isPng ? 'prova.png' : 'prova.jpg',
      type: isPng ? 'image/png' : 'image/jpeg',
    } as unknown as Blob);
  }

  await api.post(`${LOGISTICA_BASE}/entregas/${entregaId}/baixar`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000, // foto em rede móvel fraca demora — não abortar cedo
  });
}
