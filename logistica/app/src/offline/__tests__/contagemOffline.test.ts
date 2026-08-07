import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  registrarContagemLocal,
  contagensPendentes,
  contarPendentes,
  salvarPacote,
  lerPacote,
  descartarPacote,
} from '../contagemOffline';

/**
 * A regra que estes testes protegem: **contagem é ESTADO, não evento.**
 *
 * As outras cinco filas do app (baixa, frota, despesa…) são logs append —
 * cada entrada é um fato novo. Se alguém copiar aquele padrão para cá por
 * reflexo, contar 10 e corrigir para 12 vira DUAS pendências; subindo fora de
 * ordem, o servidor grava 10. O mapa por item é o que impede isso.
 */

// `contagemOffline` importa o cliente HTTP para o sincronizar; aqui só o
// ARMAZENAMENTO é exercitado, e `api/config` puxa expo-updates/expo-constants,
// que não existem no ambiente do jest. Mock evita arrastar o runtime do Expo
// para um teste que é de lógica pura.
jest.mock('../../api/config', () => ({ INVENTARIO_BASE: 'http://teste/api/v1' }));
jest.mock('../../api/client', () => ({ api: { post: jest.fn() } }));

// AsyncStorage em memória — o mock oficial da lib não vem com o preset daqui.
jest.mock('@react-native-async-storage/async-storage', () => {
  const loja = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => loja.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => { loja.set(k, v); }),
      multiRemove: jest.fn(async (ks: string[]) => { ks.forEach((k) => loja.delete(k)); }),
      __loja: loja,
    },
  };
});

const LISTA = 'lista-1';

beforeEach(() => {
  (AsyncStorage as unknown as { __loja: Map<string, string> }).__loja.clear();
});

describe('contagem offline — estado, não evento', () => {
  it('corrigir o valor SUBSTITUI a pendência, não acumula', async () => {
    await registrarContagemLocal(LISTA, 'item-A', 10);
    await registrarContagemLocal(LISTA, 'item-A', 12);

    const pend = await contagensPendentes(LISTA);
    expect(pend).toHaveLength(1);
    expect(pend[0].quantidade).toBe(12);
  });

  it('a correção gera idempotencyKey NOVA (é outra captura)', async () => {
    await registrarContagemLocal(LISTA, 'item-A', 10);
    const primeira = (await contagensPendentes(LISTA))[0].idempotencyKey;
    await new Promise((r) => setTimeout(r, 2)); // a chave carrega o timestamp
    await registrarContagemLocal(LISTA, 'item-A', 12);
    const segunda = (await contagensPendentes(LISTA))[0].idempotencyKey;

    expect(segunda).not.toBe(primeira);
  });

  it('itens diferentes são pendências independentes', async () => {
    await registrarContagemLocal(LISTA, 'item-A', 1);
    await registrarContagemLocal(LISTA, 'item-B', 2);
    expect(await contarPendentes(LISTA)).toBe(2);
  });

  it('zero é contagem válida — não pode ser tratado como "não contado"', async () => {
    await registrarContagemLocal(LISTA, 'item-A', 0);
    const pend = await contagensPendentes(LISTA);
    expect(pend).toHaveLength(1);
    expect(pend[0].quantidade).toBe(0);
  });

  it('listas diferentes não se misturam', async () => {
    await registrarContagemLocal('lista-1', 'item-A', 1);
    await registrarContagemLocal('lista-2', 'item-A', 9);
    expect(await contarPendentes('lista-1')).toBe(1);
    expect((await contagensPendentes('lista-2'))[0].quantidade).toBe(9);
  });
});

describe('pacote da lista', () => {
  const pacote = {
    listId: LISTA,
    listName: 'Lista 1',
    cicloEsperado: 2,
    baixadoEm: new Date().toISOString(),
    itens: [
      { id: 'item-A', product_code: '001', product_description: 'X', location: null, contadoNoServidor: null },
    ],
  };

  it('guarda e devolve o ciclo de QUANDO baixou', async () => {
    // É esse ciclo que vai carimbado no envio. Se o app relesse o ciclo atual
    // na hora de sincronizar, a proteção do servidor não teria como pegar nada.
    await salvarPacote(pacote);
    expect((await lerPacote(LISTA))?.cicloEsperado).toBe(2);
  });

  it('encerrar apaga pacote E contagens da lista', async () => {
    await salvarPacote(pacote);
    await registrarContagemLocal(LISTA, 'item-A', 5);

    await descartarPacote(LISTA);

    expect(await lerPacote(LISTA)).toBeNull();
    expect(await contarPendentes(LISTA)).toBe(0);
  });
});
