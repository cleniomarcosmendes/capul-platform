import { coreApi } from './api';
import type { CentroCusto } from '../types';

export const centroCustoService = {
  async listar(filialId?: string): Promise<CentroCusto[]> {
    const params = filialId ? { filialId } : {};
    const { data } = await coreApi.get('/centros-custo', { params });
    return data;
  },

  async criar(dto: { codigo: string; nome: string; descricao?: string; filialId: string }): Promise<CentroCusto> {
    const { data } = await coreApi.post('/centros-custo', dto);
    return data;
  },

  async atualizar(id: string, dto: Partial<CentroCusto>): Promise<CentroCusto> {
    const { data } = await coreApi.patch(`/centros-custo/${id}`, dto);
    return data;
  },
};
