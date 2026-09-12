/**
 * ⭐⭐ O TESTE QUE A REGRESSÃO NÃO FAZ — a nota não depende da ORDEM das
 * questões no arranjo.
 *
 * ── POR QUE ELE PRECISOU EXISTIR ────────────────────────────────────────────
 *
 * A regressão contra o Protheus (`scripts/regressao-protheus.ts`) deu
 * **108/108 idênticas** antes e depois de a nota passar a ser calculada no peso
 * exato — e isso **não prova nada sobre este caso**: o ciclo `000006` tinha 18
 * questões de peso IGUAL, e onde os pesos são iguais o exato e o arredondado
 * coincidem. Ela mede a divisão fixa por 18; **a repartição por classificação
 * nasceu depois dela**.
 *
 * Os 17 resultados apurados também não mudaram de conceito — porque as
 * respostas eram **uniformes dentro de cada classificação**, e aí o centavo
 * cancela no numerador. O efeito é real e não se manifestou naqueles dados.
 * **Teria aparecido no primeiro ciclo com respostas variadas — ou seja, no
 * piloto.**
 *
 * ⚠️ Por isso o caso é SINTÉTICO e deliberadamente hostil: respostas diferentes
 * dentro de uma classificação cujo peso tem RESTO. É o único jeito de exercitar
 * o que nenhum dado histórico exercita.
 */
import { calcularNotaAvaliacao, notaPorGrupo, type ItemRespondido } from './nota-avaliacao.js';
import { pesosDerivados } from './peso-derivado.js';

const MAIOR = 1.2;

/** Todas as permutações de um array — poucas questões, custo irrelevante. */
function permutacoes<T>(v: readonly T[]): T[][] {
  if (v.length <= 1) return [[...v]];
  return v.flatMap((x, i) =>
    permutacoes([...v.slice(0, i), ...v.slice(i + 1)]).map((resto) => [x, ...resto]),
  );
}

/**
 * Monta os itens de UMA classificação, com as questões numa ordem dada.
 *
 * ⚠️ A resposta acompanha a QUESTÃO, não a posição — é o ponto do teste: a
 * mesma pessoa respondendo as mesmas coisas, com o questionário montado em
 * outra ordem.
 */
function itens(
  classificacaoId: string,
  pesoDoGrupo: number,
  respostaPorQuestao: Record<string, number>,
  ordem: readonly string[],
): ItemRespondido[] {
  const derivados = pesosDerivados(
    ordem.map((perguntaId, i) => ({ perguntaId, classificacaoId, ordem: i })),
    [{ classificacaoId, peso: pesoDoGrupo }],
  );
  return derivados.map((d) => ({
    perguntaId: d.perguntaId,
    grupoId: classificacaoId,
    peso: d.pesoExato,
    maiorValor: MAIOR,
    valorRespondido: respostaPorQuestao[d.perguntaId],
  }));
}

