import { buildModulosResponse } from './build-modulos-response';
import { buildModulosPayload } from './build-modulos-payload';

/* eslint-disable @typescript-eslint/no-explicit-any */

function prismaCom(permissoes: unknown[]) {
  return {
    permissaoModulo: { findMany: jest.fn().mockResolvedValue(permissoes) },
    departamentoFuncionalidade: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

/**
 * ⭐ Módulo INATIVO não vira card no Hub.
 *
 * O `docker-compose.yml` afirmava desde sempre que "o módulo nasce INATIVO em
 * core.modulos_sistema, então não aparece como card no Hub" — e o código não
 * fazia isso: `status` era coluna decorativa. Em 05/09/2026 a Gestão de Pessoas
 * apareceu no Hub com cinco das sete telas por construir.
 *
 * O filtro vive no `where` de uma consulta, então o que dá para afirmar aqui é
 * que ele CONTINUA no `where` — que é justamente o que uma refatoração distraída
 * apagaria sem ninguém perceber, porque o sintoma é card a mais, não erro.
 */
describe('buildModulosResponse — o Hub só anuncia módulo ATIVO', () => {
  it('a consulta exige modulo.status = ATIVO', async () => {
    const prisma = prismaCom([]);
    await buildModulosResponse(prisma, 'u1');

    const where = prisma.permissaoModulo.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      usuarioId: 'u1',
      status: 'ATIVO',
      modulo: { status: 'ATIVO' },
    });
  });

  /**
   * ⚠️ O JWT é o oposto de propósito: INATIVO é "não anunciar", não é kill
   * switch. Quem sabe a URL — nós, testando um módulo em construção — continua
   * com a API aberta, e desligar o acesso de alguém segue sendo ato de revogar a
   * PERMISSÃO, que é por pessoa. Se um dia alguém "uniformizar" os dois helpers,
   * é aqui que a decisão está escrita.
   */
  it('o payload do JWT NÃO filtra por status do módulo', async () => {
    const prisma = prismaCom([]);
    await buildModulosPayload(prisma, 'u1');

    const where = prisma.permissaoModulo.findMany.mock.calls[0][0].where;
    expect(where.modulo).toBeUndefined();
  });
});
