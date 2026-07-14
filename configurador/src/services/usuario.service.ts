import { coreApi } from './api';
import type { UsuarioListItem, UsuarioDetalhe, ModuloSistema, FilialOption, UsuarioCapability } from '../types';

export const usuarioService = {
  async listar(filialId?: string): Promise<UsuarioListItem[]> {
    const params = filialId ? { filialId } : {};
    const { data } = await coreApi.get('/usuarios', { params });
    return data;
  },

  async buscar(id: string): Promise<UsuarioDetalhe> {
    const { data } = await coreApi.get(`/usuarios/${id}`);
    return data;
  },

  /** Busca funcionário por NOME no Protheus (SA1 filtrado a chapas E…) para preencher a
   *  matrícula — quem cadastra sabe o nome, não a chapa. */
  async buscarFuncionarios(nome: string): Promise<{ matricula: string; nome: string }[]> {
    const { data } = await coreApi.get('/usuarios/funcionarios', { params: { nome } });
    return data;
  },

  async criar(dto: {
    username: string;
    nome: string;
    senha?: string;
    matricula?: string;
    autenticaPortal?: boolean;
    email?: string;
    telefone?: string;
    cargo?: string;
    tipo?: 'INDIVIDUAL' | 'PADRAO';
    filialPrincipalId?: string;
    departamentoId: string;
    filialIds?: string[];
    permissoes?: { moduloId: string; roleModuloId: string }[];
  }): Promise<UsuarioDetalhe> {
    const { data } = await coreApi.post('/usuarios', dto);
    return data;
  },

  async atualizar(id: string, dto: {
    username?: string;
    nome?: string;
    matricula?: string;
    autenticaPortal?: boolean;
    email?: string;
    telefone?: string;
    cargo?: string;
    tipo?: 'INDIVIDUAL' | 'PADRAO';
    filialPrincipalId?: string;
    departamentoId?: string;
    filialIds?: string[];
  }): Promise<UsuarioDetalhe> {
    const { data } = await coreApi.patch(`/usuarios/${id}`, dto);
    return data;
  },

  async resetarSenha(id: string, novaSenha: string): Promise<{ success: boolean; message: string }> {
    const { data } = await coreApi.patch(`/usuarios/${id}/reset-senha`, { novaSenha });
    return data;
  },

  async atualizarStatus(id: string, status: 'ATIVO' | 'INATIVO'): Promise<UsuarioDetalhe> {
    const { data } = await coreApi.patch(`/usuarios/${id}/status`, { status });
    return data;
  },

  async atribuirPermissao(
    id: string,
    dto: { moduloId: string; roleModuloId: string; departamentoId?: string },
  ): Promise<void> {
    // Sub-fase 1.6.2 — departamentoId opcional (multi-perfil real).
    await coreApi.post(`/usuarios/${id}/permissoes`, dto);
  },

  async revogarPermissao(id: string, moduloId: string, departamentoId?: string): Promise<void> {
    // Sub-fase 1.6.2 — departamentoId opcional via query string.
    const params = departamentoId ? { departamentoId } : {};
    await coreApi.delete(`/usuarios/${id}/permissoes/${moduloId}`, { params });
  },

  async listarModulos(): Promise<ModuloSistema[]> {
    const { data } = await coreApi.get('/modulos');
    return data;
  },

  async listarFiliais(): Promise<FilialOption[]> {
    const { data } = await coreApi.get('/filiais');
    return data;
  },

  async getPreferencias(id: string): Promise<Record<string, unknown>> {
    const { data } = await coreApi.get(`/usuarios/${id}/preferencias`);
    return data ?? {};
  },

  async atualizarPreferencias(id: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { data } = await coreApi.patch(`/usuarios/${id}/preferencias`, patch);
    return data;
  },

  // Capabilities por usuário (LGPD) — só ADMIN (guard no backend).
  async listarCapabilities(id: string): Promise<UsuarioCapability[]> {
    const { data } = await coreApi.get(`/usuarios/${id}/capabilities`);
    return data;
  },

  async concederCapability(id: string, capability: string, motivo: string): Promise<void> {
    await coreApi.post(`/usuarios/${id}/capabilities`, { capability, motivo });
  },

  async revogarCapability(id: string, capability: string): Promise<void> {
    await coreApi.delete(`/usuarios/${id}/capabilities/${capability}`);
  },
};
