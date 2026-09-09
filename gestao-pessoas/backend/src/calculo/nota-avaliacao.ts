/**
 * NOTA DO QUESTIONÁRIO — calculada no ENVIO da avaliação.
 *
 *   notaAvaliacao = Σ(valor da resposta × peso da pergunta)
 *                 / Σ(maior valor de alternativa × peso da pergunta)  × 100
 *
 * É a nota da avaliação propriamente dita, isolada: sem escolaridade, sem tempo
 * de casa, sem cursos. O avaliador não vê critério cadastral enquanto responde —
 * ver `Avaliacao.notaAvaliacao` no schema.
 *
 * ⚠️ O denominador é CALCULADO, nunca constante. O modelo antigo dividia por 18
 * fixo: acrescentar uma pergunta fazia a nota passar de 100 sem acusar erro.
 * Aqui ele sai do próprio instrumento, e por pergunta — porque o peso agora mora
 * na pergunta, não no grupo.
 */

export interface ItemRespondido {
  perguntaId: string;
  /** Para agrupar a memória de cálculo por grupo no relatório (ADR-RH-02). */
  grupoId?: string;
  peso: number;
  /** Maior valor entre as alternativas DESTA pergunta (a escala é por questão). */
  maiorValor: number;
  /** Valor da alternativa que o avaliador escolheu. */
  valorRespondido: number;
}

export interface NotaCalculada {
  nota: number;
  numerador: number;
  denominador: number;
}

export class AvaliacaoIncompletaError extends Error {
  constructor(readonly perguntasSemResposta: number) {
    super(
      `A avaliação não pode ser enviada — perguntas sem resposta: ${perguntasSemResposta}. ` +
        'Toda pergunta é obrigatória — não existe "não se aplica".',
    );
    this.name = 'AvaliacaoIncompletaError';
  }
}

/**
 * @param itens uma entrada por pergunta do questionário, já com a resposta.
 * @param perguntasSemResposta quantas perguntas do modelo ficaram sem resposta.
 *   Recusar aqui é melhor do que calcular sobre um questionário pela metade: a
 *   nota sairia mais baixa e pareceria desempenho, não formulário incompleto.
 */
export function calcularNotaAvaliacao(
  itens: readonly ItemRespondido[],
  perguntasSemResposta = 0,
): NotaCalculada {
  if (perguntasSemResposta > 0) throw new AvaliacaoIncompletaError(perguntasSemResposta);
  if (itens.length === 0) {
    throw new Error('calcularNotaAvaliacao: questionário sem perguntas — modelo inválido.');
  }

  const numerador = itens.reduce((s, i) => s + i.valorRespondido * i.peso, 0);
  const denominador = itens.reduce((s, i) => s + i.maiorValor * i.peso, 0);

  if (!(denominador > 0)) {
    // A validação de publicação já barra isto; se chegou aqui, é modelo
    // publicado antes da validação existir. Falha alto em vez de dividir por zero.
    throw new Error(
      'calcularNotaAvaliacao: a pontuação máxima do questionário é zero — modelo inválido.',
    );
  }

  return { nota: arredondar((numerador / denominador) * 100), numerador, denominador };
}

/**
 * Nota de um subconjunto de perguntas — é como o relatório mostra a nota POR
 * GRUPO, agrupando por `grupoId` na leitura. Não há tabela de resultado por
 * grupo, e não deve passar a haver: ver docs/ADR-RH-02.
 */
export function notaPorGrupo(
  itens: readonly ItemRespondido[],
): { grupoId: string; nota: number; peso: number }[] {
  const porGrupo = new Map<string, ItemRespondido[]>();
  for (const item of itens) {
    const chave = item.grupoId ?? '(sem grupo)';
    porGrupo.set(chave, [...(porGrupo.get(chave) ?? []), item]);
  }
  return [...porGrupo.entries()].map(([grupoId, doGrupo]) => ({
    grupoId,
    nota: calcularNotaAvaliacao(doGrupo).nota,
    peso: arredondar(doGrupo.reduce((s, i) => s + i.peso, 0)),
  }));
}

/** Duas casas — a mesma precisão de `Decimal(6,2)` no banco. */
export function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}
