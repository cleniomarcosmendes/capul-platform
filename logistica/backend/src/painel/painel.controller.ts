import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PainelService } from './painel.service.js';

@Controller('painel')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
export class PainelController {
  constructor(private readonly painel: PainelService) {}

  @Get()
  resumo(@Query('filialId') filialId?: string, @Query('dias') dias?: string) {
    return this.painel.resumo(filialId || undefined, dias ? parseInt(dias, 10) : 14);
  }
}
