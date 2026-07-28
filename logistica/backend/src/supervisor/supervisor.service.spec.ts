import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupervisorService } from './supervisor.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

/* eslint-disable @typescript-eslint/no-explicit-any */
const user = (filialId: string | null = 'f1') => ({ sub: 'u1', filialId, modulos: [{ codigo: 'LOGISTICA', role: 'ADMIN' }] }) as any;
const condutorMock = () => ({ validar: jest.fn() }) as any;
const coreMock = () => ({}) as any;
const storageMock = () => ({ put: jest.fn(), get: jest.fn(), remove: jest.fn() }) as any;
const locaisMock = () => ({ consolidar: jest.fn().mockResolvedValue({}), listarPorCliente: jest.fn(), criar: jest.fn() }) as any;

describe('SupervisorService.rdv (RDV por planejamento)', () => {
  let prisma: any;
  let svc: SupervisorService;

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
  });

  const viagemBase = {
    id: 'v1', filialId: 'f1', tipo: 'SUPERVISOR', numero: 18, mesReferencia: 202607,
    situacao: 'CONCLUIDA', adiantamento: null, condutorMatricula: 'SEED9001', condutorNome: 'SUP',
    veiculo: null, despesas: [], paradas: [],
  };

  it('404 se a viagem não existe / não é de supervisor', async () => {
    prisma.viagem.findUnique.mockResolvedValue(null);
    await expect(svc.rdv('v1', user())).rejects.toThrow(NotFoundException);
  });

  it('403 se a viagem é de outra filial', async () => {
    prisma.viagem.findUnique.mockResolvedValue({ ...viagemBase, filialId: 'f2' });
    await expect(svc.rdv('v1', user('f1'))).rejects.toThrow(ForbiddenException);
  });

  // ⭐ Regressão 03/07: a RDV impressa por planejamento somava despesa REJEITADA
  // (CONTESTADA) junto — deve trazer só APROVADA, como a RDV mensal/Fechamento.
  it('consulta despesas filtrando por situacao APROVADA (não soma PENDENTE/CONTESTADA)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(viagemBase);
    await svc.rdv('v1', user());
    // A ÚLTIMA chamada é a query da RDV — a primeira é o gate de escopo do planejamento.
    const arg = prisma.viagem.findUnique.mock.calls.at(-1)![0];
    expect(arg.include.despesas.where).toEqual({ situacao: 'APROVADA' });
  });

  it('agrega só o que a query devolve (APROVADA): totais batem com as linhas', async () => {
    prisma.viagem.findUnique.mockResolvedValue({
      ...viagemBase,
      adiantamento: 500,
      despesas: [
        { tipoDespesaId: 't1', valor: 1100, dataDespesa: new Date('2026-07-10T12:00:00-03:00'), tipoDespesa: { id: 't1', nome: 'IPVA', categoria: 'VEICULO' } },
      ],
      paradas: [{ dataHora: new Date('2026-07-10T12:00:00-03:00'), municipio: 'UNAI' }],
    });
    const r: any = await svc.rdv('v1', user());
    expect(r.total).toBe(1100);
    expect(r.totaisPorCategoria).toEqual({ VEICULO: 1100, INDIVIDUO: 0 });
    // saldo = adiantamento(500) − total(1100) = −600 (a reembolsar)
    expect(r.saldo).toBe(-600);
  });
});

// ⭐ Fila offline (app): reenvio com a mesma idempotencyKey NÃO pode duplicar.
describe('SupervisorService idempotência (fila offline)', () => {
  let prisma: any;
  let svc: SupervisorService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
  });

  it('lancarDespesa: idempotencyKey já existente → devolve a despesa e NÃO cria outra', async () => {
    prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', situacao: 'EM_CURSO', veiculoId: null });
    prisma.despesaVeiculo.findUnique.mockResolvedValue({ id: 'd-existente', valor: 100, tipoDespesa: { nome: 'IPVA', categoria: 'VEICULO' } });
    const r: any = await svc.lancarDespesa('v1', { tipoDespesaId: 't1', valor: 100, idempotencyKey: 'k1' } as any, user());
    expect(r.id).toBe('d-existente');
    expect(prisma.despesaVeiculo.create).not.toHaveBeenCalled();
  });

  it('adicionarVisita: idempotencyKey já existente → devolve a visita e NÃO cria outra', async () => {
    prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', situacao: 'EM_CURSO', statusPlanejamento: 'RASCUNHO' });
    prisma.parada.findUnique.mockResolvedValue({ id: 'p-existente', sequencia: 1 });
    const r: any = await svc.adicionarVisita('v1', { clienteNome: 'Fulano', idempotencyKey: 'k1' } as any, user());
    expect(r.id).toBe('p-existente');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

// ⭐ Fila de aprovação (Coordenação): coordenador vê os SEUS; gestor vê TODOS da filial.
describe('SupervisorService.listarPlanejamentosCoordenador', () => {
  let prisma: any;
  let svc: SupervisorService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
  });
  const comRole = (role: string) => ({ sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role }] }) as any;

  it('coordenador: filtra pelos supervisores do vínculo (coordenadorId = user.sub)', () => {
    void svc.listarPlanejamentosCoordenador(comRole('COORDENADOR'));
    const arg = prisma.viagem.findMany.mock.calls[0][0];
    expect(arg.where.supervisorRegistro).toEqual({ coordenadorId: 'u1' });
  });

  it('ADMIN: SEM filtro de coordenador — vê todos os planejamentos da filial', async () => {
    await svc.listarPlanejamentosCoordenador(comRole('ADMIN'));
    const arg = prisma.viagem.findMany.mock.calls[0][0];
    expect(arg.where.supervisorRegistro).toBeUndefined();
    expect(arg.where.filialId).toBe('f1');
  });

  it('Supervisor de Departamento: filtra por departamentoId ∈ seus departamentos', async () => {
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }, { departamentoId: 'd2' }]);
    await svc.listarPlanejamentosCoordenador(comRole('SUPERVISOR_FROTA'));
    const arg = prisma.viagem.findMany.mock.calls[0][0];
    expect(arg.where.supervisorRegistro).toEqual({ departamentoId: { in: ['d1', 'd2'] } });
  });
});

