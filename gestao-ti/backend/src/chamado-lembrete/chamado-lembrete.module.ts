import { Module } from '@nestjs/common';
import { EmailEnvolvidosModule } from '../email/email-envolvidos.module.js';
import { ChamadoLembreteService } from './chamado-lembrete.service.js';
import { ChamadoLembreteController } from './chamado-lembrete.controller.js';

/** Gestão de chamados parados: lembretes, escalonamento e auto-fechamento. */
@Module({
  imports: [EmailEnvolvidosModule],
  controllers: [ChamadoLembreteController],
  providers: [ChamadoLembreteService],
})
export class ChamadoLembreteModule {}
