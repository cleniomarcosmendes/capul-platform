import { NotFoundException } from '@nestjs/common';
import { FrotaService } from './frota.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

/* eslint-disable @typescript-eslint/no-explicit-any */
const dep = () => ({}) as any;
const comRole = (role: string, sub = 'u1') => ({ sub, filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role }] }) as any;

describe('FrotaService — escopo de visibilidade das viagens de frota', () => {
  let prisma: any;
  let svc: FrotaService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new FrotaService(prisma, dep(), dep(), dep());
  });

  // ⭐ Vazamento pego 05/07: a lista mostrava TODAS as viagens da filial p/ qualquer papel.
  it('listar (operador): filtra pelas SUAS — criadoPorId OU supervisor do veículo', async () => {
    prisma.viagem.findMany.mockResolvedValue([]);
    await svc.listar(comRole('OPERADOR_ENTREGA'));
    const where = prisma.viagem.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ criadoPorId: 'u1' }, { veiculo: { supervisorId: 'u1' } }]);
  });

  it('listar (Gestor de Frota): SEM filtro — vê todas da filial', async () => {
    prisma.viagem.findMany.mockResolvedValue([]);
    await svc.listar(comRole('GESTOR_FROTA'));
    expect(prisma.viagem.findMany.mock.calls[0][0].where.OR).toBeUndefined();
  });

  it('listar (ADMIN): SEM filtro', async () => {
    prisma.viagem.findMany.mockResolvedValue([]);
    await svc.listar(comRole('ADMIN'));
    expect(prisma.viagem.findMany.mock.calls[0][0].where.OR).toBeUndefined();
  });

  it('obterViagem (operador) de viagem que NÃO é dele → 404 (não vaza)', async () => {
    prisma.viagem.findFirst.mockResolvedValue({ id: 'v1', criadoPorId: 'OUTRO', veiculo: { supervisorId: 'OUTRO' }, _count: { paradas: 0 } });
    await expect(svc.obterViagem('v1', comRole('OPERADOR_ENTREGA'))).rejects.toThrow(NotFoundException);
  });

  it('obterViagem (operador) da SUA viagem (registrante) → ok', async () => {
    prisma.viagem.findFirst.mockResolvedValue({ id: 'v1', criadoPorId: 'u1', veiculo: { supervisorId: 'OUTRO', placa: 'ABC', modelo: 'X' }, _count: { paradas: 0 } });
    await expect(svc.obterViagem('v1', comRole('OPERADOR_ENTREGA'))).resolves.toMatchObject({ id: 'v1' });
  });

  it('despesasDaViagem (operador) de viagem alheia → 404', async () => {
    prisma.viagem.findFirst.mockResolvedValue({ id: 'v1', criadoPorId: 'OUTRO', veiculo: { supervisorId: 'OUTRO' } });
    await expect(svc.despesasDaViagem('v1', comRole('OPERADOR_ENTREGA'))).rejects.toThrow(NotFoundException);
  });

  // ⭐ Supervisor de Departamento (SUPERVISOR_FROTA): escopo POR DEPARTAMENTO
  // (departamentos onde é encarregado de ≥1 veículo), não por veículo individual.
  it('listar (Supervisor de Departamento): filtra por criadoPorId OU veículo do(s) seu(s) departamento(s)', async () => {
    prisma.veiculo.findMany.mockResolvedValue([{ departamentoLotacaoId: 'd1' }]); // deptosSupervisionados
    prisma.viagem.findMany.mockResolvedValue([]);
    await svc.listar(comRole('SUPERVISOR_FROTA'));
    const where = prisma.viagem.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ criadoPorId: 'u1' }, { veiculo: { departamentoLotacaoId: { in: ['d1'] } } }]);
  });

  it('obterViagem (Supervisor de Departamento) de veículo do SEU depto → ok', async () => {
    prisma.veiculo.findMany.mockResolvedValue([{ departamentoLotacaoId: 'd1' }]);
    prisma.viagem.findFirst.mockResolvedValue({ id: 'v1', criadoPorId: 'OUTRO', veiculo: { supervisorId: 'OUTRO', departamentoLotacaoId: 'd1', placa: 'ABC', modelo: 'X' }, _count: { paradas: 0 } });
    await expect(svc.obterViagem('v1', comRole('SUPERVISOR_FROTA'))).resolves.toMatchObject({ id: 'v1' });
  });

  it('obterViagem (Supervisor de Departamento) de veículo de OUTRO depto → 404', async () => {
    prisma.veiculo.findMany.mockResolvedValue([{ departamentoLotacaoId: 'd1' }]);
    prisma.viagem.findFirst.mockResolvedValue({ id: 'v1', criadoPorId: 'OUTRO', veiculo: { supervisorId: 'OUTRO', departamentoLotacaoId: 'd2' }, _count: { paradas: 0 } });
    await expect(svc.obterViagem('v1', comRole('SUPERVISOR_FROTA'))).rejects.toThrow(NotFoundException);
  });
});

