import { gestaoApi } from './api';
import type {
  Software,
  SoftwareModulo,
  SoftwareFilialItem,
  ModuloFilialItem,
  TipoSoftware,
  Criticidade,
  StatusSoftware,
  StatusModulo,
} from '../types';

interface SoftwareFilters {
  tipo?: TipoSoftware;
  criticidade?: Criticidade;
  status?: StatusSoftware;
  equipeId?: string;
}

export const softwareService = {
  // ─── Software CRUD ────────────────────────────────────────

  async listar(filters: SoftwareFilters = {}): Promise<Software[]> {
    const params: Record<string, string> = {};
    if (filters.tipo) params.tipo = filters.tipo;
    if (filters.criticidade) params.criticidade = filters.criticidade;
    if (filters.status) params.status = filters.status;
    if (filters.equipeId) params.equipeId = filters.equipeId;
    const { data } = await gestaoApi.get('/softwares', { params });
    return data;
  },

  async buscar(id: string): Promise<Software> {
    const { data } = await gestaoApi.get(`/softwares/${id}`);
    return data;
  },

  async criar(payload: Partial<Software>): Promise<Software> {
    const { data } = await gestaoApi.post('/softwares', payload);
    return data;
  },

  async atualizar(id: string, payload: Partial<Software>): Promise<Software> {
    const { data } = await gestaoApi.patch(`/softwares/${id}`, payload);
    return data;
  },

  async alterarStatus(id: string, status: StatusSoftware): Promise<void> {
    await gestaoApi.patch(`/softwares/${id}/status`, { status });
  },

  async excluir(id: string): Promise<void> {
    await gestaoApi.delete(`/softwares/${id}`);
  },

  // ─── Software ↔ Filial ────────────────────────────────────

  async adicionarFilial(softwareId: string, filialId: string): Promise<SoftwareFilialItem> {
    const { data } = await gestaoApi.post(`/softwares/${softwareId}/filiais`, { filialId });
    return data;
  },

  async removerFilial(softwareId: string, filialId: string): Promise<void> {
    await gestaoApi.delete(`/softwares/${softwareId}/filiais/${filialId}`);
  },

  // ─── Módulos ──────────────────────────────────────────────

  async listarModulos(softwareId: string): Promise<SoftwareModulo[]> {
    const { data } = await gestaoApi.get(`/softwares/${softwareId}/modulos`);
    return data;
  },

  async criarModulo(softwareId: string, payload: { nome: string; descricao?: string; versao?: string; observacoes?: string }): Promise<SoftwareModulo> {
    const { data } = await gestaoApi.post(`/softwares/${softwareId}/modulos`, payload);
    return data;
  },

  async atualizarModulo(softwareId: string, moduloId: string, payload: Partial<SoftwareModulo>): Promise<SoftwareModulo> {
    const { data } = await gestaoApi.patch(`/softwares/${softwareId}/modulos/${moduloId}`, payload);
    return data;
  },

  async alterarStatusModulo(softwareId: string, moduloId: string, status: StatusModulo): Promise<void> {
    await gestaoApi.patch(`/softwares/${softwareId}/modulos/${moduloId}/status`, { status });
  },

  // ─── Módulo ↔ Filial ─────────────────────────────────────

  async adicionarModuloFilial(softwareId: string, moduloId: string, filialId: string): Promise<ModuloFilialItem> {
    const { data } = await gestaoApi.post(`/softwares/${softwareId}/modulos/${moduloId}/filiais`, { filialId });
    return data;
  },

  async removerModuloFilial(softwareId: string, moduloId: string, filialId: string): Promise<void> {
    await gestaoApi.delete(`/softwares/${softwareId}/modulos/${moduloId}/filiais/${filialId}`);
  },
};