// ⭐ Escopo do Fechamento/RDV: coordenador só alcança os SEUS supervisores.
describe('SupervisorService escopo do coordenador (Fechamento/RDV)', () => {
  let prisma: any;
  let svc: SupervisorService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
  });
  const comRole = (role: string) => ({ sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role }] }) as any;

  it('listarSupervisores coordenador: filtra por coordenadorId=user.sub', async () => {
    prisma.supervisor.findMany.mockResolvedValue([]);
    await svc.listarSupervisores(comRole('COORDENADOR'));
    expect(prisma.supervisor.findMany.mock.calls[0][0].where.coordenadorId).toBe('u1');
  });
  it('listarSupervisores ADMIN: SEM filtro (vê todos da filial)', async () => {
    prisma.supervisor.findMany.mockResolvedValue([]);
    await svc.listarSupervisores(comRole('ADMIN'));
    const where = prisma.supervisor.findMany.mock.calls[0][0].where;
    expect(where.coordenadorId).toBeUndefined();
    expect(where.departamentoId).toBeUndefined();
  });
  it('listarSupervisores Supervisor de Departamento: filtra por departamentoId ∈ seus deptos', async () => {
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    prisma.supervisor.findMany.mockResolvedValue([]);
    await svc.listarSupervisores(comRole('SUPERVISOR_FROTA'));
    expect(prisma.supervisor.findMany.mock.calls[0][0].where.departamentoId).toEqual({ in: ['d1'] });
  });
  it('criarSupervisor Supervisor de Departamento: depto FORA do seu escopo → 403', async () => {
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    await expect(svc.criarSupervisor({ matricula: 'E1', nome: 'X', departamentoId: 'd9' } as any, comRole('SUPERVISOR_FROTA')))
      .rejects.toThrow(ForbiddenException);
    expect(prisma.supervisor.create).not.toHaveBeenCalled();
  });
  it('criarSupervisor Supervisor de Departamento: depto DELE → cria', async () => {
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    prisma.supervisor.findFirst.mockResolvedValue(null);
    prisma.supervisor.create.mockResolvedValue({ id: 's1' });
    await svc.criarSupervisor({ matricula: 'E1', nome: 'X', departamentoId: 'd1' } as any, comRole('SUPERVISOR_FROTA'));
    expect(prisma.supervisor.create.mock.calls[0][0].data.departamentoId).toBe('d1');
  });
  it('rdvMensal coordenador com supervisor de OUTRO coordenador → 403', async () => {
    prisma.supervisor.findUnique.mockResolvedValue({ id: 's1', filialId: 'f1', coordenadorId: 'outro-coord' });
    await expect(svc.rdvMensal('s1', 202607, comRole('COORDENADOR'))).rejects.toThrow(ForbiddenException);
  });
  it('rdvMensal coordenador com o SEU supervisor → não barra', async () => {
    prisma.supervisor.findUnique.mockResolvedValue({ id: 's1', filialId: 'f1', coordenadorId: 'u1' });
    prisma.viagem.findMany.mockResolvedValue([]);
    prisma.adiantamento.findMany.mockResolvedValue([]);
    await expect(svc.rdvMensal('s1', 202607, comRole('COORDENADOR'))).resolves.toBeDefined();
  });
  it('lancarAdiantamento coordenador em supervisor alheio → 403', async () => {
    prisma.supervisor.findUnique.mockResolvedValue({ id: 's1', filialId: 'f1', coordenadorId: 'outro-coord' });
    await expect(svc.lancarAdiantamento({ supervisorId: 's1', mesReferencia: 202607, valor: 100 } as any, comRole('COORDENADOR'))).rejects.toThrow(ForbiddenException);
  });

  // ⭐ Auto-serviço (mudança 15/07): o próprio SUPERVISOR de área lança/vê o adiantamento
  // do SEU cadastro (casado pela matrícula do login) — mas nunca o de outro representante.
  it('lancarAdiantamento SUPERVISOR no SEU cadastro (matrícula bate, tolera prefixo/zeros) → lança', async () => {
    prisma.supervisor.findUnique.mockResolvedValue({ id: 's1', filialId: 'f1', coordenadorId: 'algum-coord', matricula: 'E01047' });
    prisma.$queryRaw.mockResolvedValue([{ matricula: '1047', nome: 'Dono' }]); // chapa('1047') === chapa('E01047')
    prisma.adiantamento.create.mockResolvedValue({ id: 'a1' });
    await expect(svc.lancarAdiantamento({ supervisorId: 's1', mesReferencia: 202607, valor: 100 } as any, comRole('SUPERVISOR'))).resolves.toBeDefined();
    expect(prisma.adiantamento.create).toHaveBeenCalled();
  });
  it('lancarAdiantamento SUPERVISOR em cadastro de OUTRO (matrícula difere) → 403', async () => {
    prisma.supervisor.findUnique.mockResolvedValue({ id: 's1', filialId: 'f1', coordenadorId: 'outro-coord', matricula: 'E09999' });
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Outro' }]); // chapa ≠ E09999
    await expect(svc.lancarAdiantamento({ supervisorId: 's1', mesReferencia: 202607, valor: 100 } as any, comRole('SUPERVISOR'))).rejects.toThrow(ForbiddenException);
    expect(prisma.adiantamento.create).not.toHaveBeenCalled();
  });
  it('meuCadastroSupervisor resolve o cadastro do supervisor logado pela matrícula do login', async () => {
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Dono' }]);
    prisma.supervisor.findFirst.mockResolvedValue({ id: 's1', nome: 'Dono', matricula: 'E01047', coordenadorId: 'c1' });
    const reg = await svc.meuCadastroSupervisor(comRole('SUPERVISOR'));
    expect(reg).toEqual({ id: 's1', nome: 'Dono', matricula: 'E01047', coordenadorId: 'c1' });
    expect(prisma.supervisor.findFirst.mock.calls[0][0].where).toMatchObject({ filialId: 'f1', matricula: 'E01047', ativo: true });
  });
  it('meuCadastroSupervisor sem cadastro montado → null', async () => {
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Dono' }]);
    prisma.supervisor.findFirst.mockResolvedValue(null);
    await expect(svc.meuCadastroSupervisor(comRole('SUPERVISOR'))).resolves.toBeNull();
  });

  // ⭐ Aprovação do adiantamento (15/07): auto-serviço do supervisor nasce PENDENTE; o
  // lançamento do coordenador/departamento já nasce APROVADO. Só o coordenador (ou depto)
  // decide — nunca o supervisionado.
  it('lancarAdiantamento SUPERVISOR (auto-serviço) → nasce PENDENTE', async () => {
    prisma.supervisor.findUnique.mockResolvedValue({ id: 's1', filialId: 'f1', coordenadorId: 'algum-coord', matricula: 'E01047' });
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Dono' }]);
    prisma.adiantamento.create.mockResolvedValue({ id: 'a1' });
    await svc.lancarAdiantamento({ supervisorId: 's1', mesReferencia: 202607, valor: 100 } as any, comRole('SUPERVISOR'));
    expect(prisma.adiantamento.create.mock.calls[0][0].data.situacao).toBe('PENDENTE');
    expect(prisma.adiantamento.create.mock.calls[0][0].data.decididoPorId).toBeNull();
  });
  it('lancarAdiantamento COORDENADOR → já nasce APROVADO (com decididoPor)', async () => {
    prisma.supervisor.findUnique.mockResolvedValue({ id: 's1', filialId: 'f1', coordenadorId: 'u1' });
    prisma.adiantamento.create.mockResolvedValue({ id: 'a1' });
    await svc.lancarAdiantamento({ supervisorId: 's1', mesReferencia: 202607, valor: 100 } as any, comRole('COORDENADOR'));
    expect(prisma.adiantamento.create.mock.calls[0][0].data.situacao).toBe('APROVADO');
    expect(prisma.adiantamento.create.mock.calls[0][0].data.decididoPorId).toBe('u1');
  });
  it('decidirAdiantamento coordenador do rep APROVAR → APROVADO', async () => {
    prisma.adiantamento.findUnique.mockResolvedValue({ id: 'a1', supervisorId: 's1', mesReferencia: 202607, situacao: 'PENDENTE', supervisor: { filialId: 'f1', coordenadorId: 'u1', departamentoId: null } });
    prisma.adiantamento.update.mockResolvedValue({ id: 'a1' });
    await svc.decidirAdiantamento('a1', 'APROVAR', undefined, comRole('COORDENADOR'));
    expect(prisma.adiantamento.update.mock.calls[0][0].data.situacao).toBe('APROVADO');
  });
  it('decidirAdiantamento REJEITAR sem motivo → 400', async () => {
    prisma.adiantamento.findUnique.mockResolvedValue({ id: 'a1', supervisorId: 's1', mesReferencia: 202607, situacao: 'PENDENTE', supervisor: { filialId: 'f1', coordenadorId: 'u1', departamentoId: null } });
    await expect(svc.decidirAdiantamento('a1', 'REJEITAR', '', comRole('COORDENADOR'))).rejects.toThrow(BadRequestException);
  });
  it('decidirAdiantamento de coordenador ALHEIO → 403 (não decide)', async () => {
    prisma.adiantamento.findUnique.mockResolvedValue({ id: 'a1', supervisorId: 's1', mesReferencia: 202607, situacao: 'PENDENTE', supervisor: { filialId: 'f1', coordenadorId: 'outro', departamentoId: null } });
    await expect(svc.decidirAdiantamento('a1', 'APROVAR', undefined, comRole('COORDENADOR'))).rejects.toThrow(ForbiddenException);
  });
  it('decidirAdiantamento já decidido → 400', async () => {
    prisma.adiantamento.findUnique.mockResolvedValue({ id: 'a1', supervisorId: 's1', mesReferencia: 202607, situacao: 'APROVADO', supervisor: { filialId: 'f1', coordenadorId: 'u1', departamentoId: null } });
    await expect(svc.decidirAdiantamento('a1', 'APROVAR', undefined, comRole('COORDENADOR'))).rejects.toThrow(BadRequestException);
  });
});

