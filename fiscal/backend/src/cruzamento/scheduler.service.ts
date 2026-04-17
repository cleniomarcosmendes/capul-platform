import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ExecucaoService } from './execucao.service.js';
import { AmbienteService } from '../ambiente/ambiente.service.js';

/**
 * Scheduler de rotinas automáticas do cruzamento.
 *
 * Inicializado em onApplicationBootstrap lendo `janelaSemanalCron` e
 * `janelaDiariaCron` do `fiscal.ambiente_config`. Se a config for alterada
 * depois, chame `reagendar()` via endpoint admin.
 *
 * Cada cron firing chama `ExecucaoService.iniciar(SEMANAL_AUTO|DIARIA_AUTO)`,
 * que cria a sincronização e enfileira os jobs no BullMQ.
 *
 * O freio de mão (`ambiente_config.pauseSync`) é respeitado no próprio
 * `ExecucaoService.iniciar`, que lança exceção se ativo. Aqui só capturamos
 * a exceção pra não matar o scheduler.
 */
@Injectable()
export class SchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly SEMANAL_JOB = 'fiscal:cruzamento-semanal';
  private readonly DIARIA_JOB = 'fiscal:cruzamento-diaria';

  constructor(
    private readonly scheduler: SchedulerRegistry,
    private readonly execucao: ExecucaoService,
    private readonly ambiente: AmbienteService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.registrar();
  }

  /**
   * Registra os crons com base nos padrões do ambiente_config.
   * Idempotente — remove crons existentes antes de recriar.
   */
  async registrar(): Promise<void> {
    const cfg = await this.ambiente.getOrCreate();

    this.removerSeExistir(this.SEMANAL_JOB);
    this.removerSeExistir(this.DIARIA_JOB);

    try {
      const semanal = new CronJob(
        cfg.janelaSemanalCron,
        () => {
          this.execucao.iniciar('SEMANAL_AUTO', 'sistema:scheduler').catch((err) => {
            this.logger.warn(
              `Cron semanal falhou ao iniciar: ${(err as Error).message}`,
            );
          });
        },
        null,
        false,
        'America/Sao_Paulo',
      );
      this.scheduler.addCronJob(this.SEMANAL_JOB, semanal as unknown as CronJob);
      semanal.start();
      this.logger.log(`Cron SEMANAL_AUTO registrado: ${cfg.janelaSemanalCron}`);
    } catch (err) {
      this.logger.error(`Falha ao registrar cron semanal (${cfg.janelaSemanalCron}): ${(err as Error).message}`);
    }

    try {
      const diaria = new CronJob(
        cfg.janelaDiariaCron,
        () => {
          this.execucao.iniciar('DIARIA_AUTO', 'sistema:scheduler').catch((err) => {
            this.logger.warn(
              `Cron diária falhou ao iniciar: ${(err as Error).message}`,
            );
          });
        },
        null,
        false,
        'America/Sao_Paulo',
      );
      this.scheduler.addCronJob(this.DIARIA_JOB, diaria as unknown as CronJob);
      diaria.start();
      this.logger.log(`Cron DIARIA_AUTO registrado: ${cfg.janelaDiariaCron}`);
    } catch (err) {
      this.logger.error(`Falha ao registrar cron diária (${cfg.janelaDiariaCron}): ${(err as Error).message}`);
    }
  }

  getStatus(): {
    semanal: { cron: string; proxima: Date | null } | null;
    diaria: { cron: string; proxima: Date | null } | null;
  } {
    return {
      semanal: this.infoJob(this.SEMANAL_JOB),
      diaria: this.infoJob(this.DIARIA_JOB),
    };
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
