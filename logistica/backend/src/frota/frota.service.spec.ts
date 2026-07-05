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
});
