// Auth types
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

// Empresa
export interface Empresa {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpjMatriz: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  logoUrl: string | null;
  filiais: Filial[];
  createdAt: string;
  updatedAt: string;
}

// Filial
export interface Filial {
  id: string;
  codigo: string;
  nomeFantasia: string;
  razaoSocial: string | null;
  cnpj: string | null;
  descricao: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  status: 'ATIVO' | 'INATIVO';
  empresaId: string;
  createdAt: string;
  updatedAt: string;
}

// Tipo de Departamento
export interface TipoDepartamento {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  status: 'ATIVO' | 'INATIVO';
  _count?: { departamentos: number };
  createdAt: string;
  updatedAt: string;
}

// Departamento
export interface Departamento {
  id: string;
  nome: string;
  descricao: string | null;
  tipoDepartamentoId: string;
  tipoDepartamento: TipoDepartamento;
  status: 'ATIVO' | 'INATIVO';
  filialId: string;
  createdAt: string;
  updatedAt: string;
}

// Centro de Custo
export interface CentroCusto {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  status: 'ATIVO' | 'INATIVO';
  filialId: string;
  createdAt: string;
  updatedAt: string;
}

// Usuario
export interface UsuarioListItem {
  id: string;
  username: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  status: 'ATIVO' | 'INATIVO';
  primeiroAcesso: boolean;
  ultimoLogin: string | null;
  createdAt: string;
  filialPrincipal: { id: string; codigo: string; nomeFantasia: string } | null;
  permissoes: {
    modulo: { codigo: string; nome: string };
    roleModulo: { codigo: string; nome: string };
  }[];
}

export interface UsuarioDetalhe extends UsuarioListItem {
  departamento: { id: string; nome: string } | null;
  filiais: { filial: { id: string; codigo: string; nomeFantasia: string } }[];
  permissoes: {
    id: string;
    status: string;
    modulo: ModuloSistema;
    roleModulo: RoleModulo;
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
  descricao: string | null;
}

export interface FilialOption {
  id: string;
  codigo: string;
  nomeFantasia: string;
  status: string;
}
