import { ForbiddenException } from '@nestjs/common';
import { rolesLogistica, temRoleLogistica, temAcessoLogistica, deptosComRoleLogistica } from './roles-logistica';
import { RolesGuard } from './guards/roles.guard';
import { podeVerOutrasFiliais } from './filial-scope';
import { assertPodeOperarViagem } from './frota-perms';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Token NOVO: papel por departamento (o que o Auth Gateway emite hoje). */
const comDeptos = (...pares: [string, string][]) =>
  ({
    sub: 'u1',
    filialId: 'f1',
    modulos: [
      {
        codigo: 'LOGISTICA',
        // Denormalizada = a do 1º depto, como o Auth Gateway monta.
        role: pares[0]?.[1],
        departamentos: pares.map(([id, role], i) => ({ id, nome: `Depto ${i}`, role })),
      },
    ],
  }) as any;

/** Token ANTIGO: só o campo denormalizado, sem `departamentos[]`. */
const legado = (role: string) => ({ sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'LOGISTICA', role }] }) as any;

const semModulo = () => ({ sub: 'u1', filialId: 'f1', modulos: [{ codigo: 'WORKSPACE', role: 'ADMIN' }] }) as any;

describe('roles-logistica (multi-role)', () => {
  describe('rolesLogistica', () => {
    it('um departamento → um papel', () => {
      expect(rolesLogistica(comDeptos(['d1', 'GESTOR_ENTREGA']))).toEqual(['GESTOR_ENTREGA']);
    });

    // ⭐ O bug que dormia: com 2 permissões o módulo usava só a role do 1º depto.
    it('DOIS departamentos → os DOIS papéis (antes só o 1º era visto)', () => {
      const u = comDeptos(['d1', 'SUPERVISOR_FROTA'], ['d2', 'GESTOR_ENTREGA']);
      expect(rolesLogistica(u)).toEqual(['SUPERVISOR_FROTA', 'GESTOR_ENTREGA']);
    });

    it('mesmo papel em 2 deptos → não duplica', () => {
      expect(rolesLogistica(comDeptos(['d1', 'SUPERVISOR'], ['d2', 'SUPERVISOR']))).toEqual(['SUPERVISOR']);
    });

    it('token ANTIGO (sem departamentos[]) → cai no campo legado', () => {
      expect(rolesLogistica(legado('PORTARIA'))).toEqual(['PORTARIA']);
    });

    it('sem o módulo Logística → vazio', () => expect(rolesLogistica(semModulo())).toEqual([]));
    it('sem usuário → vazio', () => expect(rolesLogistica(undefined)).toEqual([]));
  });

  describe('temRoleLogistica', () => {
    const u = comDeptos(['d1', 'SUPERVISOR_FROTA'], ['d2', 'GESTOR_ENTREGA']);
    it('acha o papel do 1º depto', () => expect(temRoleLogistica(u, 'SUPERVISOR_FROTA')).toBe(true));
    // Este é o ponto 4 da pauta: o "Gestor de Entrega" que também supervisiona.
    it('acha o papel do 2º depto', () => expect(temRoleLogistica(u, 'GESTOR_ENTREGA')).toBe(true));
    it('qualquer-um-de: basta um bater', () => expect(temRoleLogistica(u, 'ADMIN', 'GESTOR_ENTREGA')).toBe(true));
    it('nenhum bate → false', () => expect(temRoleLogistica(u, 'ADMIN', 'PORTARIA')).toBe(false));
    it('sem acesso → false', () => expect(temRoleLogistica(semModulo(), 'ADMIN')).toBe(false));
  });

  describe('temAcessoLogistica', () => {
    it('com papel → true', () => expect(temAcessoLogistica(legado('OPERADOR_ENTREGA'))).toBe(true));
    it('sem o módulo → false', () => expect(temAcessoLogistica(semModulo())).toBe(false));
  });

  describe('deptosComRoleLogistica', () => {
    const u = comDeptos(['d1', 'SUPERVISOR_FROTA'], ['d2', 'GESTOR_ENTREGA'], ['d3', 'SUPERVISOR_FROTA']);
    it('devolve só os deptos onde tem AQUELE papel', () => {
      expect(deptosComRoleLogistica(u, 'SUPERVISOR_FROTA')).toEqual(['d1', 'd3']);
    });
    it('papel que não tem → vazio', () => expect(deptosComRoleLogistica(u, 'ADMIN')).toEqual([]));
    // Não dá para inventar o depto que o token não trouxe — devolver "todos" abriria escopo.
    it('token ANTIGO → vazio mesmo tendo o papel (não inventa departamento)', () => {
      expect(deptosComRoleLogistica(legado('SUPERVISOR_FROTA'), 'SUPERVISOR_FROTA')).toEqual([]);
    });
  });
});

