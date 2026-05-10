import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface CachedResponse {
  status: number;
  body: unknown;
}

/**
 * Idempotency-Key — defesa em profundidade contra duplicação por retry de cliente.
 *
 * Cliente envia header `Idempotency-Key: <uuid>` em endpoints de criação.
 * Service:
 *   - Verifica cache por (usuarioId, key) antes de executar
 *   - Se cached e não expirou, retorna response do cache
 *   - Senão retorna null e o request executa normal; ao terminar, store() cacheia
 *
 * TTL padrão: 24h. Cleanup @daily apaga keys com expires_at < now().
 *
 * Origem: auditoria 10/05/2026 #M3 (Robustez).
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly TTL_MS = 24 * 60 * 60 * 1000; // 24h

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tenta recuperar resposta cacheada. Retorna null se não existe ou expirou.
   * Detecta tentativa de mau uso: mesma key em (method, path) diferente do cache → log warn.
   */
  async lookup(
    usuarioId: string,
    key: string,
    method: string,
    path: string,
  ): Promise<CachedResponse | null> {
    const cached = await this.prisma.idempotencyKey.findUnique({
      where: { idempotency_user_key: { usuarioId, key } },
    });
    if (!cached) return null;
    if (cached.expiresAt < new Date()) {
      // expirou — apaga e libera retry
      await this.prisma.idempotencyKey
        .delete({ where: { id: cached.id } })
        .catch(() => undefined);
      return null;
    }
    if (cached.method !== method || cached.path !== path) {
      this.logger.warn(
        `Idempotency-Key reusada em endpoint diferente: usuario=${usuarioId} key=${key} ` +
          `cached=(${cached.method} ${cached.path}) novo=(${method} ${path}). Bloqueando.`,
      );
      // 422 — cliente enviou Idempotency-Key igual em endpoints distintos
      return {
        status: 422,
        body: {
          error: 'Idempotency-Key conflict',
          message:
            'Esta Idempotency-Key foi usada em outro endpoint. Use uma chave diferente para cada request distinto.',
        },
      };
    }
    return { status: cached.responseStatus, body: cached.responseBody };
  }

  /**
   * Persiste resposta para futuras consultas.
   * Idempotente: se já existir (race condition), ignora.
   */
  async store(
    usuarioId: string,
    key: string,
    method: string,
    path: string,
    response: CachedResponse,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + this.TTL_MS);
    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key,
          usuarioId,
          method,
          path,
          responseStatus: response.status,
          responseBody: response.body as never, // Prisma JSON aceita any
          expiresAt,
        },
      });
    } catch (err) {
      // Race condition: outra request com mesma key inseriu primeiro. OK.
      this.logger.debug(
        `Idempotency store ignorado (provavel race): ${(err as Error).message}`,
      );
    }
  }

  /**
   * Cleanup — remove keys expiradas. Mantém tabela compacta.
   * Como gestao-ti não tem @nestjs/schedule, pode ser chamado:
   *   - Externamente via endpoint admin (POST /api/v1/gestao-ti/admin/idempotency/cleanup)
   *   - Por cron externo (cron do host) chamando o endpoint acima
   *   - Manualmente em janela de manutenção
   * Volume típico: ~1k linhas/dia se 10% das requests usar Idempotency-Key. Tabela
   * fica pequena mesmo sem cleanup imediato; cleanup mensal já basta.
   */
  async cleanup(): Promise<{ removed: number }> {
    const result = await this.prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (result.count > 0) {
      this.logger.log(`Cleanup idempotency: ${result.count} keys expiradas removidas`);
    }
    return { removed: result.count };
  }
}
