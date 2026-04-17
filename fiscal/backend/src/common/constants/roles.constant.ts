/**
 * Roles do módulo Fiscal — alinhadas com a Seção 10 do PLANO_MODULO_FISCAL_v1.4.
 *
 * Hierarquia (do menor para o maior privilégio):
 *   OPERADOR_ENTRADA  → consulta NF-e/CT-e + cadastro pontual + histórico próprio
 *   ANALISTA_CADASTRO → tudo do anterior + relatórios + divergências + sincronização manual
 *   GESTOR_FISCAL     → tudo do anterior + multi-filial + alterna PROD/HOM + carga completa + recebe alertas
 *   ADMIN_TI          → tudo do anterior + certificado + limpeza + pausar/retomar jobs
 */
export const ROLES_FISCAL = [
  'OPERADOR_ENTRADA',
  'ANALISTA_CADASTRO',
  'GESTOR_FISCAL',
  'ADMIN_TI',
] as const;

export type RoleFiscal = (typeof ROLES_FISCAL)[number];

const HIERARQUIA: Record<RoleFiscal, number> = {
  OPERADOR_ENTRADA: 1,
  ANALISTA_CADASTRO: 2,
  GESTOR_FISCAL: 3,
  ADMIN_TI: 4,
};

/**
 * Verifica se uma role atende a um requisito mínimo.
 * Ex.: temAcessoMinimo('GESTOR_FISCAL', 'ANALISTA_CADASTRO') === true
 */
export function temAcessoMinimo(roleUsuario: string, roleMinima: RoleFiscal): boolean {
  if (!ROLES_FISCAL.includes(roleUsuario as RoleFiscal)) return false;
  return HIERARQUIA[roleUsuario as RoleFiscal] >= HIERARQUIA[roleMinima];
}

export const isAdminTi = (role: string): boolean => role === 'ADMIN_TI';
export const isGestorFiscal = (role: string): boolean =>
  role === 'GESTOR_FISCAL' || role === 'ADMIN_TI';
export const isAnalistaCadastro = (role: string): boolean =>
  temAcessoMinimo(role, 'ANALISTA_CADASTRO');