// ⭐ Owner-check do workflow (enviar/iniciar): só o representante DONO (por matrícula), o
// coordenador dele, o Supervisor de Departamento (se é de um depto seu) ou ADMIN avançam o
// estado. Fecha o buraco de um SUPERVISOR da mesma filial mexer no planejamento alheio
// (gate de segurança 14/07) + escopo por departamento do Supervisor de Departamento.
describe('SupervisorService workflow enviar/iniciar — owner-check', () => {
  let prisma: any;
  let svc: SupervisorService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
    prisma.viagem.update.mockResolvedValue({ id: 'v1' });
  });
  const comRole = (role: string) => ({ sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role }] }) as any;
  // planejamento de OUTRO representante: matrícula do dono E09999, coordenador 'outro', depto 'd-outro'.
  const planAlheio = (statusPlanejamento: string) => ({
    id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', statusPlanejamento, criadoPorId: 'outro',
    supervisorRegistro: { coordenadorId: 'outro-coord', matricula: 'E09999', departamentoId: 'd-outro' },
  });

  it('enviar: SUPERVISOR que NÃO é o dono (matrícula diferente) → 403', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planAlheio('RASCUNHO'));
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Outro Sup' }]); // chapa ≠ E09999
    await expect(svc.enviarPlanejamento('v1', comRole('SUPERVISOR'))).rejects.toThrow(ForbiddenException);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });

  it('enviar: SUPERVISOR DONO (matrícula bate, tolera prefixo/zeros) → envia', async () => {
    prisma.viagem.findUnique.mockResolvedValue({
      id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', statusPlanejamento: 'RASCUNHO', criadoPorId: 'u1',
      supervisorRegistro: { coordenadorId: 'algum-coord', matricula: 'E01047' },
    });
    prisma.$queryRaw.mockResolvedValue([{ matricula: '1047', nome: 'Dono' }]); // chapa('1047') === chapa('E01047')
    await svc.enviarPlanejamento('v1', comRole('SUPERVISOR'));
    expect(prisma.viagem.update.mock.calls[0][0].data.statusPlanejamento).toBe('ENVIADO');
  });

  it('enviar: COORDENADOR do supervisor (sem depender de matrícula) → envia', async () => {
    prisma.viagem.findUnique.mockResolvedValue({
      id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', statusPlanejamento: 'RASCUNHO', criadoPorId: 'outro',
      supervisorRegistro: { coordenadorId: 'u1', matricula: 'E09999', departamentoId: 'd-outro' },
    });
    await svc.enviarPlanejamento('v1', comRole('COORDENADOR'));
    expect(prisma.viagem.update).toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled(); // atalho pelo coordenador
  });

  it('enviar: ADMIN passa direto (oversight), sem lookup de matrícula', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planAlheio('RASCUNHO'));
    await svc.enviarPlanejamento('v1', comRole('ADMIN'));
    expect(prisma.viagem.update).toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('enviar: Supervisor de Departamento no SEU depto → envia (via veículos que supervisiona)', async () => {
    prisma.viagem.findUnique.mockResolvedValue({
      id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', statusPlanejamento: 'RASCUNHO', criadoPorId: 'outro',
      supervisorRegistro: { coordenadorId: 'outro-coord', matricula: 'E09999', departamentoId: 'd1' },
    });
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]); // depto do rep ∈ seus deptos
    await svc.enviarPlanejamento('v1', comRole('SUPERVISOR_FROTA'));
    expect(prisma.viagem.update.mock.calls[0][0].data.statusPlanejamento).toBe('ENVIADO');
    expect(prisma.$queryRaw).not.toHaveBeenCalled(); // não precisa de matrícula: decide por departamento
  });

  it('enviar: Supervisor de Departamento em depto que NÃO é seu → 403', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planAlheio('RASCUNHO')); // depto 'd-outro'
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]); // só cobre 'd1'
    await expect(svc.enviarPlanejamento('v1', comRole('SUPERVISOR_FROTA'))).rejects.toThrow(ForbiddenException);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });

  it('iniciar: SUPERVISOR que NÃO é o dono → 403 (não muda estado)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planAlheio('APROVADO'));
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Outro Sup' }]);
    await expect(svc.iniciarExecucao('v1', comRole('SUPERVISOR'))).rejects.toThrow(ForbiddenException);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });
});

