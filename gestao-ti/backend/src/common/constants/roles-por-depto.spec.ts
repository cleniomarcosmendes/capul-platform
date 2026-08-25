import {
  ehAdminEmAlgumDepto,
  ehStaffNoDepto,
  ehGestorNoDepto,
} from './roles.constant';

// Os perfis são os REAIS da base da CAPUL (25/08): no Fiscal a pessoa atende chamado
// ou é gestora; no T.I. a MESMA pessoa é usuária final. Os papéis não se misturam.
const FISCAL = 'dep-fiscal';
const TI = 'dep-ti';

const comPerfis = (
  perfis: Array<[string, string]>,
  roleDenormalizada?: string,
) =>
  ({
    sub: 'u1',
    modulos: [
      {
        codigo: 'WORKSPACE',
        // A denormalizada é a do PRIMEIRO registro — e a ordem não é garantida. Por isso
        // os testes abaixo fixam a "errada" de propósito: a decisão não pode depender dela.
        role: roleDenormalizada ?? perfis[0][1],
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

describe('papel por departamento — Fiscal × T.I.', () => {
  // danielaelvira, fabioavelar, mariaoliveira, vanessasilva
  const suporteNoFiscal = comPerfis(
    [
      [FISCAL, 'SUPORTE'],
      [TI, 'USUARIO_FINAL'],
    ],
    'SUPORTE',
  );
  // vanialucia
  const gestorNoFiscal = comPerfis(
    [
      [FISCAL, 'GESTOR'],
      [TI, 'USUARIO_FINAL'],
    ],
    'GESTOR',
  );
  // thiagopereira
  const adminNoFiscal = comPerfis(
    [
      [FISCAL, 'ADMIN'],
      [TI, 'SUPORTE'],
    ],
    'ADMIN',
  );

  it('SUPORTE no Fiscal atende no Fiscal', () => {
    expect(ehStaffNoDepto(suporteNoFiscal, FISCAL, 'SUPORTE')).toBe(true);
  });

  // ⭐ O defeito de 25/08: a role denormalizada dizia SUPORTE e valia para o módulo
  // inteiro — a pessoa assumia chamado do T.I., onde é usuária final.
  it('SUPORTE no Fiscal NÃO atende no T.I. (lá é usuária final)', () => {
    expect(ehStaffNoDepto(suporteNoFiscal, TI, 'SUPORTE')).toBe(false);
  });

  it('GESTOR no Fiscal manda no Fiscal, não no T.I.', () => {
    expect(ehGestorNoDepto(gestorNoFiscal, FISCAL, 'GESTOR')).toBe(true);
    expect(ehGestorNoDepto(gestorNoFiscal, TI, 'GESTOR')).toBe(false);
  });

  // D36 mantido (decisão do Clenio em 25/08): ADMIN é global no Workspace.
  it('ADMIN em UM departamento vale em todos (D36)', () => {
    expect(ehStaffNoDepto(adminNoFiscal, TI, 'ADMIN')).toBe(true);
    expect(ehGestorNoDepto(adminNoFiscal, TI, 'ADMIN')).toBe(true);
    expect(ehAdminEmAlgumDepto(adminNoFiscal)).toBe(true);
  });

  // ⭐ E vale INDEPENDENTE da ordem em que o banco devolveu as permissões: hoje a role
  // denormalizada é a do primeiro registro, de uma consulta sem ORDER BY. Se virar, o
  // ADMIN do Fiscal não pode ser rebaixado a SUPORTE por acidente de ordenação.
  it('ADMIN continua ADMIN mesmo se a role denormalizada vier do outro departamento', () => {
    const mesmaPessoaOutraOrdem = comPerfis(
      [
        [FISCAL, 'ADMIN'],
        [TI, 'SUPORTE'],
      ],
      'SUPORTE',
    );
    expect(ehAdminEmAlgumDepto(mesmaPessoaOutraOrdem)).toBe(true);
    expect(ehGestorNoDepto(mesmaPessoaOutraOrdem, TI, 'SUPORTE')).toBe(true);
  });

  it('quem não tem perfil no departamento não atende nele', () => {
    expect(ehStaffNoDepto(suporteNoFiscal, 'dep-compras', 'SUPORTE')).toBe(
      false,
    );
  });

  // Sessão aberta durante o deploy: token pré Sub-fase 1.4 não traz departamentos[].
  // Tem de continuar valendo o comportamento antigo — não pode virar 403 no meio do dia.
  it('token antigo (sem departamentos[]) cai na role denormalizada', () => {
    const tokenAntigo = {
      sub: 'u1',
      modulos: [{ codigo: 'WORKSPACE', role: 'SUPORTE' }],
    } as any;
    expect(ehStaffNoDepto(tokenAntigo, TI, 'SUPORTE')).toBe(true);
    expect(ehGestorNoDepto(tokenAntigo, TI, 'SUPORTE')).toBe(false);
    expect(ehGestorNoDepto(tokenAntigo, TI, 'GESTOR')).toBe(true);
  });

  it('sem usuário / sem módulo, ninguém atende', () => {
    expect(ehStaffNoDepto(null, TI)).toBe(false);
    expect(ehStaffNoDepto({ sub: 'x', modulos: [] } as any, TI)).toBe(false);
  });
});
