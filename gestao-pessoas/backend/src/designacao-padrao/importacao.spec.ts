/**
 * A IMPORTAÇÃO DA PLANILHA DO RH — as regras que não podem ceder.
 *
 * 82 linhas viram ~1.000 pares. Isso torna quatro coisas obrigatórias, e cada
 * uma tem um bloco aqui:
 *
 *   PRÉ-VISUALIZAR  o relatório sai ANTES de gravar, com os números certos.
 *   IDEMPOTÊNCIA    reimportar o mesmo arquivo grava ZERO.
 *   AJUSTE MANUAL   nunca é sobrescrito sem alguém mandar.
 *   REVISÃO         a divisão alfabética fica marcada até uma pessoa olhar.
 */
import {
  conferenciaDe,
  lerPlanilhaDeAvaliadores,
  normalizarMatricula,
  PlanilhaInvalidaError,
} from './planilha.js';
import { emBlocos, montarPrevia, type ColaboradorDaPrevia, type DesignacaoVigente } from './distribuicao.js';

const CABECALHO = 'centro_custo;descricao;filiais;pessoas;avaliador_matricula;avaliador_nome';

/** Um centro de custo com 5 pessoas, duas delas chefia. */
const EQUIPE: ColaboradorDaPrevia[] = [
  { id: 'c-ana', filial: '02', matricula: '000001', nome: 'ANA', centroCusto: '21010101', centroCustoDescricao: 'SUPERMERCADO' },
  { id: 'c-bruno', filial: '02', matricula: '000002', nome: 'BRUNO', centroCusto: '21010101', centroCustoDescricao: 'SUPERMERCADO' },
  { id: 'c-carla', filial: '02', matricula: '000003', nome: 'CARLA', centroCusto: '21010101', centroCustoDescricao: 'SUPERMERCADO' },
  { id: 'c-chefe1', filial: '02', matricula: '000010', nome: 'GERENTE UM', centroCusto: '21010101', centroCustoDescricao: 'SUPERMERCADO' },
  { id: 'c-chefe2', filial: '02', matricula: '000011', nome: 'GERENTE DOIS', centroCusto: '21010101', centroCustoDescricao: 'SUPERMERCADO' },
];

const previa = (opcoes: {
  csv: string;
  colaboradores?: ColaboradorDaPrevia[];
  vigentes?: DesignacaoVigente[];
  substituirAjustesManuais?: boolean;
}) => {
  const leitura = lerPlanilhaDeAvaliadores(opcoes.csv);
  return montarPrevia({
    linhas: leitura.linhas,
    recusasDaLeitura: leitura.recusas,
    linhasNoArquivo: leitura.linhasNoArquivo,
    linhasSemAvaliador: leitura.semAvaliador,
    colaboradores: opcoes.colaboradores ?? EQUIPE,
    vigentes: opcoes.vigentes ?? [],
    substituirAjustesManuais: opcoes.substituirAjustesManuais ?? false,
  });
};

describe('leitura da planilha', () => {
  it('⭐ linha com avaliador em BRANCO não é erro — é "ainda não decidi"', () => {
    // O modelo que ela recebe tem os 74 CCs com a coluna vazia. Tratar como
    // recusa encheria a tela de vermelho e esconderia os erros de verdade.
    const l = lerPlanilhaDeAvaliadores(`${CABECALHO}\n21010101;SUPERMERCADO;02;5;;\n11010207;FINANCEIRO;01;15;;`);
    expect(l.semAvaliador).toBe(2);
    expect(l.recusas).toEqual([]);
    expect(l.linhas).toEqual([]);
  });

  it('cabeçalho sem as colunas obrigatórias recusa o arquivo inteiro, dizendo quais', () => {
    expect(() => lerPlanilhaDeAvaliadores('centro;quem\nx;y')).toThrow(PlanilhaInvalidaError);
    expect(() => lerPlanilhaDeAvaliadores('centro;quem\nx;y')).toThrow(/centro_custo, avaliador_matricula/);
  });

  it('matrícula recupera o zero que o Excel comeu', () => {
    expect(normalizarMatricula('1741')).toBe('001741');
    expect(normalizarMatricula('001741')).toBe('001741');
  });

  it('a conferência não muda por causa da quebra de linha do Windows', () => {
    // Senão ela salvaria o mesmo arquivo no Excel e levaria "o arquivo mudou".
    expect(conferenciaDe('a;b\r\nc;d\r\n')).toBe(conferenciaDe('a;b\nc;d'));
  });

  it('a conferência muda quando o conteúdo muda', () => {
    expect(conferenciaDe('a;b\n1;2')).not.toBe(conferenciaDe('a;b\n1;3'));
  });
});

