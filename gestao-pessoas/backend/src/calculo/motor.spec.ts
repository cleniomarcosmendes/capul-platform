import {
  type MotivoAlerta,
  ESCOPO_DO_MOTIVO,
  agregarAlertas,
  apurarColaborador,
  type AlertaApuracao,
  type CriterioConfigurado,
} from './motor.js';
import type { Faixa } from './faixa.js';
import type { ContextoCiclo, DadosColaborador } from './resolvers/resolver.types.js';

const ciclo: ContextoCiclo = { dataBase: '20260901', janelaTreinamentoMeses: 12 };

const faixaNum = (inf: number | null, sup: number | null, pontuacao: number, ordem: number): Faixa => ({
  id: `f${ordem}`, tipo: 'NUMERICA', limiteInferior: inf, limiteSuperior: sup,
  inclusivoInf: ordem === 0, inclusivoSup: true, valorDominio: null, pontuacao, rotulo: null, ordem,
});
const faixaDom = (v: string, pontuacao: number, ordem: number): Faixa => ({
  id: `d${ordem}`, tipo: 'DOMINIO', limiteInferior: null, limiteSuperior: null,
  inclusivoInf: false, inclusivoSup: true, valorDominio: v, pontuacao, rotulo: null, ordem,
});

const ESCOLARIDADE: CriterioConfigurado = {
  criterioId: 'cr-esc', codigo: 'ESCOLARIDADE', nome: 'Escolaridade',
  origem: 'CALCULADO', codigoCalculo: 'ESCOLARIDADE', peso: 10,
  faixas: [faixaDom('45', 25, 0), faixaDom('55', 75, 1)],
};
const TEMPO_EMPRESA: CriterioConfigurado = {
  criterioId: 'cr-tmp', codigo: 'TEMPO_EMPRESA', nome: 'Tempo de Empresa',
  origem: 'CALCULADO', codigoCalculo: 'TEMPO_EMPRESA', peso: 10,
  faixas: [faixaNum(0, 3, 25, 0), faixaNum(3, null, 100, 1)],
};

const pessoa = (over: Partial<DadosColaborador> = {}): DadosColaborador => ({
  dataAdmissao: '20000522',
  dataUltimaFuncao: '20231101',
  grauInstrucaoCodigo: '45',
  treinamentosConcluidos: [],
  ...over,
});

