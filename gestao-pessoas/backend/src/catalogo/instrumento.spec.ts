/**
 * ⭐ LER O INSTRUMENTO — a peça que destrava a decisão do RH sobre o questionário.
 *
 * Até 11/09 o texto das 44 perguntas não tinha caminho nenhum: `GET
 * /catalogo/modelos` devolve `perguntas: 11`, uma CONTAGEM, e o enunciado só
 * existia em `prisma/seed.ts`. A gestora não tinha como responder *"este
 * questionário é o que você quer usar?"* — a pergunta que trava a ordem de todo
 * o resto do módulo.
 *
 * O que este spec guarda não é a forma do JSON: são as três contas que a tela
 * mostra e que alguém pode quebrar sem perceber.
 */
import { CatalogoService } from './catalogo.service.js';
import { createPrismaMock } from '../common/testing/prisma-mock.js';

/**
 * Um arranjo de duas questões em duas classificações, com pesos desiguais de
 * propósito.
 *
 * ⭐ Depois do acervo (migration 20260911230000) o peso NÃO está na questão:
 * está em `arranjo_grupo`, por classificação, e o peso da questão é derivado.
 * Aqui cada classificação tem uma questão só, então o derivado é o peso inteiro
 * do grupo — foi assim que os números deste spec continuaram valendo.
 */
function versaoFake(over: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    modeloId: 'm1',
    versao: 1,
    publicadoEm: new Date('2026-09-05'),
    pontuacaoMaxima: 18,
    modelo: { nome: 'Administrativo', descricao: null, finalidade: 'PRODUCAO', ativo: true },
    _count: { aplicacoes: 2 },
    grupos: [
      { classificacaoId: 'c1', peso: 10, ordem: 0, classificacao: { id: 'c1', nome: 'Assiduidade' } },
      { classificacaoId: 'c2', peso: 30, ordem: 1, classificacao: { id: 'c2', nome: 'Conduta' } },
    ],
    perguntas: [
      {
        perguntaId: 'p1',
        ordem: 0,
        pergunta: {
          id: 'p1',
          codigo: '004',
          enunciado: 'Assiduidade',
          classificacaoId: 'c1',
          classificacao: { id: 'c1', nome: 'Assiduidade' },
          alternativas: [
            { id: 'a1', descricao: 'Falta muito', valor: 0.3, ordem: 0, codigoOrigem: '1' },
            { id: 'a2', descricao: 'Nunca falta', valor: 1.2, ordem: 1, codigoOrigem: '4' },
          ],
        },
      },
      {
        perguntaId: 'p2',
        ordem: 1,
        pergunta: {
          id: 'p2',
          codigo: '007',
          enunciado: 'Respeito',
          classificacaoId: 'c2',
          classificacao: { id: 'c2', nome: 'Conduta' },
          alternativas: [
            { id: 'a3', descricao: 'Não respeita', valor: 0.3, ordem: 0, codigoOrigem: '1' },
            { id: 'a4', descricao: 'Respeita', valor: 0.9, ordem: 1, codigoOrigem: '3' },
          ],
        },
      },
    ],
    ...over,
  };
}

function servico(versao: unknown) {
  const prisma = createPrismaMock();
  prisma.modeloVersao.findUnique.mockResolvedValue(versao);
  prisma.modelo.findUniqueOrThrow.mockResolvedValue({
    id: 'm1',
    nome: 'Administrativo',
    descricao: null,
    finalidade: 'PRODUCAO',
    ativo: true,
  });
  return new CatalogoService(prisma as never);
}

