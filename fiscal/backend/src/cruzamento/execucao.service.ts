import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  /** Filial de movimento (se informada ao iniciar). SA1/SA2 são compartilhadas; este campo é opcional. */
  filial: string | null;
  codigo: string;
  loja: string;
  /**
   * Snapshot Protheus no momento do enfileiramento — usado pelo
   * DivergenciaService para comparar com CCC/SEFAZ. Dados opcionais; se
   * ausentes, não há divergência gerada (mas a sync do contribuinte ainda
   * acontece normalmente).
   */
  protheusSnapshot?: {
    razaoSocial?: string | null;
    inscricaoEstadual?: string | null;
    cnae?: string | null;
    enderecoCep?: string | null;
    enderecoMunicipio?: string | null;
  };
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
   *
   * `janela` (opcional) sobrescreve o calculo padrao de `comMovimentoDesde`
   * baseado no tipo. Usado no disparo manual com data personalizada — o
   * usuario escolhe exatamente o periodo a reprocessar.
   *
   * Limitacao conhecida (21/04/2026): a API Protheus atual suporta apenas
   * `comMovimentoDesde` (data inicial). `janela.fim` e gravado em
   * `fiscal.cadastro_sincronizacao` para documentacao, mas nao e aplicado
   * na consulta. Pedido de `comMovimentoAte` registrado em MELHORIAS_BACKLOG.
   */
  async iniciar(
    tipo: TipoSincronizacao,
    disparadoPor: string,
    janela?: { inicio: Date; fim: Date },
  ): Promise<string> {
    const ambienteCfg = await this.ambiente.getOrCreate();
    if (ambienteCfg.pauseSync && tipo !== 'PONTUAL') {
      throw new ConflictException({
        erro: 'FREIO_DE_MAO_ATIVO',
        mensagem: 'Sincronização pausada pelo ADMIN_TI (freio de mão ativo). Desative em Administração antes de disparar uma nova execução.',
      });
    }

    // Guard concorrência + cooldown (pulando para PONTUAL — consulta isolada
    // por chave/CNPJ não tem efeito cumulativo em SEFAZ que justifique bloquear).
    if (tipo !== 'PONTUAL') {
      await this.guardConcorrenciaECooldown(tipo);
    }

    const sinc = await this.prisma.cadastroSincronizacao.create({
      data: {
        tipo,
        status: 'EM_EXECUCAO',
        disparadoPor,
        iniciadoEm: new Date(),
        janelaInicio: janela?.inicio,
        janelaFim: janela?.fim,
      },
    });
    this.logger.log(
      `Execução ${sinc.id.slice(0, 8)} iniciada (tipo=${tipo}, por=${disparadoPor}` +
        (janela ? `, janela=${janela.inicio.toISOString().slice(0, 10)}→${janela.fim.toISOString().slice(0, 10)}` : '') +
        ')',
    );

    // Carrega a base de contribuintes conforme o modo (janela sobrescreve padrao)
    const registros = await this.carregarBase(tipo, janela);
    this.logger.log(`Execução ${sinc.id.slice(0, 8)}: ${registros.length} registros para processar`);

    // Snapshot
    await this.prisma.protheusSnapshot.create({
      data: {
        sincronizacaoId: sinc.id,
        tipo: registros.some((r) => r.origem === 'SA2010') ? 'SA2010' : 'SA1010',
        quantidade: registros.length,
      },
    });

    // Dedup por (cnpj, uf) — Plano v2.0 §6.2 camada 1: mesmo CNPJ em várias NFs
    // do bloco vira UMA consulta SEFAZ. Mantém o primeiro registro encontrado
    // (vínculo Protheus do primeiro é representativo).
    const vistos = new Set<string>();
    const deduplicados: typeof registros = [];
    for (const r of registros) {
      const uf = this.ufFromRegistro(r);
      const key = `${r.cnpj}|${uf}`;
      if (vistos.has(key)) continue;
      vistos.add(key);
      deduplicados.push(r);
    }
    if (deduplicados.length < registros.length) {
      this.logger.log(
        `Dedup: ${registros.length} registros → ${deduplicados.length} CNPJs distintos (economia ${registros.length - deduplicados.length})`,
      );
    }

    // Janela semanal (Plano v2.2 — alinhado com setor fiscal em 22/04/2026):
    // cada CNPJ/UF é consultado no SEFAZ no máximo 1x por semana corrente
    // (domingo 00:00 BRT → sábado 23:59 BRT). Protege a cota diária SEFAZ e
    // reflete o fato de que o estado cadastral raramente muda na mesma semana.
    //
    // MANUAL e PONTUAL NÃO respeitam a janela — o operador dispara de propósito
    // quando precisa de dado fresco (ex: cliente regularizou, ligou avisando).
    const respeitaJanelaSemanal = tipo === 'MOVIMENTO_MEIO_DIA' || tipo === 'MOVIMENTO_MANHA_SEGUINTE';
    let filtrados = deduplicados;
    let puladosSemanais = 0;
    if (respeitaJanelaSemanal && deduplicados.length > 0) {
      const cutoff = this.inicioSemanaBRT();
      const jaConsultados = await this.prisma.cadastroContribuinte.findMany({
        where: {
          ultimaConsultaCccEm: { gte: cutoff },
          OR: deduplicados.map((r) => ({ cnpj: r.cnpj, uf: this.ufFromRegistro(r) })),
        },
        select: { cnpj: true, uf: true },
      });
      const chavesJa = new Set(jaConsultados.map((c) => `${c.cnpj}|${c.uf}`));
      filtrados = deduplicados.filter((r) => !chavesJa.has(`${r.cnpj}|${this.ufFromRegistro(r)}`));
      puladosSemanais = deduplicados.length - filtrados.length;
      if (puladosSemanais > 0) {
        this.logger.log(
          `Janela semanal (desde ${cutoff.toISOString()}): ${deduplicados.length} candidatos → ${filtrados.length} novos (${puladosSemanais} já consultados nesta semana).`,
        );
      }
    }

    // Atualiza total com o número efetivo de jobs que serão enfileirados
    await this.prisma.cadastroSincronizacao.update({
      where: { id: sinc.id },
      data: { totalContribuintes: filtrados.length },
    });

    if (filtrados.length === 0) {
      if (puladosSemanais > 0) {
        this.logger.log(
          `Execução ${sinc.id.slice(0, 8)}: nada a consultar — todos os ${puladosSemanais} CNPJs já foram consultados nesta semana.`,
        );
      }
      await this.finalizar(sinc.id, 0, 0, {});
      return sinc.id;
    }

    // Enfileira jobs
    const jobs = filtrados.map((r) => ({
      name: 'ccc-consulta',
      data: {
        sincronizacaoId: sinc.id,
        cnpj: r.cnpj,
        uf: this.ufFromRegistro(r),
        origem: r.origem,
        filial: r.filial ?? null,
        codigo: r.codigo,
        loja: r.loja,
        // Contrato Protheus v3 (23/04/2026) — campos encurtados.
        // Snapshot interno mantém naming descritivo (DivergenciaService compara
        // contra este shape, não contra o payload v3 cru).
        protheusSnapshot: {
          razaoSocial: r.razSoc ?? null,
          inscricaoEstadual: r.inscIE ?? null,
          cnae: r.cnae ?? null,
          enderecoCep: r.endereco?.cep ?? null,
          enderecoMunicipio: r.endereco?.municip ?? null,
        },
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
   * Cooldown em minutos entre execuções finalizadas do mesmo tipo.
   * PONTUAL fica fora desta proteção (consultas isoladas por chave).
   *
   * - MOVIMENTO_MEIO_DIA / MOVIMENTO_MANHA_SEGUINTE: 6h. O cron roda 2x/dia
   *   (12:00 e 06:00 D+1) e cobre janelas contíguas. Rodar de novo em < 6h
   *   re-consulta os mesmos CNPJs no SEFAZ, duplicando consumo sem ganho.
   * - MANUAL: 15 min. Protege contra duplo-clique e engano rápido, mas
   *   permite correção ágil se o operador errou a janela.
   */
  private static readonly COOLDOWN_MIN: Record<TipoSincronizacao, number> = {
    MOVIMENTO_MEIO_DIA: 6 * 60,
    MOVIMENTO_MANHA_SEGUINTE: 6 * 60,
    MANUAL: 15,
    PONTUAL: 0,
  };

  /**
   * Bloqueia o disparo de uma nova execução se:
   *   1. Já existe execução EM_EXECUCAO do mesmo tipo (protege contra
   *      duplo-clique e cliques em paralelo — backend não deve aceitar 2
   *      execuções concorrentes do mesmo tipo).
   *   2. Última execução CONCLUIDA do mesmo tipo foi há menos que o cooldown
   *      configurado (protege contra reprocessamento desnecessário que
   *      duplica consumo SEFAZ sem ganho real — dedup é por execução,
   *      não entre execuções).
   *
   * Lança ConflictException com código estruturado que a UI usa para
   * disabilitar botão correto e mostrar a data/hora de disponibilidade.
   */
  private async guardConcorrenciaECooldown(tipo: TipoSincronizacao): Promise<void> {
    // 1. Já existe execução do mesmo tipo em curso?
    const emCurso = await this.prisma.cadastroSincronizacao.findFirst({
      where: { tipo, status: 'EM_EXECUCAO', finalizadoEm: null },
      orderBy: { iniciadoEm: 'desc' },
    });
    if (emCurso) {
      throw new ConflictException({
        erro: 'EXECUCAO_JA_EM_CURSO',
        mensagem:
          `Já existe uma execução ${tipo} em curso desde ${emCurso.iniciadoEm.toLocaleString('pt-BR')}. ` +
          `Aguarde concluir ou cancele antes de disparar outra.`,
        sincronizacaoEmCurso: emCurso.id,
      });
    }

    // 2. Passou o cooldown desde a última CONCLUIDA do mesmo tipo?
    const cooldownMin = ExecucaoService.COOLDOWN_MIN[tipo];
    if (cooldownMin > 0) {
      const ultima = await this.prisma.cadastroSincronizacao.findFirst({
        where: { tipo, status: 'CONCLUIDA', finalizadoEm: { not: null } },
        orderBy: { finalizadoEm: 'desc' },
      });
      if (ultima?.finalizadoEm) {
        const msDesde = Date.now() - ultima.finalizadoEm.getTime();
        const cooldownMs = cooldownMin * 60_000;
        if (msDesde < cooldownMs) {
          const disponivelEm = new Date(ultima.finalizadoEm.getTime() + cooldownMs);
          throw new ConflictException({
            erro: 'EXECUCAO_EM_COOLDOWN',
            mensagem:
              `Já houve uma execução ${tipo} concluída em ${ultima.finalizadoEm.toLocaleString('pt-BR')}. ` +
              `Aguarde até ${disponivelEm.toLocaleString('pt-BR')} (cooldown de ${cooldownMin}min) para disparar novamente.`,
            ultimaExecucaoId: ultima.id,
            ultimaFinalizadoEm: ultima.finalizadoEm,
            disponivelEm,
            cooldownMinutos: cooldownMin,
          });
        }
      }
    }
  }

  /**
   * Snapshot do estado operacional por tipo para a UI do /execucoes.
   * Para cada tipo bloqueável (todos exceto PONTUAL), devolve:
   *   - emCurso: se há execução EM_EXECUCAO (id + iniciadoEm)
   *   - ultimaConcluida: última finalização CONCLUIDA (id + finalizadoEm + contadores)
   *   - disponivelEm: Date a partir de quando o tipo pode ser disparado (se em cooldown)
   *   - cooldownMinutos: duração do cooldown do tipo
   *   - bloqueadoPor: motivo estruturado ('EM_CURSO' | 'COOLDOWN' | null)
   *
   * UI consome para desabilitar a opção correspondente no modal "Nova execução"
   * e para renderizar o banner de status no topo da lista.
   */
  async statusExecucaoPorTipo(): Promise<
    Array<{
      tipo: TipoSincronizacao;
      cooldownMinutos: number;
      emCurso: { id: string; iniciadoEm: Date; disparadoPor: string | null } | null;
      ultimaConcluida: {
        id: string;
        finalizadoEm: Date;
        totalContribuintes: number | null;
        sucessos: number;
        erros: number;
      } | null;
      disponivelEm: Date | null;
      bloqueadoPor: 'EM_CURSO' | 'COOLDOWN' | null;
    }>
  > {
    const tipos: TipoSincronizacao[] = [
      'MOVIMENTO_MEIO_DIA',
      'MOVIMENTO_MANHA_SEGUINTE',
      'MANUAL',
    ];

    const agora = Date.now();
    const resultado = await Promise.all(
      tipos.map(async (tipo) => {
        const cooldownMin = ExecucaoService.COOLDOWN_MIN[tipo];
        const [emCurso, ultimaConcluida] = await Promise.all([
          this.prisma.cadastroSincronizacao.findFirst({
            where: { tipo, status: 'EM_EXECUCAO', finalizadoEm: null },
            orderBy: { iniciadoEm: 'desc' },
            select: { id: true, iniciadoEm: true, disparadoPor: true },
          }),
          this.prisma.cadastroSincronizacao.findFirst({
            where: { tipo, status: 'CONCLUIDA', finalizadoEm: { not: null } },
            orderBy: { finalizadoEm: 'desc' },
            select: {
              id: true,
              finalizadoEm: true,
              totalContribuintes: true,
              sucessos: true,
              erros: true,
            },
          }),
        ]);

        let disponivelEm: Date | null = null;
        let bloqueadoPor: 'EM_CURSO' | 'COOLDOWN' | null = null;
        if (emCurso) {
          bloqueadoPor = 'EM_CURSO';
        } else if (ultimaConcluida?.finalizadoEm && cooldownMin > 0) {
          const fim = ultimaConcluida.finalizadoEm.getTime() + cooldownMin * 60_000;
          if (agora < fim) {
            disponivelEm = new Date(fim);
            bloqueadoPor = 'COOLDOWN';
          }
        }

        return {
          tipo,
          cooldownMinutos: cooldownMin,
          emCurso: emCurso && {
            id: emCurso.id,
            iniciadoEm: emCurso.iniciadoEm,
            disparadoPor: emCurso.disparadoPor,
          },
          ultimaConcluida: ultimaConcluida?.finalizadoEm
            ? {
                id: ultimaConcluida.id,
                finalizadoEm: ultimaConcluida.finalizadoEm,
                totalContribuintes: ultimaConcluida.totalContribuintes,
                sucessos: ultimaConcluida.sucessos,
                erros: ultimaConcluida.erros,
              }
            : null,
          disponivelEm,
          bloqueadoPor,
        };
      }),
    );

    return resultado;
  }

  /**
   * Cancela uma execução EM_EXECUCAO manualmente (ADMIN_TI na UI).
   * Marca como CANCELADA no banco + remove jobs da fila BullMQ associados.
   * Nao afeta jobs que ja comecaram a processar (BullMQ nao permite kill
   * seguro de job in-flight), mas evita que mais jobs pendentes rodem.
   */
  async cancelar(
    sincronizacaoId: string,
    canceladoPor: string,
  ): Promise<{ cancelada: boolean; jobsRemovidos: number }> {
    const sinc = await this.prisma.cadastroSincronizacao.findUnique({
      where: { id: sincronizacaoId },
    });
    if (!sinc) {
      throw new NotFoundException(`Execucao ${sincronizacaoId} nao encontrada`);
    }
    if (sinc.status !== 'EM_EXECUCAO') {
      throw new ConflictException({
        erro: 'STATUS_INVALIDO',
        mensagem: `Execucao nao pode ser cancelada (status atual: ${sinc.status}). Apenas EM_EXECUCAO e cancelavel.`,
      });
    }

    // Remove jobs pendentes da fila associados a esta sincronizacao.
    let jobsRemovidos = 0;
    try {
      // Prefere jobs em wait/delayed/paused (nao iniciados). Active sao
      // mantidos — BullMQ nao permite abort seguro.
      const jobs = await this.queue.getJobs(['waiting', 'delayed', 'paused', 'wait'], 0, 10_000);
      for (const job of jobs) {
        if (job.data?.sincronizacaoId === sincronizacaoId) {
          await job.remove();
          jobsRemovidos++;
        }
      }
    } catch (err) {
      this.logger.warn(
        `Falha ao remover jobs da fila para execucao ${sincronizacaoId}: ${(err as Error).message}`,
      );
    }

    const observacao =
      `[${new Date().toISOString()}] Execucao cancelada manualmente por ${canceladoPor}. ` +
      `${jobsRemovidos} job(s) pendente(s) removidos da fila.`;

    await this.prisma.cadastroSincronizacao.update({
      where: { id: sincronizacaoId },
      data: {
        status: 'CANCELADA',
        finalizadoEm: new Date(),
        observacoes: sinc.observacoes ? `${sinc.observacoes}\n${observacao}` : observacao,
      },
    });

    this.logger.warn(
      `Execucao ${sincronizacaoId.slice(0, 8)} cancelada por ${canceladoPor}, ${jobsRemovidos} jobs removidos.`,
    );

    return { cancelada: true, jobsRemovidos };
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
  private async carregarBase(
    tipo: TipoSincronizacao,
    janela?: { inicio: Date; fim: Date },
  ): Promise<RegistroComOrigem[]> {
    const registros: RegistroComOrigem[] = [];
    const comMovimentoDesde = janela
      ? this.toYmd(janela.inicio)
      : this.comMovimentoDesdeForTipo(tipo);

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
        for (const r of resp.itens) {
          registros.push({ ...r, origem: tipoTabela });
        }
        // Loop-break: contrato v1 não retorna totalPaginas; usamos o próprio
        // tamanho da página para detectar fim (itens < porPagina = última).
        const totalPaginas = resp.paginacao?.totalPaginas;
        if (totalPaginas !== undefined) {
          if (pagina >= totalPaginas) break;
        } else if (resp.itens.length < porPagina) {
          break;
        }
        pagina++;
      }
    }
    return registros;
  }

  /**
   * Janela de movimento por tipo (Plano v2.0 §2.1):
   *   MOVIMENTO_MEIO_DIA         → hoje 00:00 → 12:00 (captura no pregão 12:00)
   *   MOVIMENTO_MANHA_SEGUINTE   → ontem 12:00 → 23:59 (captura na corrida 06:00)
   *   MANUAL                     → últimas 24h
   *   PONTUAL                    → não passa por cruzamento batch
   *
   * Formato de retorno: YYYYMMDD (bate com `comMovimentoDesde` da API Protheus v1).
   */
  private comMovimentoDesdeForTipo(tipo: TipoSincronizacao): string | undefined {
    const hoje = new Date();
    if (tipo === 'MOVIMENTO_MEIO_DIA') {
      return this.toYmd(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
    }
    if (tipo === 'MOVIMENTO_MANHA_SEGUINTE') {
      const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
      return this.toYmd(ontem);
    }
    if (tipo === 'MANUAL') {
      const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return this.toYmd(ontem);
    }
    return undefined;
  }

  private toYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${dd}`;
  }

  private ufFromRegistro(r: RegistroComOrigem): string {
    // `inscUF` é o campo v3 (antes `inscricaoEstadualUF`).
    return r.endereco?.uf ?? r.inscUF ?? 'MG';
  }

  /**
   * Início da semana corrente em horário de Brasília (domingo 00:00 BRT),
   * retornado como Date em UTC pronto para comparação com `ultimaConsultaCccEm`.
   *
   * Regra do setor fiscal (22/04/2026): janela semanal domingo→sábado.
   * O container roda em UTC, então convertemos via pt-BR locale + offset fixo
   * BRT=UTC-3 (Brasil não adota mais DST desde 2019 — Dec. 9.772/2019).
   */
  private inicioSemanaBRT(): Date {
    // "Agora" em BRT: UTC menos 3 horas — independe de DST (abolido em 2019).
    const agoraBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const diaSemana = agoraBRT.getUTCDay(); // 0=domingo ... 6=sábado
    // Domingo 00:00 BRT da semana corrente (em UTC = domingo 03:00 UTC)
    const domingoBRT = new Date(agoraBRT);
    domingoBRT.setUTCDate(agoraBRT.getUTCDate() - diaSemana);
    domingoBRT.setUTCHours(0, 0, 0, 0);
    // Converter de volta para UTC "real" adicionando 3h
    return new Date(domingoBRT.getTime() + 3 * 60 * 60 * 1000);
  }
}
