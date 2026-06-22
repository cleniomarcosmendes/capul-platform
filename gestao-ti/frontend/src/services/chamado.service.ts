import { gestaoApi } from './api';
import { withCharsetUtf8 } from '../utils/blob';
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
  /** Ordenação por clique no header (10/05/2026). Chaves whitelistadas no backend. */
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  /** Incluir chamados em status AGRUPADO (filhos). Default false (13/05/2026). */
  incluirAgrupados?: boolean;
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
  /** Senha do portal RH — revalidada no backend (loginPortal). Transiente. */
  senhaColaborador?: string;
  /** IDs de usuarios a colocar em copia. Backend rejeita membros de Equipe. */
  copiasUsuariosIds?: string[];
  /** SAC (Fase 1) — dados do cliente externo (só no workspace SAC). */
  clienteNome?: string;
  clienteEmail?: string;
  clienteTelefone?: string;
  canalOrigem?: 'BALCAO' | 'TELEFONE' | 'EMAIL' | 'OUTRO';
}

/** SAC (Fase 1) — apoiador elegível (membro de equipe de apoio SAC). */
export interface ApoiadorSac { id: string; nome: string; username: string; email: string | null }

export interface ChamadoCopia {
  id: string;
  createdAt: string;
  chamadoId: string;
  usuarioId: string;
  adicionadoPorId: string | null;
  usuario: { id: string; nome: string; username: string; email: string | null };
  adicionadoPor: { id: string; nome: string; username: string } | null;
}

export interface AdicionarCopiasResult {
  adicionados: string[];
  erros: { usuarioId: string; motivo: string }[];
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
    if (filters.sortBy) params.sortBy = filters.sortBy;
    if (filters.sortOrder) params.sortOrder = filters.sortOrder;
    if (filters.incluirAgrupados) params.incluirAgrupados = 'true';
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

  // SAC (Fase 1) — apoiadores elegíveis (roster) p/ o seletor de cópia do SAC.
  async listarApoiadoresSac(): Promise<ApoiadorSac[]> {
    const { data } = await gestaoApi.get('/chamados/sac/apoiadores');
    return data;
  },

  // SAC (Fase 2) — responde o cliente por e-mail (com anexo opcional, multipart).
  // Retorna { historico, anexo, email:{sent,mock,redirected} }.
  async responderSac(id: string, texto: string, anexo?: File | null): Promise<{ email: { sent: boolean; mock: boolean; redirected: boolean } }> {
    const form = new FormData();
    form.append('texto', texto);
    if (anexo) form.append('anexo', anexo);
    const { data } = await gestaoApi.post(`/chamados/${id}/responder-sac`, form);
    return data;
  },

  // SAC — edita dados do cliente externo (nome/e-mail/telefone) num chamado SAC aberto.
  async atualizarDadosClienteSac(id: string, dados: { clienteNome?: string; clienteEmail?: string; clienteTelefone?: string }): Promise<Chamado> {
    const { data } = await gestaoApi.patch(`/chamados/${id}/dados-cliente-sac`, dados);
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

  async transferirTecnico(id: string, tecnicoId: string, motivo?: string, emailEnvolvidos = false): Promise<Chamado> {
    const { data } = await gestaoApi.post(`/chamados/${id}/transferir-tecnico`, { tecnicoId, motivo, emailEnvolvidos });
    return data;
  },

  async comentar(
    id: string,
    descricao: string,
    publico = true,
    solicitarInfoUsuario = false,
    anexosIds?: string[],
    emailEnvolvidos = false,
  ): Promise<HistoricoChamado> {
    const { data } = await gestaoApi.post(`/chamados/${id}/comentar`, {
      descricao,
      publico,
      solicitarInfoUsuario,
      anexosIds: anexosIds && anexosIds.length > 0 ? anexosIds : undefined,
      emailEnvolvidos,
    });
    return data;
  },

  async editarComentario(chamadoId: string, historicoId: string, descricao: string): Promise<HistoricoChamado> {
    const { data } = await gestaoApi.patch(`/chamados/${chamadoId}/comentarios/${historicoId}`, { descricao });
    return data;
  },

  async resolver(id: string, descricao?: string, emailEnvolvidos = false): Promise<Chamado> {
    const { data } = await gestaoApi.patch(`/chamados/${id}/resolver`, { descricao, emailEnvolvidos });
    return data;
  },

  async fechar(id: string): Promise<Chamado> {
    const { data } = await gestaoApi.patch(`/chamados/${id}/fechar`);
    return data;
  },

  async reabrir(id: string, motivo?: string, emailEnvolvidos = false): Promise<Chamado> {
    const { data } = await gestaoApi.post(`/chamados/${id}/reabrir`, { motivo, emailEnvolvidos });
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
    const blob = new Blob([data], { type: withCharsetUtf8(mimeType) });
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

  // Elegíveis a colaborador = membros de equipes do workspace (depto) do chamado.
  async listarColaboradoresElegiveis(id: string): Promise<{ id: string; nome: string; username: string }[]> {
    const { data } = await gestaoApi.get(`/chamados/${id}/colaboradores-elegiveis`);
    return data;
  },

  async adicionarColaborador(id: string, usuarioId: string): Promise<ChamadoColaborador> {
    const { data } = await gestaoApi.post(`/chamados/${id}/colaboradores`, { usuarioId });
    return data;
  },

  async removerColaborador(id: string, colaboradorId: string): Promise<void> {
    await gestaoApi.delete(`/chamados/${id}/colaboradores/${colaboradorId}`);
  },

  // Copias (decidido em 13/05/2026)
  async listarCopias(id: string): Promise<ChamadoCopia[]> {
    const { data } = await gestaoApi.get(`/chamados/${id}/copias`);
    return data;
  },

  async adicionarCopias(id: string, usuariosIds: string[]): Promise<AdicionarCopiasResult> {
    const { data } = await gestaoApi.post(`/chamados/${id}/copias`, { usuariosIds });
    return data;
  },

  // Agrupamento (decidido em 13/05/2026)
  async agruparEm(id: string, agrupadorId: string): Promise<{ id: string; status: string; chamadoAgrupadorId: string }> {
    const { data } = await gestaoApi.post(`/chamados/${id}/agrupar-em`, { agrupadorId });
    return data;
  },

  async desagrupar(id: string): Promise<{ id: string; status: string }> {
    const { data } = await gestaoApi.post(`/chamados/${id}/desagrupar`);
    return data;
  },

  async listarAgrupados(id: string): Promise<{ id: string; numero: number; titulo: string; status: string; solicitante: { id: string; nome: string }; createdAt: string }[]> {
    const { data } = await gestaoApi.get(`/chamados/${id}/agrupados`);
    return data;
  },

  async agruparMultiplos(id: string, filhosIds: string[]): Promise<{ agrupados: { id: string; numero: number }[]; erros: { chamadoId: string; numero?: number; motivo: string }[] }> {
    const { data } = await gestaoApi.post(`/chamados/${id}/agrupar-multiplos`, { filhosIds });
    return data;
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
