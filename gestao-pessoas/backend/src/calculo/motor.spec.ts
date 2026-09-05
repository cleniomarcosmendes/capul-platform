import { apurarColaborador, type CriterioConfigurado } from './motor.js';
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
