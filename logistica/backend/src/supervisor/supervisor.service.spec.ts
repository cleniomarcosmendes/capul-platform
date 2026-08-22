import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupervisorService } from './supervisor.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

/* eslint-disable @typescript-eslint/no-explicit-any */
const user = (filialId: string | null = 'f1') => ({ sub: 'u1', filialId, modulos: [{ codigo: 'LOGISTICA', role: 'ADMIN' }] }) as any;
const condutorMock = () => ({ validar: jest.fn() }) as any;
// Lookups no schema `core` (read-only) usados ao enriquecer o planejamento com papel,
// departamento e aprovador. Vazios por padrão: cada teste que se importa com o rótulo
// sobrescreve o que precisa.
const coreMock = () => ({
  papeisLogisticaPorChapa: jest.fn().mockResolvedValue(new Map()),
  nomesDepartamentos: jest.fn().mockResolvedValue(new Map()),
  nomesUsuarios: jest.fn().mockResolvedValue(new Map()),
}) as any;
// `remove` DEVOLVE PROMISE no serviço real (o código faz `.catch()` no retorno) — o
// mock precisa refletir isso, senão o teste quebra por TypeError e não pelo motivo real.
const storageMock = () => ({ put: jest.fn(), get: jest.fn(), remove: jest.fn().mockResolvedValue(undefined) }) as any;
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
    await expect(svc.lancarAdiantamento({ supervisorId: 's1', mesReferencia: mesDeHoje(), valor: 100 } as any, comRole('COORDENADOR'))).rejects.toThrow(ForbiddenException);
  });

  // ⭐ Auto-serviço (mudança 15/07): o próprio SUPERVISOR de área lança/vê o adiantamento
  // do SEU cadastro (casado pela matrícula do login) — mas nunca o de outro representante.
  // ⭐ Auto-serviço de adiantamento ENCERRADO (01/08): saiu do app em 27/07 e agora do
  // desktop. Quem lança é quem APROVA aquele representante — ninguém lança o próprio.
  // A trava é por AUTORIDADE, não por papel: afrouxar o @Roles por engano não reabre.
  it('lancarAdiantamento SUPERVISOR no PRÓPRIO cadastro → 403 (auto-serviço encerrado)', async () => {
    prisma.supervisor.findUnique.mockResolvedValue({ id: 's1', filialId: 'f1', coordenadorId: 'algum-coord', matricula: 'E01047' });
    prisma.$queryRaw.mockResolvedValue([{ matricula: '1047', nome: 'Dono' }]); // é ele mesmo
    await expect(svc.lancarAdiantamento({ supervisorId: 's1', mesReferencia: mesDeHoje(), valor: 100 } as any, comRole('SUPERVISOR')))
      .rejects.toThrow(/lançado por quem aprova/);
    expect(prisma.adiantamento.create).not.toHaveBeenCalled();
  });
  it('lancarAdiantamento SUPERVISOR em cadastro de OUTRO (matrícula difere) → 403', async () => {
    prisma.supervisor.findUnique.mockResolvedValue({ id: 's1', filialId: 'f1', coordenadorId: 'outro-coord', matricula: 'E09999' });
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Outro' }]); // chapa ≠ E09999
    await expect(svc.lancarAdiantamento({ supervisorId: 's1', mesReferencia: mesDeHoje(), valor: 100 } as any, comRole('SUPERVISOR'))).rejects.toThrow(ForbiddenException);
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

  // O adiantamento sem data explícita usa HOJE, e o serviço exige data DENTRO do mês
  // do planejamento. Fixar 202607 fazia estes testes quebrarem sozinhos na virada do
  // mês (01/08 a suíte amanheceu vermelha sem ninguém ter mexido no código).
  const mesDeHoje = () => { const d = new Date(); return d.getFullYear() * 100 + d.getMonth() + 1; };

  // ⭐ Aprovação do adiantamento (15/07): auto-serviço do supervisor nasce PENDENTE; o
  // lançamento do coordenador/departamento já nasce APROVADO. Só o coordenador (ou depto)
  // decide — nunca o supervisionado.
  // O COORDENADOR não lança o PRÓPRIO adiantamento: o cadastro dele roteia para o
  // Supervisor de Departamento, que é quem lança. Mesma segregação da despesa.
  it('lancarAdiantamento COORDENADOR no cadastro DELE MESMO → 403', async () => {
    prisma.supervisor.findUnique.mockResolvedValue({ id: 's1', filialId: 'f1', coordenadorId: null, departamentoId: 'd1', matricula: 'E01047' });
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Coord' }]);
    await expect(svc.lancarAdiantamento({ supervisorId: 's1', mesReferencia: mesDeHoje(), valor: 100 } as any, comRole('COORDENADOR')))
      .rejects.toThrow(/lançado por quem aprova/);
    expect(prisma.adiantamento.create).not.toHaveBeenCalled();
  });
  // ⭐ 06/08 — a MESMA regra pela porta dos fundos. `editarViagem`
  // (PATCH /supervisor/viagens/:id) existia só para gravar `viagem.adiantamento`,
  // campo obsoleto desde o redesenho 6b mas ainda LIDO como fallback no acerto
  // (`advs.reduce` só substitui quando há adiantamento APROVADO no mês). Como
  // `assertEscopoSupervisor` tem ramo de auto-serviço (`ehProprioSupervisor`), o
  // COORDENADOR alcançava o PRÓPRIO planejamento e gravava o próprio
  // adiantamento — exatamente o que 01/08 encerrou. Padrão conhecido da onda:
  // `lançar` valida, `editar` herdou menos. O método foi REMOVIDO; corrigir
  // legado se faz lançando o Adiantamento aprovado, que substitui o campo.
  it('editarViagem não existe mais — não há caminho para gravar viagem.adiantamento', () => {
    expect((svc as unknown as Record<string, unknown>).editarViagem).toBeUndefined();
  });

  it('lancarAdiantamento COORDENADOR → já nasce APROVADO (com decididoPor)', async () => {
    prisma.supervisor.findUnique.mockResolvedValue({ id: 's1', filialId: 'f1', coordenadorId: 'u1' });
    prisma.adiantamento.create.mockResolvedValue({ id: 'a1' });
    await svc.lancarAdiantamento({ supervisorId: 's1', mesReferencia: mesDeHoje(), valor: 100 } as any, comRole('COORDENADOR'));
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

  // ⭐ Quem aprova NÃO fecha o ciclo sozinho. Enviando em nome do representante e
  // aprovando em seguida, o aval vira formalidade — foi o que apareceu no DEV: a
  // Supervisora de Departamento enviou e aprovou o planejamento do coordenador em
  // sequência. Montar o roteiro continua sendo dos dois; declarar que está pronto é
  // do dono.
  it('enviar: COORDENADOR do supervisor → 403 (o aval não pode nascer de quem aprova)', async () => {
    prisma.viagem.findUnique.mockResolvedValue({
      id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', statusPlanejamento: 'RASCUNHO', criadoPorId: 'outro',
      supervisorRegistro: { coordenadorId: 'u1', matricula: 'E09999', departamentoId: 'd-outro' },
    });
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Coord' }]);
    await expect(svc.enviarPlanejamento('v1', comRole('COORDENADOR'))).rejects.toThrow(ForbiddenException);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });

  it('enviar: ADMIN passa direto (oversight), sem lookup de matrícula', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planAlheio('RASCUNHO'));
    await svc.enviarPlanejamento('v1', comRole('ADMIN'));
    expect(prisma.viagem.update).toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  // Mesma regra um nível acima — é exatamente o caso reproduzido no DEV (viagem 27).
  it('enviar: Supervisor de Departamento no SEU depto → 403 (enviava e aprovava em seguida)', async () => {
    prisma.viagem.findUnique.mockResolvedValue({
      id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', statusPlanejamento: 'RASCUNHO', criadoPorId: 'outro',
      supervisorRegistro: { coordenadorId: 'outro-coord', matricula: 'E09999', departamentoId: 'd1' },
    });
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Sup.Depto' }]);
    await expect(svc.enviarPlanejamento('v1', comRole('SUPERVISOR_FROTA'))).rejects.toThrow(ForbiddenException);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });

  it('enviar: DONO cujo planejamento foi montado pelo gestor → envia (o handoff continua)', async () => {
    prisma.viagem.findUnique.mockResolvedValue({
      id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', statusPlanejamento: 'RASCUNHO', criadoPorId: 'gestor',
      supervisorRegistro: { coordenadorId: 'algum-coord', matricula: 'E09999', departamentoId: 'd1' },
    });
    prisma.$queryRaw.mockResolvedValue([{ matricula: '9999', nome: 'Dono' }]);
    await svc.enviarPlanejamento('v1', comRole('SUPERVISOR'));
    expect(prisma.viagem.update.mock.calls[0][0].data.statusPlanejamento).toBe('ENVIADO');
  });

  it('iniciar: COORDENADOR do supervisor → 403 (liberar a execução é do representante)', async () => {
    prisma.viagem.findUnique.mockResolvedValue({
      id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', statusPlanejamento: 'APROVADO', criadoPorId: 'outro',
      supervisorRegistro: { coordenadorId: 'u1', matricula: 'E09999', departamentoId: 'd-outro' },
    });
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Coord' }]);
    await expect(svc.iniciarExecucao('v1', comRole('COORDENADOR'))).rejects.toThrow(ForbiddenException);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });

  it('iniciar: o DONO → libera para execução', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planAlheio('APROVADO'));
    prisma.$queryRaw.mockResolvedValue([{ matricula: '9999', nome: 'Dono' }]); // chapa === E09999
    await svc.iniciarExecucao('v1', comRole('SUPERVISOR'));
    expect(prisma.viagem.update.mock.calls[0][0].data.statusPlanejamento).toBe('EM_EXECUCAO');
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

  // ⭐ EXECUTAR ≠ PLANEJAR. O coordenador monta e ajusta o roteiro do seu supervisor de
  // área (regra de negócio), mas quem diz que ESTEVE no cliente é o representante. Antes
  // os dois atos usavam o mesmo cadeado, e no app um coordenador executou o próprio RDV
  // e o do subordinado — mesmo aparelho, mesmo ponto de GPS, 2 minutos de diferença.
  it('apontarVisita: COORDENADOR do representante → 403 (executar é ato do dono)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planDoMeuTime());
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Coord' }]); // chapa ≠ E09999
    await expect(svc.apontarVisita('v1', 'p1', { status: 'REALIZADA' } as any, comRole('COORDENADOR'))).rejects.toThrow(ForbiddenException);
    expect(prisma.parada.update).not.toHaveBeenCalled();
  });

  it('apontarVisita: o DONO (matrícula bate) → aponta', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planDoMeuTime());
    prisma.$queryRaw.mockResolvedValue([{ matricula: '9999', nome: 'Dono' }]); // chapa('9999') === chapa('E09999')
    prisma.parada.findUnique.mockResolvedValue({ id: 'p1', viagemId: 'v1', localClienteId: null, latitude: null });
    prisma.parada.update.mockResolvedValue({ id: 'p1', status: 'REALIZADA', localClienteId: null });
    await svc.apontarVisita('v1', 'p1', { status: 'REALIZADA' } as any, comRole('SUPERVISOR'));
    expect(prisma.parada.update.mock.calls[0][0].data.status).toBe('REALIZADA');
  });

  it('apontarVisita: ADMIN → aponta (escape hatch de suporte)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planAlheio());
    prisma.parada.findUnique.mockResolvedValue({ id: 'p1', viagemId: 'v1', localClienteId: null, latitude: null });
    prisma.parada.update.mockResolvedValue({ id: 'p1', status: 'REALIZADA', localClienteId: null });
    await svc.apontarVisita('v1', 'p1', { status: 'REALIZADA' } as any, comRole('ADMIN'));
    expect(prisma.parada.update).toHaveBeenCalled();
  });

  it('concluirViagemSupervisor: COORDENADOR do representante → 403 (encerra quem executou)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planDoMeuTime());
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Coord' }]);
    await expect(svc.concluirViagemSupervisor('v1', comRole('COORDENADOR'))).rejects.toThrow(ForbiddenException);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });

  // A visita incluída DURANTE a execução nasce REALIZADA — é apontamento por outra
  // porta. Antes da execução (aprovação) o coordenador inclui à vontade.
  it('adicionarVisita EM_EXECUCAO: COORDENADOR do representante → 403', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planDoMeuTime()); // statusPlanejamento EM_EXECUCAO
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Coord' }]);
    await expect(svc.adicionarVisita('v1', { clienteNome: 'X' } as any, comRole('COORDENADOR'))).rejects.toThrow(ForbiddenException);
    expect(prisma.parada.create).not.toHaveBeenCalled();
  });

  it('adicionarVisita ENVIADO: COORDENADOR do representante → inclui (monta o roteiro na aprovação)', async () => {
    prisma.viagem.findUnique.mockResolvedValue({ ...planDoMeuTime(), statusPlanejamento: 'ENVIADO' });
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Coord' }]);
    prisma.parada.create.mockResolvedValue({ id: 'p9', status: 'PLANEJADA', localClienteId: null });
    await svc.adicionarVisita('v1', { clienteNome: 'X' } as any, comRole('COORDENADOR'));
    expect(prisma.parada.create.mock.calls[0][0].data.status).toBe('PLANEJADA');
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

  it('Supervisor de Departamento no SEU depto inclui visita no PLANEJAMENTO (decide por departamento, sem matrícula)', async () => {
    prisma.viagem.findUnique.mockResolvedValue({ ...planAlheio(), statusPlanejamento: 'ENVIADO', supervisorRegistro: { coordenadorId: 'outro-coord', matricula: 'E09999', departamentoId: 'd1' } });
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    prisma.parada.count.mockResolvedValue(0);
    prisma.parada.create.mockResolvedValue({ id: 'p9', status: 'PLANEJADA', localClienteId: null });
    await svc.adicionarVisita('v1', { clienteNome: 'X' } as any, comRole('SUPERVISOR_FROTA'));
    expect(prisma.parada.create).toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  // Mesma regra um nível acima: o Supervisor de Departamento aprova o RDV do
  // coordenador, mas também não executa por ele.
  it('Supervisor de Departamento: adicionarVisita EM_EXECUCAO no depto dele → 403', async () => {
    prisma.viagem.findUnique.mockResolvedValue({ ...planAlheio(), supervisorRegistro: { coordenadorId: 'outro-coord', matricula: 'E09999', departamentoId: 'd1' } });
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Sup.Depto' }]);
    await expect(svc.adicionarVisita('v1', { clienteNome: 'X' } as any, comRole('SUPERVISOR_FROTA'))).rejects.toThrow(ForbiddenException);
    expect(prisma.parada.create).not.toHaveBeenCalled();
  });

  it('Supervisor de Departamento: apontarVisita no depto dele → 403 (executar é do representante)', async () => {
    prisma.viagem.findUnique.mockResolvedValue({ ...planAlheio(), supervisorRegistro: { coordenadorId: 'outro-coord', matricula: 'E09999', departamentoId: 'd1' } });
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Sup.Depto' }]);
    await expect(svc.apontarVisita('v1', 'p1', { status: 'REALIZADA' } as any, comRole('SUPERVISOR_FROTA'))).rejects.toThrow(ForbiddenException);
    expect(prisma.parada.update).not.toHaveBeenCalled();
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

  // ⭐ 01/08: a despesa entra na conta do REPRESENTANTE — é ele quem "paga". Então a
  // autoridade lançando no RDV de OUTRO nasce PENDENTE e quem CONFERE é o dono. Antes
  // nascia APROVADA: o coordenador lançava e aprovava, e o representante era debitado
  // sem nunca ter visto. O caso é raro (o rep manda o comprovante e o coordenador
  // digita), mas é dinheiro dele. "Nasce aprovada" fica só para o RDV PRÓPRIO da
  // autoridade — o topo da pirâmide, que não tem a quem pedir aval (regra de 27/07).
  it('Supervisor de Departamento no RDV de um REPRESENTANTE → PENDENTE (o dono confere)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan({ coordenadorId: 'outro-coord', matricula: 'E09999', departamentoId: 'd1' }));
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    await svc.lancarDespesa('v1', dto, comRole('SUPERVISOR_FROTA'));
    const data = prisma.despesaVeiculo.create.mock.calls[0][0].data;
    expect(data.situacao).toBe('PENDENTE');
    expect(data.aprovadoPorId).toBeNull();
  });

  it('Supervisor de Departamento no RDV DELE MESMO → APROVADA (topo da pirâmide)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan({ coordenadorId: null, matricula: 'E01047', departamentoId: 'd1' }));
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Sup.Depto' }]); // é o dono
    await svc.lancarDespesa('v1', dto, comRole('SUPERVISOR_FROTA'));
    const data = prisma.despesaVeiculo.create.mock.calls[0][0].data;
    expect(data.situacao).toBe('APROVADA');
    expect(data.aprovadoPorId).toBe('u1');
  });

  it('COORDENADOR no RDV do SEU representante → PENDENTE (quem confere é o representante)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan({ coordenadorId: 'u1', matricula: 'E09999', departamentoId: 'd-outro' }));
    await svc.lancarDespesa('v1', dto, comRole('COORDENADOR'));
    expect(prisma.despesaVeiculo.create.mock.calls[0][0].data.situacao).toBe('PENDENTE');
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

  // ⭐ escopo=meus é o que o APP manda: em campo cada um executa o SEU RDV. Sem isto o
  // coordenador via o planejamento do subordinado na lista de execução e o realizava.
  it('listar escopo=meus (COORDENADOR): SÓ o próprio cadastro — nada do time', async () => {
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Coord' }]);
    prisma.supervisor.findMany.mockResolvedValue([{ id: 's-meu', matricula: '1047' }, { id: 's-outro', matricula: 'E09999' }]);
    await svc.listarViagensSupervisor(comRole('COORDENADOR'), undefined, undefined, 'meus');
    const where = prisma.viagem.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { supervisorRegistroId: null, criadoPorId: 'u1' },
      { supervisorRegistroId: { in: ['s-meu'] } },
    ]);
    expect(JSON.stringify(where)).not.toContain('coordenadorId');
  });

  it('listar escopo=meus (ADMIN): também se restringe ao próprio — o app é execução', async () => {
    prisma.$queryRaw.mockResolvedValue([]); // ADMIN sem matrícula
    await svc.listarViagensSupervisor(comRole('ADMIN'), undefined, undefined, 'meus');
    const where = prisma.viagem.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ supervisorRegistroId: null, criadoPorId: 'u1' }]);
  });

  // ⭐ A lista dizia só o nome sob o rótulo fixo "Supervisor" — o coordenador, que
  // também tem RDV próprio, aparecia como supervisor. O papel vem da role no módulo
  // (Configurador) e o aprovador segue a MESMA rota do `enviar`: quem tem coordenador
  // roteia para ele; quem não tem roteia para o responsável do departamento.
  it('listar: anexa papel do representante e o coordenador como aprovador', async () => {
    const core = coreMock();
    core.papeisLogisticaPorChapa.mockResolvedValue(new Map([['E05274', 'SUPERVISOR']]));
    core.nomesDepartamentos.mockResolvedValue(new Map([['d1', 'Vendas Internas e Externas']]));
    core.nomesUsuarios.mockResolvedValue(new Map([['u-coord', 'Fabricio Silva Neiva']]));
    svc = new SupervisorService(prisma, condutorMock(), core, storageMock(), locaisMock());
    prisma.viagem.findMany.mockResolvedValue([{
      id: 'v1', numero: 25,
      supervisorRegistro: { id: 's1', nome: 'Kelver', matricula: '005274', departamentoId: 'd1', coordenadorId: 'u-coord' },
    }]);
    const [v] = await svc.listarViagensSupervisor(comRole('ADMIN')) as any[];
    expect(v.papelRepresentante).toBe('SUPERVISOR');
    expect(v.departamentoNome).toBe('Vendas Internas e Externas');
    expect(v.aprovadorNome).toBe('Fabricio Silva Neiva');
  });

  it('listar: SEM coordenador, o aprovador é o responsável do DEPARTAMENTO (caso do coordenador)', async () => {
    const core = coreMock();
    core.papeisLogisticaPorChapa.mockResolvedValue(new Map([['E03448', 'COORDENADOR']]));
    core.nomesUsuarios.mockResolvedValue(new Map([['u-lidyane', 'Lidyane Aparecida Costa Rocha']]));
    svc = new SupervisorService(prisma, condutorMock(), core, storageMock(), locaisMock());
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1', usuarioId: 'u-lidyane' }]);
    prisma.viagem.findMany.mockResolvedValue([{
      id: 'v1', numero: 26,
      supervisorRegistro: { id: 's2', nome: 'Fabricio', matricula: '003448', departamentoId: 'd1', coordenadorId: null },
    }]);
    const [v] = await svc.listarViagensSupervisor(comRole('ADMIN')) as any[];
    expect(v.papelRepresentante).toBe('COORDENADOR');
    expect(v.aprovadorNome).toBe('Lidyane Aparecida Costa Rocha');
  });

  it('listar: sem coordenador NEM responsável de departamento → aprovador nulo (planejamento órfão)', async () => {
    prisma.viagem.findMany.mockResolvedValue([{
      id: 'v1', numero: 32,
      supervisorRegistro: { id: 's3', nome: 'Seed', matricula: 'SEED9001', departamentoId: null, coordenadorId: null },
    }]);
    const [v] = await svc.listarViagensSupervisor(comRole('ADMIN')) as any[];
    expect(v.aprovadorNome).toBeNull();
    expect(v.papelRepresentante).toBeNull();
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

// ⭐ 28/07: o seletor de filial da aba Equipe abria na filial principal do ADMIN (a
// matriz administrativa), que não tem representante — tela vazia, com cara de que
// sumiu tudo. O padrão passa a ser a filial que TEM RDV montado, resolvido por dado
// (não por UUID fixo no código: se outra filial começar a usar, continua certo).
describe('SupervisorService.filiaisComRdv', () => {
  let prisma: any;
  let svc: SupervisorService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
  });
  const comRole = (role: string) => ({ sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role }] }) as any;

  // ⚠️ O peso é o representante COM DEPARTAMENTO — é ele que vira linha na tela. Contar
  // representante sem departamento levava o padrão para a matriz (11 de seed, nenhum com
  // departamento), que abriria vazia do mesmo jeito. Não regredir para `where: {ativo}`.
  it('ADMIN: ordena por representante COM departamento; sem depto só entra na lista (peso 0)', async () => {
    prisma.supervisor.groupBy
      .mockResolvedValueOnce([{ filialId: 'fB', _count: { _all: 2 } }])                       // com departamento
      .mockResolvedValueOnce([{ filialId: 'fA', _count: { _all: 11 } }, { filialId: 'fB', _count: { _all: 2 } }]); // quaisquer
    prisma.supervisorDepartamento.groupBy.mockResolvedValue([{ filialId: 'fC', _count: { _all: 1 } }]);
    const r = await svc.filiaisComRdv(comRole('ADMIN'));
    expect(r[0]).toEqual({ filialId: 'fB', representantes: 2 }); // ganha de fA apesar de fA ter 11 sem depto
    expect(r.map((x) => x.filialId).sort()).toEqual(['fA', 'fB', 'fC']);
    expect(prisma.supervisor.groupBy.mock.calls[0][0].where).toEqual({ ativo: true, departamentoId: { not: null } });
  });

  it('não-ADMIN: devolve só a própria filial (não enumera as outras)', async () => {
    const r = await svc.filiaisComRdv(comRole('SUPERVISOR_FROTA'));
    expect(r).toEqual([{ filialId: 'f1', representantes: 0 }]);
    expect(prisma.supervisor.groupBy).not.toHaveBeenCalled();
  });
});

