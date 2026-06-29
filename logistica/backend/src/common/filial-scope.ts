import { ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from './decorators/current-user.decorator.js';

/**
 * Escopo por filial (decisão do projeto: entregas/veículos/viagens/indicadores
 * são por filial). O JWT carrega UMA `filialId` (a filial ativa do usuário).
 *
 * Regra:
 *  - ESCRITA (criar/mutar): sempre na própria filial do token — bloqueia
 *    filialId divergente vindo do cliente.
 *  - LEITURA (listar/painel): própria filial; GESTOR_ENTREGA/ADMIN podem ver
 *    qualquer filial (ou todas, quando o filtro vem vazio).
 */

export function filialDoUsuario(user: JwtPayload): string {
  if (!user?.filialId) throw new ForbiddenException('Usuário sem filial no token — selecione uma filial no Hub.');
  return user.filialId;
}

export function podeVerOutrasFiliais(user: JwtPayload): boolean {
  const role = user?.modulos?.find((m) => m.codigo === 'LOGISTICA')?.role;
  // GESTOR_FROTA administra a frota da empresa toda (cadastra/edita veículos de
  // qualquer filial) — só alcança o veículo; entrega/viagem barram esse papel no guard.
  return role === 'ADMIN' || role === 'GESTOR_ENTREGA' || role === 'GESTOR_FROTA';
}

/** Escrita: a filial-alvo informada precisa ser a do usuário. */
export function assertMesmaFilial(user: JwtPayload, filialId: string | null | undefined): void {
  if (filialId && filialId !== user?.filialId) {
    throw new ForbiddenException('Operação fora da sua filial.');
  }
}

/** Escrita por id: o registro precisa ser da filial do usuário. */
export function assertRegistroDaFilial(user: JwtPayload, registroFilialId: string): void {
  if (registroFilialId !== user?.filialId) {
    throw new ForbiddenException('Registro de outra filial — operação não permitida.');
  }
}

/**
 * Leitura por id (findOne): barra registro de outra filial — exceto perfis que
 * podem ver todas (ADMIN/GESTOR_ENTREGA). Espelha o escopo da listagem no
 * "obter por id".
 */
export function assertPodeVerRegistro(user: JwtPayload, registroFilialId: string): void {
  if (podeVerOutrasFiliais(user)) return;
  if (registroFilialId !== user?.filialId) {
    throw new ForbiddenException('Registro de outra filial — acesso não permitido.');
  }
}

/** Leitura: resolve o filtro de filial conforme o perfil. */
export function resolverFilialLeitura(user: JwtPayload, filialIdParam?: string): string | undefined {
  if (podeVerOutrasFiliais(user)) return filialIdParam || undefined;
  return filialDoUsuario(user);
}
