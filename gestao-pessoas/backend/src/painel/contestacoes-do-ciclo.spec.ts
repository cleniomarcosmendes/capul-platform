/**
 * ⭐ A LEITURA do sinal #5 do piloto. O recurso de 09/09 grava; sem esta tela o
 * dado ficaria em `rh.auditoria`, legível só por quem sabe escrever SQL — e a
 * gestora, que é quem revisa o cadastro, não sabe.
 */
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { PainelService } from './painel.service.js';
import { ACAO_FALTA_GENTE, ACAO_NAO_E_MINHA_EQUIPE } from '../avaliacao/contestacao.js';

const CICLO = 'ciclo-1';

function apontamento(avaliacaoId: string, nome: string, motivo: string) {
  return {
    entidadeId: avaliacaoId,
    justificativa: motivo,
    criadoEm: new Date('2026-09-16T10:00:00Z'),
    valorNovo: { avaliadoNome: nome, avaliadoMatricula: '004321', centroCusto: '21010101', cicloId: CICLO },
  };
}

describe('o que os avaliadores disseram sobre a própria equipe', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: PainelService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new PainelService(prisma as never, {} as never, {} as never, {} as never);

    prisma.auditoria.findMany.mockImplementation(({ where }: never) => {
      const w = where as { acao: string };
      if (w.acao === ACAO_NAO_E_MINHA_EQUIPE) {
        return Promise.resolve([
          apontamento('av-1', 'JOANA', 'Saiu do meu setor.'),
          apontamento('av-2', 'PEDRO', 'Nunca foi meu.'),
          apontamento('av-3', 'LUCIA', 'É do CD.'),
        ]);
      }
      return Promise.resolve([
        {
          entidadeId: CICLO,
          justificativa: 'Falta o TIAGO (004050).',
          criadoEm: new Date('2026-09-17T09:00:00Z'),
          valorNovo: { avaliadorId: 'chefe-2', avaliacoesNaFila: 23 },
        },
      ]);
    });
    prisma.avaliacao.findMany.mockResolvedValue([
      { id: 'av-1', avaliadorId: 'chefe-1' },
      { id: 'av-2', avaliadorId: 'chefe-1' },
      { id: 'av-3', avaliadorId: 'chefe-2' },
    ]);
    prisma.colaborador.findMany.mockResolvedValue([
      { id: 'chefe-1', nome: 'WASHINGTON DONATO', matricula: '003268' },
      { id: 'chefe-2', nome: 'IRENE ALVES', matricula: '003982' },
    ]);
  });

  it('agrupa por AVALIADOR, e quem tem mais a dizer vem primeiro', async () => {
    const r = await service.contestacoesDoCiclo(CICLO);
    expect(r.porAvaliador.map((a) => [a.avaliadorNome, a.apontamentos.length])).toEqual([
      ['WASHINGTON DONATO', 2],
      ['IRENE ALVES', 1],
    ]);
  });

  it('cada apontamento traz QUEM foi apontado e o motivo ESCRITO — é o que se lê para decidir', async () => {
    const r = await service.contestacoesDoCiclo(CICLO);
    expect(r.porAvaliador[0].apontamentos[0]).toMatchObject({
      avaliadoNome: 'JOANA',
      avaliadoMatricula: '004321',
      motivo: 'Saiu do meu setor.',
    });
  });

  /**
   * ⚠️ Os dois números SEPARADOS. "Sobra gente na fila" e "falta gente na fila"
   * são reclamações de naturezas opostas, e um total único esconderia qual das
   * duas o cadastro está produzindo — que é justamente a pergunta.
   */
  it('conta as duas causas em separado, e não soma uma na outra', async () => {
    const r = await service.contestacoesDoCiclo(CICLO);
    expect(r.totalApontamentos).toBe(3);
    expect(r.totalFaltaGente).toBe(1);
    expect(r.faltaGente[0]).toMatchObject({
      avaliadorNome: 'IRENE ALVES',
      texto: 'Falta o TIAGO (004050).',
      avaliacoesNaFila: 23,
    });
  });

  it('avaliador que sumiu do cadastro não derruba a tela — a linha diz que não achou', async () => {
    prisma.colaborador.findMany.mockResolvedValue([]);
    const r = await service.contestacoesDoCiclo(CICLO);
    expect(r.porAvaliador[0].avaliadorNome).toMatch(/não encontrado/);
    expect(r.totalApontamentos).toBe(3);
  });
});
