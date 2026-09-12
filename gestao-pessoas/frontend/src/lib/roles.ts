/**
 * Papéis do módulo, lidos do JWT.
 *
 * ⚠️ `modulos[].role` é DENORMALIZADO (a role do 1º departamento) e mente quando
 * a pessoa tem papéis diferentes em departamentos diferentes. O backend lê
 * `departamentos[].role` (`common/roles-rh.ts`); a tela lê **igual**, senão o
 * menu esconde uma opção que a API autorizaria — e o sintoma é MUDO: ninguém
 * recebe erro, o item simplesmente não existe.
 *
 * ⚠️ **O caso do `REGISTRADOR_FROTA` com "só Início" é da LOGÍSTICA, não daqui.**
 * Ele está citado como precedente — foi o que ensinou a ler `departamentos[]` —
 * e não como defeito presente: este módulo nunca usou o campo denormalizado.
 * Conferido em 12/09 com teste, dos dois lados. Ver §3.1.112.
 *
 * ⭐ Desde 12/09 as DUAS decisões moram aqui e têm spec: quais papéis a pessoa
 * tem (`rolesDoModulo`) e se um deles serve (`temPapel`, com o bypass do
 * ADMIN). O `temPapel` vivia dentro de um `useMemo` no `AuthContext` — pura,
 * decisiva e inalcançável por teste.
 */
export const ROLES = {
  ADMIN: 'ADMIN',
  RH_ADMIN: 'RH_ADMIN',
  RH_MODELO: 'RH_MODELO',
  RH_CICLO: 'RH_CICLO',
  AVALIADOR: 'AVALIADOR',
} as const;

export const MODULO = 'GESTAO_PESSOAS';

export interface ModuloDoToken {
  codigo: string;
  role?: string;
  departamentos?: { role?: string }[];
}

export interface UsuarioDoToken {
  sub: string;
  /** ⚠️ O JWT traz `username`, não `nome` — o nome vem de `/auth/me`. */
  username?: string;
  nome?: string;
  email?: string;
  modulos?: ModuloDoToken[];
}

/**
 * Espelha `rolesRh` do backend — TODOS os papéis, não o denormalizado.
 *
 * ⚠️ A ordem das três linhas importa e é a mesma dos dois lados:
 * 1. sem o módulo no token → nenhum papel (não é "sem papel", é sem acesso);
 * 2. `departamentos[]` ausente ou sem role nenhuma → o campo legado é tudo que
 *    existe (token antigo, emitido antes de o campo existir);
 * 3. caso contrário, TODOS os papéis dos departamentos, deduplicados.
 */
export function rolesDoModulo(usuario: UsuarioDoToken | null): string[] {
  const mod = usuario?.modulos?.find((m) => m.codigo === MODULO);
  if (!mod) return [];
  const deDeptos = (mod.departamentos ?? []).map((d) => d.role).filter(Boolean) as string[];
  if (deDeptos.length === 0) return mod.role ? [mod.role] : [];
  return [...new Set(deDeptos)];
}

/**
 * ⭐⭐ A DECISÃO: um destes papéis serve?
 *
 * ⚠️ **`ADMIN` passa sempre** — é o escape hatch de suporte da plataforma, e
 * espelha o `RolesGuard` do backend. Consequência que morde em teste: **quem
 * testa com ADMIN nunca vê item de menu faltar**, e por isso um erro de papel
 * atravessa varreduras inteiras sem aparecer (§3.1.108).
 *
 * ⚠️ O bypass vale para AUTORIZAÇÃO e **não alcança a separação de funções**,
 * que é verificada por REGISTRO: nem ADMIN abre a avaliação em que é o avaliado.
 */
export function temPapel(roles: readonly string[], ...alvos: string[]): boolean {
  if (roles.includes(ROLES.ADMIN)) return true;
  return alvos.some((a) => roles.includes(a));
}
