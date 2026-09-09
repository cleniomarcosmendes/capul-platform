/**
 * ⭐⭐ CANCELAR AVALIAÇÃO — o ato que faltava, e o beco que ele fecha.
 *
 * `CANCELADA` estava no enum desde o começo, era **lida em três lugares**
 * (`assertPodeEditar`, a contagem do painel e a exclusão da fila por avaliador)
 * e **não era escrita por lugar nenhum**. Não era lixo como o `EM_APURACAO` que
 * saiu em 07/09: era uma peça que faltava — o tratamento já estava escrito, e o
 * ato que o produz é que nunca existiu.
 *
 * O custo disso era o BECO de 08/09:
 *
 *   - "Excluir" na Designação escrevia SÓ em `ciclo_elegibilidade`. A avaliação
 *     continuava PENDENTE na fila do avaliador (`minhasAvaliacoes` filtra por
 *     `avaliadorId`, e só) e continuava contando no `encerrar`. O RH tirava a
 *     pessoa da vista e não tirava nada do fluxo.
 *   - "Tirar do público" recusava mandando **"Cancele a avaliação antes"** — um
 *     ato que não existia em lugar nenhum do módulo. Recusa que manda a pessoa
 *     procurar um caminho inexistente é a mesma família do "ciclo encerrado"
 *     sem alternativa que corrigimos em 07/09.
 *   - E `encerrar` exigia 100% enviado, sem saída. Uma pessoa desligada ou que
 *     simplesmente não vai responder travava o ciclo **para sempre**.
 *
 * ⚠️ **ENVIADA não se cancela.** A recusa ensina a ORDEM (reabra a avaliação
 * primeiro), pelo mesmo motivo do `assertCicloAceitaReaberturaDeAvaliacao`: uma
 * avaliação enviada já tem nota e pode já ter `ResultadoAvaliacao` — cancelá-la
 * deixaria um resultado órfão de avaliação viva, que é uma segunda verdade.
 *
 * ⭐ **Resposta dada NUNCA se apaga.** Cancelar tira a avaliação da conta, não
 * do banco: as respostas ficam registradas, fora da apuração. Quem gastou meia
 * hora respondendo doze perguntas não perde o rastro porque o RH mudou de ideia.
 * (Proposta minha, pendente de confirmação da Arielly — §5.)
 */

/** Por que a avaliação está sendo cancelada. Vai gravado, junto do motivo escrito. */
export type OrigemDoCancelamento =
  /** O RH excluiu a pessoa do ciclo na tela de Designação. */
  | 'DECISAO_RH'
  /** O ciclo foi encerrado com pendência confirmada. */
  | 'ENCERRAMENTO_DO_CICLO';

export interface AvaliacaoParaCancelar {
  status: string;
  /** Quantas respostas já foram gravadas. Entra na frase da confirmação. */
  respostas: number;
  /** Nome de quem está com ela — a confirmação diz o nome, não "o avaliador". */
  avaliadorNome?: string | null;
}

export type AcaoDoCancelamento =
  /** Há avaliação viva: cancela. */
  | 'CANCELAR'
  /** Não há o que cancelar (sem avaliação, ou já cancelada). O ato segue. */
  | 'NADA_A_FAZER'
  /** Já foi enviada: o ato é RECUSADO, e a frase ensina a ordem. */
  | 'RECUSAR';

export interface EfeitoDoCancelamento {
  acao: AcaoDoCancelamento;
  /**
   * Frase pronta — de confirmação quando `CANCELAR`, de recusa quando `RECUSAR`.
   * `null` quando não há nada a dizer além do texto padrão da tela.
   *
   * ⚠️ Mora aqui, e não na tela, pela regra de 07/09: a frase que o usuário lê
   * antes de confirmar e a que a API devolve ao recusar têm de ser a MESMA — se
   * a tela montar a sua, as duas envelhecem separadas.
   */
  frase: string | null;
}

/**
 * Só estas duas contam como avaliação VIVA — nem enviada, nem cancelada.
 *
 * ⚠️ **Fonte única, e o literal não se reescreve fora daqui.** Ela nasceu depois
 * dos chamadores e o commit que a criou não varreu: até 09/09/2026 o
 * `encerrarCiclo` ainda trazia `['PENDENTE', 'EM_ANDAMENTO']` escrito à mão nas
 * DUAS METADES do mesmo ato — quantas contar para a recusa e quais cancelar na
 * transação. Duas listas iguais hoje, e nada obrigando a continuarem iguais: o
 * dia em que um status novo entrar aqui, a recusa fala de um conjunto e o
 * encerramento cancela outro, **em silêncio e sobre avaliação de gente**.
 *
 * Quem lê este conjunto: `ciclo.service` (encerrar, e a contagem por ciclo da
 * lista) e `painel.service` (o `aFazer` do resumo).
 */
export const STATUS_VIVOS = ['PENDENTE', 'EM_ANDAMENTO'] as const;

function respostasEmTexto(n: number): string {
  if (n === 0) return 'Ela ainda não foi começada — não há resposta nenhuma.';
  return `As ${n} resposta(s) já dadas ficam registradas e não entram na apuração — nada é apagado.`;
}

/**
 * O que acontece com a avaliação de alguém quando o RH o exclui do ciclo.
 * Usada nos DOIS lados: o serviço decide por ela, e a lista de designação a
 * devolve por linha para a tela mostrar o efeito real antes do clique.
 */
export function efeitoDoExcluir(avaliacao: AvaliacaoParaCancelar | null): EfeitoDoCancelamento {
  if (!avaliacao || avaliacao.status === 'CANCELADA') {
    return { acao: 'NADA_A_FAZER', frase: null };
  }

  const quem = avaliacao.avaliadorNome?.trim() || 'o avaliador designado';

  if (avaliacao.status === 'ENVIADA') {
    return {
      acao: 'RECUSAR',
      frase:
        `${quem} já ENVIOU esta avaliação. Excluir agora tiraria do ciclo alguém que já tem nota — ` +
        'e o resultado apurado ficaria órfão. Se é para desfazer mesmo, reabra a avaliação primeiro ' +
        '(é ato do RH_ADMIN, exige motivo e fica registrado) e só depois exclua.',
    };
  }

  return {
    acao: 'CANCELAR',
    frase:
      `Isto cancela a avaliação que está com ${quem}. ` +
      respostasEmTexto(avaliacao.respostas) +
      ' Ela sai da fila dele e deixa de travar o encerramento do ciclo.',
  };
}
