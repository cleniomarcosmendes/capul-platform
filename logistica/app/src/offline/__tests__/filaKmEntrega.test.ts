import {
  enfileirarKmEntrega,
  processarFilaKmEntrega,
  contarPendentesKmEntrega,
} from '../filaKmEntrega';

/**
 * A regra que estes testes protegem: **o KM de saída sobe ANTES das baixas; o
 * encerrar sobe DEPOIS.**
 *
 * O defeito real (achado em 10/08, nenhum teste pegou): o reenvio mandava
 * `processarFilaBaixas()` primeiro e o KM inteiro por último — a ordem tinha sido
 * pensada só para o 'encerrar', que de fato precisa ir por último. Só que o
 * servidor recusa baixa em rota sem KM de saída, e a fila de baixas trata 4xx
 * como rejeição definitiva: **descartava a baixa e apagava a foto**. Quem
 * trabalhou offline perdia a prova de entrega — que é lastro de cobrança.
 *
 * `apenas` é o que deixa as duas pontas serem processadas em momentos
 * diferentes. Se alguém remover o filtro e voltar a esvaziar a fila de uma vez,
 * estes testes caem.
 */

jest.mock('../../api/config', () => ({ LOGISTICA_BASE: 'http://teste/api/v1' }));

// Prefixo `mock` é exigido pelo jest: a fábrica do `jest.mock` é içada para o
// topo do módulo e só enxerga variáveis com esse nome.
const mockIniciar = jest.fn();
const mockEncerrar = jest.fn();
jest.mock('../../api/viagens', () => ({
  iniciarEntrega: (...args: unknown[]) => mockIniciar(...args),
  encerrarEntrega: (...args: unknown[]) => mockEncerrar(...args),
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

beforeEach(() => {
  loja.clear();
  mockIniciar.mockReset().mockResolvedValue(undefined);
  mockEncerrar.mockReset().mockResolvedValue(undefined);
});

describe('filaKmEntrega — ordem de reenvio', () => {
  it('`apenas: iniciar` sobe só o KM de saída e deixa o encerrar na fila', async () => {
    await enfileirarKmEntrega({ tipo: 'iniciar', viagemId: 'v1', kmInicial: 12000 });
    await enfileirarKmEntrega({ tipo: 'encerrar', viagemId: 'v1', kmFinal: 12080 });

    const r = await processarFilaKmEntrega({ apenas: 'iniciar' });

    expect(mockIniciar).toHaveBeenCalledWith('v1', 12000);
    expect(mockEncerrar).not.toHaveBeenCalled();
    expect(r.enviadas).toBe(1);
    // O encerrar continua guardado para depois das baixas/despesas.
    expect(await contarPendentesKmEntrega()).toBe(1);
  });

  it('`apenas: encerrar` fecha a rota e esvazia a fila', async () => {
    await enfileirarKmEntrega({ tipo: 'encerrar', viagemId: 'v1', kmFinal: 12080 });

    const r = await processarFilaKmEntrega({ apenas: 'encerrar' });

    expect(mockEncerrar).toHaveBeenCalledWith('v1', 12080);
    expect(r.enviadas).toBe(1);
    expect(await contarPendentesKmEntrega()).toBe(0);
  });

  it('item fora do filtro não gasta tentativa nem vira descarte', async () => {
    await enfileirarKmEntrega({ tipo: 'encerrar', viagemId: 'v1', kmFinal: 12080 });

    const r = await processarFilaKmEntrega({ apenas: 'iniciar' });

    expect(r).toMatchObject({ enviadas: 0, descartadas: [], restantes: 1 });
    expect(mockEncerrar).not.toHaveBeenCalled();
  });

  it('KM de saída recusado pelo servidor (400) é descartado com o motivo', async () => {
    // É o caso real: hodômetro digitado menor que o KM atual do veículo. Quem
    // chama precisa saber, porque as baixas daquela rota NÃO podem subir depois.
    mockIniciar.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { message: 'KM de saída (10) menor que o KM atual do veículo (12000).' } },
    });
    await enfileirarKmEntrega({ tipo: 'iniciar', viagemId: 'v1', kmInicial: 10 });

    const r = await processarFilaKmEntrega({ apenas: 'iniciar' });

    expect(r.enviadas).toBe(0);
    expect(r.descartadas).toHaveLength(1);
    expect(r.descartadas[0].motivo).toContain('menor que o KM atual');
  });

  it('falha de rede mantém o KM na fila para a próxima tentativa', async () => {
    mockIniciar.mockRejectedValue({ isAxiosError: true, request: {} });
    await enfileirarKmEntrega({ tipo: 'iniciar', viagemId: 'v1', kmInicial: 12000 });

    const r = await processarFilaKmEntrega({ apenas: 'iniciar' });

    expect(r).toMatchObject({ enviadas: 0, descartadas: [], restantes: 1 });
  });

  it('reenfileirar a mesma ação não duplica (id por viagem+tipo)', async () => {
    await enfileirarKmEntrega({ tipo: 'iniciar', viagemId: 'v1', kmInicial: 12000 });
    await enfileirarKmEntrega({ tipo: 'iniciar', viagemId: 'v1', kmInicial: 12345 });

    expect(await contarPendentesKmEntrega()).toBe(1);
  });
});
