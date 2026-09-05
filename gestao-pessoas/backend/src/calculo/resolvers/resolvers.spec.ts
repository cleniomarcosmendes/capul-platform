/**
 * Testes dos quatro resolvers calculados e do registro.
 *
 * A `dataBase` usada é 01/09/2026 — a mesma das medições feitas no Protheus em
 * 05/09/2026, para os números baterem com o que está documentado.
 */
import { RESOLVERS, codigosRegistrados, obterResolver, resolverRegistrado } from './registry.js';
import { anosEntre, paraData, recuarMeses, type ContextoCiclo, type DadosColaborador } from './resolver.types.js';
import { escolaridade } from './escolaridade.resolver.js';
import { tempoEmpresa } from './tempo-empresa.resolver.js';
import { tempoFuncao } from './tempo-funcao.resolver.js';
import { qtdeTreinamento } from './qtde-treinamento.resolver.js';

const ciclo: ContextoCiclo = { dataBase: '20260901', janelaTreinamentoMeses: 12 };
const pessoa = (over: Partial<DadosColaborador> = {}): DadosColaborador => ({
  dataAdmissao: '20000522',
  dataUltimaFuncao: '20231101',
  grauInstrucaoCodigo: '45',
  treinamentosConcluidos: [],
  ...over,
});

describe('registro de resolvers', () => {
  it('registra exatamente os quatro critérios calculados do seed', () => {
    expect(codigosRegistrados()).toEqual([
      'ESCOLARIDADE',
      'QTDE_TREINAMENTO',
      'TEMPO_EMPRESA',
      'TEMPO_FUNCAO',
    ]);
  });

  it('reconhece código registrado e recusa o resto', () => {
    expect(resolverRegistrado('TEMPO_EMPRESA')).toBe(true);
    expect(resolverRegistrado('TEMPO_EMPRESAA')).toBe(false);
    expect(resolverRegistrado('')).toBe(false);
    expect(resolverRegistrado(null)).toBe(false);
    expect(resolverRegistrado(undefined)).toBe(false);
  });

  it('não confunde propriedade herdada de Object com resolver registrado', () => {
    // `'constructor' in RESOLVERS` seria true — por isso o registro usa hasOwn.
    expect(resolverRegistrado('constructor')).toBe(false);
    expect(resolverRegistrado('toString')).toBe(false);
  });

  it('obterResolver falha alto para código desconhecido, em vez de devolver vazio', () => {
    expect(() => obterResolver('NAO_EXISTE')).toThrow(/sem resolver/);
  });

  it('o mapa é congelado — resolver não se registra em runtime', () => {
    expect(Object.isFrozen(RESOLVERS)).toBe(true);
  });
});

describe('ESCOLARIDADE', () => {
  it('devolve o CÓDIGO do SX5 como valor de domínio', () => {
    expect(escolaridade(pessoa({ grauInstrucaoCodigo: '45' }))).toEqual({
      valorNumerico: null,
      valorTexto: '45',
      semDado: false,
    });
  });

  it('código ausente ou em branco vira semDado (entra na renormalização)', () => {
    for (const vazio of [null, undefined, '', '   ']) {
      expect(escolaridade(pessoa({ grauInstrucaoCodigo: vazio })).semDado).toBe(true);
    }
  });

  it('não interpreta o código: quem pontua é a faixa cadastrada', () => {
    // 85 (pós-graduação) é maior que 65 (mestrado) na ordem numérica, e menor na
    // ordem de escolaridade. O resolver não pode ter opinião sobre isso.
    expect(escolaridade(pessoa({ grauInstrucaoCodigo: '85' })).valorTexto).toBe('85');
  });
});

