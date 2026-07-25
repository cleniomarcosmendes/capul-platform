import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntregaService } from './entrega.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

/* eslint-disable @typescript-eslint/no-explicit-any */
const coreMock = () => ({ validarFilial: jest.fn().mockResolvedValue(undefined), colaboradorDoUsuario: jest.fn().mockResolvedValue(null) }) as any;
const cofreMock = () => ({ gravar: jest.fn().mockResolvedValue({ comprovanteId: 'cmp1', objectKey: 'k', hash: 'h' }) }) as any;
const geocodeMock = () => ({ geocodificar: jest.fn().mockResolvedValue(null), statusCacheLote: jest.fn().mockResolvedValue([]) }) as any;
const condutorMock = () => ({ validar: jest.fn().mockResolvedValue({ status: 'VALIDO', matricula: 'E00001', nome: 'Op' }) }) as any;
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
    svc = new EntregaService(prisma, core, cofre, geocodeMock(), condutorMock());
  });

  describe('create', () => {
    it('valida a filial no core e numera a entrega', async () => {
      prisma.contadorSequencial.upsert.mockResolvedValue({ ultimoNumero: 7 });
      prisma.entrega.create.mockResolvedValue({ id: 'e1', numero: 7, cupons: [] });
      const dto = { filialId: 'f1', tipoCliente: 'EVENTUAL', destinatarioNome: 'Cliente X', endLogradouro: 'Rua A', quantidadeVolumes: 1 } as any;
      const r = await svc.create(dto, userF1);
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
      await expect(svc.baixar('e1', { resultado: 'ENTREGUE' } as any, {}, userF1)).rejects.toThrow(NotFoundException);
    });

    it('403 se a entrega é de outra filial (operador)', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'EM_VIAGEM', filialId: 'OUTRA', cupons: [], parada: null });
      await expect(svc.baixar('e1', { resultado: 'ENTREGUE' } as any, {}, userF1)).rejects.toThrow(ForbiddenException);
    });

    it('400 se a entrega não está EM_VIAGEM (ainda não despachada)', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'PENDENTE', filialId: 'f1', numero: 1, cupons: [], parada: null });
      await expect(svc.baixar('e1', { resultado: 'ENTREGUE' } as any, {}, userF1)).rejects.toThrow(BadRequestException);
    });

    it('idempotente: entrega já ENTREGUE devolve o estado atual sem regravar', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'ENTREGUE', filialId: 'f1', numero: 1, comprovanteId: 'cmp0', cupons: [], parada: null });
      const r = await svc.baixar('e1', { resultado: 'ENTREGUE' } as any, { foto: { buffer: Buffer.from('x'), mimetype: 'image/jpeg', size: 1 } }, userF1);
      expect(r.status).toBe('ENTREGUE');
      expect(cofre.gravar).not.toHaveBeenCalled();
      expect(prisma.entrega.update).not.toHaveBeenCalled();
    });

    it('400 NAO_ENTREGUE sem motivo', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'EM_VIAGEM', filialId: 'f1', numero: 1, cupons: [], parada: { viagemId: 'v1' } });
      await expect(svc.baixar('e1', { resultado: 'NAO_ENTREGUE' } as any, {}, userF1)).rejects.toThrow(BadRequestException);
    });

    it('ENTREGUE com prova grava no cofre e seta temComprovante/comprovanteId', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'EM_VIAGEM', filialId: 'f1', numero: 9, matricula: 'E01', cupons: [{ numeroCupom: 'C1' }], parada: { viagemId: 'v1' } });
      prisma.viagem.findUnique.mockResolvedValue({ situacao: 'EM_CURSO', veiculoId: 'vc1', paradas: [{ entrega: { status: 'ENTREGUE' } }] });
      prisma.entrega.update.mockResolvedValue({ id: 'e1', status: 'ENTREGUE', temComprovante: true, comprovanteId: 'cmp1', cupons: [] });
      const r = await svc.baixar('e1', { resultado: 'ENTREGUE', tipoProva: 'FOTO' } as any, { foto: { buffer: Buffer.from('img'), mimetype: 'image/jpeg', size: 3 } }, userF1);
      expect(cofre.gravar).toHaveBeenCalledWith(expect.objectContaining({ entregaId: 'e1', entregaNumero: 9, filialId: 'f1', cupom: 'C1', tipo: 'FOTO' }));
      expect(r.temComprovante).toBe(true);
      // Auto-conclusão DESLIGADA (30/06): a baixa NÃO fecha mais a viagem — o
      // encerramento é explícito (ViagemService.concluir) p/ capturar o KM final.
      expect(prisma.viagem.update).not.toHaveBeenCalled();
      expect(prisma.veiculo.update).not.toHaveBeenCalled();
    });

    it('aceita FOTO + ASSINATURA juntas → grava 2 comprovantes no cofre', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'EM_VIAGEM', filialId: 'f1', numero: 9, cupons: [], parada: { viagemId: 'v1' } });
      prisma.entrega.update.mockResolvedValue({ id: 'e1', status: 'ENTREGUE', cupons: [] });
      await svc.baixar('e1', { resultado: 'ENTREGUE' } as any, { foto: { buffer: Buffer.from('f'), mimetype: 'image/jpeg', size: 1 }, assinatura: { buffer: Buffer.from('a'), mimetype: 'image/png', size: 1 } }, userF1);
      expect(cofre.gravar).toHaveBeenCalledTimes(2);
      expect(cofre.gravar).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'FOTO' }));
      expect(cofre.gravar).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'ASSINATURA' }));
    });

    it('não conclui a viagem se ainda há entrega pendente de baixa', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'EM_VIAGEM', filialId: 'f1', numero: 9, cupons: [], parada: { viagemId: 'v1' } });
      prisma.viagem.findUnique.mockResolvedValue({ situacao: 'EM_CURSO', veiculoId: 'vc1', paradas: [{ entrega: { status: 'ENTREGUE' } }, { entrega: { status: 'EM_VIAGEM' } }] });
      prisma.entrega.update.mockResolvedValue({ id: 'e1', status: 'ENTREGUE', cupons: [] });
      await svc.baixar('e1', { resultado: 'ENTREGUE', recebedorNome: 'Maria' } as any, {}, userF1);
      expect(prisma.viagem.update).not.toHaveBeenCalled();
      expect(prisma.veiculo.update).not.toHaveBeenCalled();
    });

    // ── Prova flexível (meio-termo): foto opcional, mas exige ALGUMA prova ──
    it('400 ENTREGUE sem prova (foto/assinatura) e sem recebedor', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'EM_VIAGEM', filialId: 'f1', numero: 9, cupons: [], parada: { viagemId: 'v1' } });
      await expect(svc.baixar('e1', { resultado: 'ENTREGUE' } as any, {}, userF1)).rejects.toThrow(BadRequestException);
    });

    it('ENTREGUE só com recebedor (sem arquivo) baixa sem tocar o cofre', async () => {
      prisma.entrega.findUnique.mockResolvedValue({ id: 'e1', status: 'EM_VIAGEM', filialId: 'f1', numero: 9, cupons: [], parada: { viagemId: 'v1' } });
      prisma.viagem.findUnique.mockResolvedValue({ situacao: 'EM_CURSO', veiculoId: 'vc1', paradas: [{ entrega: { status: 'EM_VIAGEM' } }] });
      prisma.entrega.update.mockResolvedValue({ id: 'e1', status: 'ENTREGUE', temComprovante: false, cupons: [] });
      const r = await svc.baixar('e1', { resultado: 'ENTREGUE', recebedorNome: 'João Portaria' } as any, {}, userF1);
      expect(cofre.gravar).not.toHaveBeenCalled();
      expect(r.status).toBe('ENTREGUE');
    });
  });

  // A baixa pode gerar FOTO e ASSINATURA, mas `entrega.comprovanteId` guarda só
  // a primária (a foto). A lista precisa devolver TODAS, senão a assinatura fica
  // sem como ser aberta na tela de Comprovantes.
  describe('buscarBaixadas — provas da entrega', () => {
    const entregaBaixada = { id: 'e1', numero: 7, comprovanteId: 'cmp-foto', cupons: [] };

    it('devolve as duas provas quando a baixa tem foto e assinatura', async () => {
      prisma.entrega.findMany.mockResolvedValue([entregaBaixada]);
      cofre.provasPorEntregas = jest.fn().mockResolvedValue(
        new Map([['e1', [{ id: 'cmp-foto', tipo: 'FOTO' }, { id: 'cmp-assin', tipo: 'ASSINATURA' }]]]),
      );

      const [r] = await svc.buscarBaixadas({ filialId: 'f1' });

      expect(r.provas).toEqual([
        { id: 'cmp-foto', tipo: 'FOTO' },
        { id: 'cmp-assin', tipo: 'ASSINATURA' },
      ]);
      expect(r.comprovanteTipo).toBe('FOTO'); // badge segue a primária
    });

    it('cofre indisponível não derruba a lista (degrada sem as provas)', async () => {
      prisma.entrega.findMany.mockResolvedValue([entregaBaixada]);
      cofre.provasPorEntregas = jest.fn().mockRejectedValue(new Error('cofre fora'));

      const [r] = await svc.buscarBaixadas({ filialId: 'f1' });

      expect(r.provas).toEqual([]);
      expect(r.comprovanteTipo).toBeNull();
      expect(r.numero).toBe(7); // a linha continua utilizável
    });
  });
});