// ⭐ Sugestão de veículo no planejamento (01/08). A despesa do RDV já lia
// `viagem.veiculoId`, mas NINGUÉM preenchia esse campo — 10 de 10 planejamentos com
// nulo — então todo combustível do RDV nascia sem veículo e sumia do custo da frota.
// Agora o planejamento nasce com o carro que o cadastro aponta para o representante.
describe('SupervisorService — veículo do planejamento', () => {
  let prisma: any;
  let svc: SupervisorService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
    prisma.supervisor.findFirst.mockResolvedValue({ id: 's1', matricula: '005274', nome: 'Kelver', coordenadorId: 'u-coord', departamentoId: 'd1' });
    prisma.contadorSequencial.upsert.mockResolvedValue({ ultimoNumero: 40 });
    prisma.viagem.create.mockResolvedValue({ id: 'v-novo' });
  });
  const gestor = () => ({ sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'SUPERVISOR_FROTA' }] }) as any;
  const dto = (extra: any = {}) => ({ mesReferencia: 202608, supervisorRegistroId: 's1', ...extra });

  it('sem veiculoId no payload → sugere o veículo cujo responsável é o representante', async () => {
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    prisma.veiculo.findMany.mockResolvedValue([
      { id: 've-kelver', supervisorAreaMatricula: 'E05274' },
      { id: 've-outro', supervisorAreaMatricula: 'E09999' },
    ]);
    await svc.criarViagemSupervisor(dto() as any, gestor());
    expect(prisma.viagem.create.mock.calls[0][0].data.veiculoId).toBe('ve-kelver');
  });

  it('string VAZIA = escolha do operador ("carro próprio") → NÃO sobrepõe com a sugestão', async () => {
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    prisma.veiculo.findMany.mockResolvedValue([{ id: 've-kelver', supervisorAreaMatricula: 'E05274' }]);
    await svc.criarViagemSupervisor(dto({ veiculoId: '' }) as any, gestor());
    expect(prisma.viagem.create.mock.calls[0][0].data.veiculoId).toBeNull();
    expect(prisma.veiculo.findMany).not.toHaveBeenCalled(); // nem consulta a sugestão
  });

  it('DOIS veículos do mesmo representante → não sugere nenhum (não chuta o custo)', async () => {
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    prisma.veiculo.findMany.mockResolvedValue([
      { id: 've-a', supervisorAreaMatricula: '005274' },
      { id: 've-b', supervisorAreaMatricula: 'E05274' },
    ]);
    await svc.criarViagemSupervisor(dto() as any, gestor());
    expect(prisma.viagem.create.mock.calls[0][0].data.veiculoId).toBeNull();
  });

  it('trocar o veículo NÃO reponta as despesas já lançadas', async () => {
    prisma.viagem.findUnique.mockResolvedValue({
      id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', statusPlanejamento: 'EM_EXECUCAO', situacao: 'EM_CURSO',
      criadoPorId: 'u1', supervisorRegistro: { coordenadorId: 'u1', matricula: 'E09999', departamentoId: 'd1' },
    });
    prisma.veiculo.findFirst.mockResolvedValue({ id: 've-novo' });
    prisma.viagem.update.mockResolvedValue({ id: 'v1' });
    await svc.definirVeiculoPlanejamento('v1', 've-novo', { sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'COORDENADOR' }] } as any);
    expect(prisma.viagem.update.mock.calls[0][0].data.veiculoId).toBe('ve-novo');
    expect(prisma.despesaVeiculo.updateMany).not.toHaveBeenCalled();
  });
});

