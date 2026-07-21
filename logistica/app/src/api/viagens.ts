import { api } from './client';
import { LOGISTICA_BASE } from './config';
import type { DespesaViagemPayload } from './frota';
import type { Viagem } from '../types/api';

/** Viagens do entregador logado (backend filtra por motoristaId do JWT). */
export async function minhasViagens(): Promise<Viagem[]> {
  const { data } = await api.get<Viagem[]>(`${LOGISTICA_BASE}/viagens/minhas`);
  return data;
}

/** Detalhe de uma viagem (paradas + entregas ordenadas). */
export async function obterViagem(id: string): Promise<Viagem> {
  const { data } = await api.get<Viagem>(`${LOGISTICA_BASE}/viagens/${id}`);
  return data;
}

/** "Iniciar entrega": registra o KM de saída (no painel do veículo). */
export async function iniciarEntrega(id: string, kmInicial: number): Promise<Viagem> {
  const { data } = await api.post<Viagem>(`${LOGISTICA_BASE}/viagens/${id}/iniciar`, { kmInicial });
  return data;
}

/** "Encerrar entrega": registra o KM de chegada e conclui a rota (libera o veículo). */
export async function encerrarEntrega(id: string, kmFinal: number): Promise<Viagem> {
  const { data } = await api.post<Viagem>(`${LOGISTICA_BASE}/viagens/${id}/concluir`, { kmFinal });
  return data;
}

/**
 * Lançar despesa na ROTA DE ENTREGA (app do entregador) → custo do veículo.
 * Sem token de condutor (o entregador é o dono da rota). Foto do cupom opcional
 * (multipart) — caso mais forte é fotografar o cupom do posto ao abastecer.
 */
export async function lancarDespesaEntrega(p: DespesaViagemPayload, fotoUris?: string[]): Promise<void> {
  const form = new FormData();
  form.append('viagemId', p.viagemId);
  form.append('tipoDespesaId', p.tipoDespesaId);
  form.append('valor', String(p.valor));
  if (p.fornecedorId) form.append('fornecedorId', p.fornecedorId);
  if (p.fornecedor) form.append('fornecedor', p.fornecedor);
  if (p.observacao) form.append('observacao', p.observacao);
  if (p.semNota) form.append('semNota', 'true');
  else if (p.numeroDocumento) form.append('numeroDocumento', p.numeroDocumento);
  if (p.idempotencyKey) form.append('idempotencyKey', p.idempotencyKey);
  (fotoUris ?? []).filter(Boolean).forEach((uri, i) => {
    const isPng = uri.toLowerCase().endsWith('.png');
    form.append('comprovantes', {
      uri,
      name: isPng ? `recibo-${i + 1}.png` : `recibo-${i + 1}.jpg`,
      type: isPng ? 'image/png' : 'image/jpeg',
    } as unknown as Blob);
  });
  await api.post(`${LOGISTICA_BASE}/despesas/viagem-entrega`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 90_000,
  });
}
