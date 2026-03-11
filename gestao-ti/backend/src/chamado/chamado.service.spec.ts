import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChamadoService } from './chamado.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacaoService } from '../notificacao/notificacao.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

const mockUser = { sub: 'user-1', email: 'user@test.com', filialId: 'filial-1' };

function baseChamado(overrides = {}) {
  return {
    id: 'ch-1',
    numero: 1,
    titulo: 'Chamado Teste',
    status: 'ABERTO',
    solicitanteId: 'solicitante-1',
    tecnicoId: null,
    equipeAtualId: 'eq-1',
    filialId: 'filial-1',
    ...overrides,
  };
}

describe('ChamadoService', () => {
  let service: ChamadoService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let notificacaoService: { criarParaUsuario: jest.Mock; criarParaUsuarios: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    notificacaoService = {
      criarParaUsuario: jest.fn().mockResolvedValue({}),
      criarParaUsuarios: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        ChamadoService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificacaoService, useValue: notificacaoService },
      ],
    }).compile();

    service = module.get(ChamadoService);
  });

  describe('create', () => {
    it('cria chamado basico com campos corretos', async () => {
      const equipe = { id: 'eq-1', aceitaChamadoExterno: true };
      prisma.equipeTI.findUnique.mockResolvedValue(equipe);
      prisma.slaDefinicao.findUnique.mockResolvedValue(null);
      prisma.chamado.create.mockResolvedValue(baseChamado());
      prisma.historicoChamado.create.mockResolvedValue({});

      const dto = { titulo: 'Teste', descricao: 'Desc', equipeAtualId: 'eq-1' };
      await service.create(dto as any, mockUser as any, 'TECNICO');

      expect(prisma.chamado.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            titulo: 'Teste',
            descricao: 'Desc',
            solicitanteId: 'user-1',
            equipeAtualId: 'eq-1',
            filialId: 'filial-1',
          }),
        }),
      );
    });

    it('calcula data limite SLA quando existe definicao', async () => {
      const equipe = { id: 'eq-1', aceitaChamadoExterno: true };
      const sla = { id: 'sla-1', horasResolucao: 24 };
      prisma.equipeTI.findUnique.mockResolvedValue(equipe);
      prisma.slaDefinicao.findUnique.mockResolvedValue(sla);
      prisma.chamado.create.mockResolvedValue(baseChamado());
      prisma.historicoChamado.create.mockResolvedValue({});

      const dto = { titulo: 'Teste', descricao: 'Desc', equipeAtualId: 'eq-1', prioridade: 'MEDIA' };
      await service.create(dto as any, mockUser as any, 'TECNICO');

      const createCall = prisma.chamado.create.mock.calls[0][0];
      expect(createCall.data.slaDefinicaoId).toBe('sla-1');
      expect(createCall.data.dataLimiteSla).toBeInstanceOf(Date);
    });

    it('lanca ForbiddenException se equipe nao aceita chamado externo', async () => {
      const equipe = { id: 'eq-1', aceitaChamadoExterno: false };
      prisma.equipeTI.findUnique.mockResolvedValue(equipe);

      const dto = { titulo: 'Teste', descricao: 'Desc', equipeAtualId: 'eq-1' };
      await expect(service.create(dto as any, mockUser as any, 'USUARIO_FINAL')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('assumir', () => {
    it('assume chamado com sucesso', async () => {
      const chamado = baseChamado({ status: 'ABERTO' });
      prisma.chamado.findUnique.mockResolvedValue(chamado);
      prisma.chamado.update.mockResolvedValue({ ...chamado, status: 'EM_ATENDIMENTO', tecnicoId: 'user-1' });
      prisma.historicoChamado.create.mockResolvedValue({});

      const result = await service.assumir('ch-1', mockUser as any);

      expect(prisma.chamado.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { tecnicoId: 'user-1', status: 'EM_ATENDIMENTO' },
        }),
      );
      expect(result.status).toBe('EM_ATENDIMENTO');
    });

    it('lanca BadRequestException se status nao e ABERTO ou PENDENTE', async () => {
      prisma.chamado.findUnique.mockResolvedValue(baseChamado({ status: 'EM_ATENDIMENTO' }));

      await expect(service.assumir('ch-1', mockUser as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('transferirEquipe', () => {
    it('transfere para outra equipe com sucesso', async () => {
      const chamado = baseChamado({ status: 'EM_ATENDIMENTO' });
      prisma.chamado.findUnique.mockResolvedValue(chamado);
      prisma.equipeTI.findUnique.mockResolvedValue({ id: 'eq-2' });
      prisma.chamado.update.mockResolvedValue({ ...chamado, equipeAtualId: 'eq-2', tecnicoId: null, status: 'ABERTO' });
      prisma.historicoChamado.create.mockResolvedValue({});
      prisma.membroEquipe.findMany.mockResolvedValue([]);

      const result = await service.transferirEquipe(
        'ch-1', { equipeDestinoId: 'eq-2' } as any, mockUser as any, 'ADMIN',
      );

      expect(prisma.chamado.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { equipeAtualId: 'eq-2', tecnicoId: null, status: 'ABERTO' },
        }),
      );
      expect(result.equipeAtualId).toBe('eq-2');
    });
  });

  describe('transferirTecnico', () => {
    it('transfere para tecnico com sucesso', async () => {
      const chamado = baseChamado({ status: 'EM_ATENDIMENTO' });
      prisma.chamado.findUnique.mockResolvedValue(chamado);
      prisma.usuario.findUnique.mockResolvedValue({ id: 'tec-2', nome: 'Tecnico 2' });
      prisma.chamado.update.mockResolvedValue({ ...chamado, tecnicoId: 'tec-2' });
      prisma.historicoChamado.create.mockResolvedValue({});

      await service.transferirTecnico('ch-1', { tecnicoId: 'tec-2' } as any, mockUser as any, 'ADMIN');

      expect(prisma.chamado.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { tecnicoId: 'tec-2', status: 'EM_ATENDIMENTO' },
        }),
      );
      expect(notificacaoService.criarParaUsuario).toHaveBeenCalledWith(
        'tec-2', 'CHAMADO_ATRIBUIDO',
        expect.any(String), expect.any(String), { chamadoId: 'ch-1' },
      );
    });
  });

  describe('resolver', () => {
    it('resolve chamado com sucesso', async () => {
      const chamado = baseChamado({ status: 'EM_ATENDIMENTO' });
      prisma.chamado.findUnique.mockResolvedValue(chamado);
      prisma.chamado.update.mockResolvedValue({ ...chamado, status: 'RESOLVIDO', dataResolucao: new Date() });
      prisma.historicoChamado.create.mockResolvedValue({});

      const result = await service.resolver('ch-1', { descricao: 'Resolvido' } as any, mockUser as any, 'ADMIN');

      expect(prisma.chamado.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'RESOLVIDO', dataResolucao: expect.any(Date) },
        }),
      );
      expect(result.status).toBe('RESOLVIDO');
    });
  });

  describe('fechar', () => {
    it('fecha chamado resolvido com sucesso', async () => {
      const chamado = baseChamado({ status: 'RESOLVIDO' });
      prisma.chamado.findUnique.mockResolvedValue(chamado);
      prisma.chamado.update.mockResolvedValue({ ...chamado, status: 'FECHADO' });
      prisma.historicoChamado.create.mockResolvedValue({});

      const result = await service.fechar('ch-1', mockUser as any, 'ADMIN');
      expect(result.status).toBe('FECHADO');
    });

    it('lanca BadRequestException se chamado nao esta resolvido', async () => {
      prisma.chamado.findUnique.mockResolvedValue(baseChamado({ status: 'EM_ATENDIMENTO' }));

      await expect(service.fechar('ch-1', mockUser as any, 'ADMIN')).rejects.toThrow(BadRequestException);
    });
  });

  describe('reabrir', () => {
    it('reabre chamado resolvido com sucesso', async () => {
      const chamado = baseChamado({ status: 'RESOLVIDO', dataResolucao: new Date() });
      prisma.chamado.findUnique.mockResolvedValue(chamado);
      prisma.chamado.update.mockResolvedValue({ ...chamado, status: 'ABERTO', dataResolucao: null, dataFechamento: null });
      prisma.historicoChamado.create.mockResolvedValue({});

      const result = await service.reabrir('ch-1', {} as any, mockUser as any, 'ADMIN');

      expect(prisma.chamado.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'ABERTO', dataResolucao: null, dataFechamento: null },
        }),
      );
      expect(result.status).toBe('ABERTO');
    });
  });

  describe('cancelar', () => {
    it('cancela chamado com sucesso', async () => {
      const chamado = baseChamado({ status: 'ABERTO' });
      prisma.chamado.findUnique.mockResolvedValue(chamado);
      prisma.chamado.update.mockResolvedValue({ ...chamado, status: 'CANCELADO' });
      prisma.historicoChamado.create.mockResolvedValue({});

      const result = await service.cancelar('ch-1', mockUser as any, 'ADMIN');
      expect(result.status).toBe('CANCELADO');
    });
  });
});
