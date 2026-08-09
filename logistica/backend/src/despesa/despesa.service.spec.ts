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
    const r = await svc.listar(sup(), ['SUPERVISOR_FROTA'], { veiculoId: 'v-out' } as any);
    expect(r).toEqual([]);
    expect(prisma.despesaVeiculo.findMany).not.toHaveBeenCalled();
  });

  it('?veiculoId DENTRO do escopo → filtra por ele', async () => {
    prisma.veiculo.findMany
      .mockResolvedValueOnce([{ departamentoLotacaoId: 'd1' }])
      .mockResolvedValueOnce([{ id: 'v-in' }]);
    prisma.despesaVeiculo.findMany.mockResolvedValue([]);
    await svc.listar(sup(), ['SUPERVISOR_FROTA'], { veiculoId: 'v-in' } as any);
    expect(prisma.despesaVeiculo.findMany.mock.calls[0][0].where.veiculoId).toBe('v-in');
  });

  it('sem filtro → veículos do escopo OU despesa de INDIVÍDUO (sem veículo) de viagem de frota do depto', async () => {
    prisma.veiculo.findMany
      .mockResolvedValueOnce([{ departamentoLotacaoId: 'd1' }]) // deptos supervisionados
      .mockResolvedValueOnce([{ id: 'v-in' }]); // veículos do depto (escopo)
    prisma.despesaVeiculo.findMany.mockResolvedValue([]);
    await svc.listar(sup(), ['SUPERVISOR_FROTA'], {} as any);
    const where = prisma.despesaVeiculo.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { veiculoId: { in: ['v-in'] } },
      { veiculoId: null, viagem: { tipo: 'FROTA', veiculo: { departamentoLotacaoId: { in: ['d1'] } } } },
    ]);
  });
});

/**
 * ⭐ 5b (09/08) — quem aprova a despesa de frota.
 *
 * Antes a autoridade era derivada do CADASTRO DO VEÍCULO: pegar um carro de outro
 * departamento mandava a aprovação para um gerente sem nenhuma relação com quem
 * gastou. Agora ela vem da PERMISSÃO (papel por departamento) e o departamento é o
 * RETRATO gravado na viagem no ato da saída.
 */
describe('DespesaService.aprovar — autoridade por DEPARTAMENTO (5b)', () => {
  let prisma: any;
  let svc: DespesaService;

  /** Usuário com SUPERVISOR_FROTA nos departamentos informados (multi-role no JWT). */
  const supDe = (...deptos: string[]) =>
    ({
      sub: 'u1',
      filialId: 'f1',
      modulos: [{
        codigo: 'LOGISTICA',
        role: 'SUPERVISOR_FROTA',
        departamentos: deptos.map((id) => ({ id, nome: id, role: 'SUPERVISOR_FROTA' })),
      }],
    }) as any;

  const despesaPendente = (viagemId: string | null) => ({
    id: 'dsp1', filialId: 'f1', situacao: 'PENDENTE', criadoPorId: 'quem-gastou',
    veiculoId: 'v1', viagemId,
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new DespesaService(prisma, dep(), dep(), dep());
    prisma.despesaVeiculo.update.mockResolvedValue({ id: 'dsp1' });
  });

  it('supervisor do departamento GRAVADO na viagem → aprova', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesaPendente('vg1'));
    prisma.viagem.findUnique.mockResolvedValue({ departamentoAprovadorId: 'dA' });
    await expect(svc.aprovar('dsp1', supDe('dA'), ['SUPERVISOR_FROTA'])).resolves.toBeDefined();
  });

  // ⭐ O caso relatado: o carro é de outro depto, mas quem gastou não é de lá.
  it('supervisor de OUTRO departamento → recusa, mesmo sendo o do veículo', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesaPendente('vg1'));
    prisma.viagem.findUnique.mockResolvedValue({ departamentoAprovadorId: 'dA' });
    await expect(svc.aprovar('dsp1', supDe('dB'), ['SUPERVISOR_FROTA'])).rejects.toThrow(/supervisor de departamento/i);
  });

  it('multi-role: responde por 2 deptos e a viagem é de um deles → aprova', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesaPendente('vg1'));
    prisma.viagem.findUnique.mockResolvedValue({ departamentoAprovadorId: 'dB' });
    await expect(svc.aprovar('dsp1', supDe('dA', 'dB'), ['SUPERVISOR_FROTA'])).resolves.toBeDefined();
  });

  it('ADMIN aprova sem depender de departamento', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesaPendente('vg1'));
    const admin = { sub: 'a1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'ADMIN' }] } as any;
    await expect(svc.aprovar('dsp1', admin, ['ADMIN'])).resolves.toBeDefined();
  });

  // Viagem antiga (anterior à mudança) não tem o retrato: cai na regra de antes,
  // seguindo o departamento de quem lançou. Sem isso, despesa velha ficaria órfã.
  it('viagem SEM retrato → volta ao departamento de quem lançou', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesaPendente('vg-antiga'));
    prisma.viagem.findUnique.mockResolvedValue({ departamentoAprovadorId: null });
    prisma.$queryRaw.mockResolvedValue([{ departamento_id: 'dLegado' }]);
    await expect(svc.aprovar('dsp1', supDe('dLegado'), ['SUPERVISOR_FROTA'])).resolves.toBeDefined();
  });

  it('GESTOR_FROTA não aprova acerto (só contesta) — regra preservada', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesaPendente('vg1'));
    prisma.viagem.findUnique.mockResolvedValue({ departamentoAprovadorId: 'dA' });
    const gestor = { sub: 'g1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'GESTOR_FROTA' }] } as any;
    await expect(svc.aprovar('dsp1', gestor, ['GESTOR_FROTA'])).rejects.toThrow(/gestor de frota/i);
  });
});
