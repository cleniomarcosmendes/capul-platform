/**
 * ⭐⭐ A ESCALA DAS ALTERNATIVAS — medida do acervo, não inventada.
 *
 * ── O QUE O ACERVO DIZ (medido em 12/09/2026, 15 questões) ──────────────────
 *
 *   Conjuntos de VALORES distintos ....... 1   →  0,3 · 0,6 · 0,9 · 1,2, sem exceção
 *   Alternativas por questão ............. 4   nas 15
 *   Textos de âncora distintos .......... 60 de 60  →  nenhum se repete
 *
 * ⭐ **As duas metades vão em direções opostas, e é isso que desenha o
 * formulário.** O VALOR é sempre o mesmo — então ele é pré-preenchido e não se
 * digita. O TEXTO nunca se repete — então ele é o trabalho real: o padrão é
 * semântico (ruim → insuficiente → bom → excelente) **com as palavras da
 * própria questão**, e é por isso que as alternativas moram na PERGUNTA e não
 * numa tabela de escala compartilhada.
 *
 * ── POR QUE O MAIOR VALOR É INVARIANTE, E NÃO PREFERÊNCIA ───────────────────
 *
 *   pontuação máxima do perfil = Σ (peso da questão × MAIOR valor da questão)
 *
 * Com `maior = 1,2` em todas e Σpesos = 60, a máxima é **72** — o número que a
 * tela do instrumento confere contra o gravado na publicação. Uma questão nova
 * com maior ≠ 1,2 muda a máxima daquele perfil e **desloca toda nota dele**,
 * sem que nada acuse erro: a conta continua fechando, sobre outro denominador.
 * É o 72,03 da §3.1.86 por outra porta.
 *
 * ⚠️ Por isso a escala é **derivada do acervo em tempo de execução**, não
 * escrita como constante. Constante seria uma segunda verdade: no dia em que o
 * acervo mudasse, ela continuaria compilando e passaria a impor a escala de
 * ontem — [[feedback_regra_duplicada_envelhece_errada]]. A constante abaixo é
 * só o fallback do acervo VAZIO, e existe para o primeiro cadastro de um
 * ambiente novo.
 */

/** Só para acervo vazio. Fora disso quem manda é o que está no banco. */
export const ESCALA_INICIAL = [0.3, 0.6, 0.9, 1.2] as const;

export interface QuestaoComAlternativas {
  codigo: string;
  alternativas: readonly { valor: number; ordem: number }[];
}

export interface EscalaDoAcervo {
  /** Os valores, em ordem crescente. */
  valores: number[];
  /** O maior — o que multiplica o peso na pontuação máxima. */
  maiorValor: number;
  /** Todas as questões usam a mesma escala? */
  uniforme: boolean;
  /** Códigos das que fogem. Vazio quando `uniforme`. */
  divergentes: string[];
  /** `true` quando não há questão nenhuma e a escala é a inicial. */
  doFallback: boolean;
}

function assinatura(q: QuestaoComAlternativas): string {
  return [...q.alternativas]
    .sort((a, b) => a.ordem - b.ordem)
    .map((a) => a.valor)
    .join('|');
}

/**
 * A escala vigente. Quando o acervo **não** é uniforme, devolve a do conjunto
 * majoritário e lista quem foge — em vez de escolher em silêncio.
 */
export function escalaDoAcervo(questoes: readonly QuestaoComAlternativas[]): EscalaDoAcervo {
  const comAlternativas = questoes.filter((q) => q.alternativas.length > 0);
  if (comAlternativas.length === 0) {
    const valores = [...ESCALA_INICIAL];
    return {
      valores,
      maiorValor: Math.max(...valores),
      uniforme: true,
      divergentes: [],
      doFallback: true,
    };
  }

  const porAssinatura = new Map<string, QuestaoComAlternativas[]>();
  for (const q of comAlternativas) {
    const a = assinatura(q);
    porAssinatura.set(a, [...(porAssinatura.get(a) ?? []), q]);
  }

  const [vencedora, doVencedor] = [...porAssinatura.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )[0];
  const valores = vencedora.split('|').map(Number);

  return {
    valores,
    maiorValor: Math.max(...valores),
    uniforme: porAssinatura.size === 1,
    divergentes: comAlternativas
      .filter((q) => assinatura(q) !== vencedora)
      .map((q) => q.codigo)
      .sort(),
    doFallback: false,
  };
}

/**
 * ⚠️ Recusa a escala que não é a do acervo, e a frase diz **o que quebra** —
 * não "valor inválido". Quem lê precisa saber que o estrago não é nesta
 * questão, é na pontuação máxima do perfil inteiro.
 */
export function problemasDaEscala(
  valores: readonly number[],
  escala: EscalaDoAcervo,
): string[] {
  const problemas: string[] = [];

  if (!escala.uniforme) {
    problemas.push(
      `O acervo não tem uma escala única: ${escala.divergentes.length} ` +
        `${escala.divergentes.length === 1 ? 'questão foge' : 'questões fogem'} do padrão ` +
        `(${escala.divergentes.join(', ')}). Enquanto isso não for resolvido, criar questão ` +
        'congelaria a escala errada — resolva o acervo antes.',
    );
    return problemas;
  }

  const esperado = escala.valores;
  const iguais =
    valores.length === esperado.length &&
    valores.every((v, i) => Math.abs(v - esperado[i]) < 1e-9);

  if (!iguais) {
    problemas.push(
      `A escala precisa ser ${esperado.map((v) => v.toString().replace('.', ',')).join(' · ')}, ` +
        `como nas outras questões do acervo. Veio ` +
        `${valores.map((v) => v.toString().replace('.', ',')).join(' · ')}. ` +
        'A pontuação máxima de um perfil é a soma dos pesos vezes o MAIOR valor de cada questão — ' +
        `com um maior diferente de ${esperado[esperado.length - 1].toString().replace('.', ',')}, ` +
        'a máxima daquele perfil muda e toda nota dele se desloca, sem nada acusar erro.',
    );
  }

  return problemas;
}
