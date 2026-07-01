import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { SupervisorService } from './supervisor.service.js';
import { AdicionarVisitaDto, AtualizarAtividadeDto, AtualizarRegiaoDto, CriarAtividadeDto, CriarRegiaoDto, CriarViagemSupervisorDto } from './dto.js';

// Leitura liberada aos operadores (escolhem atividade/região ao lançar a visita);
// escrita (cadastro dos catálogos) é do gestor. @Roles do método sobrepõe o da classe.
@Controller('supervisor')
@Roles('GESTOR_ENTREGA', 'GESTOR_FROTA', 'OPERADOR_ENTREGA', 'REGISTRADOR_FROTA')
export class SupervisorController {
  constructor(private readonly svc: SupervisorService) {}

  // ---- Atividades ----
  @Get('atividades')
  atividades(@CurrentUser() user: JwtPayload, @Query('ativos') ativos?: string) {
    return this.svc.listarAtividades(user, ativos === 'true');
  }
  @Post('atividades')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  criarAtividade(@Body() dto: CriarAtividadeDto, @CurrentUser() user: JwtPayload) {
    return this.svc.criarAtividade(dto, user);
  }
  @Patch('atividades/:id')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  atualizarAtividade(@Param('id') id: string, @Body() dto: AtualizarAtividadeDto, @CurrentUser() user: JwtPayload) {
    return this.svc.atualizarAtividade(id, dto, user);
  }

  // ---- Regiões ----
  @Get('regioes')
  regioes(@CurrentUser() user: JwtPayload, @Query('ativos') ativos?: string) {
    return this.svc.listarRegioes(user, ativos === 'true');
  }
  @Post('regioes')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  criarRegiao(@Body() dto: CriarRegiaoDto, @CurrentUser() user: JwtPayload) {
    return this.svc.criarRegiao(dto, user);
  }
  @Patch('regioes/:id')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  atualizarRegiao(@Param('id') id: string, @Body() dto: AtualizarRegiaoDto, @CurrentUser() user: JwtPayload) {
    return this.svc.atualizarRegiao(id, dto, user);
  }

  // ---- Viagem mensal do supervisor ----
  @Get('viagens')
  viagens(@CurrentUser() user: JwtPayload, @Query('mes') mes?: string, @Query('situacao') situacao?: string) {
    return this.svc.listarViagensSupervisor(user, mes ? Number(mes) : undefined, situacao);
  }
  @Get('viagens/:id')
  viagem(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.obterViagemSupervisor(id, user);
  }
  @Post('viagens')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  criarViagem(@Body() dto: CriarViagemSupervisorDto, @CurrentUser() user: JwtPayload) {
    return this.svc.criarViagemSupervisor(dto, user);
  }
  @Patch('viagens/:id/concluir')
  @Roles('GESTOR_ENTREGA', 'GESTOR_FROTA')
  concluirViagem(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.concluirViagemSupervisor(id, user);
  }

  // ---- Visitas da viagem (lançamento pelo operador/gestor) ----
  @Post('viagens/:id/visitas')
  adicionarVisita(@Param('id') id: string, @Body() dto: AdicionarVisitaDto, @CurrentUser() user: JwtPayload) {
    return this.svc.adicionarVisita(id, dto, user);
  }
  @Delete('viagens/:id/visitas/:paradaId')
  removerVisita(@Param('id') id: string, @Param('paradaId') paradaId: string, @CurrentUser() user: JwtPayload) {
    return this.svc.removerVisita(id, paradaId, user);
  }
}