describe('⭐⭐ a nota do grupo não muda com a ordem das questões', () => {
  /**
   * 16 ÷ 3 = 5,34 / 5,33 / 5,33 — o resto existe. E as respostas são as três
   * DIFERENTES possíveis, que é o que faz o centavo aparecer no numerador.
   */
  const RESPOSTAS_VARIADAS = { q1: 1.2, q2: 0.9, q3: 0.3 };

  it.each([
    ['16 ÷ 3 (Relacionamento no Administrativo)', 16],
    ['40 ÷ 3 (o descartável da varredura)', 40],
    ['10 ÷ 3 (Relacionamento na Loja — o caso do 66,65)', 10],
  ])('%s: as 6 permutações dão a MESMA nota', (_nome, peso) => {
    const notas = permutacoes(['q1', 'q2', 'q3']).map(
      (ordem) => calcularNotaAvaliacao(itens('c1', peso, RESPOSTAS_VARIADAS, ordem)).nota,
    );
    expect(new Set(notas).size).toBe(1);
  });

  /**
   * ⚠️ E o CONTRÁRIO, para o teste não passar por acidente: com o peso
   * ARREDONDADO — o que se usava até 12/09 — as mesmas permutações dão notas
   * DIFERENTES. Se um dia alguém trocar `pesoExato` por `peso` no
   * `itensRespondidos`, este é o teste que grita.
   */
  it('⚠️ com o peso ARREDONDADO as permutações divergem — é o defeito que se consertou', () => {
    const notas = permutacoes(['q1', 'q2', 'q3']).map((ordem) => {
      const derivados = pesosDerivados(
        ordem.map((perguntaId, i) => ({ perguntaId, classificacaoId: 'c1', ordem: i })),
        [{ classificacaoId: 'c1', peso: 10 }],
      );
      return calcularNotaAvaliacao(
        derivados.map((d) => ({
          perguntaId: d.perguntaId,
          grupoId: 'c1',
          peso: d.peso, // ← o arredondado, de propósito
          maiorValor: MAIOR,
          valorRespondido: RESPOSTAS_VARIADAS[d.perguntaId as keyof typeof RESPOSTAS_VARIADAS],
        })),
      ).nota;
    });
    expect(new Set(notas).size).toBeGreaterThan(1);
  });

  /**
   * ⚠️ O caso que os 17 apurados eram, e por isso não acusaram nada: respostas
   * IGUAIS dentro da classificação. Passa com os dois pesos — o que mostra que
   * dado uniforme não distingue as duas implementações.
   */
  it('respostas uniformes não distinguem exato de arredondado — por isso os 17 não mudaram', () => {
    const iguais = { q1: 0.9, q2: 0.9, q3: 0.9 };
    const comArredondado = permutacoes(['q1', 'q2', 'q3']).map((ordem) => {
      const d = pesosDerivados(
        ordem.map((perguntaId, i) => ({ perguntaId, classificacaoId: 'c1', ordem: i })),
        [{ classificacaoId: 'c1', peso: 10 }],
      );
      return calcularNotaAvaliacao(
        d.map((x) => ({
          perguntaId: x.perguntaId, grupoId: 'c1', peso: x.peso,
          maiorValor: MAIOR, valorRespondido: iguais[x.perguntaId as keyof typeof iguais],
        })),
      ).nota;
    });
    expect(new Set(comArredondado).size).toBe(1);
  });

  /** O valor certo é o da divisão exata, não o de nenhuma das duas pontas. */
  it('10 ÷ 3 com 0,9 / 0,9 / 0,6 dá 66,67 — nem 66,65, nem 66,68', () => {
    const n = calcularNotaAvaliacao(
      itens('c1', 10, { q1: 0.9, q2: 0.9, q3: 0.6 }, ['q1', 'q2', 'q3']),
    ).nota;
    expect(n).toBe(66.67);
  });
});

describe('⭐ e a nota do QUESTIONÁRIO inteiro também não muda', () => {
  /** Operação de Loja: 7 classificações, 60 no total, três delas com resto. */
  const PERFIL: [string, number, string[]][] = [
    ['assid', 9, ['a1', 'a2']],
    ['relac', 10, ['r1', 'r2', 'r3']],
    ['inic', 9, ['i1', 'i2', 'i3']],
    ['qual', 9, ['u1', 'u2', 'u3']],
    ['atend', 13, ['t1']],
    ['conh', 5, ['c1']],
    ['metas', 5, ['m1']],
  ];
  /** Respostas variadas de propósito — nenhuma classificação uniforme. */
  const R: Record<string, number> = {
    a1: 1.2, a2: 0.3, r1: 1.2, r2: 0.9, r3: 0.3, i1: 0.6, i2: 1.2, i3: 0.9,
    u1: 0.3, u2: 0.9, u3: 1.2, t1: 0.9, c1: 0.6, m1: 1.2,
  };

  const montar = (inverter: boolean) =>
    PERFIL.flatMap(([c, peso, qs]) => itens(c, peso, R, inverter ? [...qs].reverse() : qs));

  it('a nota final é a mesma com o arranjo montado ao contrário', () => {
    expect(calcularNotaAvaliacao(montar(false)).nota).toBe(calcularNotaAvaliacao(montar(true)).nota);
  });

  it('e cada nota POR CLASSIFICAÇÃO também', () => {
    const chave = (v: { grupoId: string; nota: number }[]) =>
      v.map((g) => `${g.grupoId}:${g.nota}`).sort().join('|');
    expect(chave(notaPorGrupo(montar(false)))).toBe(chave(notaPorGrupo(montar(true))));
  });
});
