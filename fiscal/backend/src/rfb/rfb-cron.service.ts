import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AmbienteService } from '../ambiente/ambiente.service.js';
import { RfbDeteccaoService } from './rfb-deteccao.service.js';

// F1.4a — Detecção automática SEMANAL da base pública CNPJ.
//
// Só DETECTA (PROPFIND no share + marca DISPONIVEL) — NUNCA importa.
// Não é caso da regra SEFAZ-em-loop (sem certificado/webservice — PROPFIND
// num share estático público, benigno).
//
// Cron CONFIGURÁVEL pelo admin (pedido Clenio): expressão vive em
// `ambiente_config.rfb_cron_deteccao` (default seg 07:00). NULL/vazio =
// detecção automática DESATIVADA. Registro dinâmico via SchedulerRegistry
// (mesmo padrão do SchedulerService de cruzamento) — `registrar()` reaplica
// sem restart quando a config muda.
const JOB = 'rfb:deteccao';

@Injectable()
export class RfbCronService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RfbCronService.name);

  constructor(
    private readonly deteccao: RfbDeteccaoService,
    private readonly ambiente: AmbienteService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  async onApplicationBootstrap() {
    await this.registrar();
  }

  /** (Re)registra o cron a partir da config. Chamar após alterar a agenda. */
  async registrar(): Promise<void> {
    this.removerSeExistir();
    const cfg = await this.ambiente.getOrCreate();
    const expr = cfg.rfbCronDeteccao?.trim();
    if (!expr) {
      this.logger.log('RFB detecção automática DESATIVADA (sem cron configurado)');
      return;
    }
    try {
      const job = new CronJob(expr, () => this.executar(), null, false, 'America/Sao_Paulo');
      this.scheduler.addCronJob(JOB, job as unknown as CronJob);
      job.start();
      this.logger.log(`RFB detecção registrada: ${expr}`);
    } catch (err) {
      this.logger.error(`Cron RFB inválido (${expr}): ${(err as Error).message}`);
    }
  }

  private async executar() {
    try {
      const r = await this.deteccao.detectar();
      this.logger.log(`RFB detecção: maisRecente=${r.maisRecente} novaDisponivel=${r.novaDisponivel}`);
    } catch (e: any) {
      this.logger.error(`RFB detecção falhou: ${e?.message || e}`);
    }
  }

  private removerSeExistir(): void {
    try {
      this.scheduler.deleteCronJob(JOB);
    } catch {
      // não existia
    }
  }
}
