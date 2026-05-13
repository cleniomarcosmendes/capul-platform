import { gestaoApi } from './api';

export interface ChamadoExternoMensal {
  id: string;
  mes: number;
  ano: number;
  qtdChamados: number;
  observacoes: string | null;
  softwareId: string;
  software: { id: string; nome: string; fabricante: string | null };
  registradoPorId: string | null;
  registradoPor: { id: string; nome: string; username: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChamadoExternoPayload {
  mes: number;
  ano: number;
  softwareId: string;
  qtdChamados: number;
  observacoes?: string;
}

export type UpdateChamadoExternoPayload = Partial<CreateChamadoExternoPayload>;

export const chamadoExternoService = {
  async listar(filters: { ano?: number; mes?: number; softwareId?: string } = {}): Promise<ChamadoExternoMensal[]> {
    const params: Record<string, string> = {};
    if (filters.ano) params.ano = String(filters.ano);
    if (filters.mes) params.mes = String(filters.mes);
    if (filters.softwareId) params.softwareId = filters.softwareId;
    const { data } = await gestaoApi.get<ChamadoExternoMensal[]>('/chamados-externos', { params });
    return data;
  },

  async criar(payload: CreateChamadoExternoPayload): Promise<ChamadoExternoMensal> {
    const { data } = await gestaoApi.post<ChamadoExternoMensal>('/chamados-externos', payload);
    return data;
  },

  async atualizar(id: string, payload: UpdateChamadoExternoPayload): Promise<ChamadoExternoMensal> {
    const { data } = await gestaoApi.patch<ChamadoExternoMensal>(`/chamados-externos/${id}`, payload);
    return data;
  },

  async excluir(id: string): Promise<void> {
    await gestaoApi.delete(`/chamados-externos/${id}`);
  },
};
