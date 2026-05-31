import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { StatusViagem } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ViagemService } from './viagem.service.js';
import { CreateViagemDto, DespacharViagemDto } from './dto.js';

@Controller('viagens')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
export class ViagemController {
  constructor(private readonly viagens: ViagemService) {}

  @Post()
  criar(@Body() dto: CreateViagemDto, @CurrentUser('sub') userId: string) {
    return this.viagens.create(dto, userId);
  }

  @Get()
  listar(
    @Query('filialId') filialId?: string,
    @Query('situacao') situacao?: StatusViagem,
    @Query('veiculoId') veiculoId?: string,
  ) {
    return this.viagens.list({ filialId, situacao, veiculoId });
  }

  @Get(':id')
  obter(@Param('id') id: string) {
    return this.viagens.findOne(id);
  }

  @Post(':id/despachar')
  despachar(@Param('id') id: string, @Body() dto: DespacharViagemDto) {
    return this.viagens.despachar(id, dto);
  }

  @Delete(':id')
  descartar(@Param('id') id: string) {
    return this.viagens.descartar(id);
  }
}
