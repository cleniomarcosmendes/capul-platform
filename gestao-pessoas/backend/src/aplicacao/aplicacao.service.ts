/**
 * APLICAÇÃO — a peça que permite questionário POR PERFIL de centro de custo.
 *
 * Um ciclo tem N aplicações; cada uma casa um modelo com um público, define
 * quanto o questionário vale (`pesoAvaliacao`) e quais critérios cadastrais
 * entram, com que peso.
 *
 * ⭐ Aplicação SEM nenhum critério é válida — é o caso dos aprendizes, avaliados
 * 100% pelo questionário porque estão no piso de escolaridade, tempo de casa e
 * cursos por definição (docs/OBSERVACAO_RH_APRENDIZES.md).
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { validarAplicacao } from '../ciclo/abertura.validator.js';
import { SITUACOES_ELEGIVEIS } from '../common/elegibilidade.js';
import { marcarRestricoesPor } from '../avaliacao/separacao-funcoes.js';
import { assertCicloOperavel } from '../ciclo/ciclo-operavel.js';
// ⚠️ A MESMA função que a tela de Designação usa. A prévia não tem — e não pode
// ter — uma segunda ideia de quem gera avaliação (§3.1.21).
import { avaliarElegibilidade } from '../designacao/elegibilidade-ciclo.js';

export interface DadosAplicacao {
  cicloId: string;
  modeloVersaoId: string;
  nome: string;
  pesoAvaliacao: number;
  ordem?: number;
  criterios?: { criterioId: string; peso: number; ordem?: number }[];
  centrosCusto?: { filial?: string | null; centroCusto: string }[];
}

/** O atalho que a tela usou para montar o público. */
export interface AlvoDoPublico {
  origem: 'CENTRO_CUSTO' | 'FILIAL' | 'MANUAL';
  /** O texto que explica o recorte — o CC, a filial, ou o critério usado. */
  referencia?: string | null;
  centrosCusto?: { filial?: string | null; centroCusto: string }[];
  filiais?: string[];
  colaboradorIds?: string[];
}

@Injectable()
export class AplicacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async criar(dados: DadosAplicacao, usuarioId: string) {
    const ciclo = await this.prisma.ciclo.findUnique({ where: { id: dados.cicloId } });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');
    if (ciclo.status !== 'RASCUNHO') {
      throw new BadRequestException(
        `O ciclo está ${ciclo.status}: aplicações só podem ser montadas enquanto ele é RASCUNHO.`,
      );
    }

    const versao = await this.prisma.modeloVersao.findUnique({
      where: { id: dados.modeloVersaoId },
      include: { modelo: true },
    });
    if (!versao) throw new NotFoundException('Versão de modelo não encontrada.');

    const criterios = await this.carregarCriterios(dados.criterios ?? []);

    // Valida ANTES de gravar: o momento mais barato de recusar é o mais perto de
    // quem cometeu o erro. A mesma validação roda de novo na abertura do ciclo.
    const problemas = validarAplicacao({
      nome: dados.nome,
      // Nasce sempre vazia — o público se monta depois, e quem cobra isso é a
      // ABERTURA do ciclo (`problemasParaAbrir`), não a criação.
      pessoasNoPublico: 0,
      pesoAvaliacao: dados.pesoAvaliacao,
      modeloFinalidade: versao.modelo.finalidade,
      criterios: criterios.map((c) => ({
        peso: c.peso,
        criterio: {
          codigo: c.criterio.codigo,
          nome: c.criterio.nome,
          origem: c.criterio.origem,
          codigoCalculo: c.criterio.codigoCalculo,
          ativo: c.criterio.ativo,
        },
      })),
    });
    if (problemas.length) throw new BadRequestException(problemas);

    const aplicacao = await this.prisma.aplicacao.create({
      data: {
        cicloId: dados.cicloId,
        modeloVersaoId: dados.modeloVersaoId,
        nome: dados.nome,
        ordem: dados.ordem ?? 0,
        pesoAvaliacao: dados.pesoAvaliacao,
        criterios: {
          create: (dados.criterios ?? []).map((c, i) => ({
            criterioId: c.criterioId,
            peso: c.peso,
            ordem: c.ordem ?? i,
          })),
        },
        centrosCusto: {
          create: (dados.centrosCusto ?? []).map((cc) => ({
            filial: cc.filial ?? null,
            centroCusto: cc.centroCusto,
          })),
        },
      },
      include: { criterios: true, centrosCusto: true },
    });

