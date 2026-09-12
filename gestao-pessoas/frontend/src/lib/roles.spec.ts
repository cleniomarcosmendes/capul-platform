import { describe, it, expect } from 'vitest';
import { ROLES, rolesDoModulo, temPapel, type UsuarioDoToken } from './roles';

/**
 * ⭐⭐ Espelha `backend/src/common/roles-rh.ts`. Os casos são os mesmos, de
 * propósito: é o que impede as duas cópias de divergirem em silêncio — e aqui
 * a divergência é MUDA, porque o sintoma é um item de menu que simplesmente
 * não existe.
 */
const comDeptos = (...roles: string[]): UsuarioDoToken => ({
  sub: 'u1',
  modulos: [{ codigo: 'GESTAO_PESSOAS', role: roles[0], departamentos: roles.map((role) => ({ role })) }],
});

describe('rolesDoModulo — TODOS os papéis, nunca o denormalizado', () => {
  it('sem o módulo no token: nenhum papel', () => {
    expect(rolesDoModulo({ sub: 'u1', modulos: [{ codigo: 'GESTAO_TI', role: 'ADMIN' }] })).toEqual([]);
    expect(rolesDoModulo({ sub: 'u1' })).toEqual([]);
    expect(rolesDoModulo(null)).toEqual([]);
  });

  /**
   * ⭐⭐ O CASO QUE JUSTIFICA A FUNÇÃO. `modulos[].role` é a role do 1º
   * departamento; ler só ele faria a tela enxergar RH_MODELO e ignorar
   * RH_CICLO — e o item "Ciclos" sumiria para quem tem direito a ele, **sem
   * erro nenhum**.
   */
  it('papéis DIFERENTES em departamentos diferentes: devolve os dois', () => {
    expect(rolesDoModulo(comDeptos('RH_MODELO', 'RH_CICLO'))).toEqual(['RH_MODELO', 'RH_CICLO']);
  });

  it('o mesmo papel em vários departamentos aparece uma vez', () => {
    expect(rolesDoModulo(comDeptos('RH_CICLO', 'RH_CICLO', 'RH_CICLO'))).toEqual(['RH_CICLO']);
  });

  /** Token antigo, emitido antes de `departamentos[]` existir. */
  it('sem `departamentos[]`: o campo legado é tudo que existe', () => {
    expect(
      rolesDoModulo({ sub: 'u1', modulos: [{ codigo: 'GESTAO_PESSOAS', role: 'RH_ADMIN' }] }),
    ).toEqual(['RH_ADMIN']);
  });

  it('`departamentos[]` presente mas sem role nenhuma: cai no legado', () => {
    expect(
      rolesDoModulo({
        sub: 'u1',
        modulos: [{ codigo: 'GESTAO_PESSOAS', role: 'RH_ADMIN', departamentos: [{}, {}] }],
      }),
    ).toEqual(['RH_ADMIN']);
  });

  it('sem `departamentos[]` e sem legado: nenhum papel', () => {
    expect(rolesDoModulo({ sub: 'u1', modulos: [{ codigo: 'GESTAO_PESSOAS' }] })).toEqual([]);
  });

  /**
   * ⚠️ A DIVERGÊNCIA QUE O DENORMALIZADO PRODUZ, escrita como teste: se algum
   * dia alguém "simplificar" a função para `mod.role`, esta linha cai.
   */
  it('o denormalizado NÃO é a resposta quando há mais de um papel', () => {
    const u = comDeptos('RH_MODELO', 'RH_CICLO');
    const denormalizado = u.modulos![0].role;
    expect(denormalizado).toBe('RH_MODELO');
    expect(rolesDoModulo(u)).toContain('RH_CICLO'); // ...e o denormalizado não diria isso
  });
});

describe('temPapel — a decisão, com o bypass do ADMIN', () => {
  it('um dos alvos basta', () => {
    expect(temPapel(['RH_CICLO'], ROLES.RH_ADMIN, ROLES.RH_CICLO)).toBe(true);
    expect(temPapel(['RH_MODELO'], ROLES.RH_ADMIN, ROLES.RH_CICLO)).toBe(false);
  });

  /**
   * ⚠️ ADMIN passa em tudo — e é por isso que **quem testa com ADMIN nunca vê
   * item de menu faltar**. O bypass é intencional (escape hatch de suporte,
   * espelha o `RolesGuard`), e o custo é de método: varredura feita com ADMIN
   * não mede RBAC.
   */
  it('ADMIN passa em qualquer alvo, inclusive num que não existe', () => {
    expect(temPapel(['ADMIN'], ROLES.RH_MODELO)).toBe(true);
    expect(temPapel(['ADMIN'], 'PAPEL_QUE_NAO_EXISTE')).toBe(true);
  });

  it('sem papel nenhum não passa em nada', () => {
    expect(temPapel([], ROLES.RH_ADMIN)).toBe(false);
    // ...e sem alvo nenhum também não: "tem()" sem argumento não é "pode tudo".
    expect(temPapel(['RH_ADMIN'])).toBe(false);
  });

  it('múltiplos papéis: passa pelo que serve', () => {
    expect(temPapel(['RH_MODELO', 'RH_CICLO'], ROLES.RH_CICLO)).toBe(true);
  });
});
