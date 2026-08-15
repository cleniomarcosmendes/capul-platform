import { VarreduraMatriculaService } from './varredura-matricula.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Esta rotina DESATIVA usuários sozinha. O que os testes protegem não é o caminho
 * feliz — é o conjunto de freios que impede a varredura de trancar a empresa.
 *
 * O cenário que motivou cada um é concreto: o endpoint `infoFuncionario` já esteve
 * apontado para HOMOLOGAÇÃO em produção (achado de 27/06), e a rotação da
 * credencial do Protheus — pendente do /security-review — produz 401 em todas as
 * chamadas. Nos dois casos o Protheus "não acha" ninguém.
 */
describe('VarreduraMatriculaService', () => {
  const usuario = (n: number, matricula: string | null) => ({
    id: `u${n}`, username: `user${n}`, nome: `Fulano ${n}`, matricula,
  });

  const montar = (opts: {
    usuarios: ReturnType<typeof usuario>[];
    situacoes: Record<string, 'ATIVO' | 'NAO_ENCONTRADO' | 'FALHA'>;
    bloquear?: boolean;
    tetoPct?: number;
  }) => {
    const updateMany = jest.fn().mockImplementation(({ where }) =>
      Promise.resolve({ count: where.id.in.length }),
    );
    const prisma: any = {
      usuario: { findMany: jest.fn().mockResolvedValue(opts.usuarios), updateMany },
      systemLog: { create: jest.fn().mockResolvedValue({}), findFirst: jest.fn() },
      systemConfig: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.key === 'varredura_matricula_bloquear') {
            return Promise.resolve({ value: String(opts.bloquear ?? false) });
          }
          return Promise.resolve(opts.tetoPct ? { value: String(opts.tetoPct) } : null);
        }),
      },
    };
    const alerts: any = { notify: jest.fn().mockResolvedValue({}) };
    const protheus: any = {
      verificarMatricula: jest.fn().mockImplementation((m: string) =>
        Promise.resolve(opts.situacoes[m] ?? 'FALHA'),
      ),
    };
    return { svc: new VarreduraMatriculaService(prisma, alerts, protheus), prisma, alerts };
  };

  // A pausa entre consultas tornaria o teste lento sem acrescentar nada.
  beforeAll(() => {
    jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => { fn(); return 0 as any; }) as any);
  });
  afterAll(() => jest.restoreAllMocks());

  it('⭐ FALHA nunca bloqueia — Protheus fora do ar não desliga ninguém', async () => {
    const { svc, prisma } = montar({
      usuarios: [usuario(1, 'E001'), usuario(2, 'E002')],
      situacoes: { E001: 'FALHA', E002: 'FALHA' },
      bloquear: true,
    });

    const r = await svc.run();

    expect(r.falhas).toBe(2);
    expect(r.naoEncontrados).toBe(0);
    expect(r.desligados).toHaveLength(0);
    expect(prisma.usuario.updateMany).not.toHaveBeenCalled();
  });

  it('⭐ freio de mão: proporção alta de "não encontrados" ABORTA sem bloquear', async () => {
    // 3 de 4 ausentes = 75%. Isso é endpoint no ambiente errado ou credencial
    // trocada, não três demissões na mesma madrugada.
    const { svc, prisma, alerts } = montar({
      usuarios: [usuario(1, 'E001'), usuario(2, 'E002'), usuario(3, 'E003'), usuario(4, 'E004')],
      situacoes: { E001: 'NAO_ENCONTRADO', E002: 'NAO_ENCONTRADO', E003: 'NAO_ENCONTRADO', E004: 'ATIVO' },
      bloquear: true,
    });

    const r = await svc.run();

    expect(r.abortada).toBe(true);
    expect(r.bloqueados).toBe(0);
    expect(prisma.usuario.updateMany).not.toHaveBeenCalled();
    expect(r.motivoAborto).toMatch(/infoFuncionario/); // aponta onde procurar
    expect(alerts.notify).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
  });

  it('⭐ o teto olha só quem o Protheus RESPONDEU — falhas não diluem a proporção', async () => {
    // 1 ausente entre 2 respostas = 50% → aborta. Se as 8 falhas entrassem na
    // conta daria 10% e a varredura bloquearia baseada em 2 respostas apenas.
    const usuarios = [usuario(1, 'E001'), usuario(2, 'E002')];
    const situacoes: Record<string, any> = { E001: 'NAO_ENCONTRADO', E002: 'ATIVO' };
    for (let i = 3; i <= 10; i++) { usuarios.push(usuario(i, `E00${i}`)); situacoes[`E00${i}`] = 'FALHA'; }

    const { svc, prisma } = montar({ usuarios, situacoes, bloquear: true });
    const r = await svc.run();

    expect(r.falhas).toBe(8);
    expect(r.abortada).toBe(true);
    expect(prisma.usuario.updateMany).not.toHaveBeenCalled();
  });

  it('⭐ modo RELATÓRIO (padrão): lista quem sairia, sem mexer em ninguém', async () => {
    const { svc, prisma } = montar({
      usuarios: [usuario(1, 'E001'), usuario(2, 'E002')],
      situacoes: { E001: 'NAO_ENCONTRADO', E002: 'ATIVO' },
      // `bloquear` ausente = false: ligar é decisão explícita.
    });

    const r = await svc.run();

    expect(r.desligados).toEqual([
      { id: 'u1', username: 'user1', nome: 'Fulano 1', matricula: 'E001' },
    ]);
    expect(r.bloqueados).toBe(0);
    expect(prisma.usuario.updateMany).not.toHaveBeenCalled();
  });

  it('com bloqueio ligado e proporção normal: desativa só o ausente', async () => {
    const usuarios = [usuario(1, 'E001')];
    const situacoes: Record<string, any> = { E001: 'NAO_ENCONTRADO' };
    for (let i = 2; i <= 10; i++) { usuarios.push(usuario(i, `E00${i}`)); situacoes[`E00${i}`] = 'ATIVO'; }

    const { svc, prisma } = montar({ usuarios, situacoes, bloquear: true });
    const r = await svc.run();

    expect(r.abortada).toBe(false);
    expect(r.bloqueados).toBe(1);
    expect(prisma.usuario.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['u1'] } },
      data: { status: 'INATIVO' },
    });
  });

  it('INDIVIDUAL sem matrícula é REPORTADO, nunca bloqueado', async () => {
    // Não há o que verificar — bloquear puniria o usuário por uma lacuna nossa.
    // Mas ele fica FORA da varredura, e isso precisa aparecer no resultado.
    const { svc, prisma } = montar({
      usuarios: [usuario(1, null), usuario(2, '  '), usuario(3, 'E003')],
      situacoes: { E003: 'ATIVO' },
      bloquear: true,
    });

    const r = await svc.run();

    expect(r.semMatricula).toBe(2);
    expect(r.verificados).toBe(1);
    expect(prisma.usuario.updateMany).not.toHaveBeenCalled();
  });

  it('só olha INDIVIDUAL ATIVO — conta PADRÃO (caixa) fica fora por consulta', async () => {
    const { svc, prisma } = montar({ usuarios: [], situacoes: {} });
    await svc.run();
    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ATIVO', tipo: 'INDIVIDUAL' } }),
    );
  });

  it('registra a execução em system_logs mesmo quando não há nada a fazer', async () => {
    // Sem rastro, ninguém sabe se a rotina rodou — e "não bloqueou nada" é
    // indistinguível de "não executou".
    const { svc, prisma } = montar({
      usuarios: [usuario(1, 'E001')],
      situacoes: { E001: 'ATIVO' },
    });

    await svc.run();

    expect(prisma.systemLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ module: 'VARREDURA_MATRICULA', action: 'RELATORIO' }),
      }),
    );
  });
});
