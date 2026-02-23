import { coreApi } from './api';
import type {
  UsuarioListItem,
  UsuarioDetalhe,
  ModuloSistema,
  FilialOption,
} from '../types';

export const usuarioService = {
  async listar(filialId?: string): Promise<UsuarioListItem[]> {
    const { data } = await coreApi.get('/usuarios', {
      params: filialId ? { filialId } : undefined,
    });
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
    filialPrincipalId?: string;
    filialIds?: string[];
    permissoes?: { moduloId: string; roleModuloId: string }[];
  }) {
    const { data } = await coreApi.post('/usuarios', dto);
    return data;
  },

  async atualizar(
    id: string,
    dto: {
      username?: string;
      nome?: string;
      email?: string;
      telefone?: string;
      cargo?: string;
      filialPrincipalId?: string;
    },
  ) {
    const { data } = await coreApi.patch(`/usuarios/${id}`, dto);
    return data;
  },

  async atualizarStatus(id: string, status: 'ATIVO' | 'INATIVO') {
    const { data } = await coreApi.patch(`/usuarios/${id}/status`, { status });
    return data;
  },

  async atribuirPermissao(
    id: string,
    dto: { moduloId: string; roleModuloId: string },
  ) {
    const { data } = await coreApi.post(`/usuarios/${id}/permissoes`, dto);
    return data;
  },

  async revogarPermissao(id: string, moduloId: string) {
    const { data } = await coreApi.delete(
      `/usuarios/${id}/permissoes/${moduloId}`,
    );
    return data;
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
