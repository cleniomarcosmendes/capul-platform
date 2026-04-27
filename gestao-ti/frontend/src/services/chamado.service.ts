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
  tecnicoId?: string;
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
}

export interface ListarChamadosResult {
  items: Chamado[];
  total: number;
  page: number;
  pageSize: number;
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
  matriculaColaborador?: string;
  nomeColaborador?: string;
}

export const chamadoService = {
  /**
   * Lista paginada — usa `ListarChamadosResult` com `items`, `total`, `page`, `pageSize`.
   * Introduzido em 23/04/2026 para a tela `/chamados` (a legada `listar` vira wrapper
   * que extrai `items` com `pageSize=200` para manter compatibilidade dos outros
   * consumidores — Dashboard, OS, Projeto, Parada).
   */
  async listarPaginado(filters: ListFilters = {}): Promise<ListarChamadosResult> {
    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status;
    if (filters.equipeId) params.equipeId = filters.equipeId;
    if (filters.visibilidade) params.visibilidade = filters.visibilidade;
    if (filters.meusChamados) params.meusChamados = 'true';
    if (filters.filialId) params.filialId = filters.filialId;
    if (filters.departamentoId) params.departamentoId = filters.departamentoId;
    if (filters.pendentesAvaliacao) params.pendentesAvaliacao = 'true';
    if (filters.search) params.search = filters.search;
    if (filters.tecnicoId) params.tecnicoId = filters.tecnicoId;
    if (filters.dataInicio) params.dataInicio = filters.dataInicio;
    if (filters.dataFim) params.dataFim = filters.dataFim;
    if (filters.page) params.page = String(filters.page);
    if (filters.pageSize) params.pageSize = String(filters.pageSize);
    const { data } = await gestaoApi.get<ListarChamadosResult>('/chamados', { params });
    return data;
  },

  /**
   * Retorna só `items` (API antiga). Preserva compatibilidade com Dashboard,
   * OrdensServico, ProjetoDetalhe, ParadaDetalhe. Puxa até 200 por chamada
   * — se o chamador precisar de mais, usar `listarPaginado`.
   */
  async listar(filters: ListFilters = {}): Promise<Chamado[]> {
    const res = await this.listarPaginado({ pageSize: 200, ...filters });
    return res.items;
  },

  async buscar(id: string): Promise<Chamado> {
    const { data } = await gestaoApi.get(`/chamados/${id}`);
    return data;
  },

  async criar(payload: CreateChamadoPayload): Promise<Chamado> {
    const { data } = await gestaoApi.post('/chamados', payload);
    return data;
  },

  async atualizarCabecalho(id: string, payload: { titulo?: string; descricao?: string }): Promise<Chamado> {
    const { data } = await gestaoApi.patch(`/chamados/${id}/cabecalho`, payload);
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

  async excluir(id: string): Promise<void> {
    await gestaoApi.delete(`/chamados/${id}`);
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

  async abrirAnexo(id: string, anexoId: string, mimeType: string): Promise<void> {
    const { data } = await gestaoApi.get(`/chamados/${id}/anexos/${anexoId}/download?inline=1`, {
      responseType: 'blob',
    });
    const blob = new Blob([data], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
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
