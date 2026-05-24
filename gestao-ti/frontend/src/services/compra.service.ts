import { gestaoApi } from './api';
import { withCharsetUtf8 } from '../utils/blob';
import type {
  TipoProduto,
  TipoProjetoConfig,
  NotaFiscal,
  NotaFiscalItemProjeto,
} from '../types';

interface NotaFiscalItemPayload {
  produtoId: string;
  quantidade: number;
  valorUnitario: number;
  centroCustoId: string;
  projetoId?: string;
  observacao?: string;
}

interface CreateNotaFiscalPayload {
  numero: string;
  dataLancamento: string;
  dataVencimento?: string;
  fornecedorId: string;
  observacao?: string;
  equipeId?: string;
  itens: NotaFiscalItemPayload[];
  /** Chave NF-e opcional (44 dígitos). Backend valida via módulo Fiscal. */
  chaveNfe?: string;
  // Workspace Onda 3 S7 (24/05) — alocação editável via <DepartamentoField>.
  departamentoId?: string;
}

interface UpdateNotaFiscalPayload {
  numero?: string;
  dataLancamento?: string;
  dataVencimento?: string;
  fornecedorId?: string;
  observacao?: string;
  status?: string;
  equipeId?: string;
  itens?: NotaFiscalItemPayload[];
  /** Nova chave NF-e ou null para desvincular. Bloqueada se status >= CONFERIDA. */
  chaveNfe?: string | null;
  /** Motivo obrigatório quando alterar/remover chave preexistente. */
  motivoAlteracaoChave?: string;
  // Workspace Onda 3 S7 (24/05) — realocação editável.
  departamentoId?: string;
}

/**
 * Resposta de POST /compras/notas-fiscais/validar-chave. Espelha
 * `NfeParsed` do módulo Fiscal — campos extras são ignorados (forward-compat).
 */
export interface ValidarChaveNfeResult {
  origem: string;
  parsed: {
    dadosGerais: {
      chave: string;
      numero: string;
      serie: string;
      dataEmissao?: string;
    };
    emitente: {
      cnpj?: string | null;
      cpf?: string | null;
      razaoSocial: string;
      inscricaoEstadual?: string | null;
    };
    destinatario: {
      cnpj?: string | null;
      cpf?: string | null;
      razaoSocial: string;
    };
    totais: {
      valorNota: number;
      valorProdutos?: number;
    };
    /** cStat é STRING — "100" = autorizada. */
    protocoloAutorizacao?: {
      protocolo: string;
      dataRecebimento: string;
      cStat: string;
      motivo: string;
      ambiente: '1' | '2';
    } | null;
    produtos: Array<{
      item: number;
      codigo: string;
      descricao: string;
      ncm?: string | null;
      cfop?: string | null;
      unidadeComercial?: string;
      quantidadeComercial: number;
      valorUnitarioComercial: number;
      valorTotalBruto: number;
    }>;
    eventos?: Array<{ tpEvento?: string; cStat?: string; motivo?: string }>;
  };
}

interface ListFilters {
  fornecedorId?: string;
  status?: string;
  centroCustoId?: string;
  projetoId?: string;
  dataInicio?: string;
  dataFim?: string;
  equipeId?: string;
}

interface AnexoNF {
  id: string;
  nomeOriginal: string;
  nomeArquivo: string;
  mimeType: string;
  tamanho: number;
  createdAt: string;
  usuario: { id: string; nome: string };
}

interface EquipeResumo {
  id: string;
  nome: string;
  sigla: string;
  cor: string | null;
}