describe('prévia — a divisão', () => {
  it('um responsável leva todo o centro de custo, menos ele mesmo', () => {
    const { previa: p, aGravar } = previa({ csv: `${CABECALHO}\n21010101;S;02;5;000010;` });
    expect(aGravar).toHaveLength(4); // 5 pessoas − o próprio
    expect(aGravar.every((g) => g.origem === 'CENTRO_CUSTO')).toBe(true);
    expect(aGravar.some((g) => g.avaliadoId === 'c-chefe1')).toBe(false);
    expect(p.pares).toMatchObject({ total: 4, novos: 4, inalterados: 0, porDivisaoAutomatica: 0 });
  });

  it('⭐ dois responsáveis dividem em blocos, e as linhas saem MARCADAS', () => {
    const { previa: p, aGravar } = previa({
      csv: `${CABECALHO}\n21010101;S;02;5;000010;\n21010101;S;02;5;000011;`,
    });
    // 3 pessoas comuns entre 2 responsáveis: 2 e 1.
    expect(aGravar).toHaveLength(3);
    expect(aGravar.every((g) => g.origem === 'DIVISAO_AUTOMATICA')).toBe(true);
    expect(p.pares.porDivisaoAutomatica).toBe(3);
    expect(p.centrosCusto[0].porDivisaoAutomatica).toBe(true);
    expect(p.centrosCusto[0].divisao.map((d) => d.quantos).sort()).toEqual([1, 2]);
  });

  it('a divisão é determinística — a mesma planilha dá sempre o mesmo resultado', () => {
    const csv = `${CABECALHO}\n21010101;S;02;5;000010;\n21010101;S;02;5;000011;`;
    const a = previa({ csv }).aGravar;
    const b = previa({ csv }).aGravar;
    expect(a).toEqual(b);
  });

  it('emBlocos reparte o mais igual possível, sem perder ninguém', () => {
    const blocos = emBlocos([...Array(87).keys()], 11);
    expect(blocos.map((b) => b.length)).toEqual([8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 7]);
    expect(blocos.flat()).toHaveLength(87);
  });
});

describe('⭐ idempotência — reimportar não duplica', () => {
  const vigentesIguais: DesignacaoVigente[] = [
    { id: 'v1', avaliadoId: 'c-ana', avaliadorId: 'c-chefe1', origem: 'CENTRO_CUSTO' },
    { id: 'v2', avaliadoId: 'c-bruno', avaliadorId: 'c-chefe1', origem: 'CENTRO_CUSTO' },
    { id: 'v3', avaliadoId: 'c-carla', avaliadorId: 'c-chefe1', origem: 'CENTRO_CUSTO' },
    { id: 'v4', avaliadoId: 'c-chefe2', avaliadorId: 'c-chefe1', origem: 'CENTRO_CUSTO' },
  ];

  it('a segunda importação do mesmo arquivo grava ZERO', () => {
    const { previa: p, aGravar } = previa({
      csv: `${CABECALHO}\n21010101;S;02;5;000010;`,
      vigentes: vigentesIguais,
    });
    expect(aGravar).toEqual([]);
    expect(p.pares).toMatchObject({ total: 0, novos: 0, inalterados: 4 });
  });

  it('⭐ par já revisado à mão NÃO é reescrito como divisão automática', () => {
    // Reescrever devolveria a linha para "não revisada" e apagaria, em silêncio,
    // o trabalho de quem já tinha conferido.
    const { aGravar, previa: p } = previa({
      csv: `${CABECALHO}\n21010101;S;02;5;000010;\n21010101;S;02;5;000011;`,
      // A divisão manda ANA para o GERENTE DOIS (a ordem é alfabética dos dois
      // lados), e é exatamente esse par que já está gravado como MANUAL.
      vigentes: [{ id: 'v1', avaliadoId: 'c-ana', avaliadorId: 'c-chefe2', origem: 'MANUAL' }],
    });
    expect(aGravar.some((g) => g.avaliadoId === 'c-ana')).toBe(false);
    expect(p.pares.inalterados).toBe(1);
    expect(p.pares.porDivisaoAutomatica).toBe(2); // BRUNO e CARLA, só
    expect(p.conflitosComAjusteManual).toEqual([]);
  });
});

