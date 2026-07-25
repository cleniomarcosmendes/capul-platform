import { RotaService } from './rota.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ⭐ Reportado pelo Clenio (24/07, HOM): numa rota com duas entregas, a que fica
// EM FRENTE à empresa foi para a 2ª posição e o entregador teve que voltar. A
// origem estava certa (é a filial); o que estava errado era o PONTO da parada —
// endereço que o OSM não conhece cai no fallback de município e entra na conta
// ancorado no centroide da cidade (~1,2 km da filial 01, em Unaí). Estes testes
// travam o que a tela precisa receber para conseguir mostrar isso ao operador.

const UNAI_FILIAL = { lat: -16.3734584, lng: -46.8949492 }; // Rua Pref. João Costa, 1455
const UNAI_CENTRO = { lat: -16.3628767, lng: -46.892413 }; // centroide do município
const VIZINHA_DA_FILIAL = { lat: -16.3735, lng: -46.8951 }; // ~20 m — "em frente"
const DISTANTE = { lat: -16.39, lng: -46.91 }; // ~2,4 km
// ~0,5 km da filial: mais PERTO que o centroide do município (~1,2 km). É essa
// relação que faz a entrega vizinha perder a 1ª posição quando cai no fallback.
const MEIO_CAMINHO = { lat: -16.3689584, lng: -46.8949492 };

const entrega = (id: string) => ({
  id,
  endLogradouro: `RUA ${id}`,
  endNumero: '1',
  endBairro: 'CENTRO',
  endCidade: 'UNAI',
  endUf: 'MG',
  endCep: '38616064',
  geoLat: null,
  geoLng: null,
});

/** Geocode fake: devolve a coordenada/precisão programada por logradouro. */
const geocodeMock = (mapa: Record<string, { lat: number; lng: number; precisao: string }>) =>
  ({
    geocodificar: jest.fn(async (e: any) => mapa[e.logradouro] ?? null),
  }) as any;

const osrmOff = () => ({ matrizDistancia: jest.fn(async () => null) }) as any; // sem OSRM → haversine
/** OSRM fake com matriz fixa (metros). Índice 0 = filial, 1..n = pontos na ordem enviada. */
const osrmMatriz = (m: number[][]) => ({ matrizDistancia: jest.fn(async () => m) }) as any;

