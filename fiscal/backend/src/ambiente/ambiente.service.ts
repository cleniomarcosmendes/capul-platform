import { BadRequestException, Injectable } from '@nestjs/common';
import { CronJob } from 'cron';
import { PrismaService } from '../prisma/prisma.service.js';
import { AmbienteSefaz } from '@prisma/client';

/**
 * Gerencia o registro singleton `ambiente_config` (id=1):
 * ambiente PROD/HOM, freio de mão, crons de movimento 12:00/06:00.
 */
@Injectable()
export class AmbienteService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate() {
    let cfg = await this.prisma.ambienteConfig.findUnique({ where: { id: 1 } });
    if (!cfg) {
      cfg = await this.prisma.ambienteConfig.create({ data: { id: 1 } });
    }
    return cfg;
  }

  async getStatus() {
    const cfg = await this.getOrCreate();
    return {
      ambienteAtivo: cfg.ambienteAtivo,
      bootstrapConcluido: cfg.bootstrapConcluidoEm !== null,
      bootstrapConcluidoEm: cfg.bootstrapConcluidoEm,
      pauseSync: cfg.pauseSync,
      cronMovimentoMeioDia: cfg.cronMovimentoMeioDia,
      cronMovimentoManhaSeguinte: cfg.cronMovimentoManhaSeguinte,
      ultimaAlteracaoEm: cfg.ultimaAlteracaoEm,
      ultimaAlteracaoPor: cfg.ultimaAlteracaoPor,
    };
  }

  async alterarAmbiente(ambiente: AmbienteSefaz, usuario: string) {
    return this.prisma.ambienteConfig.update({
      where: { id: 1 },
      data: { ambienteAtivo: ambiente, ultimaAlteracaoPor: usuario },
    });
  }

  async pauseSync(usuario: string) {
    return this.prisma.ambienteConfig.update({
      where: { id: 1 },
      data: { pauseSync: true, ultimaAlteracaoPor: usuario },
    });
  }

  async resumeSync(usuario: string) {
    return this.prisma.ambienteConfig.update({
      where: { id: 1 },
      data: { pauseSync: false, ultimaAlteracaoPor: usuario },
    });
  }

  /**
   * Atualiza as expressoes cron das rotinas automaticas. Valida que ambas
   * sao parsaveis antes de gravar (try `new CronJob` — se falhar, lanca).
   * Apos gravar, o frontend deve chamar POST /cruzamento/scheduler/recarregar
   * para recarregar os crons ja ativos sem restart.
   */
  async atualizarCrons(
    cronMovimentoMeioDia: string,
    cronMovimentoManhaSeguinte: string,
    usuario: string,
  ) {
    this.validarCron('cronMovimentoMeioDia', cronMovimentoMeioDia);
    this.validarCron('cronMovimentoManhaSeguinte', cronMovimentoManhaSeguinte);

    return this.prisma.ambienteConfig.update({
      where: { id: 1 },
      data: {
        cronMovimentoMeioDia,
        cronMovimentoManhaSeguinte,
        ultimaAlteracaoPor: usuario,
      },
    });
  }

  private validarCron(campo: string, expr: string): void {
    try {
      // Cria um CronJob "seco" apenas para validar a sintaxe.
      // Passamos um handler noop e start=false — nao agenda nada.
      const job = new CronJob(expr, () => undefined, null, false, 'America/Sao_Paulo');
      // Verifica tambem que a expressao gera uma proxima execucao.
      const proxima = job.nextDate();
      if (!proxima) {
        throw new Error('sem proxima execucao calculavel');
      }
    } catch (err) {
      throw new BadRequestException(
        `${campo} invalido: "${expr}" — ${(err as Error).message}`,
      );
    }
  }
}
