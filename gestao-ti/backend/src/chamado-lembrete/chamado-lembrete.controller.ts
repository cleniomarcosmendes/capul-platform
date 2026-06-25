import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { ChamadoLembreteService } from './chamado-lembrete.service.js';

class UpdateLembreteConfigDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(365) diasInatividadeEquipe?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) diasInatividadeSolicitante?: number;
  @IsOptional() @IsInt() @Min(1) @Max(365) diasEscala?: number;
  @IsOptional() @IsInt() @Min(1) @Max(90) intervaloReenvioDias?: number;
  @IsOptional() @IsInt() @Min(1) @Max(20) maxLembretes?: number;
  @IsOptional() @IsBoolean() autoFechar?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(365) diasAutoFechamento?: number;
  @IsOptional() @IsInt() @Min(0) @Max(23) horaExecucao?: number;
}

/**
 * Config + acionamento da gestão de chamados parados (lembretes/escalonamento/
 * auto-fechamento). Admin/Gestor. "executar-agora?dryRun=true" pré-visualiza o
 * que SERIA notificado/fechado sem enviar nada.
 */
@Controller('chamado-lembrete')
@UseGuards(JwtAuthGuard, GestaoTiGuard, RolesGuard)
@Roles('ADMIN', 'GESTOR')
export class ChamadoLembreteController {
  constructor(private readonly service: ChamadoLembreteService) {}

  @Get('config')
  config() {
    return this.service.getConfigRow();
  }

  @Put('config')
  async atualizar(@Body() dto: UpdateLembreteConfigDto, @CurrentUser() user: JwtPayload) {
    return this.service.atualizarConfig(dto, user.sub);
  }

  @Post('executar-agora')
  executar(@Query('dryRun') dryRun?: string) {
    return this.service.executarVarredura({ dryRun: dryRun === 'true' });
  }
}
