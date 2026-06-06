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
}
