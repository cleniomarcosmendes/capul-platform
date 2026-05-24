import { coreApi } from './api';
import type { Departamento, CentroCusto, UsuarioCore } from '../types';

export interface ListarDeptosOpts {
  filialId?: string;
  /** Workspace Onda 2 C2.8 — só deptos com ao menos 1 funcionalidade ativa. */
  workspaceOnly?: boolean;
  /** Workspace Onda 2 C2.8 — só deptos com esta funcionalidade ativa. */
  funcionalidade?: string;
}

export const coreService = {
  /**
   * Compat: aceita string (filialId) OU objeto de opções.
   * Forma nova: `listarDepartamentos({ funcionalidade: 'EQUIPE' })`.
   */
  async listarDepartamentos(arg?: string | ListarDeptosOpts): Promise<Departamento[]> {
    const opts: ListarDeptosOpts = typeof arg === 'string' ? { filialId: arg } : (arg ?? {});
    const params: Record<string, string> = {};
    if (opts.filialId) params.filialId = opts.filialId;
    if (opts.workspaceOnly) params.workspaceOnly = 'true';
    if (opts.funcionalidade) params.funcionalidade = opts.funcionalidade;
    const { data } = await coreApi.get('/departamentos', { params });
    return data;
  },

  async criarDepartamento(depto: Partial<Departamento>): Promise<Departamento> {
    const { data } = await coreApi.post('/departamentos', depto);
    return data;
  },

  async atualizarDepartamento(id: string, depto: Partial<Departamento>): Promise<Departamento> {
    const { data } = await coreApi.patch(`/departamentos/${id}`, depto);
    return data;
  },

  async excluirDepartamento(id: string): Promise<void> {
    await coreApi.delete(`/departamentos/${id}`);
  },

  async listarCentrosCusto(filialId?: string): Promise<CentroCusto[]> {
    const params = filialId ? { filialId } : {};
    const { data } = await coreApi.get('/centros-custo', { params });
    return data;
  },

  async criarCentroCusto(cc: Partial<CentroCusto>): Promise<CentroCusto> {
    const { data } = await coreApi.post('/centros-custo', cc);
    return data;
  },

  async atualizarCentroCusto(id: string, cc: Partial<CentroCusto>): Promise<CentroCusto> {
    const { data } = await coreApi.patch(`/centros-custo/${id}`, cc);
    return data;
  },

  async excluirCentroCusto(id: string): Promise<void> {
    await coreApi.delete(`/centros-custo/${id}`);
  },

  async listarUsuarios(): Promise<UsuarioCore[]> {
    const { data } = await coreApi.get('/usuarios');
    return data;
  },

  async listarFiliais(): Promise<{ id: string; codigo: string; nomeFantasia: string }[]> {
    const { data } = await coreApi.get('/filiais');
    return data;
  },
};