describe('⭐ ajuste manual nunca é sobrescrito sem mandarem', () => {
  const manualDiferente: DesignacaoVigente[] = [
    { id: 'v1', avaliadoId: 'c-ana', avaliadorId: 'c-chefe2', origem: 'MANUAL' },
  ];

  it('vira CONFLITO, com nome e as duas pontas — e não grava', () => {
    const { previa: p, aGravar } = previa({
      csv: `${CABECALHO}\n21010101;S;02;5;000010;`,
      vigentes: manualDiferente,
    });
    expect(aGravar.some((g) => g.avaliadoId === 'c-ana')).toBe(false);
    expect(p.conflitosComAjusteManual).toEqual([
      expect.objectContaining({
        nome: 'ANA',
        avaliadorAtual: 'GERENTE DOIS',
        avaliadorDaPlanilha: 'GERENTE UM',
      }),
    ]);
  });

  it('com o pedido explícito, substitui — e conta como substituição, não como novo', () => {
    const { previa: p, aGravar } = previa({
      csv: `${CABECALHO}\n21010101;S;02;5;000010;`,
      vigentes: manualDiferente,
      substituirAjustesManuais: true,
    });
    const daAna = aGravar.find((g) => g.avaliadoId === 'c-ana');
    expect(daAna).toMatchObject({ avaliadorId: 'c-chefe1', encerrarId: 'v1' });
    expect(p.pares.substituira).toBe(1);
    expect(p.conflitosComAjusteManual).toEqual([]);
  });

  it('designação que NÃO é manual é substituída sem pedir nada', () => {
    const { previa: p } = previa({
      csv: `${CABECALHO}\n21010101;S;02;5;000010;`,
      vigentes: [{ id: 'v1', avaliadoId: 'c-ana', avaliadorId: 'c-chefe2', origem: 'DIVISAO_AUTOMATICA' }],
    });
    expect(p.pares.substituira).toBe(1);
    expect(p.conflitosComAjusteManual).toEqual([]);
  });
});

describe('recusas — a planilha diz o que está errado, linha por linha', () => {
  it('matrícula que não existe', () => {
    const { previa: p } = previa({ csv: `${CABECALHO}\n21010101;S;02;5;999999;` });
    expect(p.recusas[0]).toMatchObject({ numero: 2, motivo: 'AVALIADOR_NAO_ENCONTRADO' });
    expect(p.recusas[0].detalhe).toMatch(/zero à esquerda/);
  });

  it('⭐ matrícula em duas filiais NÃO escolhe a primeira — recusa e pede a filial', () => {
    const gemeas = [
      ...EQUIPE,
      { id: 'c-outra', filial: '18', matricula: '000010', nome: 'XERXES', centroCusto: '41010145', centroCustoDescricao: 'RACAO' },
    ];
    const { previa: p } = previa({ csv: `${CABECALHO}\n21010101;S;02;5;000010;`, colaboradores: gemeas });
    expect(p.recusas[0]).toMatchObject({ motivo: 'MATRICULA_AMBIGUA' });
    expect(p.recusas[0].detalhe).toMatch(/coluna "filial"/);
  });

  it('centro de custo sem ninguém', () => {
    const { previa: p } = previa({ csv: `${CABECALHO}\n99999999;X;01;0;000010;` });
    expect(p.recusas[0]).toMatchObject({ motivo: 'CENTRO_DE_CUSTO_SEM_PESSOAS' });
  });

  it('linha com avaliador e sem centro de custo', () => {
    const { previa: p } = previa({ csv: `${CABECALHO}\n;S;02;5;000010;` });
    expect(p.recusas[0]).toMatchObject({ motivo: 'SEM_CENTRO_DE_CUSTO' });
  });

  it('recusa não impede o resto do arquivo de ser importado', () => {
    const { previa: p, aGravar } = previa({
      csv: `${CABECALHO}\n21010101;S;02;5;000010;\n99999999;X;01;0;000011;`,
    });
    expect(p.recusas).toHaveLength(1);
    expect(aGravar).toHaveLength(4);
  });
});

describe('a prévia conta o que a tela precisa mostrar', () => {
  it('linhas do arquivo, em branco, pares, divisão automática e recusas', () => {
    const { previa: p } = previa({
      csv: `${CABECALHO}\n21010101;S;02;5;000010;\n21010101;S;02;5;000011;\n11010207;F;01;15;;\n99999999;X;01;0;123456;`,
    });
    expect(p.linhasNoArquivo).toBe(4);
    expect(p.linhasSemAvaliador).toBe(1);
    expect(p.pares.total).toBe(3);
    expect(p.pares.porDivisaoAutomatica).toBe(3);
    expect(p.recusas).toHaveLength(1);
  });
});

