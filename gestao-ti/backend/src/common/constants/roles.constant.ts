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
export const isGestor = (role: string): boolean =>
  ROLES_GESTORES.includes(role as (typeof ROLES_GESTORES)[number]);

/** Verifica se role e de TI */
export const isTI = (role: string): boolean =>
  ROLES_TI.includes(role as (typeof ROLES_TI)[number]);

/**
 * O user é staff (ADMIN/GESTOR/SUPORTE) em ALGUM departamento marcado como T.I.
 *
 * ⚠️ 26/08 — RESTOU UM ÚNICO USO LEGÍTIMO: o **artigo GLOBAL** da base de conhecimento,
 * que não pertence a departamento nenhum e é curado pelo T.I. Em todo o resto do módulo
 * este teste foi trocado por "staff NO DEPARTAMENTO DO REGISTRO" (`ehStaffNoDepto`):
 * perguntar "é do T.I.?" era herança da época em que o Workspace só existia lá, e
 * errava dos dois lados — quem atende no Fiscal não alcançava a nota interna do próprio
 * Fiscal, e quem atende no T.I. alcançava a de todo mundo.
 *
 * Não volte a usá-lo para decidir sobre um registro que tem departamento.
 *
 * S12 (25/05) — origem: substituiu `isTI(role)`, que lia a role denormalizada.
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
export function ehStaffDeTI(
  user: JwtPayload | null | undefined,
): boolean {
  if (!user) return false;
  const workspace = user.modulos?.find((m) => m.codigo === 'WORKSPACE');
  if (!workspace) return false;
  for (const depto of workspace.departamentos ?? []) {
    if (
      depto.isTI &&
      ROLES_TI.includes(depto.role as (typeof ROLES_TI)[number])
    ) {
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
export function getDeptosOndeStaff(
  user: JwtPayload | null | undefined,
): string[] {
  if (!user) return [];
  const workspace = user.modulos?.find((m) => m.codigo === 'WORKSPACE');
  if (!workspace) return [];
  return (workspace.departamentos ?? [])
    .filter((d) => ROLES_TI.includes(d.role as (typeof ROLES_TI)[number]))
    .map((d) => d.id);
}

/**
 * Departamentos onde o user é GESTOR (ou ADMIN). Subconjunto de
 * getDeptosOndeStaff (que inclui SUPORTE). Usado na visibilidade restrita de
 * equipe (Fase workspace 18/06): o GESTOR do workspace navega TODAS as equipes
 * — inclusive as `restritaVisibilidade` —, enquanto o SUPORTE só vê as equipes
 * restritas de que é membro.
 */
export function getDeptosOndeGestor(
  user: JwtPayload | null | undefined,
): string[] {
  if (!user) return [];
  const workspace = user.modulos?.find((m) => m.codigo === 'WORKSPACE');
  if (!workspace) return [];
  return (workspace.departamentos ?? [])
    .filter((d) =>
      ROLES_GESTORES.includes(d.role as (typeof ROLES_GESTORES)[number]),
    )
    .map((d) => d.id);
}

/**
 * Workspace (fix deploy 01/06) — retorna a role do user NO departamento
 * informado, lida de `modulos[WORKSPACE].departamentos[]`. Retorna `undefined`
 * se o user não participa daquele depto (ou token antigo sem departamentos[]).
 *
 * Diferente da `modulo.role` denormalizada (= role do 1º depto), que p/ users
 * multi-perfil/multi-workspace NÃO reflete o papel no depto-alvo da operação.
 *
 * Uso: decisões que dependem do papel do user NO depto que ATENDE a operação.
 * Ex: auto-assumir chamado só se o solicitante for staff/técnico do depto-dono
 * (um user do Setor Fiscal abrindo chamado PARA a T.I. não auto-assume).
 */
export function getRoleNoDepto(
  user: JwtPayload | null | undefined,
  departamentoId: string | null | undefined,
): string | undefined {
  if (!user || !departamentoId) return undefined;
  const workspace = user.modulos?.find((m) => m.codigo === 'WORKSPACE');
  return workspace?.departamentos?.find((d) => d.id === departamentoId)?.role;
}

