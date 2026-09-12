import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { contagem, data, dataHora, flexao, nota } from './formato';

/**
 * ⭐⭐ O CASO QUE JUSTIFICA `data()` NÃO USAR `Date` — testado com FUSO FORÇADO.
 *
 * `new Date('2026-09-05')` é interpretado como **meia-noite UTC**, e
 * `toLocaleDateString` a oeste de Greenwich devolve **04/09**. A data-base do
 * ciclo é o campo que ancora todo cálculo temporal do módulo: um dia a menos
 * muda tempo de empresa, tempo na função e a janela de treinamento.
 *
 * ⚠️ **Testar com o fuso da máquina não vale.** O CI e a máquina de quem
 * desenvolve podem estar em UTC, e aí o defeito passa aqui e aparece na
 * máquina de quem usa. `process.env.TZ` força o fuso — e o teste roda o pior
 * caso de propósito.
 */
const FUSO_ORIGINAL = process.env.TZ;

describe('data() — recorta a string, nunca passa por Date', () => {
  beforeAll(() => {
    // ⚠️ Unaí/MG. Qualquer fuso a OESTE de Greenwich reproduz.
    process.env.TZ = 'America/Sao_Paulo';
  });
  afterAll(() => {
    process.env.TZ = FUSO_ORIGINAL;
  });

  it('⚠️ o defeito que se evita: `new Date` devolve o dia ANTERIOR', () => {
    // Esta é a implementação ERRADA, escrita de propósito — o caso que falha.
    const pelaDate = new Date('2026-09-05').toLocaleDateString('pt-BR');
    expect(pelaDate).toBe('04/09/2026');
    // E a nossa não erra.
    expect(data('2026-09-05')).toBe('05/09/2026');
  });

  it('ISO com hora também recorta certo', () => {
    expect(data('2026-09-05T00:00:00.000Z')).toBe('05/09/2026');
    expect(data('2026-12-31T23:59:59.000Z')).toBe('31/12/2026');
  });

  it('vazio, nulo e indefinido viram travessão — nunca "Invalid Date"', () => {
    expect(data(null)).toBe('—');
    expect(data(undefined)).toBe('—');
    expect(data('')).toBe('—');
  });

  /** As viradas de mês e de ano são onde o off-by-one aparece. */
  it.each([
    ['2026-01-01', '01/01/2026'],
    ['2026-03-01', '01/03/2026'],
    ['2026-12-31', '31/12/2026'],
  ])('%s → %s', (entrada, esperado) => {
    expect(data(entrada)).toBe(esperado);
  });
});

describe('dataHora() — aqui o Date é de propósito', () => {
  beforeAll(() => {
    process.env.TZ = 'America/Sao_Paulo';
  });
  afterAll(() => {
    process.env.TZ = FUSO_ORIGINAL;
  });

  /**
   * ⚠️ O contrário de `data()`: a hora vem em UTC e tem de aparecer no relógio
   * de quem lê. "Apurado às 13:02" precisa ser 13:02 da sala. O risco do dia
   * pular não existe quando a hora está junto — ela é o que desambigua.
   */
  it('converte para o fuso de quem lê', () => {
    // 12:00 UTC = 09:00 em São Paulo (UTC-3).
    expect(dataHora('2026-09-05T12:00:00.000Z')).toContain('09:00');
  });

  it('data inválida vira travessão, não "Invalid Date"', () => {
    expect(dataHora('nao-e-data')).toBe('—');
    expect(dataHora(null)).toBe('—');
  });
});

describe('nota()', () => {
  it('duas casas e vírgula, sempre', () => {
    expect(nota(63.19)).toBe('63,19');
    expect(nota(100)).toBe('100,00');
    expect(nota(0)).toBe('0,00');
  });
});

/**
 * ⭐⭐ CONCORDÂNCIA — o defeito só aparece no caso de UMA, que é o raro que
 * ninguém testa e que a tela mostra no pior dia.
 */
describe('flexao e contagem', () => {
  it('1 usa o singular; 0 e 2+ usam o plural', () => {
    expect(flexao(1, 'pessoa', 'pessoas')).toBe('pessoa');
    expect(flexao(0, 'pessoa', 'pessoas')).toBe('pessoas');
    expect(flexao(2, 'pessoa', 'pessoas')).toBe('pessoas');
  });

  it('contagem junta o número com a palavra concordada', () => {
    expect(contagem(1, 'avaliação', 'avaliações')).toBe('1 avaliação');
    expect(contagem(0, 'avaliação', 'avaliações')).toBe('0 avaliações');
    expect(contagem(39, 'avaliação', 'avaliações')).toBe('39 avaliações');
  });

  /** ⚠️ Zero é PLURAL em português — "0 pessoa" é o erro que passa despercebido. */
  it('zero é plural', () => {
    expect(contagem(0, 'perfil', 'perfis')).toBe('0 perfis');
  });
});
