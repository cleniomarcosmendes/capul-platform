import { Controller, Get, Inject } from '@nestjs/common';
import IORedis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service.js';
import { REDIS_CONNECTION } from '../bullmq/bullmq.module.js';
import { MailTransportService } from '../alertas/mail-transport.service.js';
import { SefazCaService } from '../sefaz/sefaz-ca.service.js';
import { Public } from '../common/decorators/public.decorator.js';

interface CheckResult {
  ok: boolean;
  message?: string;
  latencyMs?: number;
}

interface SefazTlsCheck {
  ok: boolean;
  modo: string;
  severidade: 'OK' | 'ATENCAO' | 'CRITICO';
  totalCertificados: number;
  idadeDias: number | null;
  ultimoRefresh: string | null;
  mensagem: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  checks: {
    database: CheckResult;
    redis: CheckResult;
    smtp: CheckResult;
    sefazTls: SefazTlsCheck;
  };
}

/**
 * Health check consolidado — público (sem auth).
 *
 * Três verificações independentes:
 *   - Database (PostgreSQL via Prisma `$queryRaw`)
 *   - Redis (PING via IORedis)
 *   - SMTP (status do transport verify no boot)
 *
 * Status overall:
 *   - ok: todos passam
 *   - degraded: SMTP falhou mas DB+Redis OK (não bloqueia operação)
 *   - down: DB ou Redis falhou (módulo não operacional)
 *
 * Retorna HTTP 200 em `ok`/`degraded` e HTTP 503 em `down`. O Docker/K8s
 * healthcheck deve considerar 200 como saudável.
 */
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CONNECTION) private readonly redis: IORedis,
    private readonly mail: MailTransportService,
    private readonly sefazCa: SefazCaService,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const [database, redis, smtp] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkSmtp(),
    ]);
    const sefazTls = this.checkSefazTls();

    const critical = database.ok && redis.ok;
    // Cadeia TLS crítica (ausente ou >90d) vira degraded também
    const tlsDegraded = sefazTls.severidade === 'CRITICO';
    const status: HealthResponse['status'] = !critical
      ? 'down'
      : smtp.ok && !tlsDegraded
        ? 'ok'
        : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: { database, redis, smtp, sefazTls },
    };
  }

  private checkSefazTls(): SefazTlsCheck {
    const s = this.sefazCa.getStatus();
    return {
      ok: s.severidade !== 'CRITICO',
      modo: s.modo,
      severidade: s.severidade,
      totalCertificados: s.totalCertificados,
      idadeDias: s.idadeDias,
      ultimoRefresh: s.ultimoRefresh,
      mensagem: s.mensagem,
    };
  }

  private async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, message: (err as Error).message, latencyMs: Date.now() - start };
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const pong = await this.redis.ping();
      return { ok: pong === 'PONG', latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, message: (err as Error).message, latencyMs: Date.now() - start };
    }
  }

  private async checkSmtp(): Promise<CheckResult> {
    return {
      ok: this.mail.isEnabled(),
      message: this.mail.isEnabled() ? undefined : 'SMTP não habilitado (dev) ou verify falhou',
    };
  }
}
