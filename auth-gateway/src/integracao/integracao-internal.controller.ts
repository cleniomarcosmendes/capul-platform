import { Controller, Get, Param, Query, BadRequestException } from '@nestjs/common';
import { ModuloConsumidor } from '@prisma/client';
import { IntegracaoService } from './integracao.service';
import { Public } from '../common/decorators/public.decorator';

// Rota interna (Nginx bloqueia /api/v1/internal/ externamente — ver nginx.conf:115).
// Marcada como @Public() pois é consumida por outros backends via rede Docker
// e o JwtAuthGuard global requer marcação explícita.
@Public()
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
