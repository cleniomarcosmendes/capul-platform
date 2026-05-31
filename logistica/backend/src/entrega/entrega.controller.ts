import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { StatusEntrega } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { EntregaService } from './entrega.service.js';
import { CancelarEntregaDto, CreateEntregaDto } from './dto.js';

@Controller('entregas')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
export class EntregaController {
  constructor(private readonly entregas: EntregaService) {}

  @Post()
  criar(@Body() dto: CreateEntregaDto, @CurrentUser('sub') userId: string) {
    return this.entregas.create(dto, userId);
  }

  /** Lista (default PENDENTE = fila de montagem). Filtros: filialId, status. */
  @Get()
  listar(@Query('filialId') filialId?: string, @Query('status') status?: StatusEntrega) {
    return this.entregas.list({ filialId, status });
  }

  @Get(':id')
  obter(@Param('id') id: string) {
    return this.entregas.findOne(id);
  }

  /** Cancelamento local (só PENDENTE). */
  @Post(':id/cancelar')
  cancelar(
    @Param('id') id: string,
    @Body() dto: CancelarEntregaDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.entregas.cancelar(id, dto.motivo, userId);
  }
}
