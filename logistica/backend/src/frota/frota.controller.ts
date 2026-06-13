import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { StatusViagem } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { FrotaService } from './frota.service.js';
import { BuscarCondutorDto, SaidaFrotaDto, RetornoFrotaDto, AjusteGestorDto } from './dto.js';

const roleLogistica = (user: JwtPayload) => user.modulos?.find((m) => m.codigo === 'LOGISTICA')?.role;

@Controller('frota')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA')
export class FrotaController {
  constructor(private readonly frota: FrotaService) {}

  /** Passo 1 da saída: nome do condutor pela matrícula (antes da senha). */
  @Post('condutor')
  buscarCondutor(@Body() dto: BuscarCondutorDto) {
    return this.frota.buscarCondutor(dto.matricula);
  }

  /** Registrar saída de veículo (condutor valida matrícula+senha). */
  @Post('viagens')
  saida(@Body() dto: SaidaFrotaDto, @CurrentUser() user: JwtPayload) {
    return this.frota.registrarSaida(dto, user);
  }

  /** Lista viagens de frota da filial (filtro de situação opcional). */
  @Get('viagens')
  listar(@CurrentUser() user: JwtPayload, @Query('situacao') situacao?: StatusViagem) {
    return this.frota.listar(user.filialId!, situacao);
  }

  /** Registrar retorno (só o próprio condutor). */
  @Post('viagens/:id/retorno')
  retorno(@Param('id') id: string, @Body() dto: RetornoFrotaDto, @CurrentUser() user: JwtPayload) {
    return this.frota.registrarRetorno(id, dto, user);
  }

  /** Ajuste/fechamento por gestor de frota ou supervisor do veículo. */
  @Patch('viagens/:id')
  ajustar(@Param('id') id: string, @Body() dto: AjusteGestorDto, @CurrentUser() user: JwtPayload) {
    return this.frota.ajustarPorGestor(id, dto, user, roleLogistica(user));
  }
}
