/**
 * ⭐⭐ A DEVOLUTIVA — ETAPA 1: o ATO DE LIBERAR.
 *
 * ── O DESENHO EM UMA FRASE ──────────────────────────────────────────────────
 *
 *   O **RH LIBERA**; o **AVALIADOR CONDUZ** a conversa, presencialmente.
 *
 * São dois atos, de pessoas diferentes, em momentos diferentes — e por isso
 * duas marcas (`devolutivaLiberada*` e `devolutivaConduzida*`), nunca uma.
 *
 * ⭐ **Por que o avaliador conduz, e não o RH:** a Arielly em 344 conversas no
 * ENSAIO e 894 em produção não acontece. O avaliador já conhece a pessoa e já
 * emitiu o julgamento — centralizar a devolutiva seria desenhar uma etapa que
 * ninguém consegue executar.
 *
 * ── O QUE ESTA CLASSE FAZ, E O QUE ELA NÃO FAZ ──────────────────────────────
 *
 * Ela **só liberta a leitura**. Não calcula, não altera nota, não manda nada a
 * ninguém: escreve uma data e um autor numa coluna, e a partir daí o avaliador
 * passa a ver a nota **das pessoas que ele avaliou**.
 *
 * ⚠️ **Na prática é irreversível**, e o diálogo da tela precisa dizer isso: a
 * marca dá para limpar, a conversa não. Uma vez que o avaliador leu — ou pior,
 * que ele já sentou com o avaliado — desmarcar não desfaz nada no mundo.
 *
 * ── A CONTA QUE FECHA (o portão desta etapa) ────────────────────────────────
 *
 *   liberadas + não liberadas = apuradas
 *
 * ⭐ É a conta, não o aviso, que detecta furo: se um dia a liberação passar a
 * pegar avaliação sem resultado, ou a deixar alguém de fora em silêncio, os dois
 * lados param de bater. `previaDaLiberacao` devolve os três números para a tela
 * poder mostrar a conta — e para o spec poder cobrá-la.
 */
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { ResultadoService } from '../resultado/resultado.service.js';
import { ehProprioAvaliado } from '../avaliacao/separacao-funcoes.js';

/** Escopo do lote. Um dos dois, nunca os dois. */
export interface EscopoDaLiberacao {
  cicloId: string;
  /** Recorta o lote a uma aplicação do ciclo. */
  aplicacaoId?: string | null;
}

export interface LinhaDaLiberacao {
  avaliacaoId: string;
  avaliadoNome: string;
  avaliadoMatricula: string;
  avaliadorNome: string;
  notaFinal: number | null;
  conceito: string | null;
  /** ⭐ Marcada, nunca filtrada — ver `previaDaLiberacao`. */
  ehMinha: boolean;
}