// ⭐ Despesa de VEÍCULO passou a exigir o carro (01/08). Antes caía em nulo quando o
// planejamento não tinha veículo — que era SEMPRE, porque nenhuma tela preenchia o
// campo — e o valor sumia de Custos da Frota sem aviso nenhum. Falhar é melhor do que
// perder o custo em silêncio.
describe('SupervisorService — veículo da despesa', () => {
  let prisma: any;
  let svc: SupervisorService;
  const dono = () => ({ sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'SUPERVISOR' }] }) as any;
  const planCom = (veiculoId: string | null) => ({
    id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', situacao: 'EM_CURSO', statusPlanejamento: 'EM_EXECUCAO',
    criadoPorId: 'u1', mesReferencia: 202608, supervisorRegistroId: 's1', veiculoId,
    supervisorRegistro: { coordenadorId: 'u-coord', matricula: 'E01047', departamentoId: 'd1' },
  });
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Dono' }]);
    prisma.despesaVeiculo.create.mockResolvedValue({ id: 'd1' });
    prisma.veiculo.findFirst.mockResolvedValue({ id: 've-plan' });
  });
  const combustivel = { id: 't1', nome: 'Combustível', categoria: 'VEICULO', ativo: true };
  const alimentacao = { id: 't2', nome: 'Alimentação', categoria: 'INDIVIDUO', ativo: true };

  it('categoria VEÍCULO herda o carro do planejamento', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planCom('ve-plan'));
    prisma.tipoDespesa.findFirst.mockResolvedValue(combustivel);
    await svc.lancarDespesa('v1', { tipoDespesaId: 't1', valor: 80, data: '2026-08-05' } as any, dono());
    expect(prisma.despesaVeiculo.create.mock.calls[0][0].data.veiculoId).toBe('ve-plan');
  });

  it('veiculoId na despesa sobrepõe o do planejamento (pegou outro carro)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planCom('ve-plan'));
    prisma.tipoDespesa.findFirst.mockResolvedValue(combustivel);
    prisma.veiculo.findFirst.mockResolvedValue({ id: 've-outro' });
    await svc.lancarDespesa('v1', { tipoDespesaId: 't1', valor: 80, data: '2026-08-05', veiculoId: 've-outro' } as any, dono());
    expect(prisma.despesaVeiculo.create.mock.calls[0][0].data.veiculoId).toBe('ve-outro');
  });

  it('VEÍCULO sem carro no planejamento nem na despesa → 400 (não grava sem veículo)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planCom(null));
    prisma.tipoDespesa.findFirst.mockResolvedValue(combustivel);
    await expect(svc.lancarDespesa('v1', { tipoDespesaId: 't1', valor: 80, data: '2026-08-05' } as any, dono()))
      .rejects.toThrow(/não entra no custo da frota/);
    expect(prisma.despesaVeiculo.create).not.toHaveBeenCalled();
  });

  it('categoria INDIVÍDUO segue sem veículo, mesmo com o planejamento tendo carro', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planCom('ve-plan'));
    prisma.tipoDespesa.findFirst.mockResolvedValue(alimentacao);
    await svc.lancarDespesa('v1', { tipoDespesaId: 't2', valor: 30, data: '2026-08-05' } as any, dono());
    expect(prisma.despesaVeiculo.create.mock.calls[0][0].data.veiculoId).toBeNull();
  });

  it('veículo de OUTRA filial → 400', async () => {
    prisma.viagem.findUnique.mockResolvedValue(planCom('ve-plan'));
    prisma.tipoDespesa.findFirst.mockResolvedValue(combustivel);
    prisma.veiculo.findFirst.mockResolvedValue(null); // não existe nesta filial
    await expect(svc.lancarDespesa('v1', { tipoDespesaId: 't1', valor: 80, data: '2026-08-05', veiculoId: 've-alheio' } as any, dono()))
      .rejects.toThrow(/não encontrado nesta filial/);
  });
});

