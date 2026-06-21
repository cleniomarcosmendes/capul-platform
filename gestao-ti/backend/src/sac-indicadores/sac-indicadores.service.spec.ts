import { Test } from '@nestjs/testing';
import { SacIndicadoresService } from './sac-indicadores.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

describe('SacIndicadoresService (SAC 4c)', () => {
  let service: SacIndicadoresService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module = await Test.createTestingModule({
      providers: [SacIndicadoresService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(SacIndicadoresService);
  });

  it('sem equipe de SAC → tudo zerado (não consulta chamados)', async () => {
    prisma.equipe.findMany.mockResolvedValue([]);
    const r = await service.indicadores(6, 2026);
    expect(r.volume).toEqual({ abertosNoMes: 0, resolvidosNoMes: 0, backlogAtual: 0 });
    expect(r.tempoResolucaoMedioHoras).toBeNull();
    expect(prisma.chamado.count).not.toHaveBeenCalled();
  });

  it('com equipe SAC: agrega volume, canal, e-mail e tempo de resolução', async () => {
    prisma.equipe.findMany.mockResolvedValue([{ id: 'eq-sac', nome: 'SAC', sigla: 'SACAT' }]);
    prisma.chamado.count
      .mockResolvedValueOnce(10) // abertosNoMes
      .mockResolvedValueOnce(7) // resolvidosNoMes
      .mockResolvedValueOnce(4); // backlogAtual
    prisma.chamado.groupBy
      .mockResolvedValueOnce([{ canalOrigem: 'EMAIL', _count: { _all: 6 } }, { canalOrigem: null, _count: { _all: 4 } }]) // canal
      .mockResolvedValueOnce([{ equipeAtualId: 'eq-sac', _count: { _all: 10 } }]) // equipe
      .mockResolvedValueOnce([{ status: 'ABERTO', _count: { _all: 5 } }]); // status
    // 2 resolvidos: 2h e 4h → média 3h. 1º cumpriu o SLA, 2º estourou.
    prisma.chamado.findMany
      .mockResolvedValueOnce([
        { createdAt: new Date('2026-06-01T10:00:00Z'), dataResolucao: new Date('2026-06-01T12:00:00Z'), dataLimiteSla: new Date('2026-06-01T18:00:00Z') }, // cumprido
        { createdAt: new Date('2026-06-02T10:00:00Z'), dataResolucao: new Date('2026-06-02T14:00:00Z'), dataLimiteSla: new Date('2026-06-02T11:00:00Z') }, // estourado
      ])
      // backlog: 1 vencido (limite no passado) + 1 sem SLA
      .mockResolvedValueOnce([
        { createdAt: new Date('2020-01-01T00:00:00Z'), dataLimiteSla: new Date('2020-01-02T00:00:00Z') },
        { createdAt: new Date('2026-06-10T00:00:00Z'), dataLimiteSla: null },
      ]);
    prisma.sacEmailIngestao.groupBy.mockResolvedValue([
      { resultado: 'MATCHED', _count: { _all: 6 } },
      { resultado: 'UNMATCHED', _count: { _all: 3 } },
    ]);
    prisma.sacEmailIngestao.count.mockResolvedValue(2); // triagem pendente

    const r = await service.indicadores(6, 2026);
    expect(r.volume).toEqual({ abertosNoMes: 10, resolvidosNoMes: 7, backlogAtual: 4 });
    expect(r.tempoResolucaoMedioHoras).toBe(3);
    expect(r.porCanal[0]).toEqual({ canal: 'EMAIL', total: 6 });
    expect(r.porCanal.find((c) => c.canal === 'NAO_INFORMADO')?.total).toBe(4);
    expect(r.email).toMatchObject({ ingeridosNoMes: 9, casados: 6, triagem: 3, triagemPendente: 2 });
    // SLA: backlog 1 vencido + 1 sem SLA; mês 1 cumprido + 1 estourado (50%).
    expect(r.sla.backlog).toMatchObject({ vencidos: 1, semSla: 1 });
    expect(r.sla.mes).toMatchObject({ cumpridos: 1, estourados: 1, percentualCumprimento: 50 });
  });
});
