import { DespesaService } from './despesa.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

/* eslint-disable @typescript-eslint/no-explicit-any */
const dep = () => ({}) as any;
const sup = (sub = 'u1') => ({ sub, filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'SUPERVISOR_FROTA' }] }) as any;

// ⭐ Vazamento pego no teste E2E por API (12/07): GET /despesas?veiculoId=<fora do
// escopo> sobrepunha o filtro de escopo e retornava despesa de outro departamento.
describe('DespesaService — escopo da listagem (SUPERVISOR_FROTA)', () => {
  let prisma: any;
  let svc: DespesaService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new DespesaService(prisma, dep(), dep(), dep());
  });

  it('?veiculoId FORA do escopo → não vaza (retorna [] e nem consulta despesas)', async () => {
    prisma.veiculo.findMany
      .mockResolvedValueOnce([{ departamentoLotacaoId: 'd1' }]) // deptos supervisionados
      .mockResolvedValueOnce([{ id: 'v-in' }]); // veículos do depto (escopo)
    const r = await svc.listar(sup(), 'SUPERVISOR_FROTA', { veiculoId: 'v-out' } as any);
    expect(r).toEqual([]);
    expect(prisma.despesaVeiculo.findMany).not.toHaveBeenCalled();
  });

  it('?veiculoId DENTRO do escopo → filtra por ele', async () => {
    prisma.veiculo.findMany
      .mockResolvedValueOnce([{ departamentoLotacaoId: 'd1' }])
      .mockResolvedValueOnce([{ id: 'v-in' }]);
    prisma.despesaVeiculo.findMany.mockResolvedValue([]);
    await svc.listar(sup(), 'SUPERVISOR_FROTA', { veiculoId: 'v-in' } as any);
    expect(prisma.despesaVeiculo.findMany.mock.calls[0][0].where.veiculoId).toBe('v-in');
  });

  it('sem filtro → veículos do escopo OU despesa de INDIVÍDUO (sem veículo) de viagem de frota do depto', async () => {
    prisma.veiculo.findMany
      .mockResolvedValueOnce([{ departamentoLotacaoId: 'd1' }]) // deptos supervisionados
      .mockResolvedValueOnce([{ id: 'v-in' }]); // veículos do depto (escopo)
    prisma.despesaVeiculo.findMany.mockResolvedValue([]);
    await svc.listar(sup(), 'SUPERVISOR_FROTA', {} as any);
    const where = prisma.despesaVeiculo.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { veiculoId: { in: ['v-in'] } },
      { veiculoId: null, viagem: { tipo: 'FROTA', veiculo: { departamentoLotacaoId: { in: ['d1'] } } } },
    ]);
  });
});
