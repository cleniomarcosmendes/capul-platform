/**
 * Payload JWT emitido pelo Auth Gateway.
 * Estrutura compartilhada com gestao-ti, inventario, configurador.
 */
export interface JwtPayload {
  sub: string; // userId UUID
  email: string;
  nome: string;
  empresaId?: string;
  filialId?: string;
  filialCodigo?: string;
  modulos: Array<{
    codigo: string; // ex.: 'FISCAL', 'GESTAO_TI', 'INVENTARIO'
    role: string;   // role específica do módulo
  }>;
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
}
