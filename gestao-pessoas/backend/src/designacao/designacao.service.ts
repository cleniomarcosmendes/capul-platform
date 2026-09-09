/**
 * DESIGNAÇÃO — quem entra no ciclo, e quem avalia quem.
 *
 * Três passos, na ordem em que a gestora trabalha:
 *   1. a régua monta a lista INICIAL a partir dos centros de custo da aplicação
 *      (`elegibilidade-ciclo.ts`);
 *   2. ela ajusta — inclui ou exclui — e cada ajuste vira linha em
 *      `rh.ciclo_elegibilidade`, nos dois sentidos;
 *   3. define o avaliador de cada pessoa.
 *
 * ⚠️ Ninguém some sem rastro. A lista devolve incluídos E excluídos, com motivo;
 * a decisão manual é gravada; e reverter uma decisão **não apaga** a anterior.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SITUACOES_ELEGIVEIS } from '../common/elegibilidade.js';
import {
  avaliarElegibilidade,
  montarListaInicial,
  type CandidatoDesignacao,
  type MotivoExclusao,
} from './elegibilidade-ciclo.js';
import { assertCicloOperavel } from '../ciclo/ciclo-operavel.js';
import { efeitoDoExcluir, type EfeitoDoCancelamento } from '../avaliacao/cancelamento.js';
import {
  avisoDeTrocaEmRespondidas,
  efeitoDeDesignar,
  type EfeitoDaDesignacao,
} from './efeito-de-designar.js';
import {
  decidirSituacao,
  pedeAcao,
  type SituacaoDoVinculoNoCiclo,
} from './situacao-no-ciclo.js';
import { marcarRestricoesPor } from '../avaliacao/separacao-funcoes.js';
import {
  decidirTrocaDeAplicacao,
  mensagemDaRecusa,
  type MotivoDaRecusa,
} from './troca-de-aplicacao.js';

export interface LinhaDaLista {
  colaboradorId: string;
  matricula: string;
  nome: string;
  centroCusto: string | null;
  filial: string;
  elegivel: boolean;
  motivo: MotivoExclusao | null;
  justificativa: string | null;
  /** true quando a decisão veio de uma pessoa, não da régua. */
  decididoManualmente: boolean;
  /**
   * ⭐ Quem avalia esta pessoa — null quando ninguém foi designado ainda.
   *
   * Sem isto a tela não tem como dizer o que FALTA: elegível sem avaliador não
   * gera `Avaliacao`, some de toda contagem e fica de fora do ciclo sem erro
   * nenhum. É a mesma pendência que o painel conta como `semDesignacao`.
   */
  avaliadorId: string | null;
  avaliadorNome: string | null;
  avaliacaoStatus: string | null;
  /**
   * ⭐⭐ POR QUE A AVALIAÇÃO FOI CANCELADA — e é pergunta DIFERENTE da
   * `justificativa`, que diz por que a PESSOA está fora do ciclo.
   *
   * ⚠️ As duas coincidem quando o cancelamento veio do *Excluir* (o mesmo texto
   * é gravado nos dois campos); só uma existe quando veio do *encerrar com
   * pendência*, que não cria decisão de elegibilidade nenhuma. Era esse o caso
   * das 37 do SIMULACAO: o motivo estava gravado e **a linha não tinha por onde
   * mostrá-lo** — enquanto as 2 excluídas à mão mostravam o delas, o que fazia
   * parecer que umas tinham motivo e outras não.
   *
   * O diálogo de encerrar promete que o motivo *"fica registrado no ciclo e em
   * cada avaliação cancelada — é o que responde, meses depois, por que estas
   * ficaram sem nota"*. Sem este campo a promessa não chegava à tela.
   */
  motivoCancelamento: string | null;
  /**
   * ⭐⭐ QUANTAS RESPOSTAS A AVALIAÇÃO TEM — e de quantas perguntas.
   *
   * O diálogo de encerrar com pendência promete, em letra: *"As N respostas já
   * dadas ficam registradas e não entram na apuração — nada é apagado."* Em
   * 09/09/2026 isso era **verdade no dado e mentira na tela**: o ZZ ENCERRA2
   * cancelou uma avaliação com 4 de 11 respondidas, as 4 continuaram em
   * `rh.resposta`, e nenhuma tela do módulo as mencionava — a linha dizia só
   * "cancelada", o painel não conta parcial e Resultados dizia "nenhum
   * resultado apurado". Promessa que só o banco cumpre é promessa quebrada:
   * quem lê a tela conclui que perdeu o trabalho do avaliador.
   *
   * ⚠️ É leitura, e é o caso mais barato de todos — o número já vinha sendo
   * contado para a frase do *Excluir* e era descartado na montagem da linha.
   */
  respostasDadas: number;
  /** Perguntas do modelo da aplicação — o denominador de "4 de 11". */
  perguntasNoModelo: number;
  /**
   * ⭐ O id da avaliação, quando existe. A linha trazia só o `status`, e com ele
   * a tela sabia QUE havia avaliação mas não conseguia agir sobre ela — foi o
   * que faltava para o botão de reabrir (§3.1.41).
   */
  avaliacaoId: string | null;
  /**
   * ⭐ A linha de quem está OLHANDO a lista, marcada. A §3.1 manda "mostrar a
   * linha marcada, nunca filtrar em silêncio", e esta lista mostra, por pessoa,
   * QUEM a avalia e o status da avaliação dela — a gestora se vê aqui com
   * "Avalia: CLAUDIMAR · PENDENTE". Resultados já marcava; esta não marcava.
   */
  restrita?: boolean;
  motivoRestricao?: string;
  /**
   * ⭐⭐ O QUE O "EXCLUIR" VAI FAZER NESTA LINHA — derivado no backend, pela
   * MESMA função que o serviço usa para decidir (`efeitoDoExcluir`).
   *
   * Até 08/09 a confirmação do Excluir dizia uma generalidade ("Excluir a tira
   * deste ciclo") enquanto o ato, no dado, era outro: a avaliação continuava
   * viva na fila do avaliador. Agora a tela mostra o efeito real, com o nome de
   * quem está com ela e o número de respostas já dadas. Se a tela montasse essa
   * frase sozinha, ela envelheceria separada da regra — foi o que aconteceu com
   * o texto do modal de aplicação, que passou 2 dias mentindo.
   */
  efeitoDoExcluir: EfeitoDoCancelamento;
}

interface DesignacaoVigente {
  /** Id da avaliação — o que a linha precisa para agir sobre ela (reabrir). */
  id: string;
  /** Por que a AVALIAÇÃO foi cancelada — pergunta diferente da `justificativa`. */
  motivoCancelamento: string | null;
  avaliadorId: string;
  avaliadorNome: string;
  status: string;
  /** Quantas respostas já existem — entra na frase da confirmação do Excluir. */
  respostas: number;
}


