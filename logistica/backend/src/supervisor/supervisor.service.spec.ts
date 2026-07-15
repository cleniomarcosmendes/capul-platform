import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupervisorService } from './supervisor.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

/* eslint-disable @typescript-eslint/no-explicit-any */
const user = (filialId: string | null = 'f1') => ({ sub: 'u1', filialId, modulos: [{ codigo: 'LOGISTICA', role: 'ADMIN' }] }) as any;
const condutorMock = () => ({ validar: jest.fn() }) as any;
const coreMock = () => ({}) as any;
const storageMock = () => ({ put: jest.fn(), get: jest.fn(), remove: jest.fn() }) as any;

describe('SupervisorService.rdv (RDV por planejamento)', () => {
  let prisma: any;
  let svc: SupervisorService;

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock());
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
    const arg = prisma.viagem.findUnique.mock.calls[0][0];
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
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock());
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
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock());
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
    prisma.veiculo.findMany.mockResolvedValue([{ departamentoLotacaoId: 'd1' }, { departamentoLotacaoId: 'd2' }]);
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
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock());
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
    prisma.veiculo.findMany.mockResolvedValue([{ departamentoLotacaoId: 'd1' }]);
    prisma.supervisor.findMany.mockResolvedValue([]);
    await svc.listarSupervisores(comRole('SUPERVISOR_FROTA'));
    expect(prisma.supervisor.findMany.mock.calls[0][0].where.departamentoId).toEqual({ in: ['d1'] });
  });
  it('criarSupervisor Supervisor de Departamento: depto FORA do seu escopo → 403', async () => {
    prisma.veiculo.findMany.mockResolvedValue([{ departamentoLotacaoId: 'd1' }]);
    await expect(svc.criarSupervisor({ matricula: 'E1', nome: 'X', departamentoId: 'd9' } as any, comRole('SUPERVISOR_FROTA')))
      .rejects.toThrow(ForbiddenException);
    expect(prisma.supervisor.create).not.toHaveBeenCalled();
  });
  it('criarSupervisor Supervisor de Departamento: depto DELE → cria', async () => {
    prisma.veiculo.findMany.mockResolvedValue([{ departamentoLotacaoId: 'd1' }]);
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
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock());
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
    prisma.veiculo.findMany.mockResolvedValue([{ departamentoLotacaoId: 'd1' }]); // depto do rep ∈ seus deptos
    await svc.enviarPlanejamento('v1', comRole('SUPERVISOR_FROTA'));
    expect(prisma.viagem.update.mock.calls[0][0].data.statusPlanejamento).toBe('ENVIADO');
    expect(prisma.$queryRaw).not.toHaveBeenCalled(); // não precisa de matrícula: decide por departamento
  });

  it('enviar: Supervisor de Departamento em depto que NÃO é seu → 403', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planAlheio('RASCUNHO')); // depto 'd-outro'
    prisma.veiculo.findMany.mockResolvedValue([{ departamentoLotacaoId: 'd1' }]); // só cobre 'd1'
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
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock());
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
