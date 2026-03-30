import { Controller, Get, Param } from '@nestjs/common';
import { IntegracaoService } from './integracao.service';

@Controller('api/v1/internal/integracoes')
export class IntegracaoInternalController {
  constructor(private readonly integracaoService: IntegracaoService) {}

  @Get('codigo/:codigo/endpoints-ativos')
  getEndpointsAtivos(@Param('codigo') codigo: string) {
    return this.integracaoService.getEndpointsAtivos(codigo);
  }
}
