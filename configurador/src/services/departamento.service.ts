import { coreApi } from './api';
import type { Departamento } from '../types';

export const departamentoService = {
  async listar(filialId?: string): Promise<Departamento[]> {
    const params = filialId ? { filialId } : {};
    const { data } = await coreApi.get('/departamentos', { params });
    return data;
  },

  async criar(dto: { nome: string; descricao?: string; tipoDepartamentoId: string; filialId: string }): Promise<Departamento> {
    const { data } = await coreApi.post('/departamentos', dto);
    return data;
  },

  async atualizar(id: string, dto: Partial<Departamento>): Promise<Departamento> {
    const { data } = await coreApi.patch(`/departamentos/${id}`, dto);
    return data;
  },

  async excluir(id: string): Promise<void> {
    await coreApi.delete(`/departamentos/${id}`);
  },
};