export const compraService = {
  // --- Tipos de Produto ---

  async listarTiposProduto(status?: string): Promise<TipoProduto[]> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    const { data } = await gestaoApi.get('/compras/tipos-produto', { params });
    return data;
  },

  async criarTipoProduto(payload: { codigo: string; descricao: string }): Promise<TipoProduto> {
    const { data } = await gestaoApi.post('/compras/tipos-produto', payload);
    return data;
  },

  async atualizarTipoProduto(id: string, payload: Partial<{ codigo: string; descricao: string; status: string }>): Promise<TipoProduto> {
    const { data } = await gestaoApi.patch(`/compras/tipos-produto/${id}`, payload);
    return data;
  },

  async excluirTipoProduto(id: string): Promise<void> {
    await gestaoApi.delete(`/compras/tipos-produto/${id}`);
  },

  // --- Tipos de Projeto ---

  async listarTiposProjeto(status?: string): Promise<TipoProjetoConfig[]> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    const { data } = await gestaoApi.get('/compras/tipos-projeto', { params });
    return data;
  },

  async criarTipoProjeto(payload: { codigo: string; descricao: string }): Promise<TipoProjetoConfig> {
    const { data } = await gestaoApi.post('/compras/tipos-projeto', payload);
    return data;
  },

  async atualizarTipoProjeto(id: string, payload: Partial<{ codigo: string; descricao: string; status: string }>): Promise<TipoProjetoConfig> {
    const { data } = await gestaoApi.patch(`/compras/tipos-projeto/${id}`, payload);
    return data;
  },

  async excluirTipoProjeto(id: string): Promise<void> {
    await gestaoApi.delete(`/compras/tipos-projeto/${id}`);
  },

  // --- Notas Fiscais ---

  async listarNotasFiscais(filters: ListFilters = {}): Promise<NotaFiscal[]> {
    const params: Record<string, string> = {};
    if (filters.fornecedorId) params.fornecedorId = filters.fornecedorId;
    if (filters.status) params.status = filters.status;
    if (filters.centroCustoId) params.centroCustoId = filters.centroCustoId;
    if (filters.projetoId) params.projetoId = filters.projetoId;
    if (filters.dataInicio) params.dataInicio = filters.dataInicio;
    if (filters.dataFim) params.dataFim = filters.dataFim;
    if (filters.equipeId) params.equipeId = filters.equipeId;
    const { data } = await gestaoApi.get('/compras/notas-fiscais', { params });
    return data;
  },

  async buscarNotaFiscal(id: string): Promise<NotaFiscal> {
    const { data } = await gestaoApi.get(`/compras/notas-fiscais/${id}`);
    return data;
  },

  async buscarNotasFiscaisPorProjeto(projetoId: string): Promise<NotaFiscalItemProjeto[]> {
    const { data } = await gestaoApi.get(`/compras/notas-fiscais/por-projeto/${projetoId}`);
    return data;
  },

  async criarNotaFiscal(payload: CreateNotaFiscalPayload): Promise<NotaFiscal> {
    const { data } = await gestaoApi.post('/compras/notas-fiscais', payload);
    return data;
  },

  async atualizarNotaFiscal(id: string, payload: UpdateNotaFiscalPayload): Promise<NotaFiscal> {
    const { data } = await gestaoApi.patch(`/compras/notas-fiscais/${id}`, payload);
    return data;
  },

  /**
   * Valida uma chave NF-e via módulo Fiscal e retorna preview
   * (emitente, número, valor, produtos). Lança erro tipado em caso de
   * chave inválida, NF cancelada, destinatário não-CAPUL, etc.
   */
  async validarChaveNfe(chave: string): Promise<ValidarChaveNfeResult> {
    const { data } = await gestaoApi.post('/compras/notas-fiscais/validar-chave', { chave });
    return data;
  },

  async excluirNotaFiscal(id: string): Promise<void> {
    await gestaoApi.delete(`/compras/notas-fiscais/${id}`);
  },

  async duplicarNotaFiscal(id: string): Promise<NotaFiscal> {
    const { data } = await gestaoApi.post(`/compras/notas-fiscais/${id}/duplicar`);
    return data;
  },

  async listarEquipesParaCompras(): Promise<EquipeResumo[]> {
    const { data } = await gestaoApi.get('/compras/notas-fiscais/equipes-disponiveis');
    return data;
  },

  // Anexos NF
  async listarAnexosNF(nfId: string): Promise<AnexoNF[]> {
    const { data } = await gestaoApi.get(`/compras/notas-fiscais/${nfId}/anexos`);
    return data;
  },

  async uploadAnexoNF(nfId: string, file: File): Promise<AnexoNF> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await gestaoApi.post(`/compras/notas-fiscais/${nfId}/anexos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async downloadAnexoNF(nfId: string, anexoId: string, nomeOriginal: string): Promise<void> {
    const { data } = await gestaoApi.get(`/compras/notas-fiscais/${nfId}/anexos/${anexoId}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeOriginal;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  async abrirAnexoNF(nfId: string, anexoId: string, mimeType: string): Promise<void> {
    const { data } = await gestaoApi.get(`/compras/notas-fiscais/${nfId}/anexos/${anexoId}/download?inline=1`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([data], { type: withCharsetUtf8(mimeType) }));
    window.open(url, '_blank');
  },

  async removerAnexoNF(nfId: string, anexoId: string): Promise<void> {
    await gestaoApi.delete(`/compras/notas-fiscais/${nfId}/anexos/${anexoId}`);
  },
};
