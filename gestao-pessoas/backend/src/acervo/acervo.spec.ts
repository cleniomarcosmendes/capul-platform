import { AcervoService } from './acervo.service.js';
import { createPrismaMock } from '../common/testing/prisma-mock.js';

/**
 * ⭐ O que este spec guarda não é a forma do JSON — são as duas contas que dão
 * sentido à lista: o PESO EFETIVO por perfil (que é derivado, não lido) e o
 * "fora de todo perfil", que é informação e não ausência.
 */
function servico(over: {
  questoes?: unknown[];
  classificacoes?: unknown[];
  arranjos?: unknown[];
} = {}) {
  const prisma = createPrismaMock();
  prisma.pergunta.findMany.mockResolvedValue(over.questoes ?? []);
  prisma.classificacao.findMany.mockResolvedValue(over.classificacoes ?? []);
  prisma.arranjoGrupo.findMany.mockResolvedValue(over.arranjos ?? []);
  return new AcervoService(prisma as never);
}

const CLASSIF = { id: 'c1', nome: 'Assiduidade', ordem: 0, ativa: true };

function questao(over: Record<string, unknown> = {}) {
  return {
    id: 'q1',
    codigo: '004',
    enunciado: 'Assiduidade',
    ativa: true,
    classificacaoId: 'c1',
    classificacao: CLASSIF,
    alternativas: [
      { id: 'a1', descricao: 'Falta muito', valor: 0.3, ordem: 0 },
      { id: 'a2', descricao: 'Nunca falta', valor: 1.2, ordem: 1 },
    ],
    arranjos: [],
    /** ⚠️ O bloqueio vem com a lista desde 12/09 — a contagem é parte do dado. */
    _count: { respostas: 0 },
    ...over,
  };
}

/**
 * ⚠️ `ordem` não é enfeite: é ela que decide QUEM recebe o centavo do resto
 * quando o peso do grupo não divide exato. Fixture sem ordem esconde o caso.
 */
const usoEm = (versaoId: string, nome: string, publicado = true, ordem = 0) => ({
  modeloVersaoId: versaoId,
  ordem,
  modeloVersao: { versao: 1, publicadoEm: publicado ? new Date() : null, modelo: { nome } },
});

describe('acervo — a lista das questões que existem', () => {
  it('devolve a questão com classificação, alternativas e o maior valor', async () => {
    const a = await servico({ questoes: [questao()], classificacoes: [CLASSIF] }).listar();
    expect(a.totalQuestoes).toBe(1);
    expect(a.questoes[0].classificacaoNome).toBe('Assiduidade');
    expect(a.questoes[0].maiorValor).toBe(1.2);
    expect(a.questoes[0].alternativas).toHaveLength(2);
  });

  it('conta as questões por classificação', async () => {
    const a = await servico({
      questoes: [questao(), questao({ id: 'q2', codigo: '005' })],
      classificacoes: [CLASSIF],
    }).listar();
    expect(a.classificacoes[0].questoes).toBe(2);
  });
});