describe('⚠️ o que o Excel faz com a planilha', () => {
  it('⭐ come o zero da FILIAL também, não só o da matrícula', () => {
    // `filial: 2` não casa com ninguém, e a linha seria recusada como "centro
    // de custo sem pessoas" — mensagem errada, mandando conferir o código do CC,
    // que está certo.
    const l = lerPlanilhaDeAvaliadores(`${CABECALHO};filial\n21010101;S;02;5;000010;;2`);
    expect(l.linhas[0].filial).toBe('02');
  });

  it('filial não numérica passa intacta', () => {
    const l = lerPlanilhaDeAvaliadores(`${CABECALHO};filial\n21010101;S;02;5;000010;;MATRIZ`);
    expect(l.linhas[0].filial).toBe('MATRIZ');
  });

  it('⭐ vários responsáveis na MESMA célula, separados por "|"', () => {
    // O modelo diz "repita a linha", mas a coluna de sugestões ao lado usa "|"
    // entre os candidatos — e foi assim que a planilha voltou preenchida.
    const l = lerPlanilhaDeAvaliadores(`${CABECALHO}\n21010101;S;02;5;000010|000011;`);
    expect(l.linhas).toHaveLength(2);
    expect(l.linhas.map((x) => x.avaliadorMatricula)).toEqual(['000010', '000011']);
    expect(l.linhas.every((x) => x.centroCusto === '21010101')).toBe(true);
  });

  it('a célula com "|" divide igual a linha repetida — mesmo resultado', () => {
    const juntas = previa({ csv: `${CABECALHO}\n21010101;S;02;5;000010|000011;` });
    const repetidas = previa({
      csv: `${CABECALHO}\n21010101;S;02;5;000010;\n21010101;S;02;5;000011;`,
    });
    expect(juntas.aGravar).toEqual(repetidas.aGravar);
  });

  it('espaço e zero à esquerda na célula com "|" não atrapalham', () => {
    const l = lerPlanilhaDeAvaliadores(`${CABECALHO}\n21010101;S;02;5; 10 | 000011 ;`);
    expect(l.linhas.map((x) => x.avaliadorMatricula)).toEqual(['000010', '000011']);
  });
});

/**
 * ⭐ A PLANILHA PODE TRAZER A CHAPA DO PROTHEUS (08/09).
 *
 * O RH monta a lista a partir do que o Protheus mostra, e lá a chapa é `E01981`.
 * Com match exato, a linha era recusada com "matrícula não existe entre os
 * colaboradores ativos" — mandando conferir um número que está certo. Mesma
 * família do zero à esquerda que o Excel come. Ver `common/chapa.ts`.
 */
describe('importação: a chapa do avaliador nas duas formas', () => {
  const colaborador = (matricula: string, nome: string, cc: string) => ({
    id: `id-${matricula}`, filial: '02', matricula, nome,
    centroCusto: cc, centroCustoDescricao: 'SUPERMERCADO',
  });

  const previa = (avaliadorMatricula: string) =>
    montarPrevia({
      linhas: [{ numero: 2, centroCusto: '21010101', filial: '02', avaliadorMatricula }],
      recusasDaLeitura: [],
      linhasNoArquivo: 1,
      linhasSemAvaliador: 0,
      colaboradores: [
        colaborador('001981', 'RENATA', '21010101'),
        colaborador('004000', 'AVALIADA', '21010101'),
      ],
      vigentes: [],
      substituirAjustesManuais: false,
    });

  it('a forma da nossa base acha o avaliador', () => {
    const r = previa('001981');
    expect(r.previa.recusas).toEqual([]);
    expect(r.aGravar.length).toBeGreaterThan(0);
  });

  /** ⭐ O CASO: a planilha veio do Protheus, com `E…`. */
  it('a forma do Protheus TAMBÉM acha — e não vira recusa', () => {
    const r = previa('E01981');
    expect(r.previa.recusas).toEqual([]);
    expect(r.aGravar.length).toBeGreaterThan(0);
  });

  it('as duas formas produzem o mesmo resultado', () => {
    expect(previa('E01981').aGravar).toEqual(previa('001981').aGravar);
  });

  /** ⚠️ E o que não é chapa continua sendo recusado, com o motivo de sempre. */
  it('matrícula inexistente continua recusada', () => {
    const r = previa('E09999');
    expect(r.previa.recusas[0]).toMatchObject({ motivo: 'AVALIADOR_NAO_ENCONTRADO' });
  });
});