// ⭐ Bloqueio: não criar planejamento sem cadastro/coordenador (senão nasce órfão e não
// roteia p/ aprovação — buraco pego no teste E2E de 14/07). Também barra o ENVIAR órfão.
describe('SupervisorService.criarViagemSupervisor — exige cadastro + coordenador', () => {
  let prisma: any;
  let svc: SupervisorService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
    // self-service: matriculaDoUsuario($queryRaw) → matrícula do supervisor logado.
    prisma.$queryRaw.mockResolvedValue([{ matricula: '005274', nome: 'Kelver' }]);
  });
  const comRole = (role: string) => ({ sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role }] }) as any;

  it('SUPERVISOR sem cadastro na equipe → 400 (não cria)', async () => {
    prisma.supervisor.findFirst.mockResolvedValue(null);
    await expect(svc.criarViagemSupervisor({ mesReferencia: 202607 } as any, comRole('SUPERVISOR'))).rejects.toThrow(BadRequestException);
    expect(prisma.viagem.create).not.toHaveBeenCalled();
  });

  it('SUPERVISOR cadastrado mas SEM coordenador → 400 (não cria)', async () => {
    prisma.supervisor.findFirst.mockResolvedValue({ id: 's1', coordenadorId: null });
    await expect(svc.criarViagemSupervisor({ mesReferencia: 202607 } as any, comRole('SUPERVISOR'))).rejects.toThrow(BadRequestException);
    expect(prisma.viagem.create).not.toHaveBeenCalled();
  });

  it('SUPERVISOR cadastrado COM coordenador → cria, vinculado ao cadastro', async () => {
    prisma.supervisor.findFirst.mockResolvedValue({ id: 's1', coordenadorId: 'coord1' });
    prisma.contadorSequencial.upsert.mockResolvedValue({ ultimoNumero: 1 });
    prisma.viagem.create.mockResolvedValue({ id: 'v1' });
    await svc.criarViagemSupervisor({ mesReferencia: 202607 } as any, comRole('SUPERVISOR'));
    expect(prisma.viagem.create.mock.calls[0][0].data.supervisorRegistroId).toBe('s1');
  });

  it('Supervisor de Departamento sem informar a matrícula do representante → 400', async () => {
    // não é self-service (role ≠ SUPERVISOR) e não veio matrícula → não há a quem vincular.
    await expect(svc.criarViagemSupervisor({ mesReferencia: 202607 } as any, comRole('SUPERVISOR_FROTA'))).rejects.toThrow(BadRequestException);
    expect(prisma.viagem.create).not.toHaveBeenCalled();
  });
});