/**
 * ⚠️ **DOIS EIXOS INDEPENDENTES, não uma sequência** (08/09). "Tem avaliador no
 * CADASTRO?" e "já tem avaliação no CICLO?" são perguntas diferentes, e a
 * combinação é 2×2. O código tratava como sequência — o teste do cadastro vinha
 * primeiro e absorvia os casos do ciclo —, então três pessoas designadas à mão
 * do mesmo jeito caíam em baldes diferentes só por terem, ou não, linha no
 * cadastro. E a frase do balde de cima afirmava algo sobre o CICLO
 * ("ficará de fora") que só o outro eixo sabe.
 */
export type MotivoNaoAplicada =
  /** Sem cadastro **e** sem avaliação: esta fica MESMO de fora do ciclo. */
  | 'SEM_AVALIADOR_NO_CADASTRO'
  /** Sem cadastro, **mas já designada no ciclo**: continua como está. */
  | 'SEM_CADASTRO_JA_DESIGNADA'
  | 'AJUSTE_MANUAL_DO_CICLO'
  | 'JA_RESPONDIDA'
  | 'TROCA_DE_APLICACAO';

export interface LinhaNaoAplicada {
  colaboradorId: string;
  nome: string;
  matricula: string;
  centroCusto: string | null;
  motivo: MotivoNaoAplicada;
  detalhe: string;
}

/** O que a cópia do cadastro VAI fazer (prévia) ou FEZ (aplicação). */
export interface RelatorioDaCopia {
  cicloId: string;
  /** false = prévia; nada foi gravado. */
  aplicado: boolean;
  substituirManuais: boolean;
  /**
   * ⭐ NÃO colide com o `criar` de `designar/previa` — conferido campo a campo
   * em 08/09, e a suspeita de que colidia era falsa. Nos DOIS o significado é o
   * mesmo: *"não existia `Avaliacao` no ciclo → uma será criada"*. É a única
   * palavra que os dois payloads já têm em comum.
   *
   * ⚠️ O que de fato diverge entre eles são os dois vizinhos — aqui
   * `atualizar`/`jaIguais`, lá `substituir`/`nadaAFazer` — e, pior, a POLÍTICA
   * sobre avaliação já respondida: este lote **recusa** (`JA_RESPONDIDA`) o que
   * a designação individual **permite com confirmação** (`EXIGE_CONFIRMACAO`),
   * e só a segunda tem razão escrita. Ver
   * `docs/LEVANTAMENTO_PREVIAS_GESTAO_PESSOAS_08SET.md`.
   */
  criar: number;
  /** Existia com OUTRO avaliador → troca. É o `substituir` de `designar/previa`. */
  atualizar: number;
  /** Já é assim → nada muda. É o `nadaAFazer` de `designar/previa`. */
  jaIguais: number;
  /** Das que serão gravadas, quantas vêm de divisão automática NÃO revisada. */
  deDivisaoNaoRevisada: number;
  naoAplicadas: LinhaNaoAplicada[];
  porMotivo: Partial<Record<MotivoNaoAplicada, number>>;
  porAplicacao: {
    aplicacaoId: string;
    nome: string;
    /**
     * ⚠️ Os ELEGÍVEIS da aplicação — quem o ciclo tirou não conta aqui. NÃO é o
     * `noPublico` do resumo do ciclo, que é o total de linhas montadas: as duas
     * contas respondem perguntas diferentes ("quem o ciclo alcança" × "quanto
     * foi montado") e a diferença entre elas são os excluídos. A tela rotula
     * este como "ativos no público" por isso.
     */
    publico: number;
    criar: number;
    atualizar: number;
    jaIguais: number;
    semAvaliador: number;
    naoAplicadas: number;
  }[];
  avisos: string[];
  /** Só na aplicação — quanto o lote levou, para medir a viabilidade do piloto. */
  duracaoMs?: number;
}