describe('⭐⭐ o PESO EFETIVO por perfil — derivado, nunca o do grupo', () => {
  /**
   * A questão leva o peso do GRUPO dividido pelas questões daquela
   * classificação NAQUELE perfil. Mostrar o do grupo diria que "Assiduidade"
   * vale 12 quando ela vale 6 — e é o número que quem edita compara entre
   * perfis.
   */
  it('divide o peso do grupo pelas questões daquela classificação no perfil', async () => {
    const a = await servico({
      questoes: [
        questao({ arranjos: [usoEm('v1', 'Administrativo')] }),
        questao({ id: 'q2', codigo: '005', arranjos: [usoEm('v1', 'Administrativo')] }),
      ],
      classificacoes: [CLASSIF],
      arranjos: [{ modeloVersaoId: 'v1', classificacaoId: 'c1', peso: 12 }],
    }).listar();
    // 12 do grupo ÷ 2 questões = 6 para cada
    expect(a.questoes[0].usos[0].peso).toBe(6);
    expect(a.questoes[1].usos[0].peso).toBe(6);
  });

  it('a MESMA questão pesa diferente em cada perfil — é o ponto do acervo', async () => {
    const a = await servico({
      questoes: [questao({ arranjos: [usoEm('v1', 'Administrativo'), usoEm('v2', 'Loja')] })],
      classificacoes: [CLASSIF],
      arranjos: [
        { modeloVersaoId: 'v1', classificacaoId: 'c1', peso: 12 },
        { modeloVersaoId: 'v2', classificacaoId: 'c1', peso: 9 },
      ],
    }).listar();
    const pesos = Object.fromEntries(a.questoes[0].usos.map((u) => [u.modeloNome, u.peso]));
    expect(pesos).toEqual({ Administrativo: 12, Loja: 9 });
  });

  /**
   * ⭐⭐ REGRESSÃO — 12/09. A primeira versão dividia aqui mesmo
   * (`peso ÷ n`, arredondado) e a conta não fechava: 16 ÷ 3 saía 5,33 × 3 =
   * 15,99, e o Administrativo somava **59,97** em vez de 60. Os testes acima
   * não pegaram porque todos os pesos dividiam exato — o furo mora justamente
   * onde SOBRA. A regra de repartição é uma só (`pesosDerivados`), a mesma que
   * calcula a nota; duas telas dando pesos diferentes para a mesma questão é
   * pior que não ter a tela.
   */
  it('peso que NÃO divide exato: o centavo do resto vai para a primeira, e a soma fecha', async () => {
    const a = await servico({
      questoes: [
        questao({ arranjos: [usoEm('v1', 'Administrativo', true, 0)] }),
        questao({ id: 'q2', codigo: '005', arranjos: [usoEm('v1', 'Administrativo', true, 1)] }),
        questao({ id: 'q3', codigo: '006', arranjos: [usoEm('v1', 'Administrativo', true, 2)] }),
      ],
      classificacoes: [CLASSIF],
      arranjos: [{ modeloVersaoId: 'v1', classificacaoId: 'c1', peso: 16 }],
    }).listar();
    const pesos = a.questoes.map((q) => q.usos[0].peso);
    expect(pesos).toEqual([5.34, 5.33, 5.33]);
    expect(pesos.reduce<number>((s, p) => s + (p ?? 0), 0)).toBeCloseTo(16, 10);
  });

  /**
   * ⚠️ Arranjo pela metade não pode apagar a tela inteira — e também não pode
   * dizer "peso 0", que leria como "não conta". O rascunho da Etapa 3 passa
   * por aqui enquanto está sendo montado.
   */
  it('classificação sem peso no arranjo: devolve null, não zero, e não derruba a lista', async () => {
    const a = await servico({
      questoes: [questao({ arranjos: [usoEm('v1', 'Rascunho em montagem', false)] })],
      classificacoes: [CLASSIF],
      arranjos: [],
    }).listar();
    expect(a.totalQuestoes).toBe(1);
    expect(a.questoes[0].usos[0].peso).toBeNull();
  });

  it('diz se o perfil que a usa está publicado ou é rascunho', async () => {
    const a = await servico({
      questoes: [questao({ arranjos: [usoEm('v1', 'Rascunho novo', false)] })],
      classificacoes: [CLASSIF],
      arranjos: [{ modeloVersaoId: 'v1', classificacaoId: 'c1', peso: 10 }],
    }).listar();
    expect(a.questoes[0].usos[0].publicado).toBe(false);
  });
});

