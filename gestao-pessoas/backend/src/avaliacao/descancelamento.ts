/**
 * ⭐⭐ DESCANCELAR — e as quatro decisões de política que ele carrega (11/09).
 *
 * Até aqui `CANCELADA` não voltava por caminho nenhum, e os dois diálogos que
 * levam a ela prometiam o contrário: o modal do **Excluir** diz que é reversível
 * pelo **Incluir**, e o Incluir não revertia nada. Este arquivo é o conserto
 * dessa promessa, não um botão novo.
 *
 * ── (a) PARA QUAL ESTADO ELA VOLTA ──────────────────────────────────────────
 * **Derivado do dado, nunca fixo:** com resposta gravada, `EM_ANDAMENTO`; sem,
 * `PENDENTE`. As respostas nunca foram apagadas — cancelar tira da CONTA, não
 * do banco —, então voltar para `PENDENTE` uma avaliação com 4 respostas mentiria
 * para o avaliador, que abriria e encontraria trabalho feito num estado que diz
 * "não começou". E um terceiro estado só para o pós-descancelamento seria estado
 * que ninguém mais sabe ler.
 *
 * ── (b) O MOTIVO ORIGINAL ───────────────────────────────────────────────────
 * `motivoCancelamento` é **apagado do registro**: campo que descreve um estado
 * que não vale mais é a armadilha do §3.1.48 — a linha viva continuaria exibindo
 * por que foi cancelada. O texto vai para `valorAnterior` da auditoria, e é
 * OBRIGATÓRIO que vá: sem ele a trilha guarda "descancelou" e perde o porquê,
 * que é a metade que responde a pergunta de daqui a seis meses.
 *
 * ── (c) A GRANULARIDADE É A DO ATO QUE CAUSOU ───────────────────────────────
 * `DECISAO_RH` foi um ato POR LINHA, com motivo por linha → desfaz por linha,
 * pelo Incluir. `ENCERRAMENTO` foi UM ato sobre N avaliações, com UM motivo →
 * desfaz em MASSA, por ciclo. ⚠️ Não vale aqui a regra da reapuração ("nada de
 * recorte por colaborador"): lá ela guarda resultado apurado contra a separação
 * de funções; aqui o Excluir **já é** por linha, e a simetria é o contrário de
 * um buraco.
 *
 * ── (d) AS DUAS ORIGENS, EM TRANSAÇÃO ÚNICA ─────────────────────────────────
 * Desfazer um `DECISAO_RH` reverte **cancelamento e elegibilidade juntos**.
 * Separados, sobra o estado partido que `decidirElegibilidade` foi escrito para
 * fechar: avaliação viva com decisão de exclusão vigente — e a próxima cópia do
 * cadastro a exclui de novo, calada.
 */

/** O que a avaliação precisa expor para o descancelamento decidir. */
export interface AvaliacaoParaDescancelar {
  status: string;
  /** Quantas respostas estão gravadas. Nunca foram apagadas pelo cancelamento. */
  respostas: number;
  motivoCancelamento: string | null;
  origemCancelamento: string | null;
}

export type AcaoDoDescancelamento =
  | { acao: 'DESCANCELAR'; status: 'PENDENTE' | 'EM_ANDAMENTO'; frase: null }
  | { acao: 'NADA_A_FAZER'; status: null; frase: null }
  | { acao: 'RECUSAR'; status: null; frase: string };

/**
 * ⭐ (a) O ESTADO VEM DO DADO. Exportada à parte porque a regra é citada na
 * tela ("volta como EM ANDAMENTO, com as 4 respostas") e tem de ser a mesma
 * função nos dois lados.
 */
export function estadoAoVoltar(respostas: number): 'PENDENTE' | 'EM_ANDAMENTO' {
  return respostas > 0 ? 'EM_ANDAMENTO' : 'PENDENTE';
}

/**
 * Decide o que fazer com UMA avaliação, para a origem que está desfazendo.
 *
 * `origemEsperada` é o ato que está sendo desfeito — o Incluir desfaz
 * `DECISAO_RH`, o desfazer em massa desfaz `ENCERRAMENTO`. Cruzar as duas seria
 * o Incluir de uma pessoa ressuscitando uma avaliação que o encerramento do
 * ciclo cancelou, que é outro ato e outra decisão.
 */
export function efeitoDoDescancelamento(
  avaliacao: AvaliacaoParaDescancelar | null,
  origemEsperada: 'DECISAO_RH' | 'ENCERRAMENTO',
): AcaoDoDescancelamento {
  // Sem avaliação, ou já viva: não há o que desfazer, e isso não é erro —
  // o Incluir continua servindo para quem a régua excluiu sem avaliação nenhuma.
  if (!avaliacao || avaliacao.status !== 'CANCELADA') {
    return { acao: 'NADA_A_FAZER', status: null, frase: null };
  }

  /**
   * ⚠️ Linha ANTIGA, cancelada antes de a origem existir. Não se adivinha:
   * o backfill da migration classificou todas as que havia, então `null` aqui
   * é linha nova sem origem — defeito de código, não dado legado. Recusar com
   * o motivo é melhor que escolher uma origem e desfazer o ato errado.
   */
  if (avaliacao.origemCancelamento === null) {
    return {
      acao: 'RECUSAR',
      status: null,
      frase:
        'Esta avaliação foi cancelada sem registro de qual ato a cancelou, então não há como ' +
        'saber o que desfazer com segurança. Fale com a T.I.',
    };
  }

  if (avaliacao.origemCancelamento !== origemEsperada) {
    const daOutra =
      avaliacao.origemCancelamento === 'ENCERRAMENTO'
        ? 'Ela foi cancelada pelo ENCERRAMENTO do ciclo, junto com as outras pendentes — e o ' +
          'que desfaz aquilo é devolver as canceladas do encerramento, na tela do ciclo, com ' +
          'um motivo só para todas.'
        : 'Ela foi excluída do ciclo pelo RH, uma decisão tomada nesta linha — e o que desfaz ' +
          'isso é o Incluir, aqui na Designação.';
    return {
      acao: 'RECUSAR',
      status: null,
      frase: `Esta avaliação não foi cancelada por este ato. ${daOutra}`,
    };
  }

  return {
    acao: 'DESCANCELAR',
    status: estadoAoVoltar(avaliacao.respostas),
    frase: null,
  };
}

/**
 * A frase que a tela mostra ANTES de confirmar — diz o que volta e em que
 * estado, com número. "Tem certeza?" não é confirmação de nada.
 */
export function fraseDoDescancelamento(avaliacao: AvaliacaoParaDescancelar): string {
  if (avaliacao.respostas === 0) {
    return 'A avaliação volta para a fila do avaliador como PENDENTE, ainda sem nenhuma resposta.';
  }
  /**
   * ⚠️ O número entra como VALOR DE RÓTULO, nunca no meio da frase — "com as 1
   * respostas" é o erro de §3.1.35, e há um invariante varrendo o fonte para
   * impedi-lo. Mesma forma do `respostasEmTexto` em `cancelamento.ts`.
   */
  return (
    'A avaliação volta para a fila do avaliador como EM ANDAMENTO. ' +
    `Respostas já gravadas: ${avaliacao.respostas}. Nada foi apagado no cancelamento.`
  );
}
