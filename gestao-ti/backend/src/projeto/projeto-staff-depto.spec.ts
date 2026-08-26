import { ProjetoHelpersService } from './services/projeto-helpers.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

const FISCAL = 'dep-fiscal';
const TI = 'dep-ti';

const suporteNoFiscal = {
  sub: 'u1',
  capabilities: [],
  modulos: [{
    codigo: 'WORKSPACE', role: 'SUPORTE',
    departamentos: [
      { id: FISCAL, nome: 'Fiscal', role: 'SUPORTE', isTI: false },
      { id: TI, nome: 'T.I.', role: 'USUARIO_FINAL', isTI: true },
    ],
  }],
} as any;

const auditor = {
  sub: 'u2',
  capabilities: ['OVERSIGHT_PLATAFORMA'],
  modulos: [{ codigo: 'WORKSPACE', role: 'GESTOR', departamentos: [{ id: FISCAL, nome: 'Fiscal', role: 'GESTOR', isTI: false }] }],
} as any;

describe('ehStaffNoProjeto — nota interna de projeto segue o departamento do projeto', () => {
  let prisma: any;
  let helpers: ProjetoHelpersService;

  beforeEach(() => {
    prisma = { projeto: { findUnique: jest.fn() } };
    helpers = new ProjetoHelpersService(prisma, {} as any, {} as any);
  });

  it('atende o projeto do próprio departamento', async () => {
    prisma.projeto.findUnique.mockResolvedValue({ departamentoId: FISCAL });
    await expect(helpers.ehStaffNoProjeto('p1', suporteNoFiscal, 'SUPORTE')).resolves.toBe(true);
  });

  // ⭐ Antes era `hasStaffPerfilEmTI`: quem é SUPORTE no Fiscal NÃO alcançava a nota
  // interna do projeto DO FISCAL, e quem é SUPORTE no T.I. alcançava a de todos.
  it('não atende projeto de departamento onde é usuária final', async () => {
    prisma.projeto.findUnique.mockResolvedValue({ departamentoId: TI });
    await expect(helpers.ehStaffNoProjeto('p1', suporteNoFiscal, 'SUPORTE')).resolves.toBe(false);
  });

  it('OVERSIGHT_PLATAFORMA alcança qualquer departamento (alcance EXPLÍCITO)', async () => {
    prisma.projeto.findUnique.mockResolvedValue({ departamentoId: TI });
    await expect(helpers.ehStaffNoProjeto('p1', auditor, 'GESTOR')).resolves.toBe(true);
    expect(prisma.projeto.findUnique).not.toHaveBeenCalled(); // decide sem ir ao banco
  });

  it('sem usuário, não atende', async () => {
    await expect(helpers.ehStaffNoProjeto('p1', undefined, 'SUPORTE')).resolves.toBe(false);
  });

  it('projeto inexistente não vira permissão', async () => {
    prisma.projeto.findUnique.mockResolvedValue(null);
    await expect(helpers.ehStaffNoProjeto('p-nao-existe', suporteNoFiscal, 'SUPORTE')).resolves.toBe(false);
  });
});
