import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntregaService } from './entrega.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

/* eslint-disable @typescript-eslint/no-explicit-any */
const coreMock = () => ({ validarFilial: jest.fn().mockResolvedValue(undefined) }) as any;
const cofreMock = () => ({ gravar: jest.fn().mockResolvedValue({ comprovanteId: 'cmp1', objectKey: 'k', hash: 'h' }) }) as any;
// Operador da filial f1 (não vê outras filiais) — exercita o escopo por filial.
const userF1 = { sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'OPERADOR_ENTREGA' }] } as any;

describe('EntregaService', () => {
  let prisma: any;
  let core: any;
  let cofre: any;
  let svc: EntregaService;

  beforeEach(() => {
    prisma = createPrismaMock();
    core = coreMock();
    cofre = cofreMock();
    svc = new EntregaService(prisma, core, cofre);
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

  describe('baixar', () => {
    it('404 se a entrega não existe', async () => {
      prisma.entrega.findUnique.mockResolvedValue(null);
      await expect(svc.baixar('e1', { resultado: 'ENTREGUE' } as any, undefined, userF1)).rejects.toThrow(NotFoundException);
    });

    it('403 se a entrega é de outra filial (operador)', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'EM_VIAGEM', filialId: 'OUTRA', cupons: [], parada: null });
      await expect(svc.baixar('e1', { resultado: 'ENTREGUE' } as any, undefined, userF1)).rejects.toThrow(ForbiddenException);
    });

    it('400 se a entrega não está EM_VIAGEM (ainda não despachada)', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'PENDENTE', filialId: 'f1', numero: 1, cupons: [], parada: null });
      await expect(svc.baixar('e1', { resultado: 'ENTREGUE' } as any, undefined, userF1)).rejects.toThrow(BadRequestException);
    });

    it('idempotente: entrega já ENTREGUE devolve o estado atual sem regravar', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'ENTREGUE', filialId: 'f1', numero: 1, comprovanteId: 'cmp0', cupons: [], parada: null });
      const r = await svc.baixar('e1', { resultado: 'ENTREGUE' } as any, { buffer: Buffer.from('x'), mimetype: 'image/jpeg', size: 1 }, userF1);
      expect(r.status).toBe('ENTREGUE');
      expect(cofre.gravar).not.toHaveBeenCalled();
      expect(prisma.entrega.update).not.toHaveBeenCalled();
    });

    it('400 NAO_ENTREGUE sem motivo', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'EM_VIAGEM', filialId: 'f1', numero: 1, cupons: [], parada: { viagemId: 'v1' } });
      await expect(svc.baixar('e1', { resultado: 'NAO_ENTREGUE' } as any, undefined, userF1)).rejects.toThrow(BadRequestException);
    });

    it('ENTREGUE com prova grava no cofre e seta temComprovante/comprovanteId', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'EM_VIAGEM', filialId: 'f1', numero: 9, matricula: 'E01', cupons: [{ numeroCupom: 'C1' }], parada: { viagemId: 'v1' } });
      prisma.viagem.findUnique.mockResolvedValue({ situacao: 'EM_CURSO', veiculoId: 'vc1', paradas: [{ entrega: { status: 'ENTREGUE' } }] });
      prisma.entrega.update.mockResolvedValue({ id: 'e1', status: 'ENTREGUE', temComprovante: true, comprovanteId: 'cmp1', cupons: [] });
      const r = await svc.baixar('e1', { resultado: 'ENTREGUE', tipoProva: 'FOTO' } as any, { buffer: Buffer.from('img'), mimetype: 'image/jpeg', size: 3 }, userF1);
      expect(cofre.gravar).toHaveBeenCalledWith(expect.objectContaining({ entregaId: 'e1', entregaNumero: 9, filialId: 'f1', cupom: 'C1', tipo: 'FOTO' }));
      expect(r.temComprovante).toBe(true);
      // auto-conclusão: todas baixadas → conclui viagem + libera veículo
      expect(prisma.viagem.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ situacao: 'CONCLUIDA' }) }));
      expect(prisma.veiculo.update).toHaveBeenCalledWith(expect.objectContaining({ data: { situacao: 'DISPONIVEL' } }));
    });

    it('não conclui a viagem se ainda há entrega pendente de baixa', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'EM_VIAGEM', filialId: 'f1', numero: 9, cupons: [], parada: { viagemId: 'v1' } });
      prisma.viagem.findUnique.mockResolvedValue({ situacao: 'EM_CURSO', veiculoId: 'vc1', paradas: [{ entrega: { status: 'ENTREGUE' } }, { entrega: { status: 'EM_VIAGEM' } }] });
      prisma.entrega.update.mockResolvedValue({ id: 'e1', status: 'ENTREGUE', cupons: [] });
      await svc.baixar('e1', { resultado: 'ENTREGUE' } as any, undefined, userF1);
      expect(prisma.viagem.update).not.toHaveBeenCalled();
      expect(prisma.veiculo.update).not.toHaveBeenCalled();
    });
  });
});
