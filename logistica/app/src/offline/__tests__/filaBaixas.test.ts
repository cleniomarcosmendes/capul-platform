import { enfileirar, baixasNaFilaPorEntrega, contarPendentes } from '../filaBaixas';

/**
 * A regra que estes testes protegem: **a fila é a verdade enquanto não há
 * sinal.**
 *
 * Relatado pelo Clenio em 11/08, testando em modo avião: ele confirmou a
 * entrega e a parada **continuou em "Pendentes"**, com o botão "Dar baixa"
 * disponível — porque o status da entrega vem do servidor, que offline não
 * recebeu nada. Além de parecer que a baixa não pegou, convidava a baixar a
 * mesma entrega duas vezes.
 *
 * `baixasNaFilaPorEntrega` é o que deixa a tela saber o que já foi feito no
 * aparelho. Se ela sumir ou parar de mapear por `entregaId`, a parada volta a
 * aparecer como pendente.
 */

jest.mock('../../api/config', () => ({ LOGISTICA_BASE: 'http://teste/api/v1' }));
jest.mock('../../api/baixa', () => ({ baixarEntrega: jest.fn() }));

// A fila copia a foto para a pasta do app; aqui só o índice importa.
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  makeDirectoryAsync: jest.fn(async () => undefined),
  copyAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({ exists: false })),
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const loja = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => loja.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => { loja.set(k, v); }),
      removeItem: jest.fn(async (k: string) => { loja.delete(k); }),
      __loja: loja,
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports -- o mock do AsyncStorage só existe depois do jest.mock, então tem que ser `require`
const loja: Map<string, string> = require('@react-native-async-storage/async-storage').default.__loja;

beforeEach(() => loja.clear());

const baixa = (entregaId: string, resultado: 'ENTREGUE' | 'NAO_ENTREGUE', numero: number) => ({
  entregaId,
  entregaNumero: numero,
  destinatario: `Cliente ${numero}`,
  payload: { resultado, idempotencyKey: `k-${entregaId}`, ...(resultado === 'NAO_ENTREGUE' ? { motivo: 'ausente' } : {}) },
});

describe('filaBaixas — o que a tela precisa saber estando offline', () => {
  it('fila vazia não marca nenhuma entrega', async () => {
    expect(await baixasNaFilaPorEntrega()).toEqual({});
  });

  it('entrega baixada offline aparece no mapa, com o resultado', async () => {
    await enfileirar(baixa('e1', 'ENTREGUE', 10));

    expect(await baixasNaFilaPorEntrega()).toEqual({ e1: 'ENTREGUE' });
    expect(await contarPendentes()).toBe(1);
  });

  // A recusa também tira a parada de "Pendentes" — ela foi resolvida, e o
  // encerramento da rota conta as duas coisas como feitas.
  it('não-entrega offline também entra, distinguida pelo resultado', async () => {
    await enfileirar(baixa('e1', 'ENTREGUE', 10));
    await enfileirar(baixa('e2', 'NAO_ENTREGUE', 11));

    expect(await baixasNaFilaPorEntrega()).toEqual({ e1: 'ENTREGUE', e2: 'NAO_ENTREGUE' });
  });

  it('mapeia por entregaId — é assim que o cartão da parada se encontra', async () => {
    await enfileirar(baixa('entrega-abc', 'ENTREGUE', 12));

    const mapa = await baixasNaFilaPorEntrega();
    expect(mapa['entrega-abc']).toBe('ENTREGUE');
    expect(mapa['outra']).toBeUndefined();
  });
});
