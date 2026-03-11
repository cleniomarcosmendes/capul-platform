import { gestaoApi } from './api';
import type { SoftwareLicenca, LicencaUsuario, StatusLicenca } from '../types';

interface LicencaFilters {
  softwareId?: string;
  status?: StatusLicenca;
  vencendoEm?: number;
}

interface CreateLicencaPayload {
  softwareId: string;
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
};
