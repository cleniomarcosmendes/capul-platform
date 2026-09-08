/**
 * ⭐⭐ O QUE DESIGNAR VAI FAZER — antes de fazer.
 *
 * `designar()` é um `upsert`: quando a pessoa já tem avaliação no ciclo, ele
 * **troca o avaliador em silêncio**. Isso era certo para o caso comum (corrigir
 * quem errou a designação) e errado em dois:
 *
 *   1. **em lote**, a tela não dizia que ia substituir — marcava-se um grupo,
 *      escolhia-se um avaliador e quem já tinha outro era sobrescrito sem uma
 *      palavra. Foi o que aconteceu com a CLEIA no roteiro de 08/09;
 *   2. **sobre avaliação já respondida**, trocar o avaliador **põe o nome de um
 *      sobre o julgamento de outro** — parente do `JA_RESPONDIDA` que o lote do
 *      cadastro já recusava, e que a designação individual não checava.
 *
 * ⚠️ **O (2) NÃO virou recusa, e a diferença tem motivo escrito.** Havia uma
 * decisão anterior, em `troca-de-aplicacao.spec.ts`, dizendo que *"trocar só o
 * AVALIADOR, na mesma aplicação, não é bloqueado nem com nota enviada"* —
 * porque nenhuma resposta muda de instrumento e *"corrigir 'designei o
 * supervisor errado' continua sendo um ato de uma linha para o RH"*. Essa
 * decisão está certa sobre a INTEGRIDADE do dado; o que faltava nela era o
 * outro lado, a **atribuição**: quem lê a memória de cálculo vê "avaliado por"
 * com o nome novo sobre respostas que foram de outra pessoa.
 *
 * As duas se conciliam sem que nenhuma perca: o ato **continua permitido**, e
 * deixa de ser **silencioso** — exige confirmação explícita, no mesmo desenho
 * do `confirmarPendentes` do encerrar. Recusar de vez tiraria do RH uma
 * correção legítima; deixar passar calado é o defeito.
 *
 * ⚠️ **O buraco (2) era real e nunca foi acionado.** Medido em 08/09 na
 * auditoria do DEV: 368 trocas de avaliador, **zero** sobre avaliação com
 * status `ENVIADA`/`EM_ANDAMENTO`. Sorte, não guarda.
 *
 * ⚠️ Trocar só o AVALIADOR não é trocar de APLICAÇÃO — esta continua com a
 * guarda própria (`assertPodeTrocarDeAplicacao`), porque lá o problema é outro
 * (as respostas ficam órfãs de um modelo diferente).
 *
 * ⭐ Esta função decide **e** escreve a frase, como o `efeitoDoExcluir`: a
 * prévia da tela e a recusa da API saem do mesmo lugar, então não têm como
 * discordar.
 */

import {
  decidirTrocaDeAplicacao,
  mensagemDaRecusa,
  type MotivoDaRecusa,
} from './troca-de-aplicacao.js';

export type AcaoDaDesignacao =
  /** Não havia avaliação: o ato cria. */
  | 'CRIAR'
  /** Já havia, com OUTRO avaliador: o ato substitui — e a tela tem de dizer. */
  | 'SUBSTITUIR'
  /** Já é este avaliador, nesta aplicação. O ato não muda nada. */
  | 'NADA_A_FAZER'
  /**
   * ⭐⭐ Substituiria o avaliador de uma avaliação **já respondida**: permitido,
   * mas **nunca em silêncio**. Só passa com confirmação explícita.
   */
  | 'EXIGE_CONFIRMACAO'
  /** O ato é recusado, e a frase diz por quê. */
  | 'RECUSAR';

export interface AvaliacaoAtual {
  status: string;
  respostas: number;
  avaliadorId: string;
  avaliadorNome?: string | null;
  aplicacaoId: string;
  /**
   * Nome da aplicação em que a avaliação está HOJE — só usado quando o ato
   * mudaria de aplicação, para a frase de recusa dizer de onde ela sairia.
   * Ausente vira "outra aplicação", como a guarda antiga já fazia.
   */
  aplicacaoNome?: string | null;
}

export interface EfeitoDaDesignacao {
  acao: AcaoDaDesignacao;
  /** Frase pronta — de aviso quando SUBSTITUIR, de recusa quando RECUSAR. */
  frase: string | null;
  /** Nome de quem avalia hoje, quando há. A tela lista os substituídos. */
  avaliadorAtual: string | null;
  /**
   * ⭐ O estado em UMA linha, para a lista do lote: *"ENVIADA por JOÃO"*,
   * *"7 resposta(s), por JOÃO"*. Com 50 selecionadas, repetir a frase inteira
   * por pessoa é ilegível — a explicação vai uma vez, no cabeçalho do bloco
   * (`avisoDeRespondidas`), e a lista diz só de quem se trata.
   */
  estadoAtual: string | null;
}

