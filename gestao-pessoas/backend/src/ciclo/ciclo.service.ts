/**
 * CICLO — o contêiner: período, data-base, política e conceitos.
 *
 * O questionário não vive aqui: vive nas Aplicações, que é o que permite
 * modelos diferentes por perfil de centro de custo dentro do mesmo ciclo.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ONDE_A_AVALIACAO_CONTA } from '../avaliacao/avaliacoes-que-contam.js';
import { assertCicloOperavel } from './ciclo-operavel.js';
import { estadoAoVoltar } from '../avaliacao/descancelamento.js';
import { STATUS_VIVOS } from '../avaliacao/cancelamento.js';
import { MOTIVO_MINIMO_EM_MASSA, faltamCaracteres } from '../common/motivo.js';
import {
  CicloNaoAbrivelError,
  assertCicloAbrivel,
  avisosParaAbrir,
  problemasParaAbrir,
  validarConceitos,
  type AplicacaoParaValidar,
  type FaixaConceito,
} from './abertura.validator.js';

export interface DadosCiclo {
  nome: string;
  periodoInicio: Date;
  periodoFim: Date;
  /** Congela TODO cálculo temporal do ciclo. Nunca `now()`. */
  dataBase: Date;
  janelaTreinamentoMeses?: number;
  incluirAfastados?: boolean;
  valeParaMerito?: boolean;
  /** Alcança só parte da empresa? Ver `marcarRecorte`. */
  ehRecorte?: boolean;
  conceitos: (FaixaConceito & { cor?: string | null; ordem: number })[];
}

@Injectable()
export class CicloService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async criar(dados: DadosCiclo, usuarioId: string) {
    this.validarPeriodo(dados);

    const ciclo = await this.prisma.ciclo.create({
      data: {
        nome: dados.nome,
        periodoInicio: dados.periodoInicio,
        periodoFim: dados.periodoFim,
        dataBase: dados.dataBase,
        janelaTreinamentoMeses: dados.janelaTreinamentoMeses ?? 12,
        incluirAfastados: dados.incluirAfastados ?? false,
        valeParaMerito: dados.valeParaMerito ?? false,
        ehRecorte: dados.ehRecorte ?? false,
        conceitos: {
          create: dados.conceitos.map((c) => ({
            descricao: c.descricao,
            limiteInferior: c.limiteInferior,
            limiteSuperior: c.limiteSuperior,
            cor: c.cor ?? null,
            ordem: c.ordem,
          })),
        },
      },
      include: { conceitos: true },
    });

