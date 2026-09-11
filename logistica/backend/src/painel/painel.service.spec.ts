import { PainelService } from './painel.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

/* eslint-disable @typescript-eslint/no-explicit-any */
const coreMock = () => ({
  nomesUsuarios: jest.fn().mockResolvedValue(new Map()),
  nomesFiliais: jest.fn().mockResolvedValue(new Map()),
  nomesDepartamentos: jest.fn().mockResolvedValue(new Map()),
  listarFiliais: jest.fn().mockResolvedValue([]),
}) as any;

/**
 * O Painel é de ENTREGAS. `logistica.viagem` guarda também a saída de FROTA e o
 * container mensal do RDV (SUPERVISOR), e os contadores de rota não recortavam — era
 * assim que um planejamento de RDV aparecia em "Rotas por veículo" (visto na tela em
 * 11/09/2026, veículo KELVER).
 *
 * O KM (mais abaixo no mesmo serviço) já filtrava, com o comentário "só entregas —
 * frota tem seu próprio Monitor": a regra existia, faltava nas outras cinco consultas.
 */
describe('PainelService — todo contador de rota é de ENTREGA', () => {
  let prisma: any; let svc: PainelService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new PainelService(prisma, coreMock());
    prisma.viagem.count.mockResolvedValue(0);
    prisma.viagem.groupBy.mockResolvedValue([]);
    prisma.viagem.findMany.mockResolvedValue([]);
    prisma.entrega.count.mockResolvedValue(0);
    prisma.entrega.groupBy.mockResolvedValue([]);
    prisma.entrega.findMany.mockResolvedValue([]);
    prisma.veiculo.count.mockResolvedValue(0);
    prisma.parada.findMany?.mockResolvedValue([]);
  });

  it('os 3 contadores por situação filtram tipo=ENTREGA', async () => {
    await svc.resumo('f1', 9, 2026).catch(() => undefined);
    const wheres = prisma.viagem.count.mock.calls.map((c: any) => c[0].where);
    expect(wheres.length).toBeGreaterThanOrEqual(3);
    for (const w of wheres) expect(w.tipo).toBe('ENTREGA');
  });

  it('os agrupamentos por veículo e por motorista filtram tipo=ENTREGA', async () => {
    await svc.resumo('f1', 9, 2026).catch(() => undefined);
    const porViagem = prisma.viagem.groupBy.mock.calls.map((c: any) => c[0]);
    expect(porViagem.length).toBeGreaterThanOrEqual(2);
    for (const g of porViagem) expect(g.where.tipo).toBe('ENTREGA');
  });

  it('o KM continua filtrando (já filtrava antes desta onda)', async () => {
    await svc.resumo('f1', 9, 2026).catch(() => undefined);
    const km = prisma.viagem.findMany.mock.calls.map((c: any) => c[0].where);
    for (const w of km) expect(w.tipo).toBe('ENTREGA');
  });
});
