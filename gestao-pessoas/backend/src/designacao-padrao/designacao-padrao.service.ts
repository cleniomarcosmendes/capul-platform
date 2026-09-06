/**
 * CADASTRO DE QUEM AVALIA QUEM — `rh.designacao_padrao`.
 *
 * É da PLATAFORMA, não do ciclo: cada ciclo copia daqui, e é isto que faz a
 * distribuição de um ano ser reaproveitada no seguinte.
 *
 * ⭐ A VISÃO PRINCIPAL É A PENDÊNCIA REVERSA — quem NÃO está na lista de
 * ninguém. Quem abre o cadastro precisa ver o que falta, não o que já existe.
 * A lista completa por avaliador responde "como está"; a pendência responde
 * "quem sumiria em silêncio", que é a pergunta que faz alguém agir. Hoje são
 * 188 pessoas, e 61 delas estão num único centro de custo sem nenhuma chefia.
 *
 * ⚠️ Nada aqui APAGA linha. Tirar alguém de uma lista é encerrar a vigência
 * (`vigenciaFim`), e a linha continua. Desfazer uma importação inteira é a
 * mesma coisa, em lote. É a regra do `CicloElegibilidade`: reverter não pode
 * fazer o histórico desaparecer, porque é o que se lê numa contestação meses
 * depois.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SITUACOES_ELEGIVEIS } from '../common/elegibilidade.js';
import {
  conferenciaDe,
  lerPlanilhaDeAvaliadores,
  PlanilhaInvalidaError,
} from './planilha.js';
import { montarPrevia, type ParaGravar, type Previa } from './distribuicao.js';
import { marcarRestricoesPor } from '../avaliacao/separacao-funcoes.js';

/** Origem que significa "ninguém decidiu esta linha ainda". */
const NAO_REVISADA = 'DIVISAO_AUTOMATICA';

export interface PessoaSemAvaliador {
  colaboradorId: string;
  matricula: string;
  nome: string;
  filial: string;
  centroCusto: string | null;
  centroCustoDescricao: string | null;
  cargo: string | null;
}

export interface GrupoSemAvaliador {
  chave: string;
  descricao: string | null;
  pessoas: PessoaSemAvaliador[];
}

export interface PendenciasDoCadastro {
  semAvaliador: { total: number; grupos: GrupoSemAvaliador[] };
  /** Linhas que a divisão automática arbitrou e ninguém olhou ainda. */
  naoRevisadas: { total: number; avaliadores: { avaliadorId: string; nome: string; quantos: number }[] };
  totais: { elegiveis: number; comAvaliador: number; avaliadores: number; provisorias: number };
}

