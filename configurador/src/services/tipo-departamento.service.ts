import { coreApi } from './api';
import type { TipoDepartamento } from '../types';

export const tipoDepartamentoService = {
  async listar(): Promise<TipoDepartamento[]> {
    const { data } = await coreApi.get('/tipos-departamento');
    return data;
  },

  async criar(dto: { nome: string; descricao?: string; ordem?: number }): Promise<TipoDepartamento> {
    const { data } = await coreApi.post('/tipos-departamento', dto);
    return data;
  },

  async atualizar(id: string, dto: Partial<TipoDepartamento>): Promise<TipoDepartamento> {
    const { data } = await coreApi.patch(`/tipos-departamento/${id}`, dto);
    return data;
  },

  async excluir(id: string): Promise<void> {
    await coreApi.delete(`/tipos-departamento/${id}`);
  },
};
