/**
 * Workspace Multi-Departamento — helper para checar se um código de módulo
 * é o "Workspace" (antigo GESTAO_TI).
 *
 * O rename foi feito em Onda 1 Lote 1.7: o módulo no DB virou WORKSPACE,
 * mas mantemos compat com o código antigo GESTAO_TI nos checks de
 * permissão pra não quebrar sessões/tokens antigos.
 */
export function isWorkspaceModulo(codigo: string | null | undefined): boolean {
  return codigo === 'WORKSPACE' || codigo === 'GESTAO_TI';
}
