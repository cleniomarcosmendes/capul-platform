import AsyncStorage from '@react-native-async-storage/async-storage';
import { comCache, lerCache, gravarCache, limparCacheDeLeitura } from '../cacheLeitura';

/**
 * A regra que estes testes protegem: **a rede ATUALIZA a tela; ela não é
 * condição para a tela existir.**
 *
 * Relatado pelo Clenio em 18/08, testando em homologação: abriu a carga com
 * WiFi, desligou o WiFi, tocou na carga de novo → "não localizou entrega". A
 * tela remonta e o estado morre; sem cópia no aparelho, não havia o que mostrar.
 *
 * O segundo teste é o contrapeso e importa tanto quanto: erro COM resposta do
 * servidor (403/404) tem de subir. Cair no cache aí faria o app mostrar uma
 * rota que já não é daquele motorista.
 */

jest.mock('@react-native-async-storage/async-storage', () => {
  const loja = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => loja.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => { loja.set(k, v); }),
      removeItem: jest.fn(async (k: string) => { loja.delete(k); }),
      getAllKeys: jest.fn(async () => [...loja.keys()]),
      multiRemove: jest.fn(async (ks: string[]) => { ks.forEach((k) => loja.delete(k)); }),
      __loja: loja,
    },
  };
});

/** Erro sem `response` = axios sem resposta HTTP (sem sinal / timeout). */
const semRede = () => Object.assign(new Error('Network Error'), { isAxiosError: true, response: undefined });
/** O servidor respondeu e recusou. */
const httpErro = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status } });

beforeEach(async () => {
  await limparCacheDeLeitura();
});

describe('comCache', () => {
  it('rede OK: devolve o dado do servidor e guarda no aparelho', async () => {
    const r = await comCache('viagem:1', async () => ({ numero: 7 }));
    expect(r).toMatchObject({ dado: { numero: 7 }, deCache: false });
    expect((await lerCache<{ numero: number }>('viagem:1'))?.dado).toEqual({ numero: 7 });
  });

  it('SEM REDE com cache: devolve o do aparelho em vez de estourar', async () => {
    await comCache('viagem:1', async () => ({ numero: 7 }));
    const r = await comCache('viagem:1', async () => { throw semRede(); });
    expect(r.dado).toEqual({ numero: 7 });
    expect(r.deCache).toBe(true);
    expect(r.atualizadoEm).toBeGreaterThan(0);
  });

  it('SEM REDE e sem cache: estoura — a tela não tem mesmo o que mostrar', async () => {
    await expect(comCache('viagem:nova', async () => { throw semRede(); })).rejects.toThrow();
  });

  it('erro HTTP NÃO cai no cache: o servidor falou, e a tela não pode mentir', async () => {
    await comCache('viagem:1', async () => ({ numero: 7 }));
    await expect(comCache('viagem:1', async () => { throw httpErro(403); })).rejects.toMatchObject({
      response: { status: 403 },
    });
  });

  it('aoCache pinta a tela na hora, antes da rede responder', async () => {
    await comCache('viagem:1', async () => ({ numero: 7 }));
    const pintou: number[] = [];
    const r = await comCache(
      'viagem:1',
      // Rede lenta: o disco chega primeiro.
      () => new Promise((ok) => setTimeout(() => ok({ numero: 8 }), 20)),
      { aoCache: (c) => pintou.push((c.dado as { numero: number }).numero) },
    );
    expect(pintou).toEqual([7]);   // mostrou o antigo enquanto esperava
    expect(r.dado).toEqual({ numero: 8 }); // e terminou com o novo
  });

  it('rede rápida NÃO pisca o dado velho por cima', async () => {
    await comCache('viagem:1', async () => ({ numero: 7 }));
    const pintou: number[] = [];
    await comCache('viagem:1', async () => ({ numero: 8 }), { aoCache: () => pintou.push(1) });
    expect(pintou).toEqual([]);
  });
});

describe('limparCacheDeLeitura', () => {
  it('apaga o cache na troca de usuário — sem tocar nas filas', async () => {
    await gravarCache('viagem:1', { numero: 7 });
    // Chave de fila, com outro prefixo: tem de sobreviver.
    await AsyncStorage.setItem('capul_fila_baixas', '[{"id":"x"}]');
    await limparCacheDeLeitura();
    expect(await lerCache('viagem:1')).toBeNull();
    expect(await AsyncStorage.getItem('capul_fila_baixas')).toBe('[{"id":"x"}]');
  });
});
