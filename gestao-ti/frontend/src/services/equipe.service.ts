import { gestaoApi } from './api';
import type { EquipeTI, MembroEquipe } from '../types';

export const equipeService = {
  async listar(status?: string): Promise<EquipeTI[]> {
    const params = status ? { status } : {};
    const { data } = await gestaoApi.get('/equipes', { params });
    return data;
  },

  async buscar(id: string): Promise<EquipeTI> {
    const { data } = await gestaoApi.get(`/equipes/${id}`);
    return data;
  },

  async criar(equipe: Partial<EquipeTI>): Promise<EquipeTI> {
    const { data } = await gestaoApi.post('/equipes', equipe);
    return data;
  },

  async atualizar(id: string, equipe: Partial<EquipeTI>): Promise<EquipeTI> {
    const { data } = await gestaoApi.patch(`/equipes/${id}`, equipe);
    return data;
  },

  async atualizarStatus(id: string, status: string): Promise<EquipeTI> {
    const { data } = await gestaoApi.patch(`/equipes/${id}/status`, { status });
    return data;
  },

  async adicionarMembro(equipeId: string, membro: { usuarioId: string; isLider?: boolean; podeGerirContratos?: boolean }): Promise<MembroEquipe> {
    const { data } = await gestaoApi.post(`/equipes/${equipeId}/membros`, membro);
    return data;
  },

  async atualizarMembro(equipeId: string, membroId: string, dados: { isLider?: boolean; podeGerirContratos?: boolean; status?: string }): Promise<MembroEquipe> {
    const { data } = await gestaoApi.patch(`/equipes/${equipeId}/membros/${membroId}`, dados);
    return data;
  },

  async removerMembro(equipeId: string, membroId: string): Promise<void> {
    await gestaoApi.delete(`/equipes/${equipeId}/membros/${membroId}`);
  },
};