describe('⭐⭐ fora de todo perfil — é informação, não ausência', () => {
  /**
   * Nenhuma consulta do módulo lê `pergunta` direto: as quatro passam pelo
   * ARRANJO. Questão fora de arranjo é invisível para avaliação, contagem e
   * apuração — não quebra nada, e por isso a tela precisa DIZER.
   */
  it('conta quantas não estão em perfil nenhum', async () => {
    const a = await servico({
      questoes: [
        questao({ arranjos: [usoEm('v1', 'Administrativo')] }),
        questao({ id: 'q2', codigo: '099', arranjos: [] }),
      ],
      classificacoes: [CLASSIF],
      arranjos: [{ modeloVersaoId: 'v1', classificacaoId: 'c1', peso: 10 }],
    }).listar();
    expect(a.foraDeTodoPerfil).toBe(1);
    expect(a.questoes[1].usos).toEqual([]);
  });

  it('acervo vazio não quebra', async () => {
    const a = await servico().listar();
    expect(a).toMatchObject({ totalQuestoes: 0, foraDeTodoPerfil: 0, questoes: [] });
  });
});

describe('⭐⭐ o BLOQUEIO vem com a lista, não depois do primeiro render', () => {
  /**
   * O defeito da varredura de 12/09: `efeitos` era buscado no primeiro hover do
   * cartão, e a `005` (19 respostas) nascia com Editar e Apagar HABILITADOS e
   * sem aviso. Tela que decide habilitar com dado que chega depois do primeiro
   * render mostra, no intervalo, o oposto da verdade — e o intervalo é onde a
   * pessoa clica.
   */
  it('questão com resposta gravada já vem com editar/apagar RECUSADOS', async () => {
    const a = await servico({
      questoes: [questao({ _count: { respostas: 19 } })],
      classificacoes: [CLASSIF],
    }).listar();
    expect(a.questoes[0].efeitos.editarTexto.acao).toBe('RECUSAR');
    expect(a.questoes[0].efeitos.apagar.acao).toBe('RECUSAR');
    expect(a.questoes[0].efeitos.editarTexto.frase).toMatch(/19 respostas gravadas/);
  });

  it('questão em perfil já vem com reclassificar/apagar RECUSADOS', async () => {
    const a = await servico({
      questoes: [questao({ arranjos: [usoEm('v1', 'Administrativo')] })],
      classificacoes: [CLASSIF],
      arranjos: [{ modeloVersaoId: 'v1', classificacaoId: 'c1', peso: 10 }],
    }).listar();
    expect(a.questoes[0].efeitos.reclassificar.acao).toBe('RECUSAR');
    expect(a.questoes[0].efeitos.apagar.acao).toBe('RECUSAR');
  });

  it('questão solta vem com tudo PERMITIDO, menos reativar (já está ativa)', async () => {
    const a = await servico({ questoes: [questao()], classificacoes: [CLASSIF] }).listar();
    const e = a.questoes[0].efeitos;
    expect([e.editarTexto.acao, e.reclassificar.acao, e.desativar.acao, e.apagar.acao]).toEqual([
      'PERMITIR', 'PERMITIR', 'PERMITIR', 'PERMITIR',
    ]);
    expect(e.reativar.acao).toBe('RECUSAR');
  });
});

describe('⭐ uso que só existe em RASCUNHO', () => {
  /**
   * "usada em 1 perfil" e "usada em 1 perfil, só em rascunho" são fatos
   * diferentes: o segundo quer dizer que ninguém responde a questão ainda.
   */
  it('conta quantos usos são de versão publicada', async () => {
    const a = await servico({
      questoes: [
        questao({ arranjos: [usoEm('v1', 'Administrativo', false)] }),
        questao({
          id: 'q2',
          codigo: '005',
          arranjos: [usoEm('v1', 'Administrativo', false), usoEm('v2', 'Loja', true)],
        }),
      ],
      classificacoes: [CLASSIF],
      arranjos: [
        { modeloVersaoId: 'v1', classificacaoId: 'c1', peso: 10 },
        { modeloVersaoId: 'v2', classificacaoId: 'c1', peso: 10 },
      ],
    }).listar();
    // ⚠️ Está em 1 perfil e nenhum publicado — não é "fora de todo perfil",
    // e também não é "em uso".
    expect(a.questoes[0].usos).toHaveLength(1);
    expect(a.questoes[0].usosPublicados).toBe(0);
    expect(a.foraDeTodoPerfil).toBe(0);
    expect(a.questoes[1].usosPublicados).toBe(1);
  });
});
