import { coreApi } from './api';
import type { UsuarioListItem, UsuarioDetalhe, ModuloSistema, FilialOption } from '../types';

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

  async criar(dto: {
    username: string;
    nome: string;
    senha: string;
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

  async atribuirPermissao(id: string, dto: { moduloId: string; roleModuloId: string }): Promise<void> {
    await coreApi.post(`/usuarios/${id}/permissoes`, dto);
  },

  async revogarPermissao(id: string, moduloId: string): Promise<void> {
    await coreApi.delete(`/usuarios/${id}/permissoes/${moduloId}`);
  },

  async listarModulos(): Promise<ModuloSistema[]> {
    const { data } = await coreApi.get('/modulos');
    return data;
  },

  async listarFiliais(): Promise<FilialOption[]> {
    const { data } = await coreApi.get('/filiais');
    return data;
  },
};
