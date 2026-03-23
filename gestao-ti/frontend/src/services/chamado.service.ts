import { gestaoApi } from './api';
import type { Chamado, HistoricoChamado, AnexoChamado, StatusChamado, Visibilidade, ChamadoColaborador, RegistroTempoChamado } from '../types';

interface ListFilters {
  status?: StatusChamado;
  equipeId?: string;
  visibilidade?: Visibilidade;
  meusChamados?: boolean;
  filialId?: string;
  departamentoId?: string;
  pendentesAvaliacao?: boolean;
  search?: string;
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
  ipMaquina?: string;
  ativoId?: string;
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
    if (filters.search) params.search = filters.search;
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

  async transferirEquipe(id: string, equipeDestinoId: string, motivo?: string, tecnicoDestinoId?: string): Promise<Chamado> {
    const { data } = await gestaoApi.post(`/chamados/${id}/transferir-equipe`, { equipeDestinoId, motivo, tecnicoDestinoId });
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

  async editarComentario(chamadoId: string, historicoId: string, descricao: string): Promise<HistoricoChamado> {
    const { data } = await gestaoApi.patch(`/chamados/${chamadoId}/comentarios/${historicoId}`, { descricao });
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

  async vincularProjeto(id: string, projetoId: string): Promise<unknown> {
    const { data } = await gestaoApi.patch(`/chamados/${id}/vincular-projeto`, { projetoId });
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

  // Colaboradores
  async listarColaboradores(id: string): Promise<ChamadoColaborador[]> {
    const { data } = await gestaoApi.get(`/chamados/${id}/colaboradores`);
    return data;
  },

  async adicionarColaborador(id: string, usuarioId: string): Promise<ChamadoColaborador> {
    const { data } = await gestaoApi.post(`/chamados/${id}/colaboradores`, { usuarioId });
    return data;
  },

  async removerColaborador(id: string, colaboradorId: string): Promise<void> {
    await gestaoApi.delete(`/chamados/${id}/colaboradores/${colaboradorId}`);
  },

  // Registro de Tempo
  async listarRegistrosTempo(id: string): Promise<RegistroTempoChamado[]> {
    const { data } = await gestaoApi.get(`/chamados/${id}/registros-tempo`);
    return data;
  },

  async iniciarTempo(id: string, usuarioId?: string): Promise<RegistroTempoChamado> {
    const { data } = await gestaoApi.post(`/chamados/${id}/registros-tempo/iniciar`, { usuarioId });
    return data;
  },

  async encerrarTempo(id: string, usuarioId?: string): Promise<RegistroTempoChamado> {
    const { data } = await gestaoApi.post(`/chamados/${id}/registros-tempo/encerrar`, { usuarioId });
    return data;
  },

  async ajustarRegistroTempo(id: string, registroId: string, payload: { horaInicio?: string; horaFim?: string; observacoes?: string }): Promise<RegistroTempoChamado> {
    const { data } = await gestaoApi.patch(`/chamados/${id}/registros-tempo/${registroId}`, payload);
    return data;
  },

  async removerRegistroTempo(id: string, registroId: string): Promise<void> {
    await gestaoApi.delete(`/chamados/${id}/registros-tempo/${registroId}`);
  },
};
