import { enfileirarFrota, paradasNaFilaFrota, retornosNaFilaFrota, paradasAvulsasNaFila, contarPendentesFrota, processarFilaFrota } from '../filaFrota';
import { lancarDespesaViagem } from '../../api/frota';

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

/**
 * ⭐ Viagem de VÁRIOS DIAS (levantado pelo Clenio em 19/08).
 *
 * O token de condutor vale 6h ("cobre uma jornada"), e a viagem de frota dura
 * dias. Quem sai na segunda e volta na quinta sincroniza com o token vencido:
 * o servidor responde 403, e a política de "4xx = rejeição definitiva"
 * descartava tudo de uma vez — **apagando junto as fotos dos cupons**. Ele
 * perdia as despesas da viagem inteira sem entender por quê.
 */
describe('identificação do condutor vencida (viagem de vários dias)', () => {
  const { processarFilaFrota, reautenticarFilaFrota, pendentesPrecisamCondutor, enfileirarFrota: enf } =
    jest.requireActual('../filaFrota') as typeof import('../filaFrota');
  const api = jest.requireMock('../../api/frota');

  const erro403 = Object.assign(new Error('403'), {
    isAxiosError: true,
    response: { status: 403, data: { message: 'Sessão do condutor expirou.' } },
  });

  beforeEach(async () => {
    const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage').default;
    await AsyncStorage.removeItem('capul_fila_frota');
    jest.clearAllMocks();
  });

  it('403 MANTÉM o item na fila — não descarta e não apaga a foto', async () => {
    await enf({ id: 'x1', rotulo: 'Despesa R$ 300', acao: { tipo: 'despesa', viagemId: 'v9', payload: { viagemId: 'v9', tipoDespesaId: 't', valor: 300 }, fotoUris: ['file:///cupom.jpg'], condutorToken: 'token-velho' } });
    api.lancarDespesaViagem.mockRejectedValueOnce(erro403);

    const r = await processarFilaFrota();
    expect(r.descartadas).toHaveLength(0);   // ⭐ nada jogado fora
    expect(r.restantes).toBe(1);
    expect(await pendentesPrecisamCondutor('v9')).toBe(1);

    const fs = jest.requireMock('expo-file-system/legacy');
    expect(fs.deleteAsync).not.toHaveBeenCalled(); // ⭐ o cupom continua no aparelho
  });

  it('reidentificar recarimba o token e o trabalho guardado sobe', async () => {
    // Repete o cenário: a despesa ficou na fila com o token vencido.
    await enf({ id: 'x1', rotulo: 'Despesa R$ 300', acao: { tipo: 'despesa', viagemId: 'v9', payload: { viagemId: 'v9', tipoDespesaId: 't', valor: 300 }, fotoUris: ['file:///cupom.jpg'], condutorToken: 'token-velho' } });
    api.lancarDespesaViagem.mockRejectedValueOnce(erro403);
    await processarFilaFrota();
    expect(await pendentesPrecisamCondutor('v9')).toBe(1);

    api.lancarDespesaViagem.mockResolvedValueOnce(undefined);
    const n = await reautenticarFilaFrota('v9', 'token-novo');
    expect(n).toBe(1);
    expect(await pendentesPrecisamCondutor('v9')).toBe(0);

    const r = await processarFilaFrota();
    expect(r.enviadas).toBe(1);
    expect(r.restantes).toBe(0);
  });

  it('403 SEM token de condutor segue sendo recusa definitiva (INDIVIDUAL)', async () => {
    await enf({ id: 'x2', rotulo: 'Parada: X', acao: { tipo: 'parada', viagemId: 'v9', payload: { local: 'X' } } });
    api.adicionarParadaFrota.mockRejectedValueOnce(erro403);
    const r = await processarFilaFrota();
    expect(r.descartadas).toHaveLength(1); // permissão de verdade, não identificação vencida
  });
});

/**
 * ⭐ Bloqueio TEMPORÁRIO não descarta (23/08) — irmão do teste da fila do supervisor.
 *
 * "Acerto encerrado" não recusa a despesa, recusa o MOMENTO: quem desfaz é o gestor.
 * Tratado como definitivo, a sincronização apagava a despesa E as fotos do cupom, com o
 * papel já no lixo.
 */
describe('filaFrota — acerto encerrado segura o item em vez de descartar', () => {
  const erro = (status: number, message: string) => Object.assign(new Error(message), {
    isAxiosError: true, response: { status, data: { message } },
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    let r = await processarFilaFrota();
    while (r.restantes > 0) {
      (lancarDespesaViagem as jest.Mock).mockResolvedValue({});
      r = await processarFilaFrota();
    }
  });

  it('“Acerto encerrado” mantém a despesa e as fotos na fila', async () => {
    await enfileirarFrota({ id: 'x1', rotulo: 'Despesa: Posto', acao: { tipo: 'despesa', viagemId: 'v1', payload: {} as never, fotoUris: [] } });
    (lancarDespesaViagem as jest.Mock).mockRejectedValue(erro(400, 'Acerto encerrado — reabra o acerto para lançar despesas.'));
    const r = await processarFilaFrota();
    expect(r.descartadas).toHaveLength(0);
    expect(await contarPendentesFrota()).toBe(1);
  });

  it('rejeição de conteúdo segue descartando', async () => {
    await enfileirarFrota({ id: 'x2', rotulo: 'Despesa: Posto', acao: { tipo: 'despesa', viagemId: 'v1', payload: {} as never, fotoUris: [] } });
    (lancarDespesaViagem as jest.Mock).mockRejectedValue(erro(400, 'Viagem sem veículo.'));
    const r = await processarFilaFrota();
    expect(r.descartadas).toHaveLength(1);
    expect(await contarPendentesFrota()).toBe(0);
  });
});
