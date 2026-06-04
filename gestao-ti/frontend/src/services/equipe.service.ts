import { gestaoApi } from './api';
import type { Equipe, MembroEquipe } from '../types';

export const equipeService = {
  async listar(status?: string): Promise<Equipe[]> {
    const params = status ? { status } : {};
    const { data } = await gestaoApi.get('/equipes', { params });
    return data;
  },

  async buscar(id: string): Promise<Equipe> {
    const { data } = await gestaoApi.get(`/equipes/${id}`);
    return data;
  },

  /**
   * Equipes SELECIONÁVEIS na ABERTURA de chamado — aplica a visibilidade
   * pública/privada por departamento (privada só aparece pra staff do depto
   * dela). Distinto de `listar` (global, usado pela TRANSFERÊNCIA).
   */
  async listarSelecionaveis(status?: string): Promise<Equipe[]> {
    const params = status ? { status } : {};
    const { data } = await gestaoApi.get('/equipes/abertura', { params });
    return data;
  },

  /**
   * S15.4 (27/05) — Lista equipes restritas aos deptos onde o user é STAFF
   * (ADMIN/GESTOR/SUPORTE). Pra TELA DE CONFIGURAÇÃO (`/gestao-ti/equipes`).
   * Outras telas que usam dropdown de equipe (chamado/contrato/etc) seguem
   * usando `listar` (global).
   */
  async listarParaConfig(status?: string): Promise<Equipe[]> {
    const params = status ? { status } : {};
    const { data } = await gestaoApi.get('/equipes/config', { params });
    return data;
  },

  /**
   * S15.4 (27/05) — Detalhe scoped por STAFF do depto. Pra páginas admin
   * (`/gestao-ti/equipes/:id` e `/gestao-ti/equipes/:id/editar`). Outras
   * telas que mostram membros (ex.: ChamadoDetalhePage) usam `buscar`.
   */
  async buscarParaConfig(id: string): Promise<Equipe> {
    const { data } = await gestaoApi.get(`/equipes/${id}/config`);
    return data;
  },

  async criar(equipe: Partial<Equipe>): Promise<Equipe> {
    const { data } = await gestaoApi.post('/equipes', equipe);
    return data;
  },

  async atualizar(id: string, equipe: Partial<Equipe>): Promise<Equipe> {
    const { data } = await gestaoApi.patch(`/equipes/${id}`, equipe);
    return data;
  },

  async atualizarStatus(id: string, status: string): Promise<Equipe> {
    const { data } = await gestaoApi.patch(`/equipes/${id}/status`, { status });
    return data;
  },

  async adicionarMembro(equipeId: string, membro: { usuarioId: string; isLider?: boolean; podeGerirContratos?: boolean; podeGerirCompras?: boolean }): Promise<MembroEquipe> {
    const { data } = await gestaoApi.post(`/equipes/${equipeId}/membros`, membro);
    return data;
  },

  async atualizarMembro(equipeId: string, membroId: string, dados: { isLider?: boolean; podeGerirContratos?: boolean; podeGerirCompras?: boolean; status?: string }): Promise<MembroEquipe> {
    const { data } = await gestaoApi.patch(`/equipes/${equipeId}/membros/${membroId}`, dados);
    return data;
  },

  async excluir(id: string): Promise<void> {
    await gestaoApi.delete(`/equipes/${id}`);
  },

  async removerMembro(equipeId: string, membroId: string): Promise<void> {
    await gestaoApi.delete(`/equipes/${equipeId}/membros/${membroId}`);
  },

  /**
   * Lista equipes disponiveis para vincular a contratos.
   * Para ADMIN/GESTOR_TI retorna todas. Para SUPORTE_TI, apenas as autorizadas.
   */
  async listarParaContratos(): Promise<Equipe[]> {
    const { data } = await gestaoApi.get('/equipes/para-contratos');
    return data;
  },
};