/** O estado da avaliação em uma linha. Mora aqui para a lista e o aviso não divergirem. */
function estadoEmUmaLinha(atual: AvaliacaoAtual): string {
  const quem = atual.avaliadorNome?.trim() || 'avaliador não identificado';
  if (atual.status === 'ENVIADA') return `ENVIADA por ${quem}`;
  if (atual.respostas > 0) return `${atual.respostas} resposta(s), por ${quem}`;
  return `por ${quem}`;
}

/**
 * ⭐ O aviso do LOTE, escrito uma vez para o grupo. Fica no backend pela mesma
 * razão de todas as outras frases deste módulo: se a tela compuser a dela, as
 * duas envelhecem separadas.
 */
export function avisoDeTrocaEmRespondidas(quantas: number): string | null {
  if (quantas === 0) return null;
  return (
    `⚠️ ${quantas} destas já foram respondidas. Trocar o avaliador põe o nome novo em ` +
    '"avaliado por" na memória de cálculo, sobre respostas que foram de outra pessoa. Faça isto ' +
    'só se o REGISTRO do avaliador é que estava errado; se o julgamento é que precisa mudar, ' +
    'reabra a avaliação (ato do RH_ADMIN, com motivo) e refaça-a.'
  );
}

export interface ContextoDaDesignacao {
  /** Quem seria avaliado — para a guarda da autoavaliação morar aqui dentro. */
  avaliadoId: string;
  nomeDoAvaliado: string;
  novoAvaliadorId: string;
  novoAvaliadorNome?: string | null;
  /** A aplicação para a qual se está designando. */
  aplicacaoId: string;
}

