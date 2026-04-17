import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { REDIS_CONNECTION } from '../bullmq/bullmq.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CccClient } from '../sefaz/ccc-client.service.js';
import { AmbienteService } from '../ambiente/ambiente.service.js';
import { CircuitBreakerService, CircuitBreakerOpenError } from './circuit-breaker.service.js';
import { ExecucaoService, type CruzamentoJobData } from './execucao.service.js';
import type { SituacaoCadastral } from '@prisma/client';

/**
 * Worker BullMQ que processa a fila `fiscal:cruzamento`.
 *
 * Concurrency: 3 jobs paralelos por padrão — compatível com o paralelismo
 * recomendado por UF. O rate limit real é aplicado pelo CircuitBreakerService
 * que checa a UF antes de cada chamada.
 *
 * Para cada job:
 *   1. Valida se o circuit breaker da UF está fechado (senão, falha o job
 *      com retry — BullMQ aplicará backoff exponencial).
 *   2. Chama CccClient.consultarPorCnpj.
 *   3. Persiste/atualiza fiscal.cadastro_contribuinte.
 *   4. Se mudou situação, grava histórico (com vínculo à sincronizacaoId).
 *   5. Atualiza contadores de sucessos/erros na sincronização.
 *   6. Se este foi o último job da sincronização, dispara
 *      ExecucaoService.finalizar().
 */
