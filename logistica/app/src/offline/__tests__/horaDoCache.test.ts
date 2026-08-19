import { horaDoCache } from '../cacheLeitura';

/**
 * A regra: **um dado de outro dia não pode parecer de hoje.**
 *
 * O supervisor de RDV roda vários dias fora, entrando e saindo da rede móvel.
 * Com só "de 08:15" no rótulo, um planejamento de três dias atrás lê como "desta
 * manhã", e ele decide o roteiro em cima de um retrato velho sem saber.
 */

const HOJE_10H = new Date(2026, 7, 19, 10, 30).getTime();      // 19/08/2026
const HOJE_08H = new Date(2026, 7, 19, 8, 15).getTime();
const ONTEM = new Date(2026, 7, 18, 16, 40).getTime();
const TRES_DIAS = new Date(2026, 7, 16, 9, 12).getTime();

beforeAll(() => { jest.useFakeTimers().setSystemTime(HOJE_10H); });
afterAll(() => { jest.useRealTimers(); });

it('hoje: só a hora — a data seria ruído', () => {
  expect(horaDoCache(HOJE_08H)).toBe('08:15');
});

it('ontem: diz "ontem"', () => {
  expect(horaDoCache(ONTEM)).toBe('ontem, 16:40');
});

it('dias atrás: mostra a DATA', () => {
  expect(horaDoCache(TRES_DIAS)).toBe('16/08, 09:12');
});

it('sem cache: rótulo vazio (a faixa some com o "de")', () => {
  expect(horaDoCache(null)).toBe('');
});
