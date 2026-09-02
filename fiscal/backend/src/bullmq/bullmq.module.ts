import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QueueMonitorService } from './queue-monitor.service.js';
import {
  REDIS_CONNECTION,
  QUEUE_CRUZAMENTO,
  QUEUE_SCHEDULER,
  QUEUE_ALERTAS,
} from './bullmq.tokens.js';

// Re-exporta tokens para retrocompatibilidade com módulos que ainda
// importam daqui (refactor 11/05/2026 — circular import com QueueMonitor).
export { REDIS_CONNECTION, QUEUE_CRUZAMENTO, QUEUE_SCHEDULER, QUEUE_ALERTAS };

/**
 * Módulo BullMQ — centraliza a conexão Redis compartilhada entre todas as filas
 * do Módulo Fiscal. Onda 2 usará este módulo para:
 *
 *   - Fila `cruzamento-ccc` — 1 job por CNPJ a consultar no CCC.
 *   - Fila `cruzamento-scheduler` — repeatable jobs (semanal-auto, diaria-auto).
 *   - Fila `alertas-email` — 1 job por digest consolidado.
 *
 * Na Onda 1 o módulo apenas estabelece a conexão e expõe o `IORedis` e as
 * filas base. Nenhuma job executa ainda.
 *
 * @Global porque múltiplos módulos (cruzamento, alertas) injetam a mesma
 * conexão para evitar múltiplas conexões Redis.
 */

/**
 * Defaults seguros para jobs em qualquer fila (auditoria 10/05/2026 #M4).
 *
 * Sem defaults, BullMQ aplica `attempts: 1` e nenhum backoff — uma falha
 * pontual de rede mata o job sem retry. Aplicado em todas as filas para
 * garantir que `.add()` futuros (Onda 2) herdem o comportamento defensivo
 * sem precisar lembrar de passar opts em cada chamada.
 *
 * Per-job options sobrescrevem estes defaults (ex: ExecucaoService já passa
 * a mesma config explicitamente — sem prejuízo, double coverage).
 */
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 500,
};

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL') ?? 'redis://redis:6379';
        return new IORedis(url, {
          maxRetriesPerRequest: null, // requisito do BullMQ
          enableReadyCheck: false,
        });
      },
    },
    {
      provide: QUEUE_CRUZAMENTO,
      inject: [REDIS_CONNECTION],
      useFactory: (connection: IORedis) =>
        new Queue('fiscal-cruzamento', { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    },
    {
      provide: QUEUE_SCHEDULER,
      inject: [REDIS_CONNECTION],
      useFactory: (connection: IORedis) =>
        new Queue('fiscal-scheduler', { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    },
    {
      provide: QUEUE_ALERTAS,
      inject: [REDIS_CONNECTION],
      useFactory: (connection: IORedis) =>
        new Queue('fiscal-alertas', { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    },
    QueueMonitorService,
  ],
  exports: [REDIS_CONNECTION, QUEUE_CRUZAMENTO, QUEUE_SCHEDULER, QUEUE_ALERTAS],
})
export class BullMqModule {}