// ⭐ A APROVAÇÃO PRECISA GRUDAR NO VALOR (01/08). Reproduzido no DEV com as personas
// reais: despesa aprovada em R$ 5.000 virou R$ 9.999 e seguiu APROVADA; despesa
// CONTESTADA foi apagada pelo próprio representante e relançada limpa; e o
// supervisionado apagou o adiantamento APROVADO dele (adiantamento é dívida — apagar
// aumenta o que a empresa lhe deve). O padrão: `lancar` validava direito, mas `editar`
// e `remover` herdaram só o escopo — o que pode ser tocado DEPOIS de decidido nunca
// tinha sido delimitado.
describe('SupervisorService — a decisão vale para o valor decidido', () => {
  let prisma: any;
  let svc: SupervisorService;
  const rep = () => ({ sub: 'u-rep', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'SUPERVISOR' }] }) as any;
  const coord = () => ({ sub: 'u-coord', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'COORDENADOR' }] }) as any;
  const plan = () => ({
    id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', situacao: 'EM_CURSO', statusPlanejamento: 'EM_EXECUCAO',
    criadoPorId: 'u-rep', mesReferencia: 202608, supervisorRegistroId: 's1', veiculoId: 've1',
    supervisorRegistro: { coordenadorId: 'u-coord', matricula: 'E01047', departamentoId: 'd1' },
  });
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
    prisma.viagem.findUnique.mockResolvedValue(plan());
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Rep' }]); // o logado É o dono
    prisma.despesaVeiculo.update.mockResolvedValue({ id: 'd1' });
    prisma.tipoDespesa.findUnique.mockResolvedValue({ id: 't1', nome: 'Alimentação', categoria: 'INDIVIDUO' });
  });

  it('representante edita o VALOR de despesa APROVADA → volta para PENDENTE', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({ id: 'd1', viagemId: 'v1', situacao: 'APROVADA', criadoPorId: 'u-rep', tipoDespesaId: 't1', veiculoId: null });
    await svc.editarDespesa('v1', 'd1', { valor: 9999 } as any, rep());
    const d0 = prisma.despesaVeiculo.update.mock.calls[0][0].data;
    expect(d0.situacao).toBe('PENDENTE');
    expect(d0.motivoContestacao).toBeNull();
    // `aprovadoPorId` é PRESERVADO de propósito (01/08): é o marcador de "já passou por
    // análise" que `removerDespesa` consulta. Zerá-lo devolvia a linha ao estado "nunca
    // decidida" e reabria a exclusão — contestada → edita → PENDENTE → apaga → relança.
    expect(d0.aprovadoPorId).toBeUndefined();
    expect(Object.keys(d0)).not.toContain('decididoPorId');
  });

  it('editar só a OBSERVAÇÃO não reabre a aprovação (não mexe no dinheiro)', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({ id: 'd1', viagemId: 'v1', situacao: 'APROVADA', criadoPorId: 'u-rep', tipoDespesaId: 't1', veiculoId: null });
    await svc.editarDespesa('v1', 'd1', { observacao: 'nota fiscal 123' } as any, rep());
    expect(prisma.despesaVeiculo.update.mock.calls[0][0].data.situacao).toBeUndefined();
  });

  // ⚠️ INVERTIDO EM 22/08. Este caso afirmava que "a AUTORIDADE editando mantém aprovada
  // e recarimba a decisão". A 3ª execução do roteiro mostrou o que isso permitia: o
  // coordenador aprova a despesa do representante e depois, sozinho, muda o valor —
  // aprovado, sem reconferência, sem o dono ver. Vale a regra simétrica do CLAUDE.md:
  // quem não lançou não altera o valor; se está errado, CONTESTA.
  it('a AUTORIDADE não altera o valor da despesa alheia — nem para "corrigir"', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({ id: 'd1', viagemId: 'v1', situacao: 'APROVADA', criadoPorId: 'u-rep', tipoDespesaId: 't1', veiculoId: null });
    await expect(svc.editarDespesa('v1', 'd1', { valor: 120 } as any, coord()))
      .rejects.toThrow(/lançada por outra pessoa/);
    expect(prisma.despesaVeiculo.update).not.toHaveBeenCalled();
  });

  it('a AUTORIDADE editando o que ELA MESMA lançou devolve para PENDENTE (o dono reconfere)', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({ id: 'd1', viagemId: 'v1', situacao: 'APROVADA', criadoPorId: 'u-coord', tipoDespesaId: 't1', veiculoId: null });
    await svc.editarDespesa('v1', 'd1', { valor: 120 } as any, coord());
    const data = prisma.despesaVeiculo.update.mock.calls[0][0].data;
    expect(data.situacao).toBe('PENDENTE');
    expect(Object.keys(data)).not.toContain('decididoPorId'); // campo da despesa é aprovadoPorId
  });

  it('representante NÃO apaga despesa CONTESTADA (era o caminho "some e volta limpa")', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({ id: 'd1', viagemId: 'v1', situacao: 'CONTESTADA', anexos: [] });
    await expect(svc.removerDespesa('v1', 'd1', rep())).rejects.toThrow(ForbiddenException);
    expect(prisma.despesaVeiculo.delete).not.toHaveBeenCalled();
  });

  it('representante apaga a própria despesa PENDENTE (ninguém analisou ainda)', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({ id: 'd1', viagemId: 'v1', situacao: 'PENDENTE', anexos: [] });
    await svc.removerDespesa('v1', 'd1', rep());
    expect(prisma.despesaVeiculo.delete).toHaveBeenCalled();
  });

  it('a autoridade apaga despesa já decidida', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({ id: 'd1', viagemId: 'v1', situacao: 'APROVADA', anexos: [] });
    await svc.removerDespesa('v1', 'd1', coord());
    expect(prisma.despesaVeiculo.delete).toHaveBeenCalled();
  });

  it('mês FECHADO trava a edição da despesa (o lançar já travava; editar não)', async () => {
    prisma.fechamentoRdv.findUnique.mockResolvedValue({ supervisorId: 's1', mesReferencia: 202608 });
    prisma.despesaVeiculo.findUnique.mockResolvedValue({ id: 'd1', viagemId: 'v1', situacao: 'PENDENTE', criadoPorId: 'u-rep', tipoDespesaId: 't1', veiculoId: null });
    await expect(svc.editarDespesa('v1', 'd1', { valor: 10 } as any, rep())).rejects.toThrow(/RDV do mês encerrado/);
  });

  it('supervisionado NÃO apaga o adiantamento APROVADO dele (é dívida)', async () => {
    prisma.adiantamento.findUnique.mockResolvedValue({
      id: 'a1', supervisorId: 's1', mesReferencia: 202608, situacao: 'APROVADO',
      supervisor: { filialId: 'f1', coordenadorId: 'u-coord', departamentoId: 'd1', matricula: 'E01047' },
    });
    await expect(svc.removerAdiantamento('a1', rep())).rejects.toThrow(ForbiddenException);
    expect(prisma.adiantamento.delete).not.toHaveBeenCalled();
  });

  it('supervisionado apaga o próprio adiantamento PENDENTE (auto-serviço, sem decisão)', async () => {
    prisma.adiantamento.findUnique.mockResolvedValue({
      id: 'a1', supervisorId: 's1', mesReferencia: 202608, situacao: 'PENDENTE',
      supervisor: { filialId: 'f1', coordenadorId: 'u-coord', departamentoId: 'd1', matricula: 'E01047' },
    });
    await svc.removerAdiantamento('a1', rep());
    expect(prisma.adiantamento.delete).toHaveBeenCalled();
  });

  it('mês FECHADO trava a remoção do adiantamento', async () => {
    prisma.fechamentoRdv.findUnique.mockResolvedValue({ supervisorId: 's1', mesReferencia: 202608 });
    prisma.adiantamento.findUnique.mockResolvedValue({
      id: 'a1', supervisorId: 's1', mesReferencia: 202608, situacao: 'PENDENTE',
      supervisor: { filialId: 'f1', coordenadorId: 'u-coord', departamentoId: 'd1', matricula: 'E01047' },
    });
    await expect(svc.removerAdiantamento('a1', rep())).rejects.toThrow(/RDV do mês encerrado/);
  });
});

