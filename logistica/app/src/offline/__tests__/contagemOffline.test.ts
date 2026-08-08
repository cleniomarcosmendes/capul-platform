import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  registrarContagemLocal,
  registrarContagemPorLote,
  sincronizarContagens,
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
      {
        id: 'item-A', product_code: '001', product_description: 'X', location: null,
        warehouse: '02', contadoNoServidor: null, revisarNoCiclo: false, motivoRevisao: null, zeradoNoFecho: false, exigeLote: false, lotes: [],
      },
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

/**
 * Contagem POR LOTE e a marca de SINCRONIZADO (08/08/2026).
 *
 * Dois problemas nasceram juntos e se resolvem no mesmo lugar:
 *
 *  1. produto rastreado era enviado como quantidade única, e o servidor gravava
 *     `lot_number = NULL` sem reclamar (a guarda `CONTAGEM_EXIGE_LOTE` fechou
 *     isso do lado de lá);
 *  2. ao sincronizar, o valor saía da fila e a tela caía no `contadoNoServidor`
 *     do download — o número digitado sumia e o progresso andava PARA TRÁS.
 */
describe('contagem por lote', () => {
  const LISTA_L = 'lista-lote';

  const pacoteComLote = {
    listId: LISTA_L,
    listName: 'Lista Lote',
    warehouse: '06',
    cicloEsperado: 1,
    baixadoEm: new Date().toISOString(),
    itens: [
      {
        id: 'item-L', product_code: '900', product_description: 'RACAO', location: 'A-01',
        warehouse: '06', contadoNoServidor: null, revisarNoCiclo: false, motivoRevisao: null, zeradoNoFecho: false, exigeLote: true,
        lotes: [
          { numero: 'L001', lotefor: 'F1', validade: '20271231' },
          { numero: 'L002', lotefor: 'F2', validade: null },
        ],
      },
      {
        id: 'item-S', product_code: '901', product_description: 'SAL', location: null,
        warehouse: '06', contadoNoServidor: null, revisarNoCiclo: false, motivoRevisao: null, zeradoNoFecho: false, exigeLote: false, lotes: [],
      },
    ],
  };

  beforeEach(async () => { await descartarPacote(LISTA_L); });

  it('o total é a SOMA dos lotes, nunca digitado', async () => {
    await salvarPacote(pacoteComLote);
    await registrarContagemPorLote(LISTA_L, 'item-L', [
      { numero: 'L001', quantidade: 7 },
      { numero: 'L002', quantidade: 3.5 },
    ]);

    const [c] = await contagensPendentes(LISTA_L);
    expect(c.quantidade).toBe(10.5);
    expect(c.lotes).toHaveLength(2);
  });

  it('lote SEM valor não entra — vazio não é zero', async () => {
    // Zero é afirmação ("procurei e não achei"); ausência é "ainda não contei".
    // Quem transforma o que sobrou em zero é o fecho, com rastro.
    await salvarPacote(pacoteComLote);
    await registrarContagemPorLote(LISTA_L, 'item-L', [{ numero: 'L001', quantidade: 0 }]);

    const [c] = await contagensPendentes(LISTA_L);
    expect(c.lotes).toEqual([{ numero: 'L001', quantidade: 0 }]);
    expect(c.quantidade).toBe(0);
  });

  it('apagar todos os lotes remove a pendência (não vira zero)', async () => {
    await salvarPacote(pacoteComLote);
    await registrarContagemPorLote(LISTA_L, 'item-L', [{ numero: 'L001', quantidade: 5 }]);
    expect(await contarPendentes(LISTA_L)).toBe(1);

    await registrarContagemPorLote(LISTA_L, 'item-L', []);
    expect(await contarPendentes(LISTA_L)).toBe(0);
  });

  it('⭐ lote FORA da lista é registrável — é o que o inventário existe pra achar', async () => {
    // 86% dos lotes têm saldo zero e não entram no recorte; um deles pode estar
    // fisicamente na prateleira. Sem este caminho não haveria onde registrá-lo —
    // e trazer todos na lista daria 7,2 lotes por item, até 108 num só.
    await salvarPacote(pacoteComLote);
    await registrarContagemPorLote(LISTA_L, 'item-L', [
      { numero: 'L001', quantidade: 2 },
      { numero: 'LOTE-NAO-LISTADO', quantidade: 5 },
    ]);

    const [c] = await contagensPendentes(LISTA_L);
    expect(c.quantidade).toBe(7);
    expect(c.lotes!.map((l) => l.numero)).toContain('LOTE-NAO-LISTADO');
  });

  it('produto sem lote no recorte ainda pode ser contado à mão', async () => {
    // Todos os lotes vencidos: a lista vem vazia e o servidor BLOQUEIA contagem
    // única (PRODUTO_SEM_LOTE_VALIDO). O informar-outro-lote é a saída.
    await salvarPacote({
      ...pacoteComLote,
      itens: [{ ...pacoteComLote.itens[0], lotes: [] }],
    });
    await registrarContagemPorLote(LISTA_L, 'item-L', [
      { numero: 'ACHADO-NA-PRATELEIRA', quantidade: 3 },
    ]);

    const [c] = await contagensPendentes(LISTA_L);
    expect(c.lotes).toEqual([{ numero: 'ACHADO-NA-PRATELEIRA', quantidade: 3 }]);
  });

  it('corrigir um lote NÃO gera segunda pendência', async () => {
    await salvarPacote(pacoteComLote);
    await registrarContagemPorLote(LISTA_L, 'item-L', [{ numero: 'L001', quantidade: 5 }]);
    await registrarContagemPorLote(LISTA_L, 'item-L', [{ numero: 'L001', quantidade: 8 }]);

    const pend = await contagensPendentes(LISTA_L);
    expect(pend).toHaveLength(1);
    expect(pend[0].quantidade).toBe(8);
  });

  it('envia lot_counts para produto rastreado e NÃO para os demais', async () => {
    const { api } = jest.requireMock('../../api/client') as { api: { post: jest.Mock } };
    api.post.mockClear();
    api.post.mockResolvedValue({ data: {} });

    await salvarPacote(pacoteComLote);
    await registrarContagemPorLote(LISTA_L, 'item-L', [{ numero: 'L001', quantidade: 4 }]);
    await registrarContagemLocal(LISTA_L, 'item-S', 9);

    await sincronizarContagens(LISTA_L);

    const corpos = api.post.mock.calls.map((c) => c[1]);
    const comLote = corpos.find((b) => b.lot_counts);
    expect(comLote.quantity).toBe(4);
    expect(comLote.lot_counts).toEqual([{ lot_number: 'L001', quantity: 4 }]);

    const semLote = corpos.find((b) => !b.lot_counts);
    expect(semLote.quantity).toBe(9);
  });

  it('⭐ sincronizar MARCA o item — o valor não pode sumir da tela', async () => {
    const { api } = jest.requireMock('../../api/client') as { api: { post: jest.Mock } };
    api.post.mockClear();
    api.post.mockResolvedValue({ data: {} });

    await salvarPacote(pacoteComLote);
    await registrarContagemLocal(LISTA_L, 'item-S', 9);
    await sincronizarContagens(LISTA_L);

    const p = await lerPacote(LISTA_L);
    const item = p!.itens.find((i) => i.id === 'item-S')!;
    expect(item.contadoNoServidor).toBe(9);   // antes ficava null → item "sumia"
    expect(await contarPendentes(LISTA_L)).toBe(0);
  });

  it('envio RECUSADO não marca o item como sincronizado', async () => {
    const { api } = jest.requireMock('../../api/client') as { api: { post: jest.Mock } };
    api.post.mockClear();
    api.post.mockRejectedValue({
      isAxiosError: true,
      response: { data: { detail: { erro: 'CONTAGEM_EXIGE_LOTE', mensagem: 'exige lote' } } },
    });

    await salvarPacote(pacoteComLote);
    await registrarContagemLocal(LISTA_L, 'item-L', 12);  // errado de propósito
    const r = await sincronizarContagens(LISTA_L);

    expect(r.recusadas.map((x) => x.codigo)).toContain('CONTAGEM_EXIGE_LOTE');
    const p = await lerPacote(LISTA_L);
    expect(p!.itens.find((i) => i.id === 'item-L')!.contadoNoServidor).toBeNull();
  });

  it('pacote ANTIGO (sem os campos de lote) não quebra a leitura', async () => {
    // Operador no meio da contagem quando o JS atualiza. O padrão é o
    // conservador: sem lote — e aí a guarda do servidor recusa e reporta, em vez
    // de gravar errado calado.
    await AsyncStorage.setItem(
      `capul_contagem_pacote:${LISTA_L}`,
      JSON.stringify({
        listId: LISTA_L, listName: 'Antiga', cicloEsperado: 1, baixadoEm: '2026-08-01',
        itens: [{ id: 'x', product_code: '1', product_description: 'Y', location: null, contadoNoServidor: null }],
      }),
    );

    const p = await lerPacote(LISTA_L);
    expect(p!.itens[0].lotes).toEqual([]);
    expect(p!.itens[0].exigeLote).toBe(false);
    expect(p!.itens[0].warehouse).toBeNull();
  });
});

