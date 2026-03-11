import { gestaoApi } from './api';
import type { ArtigoConhecimento, AnexoConhecimento } from '../types';

export const conhecimentoService = {
  async listar(filters?: {
    categoria?: string;
    status?: string;
    softwareId?: string;
    equipeTiId?: string;
    search?: string;
  }): Promise<ArtigoConhecimento[]> {
    const { data } = await gestaoApi.get('/conhecimento', { params: filters });
    return data;
  },

  async buscar(id: string): Promise<ArtigoConhecimento> {
    const { data } = await gestaoApi.get(`/conhecimento/${id}`);
    return data;
  },

  async criar(payload: Record<string, unknown>): Promise<ArtigoConhecimento> {
    const { data } = await gestaoApi.post('/conhecimento', payload);
    return data;
  },

  async atualizar(id: string, payload: Record<string, unknown>): Promise<ArtigoConhecimento> {
    const { data } = await gestaoApi.patch(`/conhecimento/${id}`, payload);
    return data;
  },

  async alterarStatus(id: string, status: string): Promise<ArtigoConhecimento> {
    const { data } = await gestaoApi.patch(`/conhecimento/${id}/status`, { status });
    return data;
  },

  async excluir(id: string): Promise<void> {
    await gestaoApi.delete(`/conhecimento/${id}`);
  },

  // === Anexos ===

  async listarAnexos(artigoId: string): Promise<AnexoConhecimento[]> {
    const { data } = await gestaoApi.get(`/conhecimento/${artigoId}/anexos`);
    return data;
  },

  async uploadAnexo(artigoId: string, file: File, descricao?: string): Promise<AnexoConhecimento> {
    const formData = new FormData();
    formData.append('file', file);
    if (descricao) formData.append('descricao', descricao);
    const { data } = await gestaoApi.post(`/conhecimento/${artigoId}/anexos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async downloadAnexo(artigoId: string, anexoId: string, nomeOriginal: string): Promise<void> {
    const { data } = await gestaoApi.get(`/conhecimento/${artigoId}/anexos/${anexoId}/download`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeOriginal;
    link.click();
    window.URL.revokeObjectURL(url);
  },

  async removerAnexo(artigoId: string, anexoId: string): Promise<void> {
    await gestaoApi.delete(`/conhecimento/${artigoId}/anexos/${anexoId}`);
  },
};