describe('TEMPO_EMPRESA', () => {
  it('conta da admissão até a dataBase do ciclo', () => {
    const r = tempoEmpresa(pessoa({ dataAdmissao: '20160901' }), ciclo);
    expect(r.valorNumerico).toBeCloseTo(10.0, 1);
    expect(r.semDado).toBe(false);
  });

  it('usa a dataBase, nunca a data de hoje', () => {
    const p = pessoa({ dataAdmissao: '20200101' });
    const a = tempoEmpresa(p, ciclo).valorNumerico!;
    const b = tempoEmpresa(p, { ...ciclo, dataBase: '20270901' }).valorNumerico!;
    expect(b - a).toBeCloseTo(1, 2);
  });

  it('nunca produz semDado — admissão ausente é erro de sync e falha alto', () => {
    expect(() => tempoEmpresa(pessoa({ dataAdmissao: '' }), ciclo)).toThrow(/admissão/);
  });
});

describe('TEMPO_FUNCAO', () => {
  it('conta da última troca de função até a dataBase', () => {
    // Matrícula 001174: virou MOTORISTA E 3B em 01/11/2023.
    expect(tempoFuncao(pessoa({ dataUltimaFuncao: '20231101' }), ciclo).valorNumerico).toBeCloseTo(2.83, 2);
  });

  it('falha alto se o sync não resolveu a data (deveria ter usado a admissão — C9)', () => {
    expect(() => tempoFuncao(pessoa({ dataUltimaFuncao: null }), ciclo)).toThrow(/C9/);
  });
});

describe('QTDE_TREINAMENTO', () => {
  it('conta os concluídos dentro da janela', () => {
    const r = qtdeTreinamento(
      pessoa({ treinamentosConcluidos: ['20260301', '20251201', '20250901'] }),
      ciclo,
    );
    expect(r.valorNumerico).toBe(3);
  });

  it('inclui as duas pontas da janela', () => {
    // Janela de 12 meses a partir de 20260901 = [20250901, 20260901].
    expect(
      qtdeTreinamento(pessoa({ treinamentosConcluidos: ['20250901', '20260901'] }), ciclo).valorNumerico,
    ).toBe(2);
  });

  it('exclui o que ficou fora da janela', () => {
    expect(
      qtdeTreinamento(pessoa({ treinamentosConcluidos: ['20250831', '20260902'] }), ciclo).valorNumerico,
    ).toBe(0);
  });

  it('zero é valor legítimo, NUNCA semDado', () => {
    const r = qtdeTreinamento(pessoa({ treinamentosConcluidos: [] }), ciclo);
    expect(r).toEqual({ valorNumerico: 0, valorTexto: null, semDado: false });
  });

  it('janela maior alcança mais — é o parâmetro do ciclo, não código', () => {
    // Com o registro parado desde nov/2025, 36 meses alcançariam 2023/2024.
    const p = pessoa({ treinamentosConcluidos: ['20231110', '20241105'] });
    expect(qtdeTreinamento(p, ciclo).valorNumerico).toBe(0);
    expect(qtdeTreinamento(p, { ...ciclo, janelaTreinamentoMeses: 36 }).valorNumerico).toBe(2);
  });

  it('treinamento sem data de término não conta', () => {
    expect(qtdeTreinamento(pessoa({ treinamentosConcluidos: ['', '20260101'] }), ciclo).valorNumerico).toBe(1);
  });
});

describe('utilitários de data', () => {
  it('recusa data malformada em vez de calcular errado', () => {
    expect(() => paraData('2026-09-01')).toThrow(/AAAAMMDD/);
    expect(() => paraData('20260231')).toThrow(/inexistente/);
  });

  it('recuarMeses ancora no último dia quando o mês de destino é mais curto', () => {
    expect(recuarMeses('20260331', 1)).toBe('20260228');
    expect(recuarMeses('20260901', 12)).toBe('20250901');
    expect(recuarMeses('20260901', 36)).toBe('20230901');
  });

  it('anosEntre usa 365,25, como o select original', () => {
    expect(anosEntre('20250901', '20260901')).toBeCloseTo(365 / 365.25, 4);
  });
});
