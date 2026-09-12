/**
 * ⭐⭐ A FILA É O TRABALHO QUE DÁ PARA FAZER.
 *
 * ⚠️ **A REGRA MUDOU EM 13/09, e o princípio não.** Eram só os ciclos ABERTOS;
 * agora é `ciclo ABERTO` **OU** `devolutiva liberada`. O motivo é o mesmo de
 * sempre — conduzir uma devolutiva liberada **É** trabalho que dá para fazer —
 * e o percurso real é que denunciou: a fila do avaliador voltou **VAZIA** com
 * uma devolutiva esperando por ele, porque a devolutiva acontece justamente
 * **com o ciclo ENCERRADO** (o RH encerra, apura, confere e libera).
 *
 * ⭐ Tudo o que este teste protegia continua protegido, e a lista de casos é a
 * prova: ENCERRADO **sem** devolutiva continua fora, RASCUNHO continua fora, e
 * o recorte por `cicloId` continua sem substituir o filtro.
 *
 * ── O texto original, que explica cada guarda ────────────────────────────────
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

/** O ramo do OR que fala de ciclo, e o que fala de devolutiva. */
async function ramos() {
  const where = await whereDaFila();
  const or = where.OR as { ciclo?: { status: string }; devolutivaLiberadaEm?: unknown }[];
  return {
    where,
    or,
    porCiclo: or.find((r) => r.ciclo),
    porDevolutiva: or.find((r) => r.devolutivaLiberadaEm),
  };
}

describe('a fila do avaliador: ciclo ABERTO OU devolutiva liberada', () => {
  it('a consulta tem exatamente os dois ramos, e nada mais', async () => {
    const { or, porCiclo, porDevolutiva } = await ramos();
    expect(or).toHaveLength(2);
    expect(porCiclo).toEqual({ ciclo: { status: 'ABERTO' } });
    expect(porDevolutiva).toEqual({ devolutivaLiberadaEm: { not: null } });
  });

  it('⭐ ENCERRADO COM devolutiva liberada PASSA — é o caso que motivou a mudança', async () => {
    // Sem este ramo a tela da devolutiva fica sem caminho: rota que existe e
    // ninguém alcança é rota que não existe.
    const { porDevolutiva } = await ramos();
    expect(porDevolutiva).toBeDefined();
    expect(porDevolutiva).not.toHaveProperty('ciclo');
  });

  /**
   * O caso que motivou o conserto: depois do encerramento do Piloto, ninguém
   * pode continuar vendo as 894 na fila.
   */
  it('ENCERRADO SEM devolutiva continua fora — o dia seguinte ao encerramento', async () => {
    const { porCiclo } = await ramos();
    expect(porCiclo?.ciclo).not.toEqual({ status: { not: 'ENCERRADO' } });
    expect(porCiclo?.ciclo?.status).toBe('ABERTO');
  });

  /**
   * ⚠️ RASCUNHO é a metade esquecida: designar é permitido antes de abrir, e
   * uma allowlist de "tudo menos encerrado" deixaria esse ciclo na fila.
   */
  it('RASCUNHO também não passa — designar é permitido antes de abrir', async () => {
    const { where, porCiclo } = await ramos();
    expect(JSON.stringify(where)).not.toContain('RASCUNHO');
    expect(porCiclo?.ciclo?.status).toBe('ABERTO');
  });

  /**
   * O recorte por ciclo é do CLIENTE (a tela pede um ciclo). Ele estreita,
   * nunca amplia: pedir um ciclo encerrado pelo id não pode devolver nada.
   */
  it('o recorte por cicloId não substitui os dois ramos', async () => {
    const where = await whereDaFila('ciclo-encerrado');
    expect(where.cicloId).toBe('ciclo-encerrado');
    expect(where.OR).toHaveLength(2);
    // ⚠️ Estreita, nunca amplia: o `cicloId` entra em AND com o OR, então pedir
    //    um ciclo encerrado sem devolutiva continua devolvendo nada.
    expect(where.OR[0]).toEqual({ ciclo: { status: 'ABERTO' } });
  });

  /** O filtro novo não pode ter comido o antigo. */
  it('e continua excluindo CANCELADA', async () => {
    expect((await whereDaFila()).status).toEqual({ not: 'CANCELADA' });
  });
});