/**
 * ⭐ 25/08 — O PAPEL É DO DEPARTAMENTO, e é o do departamento DO CHAMADO que decide.
 *
 * Contexto (auditoria `docs/AUDITORIA_WORKSPACE_ADMIN_GESTOR_25AGO.md`): o Workspace
 * nasceu no T.I. e hoje atende vários departamentos — no Fiscal há quem responda
 * chamado e quem seja gestor, e essas MESMAS pessoas são usuário final no T.I. Os dois
 * papéis não se misturam.
 *
 * Só que `@Roles(...)` lê a role DENORMALIZADA do JWT (uma só para o módulo, e — pior —
 * a do primeiro registro de permissão, de uma consulta sem ordem definida). Com ela,
 * quem é SUPORTE no Fiscal passava no filtro também num chamado do T.I. O que segurava
 * na prática era a VISIBILIDADE (não achar o id), não a autorização.
 *
 * `ehStaffNoDepto` é o que faltava: mesmo mecanismo que o "assumir automático" já usa
 * (`getRoleNoDepto`), aplicado a quem AGE sobre o chamado.
 */

/**
 * ADMIN em QUALQUER departamento = ADMIN do módulo (D36 — decisão mantida em 25/08).
 *
 * Lê `departamentos[]`, não a role denormalizada: o resultado passa a ser o mesmo
 * independentemente de qual permissão o banco devolveu primeiro. Antes, um ADMIN de
 * departamento podia ser rebaixado (ou não) conforme a ordem física das linhas.
 */
export function ehAdminEmAlgumDepto(
  user: JwtPayload | null | undefined,
  roleFallback?: string | null,
): boolean {
  const departamentos = user?.modulos?.find(
    (m) => m.codigo === 'WORKSPACE',
  )?.departamentos;
  // Token antigo (pré Sub-fase 1.4) não traz departamentos[]: cai na role
  // denormalizada, que é o comportamento que ele já tinha. Sessão aberta durante o
  // deploy não pode virar 403.
  if (!departamentos?.length) return roleFallback === 'ADMIN';
  return departamentos.some((d) => d.role === 'ADMIN');
}

/**
 * O user é STAFF (ADMIN/GESTOR/SUPORTE) NO departamento informado?
 *
 * `departamentoId` é o do CHAMADO (ou do projeto/registro) — não o "departamento do
 * usuário", que não existe: ele tem um papel em cada.
 */
export function ehStaffNoDepto(
  user: JwtPayload | null | undefined,
  departamentoId: string | null | undefined,
  roleFallback?: string | null,
  opts: { adminGlobal?: boolean } = {},
): boolean {
  // `adminGlobal: false` = o ADMIN NÃO escapa. Não é detalhe: o Workspace tem DUAS
  // decisões convivendo. D36 (ADMIN global) vale em chamado/projeto/dashboard, mas foi
  // REVOGADO nos 6 cadastros operacionais (E1, 24/05) — lá o bypass é a capability
  // OVERSIGHT_PLATAFORMA. Quem chama diz qual das duas está aplicando.
  if ((opts.adminGlobal ?? true) && ehAdminEmAlgumDepto(user, roleFallback)) return true;
  const departamentos = user?.modulos?.find(
    (m) => m.codigo === 'WORKSPACE',
  )?.departamentos;
  if (!departamentos?.length) return isTI(roleFallback ?? ''); // token antigo — vide acima
  const roleNoDepto = getRoleNoDepto(user, departamentoId);
  return roleNoDepto !== undefined && isTI(roleNoDepto);
}

/** Idem, restrito a ADMIN/GESTOR (quem manda no departamento). */
export function ehGestorNoDepto(
  user: JwtPayload | null | undefined,
  departamentoId: string | null | undefined,
  roleFallback?: string | null,
  opts: { adminGlobal?: boolean } = {},
): boolean {
  if ((opts.adminGlobal ?? true) && ehAdminEmAlgumDepto(user, roleFallback)) return true;
  const departamentos = user?.modulos?.find(
    (m) => m.codigo === 'WORKSPACE',
  )?.departamentos;
  if (!departamentos?.length) return isGestor(roleFallback ?? '');
  const roleNoDepto = getRoleNoDepto(user, departamentoId);
  return roleNoDepto !== undefined && isGestor(roleNoDepto);
}
