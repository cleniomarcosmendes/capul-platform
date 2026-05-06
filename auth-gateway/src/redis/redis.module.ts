import { Global, Module, OnApplicationShutdown, Logger } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Modulo Redis global. Compartilha um unico cliente ioredis entre todos os
 * services (heartbeat de presenca, avisos da plataforma, etc.).
 *
 * Conecta usando REDIS_URL do env (compose ja injeta). Em caso de falha,
 * loga e nao quebra o boot — features dependentes degradam graciosamente.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const logger = new Logger('RedisClient');
        const url = process.env.REDIS_URL;
        if (!url) {
          logger.warn('REDIS_URL nao configurado — heartbeat/online ficam desabilitados.');
          return null;
        }
        const client = new Redis(url, {
          // Reconecta automatico em caso de queda
          retryStrategy: (times) => Math.min(times * 100, 2000),
          maxRetriesPerRequest: 3,
          lazyConnect: false,
        });
        client.on('connect', () => logger.log('Conectado ao Redis.'));
        client.on('error', (err) => logger.warn(`Redis error: ${err.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  async onApplicationShutdown() {
    // ioredis fecha sozinho no exit — placeholder pra futuras limpezas
  }
}