export function efeitoDeDesignar(
  atual: AvaliacaoAtual | null,
  ctx: ContextoDaDesignacao,
): EfeitoDaDesignacao {
  /**
   * ⭐⭐ A AUTOAVALIAÇÃO ENTROU AQUI EM 08/09 — e o motivo é o da §3.1.27.
   *
   * A guarda existia **inline dentro de `designar()`** e a prévia não a rodava:
   * pedir a prévia de designar alguém para si mesmo devolvia `SUBSTITUIR`, com
   * a linha contada nos baldes, e o ato recusava logo depois. Medido no Piloto:
   * `{substituir: 1, recusar: 0, total: 1}` × *"Ninguém pode ser o avaliador da
   * própria avaliação."* — **a tela autorizando o que a API nega**, que é pior
   * que contador errado.
   *
   * Vindo para o classificador, ela deixa de ter duas versões: a prévia e o ato
   * chamam a MESMA função, e é impossível uma saber o que a outra não sabe.
   * ⚠️ Por isso não se re-implementa esta checagem em `designar()`.
   */
  if (ctx.avaliadoId === ctx.novoAvaliadorId) {
    return {
      acao: 'RECUSAR',
      avaliadorAtual: atual?.avaliadorNome ?? null,
      estadoAtual: atual ? estadoEmUmaLinha(atual) : null,
      frase: 'Ninguém pode ser o avaliador da própria avaliação.',
    };
  }

  if (!atual) return { acao: 'CRIAR', frase: null, avaliadorAtual: null, estadoAtual: null };

  const atualNome = atual.avaliadorNome?.trim() || 'o avaliador atual';
  const novoNome = ctx.novoAvaliadorNome?.trim() || 'o avaliador escolhido';

  /**
   * ⚠️ Cancelada não se redesigna: o `upsert` a reviveria com avaliador novo e
   * status `CANCELADA`, que é um estado que não quer dizer nada. Reabrir uma
   * avaliação cancelada não tem caminho no módulo — está registrado na lista de
   * pendências —, e inventar um aqui, de passagem, seria pior.
   */
  if (atual.status === 'CANCELADA') {
    return {
      acao: 'RECUSAR',
      avaliadorAtual: atual.avaliadorNome ?? null,
      estadoAtual: 'CANCELADA',
      frase:
        `A avaliação de ${ctx.nomeDoAvaliado} neste ciclo está CANCELADA. Designar de novo a ` +
        'reviveria cancelada, com avaliador novo — um estado que não quer dizer nada. ' +
        'Hoje não há caminho para descancelar; se ela tem de voltar ao ciclo, fale com a T.I.',
    };
  }

  const mudaAvaliador = atual.avaliadorId !== ctx.novoAvaliadorId;

  /**
   * ⭐⭐ TROCA DE APLICAÇÃO — a segunda guarda que a prévia não rodava.
   *
   * Estava em `assertPodeTrocarDeAplicacao`, chamada por `designar()` DEPOIS
   * deste classificador; a prévia não a chamava, e prometia `SUBSTITUIR` onde o
   * ato lançaria. A DECISÃO continua sendo a mesma função pura de sempre
   * (`decidirTrocaDeAplicacao`), compartilhada com a cópia do cadastro — o que
   * mudou foi **quem a consulta**: agora o classificador, e por isso os três
   * chamadores enxergam o mesmo.
   *
   * ⚠️ VEM ANTES do `EXIGE_CONFIRMACAO`, e isto é deliberado: recusa de troca
   * de aplicação é **dura** (nenhuma confirmação a levanta) e a de avaliador é
   * **confirmável**. Na ordem anterior, um ato que fosse as duas coisas pedia
   * confirmação primeiro e só recusava depois de confirmada — fazia a pessoa
   * autorizar algo que ia ser negado de qualquer jeito.
   *
   * ⚠️ Lê `atual.respostas` em vez de recontar no banco. É o mesmo número: os
   * dois chamadores já trazem `_count.respostas` da avaliação, e a contagem
   * extra da guarda antiga era uma segunda ida ao banco pelo mesmo dado.
   */
  if (atual.aplicacaoId !== ctx.aplicacaoId) {
    const decisao = decidirTrocaDeAplicacao({
      status: atual.status,
      respostas: atual.respostas,
    });
    if (!decisao.permitida) {
      return {
        acao: 'RECUSAR',
        avaliadorAtual: atual.avaliadorNome ?? null,
        estadoAtual: estadoEmUmaLinha(atual),
        frase: mensagemDaRecusa(decisao.motivo as MotivoDaRecusa, {
          nomeDoAvaliado: ctx.nomeDoAvaliado,
          aplicacaoAtual: atual.aplicacaoNome ?? 'outra aplicação',
          respostas: atual.respostas,
        }),
      };
    }
  }

  /**
   * ⭐⭐ O MESMO PRINCÍPIO DO `JA_RESPONDIDA` DO LOTE. A `Resposta` pertence à
   * AVALIAÇÃO, não ao avaliador: trocar o nome em cima de respostas já dadas
   * põe o julgamento de uma pessoa na conta de outra, e a memória de cálculo
   * passa a exibir "avaliado por" com o nome errado.
   */
  if (mudaAvaliador && (atual.status === 'ENVIADA' || atual.respostas > 0)) {
    const oQueTem =
      atual.status === 'ENVIADA'
        ? 'já foi ENVIADA'
        : `já tem ${atual.respostas} resposta(s) gravada(s)`;
    return {
      acao: 'EXIGE_CONFIRMACAO',
      avaliadorAtual: atual.avaliadorNome ?? null,
      estadoAtual: estadoEmUmaLinha(atual),
      frase:
        `⚠️ A avaliação de ${ctx.nomeDoAvaliado} ${oQueTem} por ${atualNome}. Trocar o avaliador ` +
        `agora põe o nome de ${novoNome} sobre o julgamento de ${atualNome} — a memória de ` +
        'cálculo passa a mostrar o novo nome em "avaliado por", e as respostas continuam sendo ' +
        `as de ${atualNome}. Faça isto só se o registro do avaliador é que estava errado; se o ` +
        'julgamento é que precisa mudar, reabra a avaliação (ato do RH_ADMIN, com motivo) e ' +
        'refaça-a.',
    };
  }

  if (!mudaAvaliador && atual.aplicacaoId === ctx.aplicacaoId) {
    return {
      acao: 'NADA_A_FAZER',
      avaliadorAtual: atual.avaliadorNome ?? null,
      estadoAtual: estadoEmUmaLinha(atual),
      frase: `${atualNome} já é quem avalia ${ctx.nomeDoAvaliado} — nada muda.`,
    };
  }

  return {
    acao: 'SUBSTITUIR',
    avaliadorAtual: atual.avaliadorNome ?? null,
    estadoAtual: estadoEmUmaLinha(atual),
    frase:
      `${ctx.nomeDoAvaliado} já é avaliada por ${atualNome}. Isto SUBSTITUI o avaliador por ` +
      `${novoNome}${atual.respostas > 0 ? '' : ' — nenhuma resposta foi dada ainda'}.`,
  };
}
