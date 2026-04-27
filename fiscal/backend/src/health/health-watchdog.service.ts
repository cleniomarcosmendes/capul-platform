import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * Polling do proprio /health a cada 5min. Conta status nao-ok consecutivos
 * e dispara alerta via auth-gateway quando atinge limite.
 *
 * Origem: auditoria observabilidade 26/04/2026 #11. Antes, /health retornava
 * `degraded` mas ninguem percebia ate alguem fazer GET manual.
 *
 * Limites:
 *   - 3 degradeds consecutivos (=15min) -> alerta WARN
 *   - 1 down imediato -> alerta CRITICAL
 * Reset: 1 ok limpa contador.
 */
@Injectable()
export class HealthWatchdogService {
  private readonly logger = new Logger(HealthWatchdogService.name);
  private degradedStreak = 0;
  private downStreak = 0;
  private lastAlertAt: number | null = null;
  private readonly ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1h — nao floodar

  private readonly HEALTH_URL = `http://localhost:${process.env.PORT ?? 3002}/api/v1/fiscal/health`;
  private readonly ALERT_URL = `http://auth-gateway:3000/api/v1/internal/alerts/notify`;

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'fiscal:health-watchdog' })
  async tick(): Promise<void> {
    let payload: { status: string; checks?: Record<string, unknown> } | null = null;
    try {
      const res = await fetch(this.HEALTH_URL, { signal: AbortSignal.timeout(8_000) });
      payload = await res.json();
    } catch (err) {
      this.logger.warn(`Watchdog: nao consegui ler /health — ${(err as Error).message}`);
      return; // sem dados, sem alerta
    }

    if (!payload) return;
    const status = payload.status;

    if (status === 'ok') {
      if (this.degradedStreak > 0 || this.downStreak > 0) {
        this.logger.log(`Watchdog: status voltou pra OK (streak degraded=${this.degradedStreak}, down=${this.downStreak} zerado)`);
      }
      this.degradedStreak = 0;
      this.downStreak = 0;
      return;
    }

    if (status === 'down') {
      this.downStreak++;
      if (this.downStreak === 1) {
        await this.sendAlert('critical', 'Fiscal DOWN', `Healthcheck retornou 'down' — DB ou Redis indisponiveis.`, payload.checks);
      }
      return;
    }

    // status === 'degraded'
    this.degradedStreak++;
    if (this.degradedStreak === 3) {
      await this.sendAlert(
        'warn',
        'Fiscal degraded ha 15min',
        `Healthcheck retornou 'degraded' em 3 verificacoes consecutivas (15min). SMTP/TLS/cadeia ICP precisam de atencao.`,
        payload.checks,
      );
    } else if (this.degradedStreak > 3 && this.degradedStreak % 12 === 0) {
      // Reaviso a cada 1h se persistir
      await this.sendAlert(
        'warn',
        `Fiscal degraded ha ${this.degradedStreak * 5}min`,
        `Estado degradado persiste. Verificacoes consecutivas: ${this.degradedStreak}.`,
        payload.checks,
      );
    }
  }

  private async sendAlert(
    severity: 'warn' | 'error' | 'critical',
    title: string,
    message: string,
    checks?: Record<string, unknown>,
  ): Promise<void> {
    // Cooldown global pra evitar floodar
    const now = Date.now();
    if (this.lastAlertAt && now - this.lastAlertAt < this.ALERT_COOLDOWN_MS && severity !== 'critical') {
      return;
    }

    try {
      await fetch(this.ALERT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          severity,
          title,
          message,
          source: 'fiscal',
          context: { checks },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      this.lastAlertAt = now;
      this.logger.log(`Alerta '${title}' enviado (severity=${severity})`);
    } catch (err) {
      this.logger.error(`Falha ao enviar alerta: ${(err as Error).message}`);
    }
  }
}
