/**
 * O PÚBLICO DA APLICAÇÃO É NOMINAL.
 *
 * Antes, `listar()` derivava o público do recorte por centro de custo. Isso
 * deixava de fora três casos que existem de verdade na Capul — medidos no
 * cadastro em 06/09: a equipe de limpeza (46 pessoas em 19 pares filial × CC,
 * das quais só 14 no CC "LIMPEZA"), os 31 aprendizes (15 pares, todos
 * compartilhados com gente efetiva) e qualquer grupo funcional que não coincida
 * com a estrutura contábil.
 *
 * Agora a lista sai de `rh.aplicacao_publico`, uma linha por pessoa. Centro de
 * custo e filial continuam existindo, como ATALHO de preenchimento, e ficam
 * registrados em `origem` + `origemReferencia`.
 */
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { DesignacaoService } from './designacao.service.js';

const APLICACAO = 'app-aprendizes';
const CICLO = 'ciclo-1';

/** Três aprendizes em TRÊS centros de custo diferentes — nenhum CC os isola. */
const APRENDIZES = [
  { id: 'c1', matricula: '005001', nome: 'ANA', filial: '02', centroCusto: '21010101', situacao: 'ATIVO' },
  { id: 'c2', matricula: '005002', nome: 'BRUNO', filial: '01', centroCusto: '21010109', situacao: 'ATIVO' },
  { id: 'c3', matricula: '005003', nome: 'CARLA', filial: '18', centroCusto: '41010116', situacao: 'ATIVO' },
];

describe('DesignacaoService.listar — público nominal', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: DesignacaoService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new DesignacaoService(prisma as never, { registrar: jest.fn() } as never);
    prisma.aplicacao.findUnique.mockResolvedValue({

      id: APLICACAO,
      cicloId: CICLO,
      // ⚠️ `status` entra aqui porque `designar` passou a checar se o ciclo
      // ainda aceita escrita (encerrado recusa designação).
      ciclo: { id: CICLO, incluirAfastados: false, status: 'ABERTO', encerradoEm: null },
    });
  });

  const publicoCom = (colaboradores: typeof APRENDIZES) => {
    prisma.aplicacaoPublico.findMany.mockResolvedValue(
      colaboradores.map((c) => ({ colaboradorId: c.id })),
    );
    prisma.colaborador.findMany.mockResolvedValue(colaboradores);
  };

  it('⭐ traz pessoas de centros de custo DIFERENTES — o caso dos aprendizes', async () => {
    publicoCom(APRENDIZES);
    const linhas = await service.listar(APLICACAO);

    expect(linhas.map((l) => l.nome)).toEqual(['ANA', 'BRUNO', 'CARLA']);
    // Três CCs, três filiais: nenhum recorte por centro de custo produziria
    // esta lista sem arrastar junto os colegas efetivos de cada um deles.
    expect(new Set(linhas.map((l) => l.centroCusto)).size).toBe(3);
  });

  it('a consulta é por ID de pessoa, não por centro de custo', async () => {
    publicoCom(APRENDIZES);
    await service.listar(APLICACAO);

    expect(prisma.colaborador.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['c1', 'c2', 'c3'] } }),
      }),
    );
    const [[chamada]] = prisma.colaborador.findMany.mock.calls;
    expect(chamada.where).not.toHaveProperty('centroCusto');
  });

  it('⭐ público vazio devolve lista VAZIA — não "todo mundo"', async () => {
    // Antes: `centros.length ? {...} : {}` caía num where sem filtro e trazia as
    // 1.036 pessoas. "Ainda não configurei" e "a empresa inteira" eram o mesmo
    // estado, e a diferença só aparecia depois de designar.
    publicoCom([]);
    await expect(service.listar(APLICACAO)).resolves.toEqual([]);
    expect(prisma.colaborador.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: [] } }) }),
    );
  });

  it('não lê mais aplicacao_centro_custo para montar a lista', async () => {
    publicoCom(APRENDIZES);
    await service.listar(APLICACAO);
    expect(prisma.aplicacaoCentroCusto.findMany).not.toHaveBeenCalled();
  });
});
