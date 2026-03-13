import { gestaoApi } from './api';
import type {
  Projeto,
  MembroProjeto,
  FaseProjeto,
  AtividadeProjeto,
  CustosConsolidados,
  CotacaoProjeto,
  CustoProjeto,
  RiscoProjeto,
  DependenciaProjeto,
  AnexoProjeto,
  ApontamentoHoras,
  RegistroTempo,
  Chamado,
  ComentarioTarefa,
  TipoProjeto,
  ModoProjeto,
  StatusProjeto,
  PapelRaci,
  StatusFase,
  UsuarioChaveProjeto,
  PendenciaProjeto,
  InteracaoPendencia,
  StatusPendencia,
  PrioridadePendencia,
} from '../types';

interface ProjetoFilters {
  status?: string;
  tipo?: TipoProjeto;
  modo?: ModoProjeto;
  softwareId?: string;
  contratoId?: string;
  search?: string;
  apenasRaiz?: boolean;
  meusProjetos?: boolean;
}

interface CreateProjetoPayload {
  nome: string;
  tipo: TipoProjeto;
  modo?: ModoProjeto;
  projetoPaiId?: string;
  softwareId?: string;
  contratoId?: string;
  responsavelId: string;
  descricao?: string;
  dataInicio?: string;
  dataFimPrevista?: string;
  custoPrevisto?: number;
  observacoes?: string;
}

interface UpdateProjetoPayload {
  nome?: string;
  tipo?: TipoProjeto;
  modo?: ModoProjeto;
  status?: StatusProjeto;
  softwareId?: string;
  contratoId?: string;
  responsavelId?: string;
  descricao?: string;
  dataInicio?: string;
  dataFimPrevista?: string;
  custoPrevisto?: number;
  custoRealizado?: number;
  observacoes?: string;
}

