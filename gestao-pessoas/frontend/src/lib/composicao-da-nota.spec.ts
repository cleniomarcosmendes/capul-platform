import { describe, it, expect } from 'vitest';
import { fracao, repartirPesos } from './composicao-da-nota';

/**
 * ⭐ O quinto módulo da fila que estava atrás do test runner. `repartirPesos`
 * já é coberto por dentro (`reparticao.spec.ts`), mas o contrato desta camada —
 * o que ela faz com lista vazia, com peso zero, e a diferença entre ela e
 * `fracao` — não tinha teste.
 */
describe('repartirPesos — a composição da nota final', () => {
  /** ⚠️ O caso do relatório: dois pesos IGUAIS exibindo percentuais diferentes. */
  it('pesos iguais recebem o mesmo percentual', () => {
    const f = repartirPesos([
      { nome: 'Questionário', peso: 60 },
      { nome: 'A', peso: 13.33 },
      { nome: 'B', peso: 13.33 },
    ]);
    expect(f[1].pct).toBe(f[2].pct);
  });

  /** ⚠️ E a coluna fecha em 100 na precisão em que é EXIBIDA (uma casa). */
  it('a soma dos percentuais fecha em 100,0', () => {
    for (const pesos of [[1, 1, 1], [60, 20, 20], [60, 13.33, 13.33, 13.34]]) {
      const f = repartirPesos(pesos.map((peso, i) => ({ nome: `x${i}`, peso })));
      const soma = Math.round(f.reduce((s, x) => s + x.pct, 0) * 10) / 10;
      expect(soma).toBe(100);
    }
  });

  /**
   * ⚠️ Total zero devolve lista VAZIA, não `NaN`. Sem peso não há composição, e
   * dividir por zero na tela produz "NaN%".
   */
  it('total zero devolve lista vazia', () => {
    expect(repartirPesos([{ nome: 'a', peso: 0 }])).toEqual([]);
    expect(repartirPesos([])).toEqual([]);
  });

  it('preserva os campos originais do item', () => {
    const [f] = repartirPesos([{ nome: 'Questionário', peso: 60 }]);
    expect(f).toMatchObject({ nome: 'Questionário', peso: 60, pct: 100 });
  });
});

/**
 * ⚠️ `fracao` é uma fração ISOLADA — um número sobre um total —, não uma coluna
 * que precisa fechar. Por isso continua sendo divisão direta, e é justamente a
 * distinção que o teste registra: usar uma no lugar da outra é o defeito.
 */
describe('fracao — um número sobre um total, não uma coluna', () => {
  it('60 de 60 é 100,0%', () => {
    expect(fracao(60, 60)).toBe('100,0%');
  });

  it('uma casa e vírgula', () => {
    expect(fracao(13.33, 100)).toBe('13,3%');
  });

  it('total zero vira travessão, não NaN', () => {
    expect(fracao(10, 0)).toBe('—');
  });
});