// ⭐ Escopo do CONTEÚDO do RDV (visitas/despesas). Antes essas rotas checavam só a
// filial: qualquer papel do @Roles da classe — inclusive OPERADOR_ENTREGA e um
// supervisor COLEGA — lançava/removia visita e despesa no RDV alheio. Agora valem as
// MESMAS pessoas de enviar/iniciar: dono (por matrícula), coordenador dele, Supervisor
// de Departamento do depto, ADMIN.
describe('SupervisorService conteúdo do RDV — escopo dono/coordenador/depto', () => {
  let prisma: any;
  let svc: SupervisorService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
  });
  const comRole = (role: string) => ({ sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role }] }) as any;
  // Planejamento de OUTRO representante: dono E09999, coordenador 'outro-coord', depto 'd-outro'.
  const planAlheio = () => ({
    id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', situacao: 'EM_CURSO', statusPlanejamento: 'EM_EXECUCAO',
    criadoPorId: 'outro', mesReferencia: 202607, supervisorRegistroId: 's-outro', veiculoId: null,
    supervisorRegistro: { coordenadorId: 'outro-coord', matricula: 'E09999', departamentoId: 'd-outro' },
  });
  const planDoMeuTime = () => ({ ...planAlheio(), supervisorRegistro: { coordenadorId: 'u1', matricula: 'E09999', departamentoId: 'd-outro' } });

  it('adicionarVisita: SUPERVISOR COLEGA (matrícula diferente) → 403 e NÃO cria a visita', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planAlheio());
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Colega' }]); // chapa ≠ E09999
    await expect(svc.adicionarVisita('v1', { clienteNome: 'X' } as any, comRole('SUPERVISOR'))).rejects.toThrow(ForbiddenException);
    expect(prisma.parada.create).not.toHaveBeenCalled();
  });

  it('adicionarVisita: OPERADOR_ENTREGA (não participa do RDV) → 403', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planAlheio());
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Operador' }]);
    await expect(svc.adicionarVisita('v1', { clienteNome: 'X' } as any, comRole('OPERADOR_ENTREGA'))).rejects.toThrow(ForbiddenException);
    expect(prisma.parada.create).not.toHaveBeenCalled();
  });

  it('apontarVisita: COORDENADOR de OUTRO time → 403 e NÃO aponta', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planAlheio()); // coordenadorId = 'outro-coord'
    await expect(svc.apontarVisita('v1', 'p1', { status: 'REALIZADA' } as any, comRole('COORDENADOR'))).rejects.toThrow(ForbiddenException);
    expect(prisma.parada.update).not.toHaveBeenCalled();
  });

  it('apontarVisita: COORDENADOR do representante → aponta (fluxo legítimo preservado)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planDoMeuTime());
    prisma.parada.findUnique.mockResolvedValue({ id: 'p1', viagemId: 'v1', localClienteId: null, latitude: null });
    prisma.parada.update.mockResolvedValue({ id: 'p1', status: 'REALIZADA', localClienteId: null });
    await svc.apontarVisita('v1', 'p1', { status: 'REALIZADA' } as any, comRole('COORDENADOR'));
    expect(prisma.parada.update.mock.calls[0][0].data.status).toBe('REALIZADA');
  });

  it('lancarDespesa: SUPERVISOR COLEGA no RDV alheio → 403 e NÃO cria a despesa', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planAlheio());
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Colega' }]);
    await expect(svc.lancarDespesa('v1', { tipoDespesaId: 't1', valor: 50 } as any, comRole('SUPERVISOR'))).rejects.toThrow(ForbiddenException);
    expect(prisma.despesaVeiculo.create).not.toHaveBeenCalled();
  });

  it('removerDespesa: COORDENADOR de OUTRO time → 403 e NÃO apaga', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planAlheio());
    await expect(svc.removerDespesa('v1', 'd1', comRole('COORDENADOR'))).rejects.toThrow(ForbiddenException);
    expect(prisma.despesaVeiculo.delete).not.toHaveBeenCalled();
  });

  it('concluirViagemSupervisor: SUPERVISOR COLEGA → 403 (não fecha o RDV do outro)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planAlheio());
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Colega' }]);
    await expect(svc.concluirViagemSupervisor('v1', comRole('SUPERVISOR'))).rejects.toThrow(ForbiddenException);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });

  it('Supervisor de Departamento no SEU depto lança visita (decide por departamento, sem matrícula)', async () => {
    prisma.viagem.findUnique.mockResolvedValue({ ...planAlheio(), supervisorRegistro: { coordenadorId: 'outro-coord', matricula: 'E09999', departamentoId: 'd1' } });
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    prisma.parada.count.mockResolvedValue(0);
    prisma.parada.create.mockResolvedValue({ id: 'p9', status: 'REALIZADA', localClienteId: null });
    await svc.adicionarVisita('v1', { clienteNome: 'X' } as any, comRole('SUPERVISOR_FROTA'));
    expect(prisma.parada.create).toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

// ⭐ Autoridade lança → despesa JÁ NASCE APROVADA (27/07, decisão do Clenio: quem
// está no topo da pirâmide não pede aval de si mesmo). A segregação de função deixou
// de ser um `if` e virou estrutural: só o representante cria PENDENTE, e ele nunca
// decide o próprio. Regra por REPRESENTANTE, não por papel — o coordenador que também
// tem RDV próprio não é autoridade sobre o seu.
describe('SupervisorService.lancarDespesa — situação inicial conforme quem lança', () => {
  let prisma: any;
  let svc: SupervisorService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
    prisma.tipoDespesa.findFirst.mockResolvedValue({ id: 't1', categoria: 'INDIVIDUO', ativo: true });
    prisma.despesaVeiculo.create.mockResolvedValue({ id: 'd1' });
  });
  const comRole = (role: string) => ({ sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role }] }) as any;
  const plan = (reg: any) => ({
    id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', situacao: 'EM_CURSO', statusPlanejamento: 'EM_EXECUCAO',
    criadoPorId: 'outro', mesReferencia: 202607, supervisorRegistroId: 's1', veiculoId: null, supervisorRegistro: reg,
  });
  const dto = { tipoDespesaId: 't1', valor: 50, data: '2026-07-10' } as any;

  it('Supervisor de Departamento no SEU depto → nasce APROVADA (topo da pirâmide)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan({ coordenadorId: 'outro-coord', matricula: 'E09999', departamentoId: 'd1' }));
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    await svc.lancarDespesa('v1', dto, comRole('SUPERVISOR_FROTA'));
    const data = prisma.despesaVeiculo.create.mock.calls[0][0].data;
    expect(data.situacao).toBe('APROVADA');
    expect(data.aprovadoPorId).toBe('u1');
  });

  it('COORDENADOR no RDV do SEU representante → nasce APROVADA', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan({ coordenadorId: 'u1', matricula: 'E09999', departamentoId: 'd-outro' }));
    await svc.lancarDespesa('v1', dto, comRole('COORDENADOR'));
    expect(prisma.despesaVeiculo.create.mock.calls[0][0].data.situacao).toBe('APROVADA');
  });

  it('COORDENADOR no RDV PRÓPRIO (ele é o representante) → PENDENTE, não é autoridade sobre si', async () => {
    // cadastro do próprio coordenador: sem coordenadorId (roteia pelo departamento).
    prisma.viagem.findUnique.mockResolvedValue(plan({ coordenadorId: null, matricula: 'E01047', departamentoId: 'd-outro' }));
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Coord dono' }]); // é o dono → pode lançar
    await svc.lancarDespesa('v1', dto, comRole('COORDENADOR'));
    const data = prisma.despesaVeiculo.create.mock.calls[0][0].data;
    expect(data.situacao).toBe('PENDENTE');
    expect(data.aprovadoPorId).toBeNull();
  });

  it('SUPERVISOR de área no próprio RDV → PENDENTE (segue precisando de aval)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan({ coordenadorId: 'algum-coord', matricula: 'E01047', departamentoId: 'd-outro' }));
    prisma.$queryRaw.mockResolvedValue([{ matricula: '1047', nome: 'Dono' }]);
    await svc.lancarDespesa('v1', dto, comRole('SUPERVISOR'));
    expect(prisma.despesaVeiculo.create.mock.calls[0][0].data.situacao).toBe('PENDENTE');
  });

  it('a despesa PENDENTE do representante segue indecidível por ele (segregação estrutural)', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({
      id: 'd1', viagemId: 'v1', filialId: 'f1', criadoPorId: 'u1',
      viagem: { tipo: 'SUPERVISOR', filialId: 'f1', supervisorRegistro: { coordenadorId: 'outro-coord', departamentoId: 'd-outro' } },
    });
    await expect(svc.decidirDespesa('v1', 'd1', 'APROVADA', undefined, comRole('SUPERVISOR'))).rejects.toThrow(ForbiddenException);
    expect(prisma.despesaVeiculo.update).not.toHaveBeenCalled();
  });

  it('a autoridade PODE contestar depois um lançamento que ela mesma fez', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({
      id: 'd1', viagemId: 'v1', filialId: 'f1', criadoPorId: 'u1',
      viagem: { tipo: 'SUPERVISOR', filialId: 'f1', supervisorRegistro: { coordenadorId: 'u1', departamentoId: 'd1' } },
    });
    prisma.despesaVeiculo.update.mockResolvedValue({ id: 'd1' });
    await svc.decidirDespesa('v1', 'd1', 'CONTESTADA', 'lancei errado', comRole('COORDENADOR'));
    expect(prisma.despesaVeiculo.update.mock.calls[0][0].data.situacao).toBe('CONTESTADA');
  });
});

