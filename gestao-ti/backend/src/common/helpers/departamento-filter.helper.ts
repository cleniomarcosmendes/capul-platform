import { ForbiddenException } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { hasCapability } from './capability.helper.js';
import { getDeptosOndeStaff } from '../constants/roles.constant.js';

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

// ─── Onda 3 S10 (24/05) — bypass via OVERSIGHT, não via role ────────
//
// D36 (ADMIN escapa filtros) foi REVOGADO nos 6 cadastros operacionais
// (Software/Licença/Contrato/NF/Ativo/Parada) — decisão E1. ADMIN sem
// OVERSIGHT_PLATAFORMA opera como user normal: vê + escreve só nos deptos
// onde tem perfil.
//
// Usos:
//   findAll → applyDepartamentoFilterCadastroOp(where, user, role)
//   create/update → assertDepartamentoDoUser(user, role, dto.departamentoId)
//
// Outros módulos (Chamado/Projeto/Indicador/Dashboard) continuam usando
// applyDepartamentoFilter/buildDashboardDeptoFilter — D36 mantido lá.

/**
 * Variante de `applyDepartamentoFilter` que usa OVERSIGHT pra bypass em
 * vez do role ADMIN. Pra ler cadastros operacionais.
 */
export function applyDepartamentoFilterCadastroOp<T extends Record<string, unknown>>(
  where: T,
  user: JwtPayload | null | undefined,
  role: string | null | undefined,
  moduloCodigo: string = 'WORKSPACE',
): T {
  if (user && hasCapability(user, 'OVERSIGHT_PLATAFORMA')) return where;

  const deptoIds = user?.modulos
    ?.find((m) => m.codigo === moduloCodigo)
    ?.departamentos?.map((d) => d.id) ?? [];

  return {
    ...where,
    departamentoId: { in: deptoIds },
  } as T;
}

/**
 * Valida que o user pode escrever pra `departamentoId` informado.
 *
 * Lança `ForbiddenException` se:
 *  - User não tem OVERSIGHT_PLATAFORMA E
 *  - `departamentoId` não está entre os deptos do perfil do user no módulo
 *
 * Bypass via OVERSIGHT (admin opera cross-depto), não via role ADMIN.
 * Pra criação/edição de Software/Licença/Contrato/NF/Ativo/Parada.
 */
export function assertDepartamentoDoUser(
  user: JwtPayload | null | undefined,
  role: string | null | undefined,
  departamentoId: string,
  moduloCodigo: string = 'WORKSPACE',
): void {
  if (user && hasCapability(user, 'OVERSIGHT_PLATAFORMA')) return;

  const deptoIds = user?.modulos
    ?.find((m) => m.codigo === moduloCodigo)
    ?.departamentos?.map((d) => d.id) ?? [];

  if (!deptoIds.includes(departamentoId)) {
    throw new ForbiddenException(
      'Você não tem permissão pra cadastrar/editar neste departamento. Solicite acesso ao ADMIN.',
    );
  }
}

/**
 * S13c (25/05) — valida que o user tem perfil STAFF (ADMIN/GESTOR/SUPORTE)
 * no depto informado, antes de criar/editar/deletar recursos linkados a uma
 * equipe (catalogo-servico, conhecimento, sla).
 *
 * Diferença pro `assertDepartamentoDoUser`: aqui exige STAFF, não qualquer
 * perfil. Pra que USUARIO_FINAL/T.I. (Juliana) não consiga editar catálogo
 * de TI mesmo tendo perfil naquele depto — só GESTOR/T.I. real consegue.
 *
 * Bypass via OVERSIGHT_PLATAFORMA (admin global). Não usa ADMIN (D36 revogado
 * em S10 pros cadastros operacionais; mesma lógica aqui).
 */
export function assertStaffEmDepto(
  user: JwtPayload | null | undefined,
  departamentoId: string | null | undefined,
): void {
  if (user && hasCapability(user, 'OVERSIGHT_PLATAFORMA')) return;
  if (!departamentoId) {
    throw new ForbiddenException('Departamento da equipe não identificado.');
  }
  const deptosStaff = getDeptosOndeStaff(user);
  if (!deptosStaff.includes(departamentoId)) {
    throw new ForbiddenException(
      'Você precisa ser ADMIN/GESTOR/SUPORTE deste departamento pra executar esta operação.',
    );
  }
}
