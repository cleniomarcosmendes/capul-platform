import type { JwtPayload } from './decorators/current-user.decorator.js';

/**
 * Papéis do usuário no módulo LOGISTICA.
 *
 * A permissão da plataforma é (usuário × módulo × DEPARTAMENTO × role) — o UNIQUE de
 * `core.permissoes_modulo` inclui o departamento. Logo a mesma pessoa pode ser, por
 * exemplo, SUPERVISOR_FROTA no departamento dela e GESTOR_ENTREGA em outro.
 *
 * O JWT sempre trouxe isso em `modulos[].departamentos[]`; o campo `modulos[].role`
 * é DENORMALIZADO (= role do primeiro depto) e existe só por retrocompatibilidade.
 * A Logística lia o campo legado em 9 pontos — o efeito era silencioso: dar uma
 * SEGUNDA permissão a alguém fazia o módulo inteiro passar a usar a role do primeiro
 * departamento da lista, sem erro e sem aviso. Este módulo é a fonte única agora.
 *
 * Tokens antigos (sem `departamentos[]`) caem no campo legado — um token de 60min
 * emitido antes do deploy continua funcionando exatamente como antes.
 */
export function rolesLogistica(user: JwtPayload | undefined): string[] {
  const mod = user?.modulos?.find((m) => m.codigo === 'LOGISTICA');
  if (!mod) return [];
  const deDeptos = (mod.departamentos ?? []).map((d) => d.role).filter(Boolean);
  // Sem departamentos[] (token antigo) → o legado é tudo que existe.
  if (deDeptos.length === 0) return mod.role ? [mod.role] : [];
  return [...new Set(deDeptos)];
}

/** Tem QUALQUER um dos papéis informados no módulo Logística? */
export function temRoleLogistica(user: JwtPayload | undefined, ...alvos: string[]): boolean {
  const roles = rolesLogistica(user);
  return alvos.some((a) => roles.includes(a));
}

/** Tem acesso ao módulo Logística (qualquer papel)? */
export function temAcessoLogistica(user: JwtPayload | undefined): boolean {
  return rolesLogistica(user).length > 0;
}

/**
 * Departamentos (ids do core) onde o usuário tem ESTE papel na Logística.
 *
 * É o que responde "em QUAL departamento eu sou SUPERVISOR_FROTA" — a pergunta que
 * o papel único não conseguia fazer. Token antigo (sem `departamentos[]`) devolve
 * vazio mesmo tendo o papel: não dá para inventar o departamento que o token não
 * trouxe, e devolver "todos" abriria escopo. Quem chama trata o vazio.
 */
export function deptosComRoleLogistica(user: JwtPayload | undefined, alvo: string): string[] {
  const mod = user?.modulos?.find((m) => m.codigo === 'LOGISTICA');
  if (!mod?.departamentos?.length) return [];
  return [...new Set(mod.departamentos.filter((d) => d.role === alvo).map((d) => d.id))];
}
