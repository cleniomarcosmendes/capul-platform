import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import { QUEUE_ALERTAS, QUEUE_CRUZAMENTO, QUEUE_SCHEDULER } from './bullmq.tokens.js';

/**
 * Monitor periodico das filas BullMQ — origem: auditoria 10/05/2026 #A3 (Robustez).
 *
 * Antes deste service, jobs falhados depois de 3 attempts iam pro set `failed`
 * mas nao havia alerta automatico — falhas em massa passavam despercebidas
 * ate alguem reportar manualmente. Stuck jobs (em `active` por muito tempo)
 * tambem nao eram detectados.
 *
 * Mecanica @cron 5min:
 *   - Coleta counts (waiting, active, failed, delayed) das 3 filas
 *   - Loga linha consolidada (info) — visivel em pino-http JSON logs
 *   - Alerta se threshold ultrapassado:
 *       failed > 10                -> WARN  (algo falhou em massa)
 *       failed > 50                -> ERROR (situacao grave)
 *       active continua subindo    -> WARN  (jobs travados, worker pode estar lento ou DB lock)
 *   - Cooldown por fila+severidade (1h) pra evitar flooding
 *
 * Pattern de envio igual ao HealthWatchdogService:
 * fetch direto pro auth-gateway:3000/api/v1/internal/alerts/notify.
 *
 * NAO substitui bull-board — bull-board e a Opcao B (UI completa). Esta e
 * a Opcao A da auditoria: alerta passivo, baixo esforco. Pode coexistir.
 */
@Injectable()
export class QueueMonitorService {
  private readonly logger = new Logger(QueueMonitorService.name);
  private readonly ALERT_URL = `http://auth-gateway:3000/api/v1/internal/alerts/notify`;
  private readonly ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1h

  // cooldown por chave "<queue>:<severity>"
  private readonly lastAlertAt = new Map<string, number>();

  // active counts da rodada anterior — pra detectar stuck (active subindo sem completar)
  private readonly previousActive = new Map<string, number>();
  private readonly stuckStreak = new Map<string, number>();

  constructor(
    @Inject(QUEUE_CRUZAMENTO) private readonly cruzamento: Queue,
    @Inject(QUEUE_SCHEDULER) private readonly scheduler: Queue,
    @Inject(QUEUE_ALERTAS) private readonly alertas: Queue,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'fiscal:queue-monitor' })
  async tick(): Promise<void> {
    const filas: Array<{ name: string; queue: Queue }> = [
      { name: 'fiscal-cruzamento', queue: this.cruzamento },
      { name: 'fiscal-scheduler', queue: this.scheduler },
      { name: 'fiscal-alertas', queue: this.alertas },
    ];

    for (const { name, queue } of filas) {
      try {
        const counts = await queue.getJobCounts('waiting', 'active', 'failed', 'delayed', 'completed');
        const { waiting = 0, active = 0, failed = 0, delayed = 0, completed = 0 } = counts;

        this.logger.log(
          `Queue ${name}: waiting=${waiting} active=${active} delayed=${delayed} failed=${failed} completed=${completed}`,
        );

        // Detectar stuck: active subindo sem completar entre 2 ticks consecutivos
        const prevActive = this.previousActive.get(name) ?? 0;
        if (active > 0 && active >= prevActive) {
          const streak = (this.stuckStreak.get(name) ?? 0) + 1;
          this.stuckStreak.set(name, streak);
          // 3 ticks consecutivos com active >= anterior = ~15min stuck
          if (streak === 3) {
            await this.alert(name, 'warn', `Jobs travados na fila ${name}`,
              `${active} jobs em active ha pelo menos 15min sem completar. Worker pode estar bloqueado, com lock no DB ou em loop.`);
          }
        } else {
          this.stuckStreak.set(name, 0);
        }
        this.previousActive.set(name, active);

        // Failed thresholds
        if (failed > 50) {
          await this.alert(name, 'error', `Fila ${name} com muitas falhas`,
            `${failed} jobs em failed. Verificar logs do worker e estado da dependencia externa (Protheus/SEFAZ/SMTP).`);
        } else if (failed > 10) {
          await this.alert(name, 'warn', `Fila ${name} acumulando falhas`,
            `${failed} jobs em failed nas ultimas execucoes. Investigar logs do worker.`);
        }
      } catch (err) {
        this.logger.warn(`Falha ao coletar counts da fila ${name}: ${(err as Error).message}`);
      }
    }
  }

  private async alert(
    queueName: string,
    severity: 'warn' | 'error' | 'critical',
    title: string,
    message: string,
  ): Promise<void> {
    const key = `${queueName}:${severity}`;
    const now = Date.now();
    const last = this.lastAlertAt.get(key);
    if (last && now - last < this.ALERT_COOLDOWN_MS) {
      return; // dentro do cooldown
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
          context: { queue: queueName },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      this.lastAlertAt.set(key, now);
      this.logger.log(`Alerta '${title}' enviado (severity=${severity})`);
    } catch (err) {
      this.logger.error(`Falha ao enviar alerta da fila ${queueName}: ${(err as Error).message}`);
    }
  }
}
