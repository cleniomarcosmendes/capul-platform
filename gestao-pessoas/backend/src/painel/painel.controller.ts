import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ROLES } from '../common/roles-rh.js';
import { ApuracaoService } from '../apuracao/apuracao.service.js';
import { PainelService } from './painel.service.js';

/**
 * Acompanhamento do ciclo. RH_CICLO entra: quem designa é quem cobra a fila.
 * A conferência de pendências cadastrais também — ela não grava nada, e saber
 * que faltam faixas antes de pedir a apuração poupa uma ida à gestora.
 */
@Controller('painel')
@Roles(ROLES.RH_ADMIN, ROLES.RH_CICLO)
export class PainelController {
  constructor(
    private readonly painel: PainelService,
    private readonly apuracao: ApuracaoService,
  ) {}

  @Get('ciclo/:cicloId') doCiclo(@Param('cicloId') cicloId: string) {
    return this.painel.doCiclo(cicloId);
  }

  /** A linha de estado do cabeçalho — barato de propósito, roda em toda aba. */
  /** O que a abertura vai fazer — lido ANTES do aviso de irreversibilidade. */
  @Get('ciclo/:cicloId/previa-da-abertura')
  previaDaAbertura(@Param('cicloId') cicloId: string) {
    return this.painel.previaDaAbertura(cicloId);
  }

  @Get('ciclo/:cicloId/resumo') resumo(@Param('cicloId') cicloId: string) {
    return this.painel.resumoDoCiclo(cicloId);
  }

  /** Mesma conta da apuração, sem gravar — ver `ApuracaoService.conferir`. */
  @Get('ciclo/:cicloId/pendencias') pendencias(@Param('cicloId') cicloId: string) {
    return this.apuracao.conferir({ tipo: 'CICLO', cicloId });
  }
}
