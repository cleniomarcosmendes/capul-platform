import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ViagemService } from './viagem.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

/* eslint-disable @typescript-eslint/no-explicit-any */
const coreMock = () => ({ validarUsuario: jest.fn().mockResolvedValue(undefined), nomesUsuarios: jest.fn().mockResolvedValue(new Map()) }) as any;

describe('ViagemService', () => {
  let prisma: any;
  let svc: ViagemService;

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new ViagemService(prisma, coreMock());
  });

  describe('despachar', () => {
    it('404 se a viagem não existe', async () => {
      prisma.viagem.findUnique.mockResolvedValue(null);
      await expect(svc.despachar('v1', {} as any, 'f1')).rejects.toThrow(NotFoundException);
    });
    it('403 se a viagem é de outra filial', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f2', situacao: 'RASCUNHO', paradas: [{ entregaId: 'e1' }] });
      await expect(svc.despachar('v1', {} as any, 'f1')).rejects.toThrow(ForbiddenException);
    });
    it('400 se não está em RASCUNHO', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', situacao: 'EM_CURSO', paradas: [{ entregaId: 'e1' }] });
      await expect(svc.despachar('v1', {} as any, 'f1')).rejects.toThrow(BadRequestException);
    });
    it('400 se a viagem não tem paradas', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', situacao: 'RASCUNHO', paradas: [] });
      await expect(svc.despachar('v1', {} as any, 'f1')).rejects.toThrow(BadRequestException);
    });
    it('400 se rascunho ainda não tem veículo/motorista (12/06)', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', veiculoId: null, motoristaId: null, situacao: 'RASCUNHO', paradas: [{ entregaId: 'e1' }] });
      await expect(svc.despachar('v1', {} as any, 'f1')).rejects.toThrow('Defina veículo e motorista');
    });
    it('400 se o veículo não está DISPONIVEL', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', veiculoId: 'vc1', motoristaId: 'm1', situacao: 'RASCUNHO', paradas: [{ entregaId: 'e1' }] });
      prisma.veiculo.findUnique.mockResolvedValue({ id: 'vc1', situacao: 'EM_USO' });
      await expect(svc.despachar('v1', {} as any, 'f1')).rejects.toThrow(BadRequestException);
    });
    it('happy path: entregas→EM_VIAGEM, veículo→EM_USO, viagem→EM_CURSO', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', veiculoId: 'vc1', motoristaId: 'm1', situacao: 'RASCUNHO', paradas: [{ entregaId: 'e1' }, { entregaId: 'e2' }] });
      prisma.veiculo.findUnique.mockResolvedValue({ id: 'vc1', situacao: 'DISPONIVEL' });
      prisma.viagem.update.mockResolvedValue({ id: 'v1', situacao: 'EM_CURSO' });
      await svc.despachar('v1', {} as any, 'f1');
      expect(prisma.entrega.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'EM_VIAGEM' } }));
      expect(prisma.veiculo.update).toHaveBeenCalledWith(expect.objectContaining({ data: { situacao: 'EM_USO' } }));
      expect(prisma.viagem.update).toHaveBeenCalled();
    });
  });

  describe('concluir', () => {
    it('400 se não está EM_CURSO', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', situacao: 'RASCUNHO', paradas: [] });
      await expect(svc.concluir('v1', 'f1')).rejects.toThrow(BadRequestException);
    });
    it('happy path: entregas→ENTREGUE, veículo→DISPONIVEL', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', veiculoId: 'vc1', situacao: 'EM_CURSO', paradas: [{ entregaId: 'e1' }] });
      prisma.viagem.update.mockResolvedValue({ id: 'v1', situacao: 'CONCLUIDA' });
      await svc.concluir('v1', 'f1');
      expect(prisma.entrega.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'ENTREGUE' } }));
      expect(prisma.veiculo.update).toHaveBeenCalledWith(expect.objectContaining({ data: { situacao: 'DISPONIVEL' } }));
    });
  });

  describe('removerEntrega', () => {
    it('400 se a viagem não está em RASCUNHO', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', situacao: 'EM_CURSO', paradas: [{ id: 'p1', entregaId: 'e1', sequencia: 1 }] });
      await expect(svc.removerEntrega('v1', 'e1', 'f1')).rejects.toThrow(BadRequestException);
    });
    it('404 se a entrega não está na viagem', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', situacao: 'RASCUNHO', paradas: [{ id: 'p1', entregaId: 'e1', sequencia: 1 }] });
      await expect(svc.removerEntrega('v1', 'eX', 'f1')).rejects.toThrow(NotFoundException);
    });
    it('happy path: apaga a parada e re-sequencia as demais', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', situacao: 'RASCUNHO', paradas: [{ id: 'p1', entregaId: 'e1', sequencia: 1 }, { id: 'p2', entregaId: 'e2', sequencia: 2 }] });
      await svc.removerEntrega('v1', 'e1', 'f1');
      expect(prisma.parada.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
      expect(prisma.parada.update).toHaveBeenCalledWith({ where: { id: 'p2' }, data: { sequencia: 1 } });
    });
  });

  describe('descartar', () => {
    it('400 se não está em RASCUNHO', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', situacao: 'EM_CURSO', paradas: [] });
      await expect(svc.descartar('v1', 'f1')).rejects.toThrow(BadRequestException);
    });
    it('403 se de outra filial', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f2', situacao: 'RASCUNHO', paradas: [] });
      await expect(svc.descartar('v1', 'f1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne (escopo de filial — F1)', () => {
    const op = (f: string) => ({ sub: 'u', filialId: f, modulos: [{ codigo: 'LOGISTICA', role: 'OPERADOR_ENTREGA' }] }) as any;
    it('OPERADOR NÃO vê viagem de outra filial (403)', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f2', paradas: [] });
      await expect(svc.findOne('v1', op('f1'))).rejects.toThrow(ForbiddenException);
    });
    it('OPERADOR vê viagem da própria filial', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', paradas: [] });
      await expect(svc.findOne('v1', op('f1'))).resolves.toBeTruthy();
    });
    it('sem user (chamada interna) não aplica escopo', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f2', paradas: [] });
      await expect(svc.findOne('v1')).resolves.toBeTruthy();
    });
  });
});