// ⭐ QUEM DECIDE É QUEM NÃO LANÇOU (01/08). A despesa entra na conta do REPRESENTANTE,
// então quando a autoridade lança no RDV dele quem confere é ele — não a autoridade
// que digitou. Aprovar o próprio lançamento é que fica barrado; CONTESTAR o próprio
// segue livre (é ato contra o lançamento, e é como se desfaz um "lancei errado" sem
// apagar o rastro — decisão de 27/07).
describe('SupervisorService.decidirDespesa — quem confere é a outra ponta', () => {
  let prisma: any;
  let svc: SupervisorService;
  const comRole = (role: string, sub = 'u1') => ({ sub, filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role }] }) as any;
  const despesa = (criadoPorId: string) => ({
    id: 'd1', viagemId: 'v1', filialId: 'f1', criadoPorId,
    viagem: { tipo: 'SUPERVISOR', filialId: 'f1', criadoPorId: 'u-rep', supervisorRegistro: { coordenadorId: 'u-coord', departamentoId: 'd1', matricula: 'E01047' } },
  });
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
    prisma.despesaVeiculo.update.mockResolvedValue({ id: 'd1' });
  });

  it('coordenador lançou no RDV do representante → o REPRESENTANTE confere', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesa('u-coord'));
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Rep' }]); // o logado é o dono
    await svc.decidirDespesa('v1', 'd1', 'APROVADA', undefined, comRole('SUPERVISOR', 'u-rep'));
    expect(prisma.despesaVeiculo.update.mock.calls[0][0].data.situacao).toBe('APROVADA');
  });

  it('coordenador NÃO aprova a despesa que ele mesmo lançou', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesa('u-coord'));
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E09999', nome: 'Coord' }]); // não é o dono
    await expect(svc.decidirDespesa('v1', 'd1', 'APROVADA', undefined, comRole('COORDENADOR', 'u-coord')))
      .rejects.toThrow(/não aprova o próprio lançamento/);
    expect(prisma.despesaVeiculo.update).not.toHaveBeenCalled();
  });

  it('mas PODE contestar o próprio lançamento ("lancei errado")', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesa('u-coord'));
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E09999', nome: 'Coord' }]);
    await svc.decidirDespesa('v1', 'd1', 'CONTESTADA', 'lancei errado', comRole('COORDENADOR', 'u-coord'));
    expect(prisma.despesaVeiculo.update.mock.calls[0][0].data.situacao).toBe('CONTESTADA');
  });

  it('caminho NORMAL preservado: representante lançou → a autoridade aprova', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesa('u-rep'));
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E09999', nome: 'Coord' }]); // não é o dono
    await svc.decidirDespesa('v1', 'd1', 'APROVADA', undefined, comRole('COORDENADOR', 'u-coord'));
    expect(prisma.despesaVeiculo.update.mock.calls[0][0].data.situacao).toBe('APROVADA');
  });

  it('representante NÃO aprova a despesa que ele mesmo lançou (segregação de 14/07 intacta)', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesa('u-rep'));
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Rep' }]);
    await expect(svc.decidirDespesa('v1', 'd1', 'APROVADA', undefined, comRole('SUPERVISOR', 'u-rep')))
      .rejects.toThrow(/não aprova o próprio lançamento/);
  });

  it('um COLEGA (nem dono, nem autoridade) não decide', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue(despesa('u-rep'));
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E09999', nome: 'Colega' }]);
    await expect(svc.decidirDespesa('v1', 'd1', 'APROVADA', undefined, comRole('SUPERVISOR', 'u-colega')))
      .rejects.toThrow(ForbiddenException);
  });
});

// ⭐⭐ FURO ACHADO PELO /security-review (01/08) e reproduzido no DEV: R$ 50 lançados
// pelo coordenador viravam R$ 5.000 e o PRÓPRIO representante aprovava.
//
// `decidirDespesa` ancora a trava de auto-aprovação em `criadoPorId`, mas `editarDespesa`
// autorizava pelo DONO e não mexia nesse campo — as duas guardas não compunham. O dono
// reescrevia o valor de uma linha lançada por outro (sem sair de PENDENTE, então sem
// reabrir a decisão) e em seguida "conferia" como se não fosse dele.
describe('SupervisorService — quem não lançou não mexe no valor', () => {
  let prisma: any;
  let svc: SupervisorService;
  const rep = () => ({ sub: 'u-rep', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'SUPERVISOR' }] }) as any;
  const coord = () => ({ sub: 'u-coord', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'COORDENADOR' }] }) as any;
  const plan = () => ({
    id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', situacao: 'EM_CURSO', statusPlanejamento: 'EM_EXECUCAO',
    criadoPorId: 'u-rep', mesReferencia: 202608, supervisorRegistroId: 's1', veiculoId: 've1',
    supervisorRegistro: { coordenadorId: 'u-coord', matricula: 'E01047', departamentoId: 'd1' },
  });
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
    prisma.viagem.findUnique.mockResolvedValue(plan());
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Rep' }]); // o logado é o dono
    prisma.despesaVeiculo.update.mockResolvedValue({ id: 'd1' });
    prisma.tipoDespesa.findUnique.mockResolvedValue({ id: 't1', nome: 'Alimentação', categoria: 'INDIVIDUO' });
  });

  it('o DONO não altera o valor de despesa lançada por OUTRO (era a escada para a auto-aprovação)', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({ id: 'd1', viagemId: 'v1', situacao: 'PENDENTE', criadoPorId: 'u-coord', tipoDespesaId: 't1', veiculoId: null });
    await expect(svc.editarDespesa('v1', 'd1', { valor: 5000 } as any, rep()))
      .rejects.toThrow(/lançada por outra pessoa/);
    expect(prisma.despesaVeiculo.update).not.toHaveBeenCalled();
  });

  it('…mas altera campo que não é dinheiro (observação) na despesa lançada por outro', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({ id: 'd1', viagemId: 'v1', situacao: 'PENDENTE', criadoPorId: 'u-coord', tipoDespesaId: 't1', veiculoId: null });
    await svc.editarDespesa('v1', 'd1', { observacao: 'recibo 12' } as any, rep());
    expect(prisma.despesaVeiculo.update).toHaveBeenCalled();
  });

  it('o DONO altera normalmente o valor da despesa que ELE lançou', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({ id: 'd1', viagemId: 'v1', situacao: 'PENDENTE', criadoPorId: 'u-rep', tipoDespesaId: 't1', veiculoId: null });
    await svc.editarDespesa('v1', 'd1', { valor: 80 } as any, rep());
    expect(prisma.despesaVeiculo.update).toHaveBeenCalled();
  });

  // ⚠️ INVERTIDO EM 22/08 — ver a nota no caso da autoridade acima. Nem PENDENTE ela
  // reescreve: o número é de quem lançou, e o caminho da autoridade é contestar.
  it('a AUTORIDADE não reescreve o valor lançado pelo representante (contesta)', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({ id: 'd1', viagemId: 'v1', situacao: 'PENDENTE', criadoPorId: 'u-rep', tipoDespesaId: 't1', veiculoId: null });
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E09999', nome: 'Coord' }]); // não é o dono
    await expect(svc.editarDespesa('v1', 'd1', { valor: 80 } as any, coord()))
      .rejects.toThrow(/conteste: quem lançou corrige|lançada por outra pessoa/);
    expect(prisma.despesaVeiculo.update).not.toHaveBeenCalled();
  });

  // MÉDIO do mesmo review: a volta para PENDENTE não pode reabrir a exclusão.
  it('editar despesa decidida PRESERVA o marcador de decisão (aprovadoPorId)', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({ id: 'd1', viagemId: 'v1', situacao: 'CONTESTADA', criadoPorId: 'u-rep', tipoDespesaId: 't1', veiculoId: null });
    await svc.editarDespesa('v1', 'd1', { valor: 80 } as any, rep());
    const data = prisma.despesaVeiculo.update.mock.calls[0][0].data;
    expect(data.situacao).toBe('PENDENTE');
    expect(Object.keys(data)).not.toContain('aprovadoPorId'); // NÃO é zerado
  });

  it('despesa que já passou por análise não é apagada pelo representante, mesmo de volta em PENDENTE', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({ id: 'd1', viagemId: 'v1', situacao: 'PENDENTE', aprovadoPorId: 'u-coord', criadoPorId: 'u-rep', anexos: [] });
    await expect(svc.removerDespesa('v1', 'd1', rep())).rejects.toThrow(/já passou por análise/);
    expect(prisma.despesaVeiculo.delete).not.toHaveBeenCalled();
  });

  it('despesa nunca decidida segue removível pelo representante', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({ id: 'd1', viagemId: 'v1', situacao: 'PENDENTE', aprovadoPorId: null, criadoPorId: 'u-rep', anexos: [] });
    await svc.removerDespesa('v1', 'd1', rep());
    expect(prisma.despesaVeiculo.delete).toHaveBeenCalled();
  });
});

// ⭐ Achados da VARREDURA de consistência (01/08), eixo "invariantes por entidade".
// O padrão que se repetiu a semana toda: `lancar` validava direito e as operações
// vizinhas herdaram menos. Sobraram tres casos — dois com peso financeiro.
describe('SupervisorService — varredura: mês fechado e evidência', () => {
  let prisma: any;
  let svc: SupervisorService;
  const rep = () => ({ sub: 'u-rep', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'SUPERVISOR' }] }) as any;
  const coord = () => ({ sub: 'u-coord', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'COORDENADOR' }] }) as any;
  const plan = () => ({
    id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', situacao: 'EM_CURSO', statusPlanejamento: 'EM_EXECUCAO',
    criadoPorId: 'u-rep', mesReferencia: 202609, supervisorRegistroId: 's1', veiculoId: 've1',
    supervisorRegistro: { coordenadorId: 'u-coord', matricula: 'E01047', departamentoId: 'd1' },
  });
  const mesFechado = () => prisma.fechamentoRdv.findUnique.mockResolvedValue({ supervisorId: 's1', mesReferencia: 202609 });
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
    prisma.viagem.findUnique.mockResolvedValue(plan());
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Rep' }]); // logado = dono
  });

  // B1 — decidir mexe no SALDO; mês fechado não se decide (decidirAdiantamento já travava).
  it('decidirDespesa com o mês FECHADO → barrado', async () => {
    mesFechado();
    prisma.despesaVeiculo.findUnique.mockResolvedValue({
      id: 'd1', viagemId: 'v1', filialId: 'f1', criadoPorId: 'u-rep',
      viagem: { tipo: 'SUPERVISOR', filialId: 'f1', criadoPorId: 'u-rep', supervisorRegistroId: 's1', mesReferencia: 202609, supervisorRegistro: { coordenadorId: 'u-coord', departamentoId: 'd1', matricula: 'E01047' } },
    });
    await expect(svc.decidirDespesa('v1', 'd1', 'CONTESTADA', 'x', coord())).rejects.toThrow(/RDV do mês encerrado/);
    expect(prisma.despesaVeiculo.update).not.toHaveBeenCalled();
  });

  // B2 — o comprovante é a EVIDÊNCIA do valor aprovado.
  it('representante NÃO apaga o comprovante de despesa já decidida', async () => {
    prisma.anexoDespesa.findUnique.mockResolvedValue({
      id: 'a1', despesaId: 'd1', objectKey: 'k',
      despesa: { viagemId: 'v1', situacao: 'APROVADA', aprovadoPorId: 'u-coord' },
    });
    await expect(svc.removerAnexoDespesa('v1', 'd1', 'a1', rep())).rejects.toThrow(/já passou por análise/);
    expect(prisma.anexoDespesa.delete).not.toHaveBeenCalled();
  });

  it('…mas apaga o comprovante enquanto a despesa está PENDENTE', async () => {
    prisma.anexoDespesa.findUnique.mockResolvedValue({
      id: 'a1', despesaId: 'd1', objectKey: 'k',
      despesa: { viagemId: 'v1', situacao: 'PENDENTE', aprovadoPorId: null },
    });
    await svc.removerAnexoDespesa('v1', 'd1', 'a1', rep());
    expect(prisma.anexoDespesa.delete).toHaveBeenCalled();
  });

  it('comprovante com o mês FECHADO → barrado mesmo estando PENDENTE', async () => {
    mesFechado();
    prisma.anexoDespesa.findUnique.mockResolvedValue({
      id: 'a1', despesaId: 'd1', objectKey: 'k',
      despesa: { viagemId: 'v1', situacao: 'PENDENTE', aprovadoPorId: null },
    });
    await expect(svc.removerAnexoDespesa('v1', 'd1', 'a1', rep())).rejects.toThrow(/RDV do mês encerrado/);
  });

  // B3 — visita não mexe em dinheiro, mas alimenta o relatório do mês.
  it('removerVisita com o mês FECHADO → barrado', async () => {
    mesFechado();
    prisma.parada.findUnique.mockResolvedValue({ id: 'p1', viagemId: 'v1' });
    await expect(svc.removerVisita('v1', 'p1', rep())).rejects.toThrow(/RDV do mês encerrado/);
    expect(prisma.parada.delete).not.toHaveBeenCalled();
  });

  it('editarVisita com o mês FECHADO → barrado', async () => {
    mesFechado();
    prisma.parada.findUnique.mockResolvedValue({ id: 'p1', viagemId: 'v1' });
    await expect(svc.editarVisita('v1', 'p1', { clienteNome: 'X' } as any, rep())).rejects.toThrow(/RDV do mês encerrado/);
    expect(prisma.parada.update).not.toHaveBeenCalled();
  });
});

