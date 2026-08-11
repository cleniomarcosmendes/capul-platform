import { LocalAprendidoService, distanciaM, medoideDe } from './local-aprendido.service.js';

/**
 * Aprendizado de campo — as regras que o Clenio escolheu em 11/08/2026:
 * promover a partir de **3 entregas concordantes** (raio de 80 m) e, divergindo
 * muito do endereço, **usar assim mesmo e sinalizar**.
 *
 * O que estes testes protegem é o que separa aprendizado de estrago: uma baixa
 * feita longe da porta não pode arrastar o ponto de um endereço, e a correção
 * manual do operador não pode ser revogada por estatística.
 */

const UNAI = { lat: -16.3577, lng: -46.906 };
/** Desloca um ponto em metros (aprox.) — ~111.320 m por grau de latitude. */
const desloca = (p: { lat: number; lng: number }, metrosLat: number, metrosLng = 0) => ({
  lat: p.lat + metrosLat / 111_320,
  lng: p.lng + metrosLng / (111_320 * Math.cos((p.lat * Math.PI) / 180)),
});

const ENDERECO = { logradouro: 'RUA DO PICO', numero: '21', bairro: 'PRIMAVERA 5', cidade: 'UNAI', uf: 'MG', cep: '38612244' };

function prismaMock(entregas: { lat: number; lng: number }[], cache: Record<string, unknown> | null = null) {
  return {
    geocodeCache: {
      findUnique: jest.fn().mockResolvedValue(cache),
      upsert: jest.fn().mockResolvedValue({}),
    },
    entrega: {
      findMany: jest.fn().mockResolvedValue(
        entregas.map((p) => ({ baixaGeoLat: p.lat, baixaGeoLng: p.lng })),
      ),
    },
  } as any;
}
const geocodeMock = () =>
  ({ chavePublica: () => ({ chave: 'chave-do-endereco', texto: 'RUA DO PICO|21|PRIMAVERA 5|UNAI|MG|38612244' }) }) as any;

describe('LocalAprendidoService — quando o campo ensina o endereço', () => {
  it('não promove com menos de 3 entregas', async () => {
    const prisma = prismaMock([UNAI, desloca(UNAI, 10)]);
    const svc = new LocalAprendidoService(prisma, geocodeMock());

    const r = await svc.reavaliar(ENDERECO);

    expect(r.promovido).toBe(false);
    expect(prisma.geocodeCache.upsert).not.toHaveBeenCalled();
  });

  it('promove com 3 entregas concordantes e registra quantas sustentaram', async () => {
    const prisma = prismaMock([UNAI, desloca(UNAI, 15), desloca(UNAI, -20, 10)]);
    const svc = new LocalAprendidoService(prisma, geocodeMock());

    const r = await svc.reavaliar(ENDERECO);

    expect(r.promovido).toBe(true);
    expect(r.amostras).toBe(3);
    const gravado = prisma.geocodeCache.upsert.mock.calls[0][0].create;
    expect(gravado.fonte).toBe('CAMPO');
    expect(gravado.precisao).toBe('CAMPO');
    expect(gravado.aprendidoAmostras).toBe(3);
  });

  // O caso que separa aprendizado de estrago: o entregador que baixou a três
  // quadras dali (no carro, na esquina) não pode mover o endereço sozinho.
  it('uma baixa longe da porta NÃO arrasta o ponto — e não conta como concordante', async () => {
    const perto = [UNAI, desloca(UNAI, 15), desloca(UNAI, -20)];
    const longe = desloca(UNAI, 900);
    const prisma = prismaMock([...perto, longe]);
    const svc = new LocalAprendidoService(prisma, geocodeMock());

    const r = await svc.reavaliar(ENDERECO);

    expect(r.promovido).toBe(true);
    expect(r.amostras).toBe(3); // as 3 de perto; a distante ficou de fora
    const gravado = prisma.geocodeCache.upsert.mock.calls[0][0].create;
    expect(distanciaM({ lat: gravado.lat, lng: gravado.lng }, longe)).toBeGreaterThan(500);
  });

  it('entregas espalhadas (endereço ambíguo) não promovem nada', async () => {
    const prisma = prismaMock([UNAI, desloca(UNAI, 700), desloca(UNAI, -900, 400)]);
    const svc = new LocalAprendidoService(prisma, geocodeMock());

    const r = await svc.reavaliar(ENDERECO);

    expect(r.promovido).toBe(false);
    expect(prisma.geocodeCache.upsert).not.toHaveBeenCalled();
  });

  // ⭐ Decisão do Clenio: pin arrastado à mão é ato explícito do operador e não é
  // revogado por estatística.
  it('correção MANUAL nunca é sobrescrita pelo aprendizado', async () => {
    const prisma = prismaMock([UNAI, desloca(UNAI, 10), desloca(UNAI, 20)], {
      fonte: 'MANUAL',
      lat: UNAI.lat,
      lng: UNAI.lng,
    });
    const svc = new LocalAprendidoService(prisma, geocodeMock());

    const r = await svc.reavaliar(ENDERECO);

    expect(r.promovido).toBe(false);
    expect(prisma.geocodeCache.upsert).not.toHaveBeenCalled();
  });

  // Divergência grande: usa o ponto de campo (o entregador esteve lá) e guarda o
  // desvio, que é o que a tela usa para sinalizar a parada.
  it('divergindo muito do provedor, promove E registra o desvio para sinalizar', async () => {
    const provedor = desloca(UNAI, 800); // geocoder jogou longe (centro do bairro)
    const prisma = prismaMock([UNAI, desloca(UNAI, 15), desloca(UNAI, -10)], {
      fonte: 'NOMINATIM',
      lat: provedor.lat,
      lng: provedor.lng,
    });
    const svc = new LocalAprendidoService(prisma, geocodeMock());

    const r = await svc.reavaliar(ENDERECO);

    expect(r.promovido).toBe(true);
    expect(r.desvioM).toBeGreaterThan(LocalAprendidoService.DESVIO_SINALIZAR_M);
    expect(prisma.geocodeCache.upsert.mock.calls[0][0].update.aprendidoDesvioM).toBe(r.desvioM);
  });

  it('ponto já aprendido e estável não reescreve a cada baixa', async () => {
    const prisma = prismaMock([UNAI, desloca(UNAI, 3), desloca(UNAI, -2)], {
      fonte: 'CAMPO',
      lat: UNAI.lat,
      lng: UNAI.lng,
    });
    const svc = new LocalAprendidoService(prisma, geocodeMock());

    const r = await svc.reavaliar(ENDERECO);

    expect(r.promovido).toBe(false);
    expect(prisma.geocodeCache.upsert).not.toHaveBeenCalled();
  });
});

describe('medóide', () => {
  // Por que medóide e não média: a média é puxada pelo ponto ruim na proporção
  // do erro; o medóide é sempre uma amostra REAL e ignora o outlier.
  it('escolhe o ponto central real e ignora o outlier', () => {
    const a = UNAI;
    const b = desloca(UNAI, 10);
    const c = desloca(UNAI, 20);
    const outlier = desloca(UNAI, 5000);

    const m = medoideDe([a, b, c, outlier]);

    expect(distanciaM(m, b)).toBeLessThan(30); // caiu no miolo, não no meio do caminho
    const mediaLat = (a.lat + b.lat + c.lat + outlier.lat) / 4;
    expect(Math.abs(m.lat - mediaLat)).toBeGreaterThan(0.005); // a média teria ido longe
  });

  it('com um ponto só, é ele mesmo', () => {
    expect(medoideDe([UNAI])).toEqual(UNAI);
  });
});