describe('RolesGuard com multi-role', () => {
  const ctx = (user: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as any;
  const guard = (required?: string[]) =>
    new RolesGuard({ getAllAndOverride: () => required } as any);

  it('sem @Roles na rota → só exige estar autenticado', () => {
    expect(guard(undefined).canActivate(ctx(semModulo()))).toBe(true);
  });

  it('sem o módulo Logística → 403', () => {
    expect(() => guard(['ADMIN']).canActivate(ctx(semModulo()))).toThrow(ForbiddenException);
  });

  // ⭐ O caso do ponto 4: GESTOR_ENTREGA num depto + SUPERVISOR_FROTA noutro.
  it('libera pelo papel do SEGUNDO departamento (antes era 403)', () => {
    const u = comDeptos(['d1', 'GESTOR_ENTREGA'], ['d2', 'SUPERVISOR_FROTA']);
    expect(guard(['SUPERVISOR_FROTA']).canActivate(ctx(u))).toBe(true);
  });

  it('ADMIN em qualquer departamento passa sempre', () => {
    const u = comDeptos(['d1', 'OPERADOR_ENTREGA'], ['d2', 'ADMIN']);
    expect(guard(['GESTOR_FROTA']).canActivate(ctx(u))).toBe(true);
  });

  it('nenhum dos papéis satisfaz → 403', () => {
    const u = comDeptos(['d1', 'OPERADOR_ENTREGA'], ['d2', 'SUPERVISOR']);
    expect(() => guard(['GESTOR_FROTA']).canActivate(ctx(u))).toThrow(ForbiddenException);
  });

  it('token ANTIGO segue funcionando exatamente como antes', () => {
    expect(guard(['PORTARIA']).canActivate(ctx(legado('PORTARIA')))).toBe(true);
    expect(() => guard(['PORTARIA']).canActivate(ctx(legado('SUPERVISOR')))).toThrow(ForbiddenException);
  });
});

describe('consumidores do papel enxergam o 2º departamento', () => {
  it('podeVerOutrasFiliais: GESTOR_FROTA no 2º depto conta', () => {
    expect(podeVerOutrasFiliais(comDeptos(['d1', 'OPERADOR_ENTREGA'], ['d2', 'GESTOR_FROTA']))).toBe(true);
    expect(podeVerOutrasFiliais(comDeptos(['d1', 'OPERADOR_ENTREGA'], ['d2', 'SUPERVISOR']))).toBe(false);
  });

  it('assertPodeOperarViagem: GESTOR_FROTA no 2º depto opera viagem de terceiro', () => {
    const viagem = { criadoPorId: 'OUTRO', veiculo: { supervisorId: 'OUTRO' } };
    const u = comDeptos(['d1', 'OPERADOR_ENTREGA'], ['d2', 'GESTOR_FROTA']);
    expect(() => assertPodeOperarViagem(u, viagem)).not.toThrow();
    const semPoder = comDeptos(['d1', 'OPERADOR_ENTREGA'], ['d2', 'SUPERVISOR']);
    expect(() => assertPodeOperarViagem(semPoder, viagem)).toThrow(ForbiddenException);
  });
});