// ⭐ ENVIADO = está na MESA DO APROVADOR — o roteiro congela para o dono (02/08).
// Reportado pelo Clenio no planejamento #47: ele enviou para aprovação e continuou
// incluindo visita. O coordenador avaliaria uma coisa e aprovaria outra, sem saber que
// mudou. O caminho de volta já existia (Ajustar/Rejeitar) — faltava a trava.
describe('SupervisorService — roteiro congela enquanto aguarda aprovação', () => {
  let prisma: any;
  let svc: SupervisorService;
  const dono = () => ({ sub: 'u-rep', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'SUPERVISOR' }] }) as any;
  const coord = () => ({ sub: 'u-coord', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'COORDENADOR' }] }) as any;
  const plan = (statusPlanejamento: string) => ({
    id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', situacao: 'EM_CURSO', statusPlanejamento,
    criadoPorId: 'u-rep', mesReferencia: 202608, supervisorRegistroId: 's1', veiculoId: 've1',
    supervisorRegistro: { coordenadorId: 'u-coord', matricula: 'E01047', departamentoId: 'd1' },
  });
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Rep' }]); // logado = dono
    prisma.parada.count.mockResolvedValue(0);
    prisma.parada.create.mockResolvedValue({ id: 'p9', status: 'PLANEJADA', localClienteId: null });
    prisma.parada.findUnique.mockResolvedValue({ id: 'p1', viagemId: 'v1' });
  });

  it('DONO não inclui visita com o planejamento ENVIADO', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('ENVIADO'));
    await expect(svc.adicionarVisita('v1', { clienteNome: 'X' } as any, dono()))
      .rejects.toThrow(/aguardando aprovação/);
    expect(prisma.parada.create).not.toHaveBeenCalled();
  });

  it('DONO não edita nem remove visita com o planejamento ENVIADO', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('ENVIADO'));
    await expect(svc.editarVisita('v1', 'p1', { clienteNome: 'Y' } as any, dono())).rejects.toThrow(/aguardando aprovação/);
    await expect(svc.removerVisita('v1', 'p1', dono())).rejects.toThrow(/aguardando aprovação/);
    expect(prisma.parada.delete).not.toHaveBeenCalled();
  });

  it('o APROVADOR mexe no roteiro durante a análise (é o que ele está fazendo ali)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('ENVIADO'));
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E09999', nome: 'Coord' }]); // não é o dono
    await svc.adicionarVisita('v1', { clienteNome: 'X' } as any, coord());
    expect(prisma.parada.create).toHaveBeenCalled();
  });

  it('devolvido para AJUSTADO, o dono volta a editar (é o vai e volta)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('AJUSTADO'));
    await svc.adicionarVisita('v1', { clienteNome: 'X' } as any, dono());
    expect(prisma.parada.create).toHaveBeenCalled();
  });

  it('em RASCUNHO o dono monta à vontade', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('RASCUNHO'));
    await svc.adicionarVisita('v1', { clienteNome: 'X' } as any, dono());
    expect(prisma.parada.create).toHaveBeenCalled();
  });

  // ⭐ APROVADO também congela (decisão do Clenio, 02/08): incluir depois do aval
  // expande em silêncio o que foi aprovado — o que será executado deixaria de ser o
  // que foi aprovado. Saída: "Devolver p/ reconfigurar".
  it('DONO não inclui visita com o planejamento APROVADO', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('APROVADO'));
    await expect(svc.adicionarVisita('v1', { clienteNome: 'X' } as any, dono()))
      .rejects.toThrow(/já foi APROVADO/);
    expect(prisma.parada.create).not.toHaveBeenCalled();
  });

  it('o APROVADOR ainda ajusta o roteiro APROVADO', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('APROVADO'));
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E09999', nome: 'Coord' }]);
    await svc.adicionarVisita('v1', { clienteNome: 'X' } as any, coord());
    expect(prisma.parada.create).toHaveBeenCalled();
  });

  // Na EXECUÇÃO o roteiro reabre para o dono: ali a visita é realidade de campo
  // (nasce REALIZADA), não plano. Regra que já existia e não pode ter sido quebrada.
  it('EM_EXECUCAO o dono volta a incluir (visita fora do plano)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('EM_EXECUCAO'));
    await svc.adicionarVisita('v1', { clienteNome: 'X' } as any, dono());
    expect(prisma.parada.create.mock.calls[0][0].data.status).toBe('REALIZADA');
  });
});


// ⭐ "Puxar de volta" (02/08): congelar o roteiro no ENVIADO criou um vai e volta —
// esqueceu um cliente depois de enviar, tinha que pedir ao aprovador para devolver.
// Retirar TIRA da fila de aprovação, então a garantia continua de pé: ninguém decide
// sobre algo que mudou por baixo.
describe('SupervisorService.retirarDaAprovacao', () => {
  let prisma: any;
  let svc: SupervisorService;
  const dono = () => ({ sub: 'u-rep', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'SUPERVISOR' }] }) as any;
  const outro = () => ({ sub: 'u-x', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'SUPERVISOR' }] }) as any;
  const plan = (st: string) => ({
    id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', situacao: 'EM_CURSO', statusPlanejamento: st,
    criadoPorId: 'u-rep', mesReferencia: 202608, supervisorRegistroId: 's1',
    supervisorRegistro: { coordenadorId: 'u-coord', matricula: 'E01047', departamentoId: 'd1' },
  });
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
    prisma.viagem.update.mockResolvedValue({ id: 'v1' });
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Rep' }]); // logado = dono
  });

  it('o DONO puxa de volta o ENVIADO → volta a RASCUNHO', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('ENVIADO'));
    await svc.retirarDaAprovacao('v1', dono());
    const data = prisma.viagem.update.mock.calls[0][0].data;
    expect(data.statusPlanejamento).toBe('RASCUNHO');
    // Comentário de uma devolução anterior se referia à versão antiga.
    expect(data.comentarioCoordenador).toBeNull();
  });

  it('não puxa de volta o que JÁ FOI DECIDIDO (aprovado)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('APROVADO'));
    await expect(svc.retirarDaAprovacao('v1', dono())).rejects.toThrow(/ainda não foi decidido/);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });

  it('não puxa de volta planejamento de OUTRO', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('ENVIADO'));
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E09999', nome: 'Colega' }]);
    await expect(svc.retirarDaAprovacao('v1', outro())).rejects.toThrow(ForbiddenException);
  });

  it('mês FECHADO trava a retirada', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('ENVIADO'));
    prisma.fechamentoRdv.findUnique.mockResolvedValue({ supervisorId: 's1', mesReferencia: 202608 });
    await expect(svc.retirarDaAprovacao('v1', dono())).rejects.toThrow(/RDV do mês encerrado/);
  });
});

/**
 * ⭐ ENCERRAMENTO DO MÊS É DE QUEM APROVA (21/08).
 *
 * Reproduzido pelo Clenio numa demonstração: o `fabricioneiva` é COORDENADOR do
 * Kelver e, ao mesmo tempo, representante com RDV próprio (cadastro sem
 * `coordenadorId`, roteado pelo DEPARTAMENTO). Ele fechava — e reabria — o próprio
 * mês, porque `fechar`/`reabrir` usavam `assertEscopoSupervisor`, que é ALCANCE e
 * traz o ramo de auto-serviço "sou eu mesmo, por matrícula".
 *
 * Mesma raiz do adiantamento (01/08) e do `editarViagem` (06/08): a trava tem de ser
 * por AUTORIDADE sobre aquele representante, não por papel nem por alcance.
 */