@Injectable()
export class CruzamentoWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(CruzamentoWorker.name);
  private worker?: Worker<CruzamentoJobData>;
  private readonly QUEUE_NAME = 'fiscal-cruzamento';
  private readonly CONCURRENCY = 3;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly connection: IORedis,
    private readonly prisma: PrismaService,
    private readonly ccc: CccClient,
    private readonly ambiente: AmbienteService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly execucao: ExecucaoService,
  ) {}

  onApplicationBootstrap(): void {
    this.worker = new Worker<CruzamentoJobData>(
      this.QUEUE_NAME,
      async (job) => this.processJob(job),
      {
        connection: this.connection,
        concurrency: this.CONCURRENCY,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.debug(`Job ${job.id} CNPJ=${job.data.cnpj} concluído`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.warn(
        `Job ${job?.id} CNPJ=${job?.data.cnpj} falhou: ${err.message} (attempt ${job?.attemptsMade}/${job?.opts.attempts})`,
      );
    });

    this.logger.log(`CruzamentoWorker inicializado (queue=${this.QUEUE_NAME}, concurrency=${this.CONCURRENCY})`);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.logger.log('CruzamentoWorker fechado.');
    }
  }

  private async processJob(job: Job<CruzamentoJobData>): Promise<void> {
    const { sincronizacaoId, cnpj, uf } = job.data;

    // Verifica se pode consultar esta UF
    try {
      await this.circuitBreaker.assertCanRequest(uf);
    } catch (err) {
      if (err instanceof CircuitBreakerOpenError) {
        throw new Error(
          `Circuit breaker ABERTO para UF ${uf} — job rejeitado, será retentado.`,
        );
      }
      throw err;
    }

    // Verifica freio de mão
    const cfg = await this.ambiente.getOrCreate();
    if (cfg.pauseSync) {
      throw new Error('Freio de mão ativo — sincronização pausada.');
    }

    const ambienteStr = cfg.ambienteAtivo === 'PRODUCAO' ? 'PRODUCAO' : 'HOMOLOGACAO';

    try {
      const raw = await this.ccc.consultarPorCnpj(cnpj, uf, ambienteStr);

      if (raw.contribuintes.length === 0) {
        await this.registrarContribuinteNaoEncontrado(sincronizacaoId, cnpj, uf, job.data);
      } else {
        const primeiro = raw.contribuintes[0];
        if (primeiro) {
          await this.persistirContribuinte(sincronizacaoId, primeiro, uf, job.data);
        }
      }

      await this.circuitBreaker.recordSuccess(uf);
      await this.incrementarContador(sincronizacaoId, 'sucessos');
    } catch (err) {
      await this.circuitBreaker.recordFailure(uf, (err as Error).message);
      await this.incrementarContador(sincronizacaoId, 'erros', uf);
      throw err; // BullMQ retry
    }

    // Verifica se esta é a última operação da sincronização
    await this.talvezFinalizar(sincronizacaoId);
  }

  private async persistirContribuinte(
    sincronizacaoId: string,
    c: Awaited<ReturnType<CccClient['consultarPorCnpj']>>['contribuintes'][number],
    uf: string,
    jobData: CruzamentoJobData,
  ): Promise<void> {
    const situacao = this.mapSituacao(c.situacaoCadastral);
    const cnpjClean = (c.cnpj ?? jobData.cnpj).replace(/\D/g, '');

    const existing = await this.prisma.cadastroContribuinte.findUnique({
      where: { cnpj_uf: { cnpj: cnpjClean, uf } },
    });

    const upserted = await this.prisma.cadastroContribuinte.upsert({
      where: { cnpj_uf: { cnpj: cnpjClean, uf } },
      create: {
        cnpj: cnpjClean,
        uf,
        inscricaoEstadual: c.ie,
        razaoSocial: c.razaoSocial,
        nomeFantasia: c.nomeFantasia,
        cnae: c.cnae,
        regimeTributario: c.regimeApuracao,
        situacao,
        dataInicioAtividade: c.inicioAtividade ? new Date(c.inicioAtividade) : null,
        dataUltimaAtualizacaoCcc: c.dataSituacao ? new Date(c.dataSituacao) : null,
        enderecoLogradouro: c.endereco?.logradouro,
        enderecoBairro: c.endereco?.bairro,
        enderecoMunicipio: c.endereco?.municipio,
        enderecoCep: c.endereco?.cep,
        vinculosProtheus: [{ origem: jobData.origem, filial: jobData.filial, codigo: jobData.codigo, loja: jobData.loja }],
        ultimaConsultaCccEm: new Date(),
        ultimaSincronizacaoId: sincronizacaoId,
      },
      update: {
        inscricaoEstadual: c.ie ?? undefined,
        razaoSocial: c.razaoSocial ?? undefined,
        nomeFantasia: c.nomeFantasia ?? undefined,
        cnae: c.cnae ?? undefined,
        situacao,
        dataUltimaAtualizacaoCcc: c.dataSituacao ? new Date(c.dataSituacao) : undefined,
        enderecoLogradouro: c.endereco?.logradouro ?? undefined,
        enderecoBairro: c.endereco?.bairro ?? undefined,
        enderecoMunicipio: c.endereco?.municipio ?? undefined,
        enderecoCep: c.endereco?.cep ?? undefined,
        vinculosProtheus: [{ origem: jobData.origem, filial: jobData.filial, codigo: jobData.codigo, loja: jobData.loja }],
        ultimaConsultaCccEm: new Date(),
        ultimaSincronizacaoId: sincronizacaoId,
      },
    });

    // Histórico de mudança de situação
    if (existing && existing.situacao !== situacao) {
      await this.prisma.cadastroHistorico.create({
        data: {
          contribuinteId: upserted.id,
          situacaoAnterior: existing.situacao,
          situacaoNova: situacao,
          sincronizacaoId,
        },
      });
    }
  }

  private async registrarContribuinteNaoEncontrado(
    sincronizacaoId: string,
    cnpj: string,
    uf: string,
    jobData: CruzamentoJobData,
  ): Promise<void> {
    // Upsert com situação DESCONHECIDO para registrar a tentativa
    await this.prisma.cadastroContribuinte.upsert({
      where: { cnpj_uf: { cnpj, uf } },
      create: {
        cnpj,
        uf,
        situacao: 'DESCONHECIDO',
        vinculosProtheus: [{ origem: jobData.origem, filial: jobData.filial, codigo: jobData.codigo, loja: jobData.loja }],
        ultimaConsultaCccEm: new Date(),
        ultimaSincronizacaoId: sincronizacaoId,
      },
      update: {
        ultimaConsultaCccEm: new Date(),
        ultimaSincronizacaoId: sincronizacaoId,
      },
    });
  }

  private async incrementarContador(
    sincronizacaoId: string,
    campo: 'sucessos' | 'erros',
    uf?: string,
  ): Promise<void> {
    if (campo === 'sucessos') {
      await this.prisma.cadastroSincronizacao.update({
        where: { id: sincronizacaoId },
        data: { sucessos: { increment: 1 } },
      });
    } else {
      const sinc = await this.prisma.cadastroSincronizacao.findUnique({
        where: { id: sincronizacaoId },
      });
      const errosPorUf = (sinc?.errosPorUf as Record<string, number>) ?? {};
      if (uf) errosPorUf[uf] = (errosPorUf[uf] ?? 0) + 1;
      await this.prisma.cadastroSincronizacao.update({
        where: { id: sincronizacaoId },
        data: { erros: { increment: 1 }, errosPorUf },
      });
    }
  }

  /**
   * Decide se esta é a última operação do batch e, se for, dispara
   * ExecucaoService.finalizar. Usa contagem total vs processados na
   * própria tabela — evita precisar contar jobs pendentes no Redis.
   */
  private async talvezFinalizar(sincronizacaoId: string): Promise<void> {
    const sinc = await this.prisma.cadastroSincronizacao.findUnique({
      where: { id: sincronizacaoId },
    });
    if (!sinc || !sinc.totalContribuintes || sinc.status !== 'EM_EXECUCAO') return;
    const processados = sinc.sucessos + sinc.erros;
    if (processados >= sinc.totalContribuintes) {
      await this.execucao.finalizar(
        sincronizacaoId,
        sinc.sucessos,
        sinc.erros,
        (sinc.errosPorUf as Record<string, number>) ?? {},
      );
    }
  }

  private mapSituacao(raw: string): SituacaoCadastral {
    const n = raw.toUpperCase();
    if (n.includes('NÃO HABILITADO') || n.includes('NAO HABILITADO')) return 'NAO_HABILITADO';
    if (n.includes('HABILITADO')) return 'HABILITADO';
    if (n.includes('SUSPENSO')) return 'SUSPENSO';
    if (n.includes('INAPTO')) return 'INAPTO';
    if (n.includes('BAIXADO') || n.includes('BAIXA')) return 'BAIXADO';
    return 'DESCONHECIDO';
  }
}
