import { VeiculoService } from './veiculo.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

/* eslint-disable @typescript-eslint/no-explicit-any */
const coreMock = () => ({
  nomesFiliais: async () => new Map(),
  nomesDepartamentos: async () => new Map(),
  nomesUsuarios: async () => new Map(),
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
