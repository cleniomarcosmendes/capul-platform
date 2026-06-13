import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { resolverFilialLeitura } from '../common/filial-scope.js';
import { PainelService } from './painel.service.js';

@Controller('painel')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
export class PainelController {
  constructor(private readonly painel: PainelService) {}

  @Get()
  resumo(@CurrentUser() user: JwtPayload, @Query('filialId') filialId?: string, @Query('dias') dias?: string) {
    return this.painel.resumo(resolverFilialLeitura(user, filialId), dias ? parseInt(dias, 10) : 14);
  }

  // Indicadores analíticos por mês (valor/origem, motorista, demanda, re-entregas).
  @Get('indicadores')
  indicadores(
    @CurrentUser() user: JwtPayload,
    @Query('mes') mes?: string,
    @Query('ano') ano?: string,
    @Query('filialId') filialId?: string,
  ) {
    const agora = new Date();
    const m = mes ? parseInt(mes, 10) : agora.getUTCMonth() + 1;
    const a = ano ? parseInt(ano, 10) : agora.getUTCFullYear();
    return this.painel.indicadoresMes(resolverFilialLeitura(user, filialId), m, a);
  }
}
