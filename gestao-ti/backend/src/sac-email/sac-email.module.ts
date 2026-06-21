import { Module } from '@nestjs/common';
import { SacEmailController } from './sac-email.controller.js';
import { SacEmailService } from './sac-email.service.js';

/**
 * SAC Fase 3 — módulo do e-mail de ENTRADA. PrismaModule é @Global (não importa).
 * Na 3a só config + teste de conexão; o poller/ingestão entra nas 3b-3d.
 */
@Module({
  controllers: [SacEmailController],
  providers: [SacEmailService],
  exports: [SacEmailService],
})
export class SacEmailModule {}
