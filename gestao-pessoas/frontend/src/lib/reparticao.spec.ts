import { describe, it, expect } from 'vitest';
import { distribuirIgual, percentuaisQueFecham, repartirExato } from './reparticao';

/**
 * ⚠️ Os MESMOS casos do gêmeo do backend (`common/percentual.spec.ts`),
 * de propósito: é o que impede as duas cópias de divergirem em silêncio.
 * Inclusive o caso que reprovou a primeira versão de lá — as três frações
 * iguais em que o float mandava o centésimo para o dono errado.
 */
const soma = (v: number[], c = 2) => Math.round(v.reduce((s, x) => s + x, 0) * 10 ** c) / 10 ** c;

describe('percentuais que fecham em 100', () => {
  it('16 · 10 · 34 fecha em 100, e não em 100,01', () => {
    expect(percentuaisQueFecham([16, 10, 34])).toEqual([26.67, 16.67, 56.66]);
    expect(soma(percentuaisQueFecham([16, 10, 34]))).toBe(100);
  });

  it('três partes iguais: 33,34 + 33,33 + 33,33 — e o centésimo é do PRIMEIRO', () => {
    expect(percentuaisQueFecham([1, 1, 1])).toEqual([33.34, 33.33, 33.33]);
  });

  /** O caso do relatório: 13,33 e 13,33 exibindo 22,22% e 22,21%. */
  it('60 · 13,33 · 13,33 · 13,34 — pesos iguais não recebem percentuais diferentes à toa', () => {
    const p = percentuaisQueFecham([60, 13.33, 13.33, 13.34]);
    expect(soma(p)).toBe(100);
    expect(p[1]).toBe(p[2]);
  });

  it('divisão exata não ganha centavo de ninguém', () => {
    expect(percentuaisQueFecham([25, 25, 25, 25])).toEqual([25, 25, 25, 25]);
  });

  it('total zero e lista vazia não quebram', () => {
    expect(percentuaisQueFecham([0, 0])).toEqual([0, 0]);
    expect(percentuaisQueFecham([])).toEqual([]);
  });
});

describe('repartirExato', () => {
  it('reparte 72 entre pesos com resto, e fecha em 72', () => {
    const v = repartirExato([5.34, 5.33, 5.33, 6, 6], 72, 2);
    expect(soma(v)).toBe(72);
  });

  it('1 casa também fecha', () => {
    expect(repartirExato([1, 1, 1], 100, 1)).toEqual([33.4, 33.3, 33.3]);
  });
});

/**
 * ⚠️ Os MESMOS casos do `distribuir-peso.spec.ts` do backend. Se as duas cópias
 * divergirem, a tela passa a prever um peso que o servidor não grava — e o RH
 * decide sobre um número que não vai existir.
 */
describe('distribuirIgual — o gêmeo do distribuirPeso do backend', () => {
  it('10 ÷ 3 = 3,34 · 3,33 · 3,33 — o resto nas primeiras', () => {
    expect(distribuirIgual(10, 3)).toEqual([3.34, 3.33, 3.33]);
  });

  it('16 ÷ 3 = 5,34 · 5,33 · 5,33 (o Relacionamento do Administrativo)', () => {
    expect(distribuirIgual(16, 3)).toEqual([5.34, 5.33, 5.33]);
  });

  it('40 ÷ 3 = 13,34 · 13,33 · 13,33 (o descartável)', () => {
    expect(distribuirIgual(40, 3)).toEqual([13.34, 13.33, 13.33]);
  });

  it('divisão exata não ganha centavo: 12 ÷ 2', () => {
    expect(distribuirIgual(12, 2)).toEqual([6, 6]);
  });

  it('uma questão leva o peso inteiro', () => {
    expect(distribuirIgual(13, 1)).toEqual([13]);
  });

  it('a soma sempre fecha no total', () => {
    for (const [t, n] of [[16, 3], [10, 3], [9, 7], [60, 14], [5, 3]] as const) {
      const v = distribuirIgual(t, n);
      expect(Math.round(v.reduce((s, x) => s + x, 0) * 100) / 100).toBe(t);
    }
  });

  it('peso zero ou sem questão não quebra', () => {
    expect(distribuirIgual(0, 3)).toEqual([0, 0, 0]);
    expect(distribuirIgual(10, 0)).toEqual([]);
  });
});