describe('motor — resolver → faixa → apuração', () => {
  it('percorre o caminho completo de um critério calculado', () => {
    const { resultado } = apurarColaborador({
      notaAvaliacao: 80, pesoAvaliacao: 60,
      criterios: [ESCOLARIDADE], colaborador: pessoa(), ciclo,
    });
    // escolaridade 45 -> 25 pontos. (80×60 + 25×10)/70 = 5050/70 = 72,14
    expect(resultado.notaFinal).toBe(72.14);
    expect(resultado.criterios[0]).toMatchObject({
      criterioNome: 'Escolaridade', valorTexto: '45', pontuacao: 25, semDado: false,
    });
  });

  it('grava a memória de cálculo por critério: valor bruto, faixa e peso', () => {
    const { resultado } = apurarColaborador({
      notaAvaliacao: 80, pesoAvaliacao: 60,
      criterios: [TEMPO_EMPRESA], colaborador: pessoa({ dataAdmissao: '20000522' }), ciclo,
    });
    const [tempo] = resultado.criterios;
    expect(tempo.valorBruto).toBeCloseTo(26.3, 1);
    expect(tempo.faixaId).toBe('f1');
    expect(tempo.pontuacao).toBe(100);
    expect(tempo.peso).toBe(10);
  });

  it('⭐ usa a dataBase do ciclo, nunca a data de hoje', () => {
    const base = { notaAvaliacao: 80, pesoAvaliacao: 60, criterios: [TEMPO_EMPRESA], colaborador: pessoa() };
    const em2026 = apurarColaborador({ ...base, ciclo }).resultado.criterios[0].valorBruto!;
    const em2027 = apurarColaborador({ ...base, ciclo: { ...ciclo, dataBase: '20270901' } })
      .resultado.criterios[0].valorBruto!;
    expect(em2027 - em2026).toBeCloseTo(1, 2);
  });

  describe('sem dado cadastral', () => {
    it('renormaliza e alerta, sem punir a pessoa', () => {
      const { resultado, alertas } = apurarColaborador({
        notaAvaliacao: 80, pesoAvaliacao: 60,
        criterios: [ESCOLARIDADE], colaborador: pessoa({ grauInstrucaoCodigo: null }), ciclo,
      });
      expect(resultado.notaFinal).toBe(80);
      expect(resultado.houveRenormalizacao).toBe(true);
      expect(alertas[0]).toMatchObject({ criterioCodigo: 'ESCOLARIDADE', motivo: 'SEM_DADO_CADASTRAL' });
    });
  });

  describe('⭐ valor sem faixa é lacuna de CADASTRO, não da pessoa', () => {
    it('não pontua zero, tira da conta e alerta o RH', () => {
      // Código de escolaridade novo no SX5 que ninguém cadastrou no critério.
      const { resultado, alertas } = apurarColaborador({
        notaAvaliacao: 80, pesoAvaliacao: 60,
        criterios: [ESCOLARIDADE], colaborador: pessoa({ grauInstrucaoCodigo: '85' }), ciclo,
      });
      expect(resultado.criterios[0].pontuacao).toBeNull();
      expect(resultado.criterios[0].semDado).toBe(true);
      expect(resultado.notaFinal).toBe(80);
      expect(alertas[0]).toMatchObject({ criterioCodigo: 'ESCOLARIDADE', motivo: 'SEM_FAIXA' });
      expect(alertas[0].detalhe).toContain('Cadastre a faixa e reapure');
    });

    it('preserva o valor lido, para o RH saber o que cadastrar', () => {
      const { resultado } = apurarColaborador({
        notaAvaliacao: 80, pesoAvaliacao: 60,
        criterios: [ESCOLARIDADE], colaborador: pessoa({ grauInstrucaoCodigo: '85' }), ciclo,
      });
      expect(resultado.criterios[0].valorTexto).toBe('85');
    });

    it('não trava a apuração dos outros critérios', () => {
      const { resultado } = apurarColaborador({
        notaAvaliacao: 80, pesoAvaliacao: 60,
        criterios: [ESCOLARIDADE, TEMPO_EMPRESA],
        colaborador: pessoa({ grauInstrucaoCodigo: '85' }), ciclo,
      });
      expect(resultado.criterios[1].pontuacao).toBe(100);
    });
  });

  describe('critério INFORMADO', () => {
    const META: CriterioConfigurado = {
      criterioId: 'cr-meta', codigo: 'META_SETOR', nome: 'Meta do Setor',
      origem: 'INFORMADO', codigoCalculo: null, peso: 20,
      faixas: [faixaNum(0, 50, 0, 0), faixaNum(50, null, 100, 1)],
    };

    it('usa o valor importado', () => {
      const { resultado } = apurarColaborador({
        notaAvaliacao: 80, pesoAvaliacao: 60, criterios: [META], colaborador: pessoa(), ciclo,
        valoresInformados: [{ criterioId: 'cr-meta', valorNumerico: 90, valorTexto: null }],
      });
      expect(resultado.criterios[0].pontuacao).toBe(100);
    });

    it('sem valor importado vira semDado + alerta — não zero', () => {
      const { resultado, alertas } = apurarColaborador({
        notaAvaliacao: 80, pesoAvaliacao: 60, criterios: [META], colaborador: pessoa(), ciclo,
      });
      expect(resultado.criterios[0].semDado).toBe(true);
      expect(resultado.notaFinal).toBe(80);
      expect(alertas[0].motivo).toBe('SEM_VALOR_INFORMADO');
    });
  });

  it('critério calculado apontando para resolver inexistente falha ALTO', () => {
    // As três validações já barram antes; se chegou aqui, é para gritar e não
    // devolver vazio em silêncio para o ciclo inteiro.
    expect(() =>
      apurarColaborador({
        notaAvaliacao: 80, pesoAvaliacao: 60,
        criterios: [{ ...ESCOLARIDADE, codigoCalculo: 'NAO_EXISTE' }],
        colaborador: pessoa(), ciclo,
      }),
    ).toThrow(/sem resolver/);
  });
});

