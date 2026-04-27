import { Controller, Get, Inject } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Endpoint público de health check usado pelo Docker `HEALTHCHECK` e pelo
 * monitoramento externo. Retorna 200 com status do DB.
 *
 * Auditoria 25/04/2026 #6 — toda observabilidade depende de um sinal binário
 * (saudável/não saudável) que o orchestrator possa consumir.
 */
@Public()
@Controller('api/v1/auth/health')
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
