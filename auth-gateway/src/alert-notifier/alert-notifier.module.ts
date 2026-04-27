import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DrConfigService } from '../backup-execucao/dr-config.service';
import { AlertNotifierService } from './alert-notifier.service';
import { AlertNotifierInternalController } from './alert-notifier.controller';

/**
 * Auditoria observabilidade 26/04/2026 #10 — service centralizado de alertas.
 * Reaproveita config (webhook + email) do BackupExecucao via DrConfigService.
 * Exporta o service pra ser injetado em outros modulos do auth-gateway.
 */
@Module({
  imports: [PrismaModule],
  controllers: [AlertNotifierInternalController],
  providers: [AlertNotifierService, DrConfigService],
  exports: [AlertNotifierService],
})
export class AlertNotifierModule {}
