import { VeiculoService } from './veiculo.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

/* eslint-disable @typescript-eslint/no-explicit-any */
const coreMock = () => ({
  nomesFiliais: async () => new Map(),
  nomesDepartamentos: async () => new Map(),
  nomesUsuarios: async () => new Map(),
  // Validações de FK do core no create/update + papel do representante.
  validarFilial: async () => undefined,
  validarDepartamento: async () => undefined,
  validarUsuario: async () => undefined,
  assertSupervisorDeVeiculo: async () => undefined,
  papeisLogisticaPorChapa: async () => new Map(),
}) as any;
const sup = (sub = 'u1') => ({ sub, filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role: 'SUPERVISOR_FROTA' }] }) as any;

// ⭐ Vazamento pego no /security-review (12/07): o filtro ?departamentoLotacaoId
// sobrepunha o recorte de escopo do Supervisor de Departamento (chave repetida no
// spread do where). Agora INTERSECTA — param fora do escopo → in: [] (não vaza).
describe('VeiculoService.list — escopo por departamento (SUPERVISOR_FROTA)', () => {
  let prisma: any;
  let svc: VeiculoService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new VeiculoService(prisma, coreMock());
  });

  const mockDeps = (deps: string[]) => {
    prisma.veiculo.findMany
      .mockResolvedValueOnce(deps.map((d) => ({ departamentoLotacaoId: d }))) // deptosSupervisionados
      .mockResolvedValueOnce([]); // list
  };
  const whereDaLista = () => prisma.veiculo.findMany.mock.calls[1][0].where.departamentoLotacaoId;

  it('sem filtro → restringe aos departamentos do escopo (in: deps)', async () => {
    mockDeps(['d1', 'd2']);
    await svc.list({ supervisorFrotaUser: sup() });
    expect(whereDaLista()).toEqual({ in: ['d1', 'd2'] });
  });

  it('?departamentoLotacaoId DENTRO do escopo → filtra só por ele', async () => {
    mockDeps(['d1', 'd2']);
    await svc.list({ supervisorFrotaUser: sup(), departamentoLotacaoId: 'd1' });
    expect(whereDaLista()).toEqual({ in: ['d1'] });
  });

  it('?departamentoLotacaoId FORA do escopo → NÃO vaza (in: [])', async () => {
    mockDeps(['d1', 'd2']);
    await svc.list({ supervisorFrotaUser: sup(), departamentoLotacaoId: 'dX' });
    expect(whereDaLista()).toEqual({ in: [] });
  });
});

// ⭐ O responsável pelo veículo (quem fica com o carro para as visitas) era texto
// livre de 20 caracteres, sem conferência: no DEV convivia 'E02336' num veículo e
// '005274' em outro. Virou dado de verdade quando passou a ser a origem da SUGESTÃO
// de veículo do planejamento do RDV — matrícula errada ou em outro formato faria a
// sugestão sumir calada. Agora casa com a Equipe da filial e grava normalizado.
describe('VeiculoService — representante responsável pelo veículo', () => {
  let prisma: any;
  let svc: VeiculoService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new VeiculoService(prisma, coreMock());
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    prisma.veiculo.create.mockResolvedValue({ id: 'v1', supervisorAreaMatricula: 'E03448', supervisorAreaNome: 'Fabricio Silva Neiva' });
  });
  const dtoBase = {
    filialId: 'f1', placa: 'ABC1D23', departamentoLotacaoId: 'd1', supervisorId: 'u-encarregado',
  } as any;

  it('aceita o COORDENADOR (não só o supervisor de área) e grava a chapa normalizada', async () => {
    prisma.supervisor.findMany.mockResolvedValue([{ matricula: '003448', nome: 'Fabricio Silva Neiva' }]);
    await svc.create({ ...dtoBase, supervisorAreaMatricula: '3448' }, 'quem-criou');
    const data = prisma.veiculo.create.mock.calls[0][0].data;
    expect(data.supervisorAreaMatricula).toBe('E03448'); // chapa('3448') === chapa('003448')
    expect(data.supervisorAreaNome).toBe('Fabricio Silva Neiva'); // nome vem da Equipe
  });

  it('matrícula fora da Equipe da filial → 400 e NÃO grava', async () => {
    prisma.supervisor.findMany.mockResolvedValue([{ matricula: '005274', nome: 'Kelver' }]);
    await expect(svc.create({ ...dtoBase, supervisorAreaMatricula: '00344' }, 'quem-criou')).rejects.toThrow(/não está cadastrada na Equipe/);
    expect(prisma.veiculo.create).not.toHaveBeenCalled();
  });

  it('nome NUNCA vem do cliente — mesmo enviado, vale o da Equipe', async () => {
    prisma.supervisor.findMany.mockResolvedValue([{ matricula: 'E03448', nome: 'Fabricio Silva Neiva' }]);
    await svc.create({ ...dtoBase, supervisorAreaMatricula: 'E03448', supervisorAreaNome: 'NOME FORJADO' } as any, 'quem-criou');
    expect(prisma.veiculo.create.mock.calls[0][0].data.supervisorAreaNome).toBe('Fabricio Silva Neiva');
  });

  it('sem matrícula informada → grava nulo, sem consultar a Equipe', async () => {
    await svc.create(dtoBase, 'quem-criou');
    expect(prisma.veiculo.create.mock.calls[0][0].data.supervisorAreaMatricula).toBeNull();
    expect(prisma.supervisor.findMany).not.toHaveBeenCalled();
  });
});
