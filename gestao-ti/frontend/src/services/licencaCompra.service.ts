import { gestaoApi } from './api';
import type { LicencaCompra } from '../types';
import type { PaginatedResponse } from '../components/Paginator';

export interface LicencaItemPayload {
  softwareId?: string;
  nome?: string;
  categoriaId?: string;
  modeloLicenca?: string;
  quantidade?: number;
  valorUnitario?: number;
  chaveSerial?: string;
  observacoes?: string;
  departamentoId: string; // Depto Licença Alocada (por item)
}

export interface CreateLicencaCompraPayload {
  numero?: string;
  semNota?: boolean;
  dataLancamento: string;
  dataVencimento?: string;
  fornecedorId?: string;
  fornecedor?: string;
  chaveNfe?: string;
  observacao?: string;
  itens: LicencaItemPayload[];
}

export type UpdateLicencaCompraPayload = Partial<Omit<CreateLicencaCompraPayload, 'itens'>>;

interface ListFilters {
  busca?: string;
  fornecedorId?: string;
  semNota?: boolean;
  page?: number;
  pageSize?: number;
}

export const licencaCompraService = {
  async listar(filters: ListFilters = {}): Promise<PaginatedResponse<LicencaCompra>> {
    const params = new URLSearchParams();
    if (filters.busca) params.set('busca', filters.busca);
    if (filters.fornecedorId) params.set('fornecedorId', filters.fornecedorId);
    if (typeof filters.semNota === 'boolean') params.set('semNota', String(filters.semNota));
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    const { data } = await gestaoApi.get(`/licenca-compras?${params.toString()}`);
    return data;
  },

  async buscar(id: string): Promise<LicencaCompra> {
    const { data } = await gestaoApi.get(`/licenca-compras/${id}`);
    return data;
  },

  async criar(payload: CreateLicencaCompraPayload): Promise<LicencaCompra> {
    const { data } = await gestaoApi.post('/licenca-compras', payload);
    return data;
  },

  async atualizar(id: string, payload: UpdateLicencaCompraPayload): Promise<LicencaCompra> {
    const { data } = await gestaoApi.patch(`/licenca-compras/${id}`, payload);
    return data;
  },

  async excluir(id: string): Promise<void> {
    await gestaoApi.delete(`/licenca-compras/${id}`);
  },
};
