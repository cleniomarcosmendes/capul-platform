import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogRetentionService } from './audit-log-retention.service';

class UpdateRetentionDto {
  @IsInt()
  @Min(0)
  @Max(3650) // 10 anos
  retentionDias!: number;
}

/**
 * Visibilidade no Configurador — auditoria observabilidade 26/04/2026 #9.
 * Atende a regra "funcionalidade oculta vira tela no Configurador".
 *
 * GET  /api/v1/core/audit-log-retention/status — config + estatistica
 * PATCH /api/v1/core/audit-log-retention/config — atualiza retencao
 */
@Controller('api/v1/core/audit-log-retention')
export class AuditLogRetentionController {
  constructor(
    private readonly service: AuditLogRetentionService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('status')
  async status() {
    return this.service.getStatus();
  }

  @Patch('config')
  async update(@Body() dto: UpdateRetentionDto) {
    await this.prisma.systemConfig.upsert({
      where: { key: 'audit_log_retention_dias' },
      create: {
        key: 'audit_log_retention_dias',
        value: String(dto.retentionDias),
        categoria: 'observabilidade',
        descricao: 'Dias de retencao em core.system_logs (cleanup mensal)',
      },
      update: { value: String(dto.retentionDias) },
    });
    return this.service.getStatus();
  }

  @Post('run-now')
  @HttpCode(202)
  async runNow() {
    // Dispara o cleanup imediatamente (admin pra testar/forcar antes do cron mensal)
    void this.service.run();
    return { ok: true, message: 'Cleanup disparado em background' };
  }
}