describe('SupervisorService — encerrar/reabrir o mês é da autoridade, nunca do próprio', () => {
  let prisma: any;
  let svc: SupervisorService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
  });
  // Coordenador que também é representante: o cadastro DELE não tem coordenadorId
  // (roteia pelo departamento → quem fecha é o Supervisor de Departamento).
  const coord = () => ({ sub: 'u-coord', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'COORDENADOR' }] }) as any;
  const supDepto = () => ({ sub: 'u-depto', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'SUPERVISOR_FROTA' }] }) as any;
  const cadastroDoCoord = { id: 's-coord', filialId: 'f1', coordenadorId: null, departamentoId: 'd1', matricula: '003448' };
  const cadastroDoRep = { id: 's-rep', filialId: 'f1', coordenadorId: 'u-coord', departamentoId: 'd1', matricula: '005274' };
  // matriculaDoUsuario: o logado é o próprio coordenador/representante 003448.
  const logadoEhOCoord = () => prisma.$queryRaw.mockResolvedValue([{ matricula: '003448', nome: 'Fabricio' }]);

  it('coordenador NÃO fecha o próprio mês (alcança por auto-serviço, mas não é autoridade sobre si)', async () => {
    prisma.supervisor.findUnique.mockResolvedValue(cadastroDoCoord);
    logadoEhOCoord();
    await expect(svc.fecharRdv('s-coord', 202608, coord())).rejects.toThrow(/encerramento do mês é de quem aprova/);
    expect(prisma.fechamentoRdv.upsert).not.toHaveBeenCalled();
  });

  it('coordenador NÃO reabre o próprio mês (destravar o valor já aceito é pior que fechar)', async () => {
    prisma.supervisor.findUnique.mockResolvedValue(cadastroDoCoord);
    logadoEhOCoord();
    await expect(svc.reabrirRdv('s-coord', 202608, coord())).rejects.toThrow(/Reabrir o mês é de quem aprova/);
    expect(prisma.fechamentoRdv.deleteMany).not.toHaveBeenCalled();
  });

  it('coordenador fecha o mês do REPRESENTANTE dele (caminho legítimo, segue passando)', async () => {
    prisma.supervisor.findUnique.mockResolvedValue(cadastroDoRep);
    await svc.fecharRdv('s-rep', 202608, coord());
    expect(prisma.fechamentoRdv.upsert).toHaveBeenCalled();
    expect(prisma.fechamentoRdv.upsert.mock.calls[0][0].create.fechadoPorId).toBe('u-coord');
  });

  it('Supervisor de Departamento fecha o mês do coordenador (é a autoridade dele)', async () => {
    prisma.supervisor.findUnique.mockResolvedValue(cadastroDoCoord);
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    await svc.fecharRdv('s-coord', 202608, supDepto());
    expect(prisma.fechamentoRdv.upsert).toHaveBeenCalled();
  });

  it('Supervisor de Departamento reabre o mês do coordenador', async () => {
    prisma.supervisor.findUnique.mockResolvedValue(cadastroDoCoord);
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    await svc.reabrirRdv('s-coord', 202608, supDepto());
    expect(prisma.fechamentoRdv.deleteMany).toHaveBeenCalled();
  });

  it('representante de OUTRO departamento continua barrado antes mesmo da autoridade (alcance)', async () => {
    prisma.supervisor.findUnique.mockResolvedValue({ ...cadastroDoRep, departamentoId: 'd9' });
    prisma.supervisorDepartamento.findMany.mockResolvedValue([{ departamentoId: 'd1' }]);
    await expect(svc.fecharRdv('s-rep', 202608, supDepto())).rejects.toThrow(/fora do seu departamento/);
  });
});

// Varredura 21/08: `enviar` e `decidir` eram os dois atos do ciclo do planejamento que
// ignoravam o mês encerrado (`retirar`, `cancelar` e `devolver` já respeitavam).
describe('SupervisorService — mês encerrado trava também enviar/decidir o planejamento', () => {
  let prisma: any;
  let svc: SupervisorService;
  const dono = () => ({ sub: 'u-rep', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'SUPERVISOR' }] }) as any;
  const coord = () => ({ sub: 'u-coord', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'COORDENADOR' }] }) as any;
  const plan = (status: string) => ({
    id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', situacao: 'EM_CURSO', statusPlanejamento: status,
    criadoPorId: 'u-rep', mesReferencia: 202608, supervisorRegistroId: 's1',
    supervisorRegistro: { coordenadorId: 'u-coord', matricula: 'E01047', departamentoId: 'd1' },
  });
  const mesFechado = () => prisma.fechamentoRdv.findUnique.mockResolvedValue({ supervisorId: 's1', mesReferencia: 202608 });
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Rep' }]); // logado = dono
  });

  it('enviar com o mês FECHADO → barrado', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('RASCUNHO'));
    mesFechado();
    await expect(svc.enviarPlanejamento('v1', dono())).rejects.toThrow(/RDV do mês encerrado/);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });

  it('decidir com o mês FECHADO → barrado (não aprova o que não poderá ser executado)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('ENVIADO'));
    mesFechado();
    await expect(svc.decidirPlanejamento('v1', 'APROVADO', undefined, coord())).rejects.toThrow(/RDV do mês encerrado/);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });

  it('com o mês ABERTO os dois seguem funcionando', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('RASCUNHO'));
    await svc.enviarPlanejamento('v1', dono());
    expect(prisma.viagem.update.mock.calls[0][0].data.statusPlanejamento).toBe('ENVIADO');
    prisma.viagem.findUnique.mockResolvedValue(plan('ENVIADO'));
    await svc.decidirPlanejamento('v1', 'APROVADO', undefined, coord());
    expect(prisma.viagem.update.mock.calls[1][0].data.statusPlanejamento).toBe('APROVADO');
  });
});

// `reabrirViagem` só não abria o próprio planejamento por acidente (a `matricula` não
// vinha no include, então o ramo de auto-serviço do escopo nunca casava). Trava explícita.
describe('SupervisorService.reabrirViagem — reabrir é da autoridade', () => {
  let prisma: any;
  let svc: SupervisorService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
  });
  const coord = () => ({ sub: 'u-coord', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'COORDENADOR' }] }) as any;
  const viagem = (reg: any) => ({ id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', situacao: 'CONCLUIDA', statusPlanejamento: 'CONCLUIDO', supervisorRegistro: reg });

  it('coordenador NÃO reabre o PRÓPRIO planejamento concluído', async () => {
    prisma.viagem.findUnique.mockResolvedValue(viagem({ coordenadorId: null, departamentoId: 'd1', matricula: '003448' }));
    prisma.$queryRaw.mockResolvedValue([{ matricula: '003448', nome: 'Fabricio' }]);
    await expect(svc.reabrirViagem('v1', coord())).rejects.toThrow(/quem aprova/);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });

  it('coordenador reabre o planejamento do REPRESENTANTE dele', async () => {
    prisma.viagem.findUnique.mockResolvedValue(viagem({ coordenadorId: 'u-coord', departamentoId: 'd1', matricula: '005274' }));
    await svc.reabrirViagem('v1', coord());
    expect(prisma.viagem.update.mock.calls[0][0].data.situacao).toBe('EM_CURSO');
  });
});

/**
 * ⭐ Achados da execução do roteiro no Chrome (21/08) — as duas falhas novas.
 */
describe('SupervisorService — F1: editar não re-carimba a aprovação de quem lançou', () => {
  let prisma: any;
  let svc: SupervisorService;
  const coord = () => ({ sub: 'u-coord', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'COORDENADOR' }] }) as any;
  const plan = () => ({
    id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', situacao: 'EM_CURSO', statusPlanejamento: 'EM_EXECUCAO',
    criadoPorId: 'u-rep', mesReferencia: 202608, supervisorRegistroId: 's1', veiculoId: 've1',
    supervisorRegistro: { coordenadorId: 'u-coord', matricula: '005274', departamentoId: 'd1' },
  });
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
    prisma.viagem.findUnique.mockResolvedValue(plan());
    prisma.$queryRaw.mockResolvedValue([{ matricula: '003448', nome: 'Fabricio' }]);
  });

  // O caminho do furo: a autoridade lança no RDV do representante (nasce PENDENTE), o
  // representante confere (APROVADA) e a autoridade edita o valor. Manter APROVADA aqui
  // é a autoridade aprovando o PRÓPRIO lançamento pela porta dos fundos.
  it('autoridade que LANÇOU edita o valor → volta para PENDENTE (o dono reconfere)', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({
      id: 'd1', viagemId: 'v1', situacao: 'APROVADA', criadoPorId: 'u-coord', aprovadoPorId: 'u-rep', tipoDespesaId: 't1', veiculoId: 've1',
    });
    await svc.editarDespesa('v1', 'd1', { valor: 999 } as any, coord());
    const data = prisma.despesaVeiculo.update.mock.calls[0][0].data;
    expect(data.situacao).toBe('PENDENTE');
    expect(data.aprovadoPorId).toBeUndefined(); // preserva o histórico da decisão anterior
  });

  /**
   * ⭐ 22/08 — a regra de autoria vale NOS DOIS SENTIDOS.
   *
   * Este caso já foi teste do comportamento oposto ("a autoridade edita e mantém o
   * aval"), que veio do código de 01/08 e eu tinha documentado como intencional. A 3ª
   * execução do roteiro mostrou o arranjo real que ele permitia: o coordenador APROVA a
   * despesa do representante e depois, sozinho, muda o valor — que segue APROVADO, sem
   * voltar para conferência e sem o dono da conta ver. O CLAUDE.md sempre disse a versão
   * simétrica: "quem não lançou NÃO altera o valor".
   */
  it('autoridade que NÃO lançou NÃO altera o valor — o caminho dela é contestar', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({
      id: 'd1', viagemId: 'v1', situacao: 'APROVADA', criadoPorId: 'u-rep', aprovadoPorId: 'u-coord', tipoDespesaId: 't1', veiculoId: 've1',
    });
    await expect(svc.editarDespesa('v1', 'd1', { valor: 88 } as any, coord()))
      .rejects.toThrow(/lançada por outra pessoa/);
    expect(prisma.despesaVeiculo.update).not.toHaveBeenCalled();
  });

  it('…mas segue corrigindo fornecedor/observação da despesa alheia (não é dinheiro)', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({
      id: 'd1', viagemId: 'v1', situacao: 'APROVADA', criadoPorId: 'u-rep', aprovadoPorId: 'u-coord', tipoDespesaId: 't1', veiculoId: 've1',
    });
    await svc.editarDespesa('v1', 'd1', { observacao: 'nota do coordenador' } as any, coord());
    const data = prisma.despesaVeiculo.update.mock.calls[0][0].data;
    expect(data.situacao).toBeUndefined(); // não mexeu no valor → o aval fica de pé
    expect(data.observacao).toBe('nota do coordenador');
  });

  it('o próprio representante editando a SUA despesa aprovada → volta para PENDENTE', async () => {
    prisma.despesaVeiculo.findUnique.mockResolvedValue({
      id: 'd1', viagemId: 'v1', situacao: 'APROVADA', criadoPorId: 'u-rep', aprovadoPorId: 'u-coord', tipoDespesaId: 't1', veiculoId: 've1',
    });
    const rep = { sub: 'u-rep', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'SUPERVISOR' }] } as any;
    prisma.$queryRaw.mockResolvedValue([{ matricula: '005274', nome: 'Kelver' }]); // logado = dono
    await svc.editarDespesa('v1', 'd1', { valor: 88 } as any, rep);
    const data = prisma.despesaVeiculo.update.mock.calls[0][0].data;
    expect(data.situacao).toBe('PENDENTE');
  });
});

