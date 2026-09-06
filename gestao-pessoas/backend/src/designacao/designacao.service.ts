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
  montarListaInicial,
  type CandidatoDesignacao,
  type MotivoExclusao,
} from './elegibilidade-ciclo.js';
import { MOTIVO_ACESSO_RESTRITO } from '../avaliacao/separacao-funcoes.js';
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
   * ⭐ A linha de quem está OLHANDO a lista, marcada. A §3.1 manda "mostrar a
   * linha marcada, nunca filtrar em silêncio", e esta lista mostra, por pessoa,
   * QUEM a avalia e o status da avaliação dela — a gestora se vê aqui com
   * "Avalia: CLAUDIMAR · PENDENTE". Resultados já marcava; esta não marcava.
   */
  restrita?: boolean;
  motivoRestricao?: string;
}

interface DesignacaoVigente {
  avaliadorId: string;
  avaliadorNome: string;
  status: string;
}


export type MotivoNaoAplicada =
  | 'SEM_AVALIADOR_NO_CADASTRO'
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
  criar: number;
  atualizar: number;
  jaIguais: number;
  /** Das que serão gravadas, quantas vêm de divisão automática NÃO revisada. */
  deDivisaoNaoRevisada: number;
  naoAplicadas: LinhaNaoAplicada[];
  porMotivo: Partial<Record<MotivoNaoAplicada, number>>;
  porAplicacao: {
    aplicacaoId: string;
    nome: string;
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

    const semDesignacao = { avaliadorId: null, avaliadorNome: null, avaliacaoStatus: null };
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
    if (!colaboradorId) return comDecisao;
    return comDecisao.map((l) =>
      l.colaboradorId === colaboradorId
        ? { ...l, restrita: true, motivoRestricao: MOTIVO_ACESSO_RESTRITO }
        : { ...l, restrita: false },
    );
  }

  /**
   * Decisão manual do RH — incluir alguém que a régua excluiu, ou o contrário.
   * A decisão anterior, se houver, é MARCADA como removida e permanece.
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

    const vigente = await this.prisma.cicloElegibilidade.findFirst({
      where: { cicloId, colaboradorId, removidoEm: null },
    });

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
      await this.auditoria.registrar({
        entidade: 'CicloElegibilidade',
        entidadeId: nova.id,
        acao: `DECIDIR_${decisao}`,
        usuarioId,
        valorAnterior: vigente ? { decisao: vigente.decisao, motivo: vigente.motivo } : undefined,
        valorNovo: { decisao, justificativa },
      });
      return nova;
    });
  }

  /**
   * Designa avaliador. `@@unique([cicloId, avaliadoId])` garante um avaliador por
   * avaliado — e o snapshot congela filial, centro de custo e cargo, para o
   * resultado histórico não se mover se a pessoa mudar de área depois.
   *
   * ⚠️ Quando a pessoa JÁ tem avaliação neste ciclo e a designação a manda para
   * OUTRA aplicação, a troca passa por `assertPodeTrocarDeAplicacao` antes de
   * qualquer escrita. Ver o comentário lá: é o defeito silencioso que nasceu
   * dentro deste método.
   */
  async designar(
    aplicacaoId: string,
    avaliadoId: string,
    avaliadorId: string,
    usuarioId: string,
    origem: 'CENTRO_CUSTO' | 'MANUAL' = 'CENTRO_CUSTO',
  ) {
    const [aplicacao, avaliado] = await Promise.all([
      this.prisma.aplicacao.findUnique({ where: { id: aplicacaoId } }),
      this.prisma.colaborador.findUnique({ where: { id: avaliadoId } }),
    ]);
    if (!aplicacao) throw new NotFoundException('Aplicação não encontrada.');
    if (!avaliado) throw new NotFoundException('Colaborador não encontrado.');

    if (avaliadoId === avaliadorId) {
      // Autoavaliação não existe (decisão A2/F1), e deixar passar aqui seria a
      // separação de funções perdendo o sentido antes mesmo de começar.
      throw new BadRequestException('Ninguém pode ser o avaliador da própria avaliação.');
    }

    const existente = await this.prisma.avaliacao.findUnique({
      where: { cicloId_avaliadoId: { cicloId: aplicacao.cicloId, avaliadoId } },
      select: { id: true, aplicacaoId: true, avaliadorId: true, status: true },
    });
    const trocaDeAplicacao = existente !== null && existente.aplicacaoId !== aplicacaoId;
    if (trocaDeAplicacao) {
      await this.assertPodeTrocarDeAplicacao(existente, avaliado.nome);
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
      acao: trocaDeAplicacao ? 'DESIGNAR_TROCA_APLICACAO' : 'DESIGNAR',
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
   * ⚠️ Trocar só o AVALIADOR, dentro da mesma aplicação, NÃO passa por aqui:
   * não há modelo diferente envolvido e nenhuma resposta muda de instrumento.
   */
  private async assertPodeTrocarDeAplicacao(
    existente: { id: string; aplicacaoId: string; status: string },
    nomeDoAvaliado: string,
  ) {
    const [respostas, origem] = await Promise.all([
      this.prisma.resposta.count({ where: { avaliacaoId: existente.id } }),
      this.prisma.aplicacao.findUnique({
        where: { id: existente.aplicacaoId },
        select: { nome: true },
      }),
    ]);

    // A DECISÃO é da função pura, compartilhada com a cópia do cadastro. Aqui
    // só se escolhe o que fazer com ela: uma por vez, recusa é exceção.
    const decisao = decidirTrocaDeAplicacao({ status: existente.status, respostas });
    if (decisao.permitida) return;

    throw new BadRequestException(
      mensagemDaRecusa(decisao.motivo as MotivoDaRecusa, {
        nomeDoAvaliado,
        aplicacaoAtual: origem?.nome ?? 'outra aplicação',
        respostas,
      }),
    );
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
        if (!noCadastro) {
          contadores.semAvaliador++;
          contadores.naoAplicadas++;
          recusar(
            linha,
            'SEM_AVALIADOR_NO_CADASTRO',
            'Não está na lista de nenhum avaliador. Resolva no cadastro de avaliadores — ' +
              'enquanto isso, esta pessoa fica de fora do ciclo sem gerar avaliação.',
          );
          continue;
        }

        const existente = avaliacaoDe.get(linha.colaboradorId);
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
              `A avaliação está ${existente.status} com ${existente._count.respostas} resposta(s). ` +
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
        `${relatorio.deDivisaoNaoRevisada} designação(ões) vêm de linhas que a importação dividiu ` +
          'em ordem alfabética e ninguém revisou. A ordem é arbitrária e não diz quem trabalha com ' +
          'quem — se este ciclo valer mérito, revise no cadastro de avaliadores antes de aplicar.',
      );
    }
    if (relatorio.porMotivo.SEM_AVALIADOR_NO_CADASTRO) {
      relatorio.avisos.push(
        `${relatorio.porMotivo.SEM_AVALIADOR_NO_CADASTRO} pessoa(s) não estão na lista de ninguém e ` +
          'ficarão de fora do ciclo. Elas aparecem como pendência do cadastro e no painel.',
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
      select: { avaliadoId: true, avaliadorId: true, status: true },
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
          avaliadorId: a.avaliadorId,
          avaliadorNome: nomePorId.get(a.avaliadorId) ?? '(colaborador não encontrado)',
          status: a.status as string,
        },
      ]),
    );
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
