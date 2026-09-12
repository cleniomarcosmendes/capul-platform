import { percentuaisQueFecham, repartirExato } from './percentual.js';

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

describe('repartirExato — a função geral', () => {
  const soma = (v: number[], c = 2) =>
    Math.round(v.reduce((s, x) => s + x, 0) * 10 ** c) / 10 ** c;

  /**
   * ⭐ O caso do 2.12 da varredura: a coluna "vale até" por questão somava
   * 72,01 contra máxima 72. `peso × 1,2` arredondado por item — 5,34 × 1,2 =
   * 6,408 → 6,41 — e três de um grupo somam 19,23 onde o grupo vale 19,2.
   */
  it('reparte 72 entre pesos com resto, e a coluna fecha em 72', () => {
    const pesos = [5.34, 5.33, 5.33, 5.34, 5.33, 5.33, 5.34, 5.33, 5.33, 6, 6];
    const v = repartirExato(pesos, 72, 2);
    expect(soma(v)).toBe(72);
    expect(v).toHaveLength(11);
  });

  it('percentuaisQueFecham é repartirExato(·, 100)', () => {
    expect(percentuaisQueFecham([16, 10, 34])).toEqual(repartirExato([16, 10, 34], 100, 2));
  });

  it('casas variáveis: 1 casa também fecha', () => {
    const v = repartirExato([1, 1, 1], 100, 1);
    expect(soma(v, 1)).toBe(100);
    expect(v).toEqual([33.4, 33.3, 33.3]);
  });

  it('total zero, partes zero e lista vazia não quebram', () => {
    expect(repartirExato([1, 1], 0)).toEqual([0, 0]);
    expect(repartirExato([0, 0], 100)).toEqual([0, 0]);
    expect(repartirExato([], 100)).toEqual([]);
  });
});