/**
 * Liberar para supervisor — a trava que o SERVIDOR não consegue fazer.
 *
 * O handoff zera os itens não contados e tira a lista de EM_CONTAGEM. Se sobrar
 * contagem presa no aparelho, ela é perdida DUAS vezes: zerada no servidor e
 * depois recusada no envio (LISTA_NAO_ESTA_EM_CONTAGEM). E o servidor não tem
 * como saber que existe trabalho neste aparelho — a guarda é obrigatoriamente
 * do cliente.
 *
 * A tela cobre isso sincronizando antes e abortando se sobrar algo; estes testes
 * seguram a peça de que ela depende.
 */
describe('pendências antes de liberar', () => {
  const LISTA_H = 'lista-handoff';
  const pacoteH = {
    listId: LISTA_H,
    listName: 'Lista H',
    cicloEsperado: 1,
    baixadoEm: new Date().toISOString(),
    itens: [
      {
        id: 'h1', product_code: '1', product_description: 'A', location: null,
        warehouse: '02', contadoNoServidor: null, revisarNoCiclo: false, motivoRevisao: null, zeradoNoFecho: false, exigeLote: false, lotes: [],
      },
    ],
  };

  beforeEach(async () => { await descartarPacote(LISTA_H); });

  it('sem sinal, a contagem CONTINUA pendente — não pode liberar', async () => {
    const { api } = jest.requireMock('../../api/client') as { api: { post: jest.Mock } };
    api.post.mockClear();
    api.post.mockRejectedValue({ isAxiosError: true, response: undefined }); // offline

    await salvarPacote(pacoteH);
    await registrarContagemLocal(LISTA_H, 'h1', 3);

    const r = await sincronizarContagens(LISTA_H);
    expect(r.enviadas).toBe(0);
    expect(r.restantes).toBe(1);
    expect(await contarPendentes(LISTA_H)).toBe(1);
  });

  it('sincronizado, não sobra pendência e o item fica marcado', async () => {
    const { api } = jest.requireMock('../../api/client') as { api: { post: jest.Mock } };
    api.post.mockClear();
    api.post.mockResolvedValue({ data: {} });

    await salvarPacote(pacoteH);
    await registrarContagemLocal(LISTA_H, 'h1', 3);

    const r = await sincronizarContagens(LISTA_H);
    expect(r.restantes).toBe(0);
    expect(await contarPendentes(LISTA_H)).toBe(0);
    expect((await lerPacote(LISTA_H))!.itens[0].contadoNoServidor).toBe(3);
  });
});

