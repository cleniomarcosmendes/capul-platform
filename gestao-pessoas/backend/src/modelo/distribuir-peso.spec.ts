import { distribuirPeso } from './distribuir-peso.js';

const soma = (v: number[]) => Number(v.reduce((s, x) => s + x, 0).toFixed(10));

describe('distribuirPeso', () => {
  it('divide exato quando dá', () => {
    expect(distribuirPeso(9, 2)).toEqual([4.5, 4.5]);
    expect(distribuirPeso(12, 3)).toEqual([4, 4, 4]);
  });

  it('⭐ preserva o TOTAL do grupo quando não divide exato', () => {
    // Divisão simples daria 3,3333333… e a Arielly veria dízima na primeira
    // tela. O resto vai para as primeiras perguntas.
    expect(distribuirPeso(10, 3)).toEqual([3.34, 3.33, 3.33]);
    expect(soma(distribuirPeso(10, 3))).toBe(10);
  });

  it('soma exatamente o total para todos os pesos que o seed usa', () => {
    for (const total of [3, 5, 9, 10, 12, 13, 16, 25]) {
      for (const n of [1, 2, 3, 4, 5]) {
        expect(soma(distribuirPeso(total, n))).toBe(total);
      }
    }
  });

  it('nunca passa de duas casas decimais', () => {
    for (const total of [10, 13, 16, 25]) {
      for (const n of [3, 6, 7]) {
        for (const peso of distribuirPeso(total, n)) {
          expect(Number(peso.toFixed(2))).toBe(peso);
        }
      }
    }
  });

  it('grupo de uma pergunta só leva o peso inteiro', () => {
    expect(distribuirPeso(13, 1)).toEqual([13]);
  });

  it('recusa entrada sem sentido em vez de devolver lista estranha', () => {
    expect(() => distribuirPeso(10, 0)).toThrow(/quantidade/);
    expect(() => distribuirPeso(0, 3)).toThrow(/total/);
    expect(() => distribuirPeso(-5, 3)).toThrow(/total/);
  });
});
