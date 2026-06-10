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

  // Viagens do próprio entregador (app — Fase 1b). DEVE vir antes de @Get(':id')
  // senão o Nest casa "minhas" como :id. Sem situacao → só acionáveis.
  // ENTREGADOR (role do app) é liberado aqui — o @Roles do método sobrepõe o da classe.
  @Get('minhas')
  @Roles('ENTREGADOR', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
  minhas(@CurrentUser() user: JwtPayload, @Query('situacao') situacao?: StatusViagem) {
    return this.viagens.listMinhas(user.sub, situacao);
  }

  // Detalhe da viagem — o app do entregador precisa pra montar a rota/paradas.
  @Get(':id')
  @Roles('ENTREGADOR', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA')
  obter(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.viagens.findOne(id, user);
  }

  @Post(':id/despachar')
  despachar(@Param('id') id: string, @Body() dto: DespacharViagemDto, @CurrentUser() user: JwtPayload) {
    return this.viagens.despachar(id, dto, user.filialId);
  }

  @Post(':id/concluir')
  concluir(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.viagens.concluir(id, user.filialId);
  }

  @Delete(':id/entregas/:entregaId')
  removerEntrega(@Param('id') id: string, @Param('entregaId') entregaId: string, @CurrentUser() user: JwtPayload) {
    return this.viagens.removerEntrega(id, entregaId, user.filialId);
  }

  @Delete(':id')
  descartar(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.viagens.descartar(id, user.filialId);
  }
}
