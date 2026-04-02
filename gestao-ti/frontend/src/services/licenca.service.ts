import { gestaoApi } from './api';
import type { SoftwareLicenca, LicencaUsuario, StatusLicenca, CategoriaLicenca } from '../types';

interface LicencaFilters {
  softwareId?: string;
  status?: StatusLicenca;
  vencendoEm?: number;
  categoriaId?: string;
  avulsas?: boolean;
}

interface CreateLicencaPayload {
  softwareId?: string;
  nome?: string;
  categoriaId?: string;
  modeloLicenca?: string;
  quantidade?: number;
  valorTotal?: number;
  valorUnitario?: number;
  dataInicio?: string;
  dataVencimento?: string;
  chaveSerial?: string;
  fornecedor?: string;
  observacoes?: string;
}

export const licencaService = {
  async listar(filters: LicencaFilters = {}): Promise<SoftwareLicenca[]> {
    const params: Record<string, string> = {};
    if (filters.softwareId) params.softwareId = filters.softwareId;
    if (filters.status) params.status = filters.status;
    if (filters.vencendoEm) params.vencendoEm = String(filters.vencendoEm);
    if (filters.categoriaId) params.categoriaId = filters.categoriaId;
    if (filters.avulsas) params.avulsas = 'true';
    const { data } = await gestaoApi.get('/licencas', { params });
    return data;
  },

  async buscar(id: string): Promise<SoftwareLicenca> {
    const { data } = await gestaoApi.get(`/licencas/${id}`);
    return data;
  },

  async criar(payload: CreateLicencaPayload): Promise<SoftwareLicenca> {
    const { data } = await gestaoApi.post('/licencas', payload);
    return data;
  },

  async atualizar(id: string, payload: Partial<CreateLicencaPayload>): Promise<SoftwareLicenca> {
    const { data } = await gestaoApi.patch(`/licencas/${id}`, payload);
    return data;
  },

  async renovar(id: string): Promise<SoftwareLicenca> {
    const { data } = await gestaoApi.post(`/licencas/${id}/renovar`);
    return data;
  },

  async inativar(id: string): Promise<SoftwareLicenca> {
    const { data } = await gestaoApi.post(`/licencas/${id}/inativar`);
    return data;
  },

  async excluir(id: string): Promise<void> {
    await gestaoApi.delete(`/licencas/${id}`);
  },

  // ─── Usuarios da Licenca ────────────────────────────────

  async listarUsuarios(licencaId: string): Promise<LicencaUsuario[]> {
    const { data } = await gestaoApi.get(`/licencas/${licencaId}/usuarios`);
    return data;
  },

  async atribuirUsuario(licencaId: string, usuarioId: string): Promise<SoftwareLicenca> {
    const { data } = await gestaoApi.post(`/licencas/${licencaId}/usuarios`, { usuarioId });
    return data;
  },

  async desatribuirUsuario(licencaId: string, usuarioId: string): Promise<SoftwareLicenca> {
    const { data } = await gestaoApi.delete(`/licencas/${licencaId}/usuarios/${usuarioId}`);
    return data;
  },

  // ─── Categorias ────────────────────────────────
  async listarCategorias(): Promise<CategoriaLicenca[]> {
    const { data } = await gestaoApi.get('/licencas/categorias');
    return data;
  },

  async criarCategoria(payload: { codigo: string; nome: string; descricao?: string }): Promise<CategoriaLicenca> {
    const { data } = await gestaoApi.post('/licencas/categorias', payload);
    return data;
  },

  async atualizarCategoria(id: string, payload: Record<string, unknown>): Promise<CategoriaLicenca> {
    const { data } = await gestaoApi.patch(`/licencas/categorias/${id}`, payload);
    return data;
  },

  async excluirCategoria(id: string): Promise<void> {
    await gestaoApi.delete(`/licencas/categorias/${id}`);
  },
};
