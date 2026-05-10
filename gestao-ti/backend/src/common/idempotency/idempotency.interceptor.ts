import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, from, of, switchMap, tap } from 'rxjs';
import { IdempotencyService } from './idempotency.service.js';

/**
 * Interceptor global que aplica Idempotency-Key opt-in pelo cliente.
 *
 * Como funciona:
 *   - Se request NÃO tem header `Idempotency-Key` → flui normal (passthrough)
 *   - Se tem e usuário não autenticado → flui normal (não cachea sem userId)
 *   - Se tem e está autenticado:
 *       - Lookup por (usuarioId, key)
 *       - Cache hit: retorna response cacheada SEM executar handler
 *       - Cache miss: executa handler e armazena resposta no `tap` (depois do success)
 *
 * Apenas métodos POST/PUT/PATCH/DELETE são considerados (idempotency em GET é
 * desnecessário — GET é naturalmente idempotente).
 *
 * Origem: auditoria 10/05/2026 #M3 (Robustez).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  // Limite máximo do header — chaves muito longas indicam mau uso
  private readonly MAX_KEY_LENGTH = 128;

  constructor(private readonly service: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const method = req.method;

    // GET/HEAD/OPTIONS: passthrough
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const rawKey = req.headers['idempotency-key'];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    if (!key || typeof key !== 'string') {
      return next.handle();
    }
    if (key.length > this.MAX_KEY_LENGTH) {
      return next.handle(); // ignora chave inválida; deixa request executar
    }

    const userId = req.user?.id;
    if (!userId) {
      // Sem auth, não há como isolar entre usuários — passthrough.
      return next.handle();
    }

    const path = req.path;

    return from(this.service.lookup(userId, key, method, path)).pipe(
      switchMap((cached) => {
        if (cached) {
          // Cache hit — devolve direto. Sinaliza no header para debug client-side.
          const res = context.switchToHttp().getResponse();
          res.setHeader('X-Idempotent-Replayed', 'true');
          if (cached.status !== 200) res.status(cached.status);
          return of(cached.body);
        }
        // Cache miss — executa handler e armazena response em tap.
        return next.handle().pipe(
          tap({
            next: (body) => {
              const res = context.switchToHttp().getResponse();
              const status = res.statusCode ?? 200;
              // Só cacheia respostas 2xx (sucesso) — não cacheia erro de validação 4xx,
              // pois cliente pode corrigir e retentar.
              if (status >= 200 && status < 300) {
                this.service
                  .store(userId, key, method, path, { status, body })
                  .catch(() => undefined);
              }
            },
          }),
        );
      }),
    );
  }
}
