import {
  MINIMO_PESSOAS_PARA_CARGA,
  classificarOrigem,
  marcarConsideradas,
  paraMovimentos,
  prepararHistorico,
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
