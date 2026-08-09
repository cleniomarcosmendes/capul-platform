import { ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from './decorators/current-user.decorator.js';
import { temRoleLogistica } from './roles-logistica.js';

/**
 * Quem pode OPERAR uma viagem de frota (lançar despesa, paradas): autorizado pela
 * identidade do usuário LOGADO —
 *  (a) quem registrou a saída (viagem.criadoPorId),
 *  (b) supervisor do veículo (veiculo.supervisorId),
 *  (c) Gestão da Frota (GESTOR_FROTA) / ADMIN.
 * Retorno é à parte (matrícula+senha do condutor que iniciou).
 */
export function assertPodeOperarViagem(
  user: JwtPayload,
  viagem: { criadoPorId: string; veiculo?: { supervisorId: string | null } | null },
): void {
  if (temRoleLogistica(user, 'GESTOR_FROTA', 'ADMIN')) return;
  if (viagem.criadoPorId === user.sub) return;
  if (viagem.veiculo?.supervisorId && viagem.veiculo.supervisorId === user.sub) return;
  throw new ForbiddenException(
    'Apenas quem registrou a saída, o supervisor do veículo ou a gestão da frota pode operar esta viagem.',
  );
}
