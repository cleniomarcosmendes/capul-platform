import { JwtPayload } from '../interfaces/jwt-payload.interface.js';

/**
 * Workspace Onda 3 S1 (24/05) — resolve `departamento_lancamento_id` pro
 * INSERT de cadastros operacionais (Software/Licença/Contrato/NF/Ativo/Parada).
 *
 * Semântica: snapshot do depto do user que cadastrou. NÃO é o depto de
 * alocação (esse vem do `<DepartamentoField>` no form ou do
 * resolveDepartamento helper).
 *
 * Cascata:
 *   1. `user.departamentoId` — campo do JWT (cadastro do user em
 *      `core.usuarios.departamento_id`). É a melhor fonte de verdade pra
 *      "quem cadastrou" — o depto onde o user está formalmente alocado.
 *   2. Fallback `departamentoAlocacaoId` — só ocorre em call sites sem
 *      `user` (import/seed). Mantém consistência com o helper de alocação
 *      `resolveDepartamento`.
 *
 * Conscientemente NÃO usa `getDeptoIdsDoUser` (perfis do user no JWT):
 * perfis do Workspace = onde o user OPERA; depto-cadastro = onde está
 * formalmente alocado. Lançamento é metadado de auditoria — interessa o
 * depto formal, não onde estava operando no momento do click.
 */
export function resolveDepartamentoLancamento(
  user: JwtPayload | null | undefined,
  departamentoAlocacaoId: string,
): string {
  return user?.departamentoId ?? departamentoAlocacaoId;
}
