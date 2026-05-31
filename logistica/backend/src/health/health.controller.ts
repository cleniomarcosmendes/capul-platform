import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '../common/decorators/public.decorator.js';

interface CheckResult {
  ok: boolean;
  message?: string;
  latencyMs?: number;
}

interface HealthResponse {
  status: 'ok' | 'down';
  module: 'logistica';
  timestamp: string;
  uptime: number;
  checks: { database: CheckResult };
}

/**
 * Health check do módulo Logística — público (sem auth).
 * 200 quando o banco responde; 503 quando o banco está fora.
 */
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const database = await this.checkDatabase();
    return {
      status: database.ok ? 'ok' : 'down',
      module: 'logistica',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: { database },
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
}
