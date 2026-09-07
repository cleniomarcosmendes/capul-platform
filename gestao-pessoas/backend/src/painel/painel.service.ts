/**
 * PAINEL — o acompanhamento do ciclo enquanto ele corre.
 *
 * A pergunta que esta tela responde é sempre a mesma: **o que falta para o
 * ciclo fechar?** Por isso ela não mostra médias nem gráficos de nota (isso é
 * Resultados) e sim três coisas, nesta ordem:
 *
 *   1. quanto falta, por aplicação;
 *   2. QUEM está segurando — a fila por avaliador, do mais atrasado ao menos,
 *      porque quem cobra precisa de nome, não de percentual;
 *   3. quem é elegível e ficou SEM designação — a única pendência que não
 *      aparece em lugar nenhum e faz a pessoa sumir do ciclo em silêncio;
 *   4. quem ficou FORA DE TODAS as aplicações.
 *
 * ⭐ Os itens 3 e 4 são a razão de o painel existir cedo, e são pendências
 * DIFERENTES, uma dentro da outra:
 *
 *   sem designação  — está no público de uma aplicação e ninguém disse quem
 *                     avalia. `Avaliacao` só nasce na designação, então a
 *                     pessoa não tem linha, não tem status e não entra em
 *                     contagem nenhuma.
 *   fora de todas   — não está no público de aplicação alguma. Nem sequer
 *                     chega a ser contada como "sem designação", porque o
 *                     item 3 é calculado POR APLICAÇÃO e ela não pertence a
 *                     nenhuma. É a pessoa que o ciclo inteiro não enxerga.
 *
 * ⚠️ Enquanto o público vinha do recorte por centro de custo, o item 4 era
 * invisível do mesmo jeito: um CC fora de todas as aplicações simplesmente não
 * aparecia. Com público nominal a conta passou a ser possível — e ela é de
 * nível de CICLO, não de aplicação.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { DesignacaoService } from '../designacao/designacao.service.js';
import { montarListaInicial } from '../designacao/elegibilidade-ciclo.js';
import { SITUACOES_ELEGIVEIS } from '../common/elegibilidade.js';
import { proximoPasso, type ProximoPasso } from './proximo-passo.js';
import { CicloService } from '../ciclo/ciclo.service.js';

export interface ProgressoDaAplicacao {
  aplicacaoId: string;
  nome: string;
  designados: number;
  enviadas: number;
  emAndamento: number;
  pendentes: number;
  canceladas: number;
  /** Elegíveis da régua que ninguém designou — não têm avaliação nenhuma. */
  semDesignacao: number;
}

export interface FilaDoAvaliador {
  avaliadorId: string;
  nome: string;
  matricula: string;
  total: number;
  enviadas: number;
  aFazer: number;
}

/** Uma pessoa que o ciclo não enxerga: elegível e fora de toda aplicação. */
export interface PessoaForaDoCiclo {
  colaboradorId: string;
  matricula: string;
  nome: string;
  filial: string;
  centroCusto: string | null;
  centroCustoDescricao: string | null;
}

export interface PainelDoCiclo {
  ciclo: {
    id: string;
    nome: string;
    status: string;
    periodoInicio: Date;
    periodoFim: Date;
    dataBase: Date;
  };
  designados: number;
  enviadas: number;
  aFazer: number;
  semDesignacao: number;
  /**
   * ⭐ DE ONDE VEM o "sem designação" — sem isto o número convida a uma
   * subtração errada.
   *
   * O cadastro de avaliadores tem o SEU "sem avaliador" (a empresa inteira) e o
   * painel tem o dele (este ciclo). Os dois universos **não se contêm**: fechar
   * os 95 do ciclo não derruba 95 dos 108 do cadastro. Em vez de avisar que a
   * conta é sutil, o painel mostra a conta:
   *
   *   `jaTemNoCadastro`  → basta copiar o cadastro para o ciclo (um botão);
   *   `nemNoCadastro`    → precisa resolver no cadastro primeiro.
   */
  semDesignacaoPorOrigem: { jaTemNoCadastro: number; nemNoCadastro: number };
  /**
   * Elegíveis do ciclo que não estão no público de NENHUMA aplicação. Vem com
   * os nomes, não só o total: quem vai resolver precisa saber de quem se trata,
   * e "17 pessoas fora" não diz a ninguém o que fazer em seguida.
   */
  foraDeTodasAsAplicacoes: { total: number; pessoas: PessoaForaDoCiclo[] };
  aplicacoes: ProgressoDaAplicacao[];
  avaliadores: FilaDoAvaliador[];
}

