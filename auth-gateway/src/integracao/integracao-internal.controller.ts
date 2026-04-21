import { Controller, Get, Param, Query, BadRequestException } from '@nestjs/common';
import { ModuloConsumidor } from '@prisma/client';
import { IntegracaoService } from './integracao.service';

@Controller('api/v1/internal/integracoes')
export class IntegracaoInternalController {
  constructor(private readonly integracaoService: IntegracaoService) {}

  @Get('codigo/:codigo/endpoints-ativos')
  getEndpointsAtivos(
    @Param('codigo') codigo: string,
    @Query('modulo') modulo?: string,
  ) {
    let moduloEnum: ModuloConsumidor | undefined;
    if (modulo !== undefined && modulo !== '') {
      if (!Object.values(ModuloConsumidor).includes(modulo as ModuloConsumidor)) {
        throw new BadRequestException(
          `modulo invalido "${modulo}". Valores aceitos: ${Object.values(ModuloConsumidor).join(', ')}`,
        );
      }
      moduloEnum = modulo as ModuloConsumidor;
    }
    return this.integracaoService.getEndpointsAtivos(codigo, moduloEnum);
  }
}
