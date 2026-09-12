import { escalaDoAcervo, problemasDaEscala, ESCALA_INICIAL } from './escala.js';

const q = (codigo: string, valores: number[]) => ({
  codigo,
  alternativas: valores.map((valor, ordem) => ({ valor, ordem })),
});
const PADRAO = [0.3, 0.6, 0.9, 1.2];

describe('a escala é MEDIDA do acervo, não escrita', () => {
  it('acervo uniforme: devolve a escala e o maior valor', () => {
    const e = escalaDoAcervo([q('004', PADRAO), q('005', PADRAO), q('006', PADRAO)]);
    expect(e.valores).toEqual(PADRAO);
    expect(e.maiorValor).toBe(1.2);
    expect(e.uniforme).toBe(true);
    expect(e.doFallback).toBe(false);
  });

  it('acervo vazio cai no fallback, e diz que caiu', () => {
    const e = escalaDoAcervo([]);
    expect(e.valores).toEqual([...ESCALA_INICIAL]);
    expect(e.doFallback).toBe(true);
  });

  /**
   * ⚠️ Não escolhe em silêncio: devolve a majoritária e LISTA quem foge. Impor
   * uma escala sem saber que o acervo tem duas é congelar a errada.
   */
  it('acervo dividido: aponta os divergentes em vez de escolher calado', () => {
    const e = escalaDoAcervo([q('004', PADRAO), q('005', PADRAO), q('099', [1, 2, 3, 4])]);
    expect(e.uniforme).toBe(false);
    expect(e.divergentes).toEqual(['099']);
    expect(e.valores).toEqual(PADRAO);
  });

  it('a ordem das alternativas não muda a escala — ela é ordenada', () => {
    const fora = { codigo: '004', alternativas: [
      { valor: 1.2, ordem: 3 }, { valor: 0.3, ordem: 0 },
      { valor: 0.9, ordem: 2 }, { valor: 0.6, ordem: 1 },
    ] };
    expect(escalaDoAcervo([fora]).valores).toEqual(PADRAO);
  });
});

describe('⭐⭐ a recusa diz O QUE QUEBRA, não "valor inválido"', () => {
  const escala = escalaDoAcervo([q('004', PADRAO)]);

  it('aceita a escala do acervo', () => {
    expect(problemasDaEscala(PADRAO, escala)).toEqual([]);
  });

  /**
   * O estrago não é nesta questão: pontuação máxima do perfil =
   * Σ(peso × MAIOR valor). Com maior ≠ 1,2 a máxima muda e toda nota do perfil
   * se desloca — e a conta continua fechando, sobre outro denominador.
   */
  it('recusa maior diferente, e explica o deslocamento da nota', () => {
    const p = problemasDaEscala([0.3, 0.6, 0.9, 1.5], escala);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/0,3 · 0,6 · 0,9 · 1,2/);
    expect(p[0]).toMatch(/máxima daquele perfil muda/);
  });

  it('recusa quantidade diferente', () => {
    expect(problemasDaEscala([0.3, 0.6, 0.9], escala)).toHaveLength(1);
  });

  it('acervo não uniforme: recusa QUALQUER escala, e manda resolver o acervo', () => {
    const dividido = escalaDoAcervo([q('004', PADRAO), q('099', [1, 2, 3, 4])]);
    const p = problemasDaEscala(PADRAO, dividido);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/não tem uma escala única/);
    expect(p[0]).toMatch(/099/);
  });
});
