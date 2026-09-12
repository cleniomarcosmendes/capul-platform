import { percentuaisQueFecham } from './percentual.js';

const soma = (v: number[]) => Math.round(v.reduce((s, x) => s + x, 0) * 100) / 100;

describe('percentuais que fecham em 100', () => {
  /** O caso que criou a função: 16/10/34 sobre 60 dava 100,01. */
  it('16 · 10 · 34 fecha em 100, e não em 100,01', () => {
    const p = percentuaisQueFecham([16, 10, 34]);
    expect(soma(p)).toBe(100);
    expect(p).toEqual([26.67, 16.67, 56.66]);
  });

  it('três partes iguais: 33,34 + 33,33 + 33,33', () => {
    const p = percentuaisQueFecham([1, 1, 1]);
    expect(soma(p)).toBe(100);
    expect(p).toEqual([33.34, 33.33, 33.33]);
  });

  it('sete partes iguais — o caso com mais resto', () => {
    expect(soma(percentuaisQueFecham([1, 1, 1, 1, 1, 1, 1]))).toBe(100);
  });

  it('divisão exata não ganha centavo de ninguém', () => {
    expect(percentuaisQueFecham([25, 25, 25, 25])).toEqual([25, 25, 25, 25]);
  });

  it('uma parte só leva 100', () => {
    expect(percentuaisQueFecham([7])).toEqual([100]);
  });

  it('total zero devolve zeros, sem dividir por zero', () => {
    expect(percentuaisQueFecham([0, 0])).toEqual([0, 0]);
    expect(percentuaisQueFecham([])).toEqual([]);
  });

  /** ⚠️ Duas leituras do mesmo arranjo têm de dar a MESMA tabela. */
  it('empate de fração é resolvido pela ordem, não por acaso', () => {
    expect(percentuaisQueFecham([1, 1, 1])).toEqual(percentuaisQueFecham([1, 1, 1]));
    // O primeiro do empate é quem leva.
    expect(percentuaisQueFecham([1, 1, 1])[0]).toBeGreaterThan(percentuaisQueFecham([1, 1, 1])[1]);
  });

  /** Os pesos reais do Administrativo: 4 classificações somando 60. */
  it('o perfil Administrativo (16 · 16 · 16 · 12) fecha', () => {
    const p = percentuaisQueFecham([16, 16, 16, 12]);
    expect(soma(p)).toBe(100);
  });
});
