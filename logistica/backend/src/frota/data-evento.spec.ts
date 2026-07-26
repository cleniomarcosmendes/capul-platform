import { resolverDataEvento, MAX_RETRO_DIAS } from './data-evento';

// ⭐ Cenário do Clenio (26/07): o condutor saiu às pressas sem registrar e lança
// saída+retorno na volta. Sem data informada, a viagem ficava com duração de
// minutos e caía no dia errado quando a saída fora na véspera.
// Campo de data aberto é porta de erro de digitação e de maquiagem de jornada —
// por isso as travas têm teste próprio.

const AGORA = new Date('2026-07-26T15:00:00.000Z');
const iso = (d: string) => new Date(d).toISOString();

describe('resolverDataEvento', () => {
  it('sem data informada, vale o instante do registro', () => {
    expect(resolverDataEvento(undefined, 'saída', AGORA)).toBe(AGORA);
  });

  it('aceita a data informada (lançamento retroativo no mesmo dia)', () => {
    const r = resolverDataEvento(iso('2026-07-26T07:30:00.000Z'), 'saída', AGORA);
    expect(r.toISOString()).toBe('2026-07-26T07:30:00.000Z');
  });

  it('aceita a véspera — é o caso que motivou tudo', () => {
    const r = resolverDataEvento(iso('2026-07-25T18:00:00.000Z'), 'saída', AGORA);
    expect(r.toISOString()).toBe('2026-07-25T18:00:00.000Z');
  });

  it('recusa data no futuro', () => {
    expect(() => resolverDataEvento(iso('2026-07-26T18:00:00.000Z'), 'saída', AGORA))
      .toThrow(/não pode ser no futuro/i);
  });

  it('tolera relógio do celular adiantado alguns minutos', () => {
    // 5 min à frente: dentro da tolerância de 10 min, não é "futuro".
    const r = resolverDataEvento(iso('2026-07-26T15:05:00.000Z'), 'saída', AGORA);
    expect(r.toISOString()).toBe('2026-07-26T15:05:00.000Z');
  });

  it('recusa relógio adiantado além da tolerância', () => {
    expect(() => resolverDataEvento(iso('2026-07-26T15:30:00.000Z'), 'saída', AGORA))
      .toThrow(/futuro/i);
  });

  it(`recusa retroativo além de ${MAX_RETRO_DIAS} dias (pega ano digitado errado)`, () => {
    // O erro clássico: digitou 2025 em vez de 2026.
    expect(() => resolverDataEvento(iso('2025-07-26T07:00:00.000Z'), 'saída', AGORA))
      .toThrow(new RegExp(`mais de ${MAX_RETRO_DIAS} dias`, 'i'));
  });

  it('aceita exatamente dentro do teto retroativo', () => {
    const limite = new Date(AGORA.getTime() - (MAX_RETRO_DIAS * 24 * 60 * 60 * 1000) + 60_000);
    expect(resolverDataEvento(limite.toISOString(), 'saída', AGORA).toISOString())
      .toBe(limite.toISOString());
  });

  it('recusa data ilegível', () => {
    expect(() => resolverDataEvento('não é data', 'chegada', AGORA)).toThrow(/inválida/i);
  });

  it('usa o rótulo do evento na mensagem (saída x chegada)', () => {
    expect(() => resolverDataEvento(iso('2026-07-26T18:00:00.000Z'), 'chegada', AGORA))
      .toThrow(/chegada/i);
  });
});
