export interface ModuloUsuario {
  codigo: string;
  nome: string;
  icone: string;
  cor: string;
  url: string;
  role: string;
  roleNome: string;
}

export interface FilialUsuario {
  id: string;
  codigo: string;
  nome: string;
  isDefault?: boolean;
}

export interface UsuarioLogado {
  id: string;
  username: string;
  nome: string;
  email: string | null;
  telefone?: string | null;
  cargo?: string | null;
  avatarUrl?: string | null;
  primeiroAcesso: boolean;
  filialAtual: FilialUsuario | null;
  filiais?: FilialUsuario[];
  modulos: ModuloUsuario[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioLogado;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface SwitchFilialResponse {
  accessToken: string;
  refreshToken: string;
  filialAtual: FilialUsuario;
}

// Gerenciamento de usuarios
export interface UsuarioListItem {
  id: string;
  username: string;
  email: string | null;
  nome: string;
  telefone: string | null;
  cargo: string | null;
  status: string;
  primeiroAcesso: boolean;
  ultimoLogin: string | null;
  createdAt: string;
  filialPrincipal: { id: string; codigo: string; nomeFantasia: string } | null;
  permissoes: {
    modulo: { codigo: string; nome: string };
    roleModulo: { codigo: string; nome: string };
  }[];
}

export interface UsuarioDetalhe {
  id: string;
  username: string;
  email: string | null;
  nome: string;
  telefone: string | null;
  cargo: string | null;
  status: string;
  filialPrincipal: { id: string; codigo: string; nomeFantasia: string } | null;
  departamento: { id: string; nome: string } | null;
  filiais: { filial: { id: string; codigo: string; nomeFantasia: string } }[];
  permissoes: {
    id: string;
    modulo: ModuloSistema;
    roleModulo: RoleModulo;
    status: string;
  }[];
}

export interface ModuloSistema {
  id: string;
  codigo: string;
  nome: string;
  icone: string;
  cor: string;
  rolesDisponiveis: RoleModulo[];
}

export interface RoleModulo {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
}

export interface FilialOption {
  id: string;
  codigo: string;
  nomeFantasia: string;
}