/** O que a linha de estado do cabeçalho do ciclo mostra. */
/**
 * ⭐⭐ O RESUMO É UM RELATÓRIO, NÃO UMA CÓPIA DO CICLO (08/09).
 *
 * Ele mandava `status` e `encerradoEm` — **dois fatos que a linha `rh.ciclo`
 * grava e `GET /ciclos/:id` já entrega**. A tela do ciclo carregava os dois
 * endpoints e lia o mesmo fato de fontes diferentes: a etiqueta do topo pelo
 * ciclo, as faixas pelo resumo. Enquanto os dois eram buscados no mesmo
 * `useEffect` ninguém via; bastaria recarregar um só para a tela passar a
 * mostrar "ABERTO" na etiqueta com a faixa de RASCUNHO embaixo.
 *
 * ⚠️ **O critério de quem sobrevive é o DONO NATURAL do fato**, não a
 * conveniência de quem consome:
 *   - atributo gravado na linha do ciclo (status, datas, período, data-base)
 *     → dono é o **registro**, `GET /ciclos/:id`;
 *   - contagem e derivação que não existem na linha e são apuradas agora
 *     (público, designados, enviadas, apuradas, próximo passo, pendências,
 *     reaberturas vindas da auditoria) → dono é **este relatório**.
 *
 * `status` continua entrando no cálculo aqui dentro — `proximoPasso` e
 * `pendenciasParaAbrir` derivam dele. O que ele não faz mais é **atravessar o
 * contrato**: quem decide pelo status, decide pelo dono dele.
 */
export interface ResumoDoCiclo {
  aplicacoes: number;
  noPublico: number;
  designados: number;
  semDesignacao: number;
  enviadas: number;
  aFazer: number;
  apuradas: number;
  /** `null` quando não há passo óbvio — a tela não mostra nada. Ver a regra. */
  proximoPasso: ProximoPasso | null;
  /**
   * ⭐ O que falta para ABRIR — só em RASCUNHO (`null` nos outros estados).
   * Vem da MESMA função que a abertura usa (`problemasParaAbrir`): lista vazia
   * significa que o clique passa, e é a mesma conta que a API vai fazer.
   */
  pendenciasParaAbrir: string[] | null;
  /**
   * ⭐ Reaberturas do ciclo. `reaberturas` conta TODAS (vem da auditoria); a
   * tabela só guarda a última. Um ciclo reaberto duas vezes é informação.
   */
  reaberturas: number;
  ultimaReabertura: { em: Date; por: string | null; motivo: string | null } | null;
}

