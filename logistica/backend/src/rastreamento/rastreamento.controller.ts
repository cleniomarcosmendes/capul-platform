import { Body, Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { RastreamentoService } from './rastreamento.service.js';
import { RegistrarPosicaoDto } from './dto.js';

@Controller('rastreamento')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA')
export class RastreamentoController {
  constructor(private readonly rastreamento: RastreamentoService) {}

  /** App envia um ping de GPS da viagem em curso (foreground). */
  @Post('posicao')
  registrar(@Body() dto: RegistrarPosicaoDto, @CurrentUser() user: JwtPayload) {
    return this.rastreamento.registrar(dto, user);
  }

  /** Mapa ao vivo: últimas posições das viagens em curso da filial (só gestores). */
  @Get('ativos')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  ativos(@CurrentUser() user: JwtPayload) {
    return this.rastreamento.ativos(user.filialId!);
  }
}
