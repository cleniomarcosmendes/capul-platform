import { BadRequestException } from '@nestjs/common';

/**
 * Data/hora de um evento de viagem (saída/chegada) informada pelo usuário.
 *
 * Existe para o LANÇAMENTO RETROATIVO: quem saiu às pressas sem registrar
 * informa depois a hora de verdade, e o KM rodado deixa de vir acompanhado de
 * uma duração de minutos.
 *
 * Não precisa de flag nem de migration: `viagem.criadoEm` continua sendo o
 * carimbo imutável de QUANDO foi registrado. Retroativo = `dataHoraSaida`
 * anterior a `criadoEm`. As duas verdades ficam separadas no banco.
 *
 * Função PURA (recebe `agora`) — campo de data aberto é porta de erro de
 * digitação e de maquiagem de jornada, então as travas merecem teste próprio.
 */

/** Teto do lançamento retroativo. Erro de ano digitado não passa, e o tardio
 *  segue sendo exceção recente — correção mais antiga é do gestor. */
export const MAX_RETRO_DIAS = 7;
/** Celular com relógio adiantado não é "futuro". */
export const TOLERANCIA_RELOGIO_MS = 10 * 60 * 1000;

export function resolverDataEvento(
  informada: string | undefined,
  rotulo: 'saída' | 'chegada' | 'parada' | 'chegada na parada',
  agora: Date = new Date(),
): Date {
  if (!informada) return agora;

  const d = new Date(informada);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Data/hora de ${rotulo} inválida.`);
  }
  if (d.getTime() > agora.getTime() + TOLERANCIA_RELOGIO_MS) {
    throw new BadRequestException(`A data/hora de ${rotulo} não pode ser no futuro.`);
  }
  if (agora.getTime() - d.getTime() > MAX_RETRO_DIAS * 24 * 60 * 60 * 1000) {
    throw new BadRequestException(
      `A data/hora de ${rotulo} está a mais de ${MAX_RETRO_DIAS} dias. ` +
        'Confira o ano/mês — para corrigir algo mais antigo, peça ao gestor de frota.',
    );
  }
  return d;
}