export const projetoService = {
  async listar(filters: ProjetoFilters = {}): Promise<Projeto[]> {
    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status;
    if (filters.tipo) params.tipo = filters.tipo;
    if (filters.modo) params.modo = filters.modo;
    if (filters.softwareId) params.softwareId = filters.softwareId;
    if (filters.contratoId) params.contratoId = filters.contratoId;
    if (filters.search) params.search = filters.search;
    if (filters.apenasRaiz) params.apenasRaiz = 'true';
    if (filters.meusProjetos) params.meusProjetos = 'true';
    const { data } = await gestaoApi.get('/projetos', { params });
    return data;
  },

  async buscar(id: string): Promise<Projeto> {
    const { data } = await gestaoApi.get(`/projetos/${id}`);
    return data;
  },

  async criar(payload: CreateProjetoPayload): Promise<Projeto> {
    const { data } = await gestaoApi.post('/projetos', payload);
    return data;
  },

  async atualizar(id: string, payload: UpdateProjetoPayload): Promise<Projeto> {
    const { data } = await gestaoApi.patch(`/projetos/${id}`, payload);
    return data;
  },

  async remover(id: string): Promise<void> {
    await gestaoApi.delete(`/projetos/${id}`);
  },

  // Membros
  async listarMembros(id: string): Promise<MembroProjeto[]> {
    const { data } = await gestaoApi.get(`/projetos/${id}/membros`);
    return data;
  },

  async adicionarMembro(id: string, payload: { usuarioId: string; papel: PapelRaci; observacoes?: string }): Promise<MembroProjeto> {
    const { data } = await gestaoApi.post(`/projetos/${id}/membros`, payload);
    return data;
  },

  async removerMembro(id: string, membroId: string): Promise<void> {
    await gestaoApi.delete(`/projetos/${id}/membros/${membroId}`);
  },

  // Fases
  async listarFases(id: string): Promise<FaseProjeto[]> {
    const { data } = await gestaoApi.get(`/projetos/${id}/fases`);
    return data;
  },

  async adicionarFase(id: string, payload: { nome: string; descricao?: string; ordem: number; status?: StatusFase; dataInicio?: string; dataFimPrevista?: string }): Promise<FaseProjeto> {
    const { data } = await gestaoApi.post(`/projetos/${id}/fases`, payload);
    return data;
  },

  async atualizarFase(id: string, faseId: string, payload: { nome?: string; descricao?: string; ordem?: number; status?: StatusFase; dataInicio?: string; dataFimPrevista?: string; dataFimReal?: string; observacoes?: string }): Promise<FaseProjeto> {
    const { data } = await gestaoApi.patch(`/projetos/${id}/fases/${faseId}`, payload);
    return data;
  },

  async removerFase(id: string, faseId: string): Promise<void> {
    await gestaoApi.delete(`/projetos/${id}/fases/${faseId}`);
  },

  // Atividades
  async listarAtividades(id: string): Promise<AtividadeProjeto[]> {
    const { data } = await gestaoApi.get(`/projetos/${id}/atividades`);
    return data;
  },

  async adicionarAtividade(id: string, payload: { titulo: string; descricao?: string; faseId?: string; dataInicio?: string; dataFimPrevista?: string }): Promise<AtividadeProjeto> {
    const { data } = await gestaoApi.post(`/projetos/${id}/atividades`, payload);
    return data;
  },

  async atualizarAtividade(id: string, atividadeId: string, payload: { titulo?: string; descricao?: string; faseId?: string; status?: string; dataInicio?: string; dataFimPrevista?: string }): Promise<AtividadeProjeto> {
    const { data } = await gestaoApi.patch(`/projetos/${id}/atividades/${atividadeId}`, payload);
    return data;
  },

  async removerAtividade(id: string, atividadeId: string): Promise<void> {
    await gestaoApi.delete(`/projetos/${id}/atividades/${atividadeId}`);
  },

  // Registro de Tempo
  async listarRegistrosTempo(id: string, atividadeId: string): Promise<RegistroTempo[]> {
    const { data } = await gestaoApi.get(`/projetos/${id}/atividades/${atividadeId}/registros-tempo`);
    return data;
  },

  async iniciarTempo(id: string, atividadeId: string): Promise<RegistroTempo> {
    const { data } = await gestaoApi.post(`/projetos/${id}/atividades/${atividadeId}/iniciar`);
    return data;
  },

  async encerrarTempo(id: string, atividadeId: string): Promise<RegistroTempo> {
    const { data } = await gestaoApi.post(`/projetos/${id}/atividades/${atividadeId}/encerrar`);
    return data;
  },

  async obterRegistroAtivo(id: string): Promise<RegistroTempo | null> {
    const { data } = await gestaoApi.get(`/projetos/${id}/registro-ativo`);
    return data;
  },

  async ajustarRegistroTempo(id: string, registroId: string, payload: { horaInicio?: string; horaFim?: string; observacoes?: string }): Promise<RegistroTempo> {
    const { data } = await gestaoApi.patch(`/projetos/${id}/registros-tempo/${registroId}`, payload);
    return data;
  },

  async removerRegistroTempo(id: string, registroId: string): Promise<void> {
    await gestaoApi.delete(`/projetos/${id}/registros-tempo/${registroId}`);
  },

  // Custos consolidados
  async getCustos(id: string): Promise<CustosConsolidados> {
    const { data } = await gestaoApi.get(`/projetos/${id}/custos`);
    return data;
  },

  // Cotacoes
  async listarCotacoes(id: string): Promise<CotacaoProjeto[]> {
    const { data } = await gestaoApi.get(`/projetos/${id}/cotacoes`);
    return data;
  },

  async adicionarCotacao(id: string, payload: { fornecedor: string; valor: number; descricao?: string; moeda?: string; dataRecebimento?: string; validade?: string; status?: string; observacoes?: string }): Promise<CotacaoProjeto> {
    const { data } = await gestaoApi.post(`/projetos/${id}/cotacoes`, payload);
    return data;
  },

  async atualizarCotacao(id: string, cotacaoId: string, payload: Record<string, unknown>): Promise<CotacaoProjeto> {
    const { data } = await gestaoApi.patch(`/projetos/${id}/cotacoes/${cotacaoId}`, payload);
    return data;
  },

  async removerCotacao(id: string, cotacaoId: string): Promise<void> {
    await gestaoApi.delete(`/projetos/${id}/cotacoes/${cotacaoId}`);
  },

  // Custos detalhados
  async listarCustosDetalhados(id: string): Promise<CustoProjeto[]> {
    const { data } = await gestaoApi.get(`/projetos/${id}/custos-detalhados`);
    return data;
  },

  async adicionarCusto(id: string, payload: { descricao: string; categoria: string; valorPrevisto?: number; valorRealizado?: number; data?: string; observacoes?: string }): Promise<CustoProjeto> {
    const { data } = await gestaoApi.post(`/projetos/${id}/custos-detalhados`, payload);
    return data;
  },

  async atualizarCusto(id: string, custoId: string, payload: Record<string, unknown>): Promise<CustoProjeto> {
    const { data } = await gestaoApi.patch(`/projetos/${id}/custos-detalhados/${custoId}`, payload);
    return data;
  },

  async removerCusto(id: string, custoId: string): Promise<void> {
    await gestaoApi.delete(`/projetos/${id}/custos-detalhados/${custoId}`);
  },

  // Riscos
  async listarRiscos(id: string): Promise<RiscoProjeto[]> {
    const { data } = await gestaoApi.get(`/projetos/${id}/riscos`);
    return data;
  },

  async adicionarRisco(id: string, payload: { titulo: string; probabilidade: string; impacto: string; descricao?: string; status?: string; planoMitigacao?: string; responsavelId?: string; observacoes?: string }): Promise<RiscoProjeto> {
    const { data } = await gestaoApi.post(`/projetos/${id}/riscos`, payload);
    return data;
  },

  async atualizarRisco(id: string, riscoId: string, payload: Record<string, unknown>): Promise<RiscoProjeto> {
    const { data } = await gestaoApi.patch(`/projetos/${id}/riscos/${riscoId}`, payload);
    return data;
  },

  async removerRisco(id: string, riscoId: string): Promise<void> {
    await gestaoApi.delete(`/projetos/${id}/riscos/${riscoId}`);
  },

  // Dependencias
  async listarDependencias(id: string): Promise<{ origem: DependenciaProjeto[]; destino: DependenciaProjeto[] }> {
    const { data } = await gestaoApi.get(`/projetos/${id}/dependencias`);
    return data;
  },

  async adicionarDependencia(id: string, payload: { projetoDestinoId: string; tipo: string; descricao?: string }): Promise<DependenciaProjeto> {
    const { data } = await gestaoApi.post(`/projetos/${id}/dependencias`, payload);
    return data;
  },

  async removerDependencia(id: string, depId: string): Promise<void> {
    await gestaoApi.delete(`/projetos/${id}/dependencias/${depId}`);
  },

  // Anexos
  async listarAnexos(id: string): Promise<AnexoProjeto[]> {
    const { data } = await gestaoApi.get(`/projetos/${id}/anexos`);
    return data;
  },

  async adicionarAnexo(id: string, payload: { titulo: string; url: string; tipo?: string; tamanho?: string; descricao?: string }): Promise<AnexoProjeto> {
    const { data } = await gestaoApi.post(`/projetos/${id}/anexos`, payload);
    return data;
  },

  async uploadAnexo(id: string, file: File, descricao?: string): Promise<AnexoProjeto> {
    const formData = new FormData();
    formData.append('file', file);
    if (descricao) formData.append('descricao', descricao);
    const { data } = await gestaoApi.post(`/projetos/${id}/anexos/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async downloadAnexo(id: string, anexoId: string, nomeOriginal: string): Promise<void> {
    const { data } = await gestaoApi.get(`/projetos/${id}/anexos/${anexoId}/download`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeOriginal;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async removerAnexo(id: string, anexoId: string): Promise<void> {
    await gestaoApi.delete(`/projetos/${id}/anexos/${anexoId}`);
  },

  // Apontamento de Horas
  async listarApontamentos(id: string): Promise<ApontamentoHoras[]> {
    const { data } = await gestaoApi.get(`/projetos/${id}/apontamentos`);
    return data;
  },

  async adicionarApontamento(id: string, payload: { data: string; horas: number; descricao: string; observacoes?: string; faseId?: string }): Promise<ApontamentoHoras> {
    const { data } = await gestaoApi.post(`/projetos/${id}/apontamentos`, payload);
    return data;
  },

  async removerApontamento(id: string, apontamentoId: string): Promise<void> {
    await gestaoApi.delete(`/projetos/${id}/apontamentos/${apontamentoId}`);
  },

  // Chamados vinculados
  async listarChamadosProjeto(id: string): Promise<Chamado[]> {
    const { data } = await gestaoApi.get(`/projetos/${id}/chamados`);
    return data;
  },

  async vincularChamado(id: string, chamadoId: string): Promise<void> {
    await gestaoApi.post(`/projetos/${id}/chamados/${chamadoId}`);
  },

  async desvincularChamado(id: string, chamadoId: string): Promise<void> {
    await gestaoApi.delete(`/projetos/${id}/chamados/${chamadoId}`);
  },

  // Comentarios de Tarefa
  async listarComentarios(id: string, atividadeId: string): Promise<ComentarioTarefa[]> {
    const { data } = await gestaoApi.get(`/projetos/${id}/atividades/${atividadeId}/comentarios`);
    return data;
  },

  async adicionarComentario(id: string, atividadeId: string, texto: string): Promise<ComentarioTarefa> {
    const { data } = await gestaoApi.post(`/projetos/${id}/atividades/${atividadeId}/comentarios`, { texto });
    return data;
  },

  async removerComentario(id: string, comentarioId: string): Promise<void> {
    await gestaoApi.delete(`/projetos/${id}/comentarios/${comentarioId}`);
  },

  async atualizarComentario(id: string, comentarioId: string, texto: string): Promise<ComentarioTarefa> {
    const { data } = await gestaoApi.patch(`/projetos/${id}/comentarios/${comentarioId}`, { texto });
    return data;
  },

  async buscarComentarios(query: string): Promise<ComentarioTarefa[]> {
    const { data } = await gestaoApi.get('/projetos/busca-comentarios', { params: { q: query } });
    return data;
  },

  // Usuarios-Chave
  async listarUsuariosChave(id: string): Promise<UsuarioChaveProjeto[]> {
    const { data } = await gestaoApi.get(`/projetos/${id}/usuarios-chave`);
    return data;
  },

  async adicionarUsuarioChave(id: string, payload: { usuarioId: string; funcao: string }): Promise<UsuarioChaveProjeto> {
    const { data } = await gestaoApi.post(`/projetos/${id}/usuarios-chave`, payload);
    return data;
  },

  async removerUsuarioChave(id: string, ucId: string): Promise<void> {
    await gestaoApi.delete(`/projetos/${id}/usuarios-chave/${ucId}`);
  },

  // Pendencias
  async listarPendencias(id: string, filters: { status?: string; prioridade?: string; responsavelId?: string; search?: string; incluirSubProjetos?: boolean } = {}): Promise<PendenciaProjeto[]> {
    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status;
    if (filters.prioridade) params.prioridade = filters.prioridade;
    if (filters.responsavelId) params.responsavelId = filters.responsavelId;
    if (filters.search) params.search = filters.search;
    if (filters.incluirSubProjetos) params.incluirSubProjetos = 'true';
    const { data } = await gestaoApi.get(`/projetos/${id}/pendencias`, { params });
    return data;
  },

  async criarPendencia(id: string, payload: { titulo: string; descricao?: string; prioridade?: PrioridadePendencia; faseId?: string; responsavelId: string; dataLimite?: string }): Promise<PendenciaProjeto> {
    const { data } = await gestaoApi.post(`/projetos/${id}/pendencias`, payload);
    return data;
  },

  async buscarPendencia(id: string, pid: string): Promise<PendenciaProjeto> {
    const { data } = await gestaoApi.get(`/projetos/${id}/pendencias/${pid}`);
    return data;
  },

  async atualizarPendencia(id: string, pid: string, payload: { titulo?: string; descricao?: string; status?: StatusPendencia; prioridade?: PrioridadePendencia; faseId?: string; responsavelId?: string; dataLimite?: string }): Promise<PendenciaProjeto> {
    const { data } = await gestaoApi.patch(`/projetos/${id}/pendencias/${pid}`, payload);
    return data;
  },

  async gerarAtividadeFromPendencia(id: string, pid: string, payload?: { titulo?: string; descricao?: string; dataFimPrevista?: string }): Promise<AtividadeProjeto> {
    const { data } = await gestaoApi.post(`/projetos/${id}/pendencias/${pid}/gerar-atividade`, payload || {});
    return data;
  },

  async adicionarInteracaoPendencia(id: string, pid: string, payload: { descricao: string; publica?: boolean }): Promise<InteracaoPendencia> {
    const { data } = await gestaoApi.post(`/projetos/${id}/pendencias/${pid}/interacoes`, payload);
    return data;
  },

  async uploadAnexoPendencia(id: string, pid: string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    await gestaoApi.post(`/projetos/${id}/pendencias/${pid}/anexos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  async downloadAnexoPendencia(id: string, pid: string, anexoId: string): Promise<Blob> {
    const { data } = await gestaoApi.get(`/projetos/${id}/pendencias/${pid}/anexos/${anexoId}/download`, {
      responseType: 'blob',
    });
    return data;
  },

  async removerAnexoPendencia(id: string, pid: string, anexoId: string): Promise<void> {
    await gestaoApi.delete(`/projetos/${id}/pendencias/${pid}/anexos/${anexoId}`);
  },
};