    await this.auditoria.registrar({
      entidade: 'Aplicacao',
      entidadeId: aplicacao.id,
      acao: 'CRIAR',
      usuarioId,
      valorNovo: {
        nome: aplicacao.nome,
        pesoAvaliacao: dados.pesoAvaliacao,
        criterios: (dados.criterios ?? []).length,
      },
    });
    return aplicacao;
  }

  /**
   * ⚠️ O PÚBLICO É NOMINAL, e a tela precisa dizer DE ONDE ele veio.
   *
   * `centrosCusto` continua vindo, mas ela deixou de decidir quem entra: é o
   * registro do atalho usado. Quem decide é `rh.aplicacao_publico`, uma linha
   * por pessoa. Mostrar só a lista de centros de custo diria a coisa errada
   * sobre um público montado por qualquer outro caminho — o dos aprendizes,
   * por exemplo, que é por cargo e não tem centro de custo nenhum.
   *
   * ⭐ Por isso vem também a QUEBRA POR ORIGEM. É o que faz um recorte
   * provisório aparecer como provisório na tela, em vez de a gestora achar que
   * a divisão foi decisão de alguém.
   */
  async listarDoCiclo(cicloId: string) {
    const aplicacoes = await this.prisma.aplicacao.findMany({
      where: { cicloId },
      orderBy: { ordem: 'asc' },
      include: {
        criterios: { include: { criterio: true } },
        centrosCusto: true,
        _count: { select: { avaliacoes: true, publico: true } },
      },
    });

    const origens = await this.prisma.aplicacaoPublico.groupBy({
      by: ['aplicacaoId', 'origem', 'origemReferencia', 'provisorio'],
      where: { cicloId },
      _count: { _all: true },
    });

    return aplicacoes.map((a) => {
      const doPublico = origens.filter((o) => o.aplicacaoId === a.id);
      return {
        ...a,
        publico: {
          total: a._count.publico,
          origens: doPublico
            .map((o) => ({
              origem: o.origem as string,
              referencia: o.origemReferencia,
              provisorio: o.provisorio,
              pessoas: o._count._all,
            }))
            .sort((x, y) => y.pessoas - x.pessoas),
          provisorio: doPublico.some((o) => o.provisorio),
        },
      };
    });
  }

  private async carregarCriterios(itens: { criterioId: string; peso: number }[]) {
    if (itens.length === 0) return [];
    const criterios = await this.prisma.criterio.findMany({
      where: { id: { in: itens.map((i) => i.criterioId) } },
    });
    const porId = new Map(criterios.map((c) => [c.id, c]));
    return itens.map((i) => {
      const criterio = porId.get(i.criterioId);
      if (!criterio) throw new NotFoundException(`Critério ${i.criterioId} não encontrado.`);
      return { peso: i.peso, criterio };
    });
  }

  // ── O PÚBLICO NOMINAL DA APLICAÇÃO ────────────────────────────────────────

  /**
   * ⭐ CENTRO DE CUSTO E FILIAL SÃO ATALHOS DE PREENCHIMENTO, não a regra.
   *
   * A tela escolhe um recorte, o sistema traz as pessoas, ela ajusta e salva a
   * LISTA RESULTANTE. O recorte fica em `origem` + `origemReferencia`, para o
   * painel explicar de onde a linha veio — mas quem manda é a lista.
   *
   * ⚠️ `previa` existe porque `@@unique([cicloId, colaboradorId])` recusa quem
   * já está em outra aplicação do mesmo ciclo. Sem prévia, escolher um centro
   * de custo que se sobrepõe a outro público falharia no INSERT, com o erro do
   * banco e sem dizer de quem se trata. A tela precisa AVISAR antes.
   */
  /**
   * ⚠️ Recebe o colaborador logado para MARCAR a linha dele — decisão de
   * 06/09/2026, a mesma da Designação. O público diz **por qual questionário a
   * pessoa é avaliada**, e a linha traz o botão "Tirar": quem opera a lista
   * precisa ver quando a linha é a própria. Como sempre: marca, não filtra.
   */
  async publicoDe(aplicacaoId: string, colaboradorId?: string | null) {
    const linhas = await this.prisma.aplicacaoPublico.findMany({
      where: { aplicacaoId },
      select: {
        id: true, colaboradorId: true, origem: true, origemReferencia: true, provisorio: true,
      },
    });
    if (linhas.length === 0) return [];

    const pessoas = await this.prisma.colaborador.findMany({
      where: { id: { in: linhas.map((l) => l.colaboradorId) } },
      select: {
        id: true, nome: true, matricula: true, filial: true,
        cargoDescricao: true, centroCusto: true, centroCustoDescricao: true, situacao: true,
      },
    });
    const porId = new Map(pessoas.map((c) => [c.id, c]));

    const publico = linhas
      .map((l) => ({
        id: l.id,
        colaboradorId: l.colaboradorId,
        nome: porId.get(l.colaboradorId)?.nome ?? '(colaborador não encontrado)',
        matricula: porId.get(l.colaboradorId)?.matricula ?? '',
        filial: porId.get(l.colaboradorId)?.filial ?? '',
        cargo: porId.get(l.colaboradorId)?.cargoDescricao ?? null,
        centroCusto: porId.get(l.colaboradorId)?.centroCusto ?? null,
        area: porId.get(l.colaboradorId)?.centroCustoDescricao ?? null,
        situacao: porId.get(l.colaboradorId)?.situacao ?? null,
        origem: l.origem as string,
        origemReferencia: l.origemReferencia,
        provisorio: l.provisorio,
      }))
      .sort((a, b) => a.filial.localeCompare(b.filial) || a.nome.localeCompare(b.nome, 'pt-BR'));

    return marcarRestricoesPor(publico, colaboradorId, (l) => l.colaboradorId);
  }

  /**
   * ⭐⭐ A PRÉVIA RESPONDE DUAS PERGUNTAS, e elas não são a mesma (08/09).
   *
   *   1. **quem entra no PÚBLICO?**  — o recorte, que é o que ela sempre disse;
   *   2. **destes, quem GERA AVALIAÇÃO?** — a régua do ciclo, que ela não dizia.
   *
   * Item H do roteiro: a prévia prometeu 5, entraram 5 no público e **4**
   * geraram avaliação — uma afastada na data-base, que o ciclo está configurado
   * para não incluir. *"5 pessoa(s) entram"* estava **certo sobre o público** e
   * era lido como "5 vão ser avaliadas". A informação existia e estava bem
   * explicada na Designação (*"Fora: regra ciclo"*) — só chegava **depois de
   * gravar**, que é tarde para quem monta o recorte.
   *
   * ⚠️ **A régua NÃO é recalculada aqui.** Chama-se `avaliarElegibilidade`, a
   * mesma função da tela de Designação e da abertura do ciclo. Uma segunda conta
   * de "quem é avaliável" divergiria no primeiro ajuste, e a prévia passaria a
   * prometer o que a designação não entrega — que é o defeito que ela veio
   * resolver.
   *
   * ⚠️ E usa a MESMA aproximação da Designação, de propósito:
   * `categoriaFuncional: null` (não é coluna do nosso cadastro; Presidente e
   * Vice saem por decisão registrada) e a situação de HOJE como proxy da
   * situação na data-base. Melhorar isto só aqui criaria a divergência que este
   * conserto está evitando.
   */
  async previaDoPublico(aplicacaoId: string, alvo: AlvoDoPublico) {
    const { aplicacao, candidatos, noCiclo } = await this.resolverAlvo(aplicacaoId, alvo);

    const jaNesta: string[] = [];
    const emOutra: { colaboradorId: string; nome: string; matricula: string; aplicacao: string }[] = [];
    const adicionar: typeof candidatos = [];

    for (const c of candidatos) {
      const existente = noCiclo.get(c.id);
      if (!existente) adicionar.push(c);
      else if (existente.aplicacaoId === aplicacaoId) jaNesta.push(c.id);
      else {
        emOutra.push({
          colaboradorId: c.id, nome: c.nome, matricula: c.matricula,
          aplicacao: existente.nome,
        });
      }
    }

    // ⭐ A SEGUNDA PERGUNTA: destes que entram, quem a régua do ciclo barra?
    const barrados = adicionar
      .map((c) => ({
        c,
        regua: avaliarElegibilidade(
          {
            colaboradorId: c.id,
            matricula: c.matricula,
            nome: c.nome,
            categoriaFuncional: null,
            situacaoNaDataBase: c.situacao as never,
          },
          { incluirAfastados: aplicacao.ciclo.incluirAfastados },
        ),
      }))
      .filter((x) => !x.regua.elegivel)
      .map((x) => ({
        colaboradorId: x.c.id,
        nome: x.c.nome,
        matricula: x.c.matricula,
        // A MESMA justificativa que a Designação mostra — nem uma segunda
        // versão do texto, nem um resumo dele.
        justificativa: x.regua.justificativa ?? '',
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    return {
      aplicacaoId,
      aplicacaoNome: aplicacao.nome,
      encontradas: candidatos.length,
      /**
       * ⭐⭐ DOIS OBJETOS, DOIS NOMES. Este campo se chamava `adicionar`, e
       * "adicionar" não diz **a quê**: quem lesse como "quantas avaliações
       * saem daqui" erraria exatamente em `barradosPelaRegua`.
       *
       * A prévia conta duas coisas ENCADEADAS e elas não são a mesma:
       *   `entramNoPublico`  → entram na LISTA da aplicação;
       *   `geramAvaliacao`   → viram AVALIAÇÃO de verdade.
       * Entre uma e outra está a régua do ciclo. É o mesmo eixo do cabeçalho
       * do ciclo (1036 montado × 989 alcançado): **público e avaliação são
       * objetos diferentes, e cada um precisa da sua palavra.**
       */
      entramNoPublico: adicionar.length,
      jaNesta: jaNesta.length,
      /** ⭐ O aviso. Ninguém em duas aplicações do mesmo ciclo. */
      emOutraAplicacao: emOutra.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      /**
       * ⭐ Quantos dos que entram vão MESMO gerar avaliação. Entrar no público e
       * gerar avaliação são duas coisas, e a prévia diz as duas em vez de
       * misturá-las num número só. Par de `entramNoPublico` — ver lá.
       */
      geramAvaliacao: adicionar.length - barrados.length,
      /** Quem entra no público e NÃO gera avaliação, com o motivo da régua. */
      barradosPelaRegua: barrados,
      amostra: adicionar
        .slice(0, 10)
        .map((c) => ({ nome: c.nome, matricula: c.matricula, area: c.centroCustoDescricao })),
    };
  }

  async adicionarAoPublico(
    aplicacaoId: string,
    alvo: AlvoDoPublico,
    provisorio: boolean,
    usuarioId: string,
  ) {
    const { aplicacao, candidatos, noCiclo } = await this.resolverAlvo(aplicacaoId, alvo);
    await this.assertCicloDaAplicacaoOperavel(aplicacao.cicloId, 'mudança no público');
    const novos = candidatos.filter((c) => !noCiclo.has(c.id));

    if (novos.length > 0) {
      await this.prisma.aplicacaoPublico.createMany({
        data: novos.map((c) => ({
          aplicacaoId,
          cicloId: aplicacao.cicloId,
          colaboradorId: c.id,
          origem: alvo.origem,
          origemReferencia: alvo.referencia ?? null,
          provisorio,
          registradoPorId: usuarioId,
        })),
      });
      await this.auditoria.registrar({
        entidade: 'Aplicacao', entidadeId: aplicacaoId, acao: 'PUBLICO_ADICIONAR', usuarioId,
        valorNovo: {
          adicionadas: novos.length, origem: alvo.origem,
          referencia: alvo.referencia, provisorio,
        },
      });
    }
    // Devolve a prévia recalculada: o que sobrou é o que continua em conflito,
    // e a tela mostra sem precisar de uma segunda chamada.
    return { adicionadas: novos.length, ...(await this.previaDoPublico(aplicacaoId, alvo)) };
  }

  async removerDoPublico(aplicacaoId: string, colaboradorId: string, usuarioId: string) {
    const linha = await this.prisma.aplicacaoPublico.findFirst({
      where: { aplicacaoId, colaboradorId },
    });
    if (!linha) throw new NotFoundException('Esta pessoa não está no público desta aplicação.');
    await this.assertCicloDaAplicacaoOperavel(linha.cicloId, 'mudança no público');

    // ⚠️ CANCELADA não conta: a avaliação cancelada já saiu de toda conta, e
    // segurar o público por causa dela seria travar por um registro histórico.
    const avaliacao = await this.prisma.avaliacao.count({
      where: { aplicacaoId, avaliadoId: colaboradorId, status: { not: 'CANCELADA' } },
    });
    if (avaliacao > 0) {
      // Tirar do público quem já tem avaliação deixaria a `Avaliacao` órfã do
      // recorte que a originou — e ela sumiria da contagem sem sumir do banco.
      //
      // ⭐ A recusa APONTA O CAMINHO (08/09). Ela dizia "Cancele a avaliação
      // antes" — um ato que não existia em lugar nenhum do módulo, mandando a
      // pessoa procurar sozinha uma porta inexistente. O ato agora existe, e
      // tem um lugar: excluir do ciclo, na Designação, cancela junto.
      //
      // ⚠️ De propósito NÃO cancela daqui. Tirar do público e cancelar
      // avaliação são atos diferentes, e juntá-los num clique repetiria o
      // defeito do seletor de CC que saiu do modal hoje: um ato com efeito que
      // a tela não mostra.
      throw new BadRequestException(
        'Esta pessoa já tem avaliação nesta aplicação. Para tirá-la do ciclo, use ' +
          'Designação → Excluir: lá a exclusão cancela a avaliação, com motivo registrado, ' +
          'e a confirmação mostra o que isso afeta antes de valer.',
      );
    }

    await this.prisma.aplicacaoPublico.delete({ where: { id: linha.id } });
    await this.auditoria.registrar({
      entidade: 'Aplicacao', entidadeId: aplicacaoId, acao: 'PUBLICO_REMOVER', usuarioId,
      valorAnterior: { colaboradorId, origem: linha.origem },
    });
    return { removida: true };
  }

  /**
   * ⚠️ A PRÉVIA continua abrindo no ciclo encerrado — ela não grava, e é assim
   * que se descobre o que aconteceria antes de decidir reabrir.
   */
  private async assertCicloDaAplicacaoOperavel(cicloId: string, acao: string) {
    const ciclo = await this.prisma.ciclo.findUniqueOrThrow({
      where: { id: cicloId },
      select: { status: true, encerradoEm: true },
    });
    assertCicloOperavel(ciclo, acao);
  }

  /** Resolve o atalho em pessoas, e diz quem já está em alguma aplicação do ciclo. */
  private async resolverAlvo(aplicacaoId: string, alvo: AlvoDoPublico) {
    const aplicacao = await this.prisma.aplicacao.findUnique({
      where: { id: aplicacaoId },
      // ⭐ `incluirAfastados` vem junto porque a PRÉVIA passou a responder também
      // "quantos destes geram avaliação?", e quem decide isso é a régua do
      // ciclo — não uma conta própria daqui (§3.1.21).
      select: {
        id: true, nome: true, cicloId: true,
        ciclo: { select: { incluirAfastados: true } },
      },
    });
    if (!aplicacao) throw new NotFoundException('Aplicação não encontrada.');

    const filtros: object[] = [];
    for (const cc of alvo.centrosCusto ?? []) {
      filtros.push({ centroCusto: cc.centroCusto, ...(cc.filial ? { filial: cc.filial } : {}) });
    }
    if (alvo.filiais?.length) filtros.push({ filial: { in: alvo.filiais } });
    if (alvo.colaboradorIds?.length) filtros.push({ id: { in: alvo.colaboradorIds } });
    if (filtros.length === 0) {
      throw new BadRequestException(
        'Escolha ao menos um centro de custo, uma filial ou uma pessoa — sem recorte, o público seria a empresa inteira.',
      );
    }

    const candidatos = await this.prisma.colaborador.findMany({
      where: { situacao: { in: SITUACOES_ELEGIVEIS as never[] }, OR: filtros },
      select: {
        id: true, nome: true, matricula: true, filial: true,
        centroCusto: true, centroCustoDescricao: true, situacao: true,
      },
      orderBy: [{ filial: 'asc' }, { nome: 'asc' }],
    });

    const ocupados = await this.prisma.aplicacaoPublico.findMany({
      where: { cicloId: aplicacao.cicloId, colaboradorId: { in: candidatos.map((c) => c.id) } },
      select: { colaboradorId: true, aplicacaoId: true, aplicacao: { select: { nome: true } } },
    });
    const noCiclo = new Map(
      ocupados.map((o) => [o.colaboradorId, { aplicacaoId: o.aplicacaoId, nome: o.aplicacao.nome }]),
    );

    return { aplicacao, candidatos, noCiclo };
  }
}
