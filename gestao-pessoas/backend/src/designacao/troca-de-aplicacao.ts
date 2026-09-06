/**
 * A REGRA DA TROCA DE APLICAÇÃO — pura, e num lugar só.
 *
 * `Resposta` aponta para as perguntas de um modelo; `Avaliacao.aplicacaoId` é
 * quem decide de qual `ModeloVersao` elas são lidas. Trocar a aplicação deixa
 * as respostas órfãs — e, se a avaliação já foi enviada, a apuração combina a
 * `notaAvaliacao` CONGELADA do modelo antigo com o `pesoAvaliacao` e os
 * `AplicacaoCriterio` da aplicação nova. Sai um número diferente, sem exceção,
 * sem alerta, e internamente coerente.
 *
 * ⭐ Mora aqui, isolado, porque tem DOIS chamadores com formas opostas:
 *   `designar()` — um por vez, e a recusa é uma exceção que chega à tela;
 *   a cópia do cadastro — mil de uma vez, e a recusa não pode abortar o lote:
 *   ela vira uma linha do relatório e o resto segue.
 *
 * ⚠️ Se cada um implementasse a regra do seu jeito, a segunda cópia envelheceria
 * errada — é o defeito que a Logística já pagou duas vezes. Aqui a decisão é
 * uma função só; o que muda é o que cada chamador faz com ela.
 *
 * A regra: **nada de valor se perde numa troca.**
 */

export type MotivoDaRecusa = 'AVALIACAO_ENVIADA' | 'TEM_RESPOSTAS';

export interface EstadoDaAvaliacao {
  status: string;
  /** Quantas respostas já estão gravadas nela. */
  respostas: number;
}

export interface DecisaoDaTroca {
  permitida: boolean;
  motivo: MotivoDaRecusa | null;
}

export function decidirTrocaDeAplicacao(estado: EstadoDaAvaliacao): DecisaoDaTroca {
  // ENVIADA recusa SEMPRE, mesmo com zero respostas: a nota congelada é o valor.
  if (estado.status === 'ENVIADA') return { permitida: false, motivo: 'AVALIACAO_ENVIADA' };
  if (estado.respostas > 0) return { permitida: false, motivo: 'TEM_RESPOSTAS' };
  return { permitida: true, motivo: null };
}

/** A frase que a pessoa lê — a mesma na exceção e no relatório do lote. */
export function mensagemDaRecusa(
  motivo: MotivoDaRecusa,
  contexto: { nomeDoAvaliado: string; aplicacaoAtual: string; respostas: number },
): string {
  if (motivo === 'AVALIACAO_ENVIADA') {
    return (
      `${contexto.nomeDoAvaliado} já teve a avaliação ENVIADA na aplicação ` +
      `"${contexto.aplicacaoAtual}", e a nota do questionário está congelada nela. Mudar de ` +
      'aplicação agora faria a apuração combinar essa nota com os pesos e critérios de outro ' +
      'questionário, e o resultado sairia errado sem acusar erro. Para mudar de aplicação, ' +
      'peça a reabertura ao RH e apague as respostas antes.'
    );
  }
  return (
    `${contexto.nomeDoAvaliado} já tem ${contexto.respostas} resposta(s) gravada(s) na ` +
    `aplicação "${contexto.aplicacaoAtual}". As respostas pertencem às perguntas daquele ` +
    'questionário e não têm equivalente no outro — trocar a aplicação as deixaria órfãs e a ' +
    'nota sairia errada. Apague as respostas antes de mudar de aplicação.'
  );
}
