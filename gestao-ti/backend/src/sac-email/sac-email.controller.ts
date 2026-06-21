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

  // SAC 3b — busca + classifica as não-lidas (sem criar histórico ainda).
  @Post('buscar-agora')
  buscarAgora() {
    return this.service.buscarAgora();
  }

  // SAC 3b — log das últimas ingestões (matched/unmatched/skipped/dup).
  @Get('ingestoes')
  listarIngestoes() {
    return this.service.listarIngestoes();
  }

  // SAC 4a — Caixa de Triagem (e-mails UNMATCHED pendentes).
  @Get('triagem')
  listarTriagem() {
    return this.service.listarTriagem();
  }

  @Post('triagem/:id/vincular')
  vincularTriagem(@Param('id') id: string, @Body('numero') numero: number, @CurrentUser() user: JwtPayload) {
    return this.service.vincularTriagem(id, Number(numero), user.sub);
  }

  @Post('triagem/:id/descartar')
  descartarTriagem(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.descartarTriagem(id, user.sub);
  }

  // SAC 4a.2 — equipes de SAC (opções) + abrir novo chamado a partir do e-mail.
  @Get('equipes-sac')
  listarEquipesSac() {
    return this.service.listarEquipesSac();
  }

  @Post('triagem/:id/abrir')
  abrirTriagem(@Param('id') id: string, @Body('equipeId') equipeId: string, @CurrentUser() user: JwtPayload) {
    return this.service.abrirTriagem(id, equipeId, user.sub, user.filialId);
  }
}
