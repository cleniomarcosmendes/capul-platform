import { api } from './client';
import { LOGISTICA_BASE } from './config';
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
