/**
 * Payload JWT emitido pelo Auth Gateway.
 * Estrutura compartilhada com gestao-ti, inventario, configurador.
 *
 * Workspace Multi-Departamento (Onda 1 Sub-fase 1.4): ModuloPayload ganhou
 * `departamentos?[]` com `funcionalidades[]` (opcional pra retrocompat).
 * Sub-fase 1.5 popula request com info departamental via FiscalGuard.
 */
export interface ModuloDepartamentoPayload {
  id: string;
  nome: string;
  role: string;
  funcionalidades: string[];
}

export interface ModuloPayload {
  codigo: string; // ex.: 'FISCAL', 'GESTAO_TI', 'INVENTARIO'
  role: string;   // role denormalizada (= role do 1º depto — retrocompat)
  departamentos?: ModuloDepartamentoPayload[];
}

export interface JwtPayload {
  sub: string; // userId UUID
  email: string;
  nome: string;
  empresaId?: string;
  filialId?: string;
  filialCodigo?: string;
  modulos: ModuloPayload[];
  iat?: number;
  exp?: number;
}

/**
 * Usuário autenticado, anexado ao request após o JwtAuthGuard + FiscalGuard.
 */
export interface FiscalAuthenticatedUser {
  id: string;
  email: string;
  nome: string;
  filialId?: string;
  filialCodigo?: string;
  fiscalRole: string;
  /**
   * Workspace Multi-Departamento (Onda 1 Sub-fase 1.5).
   * Lista de departamentos onde o usuário tem acesso ao módulo Fiscal +
   * funcionalidades ativas em cada um. Vazio se JWT antigo (pré 1.4).
   */
  fiscalDepartamentos: ModuloDepartamentoPayload[];
}
