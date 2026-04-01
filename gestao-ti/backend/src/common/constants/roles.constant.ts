/**
 * Constantes de roles centralizadas para toda a aplicacao.
 * Evita duplicacao e facilita manutencao.
 */

/** Roles com acesso de gestao (ADMIN + GESTOR_TI) */
export const ROLES_GESTORES = ['ADMIN', 'GESTOR_TI'] as const;

/** Roles de TI (inclui SUPORTE_TI) */
export const ROLES_TI = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'] as const;

/** Roles com acesso restrito a projetos vinculados */
export const ROLES_EXTERNOS = ['USUARIO_CHAVE', 'TERCEIRIZADO'] as const;

/** Verifica se role e de gestor */
export const isGestor = (role: string): boolean => ROLES_GESTORES.includes(role as typeof ROLES_GESTORES[number]);

/** Verifica se role e de TI */
export const isTI = (role: string): boolean => ROLES_TI.includes(role as typeof ROLES_TI[number]);
