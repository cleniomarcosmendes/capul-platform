import { Module } from '@nestjs/common';
import { SacEmailController } from './sac-email.controller.js';
import { SacEmailService } from './sac-email.service.js';
import { NotificacaoModule } from '../notificacao/notificacao.module.js';

/**
 * SAC Fase 3 — módulo do e-mail de ENTRADA. PrismaModule é @Global (não importa).
 * 3c usa o NotificacaoService p/ avisar o técnico quando o cliente responde.
 */
@Module({
  imports: [NotificacaoModule],
  controllers: [SacEmailController],
  providers: [SacEmailService],
  exports: [SacEmailService],
})
export class SacEmailModule {}
