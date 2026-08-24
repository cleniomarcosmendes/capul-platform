import { Controller, Get, HttpCode, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import type Redis from 'ioredis';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { VERSAO_BUILD, type VersaoBuild } from '../common/versao';

interface CheckResult {
  ok: boolean;
  message?: string;
  latencyMs?: number;
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  /** Qual build está no ar — o app mostra na tela "Sobre" (ver common/versao.ts). */
  versao: VersaoBuild;
  timestamp: string;
  uptime: number;
  checks: {
    database: CheckResult;
    redis: CheckResult;
  };
}

/**
 * Endpoint público de health check usado pelo Docker `HEALTHCHECK` e pelo
 * monitoramento externo.
 *
 * Verificações:
 *   - Database (PostgreSQL via Prisma `$queryRaw`)
 *   - Redis (PING via IORedis — REDIS_CLIENT pode ser null se não configurado)
 *
 * Status overall (auditoria 10/05/2026 #A1 — Robustez):
 *   - ok:       todos passam
 *   - degraded: REDIS_CLIENT é null (configuração incompleta; presença/online não funcionam)
 *   - down:     DB falhou (gateway não autentica) — retorna HTTP 503
 *
 * Retorna 200 em ok/degraded e 503 em down.
 *
 * Origem: auditoria 25/04/2026 #6 (observabilidade) + 10/05/2026 #A1 (incluir Redis).
 */
@Public()
@Controller('api/v1/auth/health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const status: HealthResponse['status'] = !database.ok ? 'down' : redis.ok ? 'ok' : 'degraded';

    if (status === 'down') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status,
      versao: VERSAO_BUILD,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: { database, redis },
    };
  }

  private async checkDatabase(): Promise<CheckResult> {
    const t0 = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - t0 };
    } catch (err) {
      return { ok: false, message: (err as Error).message, latencyMs: Date.now() - t0 };
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    if (!this.redis) {
      return { ok: false, message: 'REDIS_CLIENT null (REDIS_URL nao configurado)' };
    }
    const t0 = Date.now();
    try {
      const pong = await this.redis.ping();
      return { ok: pong === 'PONG', latencyMs: Date.now() - t0 };
    } catch (err) {
      return { ok: false, message: (err as Error).message, latencyMs: Date.now() - t0 };
    }
  }
}