describe('ler o instrumento inteiro', () => {
  it('devolve grupos, perguntas e alternativas — não uma contagem', async () => {
    const i = await servico(versaoFake()).instrumento('v1');
    expect(i.totalGrupos).toBe(2);
    expect(i.totalPerguntas).toBe(2);
    expect(i.totalAlternativas).toBe(4);
    expect(i.grupos[0].perguntas[0].enunciado).toBe('Assiduidade');
    expect(i.grupos[0].perguntas[0].alternativas[1].descricao).toBe('Nunca falta');
  });

  /**
   * ⭐⭐ AS DUAS PONTUAÇÕES MÁXIMAS, lado a lado. A gravada saiu da publicação;
   * a calculada sai agora, pela mesma `pontuacaoMaxima()` que a publicação usa.
   * Iguais, é conferência. Diferentes, alguém mexeu no banco por fora e a nota
   * de todo mundo está saindo sobre um denominador que não é o do instrumento.
   */
  it('traz a pontuação máxima GRAVADA e a RECALCULADA', async () => {
    const i = await servico(versaoFake()).instrumento('v1');
    // 10 × 1,2 + 30 × 0,9 = 12 + 27 = 39
    expect(i.pontuacaoMaximaCalculada).toBeCloseTo(39, 4);
    expect(i.pontuacaoMaximaGravada).toBe(18);
  });

  it('e a divergência entre elas é VISÍVEL, não silenciada', async () => {
    const i = await servico(versaoFake()).instrumento('v1');
    expect(i.pontuacaoMaximaCalculada).not.toBe(i.pontuacaoMaximaGravada);
    // as duas chegam à tela; nenhuma sobrescreve a outra
    expect(i).toHaveProperty('pontuacaoMaximaGravada');
    expect(i).toHaveProperty('pontuacaoMaximaCalculada');
  });

  /**
   * ⭐ Depois do acervo isto é o peso DECLARADO da classificação no arranjo —
   * não mais a soma das perguntas. Os dois coincidem por construção (a soma dos
   * derivados fecha exata), mas quem manda passou a ser o declarado: é ele que
   * o RH digita, e é ele que sobrevive a acrescentar ou tirar uma questão.
   */
  it('o balanço por grupo é o peso declarado da classificação, e fecha em 100%', async () => {
    const i = await servico(versaoFake()).instrumento('v1');
    expect(i.grupos[0].pesoTotal).toBe(10);
    expect(i.grupos[1].pesoTotal).toBe(30);
    expect(i.somaDosPesos).toBe(40);
    expect(i.grupos.reduce((s, g) => s + g.percentual, 0)).toBeCloseTo(100, 6);
    expect(i.grupos[1].percentual).toBeCloseTo(75, 6);
  });

  it('o percentual por PERGUNTA também fecha em 100%', async () => {
    const i = await servico(versaoFake()).instrumento('v1');
    const soma = i.grupos.flatMap((g) => g.perguntas).reduce((s, p) => s + p.percentualDoPeso, 0);
    expect(soma).toBeCloseTo(100, 6);
  });

  /** É a alternativa de maior valor que define quanto a pergunta vale. */
  it('marca a alternativa de maior valor, e só ela', async () => {
    const i = await servico(versaoFake()).instrumento('v1');
    const alts = i.grupos[0].perguntas[0].alternativas;
    expect(alts.filter((a) => a.maiorValor)).toHaveLength(1);
    expect(alts.find((a) => a.maiorValor)!.valor).toBe(1.2);
    expect(i.grupos[0].perguntas[0].pontuacaoMaxima).toBeCloseTo(12, 4);
  });

  /** Quem lê precisa saber se a versão está em uso antes de propor mudança. */
  it('diz quantas aplicações usam a versão', async () => {
    expect((await servico(versaoFake()).instrumento('v1')).aplicacoesQueUsam).toBe(2);
  });

  it('versão inexistente recusa, em vez de devolver instrumento vazio', async () => {
    await expect(servico(null).instrumento('nao-existe')).rejects.toThrow(/não encontrada/i);
  });

  /** Modelo sem pergunta nenhuma não pode estourar a divisão por zero. */
  it('modelo vazio devolve zeros, sem dividir por zero', async () => {
    const i = await servico(versaoFake({ grupos: [], perguntas: [] })).instrumento('v1');
    expect(i.totalPerguntas).toBe(0);
    expect(i.somaDosPesos).toBe(0);
    expect(i.pontuacaoMaximaCalculada).toBe(0);
  });
});
