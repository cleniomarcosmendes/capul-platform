import { coreApi } from './api';
import type { Departamento } from '../types';

export interface ListarDeptosOpts {
  filialId?: string;
  /** Workspace Onda 2 C2.8 — só deptos com pelo menos 1 funcionalidade ativa. */
  workspaceOnly?: boolean;
  /** Workspace Onda 2 C2.8 — só deptos com esta funcionalidade ativa. */
  funcionalidade?: string;
}

export const departamentoService = {
  /**
   * Compat: aceita string (filialId) OU objeto de opções.
   * Forma nova é `listar({ workspaceOnly: true, funcionalidade: 'EQUIPE' })`.
   */
  async listar(arg?: string | ListarDeptosOpts): Promise<Departamento[]> {
    const opts: ListarDeptosOpts = typeof arg === 'string' ? { filialId: arg } : (arg ?? {});
    const params: Record<string, string> = {};
    if (opts.filialId) params.filialId = opts.filialId;
    if (opts.workspaceOnly) params.workspaceOnly = 'true';
    if (opts.funcionalidade) params.funcionalidade = opts.funcionalidade;
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