    await this.auditoria.registrar({
      entidade: 'Ciclo',
      entidadeId: ciclo.id,
      acao: 'CRIAR',
      usuarioId,
      valorNovo: {
        nome: ciclo.nome,
        dataBase: ciclo.dataBase,
        valeParaMerito: ciclo.valeParaMerito,
        ehRecorte: ciclo.ehRecorte,
      },
    });
    return ciclo;
  }

  /**
   * ⭐ DECLARA O ALCANCE do ciclo: empresa inteira ou recorte.
   *
   * Muda o que o painel AFIRMA sobre quem ficou fora de todas as aplicações —
   * pendência a montar, ou informação sobre gente que este ciclo nunca quis
   * alcançar. Não toca em público, designação nem nota.
   *
   * ⚠️ Sem guarda de status, e isso é decisão: ver o comentário da rota no
   * controller. O ato é registrado na auditoria com o valor ANTERIOR, que é o
   * que responde depois "desde quando este ciclo é recorte".
   */
  async marcarRecorte(cicloId: string, ehRecorte: boolean, usuarioId: string) {
    const antes = await this.prisma.ciclo.findUnique({
      where: { id: cicloId },
      select: { id: true, ehRecorte: true },
    });
    if (!antes) throw new NotFoundException('Ciclo não encontrado.');

    // Nada a fazer, e nada a registrar: auditoria de não-mudança é ruído que
    // atrapalha justamente quem foi ler a auditoria para achar a mudança.
    if (antes.ehRecorte === ehRecorte) return { id: cicloId, ehRecorte };

    const ciclo = await this.prisma.ciclo.update({
      where: { id: cicloId },
      data: { ehRecorte },
      select: { id: true, ehRecorte: true },
    });
    await this.auditoria.registrar({
      entidade: 'Ciclo',
      entidadeId: cicloId,
      acao: 'MARCAR_RECORTE',
      usuarioId,
      valorAnterior: { ehRecorte: antes.ehRecorte },
      valorNovo: { ehRecorte },
    });
    return ciclo;
  }

  /**
   * ⭐ O HISTÓRICO DE REABERTURA — porque **um ciclo reaberto duas vezes é
   * informação, não detalhe**.
   *
   * 🔒 A tabela guarda só a ÚLTIMA reabertura (colunas únicas); a contagem vem de
   * `rh.auditoria`, que guarda todas. **Não troque por um campo da tabela.**
   * Parece simplificação — uma consulta a menos — e apaga a informação sem nada
   * acusar: a tela continua funcionando, o número continua aparecendo, e passa a
   * dizer "1×" sempre. Se incomodar, o caminho é uma coluna `reaberturas`
   * incrementada aqui, nunca derivar do `reabertoEm`. O nome de quem reabriu sai de
   * `core.usuarios` por `$queryRaw` — `core` é read-only aqui, como na Logística
   * e no Fiscal.
   */
  async historicoDeReabertura(cicloId: string) {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id: cicloId },
      select: { reabertoEm: true, reabertoPorId: true, motivoReabertura: true },
    });
    if (!ciclo?.reabertoEm) return { reaberturas: 0, ultima: null };

    const [reaberturas, nome] = await Promise.all([
      this.prisma.auditoria.count({
        where: { entidade: 'Ciclo', entidadeId: cicloId, acao: 'REABRIR' },
      }),
      this.nomeDoUsuario(ciclo.reabertoPorId),
    ]);
    return {
      reaberturas: Math.max(reaberturas, 1),
      ultima: { em: ciclo.reabertoEm, por: nome, motivo: ciclo.motivoReabertura },
    };
  }

  /** `core` é read-only: consulta por SQL cru, como os outros módulos fazem. */
  private async nomeDoUsuario(usuarioId: string | null): Promise<string | null> {
    if (!usuarioId) return null;
    const linhas = await this.prisma.$queryRaw<{ nome: string | null }[]>(
      Prisma.sql`SELECT nome FROM "core"."usuarios" WHERE id = ${usuarioId} LIMIT 1`,
    );
    return linhas[0]?.nome ?? null;
  }

  /**
   * O que falta para o ciclo poder abrir — a lista VIVA, para a tela mostrar
   * antes do clique. Roda a MESMA função da abertura sobre os MESMOS dados
   * (`carregarParaAbertura`), então não existe "a tela achava que dava".
   */
  async pendenciasParaAbrir(cicloId: string): Promise<string[]> {
    const ciclo = await this.carregarParaAbertura(cicloId);
    return problemasParaAbrir(this.aplicacoesParaValidar(ciclo), this.conceitosParaValidar(ciclo));
  }

  /**
   * ABRIR — a última porta antes de gerar nota. Valida tudo de uma vez (§4.6):
   * conceitos contíguos, aplicações com `pesoAvaliacao > 0`, critérios ativos e
   * com resolver registrado, e nenhum modelo de demonstração.
   */
  async abrir(cicloId: string, usuarioId: string) {
    const ciclo = await this.carregarParaAbertura(cicloId);
    if (ciclo.status !== 'RASCUNHO') {
      throw new BadRequestException(
        `O ciclo está ${ciclo.status} — só um ciclo em RASCUNHO pode ser aberto.`,
      );
    }

    const aplicacoes = this.aplicacoesParaValidar(ciclo);
    const conceitos = this.conceitosParaValidar(ciclo);

    try {
      assertCicloAbrivel(aplicacoes, conceitos);
    } catch (e) {
      if (e instanceof CicloNaoAbrivelError) throw new BadRequestException(e.problemas);
      throw e;
    }

    const aberto = await this.prisma.ciclo.update({
      where: { id: cicloId },
      data: { status: 'ABERTO', abertoEm: new Date() },
    });
    await this.auditoria.registrar({
      entidade: 'Ciclo',
      entidadeId: cicloId,
      acao: 'ABRIR',
      usuarioId,
      valorNovo: { aplicacoes: aplicacoes.length },
    });
    return aberto;
  }

  /** ⚠️ Um mapeamento só: a lista viva e a guarda leem o ciclo do mesmo jeito. */
  private aplicacoesParaValidar(
    ciclo: Awaited<ReturnType<CicloService['carregarParaAbertura']>>,
    /** Quantos valores INFORMADOS já existem no ciclo, por critério. */
    valoresPorCriterio: ReadonlyMap<string, number> = new Map(),
  ): AplicacaoParaValidar[] {
    return ciclo.aplicacoes.map((a) => ({
      nome: a.nome,
      pessoasNoPublico: a._count.publico,
      pesoAvaliacao: Number(a.pesoAvaliacao),
      modeloFinalidade: a.modeloVersao.modelo.finalidade,
      versaoPublicada: a.modeloVersao.publicadoEm !== null,
      criterios: a.criterios.map((ac) => ({
        peso: Number(ac.peso),
        valoresInformadosNoCiclo: valoresPorCriterio.get(ac.criterioId) ?? 0,
        criterio: {
          codigo: ac.criterio.codigo,
          nome: ac.criterio.nome,
          origem: ac.criterio.origem,
          codigoCalculo: ac.criterio.codigoCalculo,
          ativo: ac.criterio.ativo,
        },
      })),
    }));
  }

  /**
   * Quantos valores INFORMADOS existem neste ciclo, por critério. Um `groupBy`
   * só — a alternativa seria uma consulta por critério dentro do laço.
   */
  private async valoresInformadosPorCriterio(cicloId: string): Promise<Map<string, number>> {
    const linhas = await this.prisma.criterioValorInformado.groupBy({
      by: ['criterioId'],
      where: { cicloId },
      _count: { _all: true },
    });
    return new Map(linhas.map((l) => [l.criterioId, l._count._all]));
  }

  /**
   * ⭐ Os AVISOS da abertura — o que não impede abrir, mas quem abre precisa
   * saber. Hoje: critério INFORMADO sem nenhum valor no ciclo.
   *
   * ⚠️ Separado de `pendenciasParaAbrir` de propósito: misturar as duas listas
   * faria o aviso parecer impedimento, e a tela mostraria "não pode abrir" para
   * algo que pode.
   */
  async avisosParaAbrirCiclo(cicloId: string): Promise<string[]> {
    const [ciclo, valores] = await Promise.all([
      this.carregarParaAbertura(cicloId),
      this.valoresInformadosPorCriterio(cicloId),
    ]);
    return avisosParaAbrir(this.aplicacoesParaValidar(ciclo, valores));
  }

  private conceitosParaValidar(ciclo: { conceitos: { descricao: string; limiteInferior: unknown; limiteSuperior: unknown }[] }) {
    return ciclo.conceitos.map((c) => ({
      descricao: c.descricao,
      limiteInferior: Number(c.limiteInferior),
      limiteSuperior: Number(c.limiteSuperior),
    }));
  }

  /**
   * ⭐⭐ ENCERRAR — e a saída para a pendência que NÃO vai entrar (08/09).
   *
   * Exigir 100% enviado, sem exceção, tranca o ciclo para sempre no dia em que
   * alguém sai da empresa, entra em licença longa ou simplesmente não responde:
   * a avaliação fica PENDENTE, ninguém pode respondê-la, e o encerrar continua
   * contando-a. Piloto (891) e Geral (5) estão nesse estado hoje.
   *
   * A saída é a MESMA da Logística no RDV, que já roda em produção: **a API
   * recusa e diz quantas são**; só encerra com `confirmarPendentes`, e aí as
   * pendentes viram CANCELADA **com o motivo escrito**. Nada é apagado — as
   * respostas parciais ficam registradas e fora da apuração, e o painel mostra
   * a contagem de canceladas, que é onde o custo do override fica à vista.
   *
   * ⚠️ Motivo OBRIGATÓRIO e auditado. Sem isso o override vira o caminho fácil
   * e, três ciclos adiante, ninguém encerra sem ele.
   * ⚠️ RH_ADMIN só — mesmo degrau do reabrir, garantido no controller.
   */
  async encerrar(
    cicloId: string,
    usuarioId: string,
    opcoes: { confirmarPendentes?: boolean; motivo?: string } = {},
  ) {
    const ciclo = await this.prisma.ciclo.findUnique({ where: { id: cicloId } });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');
    // ⚠️ Só de ABERTO. `EM_APURACAO` estava aqui como origem possível e **nada
    // no código jamais o produziu** — saiu do enum em 07/09/2026.
    if (ciclo.status !== 'ABERTO') {
      throw new BadRequestException(
        ciclo.status === 'ENCERRADO'
          ? 'Este ciclo já está encerrado. Para mexer nele, reabra o ciclo — é ato do RH_ADMIN, exige motivo e fica registrado.'
          : `O ciclo está ${ciclo.status} e não pode ser encerrado — só um ciclo ABERTO encerra.`,
      );
    }

    // Encerrar com avaliação pendente encerraria em silêncio — a API recusa e
    // diz QUANTAS são, para a tela poder perguntar em vez de adivinhar.
    //
    // ⚠️ Esta contagem e o `updateMany` que cancela, mais abaixo, são as DUAS
    // METADES DO MESMO ATO: quantas contar aqui e quais cancelar lá. Os dois
    // conjuntos têm de ser o mesmo — por isso saem de `STATUS_VIVOS`, e não de
    // duas listas escritas à mão. Divergindo, o número da recusa passa a falar
    // de um conjunto e o encerramento cancela outro, sem erro nenhum.
    const pendentes = await this.prisma.avaliacao.count({
      where: { cicloId, status: { in: [...STATUS_VIVOS] } },
    });
    const motivo = opcoes.motivo?.trim() ?? '';
    if (pendentes > 0 && !opcoes.confirmarPendentes) {
      // ⭐ A recusa DIZ QUANTAS e DIZ A SAÍDA. Recusa sem alternativa manda a
      // pessoa procurar sozinha um caminho — e o que ela acha é criar outro
      // ciclo, que duplica resultado sem ninguém decidir.
      throw new BadRequestException(
        `Não é possível encerrar — ainda não enviadas: ${pendentes}. ` +
          'Se não vão entrar (pessoa desligada, afastada, avaliador que não vai responder), ' +
          // ⚠️ Nem número colado em palavra que concorda, NEM pronome: "elas ficam"
          // quebra com pendência única do mesmo jeito que "as N avaliação(ões)".
          // Ver a nota de forma em `painel/proximo-passo.ts`.
          'encerre com pendência: exige confirmação e motivo escrito, e cada uma fica ' +
          'registrada como CANCELADA — nada é apagado, e a contagem aparece no painel.',
      );
    }
    // ⚠️ Mínimo MAIOR aqui do que nos atos de uma linha: esta frase vai ser a
    // única explicação que sobra para dezenas de pessoas, e 3 caracteres
    // ("xpt") passavam. Ver `common/motivo.ts`.
    if (pendentes > 0 && motivo.length < MOTIVO_MINIMO_EM_MASSA) {
      throw new BadRequestException(
        'Informe o motivo de encerrar com pendência. Ele fica registrado no ciclo e em cada ' +
          'avaliação cancelada — é o que responde, meses depois, por que estas ficaram sem nota. ' +
          faltamCaracteres(motivo, MOTIVO_MINIMO_EM_MASSA),
      );
    }

    const encerrado = await this.prisma.$transaction(async (tx) => {
      if (pendentes > 0) {
        await tx.avaliacao.updateMany({
          // A outra metade do ato — mesmo conjunto que foi contado acima.
          where: { cicloId, status: { in: [...STATUS_VIVOS] } },
          data: {
            status: 'CANCELADA',
            canceladaEm: new Date(),
            canceladaPorId: usuarioId,
            motivoCancelamento: `Ciclo encerrado com pendência: ${motivo}`,
            // ⭐ UM ato sobre N avaliações — e é por isso que o desfazer dele é
            // em massa, por ciclo, e não pelo Incluir de cada linha.
            origemCancelamento: 'ENCERRAMENTO',
          },
        });
      }
      const ciclo = await tx.ciclo.update({
        where: { id: cicloId },
        data: { status: 'ENCERRADO', encerradoEm: new Date() },
      });
      await this.auditoria.registrar({
        entidade: 'Ciclo',
        entidadeId: cicloId,
        // ⚠️ Ação DIFERENTE quando houve override: "ENCERRAR" e "encerrar
        // cancelando 891 avaliações" não podem ter o mesmo nome na auditoria.
        acao: pendentes > 0 ? 'ENCERRAR_COM_PENDENCIA' : 'ENCERRAR',
        usuarioId,
        valorNovo: pendentes > 0 ? { canceladas: pendentes, motivo } : undefined,
      });
      return ciclo;
    });
    return { ...encerrado, canceladas: pendentes };
  }

  /**
   * ⭐⭐ REABRIR O CICLO — a porta que faz a recusa do encerrado ser honesta.
   *
   * Mesmo desenho do reabrir AVALIAÇÃO: `RH_ADMIN`, **motivo obrigatório**,
   * auditado, e o rastro fica no registro (`reabertoEm`, `reabertoPorId`,
   * `motivoReabertura`) ao lado do `encerradoEm`, que **não se apaga** — a
   * história é que ele foi encerrado e depois reaberto, não que nunca encerrou.
   *
   * ⚠️ **Volta para ABERTO, nunca para RASCUNHO.** RASCUNHO reabriria a porta de
   * criar aplicação e mudar peso — e peso mudado depois de existir resultado é
   * reapuração silenciosa, com nota diferente para quem já recebeu devolutiva.
   * Reabrir é para corrigir o que aconteceu DENTRO do ciclo (designação,
   * avaliação, apuração), não para remontá-lo.
   */
  /**
   * ⭐⭐ DEVOLVER as canceladas pelo ENCERRAMENTO — a prévia, e depois o ato.
   *
   * A granularidade é a do ato que causou (decisão de 11/09): o encerramento
   * com pendência foi **UM ato sobre N avaliações, com UM motivo**, então o
   * desfazer é em massa e por ciclo. O que o RH excluiu linha a linha se desfaz
   * linha a linha, pelo **Incluir** — e esta rota recusa essas, com a frase
   * dizendo onde elas se desfazem.
   *
   * ⚠️ Só `ENCERRAMENTO`, e é o filtro que a coluna `origemCancelamento` existe
   * para permitir sem parsear o texto do motivo.
   */
  async previaDaDevolucao(cicloId: string) {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id: cicloId },
      select: { id: true, status: true, encerradoEm: true },
    });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');

    const linhas = await this.prisma.avaliacao.findMany({
      where: { cicloId, status: 'CANCELADA', origemCancelamento: 'ENCERRAMENTO' },
      select: {
        id: true,
        avaliadoId: true,
        motivoCancelamento: true,
        _count: { select: { respostas: true } },
      },
      orderBy: { criadoEm: 'asc' },
    });

    const nomes = await this.prisma.colaborador.findMany({
      where: { id: { in: linhas.map((l) => l.avaliadoId) } },
      select: { id: true, nome: true, matricula: true },
    });
    const porId = new Map(nomes.map((c) => [c.id, c]));

    return {
      /** ⚠️ ABERTO é condição do ATO, não da prévia — a prévia serve para
       *  decidir SE vale reabrir o ciclo, e por isso responde com ele fechado. */
      cicloAberto: ciclo.status === 'ABERTO',
      total: linhas.length,
      /** Quantas voltam com trabalho já feito — é o que muda a conversa. */
      comRespostas: linhas.filter((l) => l._count.respostas > 0).length,
      /** O motivo é UM só para todas: foi um ato. Mostrado uma vez, não N. */
      motivoDoCancelamento: linhas[0]?.motivoCancelamento ?? null,
      pessoas: linhas.map((l) => ({
        avaliacaoId: l.id,
        nome: porId.get(l.avaliadoId)?.nome ?? '(colaborador não encontrado)',
        matricula: porId.get(l.avaliadoId)?.matricula ?? '',
        respostas: l._count.respostas,
        estadoAoVoltar: estadoAoVoltar(l._count.respostas),
      })),
    };
  }

  /**
   * O ato. Exige ciclo ABERTO — devolver avaliação para a fila de alguém num
   * ciclo encerrado a deixaria viva sem que ninguém pudesse respondê-la
   * (`responder` exige ABERTO): o mesmo beco que
   * `assertCicloAceitaReaberturaDeAvaliacao` fechou para a avaliação.
   */
  async devolverCanceladasDoEncerramento(cicloId: string, motivo: string, usuarioId: string) {
    // ⭐ MESMO MÍNIMO DO ENCERRAR E DO REABRIR — é ato em massa, e o motivo é a
    // única explicação que sobra para dezenas de pessoas voltarem à fila.
    if (!motivo?.trim() || motivo.trim().length < MOTIVO_MINIMO_EM_MASSA) {
      throw new BadRequestException(
        'Informe o motivo de devolver as avaliações canceladas. Ele fica na auditoria de cada ' +
          'uma — é o que responde, meses depois, por que elas voltaram para a fila. ' +
          faltamCaracteres(motivo?.trim() ?? '', MOTIVO_MINIMO_EM_MASSA),
      );
    }

    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id: cicloId },
      select: { id: true, status: true, encerradoEm: true },
    });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');
    if (ciclo.status !== 'ABERTO') {
      throw new BadRequestException(
        `O ciclo está ${ciclo.status}. Devolver uma avaliação para a fila de alguém num ciclo ` +
          'que não está aberto a deixaria viva sem que ninguém pudesse respondê-la — responder ' +
          'exige ciclo ABERTO. Reabra o ciclo primeiro.',
      );
    }

    const alvo = await this.prisma.avaliacao.findMany({
      where: { cicloId, status: 'CANCELADA', origemCancelamento: 'ENCERRAMENTO' },
      select: {
        id: true,
        motivoCancelamento: true,
        _count: { select: { respostas: true } },
      },
    });
    if (alvo.length === 0) {
      throw new BadRequestException(
        'Não há avaliação cancelada pelo encerramento deste ciclo. ' +
          'As que o RH excluiu uma a uma voltam pelo Incluir, na aba Designação.',
      );
    }

    /**
     * ⚠️ Duas passadas em vez de um `updateMany`: o estado ao voltar é DERIVADO
     * DO DADO de cada linha (com resposta, EM_ANDAMENTO; sem, PENDENTE), e uma
     * atualização em bloco teria de escolher um estado só para todas.
     */
    const comResposta = alvo.filter((a) => a._count.respostas > 0).map((a) => a.id);
    const semResposta = alvo.filter((a) => a._count.respostas === 0).map((a) => a.id);

    await this.prisma.$transaction(async (tx) => {
      const limpa = {
        canceladaEm: null,
        canceladaPorId: null,
        motivoCancelamento: null,
        origemCancelamento: null,
      };
      if (comResposta.length) {
        await tx.avaliacao.updateMany({
          where: { id: { in: comResposta } },
          data: { status: 'EM_ANDAMENTO', ...limpa },
        });
      }
      if (semResposta.length) {
        await tx.avaliacao.updateMany({
          where: { id: { in: semResposta } },
          data: { status: 'PENDENTE', ...limpa },
        });
      }

      /**
       * ⭐ UMA linha de auditoria POR AVALIAÇÃO, com o motivo ORIGINAL do
       * cancelamento em `valorAnterior`. Registrar só no ciclo deixaria cada
       * avaliação sem explicação na própria trilha — e é na trilha dela que
       * alguém vai olhar quando perguntar por que aquela pessoa voltou.
       */
      for (const a of alvo) {
        await this.auditoria.registrar({
          entidade: 'Avaliacao',
          entidadeId: a.id,
          acao: 'DESCANCELAR',
          usuarioId,
          justificativa: motivo.trim(),
          valorAnterior: {
            status: 'CANCELADA',
            respostas: a._count.respostas,
            motivoCancelamento: a.motivoCancelamento,
            origemCancelamento: 'ENCERRAMENTO',
          },
          valorNovo: {
            status: estadoAoVoltar(a._count.respostas),
            origem: 'DEVOLUCAO_EM_MASSA',
          },
        });
      }

      await this.auditoria.registrar({
        entidade: 'Ciclo',
        entidadeId: cicloId,
        acao: 'DEVOLVER_CANCELADAS',
        usuarioId,
        justificativa: motivo.trim(),
        valorNovo: {
          devolvidas: alvo.length,
          emAndamento: comResposta.length,
          pendentes: semResposta.length,
        },
      });
    });

    return {
      devolvidas: alvo.length,
      emAndamento: comResposta.length,
      pendentes: semResposta.length,
    };
  }

  async reabrir(cicloId: string, motivo: string, usuarioId: string) {
    // ⭐ MESMO MÍNIMO DO ENCERRAR — reabrir o ciclo é ato EM MASSA (09/09).
    // Nasceu com o mínimo de uma linha, por analogia com o reabrir AVALIAÇÃO. A
    // analogia era falsa: reabrir o ciclo devolve designação, público e apuração
    // do ciclo inteiro. A frase é a única explicação que vai sobrar.
    if (!motivo?.trim() || motivo.trim().length < MOTIVO_MINIMO_EM_MASSA) {
      throw new BadRequestException(
        'Informe o motivo da reabertura. Ele fica registrado no ciclo e na auditoria — é o que ' +
          'responde, meses depois, por que um ciclo encerrado voltou a aceitar mudança. ' +
          faltamCaracteres(motivo?.trim() ?? '', MOTIVO_MINIMO_EM_MASSA),
      );
    }
    const ciclo = await this.prisma.ciclo.findUnique({ where: { id: cicloId } });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');
    if (ciclo.status !== 'ENCERRADO') {
      throw new BadRequestException(
        `O ciclo está ${ciclo.status} — só um ciclo ENCERRADO é reaberto.`,
      );
    }

    const reaberto = await this.prisma.ciclo.update({
      where: { id: cicloId },
      data: {
        status: 'ABERTO',
        reabertoEm: new Date(),
        reabertoPorId: usuarioId,
        motivoReabertura: motivo.trim(),
      },
    });
    await this.auditoria.registrar({
      entidade: 'Ciclo',
      entidadeId: cicloId,
      acao: 'REABRIR',
      usuarioId,
      justificativa: motivo.trim(),
      valorAnterior: { status: 'ENCERRADO', encerradoEm: ciclo.encerradoEm },
      valorNovo: { status: 'ABERTO' },
    });
    return reaberto;
  }

  /**
   * ⭐ AJUSTAR O PERÍODO — e SÓ o período.
   *
   * `periodoInicio`/`periodoFim` são **rótulo**: dizem de que intervalo o ciclo
   * fala, aparecem no painel e viram o prazo na fila do avaliador. Nenhuma
   * conta os usa — quem ancora todo cálculo temporal é a `dataBase`, e ela
   * NÃO se mexe aqui, de propósito. Mudar a data-base de um ciclo em andamento
   * moveria a nota de quem já respondeu, em silêncio; é a mesma família do
   * `current_date` que o select antigo usava e que a §4.2 da spec proibiu.
   *
   * Por isso este método é estreito: quem quiser outra data-base cria outro
   * ciclo, que é a decisão que ela realmente é.
   *
   * ⚠️ Ciclo ENCERRADO não muda: o resultado já foi materializado e a memória
   * de cálculo dele fala de um período que ficaria diferente do gravado.
   */
  /**
   * ⭐⭐ A RÉGUA DE CONCEITOS, editável — a promessa que o modal já fazia.
   *
   * O modal de novo ciclo dizia, em letra: *"Ajuste fino do texto e das cores
   * fica na tela do ciclo."* Essa tela não existia. Texto que promete
   * capacidade é dívida (regra 19), e esta prometia à gestora.
   *
   * ── ATÉ QUANDO SE PODE MEXER, e por que não é "só em RASCUNHO" ────────────
   * O critério óbvio seria RASCUNHO, e é mais simples de explicar. Dois fatos
   * do próprio módulo dizem que ele é simples DEMAIS:
   *
   *   1. **O conceito é SNAPSHOT no resultado.** `resultado_avaliacao` grava
   *      `conceitoId` **e** `conceitoDescricao` na apuração. Mexer na régua
   *      depois disso não muda o que foi comunicado — cria uma segunda verdade:
   *      o resultado diz "Supera" e a régua do ciclo diz outra coisa para a
   *      mesma nota. Ninguém vê acontecer.
   *   2. **Ciclo ABERTO não volta para RASCUNHO.** Não existe caminho. Com o
   *      critério "só RASCUNHO", abrir o ciclo congelaria a régua para sempre —
   *      inclusive o texto de um rótulo que ninguém ainda viu, porque ninguém
   *      foi apurado. Recusa sem saída é o que este módulo passa o tempo
   *      consertando.
   *
   * Então a fronteira é a APURAÇÃO, que é a fronteira de verdade: **a régua
   * muda enquanto ninguém tiver sido apurado.** Cabe numa frase, como o
   * "RASCUNHO" cabia, e é a frase certa.
   */
  async ajustarConceitos(cicloId: string, conceitos: FaixaConceito[], usuarioId: string) {
    const ciclo = await this.prisma.ciclo.findUnique({ where: { id: cicloId } });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');

    /**
     * ⚠️ Achado ao conferir no ar (09/09): sem esta linha o backend ACEITAVA
     * mexer na régua de um ciclo ENCERRADO — a tela travava e a API não. Tela
     * mais restritiva que a API é o mesmo defeito do avesso: um dos dois está
     * mentindo, e quem descobre é quem tentar pela API. Encerrado só lê, como
     * em todo o módulo — e a saída é reabrir o ciclo, que existe e é auditada.
     */
    assertCicloOperavel(ciclo, 'ajuste da régua de conceitos');

    const apuradas = await this.prisma.resultadoAvaliacao.count({ where: { cicloId } });
    if (apuradas > 0) {
      throw new BadRequestException(
        `Este ciclo já tem resultado apurado — apuradas: ${apuradas}. O conceito de cada uma foi ` +
          'gravado junto com a nota ("Supera", "Atende"), e é esse texto que a pessoa recebe. ' +
          'Mudar a régua agora não mudaria o que já foi apurado: deixaria o resultado dizendo uma ' +
          'coisa e a régua do ciclo dizendo outra, sem nada na tela denunciando. Se a régua está ' +
          'errada, o caminho é recalcular a apuração depois de corrigi-la — fale com a T.I.',
      );
    }

    // ⚠️ A MESMA função da abertura (`validarConceitos`), não uma segunda:
    // contiguidade, começo em 0 e fim em 100. Escrever a segunda cópia é o
    // defeito que o dia 09/09 inteiro passou consertando (regra 25).
    const problemas = validarConceitos(conceitos);
    if (problemas.length) throw new BadRequestException(problemas);

    const anteriores = await this.prisma.conceitoFaixa.findMany({
      where: { cicloId },
      orderBy: { ordem: 'asc' },
    });

    await this.prisma.$transaction(async (tx) => {
      // Sem resultado apurado, nenhuma linha aponta para estas faixas — a
      // própria guarda acima é o que torna o delete seguro.
      await tx.conceitoFaixa.deleteMany({ where: { cicloId } });
      await tx.conceitoFaixa.createMany({
        data: conceitos.map((c, i) => ({
          cicloId,
          descricao: c.descricao,
          limiteInferior: c.limiteInferior,
          limiteSuperior: c.limiteSuperior,
          cor: (c as { cor?: string | null }).cor ?? null,
          ordem: (c as { ordem?: number }).ordem ?? i + 1,
        })),
      });
    });

    await this.auditoria.registrar({
      entidade: 'Ciclo',
      entidadeId: cicloId,
      acao: 'AJUSTAR_CONCEITOS',
      usuarioId,
      valorAnterior: {
        conceitos: anteriores.map((c) => ({
          descricao: c.descricao,
          limiteInferior: Number(c.limiteInferior),
          limiteSuperior: Number(c.limiteSuperior),
        })),
      },
      valorNovo: { conceitos },
    });

    return this.prisma.conceitoFaixa.findMany({ where: { cicloId }, orderBy: { ordem: 'asc' } });
  }

  async ajustarPeriodo(
    cicloId: string,
    periodoInicio: Date,
    periodoFim: Date,
    usuarioId: string,
  ) {
    const ciclo = await this.prisma.ciclo.findUnique({ where: { id: cicloId } });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');
    if (ciclo.status === 'ENCERRADO') {
      throw new BadRequestException(
        'O ciclo está ENCERRADO — o período dele descreve resultados já materializados e não muda.',
      );
    }

    this.validarPeriodo({
      periodoInicio,
      periodoFim,
      dataBase: ciclo.dataBase,
      janelaTreinamentoMeses: ciclo.janelaTreinamentoMeses,
    });

    const atualizado = await this.prisma.ciclo.update({
      where: { id: cicloId },
      data: { periodoInicio, periodoFim },
    });

    await this.auditoria.registrar({
      entidade: 'Ciclo',
      entidadeId: cicloId,
      acao: 'AJUSTAR_PERIODO',
      usuarioId,
      valorAnterior: { periodoInicio: ciclo.periodoInicio, periodoFim: ciclo.periodoFim },
      valorNovo: { periodoInicio, periodoFim },
    });
    return atualizado;
  }

  /**
   * ⚠️ Traz também quantas avaliações ainda NÃO foram enviadas — é a condição
   * que `encerrar` exige, e sem o número a tela só consegue escrever a regra
   * embaixo do botão e deixar a pessoa descobrir clicando. Encerrar é a ação
   * irreversível do módulo; ela não pode ser o caminho para conhecer a regra.
   */
  async listar() {
    const [ciclos, pendentes] = await Promise.all([
      this.prisma.ciclo.findMany({
        orderBy: { periodoInicio: 'desc' },
        // ⭐⭐ `_count` FILTRADO. Sem o `where`, a relação conta TODAS as linhas,
        // canceladas inclusive — e este é o número do card da lista ("52
        // avaliações") que discordava do "Faltam 37" logo abaixo, no mesmo
        // render. Ver `avaliacoes-que-contam.ts` e o invariante que varre o
        // fonte cobrando isto.
        include: {
          _count: { select: { aplicacoes: true, avaliacoes: { where: ONDE_A_AVALIACAO_CONTA } } },
        },
      }),
      // groupBy e não `_count` filtrado: o `_count` do Prisma não aceita a
      // mesma relação duas vezes (total e filtrada) na mesma consulta.
      // ⭐ Por status, e não só as pendentes: o diálogo de REABRIR precisa saber
      // quantas foram canceladas para poder dizer que elas NÃO voltam.
      this.prisma.avaliacao.groupBy({
        by: ['cicloId', 'status'],
        where: { status: { in: [...STATUS_VIVOS, 'CANCELADA'] } },
        _count: { _all: true },
      }),
    ]);
    const soma = (cicloId: string, status: string[]) =>
      pendentes
        .filter((p) => p.cicloId === cicloId && status.includes(p.status as string))
        .reduce((t, p) => t + p._count._all, 0);
    return ciclos.map((c) => ({
      ...c,
      pendentes: soma(c.id, [...STATUS_VIVOS]),
      /**
       * Quantas o ciclo já cancelou — reabrir NÃO as traz de volta.
       *
       * ⚠️ `canceladas` e não `avaliacoesCanceladas`: é o MESMO fato que
       * `ResumoDoCiclo.canceladas`, e eu escrevi os dois com nomes diferentes
       * no mesmo dia em que documentei colisões de vocabulário (§3.1.32).
       * `avaliacoesPendentes` foi junto — o módulo usa o nome nu (`enviadas`,
       * `apuradas`, `designados`) e o prefixo aqui era a única exceção.
       */
      canceladas: soma(c.id, ['CANCELADA']),
    }));
  }

  async obter(cicloId: string) {
    const ciclo = await this.carregarParaAbertura(cicloId);
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');

    /**
     * ⚠️ `canceladas` VIAJA JUNTO — o tipo do cliente já prometia este campo
     * (`CicloDetalhado` herda de `CicloDaLista`) e o endpoint nunca o mandou:
     * quem lesse `ciclo.canceladas` recebia `undefined` com o TypeScript
     * dizendo `number`. Tipo que mente sobre o payload é pior que campo
     * ausente — o compilador confirma o engano.
     *
     * Recorte por status explícito, como a contagem do encerrar: é a própria
     * pergunta, não um total (ver a dispensa em `avaliacoes-que-contam`).
     */
    const canceladas = await this.prisma.avaliacao.count({
      where: { cicloId, status: 'CANCELADA' },
    });
    return { ...ciclo, canceladas };
  }

  private async carregarParaAbertura(cicloId: string) {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id: cicloId },
      include: {
        /**
         * ⚠️ A BASE do ciclo — quantas avaliações ele tem — viaja junto porque
         * é o que qualifica todo número lido depois. A tela de Resultados
         * mostrava "3 resultado(s) · média 62,59" sem dizer que os 3 são de
         * 894: uma semana depois isso lê como número oficial. Mesma contagem
         * agregada da listagem.
         */
        // ⭐ Filtrado, como na listagem: cancelada não é avaliação do ciclo.
        _count: { select: { aplicacoes: true, avaliacoes: { where: ONDE_A_AVALIACAO_CONTA } } },
        conceitos: { orderBy: { ordem: 'asc' } },
        aplicacoes: {
          include: {
            modeloVersao: { include: { modelo: true } },
            criterios: { include: { criterio: true } },
            centrosCusto: true,
            // Quantas pessoas no público NOMINAL — é o que decide se a aplicação
            // alcança alguém. Ver `problemasParaAbrir`.
            _count: { select: { publico: true } },
          },
        },
      },
    });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');
    return ciclo;
  }

  /** Só as datas: é o que a regra olha, e pedir o ciclo inteiro obrigaria quem
   *  ajusta o período a fabricar campos que não têm nada a ver com ela. */
  private validarPeriodo(dados: Pick<DadosCiclo, 'periodoInicio' | 'periodoFim' | 'dataBase' | 'janelaTreinamentoMeses'>) {
    const problemas: string[] = [];
    if (dados.periodoFim < dados.periodoInicio) {
      problemas.push('O fim do período é anterior ao início.');
    }
    if (dados.dataBase < dados.periodoInicio || dados.dataBase > dados.periodoFim) {
      // A data-base ancora todo cálculo temporal; fora do período ela mediria
      // um momento que o ciclo não cobre.
      problemas.push('A data-base precisa estar dentro do período do ciclo.');
    }
    if ((dados.janelaTreinamentoMeses ?? 12) <= 0) {
      problemas.push('A janela de treinamento precisa ser de pelo menos 1 mês.');
    }
    if (problemas.length) throw new BadRequestException(problemas);
  }
}
