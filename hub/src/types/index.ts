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
