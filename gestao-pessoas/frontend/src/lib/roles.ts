/**
 * Papéis do módulo, lidos do JWT.
 *
 * ⚠️ `modulos[].role` é DENORMALIZADO (a role do 1º departamento) e mente quando
 * a pessoa tem papéis diferentes em departamentos diferentes. O backend lê
 * `departamentos[].role` (`common/roles-rh.ts`); a tela precisa ler igual, senão
 * o menu esconde uma opção que a API autorizaria — e o sintoma é MUDO: ninguém
 * recebe erro, o item simplesmente não existe. Foi assim que `REGISTRADOR_FROTA`
 * ficou com "só Início" na Logística.
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

/** Espelha `rolesRh` do backend — TODOS os papéis, não o denormalizado. */
export function rolesDoModulo(usuario: UsuarioDoToken | null): string[] {
  const mod = usuario?.modulos?.find((m) => m.codigo === MODULO);
  if (!mod) return [];
  const deDeptos = (mod.departamentos ?? []).map((d) => d.role).filter(Boolean) as string[];
  if (deDeptos.length === 0) return mod.role ? [mod.role] : [];
  return [...new Set(deDeptos)];
}
