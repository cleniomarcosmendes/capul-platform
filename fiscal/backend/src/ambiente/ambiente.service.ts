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
      // CT-e Distribuição (controle independente do ambiente global NF-e)
      cteDistribuicaoAtivo: cfg.cteDistribuicaoAtivo,
      cteDistribuicaoAmbiente: cfg.cteDistribuicaoAmbiente,
      cteDistribuicaoAlteradoEm: cfg.cteDistribuicaoAlteradoEm,
      cteDistribuicaoAlteradoPor: cfg.cteDistribuicaoAlteradoPor,
      // Gravação automática Protheus (Fase 4 simplificada — flag separada
      // por defesa: setor fiscal valida tela primeiro, só depois ADMIN_TI
      // libera gravação no Protheus PROD).
      cteProtheusGravaAtivo: cfg.cteProtheusGravaAtivo,
      cteProtheusGravaAlteradoEm: cfg.cteProtheusGravaAlteradoEm,
      cteProtheusGravaAlteradoPor: cfg.cteProtheusGravaAlteradoPor,
    };
  }

  /**
   * Estado leve do CT-e Distribuição — usado por DistribuicaoNsuService e
   * CteSchedulerService no gating (substitui a env var FISCAL_CTE_DISTRIBUICAO_ENABLED).
   */
  async getCteDistribuicaoConfig(): Promise<{
    ativo: boolean;
    ambiente: AmbienteSefaz;
  }> {
    const cfg = await this.getOrCreate();
    return {
      ativo: cfg.cteDistribuicaoAtivo,
      ambiente: cfg.cteDistribuicaoAmbiente,
    };
  }

  /**
   * Liga/desliga o serviço CT-e Distribuição. Operacional crítico —
   * controlled via UI por ADMIN_TI (toggle no Controle Operacional → aba CT-e).
   * Quando ativo=false, scheduler fica silencioso (não toca SEFAZ).
   */
  async setCteDistribuicaoAtivo(ativo: boolean, usuario: string) {
    return this.prisma.ambienteConfig.update({
      where: { id: 1 },
      data: {
        cteDistribuicaoAtivo: ativo,
        cteDistribuicaoAlteradoEm: new Date(),
        cteDistribuicaoAlteradoPor: usuario,
      },
    });
  }

  /**
   * Define ambiente SEFAZ específico do CT-e (independente do `ambienteAtivo`
   * global usado por NF-e/Cadastro). Permite cenário "CT-e em HOM enquanto
   * NF-e está em PROD" durante implantação. Operacional crítico — ADMIN_TI.
   */
  async setCteDistribuicaoAmbiente(ambiente: AmbienteSefaz, usuario: string) {
    return this.prisma.ambienteConfig.update({
      where: { id: 1 },
      data: {
        cteDistribuicaoAmbiente: ambiente,
        cteDistribuicaoAlteradoEm: new Date(),
        cteDistribuicaoAlteradoPor: usuario,
      },
    });
  }

  /**
   * Estado da gravação Protheus do CT-e — usado pelo CteEnriquecimentoService
   * pra decidir se chama o ProtheusGravacaoHelper após enriquecer.
   */
  async getCteProtheusGravaAtivo(): Promise<boolean> {
    const cfg = await this.getOrCreate();
    return cfg.cteProtheusGravaAtivo;
  }

  /**
   * Liga/desliga gravação automática no Protheus (SZR010+SZQ010) após
   * enriquecimento. Operacional crítico — ADMIN_TI. Quando ativa, cron
   * de enriquecimento (hh:30) tenta gravar todo CT-e schema=procCTe/procCTeSimp
   * com papel_capul preenchido em SZR010+SZQ010 via grvXML.
   *
   * Protheus é fail-safe: gravação é best-effort (TentativaGravacaoResult),
   * não trava o cron de enriquecimento.
   */
  async setCteProtheusGravaAtivo(ativo: boolean, usuario: string) {
    return this.prisma.ambienteConfig.update({
      where: { id: 1 },
      data: {
        cteProtheusGravaAtivo: ativo,
        cteProtheusGravaAlteradoEm: new Date(),
        cteProtheusGravaAlteradoPor: usuario,
      },
    });
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
    cronMovimentoManhaSeguinte: string | null | undefined,
    usuario: string,
  ) {
    this.validarCron('cronMovimentoMeioDia', cronMovimentoMeioDia);
    // null/vazio = desabilitado — não validar como cron.
    const manhaNormalizada =
      !cronMovimentoManhaSeguinte || cronMovimentoManhaSeguinte.trim() === ''
        ? null
        : cronMovimentoManhaSeguinte;
    if (manhaNormalizada) {
      this.validarCron('cronMovimentoManhaSeguinte', manhaNormalizada);
    }

    return this.prisma.ambienteConfig.update({
      where: { id: 1 },
      data: {
        cronMovimentoMeioDia,
        cronMovimentoManhaSeguinte: manhaNormalizada,
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
