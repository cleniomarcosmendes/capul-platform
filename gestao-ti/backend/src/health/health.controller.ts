import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Endpoint público de health check usado pelo Docker `HEALTHCHECK`.
 *
 * Auditoria 25/04/2026 #6 — toda observabilidade depende de um sinal binário
 * (saudável/não saudável) que o orchestrator possa consumir.
 */
// Global prefix `api/v1/gestao-ti` é aplicado em main.ts. Aqui só 'health'
// para resultar em /api/v1/gestao-ti/health.
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let database = { ok: false, latencyMs: -1 };
    const t0 = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = { ok: true, latencyMs: Date.now() - t0 };
    } catch {
      database = { ok: false, latencyMs: Date.now() - t0 };
    }
    return {
      status: database.ok ? 'ok' : 'down',
      timestamp: new Date().toISOString(),
      checks: { database },
    };
  }
}
