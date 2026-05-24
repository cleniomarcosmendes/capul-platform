import { JwtPayload } from '../interfaces/jwt-payload.interface.js';

/**
 * Aplica filtro departamental em queries do módulo Workspace.
 *
 * Workspace Multi-Departamento (Onda 2 — C2.4).
 *
 * Comportamento:
 * - **ADMIN** escapa o filtro (D36 — global por design no módulo)
 * - Demais roles: filtra `departamentoId IN (deptos do user no módulo)`
 * - User sem departamentos[] no JWT (token antigo) ou sem deptos no módulo
 *   (não deveria acontecer): retorna where com filtro impossível
 *   (`departamentoId: { in: [] }` → zero resultados)
 *
 * @example
 *   const where: Prisma.ChamadoWhereInput = { status: 'ABERTO' };
 *   const whereComFiltro = applyDepartamentoFilter(where, user, role);
 *   return this.prisma.chamado.findMany({ where: whereComFiltro });
 */
export function applyDepartamentoFilter<T extends Record<string, unknown>>(
  where: T,
  user: JwtPayload | null | undefined,
  role: string | null | undefined,
  moduloCodigo: string = 'WORKSPACE',
): T {
  // ADMIN escapa (D36)
  if (role === 'ADMIN') return where;

  const deptoIds = user?.modulos
    ?.find((m) => m.codigo === moduloCodigo)
    ?.departamentos?.map((d) => d.id) ?? [];

  return {
    ...where,
    departamentoId: { in: deptoIds },
  };
}

/**
 * Variante pra entidades onde o filtro deve ser composto OR com algo
 * (ex: chamados — user pode ver os do depto OU os que ele abriu como
 * solicitante em outro depto).
 *
 * @returns o filtro de depto pra ser usado com OR
 */
export function buildDepartamentoFilterClause(
  user: JwtPayload | null | undefined,
  role: string | null | undefined,
  moduloCodigo: string = 'WORKSPACE',
): { departamentoId?: { in: string[] } } | null {
  if (role === 'ADMIN') return null;

  const deptoIds = user?.modulos
    ?.find((m) => m.codigo === moduloCodigo)
    ?.departamentos?.map((d) => d.id) ?? [];

  return { departamentoId: { in: deptoIds } };
}

/**
 * Workspace Onda 2 C2.7 — extrai os IDs dos deptos do user no módulo.
 * Retorna `null` se ADMIN (escape D36). Retorna `[]` se user sem deptos.
 *
 * Útil para construir filtros customizados (ex: chamados, onde a regra
 * é "solicitante OU depto-dono em deptos_user").
 */
export function getDeptoIdsDoUser(
  user: JwtPayload | null | undefined,
  role: string | null | undefined,
  moduloCodigo: string = 'WORKSPACE',
): string[] | null {
  if (role === 'ADMIN') return null;
  return (
    user?.modulos
      ?.find((m) => m.codigo === moduloCodigo)
      ?.departamentos?.map((d) => d.id) ?? []
  );
}

/**
 * Workspace Onda 2 C2.7 — fragmento de `where` pra agregações de dashboard.
 * Combina o escopo automático do user (deptos onde tem perfil) com o filtro
 * opcional de UI (dropdown "Departamento").
 *
 * - ADMIN sem filtro UI       → `{}` (todo o universo)
 * - ADMIN com filtro UI X     → `{ departamentoId: X }`
 * - não-ADMIN sem filtro UI   → `{ departamentoId: { in: deptos_user } }`
 * - não-ADMIN com filtro UI X → `{ departamentoId: X }` SE X ∈ deptos_user,
 *   senão fragmento impossível `{ in: [] }` (zera resultado por segurança)
 *
 * Spread no `where`:
 *   const f = buildDashboardDeptoFilter(user, role, filters.departamentoId);
 *   prisma.chamado.count({ where: { ...periodo, ...f } });
 */
export function buildDashboardDeptoFilter(
  user: JwtPayload | null | undefined,
  role: string | null | undefined,
  filtroUI: string | null | undefined,
  moduloCodigo: string = 'WORKSPACE',
): { departamentoId?: string | { in: string[] } } {
  const deptoIds = getDeptoIdsDoUser(user, role, moduloCodigo);
  // ADMIN: respeita filtro UI ou abre tudo
  if (deptoIds === null) {
    return filtroUI ? { departamentoId: filtroUI } : {};
  }
  // Não-ADMIN com filtro UI: precisa que o depto escolhido seja dele
  if (filtroUI) {
    return deptoIds.includes(filtroUI)
      ? { departamentoId: filtroUI }
      : { departamentoId: { in: [] } };
  }
  // Não-ADMIN sem filtro UI: limita aos seus deptos
  return { departamentoId: { in: deptoIds } };
}
