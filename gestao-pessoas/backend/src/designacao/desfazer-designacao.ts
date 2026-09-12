/**
 * ⭐⭐ DESFAZER A DESIGNAÇÃO — tirar o avaliador, sem tirar a pessoa do ciclo.
 *
 * **Por que existe (12/09).** Designar a pessoa errada é o erro mais comum de
 * uma tela de designação manual, e até aqui o conserto era T.I. no banco — o
 * oposto do que este módulo existe para fazer. As 18 designações indevidas do
 * ensaio saíram por SQL, porque não havia rota.
 *
 * ⚠️ **NÃO é o mesmo que EXCLUIR do ciclo, e a diferença é o que se declara:**
 *
 *   Excluir do ciclo   diz *"esta pessoa não é avaliada neste ciclo"* — decisão
 *                      do RH, com justificativa, que fica no histórico. Cancela
 *                      a avaliação e a mantém como registro.
 *   Desfazer           diz *"o avaliador estava errado"*. A pessoa continua no
 *                      ciclo, elegível, esperando avaliador. A avaliação some
 *                      porque nunca deveria ter existido daquele jeito.
 *
 * Usar exclusão para consertar designação registraria uma decisão que ninguém
 * tomou — e é o que teria acontecido com as 18 se ninguém olhasse.
 *
 * ── As guardas, e o motivo de cada uma ──────────────────────────────────────
 *
 * ⚠️ **Só o que não tem TRABALHO dentro.** Resposta é julgamento de alguém sobre
 * outra pessoa: apagar em silêncio é destruir trabalho, e o caminho para isso é
 * outro (reabrir, que exige motivo e fica registrado). ENVIADA nem se discute —
 * há nota, e pode haver resultado apurado apontando para ela.
 *
 * ⚠️ **CANCELADA não se desfaz por aqui.** Ela é registro de uma decisão do RH;
 * apagá-la sumiria com o motivo. Quem quer revertê-la usa o Incluir.
 */

export type AcaoDoDesfazer = 'DESFAZER' | 'NADA_A_FAZER' | 'RECUSAR';

export interface EfeitoDoDesfazer {
  acao: AcaoDoDesfazer;
  /** Frase pronta — de aviso quando DESFAZER, de recusa quando RECUSAR. */
  frase: string | null;
}

export interface AvaliacaoParaDesfazer {
  status: string;
  respostas: number;
  avaliadorNome?: string | null;
}

/**
 * Decide **e** escreve a frase, como `efeitoDoExcluir` e `efeitoDeDesignar`: a
 * lista da tela e a recusa da API saem do mesmo lugar, então não discordam.
 */
export function efeitoDeDesfazer(avaliacao: AvaliacaoParaDesfazer | null): EfeitoDoDesfazer {
  if (!avaliacao) {
    return { acao: 'NADA_A_FAZER', frase: null };
  }

  const quem = avaliacao.avaliadorNome?.trim() || 'o avaliador designado';

  if (avaliacao.status === 'CANCELADA') {
    return {
      acao: 'RECUSAR',
      frase:
        'Esta avaliação está CANCELADA — ela é o registro de uma decisão do RH, com motivo. ' +
        'Desfazer a designação apagaria esse registro. Para trazer a pessoa de volta ao ciclo, ' +
        'use o Incluir na Designação.',
    };
  }

  if (avaliacao.status === 'ENVIADA') {
    return {
      acao: 'RECUSAR',
      frase:
        `${quem} já ENVIOU esta avaliação — há nota, e pode haver resultado apurado sobre ela. ` +
        'Se o avaliador estava errado, o caminho é reabrir a avaliação (ato do RH_ADMIN, com ' +
        'motivo registrado) e designar de novo.',
    };
  }

  if (avaliacao.respostas > 0) {
    return {
      acao: 'RECUSAR',
      frase:
        // Número em posição de rótulo, no fim — nenhuma palavra concorda com ele.
        `Esta avaliação já foi começada por ${quem}, e desfazer apagaria o que ele respondeu. ` +
        'Se o avaliador estava errado, troque o avaliador (a designação substitui e avisa) em ' +
        `vez de desfazer. Respostas já dadas: ${avaliacao.respostas}.`,
    };
  }

  return {
    acao: 'DESFAZER',
    frase:
      `Isto tira a avaliação da fila de ${quem}. A pessoa CONTINUA no ciclo, elegível e sem ` +
      'avaliador — vai aparecer em "sem avaliador" até alguém ser designado. ' +
      'Nada é apagado além da designação: não há resposta nenhuma.',
  };
}
