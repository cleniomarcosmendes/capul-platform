import { urlPorCanal } from '../urlPorCanal';

describe('urlPorCanal', () => {
  it('mapeia o canal production p/ a URL de produção', () => {
    expect(urlPorCanal('production')).toBe('https://platform.capul.com.br');
  });
  it('mapeia o canal homolog p/ a URL de homologação', () => {
    expect(urlPorCanal('homolog')).toBe('https://platformhlg.capul.com.br');
  });
  it('devolve undefined p/ canal nulo (dev build / Expo Go)', () => {
    expect(urlPorCanal(null)).toBeUndefined();
    expect(urlPorCanal(undefined)).toBeUndefined();
  });
  it('devolve undefined p/ canal desconhecido (não cai em produção por engano)', () => {
    expect(urlPorCanal('qualquer-coisa')).toBeUndefined();
  });
});
