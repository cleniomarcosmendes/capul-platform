import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { IdempotencyInterceptor } from './idempotency.interceptor.js';
import { IdempotencyService } from './idempotency.service.js';

/**
 * Idempotency-Key middleware — auditoria 10/05/2026 #M3.
 *
 * Registrado globalmente: qualquer endpoint POST/PUT/PATCH/DELETE responde a
 * header `Idempotency-Key` enviado pelo cliente. Sem header, comportamento
 * inalterado.
 *
 * Service exposto também para uso direto se necessário (ex: cleanup
 * manual via endpoint admin).
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    IdempotencyService,
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
