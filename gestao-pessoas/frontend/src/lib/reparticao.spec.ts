import { describe, it, expect } from 'vitest';
import { percentuaisQueFecham, repartirExato } from './reparticao';

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
