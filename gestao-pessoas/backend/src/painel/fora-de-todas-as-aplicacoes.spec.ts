/**
 * QUEM O CICLO NÃO ENXERGA.
 *
 * `semDesignacao` é calculado POR APLICAÇÃO: percorre o público de cada uma e
 * conta quem está lá sem avaliador. Por construção, ele não tem como enxergar
 * quem não pertence a aplicação nenhuma — essa pessoa não tem `Avaliacao`, não
 * tem status, não está em público algum e não entra em contagem alguma. Sai do
 * ciclo sem erro, que é exatamente o modo de falhar que este módulo existe para
 * eliminar.
 *
 * Enquanto o público vinha do recorte por centro de custo o buraco era o mesmo
 * — um CC fora de todas as aplicações simplesmente não aparecia. Com público
 * nominal a conta passou a ser possível, e ela é de nível de CICLO.
 */
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { PainelService } from './painel.service.js';

const CICLO = 'ciclo-1';

const PESSOAS = [
  { id: 'c1', matricula: '001', nome: 'ANA', filial: '01', centroCusto: '11010207', centroCustoDescricao: 'FINANCEIRO', situacao: 'ATIVO' },
  { id: 'c2', matricula: '002', nome: 'BRUNO', filial: '01', centroCusto: '11010207', centroCustoDescricao: 'FINANCEIRO', situacao: 'ATIVO' },
  { id: 'c3', matricula: '003', nome: 'CARLA', filial: '18', centroCusto: '41010145', centroCustoDescricao: 'RACAO SISTEMA DE ENSAQUE', situacao: 'ATIVO' },
  { id: 'c4', matricula: '004', nome: 'DINO', filial: '18', centroCusto: '41010145', centroCustoDescricao: 'RACAO SISTEMA DE ENSAQUE', situacao: 'AFASTADO' },
];

describe('PainelService — fora de todas as aplicações', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: PainelService;

  const montar = (opcoes: {
    noPublico: string[];
    excluidos?: string[];
    incluirAfastados?: boolean;
  }) => {
    prisma.ciclo.findUnique.mockResolvedValue({
      id: CICLO,
      nome: 'Piloto 2026',
      status: 'RASCUNHO',
      periodoInicio: new Date('2026-01-01'),
      periodoFim: new Date('2026-12-31'),
      dataBase: new Date('2026-09-15'),
      incluirAfastados: opcoes.incluirAfastados ?? false,
      aplicacoes: [],
    });
    prisma.colaborador.findMany.mockResolvedValue(PESSOAS);
    prisma.aplicacaoPublico.findMany.mockResolvedValue(
      opcoes.noPublico.map((colaboradorId) => ({ colaboradorId })),
    );
    prisma.cicloElegibilidade.findMany.mockResolvedValue(
      (opcoes.excluidos ?? []).map((colaboradorId) => ({ colaboradorId, decisao: 'EXCLUIR' })),
    );
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    // 3º argumento: o CicloService, de quem o RESUMO pede "o que falta para
    // abrir" — a mesma função que a abertura usa. Este spec é do painel cheio,
    // então basta existir.
    service = new PainelService(
      prisma as never,
      { listar: jest.fn().mockResolvedValue([]) } as never,
      { pendenciasParaAbrir: jest.fn().mockResolvedValue([]) } as never,
    );
  });

  it('⭐ quem não está no público de nenhuma aplicação aparece, com nome', async () => {
    montar({ noPublico: ['c1'] });
    const painel = await service.doCiclo(CICLO);

    expect(painel.foraDeTodasAsAplicacoes.total).toBe(2); // BRUNO e CARLA
    expect(painel.foraDeTodasAsAplicacoes.pessoas.map((p) => p.nome)).toEqual(['BRUNO', 'CARLA']);
    // Com o centro de custo junto: é por onde o RH resolve, montando a aplicação
    // que faltou em vez de caçar pessoa por pessoa.
    expect(painel.foraDeTodasAsAplicacoes.pessoas[1]).toMatchObject({
      centroCustoDescricao: 'RACAO SISTEMA DE ENSAQUE',
      filial: '18',
    });
  });

  it('ninguém fora quando todo mundo tem aplicação', async () => {
    montar({ noPublico: ['c1', 'c2', 'c3'] });
    const painel = await service.doCiclo(CICLO);
    expect(painel.foraDeTodasAsAplicacoes).toEqual({ total: 0, pessoas: [] });
  });

  it('⚠️ quem o RH EXCLUIU do ciclo não vira pendência eterna', async () => {
    // A exclusão é decisão registrada, com justificativa. Contá-la como
    // pendência transformaria uma decisão em cobrança que não sai da tela.
    montar({ noPublico: ['c1'], excluidos: ['c2'] });
    const painel = await service.doCiclo(CICLO);
    expect(painel.foraDeTodasAsAplicacoes.pessoas.map((p) => p.nome)).toEqual(['CARLA']);
  });

  it('afastado só entra na conta quando o ciclo o inclui', async () => {
    montar({ noPublico: ['c1', 'c2', 'c3'], incluirAfastados: false });
    await expect(service.doCiclo(CICLO)).resolves.toMatchObject({
      foraDeTodasAsAplicacoes: { total: 0 },
    });

    montar({ noPublico: ['c1', 'c2', 'c3'], incluirAfastados: true });
    const comAfastados = await service.doCiclo(CICLO);
    expect(comAfastados.foraDeTodasAsAplicacoes.pessoas.map((p) => p.nome)).toEqual(['DINO']);
  });

  it('a régua da elegibilidade é consultada com a política do CICLO, não a padrão', async () => {
    montar({ noPublico: [], incluirAfastados: true });
    const painel = await service.doCiclo(CICLO);
    // As 4 pessoas, o afastado incluído — se a régua rodasse com o padrão
    // (`incluirAfastados: false`), DINO sumiria da pendência sem ninguém pedir.
    expect(painel.foraDeTodasAsAplicacoes.total).toBe(4);
  });
});
