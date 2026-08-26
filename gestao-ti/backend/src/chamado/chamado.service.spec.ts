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
  let emailEnvolvidos: { enviar: jest.Mock; enviarExterno: jest.Mock };

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
    emailEnvolvidos = {
      enviar: jest.fn().mockResolvedValue(undefined),
      enviarExterno: jest.fn().mockResolvedValue({ sent: false, mock: true }),
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
        { provide: EmailEnvolvidosService, useValue: emailEnvolvidos },
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

    it('persiste os campos do cliente SAC (nome/contato/canal) — Fase 1', async () => {
      prisma.equipe.findUnique.mockResolvedValue({ id: 'eq-1', privada: false, departamentoId: 'dep-ti' });
      prisma.slaDefinicao.findUnique.mockResolvedValue(null);
      prisma.chamado.create.mockResolvedValue(baseChamado());
      prisma.historicoChamado.create.mockResolvedValue({});

      const dto = {
        titulo: 'Cliente reclamou do produto', descricao: 'Detalhes', equipeAtualId: 'eq-1',
        clienteNome: '  Maria Silva  ', clienteEmail: 'maria@cliente.com', canalOrigem: 'TELEFONE',
      };
      await service.create(dto as any, mockUser as any, 'SUPORTE');

      expect(prisma.chamado.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clienteNome: 'Maria Silva',            // trim aplicado
            clienteEmail: 'maria@cliente.com',
            canalOrigem: 'TELEFONE',
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

    it('bloqueia abrir chamado para equipe de apoio SAC (roster não roteável) — Fase 1', async () => {
      prisma.equipe.findUnique.mockResolvedValue({ id: 'eq-roster', privada: false, departamentoId: 'dep-sac', apoioSac: true });
      const dto = { titulo: 'T', descricao: 'D', equipeAtualId: 'eq-roster' };
      await expect(service.create(dto as any, mockUser as any, 'SUPORTE')).rejects.toThrow(BadRequestException);
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

      const result = await service.assumir('ch-1', mockUser as any, 'SUPORTE');

      expect(prisma.chamado.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { tecnicoId: 'user-1', status: 'EM_ATENDIMENTO' },
        }),
      );
      expect(result.status).toBe('EM_ATENDIMENTO');
    });

    it('lanca BadRequestException se status nao e ABERTO ou PENDENTE', async () => {
      prisma.chamado.findUnique.mockResolvedValue(baseChamado({ status: 'EM_ATENDIMENTO' }));

      await expect(service.assumir('ch-1', mockUser as any, 'SUPORTE')).rejects.toThrow(BadRequestException);
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

    it('bloqueia transferir para equipe de apoio SAC (roster não roteável) — Fase 1', async () => {
      prisma.chamado.findUnique.mockResolvedValue(baseChamado({ status: 'EM_ATENDIMENTO' }));
      prisma.equipe.findUnique.mockResolvedValue({ id: 'eq-roster', apoioSac: true });
      await expect(
        service.transferirEquipe('ch-1', { equipeDestinoId: 'eq-roster' } as any, mockUser as any, 'ADMIN'),
      ).rejects.toThrow(BadRequestException);
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


  // ⭐ 26/08 — reabrir virou ato de QUEM ATENDE. O chamado resolvido estava sendo usado
  // como atalho para não abrir um novo (relato do Clenio).
  describe('reabrir — só quem atende', () => {
    it('solicitante NÃO reabre, e o erro diz o que fazer no lugar', async () => {
      const chamado = baseChamado({ status: 'RESOLVIDO', solicitanteId: 'user-1', tecnicoId: 'outro', numero: 152 });
      prisma.chamado.findUnique.mockResolvedValue({ ...chamado, colaboradores: [] });
      prisma.membroEquipe.findUnique.mockResolvedValue(null); // não é da equipe

      await expect(service.reabrir('ch-1', {} as any, mockUser as any, 'USUARIO_FINAL'))
        .rejects.toThrow(/#152/); // a mensagem ensina a citar o chamado no novo
      expect(prisma.chamado.update).not.toHaveBeenCalled();
    });

    it('membro ATIVO da equipe reabre mesmo sem estar atribuído', async () => {
      const chamado = baseChamado({ status: 'RESOLVIDO', solicitanteId: 'outro', tecnicoId: null });
      prisma.chamado.findUnique.mockResolvedValue(chamado);
      prisma.membroEquipe.findUnique.mockResolvedValue({ status: 'ATIVO' });
      prisma.chamado.update.mockResolvedValue({ ...chamado, status: 'EM_ATENDIMENTO' });
      prisma.historicoChamado.create.mockResolvedValue({});

      await expect(service.reabrir('ch-1', {} as any, mockUser as any, 'SUPORTE')).resolves.toBeDefined();
    });
  });


  // ⭐ 26/08 — `#numero` no detalhamento vira laço estruturado (contrapartida de tirar o
  // "Reabrir" do solicitante).
  describe('referência a outro chamado (#numero)', () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const citar = (texto: string, user: any = mockUser, role = 'SUPORTE') =>
      (core as any).criarReferencias('origem-1', texto, user, role);

    it('sem # no texto, nem consulta o banco', async () => {
      const r = await citar('Texto sem citação nenhuma.');
      expect(r).toEqual([]);
      expect(prisma.chamado.findMany).not.toHaveBeenCalled();
    });

    it('cita #152 → cria o laço', async () => {
      prisma.chamado.findMany.mockResolvedValue([{ id: 'ch-152', numero: 152 }]);
      prisma.chamadoReferencia = { upsert: jest.fn().mockResolvedValue({}) } as any;

      const r = await citar('Seguimento do #152, mesma impressora.');

      expect(r).toEqual([{ numero: 152, vinculado: true }]);
      expect(prisma.chamadoReferencia.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: { origemId: 'origem-1', destinoId: 'ch-152', criadoPorId: 'user-1' } }),
      );
    });

    // Silêncio aqui faria a pessoa achar que vinculou. A tela precisa poder avisar.
    it('número que a pessoa não vê volta como NÃO vinculado, com motivo', async () => {
      prisma.chamado.findMany.mockResolvedValue([]);
      const r = await citar('Olha o #99999999 ali.');
      expect(r).toEqual([{ numero: 99999999, vinculado: false, motivo: expect.stringMatching(/acesso/) }]);
    });

    it('citar a si mesmo não vira laço', async () => {
      prisma.chamado.findMany.mockResolvedValue([{ id: 'origem-1', numero: 7 }]);
      prisma.chamadoReferencia = { upsert: jest.fn() } as any;
      const r = await citar('Duplicado do #7 (que é este mesmo).');
      expect(r).toEqual([]);
      expect(prisma.chamadoReferencia.upsert).not.toHaveBeenCalled();
    });

    it('o mesmo número citado duas vezes conta uma vez', async () => {
      prisma.chamado.findMany.mockResolvedValue([{ id: 'ch-9', numero: 9 }]);
      prisma.chamadoReferencia = { upsert: jest.fn().mockResolvedValue({}) } as any;
      const r = await citar('Vem do #9 — repito, #9.');
      expect(r).toHaveLength(1);
      expect(prisma.chamadoReferencia.upsert).toHaveBeenCalledTimes(1);
    });
  });


  // ⭐ 26/08 — relato do Clenio: quem entra EM CÓPIA recebia a notificação, abria pelo
  // link, mas o chamado não aparecia na lista dele. A cláusula de cópia existia na
  // camada de visibilidade desde o SAC — só que os ramos por papel, acima dela,
  // cortavam antes com um AND.
  describe('em cópia aparece na LISTA, não só na notificação', () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    async function whereDoPapel(role: string) {
      prisma.membroEquipe.findMany.mockResolvedValue([]);
      const user = { sub: 'user-1', email: 'u@test.com', filialId: 'f1', modulos: [{ codigo: 'WORKSPACE', role, departamentos: [{ id: 'dep-x', role, isTI: false }] }] } as any;
      await core.findAll(user, role, {});
      return JSON.stringify(prisma.chamado.findMany.mock.calls.at(-1)?.[0]?.where ?? {});
    }

    it('USUARIO_FINAL vê o que abriu E o que está em cópia', async () => {
      const where = await whereDoPapel('USUARIO_FINAL');
      expect(where).toContain('copias');
      expect(where).toContain('solicitanteId');
      // e segue sem ver o que não é público
      expect(where).toContain('PUBLICO');
    });

    it('USUARIO_CHAVE também', async () => {
      expect(await whereDoPapel('USUARIO_CHAVE')).toContain('copias');
    });

    it('TERCEIRIZADO também', async () => {
      expect(await whereDoPapel('TERCEIRIZADO')).toContain('copias');
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

  // ⭐ 26/08 — "staff" deixou de ser "staff em algum departamento de T.I." e passou a ser
  // "staff NO DEPARTAMENTO DO CHAMADO". Perfis reais: no Fiscal a pessoa atende; no T.I.
  // a mesma pessoa é usuária final.
  describe('nota interna e chamado PRIVADO seguem o departamento do chamado', () => {
    const suporteNoFiscal = {
      sub: 'u-1', email: 'u@test.com', filialId: 'filial-1',
      modulos: [{
        codigo: 'WORKSPACE', role: 'SUPORTE',
        departamentos: [
          { id: 'dep-fiscal', nome: 'Fiscal', role: 'SUPORTE', isTI: false },
          { id: 'dep-ti', nome: 'T.I.', role: 'USUARIO_FINAL', isTI: true },
        ],
      }],
    } as any;

    function chamadoDe(departamentoId: string, extra: Record<string, unknown> = {}) {
      return {
        ...baseChamado({ departamentoId, ...extra }),
        copias: [],
        historicos: [
          { id: 'h1', publico: true, descricao: 'publico' },
          { id: 'h2', publico: false, descricao: 'nota interna' },
        ],
      };
    }

    it('abre o PRIVADO do departamento onde atende', async () => {
      prisma.chamado.findUnique.mockResolvedValue(chamadoDe('dep-fiscal', { visibilidade: 'PRIVADO' }));
      await expect(core.findOne('ch-1', suporteNoFiscal, 'SUPORTE')).resolves.toBeDefined();
    });

    // Antes: quem é SUPORTE no Fiscal criava privado no Fiscal (onda de 25/08) e NÃO
    // conseguia abrir depois, porque a abertura exigia ser do T.I.
    it('NÃO abre o PRIVADO de um departamento onde é usuária final', async () => {
      prisma.chamado.findUnique.mockResolvedValue(chamadoDe('dep-ti', { visibilidade: 'PRIVADO' }));
      await expect(core.findOne('ch-1', suporteNoFiscal, 'SUPORTE')).rejects.toThrow(/restrito/i);
    });

    it('lê nota interna no departamento onde atende', async () => {
      prisma.chamado.findUnique.mockResolvedValue(chamadoDe('dep-fiscal'));
      const ch = await core.findOne('ch-1', suporteNoFiscal, 'SUPORTE');
      expect(ch.historicos).toHaveLength(2);
    });

    it('NÃO lê nota interna de chamado de outro departamento', async () => {
      prisma.chamado.findUnique.mockResolvedValue(chamadoDe('dep-ti'));
      const ch = await core.findOne('ch-1', suporteNoFiscal, 'SUPORTE');
      expect(ch.historicos.map((h: { id: string }) => h.id)).toEqual(['h1']);
    });
  });

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

    // SAC Fase 1 (camada 5): quem está em cópia precisa ver o chamado na LISTAGEM.
    it('inclui a cláusula de cópia no OR de visibilidade (apoiador em cópia vê na lista)', async () => {
      const where = await whereDe('SUPORTE');
      expect(where).toContain('copias');
    });
  });

  describe('responderSac (SAC Fase 2)', () => {
    const sacChamado = {
      id: 'ch-1', numero: 42, titulo: 'Reclamação', status: 'EM_ATENDIMENTO',
      equipeAtualId: 'eq-sac', clienteEmail: 'cliente@ex.com', solicitanteId: 's', tecnicoId: 't',
    };

    it('responde o cliente: cria histórico público + dispara e-mail externo [SAC-n]', async () => {
      prisma.chamado.findUnique.mockResolvedValue(sacChamado);
      prisma.equipe.findUnique.mockResolvedValue({ atendeSac: true }); // equipe do chamado atende SAC
      prisma.historicoChamado.create.mockResolvedValue({ id: 'h1' });

      await core.responderSac('ch-1', '  Olá, seu pedido foi resolvido  ', mockUser as any, 'GESTOR');

      expect(prisma.historicoChamado.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ publico: true, tipo: 'COMENTARIO' }) }),
      );
      expect(emailEnvolvidos.enviarExterno).toHaveBeenCalledWith(
        'cliente@ex.com',
        expect.stringContaining('[SAC-42]'),
        expect.any(String),
        undefined, // sem anexo
      );
    });

    it('envio FALHOU (sent:false, mock:false) → histórico marca FALHA (não afirma "enviado")', async () => {
      prisma.chamado.findUnique.mockResolvedValue(sacChamado);
      prisma.equipe.findUnique.mockResolvedValue({ atendeSac: true });
      prisma.historicoChamado.create.mockResolvedValue({ id: 'h1' });
      emailEnvolvidos.enviarExterno.mockResolvedValueOnce({ sent: false, mock: false, redirected: false });

      await core.responderSac('ch-1', 'segue resposta', mockUser as any, 'GESTOR');

      expect(prisma.historicoChamado.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ descricao: expect.stringContaining('FALHA') }) }),
      );
    });

    it('com anexo: registra AnexoChamado e cita o anexo no histórico/e-mail', async () => {
      prisma.chamado.findUnique.mockResolvedValue(sacChamado);
      prisma.equipe.findUnique.mockResolvedValue({ atendeSac: true });
      prisma.historicoChamado.create.mockResolvedValue({ id: 'h1' });
      prisma.anexoChamado.create.mockResolvedValue({ id: 'a1', nomeOriginal: 'doc.pdf' });

      // Arquivo do multer (caminho fictício — a leitura do disco falha e é
      // tratada; o registro do anexo e a citação no histórico/e-mail são o foco).
      const file = { originalname: 'doc.pdf', filename: 'uuid.pdf', mimetype: 'application/pdf', size: 7 } as any;
      await core.responderSac('ch-1', 'segue o comprovante', mockUser as any, 'GESTOR', file);

      expect(prisma.anexoChamado.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ nomeOriginal: 'doc.pdf', chamadoId: 'ch-1' }) }),
      );
      // Histórico público cita o anexo (📎) e o e-mail externo é disparado.
      expect(prisma.historicoChamado.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ descricao: expect.stringContaining('doc.pdf') }) }),
      );
      expect(emailEnvolvidos.enviarExterno).toHaveBeenCalledWith(
        'cliente@ex.com',
        expect.stringContaining('[SAC-42]'),
        expect.stringContaining('doc.pdf'),
        undefined, // leitura do disco falhou no teste → sem base64 (caminho tratado)
      );
    });

    it('bloqueia se a equipe do chamado não atende SAC', async () => {
      prisma.chamado.findUnique.mockResolvedValue(sacChamado);
      prisma.equipe.findUnique.mockResolvedValue({ atendeSac: false }); // equipe normal
      await expect(core.responderSac('ch-1', 'oi', mockUser as any, 'GESTOR')).rejects.toThrow(BadRequestException);
    });

    it('bloqueia se o cliente não tem contato', async () => {
      prisma.chamado.findUnique.mockResolvedValue({ ...sacChamado, clienteEmail: null });
      prisma.equipe.findUnique.mockResolvedValue({ atendeSac: true });
      await expect(core.responderSac('ch-1', 'oi', mockUser as any, 'GESTOR')).rejects.toThrow(BadRequestException);
    });
  });
});
