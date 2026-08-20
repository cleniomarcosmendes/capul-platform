import { Test } from '@nestjs/testing';
import { DashboardIndicadoresService } from './dashboard-indicadores.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ChamadoExternoService } from '../../chamado-externo/chamado-externo.service';
import { createPrismaMock } from '../../common/testing/prisma-mock';

/**
 * A regra que este teste protege: **item de nota fiscal SEM centro de custo não
 * pode derrubar o indicador — ele entra num balde próprio.**
 *
 * Incidente de 20/08/2026, produção. A tela de Notas Fiscais e o Dashboard de
 * investimento devolviam 500:
 *
 *   Error converting field "centroCustoId" of expected non-nullable type
 *   "String", found incompatible value of "null"   (Prisma P2032)
 *
 * Duas causas somadas, ambas silenciosas:
 *  1. a coluna `centro_custo_id` é NULLABLE no banco desde 06/04 (a migration
 *     criou assim de propósito e o `NOT NULL` nunca veio), enquanto o schema
 *     Prisma a declarava obrigatória — o cliente acreditava numa garantia que
 *     não existia;
 *  2. a FK era `ON DELETE SET NULL`: excluir um centro de custo no Configurador
 *     **zerava** o campo nos itens de nota fiscal e devolvia "excluído com
 *     sucesso", destruindo o rateio do histórico sem avisar ninguém.
 *
 * O efeito de UMA linha assim é desproporcional: o Prisma falha ao converter e
 * a QUERY INTEIRA morre, então a lista vem **vazia** em vez de vir incompleta —
 * e o operador vê "Nenhuma nota fiscal encontrada", que parece base zerada.
 *
 * A FK virou RESTRICT (migration 20260820120000), mas os NULLs históricos
 * continuam lá: é por isso que a agregação precisa tolerá-los para sempre.
 */
describe('Dashboard de investimento — item sem centro de custo', () => {
  let service: DashboardIndicadoresService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const item = (valor: number, cc: { id: string; codigo: string; nome: string } | null) => ({
    valorTotal: valor,
    centroCustoId: cc?.id ?? null,
    centroCusto: cc,
    produto: { tipoProduto: { id: 'tp1', descricao: 'Serviço' } },
  });

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module = await Test.createTestingModule({
      providers: [
        DashboardIndicadoresService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChamadoExternoService, useValue: {} },
      ],
    }).compile();
    service = module.get(DashboardIndicadoresService);
  });

  it('soma o valor e rotula "Sem centro de custo" em vez de estourar', async () => {
    const CC = { id: 'cc1', codigo: '101', nome: 'T.I.' };
    prisma.notaFiscal.findMany.mockResolvedValue([
      {
        valorTotal: 300,
        departamento: { id: 'd1', nome: 'T.I.' },
        // ⭐ o item órfão convive com um item normal na MESMA nota
        itens: [item(100, CC), item(200, null)],
      },
    ]);
    prisma.contratoParcela.findMany.mockResolvedValue([]);

    // ADMIN (role) escapa o filtro departamental — o foco aqui é o centro de custo.
    const r = await service.getInvestimentoAnalitico(8, 2026, undefined, 'ADMIN');

    const baldes = (r as { porCentroCusto?: { label: string; valor: number }[] }).porCentroCusto ?? [];
    const semCC = baldes.find((b) => b.label === 'Sem centro de custo');

    expect(semCC).toBeDefined();          // ⭐ apareceu, em vez de sumir
    expect(semCC!.valor).toBe(200);       // ⭐ e o dinheiro continua contabilizado
    expect(baldes.find((b) => b.label === '101 · T.I.')?.valor).toBe(100);
  });
});
