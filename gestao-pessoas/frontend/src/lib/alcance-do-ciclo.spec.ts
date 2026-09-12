import { describe, expect, it } from 'vitest';
import { leituraDoAlcance } from './alcance-do-ciclo';

/** Atalho: só o que muda entre os casos. */
const ler = (ehRecorte: boolean, cicloFechado = false) =>
  leituraDoAlcance({ total: 664, ehRecorte, cicloFechado, contagem: '664 pessoas' });

describe('a leitura de quem está fora de todas as aplicações', () => {
  it('ciclo da empresa inteira: é PENDÊNCIA, e diz o que fazer', () => {
    const l = ler(false);
    expect(l.tom).toBe('pendencia');
    expect(l.titulo).toBe('664 pessoas fora de TODAS as aplicações deste ciclo.');
    expect(l.explicacao).toContain('Monte o público que falta');
  });

  it('⭐ ciclo declarado como recorte: MESMO número, leitura oposta', () => {
    const l = ler(true);
    expect(l.tom).toBe('informacao');
    expect(l.titulo).toBe('664 pessoas fora do recorte.');
    expect(l.explicacao).toContain('alcança só parte da empresa');
    // O que o piloto NÃO pode continuar dizendo: que há público a montar.
    expect(l.explicacao).not.toContain('Monte o público');
  });

  it('⭐ o número não muda — o que muda é o que ele significa', () => {
    // A prova de que a coluna não filtra ninguém: o titulo dos dois carrega a
    // mesma contagem. Se um dia a flag passar a esconder gente, isto quebra.
    expect(ler(false).titulo).toContain('664 pessoas');
    expect(ler(true).titulo).toContain('664 pessoas');
  });

  it('ciclo encerrado troca a instrução, não o tom', () => {
    const l = ler(false, true);
    expect(l.tom).toBe('pendencia');
    expect(l.explicacao).toContain('reabra o ciclo primeiro');
    expect(l.explicacao).not.toContain('Monte o público que falta');
  });

  it('⚠️ encerrado + recorte: o encerramento NÃO ressuscita a pendência', () => {
    // Ordem das checagens: `ehRecorte` decide primeiro. Invertida, um piloto
    // encerrado voltaria a pedir "reabra o ciclo" para incluir gente que ele
    // nunca quis alcançar.
    const l = ler(true, true);
    expect(l.tom).toBe('informacao');
    expect(l.explicacao).not.toContain('reabra o ciclo');
  });

  it('o botão oferece sempre o ato OPOSTO ao estado atual', () => {
    expect(ler(false).rotuloDoBotao).toBe('Este ciclo alcança só parte da empresa');
    expect(ler(true).rotuloDoBotao).toBe('Este ciclo deveria alcançar a empresa inteira');
  });
});
