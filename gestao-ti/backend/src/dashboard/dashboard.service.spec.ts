import { Test } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    // Setup default aggregate returns
    prisma.softwareLicenca.aggregate.mockResolvedValue({ _sum: { valorTotal: 1000 } });
    prisma.contrato.aggregate.mockResolvedValue({ _sum: { valorTotal: 5000 } });
    prisma.projeto.aggregate.mockResolvedValue({ _sum: { custoPrevisto: 10000, custoRealizado: 8000 } });
    prisma.apontamentoHoras.aggregate.mockResolvedValue({ _sum: { horas: 200 } });

    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  describe('getResumo', () => {
    it('retorna estrutura completa do dashboard', async () => {
      prisma.chamado.count.mockResolvedValue(5);
      prisma.chamado.groupBy.mockResolvedValue([]);
      prisma.equipeTI.findMany.mockResolvedValue([]);
      prisma.ordemServico.count.mockResolvedValue(2);
      prisma.software.count.mockResolvedValue(10);
      prisma.softwareLicenca.count.mockResolvedValue(8);
      prisma.contrato.count.mockResolvedValue(3);
      prisma.parcelaContrato.count.mockResolvedValue(1);
      prisma.registroParada.count.mockResolvedValue(0);
      prisma.projeto.count.mockResolvedValue(4);
      prisma.riscoProjeto.count.mockResolvedValue(2);
      prisma.ativo.count.mockResolvedValue(50);
      prisma.artigoConhecimento.count.mockResolvedValue(12);

      const result = await service.getResumo();

      expect(result).toHaveProperty('chamados');
      expect(result).toHaveProperty('porEquipe');
      expect(result).toHaveProperty('porPrioridade');
      expect(result).toHaveProperty('ordensServico');
      expect(result).toHaveProperty('portfolio');
      expect(result).toHaveProperty('contratos');
      expect(result).toHaveProperty('sustentacao');
      expect(result).toHaveProperty('projetos');
      expect(result).toHaveProperty('ativos');
      expect(result).toHaveProperty('conhecimento');
    });

    it('calcula porEquipe com dados do groupBy', async () => {
      prisma.chamado.groupBy.mockResolvedValueOnce([
        { equipeAtualId: 'eq-1', _count: 3 },
        { equipeAtualId: 'eq-2', _count: 5 },
      ]);
      prisma.chamado.groupBy.mockResolvedValueOnce([]); // porPrioridade
      prisma.equipeTI.findMany.mockResolvedValue([
        { id: 'eq-1', nome: 'Suporte', sigla: 'SUP', cor: '#333' },
        { id: 'eq-2', nome: 'Infra', sigla: 'INF', cor: '#666' },
      ]);

      const result = await service.getResumo();

      expect(result.porEquipe).toHaveLength(2);
      expect(result.porEquipe[0]).toEqual({
        equipe: { id: 'eq-1', nome: 'Suporte', sigla: 'SUP', cor: '#333' },
        total: 3,
      });
    });
  });

  describe('getExecutivo', () => {
    it('retorna todas as secoes do dashboard executivo', async () => {
      prisma.chamado.findMany.mockResolvedValue([]);
      prisma.registroParada.findMany.mockResolvedValue([]);
      prisma.ativo.groupBy.mockResolvedValue([]);

      const result = await service.getExecutivo();

      expect(result).toHaveProperty('chamados');
      expect(result).toHaveProperty('contratos');
      expect(result).toHaveProperty('sustentacao');
      expect(result).toHaveProperty('projetos');
      expect(result).toHaveProperty('portfolio');
      expect(result).toHaveProperty('ativos');
      expect(result).toHaveProperty('conhecimento');
    });

    it('calcula SLA compliance corretamente', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 86400000); // +1 day
      const pastDate = new Date(now.getTime() - 86400000); // -1 day

      // chamadosFechadosParaSla - 3 chamados, 2 dentro do SLA
      prisma.chamado.findMany
        .mockResolvedValueOnce([
          { dataResolucao: pastDate, dataLimiteSla: futureDate }, // dentro
          { dataResolucao: pastDate, dataLimiteSla: futureDate }, // dentro
          { dataResolucao: futureDate, dataLimiteSla: pastDate }, // fora
        ])
        .mockResolvedValueOnce([]); // chamadosResolvidosRecentes

      prisma.registroParada.findMany.mockResolvedValue([]);
      prisma.ativo.groupBy.mockResolvedValue([]);

      const result = await service.getExecutivo();

      // 2 de 3 dentro do SLA = 66.7%
      expect(result.chamados.slaCompliancePercent).toBeCloseTo(66.7, 0);
    });
  });
});
