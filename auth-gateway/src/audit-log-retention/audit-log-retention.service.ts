import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AlertNotifierService } from '../alert-notifier/alert-notifier.service';

const RETENTION_KEY = 'audit_log_retention_dias';
const DEFAULT_RETENTION_DIAS = 365;

/**
 * Limpa `core.system_logs` (logs de auditoria do auth-gateway) mais antigos
 * que o limite configurado. Sem isso, a tabela cresce indefinidamente.
 *
 * Origem: auditoria observabilidade 26/04/2026 #9.
 *
 * - Cron: dia 1 de cada mes as 03:00 (horario de menor uso).
 * - Config: `core.system_config.key='audit_log_retention_dias'` (default 365).
 * - Alerta: dispara WARN no AlertNotifier se deletar > 100k linhas (anomalo).
 *
 * NOTA LGPD: antes de deletar, considere exportar pra arquivo offline ou
 * agregacao em Loki — auditoria de acesso e eventos pode ser solicitada
 * em ate 5 anos por orgaos reguladores. 365d e ponto de partida; ajustar
 * conforme politica formal de retencao quando definida.
 */
@Injectable()
export class AuditLogRetentionService {
  private readonly logger = new Logger(AuditLogRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertNotifierService,
  ) {}

  @Cron('0 3 1 * *', { name: 'core:audit-log-retention', timeZone: 'America/Sao_Paulo' })
  async run(): Promise<void> {
    const retentionDias = await this.getRetentionDias();
    if (retentionDias <= 0) {
      this.logger.warn(`Retencao = ${retentionDias} dias: cleanup desabilitado`);
      return;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDias);

    const start = Date.now();
    try {
      const result = await this.prisma.systemLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      const elapsed = Date.now() - start;
      this.logger.log(
        `Cleanup audit_logs: ${result.count} linhas deletadas (cutoff=${cutoff.toISOString()}, ${elapsed}ms)`,
      );

      if (result.count > 100_000) {
        await this.alerts.notify({
          severity: 'warn',
          source: 'auth',
          title: `Cleanup audit_logs deletou ${result.count} linhas`,
          message:
            `Retencao = ${retentionDias} dias. Volume alto sugere revisar nivel de log ` +
            `(muito DEBUG/INFO?) ou aumentar retencao.`,
          context: { retentionDias, cutoff: cutoff.toISOString(), elapsedMs: elapsed },
        });
      }
    } catch (err) {
      this.logger.error(`Falha no cleanup audit_logs: ${(err as Error).message}`);
      await this.alerts.notify({
        severity: 'error',
        source: 'auth',
        title: 'Falha no cleanup audit_logs',
        message: (err as Error).message,
        context: { retentionDias, cutoff: cutoff.toISOString() },
      });
    }
  }

  private async getRetentionDias(): Promise<number> {
    const row = await this.prisma.systemConfig.findUnique({ where: { key: RETENTION_KEY } });
    if (!row?.value) return DEFAULT_RETENTION_DIAS;
    const n = Number(row.value);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_RETENTION_DIAS;
  }

  /** Endpoint de gestao — retorna config atual + estatistica da tabela. */
  async getStatus(): Promise<{
    retentionDias: number;
    totalLinhas: number;
    maisAntigo: Date | null;
    maisRecente: Date | null;
  }> {
    const retentionDias = await this.getRetentionDias();
    const [agg] = await this.prisma.$queryRaw<
      Array<{ total: bigint; min: Date | null; max: Date | null }>
    >`SELECT count(*)::bigint as total, min(created_at) as min, max(created_at) as max FROM core.system_logs`;
    return {
      retentionDias,
      totalLinhas: Number(agg?.total ?? 0n),
      maisAntigo: agg?.min ?? null,
      maisRecente: agg?.max ?? null,
    };
  }
}
