import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { StatusEntrega } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { assertMesmaFilial, resolverFilialLeitura } from '../common/filial-scope.js';
import { EntregaService } from './entrega.service.js';
import { CancelarEntregaDto, CreateEntregaDto } from './dto.js';

@Controller('entregas')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
export class EntregaController {
  constructor(private readonly entregas: EntregaService) {}

  @Post()
  criar(@Body() dto: CreateEntregaDto, @CurrentUser() user: JwtPayload) {
    assertMesmaFilial(user, dto.filialId);
    return this.entregas.create(dto, user.sub);
  }

  /** Lista (default PENDENTE = fila de montagem). Filtros: filialId, status. */
  @Get()
  listar(@CurrentUser() user: JwtPayload, @Query('filialId') filialId?: string, @Query('status') status?: StatusEntrega) {
    return this.entregas.list({ filialId: resolverFilialLeitura(user, filialId), status });
  }

  @Get(':id')
  obter(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.entregas.findOne(id, user);
  }

  /** Cancelamento local (só PENDENTE). */
  @Post(':id/cancelar')
  cancelar(
    @Param('id') id: string,
    @Body() dto: CancelarEntregaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.entregas.cancelar(id, dto.motivo, user.sub, user.filialId);
  }
}
