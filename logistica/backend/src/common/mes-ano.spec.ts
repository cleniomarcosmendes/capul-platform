import { BadRequestException } from '@nestjs/common';
import { mesAnoDoFiltro } from './mes-ano';

/**
 * O que estes testes protegem: **indicador que mente é pior que indicador que falha.**
 *
 * `mes=abc` derrubava o painel com 500 (Prisma recusa a data inválida) e `mes=13`/`99`
 * não davam erro nenhum — o JS rola a data para o ano seguinte e a tela mostrava números
 * de um período errado, em silêncio. Achado na varredura pré-HLG de 23/08.
 */
describe('mesAnoDoFiltro', () => {
  it('mês por extenso (abc) → 400, não 500', () => {
    expect(() => mesAnoDoFiltro('abc', '2026')).toThrow(BadRequestException);
    expect(() => mesAnoDoFiltro('abc', '2026')).toThrow(/Mês inválido/);
  });

  it('mês fora de 1..12 → 400 (antes devolvia número de OUTRO período, calado)', () => {
    for (const m of ['0', '13', '99', '-1']) {
      expect(() => mesAnoDoFiltro(m, '2026')).toThrow(/Mês inválido/);
    }
  });

  it('mês decimal não passa por inteiro', () => {
    expect(() => mesAnoDoFiltro('8.5', '2026')).toThrow(/Mês inválido/);
  });

  it('ano absurdo → 400', () => {
    expect(() => mesAnoDoFiltro('8', '20260')).toThrow(/Ano inválido/);
    expect(() => mesAnoDoFiltro('8', 'abc')).toThrow(/Ano inválido/);
  });

  it('ausente = mês/ano corrente (comportamento de sempre)', () => {
    const agora = new Date();
    expect(mesAnoDoFiltro()).toEqual({ m: agora.getUTCMonth() + 1, a: agora.getUTCFullYear() });
    expect(mesAnoDoFiltro('', '')).toEqual({ m: agora.getUTCMonth() + 1, a: agora.getUTCFullYear() });
  });

  it('válido passa', () => {
    expect(mesAnoDoFiltro('1', '2026')).toEqual({ m: 1, a: 2026 });
    expect(mesAnoDoFiltro('12', '2100')).toEqual({ m: 12, a: 2100 });
  });
});
