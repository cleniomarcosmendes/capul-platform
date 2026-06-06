import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { StatusViagem } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { assertMesmaFilial, resolverFilialLeitura } from '../common/filial-scope.js';
import { ViagemService } from './viagem.service.js';
import { CreateViagemDto, DespacharViagemDto } from './dto.js';

@Controller('viagens')
@Roles('OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
export class ViagemController {
  constructor(private readonly viagens: ViagemService) {}

  @Post()
  criar(@Body() dto: CreateViagemDto, @CurrentUser() user: JwtPayload) {
    assertMesmaFilial(user, dto.filialId);
    return this.viagens.create(dto, user.sub);
  }

  @Get()
  listar(
    @CurrentUser() user: JwtPayload,
    @Query('filialId') filialId?: string,
    @Query('situacao') situacao?: StatusViagem,
    @Query('veiculoId') veiculoId?: string,
  ) {
    return this.viagens.list({ filialId: resolverFilialLeitura(user, filialId), situacao, veiculoId });
  }

  @Get(':id')
  obter(@Param('id') id: string) {
    return this.viagens.findOne(id);
  }

  @Post(':id/despachar')
  despachar(@Param('id') id: string, @Body() dto: DespacharViagemDto, @CurrentUser() user: JwtPayload) {
    return this.viagens.despachar(id, dto, user.filialId);
  }

  @Post(':id/concluir')
  concluir(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.viagens.concluir(id, user.filialId);
  }

  @Delete(':id')
  descartar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.viagens.descartar(id, user.filialId);
  }
}
