/**
 * ⚠️ Este spec foi REESCRITO em 12/09. O anterior descrevia
 * `GrupoParaPublicacao { titulo, perguntas: [{ peso, alternativas }] }` — forma
 * que a migration do acervo acabou em 11/09 — e passava verde descrevendo um
 * modelo que não existia mais, porque a peça não tinha chamador (§3.1.82).
 *
 * ⭐ As fixtures têm RESTO de propósito (16 ÷ 3, 10 ÷ 3). Fixture redonda não
 * testa arredondamento — o furo mora onde sobra (§3.1.86).
 */
import {
  assertArranjoPublicavel,
  pontuacaoMaximaDoArranjoCompleto,
  somaDeclarada,
  somaDerivada,
  somatorioPorGrupo,
  validarArranjoParaPublicacao,
  type ArranjoParaPublicacao,
} from './publicacao.validator.js';

const ESCALA = [{ valor: 0.3 }, { valor: 0.6 }, { valor: 0.9 }, { valor: 1.2 }];

const questao = (n: number, classificacaoId: string, over = {}) => ({
  perguntaId: `q${n}`,
  codigo: String(n).padStart(3, '0'),
  enunciado: `Questão ${n}`,
  ativa: true,
  classificacaoId,
  ordem: n,
  alternativas: ESCALA,
  ...over,
});

/** 16 ÷ 3 + 10 ÷ 2 + 34 ÷ 1 = 60. O primeiro grupo tem RESTO. */
const arranjoOk: ArranjoParaPublicacao = {
  grupos: [
    { classificacaoId: 'c1', titulo: 'Relacionamento', peso: 16, ordem: 0 },
    { classificacaoId: 'c2', titulo: 'Qualidade', peso: 10, ordem: 1 },
    { classificacaoId: 'c3', titulo: 'Atendimento', peso: 34, ordem: 2 },
  ],
  questoes: [
    questao(1, 'c1'), questao(2, 'c1'), questao(3, 'c1'),
    questao(4, 'c2'), questao(5, 'c2'),
    questao(6, 'c3'),
  ],
};

describe('as duas somas — declarada × derivada', () => {
  it('fecham exatamente mesmo com resto (16 ÷ 3 = 5,34 + 5,33 + 5,33)', () => {
    expect(somaDeclarada(arranjoOk.grupos)).toBe(60);
    expect(somaDerivada(arranjoOk)).toBe(60);
  });

  it('a pontuação máxima é a soma × o maior valor: 60 × 1,2 = 72', () => {
    expect(pontuacaoMaximaDoArranjoCompleto(arranjoOk)).toBeCloseTo(72, 4);
  });

  it('o balanço por classificação fecha 100% e conta as questões', () => {
    const s = somatorioPorGrupo(arranjoOk);
    expect(s.map((g) => g.questoes)).toEqual([3, 2, 1]);
    expect(s.reduce((t, g) => t + g.percentual, 0)).toBeCloseTo(100, 2);
  });
});

describe('publicar', () => {
  it('arranjo completo passa', () => {
    expect(validarArranjoParaPublicacao(arranjoOk)).toEqual([]);
    expect(() => assertArranjoPublicavel(arranjoOk)).not.toThrow();
  });

  /**
   * ⭐⭐ A validação que FALTAVA e é a que pega dinheiro. `pesosDerivados`
   * ignora classificação sem questão de propósito; o peso dela some da conta e
   * os dois números continuam parecendo certos cada um por si.
   */
  it('classificação com peso e SEM questão: recusa, e diz para quanto a soma cairia', () => {
    const p = validarArranjoParaPublicacao({
      ...arranjoOk,
      grupos: [...arranjoOk.grupos, { classificacaoId: 'c9', titulo: 'Vazia', peso: 10, ordem: 3 }],
    });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/"Vazia"/);
    // 70 declarado − 10 do grupo vazio = 60, que é o que a nota usaria.
    expect(p[0]).toMatch(/cairia para 60/);
  });

  it('questão numa classificação sem peso: recusa, dizendo que valeria zero em silêncio', () => {
    const p = validarArranjoParaPublicacao({
      ...arranjoOk,
      questoes: [...arranjoOk.questoes, questao(7, 'c-sem-peso')],
    });
    expect(p.some((x) => /valendo zero, em silêncio/.test(x))).toBe(true);
  });

  it('questão INATIVA no acervo: recusa — publicar com ela contradiz o cadastro', () => {
    const p = validarArranjoParaPublicacao({
      ...arranjoOk,
      questoes: [...arranjoOk.questoes.slice(1), questao(1, 'c1', { ativa: false })],
    });
    expect(p.some((x) => /INATIVA/.test(x))).toBe(true);
  });

  it('peso zero na classificação: manda REMOVER, não zerar', () => {
    const p = validarArranjoParaPublicacao({
      ...arranjoOk,
      grupos: arranjoOk.grupos.map((g) => (g.classificacaoId === 'c2' ? { ...g, peso: 0 } : g)),
    });
    expect(p.some((x) => /remova-a do arranjo em vez de zerar/.test(x))).toBe(true);
  });

  it('questão com menos de duas alternativas: recusa', () => {
    const p = validarArranjoParaPublicacao({
      ...arranjoOk,
      questoes: [...arranjoOk.questoes.slice(1), questao(1, 'c1', { alternativas: [{ valor: 1.2 }] })],
    });
    expect(p.some((x) => /Com menos de duas não mede nada/.test(x))).toBe(true);
  });

  it('arranjo vazio: recusa pelas duas pontas, sem empilhar a conta em cima', () => {
    const p = validarArranjoParaPublicacao({ grupos: [], questoes: [] });
    expect(p).toHaveLength(2);
    expect(p.some((x) => /nenhuma classificação com peso/.test(x))).toBe(true);
    expect(p.some((x) => /nenhuma questão/.test(x))).toBe(true);
    // ⚠️ A conta das somas NÃO entra aqui: enterraria a causa debaixo do sintoma.
    expect(p.some((x) => /soma dos pesos não fecha/.test(x))).toBe(false);
  });

  it('duplicidade de classificação e de questão', () => {
    const p = validarArranjoParaPublicacao({
      grupos: [...arranjoOk.grupos, arranjoOk.grupos[0]],
      questoes: [...arranjoOk.questoes, arranjoOk.questoes[0]],
    });
    expect(p.some((x) => /aparece duas vezes no arranjo/.test(x))).toBe(true);
  });

  it('assertArranjoPublicavel lança com a lista anexa', () => {
    expect(() => assertArranjoPublicavel({ grupos: [], questoes: [] })).toThrow(
      /não pode ser publicada/,
    );
    try {
      assertArranjoPublicavel({ grupos: [], questoes: [] });
    } catch (e) {
      expect((e as { problemas: string[] }).problemas).toHaveLength(2);
    }
  });
});
