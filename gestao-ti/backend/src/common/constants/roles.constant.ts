/**
 * Constantes de roles centralizadas para toda a aplicacao.
 * Evita duplicacao e facilita manutencao.
 */

import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

/** Roles com acesso de gestao (ADMIN + GESTOR_TI) */
export const ROLES_GESTORES = ['ADMIN', 'GESTOR'] as const;

/** Roles de TI (inclui SUPORTE_TI) */
export const ROLES_TI = ['ADMIN', 'GESTOR', 'SUPORTE'] as const;

/** Roles com acesso restrito a projetos vinculados */
export const ROLES_EXTERNOS = ['USUARIO_CHAVE', 'TERCEIRIZADO'] as const;

/** Verifica se role e de gestor */
export const isGestor = (role: string): boolean => ROLES_GESTORES.includes(role as typeof ROLES_GESTORES[number]);

/** Verifica se role e de TI */
export const isTI = (role: string): boolean => ROLES_TI.includes(role as typeof ROLES_TI[number]);

/**
 * S12 (25/05) — checa se o user tem perfil STAFF (ADMIN/GESTOR/SUPORTE)
 * em ALGUM departamento marcado como TI no JWT (`departamentos[].isTI`).
 *
 * Resolve o caso multi-perfil onde `role` denormalizada do JWT pode
 * sugerir staff (ex: GESTOR de Controladoria) mas o user NÃO é staff
 * em T.I. Sem esta verificação, o filtro de chamados em chamado-core
 * usava `isTI(role)` (role-only) → falso positivo → vazava visibilidade
 * cross-depto e PRIVADO (incidente Juliana 25/05).
 *
 * Tokens pré-S12 não trazem `isTI` em departamentos[] → todos retornam
 * false (conservador — equivale a "não é staff TI", não vaza).
 */
export function hasStaffPerfilEmTI(user: JwtPayload | null | undefined): boolean {
  if (!user) return false;
  const workspace = user.modulos?.find((m) => m.codigo === 'WORKSPACE');
  if (!workspace) return false;
  for (const depto of workspace.departamentos ?? []) {
    if (depto.isTI && ROLES_TI.includes(depto.role as typeof ROLES_TI[number])) {
      return true;
    }
  }
  return false;
}

/**
 * S13a (25/05) — retorna os IDs dos departamentos onde o user tem perfil
 * STAFF (ADMIN/GESTOR/SUPORTE), seja em depto TI ou em depto operacional
 * (Controladoria/Fiscal/etc.).
 *
 * Diferencia-se de `getDeptoIdsDoUser` (que retorna TODOS os deptos com
 * qualquer role): aqui só vêm deptos onde o user tem privilégio elevado.
 *
 * Uso: filtros que dão visão "ampla" só pra staff (chamado.departamentoId
 * IN deptos do user, projeto.departamentoId IN deptos do user). Sem esta
 * restrição, Juliana (USUARIO_FINAL/T.I.) tinha TI nos deptoIds e via
 * todos chamados/projetos de T.I. mesmo não sendo staff.
 *
 * Tokens pré-S12 (sem departamentos[]) → retorna [].
 */
export function getDeptosOndeStaff(user: JwtPayload | null | undefined): string[] {
  if (!user) return [];
  const workspace = user.modulos?.find((m) => m.codigo === 'WORKSPACE');
  if (!workspace) return [];
  return (workspace.departamentos ?? [])
    .filter((d) => ROLES_TI.includes(d.role as typeof ROLES_TI[number]))
    .map((d) => d.id);
}
