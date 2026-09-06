/**
 * Papéis do módulo GESTAO_PESSOAS.
 *
 * Derivados de como o RH da Capul trabalha (05/09/2026), não de um catálogo
 * genérico:
 *
 *   RH_ADMIN     a gestora de RH. Monta, publica, designa, apura, fecha e vê
 *                tudo. Precisa existir em DUPLA — ver NOTA abaixo.
 *   RH_MODELO    monta o INSTRUMENTO: perguntas, grupos, pesos. Não publica,
 *                não designa, não apura.
 *   RH_CICLO     monta o CICLO e a DESIGNAÇÃO: período, aplicações, quem avalia
 *                quem. Não mexe no instrumento.
 *   AVALIADOR    responde as avaliações que lhe foram designadas, e só essas.
 *
 * ⚠️ RH_MODELO e RH_CICLO estão separados DE PROPÓSITO. O RH ainda não
 * confirmou o que a gestora delega ao supervisor — montar o modelo, ou montar o
 * ciclo e a designação. São autoridades diferentes: quem pondera o instrumento
 * decide quanto vale cada coisa; quem designa decide quem julga quem. Modelar
 * como um papel só agora significaria conceder as duas por descuido, e separar
 * depois é mudança de permissão em produção. Quando a resposta vier, uma delas
 * pode simplesmente não ser atribuída a ninguém.
 *
 * ⭐ NOTA — por que precisa haver DOIS RH_ADMIN: a separação de funções
 * (`avaliacao/separacao-funcoes.ts`) proíbe qualquer pessoa de mexer na própria
 * avaliação, RH_ADMIN inclusive. Como a gestora também é avaliada, com um único
 * RH_ADMIN não haveria quem corrigisse um problema na avaliação dela. O segundo
 * costuma ser a diretoria ou a T.I.
 *
 * ⚠️ ADMIN (papel de plataforma) tem bypass no RolesGuard, como nos outros
 * módulos — mas NÃO na separação de funções, que é verificada por REGISTRO e
 * não por papel. Ver `separacao-funcoes.ts`.
 */
import type { JwtPayload } from './decorators/current-user.decorator.js';

export const MODULO = 'GESTAO_PESSOAS';

export const ROLES = {
  ADMIN: 'ADMIN',
  RH_ADMIN: 'RH_ADMIN',
  RH_MODELO: 'RH_MODELO',
  RH_CICLO: 'RH_CICLO',
  AVALIADOR: 'AVALIADOR',
} as const;

export type RoleRh = (typeof ROLES)[keyof typeof ROLES];

/**
 * ⭐ "Basta ter acesso ao módulo" — para as rotas em que **quem decide é o DADO**,
 * não o papel.
 *
 * A fila do avaliador é a primeira: ser avaliador é fato do dado (a pessoa está
 * designada), e a gestora de RH avalia 13 pessoas tendo só `RH_ADMIN`. O menu já
 * mostra "Minhas avaliações" a qualquer papel do módulo por essa razão; enquanto
 * o controller exigia `AVALIADOR` ou `RH_ADMIN`, quem tivesse só `RH_MODELO` ou
 * `RH_CICLO` **veria o item e levaria 403** — o mesmo defeito da gestora, uma
 * role adiante.
 *
 * ⚠️ Não é o mesmo que remover o `@Roles`: sem ele o `RolesGuard` não checa
 * NADA e quem não tem o módulo entra. Aqui a exigência continua sendo "tem
 * permissão no módulo"; o que decide o acesso ao registro é a designação
 * (`avaliacao/separacao-funcoes.ts`).
 */
export const QUALQUER_PAPEL_DO_MODULO = [
  ROLES.RH_ADMIN,
  ROLES.RH_MODELO,
  ROLES.RH_CICLO,
  ROLES.AVALIADOR,
] as const;

/**
 * Papéis do usuário neste módulo.
 *
 * A permissão da plataforma é (usuário × módulo × DEPARTAMENTO × role), então a
 * mesma pessoa pode ter papéis diferentes em departamentos diferentes — e todos
 * valem. `modulos[].role` é DENORMALIZADO (role do 1º departamento) e está
 * @deprecated: lê-lo faz o módulo enxergar um papel e ignorar os demais, em
 * silêncio. Isso já custou uma onda de correções na Logística.
 */
export function rolesRh(user: JwtPayload | undefined): string[] {
  const mod = user?.modulos?.find((m) => m.codigo === MODULO);
  if (!mod) return [];
  const deDeptos = (mod.departamentos ?? []).map((d) => d.role).filter(Boolean);
  // Token antigo (sem `departamentos[]`) → o campo legado é tudo que existe.
  if (deDeptos.length === 0) return mod.role ? [mod.role] : [];
  return [...new Set(deDeptos)];
}

export function temRoleRh(user: JwtPayload | undefined, ...alvos: string[]): boolean {
  const roles = rolesRh(user);
  return alvos.some((a) => roles.includes(a));
}

export function temAcessoAoModulo(user: JwtPayload | undefined): boolean {
  return rolesRh(user).length > 0;
}

/** Quem enxerga resultado de terceiros (com registro em auditoria quando não é o avaliador). */
export function podeVerResultados(user: JwtPayload | undefined): boolean {
  return temRoleRh(user, ROLES.ADMIN, ROLES.RH_ADMIN);
}
