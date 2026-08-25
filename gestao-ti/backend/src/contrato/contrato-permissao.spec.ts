import { ForbiddenException } from '@nestjs/common';
import { ContratoCoreService } from './services/contrato-core.service';

const FISCAL = 'dep-fiscal';
const TI = 'dep-ti';

const comPerfis = (
  perfis: Array<[string, string]>,
  denormalizada?: string,
  capabilities: string[] = [],
) =>
  ({
    sub: 'u1',
    capabilities,
    modulos: [
      {
        codigo: 'WORKSPACE',
        role: denormalizada ?? perfis[0][1],
        departamentos: perfis.map(([id, role]) => ({
          id,
          nome: id,
          role,
          funcionalidades: [],
          isTI: id === TI,
        })),
      },
    ],
  }) as any;

describe('ContratoCoreService.ensureContratoPermission — o contrato é de UM departamento', () => {
  let prisma: any;
  let svc: ContratoCoreService;
  const contratoDoTI = { equipeId: 'eq-ti', departamentoId: TI };

  beforeEach(() => {
    prisma = {
      membroEquipe: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    svc = new ContratoCoreService(prisma);
  });

  // ⭐ O defeito de 25/08 (auditoria §3): `if (role === 'ADMIN' || role === 'GESTOR')
  // return` — sem olhar departamento, sobre um findOne sem filtro. Rateio é dinheiro.
  it('GESTOR do Fiscal NÃO mexe em contrato do T.I.', async () => {
    const gestorFiscal = comPerfis(
      [
        [FISCAL, 'GESTOR'],
        [TI, 'USUARIO_FINAL'],
      ],
      'GESTOR',
    );
    await expect(
      svc.ensureContratoPermission(contratoDoTI, 'u1', 'GESTOR', gestorFiscal),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('GESTOR do Fiscal mexe em contrato do Fiscal', async () => {
    const gestorFiscal = comPerfis(
      [
        [FISCAL, 'GESTOR'],
        [TI, 'USUARIO_FINAL'],
      ],
      'GESTOR',
    );
    await expect(
      svc.ensureContratoPermission(
        { equipeId: 'eq-f', departamentoId: FISCAL },
        'u1',
        'GESTOR',
        gestorFiscal,
      ),
    ).resolves.toBeUndefined();
  });

  // ⚠️ Aqui vale E1, não D36: nos cadastros operacionais o ADMIN NÃO escapa por role.
  it('ADMIN de um departamento não mexe no contrato de outro (E1 revogou o D36 aqui)', async () => {
    const adminFiscal = comPerfis([[FISCAL, 'ADMIN']], 'ADMIN');
    await expect(
      svc.ensureContratoPermission(contratoDoTI, 'u1', 'ADMIN', adminFiscal),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('quem tem OVERSIGHT_PLATAFORMA passa em qualquer departamento (é o auditor)', async () => {
    const auditor = comPerfis([[FISCAL, 'GESTOR']], 'GESTOR', [
      'OVERSIGHT_PLATAFORMA',
    ]);
    await expect(
      svc.ensureContratoPermission(contratoDoTI, 'u1', 'GESTOR', auditor),
    ).resolves.toBeUndefined();
  });

  it('membro da equipe DO CONTRATO com podeGerirContratos passa', async () => {
    prisma.membroEquipe.findUnique.mockResolvedValue({
      status: 'ATIVO',
      podeGerirContratos: true,
    });
    const suporteTI = comPerfis([[TI, 'SUPORTE']], 'SUPORTE');
    await expect(
      svc.ensureContratoPermission(contratoDoTI, 'u1', 'SUPORTE', suporteTI),
    ).resolves.toBeUndefined();
  });

  it('membro sem podeGerirContratos não passa', async () => {
    prisma.membroEquipe.findUnique.mockResolvedValue({
      status: 'ATIVO',
      podeGerirContratos: false,
    });
    const suporteTI = comPerfis([[TI, 'SUPORTE']], 'SUPORTE');
    await expect(
      svc.ensureContratoPermission(contratoDoTI, 'u1', 'SUPORTE', suporteTI),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // Sessão aberta durante o deploy: sem `user`, vale o comportamento anterior.
  it('sem user (chamador antigo) cai na role denormalizada', async () => {
    await expect(
      svc.ensureContratoPermission(contratoDoTI, 'u1', 'GESTOR'),
    ).resolves.toBeUndefined();
  });
});