// O custo da manutenção era gravado em manutencao_veiculo.custo e NUNCA somado —
// Análise e indicadores leem só despesa_veiculo. Estes testes travam a correção:
// custo → despesa (uma, aprovada, vinculada); sem custo → nenhuma despesa.
describe('FrotaService — manutenção com custo gera despesa', () => {
  let prisma: any;
  let svc: FrotaService;
  const gestor = comRole('GESTOR_FROTA');

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new FrotaService(prisma, dep(), dep(), dep());
    prisma.veiculo.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', kmAtual: 1000, intervaloManutencaoKm: 10000, supervisorId: 'u1' });
    prisma.veiculo.update.mockResolvedValue({ id: 'v1' });
    prisma.tipoDespesa.findFirst.mockResolvedValue({ id: 'tp-manut', nome: 'Manutenção', ativo: true });
    prisma.despesaVeiculo.create.mockResolvedValue({ id: 'desp-1' });
    prisma.manutencaoVeiculo.create.mockResolvedValue({ id: 'm1' });
  });

  it('com custo → cria 1 despesa APROVADA no veículo e vincula à manutenção', async () => {
    await svc.registrarManutencao('v1', { custo: 450.5, km: 1200, observacao: 'Troca de óleo' } as any, gestor, 'GESTOR_FROTA');

    expect(prisma.despesaVeiculo.create).toHaveBeenCalledTimes(1);
    const despesa = prisma.despesaVeiculo.create.mock.calls[0][0].data;
    expect(despesa).toMatchObject({
      filialId: 'f1',
      veiculoId: 'v1',
      tipoDespesaId: 'tp-manut',
      situacao: 'APROVADA',
      semNota: true,
    });
    expect(Number(despesa.valor)).toBe(450.5);
    expect(despesa.observacao).toContain('KM 1200');

    // O vínculo é o que impede custo órfão e contagem dupla.
    expect(prisma.manutencaoVeiculo.create.mock.calls[0][0].data.despesaId).toBe('desp-1');
  });

  it('sem custo → NÃO cria despesa (manutenção segue sendo só histórico de KM)', async () => {
    await svc.registrarManutencao('v1', { km: 1200 } as any, gestor, 'GESTOR_FROTA');
    expect(prisma.despesaVeiculo.create).not.toHaveBeenCalled();
    expect(prisma.manutencaoVeiculo.create.mock.calls[0][0].data.despesaId).toBeNull();
  });

  it('custo zero → NÃO cria despesa (lançamento de R$ 0 só polui a Análise)', async () => {
    await svc.registrarManutencao('v1', { custo: 0, km: 1200 } as any, gestor, 'GESTOR_FROTA');
    expect(prisma.despesaVeiculo.create).not.toHaveBeenCalled();
  });

  it('tipo "Manutenção" desativado → reativa em vez de estourar no meio do registro', async () => {
    prisma.tipoDespesa.findFirst.mockResolvedValue({ id: 'tp-manut', nome: 'Manutenção', ativo: false });
    prisma.tipoDespesa.update.mockResolvedValue({ id: 'tp-manut', ativo: true });
    await svc.registrarManutencao('v1', { custo: 100 } as any, gestor, 'GESTOR_FROTA');
    expect(prisma.tipoDespesa.update).toHaveBeenCalledWith({ where: { id: 'tp-manut' }, data: { ativo: true } });
    expect(prisma.despesaVeiculo.create).toHaveBeenCalledTimes(1);
  });
});