describe('SupervisorService — F2: criar planejamento respeita o mês encerrado', () => {
  let prisma: any;
  let svc: SupervisorService;
  const rep = () => ({ sub: 'u-rep', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'SUPERVISOR' }] }) as any;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
    prisma.$queryRaw.mockResolvedValue([{ matricula: '005274', nome: 'Kelver' }]);
    prisma.supervisor.findFirst.mockResolvedValue({ id: 's1', coordenadorId: 'u-coord', departamentoId: 'd1' });
  });

  it('mês encerrado → 400 e NADA é criado', async () => {
    prisma.fechamentoRdv.findUnique.mockResolvedValue({ supervisorId: 's1', mesReferencia: 202608 });
    await expect(svc.criarViagemSupervisor({ mesReferencia: 202608 } as any, rep()))
      .rejects.toThrow(/RDV do mês encerrado.*criar planejamento/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('mês aberto → cria normalmente', async () => {
    prisma.fechamentoRdv.findUnique.mockResolvedValue(null);
    await svc.criarViagemSupervisor({ mesReferencia: 202608 } as any, rep());
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

// O3: a recusa diz qual AÇÃO foi barrada, em vez da lista fixa "despesas, adiantamentos
// ou visitas" — que aparecia até ao aprovar um planejamento.
describe('SupervisorService — mensagem do mês encerrado cita a ação', () => {
  let prisma: any;
  let svc: SupervisorService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
    prisma.fechamentoRdv.findUnique.mockResolvedValue({ supervisorId: 's1', mesReferencia: 202608 });
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Rep' }]);
    prisma.viagem.findUnique.mockResolvedValue({
      id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', situacao: 'EM_CURSO', statusPlanejamento: 'ENVIADO',
      criadoPorId: 'u-rep', mesReferencia: 202608, supervisorRegistroId: 's1',
      supervisorRegistro: { coordenadorId: 'u-coord', matricula: 'E01047', departamentoId: 'd1' },
    });
  });
  it('aprovar planejamento fala em "decidir o planejamento", não em despesas/visitas', async () => {
    const coord = { sub: 'u-coord', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'COORDENADOR' }] } as any;
    await expect(svc.decidirPlanejamento('v1', 'APROVADO', undefined, coord))
      .rejects.toThrow(/não dá para decidir o planejamento/);
  });
});

/**
 * ⭐⭐ INVARIANTE ESTRUTURAL — o guard do mês encerrado, varrido por teste (22/08).
 *
 * Três vezes seguidas o mesmo defeito: `assertRdvAberto` foi aplicado ROTA A ROTA e
 * ficou faltando justamente na que ninguém tinha testado — `editar`/`remover` (01/08),
 * `enviar`/`decidir` (21/08), `criar` (21/08) e `iniciar`/`concluir`/`veículo`/`reabrir`
 * (22/08, achados pela skill do Chrome). A observação que fechou o assunto veio dela:
 * *"vale varrer o controller inteiro atrás de rotas de escrita sem a checagem, em vez
 * de ir tapando uma a uma"*.
 *
 * Este teste É essa varredura, agora permanente: lê o FONTE do serviço, acha todo
 * método que escreve no Prisma e exige `assertRdvAberto` — a não ser que esteja na
 * lista de dispensados abaixo, cada um com o motivo. Método de escrita novo sem guard
 * quebra aqui, na hora, e quem escrever precisa dizer por que dispensa.
 */
describe('SupervisorService — INVARIANTE: toda escrita do RDV respeita o mês encerrado', () => {
  // Dispensados, com o porquê. Mexer nesta lista é decisão de negócio, não limpeza.
  const DISPENSADOS: Record<string, string> = {
    anexarReciboDespesa: 'helper privado — quem chama (lançar/editar despesa) já checa',
    anexarComprovantes: 'helper privado — idem',
    criarSupervisor: 'cadastro do time: não pertence a um mês',
    atualizarSupervisor: 'cadastro do time: não pertence a um mês',
    criarAtividade: 'catálogo de atividades: não pertence a um mês',
    atualizarAtividade: 'catálogo de atividades: não pertence a um mês',
    definirSupervisorDepartamento: 'cadastro de responsável por departamento',
    removerSupervisorDepartamento: 'cadastro de responsável por departamento',
    fecharRdv: 'É o próprio encerramento',
    reabrirRdv: 'É o que destrava o mês — não pode ser travado por ele',
  };

  it('nenhum método de escrita fica sem `assertRdvAberto` (fora os dispensados)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const src = fs.readFileSync(path.join(__dirname, 'supervisor.service.ts'), 'utf8').split('\n');
    const inicios: { linha: number; nome: string }[] = [];
    src.forEach((l, i) => {
      const m = /^ {2}(?:async |private async |private )?([a-zA-Z][a-zA-Z0-9_]*)\(/.exec(l);
      if (m) inicios.push({ linha: i, nome: m[1] });
    });
    inicios.push({ linha: src.length, nome: '__fim__' });
    const semGuard: string[] = [];
    for (let k = 0; k < inicios.length - 1; k++) {
      const { linha, nome } = inicios[k];
      if (nome === 'assertRdvAberto' || nome in DISPENSADOS) continue;
      const corpo = src.slice(linha, inicios[k + 1].linha).join('\n');
      const escreve = /\.(create|update|updateMany|delete|deleteMany|upsert)\(/.test(corpo);
      if (escreve && !corpo.includes('assertRdvAberto')) semGuard.push(nome);
    }
    expect(semGuard).toEqual([]);
  });

  it('a lista de dispensados não guarda nome que já sumiu do serviço', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const src = fs.readFileSync(path.join(__dirname, 'supervisor.service.ts'), 'utf8');
    const orfaos = Object.keys(DISPENSADOS).filter((n) => !new RegExp(`\\n {2}(?:async |private async |private )?${n}\\(`).test(src));
    expect(orfaos).toEqual([]);
  });
});

// As quatro rotas que faltavam (achadas pela skill do Chrome em 22/08): executar também
// é mexer no mês. O caso real: com o mês do Kelver encerrado, o #58 saiu de APROVADO,
// foi para EM_EXECUCAO e terminou CONCLUÍDO, tudo com a prestação de contas já aceita.
describe('SupervisorService — mês encerrado trava também EXECUTAR', () => {
  let prisma: any;
  let svc: SupervisorService;
  const dono = () => ({ sub: 'u-rep', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'SUPERVISOR' }] }) as any;
  const coord = () => ({ sub: 'u-coord', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'COORDENADOR' }] }) as any;
  const plan = (status: string, situacao = 'EM_CURSO') => ({
    id: 'v1', tipo: 'SUPERVISOR', filialId: 'f1', situacao, statusPlanejamento: status,
    criadoPorId: 'u-rep', mesReferencia: 202608, supervisorRegistroId: 's1', veiculoId: 've1',
    supervisorRegistro: { coordenadorId: 'u-coord', matricula: 'E01047', departamentoId: 'd1' },
  });
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SupervisorService(prisma, condutorMock(), coreMock(), storageMock(), locaisMock());
    prisma.$queryRaw.mockResolvedValue([{ matricula: 'E01047', nome: 'Rep' }]); // logado = dono
    prisma.fechamentoRdv.findUnique.mockResolvedValue({ supervisorId: 's1', mesReferencia: 202608 });
  });

  it('liberar para execução → barrado', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('APROVADO'));
    await expect(svc.iniciarExecucao('v1', dono())).rejects.toThrow(/não dá para liberar para execução/);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });

  it('concluir → barrado', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('EM_EXECUCAO'));
    await expect(svc.concluirViagemSupervisor('v1', dono())).rejects.toThrow(/não dá para concluir o planejamento/);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });

  it('trocar o veículo do planejamento → barrado (é de onde a despesa herda o custo)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('APROVADO'));
    prisma.veiculo.findFirst.mockResolvedValue({ id: 've2', filialId: 'f1', ativo: true });
    await expect(svc.definirVeiculoPlanejamento('v1', 've2', dono())).rejects.toThrow(/não dá para trocar o veículo/);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });

  it('reabrir o planejamento concluído → barrado (reabra o MÊS primeiro)', async () => {
    prisma.viagem.findUnique.mockResolvedValue(plan('CONCLUIDO', 'CONCLUIDA'));
    await expect(svc.reabrirViagem('v1', coord())).rejects.toThrow(/não dá para reabrir o planejamento/);
    expect(prisma.viagem.update).not.toHaveBeenCalled();
  });

  it('com o mês ABERTO, liberar e concluir seguem funcionando', async () => {
    prisma.fechamentoRdv.findUnique.mockResolvedValue(null);
    prisma.viagem.findUnique.mockResolvedValue(plan('APROVADO'));
    await svc.iniciarExecucao('v1', dono());
    expect(prisma.viagem.update.mock.calls[0][0].data.statusPlanejamento).toBe('EM_EXECUCAO');
    prisma.viagem.findUnique.mockResolvedValue(plan('EM_EXECUCAO'));
    await svc.concluirViagemSupervisor('v1', dono());
    expect(prisma.viagem.update.mock.calls[1][0].data.statusPlanejamento).toBe('CONCLUIDO');
  });
});
