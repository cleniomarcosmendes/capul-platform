import {
  MINIMO_PESSOAS_PARA_CARGA,
  classificarOrigem,
  marcarConsideradas,
  paraMovimentos,
  prepararHistorico,
  separarUtilizaveis,
  type LinhaHistorico,
} from './historico-funcional.js';
import { resolverDataUltimaFuncao } from './data-ultima-funcao.js';

const linha = (over: Partial<LinhaHistorico> = {}): LinhaHistorico => ({
  filial: '01',
  matricula: '001741',
  data: '20231101',
  sequencia: '1',
  funcaoCodigo: '02501',
  tipo: '005',
  ...over,
});

/** Um dissídio: mesma data e tipo, muita gente. */
const dissidio = (data: string, quantas: number) =>
  Array.from({ length: quantas }, (_, i) =>
    linha({ matricula: String(i).padStart(6, '0'), data, tipo: '003' }),
  );

describe('classificarOrigem — descritiva, nunca decide a nota', () => {
  it('lote grande na mesma data e tipo vira CARGA', () => {
    // O dissídio real: 20251101 com R7_TIPO=003 em 1.002 pessoas.
    const classificadas = classificarOrigem(dissidio('20251101', 60));
    expect(classificadas.every((l) => l.origem === 'CARGA')).toBe(true);
  });

  it('promoção individual continua MOVIMENTO', () => {
    const classificadas = classificarOrigem([...dissidio('20251101', 60), linha({ data: '20250315' })]);
    expect(classificadas.find((l) => l.data === '20250315')?.origem).toBe('MOVIMENTO');
  });

  it('mesmo dia, tipos diferentes, são lotes diferentes', () => {
    const misto = [...dissidio('20251101', 60), linha({ data: '20251101', tipo: '005' })];
    const classificadas = classificarOrigem(misto);
    expect(classificadas.find((l) => l.tipo === '005')?.origem).toBe('MOVIMENTO');
  });

  it('o limiar é parâmetro (§5.3 pediu configurável)', () => {
    const poucas = dissidio('20251101', 10);
    expect(classificarOrigem(poucas)[0].origem).toBe('MOVIMENTO');
    expect(classificarOrigem(poucas, 5)[0].origem).toBe('CARGA');
    expect(MINIMO_PESSOAS_PARA_CARGA).toBe(50);
  });

  it('⭐ a classificação NÃO muda o resultado do cálculo', () => {
    // A garantia que importa: se a heurística errar, muda o rótulo na tela de
    // auditoria, não a nota. Foi por depender do tipo e de uma data fixa que o
    // select antigo errou por anos.
    const historico = [
      linha({ data: '20220830', funcaoCodigo: '03156', tipo: '005' }),
      linha({ data: '20231101', funcaoCodigo: '03153', tipo: '005' }),
      linha({ data: '20251101', funcaoCodigo: '03153', tipo: '003' }),
    ];
    const comLimiarBaixo = classificarOrigem(historico, 1);
    const comLimiarAlto = classificarOrigem(historico, 9999);
    expect(comLimiarBaixo.map((l) => l.origem)).not.toEqual(comLimiarAlto.map((l) => l.origem));

    const nota = (ls: typeof comLimiarBaixo) =>
      resolverDataUltimaFuncao(paraMovimentos(ls.map((l) => ({ ...l, consideradoNoCalculo: true }))), '20000522').data;
    expect(nota(comLimiarBaixo)).toBe(nota(comLimiarAlto));
  });
});