@Injectable()
export class DesignacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Lista da aplicação: o PÚBLICO NOMINAL dela, com a régua aplicada e as
   * decisões manuais já sobrepostas.
   *
   * ⭐ O público vem de `rh.aplicacao_publico`, uma linha por pessoa — não mais
   * do recorte por centro de custo. A estrutura de gestão não coincide com a
   * contábil: a equipe de limpeza são 46 pessoas em 19 pares filial × CC, e os
   * 31 aprendizes estão em 15 pares, todos compartilhados com gente efetiva.
   * Centro de custo e filial continuam existindo como ATALHO de preenchimento
   * na tela, e ficam registrados em `origem` + `origemReferencia`.
   *
   * ⚠️ Público vazio devolve lista vazia. Antes, aplicação sem centro de custo
   * caía num `where` sem filtro e trazia as 1.036 pessoas — "ainda não
   * configurei" e "todo mundo" eram o mesmo estado.
   */
  async listar(aplicacaoId: string, colaboradorId?: string | null): Promise<LinhaDaLista[]> {
    const aplicacao = await this.prisma.aplicacao.findUnique({
      where: { id: aplicacaoId },
      include: { ciclo: true },
    });
    if (!aplicacao) throw new NotFoundException('Aplicação não encontrada.');

    const noPublico = await this.prisma.aplicacaoPublico.findMany({
      where: { aplicacaoId },
      select: { colaboradorId: true },
    });
    const colaboradores = await this.prisma.colaborador.findMany({
      where: {
        id: { in: noPublico.map((p) => p.colaboradorId) },
        situacao: { in: SITUACOES_ELEGIVEIS as never[] },
      },
      orderBy: [{ filial: 'asc' }, { nome: 'asc' }],
    });

    const candidatos: (CandidatoDesignacao & { centroCusto: string | null; filial: string })[] =
      colaboradores.map((c) => ({
        colaboradorId: c.id,
        matricula: c.matricula,
        nome: c.nome,
        // Categoria funcional não é coluna do nosso cadastro: Presidente e Vice
        // são identificados pela decisão registrada, não re-derivados aqui.
        categoriaFuncional: null,
        situacaoNaDataBase: c.situacao,
        centroCusto: c.centroCusto,
        filial: c.filial,
      }));

    const { incluidos, excluidos } = montarListaInicial(candidatos, {
      incluirAfastados: aplicacao.ciclo.incluirAfastados,
    });

    const decisoes = await this.decisoesVigentes(aplicacao.cicloId);
    const designadas = await this.designacoesVigentes(aplicacao.cicloId);

    // O denominador de "4 de 11": uma consulta para a lista inteira, não por linha.
    const perguntasNoModelo = await this.prisma.pergunta.count({
      where: { grupo: { modeloVersaoId: aplicacao.modeloVersaoId } },
    });

    const semDesignacao = {
      avaliadorId: null,
      avaliadorNome: null,
      avaliacaoStatus: null,
      avaliacaoId: null,
      motivoCancelamento: null,
      respostasDadas: 0,
      perguntasNoModelo,
      efeitoDoExcluir: efeitoDoExcluir(null),
    };
    const linhas: LinhaDaLista[] = [
      ...incluidos.map((c) => ({
        ...this.paraLinha(c),
        ...semDesignacao,
        elegivel: true,
        motivo: null,
        justificativa: null,
        decididoManualmente: false,
      })),
      ...excluidos.map((c) => ({
        ...this.paraLinha(c),
        ...semDesignacao,
        elegivel: false,
        motivo: c.motivo as MotivoExclusao | null,
        justificativa: c.justificativa as string | null,
        decididoManualmente: false,
      })),
    ];

    // A decisão manual SOBREPÕE a régua, nos dois sentidos.
    const comDecisao = linhas.map((linha) => {
      const designada = designadas.get(linha.colaboradorId);
      const comDesignacao = {
        ...linha,
        avaliadorId: designada?.avaliadorId ?? null,
        avaliadorNome: designada?.avaliadorNome ?? null,
        avaliacaoStatus: designada?.status ?? null,
        avaliacaoId: designada?.id ?? null,
        motivoCancelamento: designada?.motivoCancelamento ?? null,
        respostasDadas: designada?.respostas ?? 0,
        perguntasNoModelo,
        efeitoDoExcluir: efeitoDoExcluir(
          designada
            ? {
                status: designada.status,
                respostas: designada.respostas,
                avaliadorNome: designada.avaliadorNome,
              }
            : null,
        ),
      };

      const decisao = decisoes.get(linha.colaboradorId);
      if (!decisao) return { ...comDesignacao, decididoManualmente: false };
      return {
        ...comDesignacao,
        elegivel: decisao.decisao === 'INCLUIR',
        motivo: decisao.motivo,
        justificativa: decisao.justificativa,
        decididoManualmente: decisao.motivo === 'MANUAL_RH',
      };
    });

    // Marca, nunca filtra: filtrar faria o total não fechar, e o total é o
    // número que alguém vai conferir contra a folha.
    //
    // ⚠️ Esta regra nasceu INLINE aqui em 06/09 e virou a 1ª de quatro listas.
    // Agora sai do mesmo lugar que as outras (`marcarRestricoesPor`): cópia de
    // regra de visibilidade envelhece errada — já custou um achado de segurança
    // neste repositório.
    return marcarRestricoesPor(comDecisao, colaboradorId, (l) => l.colaboradorId);
  }

  /**
   * O que muda (e o que NÃO muda) em cada ciclo ABERTO por causa deste vínculo.
   *
   * ⚠️ **Uma linha por ciclo aberto, sempre — inclusive as que dizem "nada a
   * fazer"**. Com dois ciclos abertos (o caso de hoje), omitir aquele em que
   * nada muda faz o silêncio ser lido como "não se aplica", que é justamente a
   * ambiguidade que este aviso existe para matar.
   */
  async situacaoNosCiclosAbertos(
    avaliadoId: string,
    avaliadorVinculadoId: string,
  ): Promise<SituacaoDoVinculoNoCiclo[]> {
    const [abertos, colaborador] = await Promise.all([
      this.prisma.ciclo.findMany({
        where: { status: 'ABERTO' },
        select: { id: true, nome: true, incluirAfastados: true },
        orderBy: { criadoEm: 'asc' },
      }),
      this.prisma.colaborador.findUnique({
        where: { id: avaliadoId },
        select: { situacao: true },
      }),
    ]);
    if (abertos.length === 0 || !colaborador) return [];

    return Promise.all(
      abertos.map(async (ciclo) => {
        const [avaliacao, noPublico, decisao] = await Promise.all([
          this.prisma.avaliacao.findUnique({
            where: { cicloId_avaliadoId: { cicloId: ciclo.id, avaliadoId } },
            select: {
              avaliadorId: true, status: true, origemDesignacao: true, aplicacaoId: true,
              _count: { select: { respostas: true } },
            },
          }),
          this.prisma.aplicacaoPublico.findFirst({
            where: { cicloId: ciclo.id, colaboradorId: avaliadoId },
            select: { id: true },
          }),
          this.prisma.cicloElegibilidade.findFirst({
            where: { cicloId: ciclo.id, colaboradorId: avaliadoId, removidoEm: null },
            select: { decisao: true, justificativa: true },
          }),
        ]);

        const regua = avaliarElegibilidade(
          {
            colaboradorId: avaliadoId,
            matricula: '',
            nome: '',
            // Mesma nota da tela de designação: categoria funcional não é coluna
            // do nosso cadastro — Presidente e Vice saem por decisão registrada.
            categoriaFuncional: null,
            situacaoNaDataBase: colaborador.situacao as never,
          },
          { incluirAfastados: ciclo.incluirAfastados },
        );

        const situacao = decidirSituacao({
          avaliadorVinculadoId,
          avaliacao: avaliacao
            ? {
                avaliadorId: avaliacao.avaliadorId,
                status: avaliacao.status,
                respostas: avaliacao._count.respostas,
                origemDesignacao: avaliacao.origemDesignacao,
              }
            : null,
          noPublico: noPublico !== null,
          decisaoDoRh: decisao
            ? { decisao: decisao.decisao as 'INCLUIR' | 'EXCLUIR', justificativa: decisao.justificativa }
            : null,
          regua: { elegivel: regua.elegivel, justificativa: regua.justificativa },
        });

        // O nome de quem avalia hoje só é buscado quando a frase vai usá-lo.
        let avaliadorAtual: string | null = null;
        if (
          avaliacao &&
          (situacao === 'OUTRO_AVALIADOR' ||
            situacao === 'OUTRO_AVALIADOR_MANUAL' ||
            situacao === 'JA_RESPONDIDA')
        ) {
          const atual = await this.prisma.colaborador.findUnique({
            where: { id: avaliacao.avaliadorId },
            select: { nome: true },
          });
          avaliadorAtual = atual?.nome ?? null;
        }

        return {
          cicloId: ciclo.id,
          cicloNome: ciclo.nome,
          situacao,
          pedeAcao: pedeAcao(situacao),
          avaliadorAtual,
          // A justificativa que a tela mostra entre aspas: a do RH quando houve
          // decisão, a da régua quando foi a régua. Nunca as duas.
          justificativa:
            situacao === 'FORA_POR_DECISAO_RH'
              ? (decisao?.justificativa ?? null)
              : situacao === 'FORA_PELA_REGUA'
                ? regua.justificativa
                : null,
          respostas: avaliacao?._count.respostas ?? 0,
          statusAvaliacao: avaliacao?.status ?? null,
        };
      }),
    );
  }

  /**
   * Decisão manual do RH — incluir alguém que a régua excluiu, ou o contrário.
   * A decisão anterior, se houver, é MARCADA como removida e permanece.
   *
   * ⭐⭐ **EXCLUIR CANCELA A AVALIAÇÃO** (08/09). Até aqui este método escrevia
   * uma linha em `ciclo_elegibilidade` e mais nada: a pessoa saía da vista do
   * RH e a avaliação dela continuava PENDENTE na fila do avaliador e no
   * contador do `encerrar`. "Excluir" não fazia o que a palavra promete — e a
   * recusa do "Tirar do público" mandava **cancelar a avaliação**, um ato que
   * não existia em lugar nenhum do módulo.
   *
   * ⚠️ A avaliação **ENVIADA barra o Excluir** em vez de ser cancelada: ela já
   * tem nota e pode ter resultado apurado. A recusa ensina a ordem (reabrir
   * primeiro), como a do ciclo encerrado. Ver `efeitoDoExcluir`.
   */
  async decidir(
    cicloId: string,
    colaboradorId: string,
    decisao: 'INCLUIR' | 'EXCLUIR',
    justificativa: string,
    usuarioId: string,
  ) {
    if (!justificativa?.trim()) {
      // Sem justificativa a linha vira "alguém decidiu algo" — que é o mesmo que
      // não ter registro nenhum quando alguém perguntar meses depois.
      throw new BadRequestException('Informe o motivo da decisão.');
    }

    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id: cicloId },
      select: { status: true, encerradoEm: true },
    });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');
    assertCicloOperavel(ciclo, 'mudança na lista de quem entra');

    const vigente = await this.prisma.cicloElegibilidade.findFirst({
      where: { cicloId, colaboradorId, removidoEm: null },
    });

    // ⭐ O que o EXCLUIR faz com a avaliação viva. Decidido pela mesma função
    // que a lista devolve por linha, para a confirmação da tela e a decisão da
    // API nunca discordarem.
    const avaliacao =
      decisao === 'EXCLUIR'
        ? await this.prisma.avaliacao.findUnique({
            where: { cicloId_avaliadoId: { cicloId, avaliadoId: colaboradorId } },
            select: { id: true, status: true, avaliadorId: true, _count: { select: { respostas: true } } },
          })
        : null;
    const efeito = efeitoDoExcluir(
      avaliacao
        ? {
            status: avaliacao.status,
            respostas: avaliacao._count.respostas,
            avaliadorNome: await this.nomeDoColaborador(avaliacao.avaliadorId),
          }
        : null,
    );
    if (efeito.acao === 'RECUSAR') throw new BadRequestException(efeito.frase!);

    return this.prisma.$transaction(async (tx) => {
      if (vigente) {
        await tx.cicloElegibilidade.update({
          where: { id: vigente.id },
          data: { removidoEm: new Date(), removidoPorId: usuarioId },
        });
      }
      const nova = await tx.cicloElegibilidade.create({
        data: {
          cicloId,
          colaboradorId,
          decisao,
          motivo: 'MANUAL_RH',
          justificativa: justificativa.trim(),
          registradoPorId: usuarioId,
        },
      });
      // ⚠️ O cancelamento vai DENTRO da transação: decisão registrada com
      // avaliação viva (ou o inverso) é exatamente o estado partido que este
      // conserto veio fechar.
      if (avaliacao && efeito.acao === 'CANCELAR') {
        await tx.avaliacao.update({
          where: { id: avaliacao.id },
          data: {
            status: 'CANCELADA',
            canceladaEm: new Date(),
            canceladaPorId: usuarioId,
            // O motivo do cancelamento é a justificativa da exclusão: são o
            // mesmo ato, e duas frases diferentes para ele só criariam dúvida.
            motivoCancelamento: `Excluído do ciclo pelo RH: ${justificativa.trim()}`,
          },
        });
        await this.auditoria.registrar({
          entidade: 'Avaliacao',
          entidadeId: avaliacao.id,
          acao: 'CANCELAR',
          usuarioId,
          valorAnterior: { status: avaliacao.status, respostas: avaliacao._count.respostas },
          valorNovo: { status: 'CANCELADA', origem: 'DECISAO_RH', justificativa },
        });
      }

      await this.auditoria.registrar({
        entidade: 'CicloElegibilidade',
        entidadeId: nova.id,
        acao: `DECIDIR_${decisao}`,
        usuarioId,
        valorAnterior: vigente ? { decisao: vigente.decisao, motivo: vigente.motivo } : undefined,
        valorNovo: { decisao, justificativa },
      });
      // A tela precisa saber se cancelou, para dizer o que aconteceu — e não
      // repetir a frase da confirmação como se fosse resultado.
      return { ...nova, avaliacaoCancelada: efeito.acao === 'CANCELAR' };
    });
  }

  /**
   * Designa avaliador. `@@unique([cicloId, avaliadoId])` garante um avaliador por
   * avaliado — e o snapshot congela filial, centro de custo e cargo, para o
   * resultado histórico não se mover se a pessoa mudar de área depois.
   *
   * ⚠️ Quando a pessoa JÁ tem avaliação neste ciclo e a designação a manda para
   * OUTRA aplicação, a troca é recusada por `efeitoDeDesignar` antes de
   * qualquer escrita — junto com a autoavaliação e a avaliação cancelada, as
   * três chegando aqui como `RECUSAR`. Ver o comentário da regra abaixo: é o
   * defeito silencioso que nasceu dentro deste método.
   */
  async designar(
    aplicacaoId: string,
    avaliadoId: string,
    avaliadorId: string,
    usuarioId: string,
    origem: 'CENTRO_CUSTO' | 'MANUAL' = 'CENTRO_CUSTO',
    /**
     * ⭐ Trocar o avaliador de uma avaliação JÁ RESPONDIDA continua permitido —
     * é como o RH corrige "designei o supervisor errado" —, mas deixou de ser
     * silencioso: sem esta confirmação, a API recusa e diz o que aconteceria.
     */
    confirmarTrocaDeAvaliador = false,
  ) {
    const [aplicacao, avaliado] = await Promise.all([
      this.prisma.aplicacao.findUnique({
        where: { id: aplicacaoId },
        include: { ciclo: { select: { status: true, encerradoEm: true } } },
      }),
      this.prisma.colaborador.findUnique({ where: { id: avaliadoId } }),
    ]);
    if (!aplicacao) throw new NotFoundException('Aplicação não encontrada.');
    if (!avaliado) throw new NotFoundException('Colaborador não encontrado.');
    assertCicloOperavel(aplicacao.ciclo, 'designação');

    // ⚠️ A autoavaliação NÃO é checada aqui — mora em `efeitoDeDesignar`, com a
    // troca de aplicação, para a prévia rodar exatamente as mesmas guardas que
    // o ato. Ela continua barrada (a ação vem `RECUSAR`, e a linha abaixo
    // lança); o que mudou é que agora a tela sabe disso ANTES de oferecer.
    // Ver o cabeçalho do classificador.

    const existente = await this.prisma.avaliacao.findUnique({
      where: { cicloId_avaliadoId: { cicloId: aplicacao.cicloId, avaliadoId } },
      select: {
        id: true, aplicacaoId: true, avaliadorId: true, status: true,
        _count: { select: { respostas: true } },
      },
    });

    /**
     * ⭐⭐ TROCAR O AVALIADOR DE QUEM JÁ RESPONDEU é o mesmo problema que o lote
     * do cadastro recusava como `JA_RESPONDIDA` — e aqui não havia checagem
     * nenhuma: o `upsert` trocava o nome em silêncio. Medido em 08/09: 368
     * trocas de avaliador na auditoria do DEV, zero sobre respondida. Sorte.
     */
    const trocaDeAplicacao = existente !== null && existente.aplicacaoId !== aplicacaoId;

    const efeito = efeitoDeDesignar(
      existente
        ? {
            status: existente.status,
            respostas: existente._count.respostas,
            avaliadorId: existente.avaliadorId,
            avaliadorNome: await this.nomeDoColaborador(existente.avaliadorId),
            aplicacaoId: existente.aplicacaoId,
            // Só custa uma busca quando a aplicação MUDA — e é só aí que a
            // frase de recusa precisa dizer de onde a avaliação sairia.
            aplicacaoNome: trocaDeAplicacao
              ? await this.nomeDaAplicacao(existente.aplicacaoId)
              : null,
          }
        : null,
      {
        avaliadoId,
        nomeDoAvaliado: avaliado.nome,
        novoAvaliadorId: avaliadorId,
        novoAvaliadorNome: await this.nomeDoColaborador(avaliadorId),
        aplicacaoId,
      },
    );
    // ⭐ UMA porta. `RECUSAR` cobre agora autoavaliação, cancelada e troca de
    // aplicação impedida — as três vêm do classificador, então a prévia
    // enxerga exatamente as mesmas três.
    if (efeito.acao === 'RECUSAR') throw new BadRequestException(efeito.frase!);
    if (efeito.acao === 'EXIGE_CONFIRMACAO' && !confirmarTrocaDeAvaliador) {
      throw new BadRequestException(efeito.frase!);
    }

    const avaliacao = await this.prisma.avaliacao.upsert({
      where: { cicloId_avaliadoId: { cicloId: aplicacao.cicloId, avaliadoId } },
      update: { avaliadorId, aplicacaoId, origemDesignacao: origem },
      create: {
        cicloId: aplicacao.cicloId,
        aplicacaoId,
        avaliadoId,
        avaliadorId,
        origemDesignacao: origem,
        filialSnapshot: avaliado.filial,
        centroCustoSnapshot: avaliado.centroCusto,
        cargoSnapshot: avaliado.cargoDescricao,
      },
    });

    await this.auditoria.registrar({
      entidade: 'Avaliacao',
      entidadeId: avaliacao.id,
      // A troca de aplicação é ato distinto de designar pela primeira vez: muda
      // QUAL questionário a pessoa responde, e quem for reconstruir o ciclo
      // meses depois precisa achar isso sem ler o diff de dois campos.
      // ⚠️ Trocar o avaliador de uma avaliação já respondida não pode ter o
      // mesmo nome de designar pela primeira vez: é o ato que alguém vai
      // procurar quando a memória de cálculo mostrar um nome inesperado.
      acao: trocaDeAplicacao
        ? 'DESIGNAR_TROCA_APLICACAO'
        : efeito.acao === 'EXIGE_CONFIRMACAO'
          ? 'DESIGNAR_TROCA_AVALIADOR_RESPONDIDA'
          : 'DESIGNAR',
      usuarioId,
      valorAnterior: existente
        ? { aplicacaoId: existente.aplicacaoId, avaliadorId: existente.avaliadorId, status: existente.status }
        : undefined,
      valorNovo: { avaliadoId, avaliadorId, aplicacaoId, origem },
    });
    return avaliacao;
  }

  /**
   * ⭐ TROCAR A APLICAÇÃO DE QUEM JÁ RESPONDEU PRODUZ NOTA ERRADA, SEM ERRO.
   *
   * `Resposta` aponta para perguntas de um modelo; `Avaliacao.aplicacaoId` é
   * quem decide de qual `ModeloVersao` as perguntas são lidas
   * (`avaliacao.service.ts`, `itensRespondidos`). Trocar a aplicação deixa as
   * respostas órfãs — e, se a avaliação já foi enviada, a apuração combina a
   * `notaAvaliacao` CONGELADA do modelo antigo com o `pesoAvaliacao` e os
   * `AplicacaoCriterio` da aplicação nova (`apuracao.service.ts`). Sai um
   * número diferente, e nada acusa: não há exceção, não há alerta, e a memória
   * de cálculo fica consistente consigo mesma.
   *
   * É a família de defeito que este módulo existe para eliminar — o antigo
   * dividia por 18 fixo, o `NVL` fora da soma dava média zero — e ela nasceu
   * aqui dentro, num `upsert` que atualizava `aplicacaoId` de passagem.
   *
   * A regra é uma só: **nada de valor se perde numa troca.**
   *
   *   - ENVIADA           → recusa sempre. A nota é o valor, mesmo sem resposta.
   *   - com N respostas   → recusa DIZENDO N, para a tela poder perguntar.
   *   - sem nada gravado  → passa, e a troca vai para a auditoria.
   *
   * ⚠️ Trocar só o AVALIADOR, dentro da mesma aplicação, NÃO passa por esta
   * regra: não há modelo diferente envolvido e nenhuma resposta muda de
   * instrumento.
   *
   * ⚠️⚠️ **ONDE ELA MORA HOJE (08/09).** A decisão sempre foi a função pura
   * `decidirTrocaDeAplicacao`; o que existia aqui era um método
   * (`assertPodeTrocarDeAplicacao`) que a consultava **depois** do
   * classificador, e que só o ATO chamava. A prévia não o chamava, e por isso
   * prometia `SUBSTITUIR` onde o ato lançava. A consulta subiu para
   * `efeitoDeDesignar`, que prévia e ato já compartilhavam — então **não há
   * mais dois caminhos para manter em acordo**. A cópia do cadastro segue
   * chamando a mesma função pura direto, porque a recusa dela não é exceção: é
   * uma linha do relatório e o lote continua.
   */

  /** O nome da aplicação, para a frase de recusa da troca dizer de onde ela sairia. */
  private async nomeDaAplicacao(id: string): Promise<string | null> {
    const a = await this.prisma.aplicacao.findUnique({ where: { id }, select: { nome: true } });
    return a?.nome ?? null;
  }

  // ── COPIAR O CADASTRO PARA O CICLO ────────────────────────────────────────

  /**
   * ⭐ O BOTÃO QUE TROCA ~1.000 OPERAÇÕES POR UMA.
   *
   * `rh.designacao_padrao` diz quem avalia quem na PLATAFORMA. Isto copia para
   * o ciclo, criando a `Avaliacao` de cada pessoa do público de cada aplicação.
   *
   * ⚠️ `aplicar = false` é PRÉVIA: calcula tudo e não grava nada. É o mesmo
   * padrão da importação da planilha, pela mesma razão — mil linhas conferidas
   * depois de gravadas não são conferidas.
   *
   * Quatro coisas que o lote NÃO faz, e cada uma vira linha do relatório:
   *
   *   SEM_AVALIADOR_NO_CADASTRO  a pessoa não está na lista de ninguém. Não é
   *                              erro do lote: é a pendência do cadastro, e
   *                              some quando alguém a resolver lá.
   *   AJUSTE_MANUAL_DO_CICLO     o RH já designou esta pessoa à mão DENTRO do
   *                              ciclo. Copiar por cima apagaria a decisão
   *                              dela; só passa com `substituirManuais`.
   *   JA_RESPONDIDA              tem resposta gravada ou foi enviada. Trocar o
   *                              avaliador agora atribuiria o julgamento de
   *                              alguém a outra pessoa.
   *   TROCA_DE_APLICACAO         a mesma regra do `designar()`, pela MESMA
   *                              função (`decidirTrocaDeAplicacao`) — só que
   *                              aqui a recusa não aborta o lote: ela conta e
   *                              o resto segue. Abortar por causa de uma
   *                              pessoa deixaria as outras 999 sem designação
   *                              e sem explicação.
   *
   * ⚠️ REEXECUTÁVEL de propósito. O cadastro vai mudar quando a lista do RH
   * chegar; rodar de novo atualiza o que mudou, não duplica (`jaIguais` sai
   * sem escrita) e não toca no que já foi respondido.
   */
  async copiarDoCadastro(
    cicloId: string,
    opcoes: { aplicar: boolean; substituirManuais: boolean },
    usuarioId: string,
  ): Promise<RelatorioDaCopia> {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id: cicloId },
      include: { aplicacoes: { orderBy: { ordem: 'asc' }, select: { id: true, nome: true } } },
    });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');
    // ⚠️ Só quando GRAVA: a prévia é leitura e continua abrindo no encerrado —
    // é assim que se descobre o que teria acontecido antes de reabrir.
    if (opcoes.aplicar) assertCicloOperavel(ciclo, 'designação em lote');
    if (ciclo.aplicacoes.length === 0) {
      throw new BadRequestException(
        'O ciclo não tem nenhuma aplicação. Monte as aplicações e o público antes de designar.',
      );
    }

    const relatorio: RelatorioDaCopia = {
      cicloId,
      aplicado: opcoes.aplicar,
      substituirManuais: opcoes.substituirManuais,
      criar: 0,
      atualizar: 0,
      jaIguais: 0,
      deDivisaoNaoRevisada: 0,
      naoAplicadas: [],
      porMotivo: {},
      porAplicacao: [],
      avisos: [],
    };

    // A régua da elegibilidade é a MESMA da tela de designação, de propósito:
    // duas contas de "quem deveria estar no ciclo" divergem no primeiro ajuste
    // manual, e o lote passaria a designar gente que a tela já tinha excluído.
    const elegiveisPorAplicacao = new Map<string, LinhaDaLista[]>();
    for (const a of ciclo.aplicacoes) {
      elegiveisPorAplicacao.set(a.id, (await this.listar(a.id)).filter((l) => l.elegivel));
    }
    const todosIds = [...elegiveisPorAplicacao.values()].flat().map((l) => l.colaboradorId);

    const [cadastro, avaliacoes, aplicacoesPorId] = await Promise.all([
      this.prisma.designacaoPadrao.findMany({
        where: { avaliadoId: { in: todosIds }, vigenciaFim: null },
        select: { avaliadoId: true, avaliadorId: true, origem: true },
      }),
      this.prisma.avaliacao.findMany({
        where: { cicloId },
        select: {
          id: true, avaliadoId: true, avaliadorId: true, aplicacaoId: true,
          status: true, origemDesignacao: true, _count: { select: { respostas: true } },
        },
      }),
      Promise.resolve(new Map(ciclo.aplicacoes.map((a) => [a.id, a.nome]))),
    ]);

    const doCadastro = new Map(cadastro.map((c) => [c.avaliadoId, c]));
    const avaliacaoDe = new Map(avaliacoes.map((a) => [a.avaliadoId, a]));
    const aExecutar: { aplicacaoId: string; avaliadoId: string; avaliadorId: string }[] = [];

    const recusar = (linha: LinhaDaLista, motivo: MotivoNaoAplicada, detalhe: string) => {
      relatorio.naoAplicadas.push({
        colaboradorId: linha.colaboradorId, nome: linha.nome, matricula: linha.matricula,
        centroCusto: linha.centroCusto, motivo, detalhe,
      });
      relatorio.porMotivo[motivo] = (relatorio.porMotivo[motivo] ?? 0) + 1;
    };

    for (const aplicacao of ciclo.aplicacoes) {
      const linhas = elegiveisPorAplicacao.get(aplicacao.id) ?? [];
      const contadores = { criar: 0, atualizar: 0, jaIguais: 0, semAvaliador: 0, naoAplicadas: 0 };

      for (const linha of linhas) {
        const noCadastro = doCadastro.get(linha.colaboradorId);
        const existente = avaliacaoDe.get(linha.colaboradorId);

        if (!noCadastro) {
          contadores.naoAplicadas++;
          // ⭐⭐ A FRASE DEPENDE DO OUTRO EIXO. Sem cadastro, o lote não tem o
          // que copiar — mas isso NÃO quer dizer que a pessoa fica de fora do
          // ciclo: ela pode já ter sido designada à mão, com avaliador e tudo.
          // Dizer "ficará de fora" sobre quem está dentro é o defeito de
          // raciocínio do item F: classificar pelo cadastro e escrever sobre o
          // ciclo.
          if (existente && existente.status !== 'CANCELADA') {
            recusar(
              linha,
              'SEM_CADASTRO_JA_DESIGNADA',
              'Já foi designada dentro do ciclo e não está na lista de ninguém no cadastro — ' +
                'o lote não tem o que copiar por cima. Ela continua com o avaliador atual e ' +
                'NÃO fica de fora. ⚠️ Nem "substituir os ajustes manuais" muda isto: substituir ' +
                'por um cadastro que não existe a deixaria sem avaliador nenhum. Para o próximo ' +
                'ciclo, registre quem a avalia no cadastro de avaliadores.',
            );
            continue;
          }
          contadores.semAvaliador++;
          recusar(
            linha,
            'SEM_AVALIADOR_NO_CADASTRO',
            'Não está na lista de nenhum avaliador e não tem avaliação neste ciclo. Resolva no ' +
              'cadastro de avaliadores — enquanto isso, esta pessoa fica de fora do ciclo sem ' +
              'gerar avaliação.',
          );
          continue;
        }

        if (existente && existente.avaliadorId === noCadastro.avaliadorId
            && existente.aplicacaoId === aplicacao.id) {
          contadores.jaIguais++;
          relatorio.jaIguais++;
          continue;
        }

        if (existente) {
          const respondida = existente.status === 'ENVIADA' || existente._count.respostas > 0;
          if (respondida) {
            contadores.naoAplicadas++;
            recusar(
              linha,
              'JA_RESPONDIDA',
              `A avaliação está ${existente.status} — respostas gravadas: ${existente._count.respostas}. ` +
                'Trocar o avaliador agora atribuiria o julgamento de uma pessoa a outra.',
            );
            continue;
          }
          if (existente.origemDesignacao === 'MANUAL' && !opcoes.substituirManuais) {
            contadores.naoAplicadas++;
            recusar(
              linha,
              'AJUSTE_MANUAL_DO_CICLO',
              'Alguém já designou esta pessoa à mão dentro do ciclo. Copiar o cadastro por cima ' +
                'apagaria essa decisão — marque "substituir os ajustes manuais" se o cadastro é ' +
                'que está certo.',
            );
            continue;
          }
          if (existente.aplicacaoId !== aplicacao.id) {
            // MESMA função do designar(). O que muda é o que se faz com a
            // recusa: aqui ela conta e o lote segue.
            const decisao = decidirTrocaDeAplicacao({
              status: existente.status,
              respostas: existente._count.respostas,
            });
            if (!decisao.permitida) {
              contadores.naoAplicadas++;
              recusar(
                linha,
                'TROCA_DE_APLICACAO',
                mensagemDaRecusa(decisao.motivo as MotivoDaRecusa, {
                  nomeDoAvaliado: linha.nome,
                  aplicacaoAtual: aplicacoesPorId.get(existente.aplicacaoId) ?? 'outra aplicação',
                  respostas: existente._count.respostas,
                }),
              );
              continue;
            }
          }
        }

        if (noCadastro.origem === 'DIVISAO_AUTOMATICA') relatorio.deDivisaoNaoRevisada++;
        if (existente) {
          contadores.atualizar++;
          relatorio.atualizar++;
        } else {
          contadores.criar++;
          relatorio.criar++;
        }
        aExecutar.push({
          aplicacaoId: aplicacao.id,
          avaliadoId: linha.colaboradorId,
          avaliadorId: noCadastro.avaliadorId,
        });
      }

      relatorio.porAplicacao.push({
        aplicacaoId: aplicacao.id,
        nome: aplicacao.nome,
        publico: linhas.length,
        ...contadores,
      });
    }

    if (relatorio.deDivisaoNaoRevisada > 0) {
      relatorio.avisos.push(
        `Vindas de divisão que ninguém revisou: ${relatorio.deDivisaoNaoRevisada}. A importação ` +
          'dividiu em ordem alfabética. A ordem é arbitrária e não diz quem trabalha com ' +
          'quem — se este ciclo valer mérito, revise no cadastro de avaliadores antes de aplicar.',
      );
    }
    // ⚠️ Só quem fica de fora DE VERDADE entra neste aviso. Quem não tem
    // cadastro mas já foi designada no ciclo tem aviso próprio, abaixo — e ele
    // não fala em ficar de fora, porque ela não fica.
    if (relatorio.porMotivo.SEM_AVALIADOR_NO_CADASTRO) {
      relatorio.avisos.push(
        `Fora do cadastro e sem avaliação no ciclo: ${relatorio.porMotivo.SEM_AVALIADOR_NO_CADASTRO}. ` +
          'Quem está nesta conta não aparece na lista de ninguém no cadastro, não tem avaliação ' +
          'neste ciclo e fica de fora do ciclo. Aparece como pendência do cadastro e no painel.',
      );
    }
    if (relatorio.porMotivo.SEM_CADASTRO_JA_DESIGNADA) {
      relatorio.avisos.push(
        `Já designadas à mão, mas fora do cadastro: ${relatorio.porMotivo.SEM_CADASTRO_JA_DESIGNADA}. ` +
          'Quem está nesta conta segue com o avaliador que tem — o lote não muda nada aqui —, mas o ' +
          'PRÓXIMO ciclo vai encontrar essa pessoa sem avaliador. Registre quem a avalia no ' +
          'cadastro de avaliadores.',
      );
    }

    if (!opcoes.aplicar) return relatorio;

    // Uma por vez, pelo mesmo caminho da designação individual: o snapshot, a
    // auditoria e a guarda são os do `designar()`, não uma segunda versão deles.
    const inicio = Date.now();
    for (const item of aExecutar) {
      await this.designar(item.aplicacaoId, item.avaliadoId, item.avaliadorId, usuarioId, 'CENTRO_CUSTO');
    }
    relatorio.duracaoMs = Date.now() - inicio;

    await this.auditoria.registrar({
      entidade: 'Ciclo', entidadeId: cicloId, acao: 'COPIAR_DESIGNACAO_DO_CADASTRO', usuarioId,
      valorNovo: {
        criadas: relatorio.criar, atualizadas: relatorio.atualizar, jaIguais: relatorio.jaIguais,
        naoAplicadas: relatorio.naoAplicadas.length, porMotivo: relatorio.porMotivo,
        deDivisaoNaoRevisada: relatorio.deDivisaoNaoRevisada,
        substituirManuais: opcoes.substituirManuais, duracaoMs: relatorio.duracaoMs,
      },
    });
    return relatorio;
  }

  /** Quem já tem avaliador designado no ciclo, com o nome de quem avalia. */
  private async designacoesVigentes(cicloId: string) {
    const avaliacoes = await this.prisma.avaliacao.findMany({
      where: { cicloId },
      select: {
        id: true,
        avaliadoId: true,
        avaliadorId: true,
        status: true,
        motivoCancelamento: true,
        _count: { select: { respostas: true } },
      },
    });
    if (avaliacoes.length === 0) return new Map<string, DesignacaoVigente>();

    const avaliadores = await this.prisma.colaborador.findMany({
      where: { id: { in: [...new Set(avaliacoes.map((a) => a.avaliadorId))] } },
      select: { id: true, nome: true },
    });
    const nomePorId = new Map(avaliadores.map((c) => [c.id, c.nome]));

    return new Map<string, DesignacaoVigente>(
      avaliacoes.map((a) => [
        a.avaliadoId,
        {
          id: a.id,
          motivoCancelamento: a.motivoCancelamento,
          avaliadorId: a.avaliadorId,
          avaliadorNome: nomePorId.get(a.avaliadorId) ?? '(colaborador não encontrado)',
          status: a.status as string,
          respostas: a._count.respostas,
        },
      ]),
    );
  }

  /**
   * ⭐⭐ A PRÉVIA DA DESIGNAÇÃO — o que o botão vai fazer com CADA um dos N.
   *
   * O diálogo em lote não dizia **quem** eram as N, não avisava que ia
   * **sobrescrever** quem já tinha avaliador, e não dava retorno nenhum. Era a
   * família do modal de vínculo: botão armado com efeito que a tela não mostra.
   *
   * ⚠️ A conta vem daqui, da MESMA função que o `designar()` usa para decidir
   * (`efeitoDeDesignar`). A tela não recalcula quantos serão substituídos — se
   * recalculasse, a prévia e o ato divergiriam no primeiro caso de borda, que é
   * exatamente o defeito que ela veio evitar.
   */
  async previaDaDesignacao(aplicacaoId: string, avaliadoIds: string[], avaliadorId: string) {
    const aplicacao = await this.prisma.aplicacao.findUnique({
      where: { id: aplicacaoId },
      select: { id: true, cicloId: true },
    });
    if (!aplicacao) throw new NotFoundException('Aplicação não encontrada.');

    const [pessoas, avaliacoes, avaliador] = await Promise.all([
      this.prisma.colaborador.findMany({
        where: { id: { in: avaliadoIds } },
        select: { id: true, nome: true, matricula: true },
      }),
      this.prisma.avaliacao.findMany({
        where: { cicloId: aplicacao.cicloId, avaliadoId: { in: avaliadoIds } },
        select: {
          avaliadoId: true, avaliadorId: true, aplicacaoId: true, status: true,
          _count: { select: { respostas: true } },
        },
      }),
      this.prisma.colaborador.findUnique({ where: { id: avaliadorId }, select: { nome: true } }),
    ]);

    const porAvaliado = new Map(avaliacoes.map((a) => [a.avaliadoId, a]));
    /**
     * ⭐ Os nomes das aplicações de ORIGEM — só das que diferem desta, que são
     * as únicas em que a frase de recusa da troca precisa dizer de onde a
     * avaliação sairia. Uma busca para o lote inteiro, não uma por linha.
     */
    const nomesDeAplicacoes = new Map(
      (
        await this.prisma.aplicacao.findMany({
          where: {
            id: {
              in: [
                ...new Set(
                  avaliacoes.map((a) => a.aplicacaoId).filter((id) => id !== aplicacaoId),
                ),
              ],
            },
          },
          select: { id: true, nome: true },
        })
      ).map((a) => [a.id, a.nome]),
    );
    const nomesDeAvaliadores = new Map(
      (
        await this.prisma.colaborador.findMany({
          where: { id: { in: [...new Set(avaliacoes.map((a) => a.avaliadorId))] } },
          select: { id: true, nome: true },
        })
      ).map((c) => [c.id, c.nome]),
    );

    const linhas = pessoas
      .map((pessoa) => {
        const atual = porAvaliado.get(pessoa.id);
        const efeito = efeitoDeDesignar(
          atual
            ? {
                status: atual.status,
                respostas: atual._count.respostas,
                avaliadorId: atual.avaliadorId,
                avaliadorNome: nomesDeAvaliadores.get(atual.avaliadorId) ?? null,
                aplicacaoId: atual.aplicacaoId,
                aplicacaoNome: nomesDeAplicacoes.get(atual.aplicacaoId) ?? null,
              }
            : null,
          {
            // ⭐ O avaliado, para a guarda da autoavaliação rodar TAMBÉM aqui.
            // Sem ele, a prévia contava como `SUBSTITUIR` uma linha que o ato
            // recusa — a tela autorizando o que a API nega (§3.1.32).
            avaliadoId: pessoa.id,
            nomeDoAvaliado: pessoa.nome,
            novoAvaliadorId: avaliadorId,
            novoAvaliadorNome: avaliador?.nome ?? null,
            aplicacaoId,
          },
        );
        return {
          colaboradorId: pessoa.id,
          nome: pessoa.nome,
          matricula: pessoa.matricula,
          acao: efeito.acao,
          avaliadorAtual: efeito.avaliadorAtual,
          estadoAtual: efeito.estadoAtual,
          frase: efeito.frase,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const conta = (acao: EfeitoDaDesignacao['acao']) => linhas.filter((l) => l.acao === acao).length;
    return {
      avaliadorNome: avaliador?.nome ?? null,
      total: linhas.length,
      /** ⭐ Mesmo significado do `criar` de `copiarDoCadastro` — ver o tipo lá. */
      criar: conta('CRIAR'),
      /** O `atualizar` de `copiarDoCadastro`, com outro nome. */
      substituir: conta('SUBSTITUIR'),
      /** O `jaIguais` de `copiarDoCadastro`, com outro nome. */
      nadaAFazer: conta('NADA_A_FAZER'),
      recusar: conta('RECUSAR'),
      /**
       * ⭐⭐ O QUINTO BALDE. São CINCO ações e havia quatro contadores:
       * `EXIGE_CONFIRMACAO` ficava só dentro de `avisoDeRespondidas`, como
       * frase, e sumia da soma. Trocar o avaliador de uma pessoa que já
       * respondeu devolvia `criar: 0, substituir: 0, nadaAFazer: 0, recusar: 0,
       * total: 1` — o resumo da tela dizia "0 ganham · 0 SUBSTITUÍDO" e o botão
       * logo abaixo aplicava 1, porque ele conta `linhas`. O buraco saía daqui
       * pronto; a tela não calculava nada.
       *
       * ⚠️ NÃO somar dentro de `substituir`: é justamente a distinção de que o
       * bloco vermelho e a flag `confirmar` dependem — dobrada, a tela perderia
       * como saber quais linhas pedem confirmação explícita.
       *
       * A soma dos cinco é igual a `total`, e há teste de invariante cobrando
       * isso (`previa-fecha-a-conta.spec.ts`).
       */
      exigeConfirmacao: conta('EXIGE_CONFIRMACAO'),
      /** ⭐ A explicação do grupo, UMA vez — a lista abaixo diz só de quem se trata. */
      avisoDeRespondidas: avisoDeTrocaEmRespondidas(conta('EXIGE_CONFIRMACAO')),
      linhas,
    };
  }

  private async nomeDoColaborador(id: string): Promise<string | null> {
    const c = await this.prisma.colaborador.findUnique({ where: { id }, select: { nome: true } });
    return c?.nome ?? null;
  }

  private async decisoesVigentes(cicloId: string) {
    const linhas = await this.prisma.cicloElegibilidade.findMany({
      where: { cicloId, removidoEm: null },
    });
    return new Map(linhas.map((l) => [l.colaboradorId, l]));
  }

  private paraLinha(c: CandidatoDesignacao & { centroCusto?: string | null; filial?: string }) {
    return {
      colaboradorId: c.colaboradorId,
      matricula: c.matricula,
      nome: c.nome,
      centroCusto: c.centroCusto ?? null,
      filial: c.filial ?? '',
    };
  }
}
