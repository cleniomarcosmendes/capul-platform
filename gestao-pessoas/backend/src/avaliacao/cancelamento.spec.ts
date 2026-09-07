import { efeitoDoExcluir, STATUS_VIVOS } from './cancelamento.js';

describe('o efeito de excluir alguém do ciclo', () => {
  it('sem avaliação: não há o que cancelar, e o Excluir segue', () => {
    expect(efeitoDoExcluir(null)).toEqual({ acao: 'NADA_A_FAZER', frase: null });
  });

  it('avaliação já cancelada: idem — excluir de novo não é erro', () => {
    expect(efeitoDoExcluir({ status: 'CANCELADA', respostas: 3 }).acao).toBe('NADA_A_FAZER');
  });

  it.each(STATUS_VIVOS)('%s: cancela', (status) => {
    expect(efeitoDoExcluir({ status, respostas: 0 }).acao).toBe('CANCELAR');
  });

  /**
   * ⭐ O ponto 3 do pedido de 08/09: a confirmação diz o EFEITO REAL, com o
   * nome de quem está com ela e o número de respostas — não "tem certeza?".
   */
  it('a frase traz o NOME de quem está com ela e o NÚMERO de respostas', () => {
    const f = efeitoDoExcluir({ status: 'EM_ANDAMENTO', respostas: 12, avaliadorNome: 'ADAO BATISTA' }).frase!;
    expect(f).toContain('ADAO BATISTA');
    expect(f).toContain('12');
    expect(f).toMatch(/ficam registradas/);
    expect(f).toMatch(/não entram na apuração/);
  });

  it('sem resposta nenhuma, a frase não inventa "as 0 respostas"', () => {
    const f = efeitoDoExcluir({ status: 'PENDENTE', respostas: 0, avaliadorNome: 'MARIA' }).frase!;
    expect(f).toMatch(/ainda não foi começada/);
    expect(f).not.toContain('0 resposta');
  });

  it('sem o nome do avaliador, a frase continua legível', () => {
    expect(efeitoDoExcluir({ status: 'PENDENTE', respostas: 0 }).frase).toContain(
      'o avaliador designado',
    );
  });

  /**
   * ⭐⭐ ENVIADA NÃO SE CANCELA — e a recusa ensina a ORDEM, como a do ciclo
   * encerrado. Cancelar uma enviada deixaria `ResultadoAvaliacao` órfão de
   * avaliação viva: uma segunda verdade sobre a mesma pessoa.
   */
  describe('avaliação já ENVIADA', () => {
    const enviada = { status: 'ENVIADA', respostas: 15, avaliadorNome: 'CLAUDIMAR' };

    it('recusa em vez de cancelar', () => {
      expect(efeitoDoExcluir(enviada).acao).toBe('RECUSAR');
    });

    it('e a recusa diz a ordem e por que ela importa', () => {
      const f = efeitoDoExcluir(enviada).frase!;
      expect(f).toMatch(/reabra a avaliação primeiro/i);
      expect(f).toMatch(/RH_ADMIN/);
      expect(f).toMatch(/órfão/);
    });
  });
});

/**
 * ⭐⭐ O FURO DENTRO DO FURO — e por que este teste é de FILA, não de função.
 *
 * `filaPorAvaliador` (painel do RH) já excluía CANCELADA desde sempre;
 * `minhasAvaliacoes` (a tela do avaliador) não filtrava status nenhum. Sem o
 * filtro nos dois lados, o cancelamento daria ao RH uma fila limpa enquanto o
 * avaliador continuaria com a avaliação na mão — o beco de 08/09 em outra
 * fantasia. Aqui a garantia é sobre a CONSULTA que a fila monta.
 */
import { AvaliacaoService } from './avaliacao.service.js';
import { createPrismaMock } from '../common/testing/prisma-mock.js';

describe('a fila do avaliador não mostra avaliação cancelada', () => {
  it('minhasAvaliacoes exclui CANCELADA na própria consulta', async () => {
    const prisma = createPrismaMock();
    const service = new AvaliacaoService(
      prisma as never,
      { contextoDe: jest.fn() } as never,
      { registrar: jest.fn() } as never,
    );
    await service.minhasAvaliacoes({ colaboradorId: 'c-avaliador' } as never);
    expect(prisma.avaliacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: 'CANCELADA' } }),
      }),
    );
  });

  /** ENVIADA CONTINUA aparecendo: é o histórico do que a pessoa já fez neste
   *  ciclo. O que a fila não pode mostrar é o que foi tirado da conta. */
  it('e não vira uma lista só de status vivos — ENVIADA fica', async () => {
    const prisma = createPrismaMock();
    const service = new AvaliacaoService(
      prisma as never,
      { contextoDe: jest.fn() } as never,
      { registrar: jest.fn() } as never,
    );
    await service.minhasAvaliacoes({ colaboradorId: 'c-avaliador' } as never);
    const where = prisma.avaliacao.findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ not: 'CANCELADA' });
    expect(JSON.stringify(where)).not.toContain('ENVIADA');
  });
});
