import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

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

export const REDIS_CONNECTION = Symbol('REDIS_CONNECTION');
export const QUEUE_CRUZAMENTO = Symbol('QUEUE_CRUZAMENTO');
export const QUEUE_SCHEDULER = Symbol('QUEUE_SCHEDULER');
export const QUEUE_ALERTAS = Symbol('QUEUE_ALERTAS');

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
      useFactory: (connection: IORedis) => new Queue('fiscal-cruzamento', { connection }),
    },
    {
      provide: QUEUE_SCHEDULER,
      inject: [REDIS_CONNECTION],
      useFactory: (connection: IORedis) =>
        new Queue('fiscal-scheduler', { connection }),
    },
    {
      provide: QUEUE_ALERTAS,
      inject: [REDIS_CONNECTION],
      useFactory: (connection: IORedis) => new Queue('fiscal-alertas', { connection }),
    },
  ],
  exports: [REDIS_CONNECTION, QUEUE_CRUZAMENTO, QUEUE_SCHEDULER, QUEUE_ALERTAS],
})
export class BullMqModule {}
