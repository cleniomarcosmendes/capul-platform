import { enfileirarFrota, paradasNaFilaFrota, retornosNaFilaFrota, paradasAvulsasNaFila, contarPendentesFrota } from '../filaFrota';

/**
 * O que estes testes protegem: **o que foi feito sem sinal tem de APARECER.**
 *
 * O status da parada e da viagem vem do servidor, que offline não recebeu nada.
 * Sem os mapas abaixo, o condutor fazia o check-in, via a parada continuar
 * PLANEJADA com o botão de chegada ali, e registrava de novo — e via o botão
 * "Retorno" no veículo que acabou de entregar. É o mesmo defeito que a entrega
 * corrigiu em 11/08 (`baixasNaFilaPorEntrega`), que na frota seguia de pé.
 */

jest.mock('../../api/config', () => ({ LOGISTICA_BASE: 'http://teste/api/v1' }));
jest.mock('../../api/frota', () => ({
  adicionarParadaFrota: jest.fn(), checkinParadaFrota: jest.fn(),
  pularParadaFrota: jest.fn(), lancarDespesaViagem: jest.fn(), registrarRetorno: jest.fn(),
}));
jest.mock('../../api/client', () => ({ getCondutorToken: () => null, setCondutorToken: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  makeDirectoryAsync: jest.fn(async () => undefined),
  copyAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
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

it('check-in e "pular" na fila saem da lista de planejadas', async () => {
  await enfileirarFrota({ id: 'a', rotulo: 'Check-in: Fazenda X', acao: { tipo: 'checkin', viagemId: 'v1', paradaId: 'p1', payload: {} } });
  await enfileirarFrota({ id: 'b', rotulo: 'Pular: Fazenda Y', acao: { tipo: 'pular', viagemId: 'v1', paradaId: 'p2' } });
  expect(await paradasNaFilaFrota()).toEqual({ p1: 'CHECKIN', p2: 'PULADA' });
});

it('parada avulsa na fila aparece com o nome do local — senão o condutor digita de novo', async () => {
  await enfileirarFrota({ id: 'c', rotulo: 'Parada: Posto BR', acao: { tipo: 'parada', viagemId: 'v1', payload: { local: 'Posto BR' } } });
  expect(await paradasAvulsasNaFila('v1')).toEqual([{ id: 'c', local: 'Posto BR' }]);
  expect(await paradasAvulsasNaFila('v2')).toEqual([]); // não vaza para outra viagem
});

it('retorno na fila marca a viagem como fechada no aparelho', async () => {
  expect((await retornosNaFilaFrota()).has('v1')).toBe(false);
  await enfileirarFrota({
    id: 'd', rotulo: 'Retorno: ABC1D23',
    acao: { tipo: 'retorno', viagemId: 'v1', payload: { kmFinal: 1200, dataHoraChegada: '2026-08-19T14:30:00.000Z' } },
  });
  expect((await retornosNaFilaFrota()).has('v1')).toBe(true);
});

it('o retorno offline carrega a HORA DA CHEGADA — sem ela o servidor gravaria a hora da sincronização', async () => {
  const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage').default;
  const itens = JSON.parse((await AsyncStorage.getItem('capul_fila_frota')) as string);
  const retorno = itens.find((i: { acao: { tipo: string } }) => i.acao.tipo === 'retorno');
  expect(retorno.acao.payload.dataHoraChegada).toBe('2026-08-19T14:30:00.000Z');
});

it('o retorno entra por ÚLTIMO — a fila é FIFO, então paradas e despesas sobem antes', async () => {
  const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage').default;
  const itens = JSON.parse((await AsyncStorage.getItem('capul_fila_frota')) as string);
  expect(itens[itens.length - 1].acao.tipo).toBe('retorno');
  expect(await contarPendentesFrota()).toBe(4);
});