describe('marcarConsideradas — grava tudo, marca o que não conta', () => {
  const filialAtual = new Map([['004540', '01']]);

  // Caso real: matrícula 004540, transferida da 18 para a 01. A cópia da 18
  // continuou carimbando a função ANTIGA depois da transferência.
  const replicado = classificarOrigem([
    linha({ matricula: '004540', filial: '01', data: '20241101', funcaoCodigo: '00542' }),
    linha({ matricula: '004540', filial: '18', data: '20241101', funcaoCodigo: '02556' }),
    linha({ matricula: '004540', filial: '18', data: '20251101', funcaoCodigo: '02556' }),
  ]);

  it('NÃO descarta linha nenhuma — grava todas', () => {
    expect(marcarConsideradas(replicado, filialAtual)).toHaveLength(3);
  });

  it('só a filial atual alimenta o cálculo', () => {
    const marcadas = marcarConsideradas(replicado, filialAtual);
    expect(marcadas.filter((l) => l.consideradoNoCalculo)).toHaveLength(1);
    expect(marcadas.find((l) => l.consideradoNoCalculo)?.filial).toBe('01');
  });

  it('⭐ o descartado leva o MOTIVO escrito — nada de descarte silencioso', () => {
    const descartada = marcarConsideradas(replicado, filialAtual).find((l) => !l.consideradoNoCalculo)!;
    expect(descartada.motivoDescarte).toContain('Réplica da filial 18');
    expect(descartada.motivoDescarte).toContain('está hoje na 01');
  });

  it('matrícula sem colaborador ativo é gravada só para rastreio', () => {
    // 488 dos 905 avaliados do ciclo 2025 foram expurgados do SRA010; o
    // histórico deles ainda chega ao sync.
    const orfa = marcarConsideradas(classificarOrigem([linha({ matricula: '006605' })]), new Map());
    expect(orfa[0].consideradoNoCalculo).toBe(false);
    expect(orfa[0].motivoDescarte).toContain('sem colaborador ativo');
  });

  it('⭐ o que alimenta o cálculo reproduz a promoção verdadeira', () => {
    // Com as réplicas fora, sobra a filial 01 — e é ela que tem a função certa.
    const movimentos = paraMovimentos(marcarConsideradas(replicado, filialAtual));
    expect(movimentos).toHaveLength(1);
    expect(movimentos[0].funcaoCodigo).toBe('00542');
  });
});

describe('prepararHistorico — as duas etapas na ordem', () => {
  it('classifica e marca de uma vez', () => {
    const preparadas = prepararHistorico(
      [...dissidio('20251101', 60), linha({ matricula: '000001', filial: '99' })],
      new Map([['000001', '01']]),
    );
    expect(preparadas.find((l) => l.filial === '99')?.consideradoNoCalculo).toBe(false);
    expect(preparadas.find((l) => l.tipo === '003')?.origem).toBe('CARGA');
  });
});

describe('⭐ separarUtilizaveis — linha ruim não derruba o arquivo', () => {
  it('separa o lançamento SEM DATA, sem perder os outros', () => {
    // 99 linhas do SR7010 da Capul não têm data (98 pessoas, 79 ativas).
    // Recusar a carga inteira por causa delas trocaria um problema pequeno por
    // um grande; importar calado seria o descarte silencioso de novo.
    const { utilizaveis, invalidas } = separarUtilizaveis([
      linha({ data: '20231101' }),
      linha({ data: '        ' }),
      linha({ data: '20241101' }),
    ]);
    expect(utilizaveis).toHaveLength(2);
    expect(invalidas).toHaveLength(1);
    expect(invalidas[0].motivo).toBe('SEM_DATA');
  });

  it('o motivo diz de quem é a linha, para achar no Protheus', () => {
    const { invalidas } = separarUtilizaveis([linha({ data: '', matricula: '001178', filial: '03' })]);
    expect(invalidas[0].detalhe).toContain('001178');
    expect(invalidas[0].detalhe).toContain('filial 03');
    expect(invalidas[0].detalhe).toContain('as demais da pessoa valem');
  });

  it('separa também a linha sem código de função', () => {
    expect(separarUtilizaveis([linha({ funcaoCodigo: '  ' })]).invalidas[0].motivo).toBe('SEM_FUNCAO');
  });

  it('recusa data em formato errado — não tenta adivinhar', () => {
    expect(separarUtilizaveis([linha({ data: '2023-11-01' })]).invalidas).toHaveLength(1);
  });

  it('utilizáveis + inválidas = total lido', () => {
    const arquivo = [linha(), linha({ data: '' }), linha({ funcaoCodigo: '' }), linha()];
    const { utilizaveis, invalidas } = separarUtilizaveis(arquivo);
    expect(utilizaveis.length + invalidas.length).toBe(arquivo.length);
  });
});