/**
 * Retorno de sincronização e devolução parcial (08/08, reportado pelo Clenio:
 * "estou sincronizando e não tenho informação que foi sincronizado").
 */
describe('rastro da sincronização e revisão', () => {
  const L = 'lista-rastro';
  const base = {
    listId: L, listName: 'R', cicloEsperado: 1, baixadoEm: new Date().toISOString(),
    itens: [{
      id: 'r1', product_code: '1', product_description: 'A', location: null, warehouse: '06',
      contadoNoServidor: null, exigeLote: false, lotes: [],
      revisarNoCiclo: false, motivoRevisao: null, zeradoNoFecho: false,
    }],
  };
  beforeEach(async () => { await descartarPacote(L); });

  it('⭐ carimba a hora da sincronização — sem isso nada prova que subiu', async () => {
    const { api } = jest.requireMock('../../api/client') as { api: { post: jest.Mock } };
    api.post.mockClear();
    api.post.mockResolvedValue({ data: {} });

    await salvarPacote(base);
    expect((await lerPacote(L))!.sincronizadoEm).toBeUndefined();

    await registrarContagemLocal(L, 'r1', 5);
    await sincronizarContagens(L);

    expect((await lerPacote(L))!.sincronizadoEm).toBeDefined();
  });

  it('sincronização SEM nada a enviar não carimba', async () => {
    await salvarPacote(base);
    await sincronizarContagens(L);
    expect((await lerPacote(L))!.sincronizadoEm).toBeUndefined();
  });

  it('marca de REVISAR sobrevive à leitura do pacote', async () => {
    // É o que diz ao contador O QUE revisar depois da devolução parcial — o
    // desktop sempre mostrou, e o app descartava o campo que já vinha.
    await salvarPacote({
      ...base,
      itens: [{ ...base.itens[0], revisarNoCiclo: true, motivoRevisao: 'conferir a validade' }],
    });
    const p = await lerPacote(L);
    expect(p!.itens[0].revisarNoCiclo).toBe(true);
    expect(p!.itens[0].motivoRevisao).toBe('conferir a validade');
  });

  it('pacote ANTIGO sem os campos novos não quebra', async () => {
    await AsyncStorage.setItem(`capul_contagem_pacote:${L}`, JSON.stringify({
      listId: L, listName: 'Antiga', cicloEsperado: 1, baixadoEm: '2026-08-01',
      itens: [{ id: 'x', product_code: '1', product_description: 'Y', location: null,
                contadoNoServidor: null }],
    }));
    const p = await lerPacote(L);
    expect(p!.itens[0].revisarNoCiclo).toBe(false);
    expect(p!.itens[0].zeradoNoFecho).toBe(false);
  });
});

/**
 * Modo revisão parcial — mesma regra do desktop (`useCountingData`).
 * A lógica vive na tela; estes testes guardam o CRITÉRIO, que é o que erra.
 */
describe('critério do modo revisão parcial', () => {
  const parcial = (marcados: number, total: number) => marcados > 0 && marcados < total;

  it('ALGUNS marcados = revisão parcial (mostra só eles)', () => {
    expect(parcial(3, 10)).toBe(true);
  });

  it('⭐ TODOS marcados = devolução TOTAL, a lista inteira é para revisar', () => {
    // Sem esta distinção a devolução total esconderia tudo — o contador
    // abriria uma lista vazia sem entender por quê.
    expect(parcial(10, 10)).toBe(false);
  });

  it('nenhum marcado = contagem normal', () => {
    expect(parcial(0, 10)).toBe(false);
  });
});