// ⭐ Escopo de LEITURA: a listagem devolvia todos os RDVs da filial (no app, o
// supervisor via a prestação de contas dos colegas) e o detalhe/RDV/comprovante
// abriam qualquer um. Agora espelham o escopo da escrita.
describe('SupervisorService leitura do RDV — escopo', () => {
  let prisma: any;
  let svc: SupervisorService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
  });
  const comRole = (role: string) => ({ sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role }] }) as any;

  it('listar (COORDENADOR): filtra por time + o que ele criou + o SEU cadastro', async () => {
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Coord' }]);
    prisma.supervisor.findMany.mockResolvedValue([{ id: 's-meu', matricula: '1047' }, { id: 's-outro', matricula: 'E09999' }]);
    await svc.listarViagensSupervisor(comRole('COORDENADOR'));
    const where = prisma.viagem.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { criadoPorId: 'u1' },
      { supervisorRegistro: { coordenadorId: 'u1' } },
      { supervisorRegistroId: { in: ['s-meu'] } }, // chapa('1047') === chapa('E01047')
    ]);
  });

  it('listar (Supervisor de Departamento): filtra pelos SEUS departamentos', async () => {
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    prisma.$queryRaw.mockResolvedValue([]); // sem matrícula no login
    await svc.listarViagensSupervisor(comRole('SUPERVISOR_FROTA'));
    const where = prisma.viagem.findMany.mock.calls[0][0].where;
    expect(where.OR).toContainEqual({ supervisorRegistro: { departamentoId: { in: ['d1'] } } });
  });

  it('listar (ADMIN): SEM filtro de escopo — vê a filial inteira', async () => {
    await svc.listarViagensSupervisor(comRole('ADMIN'));
    const where = prisma.viagem.findMany.mock.calls[0][0].where;
    expect(where.OR).toBeUndefined();
    expect(where.filialId).toBe('f1');
  });

  it('obterViagemSupervisor: planejamento de OUTRO time → 403', async () => {
    prisma.viagem.findUnique.mockResolvedValue({
      id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', criadoPorId: 'outro',
      supervisorRegistro: { coordenadorId: 'outro-coord', matricula: 'E09999', departamentoId: 'd-outro' },
      paradas: [], despesas: [], saidasVinculadas: [],
    });
    await expect(svc.obterViagemSupervisor('v1', comRole('COORDENADOR'))).rejects.toThrow(ForbiddenException);
  });

  it('obterReciboDespesa: comprovante de RDV alheio → 403 (não baixa do cofre)', async () => {
    const storage = storageMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storage, locaisMock());
    prisma.viagem.findUnique.mockResolvedValue({
      id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', criadoPorId: 'outro',
      supervisorRegistro: { coordenadorId: 'outro-coord', matricula: 'E09999', departamentoId: 'd-outro' },
    });
    await expect(svc.obterReciboDespesa('v1', 'd1', comRole('COORDENADOR'))).rejects.toThrow(ForbiddenException);
    expect(storage.get).not.toHaveBeenCalled();
  });
});

// ⭐ Força maior DEPOIS do aval: até aqui só existiam Ajustar/Rejeitar (válidos no
// ENVIADO), então o planejamento aprovado ficava pendurado para sempre — ou virava um
// RDV concluído e vazio. CANCELADO tira da prestação de contas; devolver reconfigura.
describe('SupervisorService cancelar/devolver planejamento', () => {
  let prisma: any;
  let svc: SupervisorService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
    prisma.viagem.update.mockResolvedValue({ id: 'v1' });
  });
  const comRole = (role: string) => ({ sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role }] }) as any;
  const plan = (statusPlanejamento: string, situacao = 'EM_CURSO') => ({
    id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', situacao, statusPlanejamento, criadoPorId: 'outro',
    mesReferencia: 202607, supervisorRegistroId: 's1',
    supervisorRegistro: { coordenadorId: 'u1', matricula: 'E09999', departamentoId: 'd1' },
  });

  it('cancelar sem motivo → 400 (o motivo é o único rastro do que aconteceu)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('APROVADO'));
    await expect(svc.cancelarPlanejamento('v1', '  ', comRole('COORDENADOR'))).rejects.toThrow(BadRequestException);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });

  it('cancelar APROVADO: marca CANCELADO/CANCELADA com motivo, autor e data', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('APROVADO'));
    prisma.despesaVeiculo.count.mockResolvedValue(0);
    await svc.cancelarPlanejamento('v1', 'Representante afastado', comRole('COORDENADOR'));
    const data = prisma.viagem.update.mock.calls[0][0].data;
    expect(data.statusPlanejamento).toBe('CANCELADO');
    expect(data.situacao).toBe('CANCELADA');
    expect(data.motivoCancelamento).toBe('Representante afastado');
    expect(data.canceladoPorId).toBe('u1');
  });

  it('cancelar contesta as despesas PENDENTES (senão ficam órfãs na fila do coordenador)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('EM_EXECUCAO'));
    prisma.despesaVeiculo.count.mockResolvedValue(0);
    await svc.cancelarPlanejamento('v1', 'Veículo quebrado', comRole('COORDENADOR'));
    const arg = prisma.despesaVeiculo.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ viagemId: 'v1', situacao: 'PENDENTE' });
    expect(arg.data.situacao).toBe('CONTESTADA');
    expect(arg.data.motivoContestacao).toContain('Veículo quebrado');
  });

  it('cancelar com despesa já APROVADA → 400 (dinheiro já entrou na prestação de contas)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('EM_EXECUCAO'));
    prisma.despesaVeiculo.count.mockResolvedValue(2);
    await expect(svc.cancelarPlanejamento('v1', 'motivo', comRole('COORDENADOR'))).rejects.toThrow(BadRequestException);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });

  it('cancelar planejamento CONCLUÍDO → 400 (reabra antes)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('CONCLUIDO', 'CONCLUIDA'));
    await expect(svc.cancelarPlanejamento('v1', 'motivo', comRole('COORDENADOR'))).rejects.toThrow(BadRequestException);
  });

  it('cancelar com o mês do RDV encerrado → 400', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('APROVADO'));
    prisma.fechamentoRdv.findUnique.mockResolvedValue({ id: 'f1' }); // mês fechado
    await expect(svc.cancelarPlanejamento('v1', 'motivo', comRole('COORDENADOR'))).rejects.toThrow(BadRequestException);
  });

  it('cancelar de COORDENADOR de OUTRO time → 403', async () => {
    prisma.viagem.findUnique.mockResolvedValue({ ...plan('APROVADO'), supervisorRegistro: { coordenadorId: 'outro', matricula: 'E09999', departamentoId: 'd-outro' } });
    await expect(svc.cancelarPlanejamento('v1', 'motivo', comRole('COORDENADOR'))).rejects.toThrow(ForbiddenException);
  });

  it('depois de cancelado: lançar despesa → 400 (não recebe mais nada)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('CANCELADO', 'CANCELADA'));
    await expect(svc.lancarDespesa('v1', { tipoDespesaId: 't1', valor: 10 } as any, comRole('COORDENADOR'))).rejects.toThrow(BadRequestException);
    expect(prisma.despesaVeiculo.create).not.toHaveBeenCalled();
  });

  it('depois de cancelado: adicionar visita → 400', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('CANCELADO', 'CANCELADA'));
    await expect(svc.adicionarVisita('v1', { clienteNome: 'X' } as any, comRole('COORDENADOR'))).rejects.toThrow(BadRequestException);
    expect(prisma.parada.create).not.toHaveBeenCalled();
  });

  it('reabrir um CANCELADO reativa como AJUSTADO e limpa o rastro do cancelamento', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('CANCELADO', 'CANCELADA'));
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    await svc.reabrirViagem('v1', comRole('SUPERVISOR_FROTA'));
    const data = prisma.viagem.update.mock.calls[0][0].data;
    expect(data.situacao).toBe('EM_CURSO');
    expect(data.statusPlanejamento).toBe('AJUSTADO');
    expect(data.motivoCancelamento).toBeNull();
  });

  it('devolver APROVADO → AJUSTADO (o representante reconfigura e reenvia)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('APROVADO'));
    await svc.devolverPlanejamento('v1', 'Trocar a região', comRole('COORDENADOR'));
    const data = prisma.viagem.update.mock.calls[0][0].data;
    expect(data.statusPlanejamento).toBe('AJUSTADO');
    expect(data.comentarioCoordenador).toBe('Trocar a região');
  });

  it('devolver EM_EXECUCAO → AJUSTADO (força maior no meio da viagem)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('EM_EXECUCAO'));
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]); // depto do rep
    await svc.devolverPlanejamento('v1', 'Rota mudou', comRole('SUPERVISOR_FROTA'));
    expect(prisma.viagem.update.mock.calls[0][0].data.statusPlanejamento).toBe('AJUSTADO');
  });

  it('devolver um ENVIADO → 400 (ali o caminho é Ajustar/Rejeitar)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('ENVIADO'));
    await expect(svc.devolverPlanejamento('v1', 'comentario', comRole('COORDENADOR'))).rejects.toThrow(BadRequestException);
  });

  it('devolver sem comentário → 400', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('APROVADO'));
    await expect(svc.devolverPlanejamento('v1', '', comRole('COORDENADOR'))).rejects.toThrow(BadRequestException);
  });
});