describe('⭐ agregação de alertas — configuração × individual', () => {
  const alerta = (over: Partial<AlertaApuracao> = {}): AlertaApuracao => ({
    criterioCodigo: 'ESCOLARIDADE',
    criterioNome: 'Escolaridade',
    motivo: 'SEM_FAIXA',
    escopo: 'CONFIGURACAO',
    valor: '85',
    detalhe: '',
    ...over,
  });

  it('conta as pessoas afetadas por critério e motivo', () => {
    const agregados = agregarAlertas([alerta(), alerta({ valor: '85' }), alerta({ valor: '95' })]);
    expect(agregados).toHaveLength(1);
    expect(agregados[0]).toMatchObject({ pessoas: 3, valores: ['85', '95'] });
  });

  it('o resumo é a frase que a tela de fechamento mostra', () => {
    const [a] = agregarAlertas([alerta(), alerta()]);
    expect(a.resumo).toContain('2 pessoas');
    expect(a.resumo).toContain('fora de faixa');
    expect(a.resumo).toContain('85');
    expect(a.resumo).toContain('Cadastre a faixa');
  });

  it('⭐ CONFIGURAÇÃO vem antes de INDIVIDUAL — é a que se resolve de uma vez', () => {
    const agregados = agregarAlertas([
      ...Array.from({ length: 50 }, () =>
        alerta({ motivo: 'SEM_DADO_CADASTRAL', escopo: 'INDIVIDUAL', valor: null }),
      ),
      alerta(),
    ]);
    // Mesmo afetando MENOS gente, a de configuração vem primeiro: uma faixa
    // cadastrada resolve todas as linhas; 50 cadastros individuais, não.
    expect(agregados[0].escopo).toBe('CONFIGURACAO');
    expect(agregados[1].pessoas).toBe(50);
  });

  it('dentro do mesmo escopo, ordena pelo que afeta mais gente', () => {
    const agregados = agregarAlertas([
      alerta({ criterioCodigo: 'A', criterioNome: 'A' }),
      alerta({ criterioCodigo: 'B', criterioNome: 'B' }),
      alerta({ criterioCodigo: 'B', criterioNome: 'B' }),
    ]);
    expect(agregados.map((a) => a.criterioCodigo)).toEqual(['B', 'A']);
  });

  it('separa motivos diferentes do mesmo critério', () => {
    const agregados = agregarAlertas([
      alerta(),
      alerta({ motivo: 'SEM_DADO_CADASTRAL', escopo: 'INDIVIDUAL', valor: null }),
    ]);
    expect(agregados).toHaveLength(2);
  });

  it('lista vazia não vira alerta nenhum', () => {
    expect(agregarAlertas([])).toEqual([]);
  });

  it('o motor classifica o escopo automaticamente', () => {
    const { alertas } = apurarColaborador({
      notaAvaliacao: 80, pesoAvaliacao: 60,
      criterios: [ESCOLARIDADE], colaborador: pessoa({ grauInstrucaoCodigo: '85' }), ciclo,
    });
    expect(alertas[0]).toMatchObject({ escopo: 'CONFIGURACAO', valor: '85', criterioNome: 'Escolaridade' });

    const { alertas: individuais } = apurarColaborador({
      notaAvaliacao: 80, pesoAvaliacao: 60,
      criterios: [ESCOLARIDADE], colaborador: pessoa({ grauInstrucaoCodigo: null }), ciclo,
    });
    expect(individuais[0]).toMatchObject({ escopo: 'INDIVIDUAL', valor: null });
  });
});

describe('⭐⭐ escopo CALCULADO — atingir todo mundo muda o conselho', () => {
  const alerta = (motivo: MotivoAlerta, codigo = 'META'): AlertaApuracao => ({
    criterioCodigo: codigo,
    criterioNome: 'Meta mensal',
    motivo,
    escopo: ESCOPO_DO_MOTIVO[motivo],
    valor: null,
    detalhe: '',
  });

  it('SEM_VALOR_INFORMADO em ALGUMAS pessoas segue INDIVIDUAL', () => {
    const [a] = agregarAlertas([alerta('SEM_VALOR_INFORMADO'), alerta('SEM_VALOR_INFORMADO')], 10);
    expect(a.escopo).toBe('INDIVIDUAL');
    expect(a.resumo).toMatch(/2 pessoas sem valor informado/);
  });

  /**
   * ⭐ O caso do critério INFORMADO recém-criado: a tabela de valores nasce
   * vazia, então ninguém tem valor. "Resolve-se caso a caso" para 894 pessoas
   * manda fazer 894 correções onde cabe uma importação.
   */
  it('SEM_VALOR_INFORMADO em TODO MUNDO vira CONFIGURACAO', () => {
    const [a] = agregarAlertas([alerta('SEM_VALOR_INFORMADO'), alerta('SEM_VALOR_INFORMADO')], 2);
    expect(a.escopo).toBe('CONFIGURACAO');
    expect(a.resumo).toMatch(/NINGUÉM tem valor informado/);
    expect(a.resumo).toMatch(/Importe os valores e reapure/);
  });

  it('SEM_DADO_CADASTRAL em todo mundo também — e aponta o sync, não a pessoa', () => {
    const [a] = agregarAlertas([alerta('SEM_DADO_CADASTRAL')], 1);
    expect(a.escopo).toBe('CONFIGURACAO');
    expect(a.resumo).toMatch(/sincroniza/i);
  });

  it('SEM_FAIXA já era CONFIGURACAO e não muda com o total', () => {
    expect(agregarAlertas([alerta('SEM_FAIXA')], 999)[0].escopo).toBe('CONFIGURACAO');
    expect(agregarAlertas([alerta('SEM_FAIXA')], 1)[0].escopo).toBe('CONFIGURACAO');
  });

  /** Ciclo vazio: 0 de 0 não é "todo mundo" — seria promover sobre nada. */
  it('sem total informado não promove nada', () => {
    expect(agregarAlertas([alerta('SEM_VALOR_INFORMADO')])[0].escopo).toBe('INDIVIDUAL');
  });

  it('o de CONFIGURACAO vem PRIMEIRO na lista, que é a ordem de resolver', () => {
    const lista = agregarAlertas(
      [alerta('SEM_DADO_CADASTRAL', 'ESC'), alerta('SEM_VALOR_INFORMADO', 'META'), alerta('SEM_VALOR_INFORMADO', 'META')],
      2,
    );
    expect(lista[0].motivo).toBe('SEM_VALOR_INFORMADO'); // 2 de 2 -> configuracao
    expect(lista[0].escopo).toBe('CONFIGURACAO');
    expect(lista[1].escopo).toBe('INDIVIDUAL'); // 1 de 2
  });
});
