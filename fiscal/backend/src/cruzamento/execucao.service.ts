import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUE_CRUZAMENTO } from '../bullmq/bullmq.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProtheusCadastroService } from '../protheus/protheus-cadastro.service.js';
import { AmbienteService } from '../ambiente/ambiente.service.js';
import { AlertasService } from '../alertas/alertas.service.js';
import type {
  CadastroFiscalRegistro,
  TipoCadastroProtheus,
} from '../protheus/interfaces/cadastro-fiscal.interface.js';
import type { TipoSincronizacao } from '@prisma/client';

type RegistroComOrigem = CadastroFiscalRegistro & { origem: TipoCadastroProtheus };

/**
 * Tipo de um job individual no fiscal:cruzamento.
 * 1 CNPJ por job — o worker consome isoladamente, respeita circuit breaker
 * e rate limit por UF.
 */
export interface CruzamentoJobData {
  sincronizacaoId: string;
  cnpj: string;
  uf: string;
  origem: TipoCadastroProtheus;
  filial: string;
  codigo: string;
  loja: string;
}

/**
 * ExecucaoService — ORQUESTRADOR do motor de cruzamento (Onda 2).
 *
 * Responsável por iniciar uma execução de cruzamento: cria o registro em
 * fiscal.cadastro_sincronizacao, lê SA1010/SA2010 do Protheus conforme o
 * tipo, e enfileira 1 job BullMQ por CNPJ. O worker (CruzamentoWorker)
 * consome cada job, faz a consulta CCC e persiste.
 *
 * Modos suportados (correspondem ao enum TipoSincronizacao do schema):
 *   - BOOTSTRAP / SEMANAL_AUTO / COMPLETA_MANUAL: varredura completa
 *   - DIARIA_AUTO / DIARIA_MANUAL: limitado ao movimento das últimas 24h
 *   - PONTUAL: 1 CNPJ — não passa por aqui, vai direto no CadastroService
 *
 * Após enfileirar tudo, marca a execução como EM_EXECUCAO e devolve o id.
 * O worker marca como CONCLUIDA quando o último job termina (via job counter).
 */
@Injectable()
export class ExecucaoService {
  private readonly logger = new Logger(ExecucaoService.name);

  constructor(
    @Inject(QUEUE_CRUZAMENTO) private readonly queue: Queue<CruzamentoJobData>,
    private readonly prisma: PrismaService,
    private readonly protheus: ProtheusCadastroService,
    private readonly ambiente: AmbienteService,
    private readonly alertas: AlertasService,
  ) {}

