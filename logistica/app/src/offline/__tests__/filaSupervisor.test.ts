import { enfileirarSupervisor, processarFilaSupervisor, contarPendentesSupervisor } from '../filaSupervisor';
import { lancarDespesaApp } from '../../api/supervisor';

/**
 * O que estes testes protegem: **a fila não pode apagar a prova.**
 *
 * A política geral (4xx = rejeição definitiva → descarta e apaga as fotos) é certa
 * para uma despesa recusada pelo seu conteúdo. O "RDV do mês encerrado" é outra
 * coisa: o lançamento está certo, quem bloqueia é um ESTADO que a autoridade desfaz
 * ("reabra o mês"). Tratado como definitivo, produzia o pior estrago — o representante
 * lançava a despesa em campo, o coordenador encerrava o mês naquele dia, e ao
 * sincronizar a despesa sumia **junto com as fotos do cupom**, que já foi para o lixo.
 */
jest.mock('../../api/config', () => ({ LOGISTICA_BASE: 'http://teste/api/v1' }));
jest.mock('../../api/supervisor', () => ({
  adicionarVisitaApp: jest.fn(), apontarVisitaApp: jest.fn(), lancarDespesaApp: jest.fn(),
}));
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

const erro = (status: number, message: string) => Object.assign(new Error(message), {
  isAxiosError: true, response: { status, data: { message } },
});
const despesa = (id: string) => enfileirarSupervisor({
  id, rotulo: 'Despesa: Pedágio', acao: { tipo: 'despesa', viagemId: 'v1', payload: { valor: 12.34 } as never, fotoUris: [] },
});

beforeEach(async () => {
  jest.clearAllMocks();
  // esvazia a fila entre os testes
  let r = await processarFilaSupervisor();
  while (r.restantes > 0) { (lancarDespesaApp as jest.Mock).mockResolvedValue({}); r = await processarFilaSupervisor(); }
});

it('mês encerrado NÃO descarta: o item fica na fila esperando a reabertura', async () => {
  await despesa('d1');
  (lancarDespesaApp as jest.Mock).mockRejectedValue(
    erro(400, 'RDV do mês encerrado — não dá para lançar despesa. Reabra o mês…'),
  );
  const r = await processarFilaSupervisor();
  expect(r.descartadas).toHaveLength(0);
  expect(r.restantes).toBe(1);
  expect(await contarPendentesSupervisor()).toBe(1);
});

it('…e sobe sozinho quando o mês é reaberto', async () => {
  await despesa('d2');
  (lancarDespesaApp as jest.Mock).mockRejectedValue(erro(400, 'RDV do mês encerrado — reabra o mês.'));
  await processarFilaSupervisor();
  (lancarDespesaApp as jest.Mock).mockResolvedValue({});
  const r = await processarFilaSupervisor();
  expect(r.enviadas).toBe(1);
  expect(await contarPendentesSupervisor()).toBe(0);
});

it('rejeição de CONTEÚDO segue descartando (a política geral não mudou)', async () => {
  await despesa('d3');
  (lancarDespesaApp as jest.Mock).mockRejectedValue(erro(400, 'Informe o veículo desta despesa.'));
  const r = await processarFilaSupervisor();
  expect(r.descartadas).toHaveLength(1);
  expect(r.descartadas[0].motivo).toMatch(/Informe o veículo/);
  expect(await contarPendentesSupervisor()).toBe(0);
});

it('sem conexão mantém na fila, como sempre', async () => {
  await despesa('d4');
  (lancarDespesaApp as jest.Mock).mockRejectedValue(new Error('Network Error'));
  const r = await processarFilaSupervisor();
  expect(r.descartadas).toHaveLength(0);
  expect(await contarPendentesSupervisor()).toBe(1);
});
