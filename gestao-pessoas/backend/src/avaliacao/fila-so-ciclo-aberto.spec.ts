/**
 * ⭐⭐ A FILA É O TRABALHO QUE DÁ PARA FAZER — só ciclo ABERTO entra.
 *
 * Achado de 10/09, e é defeito de regra permanente, não de tela: `minhasAvaliacoes`
 * filtrava por avaliador e por `not: CANCELADA`, e **por nada mais**. Nenhum
 * filtro de ciclo, nem no backend nem no `MinhasAvaliacoesPage` — que recebe
 * `ciclo.status` da API e nunca o lê.
 *
 * O efeito só apareceria no PRIMEIRO ENCERRAMENTO DE VERDADE: encerrado o
 * Piloto, as 53 pessoas continuariam vendo as 894 avaliações na fila, com os
 * cartões "A responder" clicáveis e `responder` recusando na hora (exige
 * ABERTO). Fila que não esvazia quando o trabalho acaba deixa de ser fila.
 *
 * ⚠️ E governa o TOTAL da barra: `ProgressoGeral` recebe `total={itens.length}`,
 * somando TODOS os ciclos da resposta. Era daí que saía o "13 de 26 enviadas"
 * da Arielly — SIMULACAO somado ao Piloto, um número que não é de ciclo nenhum.
 * Com o filtro, a barra fecha sozinha: a resposta só traz ciclo aberto.
 *
 * ⚠️ Por que `ABERTO` e não `not: ENCERRADO` — o buraco é SIMÉTRICO. Designar é
 * permitido em RASCUNHO (`assertCicloOperavel` só barra ENCERRADO), então um
 * ciclo ainda não aberto encheria a fila de quem também não pode responder. A
 * mesma condição fecha os dois lados, e é a que `responder` já exige.
 */
import { AvaliacaoService } from './avaliacao.service.js';
import { createPrismaMock } from '../common/testing/prisma-mock.js';

function servico() {
  const prisma = createPrismaMock();
  const service = new AvaliacaoService(
    prisma as never,
    { contextoDe: jest.fn() } as never,
    { registrar: jest.fn() } as never,
  );
  return { prisma, service };
}

async function whereDaFila(cicloId?: string) {
  const { prisma, service } = servico();
  await service.minhasAvaliacoes({ colaboradorId: 'c-avaliador' } as never, cicloId);
  return prisma.avaliacao.findMany.mock.calls[0][0].where;
}

describe('a fila do avaliador só mostra ciclo ABERTO', () => {
  it('a consulta filtra pelo status do ciclo', async () => {
    expect(await whereDaFila()).toEqual(
      expect.objectContaining({ ciclo: { status: 'ABERTO' } }),
    );
  });

  /**
   * O caso que motivou o conserto: depois do encerramento do Piloto, ninguém
   * pode continuar vendo as 894 na fila.
   */
  it('ENCERRADO não passa — é o caso do dia seguinte ao encerramento', async () => {
    const where = await whereDaFila();
    expect(where.ciclo).not.toEqual({ status: { not: 'ENCERRADO' } });
    expect(where.ciclo.status).toBe('ABERTO');
  });

  /**
   * ⚠️ RASCUNHO é a metade esquecida: designar é permitido antes de abrir, e
   * uma allowlist de "tudo menos encerrado" deixaria esse ciclo na fila.
   */
  it('RASCUNHO também não passa — designar é permitido antes de abrir', async () => {
    const where = await whereDaFila();
    expect(JSON.stringify(where)).not.toContain('RASCUNHO');
    expect(where.ciclo.status).toBe('ABERTO');
  });

  /**
   * O recorte por ciclo é do CLIENTE (a tela pede um ciclo). Ele estreita,
   * nunca amplia: pedir um ciclo encerrado pelo id não pode devolver nada.
   */
  it('o recorte por cicloId não substitui o filtro de status', async () => {
    const where = await whereDaFila('ciclo-encerrado');
    expect(where.cicloId).toBe('ciclo-encerrado');
    expect(where.ciclo).toEqual({ status: 'ABERTO' });
  });

  /** O filtro novo não pode ter comido o antigo. */
  it('e continua excluindo CANCELADA', async () => {
    expect((await whereDaFila()).status).toEqual({ not: 'CANCELADA' });
  });
});