  /**
   * Inicia uma execução.
   * Retorna o id da sincronização imediatamente (assíncrona).
   */
  async iniciar(tipo: TipoSincronizacao, disparadoPor: string): Promise<string> {
    const ambienteCfg = await this.ambiente.getOrCreate();
    if (ambienteCfg.pauseSync && tipo !== 'PONTUAL') {
      throw new ConflictException({
        erro: 'FREIO_DE_MAO_ATIVO',
        mensagem: 'Sincronização pausada pelo ADMIN_TI (freio de mão ativo). Desative em Administração antes de disparar uma nova execução.',
      });
    }

    const sinc = await this.prisma.cadastroSincronizacao.create({
      data: {
        tipo,
        status: 'EM_EXECUCAO',
        disparadoPor,
        iniciadoEm: new Date(),
      },
    });
    this.logger.log(`Execução ${sinc.id.slice(0, 8)} iniciada (tipo=${tipo}, por=${disparadoPor})`);

    // Carrega a base de contribuintes conforme o modo
    const registros = await this.carregarBase(tipo);
    this.logger.log(`Execução ${sinc.id.slice(0, 8)}: ${registros.length} registros para processar`);

    // Snapshot
    await this.prisma.protheusSnapshot.create({
      data: {
        sincronizacaoId: sinc.id,
        tipo: registros.some((r) => r.origem === 'SA2010') ? 'SA2010' : 'SA1010',
        quantidade: registros.length,
      },
    });

    // Atualiza total
    await this.prisma.cadastroSincronizacao.update({
      where: { id: sinc.id },
      data: { totalContribuintes: registros.length },
    });

    if (registros.length === 0) {
      await this.finalizar(sinc.id, 0, 0, {});
      return sinc.id;
    }

    // Enfileira jobs
    const jobs = registros.map((r) => ({
      name: 'ccc-consulta',
      data: {
        sincronizacaoId: sinc.id,
        cnpj: r.cnpj,
        uf: this.ufFromRegistro(r),
        origem: r.origem,
        filial: r.filial,
        codigo: r.codigo,
        loja: r.loja,
      },
      opts: {
        attempts: 3,
        backoff: { type: 'exponential' as const, delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 500,
      },
    }));

    await this.queue.addBulk(jobs);
    this.logger.log(`Execução ${sinc.id.slice(0, 8)}: ${jobs.length} jobs enfileirados em fiscal:cruzamento`);
    return sinc.id;
  }

  /**
   * Finaliza uma execução — chamada pelo worker quando o contador de jobs
   * concluídos atinge o total. Atualiza status, dispara alertas digest.
   */
  async finalizar(
    sincronizacaoId: string,
    sucessos: number,
    erros: number,
    errosPorUf: Record<string, number>,
  ): Promise<void> {
    const status = erros === 0 ? 'CONCLUIDA' : 'CONCLUIDA_COM_ERROS';
    await this.prisma.cadastroSincronizacao.update({
      where: { id: sincronizacaoId },
      data: {
        status,
        finalizadoEm: new Date(),
        sucessos,
        erros,
        errosPorUf,
      },
    });
    this.logger.log(
      `Execução ${sincronizacaoId.slice(0, 8)} finalizada: status=${status} sucessos=${sucessos} erros=${erros}`,
    );

    // Se foi uma BOOTSTRAP bem-sucedida, marca o gate
    const sinc = await this.prisma.cadastroSincronizacao.findUnique({
      where: { id: sincronizacaoId },
    });
    if (sinc?.tipo === 'BOOTSTRAP' && status === 'CONCLUIDA') {
      await this.ambiente.marcarBootstrapConcluido(sinc.disparadoPor ?? 'sistema');
      this.logger.log(`Bootstrap concluído — gate liberado.`);
    }

    // Dispara alertas digest (não-bloqueante)
    this.alertas.enviarDigest(sincronizacaoId).catch((err) => {
      this.logger.error(`Falha ao enviar digest de ${sincronizacaoId}: ${(err as Error).message}`);
    });
  }

  // ----- privados -----

  /**
   * Carrega a base a ser processada conforme o tipo de execução.
   * Paginação interna — acumula em memória porque 116k registros ×
   * ~500 bytes/registro = ~60 MB, aceitável em runtime Node 22.
   */
  private async carregarBase(tipo: TipoSincronizacao): Promise<RegistroComOrigem[]> {
    const registros: RegistroComOrigem[] = [];
    const comMovimentoDesde = this.comMovimentoDesdeForTipo(tipo);

    for (const tipoTabela of ['SA1010', 'SA2010'] as TipoCadastroProtheus[]) {
      let pagina = 1;
      const porPagina = 500;
      while (true) {
        const resp = await this.protheus.listar({
          tipo: tipoTabela,
          ativo: true,
          comMovimentoDesde,
          pagina,
          porPagina,
        });
        for (const r of resp.registros) {
          registros.push({ ...r, origem: tipoTabela });
        }
        if (pagina >= resp.paginacao.totalPaginas) break;
        pagina++;
      }
    }
    return registros;
  }

  private comMovimentoDesdeForTipo(tipo: TipoSincronizacao): string | undefined {
    if (tipo === 'DIARIA_AUTO' || tipo === 'DIARIA_MANUAL') {
      const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return ontem.toISOString();
    }
    return undefined; // bootstrap / semanal / completa-manual = varredura total
  }

  private ufFromRegistro(r: RegistroComOrigem): string {
    return r.endereco?.uf ?? r.inscricaoEstadualUF ?? 'MG';
  }
}
