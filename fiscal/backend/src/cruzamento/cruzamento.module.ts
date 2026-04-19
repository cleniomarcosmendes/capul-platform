import { Module, forwardRef } from '@nestjs/common';
import { SefazModule } from '../sefaz/sefaz.module.js';
import { AmbienteModule } from '../ambiente/ambiente.module.js';
import { AlertasModule } from '../alertas/alertas.module.js';
import { CadastroModule } from '../cadastro/cadastro.module.js';
import { CircuitBreakerService } from './circuit-breaker.service.js';
import { ExecucaoService } from './execucao.service.js';
import { CruzamentoWorker } from './cruzamento.worker.js';
import { SchedulerService } from './scheduler.service.js';
import { WatchdogService } from './watchdog.service.js';
import { ExpurgoService } from './expurgo.service.js';
import { CruzamentoController } from './cruzamento.controller.js';

/**
 * CruzamentoModule — Onda 2 completa.
 *
 * Componentes:
 *   - CircuitBreakerService — disjuntor por UF (persistido)
 *   - ExecucaoService       — orquestrador: lê SA1/SA2 e enfileira jobs
 *   - CruzamentoWorker      — BullMQ worker que consome fiscal:cruzamento
 *   - SchedulerService      — repeatable jobs (semanal + diário via node-cron)
 *   - WatchdogService       — cron horário que monitora atrasos
 *   - ExpurgoService        — cron noturno de retenção LGPD
 *
 * Importa:
 *   - SefazModule    → CccClient (consulta cadastral)
 *   - AmbienteModule → freio de mão + gate bootstrap
 *   - AlertasModule  → digest consolidado via nodemailer
 *   - BullMqModule   → @Global, conexão Redis + filas
 */
@Module({
  imports: [SefazModule, AmbienteModule, AlertasModule, forwardRef(() => CadastroModule)],
  controllers: [CruzamentoController],
  providers: [
    CircuitBreakerService,
    ExecucaoService,
    CruzamentoWorker,
    SchedulerService,
    WatchdogService,
    ExpurgoService,
  ],
  exports: [CircuitBreakerService, ExecucaoService, SchedulerService],
})
export class CruzamentoModule {}