@Injectable()
export class DesignacaoPadraoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private get vigente() {
    return { vigenciaFim: null };
  }

  /**
   * ⭐ A VISÃO PRINCIPAL. Quem está fora de toda lista, agrupado por filial ×
   * centro de custo — que é como se resolve: nomeando o responsável de um
   * grupo, não caçando pessoa por pessoa.
   */
  async pendencias(): Promise<PendenciasDoCadastro> {
    const [elegiveis, vigentes] = await Promise.all([
      this.prisma.colaborador.findMany({
        where: { situacao: { in: SITUACOES_ELEGIVEIS as never[] } },
        select: {
          id: true, matricula: true, nome: true, filial: true,
          centroCusto: true, centroCustoDescricao: true, cargoDescricao: true,
        },
        orderBy: [{ filial: 'asc' }, { centroCusto: 'asc' }, { nome: 'asc' }],
      }),
      this.prisma.designacaoPadrao.findMany({
        where: this.vigente,
        select: { avaliadoId: true, avaliadorId: true, origem: true, provisorio: true },
      }),
    ]);

    const comAvaliador = new Set(vigentes.map((v) => v.avaliadoId));
    const grupos = new Map<string, GrupoSemAvaliador>();
    for (const c of elegiveis) {
      if (comAvaliador.has(c.id)) continue;
      const chave = `${c.filial}|${c.centroCusto ?? '(sem centro de custo)'}`;
      const g = grupos.get(chave) ?? { chave, descricao: c.centroCustoDescricao, pessoas: [] };
      g.pessoas.push({
        colaboradorId: c.id, matricula: c.matricula, nome: c.nome, filial: c.filial,
        centroCusto: c.centroCusto, centroCustoDescricao: c.centroCustoDescricao,
        cargo: c.cargoDescricao,
      });
      grupos.set(chave, g);
    }

    const naoRevisadasPorAvaliador = new Map<string, number>();
    for (const v of vigentes) {
      if (v.origem !== NAO_REVISADA) continue;
      naoRevisadasPorAvaliador.set(v.avaliadorId, (naoRevisadasPorAvaliador.get(v.avaliadorId) ?? 0) + 1);
    }
    const nomePorId = new Map(elegiveis.map((c) => [c.id, c.nome]));

    return {
      semAvaliador: {
        total: [...grupos.values()].reduce((t, g) => t + g.pessoas.length, 0),
        // O maior grupo primeiro: é o que dá mais resultado por decisão tomada.
        grupos: [...grupos.values()].sort((a, b) => b.pessoas.length - a.pessoas.length),
      },
      naoRevisadas: {
        total: [...naoRevisadasPorAvaliador.values()].reduce((t, n) => t + n, 0),
        avaliadores: [...naoRevisadasPorAvaliador.entries()]
          .map(([avaliadorId, quantos]) => ({
            avaliadorId,
            nome: nomePorId.get(avaliadorId) ?? '(fora do cadastro ativo)',
            quantos,
          }))
          .sort((a, b) => b.quantos - a.quantos),
      },
      totais: {
        elegiveis: elegiveis.length,
        comAvaliador: comAvaliador.size,
        avaliadores: new Set(vigentes.map((v) => v.avaliadorId)).size,
        provisorias: vigentes.filter((v) => v.provisorio).length,
      },
    };
  }

  /** A segunda visão: um cartão por avaliador, com quantos ainda não foram olhados. */
  async porAvaliador() {
    const vigentes = await this.prisma.designacaoPadrao.findMany({
      where: this.vigente,
      select: { avaliadorId: true, origem: true, provisorio: true },
    });
    if (vigentes.length === 0) return [];

    const avaliadores = await this.prisma.colaborador.findMany({
      where: { id: { in: [...new Set(vigentes.map((v) => v.avaliadorId))] } },
      select: { id: true, nome: true, matricula: true, filial: true, cargoDescricao: true, centroCustoDescricao: true },
    });
    const porId = new Map(avaliadores.map((c) => [c.id, c]));

    const agregado = new Map<string, { total: number; naoRevisadas: number; provisorias: number }>();
    for (const v of vigentes) {
      const a = agregado.get(v.avaliadorId) ?? { total: 0, naoRevisadas: 0, provisorias: 0 };
      a.total++;
      if (v.origem === NAO_REVISADA) a.naoRevisadas++;
      if (v.provisorio) a.provisorias++;
      agregado.set(v.avaliadorId, a);
    }

    return [...agregado.entries()]
      .map(([avaliadorId, n]) => ({
        avaliadorId,
        nome: porId.get(avaliadorId)?.nome ?? '(fora do cadastro ativo)',
        matricula: porId.get(avaliadorId)?.matricula ?? '',
        filial: porId.get(avaliadorId)?.filial ?? '',
        cargo: porId.get(avaliadorId)?.cargoDescricao ?? null,
        area: porId.get(avaliadorId)?.centroCustoDescricao ?? null,
        ...n,
      }))
      .sort((a, b) => b.naoRevisadas - a.naoRevisadas || b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  /** A lista nominal de um avaliador. */
  /**
   * ⚠️ Recebe o colaborador logado para MARCAR a linha dele. Esta lista revela o
   * mesmo fato que a Designação — **quem avalia quem** —, e a linha traz
   * "Tirar", além de entrar no "Conferi, está certo" do bloco inteiro. Quem
   * abre a lista do próprio avaliador tem de ver que uma das linhas é ela.
   */
  async listaDe(avaliadorId: string, colaboradorId?: string | null) {
    const linhas = await this.prisma.designacaoPadrao.findMany({
      where: { avaliadorId, ...this.vigente },
      select: {
        id: true, avaliadoId: true, origem: true, origemReferencia: true,
        provisorio: true, observacao: true, vigenciaInicio: true, importacaoId: true,
      },
    });
    const pessoas = await this.prisma.colaborador.findMany({
      where: { id: { in: linhas.map((l) => l.avaliadoId) } },
      select: { id: true, nome: true, matricula: true, filial: true, cargoDescricao: true, centroCustoDescricao: true },
    });
    const porId = new Map(pessoas.map((c) => [c.id, c]));

    const lista = linhas
      .map((l) => ({
        id: l.id,
        colaboradorId: l.avaliadoId,
        nome: porId.get(l.avaliadoId)?.nome ?? '(colaborador não encontrado)',
        matricula: porId.get(l.avaliadoId)?.matricula ?? '',
        filial: porId.get(l.avaliadoId)?.filial ?? '',
        cargo: porId.get(l.avaliadoId)?.cargoDescricao ?? null,
        area: porId.get(l.avaliadoId)?.centroCustoDescricao ?? null,
        origem: l.origem,
        origemReferencia: l.origemReferencia,
        naoRevisada: l.origem === NAO_REVISADA,
        provisorio: l.provisorio,
        observacao: l.observacao,
        vigenciaInicio: l.vigenciaInicio,
        importacaoId: l.importacaoId,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    return marcarRestricoesPor(lista, colaboradorId, (l) => l.colaboradorId);
  }

  /** Designa à mão. `MANUAL` é a origem mais forte: a importação não a sobrescreve. */
  async designar(avaliadorId: string, avaliadoId: string, usuarioId: string, observacao?: string) {
    if (avaliadorId === avaliadoId) {
      throw new BadRequestException('Ninguém pode ser o avaliador da própria avaliação.');
    }
    const [avaliador, avaliado] = await Promise.all([
      this.prisma.colaborador.findUnique({ where: { id: avaliadorId }, select: { id: true, nome: true } }),
      this.prisma.colaborador.findUnique({ where: { id: avaliadoId }, select: { id: true, nome: true } }),
    ]);
    if (!avaliador || !avaliado) throw new NotFoundException('Colaborador não encontrado.');

    const vigente = await this.prisma.designacaoPadrao.findFirst({
      where: { avaliadoId, ...this.vigente },
    });

    return this.prisma.$transaction(async (tx) => {
      if (vigente) await this.encerrar(tx, vigente.id);
      const nova = await tx.designacaoPadrao.create({
        data: {
          avaliadorId, avaliadoId, origem: 'MANUAL', origemReferencia: null,
          provisorio: false, observacao: observacao?.trim() || null,
          vigenciaInicio: new Date(), registradoPorId: usuarioId,
        },
      });
      await this.auditoria.registrar({
        entidade: 'DesignacaoPadrao', entidadeId: nova.id, acao: 'DESIGNAR_MANUAL', usuarioId,
        valorAnterior: vigente ? { avaliadorId: vigente.avaliadorId, origem: vigente.origem } : undefined,
        valorNovo: { avaliadorId, avaliadoId },
      });
      return nova;
    });
  }

  /** Tira alguém de uma lista — encerrando a vigência, nunca apagando. */
  async remover(id: string, usuarioId: string) {
    const linha = await this.prisma.designacaoPadrao.findUnique({ where: { id } });
    if (!linha) throw new NotFoundException('Designação não encontrada.');
    if (linha.vigenciaFim) throw new BadRequestException('Esta designação já estava encerrada.');

    await this.prisma.designacaoPadrao.update({
      where: { id },
      data: { vigenciaFim: new Date() },
    });
    await this.auditoria.registrar({
      entidade: 'DesignacaoPadrao', entidadeId: id, acao: 'ENCERRAR', usuarioId,
      valorAnterior: { avaliadorId: linha.avaliadorId, avaliadoId: linha.avaliadoId, origem: linha.origem },
    });
    return { id, encerrada: true };
  }

  /**
   * ⭐ REVISAR — "olhei e está certo".
   *
   * A linha deixa de ser `DIVISAO_AUTOMATICA` e vira `MANUAL`, que é a verdade:
   * agora uma pessoa decidiu. `origemReferencia` continua guardando o centro de
   * custo que a originou, então nada se perde — e a importação passa a
   * respeitá-la como ajuste manual, que é exatamente o que ela virou.
   */
  async revisar(ids: string[], usuarioId: string) {
    if (!ids.length) throw new BadRequestException('Nenhuma linha para revisar.');
    const linhas = await this.prisma.designacaoPadrao.findMany({
      where: { id: { in: ids }, vigenciaFim: null, origem: NAO_REVISADA },
      select: { id: true },
    });
    if (linhas.length === 0) {
      throw new BadRequestException(
        'Nenhuma das linhas está pendente de revisão — ou já foram revisadas, ou já estão encerradas.',
      );
    }
    await this.prisma.designacaoPadrao.updateMany({
      where: { id: { in: linhas.map((l) => l.id) } },
      data: { origem: 'MANUAL' },
    });
    await this.auditoria.registrar({
      entidade: 'DesignacaoPadrao', entidadeId: linhas[0].id, acao: 'REVISAR',
      usuarioId, valorNovo: { linhas: linhas.length, ids: linhas.map((l) => l.id) },
    });
    return { revisadas: linhas.length, pedidas: ids.length };
  }

  // ── IMPORTAÇÃO ────────────────────────────────────────────────────────────

  /** PRÉVIA — o que VAI acontecer. Não grava nada. */
  async previaDaImportacao(conteudo: string, substituirAjustesManuais: boolean): Promise<Previa & { conferencia: string }> {
    const { previa, conferencia } = await this.calcular(conteudo, substituirAjustesManuais);
    return { ...previa, conferencia };
  }

  /**
   * GRAVAR — só com a conferência que a prévia devolveu.
   *
   * ⚠️ A conferência não é burocracia: sem ela, ela confirma um relatório e
   * grava outro arquivo. Com 82 linhas virando mil pares, a diferença não
   * apareceria até alguém reclamar meses depois de estar avaliando a pessoa
   * errada.
   */
  async importar(
    conteudo: string,
    arquivoNome: string,
    conferenciaConfirmada: string,
    substituirAjustesManuais: boolean,
    usuarioId: string,
    /**
     * ⭐ Marca as linhas como DADO PROVISÓRIO. Padrão `true`, e o padrão é o
     * seguro: uma lista preenchida pela T.I. com conhecimento da estrutura não
     * é a mesma coisa que a decisão do RH sobre quem avalia quem, e a nota tem
     * consequência de mérito. Só quem souber que a lista foi confirmada pelo RH
     * passa `false` — e aí é uma afirmação de alguém, não um padrão.
     */
    provisorio = true,
  ) {
    const conferencia = conferenciaDe(conteudo);
    if (conferencia !== conferenciaConfirmada) {
      throw new BadRequestException(
        'O arquivo mudou depois da pré-visualização. Gere a prévia de novo e confira antes de gravar — ' +
          'gravar agora aplicaria uma planilha diferente da que você aprovou.',
      );
    }
    const { previa, aGravar } = await this.calcular(conteudo, substituirAjustesManuais);

    const importacao = await this.prisma.$transaction(async (tx) => {
      const lote = await tx.importacaoDesignacao.create({
        data: {
          arquivoNome, conferencia,
          linhasNoArquivo: previa.linhasNoArquivo,
          paresGravados: aGravar.length,
          resumo: previa as unknown as object,
          importadoPorId: usuarioId,
        },
      });
      // Encerra o que sai de cena ANTES de criar o novo: o índice único parcial
      // (um avaliador vigente por avaliado) recusaria os dois convivendo.
      const encerrar = aGravar.map((p) => p.encerrarId).filter((id): id is string => id !== null);
      if (encerrar.length) {
        await tx.designacaoPadrao.updateMany({
          where: { id: { in: encerrar } },
          data: { vigenciaFim: new Date() },
        });
      }
      if (aGravar.length) {
        await tx.designacaoPadrao.createMany({
          data: aGravar.map((p: ParaGravar) => ({
            avaliadorId: p.avaliadorId, avaliadoId: p.avaliadoId,
            origem: p.origem, origemReferencia: p.origemReferencia,
            provisorio, vigenciaInicio: new Date(),
            registradoPorId: usuarioId, importacaoId: lote.id,
          })),
        });
      }
      return lote;
    });

    await this.auditoria.registrar({
      entidade: 'ImportacaoDesignacao', entidadeId: importacao.id, acao: 'IMPORTAR', usuarioId,
      valorNovo: {
        arquivo: arquivoNome, pares: aGravar.length, provisorio,
        substituira: previa.pares.substituira, inalterados: previa.pares.inalterados,
        conflitos: previa.conflitosComAjusteManual.length, recusas: previa.recusas.length,
      },
    });
    return { importacaoId: importacao.id, ...previa };
  }

  listarImportacoes() {
    return this.prisma.importacaoDesignacao.findMany({
      orderBy: { criadoEm: 'desc' },
      take: 30,
      select: {
        id: true, arquivoNome: true, linhasNoArquivo: true, paresGravados: true,
        criadoEm: true, desfeitoEm: true, importadoPorId: true, desfeitoPorId: true,
      },
    });
  }

  /**
   * DESFAZER a importação inteira — encerra a vigência do lote, não apaga nada.
   *
   * ⚠️ Diz quantas das linhas encerradas já tinham sido REVISADAS à mão. Desfazer
   * um lote joga fora, junto, a conferência que alguém fez em cima dele; o
   * número precisa aparecer, porque é o trabalho que se perde.
   */
  async desfazerImportacao(importacaoId: string, usuarioId: string) {
    const lote = await this.prisma.importacaoDesignacao.findUnique({ where: { id: importacaoId } });
    if (!lote) throw new NotFoundException('Importação não encontrada.');
    if (lote.desfeitoEm) {
      throw new BadRequestException(
        `Esta importação já foi desfeita em ${lote.desfeitoEm.toLocaleDateString('pt-BR')}.`,
      );
    }

    const vigentes = await this.prisma.designacaoPadrao.findMany({
      where: { importacaoId, vigenciaFim: null },
      select: { id: true, origem: true },
    });
    const revisadasAMao = vigentes.filter((l) => l.origem !== NAO_REVISADA && l.origem !== 'CENTRO_CUSTO').length;

    await this.prisma.$transaction(async (tx) => {
      if (vigentes.length) {
        await tx.designacaoPadrao.updateMany({
          where: { id: { in: vigentes.map((l) => l.id) } },
          data: { vigenciaFim: new Date() },
        });
      }
      await tx.importacaoDesignacao.update({
        where: { id: importacaoId },
        data: { desfeitoEm: new Date(), desfeitoPorId: usuarioId },
      });
    });

    await this.auditoria.registrar({
      entidade: 'ImportacaoDesignacao', entidadeId: importacaoId, acao: 'DESFAZER_IMPORTACAO',
      usuarioId, valorNovo: { encerradas: vigentes.length, revisadasAMao },
    });
    return {
      encerradas: vigentes.length,
      revisadasAMao,
      /** As linhas que a importação havia SUBSTITUÍDO não voltam sozinhas. */
      aviso:
        'As designações que esta importação substituiu não voltam automaticamente — ' +
        'quem estava sem avaliador antes dela volta a aparecer na lista de pendências.',
    };
  }

  private async calcular(conteudo: string, substituirAjustesManuais: boolean) {
    let leitura;
    try {
      leitura = lerPlanilhaDeAvaliadores(conteudo);
    } catch (e) {
      if (e instanceof PlanilhaInvalidaError) throw new BadRequestException(e.message);
      throw e;
    }

    const [colaboradores, vigentes] = await Promise.all([
      this.prisma.colaborador.findMany({
        where: { situacao: { in: SITUACOES_ELEGIVEIS as never[] } },
        select: {
          id: true, filial: true, matricula: true, nome: true,
          centroCusto: true, centroCustoDescricao: true,
        },
      }),
      this.prisma.designacaoPadrao.findMany({
        where: this.vigente,
        select: { id: true, avaliadoId: true, avaliadorId: true, origem: true },
      }),
    ]);

    const { previa, aGravar } = montarPrevia({
      linhas: leitura.linhas,
      recusasDaLeitura: leitura.recusas,
      linhasNoArquivo: leitura.linhasNoArquivo,
      linhasSemAvaliador: leitura.semAvaliador,
      colaboradores,
      vigentes,
      substituirAjustesManuais,
    });
    return { previa, aGravar, conferencia: leitura.conferencia };
  }

  private encerrar(tx: { designacaoPadrao: { update: (a: unknown) => Promise<unknown> } }, id: string) {
    return tx.designacaoPadrao.update({ where: { id }, data: { vigenciaFim: new Date() } });
  }
}