// ⭐ 27/07: o escopo do Supervisor de Departamento no RDV deixou de ser DERIVADO dos
// veículos que ele supervisiona (`veiculo.supervisorId` — aquilo é responsabilidade
// sobre o VEÍCULO, da frota) e passou a ser a amarração explícita da aba Equipe.
// Antes, tirar o último veículo da pessoa a removia do RDV em silêncio.
describe('SupervisorService — amarração Supervisor de Departamento × departamento', () => {
  let prisma: any;
  let svc: SupervisorService;
  let core: any;
  beforeEach(() => {
    prisma = createPrismaMock();
    core = {
      validarDepartamento: jest.fn(), validarUsuario: jest.fn(),
      departamentoEhDaFilial: jest.fn().mockResolvedValue(true),
      nomesDepartamentos: jest.fn().mockResolvedValue(new Map()),
      nomesUsuarios: jest.fn().mockResolvedValue(new Map()),
      departamentosDaFilial: jest.fn().mockResolvedValue([]),
    };
    svc = new SupervisorService(prisma, condutorMock(), core, storageMock(), locaisMock());
  });
  const comRole = (role: string) => ({ sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role }] }) as any;

  it('o escopo vem da tabela de amarração, NÃO dos veículos', async () => {
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    await svc.listarPlanejamentosCoordenador(comRole('SUPERVISOR_FROTA'));
    expect(prisma.supervisorDepartamento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { filialId: 'f1', usuarioId: 'u1' } }),
    );
    expect(prisma.veiculo.findMany).not.toHaveBeenCalled(); // frota desacoplada do RDV
    expect(prisma.viagem.findMany.mock.calls[0][0].where.supervisorRegistro).toEqual({ departamentoId: { in: ['d1'] } });
  });

  it('sem amarração → não cobre departamento nenhum (falha FECHADA)', async () => {
    prisma.supervisorDepartamento.findMany.mockResolvedValue([]);
    prisma.viagem.findUnique.mockResolvedValue({
      id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', statusPlanejamento: 'ENVIADO',
      supervisorRegistro: { coordenadorId: 'outro', matricula: 'E09999', departamentoId: 'd1' },
    });
    await expect(svc.decidirPlanejamento('v1', 'APROVADO', undefined, comRole('SUPERVISOR_FROTA'))).rejects.toThrow(ForbiddenException);
  });

  // ⚠️ Esta tabela é a FONTE da autoridade do SUPERVISOR_FROTA: se ele pudesse
  // escrevê-la, se acrescentaria em qualquer departamento e aprovaria a prestação de
  // contas de quem quisesse (mesma classe do gate de 14/07).
  it('SUPERVISOR_FROTA NÃO define a própria amarração → 403 (anti auto-escalada)', async () => {
    await expect(svc.definirSupervisorDepartamento('d9', 'u1', comRole('SUPERVISOR_FROTA'))).rejects.toThrow(ForbiddenException);
    expect(prisma.supervisorDepartamento.upsert).not.toHaveBeenCalled();
  });

  it('COORDENADOR também não define → 403', async () => {
    await expect(svc.definirSupervisorDepartamento('d9', 'u2', comRole('COORDENADOR'))).rejects.toThrow(ForbiddenException);
  });

  it('ADMIN define: valida depto e usuário no core e faz upsert por (filial, depto)', async () => {
    prisma.supervisorDepartamento.upsert.mockResolvedValue({ id: 'sd1' });
    await svc.definirSupervisorDepartamento('d9', 'u9', comRole('ADMIN'));
    expect(core.validarDepartamento).toHaveBeenCalledWith('d9');
    expect(core.validarUsuario).toHaveBeenCalledWith('u9', 'Responsável');
    const arg = prisma.supervisorDepartamento.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ filialId_departamentoId: { filialId: 'f1', departamentoId: 'd9' } });
    expect(arg.create.usuarioId).toBe('u9');
  });

  it('ADMIN sem informar o responsável → 400', async () => {
    await expect(svc.definirSupervisorDepartamento('d9', '  ', comRole('ADMIN'))).rejects.toThrow(BadRequestException);
  });

  it('remover a amarração: só ADMIN', async () => {
    await expect(svc.removerSupervisorDepartamento('d9', comRole('SUPERVISOR_FROTA'))).rejects.toThrow(ForbiddenException);
    await svc.removerSupervisorDepartamento('d9', comRole('ADMIN'));
    expect(prisma.supervisorDepartamento.deleteMany).toHaveBeenCalledWith({ where: { filialId: 'f1', departamentoId: 'd9' } });
  });

  // ⭐ 28/07: a tela listava o CATÁLOGO inteiro (`core.departamentos` é por filial e tem
  // nomes repetidos — "Agroveterinaria" em 16 filiais), virando dezenas de linhas
  // indistinguíveis e uma parede de "sem responsável". Agora vêm só os departamentos que
  // PARTICIPAM do RDV da filial: com representante ativo ou já com responsável.
  it('listar traz só os departamentos com representante OU com responsável, da filial', async () => {
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1', usuarioId: 'u7' }]);
    prisma.supervisor.groupBy.mockResolvedValue([{ departamentoId: 'd2', _count: { _all: 3 } }]);
    core.nomesDepartamentos.mockResolvedValue(new Map([['d1', 'Compras'], ['d2', 'Vendas']]));
    core.nomesUsuarios.mockResolvedValue(new Map([['u7', 'Fulano']]));
    const r: any = await svc.listarSupervisoresDepartamento(comRole('SUPERVISOR_FROTA'));
    expect(prisma.supervisorDepartamento.findMany.mock.calls[0][0].where).toEqual({ filialId: 'f1' });
    expect(prisma.supervisor.groupBy.mock.calls[0][0].where).toEqual({ filialId: 'f1', ativo: true, departamentoId: { not: null } });
    expect(r.map((x: any) => x.departamentoNome)).toEqual(['Compras', 'Vendas']); // ordenado por nome
    expect(r.find((x: any) => x.departamentoId === 'd1')).toMatchObject({ responsavelNome: 'Fulano', representantes: 0 });
    // Departamento COM gente e SEM responsável — é o caso que trava a prestação de contas.
    expect(r.find((x: any) => x.departamentoId === 'd2')).toMatchObject({ usuarioId: null, representantes: 3 });
  });

  // ⭐ Integridade: a amarração grava a filial do USUÁRIO. Aceitar departamento de outra
  // filial criaria (minha filial × departamento alheio) — autoridade fantasma, silenciosa.
  it('ADMIN definindo departamento de OUTRA filial → 400 (não grava)', async () => {
    core.departamentoEhDaFilial.mockResolvedValue(false);
    await expect(svc.definirSupervisorDepartamento('d-outra-filial', 'u9', comRole('ADMIN'))).rejects.toThrow(BadRequestException);
    expect(prisma.supervisorDepartamento.upsert).not.toHaveBeenCalled();
  });

  it('departamentosDaFilial usa a filial do usuário (não o catálogo global)', async () => {
    await svc.departamentosDaFilial(comRole('ADMIN'));
    expect(core.departamentosDaFilial).toHaveBeenCalledWith('f1');
  });
});