@Injectable()
export class DevolutivaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    /**
     * ⭐ A memória é REUSADA, não reimplementada. O payload que o RH lê é o
     * mesmo que o avaliador precisa — nota final, conceito, pergunta a pergunta
     * com as âncoras, e os critérios com valor, faixa, pontos e peso. Uma
     * segunda montagem divergiria no primeiro campo novo, e a tela do avaliador
     * passaria a dizer um número diferente do da tela do RH sobre a mesma
     * pessoa.
     */
    private readonly resultados: ResultadoService,
  ) {}

  /**
   * ⭐⭐ A PRÉVIA — e o `Liberar` grava **exatamente os ids que ela mostrou**.
   *
   * ⚠️ Não é detalhe de implementação: em 07/09 o `Aplicar` do público
   * recalculava o alvo no clique, e a tela **conferia um recorte e gravava
   * outro** ([[feedback_previa_grava_o_que_mostrou]]). Aqui o contrato é o
   * mesmo do público: a prévia devolve ids, o ato recebe ids, e ninguém relê
   * nada no meio.
   *
   * Ela separa três conjuntos, porque cada um pede uma coisa diferente de quem
   * lê a tela:
   *
   *   `liberaveis`   → apuradas e ainda não liberadas — é o que o botão faz;
   *   `jaLiberadas`  → não é erro, é trabalho já feito. Some do botão, aparece
   *                    na conta (senão o total não fecha e o RH acha que perdeu
   *                    gente);
   *   `naoApuradas`  → **não podem** ser liberadas: não há nota. Aparecem com o
   *                    motivo, porque quem lê precisa saber que falta apurar —
   *                    e não que o sistema esqueceu alguém.
   */
  async previaDaLiberacao(escopo: EscopoDaLiberacao, colaboradorId: string | null) {
    const ciclo = await this.prisma.ciclo.findUnique({
      where: { id: escopo.cicloId },
      select: { id: true, nome: true, status: true },
    });
    if (!ciclo) throw new NotFoundException('Ciclo não encontrado.');

    /**
     * ⚠️ `status: 'ENVIADA'` e não "tem resultado": quem decide se dá para
     * liberar é a EXISTÊNCIA DA APURAÇÃO, mas quem entra na conta é toda
     * avaliação viva do escopo. Contar só as apuradas esconderia as que faltam
     * apurar — que é exatamente o que o RH precisa ver antes de liberar.
     */
    const avaliacoes = await this.prisma.avaliacao.findMany({
      where: {
        cicloId: escopo.cicloId,
        ...(escopo.aplicacaoId ? { aplicacaoId: escopo.aplicacaoId } : {}),
        status: 'ENVIADA',
      },
      select: {
        id: true,
        avaliadoId: true,
        avaliadorId: true,
        devolutivaLiberadaEm: true,
      },
      orderBy: { criadoEm: 'asc' },
    });

    const resultados = await this.prisma.resultadoAvaliacao.findMany({
      where: { avaliacaoId: { in: avaliacoes.map((a) => a.id) } },
      select: { avaliacaoId: true, notaFinal: true, conceitoDescricao: true },
    });
    const porAvaliacao = new Map(resultados.map((r) => [r.avaliacaoId, r]));

    const ids = [...new Set(avaliacoes.flatMap((a) => [a.avaliadoId, a.avaliadorId]))];
    const gente = await this.prisma.colaborador.findMany({
      where: { id: { in: ids } },
      select: { id: true, nome: true, matricula: true },
    });
    const porId = new Map(gente.map((c) => [c.id, c]));

    const liberaveis: LinhaDaLiberacao[] = [];
    const jaLiberadas: LinhaDaLiberacao[] = [];
    const naoApuradas: LinhaDaLiberacao[] = [];
    /**
     * ⭐⭐ A PRÓPRIA AVALIAÇÃO — marcada, e FORA do lote.
     *
     * Liberar escreve na linha da avaliação em que o RH_ADMIN é o AVALIADO, e a
     * separação de funções barra o que MUDA o registro — inclusive quando a
     * mudança não parece favorecer ninguém. É exatamente por isto que
     * **`RH_ADMIN precisa ser dado a duas pessoas`**: a devolutiva da gestora é
     * liberada pela outra.
     *
     * ⚠️ Ela aparece na lista, marcada. **Filtrar em silêncio faria o total não
     * fechar** e o RH procuraria uma pessoa que sumiu.
     */
    const minhas: LinhaDaLiberacao[] = [];

    for (const a of avaliacoes) {
      const r = porAvaliacao.get(a.id);
      const linha: LinhaDaLiberacao = {
        avaliacaoId: a.id,
        avaliadoNome: porId.get(a.avaliadoId)?.nome ?? '',
        avaliadoMatricula: porId.get(a.avaliadoId)?.matricula ?? '',
        avaliadorNome: porId.get(a.avaliadorId)?.nome ?? '',
        notaFinal: r ? Number(r.notaFinal) : null,
        conceito: r?.conceitoDescricao ?? null,
        ehMinha: ehProprioAvaliado(colaboradorId, a.avaliadoId),
      };
      if (!r) naoApuradas.push(linha);
      else if (a.devolutivaLiberadaEm) jaLiberadas.push(linha);
      else if (linha.ehMinha) minhas.push(linha);
      else liberaveis.push(linha);
    }

    const apuradas = liberaveis.length + jaLiberadas.length + minhas.length;
    return {
      ciclo: { id: ciclo.id, nome: ciclo.nome, status: ciclo.status },
      /**
       * ⭐ A CONTA DO PORTÃO, montada aqui para a tela mostrar e o spec cobrar:
       * `liberadas + naoLiberadas = apuradas`. `naoApuradas` fica FORA dela de
       * propósito — não são partes do mesmo todo, e somá-las é o erro do
       * §3.1.109 (dois números verdadeiros sem o termo que os concilia).
       */
      conta: {
        enviadas: avaliacoes.length,
        apuradas,
        liberadas: jaLiberadas.length,
        naoLiberadas: liberaveis.length + minhas.length,
        naoApuradas: naoApuradas.length,
      },
      liberaveis,
      jaLiberadas,
      naoApuradas,
      minhas,
    };
  }

  /**
   * ⭐ LIBERAR — grava **os ids recebidos**, nada mais.
   *
   * Recusa com o dado em vez de ignorar em silêncio: id fora do escopo, sem
   * apuração, ou a própria avaliação de quem está liberando param o lote
   * inteiro e dizem quantos são. ⚠️ Ignorar as ruins e gravar o resto faria a
   * tela dizer "liberadas 40" sobre um clique de 42 — e ninguém procuraria as 2.
   */
  async liberar(avaliacaoIds: string[], contexto: { colaboradorId: string | null; usuarioId: string }) {
    if (avaliacaoIds.length === 0) {
      throw new NotFoundException('Nenhuma avaliação selecionada para liberar.');
    }
    const ids = [...new Set(avaliacaoIds)];

    const avaliacoes = await this.prisma.avaliacao.findMany({
      where: { id: { in: ids } },
      select: { id: true, avaliadoId: true, cicloId: true, status: true, devolutivaLiberadaEm: true },
    });
    if (avaliacoes.length !== ids.length) {
      const achados = new Set(avaliacoes.map((a) => a.id));
      const faltando = ids.filter((i) => !achados.has(i));
      /**
       * ⚠️ Número em RÓTULO, nunca colado a palavra que concorda com ele: com
       * um só, *"1 de 1 avaliações não existem"* erra duas vezes na mesma
       * frase. Ver `texto-sem-flexao.invariante.spec.ts` — e leia a frase
       * inteira com o número 1, porque a varredura só enxerga o que está
       * colado.
       */
      throw new NotFoundException(
        'A lista que você está vendo é mais antiga que o ciclo. ' +
          `Não existem mais: ${faltando.length} · selecionadas: ${ids.length}. ` +
          'Recarregue a prévia.',
      );
    }

    const proprias = avaliacoes.filter((a) => ehProprioAvaliado(contexto.colaboradorId, a.avaliadoId));
    if (proprias.length > 0) {
      throw new ForbiddenException(
        'A sua própria avaliação está na seleção e não pode ser liberada por você — nem em ' +
          'lote. Quem libera a devolutiva de quem responde pelo RH é o segundo RH_ADMIN.',
      );
    }

    const comResultado = await this.prisma.resultadoAvaliacao.findMany({
      where: { avaliacaoId: { in: ids } },
      select: { avaliacaoId: true },
    });
    const apuradas = new Set(comResultado.map((r) => r.avaliacaoId));
    const semNota = avaliacoes.filter((a) => !apuradas.has(a.id));
    if (semNota.length > 0) {
      throw new ForbiddenException(
        'Sem apuração não há nota para mostrar, e parte da seleção ainda não foi apurada. ' +
          `Sem apuração: ${semNota.length} · selecionadas: ${ids.length}. ` +
          'Apure o ciclo antes de liberar a devolutiva.',
      );
    }

    /**
     * ⚠️ Já liberadas **não são erro** — são clique repetido, ou duas pessoas do
     * RH na mesma tela. Ficam de fora da escrita sem derrubar o lote, e o
     * retorno diz quantas eram: o número que a tela mostra tem de ser o que
     * mudou, não o que foi clicado.
     */
    const aGravar = avaliacoes.filter((a) => !a.devolutivaLiberadaEm).map((a) => a.id);
    const jaEstavam = avaliacoes.length - aGravar.length;

    if (aGravar.length > 0) {
      const agora = new Date();
      await this.prisma.avaliacao.updateMany({
        where: { id: { in: aGravar } },
        data: { devolutivaLiberadaEm: agora, devolutivaLiberadaPorId: contexto.usuarioId },
      });
      /**
       * ⭐ UMA linha de auditoria por AVALIAÇÃO, não uma pelo lote.
       *
       * O que alguém vai perguntar em dezembro é *"quando a devolutiva DESTA
       * pessoa foi liberada?"*. Uma linha só com "42 liberadas" não responde — e
       * é ela que vai sobreviver à reabertura, quando a coluna for limpa.
       */
      for (const id of aGravar) {
        await this.auditoria.registrar({
          entidade: 'Avaliacao',
          entidadeId: id,
          acao: 'LIBERAR_DEVOLUTIVA',
          usuarioId: contexto.usuarioId,
          valorNovo: { devolutivaLiberadaEm: agora, noLote: aGravar.length },
        });
      }
    }

    return { liberadas: aGravar.length, jaEstavam, recebidas: ids.length };
  }

  /**
   * ⭐⭐ ETAPA 2 — O AVALIADOR VÊ a devolutiva de quem ELE avaliou.
   *
   * ── O QUE ESTA ROTA RESOLVE, E O QUE ELA NÃO DUPLICA ──────────────────────
   *
   * A memória é chaveada por `resultadoId`; o avaliador tem `avaliacaoId` — é o
   * que a fila dele carrega. ⭐ `ResultadoAvaliacao.avaliacaoId` é **`@unique`**,
   * então o problema é de **CHAVE, não de conteúdo**: traduz-se a chave e
   * chama-se `memoria()`. **Nenhum campo é remontado aqui** — remontar faria a
   * tela dele dizer um número diferente do da tela do RH sobre a mesma pessoa,
   * no primeiro campo que mudasse.
   *
   * ── OS TRÊS PORTÕES, NESTA ORDEM E POR ESTE MOTIVO ────────────────────────
   *
   *   1. **é a avaliação em que ELE é o avaliado?** → 403 **e auditoria**
   *   2. **ele é o avaliador designado?**           → 403 *"não é sua"*
   *   3. **o RH já liberou?**                       → 403 *"ainda não liberou"*
   *
   * ⚠️ **A ORDEM É REGRA.** A da própria vem primeiro porque é a única que
   * precisa deixar rastro — e porque, invertida, quem tentasse abrir a própria
   * avaliação receberia *"esta avaliação não é sua"*, **falso e confuso**: ela é
   * dele, e é exatamente por isso que ele não pode vê-la.
   *
   * ── ⭐⭐ DOIS 403 QUE NÃO SÃO O MESMO 403 ───────────────────────────────────
   *
   * | | é |
   * |---|---|
   * | *"o RH ainda não liberou"* | **TEMPORÁRIO** — vai mudar sozinho, e ele só espera |
   * | *"esta avaliação não é sua"* | **DEFINITIVO** — nunca vai mudar |
   *
   * Dar o mesmo texto aos dois é a família do **"403 que parece falta de
   * permissão"**, que já apareceu três vezes neste módulo e sempre com o mesmo
   * custo: a pessoa vai ao Configurador pedir um acesso que ela já tem — ou que
   * não resolveria nada. A mensagem tem de dizer **o que fazer em seguida**, e
   * "espere o RH" e "não é sua" levam a lugares opostos.
   *
   * ⚠️ **Não apurada devolve a MESMA mensagem de "não liberada"**, e é decisão.
   * Do lado dele os dois estados são indistinguíveis e a ação é idêntica —
   * esperar. Separar as frases vazaria estado interno do RH ("já apuraram, mas
   * não liberaram") sem lhe dar nada que ele possa fazer.
   */
  async paraOAvaliador(
    avaliacaoId: string,
    contexto: { colaboradorId: string | null; usuarioId: string; ip?: string },
  ) {
    const avaliacao = await this.prisma.avaliacao.findUnique({
      where: { id: avaliacaoId },
      select: { id: true, avaliadoId: true, avaliadorId: true, devolutivaLiberadaEm: true },
    });
    if (!avaliacao) throw new NotFoundException('Avaliação não encontrada.');

    // ── PORTÃO 1: a própria. `ehProprioAvaliado`, nunca `===` (§3.1.104).
    if (ehProprioAvaliado(contexto.colaboradorId, avaliacao.avaliadoId)) {
      await this.auditoria.registrar({
        entidade: 'Avaliacao',
        entidadeId: avaliacaoId,
        acao: 'ACESSO_NEGADO_PROPRIO_AVALIADO:devolutiva',
        usuarioId: contexto.usuarioId,
        valorNovo: { avaliadoId: avaliacao.avaliadoId },
        ip: contexto.ip,
      });
      throw new ForbiddenException(
        'A sua própria avaliação não fica visível para você — nem a nota, nem a memória de ' +
          'cálculo. Quem responde por ela é o seu superior; a devolutiva vem por ele.',
      );
    }

    // ── PORTÃO 2: é dele? Definitivo.
    if (!contexto.colaboradorId || avaliacao.avaliadorId !== contexto.colaboradorId) {
      throw new ForbiddenException(
        'Esta avaliação não é sua. A devolutiva é conduzida por quem avaliou a pessoa.',
      );
    }

    // ── PORTÃO 3: o RH liberou? Temporário.
    if (!avaliacao.devolutivaLiberadaEm) {
      throw new ForbiddenException(
        'O RH ainda não liberou esta devolutiva. Quando liberar, a nota e a conta inteira ' +
          'aparecem aqui — não é falta de permissão sua, é etapa que ainda não aconteceu.',
      );
    }

    /**
     * ⚠️ Só agora se busca o resultado. Se a devolutiva está liberada, ele
     * existe — `liberar` recusa avaliação sem apuração. Um nulo aqui é
     * **incoerência de estado**, não caminho normal: por isso 404 com o texto
     * que manda procurar o RH, e não a frase de "aguarde".
     */
    const resultado = await this.prisma.resultadoAvaliacao.findUnique({
      where: { avaliacaoId },
      select: { id: true },
    });
    if (!resultado) {
      throw new NotFoundException(
        'A devolutiva está liberada mas o resultado não existe mais — a avaliação deve ter sido ' +
          'reaberta. Procure o RH.',
      );
    }

    /**
     * ⭐ A auditoria de leitura é a do `memoria()`, não uma nova: ela já isenta
     * o avaliador designado ("é o trabalho dele") e registra todo o resto. Duas
     * trilhas para o mesmo acesso fariam a contagem de leituras mentir.
     */
    const memoria = await this.resultados.memoria(resultado.id, contexto);
    return { ...memoria, devolutivaLiberadaEm: avaliacao.devolutivaLiberadaEm };
  }
}
