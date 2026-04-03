import { gestaoApi } from './api';
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
  departamentoId: string;
  projetoId?: string;
  observacao?: string;
}

interface CreateNotaFiscalPayload {
  numero: string;
  dataLancamento: string;
  fornecedorId: string;
  observacao?: string;
  itens: NotaFiscalItemPayload[];
}

interface UpdateNotaFiscalPayload {
  numero?: string;
  dataLancamento?: string;
  fornecedorId?: string;
  observacao?: string;
  status?: string;
  itens?: NotaFiscalItemPayload[];
}

interface ListFilters {
  fornecedorId?: string;
  status?: string;
  departamentoId?: string;
  projetoId?: string;
  dataInicio?: string;
  dataFim?: string;
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
    if (filters.departamentoId) params.departamentoId = filters.departamentoId;
    if (filters.projetoId) params.projetoId = filters.projetoId;
    if (filters.dataInicio) params.dataInicio = filters.dataInicio;
    if (filters.dataFim) params.dataFim = filters.dataFim;
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

  async excluirNotaFiscal(id: string): Promise<void> {
    await gestaoApi.delete(`/compras/notas-fiscais/${id}`);
  },

  async duplicarNotaFiscal(id: string): Promise<NotaFiscal> {
    const { data } = await gestaoApi.post(`/compras/notas-fiscais/${id}/duplicar`);
    return data;
  },
};