// ⭐ 28/07: o ADMIN é global por política (`podeVerOutrasFiliais`), mas a aba Equipe
// usava só a filial do token — logado na matriz, ele não alcançava o time das outras 34
// filiais sem trocar a filial da SESSÃO no Hub. Agora informa a filial alvo; para os
// demais papéis o parâmetro é IGNORADO (a filial vem do token, como no resto do módulo).
describe('SupervisorService — filial alvo da aba Equipe (ADMIN global)', () => {
  let prisma: any;
  let svc: SupervisorService;
  let core: any;
  beforeEach(() => {
    prisma = createPrismaMock();
    core = {
      validarFilial: jest.fn(), validarDepartamento: jest.fn(), validarUsuario: jest.fn(),
      departamentoEhDaFilial: jest.fn().mockResolvedValue(true),
      nomesDepartamentos: jest.fn().mockResolvedValue(new Map()),
      nomesUsuarios: jest.fn().mockResolvedValue(new Map()),
      departamentosDaFilial: jest.fn().mockResolvedValue([]),
    };
    svc = new SupervisorService(prisma, condutorMock(), core, storageMock(), locaisMock());
  });
  const comRole = (role: string) => ({ sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role }] }) as any;

  it('ADMIN informando outra filial: lista o time DELA (e valida a filial no core)', async () => {
    prisma.supervisor.findMany.mockResolvedValue([]);
    await svc.listarSupervisores(comRole('ADMIN'), false, 'f2');
    expect(core.validarFilial).toHaveBeenCalledWith('f2');
    expect(prisma.supervisor.findMany.mock.calls[0][0].where.filialId).toBe('f2');
  });

  it('Supervisor de Departamento informando outra filial: IGNORADO, fica na do token', async () => {
    prisma.supervisor.findMany.mockResolvedValue([]);
    prisma.supervisorDepartamento.findMany.mockResolvedValue([]);
    await svc.listarSupervisores(comRole('SUPERVISOR_FROTA'), false, 'f2');
    expect(core.validarFilial).not.toHaveBeenCalled();
    expect(prisma.supervisor.findMany.mock.calls[0][0].where.filialId).toBe('f1');
  });

  it('a amarração também segue a filial alvo do ADMIN (leitura e escrita)', async () => {
    prisma.supervisorDepartamento.findMany.mockResolvedValue([]);
    prisma.supervisor.groupBy.mockResolvedValue([]);
    await svc.listarSupervisoresDepartamento(comRole('ADMIN'), 'f2');
    expect(prisma.supervisorDepartamento.findMany.mock.calls[0][0].where).toEqual({ filialId: 'f2' });

    prisma.supervisorDepartamento.upsert.mockResolvedValue({ id: 'sd1' });
    await svc.definirSupervisorDepartamento('d9', 'u9', comRole('ADMIN'), 'f2');
    // o departamento é conferido contra a filial ALVO, não contra a do token
    expect(core.departamentoEhDaFilial).toHaveBeenCalledWith('d9', 'f2');
    expect(prisma.supervisorDepartamento.upsert.mock.calls[0][0].where).toEqual({ filialId_departamentoId: { filialId: 'f2', departamentoId: 'd9' } });
  });

  it('criar representante na filial alvo grava nela (não na do token)', async () => {
    prisma.supervisor.findFirst.mockResolvedValue(null);
    prisma.supervisor.create.mockResolvedValue({ id: 's1' });
    await svc.criarSupervisor({ matricula: 'E1', nome: 'X', departamentoId: 'd9' } as any, comRole('ADMIN'), 'f2');
    expect(prisma.supervisor.create.mock.calls[0][0].data.filialId).toBe('f2');
  });
});
