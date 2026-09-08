/**
 * ⭐⭐ INVARIANTE — O DENOMINADOR DO CICLO É UM SÓ.
 *
 * Achado do ciclo de simulação (09/09): três telas, três números para a mesma
 * pergunta. Cabeçalho e card diziam `0 de 52`; o cartão da aplicação separava
 * "29 não iniciadas / 2 canceladas"; a prévia da abertura dizia `50`.
 *
 * Este arquivo cobra que as TRÊS respostas saiam da mesma regra — e o teste é
 * sobre a igualdade entre elas, não sobre o valor: se amanhã a regra mudar, os
 * três mudam juntos ou a suíte quebra.
 */
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { PainelService } from '../painel/painel.service.js';
import { avaliacaoConta, somarQueContam } from './avaliacoes-que-contam.js';

const CICLO = 'ciclo-1';
const APP = 'app-1';

describe('a regra, isolada', () => {
  it('cancelada não conta; todo o resto conta', () => {
    expect(avaliacaoConta('CANCELADA')).toBe(false);
    for (const s of ['PENDENTE', 'EM_ANDAMENTO', 'ENVIADA']) expect(avaliacaoConta(s)).toBe(true);
  });

  /** ⚠️ `not: CANCELADA` e não allowlist: status novo entra na conta por padrão. */
  it('⚠️ um status NOVO conta por padrão — allowlist o deixaria de fora calado', () => {
    expect(avaliacaoConta('REABERTA_PARA_REVISAO')).toBe(true);
  });

  it('soma só as que contam', () => {
    expect(
      somarQueContam([
        { status: 'PENDENTE', _count: { _all: 29 } },
        { status: 'ENVIADA', _count: { _all: 21 } },
        { status: 'CANCELADA', _count: { _all: 2 } },
      ]),
    ).toBe(50);
  });
});

describe('invariante: os três lugares dizem o mesmo número', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: PainelService;

  /** O estado do SIMULACAO 09/09 quando o defeito apareceu: 52 linhas, 2 canceladas. */
  const PORSTATUS = [
    { status: 'PENDENTE', aplicacaoId: APP, _count: { _all: 50 } },
    { status: 'CANCELADA', aplicacaoId: APP, _count: { _all: 2 } },
  ];

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new PainelService(
      prisma as never,
      { listar: jest.fn().mockResolvedValue([]) } as never,
      {
        pendenciasParaAbrir: jest.fn().mockResolvedValue([]),
        historicoDeReabertura: jest.fn().mockResolvedValue({ reaberturas: 0, ultimaReabertura: null }),
      } as never,
      { acessoDeAvaliadores: jest.fn().mockResolvedValue(new Map()) } as never,
    );
    prisma.ciclo.findUnique.mockResolvedValue({
      id: CICLO, status: 'RASCUNHO', aplicacoes: [{ id: APP, nome: 'A' }],
    });
    prisma.avaliacao.groupBy.mockResolvedValue(PORSTATUS);
    // A prévia da abertura conta por `count`, já com o filtro no `where`.
    prisma.avaliacao.count.mockResolvedValue(50);
    prisma.aplicacaoPublico.count.mockResolvedValue(54);
    prisma.aplicacaoPublico.groupBy.mockResolvedValue([]);
    prisma.resultadoAvaliacao.count.mockResolvedValue(0);
    prisma.colaborador.findMany.mockResolvedValue([]);
  });

  it('⭐ resumo do ciclo e prévia da abertura concordam — e é 50, não 52', async () => {
    const resumo = await service.resumoDoCiclo(CICLO);
    const previa = await service.previaDaAbertura(CICLO);

    expect(resumo.designados).toBe(50);
    expect(previa.designados).toBe(50);
    expect(resumo.designados).toBe(previa.designados);
  });

  it('⚠️ o painel por aplicação usa a mesma conta que o cabeçalho', async () => {
    prisma.avaliacao.groupBy.mockImplementation(({ by }: { by: string[] }) =>
      Promise.resolve(by.includes('avaliadoId') ? [] : PORSTATUS),
    );
    const painel = await service.doCiclo(CICLO);
    const resumo = await service.resumoDoCiclo(CICLO);

    expect(painel.aplicacoes[0].designados).toBe(50);
    expect(painel.aplicacoes[0].canceladas).toBe(2);
    expect(painel.designados).toBe(resumo.designados);
  });
});
