import { buildModulosPayload } from './build-modulos-payload';

/* eslint-disable @typescript-eslint/no-explicit-any */

const permissao = (modulo: string, depto: string, role: string) => ({
  modulo: { codigo: modulo },
  roleModulo: { codigo: role },
  departamentoId: depto,
  departamento: { id: depto, nome: depto, tipoDepartamento: { nome: 'Administrativo' } },
});

function prismaCom(permissoes: unknown[]) {
  return {
    permissaoModulo: { findMany: jest.fn().mockResolvedValue(permissoes) },
    departamentoFuncionalidade: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

describe('buildModulosPayload — a role do módulo não pode depender da ordem do banco', () => {
  // Perfis REAIS da base (25/08): no Fiscal a pessoa atende chamado ou é gestora; no
  // T.I. a MESMA pessoa é usuária final.
  const FISCAL_GESTOR = permissao('WORKSPACE', 'Fiscal', 'GESTOR');
  const TI_FINAL = permissao('WORKSPACE', 'Tecnologia da Informacao', 'USUARIO_FINAL');

  it('o papel mais forte vence, venha em que ordem vier', async () => {
    const [a] = await buildModulosPayload(prismaCom([FISCAL_GESTOR, TI_FINAL]), 'u1');
    const [b] = await buildModulosPayload(prismaCom([TI_FINAL, FISCAL_GESTOR]), 'u1');
    expect(a.role).toBe('GESTOR');
    expect(b.role).toBe('GESTOR');
  });

  // ⭐ O defeito: antes era "a role do primeiro registro". Invertida a ordem, a mesma
  // pessoa virava USUARIO_FINAL e PERDIA acesso no Fiscal, onde é gestora — sem que
  // ninguém tivesse mexido em permissão.
  it('ADMIN em um departamento vale como ADMIN do módulo (D36)', async () => {
    const [m] = await buildModulosPayload(
      prismaCom([permissao('WORKSPACE', 'Tecnologia da Informacao', 'SUPORTE'),
                 permissao('WORKSPACE', 'Fiscal', 'ADMIN')]),
      'u1',
    );
    expect(m.role).toBe('ADMIN');
  });

  it('departamentos[] traz TODOS os perfis, com o papel de cada um', async () => {
    const [m] = await buildModulosPayload(prismaCom([FISCAL_GESTOR, TI_FINAL]), 'u1');
    expect(m.departamentos.map((d) => `${d.nome}=${d.role}`).sort())
      .toEqual(['Fiscal=GESTOR', 'Tecnologia da Informacao=USUARIO_FINAL']);
  });

  // Logística: mesmo papel nos dois departamentos (caso real — renataborges). Não há o
  // que ordenar, e papel de outro módulo não entra na hierarquia do Workspace.
  it('papel fora da hierarquia do Workspace não vira promoção nem rebaixamento', async () => {
    const [m] = await buildModulosPayload(
      prismaCom([permissao('LOGISTICA', 'Supermercado', 'SUPERVISOR_FROTA'),
                 permissao('LOGISTICA', 'Centro de Distribuicao', 'SUPERVISOR_FROTA')]),
      'u1',
    );
    expect(m.role).toBe('SUPERVISOR_FROTA');
    expect(m.departamentos).toHaveLength(2);
  });

  it('a consulta pede ordem estável (o seletor de workspace usa o primeiro)', async () => {
    const prisma = prismaCom([FISCAL_GESTOR]);
    await buildModulosPayload(prisma, 'u1');
    expect(prisma.permissaoModulo.findMany.mock.calls[0][0].orderBy).toBeDefined();
  });

  it('sem permissão, nenhum módulo', async () => {
    expect(await buildModulosPayload(prismaCom([]), 'u1')).toEqual([]);
  });
});
