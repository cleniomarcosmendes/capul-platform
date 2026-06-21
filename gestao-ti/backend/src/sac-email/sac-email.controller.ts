import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
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
}