describe('RotaService.sugerirOrdem — transparência da localização', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.entrega.findMany.mockResolvedValue([entrega('A'), entrega('B')]);
    prisma.entrega.update.mockResolvedValue({});
    prisma.$queryRaw.mockResolvedValue([
      { endereco: 'RUA PREFEITO JOAO COSTA, 1455', cidade: 'UNAI', estado: 'MG', cep: '38616064' },
    ]);
  });

  const svc = (mapa: Record<string, { lat: number; lng: number; precisao: string }>) =>
    new RotaService(prisma, geocodeMock(mapa), osrmOff());

  it('reporta a precisão de cada parada e conta as aproximadas', async () => {
    const r = await svc({
      'RUA PREFEITO JOAO COSTA, 1455': { ...UNAI_FILIAL, precisao: 'LOGRADOURO' },
      'RUA A': { ...VIZINHA_DA_FILIAL, precisao: 'CIDADE' }, // caiu no centroide
      'RUA B': { ...DISTANTE, precisao: 'LOGRADOURO' },
    }).sugerirOrdem('f1', ['A', 'B']);

    expect(r.precisao).toEqual({ A: 'CIDADE', B: 'LOGRADOURO' });
    expect(r.aproximadas).toBe(1);
  });

  it('devolve as coordenadas usadas na conta (é com elas que o mapa desenha)', async () => {
    const r = await svc({
      'RUA PREFEITO JOAO COSTA, 1455': { ...UNAI_FILIAL, precisao: 'LOGRADOURO' },
      'RUA A': { ...VIZINHA_DA_FILIAL, precisao: 'LOGRADOURO' },
      'RUA B': { ...UNAI_CENTRO, precisao: 'CIDADE' },
    }).sugerirOrdem('f1', ['A', 'B']);

    expect(r.origem).toEqual(UNAI_FILIAL);
    expect(r.coordenadas).toEqual({ A: VIZINHA_DA_FILIAL, B: UNAI_CENTRO });
    // O pin de B fica onde o algoritmo pensou que ele estava — no centro da
    // cidade — e não no endereço real. É esse descolamento que a tela sinaliza.
    expect(r.precisao!['B']).toBe('CIDADE');
  });

  it('sem origem geocodificada o mapa não recebe ponto de partida', async () => {
    const r = await svc({
      'RUA A': { ...VIZINHA_DA_FILIAL, precisao: 'LOGRADOURO' },
      'RUA B': { ...DISTANTE, precisao: 'LOGRADOURO' },
    }).sugerirOrdem('f1', ['A', 'B']);

    expect(r.origem).toBeNull();
    expect(r.origemRota).toBe('PRIMEIRA_ENTREGA');
  });

  it('origem = FILIAL quando o endereço da filial geocodifica, com a precisão dela', async () => {
    const r = await svc({
      'RUA PREFEITO JOAO COSTA, 1455': { ...UNAI_FILIAL, precisao: 'LOGRADOURO' },
      'RUA A': { ...VIZINHA_DA_FILIAL, precisao: 'LOGRADOURO' },
      'RUA B': { ...DISTANTE, precisao: 'LOGRADOURO' },
    }).sugerirOrdem('f1', ['A', 'B']);

    expect(r.origemRota).toBe('FILIAL');
    expect(r.origemPrecisao).toBe('LOGRADOURO');
  });

  it('origem = PRIMEIRA_ENTREGA (com aviso) quando a filial NÃO geocodifica', async () => {
    const r = await svc({
      // filial ausente do mapa → geocodificar devolve null
      'RUA A': { ...VIZINHA_DA_FILIAL, precisao: 'LOGRADOURO' },
      'RUA B': { ...DISTANTE, precisao: 'LOGRADOURO' },
    }).sugerirOrdem('f1', ['A', 'B']);

    expect(r.origemRota).toBe('PRIMEIRA_ENTREGA');
    expect(r.origemPrecisao).toBeNull();
  });

  it('a parada vizinha da filial vem em 1º quando localizada na porta', async () => {
    const r = await svc({
      'RUA PREFEITO JOAO COSTA, 1455': { ...UNAI_FILIAL, precisao: 'LOGRADOURO' },
      'RUA A': { ...VIZINHA_DA_FILIAL, precisao: 'LOGRADOURO' },
      'RUA B': { ...DISTANTE, precisao: 'LOGRADOURO' },
    }).sugerirOrdem('f1', ['A', 'B']);

    expect(r.ordem).toEqual(['A', 'B']);
    expect(r.aproximadas).toBe(0);
  });

  it('2-opt não aceita inversão que piora a rota quando o custo é assimétrico (mão única)', async () => {
    // 4 paradas. O vizinho-mais-próximo monta O→A→B→C→D (custo 22,3).
    // Inverter A..C melhora MUITO as duas arestas das pontas (0,5+20 → 1+0,9),
    // mas o miolo invertido custa 80 em vez de 1,8: a rota real iria a 81,9.
    // A versão que comparava só as pontas aceitava essa troca.
    prisma.entrega.findMany.mockResolvedValue([entrega('A'), entrega('B'), entrega('C'), entrega('D')]);
    const M = [
      // filial      A       B       C       D          (metros)
      [0, 500, 30000, 1000, 30000], // filial →
      [500, 0, 800, 25000, 900], // A →
      [30000, 40000, 0, 1000, 30000], // B →  (B→A caro: mão única)
      [1000, 25000, 40000, 0, 20000], // C →  (C→B caro: mão única)
      [30000, 60000, 60000, 50000, 0], // D →
    ];
    const svcOsrm = new RotaService(
      prisma,
      geocodeMock({
        'RUA PREFEITO JOAO COSTA, 1455': { ...UNAI_FILIAL, precisao: 'LOGRADOURO' },
        'RUA A': { ...VIZINHA_DA_FILIAL, precisao: 'LOGRADOURO' },
        'RUA B': { ...MEIO_CAMINHO, precisao: 'LOGRADOURO' },
        'RUA C': { ...UNAI_CENTRO, precisao: 'LOGRADOURO' },
        'RUA D': { ...DISTANTE, precisao: 'LOGRADOURO' },
      }),
      osrmMatriz(M),
    );

    const r = await svcOsrm.sugerirOrdem('f1', ['A', 'B', 'C', 'D']);

    expect(r.fonteDistancia).toBe('OSRM');
    expect(r.ordem).toEqual(['A', 'B', 'C', 'D']);
    // 500 + 800 + 1000 + 20000 = 22,3 km. Aceitando a inversão daria 81,9 km.
    expect(r.distanciaKm).toBe(22.3);
  });

  it('2-opt avalia a inversão que vai até a última parada (rota aberta)', async () => {
    // 2 paradas: NN escolhe A (mais perto da filial), mas A→B custa 100 e o
    // caminho B→A custa 1 — inverter vale a pena. O laço anterior parava antes
    // desse trecho e a troca nunca era sequer considerada.
    prisma.entrega.findMany.mockResolvedValue([entrega('A'), entrega('B')]);
    const M = [
      // filial      A        B      (metros)
      [0, 1000, 2000], // filial → A mais perto
      [1000, 0, 100000], // A → B caro
      [2000, 1000, 0], // B → A barato
    ];
    const svcOsrm = new RotaService(
      prisma,
      geocodeMock({
        'RUA PREFEITO JOAO COSTA, 1455': { ...UNAI_FILIAL, precisao: 'LOGRADOURO' },
        'RUA A': { ...VIZINHA_DA_FILIAL, precisao: 'LOGRADOURO' },
        'RUA B': { ...MEIO_CAMINHO, precisao: 'LOGRADOURO' },
      }),
      osrmMatriz(M),
    );

    const r = await svcOsrm.sugerirOrdem('f1', ['A', 'B']);

    expect(r.ordem).toEqual(['B', 'A']); // 2 km + 1 km = 3, contra 1 + 100 = 101
    expect(r.distanciaKm).toBe(3);
  });

  it('reproduz o caso relatado: vizinha ancorada no centro da cidade perde a 1ª posição — e sai marcada', async () => {
    const mapa = {
      'RUA PREFEITO JOAO COSTA, 1455': { ...UNAI_FILIAL, precisao: 'LOGRADOURO' },
      'RUA A': { ...UNAI_CENTRO, precisao: 'CIDADE' }, // é vizinha, mas foi parar no centro
      'RUA B': { ...MEIO_CAMINHO, precisao: 'LOGRADOURO' },
    };
    const r = await svc(mapa).sugerirOrdem('f1', ['A', 'B']);

    // A entrega vizinha (A) cai para 2ª: o ponto usado na conta está a ~1,2 km,
    // enquanto B, de fato mais longe na rua, foi localizado a ~0,5 km.
    expect(r.ordem).toEqual(['B', 'A']);

    // A ordem "errada" é consequência do ponto, não do algoritmo — o que o
    // serviço garante é entregar à tela o motivo, para o operador corrigir.
    expect(r.precisao!['A']).toBe('CIDADE');
    expect(r.aproximadas).toBe(1);
    expect(r.origemRota).toBe('FILIAL');

    // Contraprova: o MESMO par, com A localizado na porta, volta para 1º.
    const ok = await svc({ ...mapa, 'RUA A': { ...VIZINHA_DA_FILIAL, precisao: 'LOGRADOURO' } })
      .sugerirOrdem('f1', ['A', 'B']);
    expect(ok.ordem).toEqual(['A', 'B']);
    expect(ok.aproximadas).toBe(0);
  });
});
