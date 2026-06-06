import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntregaService } from './entrega.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

/* eslint-disable @typescript-eslint/no-explicit-any */
const coreMock = () => ({ validarFilial: jest.fn().mockResolvedValue(undefined) }) as any;

describe('EntregaService', () => {
  let prisma: any;
  let core: any;
  let svc: EntregaService;

  beforeEach(() => {
    prisma = createPrismaMock();
    core = coreMock();
    svc = new EntregaService(prisma, core);
  });

  describe('create', () => {
    it('valida a filial no core e numera a entrega', async () => {
      prisma.contadorSequencial.upsert.mockResolvedValue({ ultimoNumero: 7 });
      prisma.entrega.create.mockResolvedValue({ id: 'e1', numero: 7, cupons: [] });
      const dto = { filialId: 'f1', tipoCliente: 'EVENTUAL', destinatarioNome: 'Cliente X', endLogradouro: 'Rua A', quantidadeVolumes: 1 } as any;
      const r = await svc.create(dto, 'u1');
      expect(core.validarFilial).toHaveBeenCalledWith('f1');
      expect(prisma.entrega.create).toHaveBeenCalled();
      expect(r.numero).toBe(7);
    });
  });

  describe('cancelar', () => {
    it('404 se a entrega não existe', async () => {
      prisma.entrega.findUnique.mockResolvedValue(null);
      await expect(svc.cancelar('e1', undefined, 'u1', 'f1')).rejects.toThrow(NotFoundException);
    });
    it('403 se a entrega é de outra filial', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ status: 'PENDENTE', filialId: 'f2', parada: null });
      await expect(svc.cancelar('e1', undefined, 'u1', 'f1')).rejects.toThrow(ForbiddenException);
    });
    it('400 se a entrega não está PENDENTE', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ status: 'EM_VIAGEM', filialId: 'f1', parada: null });
      await expect(svc.cancelar('e1', undefined, 'u1', 'f1')).rejects.toThrow(BadRequestException);
    });
    it('400 se a entrega já está montada numa viagem (parada)', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ status: 'PENDENTE', filialId: 'f1', parada: { viagem: { numero: 5 } } });
      await expect(svc.cancelar('e1', undefined, 'u1', 'f1')).rejects.toThrow(BadRequestException);
    });
    it('happy path: cancela a entrega PENDENTE livre', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ status: 'PENDENTE', filialId: 'f1', parada: null });
      prisma.entrega.update.mockResolvedValue({ id: 'e1', status: 'CANCELADA', cupons: [] });
      const r = await svc.cancelar('e1', 'cliente desistiu', 'u1', 'f1');
      expect(prisma.entrega.update).toHaveBeenCalled();
      expect(r.status).toBe('CANCELADA');
    });
  });
});
