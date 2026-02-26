import { gestaoApi } from './api';
import type { Chamado, HistoricoChamado, AnexoChamado, StatusChamado, Visibilidade } from '../types';

interface ListFilters {
  status?: StatusChamado;
  equipeId?: string;
  visibilidade?: Visibilidade;
  meusChamados?: boolean;
  filialId?: string;
  departamentoId?: string;
  pendentesAvaliacao?: boolean;
}

interface CreateChamadoPayload {
  titulo: string;
  descricao: string;
  equipeAtualId: string;
  visibilidade?: Visibilidade;
  prioridade?: string;
  softwareId?: string;
  softwareModuloId?: string;
  softwareNome?: string;
  moduloNome?: string;
  catalogoServicoId?: string;
  projetoId?: string;
  filialId?: string;
  departamentoId?: string;
}

export const chamadoService = {
  async listar(filters: ListFilters = {}): Promise<Chamado[]> {
    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status;
    if (filters.equipeId) params.equipeId = filters.equipeId;
    if (filters.visibilidade) params.visibilidade = filters.visibilidade;
    if (filters.meusChamados) params.meusChamados = 'true';
    if (filters.filialId) params.filialId = filters.filialId;
    if (filters.departamentoId) params.departamentoId = filters.departamentoId;
    if (filters.pendentesAvaliacao) params.pendentesAvaliacao = 'true';
    const { data } = await gestaoApi.get('/chamados', { params });
    return data;
  },

  async buscar(id: string): Promise<Chamado> {
    const { data } = await gestaoApi.get(`/chamados/${id}`);
    return data;
  },

  async criar(payload: CreateChamadoPayload): Promise<Chamado> {
    const { data } = await gestaoApi.post('/chamados', payload);
    return data;
  },

  async assumir(id: string): Promise<Chamado> {
    const { data } = await gestaoApi.post(`/chamados/${id}/assumir`);
    return data;
  },

  async transferirEquipe(id: string, equipeDestinoId: string, motivo?: string): Promise<Chamado> {
    const { data } = await gestaoApi.post(`/chamados/${id}/transferir-equipe`, { equipeDestinoId, motivo });
    return data;
  },

  async transferirTecnico(id: string, tecnicoId: string, motivo?: string): Promise<Chamado> {
    const { data } = await gestaoApi.post(`/chamados/${id}/transferir-tecnico`, { tecnicoId, motivo });
    return data;
  },

  async comentar(id: string, descricao: string, publico = true): Promise<HistoricoChamado> {
    const { data } = await gestaoApi.post(`/chamados/${id}/comentar`, { descricao, publico });
    return data;
  },

  async resolver(id: string, descricao?: string): Promise<Chamado> {
    const { data } = await gestaoApi.patch(`/chamados/${id}/resolver`, { descricao });
    return data;
  },

  async fechar(id: string): Promise<Chamado> {
    const { data } = await gestaoApi.patch(`/chamados/${id}/fechar`);
    return data;
  },

  async reabrir(id: string, motivo?: string): Promise<Chamado> {
    const { data } = await gestaoApi.post(`/chamados/${id}/reabrir`, { motivo });
    return data;
  },

  async cancelar(id: string): Promise<Chamado> {
    const { data } = await gestaoApi.patch(`/chamados/${id}/cancelar`);
    return data;
  },

  async avaliar(id: string, nota: number, comentario?: string): Promise<Chamado> {
    const { data } = await gestaoApi.post(`/chamados/${id}/avaliar`, { nota, comentario });
    return data;
  },

  async listarAnexos(id: string): Promise<AnexoChamado[]> {
    const { data } = await gestaoApi.get(`/chamados/${id}/anexos`);
    return data;
  },

  async uploadAnexo(id: string, file: File, descricao?: string): Promise<AnexoChamado> {
    const formData = new FormData();
    formData.append('file', file);
    if (descricao) formData.append('descricao', descricao);
    const { data } = await gestaoApi.post(`/chamados/${id}/anexos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async downloadAnexo(id: string, anexoId: string, nomeOriginal: string): Promise<void> {
    const { data } = await gestaoApi.get(`/chamados/${id}/anexos/${anexoId}/download`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeOriginal;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  async removerAnexo(id: string, anexoId: string): Promise<void> {
    await gestaoApi.delete(`/chamados/${id}/anexos/${anexoId}`);
  },
};
