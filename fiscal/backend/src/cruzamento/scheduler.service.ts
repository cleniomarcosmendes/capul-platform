import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ExecucaoService } from './execucao.service.js';
import { AmbienteService } from '../ambiente/ambiente.service.js';

/**
 * Scheduler de rotinas automáticas do cruzamento — Plano v2.0 §2.1.
 *
 * Duas corridas diárias alinhadas à janela de 24h de cancelamento de NF-e:
 *   - MOVIMENTO_MEIO_DIA        (padrão 12:00) — movimento hoje 00:00 → 12:00
 *   - MOVIMENTO_MANHA_SEGUINTE  (padrão 06:00) — movimento ontem 12:00 → 23:59
 *
 * Cron expressions lidos de `fiscal.ambiente_config.cron_movimento_meio_dia`
 * e `cron_movimento_manha_seguinte`. Se a config mudar, chame `registrar()`.
 *
 * O freio de mão (`ambiente_config.pauseSync`) é respeitado dentro do
 * `ExecucaoService.iniciar`. Aqui só capturamos exceções para não matar o cron.
 */
@Injectable()
export class SchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly MEIO_DIA_JOB = 'fiscal:movimento-meio-dia';
  private readonly MANHA_SEGUINTE_JOB = 'fiscal:movimento-manha-seguinte';

  constructor(
    private readonly scheduler: SchedulerRegistry,
    private readonly execucao: ExecucaoService,
    private readonly ambiente: AmbienteService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.registrar();
  }

  async registrar(): Promise<void> {
    const cfg = await this.ambiente.getOrCreate();

    this.removerSeExistir(this.MEIO_DIA_JOB);
    this.removerSeExistir(this.MANHA_SEGUINTE_JOB);

    this.registrarCron(
      this.MEIO_DIA_JOB,
      cfg.cronMovimentoMeioDia,
      'MOVIMENTO_MEIO_DIA',
      () =>
        this.execucao
          .iniciar('MOVIMENTO_MEIO_DIA', 'sistema:scheduler')
          .catch((err) => this.logger.warn(`MOVIMENTO_MEIO_DIA falhou: ${(err as Error).message}`)),
    );

    this.registrarCron(
      this.MANHA_SEGUINTE_JOB,
      cfg.cronMovimentoManhaSeguinte,
      'MOVIMENTO_MANHA_SEGUINTE',
      () =>
        this.execucao
          .iniciar('MOVIMENTO_MANHA_SEGUINTE', 'sistema:scheduler')
          .catch((err) => this.logger.warn(`MOVIMENTO_MANHA_SEGUINTE falhou: ${(err as Error).message}`)),
    );
  }

  getStatus(): {
    meioDia: { cron: string; proxima: Date | null } | null;
    manhaSeguinte: { cron: string; proxima: Date | null } | null;
  } {
    return {
      meioDia: this.infoJob(this.MEIO_DIA_JOB),
      manhaSeguinte: this.infoJob(this.MANHA_SEGUINTE_JOB),
    };
  }

  private registrarCron(
    name: string,
    cronExpr: string,
    label: string,
    handler: () => void,
  ): void {
    try {
      const job = new CronJob(cronExpr, handler, null, false, 'America/Sao_Paulo');
      this.scheduler.addCronJob(name, job as unknown as CronJob);
      job.start();
      this.logger.log(`Cron ${label} registrado: ${cronExpr}`);
    } catch (err) {
      this.logger.error(`Falha ao registrar cron ${label} (${cronExpr}): ${(err as Error).message}`);
    }
  }

  private infoJob(name: string) {
    try {
      const job = this.scheduler.getCronJob(name) as unknown as CronJob;
      return {
        cron: String(job.cronTime.source ?? ''),
        proxima: job.nextDate().toJSDate(),
      };
    } catch {
      return null;
    }
  }

  private removerSeExistir(name: string): void {
    try {
      this.scheduler.deleteCronJob(name);
    } catch {
      // não existia
    }
  }
}
