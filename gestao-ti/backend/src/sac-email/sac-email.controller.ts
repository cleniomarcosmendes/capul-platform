import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { SacEmailService } from './sac-email.service.js';
import { UpdateSacEmailConfigDto } from './dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';

/**
 * SAC Fase 3 (3a) — config OPERACIONAL do poller IMAP de entrada. Admin/Gestor.
 * Sem ingestão ainda — só ler/editar a config e testar a conexão.
 */
@Controller('sac-email')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
@Roles('ADMIN', 'GESTOR')
export class SacEmailController {
  constructor(private readonly service: SacEmailService) {}

  @Get('config')
  getConfig() {
    return this.service.getConfig();
  }

  @Put('config')
  updateConfig(@Body() dto: UpdateSacEmailConfigDto, @CurrentUser() user: JwtPayload) {
    return this.service.updateConfig(dto, user.sub);
  }

  @Post('test-connection')
  testConnection() {
    return this.service.testConnection();
  }

  // SAC 3b/4a — TRABALHO do dia a dia (busca + triagem): libera SUPORTE também
  // (a tela "SAC — Triagem" é dos atendentes; a Configuração fica em admin/gestor).
  @Post('buscar-agora')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  buscarAgora() {
    return this.service.buscarAgora();
  }

  @Get('ingestoes')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  listarIngestoes() {
    return this.service.listarIngestoes();
  }

  @Get('triagem')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  listarTriagem() {
    return this.service.listarTriagem();
  }

  @Post('triagem/:id/vincular')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  vincularTriagem(@Param('id') id: string, @Body('numero') numero: number, @CurrentUser() user: JwtPayload) {
    return this.service.vincularTriagem(id, Number(numero), user.sub);
  }

  @Post('triagem/:id/descartar')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  descartarTriagem(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.descartarTriagem(id, user.sub);
  }

  @Get('equipes-sac')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  listarEquipesSac() {
    return this.service.listarEquipesSac();
  }

  @Post('triagem/:id/abrir')
  @Roles('ADMIN', 'GESTOR', 'SUPORTE')
  abrirTriagem(@Param('id') id: string, @Body('equipeId') equipeId: string, @CurrentUser() user: JwtPayload) {
    return this.service.abrirTriagem(id, equipeId, user.sub, user.filialId);
  }
}
