import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChamadoService } from './chamado.service';
import { ChamadoHelpersService } from './services/chamado-helpers.service';
import { ChamadoTempoService } from './services/chamado-tempo.service';
import { ChamadoCoreService } from './services/chamado-core.service';
import { ChamadoColaboradorService } from './services/chamado-colaborador.service';
import { ChamadoAnexoService } from './services/chamado-anexo.service';
import { ChamadoAgrupamentoService } from './services/chamado-agrupamento.service';
import { EmailEnvolvidosService } from '../email/email-envolvidos.service';
import { ProtheusService } from '../protheus/protheus.service';
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
    colaboradores: [],
    ...overrides,
  };
}

describe('ChamadoService', () => {
  let service: ChamadoService;
  let core: ChamadoCoreService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let notificacaoService: { criarParaUsuario: jest.Mock; criarParaUsuarios: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    notificacaoService = {
      criarParaUsuario: jest.fn().mockResolvedValue({}),
      criarParaUsuarios: jest.fn().mockResolvedValue(undefined),
    };
    const agrupamentoService = {
      propagarEventoNoFilho: jest.fn().mockResolvedValue(undefined),
      propagarComentario: jest.fn().mockResolvedValue(undefined),
      cascataResolverFechar: jest.fn().mockResolvedValue(undefined),
    };
    const emailEnvolvidosService = {
      enviar: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        ChamadoHelpersService,
        ChamadoTempoService,
        ChamadoCoreService,
        ChamadoColaboradorService,
        ChamadoAnexoService,
        ChamadoService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificacaoService, useValue: notificacaoService },
        { provide: ChamadoAgrupamentoService, useValue: agrupamentoService },
        { provide: EmailEnvolvidosService, useValue: emailEnvolvidosService },
        { provide: ProtheusService, useValue: { validarCredencialPortal: jest.fn() } },
      ],
    }).compile();

    service = module.get(ChamadoService);
    core = module.get(ChamadoCoreService);
  });

  describe('create', () => {
    it('cria chamado basico com campos corretos', async () => {
      const equipe = { id: 'eq-1', privada: false, departamentoId: 'dep-ti' };
      prisma.equipe.findUnique.mockResolvedValue(equipe);
      prisma.slaDefinicao.findUnique.mockResolvedValue(null);
      prisma.chamado.create.mockResolvedValue(baseChamado());
      prisma.historicoChamado.create.mockResolvedValue({});

      const dto = { titulo: 'Teste', descricao: 'Desc', equipeAtualId: 'eq-1' };
      await service.create(dto as any, mockUser as any, 'SUPORTE');

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
      const equipe = { id: 'eq-1', privada: false, departamentoId: 'dep-ti' };
      const sla = { id: 'sla-1', horasResolucao: 24 };
      prisma.equipe.findUnique.mockResolvedValue(equipe);
      prisma.slaDefinicao.findUnique.mockResolvedValue(sla);
      prisma.chamado.create.mockResolvedValue(baseChamado());
      prisma.historicoChamado.create.mockResolvedValue({});

      const dto = { titulo: 'Teste', descricao: 'Desc', equipeAtualId: 'eq-1', prioridade: 'MEDIA' };
      await service.create(dto as any, mockUser as any, 'SUPORTE');

      const createCall = prisma.chamado.create.mock.calls[0][0];
      expect(createCall.data.slaDefinicaoId).toBe('sla-1');
      expect(createCall.data.dataLimiteSla).toBeInstanceOf(Date);
    });

    it('lanca ForbiddenException ao abrir p/ equipe PRIVADA sem ser staff do depto', async () => {
      // mockUser nao tem modulos WORKSPACE => getDeptosOndeStaff = [] e
      // hasCapability(OVERSIGHT) = false => bloqueado para equipe privada,
      // independentemente do papel (regra por departamento, nao por papel).
      const equipe = { id: 'eq-1', privada: true, departamentoId: 'dep-ti' };
      prisma.equipe.findUnique.mockResolvedValue(equipe);

      const dto = { titulo: 'Teste', descricao: 'Desc', equipeAtualId: 'eq-1' };
      await expect(service.create(dto as any, mockUser as any, 'SUPORTE')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('permite abrir p/ equipe PRIVADA quando o user e staff do depto dela', async () => {
      const equipe = { id: 'eq-1', privada: true, departamentoId: 'dep-ti' };
      prisma.equipe.findUnique.mockResolvedValue(equipe);
      prisma.slaDefinicao.findUnique.mockResolvedValue(null);
      prisma.membroEquipe.findUnique.mockResolvedValue(null);
      prisma.chamado.create.mockResolvedValue(baseChamado());
      prisma.historicoChamado.create.mockResolvedValue({});

      // user com papel SUPORTE no depto 'dep-ti' no modulo WORKSPACE => staff.
      const staffUser = {
        ...mockUser,
        modulos: [{ codigo: 'WORKSPACE', departamentos: [{ id: 'dep-ti', role: 'SUPORTE' }] }],
      };
      const dto = { titulo: 'Teste', descricao: 'Desc', equipeAtualId: 'eq-1' };
      await expect(service.create(dto as any, staffUser as any, 'SUPORTE')).resolves.toBeDefined();
    });

    it('auto-assume (EM_ATENDIMENTO) quando o solicitante e membro ATIVO da equipe escolhida', async () => {
      prisma.equipe.findUnique.mockResolvedValue({ id: 'eq-1', privada: false, departamentoId: 'dep-ti' });
      prisma.slaDefinicao.findUnique.mockResolvedValue(null);
      prisma.membroEquipe.findUnique.mockResolvedValue({ status: 'ATIVO' });
      prisma.chamado.create.mockResolvedValue(baseChamado());
      prisma.historicoChamado.create.mockResolvedValue({});

      const dto = { titulo: 'Teste', descricao: 'Desc', equipeAtualId: 'eq-1' };
      await service.create(dto as any, mockUser as any, 'SUPORTE');

      expect(prisma.chamado.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'EM_ATENDIMENTO', tecnicoId: 'user-1' }),
        }),
      );
    });

    it('NAO auto-assume (ABERTO) quando o solicitante NAO e membro da equipe escolhida (outro workspace/equipe)', async () => {
      // Ex: usuario do Setor Fiscal (ou de outra equipe da T.I.) abrindo p/ esta equipe.
      prisma.equipe.findUnique.mockResolvedValue({ id: 'eq-ti', privada: false, departamentoId: 'dep-ti' });
      prisma.slaDefinicao.findUnique.mockResolvedValue(null);
      prisma.membroEquipe.findUnique.mockResolvedValue(null); // nao e membro
      prisma.chamado.create.mockResolvedValue(baseChamado());
      prisma.historicoChamado.create.mockResolvedValue({});

      const dto = { titulo: 'Teste', descricao: 'Desc', equipeAtualId: 'eq-ti' };
      // Mesmo com role denormalizada "staff", sem pertencer a equipe nao assume.
      await service.create(dto as any, mockUser as any, 'SUPORTE');

      expect(prisma.chamado.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ABERTO', tecnicoId: undefined }),
        }),
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
      prisma.equipe.findUnique.mockResolvedValue({ id: 'eq-2' });
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
      const chamado = baseChamado({ status: 'EM_ATENDIMENTO', tecnicoId: 'tec-1' });
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
      const chamado = baseChamado({ status: 'EM_ATENDIMENTO', tecnicoId: 'user-1' });
      prisma.chamado.findUnique.mockResolvedValue(chamado);
      prisma.registroTempoChamado.count.mockResolvedValue(1);
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
    it('reabre como REABERTO (sem auto-assumir) quem nao e membro da equipe', async () => {
      const chamado = baseChamado({ status: 'RESOLVIDO', dataResolucao: new Date() });
      prisma.chamado.findUnique.mockResolvedValue(chamado);
      // Sem membro de equipe (membroEquipe.findUnique => null por default no mock)
      prisma.chamado.update.mockResolvedValue({ ...chamado, status: 'REABERTO', tecnicoId: null });
      prisma.historicoChamado.create.mockResolvedValue({});

      await service.reabrir('ch-1', {} as any, mockUser as any, 'ADMIN');

      expect(prisma.chamado.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'REABERTO', tecnicoId: null, dataResolucao: null, dataFechamento: null },
        }),
      );
    });

    it('auto-assume (EM_ATENDIMENTO) quem e membro ATIVO da equipe que atende', async () => {
      // Tecnico membro da equipe que abriu o chamado p/ a propria equipe reabre → reassume.
      const chamado = baseChamado({ status: 'RESOLVIDO', dataResolucao: new Date(), solicitanteId: 'user-1' });
      prisma.chamado.findUnique.mockResolvedValue(chamado);
      prisma.membroEquipe.findUnique.mockResolvedValue({ status: 'ATIVO' });
      prisma.chamado.update.mockResolvedValue({ ...chamado, status: 'EM_ATENDIMENTO', tecnicoId: 'user-1' });
      prisma.historicoChamado.create.mockResolvedValue({});

      await service.reabrir('ch-1', {} as any, mockUser as any, 'SUPORTE');

      expect(prisma.chamado.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'EM_ATENDIMENTO', tecnicoId: 'user-1', dataResolucao: null, dataFechamento: null },
        }),
      );
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

  // #6 (18/06) — visibilidade restrita à equipe na LISTAGEM. O carve-out só
  // entra na cláusula de visibilidade por DEPTO-STAFF; gestor do workspace e
  // ADMIN veem tudo. Capturamos o `where` montado em prisma.chamado.findMany.
  describe('findAll — visibilidade restrita à equipe', () => {
    function workspaceUser(role: 'SUPORTE' | 'GESTOR') {
      return {
        sub: 'u-1', email: 'u@test.com', filialId: 'filial-1',
        modulos: [{ codigo: 'WORKSPACE', role, departamentos: [{ id: 'dep-ti', role, isTI: true }] }],
      } as any;
    }
    async function whereDe(role: 'SUPORTE' | 'GESTOR') {
      prisma.membroEquipe.findMany.mockResolvedValue([]); // não é membro de nenhuma equipe
      await core.findAll(workspaceUser(role), role, {});
      return JSON.stringify(prisma.chamado.findMany.mock.calls.at(-1)?.[0]?.where ?? {});
    }

    it('SUPORTE (não-membro): aplica o carve-out de equipe restrita', async () => {
      const where = await whereDe('SUPORTE');
      expect(where).toContain('restritaVisibilidade');
      expect(where).toContain('dep-ti');
    });

    it('GESTOR do workspace: vê tudo do depto, SEM carve-out de equipe restrita', async () => {
      const where = await whereDe('GESTOR');
      expect(where).not.toContain('restritaVisibilidade');
      expect(where).toContain('dep-ti');
    });
  });
});
