import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator.js';
import { SupervisorService } from './supervisor.service.js';
import { AtualizarAtividadeDto, AtualizarRegiaoDto, CriarAtividadeDto, CriarRegiaoDto } from './dto.js';

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
}