@Injectable()
export class PainelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly designacao: DesignacaoService,
    private readonly ciclos: CicloService,
  ) {}

  async doCiclo(cicloId: string): Promise<PainelDoCiclo> {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id: cicloId },
      include: { aplicacoes: { orderBy: { ordem: 'asc' } } },
    });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');

    const porAplicacaoEStatus = await this.prisma.avaliacao.groupBy({
      by: ['aplicacaoId', 'status'],
      where: { cicloId },
      _count: { _all: true },
    });

    const aplicacoes: ProgressoDaAplicacao[] = [];
    /** Quem ficou sem designação, para dizer DE ONDE isso vem (ver o tipo). */
    const semDesignacaoIds = new Set<string>();
    for (const a of ciclo.aplicacoes) {
      const linhas = porAplicacaoEStatus.filter((l) => l.aplicacaoId === a.id);
      const conta = (s: string) => linhas.find((l) => l.status === s)?._count._all ?? 0;
      const designados = linhas.reduce((t, l) => t + l._count._all, 0);

      // A lista de elegibilidade é a mesma da tela de Designação — de propósito.
      // Duas contas de "quem deveria estar no ciclo" divergem no primeiro ajuste
      // manual, e aí o painel diz que falta gente que já foi resolvida.
      const elegiveis = (await this.designacao.listar(a.id)).filter((l) => l.elegivel);
      // groupBy e não findMany de propósito: o painel precisa saber QUEM já tem
      // avaliação, nunca o que há dentro dela. Consulta agregada deixa isso
      // explícito para o invariante e para quem ler depois.
      const comAvaliacao = new Set(
        (
          await this.prisma.avaliacao.groupBy({
            by: ['avaliadoId'],
            where: { aplicacaoId: a.id },
          })
        ).map((x) => x.avaliadoId),
      );

      aplicacoes.push({
        aplicacaoId: a.id,
        nome: a.nome,
        designados,
        enviadas: conta('ENVIADA'),
        emAndamento: conta('EM_ANDAMENTO'),
        pendentes: conta('PENDENTE'),
        canceladas: conta('CANCELADA'),
        semDesignacao: elegiveis.filter((e) => !comAvaliacao.has(e.colaboradorId)).length,
      });
      for (const e of elegiveis) {
        if (!comAvaliacao.has(e.colaboradorId)) semDesignacaoIds.add(e.colaboradorId);
      }
    }

    return {
      ciclo: {
        id: ciclo.id,
        nome: ciclo.nome,
        status: ciclo.status,
        periodoInicio: ciclo.periodoInicio,
        periodoFim: ciclo.periodoFim,
        dataBase: ciclo.dataBase,
      },
      designados: aplicacoes.reduce((t, a) => t + a.designados, 0),
      enviadas: aplicacoes.reduce((t, a) => t + a.enviadas, 0),
      aFazer: aplicacoes.reduce((t, a) => t + a.pendentes + a.emAndamento, 0),
      semDesignacao: aplicacoes.reduce((t, a) => t + a.semDesignacao, 0),
      semDesignacaoPorOrigem: await this.semDesignacaoPorOrigem(semDesignacaoIds),
      foraDeTodasAsAplicacoes: await this.foraDeTodasAsAplicacoes(ciclo),
      aplicacoes,
      avaliadores: await this.filaPorAvaliador(cicloId),
    };
  }

  /**
   * ⭐ O RESUMO — o que a LINHA DE ESTADO do cabeçalho do ciclo mostra, e o
   * próximo passo derivado dele.
   *
   * É irmão do `doCiclo`, e de propósito **não** faz as duas partes caras dele:
   * a varredura de quem está fora de todas as aplicações (percorre as 1.036
   * pessoas) e a fila por avaliador. O cabeçalho aparece em TODAS as abas do
   * ciclo — o que ele custa, custa quatro vezes.
   *
   * ⚠️ `semDesignacao` sai da MESMA régua da tela de Designação (via
   * `designacao.listar`), não de uma conta paralela: `noPublico - designados`
   * seria mais barato e daria número diferente, porque ignora quem o RH excluiu
   * e quem a régua tirou. Duas contas de "quem falta" divergem no primeiro
   * ajuste manual — e o cabeçalho é onde o número é lido primeiro.
   */
  /**
   * ⭐⭐ O QUE A ABERTURA VAI FAZER — lido ANTES do aviso de irreversibilidade.
   *
   * Item I do roteiro. A confirmação do Abrir não dizia número nenhum, e a
   * validação rodava **depois** do aviso: a pessoa encarava "não tem volta",
   * confirmava, e só então recebia *"o ciclo não tem nenhuma aplicação"*.
   *
   * ⚠️ **Os números vêm daqui, das MESMAS funções que decidem** — `listar()` da
   * designação (que aplica a régua do ciclo) e `problemasParaAbrir` (que a API
   * roda no clique). Se o diálogo contasse sozinho, divergiria no primeiro caso
   * de borda, e o caso de borda aqui é **a régua barrando alguém do público**:
   * a pessoa está na lista, aparece no total, e não vai gerar avaliação.
   *
   * ⚠️ E o número que importa **não é "quantas avaliações vão nascer": abrir não
   * cria avaliação nenhuma.** Elas nascem na designação. Abrir libera as que já
   * existem e trava a montagem — a tela dizia o contrário até 08/09.
   */
  async previaDaAbertura(cicloId: string) {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id: cicloId },
      include: { aplicacoes: { orderBy: { ordem: 'asc' }, select: { id: true, nome: true } } },
    });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');

    const [designados, noPublico, provisorias] = await Promise.all([
      this.prisma.avaliacao.count({ where: { cicloId, status: { not: 'CANCELADA' } } }),
      this.prisma.aplicacaoPublico.count({ where: { cicloId } }),
      // Aplicações cujo público veio de um atalho e o RH ainda não confirmou.
      this.prisma.aplicacaoPublico.groupBy({
        by: ['aplicacaoId'],
        where: { cicloId, provisorio: true },
      }),
    ]);

    let semAvaliador = 0;
    let barradosPelaRegua = 0;
    for (const a of ciclo.aplicacoes) {
      const linhas = await this.designacao.listar(a.id);
      const comAvaliacao = new Set(
        (
          await this.prisma.avaliacao.groupBy({ by: ['avaliadoId'], where: { aplicacaoId: a.id } })
        ).map((x) => x.avaliadoId),
      );
      barradosPelaRegua += linhas.filter((l) => !l.elegivel).length;
      semAvaliador += linhas.filter((l) => l.elegivel && !comAvaliacao.has(l.colaboradorId)).length;
    }

    return {
      /** Vazio = a abertura passa. Mesma função que a API roda no clique. */
      problemas: await this.ciclos.pendenciasParaAbrir(cicloId),
      totalAplicacoes: ciclo.aplicacoes.length,
      noPublico,
      /** Avaliações que já existem e serão liberadas para responder. */
      designados,
      /** No público, elegíveis, e ninguém disse quem avalia — não serão avaliadas. */
      semAvaliador,
      /** No público e fora pela régua do ciclo — o caso de borda que a tela não veria. */
      barradosPelaRegua,
      /** Aplicações com público marcado como recorte provisório. */
      aplicacoesProvisorias: provisorias.length,
    };
  }

  async resumoDoCiclo(cicloId: string): Promise<ResumoDoCiclo> {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id: cicloId },
      include: { aplicacoes: { orderBy: { ordem: 'asc' }, select: { id: true } } },
    });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');

    const [porStatus, noPublico, apuradas] = await Promise.all([
      this.prisma.avaliacao.groupBy({ by: ['status'], where: { cicloId }, _count: { _all: true } }),
      this.prisma.aplicacaoPublico.count({ where: { cicloId } }),
      this.prisma.resultadoAvaliacao.count({ where: { cicloId } }),
    ]);
    const conta = (s: string) => porStatus.find((l) => l.status === s)?._count._all ?? 0;
    const designados = porStatus.reduce((t, l) => t + l._count._all, 0);

    let semDesignacao = 0;
    for (const a of ciclo.aplicacoes) {
      const elegiveis = (await this.designacao.listar(a.id)).filter((l) => l.elegivel);
      const comAvaliacao = new Set(
        (
          await this.prisma.avaliacao.groupBy({ by: ['avaliadoId'], where: { aplicacaoId: a.id } })
        ).map((x) => x.avaliadoId),
      );
      semDesignacao += elegiveis.filter((e) => !comAvaliacao.has(e.colaboradorId)).length;
    }

    const estado = {
      status: ciclo.status as string,
      aplicacoes: ciclo.aplicacoes.length,
      noPublico,
      designados,
      semDesignacao,
      enviadas: conta('ENVIADA'),
      aFazer: conta('PENDENTE') + conta('EM_ANDAMENTO'),
      apuradas,
    };
    // ⚠️ `estado` tem `status` porque `proximoPasso` deriva dele — mas ele NÃO
    // sai daqui: o dono do fato é `GET /ciclos/:id`. Ver o comentário do tipo.
    const { status: _status, ...numeros } = estado;
    return {
      ...numeros,
      proximoPasso: proximoPasso(estado),
      // Só faz sentido no rascunho — nos outros estados a porta já passou.
      pendenciasParaAbrir:
        ciclo.status === 'RASCUNHO' ? await this.ciclos.pendenciasParaAbrir(cicloId) : null,
      ...(await this.ciclos.historicoDeReabertura(cicloId).then((h) => ({
        reaberturas: h.reaberturas,
        ultimaReabertura: h.ultima,
      }))),
    };
  }

  /**
   * Dos que não têm designação NESTE ciclo, quantos já têm avaliador no
   * cadastro da plataforma — ou seja, quantos se resolvem só copiando.
   */
  private async semDesignacaoPorOrigem(ids: Set<string>) {
    if (ids.size === 0) return { jaTemNoCadastro: 0, nemNoCadastro: 0 };
    const noCadastro = await this.prisma.designacaoPadrao.findMany({
      where: { avaliadoId: { in: [...ids] }, vigenciaFim: null },
      select: { avaliadoId: true },
    });
    const jaTem = new Set(noCadastro.map((d) => d.avaliadoId)).size;
    return { jaTemNoCadastro: jaTem, nemNoCadastro: ids.size - jaTem };
  }

  /**
   * QUEM O CICLO NÃO ENXERGA — elegível e fora do público de toda aplicação.
   *
   * A conta é de nível de CICLO de propósito: `semDesignacao` percorre as
   * aplicações uma a uma e, por construção, não tem como enxergar quem não
   * pertence a nenhuma delas. Era o buraco que sobrava depois de o público
   * virar nominal — e é a mesma pergunta que o cadastro de avaliadores responde
   * do outro lado ("quem não está na lista de ninguém").
   *
   * ⚠️ A régua de elegibilidade é a MESMA da tela de designação
   * (`elegibilidade-ciclo.ts`), pela razão de sempre: duas contas de "quem
   * deveria estar no ciclo" divergem no primeiro ajuste manual. Aqui ela roda
   * sobre o cadastro inteiro, porque a pergunta é justamente sobre quem ficou
   * fora de todo recorte.
   */
  /**
   * ⚠️ NÃO MARCA a linha do próprio usuário — decisão de 06/09/2026, com prazo
   * de validade.
   *
   * A linha aqui só diz "esta pessoa ficaria fora do ciclo": pendência de
   * montagem, sem avaliação, avaliador nem nota. E a marca seria quase sempre
   * invisível — medido no DEV, o ciclo "Avaliação Geral 2026" tem **896 pessoas
   * nesta lista e a tela renderiza 6 nomes**; a gestora está na posição 35.
   *
   * 🔴 **Quem implementar o "ver todos" desta lista precisa revisitar isto.** A
   * decisão é inócua enquanto a tela mostra 6 de 896 — deixa de ser no dia em
   * que ela mostrar a lista inteira, com busca. Marcar é uma linha:
   * `marcarRestricoesPor(pessoas, colaboradorId, (p) => p.colaboradorId)`.
   */
  private async foraDeTodasAsAplicacoes(ciclo: { id: string; incluirAfastados: boolean }) {
    const [candidatos, noPublico, decisoes] = await Promise.all([
      this.prisma.colaborador.findMany({
        where: { situacao: { in: SITUACOES_ELEGIVEIS as never[] } },
        select: {
          id: true,
          matricula: true,
          nome: true,
          filial: true,
          centroCusto: true,
          centroCustoDescricao: true,
          situacao: true,
        },
        orderBy: [{ filial: 'asc' }, { centroCusto: 'asc' }, { nome: 'asc' }],
      }),
      this.prisma.aplicacaoPublico.findMany({
        where: { cicloId: ciclo.id },
        select: { colaboradorId: true },
      }),
      this.prisma.cicloElegibilidade.findMany({
        where: { cicloId: ciclo.id, removidoEm: null },
        select: { colaboradorId: true, decisao: true },
      }),
    ]);

    const jaTemAplicacao = new Set(noPublico.map((p) => p.colaboradorId));
    // O RH pode ter EXCLUÍDO alguém do ciclo de propósito. Contar essa pessoa
    // como pendência transformaria uma decisão registrada em cobrança eterna.
    const excluidos = new Set(
      decisoes.filter((d) => d.decisao === 'EXCLUIR').map((d) => d.colaboradorId),
    );

    const { incluidos } = montarListaInicial(
      candidatos.map((c) => ({
        colaboradorId: c.id,
        matricula: c.matricula,
        nome: c.nome,
        // Mesma nota da tela de designação: categoria funcional não é coluna do
        // nosso cadastro; Presidente e Vice saem por decisão registrada.
        categoriaFuncional: null,
        situacaoNaDataBase: c.situacao,
      })),
      { incluirAfastados: ciclo.incluirAfastados },
    );

    const porId = new Map(candidatos.map((c) => [c.id, c]));
    const pessoas: PessoaForaDoCiclo[] = incluidos
      .filter((i) => !jaTemAplicacao.has(i.colaboradorId) && !excluidos.has(i.colaboradorId))
      .map((i) => {
        const c = porId.get(i.colaboradorId)!;
        return {
          colaboradorId: c.id,
          matricula: c.matricula,
          nome: c.nome,
          filial: c.filial,
          centroCusto: c.centroCusto,
          centroCustoDescricao: c.centroCustoDescricao,
        };
      });

    return { total: pessoas.length, pessoas };
  }

  /**
   * Fila por avaliador, do mais atrasado para o menos. Cancelada fica fora da
   * conta: não é trabalho de ninguém, e somá-la faria a fila de quem não deve
   * nada parecer cheia.
   */
  private async filaPorAvaliador(cicloId: string): Promise<FilaDoAvaliador[]> {
    const linhas = await this.prisma.avaliacao.groupBy({
      by: ['avaliadorId', 'status'],
      where: { cicloId, status: { not: 'CANCELADA' } },
      _count: { _all: true },
    });
    if (linhas.length === 0) return [];

    const pessoas = await this.prisma.colaborador.findMany({
      where: { id: { in: [...new Set(linhas.map((l) => l.avaliadorId))] } },
      select: { id: true, nome: true, matricula: true },
    });
    const porId = new Map(pessoas.map((p) => [p.id, p]));

    const acumulado = new Map<string, FilaDoAvaliador>();
    for (const l of linhas) {
      const atual =
        acumulado.get(l.avaliadorId) ??
        {
          avaliadorId: l.avaliadorId,
          nome: porId.get(l.avaliadorId)?.nome ?? '(colaborador não encontrado)',
          matricula: porId.get(l.avaliadorId)?.matricula ?? '',
          total: 0,
          enviadas: 0,
          aFazer: 0,
        };
      atual.total += l._count._all;
      if (l.status === 'ENVIADA') atual.enviadas += l._count._all;
      else atual.aFazer += l._count._all;
      acumulado.set(l.avaliadorId, atual);
    }

    return [...acumulado.values()].sort((a, b) => b.aFazer - a.aFazer || a.nome.localeCompare(b.nome));
  }
}
