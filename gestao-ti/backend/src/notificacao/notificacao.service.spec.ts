import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificacaoService } from './notificacao.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

describe('NotificacaoService', () => {
  let service: NotificacaoService;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module = await Test.createTestingModule({
      providers: [
        NotificacaoService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(NotificacaoService);
  });

  describe('findAll', () => {
    it('retorna notificacoes do usuario', async () => {
      const notifs = [{ id: '1', titulo: 'Teste' }];
      prisma.notificacao.findMany.mockResolvedValue(notifs);

      const result = await service.findAll('user-1');

      expect(prisma.notificacao.findMany).toHaveBeenCalledWith({
        where: { usuarioId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      expect(result).toEqual(notifs);
    });

    it('filtra por lida quando informado', async () => {
      prisma.notificacao.findMany.mockResolvedValue([]);

      await service.findAll('user-1', false);

      expect(prisma.notificacao.findMany).toHaveBeenCalledWith({
        where: { usuarioId: 'user-1', lida: false },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });

  describe('countNaoLidas', () => {
    it('retorna contagem correta', async () => {
      prisma.notificacao.count.mockResolvedValue(5);

      const result = await service.countNaoLidas('user-1');

      expect(prisma.notificacao.count).toHaveBeenCalledWith({
        where: { usuarioId: 'user-1', lida: false },
      });
      expect(result).toEqual({ count: 5 });
    });
  });

  describe('marcarLida', () => {
    it('marca como lida com sucesso', async () => {
      const notif = { id: 'n1', usuarioId: 'user-1', lida: false };
      prisma.notificacao.findUnique.mockResolvedValue(notif);
      prisma.notificacao.update.mockResolvedValue({ ...notif, lida: true });

      const result = await service.marcarLida('n1', 'user-1');

      expect(prisma.notificacao.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { lida: true },
      });
      expect(result.lida).toBe(true);
    });

    it('lanca NotFoundException se nao encontrada', async () => {
      prisma.notificacao.findUnique.mockResolvedValue(null);

      await expect(service.marcarLida('n999', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('lanca NotFoundException se pertence a outro usuario', async () => {
      prisma.notificacao.findUnique.mockResolvedValue({ id: 'n1', usuarioId: 'outro-user' });

      await expect(service.marcarLida('n1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('marcarTodasLidas', () => {
    it('atualiza todas nao lidas do usuario', async () => {
      prisma.notificacao.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.marcarTodasLidas('user-1');

      expect(prisma.notificacao.updateMany).toHaveBeenCalledWith({
        where: { usuarioId: 'user-1', lida: false },
        data: { lida: true },
      });
      expect(result).toEqual({ marcadas: 3 });
    });
  });

  describe('criarParaUsuario', () => {
    it('cria notificacao com dados corretos', async () => {
      const created = { id: 'n1', tipo: 'CHAMADO_ATUALIZADO', titulo: 'Titulo' };
      prisma.notificacao.create.mockResolvedValue(created);

      const result = await service.criarParaUsuario(
        'user-1', 'CHAMADO_ATUALIZADO' as any, 'Titulo', 'Mensagem', { chamadoId: 'c1' },
      );

      expect(prisma.notificacao.create).toHaveBeenCalledWith({
        data: {
          tipo: 'CHAMADO_ATUALIZADO',
          titulo: 'Titulo',
          mensagem: 'Mensagem',
          dadosJson: JSON.stringify({ chamadoId: 'c1' }),
          usuarioId: 'user-1',
        },
      });
      expect(result).toEqual(created);
    });
  });

  describe('criarParaUsuarios', () => {
    it('cria notificacoes em lote', async () => {
      prisma.notificacao.createMany.mockResolvedValue({ count: 2 });

      await service.criarParaUsuarios(
        ['user-1', 'user-2'], 'CHAMADO_ATRIBUIDO' as any, 'Titulo', 'Msg',
      );

      expect(prisma.notificacao.createMany).toHaveBeenCalledWith({
        data: [
          { tipo: 'CHAMADO_ATRIBUIDO', titulo: 'Titulo', mensagem: 'Msg', dadosJson: undefined, usuarioId: 'user-1' },
          { tipo: 'CHAMADO_ATRIBUIDO', titulo: 'Titulo', mensagem: 'Msg', dadosJson: undefined, usuarioId: 'user-2' },
        ],
      });
    });

    it('nao chama createMany se lista vazia', async () => {
      await service.criarParaUsuarios([], 'GERAL' as any, 'T', 'M');

      expect(prisma.notificacao.createMany).not.toHaveBeenCalled();
    });
  });
});
